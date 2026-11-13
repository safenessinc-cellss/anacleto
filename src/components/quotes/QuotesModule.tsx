import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Plus,
  Trash,
  Send,
  Sparkles,
  Download,
  CheckCircle,
  Clock,
  ArrowRight,
  Calculator,
  Percent,
  Search,
  Building,
  DollarSign,
  FileCheck,
  Loader2,
  X,
  Eye,
  HardDrive,
  RefreshCw,
  FileDown,
  MessageCircle,
  Mail,
  Pencil,
  Trash2,
  Save
} from "lucide-react";
import { Quote, QuoteItem, Company, SenderConfig, Invoice, TechnicalDrawing } from "../../types";
import { exportQuotePdf, exportInvoicePdf, buildQuotePdf, buildInvoicePdf } from "../../utils/pdfExport";
import { collection, deleteField, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useToast } from "../ToastContext";
import PdfViewerModal from "../common/PdfViewerModal";
import ImageLightbox from "../common/ImageLightbox";
import defaultCompanyLogo from "../../assets/images/anacleto-logo-premium.svg";
import { estimatedCatalogPrice, readAluminumPricePerKg, writeAluminumPricePerKg } from "../../utils/catalogPricing";
import { compactApprovalSenderSnapshot, compactInvoiceForFirestore, compactQuoteForFirestore, sanitizeFirestoreData } from "../../utils/firestorePayloads";
import { buildParametricDrawing, isAluminumPrompt, localParametricSpec } from "../../utils/parametricCad";
import ManufacturingRoute from "../production/ManufacturingRoute";

interface QuotesModuleProps {
  senderConfig: SenderConfig;
  companies: Company[];
  onConvertToInvoice?: (quote: Quote) => void;
  language?: string;
}

export default function QuotesModule({ senderConfig, companies, onConvertToInvoice, language = "pt"}: QuotesModuleProps) {
  const { showToast } = useToast();
  // Catálogo de productos
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [savedDrawings, setSavedDrawings] = useState<TechnicalDrawing[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [debouncedCatalogSearch, setDebouncedCatalogSearch] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [itemPhotoViewer, setItemPhotoViewer] = useState<string[] | null>(null);

  // Carregar desenhos técnicos para vincular o desenho 2D ao orçamento
  useEffect(() => {
    return onSnapshot(collection(db, "technical_drawings"), (snap) => {
      setSavedDrawings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TechnicalDrawing)));
    }, (err) => {
      console.error("Technical drawings listener (quotes):", err);
      showToast("Não foi possível carregar os desenhos técnicos.", "error");
    });
  }, []);

  // Cargar catálogo
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "catalog"), (snap) => {
        const list = snap.docs.map((d) => { const data = d.data(); return { ...data, id: d.id, name: data.name || data.description || "Item sem nome", sku: data.sku || data.code || "", price: Number(data.price || 0), source: "catalog" }; });
        setCatalogItems((current) => [...current.filter((item) => item.source !== "catalog"), ...list]);
      }, (err) => {
        console.error("Catalog listener (quotes):", err);
        showToast("Não foi possível carregar o catálogo de produtos.", "error");
      }),
      onSnapshot(collection(db, "supplier_catalog"), (snap) => {
        const list = snap.docs.map((d) => { const data = d.data(); return { ...data, id: d.id, name: data.name || data.description || "Item sem nome", sku: data.code || data.sku || "", price: Number(data.price || 0), supplier: data.supplier || "", category: data.category || "", unit: data.unit || "un", source: "supplier_catalog" }; });
        setCatalogItems((current) => [...current.filter((item) => item.source !== "supplier_catalog"), ...list]);
      }, (err) => {
        console.error("Supplier catalog listener (quotes):", err);
        showToast("Não foi possível carregar o catálogo de fornecedores.", "error");
      }),
      onSnapshot(collection(db, "registry_items"), (snap) => {
        const list = snap.docs.map((d) => { const data = d.data(); return { ...data, id: d.id, itemId: d.id, name: data.name || data.description || "Item sem nome", sku: data.code || data.sku || "", price: Number(data.price || 0), category: data.category || "", unit: data.unit || "un", width: data.width || 0, height: data.height || 0, depth: data.depth || 0, itemPhotoUrls: data.itemPhotoUrls || [], source: "registry_items" }; });
        setCatalogItems((current) => [...current.filter((item) => item.source !== "registry_items"), ...list]);
      }, (err) => {
        console.error("Items registry listener (quotes):", err);
        showToast("Não foi possível carregar os itens cadastrados.", "error");
      }),
      onSnapshot(collection(db, "price_table"), (snap) => {
        const list = snap.docs.map((d) => { const data = d.data(); return { id: d.id, name: data.name || data.description || "Item sem nome", sku: data.code || data.sku || "", price: Number(data.price || 0), category: data.category || "", unit: data.unit || "un", supplier: data.priceSupplier || data.supplier || "", source: "price_table" }; });
        setCatalogItems((current) => [...current.filter((item) => item.source !== "price_table"), ...list]);
      }, (err) => {
        console.error("Price table listener (quotes):", err);
        showToast("Não foi possível carregar a tabela de preços.", "error");
      }),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);


  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const selectedQuoteIdRef = useRef<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewerPdfQuote, setViewerPdfQuote] = useState<Quote | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [generatingPublicLink, setGeneratingPublicLink] = useState(false);
  const [isQuoteActionLoading, setIsQuoteActionLoading] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ top: 0, right: 8 });
  const actionsMenuButtonRef = useRef<HTMLButtonElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [aluminumPricePerKg, setAluminumPricePerKg] = useState(readAluminumPricePerKg);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionsMenuButtonRef.current?.contains(target) || actionsMenuRef.current?.contains(target)) return;
      setActionsMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsMenuOpen(false);
    };
    const closeOnLayoutChange = () => setActionsMenuOpen(false);
    document.addEventListener("mousedown", handleOutsideMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeOnLayoutChange);
    window.addEventListener("scroll", closeOnLayoutChange, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeOnLayoutChange);
      window.removeEventListener("scroll", closeOnLayoutChange, true);
    };
  }, [actionsMenuOpen]);

  useEffect(() => {
    selectedQuoteIdRef.current = selectedQuote?.id || null;
  }, [selectedQuote?.id]);

  useEffect(() => {
    setActionsMenuOpen(false);
  }, [selectedQuote?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCatalogSearch(catalogSearch.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [catalogSearch]);

  // AI Chat Agent States
  const [aiMessage, setAiMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  // Load Quotes from Firestore in real-time
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "quotes"), orderBy("createdAt", "desc")),
      (snap) => {
        const loaded: Quote[] = [];
        snap.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() } as Quote);
        });
        setQuotes(loaded);
        const selectedId = selectedQuoteIdRef.current;
        const refreshedSelection = selectedId ? loaded.find((quote) => quote.id === selectedId) : undefined;
        if (refreshedSelection) setSelectedQuote(refreshedSelection);
        else if (!selectedId && loaded.length > 0) setSelectedQuote(loaded[0]);
      },
      (err) => {
        console.error("Firestore quotes load failed:", err);
        showToast("Não foi possível carregar os orçamentos.", "error");
      }
    );
    return () => unsub();
  }, []);

  // Criar orçamento vazio; nenhum cliente, produto, imposto ou valor fictício.
  const handleCreateNewQuote = () => {
    const now = new Date().toISOString();
    const quoteId = "quote_" + crypto.randomUUID();
    const newQ: Quote = {
      id: quoteId,
      number: "ORC-" + new Date().getFullYear() + "-" + quoteId.slice(-6).toUpperCase(),
      companyId: "",
      clientName: "",
      clientTaxId: "",
      clientEmail: "",
      clientAddress: "",
      date: now.slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      items: [],
      subtotal: 0,
      labor: 0,
      marginRate: 0,
      margin: 0,
      freight: 0,
      taxRate: 0,
      taxAmount: 0,
      discountRate: 0,
      discountAmount: 0,
      total: 0,
      currency: senderConfig.currency || "BRL",
      status: "draft",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    setSelectedQuote(newQ);
    setIsEditing(true);
  };

  const handleRejectQuote = async () => {
    if (!selectedQuote || !["draft", "pending", "pendente"].includes(String(selectedQuote.status).toLowerCase())) return;
    const updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, "quotes", selectedQuote.id), { status: "rejected", updatedAt });
      const rejected = { ...selectedQuote, status: "rejected" as const, updatedAt };
      setSelectedQuote(rejected);
      setQuotes((current) => current.map((quote) => quote.id === rejected.id ? rejected : quote));
      setIsEditing(false);
      showToast(`Orçamento ${rejected.number} rejeitado.`, "success");
    } catch (error) {
      console.error("Quote rejection failed:", error);
      showToast((error as Error).message || "Não foi possível rejeitar o orçamento.", "error");
    }
  };

  const handleDeleteQuote = async (quote: Quote) => {
    if (!window.confirm(`Excluir o orçamento ${quote.number} permanentemente?`)) return;
    closeActionsMenu();
    try {
      const linkedBudgets = await getDocs(query(collection(db, "budgets"), where("quoteId", "==", quote.id)));
      const references = new Map<string, ReturnType<typeof doc>>();
      references.set(`quotes/${quote.id}`, doc(db, "quotes", quote.id));
      references.set(`budgets/${quote.id}`, doc(db, "budgets", quote.id));
      linkedBudgets.docs.forEach((budget) => references.set(`budgets/${budget.id}`, doc(db, "budgets", budget.id)));
      await Promise.all([...references.values()].map((reference) => deleteDoc(reference)));
      setQuotes((current) => current.filter((item) => item.id !== quote.id));
      setSelectedQuote((current) => current?.id === quote.id ? null : current);
      setIsEditing(false);
      showToast(`Orçamento ${quote.number} excluído.`, "success");
    } catch (error) {
      console.error("Quote deletion failed:", error);
      showToast((error as Error).message || "Não foi possível excluir o orçamento.", "error");
    } finally {
      closeActionsMenu();
    }
  };

  // Recalculate totals
  const recalculateQuote = (current: Quote): Quote => {
    const updatedItems = current.items.map((item) => ({
      ...item,
      subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    }));

    const subtotal = Number(updatedItems.reduce((acc, curr) => acc + curr.subtotal, 0).toFixed(2));
    const labor = Math.max(0, Number(current.labor || 0));
    const marginRate = Math.max(0, Number(current.marginRate || 0));
    const margin = Number(((subtotal + labor) * marginRate / 100).toFixed(2));
    const freight = Math.max(0, Number(current.freight || 0));
    const grossBase = subtotal + labor + margin + freight;
    const discountAmount = Number(((grossBase * (current.discountRate || 0)) / 100).toFixed(2));
    const taxableBase = Math.max(0, grossBase - discountAmount);
    const taxAmount = Number(((taxableBase * (current.taxRate || 0)) / 100).toFixed(2));
    const total = Number((taxableBase + taxAmount).toFixed(2));

    return {
      ...current,
      items: updatedItems,
      subtotal,
      labor,
      marginRate,
      margin,
      freight,
      discountAmount,
      taxAmount,
      total,
      updatedAt: new Date().toISOString(),
    };
  };

  const findCatalogMatch = (item: Record<string, unknown>) => {
    const sku = String(item.sku || "").trim().toLowerCase();
    const catalogId = String(item.catalogItemId || item.itemId || "").trim();
    const description = String(item.description || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const exact = catalogItems.find((candidate) =>
      (catalogId && candidate.id === catalogId) ||
      (sku && String(candidate.sku || candidate.code || "").trim().toLowerCase() === sku) ||
      (description && String(candidate.name || candidate.description || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === description)
    );
    if (exact) return exact;
    const terms = description.split(/\s+/).filter((term) => term.length >= 4 && !/^(perfil|aluminio|janela|porta|vidro|linha)$/.test(term));
    if (!terms.length) return undefined;
    return catalogItems.map((candidate) => {
      const text = `${candidate.name || ""} ${candidate.description || ""} ${candidate.sku || candidate.code || ""} ${candidate.category || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { candidate, score };
    }).filter((result) => result.score >= Math.min(2, terms.length)).sort((a, b) => b.score - a.score)[0]?.candidate;
  };

  const buildLocalQuoteUpdate = (text: string, quote: Quote): Quote => {
    const updated = { ...quote, items: [...quote.items] };
    const taxMatch = text.match(/(?:imposto|iva|taxa)\D{0,12}(\d+(?:[.,]\d+)?)\s*%?/i);
    const marginMatch = text.match(/margem\D{0,12}(\d+(?:[.,]\d+)?)\s*%?/i);
    const freightMatch = text.match(/frete\D{0,12}(?:r\$)?\s*(\d+(?:[.,]\d+)?)/i);
    const discountMatch = text.match(/desconto\D{0,12}(\d+(?:[.,]\d+)?)\s*%?/i);
    if (taxMatch) updated.taxRate = Number(taxMatch[1].replace(",", "."));
    if (marginMatch) updated.marginRate = Number(marginMatch[1].replace(",", "."));
    if (freightMatch) updated.freight = Number(freightMatch[1].replace(",", "."));
    if (discountMatch) updated.discountRate = Number(discountMatch[1].replace(",", "."));
    if (/imposto|iva|taxa|margem|frete|desconto/i.test(text) && !isAluminumPrompt(text) && !/\b(?:adicion|inclu|orcamento|orçamento|comprar)\b/i.test(text)) {
      return recalculateQuote(updated);
    }

    const spec = isAluminumPrompt(text) ? localParametricSpec(text) : undefined;
    const countMatch = text.match(/\b(?:qtd|qtde|quantidade|unidades?)\s*(?:de|:|=)?\s*(\d+)\b/i)
      || text.match(/\b(\d+)\s*(?:x\s*)?(?:un(?:idades?)?\s*(?:de\s*)?)?(?=(?:janelas?|ventanas?|portas?|puertas?|boxes?|box|peças?|pecas?))/i)
      || text.match(/\b(?:janelas?|ventanas?|portas?|puertas?|boxes?|box|peças?|pecas?)\s*(?:x|:)?\s*(\d+)\s*(?:un(?:idades?)?)?\b/i);
    const quantity = Math.max(1, Number(countMatch?.[1] || 1));
    const dimensionMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
    const dimensionToMm = (value: string, unit = "") => {
      const number = Number(value.replace(",", "."));
      const factor = unit.toLowerCase() === "m" ? 1000 : unit.toLowerCase() === "cm" ? 10 : unit.toLowerCase() === "mm" ? 1 : number < 10 ? 1000 : number < 100 ? 10 : 1;
      return Math.round(number * factor);
    };
    const widthMm = spec?.largura_mm || (dimensionMatch ? dimensionToMm(dimensionMatch[1], dimensionMatch[2]) : 0);
    const heightMm = spec?.altura_mm || (dimensionMatch ? dimensionToMm(dimensionMatch[3], dimensionMatch[4]) : 0);
    if (spec && widthMm > 0 && heightMm > 0) {
      const glassColor = text.match(/\b(incolor|bronze|verde|fum[eê]|cinza)\b/i)?.[1]?.toLowerCase();
      const drawing = buildParametricDrawing(
        { ...spec, largura_mm: widthMm, altura_mm: heightMm },
        text,
        catalogItems.filter((item) => item.source === "supplier_catalog"),
      );
      const requestedQuantity = Math.max(1, Number(countMatch?.[1] || 1));
      const glassWidthMm = Math.max(1, Math.round(widthMm / Math.max(1, spec.folhas) - 50));
      const glassHeightMm = Math.max(1, Math.round(heightMm - 80));
      const size = `${widthMm} × ${heightMm} mm`;
      const budgetItems = drawing.budget?.items || [];
      const profileItems = budgetItems.filter((item) => {
        const piece = drawing.pieces.find((candidate) => candidate.id === item.pieceId);
        return Boolean(piece && !/vidro|glass/i.test(`${piece.name} ${piece.material}`));
      });
      const glassItems = budgetItems.filter((item) => !item.pieceId &&
        (item.id === "budget-glass" || /vidro|glass/i.test(item.description)));
      const accessoryItems = budgetItems.filter((item) => !item.pieceId && /ferragem|acess[oó]rio/i.test(item.description));
      const rows = [...profileItems, ...glassItems, ...accessoryItems];
      if (glassItems.length === 0) {
        rows.push({
          id: "local-glass",
          description: `Vidro ${spec.tipo_vidro} ${spec.espessura_mm} mm${glassColor ? ` ${glassColor}` : ""}`,
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
          cutLengthMm: 0,
          priceSource: "pending",
        });
      }
      const additions: QuoteItem[] = rows.map((budgetItem) => {
        const piece = drawing.pieces.find((candidate) => candidate.id === budgetItem.pieceId);
        const matchedCatalogItem = catalogItems.find((candidate) => candidate.id === budgetItem.catalogItemId);
        const isGlass = budgetItem.id === "budget-glass" || budgetItem.id === "local-glass" ||
          /vidro|glass/i.test(`${budgetItem.description} ${piece?.material || ""}`);
        const glassPieces = isGlass ? Math.max(1, spec.folhas) : 1;
        const quantity = Math.max(1, Number(budgetItem.quantity || 1)) * glassPieces * requestedQuantity;
        const unitPrice = Number(budgetItem.unitPrice || 0) / glassPieces;
        const priceSource: QuoteItem["priceSource"] = budgetItem.priceSource === "catalog" || budgetItem.priceSource === "estimated"
          ? budgetItem.priceSource
          : unitPrice > 0 ? "estimated" : "pending";
        return {
          id: `local_${crypto.randomUUID()}`,
          description: `${isGlass ? "Vidro " : ""}${budgetItem.description} · ${spec.linha_aluminio} · ${size}${isGlass ? ` · ${spec.tipo_vidro} ${spec.espessura_mm} mm${glassColor ? ` ${glassColor}` : ""}` : ""}`,
          quantity,
          unitPrice,
          subtotal: Number((quantity * unitPrice).toFixed(2)),
          ...(budgetItem.catalogItemId ? { catalogItemId: budgetItem.catalogItemId } : {}),
          ...(budgetItem.catalogSource ? { catalogSource: budgetItem.catalogSource } : {}),
          ...(budgetItem.sku ? { sku: budgetItem.sku } : {}),
          ...(matchedCatalogItem?.category ? { itemCategory: matchedCatalogItem.category } : {}),
          priceSource,
          notes: isGlass
            ? "Estimativa paramétrica: abatimentos de 50 mm na largura e 80 mm na altura; validar folgas da linha e encaixe da goma EPDM antes do corte."
            : piece?.notes || "Corte paramétrico preliminar; validar a tabela oficial de descontos da linha antes da fabricação.",
          ...(isGlass
            ? { itemDimensions: `${glassWidthMm} × ${glassHeightMm} mm` }
            : { cutLengthMm: Number(budgetItem.cutLengthMm || 0), cutAngle: piece?.cutAngle || "90°" }),
        };
      });
      return recalculateQuote({ ...updated, items: [...updated.items, ...additions] });
    }

    const lineMatch = text.match(/\b(suprema|gold|linha\s*(?:25|\d+))\b/i);
    const glassMatch = text.match(/\b(temperado|templado|laminado|insulado|duplo|comum|float)\b/i);
    const glassColorMatch = text.match(/\b(incolor|bronze|verde|fum[eê]|cinza)\b/i);
    const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const terms = [...new Set(normalizeText(`${text} ${spec?.tipologia || ""}`).split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3 && !/^(quero|faca|fazer|crie|criar|adicione|adicionar|orcamento|orçamento|com|para|uma|por|de|da|do|mm|cm)$/.test(term)))];
    const supplierMatch = catalogItems.filter((item) => item.source === "supplier_catalog").map((item) => {
      const catalogText = normalizeText(`${item.name || ""} ${item.description || ""} ${item.sku || ""} ${item.code || ""} ${item.category || ""}`);
      let score = terms.reduce((sum, term) => sum + (catalogText.includes(term) ? 1 : 0), 0);
      if (lineMatch && catalogText.includes(normalizeText(lineMatch[1]).replace(/^linha\s*/, ""))) score += 4;
      if (glassMatch && catalogText.includes(normalizeText(glassMatch[1]))) score += 2;
      return { item, score };
    }).sort((a, b) => b.score - a.score)[0];
    const match = supplierMatch && supplierMatch.score > 0 ? supplierMatch.item : undefined;
    const typology = spec?.tipologia.replaceAll("_", " ") || (isAluminumPrompt(text) ? "esquadria de alumínio" : "");
    const size = widthMm && heightMm ? `${widthMm} × ${heightMm} mm` : "";
    const line = lineMatch ? lineMatch[1].replace(/^linha\s*/i, "Linha ") : spec && spec.linha_aluminio !== "Linha a definir" ? spec.linha_aluminio : "";
    const glass = glassMatch ? `vidro ${glassMatch[1].toLowerCase()}${glassColorMatch ? ` ${glassColorMatch[1].toLowerCase()}` : ""}${spec ? ` ${spec.espessura_mm} mm` : ""}` : "";
    const freeDescription = [typology, size, line, glass].filter(Boolean).join(" · ") || text.trim();
    const estimated = match ? estimatedCatalogPrice(match, aluminumPricePerKg, Math.max(widthMm, heightMm) || undefined) : undefined;
    const unitPrice = Number(match?.price || 0) > 0 ? Number(match.price) : estimated || 0;
    const item: QuoteItem = {
      id: `local_${crypto.randomUUID()}`,
      description: match ? `${match.name || match.description} · ${freeDescription}` : freeDescription,
      quantity,
      unitPrice,
      subtotal: Number((quantity * unitPrice).toFixed(2)),
      ...(match ? {
        catalogSource: "supplier_catalog",
        catalogItemId: match.id,
        sku: match.sku || match.code || undefined,
        itemCategory: match.category || undefined,
      } : {}),
      priceSource: unitPrice > 0 ? (Number(match?.price || 0) > 0 ? "catalog" : "estimated") : "pending",
      notes: unitPrice > 0
        ? estimated && Number(match?.price || 0) <= 0
          ? `Estimativa a partir do peso kg/m e R$ ${Number(aluminumPricePerKg).toFixed(2)}/kg; validar a composição antes de aprovar.`
          : "Item associado ao catálogo de fornecedores pelo assistente local."
        : "Referência local sem preço confirmado; informar o preço antes de aprovar.",
      ...(size ? { itemDimensions: size } : {}),
    };
    return recalculateQuote({ ...updated, items: [...updated.items, item] });
  };

  // Prioriza o logotipo configurado; usa o ativo oficial do projeto como fallback.
  const preparePdfSender = async () => {
    const configuredLogo = senderConfig.logoUrl || senderConfig.websiteLogoUrl || "";
    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      if (src.startsWith("http://") || src.startsWith("https://")) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Não foi possível carregar o logotipo"));
      image.src = src;
    });
    try {
      let image: HTMLImageElement;
      try { image = await loadImage(configuredLogo || defaultCompanyLogo); }
      catch { image = await loadImage(defaultCompanyLogo); }
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 600;
      canvas.height = image.naturalHeight || 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) return senderConfig;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const logoData = canvas.toDataURL("image/png");
      const watermarkCanvas = document.createElement("canvas");
      watermarkCanvas.width = 900;
      watermarkCanvas.height = 900;
      const watermarkCtx = watermarkCanvas.getContext("2d");
      if (watermarkCtx) {
        watermarkCtx.globalAlpha = 0.075;
        const scale = Math.min(760 / canvas.width, 760 / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        watermarkCtx.drawImage(canvas, (900 - width) / 2, (900 - height) / 2, width, height);
      }
      return { ...senderConfig, logoUrl: logoData, watermarkLogoUrl: watermarkCanvas.toDataURL("image/png") };
    } catch (error) {
      console.warn("Não foi possível preparar o logotipo do orçamento:", error);
      return senderConfig;
    }
  };

  const handleSendQuote = async (channel: "whatsapp" | "email") => {
    if (!selectedQuote) return;
    const popup = window.open("about:blank", "_blank");
    try {
      let pdfSender: SenderConfig | undefined;
      let pdfQuote = selectedQuote;
      if (selectedQuote.approvedSnapshotId) {
        const snapshot = await loadApprovedQuoteSnapshot(selectedQuote.approvedSnapshotId);
        pdfQuote = snapshot.document as Quote;
        pdfSender = snapshot.senderSnapshot as SenderConfig | undefined;
      } else {
        pdfQuote = recalculateQuote(selectedQuote);
        pdfSender = await preparePdfSender();
      }
      const pdf = await buildQuotePdf(pdfQuote, pdfSender);
      pdf.doc.save(pdf.fileName);
      const message = `Olá, ${pdfQuote.clientName}. Segue o orçamento ${pdfQuote.number} no valor de ${formatCurrency(pdfQuote.total, pdfQuote.currency)}. O PDF foi baixado; anexe o arquivo nesta conversa.`;
      if (channel === "whatsapp") {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        if (popup) popup.location.href = url;
        else window.location.href = url;
      } else {
        const subject = encodeURIComponent(`Orçamento ${pdfQuote.number} - Anacleto Esquadrias`);
        const body = encodeURIComponent(`${message}\n\nAtenciosamente,\nAnacleto Esquadrias\n\nAnexe o PDF baixado antes de enviar.`);
        const url = `mailto:${encodeURIComponent(pdfQuote.clientEmail || "")}?subject=${subject}&body=${body}`;
        if (popup) popup.location.href = url;
        else window.location.href = url;
      }
      showToast("PDF baixado. Anexe o arquivo na conversa ou no e-mail antes de enviar.", "success");
    } catch (error) {
      if (popup) popup.close();
      console.error(error);
      showToast("Não foi possível preparar o PDF para envio.", "error");
    }
  };

  const formatCurrency = (value: number, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);

  const loadApprovedQuoteSnapshot = async (snapshotId: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Faça login novamente para consultar a aprovação.");
    const response = await fetch("/api/approved-snapshot?snapshotId=" + encodeURIComponent(snapshotId), {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Não foi possível recuperar a instantânea aprovada.");
    if (data?.type !== "quote" || !data?.document) throw new Error("Instantânea de orçamento inválida.");
    return data;
  };

  const closeActionsMenu = () => setActionsMenuOpen(false);

  const toggleActionsMenu = () => {
    if (actionsMenuOpen) {
      setActionsMenuOpen(false);
      return;
    }
    const rect = actionsMenuButtonRef.current?.getBoundingClientRect();
    if (rect) setActionsMenuPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    setActionsMenuOpen(true);
  };

  const handleDownloadQuotePdf = async (quote: Quote) => {
    try {
      if (quote.approvedSnapshotId) {
        const snapshot = await loadApprovedQuoteSnapshot(quote.approvedSnapshotId);
        const pdf = await buildQuotePdf(snapshot.document as Quote, snapshot.senderSnapshot as SenderConfig | undefined);
        pdf.doc.save(pdf.fileName);
      } else {
        const sender = await preparePdfSender();
        await exportQuotePdf(quote, sender);
      }
    } catch (error) {
      console.error("Quote PDF download failed:", error);
      showToast((error as Error).message || "Não foi possível baixar o PDF.", "error");
    }
  };

  const handleApproveQuote = async () => {
    closeActionsMenu();
    if (!selectedQuote) return;
    if (selectedQuote.approvedSnapshotId) {
      showToast("Este orçamento já está aprovado e bloqueado por instantânea.", "warning");
      return;
    }
    if (isEditing) {
      showToast("Salve as alterações do orçamento antes de aprová-lo.", "warning");
      return;
    }
    if (selectedQuote.items.some((item) => item.priceSource === "pending")) {
      showToast("Confirme os preços pendentes do orçamento antes de aprová-lo.", "warning");
      return;
    }
    setIsQuoteActionLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Faça login novamente para aprovar o orçamento.");
      const approvalCandidate = recalculateQuote(selectedQuote);
      const quoteRef = doc(db, "quotes", approvalCandidate.id);
      const persistedQuote = await getDoc(quoteRef);
      if (!persistedQuote.exists()) {
        await setDoc(quoteRef, compactQuoteForFirestore(approvalCandidate));
      }
      const senderSnapshot = compactApprovalSenderSnapshot(senderConfig);
      const response = await fetch("/api/approved-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ type: "quote", documentId: selectedQuote.id, senderSnapshot }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Não foi possível congelar o orçamento.");
      const approved = {
        ...result.snapshot.document,
        approvedSnapshotId: result.snapshotId,
        productionOrderId: result.productionOrderId || result.snapshot.document.productionOrderId,
      };
      setSelectedQuote(approved);
      setQuotes((previous) => previous.map((item) => item.id === approved.id ? approved : item));
      showToast("Orçamento aprovado e congelado. Ordem de produção criada automaticamente no painel Produção & Obras.", "success");
    } catch (error) {
      console.error("Quote approval failed:", error);
      showToast((error as Error).message || "Falha ao aprovar o orçamento.", "error");
    } finally {
      setIsQuoteActionLoading(false);
      closeActionsMenu();
    }
  };

  // Build the PDF on demand; generated files remain in memory only.
  const handleOpenQuotePdf = async (quote: Quote) => {
    let target = quote;
    try {
      let sender: SenderConfig | undefined;
      if (quote.approvedSnapshotId) {
        const snapshot = await loadApprovedQuoteSnapshot(quote.approvedSnapshotId);
        target = snapshot.document as Quote;
        sender = (snapshot.senderSnapshot || target.senderSnapshot) as SenderConfig | undefined;
      } else {
        sender = await preparePdfSender();
      }
      const pdfRes = await buildQuotePdf(target, sender);
      target = {
        ...target,
        pdfDataUri: pdfRes.dataUri,
        pdfFileName: pdfRes.fileName,
        pdfGeneratedAt: new Date().toISOString(),
        pdfFileSizeKb: pdfRes.sizeKb,
      };
    } catch (err) {
      console.warn("Could not prepare quote PDF from its source snapshot:", err);
      showToast((err as Error).message || "Não foi possível preparar o PDF.", "error");
      return;
    }
    setViewerPdfQuote(target);
    setIsPdfModalOpen(true);
  };

  // Save only the light quote data; generate its PDF when requested.
  const handleSaveQuote = async (quoteToSave?: Quote, allowUnpricedDraft = false): Promise<boolean> => {
    closeActionsMenu();
    const requested = quoteToSave || selectedQuote;
    if (!requested) return false;
    if (requested.invoiceId || requested.status === "invoiced") {
      showToast("Este orçamento já foi faturado e não pode ser editado.", "warning");
      return false;
    }
    const editingExistingQuote = isEditing && quotes.some((quote) => quote.id === requested.id);
    let target = recalculateQuote({
      ...requested,
      ...(editingExistingQuote && requested.status !== "draft" ? { status: "draft" as const } : {}),
      ...(requested.approvedSnapshotId ? {
        approvedSnapshotId: undefined,
        approvedAt: undefined,
        approvedBy: undefined,
        snapshotContentHash: undefined,
      } : {}),
    });
    if (!allowUnpricedDraft && target.items.length > 0 && target.total <= 0) {
      showToast("O orçamento tem componentes sem preço confirmado ou estimado. Revise os valores antes de salvar um total de R$ 0,00.", "error");
      return false;
    }
    setIsQuoteActionLoading(true);
    try {
      const quoteRef = doc(db, "quotes", target.id);
      const existing = await getDoc(quoteRef);
      const payload = sanitizeFirestoreData({
        ...compactQuoteForFirestore(target),
        pdfDataUri: deleteField(),
        pdfFileName: deleteField(),
        pdfGeneratedAt: deleteField(),
        pdfFileSizeKb: deleteField(),
        ...(existing.data()?.approvedSnapshotId ? {
          approvedSnapshotId: deleteField(),
          approvedAt: deleteField(),
          approvedBy: deleteField(),
          snapshotContentHash: deleteField(),
        } : {}),
      });
      if (existing.exists()) await updateDoc(quoteRef, payload);
      else await setDoc(quoteRef, payload, { merge: true });
      setSelectedQuote(target);
      setIsEditing(false);
      showToast(`Orçamento ${target.number} salvo. O PDF será gerado ao visualizar ou exportar.`, "success");
      return true;
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar orçamento no Firestore.", "error");
      return false;
    } finally {
      setIsQuoteActionLoading(false);
      closeActionsMenu();
    }
  };

  const handleGeneratePublicLink = async () => {
    if (!selectedQuote?.id) return;
    const user = auth.currentUser;
    if (!user) {
      showToast("Faça login novamente para gerar o link da proposta.", "error");
      return;
    }
    setGeneratingPublicLink(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action: "generate", id: selectedQuote.id }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.token !== "string") throw new Error(result.error || "Não foi possível gerar o link.");
      const url = new URL(`/proposta/${encodeURIComponent(selectedQuote.id)}`, window.location.origin);
      url.searchParams.set("token", result.token);
      await navigator.clipboard.writeText(url.toString());
      const updated = { ...selectedQuote, publicProposalEnabled: true, publicProposalToken: result.token };
      setSelectedQuote(updated);
      setQuotes((current) => current.map((quote) => quote.id === updated.id ? updated : quote));
      showToast("Link público seguro copiado para a área de transferência.", "success");
    } catch (error) {
      console.error("Public proposal link generation failed:", error);
      showToast(error instanceof Error ? error.message : "Não foi possível gerar o link da proposta.", "error");
    } finally {
      setGeneratingPublicLink(false);
    }
  };

  // Convert the approved quote to an invoice; the PDF is generated on demand.
  const handleConvertQuoteToInvoice = async (quote: Quote) => {
    closeActionsMenu();
    if (isEditing) {
      showToast("Salve as alterações do orçamento antes de gerar a fatura.", "warning");
      return;
    }
    setIsQuoteActionLoading(true);
    try {
      let approvedQuote = quote;
      let invoiceSender: SenderConfig = senderConfig;
      let snapshot: any;
      if (quote.approvedSnapshotId) {
        snapshot = await loadApprovedQuoteSnapshot(quote.approvedSnapshotId);
      } else {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Faça login novamente para gerar a fatura.");
        // Freeze the same recalculated totals that will be used by the invoice PDF.
        approvedQuote = recalculateQuote(quote);
        const quoteRef = doc(db, "quotes", approvedQuote.id);
        const persistedQuote = await getDoc(quoteRef);
        if (!persistedQuote.exists()) {
          await setDoc(quoteRef, compactQuoteForFirestore(approvedQuote));
        }
        const senderSnapshot = compactApprovalSenderSnapshot(senderConfig);
        const approvalResponse = await fetch("/api/approved-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ type: "quote", documentId: quote.id, senderSnapshot }),
        });
        const approvalResult = await approvalResponse.json();
        if (!approvalResponse.ok) throw new Error(approvalResult?.error || "Não foi possível congelar o orçamento antes de faturar.");
        snapshot = approvalResult.snapshot;
        setSelectedQuote({ ...snapshot.document, approvedSnapshotId: approvalResult.snapshotId });
      }
      approvedQuote = { ...snapshot.document, id: quote.id, approvedSnapshotId: quote.approvedSnapshotId || snapshot.document.approvedSnapshotId } as Quote;
      invoiceSender = snapshot.senderSnapshot || senderConfig;

      // Recompute from the approved line items instead of trusting possibly stale
      // aggregate fields. This prevents a valid priced quote becoming a R$ 0.00 invoice.
      if (!Array.isArray(approvedQuote.items) || approvedQuote.items.length === 0) {
        throw new Error("O orçamento aprovado não possui itens. Adicione os materiais e serviços antes de emitir a fatura.");
      }
      const calculatedQuote = recalculateQuote(approvedQuote);
      const invalidLine = calculatedQuote.items.find(item =>
        !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 ||
        item.unitPrice === undefined || item.unitPrice === null || String(item.unitPrice).trim() === "" ||
        !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0
      );
      if (invalidLine) {
        throw new Error(`O item "${invalidLine.description || "sem descrição"}" está sem preço válido. Atualize o preço pelo catálogo Materiais e Componentes antes de emitir a fatura.`);
      }
      if (!Number.isFinite(calculatedQuote.total) || calculatedQuote.total <= 0) {
        throw new Error("O valor total calculado é zero ou inválido. A fatura não será criada; revise os preços e os impostos do orçamento.");
      }
      approvedQuote = calculatedQuote;

      const quoteRef = doc(db, "quotes", approvedQuote.id);
      const invoiceRef = doc(collection(db, "invoices"));
      const invoiceId = invoiceRef.id;
      const invoiceNumber = "FAT-" + new Date().getFullYear() + "-" + invoiceId.slice(-8).toUpperCase();
      const baseInvoice: Invoice = {
        id: invoiceId, number: invoiceNumber, quoteId: approvedQuote.id, companyId: approvedQuote.companyId,
        clientName: approvedQuote.clientName, clientEmail: approvedQuote.clientEmail, clientTaxId: approvedQuote.clientTaxId,
        clientAddress: approvedQuote.clientAddress, date: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split("T")[0],
        items: approvedQuote.items, subtotal: approvedQuote.subtotal, labor: approvedQuote.labor,
        marginRate: approvedQuote.marginRate, margin: approvedQuote.margin, freight: approvedQuote.freight,
        taxRate: approvedQuote.taxRate, taxAmount: approvedQuote.taxAmount,
        discountRate: approvedQuote.discountRate, discountAmount: approvedQuote.discountAmount, total: approvedQuote.total,
        currency: approvedQuote.currency, senderSnapshot: invoiceSender, status: "pendente", paymentMethod: "Transferência Bancária",
        notes: `Fatura gerada a partir do orçamento ${approvedQuote.number}.`,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const finalInvoice: Invoice = baseInvoice;
      const linkedOrders = await getDocs(query(collection(db, "production_orders"), where("quoteId", "==", approvedQuote.id)));
      await runTransaction(db, async tx => {
        const current = await tx.get(quoteRef);
        if (!current.exists()) throw new Error("Orçamento não encontrado.");
        if (current.data().invoiceId) throw new Error("Este orçamento já possui uma fatura vinculada.");
        if (!["accepted", "approved", "aprovado"].includes(String(current.data().status || ""))) throw new Error("Aprove o orçamento antes de gerar a fatura.");
        tx.set(invoiceRef, compactInvoiceForFirestore(finalInvoice));
        tx.set(doc(db, "receivables", invoiceId), sanitizeFirestoreData({
          clientId: approvedQuote.companyId || "", clientName: approvedQuote.clientName || "Cliente",
          description: `Fatura ${invoiceNumber} · Orçamento ${approvedQuote.number}`,
          amount: Number(approvedQuote.total || 0), receivedAmount: 0, dueDate: baseInvoice.dueDate,
          paymentMethod: "transferencia", status: "pending", invoiceId, quoteId: approvedQuote.id,
          notes: "Gerado automaticamente na conversão do orçamento.", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        }));
        tx.update(quoteRef, sanitizeFirestoreData({ status: "invoiced", invoiceId, invoicedAt: serverTimestamp(), productionStatus: "invoiced", updatedAt: serverTimestamp() }));
        linkedOrders.docs.forEach((orderDoc) => tx.update(orderDoc.ref, {
          status: "invoiced", workflowStage: "payment", nextStep: "registrar_recebimento",
          invoiceId, invoiceNumber, invoiceStatus: "pending", updatedAt: serverTimestamp(),
        }));
      });
      showToast(`Fatura ${invoiceNumber} gerada e vinculada ao Financeiro.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao gerar fatura: " + ((err as Error).message || "erro desconhecido"), "error");
    } finally {
      setIsQuoteActionLoading(false);
      closeActionsMenu();
    }
  };

  const handleSendAiMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiMessage.trim() || !selectedQuote) return;

    const userText = aiMessage.trim();
    setAiMessage("");
    setIsAiLoading(true);

    const newHistory = [...aiChatHistory, { role: "user" as const, text: userText }];
    setAiChatHistory(newHistory);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Entre na sua conta para usar o assistente de orçamentos.");

      // Orçamentos recém-criados existem primeiro apenas no estado local.
      // O agente valida a versão persistida no servidor, portanto grave o rascunho
      // uma única vez antes da primeira chamada, sem sobrescrever documentos existentes.
      const quoteRef = doc(db, "quotes", selectedQuote.id);
      const savedQuote = await getDoc(quoteRef);
      if (!savedQuote.exists()) {
        await setDoc(quoteRef, compactQuoteForFirestore(recalculateQuote(selectedQuote)));
      }

      const res = await fetch("/api/ai/quote-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(3_000),
        body: JSON.stringify({
          message: userText,
          currentQuote: {
            id: selectedQuote.id, number: selectedQuote.number, clientName: selectedQuote.clientName,
            items: selectedQuote.items.map(item => ({ id: item.id, itemId: item.itemId || "", catalogItemId: (item as any).catalogItemId || "", catalogSource: (item as any).catalogSource || "", sku: (item as any).sku || "", description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })),
            subtotal: selectedQuote.subtotal, labor: selectedQuote.labor || 0, marginRate: selectedQuote.marginRate || 0, freight: selectedQuote.freight || 0,
            taxRate: selectedQuote.taxRate, discountRate: selectedQuote.discountRate || 0,
            total: selectedQuote.total, currency: selectedQuote.currency, notes: selectedQuote.notes || "",
          },
          history: newHistory.slice(-12),
          catalog: catalogItems.map((item) => ({
            id: item.id, name: item.name, description: item.description, sku: item.sku || item.code,
            code: item.code, price: item.price, category: item.category, unit: item.unit,
            supplier: item.supplier, source: item.source,
          })),
        }),
      });

      const errorBody = await res.clone().json().catch(() => null);
      if (!res.ok) throw new Error(errorBody?.error || `Erro no servidor de IA (${res.status}).`);

      const data = await res.json();

      // A IA nunca aprova um orçamento por conta própria nem emite fatura antes da aprovação humana.
      if (data.action === "none") {
        setAiChatHistory((prev) => [...prev, { role: "assistant", text: data.reply || "Nenhuma alteração foi aplicada ao orçamento." }]);
        return;
      }
      if (data.action === "generate_invoice") {
        const approved = ["accepted", "approved", "aprovado"].includes(String(selectedQuote.status || "").toLowerCase());
        if (!approved) {
          setAiChatHistory((prev) => [...prev, { role: "assistant", text: "O orçamento ainda não está aprovado. Registre a aprovação do cliente no orçamento antes de emitir a fatura." }]);
          return;
        }
        await handleConvertQuoteToInvoice(selectedQuote);
        setAiChatHistory((prev) => [...prev, { role: "assistant", text: `Solicitação de emissão da fatura processada para o orçamento ${selectedQuote.number}. Confira o resultado no módulo de Faturas.` }]);
        return;
      }

      // Update quote state based on AI response
      let updated: Quote = { ...selectedQuote };

      if (data.taxRate !== undefined && !isNaN(data.taxRate)) {
        updated.taxRate = Number(data.taxRate);
      }
      if (data.discountRate !== undefined && !isNaN(data.discountRate)) {
        updated.discountRate = Number(data.discountRate);
      }
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        // If items are brand new or appended
        updated.items = data.items.map((it: any, idx: number) => {
          const match = findCatalogMatch(it);
          const listedPrice = Number(match?.price || 0);
          const estimatedPrice = match ? estimatedCatalogPrice(match, aluminumPricePerKg) : undefined;
          const suppliedPrice = Number(it.unitPrice);
          const unitPrice = Number.isFinite(suppliedPrice) && suppliedPrice > 0
            ? suppliedPrice
            : listedPrice > 0 ? listedPrice : estimatedPrice || 0;
          const quantity = Number(it.quantity || 1);
          const priceSource = suppliedPrice > 0 ? it.priceSource || "catalog" : listedPrice > 0 ? "catalog" : estimatedPrice ? "estimated" : "pending";
          return {
            id: it.id || `it_${idx + 1}`,
            itemId: it.itemId || match?.itemId || (match?.source === "registry_items" ? match.id : undefined),
            catalogItemId: it.catalogItemId || match?.id || undefined,
            catalogSource: it.catalogSource || match?.source || undefined,
            sku: it.sku || match?.sku || match?.code || undefined,
            description: it.description || match?.name || "Componente do orçamento",
            quantity,
            unitPrice,
            subtotal: Number((quantity * unitPrice).toFixed(2)),
            itemPhotoUrl: match?.itemPhotoUrls?.[0] || match?.imageUrl || undefined,
            itemPhotoUrls: match?.itemPhotoUrls || undefined,
            itemCategory: match?.category || undefined,
            priceSource,
            notes: priceSource === "pending"
              ? "Preço pendente de confirmação no catálogo."
              : priceSource === "estimated"
                ? "Preço estimado com base no peso por metro e valor configurado do alumínio por kg."
                : "Preço confirmado no catálogo.",
          };
        });
      }

      updated = recalculateQuote(updated);
      setSelectedQuote(updated);
      const saved = await handleSaveQuote(updated);
      if (!saved) throw new Error("A resposta da IA foi recebida, mas o orçamento não pôde ser salvo.");

      setAiChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || "Recalculei os itens, impostos e totais do seu orçamento em tempo real.",
        },
      ]);
    } catch (err: any) {
      console.error("Quote assistant request failed:", err);
      try {
        const hasLocalIntent = isAluminumPrompt(userText)
          || /(?:imposto|iva|taxa|margem|frete|desconto)\D{0,12}\d/i.test(userText)
          || /\b(?:vidro|glass)\b/i.test(userText) && /\b(?:temperado|templado|laminado|insulado|duplo|comum|float|mm|cm|m)\b/i.test(userText);
        if (!hasLocalIntent) {
          setAiChatHistory((prev) => [...prev, {
            role: "assistant",
            text: "A API de IA está indisponível e este pedido não é compatível com o motor local. Nenhuma alteração foi aplicada ao orçamento.",
          }]);
          return;
        }
        const localQuote = buildLocalQuoteUpdate(userText, selectedQuote);
        const saved = await handleSaveQuote(localQuote, true);
        if (!saved) throw new Error("Não foi possível salvar o orçamento localmente. Confira a conexão e as permissões da conta.");
        const addedItems = localQuote.items.slice(selectedQuote.items.length);
        const hasUnpricedItems = addedItems.some((item) => item.priceSource === "pending");
        const failureReason = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
          ? "A API de IA excedeu o limite de 3 segundos."
          : "A API de IA falhou ou está indisponível.";
        const localReply = addedItems.length === 0
          ? `${failureReason} Apliquei e salvei o ajuste localmente.`
          : hasUnpricedItems
            ? `${failureReason} Salvei o orçamento gerado localmente com referências sem preço confirmado; informe os preços antes de aprovar.`
            : `${failureReason} Interpretei o pedido localmente, associei itens do catálogo e salvei o orçamento.`;
        setAiChatHistory((prev) => [...prev, { role: "assistant", text: localReply }]);
      } catch (fallbackError) {
        console.error("Local quote fallback failed:", fallbackError);
        setAiChatHistory((prev) => [...prev, {
          role: "assistant",
          text: fallbackError instanceof Error ? fallbackError.message : "A API falhou e não foi possível salvar o orçamento localmente.",
        }]);
        showToast("Não foi possível salvar o orçamento localmente.", "error");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSelectClient = (companyId: string) => {
    const comp = companies.find((c) => c.id === companyId);
    if (!comp || !selectedQuote) return;
    setSelectedQuote({
      ...selectedQuote,
      companyId: comp.id,
      clientName: comp.name,
      clientTaxId: comp.taxId,
      clientEmail: comp.email,
      clientAddress: comp.address,
    });
  };

  // Line items controls
  
  const addFromCatalog = (item: any, quoteItems: any[], setQuoteItems: any) => {
    const newItem = {
      id: Math.random().toString(36).substring(2),
      description: `${item.name}${item.sku ? ` (${item.sku})` : ""}${item.supplier ? ` — ${item.supplier}` : ""}`,
      quantity: 1,
      unitPrice: estimatedCatalogPrice(item, aluminumPricePerKg) || 0,
                          itemId: item.itemId || (item.source === "registry_items" ? item.id : undefined),
                          catalogSource: item.source,
                          catalogItemId: item.id,
                          sku: item.sku || item.code || "",
                          itemPhotoUrl: item.itemPhotoUrls?.[0],
                          itemPhotoUrls: item.itemPhotoUrls || [],
                          itemCategory: item.category,
                          itemDimensions: [item.width,item.height,item.depth].filter(Boolean).join(" × "),
                          priceSource: Number(item.price || 0) > 0 ? "catalog" : estimatedCatalogPrice(item, aluminumPricePerKg) ? "estimated" : "pending",
                          notes: Number(item.price || 0) > 0 ? undefined : estimatedCatalogPrice(item, aluminumPricePerKg) ? "Preço estimado pelo peso do perfil e valor configurado do alumínio por kg." : "Preço pendente de confirmação no catálogo.",
      unit: item.unit || "UN",
    };
    setQuoteItems([...quoteItems, newItem]);
    setShowCatalog(false);
    setCatalogSearch("");
  };

const handleAddItem = () => {
    if (!selectedQuote) return;
    const newItem: QuoteItem = {
      id: "it_" + Math.random().toString(36).substring(2, 7),
      description: "",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    };
    const updated = recalculateQuote({
      ...selectedQuote,
      items: [...selectedQuote.items, newItem],
    });
    setSelectedQuote(updated);
  };

  const handleRemoveItem = (id: string) => {
    if (!selectedQuote) return;
    const updated = recalculateQuote({
      ...selectedQuote,
      items: selectedQuote.items.filter((it) => it.id !== id),
    });
    setSelectedQuote(updated);
  };

  const handleUpdateItem = (id: string, field: "description" | "quantity" | "unitPrice" | "sku", val: any) => {
    if (!selectedQuote) return;
    const updatedItems = selectedQuote.items.map((it) => {
      if (it.id === id) {
        const next = { ...it, [field]: val };
        next.subtotal = Number((next.quantity * next.unitPrice).toFixed(2));
        return next;
      }
      return it;
    });
    const updated = recalculateQuote({ ...selectedQuote, items: updatedItems });
    setSelectedQuote(updated);
  };

  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || q.status === filterStatus;
    return matchesSearch && matchesStatus;
  });
  const latestAiReply = [...aiChatHistory].reverse().find((message) => message.role === "assistant")?.text;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Orçamentos & Propostas</h1>
            <span className="text-xs text-slate-500">{quotes.length} orçamentos</span>
          </div>
        </div>

        <button
          onClick={handleCreateNewQuote}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </div>

      {/* Main Grid: Left = Quotes List (4 cols); Right = Active Quote Detail (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: List & Search Filter */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por número ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["all", "pendente", "approved", "rejeitado"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg uppercase transition whitespace-nowrap ${
                    filterStatus === st
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {st === "all" ? "Todos" : st === "pendente" ? "Pendentes" : st === "approved" ? "Aprovados" : "Rejeitados"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
            {filteredQuotes.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhum orçamento cadastrado.</p>
              </div>
            ) : (
              filteredQuotes.map((q) => (
                <div
                  key={q.id}
                  onClick={() => {
                    setSelectedQuote(q);
                    setIsEditing(false);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    selectedQuote?.id === q.id
                      ? "bg-slate-800/90 border-amber-500/60 shadow-lg"
                      : "bg-slate-900 hover:bg-slate-800/50 border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-amber-400">{q.number}</span>
                      <h4 className="text-xs font-bold text-white mt-0.5">{q.clientName}</h4>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        q.status === "approved"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : ["rejeitado", "rejected"].includes(String(q.status).toLowerCase())
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">{q.items.length} itens</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white">
                        {q.total?.toFixed(2)} {q.currency || "BRL"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenQuotePdf(q);
                        }}
                        title="Gerar e visualizar PDF"
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-400 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedQuote(q);
                          setIsEditing(true);
                        }}
                        title={`Editar orçamento ${q.number}`}
                        aria-label={`Editar orçamento ${q.number}`}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-700 hover:text-blue-300"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteQuote(q);
                        }}
                        title={`Excluir orçamento ${q.number}`}
                        aria-label={`Excluir orçamento ${q.number}`}
                        className="rounded-lg p-1 text-rose-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Quote Form */}
        <div className="lg:col-span-8 space-y-6">
          {selectedQuote ? (
            <div className="space-y-6">
              {/* Document Header & Actions */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-amber-400">{selectedQuote.number}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-400">Data: {selectedQuote.date}</span>
                    </div>
                    <h2 className="text-lg font-black text-white mt-1">Orçamento para: {selectedQuote.clientName}</h2>
                    {selectedQuote.deliveryEvidence && <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><p className="font-bold">Entrega concluída · {selectedQuote.deliveryStatus} · Recebido por {selectedQuote.deliveryEvidence.signedBy}</p><div className="mt-2 flex flex-wrap gap-2">{selectedQuote.deliveryEvidence.photos.map(photo=><a key={photo.path} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt="Foto da entrega" className="h-14 w-20 rounded object-cover"/></a>)}<a href={selectedQuote.deliveryEvidence.signatureUrl} target="_blank" rel="noreferrer" className="rounded border border-emerald-300 px-3 py-2 font-bold">Assinatura</a><a href={`https://maps.google.com/?q=${selectedQuote.deliveryEvidence.latitude},${selectedQuote.deliveryEvidence.longitude}`} target="_blank" rel="noreferrer" className="rounded border border-emerald-300 px-3 py-2 font-bold">GPS</a></div></div>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedQuote.invoiceId || selectedQuote.status === "invoiced") {
                          showToast("Este orçamento já foi faturado e não pode ser editado.", "warning");
                          return;
                        }
                        setIsEditing(true);
                      }}
                      className="rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    >
                      Editar Orçamento
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteQuote(selectedQuote)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir / Apagar
                    </button>
                    {["draft", "pending", "pendente"].includes(String(selectedQuote.status).toLowerCase()) && (
                      <>
                        <button
                          type="button"
                          onClick={handleApproveQuote}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                        >
                          Marcar como Aprovado
                        </button>
                        <button
                          type="button"
                          onClick={handleRejectQuote}
                          className="rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Cancelar / Rejeitar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => void handleGeneratePublicLink()}
                      disabled={generatingPublicLink}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {generatingPublicLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Gerar Link para Cliente
                    </button>
                    <button
                      ref={actionsMenuButtonRef}
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={actionsMenuOpen}
                      onClick={toggleActionsMenu}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Ações ▾
                    </button>
                    {selectedQuote.approvedSnapshotId && (
                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold uppercase text-emerald-700">
                        Aprovado
                      </span>
                    )}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => void handleSaveQuote()}
                        disabled={isQuoteActionLoading}
                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Salvar orçamento
                      </button>
                    )}
                  </div>
                </div>

                <fieldset disabled={!isEditing || Boolean(selectedQuote.invoiceId || selectedQuote.status === "invoiced")} className="contents">
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-2.5">
                  <form onSubmit={handleSendAiMessage} className="flex items-center gap-2">
                    <Sparkles className="ml-1 h-4 w-4 shrink-0 text-amber-400" />
                    <input
                      type="text"
                      value={aiMessage}
                      onChange={(event) => setAiMessage(event.target.value)}
                      placeholder="Peça à IA: ex. 'adicione 2 janelas 150x120' ou 'mude imposto para 10%'"
                      aria-label="Instrução para o agente de IA"
                      className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white placeholder-slate-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAiLoading || !aiMessage.trim()}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                    >
                      {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {isAiLoading ? "Processando" : "Enviar"}
                    </button>
                  </form>
                  {latestAiReply && <p aria-live="polite" className="truncate px-8 pt-1 text-[10px] text-slate-400" title={latestAiReply}>{latestAiReply}</p>}
                </div>

                {/* Client */}
                <div className="grid grid-cols-1 gap-4 pt-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                      Selecionar cliente (CRM):
                    </label>
                    <select
                      value={selectedQuote.companyId || ""}
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500/50"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.taxId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vincular desenho técnico 2D ao orçamento */}
                <div className="mt-5 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-amber-300 mb-2">
                    Desenho 2D do produto orçado
                  </label>
                  <select
                    value={selectedQuote.technicalDrawing?.id || ""}
                    onChange={(e) => {
                      const drawing = savedDrawings.find((d) => d.id === e.target.value);
                      const updated = { ...selectedQuote, technicalDrawing: drawing || undefined, pdfDataUri: undefined, pdfFileName: undefined, pdfGeneratedAt: undefined };
                      setSelectedQuote(updated);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500/50"
                  >
                    <option value="">Selecionar desenho técnico salvo (opcional)</option>
                    {savedDrawings.map((drawing) => (
                      <option key={drawing.id} value={drawing.id}>
                        {drawing.title} — {drawing.overallDimensions?.width} × {drawing.overallDimensions?.height} {drawing.unit}
                      </option>
                    ))}
                  </select>
                  {selectedQuote.technicalDrawing && (
                    <p className="text-[11px] text-slate-300 mt-2">
                      Desenho vinculado: <strong>{selectedQuote.technicalDrawing.title}</strong>. O PDF incluirá uma página 2D com as medidas do desenho selecionado.
                    </p>
                  )}
                  {savedDrawings.length === 0 && (
                    <p className="text-[11px] text-slate-500 mt-2">Nenhum desenho salvo encontrado. Crie e salve o produto no módulo Desenho Técnico.</p>
                  )}
                </div>
                {/* Table of Items */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                      Itens e conceitos do trabalho
                    </h3>
                    
        {/* Botón para abrir catálogo */}
        <div className="mb-4">
          <label className="mb-3 block text-[10px] font-semibold text-slate-500">Valor de referência do alumínio (R$/kg)
            <input type="number" min="0.01" step="0.01" value={aluminumPricePerKg} onChange={(event) => setAluminumPricePerKg(writeAluminumPricePerKg(Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900" />
          </label>
          <button
            type="button"
            onClick={() => setShowCatalog(!showCatalog)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100"
          >
            🛒 {showCatalog ? "Fechar catálogo" : "Buscar no catálogo"}
          </button>
          
          {showCatalog && (
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border">
              <input
                placeholder="Buscar por código ou nome..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg mb-3"
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {catalogItems
                  .filter((i) => 
                    i.name?.toLowerCase().includes(debouncedCatalogSearch) ||
                    i.sku?.toLowerCase().includes(debouncedCatalogSearch) || i.category?.toLowerCase().includes(debouncedCatalogSearch) || [i.width, i.height, i.depth].join(" ").includes(debouncedCatalogSearch)
                  )
                  .slice(0, 20)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        // Adicionar o produto ao orçamento
                        const newItem: QuoteItem = {
                          id: Math.random().toString(36).substring(2),
                          description: item.name + (item.sku ? " (" + item.sku + ")" : "") + (item.width || item.height || item.depth ? " · " + [item.width,item.height,item.depth].filter(Boolean).join(" × ") + " mm" : ""),
                          quantity: 1,
                          unitPrice: estimatedCatalogPrice(item, aluminumPricePerKg) || 0,
                          itemId: item.itemId || (item.source === "registry_items" ? item.id : undefined),
                          catalogSource: item.source,
                          catalogItemId: item.id,
                          sku: item.sku || item.code || "",
                          itemPhotoUrl: item.itemPhotoUrls?.[0],
                          itemPhotoUrls: item.itemPhotoUrls || [],
                          itemCategory: item.category,
                          itemDimensions: [item.width,item.height,item.depth].filter(Boolean).join(" × "),
                          priceSource: Number(item.price || 0) > 0 ? "catalog" : estimatedCatalogPrice(item, aluminumPricePerKg) ? "estimated" : "pending",
                          notes: Number(item.price || 0) > 0 ? undefined : estimatedCatalogPrice(item, aluminumPricePerKg) ? "Preço estimado pelo peso do perfil e valor configurado do alumínio por kg." : "Preço pendente de confirmação no catálogo.",
                        };
                        if (selectedQuote) {
                          setSelectedQuote(recalculateQuote({ ...selectedQuote, items: [...selectedQuote.items, newItem] }));
                        }
                        setShowCatalog(false);
                        setCatalogSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 rounded flex justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">{item.itemPhotoUrls?.[0] && <img src={item.itemPhotoUrls[0]} alt="" className="h-10 w-10 rounded object-cover"/>}<span><strong>{item.sku || "Sem código"}</strong> — {item.name}{item.supplier ? " · " + item.supplier : ""}{item.width || item.height || item.depth ? <small className="block text-slate-500">{[item.width,item.height,item.depth].filter(Boolean).join(" × ")} mm</small> : null}</span></span>
                      <span className="text-right font-bold text-indigo-600">R$ {(estimatedCatalogPrice(item, aluminumPricePerKg) || 0).toFixed(2)}{Number(item.price || 0) <= 0 && estimatedCatalogPrice(item, aluminumPricePerKg) ? <small className="block text-[9px] font-medium">estimado</small> : null}</span>
                    </button>
                  ))}
                {catalogItems.filter((i) => i.name?.toLowerCase().includes(debouncedCatalogSearch) || i.sku?.toLowerCase().includes(debouncedCatalogSearch) || i.category?.toLowerCase().includes(debouncedCatalogSearch) || [i.width, i.height, i.depth].join(" ").includes(debouncedCatalogSearch)).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhum item encontrado. Ajuste a busca ou cadastre o item em Itens.</p>
                )}
              </div>
            </div>
          )}
        </div>
<button
                      onClick={handleAddItem}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar linha
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedQuote.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3"
                      >
                        {item.itemPhotoUrl && <button type="button" onClick={() => setItemPhotoViewer(item.itemPhotoUrls?.length ? item.itemPhotoUrls : [item.itemPhotoUrl!])} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-700"><img src={item.itemPhotoUrl} alt={"Foto de " + item.description} className="h-full w-full object-cover"/></button>}
                        <input
                          type="text"
                          aria-label="Código do item"
                          value={item.sku || ""}
                          onChange={(e) => handleUpdateItem(item.id, "sku", e.target.value)}
                          placeholder="Código"
                          className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none"
                        />
                        <div className="min-w-0 flex-1 w-full">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                            placeholder="Descrição do item..."
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none focus:border-amber-500/50"
                          />
                          {Number(item.cutLengthMm) > 0 && item.sku && (
                            <span className="mt-1 block truncate px-1 text-[10px] text-slate-400" title={`${item.sku} · ${item.description.split(" · ")[0]} (${item.cutLengthMm} mm)`}>
                              {item.sku} · {item.description.split(" · ")[0]} ({item.cutLengthMm} mm)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Qtd.:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, "quantity", Number(e.target.value) || 1)}
                              className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono text-center outline-none"
                            />
                          </div>

                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">Preço:</span>
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateItem(item.id, "unitPrice", Number(e.target.value) || 0)}
                                className={`w-24 rounded-lg border bg-slate-900 px-2 py-1.5 text-right font-mono text-xs text-white outline-none ${Number(item.unitPrice) <= 0 && (item.catalogItemId || item.catalogSource) ? "border-amber-400/70 focus:border-amber-300" : "border-slate-800"}`}
                              />
                            </div>
                            {Number(item.unitPrice) <= 0 && (item.catalogItemId || item.catalogSource) && (
                              <span className="ml-8 mt-1 text-[9px] font-medium text-amber-300">Informar preço</span>
                            )}
                          </div>

                          <span className="w-24 text-right font-mono font-bold text-xs text-amber-400">
                            {item.subtotal?.toFixed(2)} R$
                          </span>

                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals and compact financial controls */}
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs">
                    <div className="flex justify-between w-64 text-slate-400">
                      <span>Materiais:</span>
                      <span className="font-mono text-white">{selectedQuote.subtotal?.toFixed(2)} R$</span>
                    </div>
                    <div className="my-3 grid grid-cols-2 gap-2 border-y border-slate-800 py-3 sm:grid-cols-5">
                      {([
                        ["Mão de Obra (R$)", "labor"],
                        ["Margem (%)", "marginRate"],
                        ["Imposto (%)", "taxRate"],
                        ["Frete (R$)", "freight"],
                        ["Desconto (%)", "discountRate"],
                      ] as const).map(([label, field]) => (
                        <label key={field} className="text-[10px] font-semibold text-slate-400">
                          {label}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={selectedQuote[field] || 0}
                            onChange={(event) => setSelectedQuote(recalculateQuote({ ...selectedQuote, [field]: Number(event.target.value) || 0 }))}
                            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white outline-none focus:border-amber-500/50"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-amber-400">
                      <span>TOTAL:</span>
                      <span className="font-mono text-base">{selectedQuote.total?.toFixed(2)} R$</span>
                    </div>
                  </div>
                  <details className="group rounded-2xl border border-indigo-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <summary className="cursor-pointer list-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      Ver Roteiro de Produção / Taller ▾
                    </summary>
                    <div className="p-3 pt-0">
                      <ManufacturingRoute title={`Orçamento ${selectedQuote.number}`} items={selectedQuote.items} />
                    </div>
                  </details>
                </div>
                </fieldset>
              </div>

                {itemPhotoViewer && <ImageLightbox images={itemPhotoViewer} onClose={() => setItemPhotoViewer(null)} />}
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">Selecione ou crie um orçamento</h3>
              <p className="text-xs text-slate-400 mt-1">Use o botão acima para criar um novo orçamento.</p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Stored PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={`Orçamento ${viewerPdfQuote?.number || ""}`}
        subtitle={`Cliente: ${viewerPdfQuote?.clientName || ""} • Total: ${viewerPdfQuote?.total?.toFixed(2)} ${viewerPdfQuote?.currency || "BRL"}`}
        pdfDataUri={viewerPdfQuote?.pdfDataUri}
        fileName={viewerPdfQuote?.pdfFileName || `Orcamento_${viewerPdfQuote?.number}.pdf`}
        fileSizeKb={viewerPdfQuote?.pdfFileSizeKb}
        storedAt={viewerPdfQuote?.pdfGeneratedAt || viewerPdfQuote?.updatedAt}
        type="quote"
      />
      {actionsMenuOpen && selectedQuote && createPortal(
        <div
          ref={actionsMenuRef}
          role="menu"
          aria-label="Ações do orçamento"
          style={{ position: "fixed", top: actionsMenuPosition.top, right: actionsMenuPosition.right, zIndex: 1000 }}
          className="grid min-w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <button type="button" role="menuitem" onClick={() => { closeActionsMenu(); void handleOpenQuotePdf(selectedQuote); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><Eye className="h-4 w-4" />Gerar e visualizar PDF</button>
          <button type="button" role="menuitem" onClick={() => { closeActionsMenu(); void handleDownloadQuotePdf(selectedQuote); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-4 w-4" />Baixar PDF</button>
          <button type="button" role="menuitem" onClick={() => { closeActionsMenu(); void handleSendQuote("whatsapp"); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</button>
          <button type="button" role="menuitem" onClick={() => { closeActionsMenu(); void handleSendQuote("email"); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><Mail className="h-4 w-4" />Enviar por e-mail</button>
          <button type="button" role="menuitem" disabled={isQuoteActionLoading} onClick={() => { closeActionsMenu(); void handleConvertQuoteToInvoice(selectedQuote); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"><FileCheck className="h-4 w-4" />Converter em fatura</button>
          {!selectedQuote.approvedSnapshotId && <button type="button" role="menuitem" disabled={isQuoteActionLoading} onClick={() => { closeActionsMenu(); void handleApproveQuote(); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"><CheckCircle className="h-4 w-4" />Aprovar e congelar versão</button>}
          <button type="button" role="menuitem" disabled={Boolean(selectedQuote.invoiceId || selectedQuote.status === "invoiced")} onClick={() => { closeActionsMenu(); setIsEditing(true); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" />Editar orçamento</button>
          {isEditing && <button type="button" role="menuitem" disabled={isQuoteActionLoading} onClick={() => { closeActionsMenu(); void handleSaveQuote(); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"><Save className="h-4 w-4" />Salvar alterações</button>}
          <button type="button" role="menuitem" onClick={() => { closeActionsMenu(); void handleDeleteQuote(selectedQuote); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"><Trash2 className="h-4 w-4" />Excluir orçamento</button>
        </div>,
        document.body,
      )}
    </div>
  );
}
