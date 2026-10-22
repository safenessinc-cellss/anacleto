import React, { useState, useRef } from "react";
import { TechnicalDrawing, TechnicalPiece } from "../../types";
import { ZoomIn, ZoomOut, RotateCcw, Eye, Layers, Maximize2 } from "lucide-react";

interface DrawingSvgCanvasProps {
  drawing: TechnicalDrawing;
  currentStep: number;
  showDimensions?: boolean;
  showLabels?: boolean;
}

export default function DrawingSvgCanvas({
  drawing,
  currentStep,
  showDimensions = true,
  showLabels = true,
}: DrawingSvgCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [localShowDimensions, setLocalShowDimensions] = useState(showDimensions);
  const [localShowLabels, setLocalShowLabels] = useState(showLabels);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const { width: W = 120, height: H = 80, depth: D = 60 } = drawing.overallDimensions || {};
  const unit = drawing.unit || "cm";

  // Canvas bounds
  const viewBoxWidth = 800;
  const viewBoxHeight = 520;
  const centerX = viewBoxWidth / 2;
  const centerY = viewBoxHeight / 2;

  // Normalized scale for bounding box
  const maxDim = Math.max(W, H, 1);
  const scale = 280 / maxDim;
  const boxW = Math.max(80, W * scale);
  const boxH = Math.max(60, H * scale);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#090d16] rounded-2xl border border-slate-800 overflow-hidden flex flex-col select-none">
      {/* Top Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Step Badge */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
            Fase {currentStep}: {drawing.steps?.[currentStep - 1]?.title || "Visualización Técnica"}
          </span>
        </div>

        {/* Canvas Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 p-1 rounded-xl shadow-lg">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            title="Acercar (Zoom In)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))}
            title="Alejar (Zoom Out)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            title="Restablecer vista"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
          <button
            onClick={() => setLocalShowDimensions(!localShowDimensions)}
            title="Mostrar/Ocultar Cotas"
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition flex items-center gap-1 ${
              localShowDimensions ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Cotas
          </button>
          <button
            onClick={() => setLocalShowLabels(!localShowLabels)}
            title="Mostrar/Ocultar Etiquetas de Piezas"
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition flex items-center gap-1 ${
              localShowLabels ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Piezas
          </button>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center overflow-hidden"
      >
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full pointer-events-auto"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="tech-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            <pattern id="tech-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#tech-grid)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="0.8" strokeOpacity="0.6" />
            </pattern>

            {/* Dimension Line Arrowhead Markers */}
            <marker id="arrow-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="#eab308" />
            </marker>
            <marker id="arrow-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="#eab308" />
            </marker>
            <marker id="arrow-union" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
            </marker>

            {/* Gradients */}
            <linearGradient id="gold-wood" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#996515" />
            </linearGradient>
            <linearGradient id="aluminum-dark" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="glass-reflect" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0.1)" />
            </linearGradient>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#tech-grid-major)" />

          {/* Render Step Specific Phase */}
          {currentStep === 1 && renderStep1GeneralDimensions(boxW, boxH, W, H, D, unit, centerX, centerY, localShowDimensions)}
          {currentStep === 2 && renderStep2PartsBOM(drawing.pieces, viewBoxWidth, viewBoxHeight, localShowLabels)}
          {currentStep === 3 && renderStep3CuttingWithDimensions(drawing.pieces, viewBoxWidth, viewBoxHeight, localShowDimensions, localShowLabels)}
          {currentStep === 4 && renderStep4PuzzleAssembly(drawing.pieces, boxW, boxH, centerX, centerY, localShowLabels)}
          {currentStep === 5 && renderStep5FinalResult(drawing, boxW, boxH, centerX, centerY, localShowDimensions, localShowLabels)}
        </svg>
      </div>

      {/* Bottom Scale & Coordinate Stamp */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-slate-500 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>ESCALA: PROPORCIONAL • SISTEMA MÉTRICO ({unit.toUpperCase()})</span>
        </div>
        <div className="flex items-center gap-3">
          <span>ZOOM: {Math.round(zoom * 100)}%</span>
          <span>ANACLETO CAD ENGINE v2.6</span>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// RENDER PHASE 1: Definición de dimensiones generales
// -------------------------------------------------------------
function renderStep1GeneralDimensions(
  boxW: number,
  boxH: number,
  W: number,
  H: number,
  D: number,
  unit: string,
  centerX: number,
  centerY: number,
  showDimensions: boolean
) {
  const x = centerX - boxW / 2;
  const y = centerY - boxH / 2 + 10;
  const isoOffset = 30;

  return (
    <g className="animate-fadeIn">
      {/* 3D Isometric Enclosing Volume Ghost Box */}
      {/* Back Faces */}
      <polygon
        points={`${x + isoOffset},${y - isoOffset} ${x + boxW + isoOffset},${y - isoOffset} ${x + boxW + isoOffset},${y + boxH - isoOffset} ${x + isoOffset},${y + boxH - isoOffset}`}
        fill="#1e293b"
        fillOpacity="0.3"
        stroke="#475569"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      {/* Connectors */}
      <line x1={x} y1={y} x2={x + isoOffset} y2={y - isoOffset} stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
      <line x1={x + boxW} y1={y} x2={x + boxW + isoOffset} y2={y - isoOffset} stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
      <line x1={x + boxW} y1={y + boxH} x2={x + boxW + isoOffset} y2={y + boxH - isoOffset} stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />

      {/* Front Enclosing Box */}
      <rect
        x={x}
        y={y}
        width={boxW}
        height={boxH}
        fill="rgba(212, 175, 55, 0.08)"
        stroke="#eab308"
        strokeWidth="2"
        strokeDasharray="6 4"
        rx="4"
      />

      {/* Diagonal Axis Guides */}
      <line x1={x} y1={y} x2={x + boxW} y2={y + boxH} stroke="#eab308" strokeWidth="0.7" strokeDasharray="2 3" strokeOpacity="0.4" />
      <line x1={x + boxW} y1={y} x2={x} y2={y + boxH} stroke="#eab308" strokeWidth="0.7" strokeDasharray="2 3" strokeOpacity="0.4" />

      {/* Center Origin Mark */}
      <circle cx={centerX} cy={centerY + 10} r="4" fill="#eab308" />
      <text x={centerX} y={centerY + 24} fill="#eab308" fontSize="10" textAnchor="middle" fontFamily="monospace">
        ORIGEN DE PLANTA
      </text>

      {/* Dimension Lines (Cotas exteriores con flechas y etiquetas) */}
      {showDimensions && (
        <g>
          {/* Width Cota (Top) */}
          <line
            x1={x}
            y1={y - 25}
            x2={x + boxW}
            y2={y - 25}
            stroke="#eab308"
            strokeWidth="1.5"
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />
          <line x1={x} y1={y - 32} x2={x} y2={y - 5} stroke="#64748b" strokeWidth="0.8" />
          <line x1={x + boxW} y1={y - 32} x2={x + boxW} y2={y - 5} stroke="#64748b" strokeWidth="0.8" />
          <rect x={centerX - 45} y={y - 36} width="90" height="18" fill="#0f172a" stroke="#eab308" strokeWidth="1" rx="3" />
          <text x={centerX} y={y - 24} fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            ANCHO: {W} {unit}
          </text>

          {/* Height Cota (Left) */}
          <line
            x1={x - 25}
            y1={y}
            x2={x - 25}
            y2={y + boxH}
            stroke="#eab308"
            strokeWidth="1.5"
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />
          <line x1={x - 32} y1={y} x2={x - 5} y2={y} stroke="#64748b" strokeWidth="0.8" />
          <line x1={x - 32} y1={y + boxH} x2={x - 5} y2={y + boxH} stroke="#64748b" strokeWidth="0.8" />
          <rect x={x - 85} y={centerY + 10 - 10} width="95" height="18" fill="#0f172a" stroke="#eab308" strokeWidth="1" rx="3" />
          <text x={x - 37} y={centerY + 10 + 3} fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            ALTO: {H} {unit}
          </text>

          {/* Depth Cota (Isometric Top Right) */}
          {D > 0 && (
            <g>
              <line
                x1={x + boxW + 15}
                y1={y + 10}
                x2={x + boxW + isoOffset + 15}
                y2={y - isoOffset + 10}
                stroke="#eab308"
                strokeWidth="1.5"
                markerStart="url(#arrow-start)"
                markerEnd="url(#arrow-end)"
              />
              <rect
                x={x + boxW + isoOffset - 5}
                y={y - isoOffset - 16}
                width="110"
                height="18"
                fill="#0f172a"
                stroke="#eab308"
                strokeWidth="1"
                rx="3"
              />
              <text
                x={x + boxW + isoOffset + 50}
                y={y - isoOffset - 4}
                fill="#fef08a"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                FONDO: {D} {unit}
              </text>
            </g>
          )}
        </g>
      )}

      {/* Step Description Banner */}
      <g transform={`translate(${centerX - 160}, ${centerY + boxH / 2 + 55})`}>
        <rect width="320" height="34" fill="#0f172a" stroke="#334155" rx="6" />
        <text x="160" y="21" fill="#cbd5e1" fontSize="11" textAnchor="middle">
          Volumen Exterior: {W} × {H} × {D} {unit} (Envolvente Máxima)
        </text>
      </g>
    </g>
  );
}

// -------------------------------------------------------------
// RENDER PHASE 2: Despiece (Lista de piezas tipo puzzle)
// -------------------------------------------------------------
function renderStep2PartsBOM(
  pieces: TechnicalPiece[] = [],
  viewBoxWidth: number,
  viewBoxHeight: number,
  showLabels: boolean
) {
  const cols = pieces.length > 4 ? 3 : 2;
  const cardW = (viewBoxWidth - 80) / cols;
  const cardH = 95;

  return (
    <g className="animate-fadeIn">
      {/* Title */}
      <text x="40" y="45" fill="#f8fafc" fontSize="13" fontWeight="bold">
        TABLA DE DESPIECE TÉCNICO (BOM / PIEZAS IDENTIFICADAS)
      </text>

      {pieces.map((p, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const cx = 40 + col * (cardW + 15);
        const cy = 70 + row * (cardH + 15);
        const color = p.color || (idx % 2 === 0 ? "#C5A850" : "#38bdf8");

        return (
          <g key={p.id || idx} transform={`translate(${cx}, ${cy})`}>
            {/* Card Background */}
            <rect
              width={cardW}
              height={cardH}
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="1.2"
              rx="8"
            />
            {/* Top Accent Strip with Piece Color */}
            <rect width={cardW} height="4" fill={color} rx="2" />

            {/* Puzzle Piece Badge */}
            <rect x="12" y="14" width="28" height="24" fill={color} rx="4" />
            <text x="26" y="30" fill="#0f172a" fontSize="13" fontWeight="bold" textAnchor="middle">
              {p.pieceNumber || idx + 1}
            </text>

            {/* Piece Name & Quantity */}
            <text x="48" y="26" fill="#f8fafc" fontSize="11" fontWeight="bold">
              {p.name.length > 28 ? p.name.substring(0, 26) + "..." : p.name}
            </text>
            <text x="48" y="40" fill="#94a3b8" fontSize="9.5">
              Cant: <tspan fill="#fef08a" fontWeight="bold">{p.quantity} ud(s)</tspan> • {p.material}
            </text>

            {/* Dimensions Badge */}
            <rect x="12" y="52" width={cardW - 24} height="26" fill="#1e293b" rx="4" />
            <text x="20" y="69" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
              📐 {p.dimensions?.width} × {p.dimensions?.height}
              {p.dimensions?.depth ? ` × ${p.dimensions?.depth}` : ""} {p.dimensions?.unit || "cm"}
            </text>
            {p.cutAngle && (
              <text x={cardW - 20} y="69" fill="#eab308" fontSize="9.5" textAnchor="end" fontFamily="monospace">
                {p.cutAngle}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// -------------------------------------------------------------
// RENDER PHASE 3: Corte de cada pieza con sus cotas
// -------------------------------------------------------------
function renderStep3CuttingWithDimensions(
  pieces: TechnicalPiece[] = [],
  viewBoxWidth: number,
  viewBoxHeight: number,
  showDimensions: boolean,
  showLabels: boolean
) {
  const displayPieces = pieces.slice(0, 4); // Show top primary cuts clearly
  const blockH = 95;

  return (
    <g className="animate-fadeIn">
      <text x="40" y="45" fill="#f8fafc" fontSize="13" fontWeight="bold">
        PATRÓN DE CORTE, ÁNGULOS Y COTAS INDIVIDUALES
      </text>

      {displayPieces.map((p, idx) => {
        const y = 70 + idx * (blockH + 15);
        const color = p.color || "#C5A850";
        const w = p.dimensions?.width || 50;
        const h = p.dimensions?.height || 20;

        return (
          <g key={p.id || idx} transform={`translate(40, ${y})`}>
            {/* Background container */}
            <rect width={viewBoxWidth - 80} height={blockH} fill="#0f172a" stroke="#1e293b" rx="6" />

            {/* Piece Tag */}
            <rect x="12" y="12" width="24" height="20" fill={color} rx="3" />
            <text x="24" y="26" fill="#000" fontSize="11" fontWeight="bold" textAnchor="middle">
              {p.pieceNumber || idx + 1}
            </text>
            <text x="44" y="26" fill="#f8fafc" fontSize="11" fontWeight="bold">
              {p.name}
            </text>

            {/* Visual Cut Representation */}
            <g transform="translate(240, 15)">
              {/* Cut Angle Indicating Polygon or Rect */}
              {p.cutAngle?.includes("45") ? (
                <polygon
                  points="0,10 200,10 180,45 20,45"
                  fill="rgba(197, 168, 80, 0.2)"
                  stroke={color}
                  strokeWidth="2"
                />
              ) : (
                <rect x="0" y="10" width="220" height="35" fill="rgba(56, 189, 248, 0.15)" stroke={color} strokeWidth="2" rx="2" />
              )}

              {/* Cut Line & Saw blade mark */}
              <line x1="0" y1="5" x2="0" y2="50" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="220" y1="5" x2="220" y2="50" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />

              {/* Angle Label */}
              <text x="110" y="32" fill="#fef08a" fontSize="10" textAnchor="middle" fontWeight="bold">
                CORTE: {p.cutAngle || "90° RECTO"}
              </text>

              {/* Dimension horizontal */}
              {showDimensions && (
                <g>
                  <line x1="0" y1="58" x2="220" y2="58" stroke="#eab308" strokeWidth="1.2" markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
                  <text x="110" y="70" fill="#fef08a" fontSize="9" textAnchor="middle" fontFamily="monospace">
                    L = {w} {p.dimensions?.unit || "cm"}
                  </text>
                </g>
              )}
            </g>

            {/* Material & Specs */}
            <g transform="translate(560, 25)">
              <text x="0" y="0" fill="#94a3b8" fontSize="10">
                Material: <tspan fill="#f1f5f9">{p.material}</tspan>
              </text>
              <text x="0" y="16" fill="#94a3b8" fontSize="10">
                Espesor: <tspan fill="#f1f5f9">{p.dimensions?.thickness || p.dimensions?.depth || 2} {p.dimensions?.unit || "cm"}</tspan>
              </text>
              <text x="0" y="32" fill="#38bdf8" fontSize="10" fontWeight="bold">
                Tolerancia: ± 0.5 mm
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// -------------------------------------------------------------
// RENDER PHASE 4: Ensamblaje tipo puzzle (exploded view + flechas de unión)
// -------------------------------------------------------------
function renderStep4PuzzleAssembly(
  pieces: TechnicalPiece[] = [],
  boxW: number,
  boxH: number,
  centerX: number,
  centerY: number,
  showLabels: boolean
) {
  return (
    <g className="animate-fadeIn">
      {/* Title */}
      <text x="40" y="45" fill="#f8fafc" fontSize="13" fontWeight="bold">
        VISTA DE ENSAMBLAJE TIPO PUZZLE (EXPLOSIONADA + FLECHAS DE UNIÓN)
      </text>

      {/* Exploded Parts Assembly */}
      {/* 1. Top piece floating up */}
      <g transform={`translate(${centerX - boxW / 2}, ${centerY - boxH / 2 - 40})`}>
        <rect width={boxW} height="22" fill="#d4af37" stroke="#fff" strokeWidth="1.5" rx="3" />
        <text x={boxW / 2} y="15" fill="#000" fontSize="10" fontWeight="bold" textAnchor="middle">
          Pieza 1 - Tablero / Marco Superior
        </text>
        {/* Assembly arrow down */}
        <line x1={boxW / 2} y1="28" x2={boxW / 2} y2="52" stroke="#38bdf8" strokeWidth="2.5" markerEnd="url(#arrow-union)" strokeDasharray="3 3" />
      </g>

      {/* 2. Left side strut */}
      <g transform={`translate(${centerX - boxW / 2 - 50}, ${centerY - 30})`}>
        <rect width="24" height={boxH} fill="#334155" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
        <text x="12" y={boxH / 2 + 4} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">
          P2
        </text>
        {/* Arrow pointing right towards frame */}
        <line x1="30" y1={boxH / 2} x2="60" y2={boxH / 2} stroke="#38bdf8" strokeWidth="2.5" markerEnd="url(#arrow-union)" strokeDasharray="3 3" />
      </g>

      {/* 3. Center Core / Panel */}
      <g transform={`translate(${centerX - (boxW * 0.7) / 2}, ${centerY - (boxH * 0.7) / 2 + 5})`}>
        <rect
          width={boxW * 0.7}
          height={boxH * 0.7}
          fill="rgba(56, 189, 248, 0.15)"
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeDasharray="4 4"
          rx="4"
        />
        <text x={(boxW * 0.7) / 2} y={(boxH * 0.7) / 2 - 6} fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
          ENCURVADO CENTRAL (PUZZLE CORE)
        </text>
        <text x={(boxW * 0.7) / 2} y={(boxH * 0.7) / 2 + 10} fill="#94a3b8" fontSize="9" textAnchor="middle">
          Alineación de espigas y fijaciones
        </text>
      </g>

      {/* 4. Right side strut */}
      <g transform={`translate(${centerX + boxW / 2 + 25}, ${centerY - 30})`}>
        <rect width="24" height={boxH} fill="#334155" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
        <text x="12" y={boxH / 2 + 4} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">
          P3
        </text>
        {/* Arrow pointing left towards frame */}
        <line x1="-5" y1={boxH / 2} x2="-35" y2={boxH / 2} stroke="#38bdf8" strokeWidth="2.5" markerEnd="url(#arrow-union)" strokeDasharray="3 3" />
      </g>

      {/* 5. Bottom Base piece */}
      <g transform={`translate(${centerX - boxW / 2}, ${centerY + boxH / 2 + 45})`}>
        <rect width={boxW} height="22" fill="#8c6d37" stroke="#fff" strokeWidth="1.5" rx="3" />
        <text x={boxW / 2} y="15" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">
          Pieza 4 / Base de Soporte Inferior
        </text>
        {/* Arrow pointing up */}
        <line x1={boxW / 2} y1="-6" x2={boxW / 2} y2="-30" stroke="#38bdf8" strokeWidth="2.5" markerEnd="url(#arrow-union)" strokeDasharray="3 3" />
      </g>

      {/* Step Sequence Guide Banner */}
      <g transform={`translate(${centerX - 240}, 475)`}>
        <rect width="480" height="32" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" rx="6" />
        <text x="240" y="20" fill="#38bdf8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
          ORDEN DE MONTAJE PUZZLE: Base (4) ➔ Laterales (2,3) ➔ Panel Central ➔ Cierre Superior (1)
        </text>
      </g>
    </g>
  );
}

// -------------------------------------------------------------
// RENDER PHASE 5: Resultado final con vista completa y medidas totales
// -------------------------------------------------------------
function renderStep5FinalResult(
  drawing: TechnicalDrawing,
  boxW: number,
  boxH: number,
  centerX: number,
  centerY: number,
  showDimensions: boolean,
  showLabels: boolean
) {
  const x = centerX - boxW / 2;
  const y = centerY - boxH / 2 + 10;
  const { width: W = 120, height: H = 80, depth: D = 60 } = drawing.overallDimensions || {};
  const isWindow = drawing.category === "aluminum_window";

  return (
    <g className="animate-fadeIn">
      {/* Quality Certification Stamp */}
      <g transform="translate(620, 30)">
        <circle cx="45" cy="45" r="38" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" />
        <circle cx="45" cy="45" r="34" fill="#0f172a" stroke="#eab308" strokeWidth="1" />
        <text x="45" y="38" fill="#eab308" fontSize="8.5" fontWeight="bold" textAnchor="middle">
          ANACLETO PRO
        </text>
        <text x="45" y="49" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">
          ★ CERTIFICADO ★
        </text>
        <text x="45" y="60" fill="#94a3b8" fontSize="7.5" textAnchor="middle">
          100% ENSAMBLADO
        </text>
      </g>

      {/* Assembled 2D/3D Object */}
      {isWindow ? (
        // Assembled Window
        <g>
          {/* Outer Frame (Aluminum) */}
          <rect x={x} y={y} width={boxW} height={boxH} fill="#0f172a" stroke="#d4af37" strokeWidth="3" rx="4" />
          {/* Inner Sash 1 (Left) */}
          <rect
            x={x + 10}
            y={y + 10}
            width={boxW / 2 - 5}
            height={boxH - 20}
            fill="url(#glass-reflect)"
            stroke="#64748b"
            strokeWidth="2"
            rx="2"
          />
          {/* Inner Sash 2 (Right) */}
          <rect
            x={x + boxW / 2 - 5}
            y={y + 10}
            width={boxW / 2 - 5}
            height={boxH - 20}
            fill="url(#glass-reflect)"
            stroke="#d4af37"
            strokeWidth="2"
            rx="2"
          />
          {/* Handle */}
          <rect x={x + boxW / 2 + 10} y={y + boxH / 2 - 15} width="6" height="30" fill="#d4af37" rx="3" />
          {/* Glass glare line */}
          <line x1={x + 20} y1={y + 20} x2={x + 60} y2={y + boxH - 30} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        </g>
      ) : (
        // Assembled Furniture / Architectural piece
        <g>
          {/* Top Board */}
          <rect x={x} y={y} width={boxW} height="16" fill="url(#gold-wood)" stroke="#fff" strokeWidth="1.2" rx="3" />
          {/* Left Leg */}
          <rect x={x + 10} y={y + 16} width="16" height={boxH - 16} fill="#8c6d37" stroke="#664d26" strokeWidth="1" />
          {/* Right Leg */}
          <rect x={x + boxW - 26} y={y + 16} width="16" height={boxH - 16} fill="#8c6d37" stroke="#664d26" strokeWidth="1" />
          {/* Apron / Crossbar */}
          <rect x={x + 26} y={y + 16} width={boxW - 52} height="16" fill="#a88440" stroke="#664d26" strokeWidth="1" />
          {/* Back shadow legs */}
          <rect x={x + 22} y={y + 16} width="12" height={boxH - 24} fill="#593e17" opacity="0.6" />
          <rect x={x + boxW - 34} y={y + 16} width="12" height={boxH - 24} fill="#593e17" opacity="0.6" />
        </g>
      )}

      {/* Final Dimension Lines */}
      {showDimensions && (
        <g>
          {/* Width */}
          <line x1={x} y1={y - 20} x2={x + boxW} y2={y - 20} stroke="#eab308" strokeWidth="1.5" markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
          <text x={centerX} y={y - 26} fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            {W} {drawing.unit} (Ancho Total)
          </text>

          {/* Height */}
          <line x1={x - 20} y1={y} x2={x - 20} y2={y + boxH} stroke="#eab308" strokeWidth="1.5" markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
          <text x={x - 28} y={centerY + 10} fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="end" fontFamily="monospace">
            {H} {drawing.unit} (Alto Total)
          </text>
        </g>
      )}

      {/* Piece Labels Callouts */}
      {showLabels && (
        <g>
          <circle cx={x + 18} cy={y + 8} r="8" fill="#eab308" />
          <text x={x + 18} y={y + 11} fill="#000" fontSize="9" fontWeight="bold" textAnchor="middle">
            1
          </text>

          <circle cx={x + 18} cy={y + boxH / 2} r="8" fill="#38bdf8" />
          <text x={x + 18} y={y + boxH / 2 + 3} fill="#000" fontSize="9" fontWeight="bold" textAnchor="middle">
            2
          </text>

          <circle cx={x + boxW - 18} cy={y + boxH / 2} r="8" fill="#38bdf8" />
          <text x={x + boxW - 18} y={y + boxH / 2 + 3} fill="#000" fontSize="9" fontWeight="bold" textAnchor="middle">
            3
          </text>
        </g>
      )}

      {/* Completion Banner */}
      <g transform={`translate(${centerX - 200}, ${y + boxH + 35})`}>
        <rect width="400" height="34" fill="#0f172a" stroke="#eab308" strokeWidth="1" rx="6" />
        <text x="200" y="21" fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle">
          ✓ ENSAMBLAJE FINALIZADO • TODAS LAS MEDIDAS VERIFICADAS
        </text>
      </g>
    </g>
  );
}
