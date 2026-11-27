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
  "payment-pix": { limit: 5, windowMs: WINDOW_MINUTE },
  "payment-link": { limit: 5, windowMs: WINDOW_MINUTE },
  "technical-drawing": { limit: 12, windowMs: WINDOW_MINUTE },
  "approved-snapshot": { limit: 6, windowMs: WINDOW_MINUTE },
});
export function getAIRateLimit(bucket: string): AIRateLimitPolicy {
  const policy = AI_RATE_LIMITS[bucket];
  if (!policy) throw new Error(`No AI rate-limit policy is registered for bucket: ${bucket}`);
  return policy;
}
