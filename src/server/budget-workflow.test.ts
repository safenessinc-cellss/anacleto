import assert from "node:assert/strict";
import test from "node:test";
import { buildCommercialQuoteDraft, isTechnicalVisitPending } from "../utils/budget-workflow.js";

test("converts smart budgets while preserving confirmed and pending price provenance", () => {
  const quote = buildCommercialQuoteDraft({
    clientName: "Cliente A",
    items: [
      { id: "i1", description: "Janela", quantity: 2, unitPrice: 350, priceSource: "catalog", catalogItemId: "cat-1", catalogSource: "catalog", sku: "J-1" },
      { id: "i2", description: "Instalação", quantity: 1, unitPrice: 0, priceSource: "pending" },
    ],
    laborAmount: 100,
  }, "smart", "abc12345", new Date("2026-11-27T12:00:00.000Z"));
  assert.equal(quote.items[0].priceSource, "catalog");
  assert.equal(quote.items[0].catalogItemId, "cat-1");
  assert.equal(quote.items[1].priceSource, "pending");
  assert.equal(quote.requiresTechnicalVisit, false);
  assert.equal(quote.total, 800);
});

test("converts technical BOM as preliminary, estimates supplier prices and requires a visit", () => {
  const quote = buildCommercialQuoteDraft({
    clientName: "Cliente B",
    bomData: { bom: [{ id: "p1", code: "P-01", description: "Perfil", quantity: 2, unit: "bar" }] },
    comparisons: [{ supplier: "Fornecedor X", complete: true, verified: true, lines: [{ itemId: "p1", quantityToBuy: 2, unitPrice: 80, status: "priced", offerId: "offer-1" }] }],
    bestSupplier: "Fornecedor X",
    laborAmount: 50,
    total: 250,
  }, "technical", "tech12345", new Date("2026-11-27T12:00:00.000Z"));
  assert.equal(quote.items[0].priceSource, "estimated");
  assert.equal(quote.items[0].unitPrice, 80);
  assert.equal(quote.items[0].sku, "");
  assert.equal(quote.requiresTechnicalVisit, true);
  assert.equal(quote.technicalVisitStatus, "pending");
  assert.equal(isTechnicalVisitPending(quote), true);
});

test("blocks final approval until a required technical visit is completed", () => {
  assert.equal(isTechnicalVisitPending({ requiresTechnicalVisit: true }), true);
  assert.equal(isTechnicalVisitPending({ requiresTechnicalVisit: true, technicalVisitStatus: "pending" }), true);
  assert.equal(isTechnicalVisitPending({ requiresTechnicalVisit: true, technicalVisitStatus: "completed" }), false);
  assert.equal(isTechnicalVisitPending({ requiresTechnicalVisit: false }), false);
});

test("rejects conversion when no valid items exist", () => {
  assert.throws(() => buildCommercialQuoteDraft({ items: [] }, "smart", "empty123"), /não contém itens válidos/);
});
