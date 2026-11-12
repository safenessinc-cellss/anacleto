import { createHash } from "node:crypto";
import { generateText } from "ai";
import { AI_CONFIG, getAIModel } from "../../src/server/ai-config";
import { parseAIJson } from "../../src/server/ai-json";
import { recordAIAudit } from "../../src/server/ai-audit";

type RateState = { count: number; resetAt: number };
const localWindows = new Map<string, RateState>();
function send(res: any, status: number, payload: unknown) {
  res.setHeader?.("Cache-Control", "no-store");
  return res.status(status).json(payload);
}
function clientIp(req: any): string {
  const trustedRealIp = String(req.headers?.["x-real-ip"] || "").trim();
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",").map((value: string) => value.trim()).filter(Boolean);
  const address = trustedRealIp || forwarded[forwarded.length - 1] || String(req.socket?.remoteAddress || req.ip || "unknown");
  return createHash("sha256").update(address).digest("hex");
}
async function consumePublicQuota(ip: string): Promise<boolean> {
 const now=Date.now();for(const [key,value] of localWindows)if(now>=value.resetAt)localWindows.delete(key);
 const current=localWindows.get(ip);if(!current||now>=current.resetAt){localWindows.set(ip,{count:1,resetAt:now+3600000});return true;}
 current.count+=1;return current.count<=3;
}
export default async function handler(req: any, res: any) {
  const requestStartedAt = Date.now();
  let auditPrompt = "";
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return send(res, 405, { error: "Método não permitido." });
  }
  try {
    const ip = clientIp(req);
    if (!(await consumePublicQuota(ip))) return send(res, 429, { error: "Limite público atingido: 3 solicitações por hora. Entre em contato com a equipe comercial." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "description")) {
      return send(res, 400, { error: "A solicitação contém campos não permitidos." });
    }
    const prompt = typeof body.description === "string" ? body.description.trim() : "";
    auditPrompt = prompt;
    if (prompt.length < 12 || prompt.length > 3000) return send(res, 400, { error: "Descreva o projeto em 12 a 3000 caracteres." });
    const aiStartedAt = Date.now();
    const result = await generateText({
      model: getAIModel("publicEstimate"),
      system: "Você é um assistente de pré-atendimento comercial. Resuma escopo, tipologia provável, medidas mencionadas e perguntas faltantes. NÃO invente preços, SKUs, prazos ou disponibilidade. NÃO produza orçamento vinculante nem preço comercial. Responda em português do Brasil, JSON válido com scopeSummary, detectedDimensions, questions, disclaimer.",
      prompt,
      temperature: AI_CONFIG.publicEstimate.temperature,
      maxOutputTokens: AI_CONFIG.publicEstimate.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_CONFIG.publicEstimate.timeoutMs),
    });
    let estimate: Record<string, unknown>;
    try {
      estimate = parseAIJson(result.text, (value: any) => {
        if (!value || typeof value !== "object" || Array.isArray(value) ||
            typeof value.scopeSummary !== "string" || !Array.isArray(value.questions) ||
            typeof value.disclaimer !== "string") throw new Error("Invalid public estimate response schema.");
        return value as Record<string, unknown>;
      });
    } catch (parseError) {
      await recordAIAudit({
        serviceName: "BUDGET", modelUsed: AI_CONFIG.publicEstimate.model,
        input: { description: prompt, channel: "public" }, output: result.text,
        usage: result.usage as any, error: parseError, startedAt: aiStartedAt,
        requestId: String(req.headers?.["x-request-id"] || ""),
      });
      return send(res, 502, { error: "Não foi possível estruturar a pré-avaliação. Tente novamente." });
    }
    await recordAIAudit({
      serviceName: "BUDGET",
      modelUsed: AI_CONFIG.publicEstimate.model,
      input: { description: prompt, channel: "public" },
      output: estimate,
      usage: result.usage as any,
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
    return send(res, 503, { error: "Pré-avaliação temporariamente indisponível." });
  }
}
