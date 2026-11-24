import { AI_CONFIG } from "../../src/server/ai-config.js";
import { generateValidatedJson } from "../../src/server/ai-json.js";
import { recordAIAudit } from "../../src/server/ai-audit.js";
import { consumeRateLimit, getClientIp } from "../../src/server/rate-limit.js";
import { getAIRateLimit } from "../../src/server/ai-limits.js";

function send(res: any, status: number, payload: unknown) {
  res.setHeader?.("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

export default async function handler(req: any, res: any) {
  const requestStartedAt = Date.now();
  let auditPrompt = "";
  let usage: any;
  let modelUsed = AI_CONFIG.publicEstimate.model;
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return send(res, 405, { error: "Método não permitido." });
  }

  try {
    const ip = getClientIp(req);
    const quota = getAIRateLimit("public-quote-estimate");
    if (!(await consumeRateLimit("public-quote-estimate", ip, quota.limit, quota.windowMs))) {
      return send(res, 429, { error: "Limite público atingido. Tente novamente mais tarde ou entre em contato com a equipe comercial." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "description")) {
      return send(res, 400, { error: "A solicitação contém campos não permitidos." });
    }
    const prompt = typeof body.description === "string" ? body.description.trim() : "";
    auditPrompt = prompt;
    if (prompt.length < 12 || prompt.length > 3000) {
      return send(res, 400, { error: "Descreva o projeto em 12 a 3000 caracteres." });
    }

    const estimate = await generateValidatedJson({
      capability: "publicEstimate",
      system: "Você é um assistente de pré-atendimento comercial. Resuma escopo, tipologia provável, medidas mencionadas e perguntas faltantes. NÃO invente preços, SKUs, prazos ou disponibilidade. NÃO produza orçamento vinculante nem preço comercial. Responda em português do Brasil, JSON válido com scopeSummary, detectedDimensions, questions e disclaimer.",
      prompt,
      onGeneration: event => { usage = event.usage; modelUsed = event.model || modelUsed; },
      validate: (value: any) => {
        if (!value || typeof value !== "object" || Array.isArray(value) ||
            typeof value.scopeSummary !== "string" ||
            !Array.isArray(value.questions) ||
            !value.questions.every((question: unknown) => typeof question === "string") ||
            typeof value.disclaimer !== "string") {
          throw new Error("Invalid public estimate response schema.");
        }
        if (value.questions.length > 10) throw new Error("Public estimate returned too many follow-up questions.");
        return {
          scopeSummary: value.scopeSummary.slice(0, 4000),
          detectedDimensions: Array.isArray(value.detectedDimensions) ? value.detectedDimensions.slice(0, 20) : [],
          questions: value.questions.slice(0, 10).map((question: string) => question.slice(0, 500)),
          disclaimer: value.disclaimer.slice(0, 1000),
        };
      },
    });

    await recordAIAudit({
      serviceName: "BUDGET",
      modelUsed,
      input: { description: prompt, channel: "public" },
      output: estimate,
      usage,
      requestId: String(req.headers?.["x-request-id"] || ""),
      startedAt: requestStartedAt,
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
          serviceName: "BUDGET",
          modelUsed: AI_CONFIG.publicEstimate.model,
          input: { description: auditPrompt, channel: "public" },
          error,
          requestId: String(req.headers?.["x-request-id"] || ""),
          startedAt: requestStartedAt,
        });
      } catch (auditError) {
        console.error("[PUBLIC_QUOTE_FAILURE_AUDIT]", auditError);
      }
    }
    console.error("[PUBLIC_QUOTE_ESTIMATE]", error);
    return send(res, 503, { error: "Pré-avaliação temporariamente indisponível." });
  }
}
