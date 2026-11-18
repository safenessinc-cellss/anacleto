/**
 * ANACLETO — fórmulas paramétricas de fabricação.
 *
 * A expressão é uma AST controlada (sem eval/Function). Fórmulas novas começam
 * como draft e não podem gerar BOM de produção até serem aprovadas com fonte técnica.
 */

import type { ResolvedBomLine, TechnicalCategory } from "./technicalCatalog";

export type DimensionKey = "widthMm" | "heightMm" | "leafCount";

export type FormulaExpression =
  | { op: "constant"; value: number }
  | { op: "dimension"; key: DimensionKey }
  | { op: "add"; terms: FormulaExpression[] }
  | { op: "subtract"; left: FormulaExpression; right: FormulaExpression }
  | { op: "multiply"; left: FormulaExpression; right: FormulaExpression }
  | { op: "divide"; left: FormulaExpression; right: FormulaExpression };

export interface FormulaDimensions {
  widthMm: number;
  heightMm: number;
  leafCount: number;
}

export interface TipologiaBomRule {
  id: string;
  catalogItemId: string;
  description: string;
  category: TechnicalCategory;
  unit: "kg" | "m" | "m2" | "un" | "barra" | "conjunto";
  quantity: FormulaExpression;
  cutLengthMm?: FormulaExpression;
  glassWidthMm?: FormulaExpression;
  glassHeightMm?: FormulaExpression;
  wasteRate?: number;
  requiredSystemLineId: string;
  requiredTipologiaId: string;
  requiredFinish?: string;
  requiredGlassThicknessMm?: number;
}

export interface TipologiaDefinition {
  id: string;
  name: string;
  systemLineId: string;
  category: string;
  formulaVersion: string;
  status: "draft" | "technical_review" | "approved" | "retired";
  bomRules: TipologiaBomRule[];
  technicalSourceUrl?: string;
  technicalSourceDocument?: string;
  validatedAgainst?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  validationChecklist?: string[];
}

export function evaluateFormula(
  expression: FormulaExpression,
  dimensions: FormulaDimensions,
): number {
  let result: number;
  switch (expression.op) {
    case "constant":
      result = expression.value;
      break;
    case "dimension":
      result = dimensions[expression.key];
      break;
    case "add":
      if (!expression.terms.length) throw new Error("A soma da fórmula não possui termos.");
      result = expression.terms.reduce((sum, term) => sum + evaluateFormula(term, dimensions), 0);
      break;
    case "subtract":
      result = evaluateFormula(expression.left, dimensions) - evaluateFormula(expression.right, dimensions);
      break;
    case "multiply":
      result = evaluateFormula(expression.left, dimensions) * evaluateFormula(expression.right, dimensions);
      break;
    case "divide": {
      const divisor = evaluateFormula(expression.right, dimensions);
      if (divisor === 0) throw new Error("Divisão por zero na fórmula de fabricação.");
      result = evaluateFormula(expression.left, dimensions) / divisor;
      break;
    }
    default: {
      const exhaustive: never = expression;
      throw new Error(`Operação de fórmula não suportada: ${String(exhaustive)}`);
    }
  }
  if (!Number.isFinite(result)) throw new Error("A fórmula produziu um resultado não finito.");
  return result;
}

function positiveOrZero(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`A fórmula de ${label} produziu um valor negativo ou inválido.`);
  }
  return value;
}

/**
 * Only approved, source-backed definitions can produce a manufacturing BOM.
 * This deliberately does not contain guessed Suprema/Gold measurements.
 */
export function buildBomFromTipologia(input: {
  definition: TipologiaDefinition;
  dimensions: FormulaDimensions;
  finish?: string;
  glassThicknessMm?: number;
}): ResolvedBomLine[] {
  const { definition, dimensions } = input;
  if (definition.status !== "approved") {
    throw new Error("Esta tipologia ainda não foi aprovada tecnicamente para fabricação.");
  }
  if (!definition.technicalSourceUrl && !definition.technicalSourceDocument) {
    throw new Error("A tipologia aprovada precisa manter a fonte técnica da fórmula.");
  }
  if (!definition.validatedAgainst?.trim() || !definition.approvedAt || !definition.approvedBy) {
    throw new Error("Faltam evidências de validação e aprovação da fórmula.");
  }
  if (!Number.isFinite(dimensions.widthMm) || dimensions.widthMm <= 0
    || !Number.isFinite(dimensions.heightMm) || dimensions.heightMm <= 0
    || !Number.isFinite(dimensions.leafCount) || dimensions.leafCount <= 0) {
    throw new Error("Informe largura, altura e quantidade de folhas válidas.");
  }
  if (!definition.bomRules.length) {
    throw new Error("A tipologia não possui componentes cadastrados na lista técnica.");
  }

  return definition.bomRules.map((rule): ResolvedBomLine => {
    if (rule.requiredSystemLineId !== definition.systemLineId
      || rule.requiredTipologiaId !== definition.id) {
      throw new Error(`A regra ${rule.id} está vinculada a outra linha ou tipologia.`);
    }
    const quantity = positiveOrZero(evaluateFormula(rule.quantity, dimensions), rule.description);
    if (quantity <= 0) throw new Error(`A quantidade de ${rule.description} precisa ser maior que zero.`);
    if (rule.wasteRate !== undefined && (!Number.isFinite(rule.wasteRate) || rule.wasteRate < 0 || rule.wasteRate > 1)) {
      throw new Error(`A perda técnica de ${rule.description} deve estar entre 0% e 100%.`);
    }
    if (rule.requiredFinish && input.finish !== rule.requiredFinish) {
      throw new Error(`O acabamento exigido para ${rule.description} não corresponde ao selecionado.`);
    }
    if (rule.requiredGlassThicknessMm && input.glassThicknessMm !== rule.requiredGlassThicknessMm) {
      throw new Error(`A espessura de vidro exigida para ${rule.description} não corresponde à selecionada.`);
    }
    const result: ResolvedBomLine = {
      catalogItemId: rule.catalogItemId,
      description: rule.description,
      category: rule.category,
      quantity,
      unit: rule.unit,
      wasteRate: rule.wasteRate,
      requiredSystemLineId: rule.requiredSystemLineId,
      requiredTipologiaId: rule.requiredTipologiaId,
      requiredCategory: rule.category,
      requiredFinish: rule.requiredFinish,
      requiredGlassThicknessMm: rule.requiredGlassThicknessMm,
    };
    if (rule.cutLengthMm) result.cutLengthMm = positiveOrZero(evaluateFormula(rule.cutLengthMm, dimensions), rule.description);
    if (rule.glassWidthMm) result.widthMm = positiveOrZero(evaluateFormula(rule.glassWidthMm, dimensions), rule.description);
    if (rule.glassHeightMm) result.heightMm = positiveOrZero(evaluateFormula(rule.glassHeightMm, dimensions), rule.description);
    if (rule.category === "glass" && (!result.widthMm || !result.heightMm || !rule.requiredGlassThicknessMm)) {
      throw new Error(`A regra de vidro ${rule.description} precisa definir largura, altura e espessura.`);
    }
    if (rule.category === "aluminum_profile" && !result.cutLengthMm) {
      throw new Error(`A regra de perfil ${rule.description} precisa definir o comprimento de corte.`);
    }
    return result;
  });
}

/** Draft only: this is a checklist/template, not a fabrication formula. */
export function createUnconfiguredSlidingWindowTemplate(input: {
  id: string;
  systemLineId: string;
  createdAt: string;
}): TipologiaDefinition {
  return {
    id: input.id,
    name: "Janela de correr — 2 folhas",
    systemLineId: input.systemLineId,
    category: "janela_correr",
    formulaVersion: "0.1.0-draft",
    status: "draft",
    bomRules: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}


/**
 * Registered draft for the first implementation target. The checklist records
 * what must be sourced from the official Suprema technical manual; it is not
 * a cutting list and must never be used to calculate a customer quote.
 */
export function createSupremaTwoLeafSlidingWindowDraft(now: string): TipologiaDefinition {
  return {
    id: "janela-correr-2-folhas-suprema",
    name: "Janela de correr — 2 folhas",
    systemLineId: "suprema",
    category: "janela_correr",
    formulaVersion: "0.1.0-draft",
    status: "technical_review",
    bomRules: [],
    validationChecklist: [
      "Identificar códigos oficiais dos perfis de marco, folhas e encontro.",
      "Registrar peso kg/m e comprimento comercial de cada perfil a partir do catálogo do fabricante.",
      "Registrar descontos de corte, usinagem, folgas e sobreposições da tabela oficial.",
      "Definir modelo e quantidade de roldanas conforme peso máximo da folha.",
      "Definir fecho, contra-fecho e parafusos por código e compatibilidade documentada.",
      "Definir escovas, guarnições e metragem por canal/perímetro.",
      "Definir tipo, espessura e dimensões de vidro com as folgas prescritas.",
      "Anexar fonte técnica e validar uma peça piloto fabricada antes da aprovação.",
    ],
    createdAt: now,
    updatedAt: now,
  };
}
