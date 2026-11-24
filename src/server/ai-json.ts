import { generateText } from "ai";
import { GoogleGenAI } from "@google/genai";
import { AI_CONFIG, getAIModel } from "./ai-config.js";

export class AIJsonError extends Error {
  readonly code = "AI_INVALID_STRUCTURED_RESPONSE";
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AIJsonError";
  }
}

/** Extract JSON while respecting quoted strings and escaped characters. */
export function extractJsonText(input: unknown): string {
  const raw = String(input ?? "").replace(/^\uFEFF/, "").trim();
  if (!raw) throw new AIJsonError("A IA retornou uma resposta vazia.");
  const unfenced = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = unfenced.indexOf("{");
  if (start < 0) throw new AIJsonError("A resposta da IA não contém um objeto JSON.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < unfenced.length; i++) {
    const char = unfenced[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return unfenced.slice(start, i + 1);
  }
  throw new AIJsonError("O JSON retornado pela IA está incompleto.");
}

export function parseAIJson<T>(input: unknown, validate: (value: any) => T): T {
  try {
    return validate(JSON.parse(extractJsonText(input)));
  } catch (error) {
    if (error instanceof AIJsonError) throw error;
    throw new AIJsonError("A resposta estruturada da IA não passou na validação.", error);
  }
}

/**
 * Generate, sanitize, validate, then perform one bounded repair attempt.
 * The repair never supplies business facts: it only asks the model to fix the
 * structure using the original response and schema instructions.
 */
function providerStatus(error: any): number {
  return Number(error?.status || error?.statusCode || error?.cause?.status || error?.cause?.statusCode || 0);
}
function providerMessage(error: any): string {
  return String(error?.message || error?.cause?.message || error || "Unknown AI provider error").slice(0, 1200);
}
function isRetryableProviderError(error: any): boolean {
  const status = providerStatus(error);
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
    || /high demand|temporarily unavailable|overloaded|rate.?limit|resource exhausted/i.test(providerMessage(error));
}
function geminiModelName(value: string): string {
  return value.replace(/^google\//, "").replace(/^models\//, "");
}
async function generateWithOpenAI(options: {
  system: string; prompt: string; timeoutMs: number; maxOutputTokens: number;
}): Promise<{ text: string; usage?: any }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada para fallback.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANACLETO_OPENAI_FALLBACK_MODEL || "gpt-4.1-mini",
      temperature: 0,
      max_tokens: options.maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.system + "\nResponda exclusivamente com um objeto JSON válido, sem markdown." },
        { role: "user", content: options.prompt },
      ],
    }),
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || "OpenAI fallback failed"), { statusCode: response.status });
  return {
    text: String(payload?.choices?.[0]?.message?.content || ""),
    usage: { inputTokens: payload?.usage?.prompt_tokens, outputTokens: payload?.usage?.completion_tokens },
  };
}

/**
 * Uses direct Gemini API first (does not depend on Vercel AI Gateway billing),
 * retries transient provider errors once within a single total deadline, then
 * falls back to OpenAI when OPENAI_API_KEY is configured. JSON is always parsed
 * and validated by the caller before it can be used by business workflows.
 */
export async function generateValidatedJson<T>(options: {
  capability: keyof typeof AI_CONFIG;
  system: string;
  prompt: string;
  validate: (value: any) => T;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: Record<string, unknown>;
  onGeneration?: (event: { text: string; usage?: { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number }; attempt: number }) => void;
}): Promise<T> {
  const config = AI_CONFIG[options.capability];
  const totalTimeoutMs = Math.min(config.timeoutMs, 50_000);
  const deadline = Date.now() + totalTimeoutMs;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const openAIKey = process.env.OPENAI_API_KEY || "";
  const gatewayConfigured = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  const configuredModel = String(config.model || "google/gemini-3.8-flash");
  const modelCandidates = [...new Set([
    geminiModelName(configuredModel),
    "gemini-3.8-flash",
  ])];
  let lastError: unknown;
  let raw = "";

  if (!geminiKey && !openAIKey && !gatewayConfigured) {
    throw Object.assign(new Error("Nenhum provedor de IA configurado. Configure GEMINI_API_KEY ou OPENAI_API_KEY no Vercel."), { statusCode: 503, code: "AI_PROVIDER_NOT_CONFIGURED" });
  }

  if (geminiKey) {
    const client = new GoogleGenAI({ apiKey: geminiKey });
    for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex++) {
      const model = modelCandidates[modelIndex];
      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < 1_500) break;
        try {
          const result = await client.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: options.prompt }] }],
            config: {
              systemInstruction: options.system,
              responseMimeType: "application/json",
              ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
              temperature: options.temperature ?? config.temperature,
              maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
              abortSignal: AbortSignal.timeout(Math.min(remaining, attempt === 0 ? Math.max(5_000, remaining - 1_500) : remaining)),
            },
          });
          raw = result.text || "";
          const usage = { inputTokens: result.usageMetadata?.promptTokenCount, outputTokens: result.usageMetadata?.candidatesTokenCount };
          options.onGeneration?.({ text: raw, usage, attempt });
          return parseAIJson(raw, options.validate);
        } catch (error: any) {
          lastError = error;
          const status = providerStatus(error);
          console.error("[AI_PROVIDER] Gemini request failed", {
            capability: options.capability, model, status,
            retryable: isRetryableProviderError(error), message: providerMessage(error),
          });
          if (status === 404 && modelIndex === 0 && modelCandidates.length > 1) break;
          if (attempt === 0 && isRetryableProviderError(error) && Date.now() + 500 < deadline) {
            await new Promise(resolve => setTimeout(resolve, 350));
            continue;
          }
          break;
        }
      }
    }
  }

  if (openAIKey && Date.now() + 1_500 < deadline) {
    try {
      const fallback = await generateWithOpenAI({
        system: options.system + (options.responseSchema ? "\nSchema esperado: " + JSON.stringify(options.responseSchema) : ""),
        prompt: options.prompt,
        timeoutMs: Math.max(1_500, deadline - Date.now()),
        maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
      });
      raw = fallback.text;
      options.onGeneration?.({ text: raw, usage: fallback.usage, attempt: 2 });
      return parseAIJson(raw, options.validate);
    } catch (error) {
      lastError = error;
      console.error("[AI_PROVIDER] OpenAI fallback failed", {
        capability: options.capability, message: providerMessage(error), status: providerStatus(error),
      });
    }
  }

  // Gateway is a last resort only. A 403 customer-verification/billing error is
  // not retried and is surfaced clearly instead of being mislabeled as timeout.
  if (!geminiKey && !openAIKey && gatewayConfigured && Date.now() < deadline) {
    try {
      const result = await generateText({
        model: getAIModel(options.capability), system: options.system, prompt: options.prompt,
        temperature: options.temperature ?? config.temperature,
        maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
        abortSignal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      });
      options.onGeneration?.({ text: result.text || "", usage: result.usage as any, attempt: 0 });
      return parseAIJson(result.text, options.validate);
    } catch (error) {
      lastError = error;
    }
  }

  const statusCode = providerStatus(lastError);
  const detail = providerMessage(lastError);
  throw Object.assign(
    new AIJsonError("Todos os provedores de IA falharam para " + options.capability + ": " + detail, lastError),
    { statusCode: statusCode >= 400 && statusCode < 600 ? statusCode : 503, code: "AI_PROVIDER_UNAVAILABLE" },
  );
}
