export interface BudgetAIFallback {
  items: Array<{
    description: string;
    qty: number;
    price: number;
    sku: string;
    catalogItemId: string;
    priceSource: "pending";
    notes: string;
  }>;
  notes: string;
  pendingQuestions: string[];
  visitRequired: boolean;
  visitReason: string;
  fallback: true;
  code: "AI_PROVIDER_FALLBACK";
}

export function buildBudgetAIFallback(prompt: string): BudgetAIFallback {
  const text = String(prompt || "").trim();
  const hasDimensions =
    /altura\s*(?:de|:|=)?\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\b[\s\S]{0,80}largura\s*(?:de|:|=)?\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\b/i.test(text) ||
    /\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?\b/i.test(text);
  const hasQuantity = /\b\d+\s*(?:un(?:idades?)?|peças?|portas?|janelas?|boxes?|m²|metros?)\b/i.test(text);
  const hasMaterial = /alum[ií]nio|vidro|madeira|aço|concreto|pedra|porcelanato|gesso|tijolo|pvc|ferro/i.test(text);
  const hasFinish = /branco|preto|bronze|natural|anodiz|pintura|fosco|brilhante|amadeirado/i.test(text);
  const pendingQuestions: string[] = [];
  if (!hasDimensions) pendingQuestions.push("Informar as medidas em altura × largura, com unidade explícita (mm, cm ou m), para cada vão/área.");
  if (!hasQuantity) pendingQuestions.push("Confirmar a quantidade de unidades, vãos ou áreas. Folhas de uma esquadria não equivalem à quantidade de unidades.");
  if (!hasMaterial) pendingQuestions.push("Definir o material e o sistema construtivo de cada serviço.");
  if (!hasFinish) pendingQuestions.push("Definir acabamento, cor e padrão visual.");
  pendingQuestions.push("Separar e confirmar cada serviço/etapa do pedido antes de emitir a proposta comercial.");
  const needsSiteInspection = /reforma|piscina|churrasqueira|lareira|chimenea|pergolado|estrutura|constru[cç][aã]o|terreno|instala[cç][aã]o|madeira laminada|\bmlc\b/i.test(text);
  const needsOpeningMeasurement = /esquadria|janela|porta|box/i.test(text) && !hasDimensions;
  const visitRequired = needsSiteInspection || needsOpeningMeasurement;
  const visitReason = visitRequired
    ? "Visita técnica pendente para medir e avaliar acesso, estrutura e condições existentes antes do orçamento executivo."
    : "";
  return {
    items: [{
      description: "Rascunho provisório — pedido recebido: " + text.slice(0, 500),
      qty: quantity,
      price: 0,
      sku: "",
      catalogItemId: "",
      priceSource: "pending",
      notes: "A IA/provedor não respondeu. Escopo mantido como texto original; quantidade, materiais, composição e preço não foram presumidos. Não liberar compra ou fabricação.",
    }],
    notes: "Rascunho local de contingência. Não é proposta comercial nem orçamento executivo; o pedido ainda precisa ser desmembrado e validado.",
    pendingQuestions,
    visitRequired,
    visitReason,
    fallback: true,
    code: "AI_PROVIDER_FALLBACK",
  };
}
