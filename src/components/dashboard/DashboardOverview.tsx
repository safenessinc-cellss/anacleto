import React, { useState } from "react";
import {
  FileText,
  FileCheck,
  Building,
  Compass,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
  Users,
  Eye,
  Download,
  CheckCircle,
  HardDrive,
  ShieldCheck,
  Search
} from "lucide-react";
import { Quote, Invoice, Company, TechnicalDrawing, SenderConfig } from "../../types";
import { buildQuotePdf, buildInvoicePdf, buildTechnicalDrawingPdf } from "../../utils/pdfExport";
import PdfViewerModal from "../common/PdfViewerModal";

interface DashboardOverviewProps {
  quotes: Quote[];
  invoices: Invoice[];
  companies: Company[];
  drawings: TechnicalDrawing[];
  senderConfig: SenderConfig;
  onNavigateTab: (tab: "dashboard" | "crm" | "quotes" | "invoices" | "technical_drawing" | "settings") => void;
}

export default function DashboardOverview({
  quotes,
  invoices,
  companies,
  drawings,
  senderConfig,
  onNavigateTab,
}: DashboardOverviewProps) {
  const [pdfFilter, setPdfFilter] = useState<"all" | "quotes" | "invoices" | "drawings">("all");
  const [pdfSearch, setPdfSearch] = useState("");
  const [activePdfModal, setActivePdfModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    dataUri: string;
    fileName: string;
    sizeKb?: number;
    storedAt?: string;
    type: "quote" | "invoice" | "drawing" | "generic";
  }>({
    isOpen: false,
    title: "",
    dataUri: "",
    fileName: "",
    type: "generic",
  });
  const totalInvoiced = invoices.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalQuotesValue = quotes.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 p-8 rounded-3xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full">
              <Sparkles className="w-3.5 h-3.5" /> Anacleto Pro Enterprise OS
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Bienvenido al Panel de Control
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Gestión unificada de carpintería de aluminio, presupuestos dinámicos asistidos por IA,
              facturas con exportación a PDF y motor CAD de dibujo técnico 2D por fases.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigateTab("technical_drawing")}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20"
            >
              <Compass className="w-4 h-4" /> Nuevo Dibujo Técnico
            </button>
            <button
              onClick={() => onNavigateTab("quotes")}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition border border-slate-700"
            >
              <FileText className="w-4 h-4 text-amber-400" /> Crear Presupuesto
            </button>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute right-0 top-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 Summary Stat Cards Required by Prompt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Presupuestos */}
        <div
          onClick={() => onNavigateTab("quotes")}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-5 rounded-3xl shadow-xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
              <FileText className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Presupuestos</span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-black text-white">{quotes.length}</h3>
            <span className="text-xs font-mono font-bold text-amber-400">{totalQuotesValue.toFixed(2)} €</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Presupuestos creados y cotizados
          </p>
        </div>

        {/* Card 2: Facturas Emitidas */}
        <div
          onClick={() => onNavigateTab("invoices")}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-3xl shadow-xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
              <FileCheck className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Facturas Emitidas</span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-black text-white">{invoices.length}</h3>
            <span className="text-xs font-mono font-bold text-emerald-400">{totalPaid.toFixed(2)} € cobrado</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Total Facturado: {totalInvoiced.toFixed(2)} €
          </p>
        </div>

        {/* Card 3: Empresas Registradas */}
        <div
          onClick={() => onNavigateTab("crm")}
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-5 rounded-3xl shadow-xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition">
              <Building className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Empresas Registradas</span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-black text-white">{companies.length}</h3>
            <span className="text-xs text-indigo-400 font-bold">CRM Activo</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Clientes y empresas colaboradoras
          </p>
        </div>

        {/* Card 4: Dibujos Generados */}
        <div
          onClick={() => onNavigateTab("technical_drawing")}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-5 rounded-3xl shadow-xl transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
              <Compass className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dibujos Técnicos CAD</span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-black text-white">{drawings.length}</h3>
            <span className="text-xs text-amber-400 font-bold">5 Fases c/u</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Cotas, despiece y vistas puzzle
          </p>
        </div>
      </div>

      {/* Two Column Section: Recent Quotes & Recent Technical Drawings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Últimos Presupuestos</h3>
            </div>
            <button
              onClick={() => onNavigateTab("quotes")}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {quotes.slice(0, 4).map((q) => (
              <div
                key={q.id}
                onClick={() => onNavigateTab("quotes")}
                className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-amber-500/30 transition cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">{q.number}</span>
                  <h4 className="text-xs font-bold text-white">{q.clientName}</h4>
                  <span className="text-[10px] text-slate-500">{q.date}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xs text-white block">
                    {q.total?.toFixed(2)} €
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                      q.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {q.status}
                  </span>
                </div>
              </div>
            ))}
            {quotes.length === 0 && (
              <p className="text-xs text-slate-500 py-4 text-center">No hay presupuestos recientes.</p>
            )}
          </div>
        </div>

        {/* Recent Technical Drawings */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Dibujos Técnicos Recientes</h3>
            </div>
            <button
              onClick={() => onNavigateTab("technical_drawing")}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Ver taller CAD <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {drawings.slice(0, 4).map((d) => (
              <div
                key={d.id}
                onClick={() => onNavigateTab("technical_drawing")}
                className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-amber-500/30 transition cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                    {d.overallDimensions?.width}×{d.overallDimensions?.height} {d.unit}
                  </span>
                  <h4 className="text-xs font-bold text-white truncate max-w-xs">{d.title}</h4>
                  <span className="text-[10px] text-slate-500">{d.pieces?.length || 0} piezas despiece</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 uppercase">
                    5 Fases
                  </span>
                </div>
              </div>
            ))}
            {drawings.length === 0 && (
              <div
                onClick={() => onNavigateTab("technical_drawing")}
                className="p-6 text-center bg-slate-950 rounded-2xl border border-dashed border-slate-800 cursor-pointer hover:border-amber-500/40 transition"
              >
                <Compass className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-white">Genera tu primer plano técnico</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Describe una mesa, ventana o mueble en lenguaje natural.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BÓVEDA DE DOCUMENTOS PDF ALMACENADOS EN PLATAFORMA */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Almacenamiento PDF Persistente
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Total: {quotes.length + invoices.length + drawings.length} documentos
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight mt-0.5">
                Bóveda de Documentos PDF Almacenados
              </h2>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar PDF..."
                value={pdfSearch}
                onChange={(e) => setPdfSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "quotes", label: `Presupuestos (${quotes.length})` },
                  { id: "invoices", label: `Facturas (${invoices.length})` },
                  { id: "drawings", label: `Planos (${drawings.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPdfFilter(tab.id)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition ${
                    pdfFilter === tab.id
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vault Items List */}
        {(() => {
          const vaultItems = [
            ...quotes.map((q) => ({
              id: q.id,
              type: "quote" as const,
              typeLabel: "Presupuesto",
              badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
              title: `Presupuesto ${q.number}`,
              clientOrDetail: q.clientName,
              number: q.number,
              date: q.date,
              metric: `${q.total?.toFixed(2)} €`,
              pdfDataUri: q.pdfDataUri,
              pdfFileName: q.pdfFileName || `Presupuesto_${q.number}.pdf`,
              sizeKb: q.pdfFileSizeKb || 35,
              storedAt: q.pdfGeneratedAt || q.updatedAt,
              raw: q,
            })),
            ...invoices.map((inv) => ({
              id: inv.id,
              type: "invoice" as const,
              typeLabel: "Factura",
              badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
              title: `Factura ${inv.number}`,
              clientOrDetail: inv.clientName,
              number: inv.number,
              date: inv.date,
              metric: `${inv.total?.toFixed(2)} €`,
              pdfDataUri: inv.pdfDataUri,
              pdfFileName: inv.pdfFileName || `Factura_${inv.number}.pdf`,
              sizeKb: inv.pdfFileSizeKb || 38,
              storedAt: inv.pdfGeneratedAt || inv.updatedAt,
              raw: inv,
            })),
            ...drawings.map((d) => ({
              id: d.id,
              type: "drawing" as const,
              typeLabel: "Plano CAD 2D",
              badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
              title: d.title,
              clientOrDetail: `${d.overallDimensions?.width}×${d.overallDimensions?.height} ${d.unit} • ${d.pieces?.length || 0} piezas`,
              number: `CAD-${d.id.substring(0, 6).toUpperCase()}`,
              date: d.createdAt ? d.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
              metric: `${d.pieces?.length || 0} piezas`,
              pdfDataUri: d.pdfDataUri,
              pdfFileName: d.pdfFileName || `Plano_Tecnico_${(d.title || "Proyecto").replace(/\s+/g, "_")}.pdf`,
              sizeKb: d.pdfFileSizeKb || 42,
              storedAt: d.pdfGeneratedAt || d.updatedAt,
              raw: d,
            })),
          ];

          const filteredVault = vaultItems.filter((item) => {
            const matchesTab =
              pdfFilter === "all" ||
              (pdfFilter === "quotes" && item.type === "quote") ||
              (pdfFilter === "invoices" && item.type === "invoice") ||
              (pdfFilter === "drawings" && item.type === "drawing");
            const q = pdfSearch.toLowerCase();
            const matchesSearch =
              !q ||
              item.title.toLowerCase().includes(q) ||
              item.clientOrDetail.toLowerCase().includes(q) ||
              item.number.toLowerCase().includes(q) ||
              item.pdfFileName.toLowerCase().includes(q);
            return matchesTab && matchesSearch;
          });

          const handleOpenVaultPdf = (item: any) => {
            let uri = item.pdfDataUri;
            let fileName = item.pdfFileName;
            let sizeKb = item.sizeKb;
            if (!uri) {
              if (item.type === "quote") {
                const res = buildQuotePdf(item.raw, senderConfig);
                uri = res.dataUri;
                fileName = res.fileName;
                sizeKb = res.sizeKb;
              } else if (item.type === "invoice") {
                const res = buildInvoicePdf(item.raw, senderConfig);
                uri = res.dataUri;
                fileName = res.fileName;
                sizeKb = res.sizeKb;
              } else if (item.type === "drawing") {
                const res = buildTechnicalDrawingPdf(item.raw, senderConfig);
                uri = res.dataUri;
                fileName = res.fileName;
                sizeKb = res.sizeKb;
              }
            }

            setActivePdfModal({
              isOpen: true,
              title: item.title,
              subtitle: `${item.number} • ${item.clientOrDetail} • ${item.metric}`,
              dataUri: uri,
              fileName: fileName,
              sizeKb: sizeKb,
              storedAt: item.storedAt,
              type: item.type,
            });
          };

          const handleDownloadDirect = (item: any) => {
            let uri = item.pdfDataUri;
            let fileName = item.pdfFileName;
            if (!uri) {
              if (item.type === "quote") {
                const res = buildQuotePdf(item.raw, senderConfig);
                uri = res.dataUri;
                fileName = res.fileName;
              } else if (item.type === "invoice") {
                const res = buildInvoicePdf(item.raw, senderConfig);
                uri = res.dataUri;
                fileName = res.fileName;
              } else if (item.type === "drawing") {
                const res = buildTechnicalDrawingPdf(item.raw, senderConfig);
                uri = res.dataUri;
                fileName = res.fileName;
              }
            }
            const a = document.createElement("a");
            a.href = uri;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };

          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVault.map((item) => (
                  <div
                    key={`${item.type}_${item.id}`}
                    className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${item.badgeColor}`}
                        >
                          {item.typeLabel}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          PDF Almacenado
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.clientOrDetail}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
                        <span>{item.date}</span>
                        <span className="text-slate-300 font-bold">{item.metric}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2">
                      <button
                        onClick={() => handleOpenVaultPdf(item)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold rounded-xl border border-amber-500/30 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" /> Ver PDF
                      </button>
                      <button
                        onClick={() => handleDownloadDirect(item)}
                        title="Descargar archivo PDF"
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredVault.length === 0 && (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800">
                  <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No se encontraron documentos almacenados en este filtro.</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Global Dashboard PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={activePdfModal.isOpen}
        onClose={() => setActivePdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={activePdfModal.title}
        subtitle={activePdfModal.subtitle}
        pdfDataUri={activePdfModal.dataUri}
        fileName={activePdfModal.fileName}
        fileSizeKb={activePdfModal.sizeKb}
        storedAt={activePdfModal.storedAt}
        type={activePdfModal.type}
      />
    </div>
  );
}
