import assert from "node:assert/strict";
import test from "node:test";
import { shouldAttemptGatewayFallback } from "../utils/ai-provider-routing.js";

test("uses the configured gateway as a last resort when time remains", () => {
  assert.equal(shouldAttemptGatewayFallback(true, 12_000), true);
});

test("does not call an unconfigured gateway or start after the deadline", () => {
  assert.equal(shouldAttemptGatewayFallback(false, 12_000), false);
  assert.equal(shouldAttemptGatewayFallback(true, 1_000), false);
  assert.equal(shouldAttemptGatewayFallback(true, -1), false);
});
