import { createHash } from "node:crypto";

export interface SnapshotDimension {
  width: number;
  height: number;
  depth?: number;
  unit: "mm" | "cm";
}
export interface SnapshotBudgetLine {
  lineId: string;
  description: string;
  sku: string | null;
  catalogItemId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  priceValidation: "CATALOG_VERIFIED" | "MANUALLY_APPROVED_BY_AUTHORIZED_USER";
  materialType: "PROFILE" | "GLASS" | "HARDWARE" | "SERVICE" | "OTHER";
}
export interface BudgetSnapshot {
  schemaVersion: 1;
  snapshotType: "BUDGET";
  documentId: string;
  documentNumber: string;
  approvedAt: string;
  approvedBy: { uid: string; email: string; role: string };
  currency: string;
  lines: SnapshotBudgetLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  dimensions: SnapshotDimension | null;
  profiles: SnapshotBudgetLine[];
  glazing: SnapshotBudgetLine[];
  technicalDrawing: {
    drawingId: string | null;
    title: string | null;
    status: string | null;
    contentHash: string | null;
    dimensions: SnapshotDimension | null;
    pieces: unknown[];
    cuttingPlan: unknown[];
    measurementPlan: unknown[];
    vectorPayload: unknown | null;
  } | null;
  modelSignature: Record<string, unknown>;
  contentHash: string;
}
export interface BuildBudgetSnapshotInput {
  documentId: string;
  documentNumber: string;
  approvedAt: string;
  approvedBy: BudgetSnapshot["approvedBy"];
  currency: string;
  lines: Array<Record<string, unknown>>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  technicalDrawing?: Record<string, any> | null;
  modelSignature: Record<string, unknown>;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value as Record<string, unknown>).sort().map(key =>
      JSON.stringify(key) + ":" + stable((value as Record<string, unknown>)[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}
export function sha256Snapshot(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
function classify(line: Record<string, unknown>): SnapshotBudgetLine["materialType"] {
  const category = String(line.itemCategory || line.category || "").toLowerCase();
  const description = String(line.description || "").toLowerCase();
  if (/vidro|glass|laminad|temperad|espelho/.test(category + " " + description)) return "GLASS";
  if (/perfil|profile|alum[ií]nio|aluminum/.test(category + " " + description)) return "PROFILE";
  if (/ferragem|hardware|roldana|fechadura|dobradi/.test(category + " " + description)) return "HARDWARE";
  if (/servi[cç]o|instala[cç]|m[aã]o de obra/.test(category + " " + description)) return "SERVICE";
  return "OTHER";
}
function normalizeDimension(value: any): SnapshotDimension | null {
  if (!value || typeof value !== "object") return null;
  const width = Number(value.width), height = Number(value.height);
  const depth = value.depth == null ? undefined : Number(value.depth);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  if (depth !== undefined && (!Number.isFinite(depth) || depth < 0)) return null;
  const unit = value.unit === "mm" ? "mm" : "cm";
  return { width, height, ...(depth === undefined ? {} : { depth }), unit };
}
export function createBudgetSnapshot(input: BuildBudgetSnapshotInput): BudgetSnapshot {
  const lines: SnapshotBudgetLine[] = input.lines.map((line, index) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const lineTotal = Number((quantity * unitPrice).toFixed(2));
    const priceValidation = line.priceValidation;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !["CATALOG_VERIFIED", "MANUALLY_APPROVED_BY_AUTHORIZED_USER"].includes(String(priceValidation))) {
      throw new Error("Budget snapshot rejected an unvalidated or invalid commercial line.");
    }
    return {
      lineId: String(line.id || line.pieceId || "line-" + (index + 1)),
      description: String(line.description || "").slice(0, 500),
      sku: line.sku ? String(line.sku) : null,
      catalogItemId: line.catalogItemId ? String(line.catalogItemId) : null,
      quantity, unitPrice, lineTotal,
      currency: input.currency,
      priceValidation: priceValidation as SnapshotBudgetLine["priceValidation"],
      materialType: classify(line),
    };
  });
  const drawing = input.technicalDrawing || null;
  const drawingDimensions = normalizeDimension(drawing?.overallDimensions ? { ...drawing.overallDimensions, unit: drawing.unit } : null);
  const draft = {
    schemaVersion: 1 as const,
    snapshotType: "BUDGET" as const,
    documentId: input.documentId,
    documentNumber: input.documentNumber,
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    currency: input.currency,
    lines,
    subtotal: input.subtotal,
    discountAmount: input.discountAmount,
    taxAmount: input.taxAmount,
    total: input.total,
    dimensions: drawingDimensions,
    profiles: lines.filter(line => line.materialType === "PROFILE"),
    glazing: lines.filter(line => line.materialType === "GLASS"),
    technicalDrawing: drawing ? {
      drawingId: drawing.id ? String(drawing.id) : null,
      title: drawing.title ? String(drawing.title) : null,
      status: drawing.status ? String(drawing.status) : null,
      contentHash: drawing.snapshotContentHash ? String(drawing.snapshotContentHash) : null,
      dimensions: drawingDimensions,
      pieces: Array.isArray(drawing.pieces) ? drawing.pieces : [],
      cuttingPlan: Array.isArray(drawing.cuttingPlan) ? drawing.cuttingPlan : [],
      measurementPlan: Array.isArray(drawing.measurementPlan) ? drawing.measurementPlan : [],
      vectorPayload: drawing.vectorPayload || null,
    } : null,
    modelSignature: input.modelSignature,
  };
  return { ...draft, contentHash: sha256Snapshot(draft) };
}
