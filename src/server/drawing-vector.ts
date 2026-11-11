export const TECHNICAL_DRAFT_WATERMARK = "BORRADOR PRELIMINAR - NO VÁLIDO PARA FABRICACIÓN";
export interface VectorDrawingPayload {
  format: "svg";
  svg: string;
  watermarked: boolean;
  status: "PRELIMINARY_CONTINGENCY" | "APPROVED_FOR_MANUFACTURING";
}
type VectorElement = Record<string, unknown>;
const escapeXml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] as string);
function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-10000, Math.min(10000, number)) : fallback;
}
function renderElement(element: VectorElement): string {
  const type = String(element.type || "").toLowerCase();
  const stroke = escapeXml(element.stroke || "#cbd5e1");
  const fill = escapeXml(element.fill || "none");
  const width = Math.max(0.5, Math.min(12, safeNumber(element.strokeWidth, 2)));
  if (type === "rect") return `<rect x="${safeNumber(element.x)}" y="${safeNumber(element.y)}" width="${Math.max(0,safeNumber(element.width))}" height="${Math.max(0,safeNumber(element.height))}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  if (type === "line") return `<line x1="${safeNumber(element.x1)}" y1="${safeNumber(element.y1)}" x2="${safeNumber(element.x2)}" y2="${safeNumber(element.y2)}" stroke="${stroke}" stroke-width="${width}"/>`;
  if (type === "circle") return `<circle cx="${safeNumber(element.cx)}" cy="${safeNumber(element.cy)}" r="${Math.max(0,safeNumber(element.r))}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  if (type === "polygon" && Array.isArray(element.points)) {
    const points = element.points.slice(0, 500).map((point: any) => `${safeNumber(point?.x)},${safeNumber(point?.y)}`).join(" ");
    return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  }
  if (type === "text") return `<text x="${safeNumber(element.x)}" y="${safeNumber(element.y)}" fill="${fill === "none" ? "#f8fafc" : fill}" font-size="${Math.max(6,Math.min(48,safeNumber(element.fontSize,14)))}">${escapeXml(element.text)}</text>`;
  return "";
}
export function buildDrawingVectorPayload(elements: VectorElement[], isDraft: boolean): VectorDrawingPayload {
  const safeElements = Array.isArray(elements) ? elements.slice(0, 500) : [];
  const base = safeElements.map(renderElement).join("");
  const watermark = isDraft
    ? `<g id="anacleto-draft-watermark" pointer-events="none" opacity="0.30"><text x="500" y="500" text-anchor="middle" font-family="Arial,sans-serif" font-size="58" font-weight="700" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" transform="rotate(-28 500 500)">${TECHNICAL_DRAFT_WATERMARK}</text></g>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="Desenho técnico Anacleto">${base}${watermark}</svg>`;
  return { format: "svg", svg, watermarked: isDraft, status: isDraft ? "PRELIMINARY_CONTINGENCY" : "APPROVED_FOR_MANUFACTURING" };
}
export function withDraftVectorWatermark<T extends { visualElements?: VectorElement[]; isDraft?: boolean; status?: string }>(drawing: T): T & { vectorPayload: VectorDrawingPayload } {
  const isDraft = drawing.isDraft !== false || drawing.status !== "APPROVED_FOR_MANUFACTURING";
  const vectorPayload = buildDrawingVectorPayload(drawing.visualElements || [], isDraft);
  const cleanElements = (drawing.visualElements || []).filter(element => element?.id !== "anacleto-draft-watermark");
  return {
    ...drawing,
    isDraft,
    status: isDraft ? "PRELIMINARY_CONTINGENCY" : "APPROVED_FOR_MANUFACTURING",
    visualElements: isDraft ? [...cleanElements, { id: "anacleto-draft-watermark", type: "text", x: 500, y: 520, text: TECHNICAL_DRAFT_WATERMARK, fill: "#dc2626", fontSize: 34, rotation: -28, opacity: 0.30, nonManufacturingAnnotation: true }] : cleanElements,
    vectorPayload,
  };
}
