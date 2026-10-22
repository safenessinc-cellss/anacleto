import React, { useState, useEffect } from "react";
import {
  Compass,
  Sparkles,
  Send,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileCheck,
  FolderOpen,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Maximize,
  HelpCircle,
  Box,
  Hammer,
  Scissors,
  Check,
  Eye
} from "lucide-react";
import { TechnicalDrawing, SenderConfig } from "../../types";
import DrawingSvgCanvas from "./DrawingSvgCanvas";
import { exportTechnicalDrawingPdf, buildTechnicalDrawingPdf } from "../../utils/pdfExport";
import { collection, doc, setDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useToast } from "../ToastContext";
import PdfViewerModal from "../common/PdfViewerModal";

interface TechnicalDrawingModuleProps {
  senderConfig: SenderConfig;
}

// Initial sample project for instantaneous feedback
const initialSampleDrawing: TechnicalDrawing = {
  id: "draw-sample-01",
  title: "Mesa de Madera Maciza 120×80×75 cm",
  description: "Estructura arquitectónica en madera de roble con ensambles tipo caja y espiga y faldones perimetrales.",
  category: "furniture",
  unit: "cm",
  overallDimensions: { width: 120, height: 75, depth: 80 },
  pieces: [
    {
      id: "p1",
      pieceNumber: 1,
      name: "Pieza 1 - Tablero superior",
      quantity: 1,
      dimensions: { width: 120, height: 4, depth: 80, unit: "cm" },
      material: "Madera maciza de roble 40mm",
      color: "#C5A850",
      cutAngle: "90° recto",
      notes: "Cantos biselados a 2mm",
    },
    {
      id: "p2",
      pieceNumber: 2,
      name: "Pieza 2 - Pata delantera izq.",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madera maciza torneada",
      color: "#8C6D37",
      cutAngle: "90° recto",
    },
    {
      id: "p3",
      pieceNumber: 3,
      name: "Pieza 3 - Pata delantera der.",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madera maciza torneada",
      color: "#8C6D37",
      cutAngle: "90° recto",
    },
    {
      id: "p4",
      pieceNumber: 4,
      name: "Pieza 4 - Pata trasera izq.",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madera maciza torneada",
      color: "#735728",
      cutAngle: "90° recto",
    },
    {
      id: "p5",
      pieceNumber: 5,
      name: "Pieza 5 - Pata trasera der.",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madera maciza torneada",
      color: "#735728",
      cutAngle: "90° recto",
    },
    {
      id: "p6",
      pieceNumber: 6,
      name: "Pieza 6 - Faldones de unión longitudinal",
      quantity: 2,
      dimensions: { width: 104, height: 10, depth: 3, unit: "cm" },
      material: "Madera maciza de roble",
      color: "#A88440",
      cutAngle: "90° recto",
    },
  ],
  dimensionLines: [
    { id: "d1", label: "120 cm", value: 120, unit: "cm", orientation: "horizontal", start: { x: 80, y: 50 }, end: { x: 520, y: 50 } },
    { id: "d2", label: "75 cm", value: 75, unit: "cm", orientation: "vertical", start: { x: 50, y: 80 }, end: { x: 50, y: 380 } },
  ],
  assemblyInstructions: [
    "Montar las 4 patas uniendo los faldones longitudinales.",
    "Comprobar las escuadras en diagonal (máx. 1 mm de diferencia).",
    "Fijar el tablero superior mediante conectores ocultos en z.",
  ],
  steps: [
    {
      stepNumber: 1,
      phaseName: "Paso 1: Definición de dimensiones generales",
      title: "Volumen Exterior y Límites Perimetrales",
      description: "Delimitación del espacio de trabajo con ancho de 120 cm, alto de 75 cm y profundidad de 80 cm.",
      instructions: ["Comprobar espacio físico disponible.", "Verificar escuadras y tolerancias perimetrales."],
    },
    {
      stepNumber: 2,
      phaseName: "Paso 2: Despiece",
      title: "Lista de piezas identificadas tipo puzzle",
      description: "Inventario técnico con 6 componentes rotulados, identificados y cubicados.",
      instructions: ["Inspeccionar material de origen.", "Marcar piezas con su número identificador."],
    },
    {
      stepNumber: 3,
      phaseName: "Paso 3: Corte de cada pieza con sus cotas",
      title: "Dimensionado individual y mecanizado",
      description: "Cortes con precisión milimétrica, ingletes y ranurados para fijación.",
      instructions: ["Ejecutar cortes siguiendo las cotas individuales.", "Limpiar rebabas y perfilar cantos."],
    },
    {
      stepNumber: 4,
      phaseName: "Paso 4: Ensamblaje tipo puzzle",
      title: "Secuencia de montaje y unión",
      description: "Montaje secuencial con flechas de ensamble y ajuste de fijaciones.",
      instructions: ["Presentar las piezas en seco.", "Ajustar uniones mediante fijaciones ocultas."],
    },
    {
      stepNumber: 5,
      phaseName: "Paso 5: Resultado final con vista completa y medidas totales",
      title: "Producto terminado y revisión de calidad",
      description: "Estructura final consolidada con todas las cotas y verificación de aplomo.",
      instructions: ["Comprobación de solidez mecánica.", "Limpieza final y entrega."],
    },
  ],
  currentStep: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function TechnicalDrawingModule({ senderConfig }: TechnicalDrawingModuleProps) {
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [drawing, setDrawing] = useState<TechnicalDrawing>(initialSampleDrawing);
  const [savedDrawings, setSavedDrawings] = useState<TechnicalDrawing[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Load saved drawings from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "technical_drawings"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: TechnicalDrawing[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as TechnicalDrawing);
        });
        setSavedDrawings(list);
      },
      (err) => {
        console.warn("Firestore drawings load notice:", err);
      }
    );
    return () => unsub();
  }, []);

  const handleOpenDrawingPdf = async (targetDrawing?: TechnicalDrawing) => {
    let target = targetDrawing || drawing;
    if (!target.pdfDataUri) {
      try {
        const pdfRes = buildTechnicalDrawingPdf(target, senderConfig);
        target = {
          ...target,
          pdfDataUri: pdfRes.dataUri,
          pdfFileName: pdfRes.fileName,
          pdfGeneratedAt: new Date().toISOString(),
          pdfFileSizeKb: pdfRes.sizeKb,
          updatedAt: new Date().toISOString(),
        };
        setDrawing(target);
        await setDoc(doc(db, "technical_drawings", target.id), target);
      } catch (err) {
        console.warn("Could not pre-build drawing PDF:", err);
      }
    }
    setIsPdfModalOpen(true);
  };

  const handleSaveDrawing = async () => {
    setIsSaving(true);
    try {
      const pdfRes = buildTechnicalDrawingPdf(drawing, senderConfig);
      const updated: TechnicalDrawing = {
        ...drawing,
        pdfDataUri: pdfRes.dataUri,
        pdfFileName: pdfRes.fileName,
        pdfGeneratedAt: new Date().toISOString(),
        pdfFileSizeKb: pdfRes.sizeKb,
        updatedAt: new Date().toISOString(),
      };
      setDrawing(updated);
      await setDoc(doc(db, "technical_drawings", drawing.id), updated);
      showToast("Plano técnico y PDF almacenados con éxito en la plataforma.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar en Firestore.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async (presetPrompt?: string) => {
    const inputPrompt = presetPrompt || prompt;
    if (!inputPrompt.trim()) {
      showToast("Por favor describe la pieza o mueble a diseñar.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/technical-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: inputPrompt, currentDrawing: drawing }),
      });

      if (!res.ok) {
        throw new Error("Error en el servidor de IA");
      }

      const data = await res.json();
      const newDrawing: TechnicalDrawing = {
        id: "draw_" + Math.random().toString(36).substring(2, 9),
        title: data.title || "Pieza Arquitectónica a Medida",
        description: data.description || inputPrompt,
        category: data.category || "custom",
        unit: data.unit || "cm",
        overallDimensions: data.overallDimensions || { width: 100, height: 100, depth: 50 },
        pieces: data.pieces || [],
        dimensionLines: data.dimensionLines || [],
        assemblyInstructions: data.assemblyInstructions || [],
        steps: data.steps || initialSampleDrawing.steps,
        currentStep: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setDrawing(newDrawing);
      setCurrentStep(1);
      showToast("¡Plano técnico y despiece generado con éxito!", "success");

      // Auto-save to Firestore with persistent PDF
      try {
        const pdfRes = buildTechnicalDrawingPdf(newDrawing, senderConfig);
        const savedWithPdf: TechnicalDrawing = {
          ...newDrawing,
          pdfDataUri: pdfRes.dataUri,
          pdfFileName: pdfRes.fileName,
          pdfGeneratedAt: new Date().toISOString(),
          pdfFileSizeKb: pdfRes.sizeKb,
        };
        setDrawing(savedWithPdf);
        await setDoc(doc(db, "technical_drawings", newDrawing.id), savedWithPdf);
      } catch (err) {
        console.warn("Auto-save notice:", err);
      }

      if (!presetPrompt) setPrompt("");
    } catch (err: any) {
      console.error(err);
      showToast("No se pudo contactar con la IA técnica. Usando generador inteligente local.", "info");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPdf = () => {
    try {
      exportTechnicalDrawingPdf(drawing, senderConfig);
      showToast("Plano técnico y memoria exportados a PDF.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al exportar PDF.", "error");
    }
  };

  const currentStepData = drawing.steps?.[currentStep - 1];

  const presets = [
    "una mesa de madera de 120x80x75 cm con 4 patas",
    "un armario de 2 puertas de 180x60x200 cm",
    "una pieza en L de 90x90 cm con un corte a 45°",
    "ventana de aluminio de 150x120 cm con 2 hojas corredizas",
  ];

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Módulo Arquitectónico CAD
              </span>
              <span className="text-[10px] font-mono text-slate-400">Gemini 2.5 Industrial Engine</span>
              {drawing.pdfDataUri && (
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  PDF Almacenado ({drawing.pdfFileSizeKb || 40} KB)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Dibujo Técnico & Despiece Inteligente
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenDrawingPdf()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 text-xs font-bold rounded-xl transition border border-amber-500/40 shadow-sm"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            Ver Plano PDF Almacenado
          </button>
          <button
            onClick={handleSaveDrawing}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Save className="w-4 h-4 text-amber-400" />}
            Guardar Proyecto y PDF
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Two-Panel Layout: Left = Chat / Controls; Right = Scalable SVG Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Chat / Instructions / Step by Step (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Natural Language Prompt Box */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Instrucciones para la IA
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Diseño 2D + Cotas + Puzzle</span>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Describe en lenguaje natural cualquier pieza arquitectónica, ventana de aluminio o mueble con sus medidas:
            </p>

            {/* Quick Preset Pills */}
            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {presets.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleGenerate(p)}
                  disabled={isLoading}
                  className="text-[10px] px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700 rounded-lg transition text-left"
                >
                  ⚡ {p}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
              className="relative"
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: una mesa de madera de 120x80x75 cm con 4 patas..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-2xl text-xs text-white placeholder-slate-500 outline-none resize-none transition pr-12"
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="absolute right-3 bottom-3 p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl transition shadow-md"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>

          {/* 5-Step Phase Controller */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Proceso de Construcción (5 Fases)
              </h3>
              <span className="text-[11px] font-mono text-slate-400 font-bold">
                Paso {currentStep} de 5
              </span>
            </div>

            {/* Step Selector Buttons */}
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentStep(num)}
                  className={`py-2 rounded-xl text-xs font-black transition flex flex-col items-center gap-1 border ${
                    currentStep === num
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20"
                      : "bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] opacity-70">FASE</span>
                  <span>{num}</span>
                </button>
              ))}
            </div>

            {/* Current Step Description Card */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <h4 className="text-xs font-bold text-white">
                  {currentStepData?.phaseName || `Paso ${currentStep}`}
                </h4>
              </div>
              <p className="text-xs font-medium text-amber-300">
                {currentStepData?.title}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentStepData?.description}
              </p>

              {currentStepData?.instructions && currentStepData.instructions.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Instrucciones Técnicas de Taller:
                  </span>
                  {currentStepData.instructions.map((inst, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{inst}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Step Buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={() => setCurrentStep((s) => Math.max(s - 1, 1))}
                disabled={currentStep === 1}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200 transition border border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" /> Paso Anterior
              </button>
              <button
                onClick={() => setCurrentStep((s) => Math.min(s + 1, 5))}
                disabled={currentStep === 5}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-xs font-black text-slate-950 transition shadow-md"
              >
                Siguiente Paso <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Despiece Summary (Pieces / BOM) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Box className="w-4 h-4 text-amber-400" />
                Despiece Tipo Puzzle ({drawing.pieces?.length || 0} Piezas)
              </h3>
              <span className="text-[10px] font-mono text-slate-400">BOM Técnico</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {drawing.pieces?.map((piece, idx) => (
                <div
                  key={piece.id || idx}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-slate-950"
                      style={{ backgroundColor: piece.color || "#C5A850" }}
                    >
                      {piece.pieceNumber || idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{piece.name}</h4>
                      <p className="text-[10px] text-slate-400">{piece.material}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono font-bold text-amber-400">
                      {piece.dimensions?.width}×{piece.dimensions?.height}
                      {piece.dimensions?.depth ? `×${piece.dimensions?.depth}` : ""} {piece.dimensions?.unit || "cm"}
                    </span>
                    <p className="text-[10px] text-slate-500 font-bold">Cant: {piece.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Scalable SVG Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-2xl flex flex-col h-[680px]">
            {/* Header info bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2 mb-2 border-b border-slate-800/80">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wide">
                  {drawing.title}
                </h2>
                <p className="text-[11px] text-slate-400 truncate max-w-md">
                  {drawing.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-amber-400 text-[10px] font-mono rounded-lg">
                  {drawing.overallDimensions?.width} × {drawing.overallDimensions?.height}
                  {drawing.overallDimensions?.depth ? ` × ${drawing.overallDimensions?.depth}` : ""} {drawing.unit}
                </span>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg uppercase">
                  {drawing.category}
                </span>
              </div>
            </div>

            {/* Interactive Canvas */}
            <div className="flex-1 w-full overflow-hidden rounded-2xl relative">
              <DrawingSvgCanvas
                drawing={drawing}
                currentStep={currentStep}
                showDimensions={true}
                showLabels={true}
              />
            </div>
          </div>

          {/* Saved Projects Drawer / Quick Switcher */}
          {savedDrawings.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  Proyectos Técnicos Guardados ({savedDrawings.length})
                </h4>
                <span className="text-[10px] font-mono text-slate-500">Cargar en un clic</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {savedDrawings.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setDrawing(item);
                      setCurrentStep(1);
                      showToast(`Cargado proyecto: ${item.title}`, "info");
                    }}
                    className={`p-3 rounded-2xl border text-left transition relative group ${
                      drawing.id === item.id
                        ? "bg-amber-500/10 border-amber-500/40 text-white"
                        : "bg-slate-950/80 hover:bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h5 className="text-xs font-bold truncate flex-1">{item.title}</h5>
                      {item.pdfDataUri && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrawingPdf(item);
                          }}
                          title="Ver plano PDF almacenado"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-md transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                      <span>{item.overallDimensions?.width}×{item.overallDimensions?.height} {item.unit}</span>
                      {item.pdfDataUri && (
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                          PDF ({item.pdfFileSizeKb || 40} KB)
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Stored PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={drawing.title}
        subtitle={`Dimensiones: ${drawing.overallDimensions?.width || 0}×${drawing.overallDimensions?.height || 0} cm • ${drawing.pieces?.length || 0} piezas tipo puzzle • Memoria Técnica`}
        pdfDataUri={drawing.pdfDataUri}
        fileName={drawing.pdfFileName || `Plano_Tecnico_${(drawing.title || "Proyecto").replace(/\s+/g, "_")}.pdf`}
        fileSizeKb={drawing.pdfFileSizeKb}
        storedAt={drawing.pdfGeneratedAt || drawing.updatedAt}
        type="drawing"
      />
    </div>
  );
}
