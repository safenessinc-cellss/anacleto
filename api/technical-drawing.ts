import { generateText } from "ai";
import { GoogleGenAI, Type } from "@google/genai";
import { AI_CONFIG, getAIModel } from "../src/server/ai-config.js";
import { parseAIJson } from "../src/server/ai-json.js";
import { loadCatalogFromFirestore } from "../src/server/firestore-data.js";
import { recordAIAudit } from "../src/server/ai-audit.js";
import { withDraftVectorWatermark } from "../src/server/drawing-vector.js";
import { buildParametricDrawing, isAluminumPrompt, localParametricSpec, type AluminumTipologia, type ParametricWindowSpec } from "../src/utils/parametricCad.js";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

type DrawingRequest = { prompt?: string; catalog?: unknown[]; images?: string[]; currentDrawing?: Record<string, unknown> };
type WindowEntry = { startedAt: number; count: number };
const windows = new Map<string, WindowEntry>();
const OWNER_EMAIL = "safeness.c.a@gmail.com";

const drawingResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING }, description: { type: Type.STRING },
    category: { type: Type.STRING, enum: ["furniture","architectural","aluminum_window","glass_door","custom"] },
    unit: { type: Type.STRING, enum: ["mm","cm"] },
    overallDimensions: { type: Type.OBJECT, properties: { width: {type:Type.NUMBER}, height: {type:Type.NUMBER}, depth: {type:Type.NUMBER} }, required: ["width","height"] },
    pieces: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      id:{type:Type.STRING},pieceNumber:{type:Type.NUMBER},name:{type:Type.STRING},quantity:{type:Type.NUMBER},
      dimensions:{type:Type.OBJECT,properties:{width:{type:Type.NUMBER},height:{type:Type.NUMBER},depth:{type:Type.NUMBER},thickness:{type:Type.NUMBER},unit:{type:Type.STRING}},required:["width","height","unit"]},
      material:{type:Type.STRING},color:{type:Type.STRING},cutAngle:{type:Type.STRING}
    }, required:["id","pieceNumber","name","quantity","dimensions","material","cutAngle"] } },
    dimensionLines: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      id:{type:Type.STRING},label:{type:Type.STRING},value:{type:Type.NUMBER},unit:{type:Type.STRING},orientation:{type:Type.STRING},
      start:{type:Type.OBJECT,properties:{x:{type:Type.NUMBER},y:{type:Type.NUMBER}},required:["x","y"]},
      end:{type:Type.OBJECT,properties:{x:{type:Type.NUMBER},y:{type:Type.NUMBER}},required:["x","y"]}
    }, required:["label","value","unit","orientation","start","end"] } },
    assemblyInstructions:{type:Type.ARRAY,items:{type:Type.STRING}},
    steps:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{stepNumber:{type:Type.NUMBER},title:{type:Type.STRING},description:{type:Type.STRING},phaseName:{type:Type.STRING},instructions:{type:Type.ARRAY,items:{type:Type.STRING}}},required:["stepNumber","title","description","phaseName","instructions"]}},
    measurementPlan:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{point:{type:Type.STRING},method:{type:Type.STRING},tool:{type:Type.STRING},checks:{type:Type.ARRAY,items:{type:Type.STRING}}},required:["point","method","tool","checks"]}},
    cuttingPlan:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{pieceNumber:{type:Type.NUMBER},name:{type:Type.STRING},material:{type:Type.STRING},quantity:{type:Type.NUMBER},length:{type:Type.NUMBER},width:{type:Type.NUMBER},thickness:{type:Type.NUMBER},unit:{type:Type.STRING},cutAngle:{type:Type.STRING},notes:{type:Type.STRING}},required:["pieceNumber","name","material","quantity","unit","cutAngle","notes"]}},
    manufacturingSteps:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{step:{type:Type.NUMBER},title:{type:Type.STRING},instructions:{type:Type.ARRAY,items:{type:Type.STRING}},qualityGate:{type:Type.STRING}},required:["step","title","instructions","qualityGate"]}},
    modelDescription:{type:Type.STRING},finalAppearance:{type:Type.STRING},
    visualElements:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{
      type:{type:Type.STRING,enum:["rect","line","circle","polygon","text"]},x:{type:Type.NUMBER},y:{type:Type.NUMBER},width:{type:Type.NUMBER},height:{type:Type.NUMBER},
      x1:{type:Type.NUMBER},y1:{type:Type.NUMBER},x2:{type:Type.NUMBER},y2:{type:Type.NUMBER},cx:{type:Type.NUMBER},cy:{type:Type.NUMBER},r:{type:Type.NUMBER},
      points:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{x:{type:Type.NUMBER},y:{type:Type.NUMBER}},required:["x","y"]}},
      fill:{type:Type.STRING},stroke:{type:Type.STRING},strokeWidth:{type:Type.NUMBER},label:{type:Type.STRING},text:{type:Type.STRING},fontSize:{type:Type.NUMBER}
    },required:["type"]}},
    qualityChecklist:{type:Type.ARRAY,items:{type:Type.STRING}},assumptions:{type:Type.ARRAY,items:{type:Type.STRING}}
  },
  required:["title","description","category","unit","overallDimensions","pieces","dimensionLines","assemblyInstructions","steps","measurementPlan","cuttingPlan","manufacturingSteps","modelDescription","finalAppearance","visualElements","qualityChecklist","assumptions"]
};
const parametricResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tipologia: { type: Type.STRING, enum: ["janela_correr", "porta_correr", "porta_giro", "porta_pivotante", "maxim_ar", "basculante", "box_banheiro"] },
    linha_aluminio: { type: Type.STRING },
    cor_perfil: { type: Type.STRING },
    largura_mm: { type: Type.NUMBER },
    altura_mm: { type: Type.NUMBER },
    folhas: { type: Type.NUMBER },
    modulo_fixo: { type: Type.BOOLEAN },
    tipo_vidro: { type: Type.STRING },
    espessura_mm: { type: Type.NUMBER },
    abertura: { type: Type.STRING },
  },
  required: ["tipologia", "linha_aluminio", "cor_perfil", "largura_mm", "altura_mm", "folhas", "modulo_fixo", "tipo_vidro", "espessura_mm", "abertura"],
};
async function generateDrawingJson(options: { system: string; prompt: string; images?: URL[]; temperature: number; maxOutputTokens: number; responseSchema?: any }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (apiKey) {
    const parts: any[] = [{ text: options.prompt }];
    for (const imageUrl of options.images || []) {
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error("Não foi possível carregar uma imagem de referência autorizada.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("A imagem de referência excede o limite de 8 MB.");
      parts.push({ inlineData: { mimeType: response.headers.get("content-type") || "image/jpeg", data: Buffer.from(bytes).toString("base64") } });
    }
    const client = new GoogleGenAI({ apiKey });
    const model = options.responseSchema === parametricResponseSchema ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: { systemInstruction: options.system, responseMimeType: "application/json", responseSchema: options.responseSchema || drawingResponseSchema, temperature: options.temperature, maxOutputTokens: options.maxOutputTokens }
    });
    return { text: response.text || "", usage: { inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount }, model };
  }
  // Backward-compatible provider path. Runtime validation remains mandatory.
  const result = await generateText({
    model: getAIModel("technicalDrawing"), system: options.system,
    messages: [{ role: "user", content: [{ type: "text", text: options.prompt }, ...(options.images || []).map(image => ({ type: "image" as const, image }))] }],
    temperature: options.temperature, maxOutputTokens: options.maxOutputTokens,
    abortSignal: AbortSignal.timeout(AI_CONFIG.technicalDrawing.timeoutMs),
  });
  return { text: result.text || "", usage: result.usage as any, model: AI_CONFIG.technicalDrawing.model };
}


function json(res: any, status: number, body: unknown) {
  // Vercel Node responses and Express responses do not share identical chaining semantics.
  res.setHeader?.("Cache-Control", "no-store");
  return res.status(status).json(body);
}
const firestoreDocuments = () => {
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  return "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId + "/databases/" + databaseId + "/documents";
};
function encodeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeFirestoreValue(item)])) } };
  return { stringValue: String(value) };
}
function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([key, item]) => [key, decodeFirestoreValue(item)]));
  return value;
}
async function createDrawingJob(req: any, jobId: string, uid: string): Promise<void> {
  const fields = { id: jobId, userUid: uid, status: "PROCESSING", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const response = await fetch(firestoreDocuments() + "/drawing_jobs?documentId=" + encodeURIComponent(jobId), {
    method: "POST", headers: { Authorization: "Bearer " + String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""), "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, encodeFirestoreValue(value)])) }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Não foi possível registrar a tarefa técnica (HTTP " + response.status + ").");
}
async function updateDrawingJob(req: any, jobId: string, values: Record<string, unknown>): Promise<void> {
  const params = new URLSearchParams();
  for (const key of Object.keys(values)) params.append("updateMask.fieldPaths", key);
  const fields = Object.fromEntries(Object.entries({ ...values, updatedAt: new Date().toISOString() }).map(([key, value]) => [key, encodeFirestoreValue(value)]));
  params.append("updateMask.fieldPaths", "updatedAt");
  const response = await fetch(firestoreDocuments() + "/drawing_jobs/" + encodeURIComponent(jobId) + "?" + params.toString(), {
    method: "PATCH", headers: { Authorization: "Bearer " + String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""), "Content-Type": "application/json" },
    body: JSON.stringify({ fields }), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Não foi possível atualizar a tarefa técnica (HTTP " + response.status + ").");
}
async function readDrawingJob(req: any, jobId: string): Promise<Record<string, any> | null> {
  const response = await fetch(firestoreDocuments() + "/drawing_jobs/" + encodeURIComponent(jobId), {
    headers: { Authorization: "Bearer " + String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") },
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Não foi possível consultar a tarefa técnica (HTTP " + response.status + ").");
  const raw = await response.json() as any;
  return Object.fromEntries(Object.entries(raw.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

async function authenticate(req: any): Promise<{ uid: string; email: string; role: string } | null> {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
  if (!token || !apiKey) return null;

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string; email?: string }> };
  const user = data.users?.[0];
  if (!user?.localId || !user.email) return null;

  const email = user.email.toLowerCase();
  let role = "owner";
  if (email !== OWNER_EMAIL) {
    const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
    const documentId = encodeURIComponent(email);
    const roleUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/admins/${documentId}`;
    const roleResponse = await fetch(roleUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!roleResponse.ok) return null;
    const roleData = await roleResponse.json() as { fields?: { role?: { stringValue?: string } } };
    if (!roleData.fields?.role?.stringValue) return null;
    role = roleData.fields.role.stringValue;
  }
  return { uid: user.localId, email, role };
}

function allowRequest(uid: string): boolean {
  const now = Date.now();
  const current = windows.get(uid);
  if (!current || now - current.startedAt >= 60_000) {
    windows.set(uid, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  return true;
}

function normalizeName(value: unknown): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildTechnicalBudget(pieces: any[], catalog: any[]) {
  const items = (Array.isArray(pieces) ? pieces : []).map((piece: any, index: number) => {
    const quantity = Math.max(1, Number(piece?.quantity) || 1);
    const sku = String(piece?.sku || piece?.code || "").trim().toLowerCase();
    const itemId = String(piece?.catalogItemId || piece?.itemId || "").trim();
    const description = normalizeName(piece?.name || piece?.material);
    const match = (Array.isArray(catalog) ? catalog : []).find((row: any) => {
      const rowSku = String(row?.sku || row?.code || "").trim().toLowerCase();
      const idMatch = !!itemId && String(row?.id || "") === itemId;
      const skuMatch = !!sku && !!rowSku && sku === rowSku;
      if (itemId && sku) return idMatch && skuMatch;
      if (itemId) return idMatch;
      if (sku) return skuMatch;
      const rowName = normalizeName(row?.name || row?.description);
      return !!description && !!rowName && description === rowName;
    });
    const rawPrice = match?.price;
    const priceVerified = rawPrice !== undefined && rawPrice !== null && String(rawPrice).trim() !== "" && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0;
    const unitPrice = priceVerified ? Number(rawPrice) : 0;
    return {
      id: String(piece?.id || "piece-" + (index + 1)),
      pieceId: String(piece?.id || ""),
      description: String(piece?.name || piece?.material || "Componente técnico"),
      sku: priceVerified ? String(match.sku || match.code || "") : String(piece?.sku || ""),
      catalogItemId: priceVerified ? String(match.id || "") : "",
      quantity,
      unitPrice,
      subtotal: Number((quantity * unitPrice).toFixed(2)),
      priceSource: priceVerified ? "catalog" : "pending",
    };
  });
  const subtotal = Number(items.reduce((sum: number, item: any) => sum + item.subtotal, 0).toFixed(2));
  return {
    currency: "BRL",
    items,
    subtotal,
    labor: 0,
    total: subtotal,
    notes: "Preços aplicados exclusivamente por correspondência exata no catálogo Firestore. Itens pendentes exigem revisão manual; mão de obra não informada não foi estimada.",
  };
}

function localFallback(prompt: string) {
  const text = prompt.toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?))?/);
  const n = (value?: string, fallback = 100) => value ? Number(value.replace(",", ".")) : fallback;
  const width = Math.max(1, n(match?.[1]));
  const height = Math.max(1, n(match?.[2]));
  const depth = Math.max(1, n(match?.[3], /janela|ventana|esquadria/.test(text) ? 12 : 50));
  const isWindow = /janela|ventana|esquadria|corredi[cç]a/.test(text);
  const isDoor = /porta|puerta/.test(text);
  const isTable = /mesa|table/.test(text);
  const isCabinet = /arm[aá]rio|closet|guarda roupa/.test(text);
  const unit = /\bmm\b|milímetro|milimetro/.test(text) ? "mm" : "cm";
  const category = isWindow ? "aluminum_window" : isDoor ? "glass_door" : isTable || isCabinet ? "furniture" : "custom";
  const names = isWindow || isDoor
    ? ["Perfil superior do marco", "Perfil inferior do marco", "Montantes laterais", "Folhas / painéis"]
    : isTable
      ? ["Tampo superior", "Pés / montantes", "Travessas longitudinais", "Travessas transversais"]
      : isCabinet
        ? ["Lateral esquerda", "Lateral direita", "Tampo e base", "Portas frontais"]
        : ["Componente principal", "Elemento de suporte", "Reforços / uniões"];
  const pieces = names.map((name, index) => ({
    id: `p${index + 1}`, pieceNumber: index + 1, name, quantity: index === 1 || index === 2 ? 2 : 1,
    dimensions: { width: index === 0 ? width : Math.max(1, width / 2), height: index === 0 ? height : Math.max(1, height / 2), depth: Math.max(1, depth / 4), thickness: Math.max(1, depth / 4), unit },
    material: isWindow || isDoor ? "Alumínio / vidro — especificação a validar" : "Material a definir pelo responsável técnico",
    color: ["#C5A850", "#8C6D37", "#60A5FA", "#94A3B8"][index],
    cutAngle: /45|inglete|mitre/.test(text) ? "Ângulo solicitado: validar corte a 45°" : "90° — validar antes de fabricar",
    notes: "Dimensão preliminar; validar medidas, folgas, material e sistema antes da fabricação."
  }));
  const phases = [
    ["Definição das dimensões gerais", "Dimensões gerais", `Largura ${width} × altura ${height} × profundidade ${depth} ${unit}.`],
    ["Despiece e lista de componentes", "Lista de peças", `${pieces.length} grupos de componentes estruturados para detalhamento.`],
    ["Corte e cotagem individual", "Corte de cada peça", "Cotas e ângulos preliminares; validar espessuras, tolerâncias e ferramentas."],
    ["Encaixe e montagem", "Montagem / encaixe", "Verificar sequência, esquadro, folgas e fixações adequadas ao material."],
    ["Vista final e conferência", "Resultado final", "Conferir medidas reais e tolerâncias antes de liberar para fabricação."]
  ];
  return {
    _fallback: true,
    draftStatus: "preliminary",
    draftLabel: "RASCUNHO PRELIMINAR — NÃO LIBERADO PARA FABRICAÇÃO",
    assumptions: ["Gerado pelo mecanismo local de contingência porque o provedor de IA falhou. Todas as medidas, materiais, ferragens, folgas e cortes exigem validação humana."],
    title: isWindow ? "Esquadria / janela sob medida" : isDoor ? "Porta sob medida" : isTable ? "Mesa sob medida" : isCabinet ? "Armário sob medida" : "Projeto técnico sob medida",
    description: `Projeto preliminar criado a partir de: ${prompt}`,
    category, unit, overallDimensions: { width, height, depth }, pieces,
    budget: buildTechnicalBudget(pieces, []),
    dimensionLines: [
      { id: "d1", label: `${width} ${unit}`, value: width, unit, orientation: "horizontal", start: { x: 80, y: 50 }, end: { x: 520, y: 50 } },
      { id: "d2", label: `${height} ${unit}`, value: height, unit, orientation: "vertical", start: { x: 50, y: 80 }, end: { x: 50, y: 380 } },
      { id: "d3", label: `${depth} ${unit}`, value: depth, unit, orientation: "diagonal", start: { x: 540, y: 80 }, end: { x: 570, y: 50 } }
    ],
    assemblyInstructions: ["Conferir todas as dimensões no local.", "Validar componentes e materiais.", "Executar corte apenas após aprovação técnica.", "Montar e verificar esquadro e folgas.", "Registrar revisão final do projeto."],
    steps: phases.map(([phaseName, title, description], index) => ({
      stepNumber: index + 1, phaseName, title, description,
      instructions: [[ "Confirmar largura, altura e profundidade no local." ],
        [ "Conferir materiais, quantidades e identificadores." ],
        [ "Validar espessuras, folgas, ângulos e ferramentas." ],
        [ "Montar a seco e verificar alinhamento e esquadro." ],
        [ "Aprovar o desenho revisado antes da fabricação." ]][index]
    }))
  };
}

export default async function handler(req: any, res: any) {
  const requestId = String(req.headers?.["x-vercel-id"] || req.headers?.["x-request-id"] || "unknown");
  let prompt = "";
  let authenticated = false;
  let catalog: any[] = [];
  let actorUid = "";
  let auditRecorded = false;
  let drawingJobId: string | null = null;
  let jobPersisted = false;
  let stage = "request";

  try {
    if (req.method !== "POST") {
      res.setHeader?.("Allow", "GET, POST");
      return json(res, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });
    }

    stage = "input";
    let body = req.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return json(res, 400, { error: "Corpo da solicitação inválido.", code: "INVALID_JSON" }); }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(res, 400, { error: "Corpo da solicitação inválido.", code: "INVALID_BODY" });
    }
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 3) {
      return json(res, 400, { error: "Descreva a peça e suas dimensões.", code: "PROMPT_REQUIRED" });
    }

    const currentDrawing = body.currentDrawing && typeof body.currentDrawing === "object" &&
      !Array.isArray(body.currentDrawing) && body.currentDrawing.id !== "draw-sample-01"
      ? JSON.stringify(body.currentDrawing).slice(0, 18000)
      : "";
    const isEditRequest = /\b(altere|alterar|ajuste|ajustar|modifique|modificar|adicione|adicionar|remova|remover|mude|mudar|substitua|substituir|corrija|corrigir|aumente|aumentar|reduza|reduzir|change|update|modify|add|remove|replace|adjust|cambia|cambiar|modifica|modificar|agrega|agregar|quita|quitar)\b/i.test(prompt);
    const drawingContext = currentDrawing && isEditRequest ? currentDrawing : "";
    const imageUrls = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
    const allowedImageUrls: URL[] = [];
    for (const value of imageUrls) {
      try {
        const url = new URL(String(value));
        if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com" ||
            !url.pathname.includes("/v0/b/" + firebaseConfig.storageBucket + "/o/")) {
          return json(res, 400, { error: "Imagem de referência fora do armazenamento autorizado.", code: "IMAGE_NOT_ALLOWED" });
        }
        allowedImageUrls.push(url);
      } catch {
        return json(res, 400, { error: "URL de imagem de referência inválida.", code: "INVALID_IMAGE_URL" });
      }
    }

    stage = "authentication";
    const user = await authenticate(req);
    if (!user) {
      return json(res, 401, { error: "Sessão inválida ou acesso não autorizado. Entre novamente.", code: "UNAUTHORIZED" });
    }
    authenticated = true;
    actorUid = user.uid;
    if (!["owner","super_admin","super_usuario","ceo","admin","supervisor","colaborador","qualidade","producao"].includes(user.role)) {
      return json(res, 403, { error: "Seu perfil não possui permissão para operações de desenho técnico.", code: "ROLE_FORBIDDEN" });
    }
    catalog = (await loadCatalogFromFirestore(req)).slice(0, 200);
    if (!allowRequest(user.uid)) {
      return json(res, 429, { error: "Limite de 12 gerações por minuto. Aguarde e tente novamente.", code: "RATE_LIMITED" });
    }
    if (isAluminumPrompt(prompt)) {
      stage = "parametric_spec_extraction";
      const aiStartedAt = Date.now();
      const system = `Extraia somente dados técnicos explícitos de uma esquadria de alumínio. Não calcule nem devolva coordenadas, linhas, geometrias, lista de peças ou orçamento. Devolva JSON estrito com exatamente as chaves tipologia, linha_aluminio, cor_perfil, largura_mm, altura_mm, folhas, modulo_fixo, tipo_vidro, espessura_mm, abertura. Tipologias permitidas: janela_correr, porta_correr, porta_giro, porta_pivotante, maxim_ar, basculante, box_banheiro. Converta dimensões explicitamente fornecidas para milímetros. Use valores vazios ou zero quando não forem informados; não invente linha, cor, tipo de vidro ou espessura. folhas deve ser 2/3/4 para correr e 1 para os demais. modulo_fixo é booleano.`;
      const extracted = await generateDrawingJson({
        system,
        prompt: `${prompt}${drawingContext ? `\nContexto técnico existente: ${drawingContext}` : ""}`,
        images: allowedImageUrls,
        temperature: 0,
        maxOutputTokens: 512,
        responseSchema: parametricResponseSchema,
      });
      await recordAIAudit({
        serviceName: "TECHNICAL_DRAWING",
        modelUsed: extracted.model,
        input: { prompt, mode: "parametric_spec_extraction", imageCount: allowedImageUrls.length },
        output: extracted.text,
        usage: extracted.usage as any,
        actorUid,
        requestId,
        startedAt: aiStartedAt,
        authorizationToken: String(req.headers?.authorization || "").replace(/^Bearer\s+/i, ""),
      });
      auditRecorded = true;
      const spec = parseAIJson(extracted.text, (value: any): ParametricWindowSpec => {
        const validTypes: AluminumTipologia[] = ["janela_correr", "porta_correr", "porta_giro", "porta_pivotante", "maxim_ar", "basculante", "box_banheiro"];
        if (!value || Object.keys(value).some((key) => !parametricResponseSchema.required.includes(key)) ||
            parametricResponseSchema.required.some((key) => !(key in value)) ||
            !validTypes.includes(value.tipologia) || typeof value.linha_aluminio !== "string" ||
            typeof value.cor_perfil !== "string" || !Number.isFinite(value.largura_mm) || value.largura_mm < 0 ||
            !Number.isFinite(value.altura_mm) || value.altura_mm < 0 || !Number.isInteger(value.folhas) ||
            typeof value.modulo_fixo !== "boolean" || typeof value.tipo_vidro !== "string" ||
            !Number.isFinite(value.espessura_mm) || value.espessura_mm < 0 || typeof value.abertura !== "string") {
          throw new Error("A extração não retornou o schema paramétrico de esquadrias válido.");
        }
        if ((value.tipologia === "janela_correr" && ![2, 3, 4].includes(value.folhas)) ||
            (value.tipologia === "porta_correr" && ![2, 4].includes(value.folhas)) ||
            (!["janela_correr", "porta_correr"].includes(value.tipologia) && value.folhas !== 1)) {
          throw new Error("Quantidade de folhas incompatível com a tipologia.");
        }
        if (value.largura_mm > 20_000 || value.altura_mm > 20_000 || value.espessura_mm > 100) {
          throw new Error("Dimensão extraída acima do limite seguro.");
        }
        return value;
      });
      if (spec.largura_mm <= 0 || spec.altura_mm <= 0) {
        return json(res, 422, { error: "Informe largura e altura explícitas em milímetros para gerar o desenho paramétrico.", code: "DIMENSIONS_REQUIRED" });
      }
      const responseDrawing = withDraftVectorWatermark(buildParametricDrawing(spec, prompt, catalog));
      return json(res, 200, responseDrawing);
    }
    stage = "ai_generation";
    const system = `Você é o engenheiro de produto, projetista e especialista em fabricação da Anacleto Pro. Interprete a solicitação inteira, não apenas palavras-chave. Identifique produto, material, tipo de abertura/encaixe, quantidade de folhas/portas, divisões, posição dos componentes e todas as dimensões explicitamente informadas. Diferencie largura, altura e profundidade conforme o produto; para móveis, não confunda profundidade com altura. Preserve a unidade original e converta somente quando o usuário pedir. Se o usuário solicitar alteração de um desenho existente, modifique somente os pontos pedidos e preserve os demais dados e componentes existentes; não reinicie o projeto. Se for um novo projeto, não reutilize o desenho anterior. Nunca invente dimensões, perfis, ferragens, folgas, descontos, espessuras, tolerâncias, fórmulas ou ângulos. Se faltar informação necessária, mantenha o campo vazio/zero e registre pergunta/pendência em assumptions; não apresente suposições como medidas confirmadas. A lista de corte é preliminar até validar sistema, ferragens e tabelas oficiais do fabricante. Gere somente JSON válido, sem markdown, com: title, description, category, unit, overallDimensions {width,height,depth}, pieces (array não vazio com id,pieceNumber,name,quantity,dimensions {width,height,depth,thickness,unit},material,color,cutAngle), dimensionLines (array), assemblyInstructions (array), steps (exatamente 5 objetos com stepNumber,phaseName,title,description,instructions), measurementPlan (array de {point,method,tool,checks}), cuttingPlan (array de {pieceNumber,name,material,quantity,length,width,thickness,unit,cutAngle,notes}), manufacturingSteps (array de {step,title,instructions,qualityGate}), modelDescription (string), finalAppearance (string), visualElements (array de elementos SVG estruturados para desenhar exatamente o produto solicitado, coordenadas normalizadas de 0 a 1000: retângulos {type:"rect",x,y,width,height,fill,stroke,strokeWidth,label}, linhas {type:"line",x1,y1,x2,y2,stroke,strokeWidth,label}, círculos {type:"circle",cx,cy,r,fill,stroke}, polígonos {type:"polygon",points:[{x,y}],fill,stroke}, textos {type:"text",x,y,text,fill,fontSize}). A geometria deve representar fielmente a configuração pedida: número e posição exatos de folhas, portas, gavetas, divisórias, prateleiras, puxadores, trilhos, montantes, travessas, pés, recortes e demais detalhes descritos. Cada elemento visual deve corresponder a um componente real descrito na solicitação ou na lista de peças; use coordenadas normalizadas de 0 a 1000, mantenha proporções coerentes e distribua os elementos dentro do contorno do produto. A vista frontal deve mostrar exatamente a quantidade de folhas/portas/divisões solicitadas, suas posições, puxadores e ferragens explicitamente mencionados. Não use uma ilustração genérica da categoria; não acrescente elementos que o usuário não pediu. Se não for possível determinar a geometria com segurança, registre a lacuna em assumptions em vez de inventar uma imagem. Use o catálogo quando aplicável: ${JSON.stringify(catalog)}.`;

    const aiStartedAt = Date.now();
    const drawingPrompt = `Analise as imagens anexadas como referência visual e extraia somente cotas legíveis. Se houver conflito entre texto e imagem, registre a divergência em assumptions. ${drawingContext ? `DESENHO ATUAL PARA ALTERAÇÃO (preserve tudo que não foi solicitado para mudar): ${drawingContext}. ` : "Trate como um novo projeto. "}Solicitação do usuário: ${prompt}`;
    const result = await generateDrawingJson({
      system, prompt: drawingPrompt, images: allowedImageUrls,
      temperature: AI_CONFIG.technicalDrawing.temperature,
      maxOutputTokens: AI_CONFIG.technicalDrawing.maxOutputTokens,
    });

    await recordAIAudit({
      serviceName: "TECHNICAL_DRAWING",
      modelUsed: result.model,
      input: { prompt, drawingContext, imageCount: allowedImageUrls.length },
      output: result.text,
      usage: result.usage as any,
      actorUid,
      requestId,
      startedAt: aiStartedAt,
      authorizationToken: String(req.headers?.authorization || "").replace(/^Bearer\s+/i, ""),
    });
    auditRecorded = true;

    stage = "validate_ai_response";
    let drawing: any;
    try {
      drawing = parseAIJson(result.text, (value: any) => {
        const dims = value?.overallDimensions || {};
        if (!value || !Array.isArray(value.pieces) || !value.pieces.length || !Number.isFinite(Number(dims.width)) || Number(dims.width) <= 0 || !Number.isFinite(Number(dims.height)) || Number(dims.height) <= 0) throw new Error("Resposta da IA sem dimensões ou componentes válidos.");
        return value;
      });
    } catch (firstError) {
      const repairStartedAt = Date.now();
      const repaired = await generateDrawingJson({
        system: system + "\nRetorne somente JSON válido. Corrija exclusivamente a estrutura; preserve os dados, não invente medidas, materiais, ferragens ou componentes.",
        prompt: "A resposta anterior não passou na validação JSON. Erro: " + String((firstError as Error)?.message || firstError) + ". Corrija esta resposta sem acrescentar fatos: " + String(result.text || "").slice(0, 30000),
        temperature: 0, maxOutputTokens: AI_CONFIG.technicalDrawing.maxOutputTokens,
      });
      await recordAIAudit({
        serviceName: "TECHNICAL_DRAWING",
        modelUsed: repaired.model,
        input: { prompt, repair: true, previousOutputHash: String(result.text || "").length },
        output: repaired.text,
        usage: repaired.usage as any,
        actorUid, requestId, startedAt: repairStartedAt,
        authorizationToken: String(req.headers?.authorization || "").replace(/^Bearer\s+/i, ""),
      });
      drawing = parseAIJson(repaired.text, (value: any) => {
        const dims = value?.overallDimensions || {};
        if (!value || !Array.isArray(value.pieces) || !value.pieces.length || !Number.isFinite(Number(dims.width)) || Number(dims.width) <= 0 || !Number.isFinite(Number(dims.height)) || Number(dims.height) <= 0) throw new Error("Resposta reparada sem dimensões ou componentes válidos.");
        return value;
      });
    }
    const dims = drawing?.overallDimensions || {};
    if (!drawing || !Array.isArray(drawing.pieces) || !drawing.pieces.length ||
        !Number.isFinite(Number(dims.width)) || Number(dims.width) <= 0 ||
        !Number.isFinite(Number(dims.height)) || Number(dims.height) <= 0) {
      throw new Error("Resposta da IA sem dimensões ou componentes válidos.");
    }
    drawing.steps = Array.isArray(drawing.steps) ? drawing.steps.slice(0, 5) : [];
    if (drawing.steps.length !== 5) throw new Error("A IA não retornou as cinco fases do desenho.");
    drawing.assemblyInstructions = Array.isArray(drawing.assemblyInstructions) ? drawing.assemblyInstructions : [];
    drawing.budget = buildTechnicalBudget(drawing.pieces, catalog);
    drawing.isDraft = true;
    drawing.status = "PRELIMINARY_CONTINGENCY";
    drawing.draftStatus = "preliminary";
    drawing.draftLabel = "BORRADOR TÉCNICO - NO VÁLIDO PARA FABRICACIÓN";
    const requiredArrays = ["measurementPlan", "cuttingPlan", "manufacturingSteps", "qualityChecklist", "assumptions"];
    for (const field of requiredArrays) {
      if (!Array.isArray(drawing[field]) || drawing[field].length === 0) {
        throw new Error("A IA não retornou a etapa obrigatória: " + field);
      }
    }
    if (!Array.isArray(drawing.visualElements) || drawing.visualElements.length < 2 || drawing.visualElements.length > 100) {
      throw new Error("A IA não retornou a geometria visual específica do projeto.");
    }
    if (typeof drawing.modelDescription !== "string" || !drawing.modelDescription.trim() ||
        typeof drawing.finalAppearance !== "string" || !drawing.finalAppearance.trim()) {
      throw new Error("A IA não retornou a descrição do modelo e do resultado final.");
    }
    const responseDrawing = withDraftVectorWatermark(drawing);
    if (jobPersisted && drawingJobId) await updateDrawingJob(req, drawingJobId, { status: "COMPLETED", result: responseDrawing, completedAt: new Date().toISOString() });
    return json(res, 200, responseDrawing);
  } catch (error) {
    // Never leak provider credentials or internal stack traces to the browser.
    console.error("Technical drawing request failed", {
      requestId,
      stage,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });

    if (authenticated && prompt.length >= 3) {
      if (!auditRecorded && (stage === "ai_generation" || stage === "validate_ai_response")) {
        try {
          await recordAIAudit({
            serviceName: "TECHNICAL_DRAWING",
            modelUsed: AI_CONFIG.technicalDrawing.model,
            input: { prompt, stage },
            error,
            actorUid,
            requestId,
            authorizationToken: String(req.headers?.authorization || "").replace(/^Bearer\\s+/i, ""),
          });
        } catch (auditError) {
          console.error("Technical drawing failure audit could not be persisted", auditError);
        }
      }
      if (jobPersisted && drawingJobId) {
        try {
          await updateDrawingJob(req, drawingJobId, { status: "FAILED", error: "AI_PROVIDER_OR_SCHEMA_FAILURE", completedAt: new Date().toISOString() });
        } catch (jobError) {
          console.error("Could not persist failed drawing job", jobError);
        }
      }
      // Rascunho local temporário: nunca liberado para fabricação sem validação técnica.
      try {
        if (isAluminumPrompt(prompt)) {
          const localSpec = localParametricSpec(prompt);
          if (localSpec.largura_mm <= 0 || localSpec.altura_mm <= 0) {
            return json(res, 422, { error: "Não consegui extrair as dimensões da descrição. Informe largura e altura para continuar.", code: "DIMENSIONS_REQUIRED" });
          }
          const local = buildParametricDrawing(localSpec, prompt, catalog);
          local.status = "PRELIMINARY_CONTINGENCY";
          local.draftLabel = "RASCUNHO PARAMÉTRICO LOCAL — VALIDAR ANTES DE FABRICAR";
          local.assumptions = ["A extração de IA não ficou disponível; os dados foram identificados localmente por palavras-chave. Confirme tipologia e cotas antes da fabricação."];
          return json(res, 200, withDraftVectorWatermark(local));
        }
        const fallback: any = localFallback(prompt);
        fallback.isDraft = true;
        fallback.status = "LOCAL_PRELIMINARY_FALLBACK";
        fallback.draftStatus = "preliminary";
        fallback.draftLabel = "RASCUNHO LOCAL — NÃO UTILIZAR PARA FABRICAÇÃO";
        fallback.assumptions = [...(Array.isArray(fallback.assumptions) ? fallback.assumptions : []), "Rascunho local sem IA: validar todas as medidas, perfis, ferragens e cortes antes de fabricar."];
        return json(res, 200, withDraftVectorWatermark(fallback));
      } catch (fallbackError) {
        console.error("Local drawing fallback failed:", fallbackError);
        return json(res, 503, { error: "IA indisponível e falha no rascunho local.", code: "TECHNICAL_DRAWING_UNAVAILABLE" });
      }
    }

    if (stage === "authentication") {
      return json(res, 503, {
        error: "Não foi possível validar sua sessão agora. Tente novamente em instantes.",
        code: "AUTH_SERVICE_UNAVAILABLE",
        requestId,
      });
    }

    return json(res, 500, {
      error: "O serviço de desenho técnico encontrou uma falha inesperada.",
      code: "TECHNICAL_DRAWING_INTERNAL_ERROR",
      requestId,
    });
  }
}
