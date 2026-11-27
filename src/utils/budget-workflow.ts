export type ConvertibleBudgetWorkflow = "smart" | "technical";

const money = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
};

export function buildCommercialQuoteDraft(
  source: Record<string, any>,
  workflow: ConvertibleBudgetWorkflow,
  sourceId: string,
  now = new Date()
) {
  const date = now.toISOString().slice(0, 10);
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let items: Array<Record<string, any>> = [];
  let freight = money(source.freight);
  const pendingQuestions = Array.isArray(source.pendingQuestions) ? source.pendingQuestions.map((question: unknown) => String(question || "").trim()).filter(Boolean).slice(0, 30) : [];
  const requiresTechnicalVisit = source.visitRequired === true || source.requiresTechnicalVisit === true || (workflow === "technical" && source.measurementsConfirmed !== true);
  const requiresClientConfirmation = pendingQuestions.length > 0 || source.requiresClientConfirmation === true;

  if (workflow === "smart") {
    items = (Array.isArray(source.items) ? source.items : []).map((item: any, index: number) => {
      const requestedSource = String(item.priceSource || "pending").toLowerCase();
      const priceSource = ["catalog", "manual", "existing", "estimated", "pending"].includes(requestedSource) ? requestedSource : "pending";
      const catalogPrice = Boolean(priceSource === "catalog" && money(item.unitPrice) > 0 && String(item.catalogItemId || "").trim());
      return {
        id: String(item.id || ("smart-" + (index + 1))),
        description: String(item.description || "").trim(),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 0,
        quantityPending: item.quantityPending === true || !(Number(item.quantity) > 0),
        unitPrice: money(item.unitPrice),
        sku: String(item.sku || ""),
        catalogItemId: catalogPrice ? String(item.catalogItemId) : "",
        catalogSource: catalogPrice ? String(item.catalogSource || "") : "",
        priceSource: catalogPrice ? "catalog" : priceSource === "catalog" ? "pending" : priceSource,
        notes: String(item.notes || ""),
      };
    });
  } else {
    const bom = Array.isArray(source.bomData?.bom) ? source.bomData.bom : [];
    const comparisons = Array.isArray(source.comparisons) ? source.comparisons : [];
    const selected = comparisons.find((entry: any) => entry.supplier === source.bestSupplier) ||
      comparisons.find((entry: any) => entry.complete === true && entry.verified === true);
    const lines = Array.isArray(selected?.lines) ? selected.lines : [];
    freight = money(selected?.shippingCost);
    items = bom.map((part: any, index: number) => {
      const line = lines.find((entry: any) => entry.itemId === part.id);
      const hasOfferPrice = line?.status === "priced" && money(line.unitPrice) > 0;
      const unitPrice = hasOfferPrice ? money(line.unitPrice) : 0;
      return {
        id: String(part.id || ("technical-" + (index + 1))),
        description: String(part.description || "").trim(),
        quantity: Number(line?.quantityToBuy || part.quantity) > 0 ? Number(line?.quantityToBuy || part.quantity) : 0,
        quantityPending: !(Number(line?.quantityToBuy || part.quantity) > 0),
        unitPrice,
        sku: "",
        catalogItemId: "",
        priceSource: hasOfferPrice ? "estimated" : "pending",
        notes: [
          part.code ? "Código técnico: " + part.code : "",
          part.unit ? "Unidade: " + part.unit : "",
          selected?.supplier ? "Fornecedor de referência: " + selected.supplier : "Fornecedor ainda não definido",
          line?.offerId ? "Oferta de referência: " + line.offerId : "Preço/oferta precisa de validação comercial",
          "Valor preliminar; não confirmado para aprovação ou fabricação.",
        ].filter(Boolean).join(" · "),
      };
    });
  }

  if (!items.length) throw new Error("O orçamento não contém itens válidos para integrar ao fluxo comercial.");
  if (items.some(item => !item.description || !Number.isFinite(item.quantity) || item.quantity < 0 || (item.quantity === 0 && item.quantityPending !== true))) {
    throw new Error("Há itens sem descrição ou com quantidade inválida. Corrija o orçamento original antes de integrar.");
  }

  const subtotal = items.reduce((sum, item) => sum + money(item.unitPrice) * Number(item.quantity), 0);
  const labor = money(source.laborAmount ?? source.labor?.amount);
  const originalTechnicalTotal = workflow === "technical" ? money(source.total) : 0;
  const total = subtotal + labor + freight;
  const notes = [
    String(source.request || "").trim(),
    String(source.notes || "").trim(),
    ...(pendingQuestions.length ? ["Pendências para confirmar: " + pendingQuestions.join(" | ")] : []),
    source.visitReason ? "Motivo da visita técnica: " + String(source.visitReason) : "",
    workflow === "technical"
      ? "ORÇAMENTO PRELIMINAR TÉCNICO. " + (requiresTechnicalVisit ? "Visita técnica pendente. " : "Medidas confirmadas. ") + "Total calculado no fluxo técnico de origem: R$ " + originalTechnicalTotal.toFixed(2) + ". Preços de fornecedor permanecem estimados até validação comercial."
      : "Convertido do Orçamento Inteligente. Revise itens, preços, condições e dados do cliente antes de enviar.",
  ].filter(Boolean).join("\n\n");

  return {
    number: "ORC-" + (workflow === "smart" ? "IA" : "TEC") + "-" + sourceId.slice(0, 8).toUpperCase(),
    clientName: String(source.clientName || source.customerName || "Cliente não informado"),
    clientEmail: String(source.clientEmail || ""),
    clientTaxId: String(source.clientTaxId || source.clientCnpj || ""),
    clientAddress: String(source.clientAddress || ""),
    date,
    validUntil,
    items,
    subtotal,
    labor,
    laborRate: money(source.laborPercent ?? source.laborRate ?? source.labor?.percentage),
    marginRate: 0,
    freight,
    taxRate: 0,
    taxAmount: 0,
    discountRate: 0,
    discountAmount: 0,
    total,
    currency: String(source.currency || "BRL"),
    status: "draft",
    notes,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    sourceBudgetCollection: workflow === "smart" ? "smart_budgets" : "technical_budgets",
    sourceBudgetId: sourceId,
    sourceBudgetWorkflow: workflow,
    pendingQuestions,
    requiresClientConfirmation,
    clientConfirmationStatus: requiresClientConfirmation ? (source.clientConfirmationStatus === "completed" ? "completed" : "pending") : "not_required",
    clientConfirmationNotes: String(source.clientConfirmationNotes || ""),
    requiresTechnicalVisit,
    visitRequired: requiresTechnicalVisit,
    visitReason: String(source.visitReason || ""),
    technicalVisitStatus: requiresTechnicalVisit ? (source.technicalVisitStatus === "completed" ? "completed" : "pending") : "not_required",
    preliminaryOnly: requiresTechnicalVisit || requiresClientConfirmation || items.some(item => item.quantityPending || ["pending", "estimated"].includes(String(item.priceSource || ""))),
  };
}

export function isTechnicalVisitPending(quote: Record<string, any>): boolean {
  return quote.requiresTechnicalVisit === true && String(quote.technicalVisitStatus || "pending") !== "completed";
}

export function hasPendingBudgetApprovalData(quote: Record<string, any>): boolean {
  if (isTechnicalVisitPending(quote)) return true;
  if (Array.isArray(quote.pendingQuestions) && quote.pendingQuestions.length > 0) return true;
  if (quote.requiresClientConfirmation === true && String(quote.clientConfirmationStatus || "pending") !== "completed") return true;
  const items = Array.isArray(quote.items) ? quote.items : [];
  return items.some((item: any) => item.quantityPending === true || !(Number(item.quantity) > 0));
}
