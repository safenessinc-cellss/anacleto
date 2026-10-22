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
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useToast } from "../ToastContext";
import PdfViewerModal from "../common/PdfViewerModal";

interface InvoicesModuleProps {
  senderConfig: SenderConfig;
}

export default function InvoicesModule({ senderConfig }: InvoicesModuleProps) {
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
    let target = inv;
    if (!target.pdfDataUri) {
      try {
        const res = buildInvoicePdf(target, senderConfig);
        target = {
          ...target,
          pdfDataUri: res.dataUri,
          pdfFileName: res.fileName,
          pdfGeneratedAt: new Date().toISOString(),
          pdfFileSizeKb: res.sizeKb,
        };
        await setDoc(doc(db, "invoices", target.id), target);
        if (selectedInvoice?.id === target.id) {
          setSelectedInvoice(target);
        }
      } catch (err) {
        console.warn("Could not pre-build invoice PDF:", err);
      }
    }
    setViewerPdfInvoice(target);
    setIsPdfModalOpen(true);
  };

  const handleToggleStatus = async (invoice: Invoice) => {
    const nextStatus: InvoiceStatus = invoice.status === "pago" ? "pendente" : "pago";
    try {
      const baseUpdated: Invoice = { ...invoice, status: nextStatus, updatedAt: new Date().toISOString() };
      const pdfRes = buildInvoicePdf(baseUpdated, senderConfig);
      const updated: Invoice = {
        ...baseUpdated,
        pdfDataUri: pdfRes.dataUri,
        pdfFileName: pdfRes.fileName,
        pdfGeneratedAt: new Date().toISOString(),
        pdfFileSizeKb: pdfRes.sizeKb,
      };

      await setDoc(doc(db, "invoices", invoice.id), updated);
      setSelectedInvoice(updated);
      showToast(`Factura ${invoice.number} marcada como ${nextStatus === "pago" ? "PAGADA" : "PENDIENTE"} y PDF actualizado.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Error al actualizar estado.", "error");
    }
  };

  const handleExportPdf = (inv: Invoice) => {
    try {
      exportInvoicePdf(inv, senderConfig);
      showToast(`Factura ${inv.number} exportada a PDF.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Error al exportar factura a PDF.", "error");
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm("¿Deseas eliminar esta factura del sistema?")) return;
    try {
      await deleteDoc(doc(db, "invoices", id));
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
      }
      showToast("Factura eliminada.", "info");
    } catch (err) {
      console.error(err);
      showToast("No se pudo eliminar la factura.", "error");
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalInvoiced = invoices.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === "pago").reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalPending = invoices.filter((i) => i.status === "pendente").reduce((acc, curr) => acc + (curr.total || 0), 0);

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
                Facturación Oficial
              </span>
              <span className="text-[10px] font-mono text-slate-400">Total: {invoices.length} Facturas</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Libro de Facturas Emitidas
            </h1>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Cobrado</span>
            <span className="text-xs font-mono font-black text-emerald-400">
              {totalPaid.toFixed(2)} €
            </span>
          </div>
          <div className="px-3.5 py-2 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Pendiente</span>
            <span className="text-xs font-mono font-black text-amber-400">
              {totalPending.toFixed(2)} €
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
                placeholder="Buscar por nº o cliente..."
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
                  {st === "all" ? "Todas" : st === "pago" ? "Cobradas" : "Pendientes"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl">
                <FileCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No hay facturas registradas.</p>
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
                        inv.status === "pago"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {inv.status === "pago" ? "Pagada" : "Pendiente"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{inv.items?.length || 0} ítems</span>
                      {inv.pdfDataUri && (
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                          PDF
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white">
                        {inv.total?.toFixed(2)} {inv.currency || "EUR"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInvoicePdf(inv);
                        }}
                        title="Ver PDF almacenado en la plataforma"
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
                    <span className="text-xs text-slate-400">Fecha: {selectedInvoice.date}</span>
                    {selectedInvoice.pdfDataUri && (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        PDF Almacenado ({selectedInvoice.pdfFileSizeKb || 35} KB)
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-black text-white mt-1">Factura para: {selectedInvoice.clientName}</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleOpenInvoicePdf(selectedInvoice)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 text-xs font-bold rounded-xl transition border border-emerald-500/40 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" /> Ver PDF Almacenado
                  </button>

                  <button
                    onClick={() => handleToggleStatus(selectedInvoice)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                      selectedInvoice.status === "pago"
                        ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {selectedInvoice.status === "pago" ? "Marcar Pendiente" : "Marcar como Pagada"}
                  </button>

                  <button
                    onClick={() => handleExportPdf(selectedInvoice)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-300" /> Descargar PDF
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
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Emisor (Empresa):</span>
                  <p className="font-bold text-white">{senderConfig.name}</p>
                  <p className="text-slate-400 font-mono">NIF: {senderConfig.nif}</p>
                  <p className="text-slate-400">{senderConfig.address}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Receptor (Cliente):</span>
                  <p className="font-bold text-white">{selectedInvoice.clientName}</p>
                  <p className="text-slate-400 font-mono">NIF/DNI: {selectedInvoice.clientTaxId}</p>
                  <p className="text-slate-400">{selectedInvoice.clientAddress || "Domicilio fiscal del cliente"}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Conceptos Facturados
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400">
                        <th className="py-2 px-3">Descripción</th>
                        <th className="py-2 px-3 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">Precio Unit.</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedInvoice.items?.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-3 px-3 text-white font-medium">{item.description}</td>
                          <td className="py-3 px-3 text-center text-slate-300 font-mono">{item.quantity}</td>
                          <td className="py-3 px-3 text-right text-slate-300 font-mono">
                            {item.unitPrice?.toFixed(2)} €
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-mono font-bold">
                            {(item.subtotal || item.quantity * item.unitPrice)?.toFixed(2)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-end space-y-1.5 text-xs">
                  <div className="flex justify-between w-64 text-slate-400">
                    <span>Base Imponible:</span>
                    <span className="font-mono text-white">{selectedInvoice.subtotal?.toFixed(2)} €</span>
                  </div>
                  {selectedInvoice.discountRate ? (
                    <div className="flex justify-between w-64 text-rose-400">
                      <span>Descuento ({selectedInvoice.discountRate}%):</span>
                      <span className="font-mono">-{selectedInvoice.discountAmount?.toFixed(2)} €</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between w-64 text-slate-400">
                    <span>IVA ({selectedInvoice.taxRate}%):</span>
                    <span className="font-mono text-white">{selectedInvoice.taxAmount?.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between w-64 pt-2 border-t border-slate-800 text-sm font-black text-emerald-400">
                    <span>TOTAL FACTURA:</span>
                    <span className="font-mono text-base">{selectedInvoice.total?.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
              <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">Selecciona una factura</h3>
              <p className="text-xs text-slate-400 mt-1">
                Puedes generar facturas directamente desde la sección "Orçamentos".
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Stored PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={`Factura ${viewerPdfInvoice?.number || ""}`}
        subtitle={`Cliente: ${viewerPdfInvoice?.clientName || ""} • Total: ${viewerPdfInvoice?.total?.toFixed(2)} ${viewerPdfInvoice?.currency || "EUR"}`}
        pdfDataUri={viewerPdfInvoice?.pdfDataUri}
        fileName={viewerPdfInvoice?.pdfFileName || `Factura_${viewerPdfInvoice?.number}.pdf`}
        fileSizeKb={viewerPdfInvoice?.pdfFileSizeKb}
        storedAt={viewerPdfInvoice?.pdfGeneratedAt || viewerPdfInvoice?.updatedAt}
        type="invoice"
      />
    </div>
  );
}
