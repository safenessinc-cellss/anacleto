const UNCONFIRMED_PRICE_SOURCES = new Set(["pending", "pendente", "estimated", "estimado", "estimate"]);

export function isUnconfirmedPriceSource(value: unknown): boolean {
  return UNCONFIRMED_PRICE_SOURCES.has(String(value ?? "").trim().toLowerCase());
}

export function requiresCatalogPriceVerification(item: Record<string, unknown>): boolean {
  return Boolean(item.catalogItemId || item.itemId || (item.sku && item.priceSource !== "manual"));
}
