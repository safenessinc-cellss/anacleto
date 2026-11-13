import React, { useMemo, useRef, useState } from "react";
import { TechnicalDrawing, TechnicalPiece } from "../../types";
import { ZoomIn, ZoomOut, RotateCcw, Eye, Layers } from "lucide-react";
import { fitDrawingToViewport } from "../../utils/drawingViewport";
import { buildArchitecturalElevationSvg, svgDataUri } from "../../utils/architecturalSvg";

interface DrawingSvgCanvasProps {
  drawing: TechnicalDrawing;
  currentStep: number;
  showDimensions?: boolean;
  showLabels?: boolean;
}

const fmt = (value: number) => Number.isFinite(value) ? Number(value.toFixed(2)).toString() : "—";
const safe = (value: number | undefined, fallback = 1) => Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;

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

  const W = safe(drawing.overallDimensions?.width, 100);
  const H = safe(drawing.overallDimensions?.height, 100);
  const D = safe(drawing.overallDimensions?.depth, 10);
  const unit = drawing.unit || "cm";
  const pieces = (drawing.pieces || []).filter(Boolean);
  const category = drawing.category || "custom";
  const isArchitecturalDrawing = Boolean(
    drawing.parametricSpec ||
    category === "aluminum_window" ||
    category === "glass_door" ||
    /janela|porta|esquadria|box|maxim.?ar/i.test(`${drawing.title || ""} ${drawing.tipologia || ""}`),
  );
  const architecturalElevation = useMemo(
    () => isArchitecturalDrawing ? svgDataUri(buildArchitecturalElevationSvg(drawing)) : "",
    [drawing, isArchitecturalDrawing],
  );

  const canvasHeight = useMemo(() => {
    if (currentStep === 2) return Math.max(620, 125 + Math.ceil(pieces.length / 2) * 145);
    if (currentStep === 3) return Math.max(620, 125 + pieces.length * 118);
    if (currentStep === 4) return Math.max(620, 150 + Math.ceil(pieces.length / 2) * 185);
    return 620;
  }, [currentStep, pieces.length]);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
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

  const dimensionLabel = (label: string, x1: number, y1: number, x2: number, y2: number, tx: number, ty: number, anchor: "start" | "middle" | "end" = "middle") => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="1.5" markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
      <text x={tx} y={ty} fill="#fde68a" fontSize="13" fontWeight="700" textAnchor={anchor}>{label}</text>
    </g>
  );

  const renderOverview = () => {
    const frontScale = Math.min(350 / W, 245 / H);
    const fw = W * frontScale, fh = H * frontScale;
    const sideScale = Math.min(180 / D, 245 / H);
    const sw = D * sideScale, sh = H * sideScale;
    const topScale = Math.min(350 / W, 120 / D);
    const tw = W * topScale, td = D * topScale;
    const fx = 110, fy = 160;
    const sx = 625, sy = 160;
    const tx = 110, ty = 455;
    return <g>
      <text x="55" y="58" fill="#f8fafc" fontSize="19" fontWeight="800">DESENHO TÉCNICO — VISTAS ORTOGRÁFICAS</text>
      <text x={fx} y="125" fill="#93c5fd" fontSize="14" fontWeight="700">VISTA FRONTAL</text>
      <rect x={fx} y={fy} width={fw} height={fh} fill="#334155" fillOpacity=".22" stroke="#e2e8f0" strokeWidth="2.5"/>
      <line x1={fx} y1={fy + fh} x2={fx + fw} y2={fy + fh} stroke="#64748b" strokeWidth="1"/>
      {dimensionsVisible && <>
        {dimensionLabel(`LARGURA: ${fmt(W)} ${unit}`, fx, fy - 24, fx + fw, fy - 24, fx + fw/2, fy - 34)}
        {dimensionLabel(`ALTURA: ${fmt(H)} ${unit}`, fx - 28, fy, fx - 28, fy + fh, fx - 38, fy + fh/2, "end")}
      </>}
      <text x={sx} y="125" fill="#93c5fd" fontSize="14" fontWeight="700">VISTA LATERAL</text>
      <rect x={sx} y={sy} width={sw} height={sh} fill="#0ea5e9" fillOpacity=".12" stroke="#cbd5e1" strokeWidth="2.5"/>
      {dimensionsVisible && dimensionLabel(`PROF.: ${fmt(D)} ${unit}`, sx, sy + sh + 30, sx + sw, sy + sh + 30, sx + sw/2, sy + sh + 50)}
      <text x={tx} y="425" fill="#93c5fd" fontSize="14" fontWeight="700">VISTA SUPERIOR</text>
      <rect x={tx} y={ty} width={tw} height={td} fill="#0ea5e9" fillOpacity=".12" stroke="#cbd5e1" strokeWidth="2.5"/>
      {dimensionsVisible && dimensionLabel(`LARGURA: ${fmt(W)} ${unit}`, tx, ty + td + 24, tx + tw, ty + td + 24, tx + tw/2, ty + td + 44)}
      <text x="625" y="455" fill="#94a3b8" fontSize="12">CATEGORIA: {category.toUpperCase()}</text>
      <text x="625" y="480" fill="#94a3b8" fontSize="12">COMPONENTES: {pieces.length}</text>
      <text x="625" y="505" fill="#94a3b8" fontSize="12">UNIDADE: {unit.toUpperCase()}</text>
      <text x="625" y="550" fill="#fbbf24" fontSize="11">Medidas de referência — validar antes de fabricar.</text>
    </g>;
  };

  const renderParts = () => {
    const cols = 2;
    const cardW = 425, cardH = 116, gapX = 24, gapY = 18;
    return <g>
      <text x="55" y="58" fill="#f8fafc" fontSize="19" fontWeight="800">LISTA TÉCNICA DE PEÇAS</text>
      {pieces.map((piece, index) => {
        const col = index % cols, row = Math.floor(index / cols);
        const x = 55 + col * (cardW + gapX), y = 92 + row * (cardH + gapY);
        const color = piece.color || (index % 2 ? "#38bdf8" : "#d4af37");
        const pd = piece.dimensions || { width: 0, height: 0, depth: 0, unit };
        return <g key={piece.id || index} transform={`translate(${x},${y})`}>
          <rect width={cardW} height={cardH} rx="10" fill="#0f172a" stroke="#475569" strokeWidth="1.4"/>
          <rect width="7" height={cardH} rx="3" fill={color}/>
          <circle cx="34" cy="32" r="17" fill={color}/>
          <text x="34" y="37" fill="#07111f" fontSize="14" fontWeight="900" textAnchor="middle">{piece.pieceNumber || index + 1}</text>
          <text x="64" y="29" fill="#f8fafc" fontSize="14" fontWeight="700">{(piece.name || "Componente").slice(0, 42)}</text>
          <text x="64" y="51" fill="#cbd5e1" fontSize="11">QUANTIDADE: {safe(piece.quantity, 1)}  •  MATERIAL: {(piece.material || "A definir").slice(0, 34)}</text>
          <rect x="20" y="69" width={cardW - 40} height="31" rx="5" fill="#1e293b"/>
          <text x="32" y="89" fill="#7dd3fc" fontSize="12" fontWeight="700">{fmt(pd.width)} × {fmt(pd.height)} × {fmt(pd.depth || pd.thickness || 0)} {pd.unit || unit}</text>
          {showLabels && <text x={cardW - 20} y="89" fill="#fbbf24" fontSize="10" textAnchor="end">{piece.cutAngle || "Corte a validar"}</text>}
        </g>;
      })}
      {pieces.length === 0 && <text x="55" y="120" fill="#fca5a5" fontSize="15">Nenhum componente foi informado. Descreva o produto novamente.</text>}
    </g>;
  };

  const renderCuts = () => <g>
    <text x="55" y="58" fill="#f8fafc" fontSize="19" fontWeight="800">PLANO DE CORTE E DIMENSÕES INDIVIDUAIS</text>
    {pieces.map((piece, index) => {
      const y = 88 + index * 118;
      const pd = piece.dimensions || { width: 1, height: 1, depth: 1, unit };
      const length = safe(pd.width, 1), section = safe(pd.height, 1);
      const barW = Math.max(90, Math.min(390, 390 * length / Math.max(...pieces.map(p => safe(p.dimensions?.width, 1)))));
      const barH = Math.max(18, Math.min(42, 42 * section / Math.max(...pieces.map(p => safe(p.dimensions?.height, 1)))));
      const color = piece.color || "#38bdf8";
      return <g key={piece.id || index} transform={`translate(55,${y})`}>
        <rect width="890" height="102" rx="8" fill="#0f172a" stroke="#334155"/>
        <text x="16" y="24" fill="#f8fafc" fontSize="13" fontWeight="700">{piece.pieceNumber || index + 1}. {(piece.name || "Componente").slice(0, 55)}</text>
        <rect x="20" y="42" width={barW} height={barH} rx="3" fill={color} fillOpacity=".5" stroke={color} strokeWidth="2"/>
        {dimensionsVisible && <text x="20" y="94" fill="#fde68a" fontSize="11">Comprimento: {fmt(length)} {pd.unit || unit}  •  Altura: {fmt(section)}  •  Profundidade: {fmt(pd.depth || pd.thickness || 0)}</text>}
        <text x="470" y="52" fill="#cbd5e1" fontSize="12">Quantidade: {safe(piece.quantity, 1)} ×</text>
        <text x="470" y="74" fill="#7dd3fc" fontSize="12">Corte: {piece.cutAngle || "90° — validar"}</text>
        <text x="680" y="52" fill="#94a3b8" fontSize="11">{(piece.material || "Material a definir").slice(0, 28)}</text>
        {showLabels && piece.notes && <text x="680" y="74" fill="#94a3b8" fontSize="10">{piece.notes.slice(0, 32)}</text>}
      </g>;
    })}
  </g>;

  const renderAssembly = () => <g>
    <text x="55" y="58" fill="#f8fafc" fontSize="19" fontWeight="800">MONTAGEM — COMPONENTES DO PROJETO</text>
    <text x="55" y="80" fill="#94a3b8" fontSize="11">Cada cartão representa uma peça real da lista técnica, com suas dimensões e quantidade.</text>
    {pieces.map((piece, index) => {
      const col = index % 2, row = Math.floor(index / 2);
      const x = 65 + col * 455, y = 110 + row * 168;
      const pd = piece.dimensions || { width: 0, height: 0, depth: 0, unit };
      const color = piece.color || "#38bdf8";
      return <g key={piece.id || index} transform={`translate(${x},${y})`}>
        <rect width="405" height="132" rx="9" fill="#0f172a" stroke="#475569"/>
        <rect x="14" y="16" width={Math.max(45, Math.min(180, safe(pd.width, 1) / Math.max(W, H, D) * 180))} height={Math.max(18, Math.min(62, safe(pd.height, 1) / Math.max(W, H, D) * 100))} rx="3" fill={color} fillOpacity=".6" stroke={color} strokeWidth="2"/>
        <text x="210" y="30" fill="#f8fafc" fontSize="13" fontWeight="700">{piece.pieceNumber || index + 1}. {(piece.name || "Componente").slice(0, 24)}</text>
        <text x="210" y="54" fill="#7dd3fc" fontSize="11">{fmt(pd.width)} × {fmt(pd.height)} × {fmt(pd.depth || pd.thickness || 0)} {pd.unit || unit}</text>
        <text x="210" y="76" fill="#cbd5e1" fontSize="10">Quantidade: {safe(piece.quantity, 1)}</text>
        <text x="210" y="96" fill="#94a3b8" fontSize="10">{(piece.material || "Material a definir").slice(0, 26)}</text>
        {index < pieces.length - 1 && <path d="M 195 112 L 205 112" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#assembly-arrow)"/>}
      </g>;
    })}
    {pieces.length === 0 && <text x="65" y="130" fill="#fca5a5" fontSize="14">Não há peças para montar.</text>}
    <text x="65" y={Math.max(570, 125 + Math.ceil(pieces.length / 2) * 168)} fill="#fbbf24" fontSize="12">Sequência de montagem: seguir a identificação e as instruções técnicas do projeto.</text>
  </g>;

  const renderFinal = () => {
    const visualElements = Array.isArray((drawing as any).visualElements) ? (drawing as any).visualElements : [];
    // Preserve the real width/height ratio instead of stretching every product
    // into the same rectangle. This keeps the generated elevation faithful.
    const fit = fitDrawingToViewport(W, H, 500, 340, 48);
    const w = fit.width, h = fit.height;
    const x = 250 + fit.x;
    const y = 120 + fit.y;
    const side = Math.max(28, Math.min(95, D / Math.max(W, H, D) * 170));
    const frame = "#cbd5e1";
    const isWindow = category === "aluminum_window";
    const isDoor = category === "glass_door";
    const isWardrobe = /arm[aá]rio|closet|guarda roupa/i.test(drawing.title + " " + drawing.description);
    const isTable = /mesa|table/i.test(drawing.title + " " + drawing.description);
    return <g>
      <text x="55" y="58" fill="#f8fafc" fontSize="19" fontWeight="800">VISTA FINAL DO PRODUTO</text>
      <text x="55" y="82" fill="#94a3b8" fontSize="12">{drawing.title} — {fmt(W)} × {fmt(H)} × {fmt(D)} {unit}</text>
      {visualElements.length > 0 ? (
        <rect x={x} y={y} width={w} height={h} fill="#0f172a" stroke={frame} strokeWidth="1.5" rx="2" />
      ) : (
        <>
          <polygon points={`${x},${y} ${x+side},${y-side/2} ${x+w+side},${y-side/2} ${x+w},${y}`} fill="#64748b" fillOpacity=".35" stroke={frame} strokeWidth="1.5"/>
          <polygon points={`${x+w},${y} ${x+w+side},${y-side/2} ${x+w+side},${y+h-side/2} ${x+w},${y+h}`} fill="#334155" fillOpacity=".75" stroke={frame} strokeWidth="1.5"/>
          <rect x={x} y={y} width={w} height={h} fill="#0f172a" stroke={frame} strokeWidth="4" rx="2"/>
        </>
      )}
      {architecturalElevation ? (
        <image href={architecturalElevation} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
      ) : visualElements.length > 0 ? <g>
        {visualElements.map((element: any, index: number) => {
          const type = String(element.type || "rect").toLowerCase();
          const stroke = element.stroke || "#cbd5e1";
          const fill = element.fill || "none";
          const sw = Math.max(0.5, Math.min(12, Number(element.strokeWidth) || 2));
          const opacity = Math.max(0, Math.min(1, Number(element.opacity ?? 1)));
          const label = String(element.label || "");
          if (type === "line") return <g key={element.id || index} opacity={opacity}>
            <line x1={x + Number(element.x1 || 0) * w / 1000} y1={y + Number(element.y1 || 0) * h / 1000} x2={x + Number(element.x2 || 0) * w / 1000} y2={y + Number(element.y2 || 0) * h / 1000} stroke={stroke} strokeWidth={sw} strokeDasharray={element.strokeDasharray || undefined} />
            {label && <text x={x + Number(element.x1 || 0) * w / 1000} y={y + Number(element.y1 || 0) * h / 1000 - 5} fill="#f8fafc" fontSize="10">{label}</text>}
          </g>;
          if (type === "circle") return <circle key={element.id || index} cx={x + Number(element.cx || 0) * w / 1000} cy={y + Number(element.cy || 0) * h / 1000} r={Math.max(1, Number(element.r) || 8) * Math.min(w, h) / 1000} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity} />;
          if (type === "polygon") {
            const points = Array.isArray(element.points) ? element.points.map((p: any) => (x + Number(p.x || 0) * w / 1000) + "," + (y + Number(p.y || 0) * h / 1000)).join(" ") : "";
            return <polygon key={element.id || index} points={points} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity} />;
          }
          if (type === "text") return <text key={element.id || index} x={x + Number(element.x || 0) * w / 1000} y={y + Number(element.y || 0) * h / 1000} fill={element.fill || "#f8fafc"} fontSize={Math.max(7, Math.min(22, Number(element.fontSize) || 12))} fontWeight={element.fontWeight || "normal"}>{String(element.text || "")}</text>;
          return <g key={element.id || index} opacity={opacity}>
            <rect x={x + Number(element.x || 0) * w / 1000} y={y + Number(element.y || 0) * h / 1000} width={Math.max(0, Number(element.width) || 0) * w / 1000} height={Math.max(0, Number(element.height) || 0) * h / 1000} rx={Math.max(0, Number(element.rx) || 0)} fill={fill} stroke={stroke} strokeWidth={sw} />
            {label && <text x={x + Number(element.x || 0) * w / 1000 + 4} y={y + Number(element.y || 0) * h / 1000 + 14} fill="#f8fafc" fontSize="10">{label}</text>}
          </g>;
        })}
      </g> : (isWindow ? <g>
        <rect x={x+14} y={y+14} width={w/2-19} height={h-28} fill="#38bdf8" fillOpacity=".2" stroke="#94a3b8" strokeWidth="5"/>
        <rect x={x+w/2+5} y={y+14} width={w/2-19} height={h-28} fill="#38bdf8" fillOpacity=".2" stroke="#94a3b8" strokeWidth="5"/>
        <line x1={x+w/2} y1={y+8} x2={x+w/2} y2={y+h-8} stroke="#e2e8f0" strokeWidth="5"/>
        <line x1={x+25} y1={y+25} x2={x+w/2-25} y2={y+h-35} stroke="#e0f2fe" strokeOpacity=".65" strokeWidth="3"/>
        <rect x={x+w/2-10} y={y+h/2-15} width="5" height="30" rx="2" fill="#fbbf24"/>
      </g> : isDoor ? <g>
        <rect x={x+18} y={y+14} width={w-36} height={h-28} fill="#64748b" fillOpacity=".35" stroke="#94a3b8" strokeWidth="3"/>
        <rect x={x+42} y={y+38} width={w-84} height={h-76} fill="#0ea5e9" fillOpacity=".12" stroke="#64748b" strokeWidth="2"/>
        <circle cx={x+w-48} cy={y+h/2} r="7" fill="#fbbf24"/>
      </g> : isWardrobe ? <g>
        <line x1={x+w/2} y1={y+5} x2={x+w/2} y2={y+h-5} stroke="#cbd5e1" strokeWidth="3"/>
        <rect x={x+12} y={y+12} width={w/2-18} height={h-24} fill="#94a3b8" fillOpacity=".12" stroke="#94a3b8" strokeWidth="2"/>
        <rect x={x+w/2+6} y={y+12} width={w/2-18} height={h-24} fill="#94a3b8" fillOpacity=".12" stroke="#94a3b8" strokeWidth="2"/>
        <rect x={x+w/2-12} y={y+h/2-3} width="5" height="34" rx="2" fill="#fbbf24"/>
        <rect x={x+w/2+7} y={y+h/2-3} width="5" height="34" rx="2" fill="#fbbf24"/>
      </g> : isTable || category === "furniture" ? <g>
        <rect x={x+18} y={y+18} width={w-36} height="34" fill="#b08945" stroke="#f8fafc" strokeWidth="2"/>
        <rect x={x+28} y={y+52} width="25" height={h-70} fill="#8c6d37" stroke="#d6b36a"/>
        <rect x={x+w-53} y={y+52} width="25" height={h-70} fill="#8c6d37" stroke="#d6b36a"/>
        <rect x={x+53} y={y+64} width={w-106} height="18" fill="#a88440"/>
        <rect x={x+65} y={y+52} width="16" height={h-70} fill="#735728" opacity=".8"/>
        <rect x={x+w-81} y={y+52} width="16" height={h-70} fill="#735728" opacity=".8"/>
      </g> : <g>
        {pieces.slice(0, 8).map((piece, index) => <rect key={piece.id || index} x={x+16+(index%4)*98} y={y+20+Math.floor(index/4)*145} width="82" height="120" rx="2" fill={piece.color || "#38bdf8"} fillOpacity=".28" stroke={piece.color || "#38bdf8"} strokeWidth="2"/>)}
      </g>)}
      {dimensionsVisible && <>
        {dimensionLabel(`LARGURA ${fmt(W)} ${unit}`, x, y+h+36, x+w, y+h+36, x+w/2, y+h+57)}
        {dimensionLabel(`ALTURA ${fmt(H)} ${unit}`, x-28, y, x-28, y+h, x-38, y+h/2, "end")}
        {dimensionLabel(`PROFUNDIDADE ${fmt(D)} ${unit}`, x+w+12, y-10, x+w+side+12, y-side/2-10, x+w+side+18, y-30, "start")}
      </>}
      <rect x="55" y="545" width="890" height="42" rx="7" fill="#0f172a" stroke="#475569"/>
      <text x="75" y="571" fill="#cbd5e1" fontSize="12">Componentes: {pieces.length}  •  Categoria: {category}  •  Unidade: {unit}</text>
      <text x="925" y="571" fill="#fbbf24" fontSize="10" textAnchor="end">Pré-visualização técnica — conferir projeto antes do corte.</text>
    </g>;
  };

  return (
    <div className="relative flex h-full min-h-[460px] w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#090d16] select-none">
      <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-lg">
          <span className="h-2 w-2 rounded-full bg-emerald-400"/>
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-100">Fase {currentStep}: {drawing.steps?.[currentStep-1]?.title || "Desenho técnico"}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/95 p-1 shadow-lg">
          <button type="button" onClick={() => setZoom(z => Math.min(3, z + .2))} title="Aproximar" className="rounded-lg p-2 text-slate-200 hover:bg-slate-700"><ZoomIn className="h-4 w-4"/></button>
          <button type="button" onClick={() => setZoom(z => Math.max(.5, z - .2))} title="Afastar" className="rounded-lg p-2 text-slate-200 hover:bg-slate-700"><ZoomOut className="h-4 w-4"/></button>
          <button type="button" onClick={resetView} title="Restaurar visualização" className="rounded-lg p-2 text-slate-200 hover:bg-slate-700"><RotateCcw className="h-4 w-4"/></button>
          <button type="button" onClick={() => setDimensionsVisible(v => !v)} title="Mostrar ou ocultar cotas" className={`rounded-lg p-2 ${dimensionsVisible ? "bg-amber-500/20 text-amber-300" : "text-slate-400"}`}><Layers className="h-4 w-4"/></button>
          <button type="button" onClick={() => setLabelsVisible(v => !v)} title="Mostrar ou ocultar identificações" className={`rounded-lg p-2 ${labelsVisible ? "bg-sky-500/20 text-sky-300" : "text-slate-400"}`}><Eye className="h-4 w-4"/></button>
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 overflow-auto ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg viewBox={`0 0 1000 ${canvasHeight}`} className="h-full min-h-[460px] w-full" style={{ minHeight: `${canvasHeight}px` }} role="img" aria-label={`Desenho técnico de ${drawing.title}`}>
          <defs>
            <pattern id="drawing-grid-small" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth=".6" opacity=".45"/></pattern>
            <pattern id="drawing-grid-large" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#drawing-grid-small)"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#475569" strokeWidth="1" opacity=".5"/></pattern>
            <marker id="dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/></marker>
            <marker id="assembly-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/></marker>
          </defs>
          <rect width="1000" height={canvasHeight} fill="url(#drawing-grid-large)"/>
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {currentStep === 1 && (drawing.parametricSpec ? renderFinal() : renderOverview())}
            {currentStep === 2 && renderParts()}
            {currentStep === 3 && renderCuts()}
            {currentStep === 4 && renderAssembly()}
            {currentStep >= 5 && renderFinal()}
          </g>
          {(drawing.isDraft !== false || drawing.status !== "APPROVED_FOR_MANUFACTURING") && (
            <g id="anacleto-draft-watermark" pointerEvents="none" opacity="0.28">
              <text x="500" y={Math.max(260, canvasHeight / 2)} textAnchor="middle" transform={`rotate(-24 500 ${Math.max(260, canvasHeight / 2)})`} fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" paintOrder="stroke" fontSize="34" fontWeight="900" letterSpacing="2">
                BORRADOR PRELIMINAR - NO VÁLIDO PARA FABRICACIÓN
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex justify-between text-[9px] font-mono text-slate-500">
        <span>ESCALA PROPORCIONAL • {unit.toUpperCase()}</span>
        <span>{Math.round(zoom*100)}% • {pieces.length} COMPONENTES</span>
      </div>
    </div>
  );
}
