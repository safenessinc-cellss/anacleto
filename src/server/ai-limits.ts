/** Central quota policy for every AI generation and extraction endpoint. */
export interface AIRateLimitPolicy { limit: number; windowMs: number }
const WINDOW_MINUTE = 60_000;
export const AI_RATE_LIMITS: Readonly<Record<string, AIRateLimitPolicy>> = Object.freeze({
  "financial-assistant": { limit: 15, windowMs: WINDOW_MINUTE },
  "quote-agent": { limit: 30, windowMs: WINDOW_MINUTE },
  "budget-items": { limit: 30, windowMs: WINDOW_MINUTE },
  "project-intake": { limit: 20, windowMs: WINDOW_MINUTE },
  "financial-ai": { limit: 8, windowMs: WINDOW_MINUTE },
  "purchase-ai": { limit: 8, windowMs: WINDOW_MINUTE },
  "technical-drawing": { limit: 12, windowMs: WINDOW_MINUTE },
  "public-chat": { limit: 12, windowMs: WINDOW_MINUTE },
  "public-architectural-visualization": { limit: 3, windowMs: WINDOW_MINUTE },
  "generate-3d-render": { limit: 3, windowMs: WINDOW_MINUTE },
  "public-quote-estimate": { limit: 3, windowMs: 60 * 60_000 },
});
export function getAIRateLimit(bucket: string): AIRateLimitPolicy {
  const policy = AI_RATE_LIMITS[bucket];
  if (!policy) throw new Error(`No AI rate-limit policy is registered for bucket: ${bucket}`);
  return policy;
}
