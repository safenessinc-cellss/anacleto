import { createHash } from "node:crypto";

type LocalWindow = { count: number; resetAt: number };
const localWindows = new Map<string, LocalWindow>();

const RATE_LIMIT_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('TTL', KEYS[1])",
  "return {count, ttl}",
].join("\n");

function headerValue(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

/** Prefer the platform-provided real IP; never trust the first forwarded value. */
export function getClientIp(req: any): string {
  const realIp = headerValue(req?.headers?.["x-real-ip"]).trim();
  if (realIp) return realIp;
  const forwarded = headerValue(req?.headers?.["x-forwarded-for"])
    .split(",").map(value => value.trim()).filter(Boolean);
  if (forwarded.length) return forwarded[forwarded.length - 1];
  return String(req?.socket?.remoteAddress || req?.ip || "unknown");
}

/**
 * Atomic fixed-window quota shared across serverless instances through Upstash.
 * Production fails closed when Redis is not configured; local memory is only
 * a development fallback and is bounded/pruned to avoid unbounded growth.
 */
export async function consumeRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  if (!bucket || !identifier || !Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Invalid rate-limit configuration.");
  }
  const url = String(process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  const production = process.env.NODE_ENV === "production";

  if (url && token) {
    const identityHash = createHash("sha256").update(identifier).digest("hex");
    const key = "anacleto:rate:" + bucket + ":" + identityHash;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", RATE_LIMIT_SCRIPT, "1", key, String(Math.max(1, Math.ceil(windowMs / 1000)))]),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("Distributed rate-limit service returned HTTP " + response.status + ".");
    const payload = await response.json() as { result?: unknown; error?: string };
    if (payload.error) throw new Error("Distributed rate-limit command failed: " + payload.error);
    const result = Array.isArray(payload.result) ? Number(payload.result[0]) : Number(payload.result);
    if (!Number.isFinite(result) || result < 1) throw new Error("Distributed rate-limit service returned an invalid counter.");
    return result <= limit;
  }

  if (production) throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for production rate limiting.");

  const now = Date.now();
  for (const [key, value] of localWindows) if (now >= value.resetAt) localWindows.delete(key);
  const identityHash = createHash("sha256").update(identifier).digest("hex");
  const key = bucket + ":" + identityHash;
  const current = localWindows.get(key);
  if (!current || now >= current.resetAt) {
    if (localWindows.size >= 5000) {
      const firstKey = localWindows.keys().next().value;
      if (firstKey) localWindows.delete(firstKey);
    }
    localWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}
