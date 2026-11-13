const ALUMINUM_PRICE_STORAGE_KEY = "anacleto.aluminum-price-per-kg";

export function readAluminumPricePerKg(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(ALUMINUM_PRICE_STORAGE_KEY);
  if (!raw) return undefined;
  const saved = Number(raw);
  return Number.isFinite(saved) && saved > 0 ? saved : undefined;
}

export function writeAluminumPricePerKg(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    if (typeof window !== "undefined") window.localStorage.removeItem(ALUMINUM_PRICE_STORAGE_KEY);
    return undefined;
  }
  if (typeof window !== "undefined") window.localStorage.setItem(ALUMINUM_PRICE_STORAGE_KEY, String(value));
  return value;
}

export function aluminumWeightPerMeter(description: unknown): number | undefined {
  const match = String(description || "").match(/(?:\(|\b)(\d+(?:[.,]\d+)?)\s*kg\s*\/\s*m\b/i);
  if (!match) return undefined;
  const weight = Number(match[1].replace(",", "."));
  return Number.isFinite(weight) && weight > 0 ? weight : undefined;
}

export function estimatedCatalogPrice(
  item: { name?: unknown; description?: unknown; price?: unknown },
  aluminumPricePerKg?: number,
  lengthMm?: number,
): number | undefined {
  const price = Number(item.price);
  if (Number.isFinite(price) && price > 0) return price;
  if (!Number.isFinite(aluminumPricePerKg) || Number(aluminumPricePerKg) <= 0) return undefined;
  const weightPerMeter = aluminumWeightPerMeter(`${String(item.name || "")} ${String(item.description || "")}`);
  if (!weightPerMeter) return undefined;
  const lengthInMeters = Number.isFinite(lengthMm) && Number(lengthMm) > 0 ? Number(lengthMm) / 1000 : 1;
  return Number((weightPerMeter * Number(aluminumPricePerKg) * lengthInMeters).toFixed(2));
}
