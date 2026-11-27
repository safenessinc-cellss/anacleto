export interface ApprovedQuoteTotals {
  subtotal: number;
  labor: number;
  laborRate: number;
  margin: number;
  marginRate: number;
  freight: number;
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

const roundMoney = (value: unknown) => Number((Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0).toFixed(2));

export function calculateApprovedQuoteTotals(
  source: Record<string, any>,
  items: Array<{ quantity: number; unitPrice: number }>
): ApprovedQuoteTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0));
  const laborRate = Number(source.laborRate ?? source.labor?.percentage ?? 0);
  const marginRate = Number(source.marginRate || 0);
  const discountRate = Number(source.discountRate || 0);
  const taxRate = Number(source.taxRate || 0);
  if (![laborRate, marginRate, discountRate, taxRate].every(value => Number.isFinite(value) && value >= 0) ||
      laborRate > 300 || marginRate > 300 || discountRate > 100 || taxRate > 100) {
    throw new Error("Mão de obra, margem, impostos ou descontos inválidos.");
  }

  const explicitLabor = typeof source.labor === "object" ? source.labor?.amount : source.labor;
  const labor = roundMoney(laborRate > 0 ? subtotal * laborRate / 100 : (source.laborAmount ?? explicitLabor ?? 0));
  const explicitMargin = Number(source.margin || 0);
  const margin = roundMoney(marginRate > 0 ? (subtotal + labor) * marginRate / 100 : explicitMargin);
  const freight = roundMoney(source.freight || 0);
  const grossBase = roundMoney(subtotal + labor + margin + freight);
  const discountAmount = discountRate > 0 ? roundMoney(grossBase * discountRate / 100) : roundMoney(source.discountAmount || 0);
  const taxableBase = roundMoney(Math.max(0, grossBase - discountAmount));
  const taxAmount = taxRate > 0 ? roundMoney(taxableBase * taxRate / 100) : roundMoney(source.taxAmount || 0);
  const total = roundMoney(taxableBase + taxAmount);

  return { subtotal, labor, laborRate, margin, marginRate, freight, discountRate, discountAmount, taxRate, taxAmount, total };
}
