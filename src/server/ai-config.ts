import { gateway } from "ai";

/**
 * Single source of truth for Anacleto AI model routing and runtime limits.
 * Override models per capability without changing application code.
 */
const DEFAULT_MODEL = process.env.ANACLETO_AI_MODEL || "google/gemini-2.5-flash";

export const AI_CONFIG = {
  default: {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 8192,
    timeoutMs: 45_000,
    retries: 1,
  },
  chat: {
    model: process.env.ANACLETO_CHAT_MODEL || DEFAULT_MODEL,
    temperature: 0.7,
    maxOutputTokens: 4096,
    timeoutMs: 45_000,
    retries: 0,
  },
  quote: {
    model: process.env.ANACLETO_QUOTE_MODEL || DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 5000,
    timeoutMs: 45_000,
    retries: 1,
  },
  budget: {
    model: process.env.ANACLETO_BUDGET_MODEL || DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 5000,
    timeoutMs: 45_000,
    retries: 1,
  },
  projectIntake: {
    model: process.env.ANACLETO_PROJECT_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 3000,
    timeoutMs: 45_000,
    retries: 1,
  },
  technicalDrawing: {
    model: process.env.ANACLETO_DRAWING_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 12000,
    timeoutMs: 45_000,
    retries: 1,
  },
  documentExtraction: {
    model: process.env.ANACLETO_DOCUMENT_MODEL || DEFAULT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 5000,
    timeoutMs: 45_000,
    retries: 1,
  },
  publicEstimate: {
    model: process.env.ANACLETO_PUBLIC_ESTIMATE_MODEL || "google/gemini-2.0-flash-lite",
    temperature: 0.1,
    maxOutputTokens: 1200,
    timeoutMs: 8_000,
    retries: 0,
  },
} as const;

export function getAIModel(capability: keyof typeof AI_CONFIG = "default") {
  return gateway(AI_CONFIG[capability].model);
}
