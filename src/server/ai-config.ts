import { gateway } from "ai";

/**
 * Single source of truth for Anacleto AI model routing and runtime limits.
 * Pin the production model in code so stale Vercel environment overrides
 * cannot silently route requests back to retired Gemini 2.5 models.
 */
const DEFAULT_MODEL = "google/gemini-3.8-flash";

export const AI_CONFIG = {
  default: {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 8192,
    timeoutMs: 25_000,
    retries: 1,
  },
  chat: {
    model: DEFAULT_MODEL,
    temperature: 0.7,
    maxOutputTokens: 4096,
    timeoutMs: 20_000,
    retries: 0,
  },
  quote: {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 5000,
    timeoutMs: 35_000,
    retries: 1,
  },
  budget: {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 5000,
    timeoutMs: 35_000,
    retries: 1,
  },
  projectIntake: {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 3000,
    timeoutMs: 35_000,
    retries: 1,
  },
  technicalDrawing: {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 12000,
    timeoutMs: 40_000,
    retries: 1,
  },
  documentExtraction: {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 5000,
    timeoutMs: 35_000,
    retries: 1,
  },
  publicEstimate: {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 1200,
    timeoutMs: 8_000,
    retries: 0,
  },
} as const;

export function getAIModel(capability: keyof typeof AI_CONFIG = "default") {
  return gateway(AI_CONFIG[capability].model);
}
