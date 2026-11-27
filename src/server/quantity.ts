export function normalizeNonNegativeQuantity(value: unknown): { quantity: number; pending: boolean } {
  if (value === undefined || value === null || value === "") return { quantity: 0, pending: true };
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Quantidade inválida: informe um número não negativo.");
  return { quantity, pending: quantity === 0 };
}
