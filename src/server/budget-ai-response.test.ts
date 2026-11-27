import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBudgetAIDraftResponse } from "./budget-ai-response.js";

test("keeps a provisional draft when quantity is unknown and asks for it", () => {
  const result = normalizeBudgetAIDraftResponse({
    items: [{ description: "Janela de correr", qty: 0, price: 0 }],
    notes: "As medidas ainda não foram informadas.",
    pendingQuestions: [],
    visitRequired: false,
    visitReason: "",
  });
  assert.equal(result.items[0].qty, 0);
  assert.equal(result.items[0].price, 0);
  assert.equal(result.pendingQuestions.length, 1);
  assert.match(result.pendingQuestions[0], /quantidade e as medidas/);
});

test("keeps an empty provisional draft when a site visit is required", () => {
  const result = normalizeBudgetAIDraftResponse({
    items: [],
    notes: "Reforma a avaliar no local.",
    pendingQuestions: [],
    visitRequired: true,
    visitReason: "Inspecionar terreno e acesso.",
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.visitRequired, true);
  assert.equal(result.pendingQuestions.length, 1);
});

test("rejects an empty response without questions or visit requirement", () => {
  assert.throws(() => normalizeBudgetAIDraftResponse({
    items: [], notes: "", pendingQuestions: [], visitRequired: false, visitReason: "",
  }), /não identificou itens/);
});

test("rejects negative or non-finite quantities and prices", () => {
  assert.throws(() => normalizeBudgetAIDraftResponse({
    items: [{ description: "Perfil", qty: -1, price: 0 }],
    pendingQuestions: [], visitRequired: false,
  }), /Linha inválida/);
});

test("adds a quantity question even when other questions are already present", () => {
  const result = normalizeBudgetAIDraftResponse({
    items: [{ description: "Piscina", qty: 0, price: 0 }],
    notes: "Projeto preliminar.",
    pendingQuestions: ["Qual o revestimento desejado?"],
    visitRequired: true,
    visitReason: "Inspecionar terreno e acesso.",
  });
  assert.equal(result.pendingQuestions.length, 2);
  assert.ok(result.pendingQuestions.some(question => /quantidade e as medidas/.test(question)));
});
