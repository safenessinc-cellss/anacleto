import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
// import estático de vite eliminado - se usa import dinámico en desarrollo
import { generateText } from "ai";
import { AI_CONFIG, getAIModel } from "./src/server/ai-config";
import { generateValidatedJson, parseAIJson } from "./src/server/ai-json";
import { loadCatalogFromFirestore, loadQuoteFromFirestore } from "./src/server/firestore-data";
import technicalDrawingHandler from "./api/technical-drawing";
import approvedSnapshotHandler from "./api/approved-snapshot";
import { google } from "googleapis";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

// Load .env.local first if available, then fallback to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

// Create Express app and HTTP server
const app = express();
const httpServer = http.createServer(app);
app.use(express.json({ limit: "16mb" }));

const PORT = 3000;

// Vercel AI Gateway supplies authentication in previews and deployments.
const aiModel = getAIModel("default");

const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
const ownerEmail = "safeness.c.a@gmail.com";

const requireFirebaseAuth: express.RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });
  if (!firebaseApiKey) return res.status(503).json({ error: "A verificação de autenticação não está configurada no servidor." });

  try {
    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!identityResponse.ok) return res.status(401).json({ error: "Sessão inválida ou expirada. Entre novamente." });
    const identity = await identityResponse.json() as { users?: Array<{ localId?: string; email?: string }> };
    const user = identity.users?.[0];
    if (!user?.localId || !user.email) return res.status(401).json({ error: "Conta autenticada inválida." });

    const email = user.email.toLowerCase();
    if (email === ownerEmail) {
      res.locals.firebaseUser = { uid: user.localId, email, role: "super_admin" };
      return next();
    }

    const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
    const documentId = encodeURIComponent(email);
    const roleUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/admins/${documentId}`;
    const roleResponse = await fetch(roleUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!roleResponse.ok) return res.status(403).json({ error: "Acesso pendente de aprovação ou perfil não autorizado." });
    const roleDocument = await roleResponse.json() as { fields?: { role?: { stringValue?: string } } };
    const role = roleDocument.fields?.role?.stringValue;
    if (!role) return res.status(403).json({ error: "Perfil de acesso não encontrado." });
    res.locals.firebaseUser = { uid: user.localId, email, role };
    return next();
  } catch (error) {
    console.error("Firebase API authentication error:", error);
    return res.status(503).json({ error: "Não foi possível validar a sessão no momento." });
  }
};

const requireQuoteRole: express.RequestHandler = (_req, res, next) => {
  const user = res.locals.firebaseUser as { role?: string } | undefined;
  if (user && ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "financeiro"].includes(user.role || "")) return next();
  return res.status(403).json({ error: "Seu perfil não tem autorização para operações comerciais e orçamentos." });
};

const requireFinanceRole: express.RequestHandler = (_req, res, next) => {
  const user = res.locals.firebaseUser as { role?: string } | undefined;
  if (user && ["super_admin", "super_usuario", "ceo", "admin", "financeiro"].includes(user.role || "")) return next();
  return res.status(403).json({ error: "Seu perfil não tem autorização para operações financeiras." });
};

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const rateLimitByUser = (bucket: string, limit: number, windowMs: number): express.RequestHandler => (req, res, next) => {
  const user = res.locals.firebaseUser as { uid?: string } | undefined;
  const key = `${bucket}:${user?.uid || req.ip}`;
  const now = Date.now();
  if (requestWindows.size > 5000) {
    for (const [entry, window] of requestWindows) {
      if (now - window.startedAt >= windowMs) requestWindows.delete(entry);
    }
  }
  const current = requestWindows.get(key);
  if (!current && requestWindows.size >= 10000) return res.status(429).json({ error: "Limite temporário de solicitações atingido. Tente novamente em instantes." });
  if (!current || now - current.startedAt >= windowMs) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= limit) return res.status(429).json({ error: "Muitas solicitações. Aguarde um momento e tente novamente." });
  current.count += 1;
  return next();
};


// ----------------------------------------------------
// 1. General AI Chat Proxy
// ----------------------------------------------------
app.post("/api/chat", requireFirebaseAuth, async (req, res) => {
  try {
    const { message, history, language = "es" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }


    const systemInstruction = `
      Eres el Asistente Técnico y Comercial de "Anacleto Pro", una plataforma SaaS moderna especializada en presupuestos inteligentes, facturación, CRM para empresas y Dibujo Técnico Arquitectónico para carpintería de aluminio, vidrio y mobiliario a medida.
      Idioma principal: ${language}.
      Sé conciso, técnico, profesional y resolutivo.
    `;

    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text || msg.content || "" }],
        });
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await generateText({
      model: getAIModel("chat"),
      system: systemInstruction,
      messages: contents.map((content) => ({
        role: content.role === "model" ? "assistant" : content.role,
        content: content.parts?.[0]?.text || "",
      })),
      temperature: 0.7,
    });

    const replyText = response.text || "No se pudo procesar la respuesta en este momento.";
    return res.json({ response: replyText });
  } catch (error: any) {
    console.error("Gemini chat error:", error);
    return res.status(500).json({
      error: "Error en el asistente de IA.",
      details: error?.message || String(error),
    });
  }
});

// ----------------------------------------------------
// 2. Quotes & Invoices AI Agent (/api/ai/quote-agent)
// ----------------------------------------------------

function normalizeCatalogName(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function findExactCatalogItem(item: any, catalog: any[]) {
  const sku = String(item?.sku || item?.code || "").trim().toLowerCase();
  const catalogId = String(item?.catalogItemId || item?.itemId || "").trim();
  const description = normalizeCatalogName(item?.description);
  return catalog.find((row: any) => {
    const rowSku = String(row?.sku || row?.code || "").trim().toLowerCase();
    const idMatches = !!catalogId && String(row?.id || "") === catalogId;
    const skuMatches = !!sku && !!rowSku && sku === rowSku;
    if (catalogId && sku) return idMatches && skuMatches;
    if (catalogId) return idMatches;
    if (sku) return skuMatches;
    const rowName = normalizeCatalogName(row?.name || row?.description);
    return !!description && !!rowName && description === rowName;
  });
}
function hasVerifiedCatalogPrice(row: any): boolean {
  if (!row || row.price === undefined || row.price === null || String(row.price).trim() === "") return false;
  const price = Number(row.price);
  return Number.isFinite(price) && price >= 0;
}

// ----------------------------------------------------
// 2. Quotes & Invoices AI Agent (/api/ai/quote-agent)
// ----------------------------------------------------
app.post("/api/ai/quote-agent", requireFirebaseAuth, requireQuoteRole, rateLimitByUser("quote-agent", 30, 60_000), async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const requestedQuote = req.body?.currentQuote && typeof req.body.currentQuote === "object" ? req.body.currentQuote : {};
    const quoteId = String(requestedQuote.id || "").trim();
    if (!quoteId) return res.status(400).json({ error: "Selecione um orçamento salvo antes de usar o agente." });
    const storedQuote = await loadQuoteFromFirestore(req, quoteId);
    if (!storedQuote) return res.status(404).json({ error: "Orçamento não encontrado no banco de dados." });
    const currentQuote = { ...storedQuote, id: quoteId };
    const storedQuoteItems = Array.isArray(storedQuote.items) ? storedQuote.items : [];
    if (!message) return res.status(400).json({ error: "Mensagem obrigatória." });
    const catalog = (await loadCatalogFromFirestore(req)).slice(0, 250);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10).map((entry: any) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      text: String(entry?.text || "").slice(0, 2000),
    })) : [];
    const systemPrompt = `
Você é o agente técnico de orçamentos da Anacleto Esquadrias.
Responda exclusivamente JSON válido: {"reply":"...","action":"update_quote|generate_invoice|none","items":[{"id":"...","description":"nome EXATO do catálogo quando houver correspondência","sku":"","catalogItemId":"","quantity":1,"unitPrice":0,"subtotal":0,"priceSource":"catalog|pending"}],"taxRate":0,"discountRate":0,"notes":""}.
Orçamento atual: ${JSON.stringify(currentQuote)}
Catálogo real: ${JSON.stringify(catalog)}
Regras obrigatórias:
- Preserve TODAS as linhas atuais, seus IDs, quantidades e preços quando o usuário não pedir alteração.
- Ao adicionar itens, devolva também todas as linhas que já existiam sem alterações.
- Use somente itens do catálogo com correspondência exata por SKU/código, ID ou nome completo. Informe sku e catalogItemId quando existirem.
- O servidor validará os preços contra o catálogo. Se não houver correspondência exata, unitPrice=0 e priceSource="pending".
- Nunca estime/invente preços, impostos, medidas ou custos. Medidas ausentes devem aparecer em notes como pendências.
- Só altere imposto ou desconto quando o usuário solicitar explicitamente.
- "generate_invoice" só pode ser retornado quando o usuário pedir explicitamente a emissão da fatura. Isso NÃO aprova o orçamento.
- Se não houver alteração solicitada, use action="none".
`;
    const transcript = history.map((entry: any) => `${entry.role}: ${entry.text}`).join("\\n");
    const parsed = await generateValidatedJson({
      capability: "quote",
      system: systemPrompt,
      prompt: `Histórico recente:\\n${transcript}\\n\\nSolicitação atual: ${message}`,
      validate: (value: any) => {
        if (!value || typeof value !== "object" || !Array.isArray(value.items)) throw new Error("Resposta de orçamento incompleta.");
        if (value.items.length > 150) throw new Error("O orçamento excede o limite de 150 linhas.");
        for (const item of value.items) {
          const quantity = Number(item?.quantity);
          if (!String(item?.description || "").trim() || !Number.isFinite(quantity) || quantity <= 0) throw new Error("A IA retornou uma linha de orçamento inválida.");
        }
        return value;
      },
    });
    const items = parsed.items.map((item: any, index: number) => {
      const quantity = Number(item.quantity);
      if (!String(item.description || "").trim() || !Number.isFinite(quantity) || quantity <= 0) throw new Error("A IA retornou uma linha de orçamento inválida.");
      const match = findExactCatalogItem(item, catalog);
      const existingItem = Array.isArray(currentQuote.items)
        ? currentQuote.items.find((row: any) => String(row?.id || "") === String(item.id || ""))
        : undefined;
      const catalogPrice = match ? Number(match.price) : 0;
      const confirmed = hasVerifiedCatalogPrice(match) && Number.isFinite(catalogPrice) && catalogPrice >= 0;
      const storedExistingItem = storedQuoteItems.find((row: any) => String(row?.id || "") === String(existingItem?.id || ""));
      const existingPrice = Number(storedExistingItem?.unitPrice);
      const hasStoredPrice = storedExistingItem?.unitPrice !== undefined && storedExistingItem?.unitPrice !== null && String(storedExistingItem.unitPrice).trim() !== "";
      const preservedExistingPrice = !confirmed && !!storedExistingItem && hasStoredPrice && Number.isFinite(existingPrice) && existingPrice >= 0;
      const unitPrice = confirmed ? catalogPrice : preservedExistingPrice ? existingPrice : 0;
      return {
        id: String(item.id || `ai-${index + 1}`),
        itemId: String(match?.id || item.itemId || existingItem?.itemId || ""),
        description: String(item.description).slice(0, 500),
        quantity,
        unitPrice,
        subtotal: Number((quantity * unitPrice).toFixed(2)),
        sku: confirmed ? String(match.sku || match.code || "") : String(item.sku || existingItem?.sku || ""),
        catalogItemId: confirmed ? String(match.id || "") : String(item.catalogItemId || existingItem?.catalogItemId || ""),
        priceSource: confirmed ? "catalog" : preservedExistingPrice ? "existing" : "pending",
      };
    });
    const taxRate = parsed.taxRate === undefined ? Number(currentQuote.taxRate || 0) : Number(parsed.taxRate);
    const discountRate = parsed.discountRate === undefined ? Number(currentQuote.discountRate || 0) : Number(parsed.discountRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
      throw new Error("Percentual de imposto ou desconto inválido.");
    }
    return res.json({
      reply: String(parsed.reply || "Itens preparados. Confirme as medidas e os preços pendentes antes de aprovar."),
      action: ["generate_invoice", "none"].includes(parsed.action) ? parsed.action : "update_quote",
      items,
      taxRate,
      discountRate,
      notes: String(parsed.notes || ""),
    });
  } catch (err: any) {
    console.error("Quote agent error:", {
      message: err?.message || String(err),
      name: err?.name || "Error",
      cause: err?.cause?.message || err?.cause || null,
      statusCode: err?.statusCode || err?.status || null,
      model: AI_CONFIG.quote.model,
    });
    return res.status(502).json({
      error: "O agente de orçamento está temporariamente indisponível. Verifique a configuração do Vercel AI Gateway e tente novamente.",
      code: "QUOTE_AI_UNAVAILABLE",
    });
  }
});

app.post("/api/ai/budget-items", requireFirebaseAuth, requireQuoteRole, rateLimitByUser("budget-items", 30, 60_000), async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim().slice(0, 6000);
    const language = String(req.body?.language || "pt").slice(0, 8);
    const catalog = (await loadCatalogFromFirestore(req)).slice(0, 250);
    if (prompt.length < 5) return res.status(400).json({ error: "Descreva o serviço ou produto para orçar." });
    const parsed = await generateValidatedJson({
      capability: "budget",
      system: `Você é especialista em orçamentos de esquadrias de alumínio, vidros e fabricação sob medida. Responda somente JSON: {"items":[{"description":"...","qty":1,"price":0,"sku":"","catalogItemId":"","priceSource":"catalog|pending"}],"notes":"..."}. Idioma: ${language}. Catálogo real: ${JSON.stringify(catalog)}. Gere linhas técnicas com materiais, serviços, quantidades e medidas somente quando informadas. Não invente medidas ausentes; registre-as em notes. Só associe item do catálogo por SKU/código, ID ou nome completo EXATO. Informe sku/catalogItemId para validação. O servidor substituirá o preço pelo preço cadastrado; se não houver correspondência exata, price=0 e priceSource="pending". Nunca invente preço, custo, imposto ou valor.`,
      prompt,
      validate: (value: any) => {
        if (!Array.isArray(value?.items) || !value.items.length || value.items.length > 150) throw new Error("A IA não retornou uma lista válida de itens.");
        for (const item of value.items) {
          const qty = Number(item?.qty);
          if (!String(item?.description || "").trim() || !Number.isFinite(qty) || qty <= 0) throw new Error("Linha inválida retornada pela IA.");
        }
        return value;
      },
    });
    const items = parsed.items.map((item: any) => {
      const qty = Number(item.qty);
      if (!String(item.description || "").trim() || !Number.isFinite(qty) || qty <= 0) throw new Error("Linha inválida retornada pela IA.");
      const match = findExactCatalogItem(item, catalog);
      const catalogPrice = match ? Number(match.price) : 0;
      const confirmed = hasVerifiedCatalogPrice(match) && Number.isFinite(catalogPrice) && catalogPrice >= 0;
      return {
        description: String(item.description).slice(0, 500),
        qty,
        price: confirmed ? catalogPrice : 0,
        sku: confirmed ? String(match.sku || match.code || "") : String(item.sku || ""),
        catalogItemId: confirmed ? String(match.id || "") : "",
        priceSource: confirmed ? "catalog" : "pending",
      };
    });
    return res.json({ items, notes: String(parsed.notes || "") });
  } catch (err: any) {
    console.error("Budget items AI error:", err?.message || err);
    return res.status(502).json({ error: "Falha ao gerar os itens do orçamento. Nenhum preço sem confirmação no catálogo foi aplicado.", code: "BUDGET_AI_UNAVAILABLE" });
  }
});

function normalizeTechnicalBudget(rawBudget: any, pieces: any[], catalog: any[]) {
  const catalogRows = Array.isArray(catalog) ? catalog : [];
  const rawItems = Array.isArray(rawBudget?.items) ? rawBudget.items : pieces.map((piece: any) => ({
    pieceId: piece.id,
    description: piece.name || piece.material || "Componente técnico",
    quantity: Math.max(1, Number(piece.quantity) || 1),
  }));
  // Preços do orçamento técnico só podem vir de uma correspondência exata no catálogo.
  // Nunca aceitar preço estimado pela IA nem associação por palavras parcialmente coincidentes.
  const items = rawItems.map((item: any, index: number) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const match = findExactCatalogItem(item, catalogRows);
    const catalogPrice = match ? Number(match.price) : 0;
    const confirmed = hasVerifiedCatalogPrice(match) && Number.isFinite(catalogPrice) && catalogPrice >= 0;
    const unitPrice = confirmed ? catalogPrice : 0;
    return {
      ...item,
      id: item.id || `budget-${index + 1}`,
      sku: confirmed ? String(match.sku || match.code || "") : String(item.sku || ""),
      catalogItemId: confirmed ? String(match.id || "") : "",
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice,
      priceSource: confirmed ? "catalogo" : "pendente",
    };
  });
  const subtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const labor = Math.max(0, Number(rawBudget?.labor) || 0);
  return { currency: rawBudget?.currency || "BRL", items, subtotal, labor, total: subtotal + labor, notes: rawBudget?.notes || "Valores sincronizados com o catálogo quando disponível." };
}

// ----------------------------------------------------
// 3. Project intake AI (/api/ai/project-intake)
// ----------------------------------------------------
app.post("/api/ai/project-intake", requireFirebaseAuth, requireQuoteRole, rateLimitByUser("project-intake", 20, 60_000), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 180);
    const description = String(req.body?.description || "").trim().slice(0, 10000);
    const sourceUrl = String(req.body?.sourceUrl || "").trim().slice(0, 2000);
    if (!description) return res.status(400).json({ error: "Descreva o projeto para a IA organizar." });
    if (sourceUrl) {
      let parsed: URL;
      try { parsed = new URL(sourceUrl); } catch { return res.status(400).json({ error: "Endereço de referência inválido." }); }
      if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).json({ error: "O endereço deve usar HTTP ou HTTPS." });
    }
    const project = await generateValidatedJson({
      capability: "projectIntake",
      system: "Você é um analista de projetos. Organize os dados informados em JSON estrito. Não invente dimensões, cliente, preço ou código. Use strings vazias e zero quando desconhecidos. Responda somente com {name,code,category,client,summary,width,height,quantity,price}. width e height são milímetros quando explicitamente informados; price é BRL apenas se o usuário informar.",
      prompt: JSON.stringify({ name, description, sourceUrl }),
      validate: (value: any) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta da IA inválida.");
        for (const field of ["name", "code", "category", "client", "summary"]) if (value[field] !== undefined && typeof value[field] !== "string") throw new Error("Campo textual inválido: " + field);
        for (const field of ["width", "height", "quantity", "price"]) if (value[field] !== undefined && !Number.isFinite(Number(value[field]))) throw new Error("Campo numérico inválido: " + field);
        return value;
      },
    });
    if (!project || typeof project !== "object" || Array.isArray(project)) throw new Error("Resposta da IA inválida.");
    return res.json({ project: {
      name: String(project.name || name || "Novo projeto").slice(0, 180),
      code: String(project.code || "").slice(0, 80),
      category: String(project.category || "Projeto").slice(0, 80),
      client: String(project.client || "").slice(0, 180),
      summary: String(project.summary || description).slice(0, 12000),
      width: Number(project.width) > 0 ? Number(project.width) : 0,
      height: Number(project.height) > 0 ? Number(project.height) : 0,
      quantity: Number(project.quantity) > 0 ? Number(project.quantity) : 1,
      price: Number(project.price) >= 0 ? Number(project.price) : 0,
    }});
  } catch (error: any) {
    console.error("Project intake AI error:", error?.message || error);
    return res.status(502).json({ error: "A IA não conseguiu estruturar o projeto agora. Tente novamente ou importe os arquivos sem IA." });
  }
});

// ----------------------------------------------------
// 4. Technical Drawing AI Agent (/api/ai/technical-drawing)
// ----------------------------------------------------
app.post("/api/ai/technical-drawing", (req, res) => technicalDrawingHandler(req, res));
app.all("/api/approved-snapshot", (req, res) => approvedSnapshotHandler(req, res));

// Setup Vite Dev Server / Serve build static files
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.on("error", (err: any) => {
    console.error("HTTP server error:", err);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Anacleto Pro platform running on port ${PORT}`);
  });
};

// Vercel executa o Express como função serverless; não abra uma porta TCP durante a inicialização.
// O listener local só é iniciado fora do ambiente Vercel.
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Express startup failed:", err);
  });
}


// ============ Google Calendar Endpoint ============
app.post("/api/create-calendar-event", requireFirebaseAuth, async (req, res) => {
  try {
    const { name, email, phone, service, address, preferDate, preferTime, notes } = req.body;
    if (!name || !preferDate || !preferTime) {
      return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
    }

    // Autenticación con cuenta de servicio (JSON en variable de entorno)
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      console.warn("GOOGLE_SERVICE_ACCOUNT_JSON no configurado; se omite Calendar.");
      return res.status(200).json({ success: false, skipped: true, reason: "No credentials" });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsJson),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const calendar = google.calendar({ version: "v3", auth });

    const startDateTime = `${preferDate}T${preferTime}:00`;
    const endHour = String(parseInt(preferTime.split(":")[0], 10) + 1).padStart(2, "0");
    const endDateTime = `${preferDate}T${endHour}:${preferTime.split(":")[1]}:00`;

    const event = {
      summary: `Visita Técnica — ${name}`,
      description: [
        `Cliente: ${name}`,
        `Telefone: ${phone || "-"}`,
        email ? `Email: ${email}` : null,
        `Serviço: ${service || "-"}`,
        `Endereço: ${address || "-"}`,
        notes ? `Notas: ${notes}` : null,
      ].filter(Boolean).join("\n"),
      location: address || "",
      start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
    };

    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log(`✅ Evento creado en Calendar: ${response.data.id}`);
    return res.json({ success: true, eventId: response.data.id, htmlLink: response.data.htmlLink });
  } catch (err: any) {
    console.error("❌ Error creando evento en Calendar:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Error desconocido" });
  }
});


async function extractFinancialDocument(data: string, mimeType: string, fileName: string, prompt: string, maxOutputTokens = 4000) {
  const binary = Buffer.from(data, "base64");
  const attachment = mimeType === "application/pdf"
    ? { type: "file" as const, data: binary, mediaType: mimeType, filename: fileName.slice(0, 120) }
    : { type: "image" as const, image: binary, mediaType: mimeType };
  const response = await generateText({
    model: getAIModel("documentExtraction"),
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, attachment] }],
    temperature: 0.1,
    maxOutputTokens,
  });
  const validate = (value: any) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Documento sem objeto de dados válido.");
    return value;
  };
  try {
    return parseAIJson(response.text, validate);
  } catch (firstError) {
    const repaired = await generateText({
      model: getAIModel("documentExtraction"),
      system: "Corrija somente a estrutura JSON da extração. Não invente, complete ou altere nenhum dado do documento. Retorne apenas JSON válido.",
      prompt: "A extração não passou no parser. Erro: " + String((firstError as Error)?.message || firstError) + "\nResposta original:\n" + String(response.text || "").slice(0, 30000),
      temperature: 0,
      maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_CONFIG.documentExtraction.timeoutMs),
    });
    return parseAIJson(repaired.text, validate);
  }
}

// ============ FINANCIAL AI: Extraer datos de boleto ============
app.post("/api/ai/financial-extract", requireFirebaseAuth, requireFinanceRole, rateLimitByUser("financial-ai", 8, 60_000), async (req, res) => {
  try {
    const { data, mimeType, fileName } = req.body || {};
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (typeof data !== "string" || !data || data.length > 14_000_000) return res.status(400).json({ error: "Envie um documento de até 10 MB." });
    if (!allowedMimeTypes.includes(mimeType)) return res.status(415).json({ error: "Formato não suportado. Use PDF, JPG, PNG ou WEBP." });
    const prompt = "Analise este boleto ou conta a pagar brasileira. Extraia somente dados visíveis, sem inventar. Responda APENAS JSON válido: { \"beneficiary\":\"\", \"cnpj\":\"\", \"amount\":0, \"dueDate\":\"YYYY-MM-DD\", \"digitableLine\":\"\", \"description\":\"\" }. Se algum dado não estiver legível, use string vazia ou zero.";
    const parsed = await extractFinancialDocument(data, mimeType, String(fileName || "documento"), prompt, 1800);
    return res.json({
      beneficiary: String(parsed.beneficiary || "").slice(0, 180),
      cnpj: String(parsed.cnpj || "").replace(/\D/g, "").slice(0, 14),
      amount: Math.max(0, Number(parsed.amount) || 0),
      dueDate: String(parsed.dueDate || "").slice(0, 10),
      digitableLine: String(parsed.digitableLine || "").replace(/[^0-9. ]/g, "").slice(0, 80),
      description: String(parsed.description || "Boleto bancário").slice(0, 300),
      extractedBy: "Vercel AI Gateway",
    });
  } catch (err: any) {
    console.error("Financial AI error:", err?.message || err);
    return res.status(422).json({ error: "Não foi possível interpretar o documento com segurança. Revise a imagem ou preencha manualmente." });
  }
});

// ============ COMPRAS: leitura inteligente de documentos ============
app.post("/api/ai/purchase-extract", requireFirebaseAuth, requireFinanceRole, rateLimitByUser("purchase-ai", 8, 60_000), async (req, res) => {
  try {
    const { data, mimeType, fileName } = req.body || {};
    if (typeof data !== "string" || !data || data.length > 14_000_000) return res.status(400).json({ error: "Envie um documento de até 10 MB." });
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(mimeType)) return res.status(415).json({ error: "Formato não suportado. Use PDF, JPG, PNG ou WEBP." });
    const prompt = "Você é um analista financeiro e fiscal brasileiro. Leia a nota fiscal, boleto, recibo, orçamento ou documento de compra. Extraia apenas dados visíveis, sem inventar. Responda APENAS JSON válido: { \"documentType\":\"nfe|danfe|supplier_quote|purchase_order|boleto|receipt|other\", \"supplierName\":\"\", \"supplierCnpj\":\"\", \"documentNumber\":\"\", \"accessKey\":\"\", \"issueDate\":\"YYYY-MM-DD\", \"dueDate\":\"YYYY-MM-DD\", \"currency\":\"BRL\", \"total\":0, \"tax\":0, \"description\":\"\", \"digitableLine\":\"\", \"barcode\":\"\", \"payerName\":\"\", \"payerCnpj\":\"\", \"items\":[{\"description\":\"\",\"sku\":\"\",\"quantity\":1,\"unit\":\"un\",\"unitPrice\":0,\"total\":0}], \"confidence\":\"high|medium|low\", \"warnings\":[] }. Use string vazia, zero ou lista vazia quando ausente. Não confunda CNPJ do emitente com destinatário/pagador. Valores em reais. Limite itens a 100. Arquivo: " + String(fileName || "").slice(0, 120);
    const parsed = await extractFinancialDocument(data, mimeType, String(fileName || "documento"), prompt, 5000);
    if (!parsed || typeof parsed !== "object") throw new Error("A IA não retornou dados estruturados.");
    parsed.documentType = String(parsed.documentType || "other");
    parsed.supplierName = String(parsed.supplierName || "").slice(0, 180);
    parsed.supplierCnpj = String(parsed.supplierCnpj || "").replace(/\D/g, "").slice(0, 14);
    parsed.documentNumber = String(parsed.documentNumber || "").slice(0, 80);
    parsed.accessKey = String(parsed.accessKey || "").replace(/\D/g, "").slice(0, 44);
    parsed.issueDate = String(parsed.issueDate || "").slice(0, 10);
    parsed.dueDate = String(parsed.dueDate || "").slice(0, 10);
    parsed.total = Math.max(0, Number(parsed.total) || 0);
    parsed.tax = Math.max(0, Number(parsed.tax) || 0);
    parsed.description = String(parsed.description || "").slice(0, 300);
    parsed.digitableLine = String(parsed.digitableLine || "").replace(/[^0-9. ]/g, "").slice(0, 80);
    parsed.barcode = String(parsed.barcode || "").replace(/\D/g, "").slice(0, 48);
    parsed.payerName = String(parsed.payerName || "").slice(0, 180);
    parsed.payerCnpj = String(parsed.payerCnpj || "").replace(/\D/g, "").slice(0, 14);
    parsed.items = Array.isArray(parsed.items) ? parsed.items.slice(0, 100).map((item: any) => ({
      description: String(item.description || "").slice(0, 300), sku: String(item.sku || "").slice(0, 80),
      quantity: Math.max(0, Number(item.quantity) || 0), unit: String(item.unit || "un").slice(0, 20),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0), total: Math.max(0, Number(item.total) || 0),
    })) : [];
    parsed.warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map((warning: any) => String(warning).slice(0, 240)).slice(0, 20) : [];
    parsed.confidence = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
    return res.json(parsed);
  } catch (error: any) {
    console.error("Purchase document extraction error:", error?.message || error);
    return res.status(422).json({ error: "Não foi possível interpretar o documento com segurança. Revise o PDF ou preencha manualmente." });
  }
});

// ============ Mercado Pago: PIX real e link de pagamento ============
function mercadoPagoToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
}

app.get("/api/payments/config-status", (_req, res) => {
  const token = mercadoPagoToken();
  return res.json({
    configured: Boolean(token),
    provider: "Mercado Pago",
    pixEnabled: Boolean(token),
    cardCheckoutEnabled: Boolean(token),
    credentialsLocation: "server_environment",
  });
});

app.post("/api/payments/pix", requireFirebaseAuth, requireFinanceRole, rateLimitByUser("payment-pix", 5, 60_000), async (req, res) => {
  try {
    const token = mercadoPagoToken();
    if (!token) return res.status(503).json({ error: "Integração Mercado Pago não configurada no servidor. Configure MERCADO_PAGO_ACCESS_TOKEN nas variáveis de ambiente do Vercel." });
    const amount = Number(req.body?.amount);
    const description = String(req.body?.description || "").trim().slice(0, 250);
    const payerEmail = String(req.body?.payerEmail || "").trim();
    const externalReference = String(req.body?.payableId || "").trim().slice(0, 100);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return res.status(400).json({ error: "Valor de cobrança inválido." });
    if (!description) return res.status(400).json({ error: "Descrição obrigatória." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) return res.status(400).json({ error: "Informe um e-mail válido do pagador para gerar o PIX." });

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `anacleto-pix-${externalReference || "charge"}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
      body: JSON.stringify({
        transaction_amount: Math.round(amount * 100) / 100,
        description,
        payment_method_id: "pix",
        external_reference: externalReference || undefined,
        payer: { email: payerEmail },
      }),
    });
    const payment = await response.json();
    if (!response.ok) {
      console.error("Mercado Pago PIX API error:", response.status, payment?.message || payment?.error);
      return res.status(response.status >= 400 && response.status < 500 ? 422 : 502).json({ error: payment?.message || "Não foi possível gerar a cobrança PIX no Mercado Pago.", details: payment?.cause?.[0]?.description });
    }
    const transaction = payment?.point_of_interaction?.transaction_data;
    if (!transaction?.qr_code || !transaction?.qr_code_base64) {
      return res.status(502).json({ error: "O Mercado Pago não retornou os dados do QR Code PIX." });
    }
    return res.json({
      paymentId: String(payment.id),
      status: payment.status,
      qrCode: `data:image/png;base64,${transaction.qr_code_base64}`,
      copyPaste: transaction.qr_code,
      ticketUrl: transaction.ticket_url || "",
    });
  } catch (err: any) {
    console.error("Mercado Pago PIX error:", err?.message || err);
    return res.status(500).json({ error: "Falha ao comunicar com o Mercado Pago." });
  }
});

app.post("/api/payments/mercado-pago-link", requireFirebaseAuth, requireFinanceRole, rateLimitByUser("payment-link", 5, 60_000), async (req, res) => {
  try {
    const token = mercadoPagoToken();
    if (!token) return res.status(503).json({ error: "Integração Mercado Pago não configurada no servidor. Configure MERCADO_PAGO_ACCESS_TOKEN nas variáveis de ambiente do Vercel." });
    const amount = Number(req.body?.amount);
    const description = String(req.body?.description || "").trim().slice(0, 250);
    const payerEmail = String(req.body?.payerEmail || "").trim();
    const externalReference = String(req.body?.payableId || "").trim().slice(0, 100);
    const payerName = String(req.body?.payerName || "").trim().slice(0, 120);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return res.status(400).json({ error: "Valor de cobrança inválido." });
    if (!description) return res.status(400).json({ error: "Descrição obrigatória." });
    if (payerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) return res.status(400).json({ error: "E-mail do pagador inválido." });

    const baseUrl = (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")).replace(/\/$/, "");
    const preferenceBody: any = {
      items: [{ id: externalReference || "anacleto-charge", title: description, quantity: 1, currency_id: "BRL", unit_price: Math.round(amount * 100) / 100 }],
      external_reference: externalReference || undefined,
      statement_descriptor: "ANACLETO",
      metadata: { source: "anacleto", payable_id: externalReference || "" },
    };
    if (payerEmail) preferenceBody.payer = { email: payerEmail, name: payerName || undefined };
    if (baseUrl) {
      preferenceBody.back_urls = { success: `${baseUrl}/?payment=success`, pending: `${baseUrl}/?payment=pending`, failure: `${baseUrl}/?payment=failure` };
    }
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(preferenceBody),
    });
    const preference = await response.json();
    if (!response.ok) {
      console.error("Mercado Pago preference API error:", response.status, preference?.message || preference?.error);
      return res.status(response.status >= 400 && response.status < 500 ? 422 : 502).json({ error: preference?.message || "Não foi possível criar o link de pagamento.", details: preference?.cause?.[0]?.description });
    }
    const initPoint = preference.init_point || preference.sandbox_init_point;
    if (!initPoint) return res.status(502).json({ error: "O Mercado Pago não retornou o link de checkout." });
    return res.json({ preferenceId: preference.id, paymentUrl: initPoint });
  } catch (err: any) {
    console.error("Mercado Pago preference error:", err?.message || err);
    return res.status(500).json({ error: "Falha ao comunicar com o Mercado Pago." });
  }
});

app.post("/api/payments/webhook", async (req, res) => {
  // Acknowledgement only. Reconciliation/signature verification should be configured
  // before this endpoint is used to update financial records automatically.
  console.info("Mercado Pago webhook received", req.query?.type || req.body?.type || "unknown");
  return res.status(200).json({ received: true });
});

export default app;
