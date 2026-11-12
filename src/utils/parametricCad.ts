import type { TechnicalDrawing, TechnicalPiece } from "../types";

export type AluminumTipologia =
  | "janela_correr"
  | "porta_correr"
  | "porta_giro"
  | "porta_pivotante"
  | "maxim_ar"
  | "basculante"
  | "box_banheiro";

export interface ParametricWindowSpec {
  tipologia: AluminumTipologia;
  linha_aluminio: string;
  cor_perfil: string;
  largura_mm: number;
  altura_mm: number;
  folhas: number;
  modulo_fixo: boolean;
  tipo_vidro: string;
  espessura_mm: number;
  abertura: string;
}

export type CadElement = Record<string, string | number | boolean | Array<{ x: number; y: number }>>;

const frameFill = "#64748b";
const frameStroke = "#e2e8f0";
const glassFill = "#38bdf8";
const glassStroke = "#bae6fd";

export function isAluminumPrompt(prompt: string): boolean {
  return /janela|ventana|porta|puerta|esquadria|box de banheiro|box para banheiro|maxim.?ar|basculante|pivotante/i.test(prompt);
}

export function localParametricSpec(prompt: string): ParametricWindowSpec {
  const text = prompt.toLowerCase();
  const match = prompt.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  const toMm = (value: string | undefined, unit: string | undefined, fallback: number) => {
    const number = value ? Number(value.replace(",", ".")) : fallback;
    return Math.max(0, Math.round(number * (unit?.toLowerCase() === "m" ? 1000 : unit?.toLowerCase() === "cm" || (!unit && number > 0 && number < 100) ? 10 : 1)));
  };
  const tipologia: AluminumTipologia = /box/.test(text) ? "box_banheiro"
    : /maxim.?ar/.test(text) ? "maxim_ar"
    : /basculante/.test(text) ? "basculante"
    : /pivot/.test(text) ? "porta_pivotante"
    : /porta/.test(text) && /giro|abrir|dobradi[cç]a/.test(text) ? "porta_giro"
    : /porta/.test(text) ? "porta_correr"
    : "janela_correr";
  const requestedLeaves = Number(text.match(/([234])\s*(?:folhas|folha|pain[eé]is|portas)/)?.[1] || 2);
  const leaves = tipologia === "porta_correr" ? (requestedLeaves === 4 ? 4 : 2)
    : tipologia === "janela_correr" ? [2, 3, 4].includes(requestedLeaves) ? requestedLeaves : 2 : 1;
  const widthMatch = prompt.match(/largura\s*(?:de|:|=)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  const heightMatch = prompt.match(/altura\s*(?:de|:|=)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  const width = toMm(widthMatch?.[1] || match?.[1], widthMatch?.[2] || match?.[2], 0);
  const height = toMm(heightMatch?.[1] || match?.[3], heightMatch?.[2] || match?.[4], 0);
  return {
    tipologia,
    linha_aluminio: (prompt.match(/linha\s+([a-z0-9 -]+)/i)?.[1] || "Linha a definir").trim(),
    cor_perfil: /preto/.test(text) ? "#1f2937" : /branco/.test(text) ? "#f8fafc" : "#94a3b8",
    largura_mm: width,
    altura_mm: height,
    folhas: leaves,
    modulo_fixo: /fix[oa]|m[oó]dulo fixo/.test(text),
    tipo_vidro: /laminado/.test(text) ? "laminado" : /temperado/.test(text) ? "temperado" : "a definir",
    espessura_mm: Number(text.match(/(\d+(?:[.,]\d+)?)\s*mm\s*(?:de\s*)?(?:vidro|espessura)/)?.[1]?.replace(",", ".")) || 8,
    abertura: /esquerda/.test(text) ? "esquerda" : /direita/.test(text) ? "direita" : tipologia === "maxim_ar" ? "projetante" : tipologia === "basculante" ? "basculante" : "central",
  };
}

function rect(elements: CadElement[], x: number, y: number, width: number, height: number, fill: string, label: string, stroke = frameStroke) {
  elements.push({ type: "rect", x, y, width, height, fill, stroke, strokeWidth: 3, label });
}
function line(elements: CadElement[], x1: number, y1: number, x2: number, y2: number, label = "", dashed = false, stroke = frameStroke, strokeWidth = 3) {
  elements.push({ type: "line", x1, y1, x2, y2, stroke, strokeWidth, label, ...(dashed ? { strokeDasharray: "8 7" } : {}) });
}
function text(elements: CadElement[], x: number, y: number, value: string, fill = "#f8fafc", fontSize = 17, fontWeight = "700") {
  elements.push({ type: "text", x, y, text: value, fill, fontSize, fontWeight });
}

function buildElevation(spec: ParametricWindowSpec): CadElement[] {
  const elements: CadElement[] = [];
  const { tipologia, largura_mm: width, altura_mm: height, folhas, modulo_fixo: fixed, cor_perfil: color } = spec;
  const x = 120, y = 130, w = 760, h = 620;
  const framePx = Math.max(15, Math.min(34, 30 * Math.min(width / height, 1.5)));
  const frame = color === "#f8fafc" || /branc/i.test(color) ? "#cbd5e1"
    : color === "#1f2937" || /pret/i.test(color) ? "#334155"
    : /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#94a3b8";
  const isSliding = tipologia === "janela_correr" || tipologia === "porta_correr" || tipologia === "box_banheiro";

  if (tipologia === "porta_giro" || tipologia === "porta_pivotante") {
    rect(elements, x, y, w, h, "none", "Marco superior/laterais", frame);
    rect(elements, x + framePx, y + framePx, w - framePx * 2, h - framePx, "#0f172a", "Vão da porta", frame);
    line(elements, x + framePx * 1.5, y + framePx * 1.5, x + w - framePx * 1.5, y + h - framePx * 1.5, "Folha aberta", true, glassStroke, 2);
    line(elements, x + w - framePx * 1.5, y + framePx * 1.5, x + framePx * 1.5, y + h - framePx * 1.5, "", true, glassStroke, 2);
    if (tipologia === "porta_pivotante") {
      const pivotX = spec.abertura === "esquerda" ? x + 150 / width * w : x + w - 150 / width * w;
      line(elements, pivotX, y + framePx, pivotX, y + h - framePx, "Eixo pivotante · 150 mm", false, "#fbbf24", 3);
      elements.push({ type: "circle", cx: pivotX, cy: y + h / 2, r: 9, fill: "#fbbf24", stroke: "#fff" });
    } else {
      elements.push({ type: "circle", cx: spec.abertura === "esquerda" ? x + framePx * 1.5 : x + w - framePx * 1.5, cy: y + h / 2, r: 8, fill: "#fbbf24", stroke: "#fff" });
    }
    text(elements, x + w / 2, y + h + 62, `${width} mm · PASSAGEM`, "#fde68a", 16);
  } else if (tipologia === "maxim_ar" || tipologia === "basculante") {
    rect(elements, x, y, w, h, frame, "Marco perimetral", frameStroke);
    rect(elements, x + framePx, y + framePx, w - framePx * 2, h - framePx * 2, "#0f172a", "Vão", frame);
    line(elements, x + framePx, y + h - framePx, x + w - framePx, y + framePx, "Folha projetante", false, glassStroke, 5);
    line(elements, x + framePx, y + h - framePx, x + w / 2, y + h / 2, "", true, "#fbbf24", 3);
    line(elements, x + w / 2, y + h / 2, x + w - framePx, y + framePx, "Projeção exterior", true, "#fbbf24", 3);
    line(elements, x + framePx * 2, y + h * 0.6, x + framePx * 2.7, y + h * 0.45, "Braço articulado", false, "#fbbf24", 5);
    line(elements, x + framePx * 2.7, y + h * 0.45, x + framePx * 3.5, y + h * 0.58, "", false, "#fbbf24", 5);
  } else if (tipologia === "box_banheiro") {
    rect(elements, x, y, w, h, frame, "Guias do box", frameStroke);
    rect(elements, x + framePx, y + framePx, w / 2 - framePx, h - framePx * 2, glassFill, "Vidro fixo", glassStroke);
    rect(elements, x + w / 2, y + framePx, w / 2 - framePx, h - framePx * 2, "#0f172a", "Porta corrediza", frame);
    line(elements, x + w / 2, y + framePx, x + w / 2, y + h - framePx, "", false, glassStroke, 4);
    for (const rollerX of [x + w * 0.62, x + w * 0.84]) elements.push({ type: "circle", cx: rollerX, cy: y + framePx + 10, r: 9, fill: "#e2e8f0", stroke: "#64748b" });
    elements.push({ type: "circle", cx: x + w * 0.72, cy: y + h / 2, r: 12, fill: "#fbbf24", stroke: "#fff" });
    line(elements, x + framePx, y + h - framePx, x + w - framePx, y + h - framePx, "Guia inferior", false, "#fbbf24", 5);
  } else {
    rect(elements, x, y, w, h, frame, "Marco perimetral", frameStroke);
    const insideX = x + framePx, insideY = y + framePx, insideW = w - framePx * 2, insideH = h - framePx * 2;
    const sashWidth = insideW / folhas;
    for (let index = 0; index < folhas; index++) {
      const sashX = insideX + index * sashWidth;
      const sashFrame = Math.max(8, framePx * 0.55);
      rect(elements, sashX + 3, insideY + 3, sashWidth - 6, insideH - 6, glassFill, `Folha ${index + 1}`, glassStroke);
      rect(elements, sashX + sashWidth / 2 - sashFrame / 2, insideY + 3, sashFrame, insideH - 6, frame, "Montante da folha", frame);
      if (fixed && index === 0) {
        line(elements, sashX + 18, insideY + 20, sashX + sashWidth - 18, insideY + insideH - 20, "Módulo fixo", false, "#e0f2fe", 3);
        line(elements, sashX + sashWidth - 18, insideY + 20, sashX + 18, insideY + insideH - 20, "", false, "#e0f2fe", 3);
      } else {
        const direction = index % 2 === 0 ? "→" : "←";
        text(elements, sashX + sashWidth / 2 - 9, insideY + insideH / 2, direction, "#fbbf24", 32);
      }
    }
    const overlapX = x + w / 2;
    line(elements, overlapX, insideY, overlapX, insideY + insideH, "Traslape central", false, "#f8fafc", Math.max(4, framePx * 0.28));
    if (tipologia === "porta_correr") rect(elements, x, y + h - framePx * 1.6, w, framePx * 1.6, frame, "Zócalo reforçado", frameStroke);
    const handleY = tipologia === "porta_correr" ? y + h - 1050 / height * h : y + h / 2;
    elements.push({ type: "rect", x: overlapX - 4, y: handleY - 24, width: 8, height: 48, fill: "#fbbf24", stroke: "#fff", strokeWidth: 2, label: tipologia === "porta_correr" ? "Fecho a 1050 mm" : "Fecho central" });
    if (tipologia === "porta_correr") text(elements, x + w / 2, y + h + 62, `${width} mm · VÃO DE PASSAGEM`, "#fde68a", 16);
    const leafWidth = Math.round(width / folhas);
    text(elements, x + w / 2, y - 42, `${width} mm · ${leafWidth} mm / folha`, "#fde68a", 17);
  }

  if (isSliding && tipologia !== "box_banheiro") {
    text(elements, x + w / 2, y + h + 88, `ALTURA TOTAL: ${height} mm`, "#fde68a", 16);
  } else {
    text(elements, x + w / 2, y + h + 88, `${width} × ${height} mm`, "#fde68a", 16);
  }
  line(elements, x, y - 15, x + w, y - 15, `${width} mm`, false, "#fbbf24", 2);
  line(elements, x - 25, y, x - 25, y + h, `${height} mm`, false, "#fbbf24", 2);
  text(elements, x + 5, y - 62, `${tipologia.replaceAll("_", " ").toUpperCase()} · ${spec.linha_aluminio}`, "#93c5fd", 15);
  text(elements, x + 5, y + h + 116, `${spec.tipo_vidro} · ${spec.espessura_mm} mm · perfil ${spec.cor_perfil}`, "#cbd5e1", 13);
  return elements;
}

export function buildParametricDrawing(spec: ParametricWindowSpec, prompt: string, catalog: any[] = []): TechnicalDrawing {
  const width = spec.largura_mm, height = spec.altura_mm, frameDepth = 60;
  const isDoor = spec.tipologia.startsWith("porta");
  const isBox = spec.tipologia === "box_banheiro";
  const pieceRows: Array<{ name: string; quantity: number; lengthMm: number; sectionMm: number }> = [
    { name: "Marco · montantes laterais", quantity: 2, lengthMm: height, sectionMm: 40 },
    { name: "Marco · travessas superior/inferior", quantity: 2, lengthMm: width, sectionMm: 40 },
  ];
  if (spec.tipologia === "janela_correr" || spec.tipologia === "porta_correr") {
    pieceRows.push({ name: "Folha corrediza · perfis verticais", quantity: spec.folhas * 2, lengthMm: Math.max(1, height - 80), sectionMm: 35 });
    pieceRows.push({ name: "Folha corrediza · perfis horizontais", quantity: spec.folhas * 2, lengthMm: Math.max(1, width / spec.folhas - 50), sectionMm: 35 });
  } else if (isBox) {
    pieceRows.push({ name: "Porta de correr · perfis", quantity: 4, lengthMm: Math.max(1, height - 60), sectionMm: 25 });
    pieceRows.push({ name: "Painel fixo de vidro", quantity: 1, lengthMm: height, sectionMm: Math.round(width / 2) });
  } else {
    pieceRows.push({ name: "Folha / painel", quantity: 1, lengthMm: height, sectionMm: Math.max(1, width - 80) });
  }
  const profileColor = /^#[0-9a-f]{3,8}$/i.test(spec.cor_perfil) ? spec.cor_perfil : /branc/i.test(spec.cor_perfil) ? "#cbd5e1" : /pret/i.test(spec.cor_perfil) ? "#334155" : "#94a3b8";
  const pieces: TechnicalPiece[] = pieceRows.map((row, index) => ({
    id: `p${index + 1}`,
    pieceNumber: index + 1,
    name: row.name,
    quantity: row.quantity,
    dimensions: { width: row.lengthMm, height: row.sectionMm, depth: frameDepth, thickness: frameDepth, unit: "mm" },
    material: /vidro/.test(row.name) ? `${spec.tipo_vidro} ${spec.espessura_mm} mm` : `${spec.linha_aluminio} · ${spec.cor_perfil}`,
    color: profileColor,
    cutAngle: "90° · confirmar tabela do fabricante",
    notes: "Dimensão nominal gerada por template paramétrico. Validar folgas e corte conforme a linha de alumínio selecionada.",
  }));
  const budgetItems = pieces.map((piece) => {
    const catalogItem = catalog.find((row) => {
      const sourceName = String(row.name || row.description || "").toLowerCase();
      return sourceName && (sourceName.includes(piece.name.toLowerCase().split(" · ")[0]) || piece.material.toLowerCase().includes(String(row.code || row.sku || "").toLowerCase()));
    });
    const unitPrice = Number(catalogItem?.price || 0);
    return {
      id: `budget-${piece.id}`,
      pieceId: piece.id,
      catalogItemId: catalogItem?.id || "",
      sku: catalogItem?.code || catalogItem?.sku || "",
      description: piece.name,
      quantity: piece.quantity,
      unitPrice,
      subtotal: Number((piece.quantity * unitPrice).toFixed(2)),
      cutLengthMm: piece.dimensions.width,
      imageUrl: catalogItem?.thumbnailDataUrl || catalogItem?.imageUrl || "",
      priceSource: catalogItem ? "catalog" : "pending",
    };
  });
  const subtotal = Number(budgetItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const steps = [
    ["Conferência de vão", "Medir o vão acabado no local e confirmar largura/altura em milímetros."],
    ["Seleção de linha", `Validar linha ${spec.linha_aluminio}, cor, perfis, ferragens e vidro.`],
    ["Plano de corte", "Aplicar as fórmulas e folgas oficiais do fabricante antes de cortar."],
    ["Montagem", "Montar marco e folhas, conferir esquadro, alinhamento e funcionamento."],
    ["Inspeção final", "Conferir cotas, vedação, ferragens e segurança antes da liberação."],
  ].map(([title, description], index) => ({ stepNumber: index + 1, title, description, phaseName: `Etapa ${index + 1}`, instructions: [description] }));
  return {
    id: `cad_${Date.now()}`,
    title: spec.tipologia.replaceAll("_", " "),
    description: prompt,
    category: isDoor || isBox ? "glass_door" : "aluminum_window",
    unit: "mm",
    overallDimensions: { width, height, depth: frameDepth },
    pieces,
    isDraft: true,
    status: "PRELIMINARY_CONTINGENCY",
    draftStatus: "preliminary",
    draftLabel: "DESENHO PARAMÉTRICO PRELIMINAR — VALIDAR FÓRMULAS DO FABRICANTE",
    parametricSpec: spec,
    visualElements: buildElevation(spec),
    dimensionLines: [
      { id: "width", label: `LARGURA TOTAL: ${width} mm`, value: width, unit: "mm", orientation: "horizontal", start: { x: 120, y: 100 }, end: { x: 880, y: 100 } },
      { id: "height", label: `ALTURA TOTAL: ${height} mm`, value: height, unit: "mm", orientation: "vertical", start: { x: 95, y: 130 }, end: { x: 95, y: 750 } },
      ...(spec.tipologia === "janela_correr" ? [{ id: "leaf-width", label: `LARGURA POR FOLHA: ${Math.round(width / spec.folhas)} mm`, value: Math.round(width / spec.folhas), unit: "mm", orientation: "horizontal" as const, start: { x: 120, y: 110 }, end: { x: 120 + 760 / spec.folhas, y: 110 } }] : []),
    ],
    assemblyInstructions: steps.map((step) => step.description),
    steps,
    currentStep: 1,
    cuttingPlan: pieces.map((piece) => ({ pieceNumber: piece.pieceNumber, name: piece.name, material: piece.material, quantity: piece.quantity, length: piece.dimensions.width, width: piece.dimensions.height, unit: "mm", cutAngle: piece.cutAngle, notes: piece.notes })),
    budget: { currency: "BRL", items: budgetItems, subtotal, labor: 0, marginRate: 0, taxRate: 0, freight: 0, total: subtotal },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as TechnicalDrawing;
}
