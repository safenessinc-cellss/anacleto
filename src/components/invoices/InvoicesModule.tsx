import React, { useState, useEffect } from "react";
import {
  FileCheck,
  Download,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Calendar,
  Building,
  CreditCard,
  Trash,
  Filter,
  Eye,
  RefreshCw
} from "lucide-react";
import { Invoice, InvoiceStatus, SenderConfig } from "../../types";
import { exportInvoicePdf, buildInvoicePdf } from "../../utils/pdfExport";
import { collection, doc, deleteDoc, getDocs, onSnapshot, query, orderBy, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useToast } from "../ToastContext";
import PdfViewerModal from "../common/PdfViewerModal";
import { compactInvoiceForFirestore, sanitizeFirestoreData } from "../../utils/firestorePayloads";

interface InvoicesModuleProps {
  senderConfig: SenderConfig;
  language?: string;
  canManageFinance?: boolean;
}

export default function InvoicesModule({ senderConfig, language = "pt", canManageFinance = false}: InvoicesModuleProps) {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewerPdfInvoice, setViewerPdfInvoice] = useState<Invoice | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "invoices"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: Invoice[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Invoice);
        });
        setInvoices(list);
        if (list.length > 0 && !selectedInvoice) {
          setSelectedInvoice(list[0]);
        }
      },
      (err) => {
        console.warn("Firestore invoices load notice:", err);
      }
    );
    return () => unsub();
  }, []);

  const handleOpenInvoicePdf = async (inv: Invoice) => {
    try {
      const res = buildInvoicePdf(inv, senderConfig);
      setViewerPdfInvoice({ ...inv, pdfDataUri: res.dataUri, pdfFileName: res.fileName, pdfFileSizeKb: res.sizeKb });
      setIsPdfModalOpen(true);
    } catch (err) {
      console.error("Could not build invoice PDF:", err);
      showToast((err as Error).message || "Não foi possível gerar o PDF da fatura.", "error");
    }
  };

  const handleToggleStatus = async (invoice: Invoice) => {
    if (invoice.status === "pago" || invoice.status === "paid") {
      showToast("Uma fatura recebida não pode ser reaberta por este botão. Registre um estorno com autorização financeira.", "info");
      return;
    }
    try {
      const nextStatus: InvoiceStatus = "paid";
      const baseUpdated: Invoice = { ...invoice, status: nextStatus, updatedAt: new Date().toISOString() };
      const updated: Invoice = baseUpdated;
      const invoiceRef = doc(db, "invoices", invoice.id);
      const receivableRef = doc(db, "receivables", invoice.id);
      const ledgerRef = doc(db, "ledger_entries", `invoice-paid-${invoice.id}`);
      const linkedOrders = invoice.quoteId
        ? await getDocs(query(collection(db, "production_orders"), where("quoteId", "==", invoice.quoteId)))
        : null;
      await runTransaction(db, async tx => {
        const invoiceSnap = await tx.get(invoiceRef);
        const receivableSnap = await tx.get(receivableRef);
        const ledgerSnap = await tx.get(ledgerRef);
        if (!invoiceSnap.exists() || ["pago", "paid"].includes(String(invoiceSnap.data().status || ""))) throw new Error("A fatura já foi processada por outro usuário.");
        if (ledgerSnap.exists()) throw new Error("Já existe um lançamento financeiro para esta fatura.");
        const previousReceived = Number(receivableSnap.exists() ? receivableSnap.data().receivedAmount || 0 : 0);
        const receiptDelta = Math.max(0, Number(invoice.total || 0) - previousReceived);
        if (receiptDelta <= 0) throw new Error("Esta fatura já está totalmente recebida.");
        tx.set(invoiceRef, compactInvoiceForFirestore(updated));
        tx.set(receivableRef, sanitizeFirestoreData({
          clientId: invoice.companyId || "", clientName: invoice.clientName || "Cliente",
          description: `Recebimento da fatura ${invoice.number}`, amount: Number(invoice.total || 0),
          receivedAmount: Number(invoice.total || 0), dueDate: invoice.dueDate || invoice.date,
          paymentMethod: "transferencia", status: "received", invoiceId: invoice.id,
          receivedAt: new Date().toISOString(), updatedAt: serverTimestamp()
        }), { merge: true });
        tx.set(ledgerRef, sanitizeFirestoreData({
          direction: "inflow", category: "customer_receipt", sourceType: "invoice", sourceId: invoice.id,
          description: `Recebimento da fatura ${invoice.number}`, amount: receiptDelta,
          date: new Date().toISOString().slice(0, 10), status: "posted", createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.email || ""
        }));
        linkedOrders?.docs.forEach((orderDoc) => tx.update(orderDoc.ref, {
          status: "paid", workflowStage: "closed", nextStep: "concluido",
          paymentStatus: "paid", paidAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
      });
      setSelectedInvoice(updated);
      showToast(`Fatura ${invoice.number} recebida e conciliada no Financeiro.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao conciliar o recebimento: " + ((err as Error).message || "erro desconhecido"), "error");
    }
  };

  const handleExportPdf = (inv: Invoice) => {
    try {
      exportInvoicePdf(inv, senderConfig);
      showToast(`Fatura ${inv.number} exportada para PDF.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao exportar fatura para PDF.", "error");
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm("Deseja excluir esta fatura do sistema?")) return;
    try {
      await deleteDoc(doc(db, "invoices", id));
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
      }
      showToast("Fatura excluída.", "info");
    } catch (err) {
      console.error(err);
      showToast("Não foi possível excluir a fatura.", "error");
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || (filterStatus === "pago" ? ["pago", "paid"].includes(String(inv.status)) : filterStatus === "pendente" ? ["pendente", "pending"].includes(String(inv.status)) : inv.status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const totalInvoiced = invoices.filter(i => !["cancelled", "cancelado", "void"].includes(String(i.status || "").toLowerCase())).reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalPaid = invoices.filter((i) => (i.status === "pago" || i.status === "paid")).reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalPending = invoices.filter((i) => ["pendente", "pending"].includes(String(i.status))).reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Financial Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Faturación Oficial
              </span>
              <span className="text-[10px] font-mono text-slate-400">Total: {invoices.length} Faturas</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Libro de Faturas Emitidas
            </h1>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Cobrado</span>
            <span className="text-xs font-mono font-black text-emerald-400">
              {totalPaid.toFixed(2)} R$
            </span>
          </div>
          <div className="px-3.5 py-2 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Pendente</span>
            <span className="text-xs font-mono font-black text-amber-400">
              {totalPending.toFixed(2)} R$
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Invoices List; Right = Selected Invoice Preview */}
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
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="flex gap-1.5">
              {["all", "pago", "pendente"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg uppercase transition ${
                    filterStatus === st
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {st === "all" ? "Todas" : st === "pago" ? "Cobradas" : "Pendentes"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl">
                <FileCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhuma fatura cadastrada.</p>
              </div>
            ) : (
              filtered.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    selectedInvoice?.id === inv.id
                      ? "bg-slate-800/90 border-emerald-500/60 shadow-lg"
                      : "bg-slate-900 hover:bg-slate-800/50 border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400">{inv.number}</span>
                      <h4 className="text-xs font-bold text-white mt-0.5">{inv.clientName}</h4>
                      <p className="text-[10px] text-slate-400">{inv.date}</p>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        (inv.status === "pago" || inv.status === "paid")
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {(inv.status === "pago" || inv.status === "paid") ? "Paga" : inv.status === "cancelled" ? "Cancelada" : "Pendente"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{inv.items?.length || 0} itens</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white">
                        {inv.total?.toFixed(2)} {inv.currency || "BRL"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInvoicePdf(inv);
                        }}
                        title="Gerar e visualizar PDF"
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded-lg transition"
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

        {/* RIGHT COLUMN: Selected Invoice Detail & Actions */}
        <div className="lg:col-span-8 space-y-6">
          {selectedInvoice ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-emerald-400">{selectedInvoice.number}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-400">Data: {selectedInvoice.date}</span>
                  </div>
                  <h2 className="text-lg font-black text-white mt-1">Fatura para: {selectedInvoice.clientName}</h2>
                  {selectedInvoice.deliveryEvidence && <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><p className="font-bold">Entrega concluída · {selectedInvoice.deliveryStatus} · Recebido por {selectedInvoice.deliveryEvidence.signedBy}</p><div className="mt-2 flex flex-wrap gap-2">{selectedInvoice.deliveryEvidence.photos.map(photo=><a key={photo.path} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt="Foto da entrega" className="h-14 w-20 rounded object-cover"/></a>)}<a href={selectedInvoice.deliveryEvidence.signatureUrl} target="_blank" rel="noreferrer" className="rounded border border-emerald-300 px-3 py-2 font-bold">Assinatura</a><a href={`https://maps.google.com/?q=${selectedInvoice.deliveryEvidence.latitude},${selectedInvoice.deliveryEvidence.longitude}`} target="_blank" rel="noreferrer" className="rounded border border-emerald-300 px-3 py-2 font-bold">GPS</a></div></div>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleOpenInvoicePdf(selectedInvoice)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 text-xs font-bold rounded-xl transition border border-emerald-500/40 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" /> Gerar e visualizar PDF
                  </button>

                  {canManageFinance && <button
                    onClick={() => handleToggleStatus(selectedInvoice)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                      ["pago", "paid"].includes(selectedInvoice.status)
                        ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {(["pago", "paid"].includes(selectedInvoice.status) ? "Fatura recebida" : "Registrar recebimento")}
                  </button>}

                  <button
                    onClick={() => handleExportPdf(selectedInvoice)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-300" /> Baixar PDF
                  </button>

                  <button
                    onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fiscal Data Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Emitente (empresa):</span>
                  <p className="font-bold text-white">{senderConfig.name}</p>
                  <p className="text-slate-400 font-mono">NIF: {senderConfig.nif}</p>
                  <p className="text-slate-400">{senderConfig.address}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Destinatário (cliente):</span>
                  <p className="font-bold text-white">{selectedInvoice.clientName}</p>
                  <p className="text-slate-400 font-mono">NIF/DNI: {selectedInvoice.clientTaxId}</p>
                  <p className="text-slate-400">{selectedInvoice.clientAddress || "Domicílio fiscal do cliente"}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Itens faturados
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400">
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3 text-center">Qtd.</th>
                        <th className="py-2 px-3 text-right">Preço unitário</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedInvoice.items?.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-3 px-3 text-white font-medium">{item.description}</td>
                          <td className="py-3 px-3 text-center text-slate-300 font-mono">{item.quantity}</td>
                          <td className="py-3 px-3 text-right text-slate-300 font-mono">
                            {item.unitPrice?.toFixed(2)} R$
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-mono font-bold">
                            {(item.subtotal || item.quantity * item.unitPrice)?.toFixed(2)} R$
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-end space-y-1.5 text-xs">
                  <div className="flex justify-between w-64 text-slate-400">
                    <span>Base de cálculo:</span>
                    <span className="font-mono text-white">{selectedInvoice.subtotal?.toFixed(2)} R$</span>
                  </div>
                  {selectedInvoice.discountRate ? (
                    <div className="flex justify-between w-64 text-rose-400">
                      <span>Desconto ({selectedInvoice.discountRate}%):</span>
                      <span className="font-mono">-{selectedInvoice.discountAmount?.toFixed(2)} R$</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between w-64 text-slate-400">
                    <span>Imposto ({selectedInvoice.taxRate}%):</span>
                    <span className="font-mono text-white">{selectedInvoice.taxAmount?.toFixed(2)} R$</span>
                  </div>
                  <div className="flex justify-between w-64 pt-2 border-t border-slate-800 text-sm font-black text-emerald-400">
                    <span>TOTAL DA FATURA:</span>
                    <span className="font-mono text-base">{selectedInvoice.total?.toFixed(2)} R$</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
              <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">Selecione uma fatura</h3>
              <p className="text-xs text-slate-400 mt-1">
                Você pode gerar faturas diretamente na seção "Orçamentos".
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Stored PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={`Fatura ${viewerPdfInvoice?.number || ""}`}
        subtitle={`Cliente: ${viewerPdfInvoice?.clientName || ""} • Total: ${viewerPdfInvoice?.total?.toFixed(2)} ${viewerPdfInvoice?.currency || "BRL"}`}
        pdfDataUri={viewerPdfInvoice?.pdfDataUri}
        fileName={viewerPdfInvoice?.pdfFileName || `Fatura_${viewerPdfInvoice?.number}.pdf`}
        fileSizeKb={viewerPdfInvoice?.pdfFileSizeKb}
        storedAt={viewerPdfInvoice?.pdfGeneratedAt || viewerPdfInvoice?.updatedAt}
        type="invoice"
      />
    </div>
  );
}
