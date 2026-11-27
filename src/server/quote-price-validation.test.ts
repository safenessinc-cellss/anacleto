import assert from "node:assert/strict";
import test from "node:test";
import { isUnconfirmedPriceSource } from "../utils/quote-price-validation.js";

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
