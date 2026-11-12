export const DEFAULT_ALUMINUM_PRICE_PER_KG = 38;
const ALUMINUM_PRICE_STORAGE_KEY = "anacleto.aluminum-price-per-kg";

export function readAluminumPricePerKg(): number {
  if (typeof window === "undefined") return DEFAULT_ALUMINUM_PRICE_PER_KG;
  const saved = Number(window.localStorage.getItem(ALUMINUM_PRICE_STORAGE_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_ALUMINUM_PRICE_PER_KG;
}

export function writeAluminumPricePerKg(value: number): number {
  const price = Number.isFinite(value) && value > 0 ? value : DEFAULT_ALUMINUM_PRICE_PER_KG;
  if (typeof window !== "undefined") window.localStorage.setItem(ALUMINUM_PRICE_STORAGE_KEY, String(price));
  return price;
}

export function aluminumWeightPerMeter(description: unknown): number | undefined {
  const match = String(description || "").match(/(?:\(|\b)(\d+(?:[.,]\d+)?)\s*kg\s*\/\s*m\b/i);
  if (!match) return undefined;
  const weight = Number(match[1].replace(",", "."));
  return Number.isFinite(weight) && weight > 0 ? weight : undefined;
}

export function estimatedCatalogPrice(
  item: { name?: unknown; description?: unknown; price?: unknown },
  aluminumPricePerKg = DEFAULT_ALUMINUM_PRICE_PER_KG,
  lengthMm?: number,
): number | undefined {
  const price = Number(item.price);
  if (Number.isFinite(price) && price > 0) return price;
  const weightPerMeter = aluminumWeightPerMeter(`${String(item.name || "")} ${String(item.description || "")}`);
  if (!weightPerMeter) return undefined;
  const lengthInMeters = Number.isFinite(lengthMm) && Number(lengthMm) > 0 ? Number(lengthMm) / 1000 : 1;
  return Number((weightPerMeter * aluminumPricePerKg * lengthInMeters).toFixed(2));
}
