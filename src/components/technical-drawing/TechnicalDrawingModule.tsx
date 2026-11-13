import React, { useState, useEffect } from "react";
import {
  Compass,
  Sparkles,
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
  Eye,
  Plus,
  Trash2,
  FileText
} from "lucide-react";
import { TechnicalDrawing, SenderConfig, Quote } from "../../types";
import DrawingSvgCanvas from "./DrawingSvgCanvas";
import DrawingThreePreview from "./DrawingThreePreview";
import ManufacturingRoute from "../production/ManufacturingRoute";
import { exportArchitecturalSheetPdf, exportTechnicalDrawingPdf, buildTechnicalDrawingPdf } from "../../utils/pdfExport";
import { downloadTechnicalDrawingDxf } from "../../utils/dxfExport";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { db, storage } from "../../firebase";
import { useToast } from "../ToastContext";
import { sanitizeFirestoreData } from "../../utils/firestorePayloads";
import PdfViewerModal from "../common/PdfViewerModal";
import { buildParametricDrawing, isAluminumPrompt, localParametricSpec, type ParametricWindowSpec } from "../../utils/parametricCad";
import { estimatedCatalogPrice, readAluminumPricePerKg, writeAluminumPricePerKg } from "../../utils/catalogPricing";
import { compactQuoteForFirestore, withoutHeavyInlineData } from "../../utils/firestorePayloads";
import { buildArchitecturalDrawingSheetSvg } from "../../utils/architecturalSvg";

interface TechnicalDrawingModuleProps {
  senderConfig: SenderConfig;
  language?: string;
}

// Initial sample project for instantaneous feedback
const furnitureSampleDrawing: TechnicalDrawing = {
  id: "draw-sample-01",
  title: "Mesa de Madeira Maciça 120×80×75 cm",
  description: "Estrutura arquitetônica em madeira de carvalho com encaixes tipo caixa e espiga e saias perimetrais.",
  category: "furniture",
  unit: "cm",
  overallDimensions: { width: 120, height: 75, depth: 80 },
  pieces: [
    {
      id: "p1",
      pieceNumber: 1,
      name: "Peça 1 - Tampo superior",
      quantity: 1,
      dimensions: { width: 120, height: 4, depth: 80, unit: "cm" },
      material: "Madeira maciça de carvalho 40mm",
      color: "#C5A850",
      cutAngle: "90° reto",
      notes: "Cantos biselados em 2 mm",
    },
    {
      id: "p2",
      pieceNumber: 2,
      name: "Peça 2 - Perna dianteira esquerda",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madeira maciça torneada",
      color: "#8C6D37",
      cutAngle: "90° reto",
    },
    {
      id: "p3",
      pieceNumber: 3,
      name: "Peça 3 - Perna dianteira direita",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madeira maciça torneada",
      color: "#8C6D37",
      cutAngle: "90° reto",
    },
    {
      id: "p4",
      pieceNumber: 4,
      name: "Peça 4 - Perna traseira esquerda",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madeira maciça torneada",
      color: "#735728",
      cutAngle: "90° reto",
    },
    {
      id: "p5",
      pieceNumber: 5,
      name: "Peça 5 - Perna traseira direita",
      quantity: 1,
      dimensions: { width: 8, height: 71, depth: 8, unit: "cm" },
      material: "Madeira maciça torneada",
      color: "#735728",
      cutAngle: "90° reto",
    },
    {
      id: "p6",
      pieceNumber: 6,
      name: "Peça 6 - Travessas longitudinais de união",
      quantity: 2,
      dimensions: { width: 104, height: 10, depth: 3, unit: "cm" },
      material: "Madeira maciça de carvalho",
      color: "#A88440",
      cutAngle: "90° reto",
    },
  ],
  dimensionLines: [
    { id: "d1", label: "120 cm", value: 120, unit: "cm", orientation: "horizontal", start: { x: 80, y: 50 }, end: { x: 520, y: 50 } },
    { id: "d2", label: "75 cm", value: 75, unit: "cm", orientation: "vertical", start: { x: 50, y: 80 }, end: { x: 50, y: 380 } },
  ],
  assemblyInstructions: [
    "Montar as quatro pernas unindo as travessas longitudinais.",
    "Conferir o esquadro pelas diagonais (diferença máxima de 1 mm).",
    "Fixar o tampo superior com conectores ocultos em Z.",
  ],
  steps: [
    {
      stepNumber: 1,
      phaseName: "Passo 1: Definição de dimensões gerais",
      title: "Volume Exterior e Limites Perimetrais",
      description: "Delimitação do espaço de trabalho com largura de 120 cm, altura de 75 cm e profundidade de 80 cm.",
      instructions: ["Verificar espaço físico disponível.", "Verificar esquadros e tolerâncias perimetrais."],
    },
    {
      stepNumber: 2,
      phaseName: "Passo 2: Lista de componentes",
      title: "Lista de peças identificadas para montagem",
      description: "Inventário técnico com seis componentes identificados, etiquetados e dimensionados.",
      instructions: ["Inspecionar o material de origem.", "Marcar as peças com seus respectivos números de identificação."],
    },
    {
      stepNumber: 3,
      phaseName: "Passo 3: Corte de cada peça com suas medidas",
      title: "Dimensionamento individual e usinagem",
      description: "Cortes com precisão milimétrica, meia-esquadria e ranhuras para fixação.",
      instructions: ["Executar os cortes conforme as medidas individuais.", "Remover rebarbas e fazer o acabamento das bordas."],
    },
    {
      stepNumber: 4,
      phaseName: "Passo 4: Montagem por encaixe",
      title: "Sequência de montagem e união",
      description: "Montagem sequencial com indicações de encaixe e ajuste das fixações.",
      instructions: ["Posicionar as peças sem fixação definitiva.", "Ajustar as uniões com fixadores ocultos."],
    },
    {
      stepNumber: 5,
      phaseName: "Passo 5: Resultado final com vista completa e medidas totais",
      title: "Produto finalizado e inspeção de qualidade",
      description: "Estrutura final montada, com todas as medidas e conferência de alinhamento.",
      instructions: ["Verificação da resistência mecânica.", "Limpeza final e entrega."],
    },
  ],
  currentStep: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultCadPrompt = "Janela de Correr 2 Folhas - Linha Suprema - 1500x1200mm - Vidro Temperado 8mm";
const defaultCadSpec = {
  tipologia: "janela_correr",
  linha_aluminio: "Linha Suprema",
  cor_perfil: "#9da8ae",
  cor_vidro: "incolor",
  largura_mm: 1500,
  altura_mm: 1200,
  folhas: 2,
  modulo_fixo: false,
  tipo_vidro: "temperado",
  espessura_mm: 8,
  abertura: "central",
} as const;
const initialSampleDrawing: TechnicalDrawing = {
  ...buildParametricDrawing(defaultCadSpec, defaultCadPrompt),
  id: "draw-sample-01",
  title: defaultCadPrompt,
  description: defaultCadPrompt,
};

function enrichDrawingBudget(
  budget: NonNullable<TechnicalDrawing["budget"]>,
  catalog: any[],
  aluminumPricePerKg: number,
): NonNullable<TechnicalDrawing["budget"]> {
  const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const items = budget.items.map((item) => {
    const itemText = normalize(item.description);
    const terms = itemText.split(/\s+/).filter((term) => term.length >= 4);
    const match = catalog.find((row) =>
      (item.catalogItemId && row.id === item.catalogItemId) ||
      (item.sku && normalize(row.sku || row.code) === normalize(item.sku))
    ) || catalog.map((row) => {
      const rowText = normalize(`${row.name || ""} ${row.description || ""} ${row.code || ""} ${row.sku || ""}`);
      const score = terms.reduce((sum, term) => sum + (rowText.includes(term) ? 1 : 0), 0);
      return { row, score };
    }).filter((candidate) => candidate.score >= Math.min(2, terms.length))
      .sort((a, b) => b.score - a.score)[0]?.row;
    const catalogPrice = Number(match?.price || 0);
    const estimated = match ? estimatedCatalogPrice(match, aluminumPricePerKg, item.cutLengthMm) : undefined;
    const unitPrice = Number(item.unitPrice) > 0 ? Number(item.unitPrice) : catalogPrice > 0 ? catalogPrice : estimated || 0;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return {
      ...item,
      catalogItemId: item.catalogItemId || match?.id || "",
      sku: item.sku || match?.sku || match?.code || "",
      imageUrl: item.imageUrl || match?.thumbnailDataUrl || match?.imageUrl || "",
      unitPrice,
      quantity,
      subtotal: Number((quantity * unitPrice).toFixed(2)),
      priceSource: unitPrice <= 0 ? "pending" : catalogPrice > 0 ? "catalog" : Number(item.unitPrice) > 0 ? item.priceSource || "catalog" : "estimated",
    };
  });
  const subtotal = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const labor = Math.max(0, Number(budget.labor || 0));
  const marginRate = Math.max(0, Number(budget.marginRate || 0));
  const margin = Number((budget.margin ?? (subtotal + labor) * marginRate / 100).toFixed(2));
  const freight = Math.max(0, Number(budget.freight || 0));
  const taxRate = Math.max(0, Number(budget.taxRate || 0));
  const taxAmount = Number(((subtotal + labor + margin + freight) * taxRate / 100).toFixed(2));
  return { ...budget, items, subtotal, labor, marginRate, margin, freight, taxRate, taxAmount, total: Number((subtotal + labor + margin + freight + taxAmount).toFixed(2)) };
}


function buildLocalTechnicalDrawing(input: string): TechnicalDrawing {
  const normalized = input.toLowerCase();
  const isWindow = /janela|ventana|esquadria|corredi[cç]a/.test(normalized);
  const isDoor = /porta|puerta/.test(normalized);
  const isTable = /mesa|table/.test(normalized);
  const isWardrobe = /arm[aá]rio|closet|guarda roupa/.test(normalized);
  // Aceita medidas no formato 120x80x75, inclusive com unidade após cada número.
  const dimensionText = normalized.replace(/(\d)\s*(?:mm|cm)\b/g, "$1");
  const numbers = [...dimensionText.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?))?/g)];
  const parsed = numbers[0];
  const unit = /\bmm\b|milímetro|milimetro/.test(normalized) ? "mm" : "cm";
  const factor = unit === "mm" ? 10 : 1;
  const toNumber = (value?: string) => value ? Number(value.replace(",", ".")) : 0;
  const namedDimension = (labels: string) => {
    const match = normalized.match(new RegExp("(?:\\b(?:" + labels + ")\\b)\\s*(?:de|:|=)?\\s*(\\d+(?:[.,]\\d+)?)"));
    return match ? toNumber(match[1]) : 0;
  };
  const first = parsed ? toNumber(parsed[1]) : 0;
  const second = parsed ? toNumber(parsed[2]) : 0;
  const third = parsed?.[3] ? toNumber(parsed[3]) : 0;
  const width = Math.max(1, namedDimension("largura|width") || first || 100);
  const heightFromLabel = namedDimension("altura|alto|height");
  const depthFromLabel = namedDimension("profundidade|fundo|depth");
  // Para mesas, a ordem usual é largura × profundidade × altura.
  const height = Math.max(1, heightFromLabel || (isTable && third ? third : second) || 100);
  const depth = Math.max(1, depthFromLabel || (isTable && third ? second : third) || (isWindow || isDoor ? 12 * factor : 50 * factor));
  const category: TechnicalDrawing["category"] = isWindow ? "aluminum_window" : isDoor ? "glass_door" : isTable || isWardrobe ? "furniture" : "custom";
  const title = isWindow ? "Esquadria / janela sob medida" : isDoor ? "Porta sob medida" : isTable ? "Mesa sob medida" : isWardrobe ? "Armário sob medida" : "Projeto técnico sob medida";
  const material = isWindow || isDoor ? "Alumínio / vidro — especificação a validar" : "Material a definir pelo responsável técnico";
  const piece = (id: string, name: string, qty: number, w: number, h: number, d: number, color: string): TechnicalDrawing["pieces"][number] => ({
    id, pieceNumber: Number(id.replace("p", "")), name, quantity: qty,
    dimensions: { width: w, height: h, depth: d, thickness: d, unit },
    material, color, cutAngle: /45|inglete|mitre/.test(normalized) ? "Ângulo solicitado: validar corte a 45°" : "90° — validar antes de fabricar",
    notes: "Dimensão preliminar gerada localmente; confirmar medidas, folgas e sistema de perfil antes da produção."
  });
  let pieces: TechnicalDrawing["pieces"];
  if (isTable) {
    const leg = Math.max(1, height - 4);
    pieces = [
      piece("p1", "Tampo superior", 1, width, 4, depth, "#C5A850"),
      piece("p2", "Pés / montantes", 4, 8, leg, 8, "#8C6D37"),
      piece("p3", "Travessas longitudinais", 2, Math.max(1, width - 16), 10, 3, "#A88440"),
      piece("p4", "Travessas transversais", 2, Math.max(1, depth - 16), 10, 3, "#735728")
    ];
  } else if (isWindow || isDoor) {
    pieces = [
      piece("p1", "Perfil superior do marco", 1, width, 8, depth, "#94A3B8"),
      piece("p2", "Perfil inferior do marco", 1, width, 8, depth, "#64748B"),
      piece("p3", "Montantes laterais", 2, 8, height, depth, "#475569"),
      piece("p4", "Folhas / painéis", isWindow ? 2 : 1, Math.max(1, width / (isWindow ? 2 : 1) - 2), Math.max(1, height - 12), 4, "#60A5FA")
    ];
  } else if (isWardrobe) {
    pieces = [
      piece("p1", "Lateral esquerda", 1, depth, height, 2, "#64748B"),
      piece("p2", "Lateral direita", 1, depth, height, 2, "#64748B"),
      piece("p3", "Tampo e base", 2, Math.max(1, width - 4), depth, 2, "#94A3B8"),
      piece("p4", "Portas frontais", 2, Math.max(1, width / 2 - 2), Math.max(1, height - 6), 2, "#C5A850")
    ];
  } else {
    pieces = [
      piece("p1", "Componente principal", 1, width, height, depth, "#C5A850"),
      piece("p2", "Elemento de suporte", 2, Math.max(1, width / 2), Math.max(1, height), Math.max(1, depth / 4), "#60A5FA"),
      piece("p3", "Reforços / uniões", 2, Math.max(1, width / 5), Math.max(1, height / 5), Math.max(1, depth / 5), "#94A3B8")
    ];
  }
  const steps = furnitureSampleDrawing.steps.map((step, index) => ({
    ...step,
    stepNumber: index + 1,
    phaseName: ["Definição das dimensões gerais", "Lista de peças e componentes", "Corte e cotagem individual", "Encaixe e montagem", "Vista final e conferência"][index],
    title: ["Dimensões gerais", "Lista de peças", "Corte de cada peça", "Montagem / encaixe", "Resultado final"][index],
    description: [
      `Dimensões informadas: largura ${width} × altura ${height} × profundidade ${depth} ${unit}.`,
      `Foram estruturados ${pieces.length} grupos de componentes para detalhamento.`,
      "Cotas e ângulos são preliminares e precisam de validação técnica.",
      "Verificar sequência, esquadro, folgas e fixações adequadas ao material.",
      "Conferir medidas reais e tolerâncias antes de liberar para fabricação."
    ][index],
    instructions: [
      ["Confirmar largura, altura e profundidade no local."],
      ["Conferir materiais, quantidades e identificadores."],
      ["Validar espessuras, folgas, ângulos e ferramentas."],
      ["Montar a seco e verificar alinhamento e esquadro."],
      ["Aprovar o desenho revisado antes da fabricação."]
    ][index]
  }));
  return {
    id: `draw_local_${Date.now()}`, title, description: `Projeto preliminar criado a partir de: ${input}`,
    isDraft: true, status: "PRELIMINARY_CONTINGENCY", draftStatus: "preliminary",
    draftLabel: "BORRADOR TÉCNICO - NO VÁLIDO PARA FABRICACIÓN",
    category, unit, overallDimensions: { width, height, depth }, pieces,
    dimensionLines: [
      { id: "d1", label: `${width} ${unit}`, value: width, unit, orientation: "horizontal", start: { x: 80, y: 50 }, end: { x: 520, y: 50 } },
      { id: "d2", label: `${height} ${unit}`, value: height, unit, orientation: "vertical", start: { x: 50, y: 80 }, end: { x: 50, y: 380 } },
      { id: "d3", label: `${depth} ${unit}`, value: depth, unit, orientation: "diagonal", start: { x: 540, y: 80 }, end: { x: 570, y: 50 } }
    ],
    assemblyInstructions: ["Conferir todas as dimensões no local.", "Validar componentes e materiais.", "Executar corte apenas após aprovação técnica.", "Montar e verificar esquadro e folgas.", "Registrar revisão final do projeto."],
    steps, currentStep: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}

export default function TechnicalDrawingModule({ senderConfig, language = "pt"}: TechnicalDrawingModuleProps) {
  // Aguardar a autenticação antes de iniciar os listeners do Firestore
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthReady(!!u));
    return () => unsub();
  }, []);

  const { showToast } = useToast();
  const [prompt, setPrompt] = useState(defaultCadPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [drawing, setDrawing] = useState<TechnicalDrawing>(initialSampleDrawing);
  const [activeView, setActiveView] = useState<"list" | "studio">("studio");
  const [savedDrawings, setSavedDrawings] = useState<TechnicalDrawing[]>([]);
  const [projects, setProjects] = useState<Array<{id:string;name:string}>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [supplierCatalog, setSupplierCatalog] = useState<any[]>([]);
  const [aluminumPricePerKg, setAluminumPricePerKg] = useState(readAluminumPricePerKg);
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [activeToolTab, setActiveToolTab] = useState<"ai" | "saved">("ai");
  const [aiDrawing, setAiDrawing] = useState<TechnicalDrawing | null>(null);
  const [aiTitle, setAiTitle] = useState("");
  const [selectedParametricModelId, setSelectedParametricModelId] = useState("");

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), (snap) => {
      setProjects(snap.docs.map((item) => ({ id: item.id, name: String(item.data().name || "Projeto sem nome") })));
    }, (err) => console.warn("Projects list load notice:", err));
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(collection(db, "catalog"), (snap) => {
      const loaded = snap.docs.map((item) => ({ id: item.id, ...item.data(), source: "catalog" }));
      setCatalogItems(loaded);
      setSupplierCatalog((current) => [...current.filter((item) => item.source !== "catalog"), ...loaded]);
    }, (err) => console.warn("Firestore catalog load notice:", err));
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(collection(db, "supplier_catalog"), (snap) => {
      const loaded = snap.docs.map((item) => ({ id: item.id, ...item.data(), source: "supplier_catalog" }));
      setSupplierCatalog((current) => [...current.filter((item) => item.source !== "supplier_catalog"), ...loaded]);
    }, (err) => {
      console.error("Supplier catalog load failed in technical drawing module:", err);
      showToast("Não foi possível carregar o catálogo de fornecedores para o orçamento CAD.", "error");
    });
  }, [authReady, showToast]);

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(collection(db, "registry_items"), (snap) => {
      const loaded = snap.docs.map((item) => ({ id: item.id, ...item.data(), name: item.data().name || item.data().description || "Item sem nome", source: "registry_items" }));
      setSupplierCatalog((current) => [...current.filter((item) => item.source !== "registry_items"), ...loaded]);
    }, (err) => {
      console.error("Registry catalog load failed in technical drawing module:", err);
      showToast("Não foi possível carregar os itens cadastrados para o orçamento CAD.", "error");
    });
  }, [authReady, showToast]);

  useEffect(() => {
    if (!supplierCatalog.length && !catalogItems.length) return;
    setDrawing((current) => {
      if (!current.parametricSpec || !current.budget) return current;
      return {
        ...current,
        budget: enrichDrawingBudget(current.budget, [...catalogItems, ...supplierCatalog], aluminumPricePerKg),
      };
    });
  }, [catalogItems, supplierCatalog, aluminumPricePerKg]);

  const updateBudget = (change: (budget: NonNullable<TechnicalDrawing["budget"]>) => NonNullable<TechnicalDrawing["budget"]>) => {
    setDrawing((current) => {
      const currentBudget = current.budget || { currency: "BRL", items: [], subtotal: 0, labor: 0, total: 0 };
      const next = change(currentBudget);
      const subtotal = Number(next.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0).toFixed(2));
      const labor = Math.max(0, Number(next.labor || 0));
      const marginRate = Math.max(0, Number(next.marginRate || 0));
      const margin = Number(((subtotal + labor) * marginRate / 100).toFixed(2));
      const freight = Math.max(0, Number(next.freight || 0));
      const taxRate = Math.max(0, Number(next.taxRate || 0));
      const taxAmount = Number(((subtotal + labor + margin + freight) * taxRate / 100).toFixed(2));
      return { ...current, budget: { ...next, subtotal, labor, marginRate, margin, freight, taxRate, taxAmount, total: Number((subtotal + labor + margin + freight + taxAmount).toFixed(2)) } };
    });
  };

  const updateBudgetItem = (itemId: string, field: "description" | "sku" | "quantity" | "unitPrice" | "cutLengthMm", value: string) => {
    updateBudget((budget) => ({
      ...budget,
      items: budget.items.map((item) => item.id === itemId ? { ...item, [field]: ["quantity", "unitPrice", "cutLengthMm"].includes(field) ? Number(value) || 0 : value } : item),
    }));
  };

  const rebuildParametricPreview = (
    current: TechnicalDrawing,
    spec: ParametricWindowSpec,
    description: string,
  ): TechnicalDrawing => {
    const updated = buildParametricDrawing(spec, description, [...catalogItems, ...supplierCatalog]);
    const generatedIds = new Set(updated.budget?.items.map((item) => item.id) || []);
    const retainedItems = (current.budget?.items || []).filter((item) =>
      !item.pieceId && !item.id.startsWith("budget-") && !generatedIds.has(item.id)
    );
    const budget = updated.budget && current.budget
      ? enrichDrawingBudget({
        ...updated.budget,
        items: [...updated.budget.items, ...retainedItems],
        labor: current.budget.labor,
        marginRate: current.budget.marginRate,
        freight: current.budget.freight,
        taxRate: current.budget.taxRate,
      }, [...catalogItems, ...supplierCatalog], aluminumPricePerKg)
      : updated.budget;
    return {
      ...updated,
      ...(budget ? { budget } : {}),
      id: current.id === "draw-sample-01" ? `draw_local_${Date.now()}` : current.id,
      createdAt: current.createdAt || updated.createdAt,
      updatedAt: new Date().toISOString(),
      projectId: current.projectId,
      projectName: current.projectName,
    };
  };

  const promptForSpec = (spec: ParametricWindowSpec) => {
    const typeLabels: Record<ParametricWindowSpec["tipologia"], string> = {
      janela_correr: "Janela de Correr",
      porta_correr: "Porta de Correr",
      porta_giro: "Porta de Giro",
      porta_pivotante: "Porta Pivotante",
      maxim_ar: "Maxim-ar",
      basculante: "Basculante",
      box_banheiro: "Box de Banheiro",
    };
    const colorLabel = /branc/i.test(spec.cor_perfil) ? "Branco"
      : /pret|#1f2937/i.test(spec.cor_perfil) ? "Preto"
      : /bronze|#80552f/i.test(spec.cor_perfil) ? "Bronze"
      : "Anodizado Natural";
    return `${typeLabels[spec.tipologia]} ${spec.folhas} Folhas - ${spec.linha_aluminio} - ${spec.largura_mm}x${spec.altura_mm}mm - ${spec.cor_perfil === "#f8fafc" ? "Branco" : colorLabel} - Vidro ${spec.tipo_vidro} ${spec.cor_vidro || ""} ${spec.espessura_mm}mm`.replace(/\s+/g, " ").trim();
  };

  const updateDrawingSpec = (patch: Partial<ParametricWindowSpec>) => {
    if (drawing.approvedSnapshotId || drawing.status === "APPROVED_FOR_MANUFACTURING") return;
    const spec = { ...(drawing.parametricSpec || defaultCadSpec), ...patch };
    if (spec.tipologia === "box_banheiro") spec.folhas = Math.max(2, spec.folhas);
    const command = promptForSpec(spec);
    setDrawing((current) => rebuildParametricPreview(current, spec, command));
    setPrompt(command);
  };


  const updateParametricField = (field: "largura_mm" | "altura_mm" | "folhas", value: number) => {
    if (!Number.isFinite(value) || value <= 0 || drawing.approvedSnapshotId || drawing.status === "APPROVED_FOR_MANUFACTURING") return;
    const minValue = field === "folhas" && drawing.parametricSpec?.tipologia === "box_banheiro" ? 2 : 1;
    const boundedValue = field === "folhas" ? Math.min(8, Math.max(minValue, value)) : Math.min(20_000, value);
    const nextValue = Math.round(boundedValue);
    updateDrawingSpec(field === "largura_mm" ? { largura_mm: nextValue }
      : field === "altura_mm" ? { altura_mm: nextValue }
      : { folhas: nextValue });
  };

  const addSupplierBudgetItem = (productId: string) => {
    const product = supplierCatalog.find((item) => item.id === productId || `${item.source}:${item.id}` === productId);
    if (!product) return;
    if (drawing.approvedSnapshotId || drawing.status === "APPROVED_FOR_MANUFACTURING") {
      showToast("Desenho aprovado: duplique o projeto para alterar o orçamento.", "warning");
      return;
    }
    const unitPrice = estimatedCatalogPrice(product, aluminumPricePerKg, Number(product.lengthMm || 0)) || 0;
    updateBudget((budget) => ({
      ...budget,
      items: [...budget.items, {
        id: `catalog-${product.id}-${Date.now()}`,
        catalogItemId: product.id,
        catalogSource: product.source,
        sku: product.code || "",
        description: product.name,
        quantity: 1,
        unitPrice,
        subtotal: unitPrice,
        cutLengthMm: Number(product.lengthMm || 0),
        imageUrl: product.thumbnailDataUrl || product.imageUrl || "",
        priceSource: Number(product.price || 0) > 0 ? "catalog" : unitPrice > 0 ? "estimated" : "pending",
      }],
    }));
  };

  const handleCreateQuoteFromDrawing = async () => {
    const budget = drawing.budget;
    if (!budget?.items.length) {
      showToast("Adicione componentes ao orçamento do desenho antes de criar a proposta.", "warning");
      return;
    }
    const items = budget.items.map((item, index) => ({
      id: item.id || `drawing-item-${index + 1}`,
      description: item.description,
      sku: item.sku || "",
      catalogItemId: item.catalogItemId || "",
      catalogSource: item.catalogSource || supplierCatalog.find((product) => product.id === item.catalogItemId)?.source || "",
      quantity: Math.max(1, Number(item.quantity) || 1),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      subtotal: Number((Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.unitPrice) || 0)).toFixed(2)),
      itemPhotoUrl: item.imageUrl || "",
      itemPhotoUrls: item.imageUrl ? [item.imageUrl] : [],
      priceSource: item.priceSource === "estimated" ? "estimated" as const : item.unitPrice > 0 ? "catalog" as const : "pending" as const,
      notes: item.priceSource === "estimated" ? "Preço estimado pelo peso do perfil e valor configurado do alumínio por kg." : undefined,
    }));
    const subtotal = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const labor = Math.max(0, Number(budget.labor || 0));
    const marginRate = Math.max(0, Number(budget.marginRate || 0));
    const margin = Number(((subtotal + labor) * marginRate / 100).toFixed(2));
    const freight = Math.max(0, Number(budget.freight || 0));
    const taxRate = Math.max(0, Number(budget.taxRate || 0));
    const taxAmount = Number(((subtotal + labor + margin + freight) * taxRate / 100).toFixed(2));
    const total = Number((subtotal + labor + margin + freight + taxAmount).toFixed(2));
    if (total <= 0) {
      showToast("Não é possível gerar um orçamento total de R$ 0,00. Informe preços no catálogo ou revise o custo do alumínio por kg.", "error");
      return;
    }
    const id = `quote_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const quote: Quote = {
      id,
      number: `ORC-${new Date().getFullYear()}-${id.slice(-6).toUpperCase()}`,
      companyId: "",
      clientName: "",
      clientTaxId: "",
      clientEmail: "",
      clientAddress: "",
      date: now.slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      items,
      subtotal,
      labor,
      marginRate,
      margin,
      freight,
      taxRate,
      taxAmount,
      discountRate: 0,
      discountAmount: 0,
      total,
      currency: "BRL",
      status: "draft",
      notes: `Orçamento criado a partir do desenho técnico: ${drawing.title}. Preços estimados precisam de validação.`,
      technicalDrawing: drawing,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await setDoc(doc(db, "quotes", id), compactQuoteForFirestore(quote));
      showToast(`Orçamento ${quote.number} salvo. O PDF será gerado ao visualizar ou exportar.`, "success");
    } catch (error) {
      console.error("Could not save quote generated from technical drawing:", error);
      showToast((error as Error).message || "Não foi possível salvar o orçamento do desenho.", "error");
    }
  };

  // Load saved drawings from Firestore
  useEffect(() => {
    if (!authReady || !auth.currentUser) {
      setSavedDrawings([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "technical_drawings"),
      (snap) => {
        const list: TechnicalDrawing[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as TechnicalDrawing));
        // Ordena pelo salvamento/edição mais recente; registros legados usam createdAt.
        list.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
        setSavedDrawings(list);
      },
      (err) => console.warn("Firestore drawings load notice:", err)
    );
    return () => unsub();
  }, [authReady]);

  const loadApprovedDrawingSnapshot = async (snapshotId: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Faça login novamente para consultar o desenho aprovado.");
    const response = await fetch("/api/approved-snapshot?snapshotId=" + encodeURIComponent(snapshotId), {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Não foi possível recuperar o snapshot do desenho.");
    if (data?.type !== "drawing" || !data?.document) throw new Error("Snapshot de desenho inválido.");
    return data;
  };

  const drawingFileBaseName = () => (drawing.title || "Esquadria")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "_");

  const handleDownloadDrawingSvg = () => {
    try {
      const blob = new Blob([buildArchitecturalDrawingSheetSvg(drawing)], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Desenho_Arquitetonico_${drawingFileBaseName()}.svg`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      console.error("Architectural SVG export failed:", error);
      showToast("Não foi possível exportar o desenho SVG.", "error");
    }
  };

  const handleDownloadDrawingPng = async () => {
    try {
      const image = new Image();
      const imageReady = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível renderizar a ficha SVG."));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildArchitecturalDrawingSheetSvg(drawing))}`;
      });
      await imageReady;
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 3260;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a imagem PNG.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `Desenho_Arquitetonico_${drawingFileBaseName()}.png`;
      anchor.click();
      showToast("Desenho PNG em alta resolução exportado.", "success");
    } catch (error) {
      console.error("Architectural PNG export failed:", error);
      showToast(error instanceof Error ? error.message : "Não foi possível exportar o desenho PNG.", "error");
    }
  };

  const handleExportArchitecturalPdf = async () => {
    try {
      await exportArchitecturalSheetPdf(buildArchitecturalDrawingSheetSvg(drawing), drawingFileBaseName());
      showToast("Ficha técnica arquitetônica PDF exportada.", "success");
    } catch (error) {
      console.error("Architectural PDF export failed:", error);
      showToast(error instanceof Error ? error.message : "Não foi possível exportar a ficha técnica PDF.", "error");
    }
  };

  const handleApproveDrawing = async () => {
    if (!drawing?.id || !drawing.pieces?.length) return;
    if (drawing.id === "draw-sample-01") {
      showToast("Gere ou abra um projeto real antes de aprová-lo para fabricação.", "warning");
      return;
    }
    if (drawing.approvedSnapshotId) {
      showToast("Este desenho já está aprovado e bloqueado para fabricação.", "warning");
      return;
    }
    if (drawing.id === "draw-sample-01") {
      showToast("O desenho de demonstração não pode ser aprovado para fabricação. Gere ou abra um projeto real.", "warning");
      return;
    }
    if ((drawing as any).isDraft === true && !window.confirm("CONFIRMAÇÃO DE RESPONSABILIDADE TÉCNICA\n\nRevisei as dimensões, materiais, componentes, folgas, ferragens e plano de corte. Confirmo que este desenho preliminar foi verificado por profissional autorizado e pode ser liberado para fabricação.\n\nDeseja congelar esta versão como aprovada?")) return;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre novamente para aprovar o desenho.");
      const saved = await handleSaveDrawing(drawing, true);
      if (!saved) throw new Error("Salve o desenho antes de aprová-lo.");
      const token = await user.getIdToken();
      const response = await fetch("/api/approved-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ type: "drawing", documentId: drawing.id, senderSnapshot: senderConfig }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Não foi possível aprovar o desenho.");
      const approved = { ...result.snapshot.document, approvedSnapshotId: result.snapshotId } as TechnicalDrawing;
      setDrawing(approved);
      setSavedDrawings((previous) => previous.map((item) => item.id === approved.id ? approved : item));
      showToast("Plano aprovado. Snapshot imutável criado e liberado para fabricação.", "success");
    } catch (error) {
      console.error("Technical drawing approval failed:", error);
      showToast((error as Error).message || "Falha ao aprovar o desenho.", "error");
    }
  };

  const handleOpenDrawingPdf = async (targetDrawing?: TechnicalDrawing) => {
    const source = targetDrawing || drawing;
    try {
      let pdfSource = source;
      let pdfSender: SenderConfig | undefined;
      if (source.approvedSnapshotId) {
        const snapshot = await loadApprovedDrawingSnapshot(source.approvedSnapshotId);
        pdfSource = snapshot.document as TechnicalDrawing;
        pdfSender = snapshot.senderSnapshot as SenderConfig | undefined;
      }
      const pdf = buildTechnicalDrawingPdf(pdfSource, pdfSender);
      const target = { ...pdfSource, pdfDataUri: pdf.dataUri, pdfFileName: pdf.fileName, pdfFileSizeKb: pdf.sizeKb };
      setDrawing(target);
      setIsPdfModalOpen(true);
    } catch (error) {
      console.error("Could not build drawing PDF from its approved snapshot:", error);
      showToast((error as Error).message || "Não foi possível preparar a pré-visualização PDF.", "error");
    }
  };

  const handleSaveDrawing = async (targetDrawing: TechnicalDrawing = drawing, silent = false): Promise<boolean> => {
    if (targetDrawing.approvedSnapshotId || targetDrawing.status === "APPROVED_FOR_MANUFACTURING") {
      if (!silent) showToast("Desenho aprovado: edição bloqueada. Duplique o projeto para criar uma nova revisão.", "warning");
      return false;
    }
    const user = auth.currentUser;
    if (!user) {
      if (!silent) showToast("Faça login novamente para salvar o projeto técnico.", "error");
      return false;
    }
    if (!targetDrawing.pieces?.length) {
      if (!silent) showToast("O desenho não possui peças para salvar.", "warning");
      return false;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const {
        pdfDataUri: _pdf,
        pdfUrl: _pdfUrl,
        pdfStoragePath: _storagePath,
        pdfFileName: _fileName,
        pdfGeneratedAt: _generatedAt,
        pdfFileSizeKb: _size,
        ...drawingData
      } = targetDrawing;
      const savedDrawing: TechnicalDrawing = withoutHeavyInlineData({
        ...drawingData,
        createdAt: targetDrawing.createdAt || now,
        updatedAt: now,
        ownerUid: user.uid,
        schemaVersion: 2,
      });
      await setDoc(doc(db, "technical_drawings", targetDrawing.id), sanitizeFirestoreData(savedDrawing));
      setDrawing(savedDrawing);
      if (!silent) showToast("Projeto técnico salvo com os dados editáveis. O PDF será gerado ao exportar.", "success");
      return true;
    } catch (err) {
      console.error("Technical drawing save failed:", err);
      if (!silent) showToast("Não foi possível salvar o projeto técnico. O desenho continua aberto para tentar novamente.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAiDrawing = async () => {
    if (!aiDrawing) {
      showToast("Gere um desenho antes de salvar.", "warning");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      showToast("Faça login novamente para salvar o desenho gerado por IA.", "error");
      return;
    }
    const title = aiTitle.trim();
    if (!title) {
      showToast("Informe um título para guardar este desenho no projeto.", "warning");
      return;
    }
    try {
      const now = new Date().toISOString();
      const saved = withoutHeavyInlineData({
        ...aiDrawing,
        title,
        drawingOrigin: "ai",
        aiPrompt: prompt,
        createdAt: aiDrawing.createdAt || now,
        updatedAt: now,
        ownerUid: user.uid,
        schemaVersion: 2,
      }) as TechnicalDrawing;
      await setDoc(doc(db, "technical_drawings", saved.id), sanitizeFirestoreData(saved));
      setAiDrawing(saved);
      setSavedDrawings((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      showToast("Desenho de IA salvo no projeto com prompt e dados editáveis.", "success");
    } catch (error) {
      console.error("AI drawing save failed:", error);
      showToast((error as Error).message || "Não foi possível salvar o desenho de IA.", "error");
    }
  };

  const handleSaveAiAsParametricModel = async () => {
    if (!aiDrawing?.parametricSpec) {
      showToast("Gere uma esquadria com parâmetros reconhecidos antes de adicioná-la à biblioteca local.", "warning");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      showToast("Faça login novamente para salvar o modelo paramétrico.", "error");
      return;
    }
    if (!aiDrawing.parametricSpec.largura_mm || !aiDrawing.parametricSpec.altura_mm) {
      showToast("O modelo precisa ter largura e altura válidas antes de entrar na biblioteca paramétrica.", "warning");
      return;
    }
    try {
      const now = new Date().toISOString();
      const model = withoutHeavyInlineData({
        ...aiDrawing,
        id: "parametric_model_" + crypto.randomUUID(),
        title: aiTitle.trim() || aiDrawing.title || "Modelo paramétrico sem título",
        drawingOrigin: "ai",
        aiPrompt: prompt,
        parametricLibrary: true,
        sourceDrawingId: aiDrawing.id,
        createdAt: now,
        updatedAt: now,
        ownerUid: user.uid,
        schemaVersion: 2,
      }) as TechnicalDrawing;
      await setDoc(doc(db, "technical_drawings", model.id), sanitizeFirestoreData(model));
      setSavedDrawings((previous) => [model, ...previous.filter((item) => item.id !== model.id)]);
      setSelectedParametricModelId(model.id);
      showToast("Modelo adicionado à biblioteca de parâmetros arquitetônicos locais.", "success");
    } catch (error) {
      console.error("Parametric model save failed:", error);
      showToast((error as Error).message || "Não foi possível guardar o modelo nos parâmetros locais.", "error");
    }
  };

  const handleDeleteDrawing = async (item: TechnicalDrawing) => {
    if (item.approvedSnapshotId || item.status === "APPROVED_FOR_MANUFACTURING") { showToast("Um desenho aprovado não pode ser excluído. Preserve o histórico industrial.", "warning"); return; }
    if (!auth.currentUser) { showToast("Faça login novamente para excluir o desenho.", "error"); return; }
    if (!window.confirm("Deseja excluir definitivamente o desenho “" + item.title + "”? Esta ação não pode ser desfeita.")) return;
    try {
      const storedPath = (item as any).pdfStoragePath;
      if (storedPath) {
        try { await deleteObject(storageRef(storage, storedPath)); }
        catch (storageError: any) { if (storageError?.code !== "storage/object-not-found") throw storageError; }
      }
      await deleteDoc(doc(db, "technical_drawings", item.id));
      if (drawing.id === item.id) { setDrawing(initialSampleDrawing); setCurrentStep(1); setIsPdfModalOpen(false); }
      showToast("Desenho excluído com sucesso.", "success");
    } catch (err) { console.error("Drawing delete failed:", err); showToast("Não foi possível excluir o desenho.", "error"); }
  };

  const handleStartNewDrawing = (project?: { id: string; name: string }) => {
    const now = new Date().toISOString();
    setDrawing({
      ...initialSampleDrawing,
      id: `draw_${crypto.randomUUID()}`,
      title: project?.name || "Novo projeto técnico",
      description: "",
      projectId: project?.id,
      projectName: project?.name,
      createdAt: now,
      updatedAt: now,
    });
    setPrompt(defaultCadPrompt);
    setSelectedProjectId(project?.id || "");
    setCurrentStep(1);
    setActiveView("studio");
  };

  const handleOpenSavedDrawing = (item: TechnicalDrawing) => {
    // Registros novos contêm o desenho completo e podem voltar ao editor.
    if (Array.isArray(item.pieces) && item.pieces.length > 0) {
      setDrawing(item);
      setPrompt(item.description || item.title || defaultCadPrompt);
      setSelectedProjectId(item.projectId || "");
      setCurrentStep(Math.min(Math.max(Number(item.currentStep) || 1, 1), 5));
      setIsPdfModalOpen(false);
      setActiveView("studio");
      showToast("Projeto técnico carregado para edição.", "success");
      return;
    }
    // Compatibilidade com os registros antigos que armazenavam somente o PDF.
    if ((item as any).pdfUrl || item.pdfDataUri) {
      setDrawing(item);
      setActiveView("studio");
      handleOpenDrawingPdf(item);
      showToast("Este projeto antigo contém somente o PDF. O arquivo foi aberto para consulta.", "warning");
      return;
    }
    showToast("Este registro não contém dados suficientes para abrir o desenho.", "warning");
  };
  const handleGenerate = async (presetPrompt?: string) => {
    const inputPrompt = (presetPrompt || prompt).trim();
    if (!inputPrompt) {
      showToast("Descreva a peça ou o móvel que deseja projetar.", "warning");
      return;
    }

    setIsLoading(true);
    let generated: TechnicalDrawing;
    let generationWarning = true;
    const aluminumPrompt = isAluminumPrompt(inputPrompt);
    if (aluminumPrompt) {
      const spec = localParametricSpec(inputPrompt);
      if (!spec.largura_mm) spec.largura_mm = 1000;
      if (!spec.altura_mm) spec.altura_mm = 1000;
      generated = buildParametricDrawing(spec, inputPrompt, supplierCatalog);
      if (!/\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?\s*[x×]\s*\d+/i.test(inputPrompt) &&
          !/largura\s*(?:de|:|=)?\s*\d+[\s\S]*altura\s*(?:de|:|=)?\s*\d+/i.test(inputPrompt)) {
        generated.assumptions = [...(generated.assumptions || []), "Dimensões ausentes: foi usado um vão preliminar de 1000 × 1000 mm para que o desenho possa ser revisado."];
      }
    } else {
      generated = buildLocalTechnicalDrawing(inputPrompt);
    }

    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    generated = { ...generated, projectId: selectedProject?.id, projectName: selectedProject?.name };
    setAiDrawing(generated); setAiTitle(generated.title || inputPrompt);
    setCurrentStep(1);
    setPrompt(inputPrompt);
    const localDrawing = generated;

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("O desenho local está aberto; entre na sua conta para tentar a melhoria por IA.");
      }
      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai/technical-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ prompt: inputPrompt, currentDrawing: localDrawing, catalog: [...catalogItems, ...supplierCatalog] }),
        signal: AbortSignal.timeout(4_000),
      });
      let responseBody = await res.json().catch(() => null);
      if (res.status === 202 && responseBody?.status === "JOB_PROCESSING" && responseBody?.jobId && responseBody?.pollUrl) {
        throw new Error("A versão de IA segue em processamento; o desenho local permanece disponível.");
      }
      if (!res.ok) {
        throw new Error(responseBody?.error || responseBody?.details || `Falha no serviço de desenho (${res.status})`);
      }
      if (!responseBody || !Array.isArray(responseBody.pieces) || responseBody.pieces.length === 0) {
        throw new Error("O serviço retornou um desenho sem componentes renderizáveis.");
      }
      // A resposta de fallback é um rascunho heurístico, não um desenho validado pela IA.
      generationWarning = Boolean(responseBody._fallback || responseBody.warning);
      const dimensions = responseBody.overallDimensions || {};
      const width = Number(dimensions.width);
      const height = Number(dimensions.height);
      const depth = Number(dimensions.depth || 0);
      if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
        throw new Error("O serviço retornou dimensões inválidas.");
      }
      generationWarning = Boolean(responseBody._fallback || responseBody.warning);
      generated = {
        id: "draw_" + Date.now().toString(36),
        title: responseBody.title || "Projeto técnico sob medida",
        description: responseBody.description || inputPrompt,
        category: responseBody.category || "custom",
        unit: responseBody.unit === "mm" ? "mm" : "cm",
        overallDimensions: { width, height, depth: depth > 0 ? depth : undefined },
        pieces: responseBody.pieces,
        ...((responseBody.parametricSpec || localDrawing.parametricSpec) ? { parametricSpec: responseBody.parametricSpec || localDrawing.parametricSpec } : {}),
        visualElements: Array.isArray(responseBody.visualElements) && responseBody.visualElements.some((element: any) => element && element.type !== "text")
          ? responseBody.visualElements
          : localDrawing.visualElements || [],
        ...(responseBody.vectorPayload ? { vectorPayload: responseBody.vectorPayload } as any : {}),
        modelDescription: responseBody.modelDescription || "",
        finalAppearance: responseBody.finalAppearance || "",
        measurementPlan: Array.isArray(responseBody.measurementPlan) ? responseBody.measurementPlan : [],
        cuttingPlan: Array.isArray(responseBody.cuttingPlan) ? responseBody.cuttingPlan : [],
        manufacturingSteps: Array.isArray(responseBody.manufacturingSteps) ? responseBody.manufacturingSteps : [],
        qualityChecklist: Array.isArray(responseBody.qualityChecklist) ? responseBody.qualityChecklist : [],
        assumptions: Array.isArray(responseBody.assumptions) ? responseBody.assumptions : [],
        dimensionLines: Array.isArray(responseBody.dimensionLines) ? responseBody.dimensionLines : [],
        assemblyInstructions: Array.isArray(responseBody.assemblyInstructions) ? responseBody.assemblyInstructions : [],
        steps: Array.isArray(responseBody.steps) && responseBody.steps.length >= 5 ? responseBody.steps.slice(0, 5) : furnitureSampleDrawing.steps,
        currentStep: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        budget: responseBody.budget
          ? enrichDrawingBudget(responseBody.budget, [...catalogItems, ...supplierCatalog], aluminumPricePerKg)
          : localDrawing.budget,
        isDraft: true,
        status: "PRELIMINARY_CONTINGENCY",
        draftStatus: "preliminary",
        draftLabel: "BORRADOR TÉCNICO - NO VÁLIDO PARA FABRICACIÓN",
      };
      generated = { ...generated, projectId: selectedProject?.id, projectName: selectedProject?.name };
      if (generationWarning || responseBody.draftStatus === "preliminary") {
        (generated as any).draftStatus = "preliminary";
        (generated as any).draftLabel = responseBody.draftLabel || "RASCUNHO PRELIMINAR — NÃO LIBERADO PARA FABRICAÇÃO";
        (generated as any).assumptions = [
          ...(Array.isArray((generated as any).assumptions) ? (generated as any).assumptions : []),
          "Desenho de contingência ou resposta não validada pelo serviço de IA. Confirmar todas as medidas, materiais, ferragens e cortes antes de fabricar."
        ];
      }
    } catch (error) {
      console.warn("A versão local foi mantida após falha ou demora da IA:", error);
      generationWarning = true;
      generated = localDrawing;
    }

    try {
      setAiDrawing(generated);
      setAiTitle(generated.title || inputPrompt);
      if (generationWarning) {
        showToast("Rascunho técnico preparado. Revise os dados e salve quando estiver pronto.", "warning");
      } else {
        showToast("Desenho técnico gerado por IA. Defina um título e salve no projeto.", "success");
      }
    } finally {
      setIsLoading(false);
    }
  };

    const handleExportPdf = async () => {
    try {
      let source = drawing;
      let sender: SenderConfig | undefined = senderConfig;
      if (drawing.approvedSnapshotId) {
        const snapshot = await loadApprovedDrawingSnapshot(drawing.approvedSnapshotId);
        source = snapshot.document as TechnicalDrawing;
        sender = snapshot.senderSnapshot as SenderConfig | undefined;
      }
      exportTechnicalDrawingPdf(source, sender);
      showToast("Desenho técnico e memorial exportados para PDF.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao exportar o PDF.", "error");
    }
  };

  const handleExportDxf = async () => {
    try {
      let source = drawing;
      if (drawing.approvedSnapshotId) {
        const snapshot = await loadApprovedDrawingSnapshot(drawing.approvedSnapshotId);
        source = snapshot.document as TechnicalDrawing;
      }
      downloadTechnicalDrawingDxf(source);
      showToast("Arquivo DXF exportado para AutoCAD.", "success");
    } catch (err) {
      console.error("DXF export failed:", err);
      showToast((err as Error).message || "Não foi possível exportar o DXF.", "error");
    }
  };

  const currentStepData = drawing.steps?.[currentStep - 1];
  const parametricSpec = drawing.parametricSpec || defaultCadSpec;
  const canEditParametric = !drawing.approvedSnapshotId && drawing.status !== "APPROVED_FOR_MANUFACTURING";
  const parametricModels = savedDrawings.filter((item) => Boolean((item as any).parametricLibrary && item.parametricSpec));

  const applyParametricModel = (model: TechnicalDrawing) => {
    if (!model.parametricSpec) {
      showToast("Este desenho não possui parâmetros arquitetônicos estruturados.", "warning");
      return;
    }
    if (!canEditParametric) {
      showToast("Este projeto está aprovado e bloqueado. Duplique-o para aplicar outro modelo.", "warning");
      return;
    }
    const command = promptForSpec(model.parametricSpec);
    setDrawing((current) => ({
      ...rebuildParametricPreview(current, model.parametricSpec!, command),
      title: model.title || command,
      description: command,
      projectId: selectedProjectId || current.projectId,
      projectName: projects.find((project) => project.id === selectedProjectId)?.name || current.projectName,
    }));
    setPrompt(command);
    setSelectedParametricModelId(model.id);
    showToast("Modelo aplicado aos parâmetros locais. As vistas CAD foram atualizadas sem IA.", "success");
  };

  const presets = [
    "una mesa de madera de 120x80x75 cm con 4 patas",
    "un armario de 2 puertas de 180x60x200 cm",
    "una pieza en L de 90x90 cm con un corte a 45°",
    "ventana de aluminio de 150x120 cm con 2 hojas corredizas",
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Projetos e Oficina CAD" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveView("list")}
          aria-current={activeView === "list" ? "page" : undefined}
          className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${activeView === "list" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          Lista de Projetos & Desenhos Salvos
        </button>
        <button
          type="button"
          onClick={() => activeView === "studio" ? setActiveView("studio") : handleStartNewDrawing()}
          aria-current={activeView === "studio" ? "page" : undefined}
          className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${activeView === "studio" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          Estúdio CAD & Orçamento
        </button>
      </nav>

      {activeView === "list" ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Projetos & Desenhos Salvos</h2>
              <p className="mt-1 text-sm text-slate-500">Abra um desenho editável ou inicie um novo projeto CAD.</p>
            </div>
            <button type="button" onClick={() => handleStartNewDrawing()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Novo Projeto / Desenho
            </button>
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Projetos</h3>
            {projects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">Nenhum projeto cadastrado. Crie um projeto ou abra o estúdio para iniciar um desenho.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project) => {
                  const projectDrawing = savedDrawings.find((item) => item.projectId === project.id);
                  return (
                    <article key={project.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{project.name}</h4>
                        <p className="mt-1 text-xs text-slate-500">{savedDrawings.filter((item) => item.projectId === project.id).length} desenhos salvos</p>
                      </div>
                      <button type="button" onClick={() => projectDrawing ? handleOpenSavedDrawing(projectDrawing) : handleStartNewDrawing(project)} className="shrink-0 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950">
                        {projectDrawing ? "Abrir projeto" : "Novo desenho"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Desenhos salvos ({savedDrawings.length})</h3>
              {savedDrawings[0] && <span className="text-xs text-slate-500">Atualizado {new Date(savedDrawings[0].updatedAt || savedDrawings[0].createdAt).toLocaleString("pt-BR")}</span>}
            </div>
            {savedDrawings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <FolderOpen className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum desenho salvo ainda</p>
                <p className="mt-1 text-xs text-slate-500">Os projetos salvos no estúdio aparecerão nesta lista.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedDrawings.map((item) => {
                  const editable = Array.isArray(item.pieces) && item.pieces.length > 0;
                  const savedAt = item.updatedAt || item.createdAt;
                  return (
                    <article key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.title || "Projeto técnico sem título"}</h4>
                        <p className="mt-1 truncate text-xs text-slate-500">{item.projectName || "Sem projeto associado"} · {savedAt ? new Date(savedAt).toLocaleString("pt-BR") : "Data não informada"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.overallDimensions?.width || "—"} × {item.overallDimensions?.height || "—"}{item.overallDimensions?.depth ? ` × ${item.overallDimensions.depth}` : ""} {item.unit || "cm"} · {editable ? "Desenho editável" : "PDF legado"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => handleOpenSavedDrawing(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                          <FolderOpen className="h-3.5 w-3.5" /> {editable ? "Abrir / editar" : "Abrir PDF"}
                        </button>
                        <button type="button" onClick={() => handleDeleteDrawing(item)} title="Excluir desenho" aria-label={`Excluir desenho ${item.title}`} className="inline-flex items-center justify-center rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-slate-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      ) : (
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {drawing.pdfDataUri && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Pré-visualização / Exportar PDF
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Projeto CAD
            </h1>            {(drawing as any).isDraft !== false && drawing.status !== "APPROVED_FOR_MANUFACTURING" && (
              <div role="alert" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                <AlertCircle className="h-4 w-4" />
                {(drawing as any).draftLabel || "BORRADOR TÉCNICO - NO VÁLIDO PARA FABRICACIÓN"}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleDownloadDrawingPng} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            <Download className="h-4 w-4" /> Baixar Desenho (PNG Alta Resolução)
          </button>
          <button type="button" onClick={handleDownloadDrawingSvg} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            <Download className="h-4 w-4" /> Baixar SVG vetorial
          </button>
          <button type="button" onClick={() => void handleExportArchitecturalPdf()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
            <FileText className="h-4 w-4" /> Exportar Ficha Técnica (PDF)
          </button>
          <button
            onClick={() => handleSaveDrawing()}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Projeto
          </button>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Ações ▾</summary>
            <div className="absolute right-0 z-30 mt-2 grid min-w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => handleOpenDrawingPdf()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><Eye className="h-4 w-4" />Pré-visualizar PDF</button>
              {!drawing.approvedSnapshotId && <button type="button" onClick={handleApproveDrawing} disabled={isSaving || !drawing.pieces?.length || drawing.isDraft === false || drawing.id === "draw-sample-01"} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"><CheckCircle className="h-4 w-4" />Aprovar para fabricação</button>}
              <button type="button" onClick={handleExportDxf} disabled={!Array.isArray((drawing as any).visualElements) || !(drawing as any).visualElements.length} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-4 w-4" />Exportar DXF</button>
              <button type="button" onClick={handleExportPdf} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-4 w-4" />Baixar PDF</button>
            </div>
          </details>
          {drawing.approvedSnapshotId && <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold uppercase text-emerald-700">Aprovado</span>}
        </div>
      </div>

      <nav aria-label="Ferramentas adicionais do Projeto CAD" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        <button type="button" onClick={() => setActiveToolTab("ai")} aria-current={activeToolTab === "ai" ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${activeToolTab === "ai" ? "border-violet-600 text-violet-700 dark:text-violet-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>Desenhe com IA</button>
        <button type="button" onClick={() => setActiveToolTab("saved")} aria-current={activeToolTab === "saved" ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${activeToolTab === "saved" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>Desenhos salvos</button>
      </nav>

      {/* Projeto CAD permanece independente; as abas auxiliares não substituem o motor local. */}
      {/* Two-Panel Layout: Left = Controls; Right = Scalable SVG Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Chat / Instructions / Step by Step (5 cols) */}
        <div className="lg:order-2 lg:col-span-5 space-y-6">
          {activeToolTab === "ai" ? (
            <section className="space-y-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-900 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Desenhe com IA</h3>
                  <p className="text-xs text-slate-500">Gere um desenho técnico vetorial separado do CAD local.</p>
                </div>
              </div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Associar a um projeto</label>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-xs dark:bg-slate-950">
                <option value="">Sem projeto associado</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPrompt(p)} disabled={isLoading} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-left text-[10px] text-violet-800 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
                    {p}
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Descreva o desenho desejado</label>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: Janela de correr de duas folhas, linha Suprema, 1500 × 1200 mm, alumínio anodizado natural e vidro temperado..." rows={4} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <button type="submit" disabled={isLoading || !prompt.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar desenho com IA
                </button>
              </form>
              {aiDrawing && (
                <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Título para salvar no projeto
                    <input value={aiTitle} onChange={(e) => setAiTitle(e.target.value)} placeholder="Ex.: Janela Suprema — modelo 01" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" />
                  </label>
                  <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-2 dark:border-slate-700">
                    <DrawingSvgCanvas drawing={aiDrawing} currentStep={1} showDimensions showLabels />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-950 p-2 dark:border-slate-700">
                    <DrawingThreePreview drawing={aiDrawing} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => void handleSaveAiDrawing()} disabled={isSaving || !aiTitle.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                      <Save className="h-4 w-4" /> Salvar desenho no projeto
                    </button>
                    <button type="button" onClick={() => void handleSaveAiAsParametricModel()} disabled={isSaving || !aiDrawing.parametricSpec} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                      <Layers className="h-4 w-4" /> Adicionar aos parâmetros locais
                    </button>
                  </div>
                  {!aiDrawing.parametricSpec && <p className="text-[11px] text-amber-700 dark:text-amber-300">Este desenho ainda não possui uma ficha paramétrica de esquadria para reutilização automática.</p>}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Desenhos salvos</h3>
                  <p className="text-xs text-slate-500">Abra desenhos ou reutilize modelos paramétricos adicionados à biblioteca.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{savedDrawings.length}</span>
              </div>
              {savedDrawings.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-slate-500">Ainda não há desenhos salvos neste espaço.</div>
              ) : (
                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {savedDrawings.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white">{item.title || "Desenho sem título"}</h4>
                          <p className="mt-1 text-[10px] text-slate-500">{(item as any).parametricLibrary ? "Modelo paramétrico local" : (item as any).drawingOrigin === "ai" ? "Gerado por IA" : "Projeto CAD"} · {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("pt-BR") : "Data não informada"}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleOpenSavedDrawing(item)} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white">Abrir no Projeto CAD</button>
                        {item.parametricSpec && <button type="button" onClick={() => applyParametricModel(item)} className="rounded-lg border border-emerald-300 px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Aplicar parâmetros locais</button>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">Parâmetros arquitetônicos · atualização local instantânea</h3>
            <p className="mt-1 text-xs text-slate-500">O comando e todos os campos abaixo alimentam diretamente as vistas 2D e isométrica, sem depender de IA.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-[10px] font-semibold text-slate-500">Tipologia
                <select value={parametricSpec.tipologia} disabled={!canEditParametric} onChange={(event) => updateDrawingSpec({ tipologia: event.target.value as ParametricWindowSpec["tipologia"] })} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs disabled:opacity-50">
                  <option value="janela_correr">Janela de Correr</option>
                  <option value="porta_correr">Porta de Correr</option>
                  <option value="porta_giro">Porta de Giro</option>
                  <option value="porta_pivotante">Porta Pivotante</option>
                  <option value="maxim_ar">Maxim-ar</option>
                  <option value="box_banheiro">Box de Banheiro</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold text-slate-500">Largura (mm)<input type="number" min="1" max="20000" value={parametricSpec.largura_mm} disabled={!canEditParametric} onChange={(event) => updateParametricField("largura_mm", Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2 text-xs disabled:opacity-50" /></label>
              <label className="text-[10px] font-semibold text-slate-500">Alto (mm)<input type="number" min="1" max="20000" value={parametricSpec.altura_mm} disabled={!canEditParametric} onChange={(event) => updateParametricField("altura_mm", Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2 text-xs disabled:opacity-50" /></label>
              <label className="text-[10px] font-semibold text-slate-500">Nº de Hojas<input type="number" min={parametricSpec.tipologia === "box_banheiro" ? 2 : 1} max="8" value={parametricSpec.folhas} disabled={!canEditParametric} onChange={(event) => updateParametricField("folhas", Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2 text-xs disabled:opacity-50" /></label>
              <label className="text-[10px] font-semibold text-slate-500">Línea
                <select value={parametricSpec.linha_aluminio} disabled={!canEditParametric} onChange={(event) => updateDrawingSpec({ linha_aluminio: event.target.value })} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs disabled:opacity-50">
                  <option value="Linha Suprema">Suprema</option>
                  <option value="Linha Gold">Gold</option>
                  <option value="Linha 25">Linha 25</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold text-slate-500">Cor do Alumínio
                <select value={parametricSpec.cor_perfil} disabled={!canEditParametric} onChange={(event) => updateDrawingSpec({ cor_perfil: event.target.value })} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs disabled:opacity-50">
                  <option value="#f8fafc">Branco</option>
                  <option value="#1f2937">Preto</option>
                  <option value="#9da8ae">Anodizado Natural</option>
                  <option value="#80552f">Bronze</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold text-slate-500">Tipo de Vidro
                <select value={parametricSpec.tipo_vidro} disabled={!canEditParametric} onChange={(event) => updateDrawingSpec({ tipo_vidro: event.target.value })} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs disabled:opacity-50">
                  <option value="temperado">Temperado</option>
                  <option value="laminado">Laminado</option>
                  <option value="comum">Comum / Float</option>
                  <option value="insulado">Insulado</option>
                  <option value="duplo">Duplo</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[1fr_auto]">
              <label className="text-[10px] font-semibold text-slate-500">Biblioteca de modelos paramétricos locais
                <select value={selectedParametricModelId} onChange={(event) => setSelectedParametricModelId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-slate-950">
                  <option value="">Selecionar modelo salvo...</option>
                  {parametricModels.map((model) => <option key={model.id} value={model.id}>{model.title}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => { const model = parametricModels.find((item) => item.id === selectedParametricModelId); if (model) applyParametricModel(model); }} disabled={!selectedParametricModelId || !canEditParametric} className="self-end rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Aplicar modelo</button>
            </div>
            {parametricModels.length === 0 && <p className="mt-2 text-[10px] text-slate-500">Modelos gerados por IA e adicionados à biblioteca aparecerão aqui.</p>}
          </section>

          {/* 5-Step Phase Controller */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Processo de Construção (5 Fases)
              </h3>
              <span className="text-[11px] font-mono text-slate-400 font-bold">
                Passo {currentStep} de 5
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
                  {currentStepData?.phaseName || `Passo ${currentStep}`}
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
                    Instruções técnicas de fabricação:
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
                <ChevronLeft className="w-4 h-4" /> Passo Anterior
              </button>
              <button
                onClick={() => setCurrentStep((s) => Math.min(s + 1, 5))}
                disabled={currentStep === 5}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-xs font-black text-slate-950 transition shadow-md"
              >
                Próximo passo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resumo das peças (lista técnica / BOM) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Box className="w-4 h-4 text-amber-400" />
                Lista de peças para montagem ({drawing.pieces?.length || 0} Peças)
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
                    <p className="text-[10px] text-slate-500 font-bold">Qtd.: {piece.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {drawing.budget && (
            <div className="bg-slate-900 border border-emerald-500/20 p-5 rounded-3xl shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">Orçamento de materiais</h3>
                <span className="text-sm font-black text-emerald-300">{drawing.budget.currency} {drawing.budget.total.toFixed(2)}</span>
              </div>
              <label className="block text-[10px] font-semibold text-slate-400">Valor de referência do alumínio (R$/kg)
                <input type="number" min="0.01" step="0.01" value={aluminumPricePerKg} onChange={(event) => setAluminumPricePerKg(writeAluminumPricePerKg(Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-400">Adicionar item do catálogo de fornecedores
                <select disabled={Boolean(drawing.approvedSnapshotId)} defaultValue="" onChange={(event) => { addSupplierBudgetItem(event.target.value); event.currentTarget.value = ""; }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white disabled:opacity-50">
                  <option value="">Selecionar produto...</option>
                  {supplierCatalog.map((product) => <option key={`${product.source}-${product.id}`} value={`${product.source}:${product.id}`}>{product.code || product.sku ? `${product.code || product.sku} · ` : ""}{product.name || product.description} · R$ {Number(product.price || 0).toFixed(2)}</option>)}
                </select>
              </label>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[11px] text-slate-300">
                  <thead><tr className="border-b border-slate-700 text-[9px] uppercase text-slate-500"><th className="p-2">Item</th><th className="p-2">Código</th><th className="p-2">Corte (mm)</th><th className="p-2">Qtd.</th><th className="p-2">Preço unit.</th><th className="p-2">Subtotal</th></tr></thead>
                  <tbody>{drawing.budget.items.map((item, index) => (
                    <tr key={item.id || index} className="border-b border-slate-800">
                      <td className="p-2"><div className="flex items-center gap-2">{item.imageUrl && <img src={item.imageUrl} alt="" className="h-10 w-10 rounded bg-white object-contain" />}<input disabled={Boolean(drawing.approvedSnapshotId)} value={item.description} onChange={(event) => updateBudgetItem(item.id || `budget-${index}`, "description", event.target.value)} className="w-40 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-60" /></div></td>
                      <td className="p-2"><input disabled={Boolean(drawing.approvedSnapshotId)} value={item.sku || ""} onChange={(event) => updateBudgetItem(item.id || `budget-${index}`, "sku", event.target.value)} className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-60" /></td>
                      <td className="p-2"><input disabled={Boolean(drawing.approvedSnapshotId)} type="number" min="0" value={item.cutLengthMm || 0} onChange={(event) => updateBudgetItem(item.id || `budget-${index}`, "cutLengthMm", event.target.value)} className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-60" /></td>
                      <td className="p-2"><input disabled={Boolean(drawing.approvedSnapshotId)} type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateBudgetItem(item.id || `budget-${index}`, "quantity", event.target.value)} className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-60" /></td>
                      <td className="p-2"><input disabled={Boolean(drawing.approvedSnapshotId)} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateBudgetItem(item.id || `budget-${index}`, "unitPrice", event.target.value)} className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-60" /></td>
                      <td className="p-2 font-mono text-emerald-300">R$ {(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-2">
                {([
                  ["Mão de Obra (R$)", "labor"],
                  ["Margem (%)", "marginRate"],
                  ["Impostos / IVA (%)", "taxRate"],
                  ["Frete (R$)", "freight"],
                ] as const).map(([label, field]) => <label key={field} className="text-[10px] font-semibold text-slate-400">{label}<input disabled={Boolean(drawing.approvedSnapshotId)} type="number" min="0" step="0.01" value={drawing.budget?.[field] || 0} onChange={(event) => updateBudget((budget) => ({ ...budget, [field]: Number(event.target.value) || 0 }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white disabled:opacity-60" /></label>)}
              </div>
              <div className="space-y-1 border-t border-slate-800 pt-2 text-[11px] text-slate-300">
                <p className="flex justify-between"><span>Materiais + mão de obra</span><span>R$ {(drawing.budget.subtotal + drawing.budget.labor).toFixed(2)}</span></p>
                <p className="flex justify-between"><span>Margem calculada</span><span>R$ {Number(drawing.budget.margin || 0).toFixed(2)}</span></p>
                <p className="flex justify-between"><span>Impostos</span><span>R$ {Number(drawing.budget.taxAmount || 0).toFixed(2)}</span></p>
                <p className="flex justify-between"><span>Frete</span><span>R$ {Number(drawing.budget.freight || 0).toFixed(2)}</span></p>
                <p className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-emerald-300"><span>Total</span><span>R$ {drawing.budget.total.toFixed(2)}</span></p>
              </div>
              {drawing.budget.notes && <p className="text-[10px] text-slate-500">{drawing.budget.notes}</p>}
              <button type="button" onClick={handleCreateQuoteFromDrawing} disabled={Boolean(drawing.approvedSnapshotId) || isSaving || drawing.budget.total <= 0} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Criar orçamento e PDF no Cofre de Documentos</button>
              <button type="button" onClick={async () => { const saved = await handleSaveDrawing(); if (saved) await handleExportPdf(); }} disabled={isSaving || Boolean(drawing.approvedSnapshotId)} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{isSaving ? "Salvando..." : "Guardar Projeto e Gerar Orçamento PDF"}</button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Scalable SVG Canvas (7 cols) */}
        <div className="lg:order-1 lg:col-span-7 space-y-4">
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
            <div className="mt-4">
              <DrawingThreePreview drawing={drawing} />
            </div>
          </div>
          <ManufacturingRoute drawing={drawing} title={drawing.title || "Projeto técnico"} />

        </div>
      </div>

      {/* Embedded Stored PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={drawing.title}
        subtitle={`Dimensões: ${drawing.overallDimensions?.width || 0}×${drawing.overallDimensions?.height || 0} cm • ${drawing.pieces?.length || 0} peças tipo encaixe • Memorial técnico`}
        pdfDataUri={drawing.pdfDataUri || (drawing as any).pdfUrl}
        fileName={drawing.pdfFileName || `Plano_Tecnico_${(drawing.title || "Projeto").replace(/\s+/g, "_")}.pdf`}
        fileSizeKb={drawing.pdfFileSizeKb}
        storedAt={drawing.pdfGeneratedAt || drawing.updatedAt}
        type="drawing"
      />
      </div>
      )}
    </div>
  );
}
