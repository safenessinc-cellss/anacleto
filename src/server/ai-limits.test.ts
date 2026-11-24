import test from "node:test";
import assert from "node:assert/strict";
import { AI_RATE_LIMITS, getAIRateLimit } from "./ai-limits.js";

test("all AI capabilities have explicit finite quotas", () => {
  for (const [bucket, policy] of Object.entries(AI_RATE_LIMITS)) {
    assert.ok(bucket.length > 0);
    assert.ok(Number.isInteger(policy.limit) && policy.limit > 0);
    assert.ok(Number.isInteger(policy.windowMs) && policy.windowMs > 0);
  }
});

test("unknown AI quota buckets are rejected instead of silently unbounded", () => {
  assert.throws(() => getAIRateLimit("unregistered-ai-route"), /No AI rate-limit policy/);
  assert.deepEqual(getAIRateLimit("technical-drawing"), { limit: 12, windowMs: 60_000 });
});
