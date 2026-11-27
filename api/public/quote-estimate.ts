import { AI_CONFIG } from "../../src/server/ai-config.js";
import { generateValidatedJson } from "../../src/server/ai-json.js";
import { recordAIAudit } from "../../src/server/ai-audit.js";
import { consumeRateLimit, getClientIp } from "../../src/server/rate-limit.js";
import { getAIRateLimit } from "../../src/server/ai-limits.js";

function send(res: any, status: number, payload: unknown) {
  res.setHeader?.("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

function buildLocalPublicEstimate(prompt: string) {
  const text = prompt.toLowerCase();
  const questions: string[] = [];
  const hasDimensions = /altura\s*(?:de|:|=)?\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\b[\s\S]{0,80}largura\s*(?:de|:|=)?\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\b/i.test(prompt)
    || /\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?\b/i.test(prompt);
  const hasQuantity = /\b\d+\s*(?:un(?:idades?)?|peças?|folhas?|pain[eé]is|portas?|janelas?|boxes?|m²|metros?)\b/i.test(prompt);
  const hasMaterial = /alum[ií]nio|vidro|madeira|aço|aço inox|concreto|pedra|porcelanato|gesso|tijolo|PVC/i.test(prompt);
  const hasFinish = /branco|preto|bronze|natural|anodiz|pintura|fosco|brilhante|amadeirado/i.test(prompt);
  if (!hasDimensions) questions.push("Informar as medidas de cada item em altura × largura, com unidade (mm, cm ou m).");
  if (!hasQuantity) questions.push("Confirmar a quantidade de unidades, vãos ou áreas.");
  if (!hasMaterial) questions.push("Definir o material e o sistema construtivo de cada serviço.");
  if (!hasFinish) questions.push("Definir acabamento, cor e padrão visual.");
  const needsSiteInspection = /reforma|piscina|churrasqueira|lareira|chimenea|pergolado|estrutura|constru[cç][aã]o|terreno|instala[cç][aã]o|madeira laminada|\\bMLC\\b/i.test(prompt);
  const needsOpeningMeasurement = /esquadria|janela|porta|box/i.test(prompt) && !hasDimensions;
  const needsVisit = needsSiteInspection || needsOpeningMeasurement;
  if (needsVisit) questions.push("Agendar visita técnica para medir e avaliar acesso, estrutura e condições existentes.");
  if (questions.length === 0) questions.push("Confirmar escopo final e condições de instalação antes de emitir proposta vinculante.");
  return {
    scopeSummary: "Rascunho provisório baseado somente na descrição recebida: " + prompt.slice(0, 700),
    detectedDimensions: [],
    questions,
    visitRequired: needsVisit,
    visitReason: needsVisit ? "A descrição envolve medição/inspeção presencial antes de definir quantidades e condições de execução." : "",
    disclaimer: "Pré-avaliação de contingência: não contém preço, quantidade presumida nem especificação executiva. Validar os dados com a equipe técnica.",
  };
}

export default async function handler(req: any, res: any) {
  const requestStartedAt = Date.now();
  let auditPrompt = "";
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return send(res, 405, { error: "Método não permitido." });
  }
  try {
    const quota = getAIRateLimit("public-quote-estimate");
    try {
      if (!(await consumeRateLimit("public-quote-estimate", getClientIp(req), quota.limit, quota.windowMs))) {
        return send(res, 429, { error: "Limite público atingido: 3 solicitações por hora. Entre em contato com a equipe comercial.", code: "RATE_LIMITED" });
      }
    } catch (rateError: any) {
      console.error("[PUBLIC_QUOTE_ESTIMATE_RATE_LIMIT]", String(rateError?.message || rateError).slice(0, 500));
      return send(res, 503, { error: "Controle de uso indisponível no momento.", code: "RATE_LIMIT_UNAVAILABLE" });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "description")) {
      return send(res, 400, { error: "A solicitação contém campos não permitidos." });
    }
    const prompt = typeof body.description === "string" ? body.description.trim() : "";
    auditPrompt = prompt;
    if (prompt.length < 12 || prompt.length > 3000) return send(res, 400, { error: "Descreva o projeto em 12 a 3000 caracteres." });
    const aiStartedAt = Date.now();
    let generatedUsage: any = undefined;
    const estimate = await generateValidatedJson({
      capability: "publicEstimate",
      system: "Você é um assistente de pré-atendimento comercial. Resuma escopo, tipologia provável, medidas mencionadas e perguntas faltantes. NÃO invente preços, SKUs, prazos ou disponibilidade. NÃO produza orçamento vinculante nem preço comercial. Responda em português do Brasil, JSON válido com scopeSummary, detectedDimensions, questions, disclaimer. Nunca inclua price, total, cost, sku ou valores monetários.",
      prompt,
      temperature: AI_CONFIG.publicEstimate.temperature,
      maxOutputTokens: AI_CONFIG.publicEstimate.maxOutputTokens,
      validate: (value: any) => {
        if (!value || typeof value !== "object" || Array.isArray(value) ||
            typeof value.scopeSummary !== "string" || !Array.isArray(value.questions) ||
            !value.questions.every((item: unknown) => typeof item === "string") ||
            typeof value.disclaimer !== "string" ||
            (value.detectedDimensions !== undefined && !Array.isArray(value.detectedDimensions)) ||
            ["price", "total", "cost", "sku", "amount"].some((key) => Object.prototype.hasOwnProperty.call(value, key))) {
          throw new Error("Invalid or unsafe public estimate response schema.");
        }
        return value as Record<string, unknown>;
      },
      onGeneration: (event) => {
        generatedUsage = event.usage;
      },
    });
    await recordAIAudit({
      serviceName: "BUDGET",
      modelUsed: AI_CONFIG.publicEstimate.model,
      input: { description: prompt, channel: "public" },
      output: estimate,
      usage: generatedUsage,
      requestId: String(req.headers?.["x-request-id"] || ""),
      startedAt: aiStartedAt,
    });
    return send(res, 200, {
      type: "NON_BINDING_PRE_ESTIMATE",
      estimate,
      disclaimer: "Pré-avaliação automática sem preço comercial. Valores e especificações dependem de validação por comercial/engenharia.",
    });
  } catch (error) {
    if (auditPrompt.length >= 12) {
      try {
        await recordAIAudit({
          serviceName: "BUDGET", modelUsed: AI_CONFIG.publicEstimate.model,
          input: { description: auditPrompt, channel: "public" }, error,
          requestId: String(req.headers?.["x-request-id"] || ""),
          startedAt: requestStartedAt,
        });
      } catch (auditError) { console.error("[PUBLIC_QUOTE_FAILURE_AUDIT]", auditError); }
    }
    console.error("[PUBLIC_QUOTE_ESTIMATE]", error);
    return send(res, 200, {
      type: "NON_BINDING_PRE_ESTIMATE",
      fallback: true,
      code: "AI_PROVIDER_FALLBACK",
      estimate: buildLocalPublicEstimate(auditPrompt),
      disclaimer: "A IA está temporariamente indisponível. Este rascunho foi organizado localmente e não contém preços nem medidas presumidas.",
    });
  }
}
