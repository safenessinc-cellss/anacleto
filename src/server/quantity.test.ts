import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNonNegativeQuantity } from "./quantity.js";

test("missing and zero quantities remain pending instead of defaulting to one", () => {
  assert.deepEqual(normalizeNonNegativeQuantity(undefined), { quantity: 0, pending: true });
  assert.deepEqual(normalizeNonNegativeQuantity(""), { quantity: 0, pending: true });
  assert.deepEqual(normalizeNonNegativeQuantity(0), { quantity: 0, pending: true });
});

test("positive quantities remain explicit", () => {
  assert.deepEqual(normalizeNonNegativeQuantity("2.5"), { quantity: 2.5, pending: false });
});

test("negative and nonnumeric quantities are rejected", () => {
  assert.throws(() => normalizeNonNegativeQuantity(-1), /Quantidade inválida/);
  assert.throws(() => normalizeNonNegativeQuantity("abc"), /Quantidade inválida/);
});
