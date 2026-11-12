import type { TechnicalDrawing } from "../types";

type Element = Record<string, any>;

const safe = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const cleanText = (value: unknown): string =>
  String(value ?? "").replace(/[\r\n]/g, " ").replace(/[<>]/g, "").slice(0, 240);

function pair(code: number, value: string | number): string {
  return `${code}\n${value}\n`;
}

/**
 * Export the model's normalized 2D vector geometry as an AutoCAD R12 DXF.
 * Coordinates are converted from the 0..1000 drawing grid to millimetres.
 * The exported geometry is the current vector/front view, not a certified
 * manufacturing drawing; draft status is preserved in the file header note.
 */
export function buildTechnicalDrawingDxf(drawing: TechnicalDrawing): string {
  const model = drawing as TechnicalDrawing & { visualElements?: Element[]; isDraft?: boolean; status?: string };
  const dimensions = model.overallDimensions || { width: 0, height: 0 };
  const unitFactor = model.unit === "cm" ? 10 : 1;
  const widthMm = Math.max(1, safe(dimensions.width) * unitFactor);
  const heightMm = Math.max(1, safe(dimensions.height) * unitFactor);
  const sx = widthMm / 1000;
  const sy = heightMm / 1000;
  const x = (value: unknown) => safe(value) * sx;
  const y = (value: unknown) => heightMm - safe(value) * sy;
  const lines: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, layer = "GEOMETRY") => {
    lines.push(pair(0, "LINE"), pair(8, layer), pair(10, x1), pair(20, y1), pair(30, 0), pair(11, x2), pair(21, y2), pair(31, 0));
  };

  for (const element of (Array.isArray(model.visualElements) ? model.visualElements : []).slice(0, 500)) {
    const type = String(element.type || "").toLowerCase();
    if (type === "line") {
      line(x(element.x1), y(element.y1), x(element.x2), y(element.y2));
    } else if (type === "rect") {
      const left = x(element.x), right = x(safe(element.x) + safe(element.width));
      const top = y(element.y), bottom = y(safe(element.y) + safe(element.height));
      line(left, top, right, top); line(right, top, right, bottom);
      line(right, bottom, left, bottom); line(left, bottom, left, top);
    } else if (type === "circle") {
      lines.push(pair(0, "CIRCLE"), pair(8, "GEOMETRY"), pair(10, x(element.cx)), pair(20, y(element.cy)), pair(30, 0), pair(40, Math.max(0.1, safe(element.r) * Math.min(sx, sy))));
    } else if (type === "polygon" && Array.isArray(element.points) && element.points.length >= 3) {
      const points = element.points.slice(0, 200);
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        line(x(a.x), y(a.y), x(b.x), y(b.y));
      }
    } else if (type === "text" && cleanText(element.text)) {
      lines.push(pair(0, "TEXT"), pair(8, "ANNOTATION"), pair(10, x(element.x)), pair(20, y(element.y)), pair(30, 0), pair(40, Math.max(1.5, safe(element.fontSize, 14) * Math.min(sx, sy))), pair(1, cleanText(element.text)));
    }
  }

  // Export the dimension annotations as real DXF line/text entities too.
  const dimensionAnnotations = Array.isArray((model as any).dimensionLines) ? (model as any).dimensionLines.slice(0, 100) : [];
  for (const dimension of dimensionAnnotations) {
    const start = dimension?.start || {};
    const end = dimension?.end || {};
    const x1 = x(start.x), y1 = y(start.y), x2 = x(end.x), y2 = y(end.y);
    line(x1, y1, x2, y2, "DIMENSIONS");
    const label = cleanText(dimension.label || (Number.isFinite(Number(dimension.value)) ? String(dimension.value) + " " + String(dimension.unit || "mm") : ""));
    if (label) {
      lines.push(pair(0, "TEXT"), pair(8, "DIMENSIONS"), pair(10, (x1 + x2) / 2), pair(20, (y1 + y2) / 2 + 8), pair(30, 0), pair(40, Math.max(2, Math.min(12, Math.min(widthMm, heightMm) * 0.012))), pair(1, label));
    }
  }

  if (!lines.length) throw new Error("Este desenho ainda não possui geometria vetorial para exportar em DXF.");
  const draft = model.isDraft !== false || model.status !== "APPROVED_FOR_MANUFACTURING";
  const header =
    pair(0, "SECTION") + pair(2, "HEADER") +
    pair(9, "$ACADVER") + pair(1, "AC1009") +
    pair(9, "$INSUNITS") + pair(70, "4") +
    pair(999, cleanText(model.title || "ANACLETO")) +
    pair(999, draft ? "RASCUNHO PRELIMINAR - NAO FABRICAR SEM VALIDACAO" : "DESENHO APROVADO - CONFERIR SNAPSHOT") +
    pair(0, "ENDSEC");
  const tables = pair(0, "SECTION") + pair(2, "TABLES") +
    pair(0, "TABLE") + pair(2, "LAYER") + pair(70, "3") +
    pair(0, "LAYER") + pair(2, "GEOMETRY") + pair(70, "0") + pair(62, "7") + pair(6, "CONTINUOUS") +
    pair(0, "LAYER") + pair(2, "ANNOTATION") + pair(70, "0") + pair(62, "2") + pair(6, "CONTINUOUS") +
    pair(0, "LAYER") + pair(2, "DIMENSIONS") + pair(70, "0") + pair(62, "4") + pair(6, "CONTINUOUS") +
    pair(0, "ENDTAB") + pair(0, "ENDSEC");
  return header + tables + pair(0, "SECTION") + pair(2, "ENTITIES") + lines.join("") + pair(0, "ENDSEC") + pair(0, "EOF");
}

export function downloadTechnicalDrawingDxf(drawing: TechnicalDrawing): void {
  const content = buildTechnicalDrawingDxf(drawing);
  const blob = new Blob([content], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const base = cleanText(drawing.title || "Anacleto_Desenho_Tecnico").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "Anacleto_Desenho_Tecnico";
  anchor.href = url;
  anchor.download = base + ".dxf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
