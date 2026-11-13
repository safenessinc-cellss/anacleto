import type { TechnicalDrawing, TechnicalDrawingReference } from "../types";

type DrawingInput = TechnicalDrawing | TechnicalDrawingReference;
type AluminumType = NonNullable<TechnicalDrawing["parametricSpec"]>["tipologia"];

interface AluminumSpec {
  type: AluminumType;
  line: string;
  frameColor: string;
  glassColor: string;
  glassType: string;
  width: number;
  height: number;
  depth: number;
  leaves: number;
  fixed: boolean;
  opening: string;
}

const escapeXml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[char] || char));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const numeric = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function framePaint(value: unknown): string {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/branc|white/i.test(color)) return "#e8edf0";
  if (/pret|black/i.test(color)) return "#252b32";
  if (/bronze/i.test(color)) return "#80552f";
  if (/natural|anodiz|silver|prata/i.test(color)) return "#9da8ae";
  return "#65747d";
}

function glassPaint(value: unknown): string {
  const color = String(value || "").toLowerCase();
  if (/bronze/.test(color)) return "#9c704d";
  if (/verde|green/.test(color)) return "#378a7a";
  if (/fum[eê]|fume|cinza|gray/.test(color)) return "#58727b";
  return "#5caeb9";
}

function normalizedType(value: unknown): AluminumType {
  const type = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/box/.test(type)) return "box_banheiro";
  if (/maxim/.test(type)) return "maxim_ar";
  if (/bascul/.test(type)) return "basculante";
  if (/pivot/.test(type)) return "porta_pivotante";
  if (/porta.*giro|giro/.test(type)) return "porta_giro";
  if (/porta|door/.test(type)) return "porta_correr";
  return "janela_correr";
}

export function resolveAluminumSpec(drawing: DrawingInput): AluminumSpec {
  const source = drawing as DrawingInput & { parametricSpec?: TechnicalDrawing["parametricSpec"] };
  const supplied = source.parametricSpec;
  const titleAndType = `${drawing.title || ""} ${drawing.tipologia || ""} ${drawing.category || ""}`;
  const type = normalizedType(supplied?.tipologia || drawing.tipologia || titleAndType);
  const unitFactor = drawing.unit === "cm" ? 10 : 1;
  const dimensions = drawing.overallDimensions;
  const width = numeric(supplied?.largura_mm, numeric(dimensions?.width, 1000) * unitFactor);
  const height = numeric(supplied?.altura_mm, numeric(dimensions?.height, 1000) * unitFactor);
  const depth = clamp(numeric(dimensions?.depth, 60 / unitFactor) * unitFactor, 30, 100);
  const leaves = clamp(Math.floor(numeric(supplied?.folhas, /3\s*folhas/i.test(titleAndType) ? 3 : 2)), 1, 8);
  const rawColor = supplied?.cor_perfil || drawing.cor || "";
  const rawGlass = supplied?.cor_vidro || drawing.vidro || "";
  return {
    type,
    line: String(supplied?.linha_aluminio || drawing.linha || "Linha a definir").slice(0, 60),
    frameColor: framePaint(rawColor),
    glassColor: glassPaint(rawGlass),
    glassType: String(supplied?.tipo_vidro || drawing.vidro || "vidro a definir").slice(0, 50),
    width,
    height,
    depth,
    leaves: type === "box_banheiro" ? Math.max(2, leaves) : leaves,
    fixed: Boolean(supplied?.modulo_fixo),
    opening: String(supplied?.abertura || "central"),
  };
}

export function buildArchitecturalElevationSvg(drawing: DrawingInput): string {
  const spec = resolveAluminumSpec(drawing);
  const x = 278, y = 206, w = 644;
  const h = clamp(w * spec.height / spec.width, 330, 474);
  const wallX = x - 76, wallY = y - 68, wallW = w + 152, wallH = h + 130;
  const cf = spec.frameColor;
  const glass = spec.glassColor;
  const innerX = x + 24, innerY = y + 24, innerW = w - 48, innerH = h - 48;
  const leafCount = spec.leaves;
  const paneWidth = innerW / leafCount;
  const handles = spec.type === "porta_correr" || spec.type === "janela_correr" || spec.type === "box_banheiro";
  const leaves = Array.from({ length: leafCount }, (_, index) => {
    const paneX = innerX + index * paneWidth;
    const fixed = spec.fixed && index === 0;
    const bar = clamp(w / 40, 10, 18);
    const gripX = paneX + paneWidth * (index % 2 ? 0.25 : 0.75);
    return `<g>
      <rect x="${paneX + 5}" y="${innerY + 5}" width="${paneWidth - 10}" height="${innerH - 10}" rx="1" fill="url(#architectural-glass)" stroke="#d7e5e7" stroke-width="2"/>
      <path d="M ${paneX + 14} ${innerY + innerH - 18} L ${paneX + paneWidth * 0.48} ${innerY + 18} L ${paneX + paneWidth * 0.56} ${innerY + 18} L ${paneX + 24} ${innerY + innerH - 18} Z" fill="#ffffff" opacity=".22"/>
      <path d="M ${paneX + 34} ${innerY + innerH - 20} L ${paneX + paneWidth * 0.67} ${innerY + 20}" stroke="#f4ffff" stroke-width="3" opacity=".52"/>
      <rect x="${paneX + 2}" y="${innerY + 2}" width="${bar}" height="${innerH - 4}" fill="url(#architectural-metal)" stroke="#26353b" stroke-width="1.4"/>
      <rect x="${paneX + paneWidth - bar - 2}" y="${innerY + 2}" width="${bar}" height="${innerH - 4}" fill="url(#architectural-metal)" stroke="#26353b" stroke-width="1.4"/>
      <rect x="${paneX + 2}" y="${innerY + 2}" width="${paneWidth - 4}" height="${bar}" fill="url(#architectural-metal)" stroke="#26353b" stroke-width="1.4"/>
      <rect x="${paneX + 2}" y="${innerY + innerH - bar - 2}" width="${paneWidth - 4}" height="${bar}" fill="url(#architectural-metal)" stroke="#26353b" stroke-width="1.4"/>
      ${spec.type === "janela_correr" || spec.type === "basculante" ? `<rect x="${paneX + 2}" y="${innerY + innerH / 2 - bar / 2}" width="${paneWidth - 4}" height="${bar}" fill="url(#architectural-metal)" stroke="#26353b" stroke-width="1.4"/>` : ""}
      <rect x="${paneX + 9}" y="${innerY + 10}" width="${paneWidth - 18}" height="${innerH - 20}" fill="none" stroke="#d6e0e2" stroke-width="2" opacity=".9"/>
      ${!fixed && handles ? `<path d="M ${gripX} ${y + h * 0.52 - 15} q 8 0 8 8 v 26 q 0 8 -8 8 h -3 v -42 z" fill="#35464c" stroke="#d8e1e2" stroke-width="2"/><circle cx="${gripX + 1}" cy="${y + h * 0.52 - 4}" r="2" fill="#f3f5f4"/>` : ""}
      ${!fixed && handles ? `<text x="${paneX + paneWidth / 2}" y="${innerY + innerH * .56}" text-anchor="middle" fill="#275b60" font-size="26" font-weight="700">${index % 2 ? "←" : "→"}</text>` : ""}
      <text x="${paneX + paneWidth / 2}" y="${y - 11}" text-anchor="middle" fill="#33444a" font-size="12" font-weight="700">${fixed ? "MÓDULO FIXO" : `FOLHA ${index + 1} · ${Math.round(spec.width / leafCount)} mm`}</text>
    </g>`;
  }).join("");
  const miters = [
    `M ${x + 8} ${y + 8} l 20 20`,
    `M ${x + w - 8} ${y + 8} l -20 20`,
    `M ${x + 8} ${y + h - 8} l 20 -20`,
    `M ${x + w - 8} ${y + h - 8} l -20 -20`,
  ].join(" ");
  const hardware = spec.type === "maxim_ar" || spec.type === "basculante"
    ? `<path d="M ${x + 92} ${y + h - 62} L ${x + w / 2} ${y + h / 2} L ${x + w - 92} ${y + 62}" fill="none" stroke="#75858b" stroke-width="3" stroke-dasharray="8 7"/><path d="M ${x + 72} ${y + h - 80} l 42 -35 l 22 17" fill="none" stroke="#596b70" stroke-width="7" stroke-linecap="round"/><text x="${x + 96}" y="${y + h - 97}" fill="#40545b" font-size="11">BRAÇO ARTICULADO</text>`
    : spec.type === "porta_giro" || spec.type === "porta_pivotante"
      ? `<circle cx="${spec.opening === "esquerda" ? x + 37 : x + w - 37}" cy="${y + h / 2}" r="8" fill="#d1ad62" stroke="#58451d" stroke-width="2"/><path d="M ${x + 45} ${y + 50} A ${w * .7} ${h * .72} 0 0 1 ${x + w - 20} ${y + h - 30}" fill="none" stroke="#607178" stroke-width="2" stroke-dasharray="7 7"/><path d="M ${x + 38} ${y + h / 2} L ${x + w - 26} ${y + 44} L ${x + w - 26} ${y + h - 44} Z" fill="none" stroke="#607178" stroke-width="1.8" stroke-dasharray="6 6"/>`
      : spec.type === "box_banheiro"
        ? `<g fill="#e1e7e8" stroke="#45565b" stroke-width="3"><circle cx="${x + w * .62}" cy="${y + 36}" r="10"/><circle cx="${x + w * .82}" cy="${y + 36}" r="10"/></g><text x="${x + w * .72}" y="${y + 62}" text-anchor="middle" fill="#33444a" font-size="10">ROLDANAS DUPLAS</text>`
        : "";
  const cutLabel = spec.type === "porta_giro" || spec.type === "porta_pivotante" ? "FECHO / CILINDRO" : "FECHO CONCHA";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850" role="img" aria-label="Elevação arquitetônica técnica de esquadria">
    <defs>
      <linearGradient id="architectural-metal" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f8fafb"/><stop offset=".18" stop-color="${cf}"/><stop offset=".48" stop-color="#f0f3f4"/><stop offset=".72" stop-color="${cf}"/><stop offset="1" stop-color="#59676d"/></linearGradient>
      <linearGradient id="architectural-glass" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#d8f6f5" stop-opacity=".85"/><stop offset=".42" stop-color="${glass}" stop-opacity=".54"/><stop offset="1" stop-color="#6b9fa4" stop-opacity=".72"/></linearGradient>
      <pattern id="architectural-brick" width="42" height="22" patternUnits="userSpaceOnUse"><path d="M0 0H42M0 11H42M21 0V11M0 11V22M42 11V22" fill="none" stroke="#bac3c5" stroke-width="1"/></pattern>
      <marker id="architectural-dim" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#45585f"/></marker>
      <filter id="architectural-shadow" x="-.2" y="-.2" width="1.4" height="1.5"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="1200" height="850" fill="#f8fafb"/>
    <text x="600" y="42" text-anchor="middle" fill="#21333a" font-family="Arial,sans-serif" font-size="22" font-weight="700">ELEVAÇÃO FRONTAL · ${escapeXml(drawing.title || "ESQUADRIA DE ALUMÍNIO")}</text>
    <rect x="${wallX}" y="${wallY}" width="${wallW}" height="${wallH}" fill="#edf0f0" stroke="#aab4b7" stroke-width="2"/>
    <rect x="${wallX}" y="${wallY}" width="${wallW}" height="${wallH}" fill="url(#architectural-brick)" opacity=".55"/>
    <rect x="${wallX + 8}" y="${wallY + 8}" width="${wallW - 16}" height="${wallH - 16}" fill="#eef2f2" stroke="#9eabad" stroke-width="1"/>
    <text x="${wallX + 12}" y="${wallY - 12}" fill="#54666c" font-family="Arial,sans-serif" font-size="12">ALVENARIA · VÃO LUZ</text>
    <ellipse cx="${x + w / 2}" cy="${y + h + 18}" rx="${w * .54}" ry="18" fill="#26353a" opacity=".13" filter="url(#architectural-shadow)"/>
    <rect x="${x - 18}" y="${y - 18}" width="${w + 36}" height="${h + 36}" fill="#707c80" stroke="#455358" stroke-width="2"/>
    <rect x="${x - 12}" y="${y - 12}" width="${w + 24}" height="${h + 24}" fill="url(#architectural-metal)" stroke="#38484e" stroke-width="2"/>
    <text x="${x - 18}" y="${y + h + 57}" fill="#58696e" font-family="Arial,sans-serif" font-size="11">CONTRAMARCO</text>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#architectural-metal)" stroke="#26373d" stroke-width="2"/>
    <rect x="${x + 18}" y="${y + 18}" width="${w - 36}" height="${h - 36}" fill="#66767b" stroke="#27383e" stroke-width="2"/>
    <g>${leaves}</g>
    <rect x="${x + 18}" y="${y + 18}" width="${w - 36}" height="${h - 36}" fill="none" stroke="#293a40" stroke-width="3"/>
    <path d="${miters}" fill="none" stroke="#192a30" stroke-width="2.5"/>
    <path d="M ${x + 5} ${y + h + 10} H ${x + w - 5}" fill="none" stroke="#2f4147" stroke-width="5"/>
    ${hardware}
    <text x="${x + w - 18}" y="${y + h * .52 - 22}" text-anchor="end" fill="#45585f" font-family="Arial,sans-serif" font-size="10">${cutLabel}</text>
    <line x1="${x}" y1="${y - 55}" x2="${x + w}" y2="${y - 55}" stroke="#45585f" stroke-width="1.4" marker-start="url(#architectural-dim)" marker-end="url(#architectural-dim)"/>
    <line x1="${x}" y1="${y - 45}" x2="${x}" y2="${y - 18}" stroke="#65767b" stroke-width="1"/>
    <line x1="${x + w}" y1="${y - 45}" x2="${x + w}" y2="${y - 18}" stroke="#65767b" stroke-width="1"/>
    <text x="${x + w / 2}" y="${y - 63}" text-anchor="middle" fill="#273a40" font-family="Arial,sans-serif" font-size="14" font-weight="700">LARGURA TOTAL · ${Math.round(spec.width)} mm</text>
    <line x1="${x - 50}" y1="${y}" x2="${x - 50}" y2="${y + h}" stroke="#45585f" stroke-width="1.4" marker-start="url(#architectural-dim)" marker-end="url(#architectural-dim)"/>
    <text x="${x - 63}" y="${y + h / 2}" transform="rotate(-90 ${x - 63} ${y + h / 2})" text-anchor="middle" fill="#273a40" font-family="Arial,sans-serif" font-size="14" font-weight="700">ALTURA TOTAL · ${Math.round(spec.height)} mm</text>
    ${handles ? `<line x1="${x + w + 40}" y1="${y + h * .52}" x2="${x + w + 40}" y2="${y + h - 18}" stroke="#75858a" stroke-width="1" marker-start="url(#architectural-dim)" marker-end="url(#architectural-dim)"/><text x="${x + w + 52}" y="${y + h * .68}" fill="#45585f" font-family="Arial,sans-serif" font-size="11">FECHO · 1050 mm</text>` : ""}
    <rect x="80" y="744" width="1040" height="72" rx="3" fill="#e8edef" stroke="#9eabad" stroke-width="1.5"/>
    <path d="M 80 766H1120M 710 744V816M 880 744V816" stroke="#aab5b8" stroke-width="1"/>
    <text x="98" y="761" fill="#273a40" font-family="Arial,sans-serif" font-size="12" font-weight="700">ESQUADRIA · ${escapeXml(spec.type.replaceAll("_", " ").toUpperCase())}</text>
    <text x="98" y="792" fill="#40545a" font-family="Arial,sans-serif" font-size="12">Linha: ${escapeXml(spec.line)} · Perfil: ${escapeXml(spec.frameColor)} · Vidro: ${escapeXml(spec.glassType)} ${Math.max(4, Number((drawing as TechnicalDrawing).parametricSpec?.espessura_mm || 8))} mm</text>
    <text x="730" y="761" fill="#273a40" font-family="Arial,sans-serif" font-size="11" font-weight="700">ESCALA VISUAL</text>
    <text x="730" y="792" fill="#40545a" font-family="Arial,sans-serif" font-size="12">Cotas nominais em mm · conferir vão</text>
    <text x="900" y="761" fill="#273a40" font-family="Arial,sans-serif" font-size="11" font-weight="700">ENGENHARIA</text>
    <text x="900" y="792" fill="#40545a" font-family="Arial,sans-serif" font-size="12">Projeto preliminar · validar fabricante</text>
  </svg>`;
}

export function buildArchitecturalIsometricSvg(drawing: DrawingInput): string {
  const spec = resolveAluminumSpec(drawing);
  const x = 268, y = 156, w = 470;
  const h = clamp(w * spec.height / spec.width, 275, 355);
  const depthOffset = 22 + (spec.depth - 30) / 70 * 54;
  const dx = depthOffset, dy = -depthOffset * .56;
  const frame = spec.frameColor, glass = spec.glassColor;
  const inset = 24, innerW = w - inset * 2, innerH = h - inset * 2;
  const leafCount = spec.leaves;
  const sashWidth = innerW / leafCount;
  const rearSashes = Array.from({ length: leafCount }, (_, index) => {
    const px = x + inset + index * sashWidth + dx * .46;
    const py = y + inset + dy * .46;
    return `<g>
      <rect x="${px + 4}" y="${py + 4}" width="${sashWidth - 8}" height="${innerH - 8}" fill="url(#iso-glass-back)" stroke="#afc7ca" stroke-width="3"/>
      <path d="M ${px + 9} ${py + innerH - 18} L ${px + sashWidth * .65} ${py + 15}" stroke="#fff" stroke-width="3" opacity=".46"/>
      <rect x="${px}" y="${py}" width="10" height="${innerH}" fill="url(#iso-metal)" stroke="#35454a" stroke-width="2"/>
      <rect x="${px + sashWidth - 10}" y="${py}" width="10" height="${innerH}" fill="url(#iso-metal)" stroke="#35454a" stroke-width="2"/>
      <rect x="${px}" y="${py}" width="${sashWidth}" height="10" fill="url(#iso-metal)" stroke="#35454a" stroke-width="2"/>
      <rect x="${px}" y="${py + innerH - 10}" width="${sashWidth}" height="10" fill="url(#iso-metal)" stroke="#35454a" stroke-width="2"/>
      ${spec.type === "janela_correr" ? `<rect x="${px}" y="${py + innerH / 2 - 5}" width="${sashWidth}" height="10" fill="url(#iso-metal)" stroke="#35454a" stroke-width="2"/>` : ""}
    </g>`;
  }).join("");
  const frontSashes = Array.from({ length: Math.min(leafCount, 4) }, (_, index) => {
    const isSliding = spec.type.includes("correr") || spec.type === "box_banheiro";
    const travel = isSliding ? sashWidth * 0.12 : 0;
    const slideX = index % 2 === 0 ? -travel : travel;
    const px = x + inset + index * sashWidth + slideX;
    const py = y + inset;
    const width = Math.max(20, sashWidth - 6);
    return `<g>
      <rect x="${px + 5}" y="${py + 5}" width="${width - 10}" height="${innerH - 10}" fill="url(#iso-glass-front)" stroke="#d4e5e7" stroke-width="2"/>
      <path d="M ${px + 12} ${py + innerH - 22} L ${px + width * .7} ${py + 12}" stroke="#fff" stroke-width="4" opacity=".56"/>
      <rect x="${px}" y="${py}" width="13" height="${innerH}" fill="url(#iso-metal)" stroke="#2d3e44" stroke-width="2"/>
      <rect x="${px + width - 13}" y="${py}" width="13" height="${innerH}" fill="url(#iso-metal)" stroke="#2d3e44" stroke-width="2"/>
      <rect x="${px}" y="${py}" width="${width}" height="13" fill="url(#iso-metal)" stroke="#2d3e44" stroke-width="2"/>
      <rect x="${px}" y="${py + innerH - 13}" width="${width}" height="13" fill="url(#iso-metal)" stroke="#2d3e44" stroke-width="2"/>
      ${spec.type === "janela_correr" ? `<rect x="${px}" y="${py + innerH / 2 - 6}" width="${width}" height="12" fill="url(#iso-metal)" stroke="#2d3e44" stroke-width="2"/>` : ""}
      ${index === 0 && spec.type.includes("correr") ? `<path d="M ${px + width * .76} ${py + innerH * .52 - 13} q 7 0 7 7 v 22 q 0 7 -7 7 h -3 v -36 z" fill="#33464b" stroke="#e1e7e8" stroke-width="2"/>` : ""}
    </g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="780" viewBox="0 0 1200 780" role="img" aria-label="Perspectiva isométrica arquitetônica da esquadria">
    <defs>
      <linearGradient id="iso-metal" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f5f7f7"/><stop offset=".2" stop-color="${frame}"/><stop offset=".42" stop-color="#e6ebec"/><stop offset=".63" stop-color="${frame}"/><stop offset=".82" stop-color="#f8f9f9"/><stop offset="1" stop-color="#526168"/></linearGradient>
      <linearGradient id="iso-glass-back" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${glass}" stop-opacity=".38"/><stop offset="1" stop-color="#355a60" stop-opacity=".72"/></linearGradient>
      <linearGradient id="iso-glass-front" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#dafafa" stop-opacity=".72"/><stop offset=".52" stop-color="${glass}" stop-opacity=".36"/><stop offset="1" stop-color="#4f858b" stop-opacity=".72"/></linearGradient>
      <filter id="iso-shadow" x="-.3" y="-.3" width="1.6" height="1.7"><feGaussianBlur stdDeviation="13"/></filter>
      <marker id="iso-dim" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#45585f"/></marker>
    </defs>
    <rect width="1200" height="780" fill="#f7f9f9"/>
    <text x="600" y="42" text-anchor="middle" fill="#25373d" font-family="Arial,sans-serif" font-size="21" font-weight="700">PERSPECTIVA ISOMÉTRICA · ${escapeXml(drawing.title || "ESQUADRIA")}</text>
    <path d="M ${x - 60} ${y + h + 80} L ${x + w + dx + 80} ${y + h + dy + 105} L ${x + w + 35} ${y + h + 145} L ${x - 95} ${y + h + 120} Z" fill="#18272d" opacity=".18" filter="url(#iso-shadow)"/>
    <polygon points="${x},${y} ${x + dx},${y + dy} ${x + w + dx},${y + dy} ${x + w},${y}" fill="url(#iso-metal)" stroke="#45565c" stroke-width="3"/>
    <polygon points="${x + w},${y} ${x + w + dx},${y + dy} ${x + w + dx},${y + h + dy} ${x + w},${y + h}" fill="url(#iso-metal)" stroke="#35464c" stroke-width="3"/>
    <polygon points="${x},${y + h} ${x + dx},${y + h + dy} ${x + w + dx},${y + h + dy} ${x + w},${y + h}" fill="#65747a" stroke="#35464c" stroke-width="3"/>
    <rect x="${x + dx}" y="${y + dy}" width="${w}" height="${h}" fill="url(#iso-glass-back)" stroke="#43565c" stroke-width="5"/>
    <g>${rearSashes}</g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#iso-metal)" stroke="#26373d" stroke-width="3"/>
    <rect x="${x + 18}" y="${y + 18}" width="${w - 36}" height="${h - 36}" fill="url(#iso-glass-front)" stroke="#2a3d43" stroke-width="5"/>
    <g>${frontSashes}</g>
    <path d="M ${x + 7} ${y + 7} l 19 19 M ${x + w - 7} ${y + 7} l -19 19 M ${x + 7} ${y + h - 7} l 19 -19 M ${x + w - 7} ${y + h - 7} l -19 -19" fill="none" stroke="#25363c" stroke-width="2.5"/>
    <line x1="${x}" y1="${y - 48}" x2="${x + w}" y2="${y - 48}" stroke="#53666d" stroke-width="1.5" marker-start="url(#iso-dim)" marker-end="url(#iso-dim)"/>
    <text x="${x + w / 2}" y="${y - 58}" text-anchor="middle" fill="#31444a" font-family="Arial,sans-serif" font-size="13" font-weight="700">${Math.round(spec.width)} mm</text>
    <line x1="${x - 40}" y1="${y}" x2="${x - 40}" y2="${y + h}" stroke="#53666d" stroke-width="1.5" marker-start="url(#iso-dim)" marker-end="url(#iso-dim)"/>
    <text x="${x - 51}" y="${y + h / 2}" transform="rotate(-90 ${x - 51} ${y + h / 2})" text-anchor="middle" fill="#31444a" font-family="Arial,sans-serif" font-size="13" font-weight="700">${Math.round(spec.height)} mm</text>
    <line x1="${x + w + 8}" y1="${y - 4}" x2="${x + w + dx + 8}" y2="${y + dy - 4}" stroke="#53666d" stroke-width="1.5" marker-start="url(#iso-dim)" marker-end="url(#iso-dim)"/>
    <text x="${x + w + dx + 18}" y="${y + dy - 8}" fill="#31444a" font-family="Arial,sans-serif" font-size="12" font-weight="700">PERFIL ${Math.round(spec.depth)} mm</text>
    <rect x="76" y="650" width="1048" height="74" rx="3" fill="#e8edef" stroke="#a6b1b4" stroke-width="1.5"/>
    <path d="M 76 675H1124M 700 650V724M 900 650V724" stroke="#aab5b8" stroke-width="1"/>
    <text x="96" y="668" fill="#273a40" font-family="Arial,sans-serif" font-size="12" font-weight="700">LINHA · ${escapeXml(spec.line)}</text>
    <text x="96" y="704" fill="#40545a" font-family="Arial,sans-serif" font-size="12">Acabamento metálico · ${escapeXml(spec.frameColor)} · ${escapeXml(spec.glassType)}</text>
    <text x="720" y="668" fill="#273a40" font-family="Arial,sans-serif" font-size="11" font-weight="700">MÓDULOS</text>
    <text x="720" y="704" fill="#40545a" font-family="Arial,sans-serif" font-size="12">${spec.leaves} folha(s) · trilhos deslocados</text>
    <text x="920" y="668" fill="#273a40" font-family="Arial,sans-serif" font-size="11" font-weight="700">VALIDAÇÃO</text>
    <text x="920" y="704" fill="#40545a" font-family="Arial,sans-serif" font-size="12">Conferir perfis e folgas do fabricante</text>
  </svg>`;
}

export function buildArchitecturalDrawingSheetSvg(drawing: DrawingInput): string {
  const elevation = svgDataUri(buildArchitecturalElevationSvg(drawing));
  const isometric = svgDataUri(buildArchitecturalIsometricSvg(drawing));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1630" viewBox="0 0 1200 1630" role="img" aria-label="Ficha técnica arquitetônica em vistas frontal e isométrica">
    <image href="${elevation}" x="0" y="0" width="1200" height="850"/>
    <image href="${isometric}" x="0" y="850" width="1200" height="780" preserveAspectRatio="xMidYMid meet"/>
  </svg>`;
}

/** Retorna o conteúdo interno de um SVG gerado localmente para renderização vetorial inline. */
export function svgInnerMarkup(svg: string): string {
  const match = svg.match(/^\\s*<svg\\b[^>]*>([\\s\\S]*)<\\/svg>\\s*$/i);
  return match?.[1] ?? svg;
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
