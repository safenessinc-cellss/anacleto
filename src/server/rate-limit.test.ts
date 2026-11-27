import test from "node:test";
import assert from "node:assert/strict";
import { consumeRateLimit, getClientIp } from "./rate-limit.js";

test("getClientIp prefers the platform real-IP header", () => {
  assert.equal(getClientIp({ headers: { "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.1, 203.0.113.2" } }), "203.0.113.10");
});

test("getClientIp uses the last forwarded address when real-IP is absent", () => {
  assert.equal(getClientIp({ headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.2" } }), "203.0.113.2");
});

test("local rate limits enforce the configured window and limit", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.NODE_ENV = "test";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const bucket = "unit-test-rate-limit-" + Date.now();
    assert.equal(await consumeRateLimit(bucket, "user-1", 2, 60_000), true);
    assert.equal(await consumeRateLimit(bucket, "user-1", 2, 60_000), true);
    assert.equal(await consumeRateLimit(bucket, "user-1", 2, 60_000), false);
    assert.equal(await consumeRateLimit(bucket, "user-2", 2, 60_000), true);
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});


test("production rate limits fail closed without shared Redis even when not explicitly requested", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.NODE_ENV = "production";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    await assert.rejects(consumeRateLimit("production-test", "user-1", 3, 60_000, { requireDistributed: true }), /UPSTASH_REDIS_REST_URL.*required/);
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});
