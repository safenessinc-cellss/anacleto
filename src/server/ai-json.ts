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
  // timeoutMs is the TOTAL budget for all attempts, not a per-attempt timeout.
  // This prevents a retry from running beyond Vercel's function execution window.
  const deadline = Date.now() + config.timeoutMs;
  let raw = "";
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1_500) break;

    // Reserve up to 5 seconds for one bounded JSON-repair attempt.
    const attemptTimeoutMs = attempt === 0 && config.retries > 0
      ? Math.max(1_500, remainingMs - 5_000)
      : remainingMs;
    const signal = AbortSignal.timeout(attemptTimeoutMs);
    const prompt = attempt === 0
      ? options.prompt
      : `Corrija exclusivamente a estrutura da resposta abaixo para JSON válido conforme as instruções. Preserve os dados; não invente nem complete informações ausentes. Retorne somente JSON.\\nERRO DE VALIDAÇÃO: ${String((lastError as Error)?.message || lastError).slice(0, 500)}\\nRESPOSTA ORIGINAL:\\n${raw.slice(0, 20_000)}`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    let usage: any;

    if (apiKey) {
      const client = new GoogleGenAI({ apiKey });
      const result = await client.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
          temperature: options.temperature ?? config.temperature,
          maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
          abortSignal: signal,
        },
      });
      raw = result.text || "";
      usage = { inputTokens: result.usageMetadata?.promptTokenCount, outputTokens: result.usageMetadata?.candidatesTokenCount };
    } else {
      const result = await generateText({
        model: getAIModel(options.capability),
        system: options.system,
        prompt,
        temperature: options.temperature ?? config.temperature,
        maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
        abortSignal: signal,
      });
      raw = result.text || "";
      usage = result.usage as any;
    }

    options.onGeneration?.({ text: raw, usage, attempt });
    try {
      return parseAIJson(raw, options.validate);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new AIJsonError("A IA não conseguiu gerar uma resposta estruturada válida dentro do tempo disponível.", lastError);
  }
  throw new AIJsonError("Tempo limite excedido ao consultar o provedor de IA.");
}
