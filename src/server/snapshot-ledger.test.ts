import assert from "node:assert/strict";
import test from "node:test";
import { createBudgetSnapshot } from "./snapshot-ledger.js";

const base = {
  documentId: "quote-1",
  documentNumber: "ORC-001",
  approvedAt: "2026-11-27T12:00:00.000Z",
  approvedBy: { uid: "admin-1", email: "admin@example.com", role: "admin" },
  currency: "BRL",
  lines: [{
    id: "line-1",
    description: "Janela",
    quantity: 2,
    unitPrice: 100,
    priceValidation: "CATALOG_VERIFIED",
  }],
  subtotal: 200,
  labor: 20,
  laborRate: 10,
  margin: 11,
  marginRate: 5,
  freight: 15,
  discountRate: 10,
  discountAmount: 24.6,
  taxRate: 5,
  taxAmount: 11.07,
  total: 232.47,
  modelSignature: { provider: "test", model: "test" },
};

test("immutable budget snapshot preserves all commercial total components", () => {
  const snapshot = createBudgetSnapshot(base);
  assert.equal(snapshot.subtotal, 200);
  assert.equal(snapshot.labor, 20);
  assert.equal(snapshot.margin, 11);
  assert.equal(snapshot.freight, 15);
  assert.equal(snapshot.discountAmount, 24.6);
  assert.equal(snapshot.taxAmount, 11.07);
  assert.equal(snapshot.total, 232.47);
  assert.ok(snapshot.contentHash);
});

test("snapshot hash changes when labor or freight changes", () => {
  const original = createBudgetSnapshot(base);
  const changed = createBudgetSnapshot({ ...base, labor: 30 });
  assert.notEqual(original.contentHash, changed.contentHash);
});
