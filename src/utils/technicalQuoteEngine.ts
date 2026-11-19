import {
  buildBomFromTipologia,
  type FormulaDimensions,
  type TipologiaDefinition,
} from "./manufacturingFormulas";
import {
  calculateSellingPrice,
  priceResolvedBom,
  type CommercialPriceMode,
  type ManufacturingCostResult,
  type TechnicalCatalogItem,
} from "./technicalCatalog";

export interface TechnicalQuoteCalculation {
  bom: ReturnType<typeof buildBomFromTipologia>;
  materials: ManufacturingCostResult;
  manufacturingCost: number;
  selling: ReturnType<typeof calculateSellingPrice>;
  readyToQuote: boolean;
  blockers: string[];
}

/**
 * Single calculation path for quote/production: approved tipologia -> BOM ->
 * compatible, verified supplier offers -> manufacturing cost -> sale price.
 * No fallback to legacy catalogue prices or browser-local aluminum price.
 */
export function calculateTechnicalQuote(input: {
  definition: TipologiaDefinition;
  dimensions: FormulaDimensions;
  catalog: TechnicalCatalogItem[];
  quoteDate: string;
  finish?: string;
  glassThicknessMm?: number;
  preferredSupplierIds?: string[];
  laborCost: number;
  otherCosts: number;
  commercialRate: number;
  commercialMode: CommercialPriceMode;
}): TechnicalQuoteCalculation {
  const bom = buildBomFromTipologia({
    definition: input.definition,
    dimensions: input.dimensions,
    finish: input.finish,
    glassThicknessMm: input.glassThicknessMm,
  });
  const materials = priceResolvedBom({
    bom,
    catalog: input.catalog,
    quoteDate: input.quoteDate,
    preferredSupplierIds: input.preferredSupplierIds,
  });
  const blockers = [...materials.warnings];
  if (materials.missingCount > 0) blockers.push("Existem componentes sem preço verificado ou incompatíveis.");
  if (!Number.isFinite(input.laborCost) || input.laborCost < 0) blockers.push("Custo de mão de obra inválido.");
  if (!Number.isFinite(input.otherCosts) || input.otherCosts < 0) blockers.push("Outros custos inválidos.");
  const manufacturingCost = Number((materials.materialSubtotal + Math.max(0, input.laborCost) + Math.max(0, input.otherCosts)).toFixed(2));
  const selling = calculateSellingPrice(manufacturingCost, input.commercialRate, input.commercialMode);
  return {
    bom,
    materials,
    manufacturingCost,
    selling,
    readyToQuote: blockers.length === 0,
    blockers,
  };
}
