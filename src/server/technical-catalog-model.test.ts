import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTechnicalIdentityKey, isSupplierOfferUsable, isTechnicalProductUsable,
  validateSupplierOffer, validateTechnicalProduct, type SupplierOffer, type TechnicalProduct
} from "./technical-catalog-model.ts";

const product: TechnicalProduct = {
  id: "tp-1", identityKey: "aluminum-profile__fabricante-a__linha-25__p-001__standard__branco",
  kind: "aluminum_profile", manufacturer: "Fabricante A", line: "Linha 25",
  manufacturerCode: "P-001", description: "Perfil montante", variantKey: "standard",
  finish: "Branco", technicalProperties: { weightKgM: 1.25 }, compatibilityKeys: ["fab-a:linha25:p-001:branco"],
  source: { sourceDocumentId: "doc-1", sourcePage: 12 }, status: "verified",
  reviewedBy: "reviewer-uid", reviewedAt: "2026-11-20T12:00:00.000Z",
  createdAt: "2026-11-20T11:00:00.000Z", updatedAt: "2026-11-20T12:00:00.000Z"
};
const offer: SupplierOffer = {
  id: "offer-1", technicalProductId: "tp-1", supplierId: "supplier-1",
  supplierName: "Distribuidor A", supplierProductCode: "SKU-DIST-99",
  unit: "bar", unitPrice: 120, currency: "BRL", priceDate: "2026-11-20T10:00:00.000Z",
  validUntil: "2026-12-20T23:59:59.000Z", availability: "in_stock",
  shippingCost: 0, shippingConfirmed: true,
  source: { sourceDocumentId: "quote-doc-1", sourcePage: 1 },
  status: "verified", priceStatus: "verified", reviewedBy: "reviewer-uid",
  reviewedAt: "2026-11-20T12:00:00.000Z",
  createdAt: "2026-11-20T10:00:00.000Z", updatedAt: "2026-11-20T12:00:00.000Z"
};

test("technical identity ignores reseller and normalizes spelling/case", () => {
  const key = buildTechnicalIdentityKey(product);
  assert.equal(key, buildTechnicalIdentityKey({ ...product, manufacturer: "FABRICANTE Á", line: "linha 25" }));
});
test("technical product requires source document/page and explicit approval", () => {
  assert.deepEqual(validateTechnicalProduct(product), []);
  assert.equal(isTechnicalProductUsable(product), true);
  assert.equal(isTechnicalProductUsable({ ...product, status: "pending_review" }), false);
  assert.ok(validateTechnicalProduct({ ...product, source: { sourceDocumentId: "", sourcePage: 0 } }).length >= 2);
});
test("supplier offers require both technical linkage and price approval", () => {
  assert.deepEqual(validateSupplierOffer(offer), []);
  assert.equal(isSupplierOfferUsable(offer, Date.parse("2026-11-20T13:00:00.000Z")), true);
  assert.equal(isSupplierOfferUsable({ ...offer, priceStatus: "pending_review" }, Date.parse("2026-11-20T13:00:00.000Z")), false);
  assert.equal(isSupplierOfferUsable({ ...offer, technicalProductId: "" }, Date.parse("2026-11-20T13:00:00.000Z")), false);
});
test("stale and expired offers never feed purchase comparison", () => {
  assert.equal(isSupplierOfferUsable({ ...offer, priceDate: "2026-09-01T00:00:00.000Z" }, Date.parse("2026-11-20T13:00:00.000Z")), false);
  assert.equal(isSupplierOfferUsable({ ...offer, validUntil: "2026-11-01T00:00:00.000Z" }, Date.parse("2026-11-20T13:00:00.000Z")), false);
});
