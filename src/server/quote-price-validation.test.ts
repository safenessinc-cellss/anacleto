import assert from "node:assert/strict";
import test from "node:test";
import { isUnconfirmedPriceSource, requiresCatalogPriceVerification } from "../utils/quote-price-validation.js";

test("blocks pending and estimated prices from final approval", () => {
  for (const value of ["pending", "pendente", "estimated", "estimado", "estimate"]) {
    assert.equal(isUnconfirmedPriceSource(value), true, String(value));
  }
});

test("does not block explicitly manual or catalog-confirmed prices", () => {
  for (const value of ["manual", "catalog", "existing", ""]) {
    assert.equal(isUnconfirmedPriceSource(value), false, String(value));
  }
});

test("manual price can be reviewed by an authorized approver without catalog match", () => {
  assert.equal(requiresCatalogPriceVerification({ sku: "CUSTOM-01", priceSource: "manual" }), false);
  assert.equal(requiresCatalogPriceVerification({ sku: "CAT-01", priceSource: "estimated" }), true);
  assert.equal(requiresCatalogPriceVerification({ catalogItemId: "item-1", priceSource: "manual" }), true);
});
