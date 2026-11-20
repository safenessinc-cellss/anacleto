import test from "node:test";
import assert from "node:assert/strict";
import { compareSupplierOffers, optimizeProfileBars, validateBom, type MarketOffer, type TechnicalBomItem } from "./technical-bom.ts";

const profile: TechnicalBomItem = {
  id: "p1", category: "aluminum_profile", code: "P-001", description: "Perfil montante Linha 25",
  quantity: 2, unit: "bar", cutLengthsMm: [3000, 3000], commercialBarLengthMm: 6000,
  kerfMm: 3, manufacturer: "Fabricante A", system: "Linha 25", finish: "Branco",
  compatibilityKey: "fab-a:linha25:p-001:branco", required: true, technicalStatus: "verified"
};

test("optimizer accepts an exact-fit single cut without charging kerf before first cut", () => {
  const result = optimizeProfileBars([6000], 6000, 3);
  assert.equal(result.bars.length, 1);
  assert.equal(result.bars[0].wasteMm, 0);
});

test("optimizer accounts for kerf between cuts and minimizes simple bar count", () => {
  const result = optimizeProfileBars([3000, 3000], 6000, 3);
  assert.equal(result.bars.length, 2);
  assert.equal(result.totalWasteMm, 6000);
});

test("BOM validation blocks unverified technical rules", () => {
  assert.ok(validateBom([profile]).length === 0);
  assert.ok(validateBom([{ ...profile, technicalStatus: "pending_review" }]).some(message => message.includes("pendente")));
});

test("comparison never mixes compatibility keys and marks incomplete baskets", () => {
  const now = new Date().toISOString();
  const offer: MarketOffer = {
    id: "o1", itemCompatibilityKey: "other-system:profile", supplier: "Fornecedor A",
    supplierUrl: "https://supplier.example", productUrl: "https://supplier.example/p",
    unit: "bar", unitPrice: 100, currency: "BRL", observedAt: now,
    availability: "in_stock", evidence: "supplier_page", verification: "verified"
  };
  const result = compareSupplierOffers([profile], [offer]);
  assert.equal(result.length, 1);
  assert.equal(result[0].complete, false);
  assert.equal(result[0].lines[0].status, "missing_price");
});

test("comparison selects current verified compatible basket", () => {
  const now = new Date().toISOString();
  const offer: MarketOffer = {
    id: "o2", itemCompatibilityKey: profile.compatibilityKey, supplier: "Fornecedor B",
    supplierUrl: "https://supplier.example", productUrl: "https://supplier.example/p",
    unit: "bar", unitPrice: 100, currency: "BRL", observedAt: now,
    availability: "in_stock", evidence: "supplier_page", verification: "verified"
  };
  const result = compareSupplierOffers([profile], [offer]);
  assert.equal(result[0].complete, true);
  assert.equal(result[0].total, 200);
});
