import test from "node:test";
import assert from "node:assert/strict";
import { stripBearerPrefix } from "./auth-token.js";

test("stripBearerPrefix removes a case-insensitive Bearer scheme", () => {
  assert.equal(stripBearerPrefix("Bearer abc123"), "abc123");
  assert.equal(stripBearerPrefix("bearer abc123"), "abc123");
  assert.equal(stripBearerPrefix("  BEARER   abc123  "), "abc123");
});

test("stripBearerPrefix does not alter a raw token", () => {
  assert.equal(stripBearerPrefix("abc123"), "abc123");
  assert.equal(stripBearerPrefix(""), "");
  assert.equal(stripBearerPrefix(undefined), "");
});
