import assert from "node:assert/strict";
import test from "node:test";
import { hasConfirmedCatalogPrice } from "../utils/catalog-price-validation.js";

test("accepts a positive price with explicit verified price review", () => {
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5, status: "verified", priceStatus: "verified" }), true);
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5, status: "Ativo", reviewStatus: "verified" }), true);
});

test("does not treat legacy active catalog prices as confirmed", () => {
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5, status: "Ativo" }), false);
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5, status: "verified" }), false);
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5 }), false);
});

test("rejects any explicit pending or rejected review state", () => {
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5, status: "verified", priceStatus: "pending_review" }), false);
  assert.equal(hasConfirmedCatalogPrice({ price: 125.5, reviewStatus: "rejected" }), false);
});

test("requires a positive finite price", () => {
  assert.equal(hasConfirmedCatalogPrice({ price: 0, status: "verified" }), false);
  assert.equal(hasConfirmedCatalogPrice({ price: "invalid", status: "verified" }), false);
});
