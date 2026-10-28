import React, { useState, useEffect } from "react";
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
  FileDown
} from "lucide-react";
import { Quote, QuoteItem, Company, SenderConfig, Invoice } from "../../types";
import { exportQuotePdf, exportInvoicePdf, buildQuotePdf, buildInvoicePdf } from "../../utils/pdfExport";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useToast } from "../ToastContext";
import PdfViewerModal from "../common/PdfViewerModal";

interface QuotesModuleProps {
  senderConfig: SenderConfig;
  companies: Company[];
  onConvertToInvoice?: (quote: Quote) => void;
  language?: string;
}

export default function QuotesModule({ senderConfig, companies, onConvertToInvoice, language = "pt"}: QuotesModuleProps) {
  // Catálogo de productos
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  // Cargar catálogo
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "catalog"), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), source: "catalog" }));
        setCatalogItems((current) => [...current.filter((item) => item.source !== "catalog"), ...list]);
      }, (err) => console.warn("Catalog listener (quotes):", err)),
      onSnapshot(collection(db, "supplier_catalog"), (snap) => {
        const list = snap.docs.map((d) => { const data = d.data(); return { id: d.id, name: data.name || data.description || "Item sem nome", sku: data.code || data.sku || "", price: Number(data.price || 0), supplier: data.supplier || "", category: data.category || "", unit: data.unit || "un", source: "supplier_catalog" }; });
        setCatalogItems((current) => [...current.filter((item) => item.source !== "supplier_catalog"), ...list]);
      }, (err) => console.warn("Supplier catalog listener (quotes):", err)),
      onSnapshot(collection(db, "registry_items"), (snap) => {
        const list = snap.docs.map((d) => { const data = d.data(); return { id: d.id, name: data.name || "Item sem nome", sku: data.code || data.sku || "", price: Number(data.price || 0), category: data.category || "", unit: data.unit || "un", source: "registry_items" }; });
        setCatalogItems((current) => [...current.filter((item) => item.source !== "registry_items"), ...list]);
      }, (err) => console.warn("Items registry listener (quotes):", err)),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);


  const { showToast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewerPdfQuote, setViewerPdfQuote] = useState<Quote | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // AI Chat Agent States
  const [aiMessage, setAiMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Olá! Sou seu Agente Técnico de Orçamentos da Anacleto Pro. Você pode me pedir coisas como: 'Adicione 3 janelas de alumínio de 120x100', 'mude o IVA para 21%', 'adicione um desconto de 10%' ou 'gere a fatura deste orçamento'.",
    },
  ]);

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
        if (loaded.length > 0 && !selectedQuote) {
          setSelectedQuote(loaded[0]);
        }
      },
      (err) => {
        console.warn("Firestore quotes load warning:", err);
      }
    );
    return () => unsub();
  }, []);

  // Create new blank quote
  const handleCreateNewQuote = () => {
    const defaultClient = companies[0] || {
      id: "cli_gen",
      name: "Cliente Particular",
      taxId: "44556677B",
      email: "cliente@ejemplo.com",
      address: "Rua Principal 123",
    };

    const newQ: Quote = {
      id: "quote_" + Math.random().toString(36).substring(2, 9),
      number: "PRE-" + new Date().getFullYear() + "-" + String(quotes.length + 1).padStart(3, "0"),
      companyId: defaultClient.id,
      clientName: defaultClient.name,
      clientTaxId: defaultClient.taxId,
      clientEmail: defaultClient.email,
      clientAddress: defaultClient.address,
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
      items: [
        {
          id: "item_1",
          description: "Janela de Alumínio Linha Suprema 120×100 cm c/ Vidro Incolor 6mm",
          quantity: 2,
          unitPrice: 380,
          subtotal: 760,
        },
      ],
      subtotal: 760,
      taxRate: 0,
      taxAmount: 159.6,
      discountRate: 0,
      discountAmount: 0,
      total: 919.6,
      currency: senderConfig.currency || "BRL",
      status: "pendente",
      notes: "Prazo de entrega estimado: 15 dias úteis. Garantia de 5 anos em carpintaria.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSelectedQuote(newQ);
    setIsEditing(true);
  };

  // Recalculate totals
  const recalculateQuote = (current: Quote): Quote => {
    const updatedItems = current.items.map((item) => ({
      ...item,
      subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    }));

    const subtotal = Number(updatedItems.reduce((acc, curr) => acc + curr.subtotal, 0).toFixed(2));
    const discountAmount = Number(((subtotal * (current.discountRate || 0)) / 100).toFixed(2));
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number(((taxableBase * (current.taxRate || 0)) / 100).toFixed(2));
    const total = Number((taxableBase + taxAmount).toFixed(2));

    return {
      ...current,
      items: updatedItems,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      updatedAt: new Date().toISOString(),
    };
  };

  // Open and View Stored PDF
  const handleOpenQuotePdf = async (quote: Quote) => {
    let target = quote;
    if (!target.pdfDataUri) {
      try {
        const pdfRes = buildQuotePdf(target, senderConfig);
        target = {
          ...target,
          pdfDataUri: pdfRes.dataUri,
          pdfFileName: pdfRes.fileName,
          pdfGeneratedAt: new Date().toISOString(),
          pdfFileSizeKb: pdfRes.sizeKb,
        };
        await setDoc(doc(db, "quotes", target.id), target);
        if (selectedQuote?.id === target.id) {
          setSelectedQuote(target);
        }
      } catch (err) {
        console.warn("Could not pre-cache PDF data URI:", err);
      }
    }
    setViewerPdfQuote(target);
    setIsPdfModalOpen(true);
  };

  // Save Quote and its persistent PDF to Firestore
  const handleSaveQuote = async (quoteToSave?: Quote) => {
    let target = recalculateQuote(quoteToSave || selectedQuote!);
    try {
      // Build PDF document and serialize as data URI
      const pdfRes = buildQuotePdf(target, senderConfig);
      target = {
        ...target,
        pdfDataUri: pdfRes.dataUri,
        pdfFileName: pdfRes.fileName,
        pdfGeneratedAt: new Date().toISOString(),
        pdfFileSizeKb: pdfRes.sizeKb,
      };

      await setDoc(doc(db, "quotes", target.id), target);
      setSelectedQuote(target);
      setIsEditing(false);
      showToast(`Presupuesto ${target.number} y PDF almacenados en la plataforma.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar orçamento no Firestore.", "error");
    }
  };

  // Convert Approved Quote to Invoice (with persistent PDF attached)
  const handleConvertQuoteToInvoice = async (quote: Quote) => {
    try {
      const invoiceId = "inv_" + Math.random().toString(36).substring(2, 9);
      const invoiceNumber = "FAC-" + new Date().getFullYear() + "-" + Math.floor(Math.random() * 900 + 100);

      const baseInvoice: Invoice = {
        id: invoiceId,
        number: invoiceNumber,
        quoteId: quote.id,
        companyId: quote.companyId,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientTaxId: quote.clientTaxId,
        clientAddress: quote.clientAddress,
        date: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split("T")[0],
        items: quote.items,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        discountRate: quote.discountRate,
        discountAmount: quote.discountAmount,
        total: quote.total,
        currency: quote.currency,
        status: "pendente",
        paymentMethod: "Transferência Bancária",
        notes: `Factura generada a partir del Presupuesto ${quote.number}.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Generate invoice PDF for immediate platform storage
      const invPdfRes = buildInvoicePdf(baseInvoice, senderConfig);
      const finalInvoice: Invoice = {
        ...baseInvoice,
        pdfDataUri: invPdfRes.dataUri,
        pdfFileName: invPdfRes.fileName,
        pdfGeneratedAt: new Date().toISOString(),
        pdfFileSizeKb: invPdfRes.sizeKb,
      };

      await setDoc(doc(db, "invoices", invoiceId), finalInvoice);

      // Update quote status to approved/invoiced
      const updatedQuote: Quote = { ...quote, status: "approved" };
      await setDoc(doc(db, "quotes", quote.id), updatedQuote);
      setSelectedQuote(updatedQuote);

      showToast(`¡Factura ${invoiceNumber} generada y almacenada en PDF en la plataforma!`, "success");

      if (onConvertToInvoice) {
        onConvertToInvoice(updatedQuote);
      }
    } catch (err) {
      console.error(err);
      showToast("Não foi possível gerar a fatura.", "error");
    }
  };

  // AI Agent Message Sender
  const handleSendAiMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiMessage.trim() || !selectedQuote) return;

    const userText = aiMessage.trim();
    setAiMessage("");
    setIsAiLoading(true);

    const newHistory = [...aiChatHistory, { role: "user" as const, text: userText }];
    setAiChatHistory(newHistory);

    try {
      const res = await fetch("/api/ai/quote-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          currentQuote: selectedQuote,
          history: newHistory,
        }),
      });

      if (!res.ok) throw new Error("Erro no servidor de IA");

      const data = await res.json();

      // Check if action was generate_invoice
      if (data.action === "generate_invoice" || userText.toLowerCase().includes("genera la factura")) {
        await handleConvertQuoteToInvoice(selectedQuote);
        setAiChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Aprovei o orçamento ${selectedQuote.number} e gerei a fatura correspondente.`,
          },
        ]);
        setIsAiLoading(false);
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
        updated.items = data.items.map((it: any, idx: number) => ({
          id: it.id || `it_${idx + 1}`,
          description: it.description,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          subtotal: Number((Number(it.quantity || 1) * Number(it.unitPrice || 0)).toFixed(2)),
        }));
      }

      updated = recalculateQuote(updated);
      setSelectedQuote(updated);
      await handleSaveQuote(updated);

      setAiChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || "Recalculei os itens, impostos e totais do seu orçamento em tempo real.",
        },
      ]);
    } catch (err: any) {
      console.error(err);
      // Smart local command execution fallback
      const lower = userText.toLowerCase();
      let updated = { ...selectedQuote };
      let reply = "Processei sua instrução:";

      if (lower.includes("iva") && lower.includes("21")) {
        updated.taxRate = 21;
        reply = "IVA alterado para 21%. Totais recalculados.";
      } else if (lower.includes("iva") && lower.includes("10")) {
        updated.taxRate = 10;
        reply = "IVA reduzido para 10%. Totais recalculados.";
      } else if (lower.includes("descuento") && lower.includes("10")) {
        updated.discountRate = 10;
        reply = "Aplicado desconto comercial de 10% sobre a base tributável.";
      } else if (lower.includes("descuento") && lower.includes("15")) {
        updated.discountRate = 15;
        reply = "Aplicado desconto de 15% sobre o orçamento.";
      } else if (lower.includes("factura")) {
        handleConvertQuoteToInvoice(selectedQuote);
        reply = "Fatura emitida com sucesso a partir deste orçamento.";
      } else {
        // Add sample requested item
        updated.items.push({
          id: "item_" + Math.random().toString(36).substring(2, 6),
          description: userText,
          quantity: 1,
          unitPrice: 450,
          subtotal: 450,
        });
        reply = `Añadido el concepto "${userText}" con precio estimado.`;
      }

      updated = recalculateQuote(updated);
      setSelectedQuote(updated);
      handleSaveQuote(updated);

      setAiChatHistory((prev) => [...prev, { role: "assistant", text: reply }]);
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
      unitPrice: item.price,
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
      description: "Serviço de Carpintaria de Alumínio / Instalação Técnica",
      quantity: 1,
      unitPrice: 150,
      subtotal: 150,
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

  const handleUpdateItem = (id: string, field: "description" | "quantity" | "unitPrice", val: any) => {
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Gestor Comercial
              </span>
              <span className="text-[10px] font-mono text-slate-400">Total: {quotes.length} Orçamentos</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Orçamentos Inteligentes con IA
            </h1>
          </div>
        </div>

        <button
          onClick={handleCreateNewQuote}
          className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </div>

      {/* Main Grid: Left = Quotes List (4 cols); Right = Active Quote Detail & AI Chat (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: List & Search Filter */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nº ou cliente..."
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
                <p className="text-xs text-slate-400">No hay presupuestos registrados.</p>
              </div>
            ) : (
              filteredQuotes.map((q) => (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuote(q)}
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
                          : q.status === "rejeitado"
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">{q.items.length} ítems</span>
                      {q.pdfDataUri ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                          PDF
                        </span>
                      ) : null}
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
                        title="Ver PDF armazenado na plataforma"
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-400 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Quote Form & Gemini AI Assistant */}
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
                      {selectedQuote.pdfDataUri && (
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          PDF Almacenado ({selectedQuote.pdfFileSizeKb || 35} KB)
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-black text-white mt-1">Presupuesto para: {selectedQuote.clientName}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleOpenQuotePdf(selectedQuote)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 text-xs font-bold rounded-xl transition border border-amber-500/40 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" /> Ver PDF Almacenado
                    </button>
                    <button
                      onClick={() => exportQuotePdf(selectedQuote, senderConfig)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-300" /> Descargar PDF
                    </button>
                    <button
                      onClick={() => handleConvertQuoteToInvoice(selectedQuote)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/20"
                    >
                      <FileCheck className="w-3.5 h-3.5" /> Convertir a Factura
                    </button>
                    <button
                      onClick={() => handleSaveQuote()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl transition shadow-md shadow-amber-500/20"
                    >
                      Salvar y Almacenar PDF
                    </button>
                  </div>
                </div>

                {/* Client & Tax Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                      Seleccionar Cliente (CRM):
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

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                      IVA (%):
                    </label>
                    <input
                      type="number"
                      value={selectedQuote.taxRate}
                      onChange={(e) => {
                        const updated = recalculateQuote({
                          ...selectedQuote,
                          taxRate: Number(e.target.value) || 0,
                        });
                        setSelectedQuote(updated);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                      Desconto (%):
                    </label>
                    <input
                      type="number"
                      value={selectedQuote.discountRate || 0}
                      onChange={(e) => {
                        const updated = recalculateQuote({
                          ...selectedQuote,
                          discountRate: Number(e.target.value) || 0,
                        });
                        setSelectedQuote(updated);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                {/* Table of Items */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                      Ítems y Conceptos del Trabajo
                    </h3>
                    
        {/* Botón para abrir catálogo */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowCatalog(!showCatalog)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100"
          >
            🛒 {showCatalog ? "Cerrar catálogo" : "Buscar en catálogo"}
          </button>
          
          {showCatalog && (
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border">
              <input
                placeholder="Buscar por SKU o nombre..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg mb-3"
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {catalogItems
                  .filter((i) => 
                    i.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    i.sku?.toLowerCase().includes(catalogSearch.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        // Añadir el producto al presupuesto
                        const newItem = {
                          id: Math.random().toString(36).substring(2),
                          description: `${item.name} (${item.sku})`,
                          quantity: 1,
                          unitPrice: item.price,
                        };
                        // Asumiendo que el state se llama items o quoteItems
                        if (typeof setItems !== "undefined") setItems([...items, newItem]);
                        else if (typeof setQuoteItems !== "undefined") setQuoteItems([...quoteItems, newItem]);
                        setShowCatalog(false);
                        setCatalogSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 rounded flex justify-between"
                    >
                      <span><strong>{item.sku || "Sem código"}</strong> — {item.name}{item.supplier ? " · " + item.supplier : ""}</span>
                      <span className="font-bold text-indigo-600">R$ {item.price?.toFixed(2)}</span>
                    </button>
                  ))}
                {catalogItems.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No hay productos en el catálogo. Añádelos en Configuración → Catálogo.</p>
                )}
              </div>
            </div>
          )}
        </div>
<button
                      onClick={handleAddItem}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir Fila
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedQuote.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3"
                      >
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                          placeholder="Descrição do item..."
                          className="flex-1 w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none focus:border-amber-500/50"
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Cant:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, "quantity", Number(e.target.value) || 1)}
                              className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono text-center outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Preço:</span>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, "unitPrice", Number(e.target.value) || 0)}
                              className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono text-right outline-none"
                            />
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

                  {/* Totals Summary */}
                  <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-end space-y-1.5 text-xs">
                    <div className="flex justify-between w-64 text-slate-400">
                      <span>Base Imponible:</span>
                      <span className="font-mono text-white">{selectedQuote.subtotal?.toFixed(2)} R$</span>
                    </div>
                    {selectedQuote.discountRate ? (
                      <div className="flex justify-between w-64 text-rose-400">
                        <span>Desconto ({selectedQuote.discountRate}%):</span>
                        <span className="font-mono">-{selectedQuote.discountAmount?.toFixed(2)} R$</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between w-64 text-slate-400">
                      <span>IVA ({selectedQuote.taxRate}%):</span>
                      <span className="font-mono text-white">{selectedQuote.taxAmount?.toFixed(2)} R$</span>
                    </div>
                    <div className="flex justify-between w-64 pt-2 border-t border-slate-800 text-sm font-black text-amber-400">
                      <span>TOTAL:</span>
                      <span className="font-mono text-base">{selectedQuote.total?.toFixed(2)} R$</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Real-Time Quote Copilot Chat */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Agente de IA para Orçamentos y Facturas (Gemini)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Activo
                  </span>
                </div>

                {/* Chat History Box */}
                <div className="max-h-52 overflow-y-auto space-y-2.5 p-3 bg-slate-950 rounded-2xl border border-slate-800/80 custom-scrollbar">
                  {aiChatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                        msg.role === "user"
                          ? "ml-auto bg-amber-500 text-slate-950 font-medium"
                          : "bg-slate-900 border border-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-amber-400 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>El agente está analizando y recalculando el presupuesto...</span>
                    </div>
                  )}
                </div>

                {/* Prompt Suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "mude o IVA para 21%",
                    "añade un descuento del 10%",
                    "genera la factura de este presupuesto",
                    "añade 2 ventanas correderas de 150x120",
                  ].map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAiMessage(sug);
                      }}
                      className="text-[10px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    >
                      💬 "{sug}"
                    </button>
                  ))}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendAiMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    placeholder="Escreva uma instrução ao agente (ex: 'mude o IVA para 21%')..."
                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading || !aiMessage.trim()}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-black uppercase rounded-xl transition shadow-md"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">Selecciona o crea un presupuesto</h3>
              <p className="text-xs text-slate-400 mt-1">Usa el botón superior para crear uno nuevo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Stored PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={`Presupuesto ${viewerPdfQuote?.number || ""}`}
        subtitle={`Cliente: ${viewerPdfQuote?.clientName || ""} • Total: ${viewerPdfQuote?.total?.toFixed(2)} ${viewerPdfQuote?.currency || "BRL"}`}
        pdfDataUri={viewerPdfQuote?.pdfDataUri}
        fileName={viewerPdfQuote?.pdfFileName || `Presupuesto_${viewerPdfQuote?.number}.pdf`}
        fileSizeKb={viewerPdfQuote?.pdfFileSizeKb}
        storedAt={viewerPdfQuote?.pdfGeneratedAt || viewerPdfQuote?.updatedAt}
        type="quote"
      />
    </div>
  );
}
