/**
 * Canonical technical catalogue contracts.
 *
 * A technical product is independent from any supplier listing or price.
 * Firestore persistence is intentionally additive: legacy collections remain
 * readable until a separately reviewed migration maps their existing records.
 */
export type ReviewStatus = "pending_review" | "verified" | "rejected";
export type TechnicalProductKind = "aluminum_profile" | "hardware" | "glass" | "seal" | "fastener" | "consumable" | "service";
export type PriceUnit = "bar" | "meter" | "piece" | "m2" | "kg";

export interface SourceReference {
  sourceDocumentId: string;
  sourcePage: number;
  sourceUrl?: string;
  sourceRevision?: string;
  excerpt?: string;
}

export interface TechnicalProduct {
  id: string;
  identityKey: string;
  kind: TechnicalProductKind;
  manufacturer: string;
  line: string;
  manufacturerCode: string;
  description: string;
  variantKey: string;
  finish?: string;
  technicalProperties: Record<string, string | number | boolean>;
  compatibilityKeys: string[];
  source: SourceReference;
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalProductAsset {
  id: string;
  technicalProductId: string;
  assetType: "photo" | "drawing" | "section" | "document_page";
  storagePath: string;
  contentType: string;
  checksumSha256: string;
  source: SourceReference;
  status: ReviewStatus;
  createdAt: string;
}

export interface SupplierOffer {
  id: string;
  technicalProductId: string;
  supplierId: string;
  supplierName: string;
  supplierProductCode?: string;
  unit: PriceUnit;
  unitPrice: number;
  currency: string;
  priceDate: string;
  validUntil?: string;
  availability: "in_stock" | "quote_required" | "unknown";
  shippingCost?: number;
  shippingConfirmed: boolean;
  source: SourceReference;
  status: ReviewStatus;
  priceStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOfferPriceHistory {
  id: string;
  supplierOfferId: string;
  technicalProductId: string;
  supplierId: string;
  unitPrice: number;
  currency: string;
  unit: PriceUnit;
  priceDate: string;
  validUntil?: string;
  source: SourceReference;
  status: ReviewStatus;
  recordedAt: string;
}

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("pt-BR")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

/**
 * Stable deduplication key for the engineering identity, never based on a
 * reseller's SKU. Variant/finish are included because they can affect fit.
 * The caller must enforce uniqueness transactionally in Firestore.
 */
export function buildTechnicalIdentityKey(input: Pick<TechnicalProduct,
  "kind" | "manufacturer" | "line" | "manufacturerCode" | "variantKey" | "finish"
>): string {
  const parts = [
    input.kind, input.manufacturer, input.line, input.manufacturerCode,
    input.variantKey, input.finish || "standard"
  ].map(normalize);
  if (parts.some(part => !part)) throw new Error("Identidade técnica incompleta: tipo, fabricante, linha, código e variante são obrigatórios.");
  return parts.join("__");
}

export function validateTechnicalProduct(product: TechnicalProduct): string[] {
  const errors: string[] = [];
  if (!product.id.trim()) errors.push("ID técnico ausente.");
  if (!product.identityKey.trim()) errors.push("Chave de identidade técnica ausente.");
  if (!product.manufacturer.trim() || !product.line.trim() || !product.manufacturerCode.trim()) errors.push("Fabricante, linha e código do fabricante são obrigatórios.");
  if (!product.description.trim()) errors.push("Descrição técnica ausente.");
  if (!product.source?.sourceDocumentId?.trim()) errors.push("Documento de origem não vinculado.");
  if (!Number.isInteger(product.source?.sourcePage) || product.source.sourcePage < 1) errors.push("Página de origem inválida ou ausente.");
  if (product.status === "verified" && (!product.reviewedBy || !product.reviewedAt)) errors.push("Produto verificado sem responsável e data de validação.");
  return errors;
}

export function validateSupplierOffer(offer: SupplierOffer): string[] {
  const errors: string[] = [];
  if (!offer.id.trim() || !offer.technicalProductId.trim()) errors.push("Oferta sem ID ou vínculo com produto técnico.");
  if (!offer.supplierId.trim() || !offer.supplierName.trim()) errors.push("Fornecedor não identificado.");
  if (!Number.isFinite(offer.unitPrice) || offer.unitPrice <= 0) errors.push("Preço unitário inválido.");
  if (!offer.currency.trim()) errors.push("Moeda ausente.");
  if (!offer.unit.trim()) errors.push("Unidade comercial ausente.");
  if (!Number.isFinite(Date.parse(offer.priceDate))) errors.push("Data do preço inválida.");
  if (offer.validUntil && !Number.isFinite(Date.parse(offer.validUntil))) errors.push("Validade da oferta inválida.");
  if (!offer.source?.sourceDocumentId?.trim()) errors.push("Documento/evidência original da oferta não vinculado.");
  if (!Number.isInteger(offer.source?.sourcePage) || offer.source.sourcePage < 1) errors.push("Página de origem da oferta inválida ou ausente.");
  if (offer.shippingConfirmed && (!Number.isFinite(offer.shippingCost) || Number(offer.shippingCost) < 0)) errors.push("Frete marcado como confirmado sem valor válido.");
  if (offer.status === "verified" || offer.priceStatus === "verified") {
    if (offer.status !== "verified" || offer.priceStatus !== "verified") errors.push("A oferta e o preço devem ser validados separadamente antes da aprovação final.");
    if (!offer.reviewedBy || !offer.reviewedAt) errors.push("Oferta verificada sem responsável e data de validação.");
  }
  return errors;
}

export function isTechnicalProductUsable(product: TechnicalProduct): boolean {
  return product.status === "verified" && validateTechnicalProduct(product).length === 0;
}

export function isSupplierOfferUsable(offer: SupplierOffer, now = Date.now()): boolean {
  if (offer.status !== "verified" || offer.priceStatus !== "verified") return false;
  if (validateSupplierOffer(offer).length) return false;
  const observed = Date.parse(offer.priceDate);
  if (observed > now + 5 * 60_000 || now - observed > 30 * 86_400_000) return false;
  if (offer.validUntil && Date.parse(offer.validUntil) < now) return false;
  return offer.availability === "in_stock" && offer.shippingConfirmed;
}
