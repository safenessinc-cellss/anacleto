import type { TechnicalDrawing } from "../types";

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
  cor_vidro?: string;
  largura_mm: number;
  altura_mm: number;
  folhas: number;
  modulo_fixo: boolean;
  tipo_vidro: string;
  espessura_mm: number;
  abertura: string;
  pendencias?: string[];
}

export type CadElement = Record<string, string | number | boolean | Array<{ x: number; y: number }>>;

const frameFill = "#64748b";
const frameStroke = "#e2e8f0";
const glassFill = "#38bdf8";
const glassStroke = "#bae6fd";

export function isAluminumPrompt(prompt: string): boolean {
  return /janela|ventana|porta|puerta|esquadria|\bbox\b|maxim[\s-]?ar|basculante|pivotante/i.test(prompt);
}

export function localParametricSpec(prompt: string): ParametricWindowSpec {
  const text = prompt.toLowerCase();
  const match = prompt.match(/(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m)?\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m)?/i);
  const toMm = (value: string | undefined, unit: string | undefined) => {
    if (!value || !unit) return 0;
    const number = Number(value.replace(",", "."));
    const normalizedUnit = unit.toLowerCase();
    const factor = normalizedUnit === "m" ? 1000 : normalizedUnit === "cm" ? 10 : 1;
    return Number.isFinite(number) && number > 0 ? Math.round(number * factor) : 0;
  };
  const tipologia: AluminumTipologia = /box/.test(text) ? "box_banheiro"
    : /maxim[\\s-]?ar/.test(text) ? "maxim_ar"
    : /basculante/.test(text) ? "basculante"
    : /pivot/.test(text) ? "porta_pivotante"
    : /porta/.test(text) && /giro|abrir|dobradi[cç]a/.test(text) ? "porta_giro"
    : /porta/.test(text) ? "porta_correr"
    : "janela_correr";
  const requestedLeaves = Number(text.match(/(\\d{1,2})\\s*(?:folhas?|pain[eé]is)/)?.[1] || 0);
  const leaves = requestedLeaves > 0 ? Math.min(8, requestedLeaves) : 0;
  const widthMatch = prompt.match(/largura\\s*(?:de|:|=)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m)/i);
  const heightMatch = prompt.match(/altura\\s*(?:de|:|=)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m)/i);
  // Unlabelled dimensions follow the requested convention: ALTURA × LARGURA.
  const sharedUnit = match?.[4] || match?.[2];
  const height = toMm(heightMatch?.[1] || match?.[1], heightMatch?.[2] || sharedUnit);
  const width = toMm(widthMatch?.[1] || match?.[3], widthMatch?.[2] || sharedUnit);
  const namedLine = prompt.match(/\\blinha\\s+(suprema|gold|\\d+)\\b/i)?.[1] || prompt.match(/\\b(suprema|gold)\\b/i)?.[1];
  const glassType = text.match(/\\b(duplo|laminado|temperado|insulado|comum|float)\\b/)?.[1];
  const thickness = text.match(/(?:vidro\\s+(?:(?:duplo|laminado|temperado|insulado|comum|float)\\s+)?(?:de\\s*)?|espessura\\s*(?:de\\s*)?)(\\d+(?:[.,]\\d+)?)\\s*mm/)?.[1]
    || text.match(/(\\d+(?:[.,]\\d+)?)\\s*mm\\s*(?:de\\s*)?(?:vidro|espessura)\\b/)?.[1];
  const fixedModule = /m[oó]dulo fixo|fix[oa]/.test(text) && !/sem\\s+(?:m[oó]dulo fixo|fix[oa])/.test(text);
  const pendencias: string[] = [];
  if (!(width > 0) || !(height > 0)) pendencias.push("Informar largura e altura com unidade explícita (mm, cm ou m), confirmando a ordem altura × largura.");
  if (!(leaves > 0)) pendencias.push("Confirmar a quantidade de folhas/painéis.");
  if (!namedLine) pendencias.push("Definir fabricante e linha do perfil.");
  if (!/(bronze|natural|prata|anodiz|preto|branco)/.test(text)) pendencias.push("Definir acabamento/cor do perfil.");
  if (/(janela|porta)/.test(text) && !/(correr|corredi[cç]a|deslizante|giro|abrir|dobradi[cç]a|pivotante)/.test(text)) pendencias.push("Confirmar o sistema de abertura da esquadria.");
  if (!glassType) pendencias.push("Definir o tipo de vidro.");
  if (!thickness) pendencias.push("Confirmar a espessura do vidro.");
  if (!/esquerda|direita/.test(text)) pendencias.push("Confirmar o sentido de abertura.");
  if (!/fix[oa]|m[oó]dulo fixo|sem m[oó]dulo fixo/.test(text)) pendencias.push("Confirmar se existe módulo fixo.");
  return {
    tipologia,
    linha_aluminio: namedLine ? `Linha ${namedLine.replace(/\\b\\w/g, (letter) => letter.toUpperCase())}` : "Linha a definir",
    cor_perfil: /bronze/.test(text) ? "#80552f"
      : /anodiz|natural|prata/.test(text) ? "#9da8ae"
      : /preto/.test(text) ? "#1f2937"
      : /branco/.test(text) ? "#f8fafc"
      : "a definir",
    cor_vidro: text.match(/\\b(incolor|bronze|verde|fum[eê]|cinza)\\b/i)?.[1]?.toLowerCase() || "a definir",
    largura_mm: width,
    altura_mm: height,
    folhas: leaves,
    modulo_fixo: fixedModule,
    tipo_vidro: glassType ? glassType.toLowerCase() : "a definir",
    espessura_mm: Number(thickness?.replace(",", ".")) || 0,
    abertura: /esquerda/.test(text) ? "esquerda" : /direita/.test(text) ? "direita" : "a definir",
    pendencias,
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
  if (!(spec.largura_mm > 0) || !(spec.altura_mm > 0) || !(spec.folhas > 0)) {
    text(elements, 500, 430, "Geometria pendente — informe altura, largura e folhas", "#fbbf24", 22);
    return elements;
  }
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
  text(elements, x + 5, y + h + 116, `${spec.tipo_vidro} ${spec.cor_vidro} · ${spec.espessura_mm} mm · perfil ${spec.cor_perfil}`, "#cbd5e1", 13);
  return elements;
}

export function buildParametricDrawing(spec: ParametricWindowSpec, prompt: string, _catalog: any[] = []): TechnicalDrawing {
  const width = Number.isFinite(spec.largura_mm) && spec.largura_mm > 0 ? spec.largura_mm : 0;
  const height = Number.isFinite(spec.altura_mm) && spec.altura_mm > 0 ? spec.altura_mm : 0;
  const dimensionsKnown = width > 0 && height > 0 && spec.folhas > 0;
  const isDoor = spec.tipologia.startsWith("porta");
  const isBox = spec.tipologia === "box_banheiro";
  const assumptions = [
    ...(spec.pendencias || []),
    "O desenho é conceitual e preliminar. Não há despiece, seção de perfil, folga, ferragem ou plano de corte validado por tabela oficial do fabricante.",
    "O orçamento executivo depende de catálogo verificado, regras de corte aprovadas e medição/avaliação técnica.",
  ];
  const steps = [
    ["Levantamento do vão", "Medir altura e largura no local, com unidade e pontos de conferência."],
    ["Definição do sistema", "Confirmar fabricante, linha, acabamento, folhas, abertura e módulo fixo."],
    ["Especificação do vidro", "Confirmar tipo, espessura, cor e requisitos de segurança."],
    ["Despiece executivo", "Gerar perfis, folgas, ferragens e cortes somente com tabela oficial validada."],
    ["Liberação de fabricação", "Revisar e aprovar o desenho executivo antes de comprar ou cortar materiais."],
  ].map(([title, description], index) => ({
    stepNumber: index + 1,
    title,
    description,
    phaseName: `Etapa ${index + 1}`,
    instructions: [description],
  }));
  const dimensionLines = [
    {
      id: "height",
      label: height > 0 ? `ALTURA: ${height} mm` : "ALTURA PENDENTE",
      value: height,
      unit: "mm",
      orientation: "vertical",
      start: { x: 95, y: 130 },
      end: { x: 95, y: 750 },
    },
    {
      id: "width",
      label: width > 0 ? `LARGURA: ${width} mm` : "LARGURA PENDENTE",
      value: width,
      unit: "mm",
      orientation: "horizontal",
      start: { x: 120, y: 100 },
      end: { x: 880, y: 100 },
    },
  ];
  return {
    id: `cad_${Date.now()}`,
    title: spec.tipologia.replaceAll("_", " "),
    description: prompt,
    category: isDoor || isBox ? "glass_door" : "aluminum_window",
    unit: "mm",
    overallDimensions: { width, height },
    pieces: [],
    isDraft: true,
    status: "PRELIMINARY_CONTINGENCY",
    draftStatus: "preliminary",
    draftLabel: dimensionsKnown
      ? "DESENHO CONCEITUAL PRELIMINAR — SEM LISTA DE CORTE — NÃO LIBERADO PARA FABRICAÇÃO"
      : "RASCUNHO PRELIMINAR — MEDIDAS/CONFIGURAÇÃO PENDENTES — NÃO FABRICAR",
    parametricSpec: spec,
    vidro: spec.cor_vidro || "a definir",
    visualElements: buildElevation(spec),
    assumptions,
    dimensionLines,
    assemblyInstructions: steps.map((step) => step.description),
    steps,
    currentStep: 1,
    cuttingPlan: [],
    budget: {
      currency: "BRL",
      items: [],
      subtotal: 0,
      labor: 0,
      marginRate: 0,
      taxRate: 0,
      freight: 0,
      total: 0,
      notes: "Sem despiece e regras de corte verificadas, nenhum custo de material foi calculado. Informe os dados pendentes e valide a tabela do fabricante.",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as TechnicalDrawing;
}
