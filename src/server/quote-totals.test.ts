import assert from "node:assert/strict";
import test from "node:test";
import { calculateApprovedQuoteTotals } from "../utils/quote-totals.js";

test("approved quote total includes labor, margin, freight, discount and tax", () => {
  const totals = calculateApprovedQuoteTotals({
    laborRate: 10,
    marginRate: 5,
    freight: 15,
    discountRate: 10,
    taxRate: 5,
  }, [{ quantity: 2, unitPrice: 100 }]);
  assert.deepEqual(totals, {
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
  });
});

test("uses explicit labor and margin values when no percentage is configured", () => {
  const totals = calculateApprovedQuoteTotals({
    labor: { amount: 50 },
    margin: 12,
    freight: 8,
  }, [{ quantity: 1, unitPrice: 100 }]);
  assert.equal(totals.labor, 50);
  assert.equal(totals.margin, 12);
  assert.equal(totals.freight, 8);
  assert.equal(totals.total, 170);
});

test("rejects invalid rates instead of silently changing the total", () => {
  assert.throws(() => calculateApprovedQuoteTotals({ taxRate: 150 }, [{ quantity: 1, unitPrice: 10 }]), /inválidos/);
});
