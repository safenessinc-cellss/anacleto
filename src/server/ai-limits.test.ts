import test from "node:test";
import assert from "node:assert/strict";
import { AI_RATE_LIMITS, getAIRateLimit } from "./ai-limits.js";

test("all AI routes have explicit finite quotas", () => {
  for (const [bucket, policy] of Object.entries(AI_RATE_LIMITS)) {
    assert.ok(bucket.length > 0);
    assert.ok(Number.isInteger(policy.limit) && policy.limit > 0);
    assert.ok(Number.isInteger(policy.windowMs) && policy.windowMs > 0);
  }
});

test("unknown quota buckets are rejected", () => {
  assert.throws(() => getAIRateLimit("unregistered-route"), /No AI rate-limit policy/);
  assert.deepEqual(getAIRateLimit("payment-pix"), { limit: 5, windowMs: 60_000 });
  assert.deepEqual(getAIRateLimit("generate-3d-render"), { limit: 3, windowMs: 60_000 });
  assert.deepEqual(getAIRateLimit("architectural-visualization"), { limit: 3, windowMs: 60_000 });
  assert.deepEqual(getAIRateLimit("public-quote-estimate"), { limit: 3, windowMs: 3_600_000 });
});
