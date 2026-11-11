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
  Eye,
  Trash2
} from "lucide-react";
import { TechnicalDrawing, SenderConfig } from "../../types";
import DrawingSvgCanvas from "./DrawingSvgCanvas";
import { exportTechnicalDrawingPdf, buildTechnicalDrawingPdf } from "../../utils/pdfExport";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { db, storage } from "../../firebase";
import { useToast } from "../ToastContext";
import PdfViewerModal from "../common/PdfViewerModal";

interface TechnicalDrawingModuleProps {
  senderConfig: SenderConfig;
  language?: string;
}

// Initial sample project for instantaneous feedback
const initialSampleDrawing: TechnicalDrawing = {
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
  const steps = initialSampleDrawing.steps.map((step, index) => ({
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
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [drawing, setDrawing] = useState<TechnicalDrawing>(initialSampleDrawing);
  const [savedDrawings, setSavedDrawings] = useState<TechnicalDrawing[]>([]);
  const [projects, setProjects] = useState<Array<{id:string;name:string}>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), (snap) => {
      setProjects(snap.docs.map((item) => ({ id: item.id, name: String(item.data().name || "Projeto sem nome") })));
    }, (err) => console.warn("Projects list load notice:", err));
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(collection(db, "catalog"), (snap) => {
      setCatalogItems(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (err) => console.warn("Firestore catalog load notice:", err));
  }, [authReady]);

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

  const handleApproveDrawing = async () => {
    if (!drawing?.id || !drawing.pieces?.length) return;
    if (drawing.approvedSnapshotId) {
      showToast("Este desenho já está aprovado e bloqueado para fabricação.", "warning");
      return;
    }
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
      let pdfSender = senderConfig;
      if (source.approvedSnapshotId) {
        const snapshot = await loadApprovedDrawingSnapshot(source.approvedSnapshotId);
        pdfSource = snapshot.document as TechnicalDrawing;
        pdfSender = snapshot.senderSnapshot || {};
      }
      const pdf = buildTechnicalDrawingPdf(pdfSource, pdfSender);
      const target = { ...pdfSource, pdfDataUri: pdf.dataUri, pdfFileName: pdf.fileName, pdfFileSizeKb: pdf.sizeKb };
      if (drawing.id === target.id) setDrawing(target);
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
      const pdfRes = buildTechnicalDrawingPdf(targetDrawing, senderConfig);
      const blob = await (await fetch(pdfRes.dataUri)).blob();
      const storagePath = "technical-drawings/" + user.uid + "/" + targetDrawing.id + ".pdf";
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, blob, { contentType: "application/pdf", customMetadata: { ownerUid: user.uid, drawingId: targetDrawing.id } });
      const pdfUrl = await getDownloadURL(fileRef);
      const { pdfDataUri: _temporaryPdfDataUri, ...editableDrawing } = targetDrawing;
      const savedDrawing: TechnicalDrawing = {
        ...editableDrawing,
        createdAt: targetDrawing.createdAt || now,
        updatedAt: now,
        pdfUrl,
        pdfStoragePath: storagePath,
        ownerUid: user.uid,
        schemaVersion: 2,
        pdfFileName: pdfRes.fileName,
        pdfGeneratedAt: now,
        pdfFileSizeKb: pdfRes.sizeKb,
      };
      await setDoc(doc(db, "technical_drawings", targetDrawing.id), savedDrawing);
      setDrawing(savedDrawing);
      if (!silent) showToast("Projeto técnico salvo com desenho editável e PDF.", "success");
      return true;
    } catch (err) {
      console.error("Technical drawing save failed:", err);
      if (!silent) showToast("Não foi possível salvar o projeto técnico. O desenho continua aberto para tentar novamente.", "error");
      return false;
    } finally {
      setIsSaving(false);
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

  const handleOpenSavedDrawing = (item: TechnicalDrawing) => {
    // Registros novos contêm o desenho completo e podem voltar ao editor.
    if (Array.isArray(item.pieces) && item.pieces.length > 0) {
      setDrawing(item);
      setSelectedProjectId(item.projectId || "");
      setCurrentStep(Math.min(Math.max(Number(item.currentStep) || 1, 1), 5));
      setIsPdfModalOpen(false);
      showToast("Projeto técnico carregado para edição.", "success");
      return;
    }
    // Compatibilidade com os registros antigos que armazenavam somente o PDF.
    if ((item as any).pdfUrl || item.pdfDataUri) {
      setDrawing(item);
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
    let generated: TechnicalDrawing | null = null;
    let generationWarning = false;
    try {
      const user = auth.currentUser;
      if (!user) {
        showToast("Entre na sua conta para gerar e salvar projetos técnicos.", "error");
        setIsLoading(false);
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch("/api/technical-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ prompt: inputPrompt, currentDrawing: drawing, catalog: catalogItems }),
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        const serviceError = new Error(responseBody?.error || responseBody?.details || `Falha no serviço de desenho (${res.status})`);
        if (res.status === 401 || res.status === 403) {
          showToast("Sua conta não tem autorização para gerar desenhos. Entre com o usuário autorizado.", "error");
          setIsLoading(false);
          return;
        }
        throw serviceError;
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
      generated = {
        id: "draw_" + Date.now().toString(36),
        title: responseBody.title || "Projeto técnico sob medida",
        description: responseBody.description || inputPrompt,
        category: responseBody.category || "custom",
        unit: responseBody.unit === "mm" ? "mm" : "cm",
        overallDimensions: { width, height, depth: depth > 0 ? depth : undefined },
        pieces: responseBody.pieces,
        visualElements: Array.isArray(responseBody.visualElements) ? responseBody.visualElements : [],
        modelDescription: responseBody.modelDescription || "",
        finalAppearance: responseBody.finalAppearance || "",
        measurementPlan: Array.isArray(responseBody.measurementPlan) ? responseBody.measurementPlan : [],
        cuttingPlan: Array.isArray(responseBody.cuttingPlan) ? responseBody.cuttingPlan : [],
        manufacturingSteps: Array.isArray(responseBody.manufacturingSteps) ? responseBody.manufacturingSteps : [],
        qualityChecklist: Array.isArray(responseBody.qualityChecklist) ? responseBody.qualityChecklist : [],
        assumptions: Array.isArray(responseBody.assumptions) ? responseBody.assumptions : [],
        dimensionLines: Array.isArray(responseBody.dimensionLines) ? responseBody.dimensionLines : [],
        assemblyInstructions: Array.isArray(responseBody.assemblyInstructions) ? responseBody.assemblyInstructions : [],
        steps: Array.isArray(responseBody.steps) && responseBody.steps.length >= 5 ? responseBody.steps.slice(0, 5) : initialSampleDrawing.steps,
        currentStep: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        budget: responseBody.budget,
        isDraft: true,
        status: "PRELIMINARY_CONTINGENCY",
        draftStatus: "preliminary",
        draftLabel: "BORRADOR TÉCNICO - NO VÁLIDO PARA FABRICACIÓN",
      };
      if (generationWarning || responseBody.draftStatus === "preliminary") {
        (generated as any).draftStatus = "preliminary";
        (generated as any).draftLabel = responseBody.draftLabel || "RASCUNHO PRELIMINAR — NÃO LIBERADO PARA FABRICAÇÃO";
        (generated as any).assumptions = [
          ...(Array.isArray((generated as any).assumptions) ? (generated as any).assumptions : []),
          "Desenho de contingência ou resposta não validada pelo serviço de IA. Confirmar todas as medidas, materiais, ferragens e cortes antes de fabricar."
        ];
      }
    } catch (error) {
      console.error("Falha na geração do desenho técnico:", error);
      generated = buildLocalTechnicalDrawing(inputPrompt);
      generationWarning = true;
    }

    try {
      if (!generated) throw new Error("Não foi possível montar o desenho técnico.");
      // O desenho técnico é salvo independentemente do cadastro de um projeto comercial.
      // Se houver projeto selecionado, vincula; caso contrário, mantém como desenho avulso.
      const selectedProject = projects.find((project) => project.id === selectedProjectId);
      generated = { ...generated, projectId: selectedProject?.id, projectName: selectedProject?.name };
      setDrawing(generated);
      setCurrentStep(1);
      if (!presetPrompt) setPrompt("");

      setDrawing(generated);
      if (generationWarning) {
        showToast("A IA não confirmou um desenho técnico válido. Um rascunho preliminar foi aberto, mas não será salvo automaticamente. Revise a geometria e as medidas antes de salvar ou fabricar.", "warning");
      } else {
        const saved = await handleSaveDrawing(generated, true);
        if (saved) {
          showToast("Desenho gerado pela IA e salvo com PDF e dados editáveis.", "success");
        } else {
          showToast("Desenho gerado, mas não foi possível salvar automaticamente. Ele permanece aberto; use Salvar projeto para tentar novamente.", "warning");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

    const handleExportPdf = () => {
    try {
      exportTechnicalDrawingPdf(drawing, senderConfig);
      showToast("Desenho técnico e memorial exportados para PDF.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao exportar o PDF.", "error");
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
                  PDF armazenado ({drawing.pdfFileSizeKb || 40} KB)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Desenho Técnico e Lista de Componentes Inteligente
            </h1>            {(drawing as any).draftStatus === "preliminary" && (
              <div role="alert" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[11px] font-black tracking-wide text-amber-300">
                <AlertCircle className="h-4 w-4" />
                {(drawing as any).draftLabel || "RASCUNHO PRELIMINAR — NÃO LIBERADO PARA FABRICAÇÃO"}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenDrawingPdf()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 text-xs font-bold rounded-xl transition border border-amber-500/40 shadow-sm"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            Pré-visualizar PDF
          </button>
          <button
            onClick={handleSaveDrawing}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Save className="w-4 h-4 text-amber-400" />}
            Salvar desenho
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <Download className="w-4 h-4" />
            Baixar PDF
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
                  Instruções para a IA
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Desenho 2D + medidas + encaixes</span>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Descreva em linguagem natural qualquer peça arquitetônica, esquadria de alumínio ou móvel com suas medidas:
            </p>
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Associar este modelo a um projeto</label>
            <select value={selectedProjectId} onChange={(e) => { const id = e.target.value; const project = projects.find((item) => item.id === id); setSelectedProjectId(id); setDrawing((current) => ({ ...current, projectId: project?.id, projectName: project?.name, updatedAt: new Date().toISOString() })); }} className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white">
              <option value="">Sem projeto associado</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>

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
                placeholder="Ex: uma mesa de madeira de 120x80x75 cm com 4 pernas..."
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
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {drawing.budget.items.map((item, index) => (
                  <div key={item.id || index} className="flex justify-between gap-3 text-[11px] text-slate-300">
                    <span className="truncate">{item.description} ({item.quantity} × {item.unitPrice.toFixed(2)})</span>
                    <span className="font-mono text-emerald-300">{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-[11px] font-bold text-slate-300">
                <span>Materiais + mão de obra</span><span>{drawing.budget.total.toFixed(2)} {drawing.budget.currency}</span>
              </div>
              {drawing.budget.notes && <p className="text-[10px] text-slate-500">{drawing.budget.notes}</p>}
            </div>
          )}
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

          {/* Projetos técnicos salvos: lista completa, mais recente primeiro */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  Projetos Técnicos Guardados ({savedDrawings.length})
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">O projeto salvo mais recentemente aparece primeiro.</p>
              </div>
              {savedDrawings[0] && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                  Último salvo: {new Date(savedDrawings[0].updatedAt || savedDrawings[0].createdAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>

            {savedDrawings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum desenho salvo ainda</p>
                <p className="text-xs text-slate-500 mt-1">Os desenhos gerados são salvos automaticamente neste histórico.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                {savedDrawings.map((item) => {
                  const editable = Array.isArray(item.pieces) && item.pieces.length > 0;
                  const savedAt = item.updatedAt || item.createdAt;
                  return (
                    <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border ${drawing.id === item.id ? "border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.title || "Projeto técnico sem título"}</p>
                        <p className="text-[11px] text-slate-500 truncate">{item.projectName || "Sem projeto associado"} · {savedAt ? new Date(savedAt).toLocaleString("pt-BR") : "Data não informada"}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{item.overallDimensions?.width || "—"} × {item.overallDimensions?.height || "—"}{item.overallDimensions?.depth ? ` × ${item.overallDimensions.depth}` : ""} {item.unit || "cm"} · {editable ? "Desenho editável" : "PDF legado para consulta"}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{item.pdfFileName || "Arquivo PDF"}{item.pdfFileSizeKb ? ` · PDF (${item.pdfFileSizeKb} KB)` : " · Tamanho do PDF indisponível"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => handleOpenSavedDrawing(item)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white transition">
                          <FolderOpen className="w-3.5 h-3.5" /> {editable ? "Abrir / editar" : "Abrir PDF"}
                        </button>
                        <button type="button" onClick={() => handleDeleteDrawing(item)} title="Excluir desenho" aria-label={`Excluir desenho ${item.title}`} className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 p-2 text-rose-600 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
  );
}
