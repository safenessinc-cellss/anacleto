const REVIEW_STATES = new Set(["verified", "pending_review", "rejected"]);

/**
 * A catalog price is confirmed only after an explicit review state says verified.
 * Generic lifecycle states such as "Ativo" do not prove that a price was reviewed.
 * Legacy rows without review metadata remain unverified until an authorized review.
 */
export function hasConfirmedCatalogPrice(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const item = row as Record<string, unknown>;
  const price = Number(item.price);
  if (!Number.isFinite(price) || price <= 0 || item.verified === false) return false;

  const states = [item.reviewStatus, item.priceStatus, item.status]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter((value) => REVIEW_STATES.has(value));

  return states.length > 0 && states.every((state) => state === "verified");
}
