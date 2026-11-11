import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
// import estático de vite eliminado - se usa import dinámico en desarrollo
import { generateText, gateway } from "ai";
import { google } from "googleapis";
import firebaseConfig from "./firebase-applet-config.json";

// Load .env.local first if available, then fallback to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

// Create Express app and HTTP server
const app = express();
const httpServer = http.createServer(app);
app.use(express.json({ limit: "16mb" }));

const PORT = 3000;

// Vercel AI Gateway supplies authentication in previews and deployments.
const aiModel = gateway(process.env.ANACLETO_AI_MODEL || "google/gemini-2.5-flash");

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
      model: aiModel,
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
  const catalogId = String(item?.catalogItemId || "").trim();
  const description = normalizeCatalogName(item?.description);
  return catalog.find((row: any) => {
    const rowSku = String(row?.sku || row?.code || "").trim().toLowerCase();
    if (catalogId && String(row?.id || "") === catalogId) return true;
    if (sku && rowSku && sku === rowSku) return true;
    const rowName = normalizeCatalogName(row?.name || row?.description);
    return !!description && !!rowName && description === rowName;
  });
}

// ----------------------------------------------------
// 2. Quotes & Invoices AI Agent (/api/ai/quote-agent)
// ----------------------------------------------------
app.post("/api/ai/quote-agent", requireFirebaseAuth, rateLimitByUser("quote-agent", 30, 60_000), async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const currentQuote = req.body?.currentQuote || {};
    if (!message) return res.status(400).json({ error: "Mensagem obrigatória." });
    const catalog = Array.isArray(req.body?.catalog) ? req.body.catalog.slice(0, 250) : [];
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
    const response = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt: `Histórico recente:\\n${transcript}\\n\\nSolicitação atual: ${message}`,
      temperature: 0.1,
    });
    const raw = String(response.text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) throw new Error("Resposta de orçamento incompleta.");
    const items = parsed.items.map((item: any, index: number) => {
      const quantity = Number(item.quantity);
      if (!String(item.description || "").trim() || !Number.isFinite(quantity) || quantity <= 0) throw new Error("A IA retornou uma linha de orçamento inválida.");
      const match = findExactCatalogItem(item, catalog);
      const catalogPrice = match ? Number(match.price) : 0;
      const confirmed = !!match && Number.isFinite(catalogPrice) && catalogPrice >= 0;
      return {
        id: String(item.id || `ai-${index + 1}`),
        description: String(item.description).slice(0, 500),
        quantity,
        unitPrice: confirmed ? catalogPrice : 0,
        subtotal: Number((quantity * (confirmed ? catalogPrice : 0)).toFixed(2)),
        sku: confirmed ? String(match.sku || match.code || "") : String(item.sku || ""),
        catalogItemId: confirmed ? String(match.id || "") : "",
        priceSource: confirmed ? "catalog" : "pending",
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
      model: process.env.ANACLETO_AI_MODEL || "google/gemini-2.5-flash",
    });
    return res.status(502).json({
      error: "O agente de orçamento está temporariamente indisponível. Verifique a configuração do Vercel AI Gateway e tente novamente.",
      code: "QUOTE_AI_UNAVAILABLE",
    });
  }
});

app.post("/api/ai/budget-items", requireFirebaseAuth, rateLimitByUser("budget-items", 30, 60_000), async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim().slice(0, 6000);
    const language = String(req.body?.language || "pt").slice(0, 8);
    const catalog = Array.isArray(req.body?.catalog) ? req.body.catalog.slice(0, 250) : [];
    if (prompt.length < 5) return res.status(400).json({ error: "Descreva o serviço ou produto para orçar." });
    const response = await generateText({
      model: aiModel,
      temperature: 0.1,
      system: `Você é especialista em orçamentos de esquadrias de alumínio, vidros e fabricação sob medida. Responda somente JSON: {"items":[{"description":"...","qty":1,"price":0,"sku":"","catalogItemId":"","priceSource":"catalog|pending"}],"notes":"..."}. Idioma: ${language}. Catálogo real: ${JSON.stringify(catalog)}. Gere linhas técnicas com materiais, serviços, quantidades e medidas somente quando informadas. Não invente medidas ausentes; registre-as em notes. Só associe item do catálogo por SKU/código, ID ou nome completo EXATO. Informe sku/catalogItemId para validação. O servidor substituirá o preço pelo preço cadastrado; se não houver correspondência exata, price=0 e priceSource="pending". Nunca invente preço, custo, imposto ou valor.`,
      prompt,
    });
    const raw = String(response.text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items) || !parsed.items.length) throw new Error("A IA não retornou itens.");
    const items = parsed.items.map((item: any) => {
      const qty = Number(item.qty);
      if (!String(item.description || "").trim() || !Number.isFinite(qty) || qty <= 0) throw new Error("Linha inválida retornada pela IA.");
      const match = findExactCatalogItem(item, catalog);
      const catalogPrice = match ? Number(match.price) : 0;
      const confirmed = !!match && Number.isFinite(catalogPrice) && catalogPrice >= 0;
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
  const rawItems = Array.isArray(rawBudget?.items) ? rawBudget.items : pieces.map((piece: any) => {
    const material = String(piece.material || piece.name || "").toLowerCase();
    const match = catalogRows.find((item: any) => {
      const haystack = `${item.name || ""} ${item.sku || ""} ${item.category || ""}`.toLowerCase();
      return material.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word));
    });
    const quantity = Math.max(1, Number(piece.quantity) || 1);
    const unitPrice = Number(match?.price) || 0;
    return {
      pieceId: piece.id,
      description: piece.name || piece.material || "Componente técnico",
      sku: match?.sku || "",
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice,
      priceSource: match ? "catalogo" : "estimado",
    };
  });
  const items = rawItems.map((item: any, index: number) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    return { ...item, id: item.id || `budget-${index + 1}`, quantity, unitPrice, subtotal: quantity * unitPrice };
  });
  const subtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const labor = Math.max(0, Number(rawBudget?.labor) || 0);
  return { currency: rawBudget?.currency || "BRL", items, subtotal, labor, total: subtotal + labor, notes: rawBudget?.notes || "Valores sincronizados com o catálogo quando disponível." };
}

// ----------------------------------------------------
// 3. Project intake AI (/api/ai/project-intake)
// ----------------------------------------------------
app.post("/api/ai/project-intake", requireFirebaseAuth, rateLimitByUser("project-intake", 20, 60_000), async (req, res) => {
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
    const response = await generateText({
      model: aiModel,
      system: "Você é um analista de projetos. Organize os dados informados em JSON estrito. Não invente dimensões, cliente, preço ou código. Use strings vazias e zero quando desconhecidos. Responda somente com {name,code,category,client,summary,width,height,quantity,price}. width e height são milímetros quando explicitamente informados; price é BRL apenas se o usuário informar.",
      prompt: JSON.stringify({ name, description, sourceUrl }),
      temperature: 0.2,
    });
    const raw = String(response.text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const project = JSON.parse(raw);
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
app.post("/api/ai/technical-drawing", requireFirebaseAuth, rateLimitByUser("technical-drawing", 12, 60_000), async (req, res) => {
  try {
    const { prompt, currentDrawing, catalog = [] } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return res.status(400).json({ error: "Descripción técnica requerida" });
    }


    const systemPrompt = `
      Eres el Arquitecto e Ingeniero de Dibujo Técnico de "Anacleto Pro".
      El usuario describirá en lenguaje natural una pieza arquitectónica, mueble o estructura:
      (ej: "una mesa de madera de 120x80x75 cm con 4 patas", "un armario de 2 puertas de 180x60x200 cm", "una pieza en L de 90x90 cm con un corte a 45°", "ventana de aluminio corrediza de 150x120 cm con 2 hojas", etc.).

      Debes generar un proyecto técnico completo con TODAS las siguientes especificaciones.
      Catálogo disponible del taller (usa sus nombres, SKU y precios cuando coincidan; no inventes precios si hay coincidencia):
      ${JSON.stringify(Array.isArray(catalog) ? catalog.slice(0, 200) : [])}
      La salida también debe incluir presupuesto materializado con líneas, precio unitario, subtotal y total en BRL. Si no existe precio para una pieza, marca priceSource como "estimado" y usa un valor prudente.
      1. Título y categoría de la pieza.
      2. Dimensiones generales (ancho, alto, profundidad, unidad en cm o mm).
      3. Despiece detallado (BOM): Lista de componentes donde cada pieza tiene:
         - pieceNumber: 1, 2, 3...
         - name: tipo puzzle con número (ej: "Pieza 1 - Tablero superior", "Pieza 2 - Pata frontal izquierda", "Pieza 3 - Estante regulable", "Pieza 4 - Puerta batiente izquierda")
         - quantity: número de piezas
         - dimensions: { width, height, thickness, depth, unit }
         - material: tipo de material (ej: "Madera maciza de roble 30mm", "Aluminio serie 40 lacado negro", "Vidrio templado 8mm")
         - color: color hexadecimal elegante o tono para diferenciar en el dibujo
         - cutAngle: tipo de corte si aplica (ej: "90° recto", "Inglete a 45°")
      4. Cotas (dimension lines): Líneas de cota con flechas en los extremos y el valor numérico visible y legible.
      5. Proceso paso a paso estructurado exactamente en 5 fases de construcción:
         - Paso 1: "Definición de dimensiones generales" (muestra el volumen perimetral exterior con cotas principales ancho x alto x profundidad).
         - Paso 2: "Despiece" (muestra cada pieza separada, etiquetada con su nombre tipo puzzle, medidas y cantidad).
         - Paso 3: "Corte de cada pieza con sus cotas" (detalle de corte, ángulos como 45° o 90°, espesores y mecanizados).
         - Paso 4: "Ensamblaje tipo puzzle" (diagrama explosionado de ensamble con flechas de unión, orden de montaje y encaje).
         - Paso 5: "Resultado final con vista completa y medidas totales" (pieza 100% ensamblada, acabada con cotas finales y render técnico).
      6. Cada paso debe contener instrucciones claras y elementos de dibujo vectorial simples (rectángulos, líneas, textos, cotas) listos para renderizar en el lienzo SVG.

      RESPONDE ÚNICAMENTE EN JSON con la siguiente estructura:
      {
        "title": "Nombre descriptivo de la pieza",
        "assemblyInstructions": ["Instrucción de montaje 1"],
        "budget": {
          "currency": "BRL",
          "items": [{ "pieceId": "p1", "description": "Perfil", "sku": "", "quantity": 1, "unitPrice": 0, "subtotal": 0, "priceSource": "catalogo" }],
          "subtotal": 0,
          "labor": 0,
          "total": 0,
          "notes": ""
        },
        "description": "Descripción arquitectónica resumida",
        "category": "furniture" | "architectural" | "aluminum_window" | "glass_door" | "custom",
        "unit": "cm",
        "overallDimensions": { "width": 120, "height": 75, "depth": 80 },
        "pieces": [
          {
            "id": "p1",
            "pieceNumber": 1,
            "name": "Pieza 1 - Tablero superior",
            "quantity": 1,
            "dimensions": { "width": 120, "height": 3, "depth": 80, "unit": "cm" },
            "material": "Madera maciza / Aluminio",
            "color": "#D4AF37",
            "cutAngle": "90° recto"
          }
        ],
        "dimensionLines": [
          {
            "id": "dim-1",
            "label": "120 cm",
            "value": 120,
            "unit": "cm",
            "orientation": "horizontal",
            "start": { "x": 100, "y": 80 },
            "end": { "x": 500, "y": 80 },
            "offset": 20
          }
        ],
        "steps": [
          {
            "stepNumber": 1,
            "phaseName": "Paso 1: Definición de dimensiones generales",
            "title": "Dimensiones exteriores y envolvente",
            "description": "Verificación del espacio, cotas perimetrales y volumen total de trabajo.",
            "instructions": ["Comprobar escuadras y tolerancias perimetrales.", "Marcar cotas exteriores."]
          },
          {
            "stepNumber": 2,
            "phaseName": "Paso 2: Despiece",
            "title": "Lista de piezas identificadas tipo puzzle",
            "description": "Clasificación de tableros, perfiles, herrajes y elementos estructurales.",
            "instructions": ["Verificar cantidades de cada pieza según plano de corte."]
          },
          {
            "stepNumber": 3,
            "phaseName": "Paso 3: Corte de cada pieza con sus cotas",
            "title": "Dimensionado individual y mecanizado",
            "description": "Cortes rectos a 90° e ingletes a 45° con tolerancias milimétricas.",
            "instructions": ["Aplicar línea de corte limpia.", "Rotular cada pieza con su ID."]
          },
          {
            "stepNumber": 4,
            "phaseName": "Paso 4: Ensamblaje tipo puzzle",
            "title": "Secuencia de montaje y unión",
            "description": "Diagrama explosionado que indica el orden de unión y ajuste.",
            "instructions": ["Montar estructura base.", "Alinear uniones y asegurar fijaciones."]
          },
          {
            "stepNumber": 5,
            "phaseName": "Paso 5: Resultado final con vista completa y medidas totales",
            "title": "Producto terminado y revisión de calidad",
            "description": "Vista global ensamblada con verificación de cotas y solidez estructural.",
            "instructions": ["Comprobación final de estabilidad y cotas generales."]
          }
        ]
      }
    `;

    const response = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt: `Diseña y despieza la siguiente pieza arquitectónica o mueble: "${prompt}"`,
      temperature: 0.2,
    });

    const rawText = response.text || "{}";
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const drawingData = JSON.parse(jsonText);
    const pieces = Array.isArray(drawingData.pieces) ? drawingData.pieces : [];
    drawingData.assemblyInstructions = Array.isArray(drawingData.assemblyInstructions)
      ? drawingData.assemblyInstructions
      : drawingData.steps?.flatMap((step: any) => step.instructions || []) || [];
    drawingData.budget = normalizeTechnicalBudget(drawingData.budget, pieces, catalog);
    return res.status(200).json(drawingData);
  } catch (err: any) {
    console.error("Technical drawing AI error:", err);
    // Sophisticated smart fallback generator based on the prompt keywords
    const p = (req.body?.prompt || "").toLowerCase();
    const isTable = p.includes("mesa");
    const isWindow = p.includes("ventana") || p.includes("esquadria");
    const isWardrobe = p.includes("armario") || p.includes("closet");
    const isLPiece = p.includes("l") || p.includes("45");

    let title = "Pieza en L Arquitectónica con Corte a 45°";
    let width = 90;
    let height = 90;
    let depth = 40;
    let pieces: any[] = [];

    if (isTable) {
      title = "Mesa de Madera Maciza 120x80x75 cm";
      width = 120;
      height = 75;
      depth = 80;
      pieces = [
        { id: "p1", pieceNumber: 1, name: "Pieza 1 - Tablero superior", quantity: 1, dimensions: { width: 120, height: 4, depth: 80, unit: "cm" }, material: "Madera maciza de roble", color: "#C5A850", cutAngle: "90° recto" },
        { id: "p2", pieceNumber: 2, name: "Pieza 2 - Pata delantera izq.", quantity: 1, dimensions: { width: 8, height: 71, depth: 8, unit: "cm" }, material: "Madera de roble torneada", color: "#8C6D37", cutAngle: "90° recto" },
        { id: "p3", pieceNumber: 3, name: "Pieza 3 - Pata delantera der.", quantity: 1, dimensions: { width: 8, height: 71, depth: 8, unit: "cm" }, material: "Madera de roble torneada", color: "#8C6D37", cutAngle: "90° recto" },
        { id: "p4", pieceNumber: 4, name: "Pieza 4 - Pata trasera izq.", quantity: 1, dimensions: { width: 8, height: 71, depth: 8, unit: "cm" }, material: "Madera de roble torneada", color: "#735728", cutAngle: "90° recto" },
        { id: "p5", pieceNumber: 5, name: "Pieza 5 - Pata trasera der.", quantity: 1, dimensions: { width: 8, height: 71, depth: 8, unit: "cm" }, material: "Madera de roble torneada", color: "#735728", cutAngle: "90° recto" },
        { id: "p6", pieceNumber: 6, name: "Pieza 6 - Faldón de unión", quantity: 2, dimensions: { width: 104, height: 10, depth: 3, unit: "cm" }, material: "Madera maciza de roble", color: "#A88440", cutAngle: "90° recto" },
      ];
    } else if (isWardrobe) {
      title = "Armario de 2 Puertas 180x60x200 cm";
      width = 180;
      height = 200;
      depth = 60;
      pieces = [
        { id: "p1", pieceNumber: 1, name: "Pieza 1 - Panel lateral izquierdo", quantity: 1, dimensions: { width: 60, height: 200, depth: 2, unit: "cm" }, material: "Tablero melamina alta densidad", color: "#334155", cutAngle: "90° recto" },
        { id: "p2", pieceNumber: 2, name: "Pieza 2 - Panel lateral derecho", quantity: 1, dimensions: { width: 60, height: 200, depth: 2, unit: "cm" }, material: "Tablero melamina alta densidad", color: "#334155", cutAngle: "90° recto" },
        { id: "p3", pieceNumber: 3, name: "Pieza 3 - Techo y suelo superior/inferior", quantity: 2, dimensions: { width: 176, height: 60, depth: 2, unit: "cm" }, material: "Tablero melamina 19mm", color: "#475569", cutAngle: "90° recto" },
        { id: "p4", pieceNumber: 4, name: "Pieza 4 - Puerta batiente izq.", quantity: 1, dimensions: { width: 88, height: 194, depth: 2, unit: "cm" }, material: "Madera lacada con jaladera embutida", color: "#C5A850", cutAngle: "90° recto" },
        { id: "p5", pieceNumber: 5, name: "Pieza 5 - Puerta batiente der.", quantity: 1, dimensions: { width: 88, height: 194, depth: 2, unit: "cm" }, material: "Madera lacada con jaladera embutida", color: "#C5A850", cutAngle: "90° recto" },
      ];
    } else if (isWindow) {
      title = "Ventana de Aluminio Corrediza 150x120 cm";
      width = 150;
      height = 120;
      depth = 12;
      pieces = [
        { id: "p1", pieceNumber: 1, name: "Pieza 1 - Marco perimetral superior", quantity: 1, dimensions: { width: 150, height: 8, depth: 12, unit: "cm" }, material: "Perfil Aluminio Linha Suprema", color: "#1e293b", cutAngle: "Corte a 45° inglete" },
        { id: "p2", pieceNumber: 2, name: "Pieza 2 - Marco perimetral inferior c/ desague", quantity: 1, dimensions: { width: 150, height: 8, depth: 12, unit: "cm" }, material: "Perfil Aluminio Linha Suprema", color: "#1e293b", cutAngle: "Corte a 45° inglete" },
        { id: "p3", pieceNumber: 3, name: "Pieza 3 - Jambas laterales izq/der", quantity: 2, dimensions: { width: 8, height: 120, depth: 12, unit: "cm" }, material: "Perfil Aluminio Linha Suprema", color: "#1e293b", cutAngle: "Corte a 45° inglete" },
        { id: "p4", pieceNumber: 4, name: "Pieza 4 - Hoja corrediza izquierda", quantity: 1, dimensions: { width: 77, height: 114, depth: 4, unit: "cm" }, material: "Aluminio + Felpas acústicas", color: "#C5A850", cutAngle: "90° recto" },
        { id: "p5", pieceNumber: 5, name: "Pieza 5 - Hoja corrediza derecha", quantity: 1, dimensions: { width: 77, height: 114, depth: 4, unit: "cm" }, material: "Aluminio + Cierre caracol", color: "#C5A850", cutAngle: "90° recto" },
        { id: "p6", pieceNumber: 6, name: "Pieza 6 - Vidrio templado incoloro 6mm", quantity: 2, dimensions: { width: 70, height: 107, depth: 0.6, unit: "cm" }, material: "Vidrio templado NBR 7199", color: "#60a5fa", cutAngle: "Bordes pulidos" },
      ];
    } else {
      pieces = [
        { id: "p1", pieceNumber: 1, name: "Pieza 1 - Tramo principal A", quantity: 1, dimensions: { width: 90, height: 40, depth: 5, unit: "cm" }, material: "Estructura arquitectónica", color: "#C5A850", cutAngle: "Corte a 45° inglete" },
        { id: "p2", pieceNumber: 2, name: "Pieza 2 - Tramo en retorno B", quantity: 1, dimensions: { width: 90, height: 40, depth: 5, unit: "cm" }, material: "Estructura arquitectónica", color: "#38bdf8", cutAngle: "Corte a 45° inglete" },
        { id: "p3", pieceNumber: 3, name: "Pieza 3 - Escuadra interior de refuerzo", quantity: 2, dimensions: { width: 15, height: 15, depth: 3, unit: "cm" }, material: "Chapa de acero galvanizado", color: "#94a3b8", cutAngle: "90° recto" },
      ];
    }

    // The AI service is optional: always return a valid drawing so a provider
    // timeout, quota error, or malformed model response never becomes a 500.
    return res.status(200).json({
      _fallback: true,
      title: title,
      description: "Generado con motor técnico de arquitectura e ingeniería Anacleto Pro.",
      category: isWindow ? "aluminum_window" : isTable ? "furniture" : "architectural",
      unit: "cm",
      overallDimensions: { width, height, depth },
      pieces: pieces,
      dimensionLines: [
        { id: "d1", label: `${width} cm (Ancho total)`, value: width, unit: "cm", orientation: "horizontal", start: { x: 80, y: 50 }, end: { x: 520, y: 50 }, offset: 25 },
        { id: "d2", label: `${height} cm (Alto total)`, value: height, unit: "cm", orientation: "vertical", start: { x: 50, y: 80 }, end: { x: 50, y: 380 }, offset: 25 },
        { id: "d3", label: `${depth} cm (Profundidad)`, value: depth, unit: "cm", orientation: "diagonal", start: { x: 540, y: 80 }, end: { x: 570, y: 50 }, offset: 20 },
      ],
      steps: [
        {
          stepNumber: 1,
          phaseName: "Paso 1: Definición de dimensiones generales",
          title: "Delimitación perimetral y cotas envolventes",
          description: `Dimensiones nominales verificadas: ${width} cm de ancho x ${height} cm de alto x ${depth} cm de fondo.`,
          instructions: ["Comprobar espacio físico disponible.", "Verificar escuadras y tolerancias perimetrales."]
        },
        {
          stepNumber: 2,
          phaseName: "Paso 2: Despiece",
          title: "Lista de piezas identificadas tipo puzzle",
          description: `Inventario técnico con ${pieces.length} componentes rotulados y cubicados.`,
          instructions: ["Inspeccionar material de origen.", "Marcar piezas con su número identificador."]
        },
        {
          stepNumber: 3,
          phaseName: "Paso 3: Corte de cada pieza con sus cotas",
          title: "Dimensionado individual y mecanizado",
          description: "Cortes con precisión milimétrica, ingletes a 45° y taladros para fijación.",
          instructions: ["Ejecutar cortes siguiendo las cotas individuales.", "Limpiar rebabas y perfilar cantos."]
        },
        {
          stepNumber: 4,
          phaseName: "Paso 4: Ensamblaje tipo puzzle",
          title: "Secuencia de montaje y unión",
          description: "Montaje secuencial con flechas de ensamble y ajuste de fijaciones.",
          instructions: ["Presentar las piezas en seco.", "Ajustar uniones mediante fijaciones ocultas.", "Comprobar ángulos a 90°."]
        },
        {
          stepNumber: 5,
          phaseName: "Paso 5: Resultado final con vista completa y medidas totales",
          title: "Producto terminado y revisión de calidad",
          description: "Estructura final consolidada con todas las cotas y verificación de aplomo.",
          instructions: ["Comprobación de solidez mecánica.", "Limpieza final y entrega."]
        }
      ]
    });
  }
});

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
    model: gateway("google/gemini-2.5-flash"),
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, attachment] }],
    temperature: 0.1,
    maxOutputTokens,
  });
  const raw = response.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
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
