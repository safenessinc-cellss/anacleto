const UNCONFIRMED_PRICE_SOURCES = new Set(["pending", "pendente", "estimated", "estimado", "estimate"]);

export function isUnconfirmedPriceSource(value: unknown): boolean {
  return UNCONFIRMED_PRICE_SOURCES.has(String(value ?? "").trim().toLowerCase());
}
