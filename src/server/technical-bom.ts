export type BomCategory =
  | "aluminum_profile"
  | "hardware"
  | "glass"
  | "seal"
  | "fastener"
  | "consumable"
  | "service";

export type PurchaseUnit = "bar" | "meter" | "piece" | "m2" | "kg";

export interface TechnicalBomItem {
  id: string;
  category: BomCategory;
  code: string;
  description: string;
  quantity: number;
  unit: PurchaseUnit;
  cutLengthsMm?: number[];
  commercialBarLengthMm?: number;
  kerfMm?: number;
  manufacturer: string;
  system: string;
  finish?: string;
  compatibilityKey: string;
  required: boolean;
  sourceDocumentId?: string;
  sourcePage?: number;
  ruleId?: string;
  technicalStatus: "verified" | "pending_review";
}

export interface MarketOffer {
  id: string;
  itemCompatibilityKey: string;
  supplier: string;
  supplierUrl: string;
  productUrl: string;
  unit: PurchaseUnit;
  unitPrice: number;
  currency: "BRL";
  observedAt: string;
  validUntil?: string;
  availability: "in_stock" | "quote_required" | "unknown";
  evidence: "supplier_page" | "marketplace" | "manual_quote";
  verification: "verified" | "unverified";
  minimumQuantity?: number;
  shippingCost?: number;
  notes?: string;
}

export interface SupplierComparisonLine {
  itemId: string;
  description: string;
  quantityToBuy: number;
  unit: PurchaseUnit;
  unitPrice: number | null;
  subtotal: number | null;
  offerId?: string;
  productUrl?: string;
  status: "priced" | "missing_price" | "incompatible" | "stale";
}

export interface SupplierComparison {
  supplier: string;
  supplierUrl: string;
  lines: SupplierComparisonLine[];
  materialSubtotal: number;
  shippingCost: number;
  total: number;
  complete: boolean;
  verified: boolean;
  missingItems: string[];
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const validDate = (value?: string) => {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
};

export function validateBom(items: TechnicalBomItem[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) errors.push("ID de material ausente ou duplicado.");
    ids.add(item.id);
    if (!item.description.trim() || !item.code.trim()) errors.push(`Material sem código ou descrição: ${item.id || "sem ID"}.`);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) errors.push(`Quantidade inválida: ${item.description}.`);
    if (!item.compatibilityKey.trim()) errors.push(`Compatibilidade não definida: ${item.description}.`);
    if (item.technicalStatus !== "verified") errors.push(`Regra técnica pendente: ${item.description}.`);
    if (item.unit === "bar" && (!item.commercialBarLengthMm || item.commercialBarLengthMm <= 0)) {
      errors.push(`Comprimento comercial da barra não confirmado: ${item.description}.`);
    }
    if (item.cutLengthsMm?.some(length => !Number.isFinite(length) || length <= 0)) {
      errors.push(`Medida de corte inválida: ${item.description}.`);
    }
  }
  return errors;
}

/** First-fit-decreasing cutting plan. It never changes the requested cut lengths. */
export function optimizeProfileBars(
  cutLengthsMm: number[],
  barLengthMm: number,
  kerfMm = 3
): { bars: Array<{ cutsMm: number[]; usedMm: number; wasteMm: number }>; totalWasteMm: number } {
  if (!Number.isFinite(barLengthMm) || barLengthMm <= 0) throw new Error("Comprimento comercial inválido.");
  if (!Number.isFinite(kerfMm) || kerfMm < 0) throw new Error("Espessura de corte inválida.");
  const cuts = [...cutLengthsMm].sort((a, b) => b - a);
  if (cuts.some(cut => !Number.isFinite(cut) || cut <= 0 || cut > barLengthMm)) {
    throw new Error("Existe corte inválido ou maior que a barra comercial.");
  }
  const bars: Array<{ cutsMm: number[]; usedMm: number; wasteMm: number }> = [];
  for (const cut of cuts) {
    let target = bars.find(bar => bar.usedMm + kerfMm + cut <= barLengthMm);
    if (!target) {
      target = { cutsMm: [], usedMm: 0, wasteMm: 0 };
      bars.push(target);
    }
    target.usedMm += (target.cutsMm.length ? kerfMm : 0) + cut;
    target.cutsMm.push(cut);
  }
  for (const bar of bars) bar.wasteMm = barLengthMm - bar.usedMm;
  return { bars, totalWasteMm: bars.reduce((sum, bar) => sum + bar.wasteMm, 0) };
}

function offerIsCurrent(offer: MarketOffer, now: number, maxAgeDays: number): boolean {
  if (!validDate(offer.observedAt)) return false;
  const observed = Date.parse(offer.observedAt);
  if (observed > now + 5 * 60_000 || now - observed > maxAgeDays * 86_400_000) return false;
  if (offer.validUntil && (!validDate(offer.validUntil) || Date.parse(offer.validUntil) < now)) return false;
  return true;
}

function requiredPurchaseQuantity(item: TechnicalBomItem): number {
  if (item.unit === "bar" && item.cutLengthsMm?.length && item.commercialBarLengthMm) {
    return optimizeProfileBars(item.cutLengthsMm, item.commercialBarLengthMm, item.kerfMm ?? 3).bars.length;
  }
  return item.quantity;
}

/**
 * Compares supplier baskets without mixing incompatible systems, finishes or profile codes.
 * Offers with stale dates, unverified evidence or quote-only prices are not treated as confirmed prices.
 */
export function compareSupplierOffers(
  items: TechnicalBomItem[],
  offers: MarketOffer[],
  options: { now?: number; maxAgeDays?: number } = {}
): SupplierComparison[] {
  const now = options.now ?? Date.now();
  const maxAgeDays = options.maxAgeDays ?? 30;
  const suppliers = new Map<string, SupplierComparison>();
  for (const offer of offers) {
    if (!offer.supplier.trim()) continue;
    if (!suppliers.has(offer.supplier)) suppliers.set(offer.supplier, {
      supplier: offer.supplier,
      supplierUrl: offer.supplierUrl,
      lines: [],
      materialSubtotal: 0,
      shippingCost: 0,
      total: 0,
      complete: true,
      verified: true,
      missingItems: []
    });
  }
  for (const basket of suppliers.values()) {
    for (const item of items) {
      const quantity = requiredPurchaseQuantity(item);
      const candidates = offers.filter(offer =>
        offer.supplier === basket.supplier &&
        offer.itemCompatibilityKey === item.compatibilityKey &&
        offer.unit === item.unit &&
        offer.availability === "in_stock" &&
        offer.verification === "verified" &&
        offer.evidence !== "marketplace" &&
        offer.unitPrice > 0 &&
        Number.isFinite(offer.unitPrice) &&
        offer.minimumQuantity !== undefined ? quantity >= offer.minimumQuantity : true
      );
      const current = candidates.filter(offer => offerIsCurrent(offer, now, maxAgeDays));
      const selected = current.sort((a, b) => a.unitPrice - b.unitPrice)[0];
      if (!selected) {
        const stale = candidates.length > 0;
        basket.lines.push({
          itemId: item.id,
          description: item.description,
          quantityToBuy: quantity,
          unit: item.unit,
          unitPrice: null,
          subtotal: null,
          status: stale ? "stale" : "missing_price"
        });
        basket.complete = false;
        basket.verified = false;
        basket.missingItems.push(item.description);
        continue;
      }
      const subtotal = roundMoney(quantity * selected.unitPrice);
      basket.lines.push({
        itemId: item.id,
        description: item.description,
        quantityToBuy: quantity,
        unit: item.unit,
        unitPrice: selected.unitPrice,
        subtotal,
        offerId: selected.id,
        productUrl: selected.productUrl,
        status: "priced"
      });
      basket.materialSubtotal += subtotal;
      basket.shippingCost = Math.max(basket.shippingCost, Number(selected.shippingCost || 0));
    }
    basket.materialSubtotal = roundMoney(basket.materialSubtotal);
    basket.shippingCost = roundMoney(basket.shippingCost);
    basket.total = roundMoney(basket.materialSubtotal + basket.shippingCost);
    if (basket.missingItems.length) basket.complete = false;
  }
  return [...suppliers.values()].sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return a.total - b.total;
  });
}
