import type { TechnicalCategory, PriceBasis } from "./technicalCatalog";

export interface LegacySupplierCatalogRow {
  id: string;
  supplier?: unknown;
  code?: unknown;
  sku?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  unit?: unknown;
  price?: unknown;
  lengthMm?: unknown;
  color?: unknown;
  material?: unknown;
  sourceUrl?: unknown;
  sourceDocument?: unknown;
  createdAt?: unknown;
}

export interface LegacyCatalogCandidate {
  legacyCollection: "supplier_catalog" | "catalog" | "registry_items" | "price_table";
  legacyId: string;
  suggestedSupplierName: string;
  supplierSku: string;
  suggestedDescription: string;
  suggestedCategory?: TechnicalCategory;
  suggestedPrice?: number;
  suggestedPriceBasis?: PriceBasis;
  suggestedLengthMm?: number;
  suggestedFinish?: string;
  sourceUrl?: string;
  sourceDocument?: string;
  reviewStatus: "pending_review";
  reviewIssues: string[];
}

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const numeric = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function categoryFromLegacy(value: string, description: string): TechnicalCategory | undefined {
  const normalized = `${value} ${description}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/perfil|alumin/.test(normalized)) return "aluminum_profile";
  if (/vidro|glass/.test(normalized)) return "glass";
  if (/fechadura|roldana|dobradica|puxador|ferragem/.test(normalized)) return "hardware";
  if (/parafuso|rebite|fixador/.test(normalized)) return "fastener";
  if (/felpa|borracha|vedacao|guarnicao/.test(normalized)) return "seal";
  if (/silicone|cola|consumivel/.test(normalized)) return "consumable";
  if (/acessorio|acessorios/.test(normalized)) return "accessory";
  return undefined;
}

function priceBasisFromLegacy(unit: string): PriceBasis | undefined {
  const value = unit.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (["kg", "quilo", "quilograma"].includes(value)) return "kg";
  if (["m", "metro", "metros"].includes(value)) return "m";
  if (["m2", "m²", "metro quadrado"].includes(value)) return "m2";
  if (["un", "un.", "unidade", "peca", "pecas"].includes(value)) return "unit";
  if (["barra", "barras"].includes(value)) return "bar";
  if (["conjunto", "cj", "kit"].includes(value)) return "set";
  return undefined;
}

/**
 * Converts a legacy row into a review candidate only. It deliberately does not
 * merge products, approve compatibility, or mark prices as verified.
 */
export function mapLegacySupplierCatalogRow(
  row: LegacySupplierCatalogRow,
  legacyCollection: LegacyCatalogCandidate["legacyCollection"] = "supplier_catalog",
): LegacyCatalogCandidate {
  const description = text(row.name) || text(row.description);
  const supplierName = text(row.supplier);
  const sku = text(row.code) || text(row.sku);
  const unit = text(row.unit);
  const category = categoryFromLegacy(text(row.category), description);
  const price = numeric(row.price);
  const basis = priceBasisFromLegacy(unit);
  const length = numeric(row.lengthMm);
  const issues: string[] = [];

  if (!supplierName) issues.push("Fornecedor não identificado; revisar cadastro antes de criar oferta.");
  if (!sku) issues.push("SKU/código original ausente; não mesclar automaticamente com outro produto.");
  if (!description) issues.push("Descrição ausente.");
  if (!category) issues.push("Categoria técnica não identificada com segurança.");
  if (price === undefined) issues.push("Preço ausente ou inválido.");
  if (price !== undefined && !basis) issues.push("Unidade do preço não reconhecida; não converter nem usar no orçamento.");
  if (category === "aluminum_profile" && !length) issues.push("Comprimento comercial ausente; peso kg/m precisa vir de fonte técnica.");
  if (category === "glass") issues.push("Tipo, espessura e especificação do vidro precisam ser confirmados.");
  if (category === "aluminum_profile") issues.push("Peso em kg/m precisa ser preenchido a partir de catálogo técnico oficial.");
  if (!text(row.sourceUrl) && !text(row.sourceDocument)) issues.push("Origem documental do dado não registrada.");
  if (row.color && !text(row.color)) issues.push("Acabamento não normalizado.");

  return {
    legacyCollection,
    legacyId: row.id,
    suggestedSupplierName: supplierName,
    supplierSku: sku,
    suggestedDescription: description,
    suggestedCategory: category,
    suggestedPrice: price,
    suggestedPriceBasis: basis,
    suggestedLengthMm: length,
    suggestedFinish: text(row.color) || undefined,
    sourceUrl: text(row.sourceUrl) || undefined,
    sourceDocument: text(row.sourceDocument) || undefined,
    reviewStatus: "pending_review",
    reviewIssues: issues,
  };
}
