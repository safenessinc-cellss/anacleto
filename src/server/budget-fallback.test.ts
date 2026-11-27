import test from "node:test";
import assert from "node:assert/strict";
import { buildBudgetAIFallback } from "./budget-fallback.js";

test("provider failure creates a zero-value provisional draft with explicit pending questions", () => {
  const result = buildBudgetAIFallback("Reforma de uma casa com piscina e churrasqueira");
  assert.equal(result.fallback, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 0);
  assert.equal(result.items[0].price, 0);
  assert.equal(result.items[0].priceSource, "pending");
  assert.ok(result.pendingQuestions.some((question) => question.includes("medidas")));
  assert.ok(result.pendingQuestions.some((question) => question.includes("quantidade")));
  assert.equal(result.visitRequired, true);
});

test("leaf count is not mistaken for product quantity", () => {
  const result = buildBudgetAIFallback("Janela de alumínio com 2 folhas");
  assert.ok(result.pendingQuestions.some((question) => question.includes("quantidade")));
  assert.equal(result.items[0].qty, 0);
});

test("explicit dimensions and quantity are not asked again, but no prices are invented", () => {
  const result = buildBudgetAIFallback("Janela 1200 x 1500 mm, 2 unidades, alumínio branco");
  assert.ok(!result.pendingQuestions.some((question) => question.includes("medidas")));
  assert.ok(!result.pendingQuestions.some((question) => question.includes("quantidade")));
  assert.equal(result.items[0].price, 0);
  assert.equal(result.items[0].qty, 2);
});
