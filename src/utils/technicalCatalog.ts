/**
 * ANACLETO — catálogo técnico integrado (schema v1).
 *
 * Este módulo define a linguagem comum entre fornecedores, linhas, tipologias,
 * listas técnicas de fabricação e orçamento. Não presume compatibilidade nem
 * inventa preços: componentes sem dados validados geram pendências.
 */

export type TechnicalCategory =
  | "aluminum_profile"
  | "glass"
  | "hardware"
  | "accessory"
  | "fastener"
  | "seal"
  | "consumable";

export type PriceBasis = "kg" | "m" | "m2" | "unit" | "bar" | "set";
export type CommercialPriceMode = "markup" | "gross_margin";

export interface SupplierRecord {
  id: string;
  name: string;
  cnpj?: string;
  website?: string;
  active: boolean;
}

export interface SupplierOffer {
  id: string;
  supplierId: string;
  supplierSku: string;
  price: number;
  currency: "BRL";
  basis: PriceBasis;
  colorOrFinish?: string;
  validFrom: string;
  validUntil?: string;
  sourceUrl?: string;
  sourceDocument?: string;
  verifiedAt?: string;
  status: "verified" | "pending_review" | "expired";
}

export interface TechnicalCatalogItem {
  id: string;
  canonicalCode: string;
  description: string;
  category: TechnicalCategory;
  brand?: string;
  systemLineIds: string[];
  compatibleTipologiaIds: string[];
  compatibleItemIds: string[];
  weightKgPerMeter?: number;
  commercialLengthMm?: number;
  glassThicknessMm?: number;
  glassType?: string;
  colorOrFinish?: string;
  unit: "kg" | "m" | "m2" | "un" | "barra" | "conjunto";
  offers: SupplierOffer[];
  active: boolean;
  technicalSourceUrl?: string;
  technicalDocument?: string;
  verifiedAt?: string;
  schemaVersion: 1;
}

export interface SystemLine {
  id: string;
  name: string;
  manufacturer?: string;
  compatibleLineIds: string[];
  active: boolean;
}

export interface ResolvedBomLine {
  catalogItemId: string;
  description: string;
  category: TechnicalCategory;
  quantity: number;
  unit: string;
  /** Required only for profile pricing by kg or meter. */
  cutLengthMm?: number;
  /** Required for glass pricing by m². */
  widthMm?: number;
  heightMm?: number;
  /** Optional waste factor, e.g. 0.08 for 8%. */
  wasteRate?: number;
  requiredSystemLineId?: string;
  requiredTipologiaId?: string;
  requiredCategory?: TechnicalCategory;
  requiredGlassThicknessMm?: number;
  requiredFinish?: string;
}

export interface PricedBomLine extends ResolvedBomLine {
  supplierId?: string;
  supplierSku?: string;
  priceBasis?: PriceBasis;
  unitPrice?: number;
  subtotal: number;
  status: "priced" | "missing_item" | "missing_offer" | "incompatible" | "invalid_quantity";
  warnings: string[];
}

export interface ManufacturingCostResult {
  lines: PricedBomLine[];
  materialSubtotal: number;
  missingCount: number;
  warnings: string[];
}

const finitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function validateCatalogItem(item: TechnicalCatalogItem): string[] {
  const errors: string[] = [];
  if (!item.id.trim()) errors.push("Produto sem identificador.");
  if (!item.canonicalCode.trim()) errors.push("Produto sem código canônico.");
  if (!item.description.trim()) errors.push("Produto sem descrição.");
  if (item.category === "aluminum_profile" && !finitePositive(item.weightKgPerMeter)) {
    errors.push("Perfil de alumínio sem peso técnico válido em kg/m.");
  }
  if (item.category === "glass" && !finitePositive(item.glassThicknessMm)) {
    errors.push("Vidro sem espessura técnica.");
  }
  for (const offer of item.offers) {
    if (!finitePositive(offer.price)) errors.push(`Oferta ${offer.id}: preço inválido.`);
    if (!offer.supplierId) errors.push(`Oferta ${offer.id}: fornecedor não informado.`);
    if (!offer.validFrom) errors.push(`Oferta ${offer.id}: data inicial não informada.`);
  }
  return errors;
}

function offerIsUsable(offer: SupplierOffer, date: string): boolean {
  return offer.status === "verified"
    && finitePositive(offer.price)
    && !!offer.verifiedAt
    && !!(offer.sourceUrl || offer.sourceDocument)
    && !!date
    && offer.validFrom <= date
    && (!offer.validUntil || offer.validUntil >= date);
}

function offerUnitPrice(
  item: TechnicalCatalogItem,
  offer: SupplierOffer,
  line: ResolvedBomLine,
): number | undefined {
  const quantity = line.quantity * (1 + Math.max(0, line.wasteRate || 0));
  if (item.category === "aluminum_profile" && !["kg", "m"].includes(offer.basis)) return undefined;
  if (item.category === "glass" && offer.basis !== "m2") return undefined;
  if (!["aluminum_profile", "glass"].includes(item.category) && !["unit", "set", "bar"].includes(offer.basis)) return undefined;
  switch (offer.basis) {
    case "kg": {
      if (!finitePositive(item.weightKgPerMeter) || !finitePositive(line.cutLengthMm)) return undefined;
      return offer.price * item.weightKgPerMeter * (line.cutLengthMm / 1000) * quantity;
    }
    case "m": {
      if (!finitePositive(line.cutLengthMm)) return undefined;
      return offer.price * (line.cutLengthMm / 1000) * quantity;
    }
    case "m2": {
      if (!finitePositive(line.widthMm) || !finitePositive(line.heightMm)) return undefined;
      return offer.price * (line.widthMm / 1000) * (line.heightMm / 1000) * quantity;
    }
    case "unit":
    case "set":
    case "bar":
      return offer.price * quantity;
    default:
      return undefined;
  }
}

/**
 * Resolve BOM prices only from verified, date-valid supplier offers.
 * A preferred supplier is a preference, never permission to use an
 * incompatible or unverified alternative.
 */
export function priceResolvedBom(input: {
  bom: ResolvedBomLine[];
  catalog: TechnicalCatalogItem[];
  quoteDate: string;
  preferredSupplierIds?: string[];
}): ManufacturingCostResult {
  const byId = new Map(input.catalog.map((item) => [item.id, item]));
  const lines: PricedBomLine[] = input.bom.map((line) => {
    const warnings: string[] = [];
    if (!finitePositive(line.quantity)) {
      return { ...line, subtotal: 0, status: "invalid_quantity", warnings: ["Quantidade inválida ou igual a zero."] };
    }
    const item = byId.get(line.catalogItemId);
    if (!item || !item.active) {
      return { ...line, subtotal: 0, status: "missing_item", warnings: ["Componente não cadastrado ou inativo no catálogo técnico."] };
    }
    if (line.requiredCategory && item.category !== line.requiredCategory) {
      return { ...line, subtotal: 0, status: "incompatible", warnings: ["A categoria técnica do item não corresponde ao componente exigido pela tipologia."] };
    }
    if (line.requiredCategory && item.category !== line.requiredCategory) {
      return { ...line, subtotal: 0, status: "incompatible", warnings: ["A categoria técnica do item não corresponde ao componente exigido pela tipologia."] };
    }
    if (line.requiredSystemLineId && !item.systemLineIds.includes(line.requiredSystemLineId)) {
      return { ...line, subtotal: 0, status: "incompatible", warnings: ["O componente não está validado para a linha de esquadria selecionada."] };
    }
    if (line.requiredTipologiaId && !item.compatibleTipologiaIds.includes(line.requiredTipologiaId)) {
      return { ...line, subtotal: 0, status: "incompatible", warnings: ["O componente não está validado para esta tipologia."] };
    }
    if (line.requiredGlassThicknessMm && (item.category !== "glass" || item.glassThicknessMm !== line.requiredGlassThicknessMm)) {
      return { ...line, subtotal: 0, status: "incompatible", warnings: ["Espessura do vidro não corresponde à especificação exigida."] };
    }
    if (line.requiredFinish && item.colorOrFinish !== line.requiredFinish) {
      return { ...line, subtotal: 0, status: "incompatible", warnings: ["Acabamento ausente ou diferente do acabamento solicitado; exige validação técnica."] };
    }

    const validOffers = item.offers.filter((offer) => offerIsUsable(offer, input.quoteDate));
    const orderedOffers = [...validOffers].sort((a, b) => {
      const aRank = input.preferredSupplierIds?.indexOf(a.supplierId) ?? -1;
      const bRank = input.preferredSupplierIds?.indexOf(b.supplierId) ?? -1;
      const ar = aRank < 0 ? Number.MAX_SAFE_INTEGER : aRank;
      const br = bRank < 0 ? Number.MAX_SAFE_INTEGER : bRank;
      return ar - br || a.price - b.price;
    });
    for (const offer of orderedOffers) {
      const subtotal = offerUnitPrice(item, offer, line);
      if (subtotal === undefined || !Number.isFinite(subtotal)) continue;
      return {
        ...line,
        supplierId: offer.supplierId,
        supplierSku: offer.supplierSku,
        priceBasis: offer.basis,
        unitPrice: subtotal / line.quantity,
        subtotal: Number(subtotal.toFixed(2)),
        status: "priced",
        warnings,
      };
    }
    return {
      ...line,
      subtotal: 0,
      status: "missing_offer",
      warnings: ["Não existe oferta verificada e vigente com unidade de preço compatível com os dados técnicos desta peça."],
    };
  });

  const materialSubtotal = Number(lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2));
  const missingCount = lines.filter((line) => line.status !== "priced").length;
  const warnings = lines.flatMap((line) => line.warnings.map((warning) => `${line.description}: ${warning}`));
  return { lines, materialSubtotal, missingCount, warnings };
}

export function calculateSellingPrice(
  manufacturingCost: number,
  rate: number,
  mode: CommercialPriceMode,
): { sellingPrice: number; grossProfit: number; effectiveGrossMargin: number } {
  if (!Number.isFinite(manufacturingCost) || manufacturingCost < 0) {
    throw new Error("O custo de fabricação deve ser um valor não negativo.");
  }
  if (!Number.isFinite(rate) || rate < 0 || rate >= 100) {
    throw new Error("A taxa deve estar entre 0 e 99,99%.");
  }
  const sellingPrice = mode === "markup"
    ? manufacturingCost * (1 + rate / 100)
    : manufacturingCost / (1 - rate / 100);
  const roundedPrice = Number(sellingPrice.toFixed(2));
  const grossProfit = Number((roundedPrice - manufacturingCost).toFixed(2));
  const effectiveGrossMargin = roundedPrice > 0
    ? Number((grossProfit / roundedPrice * 100).toFixed(2))
    : 0;
  return { sellingPrice: roundedPrice, grossProfit, effectiveGrossMargin };
}

/** Freeze the exact technical and commercial inputs used by an approved quote. */
export function createManufacturingSnapshot(input: {
  quoteDate: string;
  systemLineId: string;
  tipologiaId: string;
  widthMm: number;
  heightMm: number;
  bom: PricedBomLine[];
  materialSubtotal: number;
  labor: number;
  otherCosts: number;
  sellingPrice: number;
  formulaVersion: string;
}) {
  return {
    schemaVersion: 1 as const,
    quoteDate: input.quoteDate,
    systemLineId: input.systemLineId,
    tipologiaId: input.tipologiaId,
    dimensions: { widthMm: input.widthMm, heightMm: input.heightMm },
    bom: input.bom.map((line) => ({ ...line })),
    materialSubtotal: input.materialSubtotal,
    labor: input.labor,
    otherCosts: input.otherCosts,
    sellingPrice: input.sellingPrice,
    formulaVersion: input.formulaVersion,
    frozenAt: new Date().toISOString(),
  };
}
