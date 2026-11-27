export interface BudgetAIDraftResponse {
  items: Array<Record<string, any>>;
  notes: string;
  pendingQuestions: string[];
  visitRequired: boolean;
  visitReason: string;
}

export function normalizeBudgetAIDraftResponse(value: any): BudgetAIDraftResponse {
  if (!Array.isArray(value?.items) || value.items.length > 150) {
    throw new Error("A IA não retornou uma lista válida de itens.");
  }
  const pendingQuestions = Array.isArray(value.pendingQuestions)
    ? value.pendingQuestions.map((question: any) => String(question || "").trim()).filter(Boolean).slice(0, 20)
    : [];
  const visitRequired = value.visitRequired === true;
  const itemsWithPendingQuantity = value.items.filter((item: any) => Number(item?.qty) === 0);
  if (itemsWithPendingQuantity.length && !pendingQuestions.some((question: string) => /quantidade|medida|dimens[aã]o|largura|altura/i.test(question))) {
    pendingQuestions.push("Informe a quantidade e as medidas de cada item marcado como pendente.");
  }
  if (!value.items.length && visitRequired && !pendingQuestions.length) {
    pendingQuestions.push("Quais serviços, ambientes e elementos devem compor o escopo do orçamento?");
  }
  if (!value.items.length && !pendingQuestions.length && !visitRequired) {
    throw new Error("A IA não identificou itens nem pendências que justifiquem um rascunho.");
  }

  const items = value.items.map((item: any) => {
    const description = String(item?.description || "").trim();
    const qty = Number(item?.qty);
    const price = Number(item?.price);
    if (!description || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(price) || price < 0) {
      throw new Error("Linha inválida retornada pela IA.");
    }
    return { ...item, description, qty, price };
  });

  return {
    ...value,
    items,
    notes: String(value.notes || "").slice(0, 4000),
    pendingQuestions: pendingQuestions.slice(0, 20),
    visitRequired,
    visitReason: String(value.visitReason || "").slice(0, 1000),
  };
}
