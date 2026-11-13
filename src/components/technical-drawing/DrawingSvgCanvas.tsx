import React, { useMemo, useRef, useState } from "react";
import { TechnicalDrawing } from "../../types";
import { ZoomIn, ZoomOut, RotateCcw, Eye, Layers } from "lucide-react";
import { fitDrawingToViewport } from "../../utils/drawingViewport";
import { buildArchitecturalElevationSvg, svgDataUri } from "../../utils/architecturalSvg";

interface DrawingSvgCanvasProps {
  drawing: TechnicalDrawing;
  currentStep: number;
  showDimensions?: boolean;
  showLabels?: boolean;
}

const fmt = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(2)).toString() : "—");
const safe = (value: number | undefined, fallback = 1) =>
  Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;

function getAluminumPalette(rawColor?: string) {
  const c = String(rawColor || "").toLowerCase();
  if (/preto|black|negro/.test(c)) {
    return { frame: "#1e293b", stroke: "#475569", bevel: "#334155", sideTop: "#0f172a", sideRight: "#020617" };
  }
  if (/bronze|marrom|corten/.test(c)) {
    return { frame: "#5c4033", stroke: "#8d6e63", bevel: "#795548", sideTop: "#4e342e", sideRight: "#3e2723" };
  }
  if (/anodiz|fosco|natural|inox|cinza/.test(c)) {
    return { frame: "#94a3b8", stroke: "#cbd5e1", bevel: "#e2e8f0", sideTop: "#64748b", sideRight: "#475569" };
  }
  // Branco por defecto
  return { frame: "#f1f5f9", stroke: "#cbd5e1", bevel: "#ffffff", sideTop: "#cbd5e1", sideRight: "#94a3b8" };
}

export default function DrawingSvgCanvas({
  drawing,
  currentStep,
  showDimensions = true,
  showLabels = true,
}: DrawingSvgCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dimensionsVisible, setDimensionsVisible] = useState(showDimensions);
  const [labelsVisible, setLabelsVisible] = useState(showLabels);

  const W = safe(drawing.overallDimensions?.width, 1500);
  const H = safe(drawing.overallDimensions?.height, 1200);
  const D = safe(drawing.overallDimensions?.depth, 60);
  const unit = drawing.unit || "mm";
  const pieces = (drawing.pieces || []).filter(Boolean);
  const category = drawing.category || "aluminum_window";

  const descriptorText = `${drawing.title || ""} ${drawing.description || ""} ${drawing.tipologia || ""}`;
  const isArchitecturalDrawing = Boolean(
    drawing.parametricSpec ||
      category === "aluminum_window" ||
      category === "glass_door" ||
      /janela|porta|esquadria|box|maxim.?ar|basculante|pivotante|correr|giro/i.test(descriptorText),
  );

  const architecturalElevation = useMemo(() => {
    if (!isArchitecturalDrawing) return "";
    try {
      const svg = buildArchitecturalElevationSvg(drawing);
      return svg ? svgDataUri(svg) : "";
    } catch {
      return "";
    }
  }, [drawing, isArchitecturalDrawing]);

  const canvasHeight = useMemo(() => {
    if (currentStep === 2) return Math.max(620, 125 + Math.ceil(pieces.length / 2) * 145);
    if (currentStep === 3) return Math.max(620, 125 + pieces.length * 118);
    if (currentStep === 4) return Math.max(620, 150 + Math.ceil(pieces.length / 2) * 185);
    return 620;
  }, [currentStep, pieces.length]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    setDragging(true);
    dragOrigin.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan({
      x: dragOrigin.current.panX + event.clientX - dragOrigin.current.x,
      y: dragOrigin.current.panY + event.clientY - dragOrigin.current.y,
    });
  };

  const onPointerUp = () => setDragging(false);

  const dimensionLabel = (
    label: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tx: number,
    ty: number,
    anchor: "start" | "middle" | "end" = "middle",
  ) => (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#fbbf24"
        strokeWidth="1.5"
        markerStart="url(#dim-arrow)"
        markerEnd="url(#dim-arrow)"
      />
      <text x={tx} y={ty} fill="#fde68a" fontSize="13" fontWeight="700" textAnchor={anchor}>
        {label}
      </text>
    </g>
  );

  const renderRealisticArchitecturalModel = (x: number, y: number, w: number, h: number, side: number) => {
    const spec = (drawing.parametricSpec || {}) as Record<string, any>;
    const palette = getAluminumPalette(spec.cor_perfil || spec.color || drawing.description);
    const folhas = Math.max(1, Math.min(6, Number(spec.folhas) || (/4\s*folhas/i.test(descriptorText) ? 4 : /3\s*folhas/i.test(descriptorText) ? 3 : /1\s*folha|giro|pivotante|maxim|basculante/i.test(descriptorText) ? 1 : 2)));
    const isMaximAr = /maxim.?ar|basculante/i.test(descriptorText);
    const isPivotante = /pivotante/i.test(descriptorText);
    const isGiro = /giro/i.test(descriptorText) && !isPivotante;
    const isBox = /box/i.test(descriptorText);

    const frameThick = Math.max(10, Math.min(18, Math.min(w, h) * 0.055));
    const innerX = x + frameThick;
    const innerY = y + frameThick;
    const innerW = Math.max(20, w - frameThick * 2);
    const innerH = Math.max(20, h - frameThick * 2);
    const leafW = innerW / folhas;
    const sashThick = Math.max(7, frameThick * 0.72);

    return (
      <g>
        {/* Profundidad 3D Isométrica del Marco Extruido */}
        <polygon
          points={`${x},${y} ${x + side},${y - side * 0.55} ${x + w + side},${y - side * 0.55} ${x + w},${y}`}
          fill={palette.sideTop}
          stroke={palette.stroke}
          strokeWidth="1.4"
        />
        <polygon
          points={`${x + w},${y} ${x + w + side},${y - side * 0.55} ${x + w + side},${y + h - side * 0.55} ${x + w},${y + h}`}
          fill={palette.sideRight}
          stroke={palette.stroke}
          strokeWidth="1.4"
        />

        {/* Vano de albañilería sutil */}
        <rect
          x={x - 6}
          y={y - 6}
          width={w + 12}
          height={h + 12}
          fill="none"
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Marco perimetral exterior */}
        <rect x={x} y={y} width={w} height={h} fill={palette.frame} stroke={palette.stroke} strokeWidth="2" rx="1.5" />

        {/* Cortes reales a 45° en las 4 esquinas del marco */}
        <line x1={x} y1={y} x2={innerX} y2={innerY} stroke="#64748b" strokeWidth="1.2" />
        <line x1={x + w} y1={y} x2={innerX + innerW} y2={innerY} stroke="#64748b" strokeWidth="1.2" />
        <line x1={x} y1={y + h} x2={innerX} y2={innerY + innerH} stroke="#64748b" strokeWidth="1.2" />
        <line x1={x + w} y1={y + h} x2={innerX + innerW} y2={innerY + innerH} stroke="#64748b" strokeWidth="1.2" />

        {/* Interior del vano */}
        <rect x={innerX} y={innerY} width={innerW} height={innerH} fill="#0b1324" stroke="#64748b" strokeWidth="1" />

        {/* Hojas individuales con vidrio templado, reflejos y simbología ABNT */}
        {Array.from({ length: folhas }).map((_, i) => {
          const lx = innerX + i * leafW;
          const isMobile =
            folhas === 1 ||
            (folhas === 2 && i === 1) ||
            (folhas === 3 && i === 1) ||
            (folhas === 4 && (i === 1 || i === 2));

          return (
            <g key={i}>
              {/* Perfil de hoja (si no es Box sin marco) */}
              {!isBox && (
                <rect
                  x={lx + 1}
                  y={innerY + 1}
                  width={Math.max(8, leafW - 2)}
                  height={Math.max(8, innerH - 2)}
                  fill={palette.frame}
                  stroke={palette.stroke}
                  strokeWidth="1.3"
                />
              )}

              {/* Paño de Vidrio con gradiente arquitectónico */}
              <rect
                x={lx + (isBox ? 2 : sashThick)}
                y={innerY + (isBox ? 2 : sashThick)}
                width={Math.max(4, leafW - (isBox ? 4 : sashThick * 2))}
                height={Math.max(4, innerH - (isBox ? 4 : sashThick * 2))}
                fill="url(#arch-glass-grad)"
                stroke="#38bdf8"
                strokeOpacity="0.45"
                strokeWidth="1"
              />

              {/* Reflejos diagonales realistas en el cristal */}
              <line
                x1={lx + sashThick + 10}
                y1={innerY + sashThick + 14}
                x2={lx + leafW - sashThick - 14}
                y2={innerY + innerH - sashThick - 18}
                stroke="#e0f2fe"
                strokeOpacity="0.32"
                strokeWidth="2.5"
              />
              <line
                x1={lx + sashThick + 22}
                y1={innerY + sashThick + 14}
                x2={lx + leafW - sashThick - 14}
                y2={innerY + innerH - sashThick - 30}
                stroke="#e0f2fe"
                strokeOpacity="0.18"
                strokeWidth="1.2"
              />

              {/* Simbología técnica de apertura */}
              {isMaximAr && (
                <polyline
                  points={`${lx + 6},${innerY + 6} ${lx + leafW / 2},${innerY + innerH - 8} ${lx + leafW - 6},${innerY + 6}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.6"
                  strokeDasharray="5 4"
                />
              )}

              {isGiro && (
                <polyline
                  points={`${lx + 6},${innerY + 6} ${lx + leafW - 8},${innerY + innerH / 2} ${lx + 6},${innerY + innerH - 6}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.6"
