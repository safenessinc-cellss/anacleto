import { generateText } from "ai";
import { GoogleGenAI } from "@google/genai";
import { AI_CONFIG, getAIModel } from "./ai-config";

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
  let raw = "";
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retries; attempt++) {
    const prompt = attempt === 0
      ? options.prompt
      : `Corrija exclusivamente a estrutura da resposta abaixo para JSON válido conforme as instruções. Preserve todos os dados; não invente nem complete informações ausentes. Retorne somente JSON.\nERRO DE VALIDAÇÃO: ${String((lastError as Error)?.message || lastError)}\nRESPOSTA ORIGINAL:\n${raw}`;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    let usage: any;
    if (apiKey) {
      const client = new GoogleGenAI({ apiKey });
      const result = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
          temperature: options.temperature ?? config.temperature,
          maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
          abortSignal: AbortSignal.timeout(config.timeoutMs),
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
        abortSignal: AbortSignal.timeout(config.timeoutMs),
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
  throw new AIJsonError("A IA não conseguiu gerar uma resposta estruturada válida após a tentativa de recuperação.", lastError);
}
