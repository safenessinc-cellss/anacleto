export type AIRoleCapability =
  | "budget"
  | "financial"
  | "technicalDrawing"
  | "snapshotQuote"
  | "snapshotDrawing"
  | "manualPriceApproval";

const AI_ROLE_POLICIES: Record<AIRoleCapability, readonly string[]> = {
  budget: ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "financeiro"],
  financial: ["super_admin", "super_usuario", "ceo", "admin", "financeiro"],
  technicalDrawing: ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "qualidade", "producao"],
  snapshotQuote: ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "financeiro"],
  snapshotDrawing: ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "qualidade", "producao"],
  manualPriceApproval: ["super_admin", "super_usuario", "ceo", "admin", "financeiro"],
};

/** One server-side role policy for all AI, budget, finance and CAD operations. */
export function hasAIRole(role: unknown, capability: AIRoleCapability): boolean {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return AI_ROLE_POLICIES[capability].includes(normalizedRole);
}
