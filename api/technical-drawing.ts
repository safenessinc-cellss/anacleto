import { generateText, gateway } from "ai";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

type DrawingRequest = { prompt?: string; catalog?: unknown[]; images?: string[]; currentDrawing?: Record<string, unknown> };
type WindowEntry = { startedAt: number; count: number };
const windows = new Map<string, WindowEntry>();
const OWNER_EMAIL = "safeness.c.a@gmail.com";

function json(res: any, status: number, body: unknown) {
  // Vercel Node responses and Express responses do not share identical chaining semantics.
  res.setHeader?.("Cache-Control", "no-store");
  return res.status(status).json(body);
}

async function authenticate(req: any): Promise<{ uid: string; email: string } | null> {
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
  }
  return { uid: user.localId, email };
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
    title: isWindow ? "Esquadria / janela sob medida" : isDoor ? "Porta sob medida" : isTable ? "Mesa sob medida" : isCabinet ? "Armário sob medida" : "Projeto técnico sob medida",
    description: `Projeto preliminar criado a partir de: ${prompt}`,
    category, unit, overallDimensions: { width, height, depth }, pieces,
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
  let stage = "request";

  try {
    if (req.method !== "POST") {
      res.setHeader?.("Allow", "POST");
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

    const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 200) : [];
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

    if (!allowRequest(user.uid)) {
      return json(res, 429, { error: "Limite de 12 gerações por minuto. Aguarde e tente novamente.", code: "RATE_LIMITED" });
    }

    stage = "ai_generation";
    const system = `Você é o engenheiro de produto, projetista e especialista em fabricação da Anacleto Pro. Interprete a solicitação inteira, não apenas palavras-chave. Identifique produto, material, tipo de abertura/encaixe, quantidade de folhas/portas, divisões, posição dos componentes e todas as dimensões explicitamente informadas. Diferencie largura, altura e profundidade conforme o produto; para móveis, não confunda profundidade com altura. Preserve a unidade original e converta somente quando o usuário pedir. Se o usuário solicitar alteração de um desenho existente, modifique somente os pontos pedidos e preserve os demais dados e componentes existentes; não reinicie o projeto. Se for um novo projeto, não reutilize o desenho anterior. Nunca invente dimensões, perfis, ferragens, folgas, descontos, espessuras, tolerâncias, fórmulas ou ângulos. Se faltar informação necessária, mantenha o campo vazio/zero e registre pergunta/pendência em assumptions; não apresente suposições como medidas confirmadas. A lista de corte é preliminar até validar sistema, ferragens e tabelas oficiais do fabricante. Gere somente JSON válido, sem markdown, com: title, description, category, unit, overallDimensions {width,height,depth}, pieces (array não vazio com id,pieceNumber,name,quantity,dimensions {width,height,depth,thickness,unit},material,color,cutAngle), dimensionLines (array), assemblyInstructions (array), steps (exatamente 5 objetos com stepNumber,phaseName,title,description,instructions), measurementPlan (array de {point,method,tool,checks}), cuttingPlan (array de {pieceNumber,name,material,quantity,length,width,thickness,unit,cutAngle,notes}), manufacturingSteps (array de {step,title,instructions,qualityGate}), modelDescription (string), finalAppearance (string), qualityChecklist (array de strings), assumptions (array de strings). Use o catálogo quando aplicável: ${JSON.stringify(catalog)}.`;

    const result = await generateText({
      model: gateway("openai/gpt-4o-mini"),
      system,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Analise as imagens anexadas como referência visual e extraia somente cotas legíveis. Se houver conflito entre texto e imagem, registre a divergência em assumptions. ${drawingContext ? `DESENHO ATUAL PARA ALTERAÇÃO (preserve tudo que não foi solicitado para mudar): ${drawingContext}. ` : "Trate como um novo projeto. "}Solicitação do usuário: ${prompt}` },
          ...allowedImageUrls.map((image) => ({ type: "image" as const, image })),
        ],
      }],
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(45_000),
    });

    stage = "validate_ai_response";
    const raw = (result.text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const drawing = JSON.parse(raw);
    const dims = drawing?.overallDimensions || {};
    if (!drawing || !Array.isArray(drawing.pieces) || !drawing.pieces.length ||
        !Number.isFinite(Number(dims.width)) || Number(dims.width) <= 0 ||
        !Number.isFinite(Number(dims.height)) || Number(dims.height) <= 0) {
      throw new Error("Resposta da IA sem dimensões ou componentes válidos.");
    }
    drawing.steps = Array.isArray(drawing.steps) ? drawing.steps.slice(0, 5) : [];
    if (drawing.steps.length !== 5) throw new Error("A IA não retornou as cinco fases do desenho.");
    drawing.assemblyInstructions = Array.isArray(drawing.assemblyInstructions) ? drawing.assemblyInstructions : [];
    const requiredArrays = ["measurementPlan", "cuttingPlan", "manufacturingSteps", "qualityChecklist", "assumptions"];
    for (const field of requiredArrays) {
      if (!Array.isArray(drawing[field]) || drawing[field].length === 0) {
        throw new Error("A IA não retornou a etapa obrigatória: " + field);
      }
    }
    if (typeof drawing.modelDescription !== "string" || !drawing.modelDescription.trim() ||
        typeof drawing.finalAppearance !== "string" || !drawing.finalAppearance.trim()) {
      throw new Error("A IA não retornou a descrição do modelo e do resultado final.");
    }
    return json(res, 200, drawing);
  } catch (error) {
    // Never leak provider credentials or internal stack traces to the browser.
    console.error("Technical drawing request failed", {
      requestId,
      stage,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });

    if (authenticated && prompt.length >= 3) {
      try {
        const fallback = localFallback(prompt);
        return json(res, 200, {
          ...fallback,
          warning: "A IA está temporariamente indisponível. Foi criado um desenho preliminar local; confira todas as medidas antes de fabricar.",
          fallbackReason: stage,
        });
      } catch (fallbackError) {
        console.error("Technical drawing local fallback failed", {
          requestId,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        return json(res, 500, {
          error: "Não foi possível gerar o desenho técnico. Tente novamente ou revise a descrição.",
          code: "DRAWING_GENERATION_FAILED",
          requestId,
        });
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
