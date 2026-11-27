import test from "node:test";
import assert from "node:assert/strict";
import { hasAIRole } from "./ai-roles.js";

test("budget, finance and CAD capabilities use explicit shared role policies", () => {
  assert.equal(hasAIRole("colaborador", "budget"), true);
  assert.equal(hasAIRole("colaborador", "financial"), false);
  assert.equal(hasAIRole("financeiro", "financial"), true);
  assert.equal(hasAIRole("qualidade", "technicalDrawing"), true);
  assert.equal(hasAIRole("qualidade", "budget"), false);
  assert.equal(hasAIRole("producao", "snapshotDrawing"), true);
  assert.equal(hasAIRole("producao", "snapshotQuote"), false);
});

test("role checks normalize case and whitespace", () => {
  assert.equal(hasAIRole("  SUPER_ADMIN ", "financial"), true);
  assert.equal(hasAIRole("unknown", "budget"), false);
  assert.equal(hasAIRole(undefined, "technicalDrawing"), false);
});
