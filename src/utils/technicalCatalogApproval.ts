import type { Firestore } from "firebase/firestore";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import {
  validateCatalogItem,
  type TechnicalCatalogItem,
  type SupplierOffer,
} from "./technicalCatalog";

export interface ReviewApprovalInput {
  reviewId: string;
  canonicalCode: string;
  category: TechnicalCatalogItem["category"];
  description: string;
  unit: TechnicalCatalogItem["unit"];
  supplierId: string;
  supplierName: string;
  supplierSku: string;
  price: number;
  priceBasis: SupplierOffer["basis"];
  validFrom: string;
  sourceUrl: string;
  sourceDocument: string;
  weightKgPerMeter?: number;
  commercialLengthMm?: number;
  glassThicknessMm?: number;
  glassType?: string;
  colorOrFinish?: string;
  systemLineIds: string[];
  compatibleTipologiaIds: string[];
}

export async function approveLegacyCatalogCandidate(db: Firestore, input: ReviewApprovalInput) {
  const required = [
    ["Código canônico", input.canonicalCode],
    ["Descrição", input.description],
    ["Fornecedor", input.supplierId],
    ["SKU original", input.supplierSku],
    ["Fonte do preço", input.sourceUrl || input.sourceDocument],
    ["Data inicial do preço", input.validFrom],
  ] as const;
  const missing = required.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
  if (missing.length) throw new Error("Preencha os campos obrigatórios: " + missing.join(", "));
  if (!Number.isFinite(input.price) || input.price <= 0) throw new Error("Informe um preço positivo.");
  if (input.category === "aluminum_profile" && (!input.weightKgPerMeter || input.weightKgPerMeter <= 0)) {
    throw new Error("Perfil exige peso técnico válido em kg/m.");
  }
  if (input.category === "glass" && (!input.glassThicknessMm || input.glassThicknessMm <= 0 || !input.glassType?.trim())) {
    throw new Error("Vidro exige tipo e espessura.");
  }
  if (input.category === "aluminum_profile" && !["kg", "m"].includes(input.priceBasis)) {
    throw new Error("Perfil deve ser cotado por kg ou metro.");
  }
  if (input.category === "glass" && input.priceBasis !== "m2") {
    throw new Error("Vidro deve ser cotado por m².");
  }

  const itemId = encodeURIComponent(input.canonicalCode.trim().toUpperCase());
  const itemRef = doc(db, "technical_catalog_items", itemId);
  const reviewRef = doc(db, "technical_catalog_review", input.reviewId);
  const offer: SupplierOffer = {
    id: encodeURIComponent(input.supplierId + "__" + input.supplierSku),
    supplierId: input.supplierId,
    supplierSku: input.supplierSku.trim(),
    price: input.price,
    currency: "BRL",
    basis: input.priceBasis,
    colorOrFinish: input.colorOrFinish || undefined,
    validFrom: input.validFrom,
    sourceUrl: input.sourceUrl || undefined,
    sourceDocument: input.sourceDocument || undefined,
    status: "pending_review",
  };
  const item: TechnicalCatalogItem = {
    id: itemId,
    canonicalCode: input.canonicalCode.trim().toUpperCase(),
    description: input.description.trim(),
    category: input.category,
    systemLineIds: input.systemLineIds,
    compatibleTipologiaIds: input.compatibleTipologiaIds,
    compatibleItemIds: [],
    weightKgPerMeter: input.weightKgPerMeter,
    commercialLengthMm: input.commercialLengthMm,
    glassThicknessMm: input.glassThicknessMm,
    glassType: input.glassType,
    colorOrFinish: input.colorOrFinish,
    unit: input.unit,
    offers: [offer],
    active: true,
    schemaVersion: 1,
  };
  const validation = validateCatalogItem(item);
  if (validation.length) throw new Error(validation.join(" "));
  await runTransaction(db, async (transaction) => {
    const [reviewSnap, itemSnap] = await Promise.all([
      transaction.get(reviewRef),
      transaction.get(itemRef),
    ]);
    if (!reviewSnap.exists()) throw new Error("Registro de revisão não encontrado.");
    if (reviewSnap.data().status !== "pending_review") throw new Error("Este registro já foi processado.");
    const supplierRef = doc(db, "technical_suppliers", encodeURIComponent(input.supplierId.trim().toLowerCase()));
    const supplierSnap = await transaction.get(supplierRef);
    if (!supplierSnap.exists()) {
      transaction.set(supplierRef, {
        id: encodeURIComponent(input.supplierId.trim().toLowerCase()),
        name: input.supplierName.trim() || input.supplierId.trim(),
        active: true,
        createdAt: serverTimestamp(),
      });
    }
    if (itemSnap.exists()) {
      const existing = itemSnap.data() as TechnicalCatalogItem;
      if (existing.category !== item.category) throw new Error("O código canônico já existe em outra categoria.");
      const offers = Array.isArray(existing.offers) ? existing.offers : [];
      if (offers.some((current) => current.supplierId === offer.supplierId && current.supplierSku === offer.supplierSku)) {
        throw new Error("Esta oferta do fornecedor já está cadastrada.");
      }
      transaction.update(itemRef, {
        offers: [...offers, offer],
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(itemRef, { ...item, createdAt: serverTimestamp() });
    }
    transaction.update(reviewRef, {
      status: "approved_to_pending_offer",
      canonicalItemId: itemId,
      reviewedAt: serverTimestamp(),
      reviewIssues: ["Oferta criada como pendente; exigir conferência documental e aprovação comercial antes de usar no orçamento."],
    });
  });
  return { itemId, offerStatus: "pending_review" as const };
}
