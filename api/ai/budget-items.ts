import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };
import { GoogleGenAI, Type } from "@google/genai";

const OWNER_EMAIL = "safeness.c.a@gmail.com";
const ALLOWED_ROLES = ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador"];

async function authenticate(token: string) {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
  if (!apiKey) throw Object.assign(new Error("Configuração Firebase ausente no servidor."), { statusCode: 503 });
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw Object.assign(new Error("Sessão inválida ou expirada."), { statusCode: 401 });
  const identity: any = await response.json();
  const user = identity.users?.[0];
  if (!user?.localId || !user?.email) throw Object.assign(new Error("Usuário não autenticado."), { statusCode: 401 });
  if (String(user.email).toLowerCase() === OWNER_EMAIL) return user;
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  const roleUrl = "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId +
    "/databases/" + databaseId + "/documents/admins/" + encodeURIComponent(String(user.email).toLowerCase());
  const roleResponse = await fetch(roleUrl, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(4000) });
  if (!roleResponse.ok) throw Object.assign(new Error("Acesso pendente de aprovação ou perfil não autorizado."), { statusCode: 403 });
  const roleDoc: any = await roleResponse.json();
  const role = String(roleDoc.fields?.role?.stringValue || "");
  if (!ALLOWED_ROLES.includes(role)) throw Object.assign(new Error("Seu perfil não pode gerar orçamentos."), { statusCode: 403 });
  return user;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          qty: { type: Type.NUMBER },
          sku: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: ["description", "qty", "sku", "notes"],
      },
    },
    notes: { type: Type.STRING },
  },
  required: ["items", "notes"],
};

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });
    await authenticate(token);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const prompt = String(body.prompt || "").trim().slice(0, 6000);
    const language = String(body.language || "pt").slice(0, 8);
    const catalog = (Array.isArray(body.catalog) ? body.catalog : []).slice(0, 150).map((row: any) => ({
      id: String(row.id || "").slice(0, 100),
      name: String(row.name || "").slice(0, 180),
      sku: String(row.sku || "").slice(0, 80),
      category: String(row.category || "").slice(0, 80),
      unit: String(row.unit || "un").slice(0, 20),
    })).filter((row: any) => row.name);
    if (prompt.length < 5) return res.status(400).json({ error: "Descreva o serviço ou produto para orçar." });
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "IA indisponível: configure GEMINI_API_KEY no Vercel." });
    const client = new GoogleGenAI({ apiKey });
    const model = (process.env.ANACLETO_BUDGET_MODEL || process.env.ANACLETO_AI_MODEL || "gemini-3.8-flash").replace(/^google\//, "");
    const deadline = Date.now() + 40_000;
    let result: any;
    let lastProviderError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 1_500) break;
      try {
        result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: `Você é o engenheiro orçamentista da Anacleto Esquadrias. Organize o pedido em linhas de orçamento no idioma ${language}. Use o catálogo fornecido apenas para reconhecer nomes, códigos e unidades; nunca invente códigos nem quantidades que dependam de medidas ausentes. Se faltar informação, mantenha uma linha pendente e explique exatamente o que falta. Não gere preço. Todos os valores serão preenchidos e conferidos pelo usuário. Catálogo de referência: ${JSON.stringify(catalog)}`,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1,
        maxOutputTokens: 5000,
        abortSignal: AbortSignal.timeout(Math.min(remaining, attempt === 0 ? Math.max(5_000, remaining - 1_500) : remaining)),
      },
    });
        break;
      } catch (providerError: any) {
        lastProviderError = providerError;
        const status = Number(providerError?.status || providerError?.statusCode || 0);
        const retryable = [408, 429, 500, 502, 503, 504].includes(status) || /high demand|temporarily unavailable|resource exhausted/i.test(String(providerError?.message || ""));
        console.error("[BUDGET_ITEMS_AI] provider failure", { model, status, attempt, message: String(providerError?.message || providerError).slice(0, 800) });
        if (attempt === 0 && retryable && Date.now() + 500 < deadline) { await new Promise(resolve => setTimeout(resolve, 350)); continue; }
        break;
      }
    }
    if (!result) throw Object.assign(new Error(String(lastProviderError?.message || "Provedor de IA indisponível.")), { statusCode: Number(lastProviderError?.status || lastProviderError?.statusCode || 503), code: "BUDGET_AI_PROVIDER_FAILED" });
    const raw = result.text || "";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new Error("A IA retornou uma resposta que não pôde ser interpretada."); }
    if (!Array.isArray(parsed.items) || !parsed.items.length || parsed.items.length > 100) {
      throw new Error("A IA não retornou uma lista válida de itens.");
    }
    const items = parsed.items.map((item: any) => {
      const description = String(item.description || "").trim().slice(0, 500);
      const quantity = Number(item.qty);
      if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
        throw new Error("A IA retornou uma linha com descrição ou quantidade inválida.");
      }
      const sku = String(item.sku || "").trim().slice(0, 80);
      const exactMatch = catalog.find((row: any) => sku && row.sku.toLowerCase() === sku.toLowerCase());
      return {
        description,
        qty: quantity,
        price: 0,
        sku: exactMatch ? exactMatch.sku : "",
        catalogItemId: exactMatch ? exactMatch.id : "",
        priceSource: "pending",
        notes: String(item.notes || (exactMatch ? "Código identificado no catálogo; preço pendente de conferência." : "Identificação e preço pendentes de conferência.")).slice(0, 500),
      };
    });
    return res.status(200).json({ items, notes: String(parsed.notes || "").slice(0, 2000), pricingPolicy: "manual_review_required" });
  } catch (error: any) {
    const status = Number(error?.statusCode || 0);
    const requestId = String(req.headers["x-vercel-id"] || req.headers["x-request-id"] || "");
    console.error("[BUDGET_ITEMS_AI] request failed", { requestId, name: error?.name || "Error", code: error?.code || "BUDGET_ITEMS_FAILED", status, message: String(error?.message || error).slice(0, 1200), stack: error?.stack });
    return res.status(status >= 400 && status < 600 ? status : 502).json({
      error: status ? String(error.message) : "Falha ao gerar os itens com IA. Nenhum preço automático foi aplicado.",
      code: error?.code || "BUDGET_ITEMS_FAILED", requestId,
    });
  }
}
