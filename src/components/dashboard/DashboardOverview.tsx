import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { ArrowUpRight, CheckCircle, Download, Eye, Factory, FileText, HardDrive, Search, Wallet } from "lucide-react";
import { db } from "../../firebase";
import { Quote, Invoice, TechnicalDrawing, SenderConfig } from "../../types";
import { buildQuotePdf, buildInvoicePdf, buildTechnicalDrawingPdf } from "../../utils/pdfExport";
import PdfViewerModal from "../common/PdfViewerModal";

interface DashboardOverviewProps {
  quotes: Quote[];
  invoices: Invoice[];
  drawings: TechnicalDrawing[];
  senderConfig: SenderConfig;
  canViewFinance: boolean;
  canViewProduction: boolean;
  canViewInvoices: boolean;
  canViewQuotes: boolean;
  canViewDrawings: boolean;
  onNavigateTab: (tab: "dashboard" | "crm" | "quotes" | "finance" | "production" | "settings") => void;
}

type LedgerEntry = { direction?: string; type?: string; amount?: number; status?: string };
type ProductionOrder = { status?: string };
type VaultItem = {
  id: string;
  type: "quote" | "invoice" | "drawing";
  title: string;
  details: string;
  number: string;
  date: string;
  amount: string;
  pdfDataUri?: string;
  pdfFileName: string;
  raw: Quote | Invoice | TechnicalDrawing;
};

const activeStatus = (status?: string) => !["cancelled", "cancelado", "void", "estornado"].includes(String(status || "").toLowerCase());
const isIncoming = (entry: LedgerEntry) => ["inflow", "income", "in", "entrada"].includes(String(entry.direction || entry.type || "").toLowerCase());
const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DashboardOverview({ quotes, invoices, drawings, senderConfig, canViewFinance, canViewProduction, canViewInvoices, canViewQuotes, canViewDrawings, onNavigateTab }: DashboardOverviewProps) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [dataError, setDataError] = useState("");
  const [pdfFilter, setPdfFilter] = useState<"all" | "quotes" | "invoices" | "drawings">("all");
  const [pdfSearch, setPdfSearch] = useState("");
  const [activePdfModal, setActivePdfModal] = useState<{ isOpen: boolean; title: string; subtitle: string; dataUri: string; fileName: string; sizeKb?: number; type: "quote" | "invoice" | "drawing" | "generic" }>({
    isOpen: false, title: "", subtitle: "", dataUri: "", fileName: "", type: "generic",
  });

  useEffect(() => {
    if (!canViewProduction) {
      setOrders([]);
      return;
    }
    const stopOrders = onSnapshot(
      collection(db, "production_orders"),
      (snapshot) => setOrders(snapshot.docs.map((item) => item.data() as ProductionOrder)),
      (error) => setDataError(`Falha ao carregar as ordens de produção: ${error.message}`),
    );
    return stopOrders;
  }, [canViewProduction]);

  useEffect(() => {
    if (!canViewFinance) {
      setLedger([]);
      return;
    }
    const stopLedger = onSnapshot(
      collection(db, "ledger_entries"),
      (snapshot) => setLedger(snapshot.docs.map((item) => item.data() as LedgerEntry)),
      (error) => setDataError(`Falha ao carregar o saldo em caixa: ${error.message}`),
    );
    return stopLedger;
  }, [canViewFinance]);

  const openQuotes = quotes.filter((quote) => ["draft", "pending", "pendente"].includes(String(quote.status || "").toLowerCase())).length;
  const activeOrders = orders.filter((order) => String(order.status || "").toLowerCase() === "in_progress").length;
  const cashBalance = ledger.filter((entry) => activeStatus(entry.status)).reduce((sum, entry) => sum + (isIncoming(entry) ? 1 : -1) * Number(entry.amount || 0), 0);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const billedThisMonth = invoices.filter((invoice) => activeStatus(invoice.status) && String(invoice.date || "").slice(0, 7) === currentMonth).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const monthlyBilled = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString("pt-BR", { month: "short" }),
      total: invoices.filter((invoice) => activeStatus(invoice.status) && String(invoice.date || "").slice(0, 7) === key).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    };
  }), [invoices]);
  const maxBilled = Math.max(1, ...monthlyBilled.map((month) => month.total));

  const vaultItems = useMemo<VaultItem[]>(() => [
    ...(canViewQuotes ? quotes : []).map((quote) => ({
      id: quote.id, type: "quote" as const, title: `Orçamento ${quote.number}`, details: quote.clientName,
      number: quote.number, date: quote.date, amount: money(Number(quote.total || 0)), pdfDataUri: quote.pdfDataUri,
      pdfFileName: quote.pdfFileName || `Orcamento_${quote.number}.pdf`, raw: quote,
    })),
    ...(canViewInvoices ? invoices : []).map((invoice) => ({
      id: invoice.id, type: "invoice" as const, title: `Fatura ${invoice.number}`, details: invoice.clientName,
      number: invoice.number, date: invoice.date, amount: money(Number(invoice.total || 0)), pdfDataUri: invoice.pdfDataUri,
      pdfFileName: invoice.pdfFileName || `Fatura_${invoice.number}.pdf`, raw: invoice,
    })),
    ...(canViewDrawings ? drawings : []).map((drawing) => ({
      id: drawing.id, type: "drawing" as const, title: drawing.title,
      details: `${drawing.overallDimensions?.width} × ${drawing.overallDimensions?.height} ${drawing.unit} · ${drawing.pieces?.length || 0} componentes`,
      number: `CAD-${drawing.id.slice(0, 6).toUpperCase()}`, date: drawing.createdAt?.slice(0, 10) || "",
      amount: `${drawing.pieces?.length || 0} componentes`, pdfDataUri: drawing.pdfDataUri,
      pdfFileName: drawing.pdfFileName || `Projeto_${drawing.id}.pdf`, raw: drawing,
    })),
  ], [quotes, invoices, drawings, canViewInvoices, canViewQuotes, canViewDrawings]);

  const filteredVault = vaultItems.filter((item) => {
    const matchesType = pdfFilter === "all" || item.type === (pdfFilter === "quotes" ? "quote" : pdfFilter === "invoices" ? "invoice" : "drawing");
    const query = pdfSearch.trim().toLocaleLowerCase();
    return matchesType && (!query || `${item.title} ${item.details} ${item.number} ${item.pdfFileName}`.toLocaleLowerCase().includes(query));
  });

  const getPdf = (item: VaultItem) => {
    if (item.pdfDataUri) return { dataUri: item.pdfDataUri, fileName: item.pdfFileName };
    if (item.type === "quote") return buildQuotePdf(item.raw as Quote, senderConfig);
    if (item.type === "invoice") return buildInvoicePdf(item.raw as Invoice, senderConfig);
    return buildTechnicalDrawingPdf(item.raw as TechnicalDrawing, senderConfig);
  };
  const downloadPdf = (item: VaultItem) => {
    const pdf = getPdf(item);
    const link = document.createElement("a");
    link.href = pdf.dataUri;
    link.download = pdf.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  const openPdf = (item: VaultItem) => {
    const pdf = getPdf(item);
    setActivePdfModal({ isOpen: true, title: item.title, subtitle: `${item.number} · ${item.details}`, dataUri: pdf.dataUri, fileName: pdf.fileName, sizeKb: "sizeKb" in pdf ? pdf.sizeKb : undefined, type: item.type });
  };

  const stats = [
    { title: "Orçamentos em Aberto", value: canViewQuotes ? String(openQuotes) : "—", detail: canViewQuotes ? "Aguardando aprovação" : "Acesso restrito", icon: FileText, onClick: () => canViewQuotes && onNavigateTab("quotes") },
    { title: "Obras em Produção", value: canViewProduction ? String(activeOrders) : "—", detail: canViewProduction ? "Ordens em andamento" : "Acesso restrito", icon: Factory, onClick: () => canViewProduction && onNavigateTab("production") },
    { title: "Saldo em Caixa", value: canViewFinance ? money(cashBalance) : "—", detail: canViewFinance ? "Lançamentos conciliados" : "Acesso restrito", icon: Wallet, onClick: () => canViewFinance && onNavigateTab("finance") },
    { title: "Faturado no Mês", value: canViewFinance ? money(billedThisMonth) : "—", detail: canViewFinance ? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Acesso restrito", icon: ArrowUpRight, onClick: () => canViewFinance && onNavigateTab("finance") },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Início</h1>
        <div className="flex flex-wrap gap-2">
          {canViewQuotes && <button type="button" onClick={() => onNavigateTab("quotes")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            + Novo Projeto / Orçamento
          </button>}
          <button type="button" onClick={() => document.getElementById("pdf-vault")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Ver Cofre de PDFs
          </button>
        </div>
      </header>

      {dataError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{dataError}</p>}

      <section aria-label="Indicadores principais" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ title, value, detail, icon: Icon, onClick }) => (
          <button key={title} type="button" onClick={onClick} className="rounded-2xl border border-slate-200/80 bg-white p-6 text-left transition hover:border-blue-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{title}</span>
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-4 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Resumo de faturamento</h2>
          <p className="mt-1 text-sm text-slate-500">Faturas emitidas nos últimos seis meses</p>
        </div>
        {canViewFinance ? (
          <div className="grid h-48 grid-cols-6 items-end gap-3 sm:h-56 sm:gap-6" role="img" aria-label="Gráfico de faturamento dos últimos seis meses">
            {monthlyBilled.map((month) => (
              <div key={month.key} className="flex h-full flex-col items-center justify-end gap-2">
                <span className="max-w-full truncate text-[10px] text-slate-500">{month.total ? money(month.total) : "—"}</span>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-md bg-blue-500/80 transition-all" style={{ height: `${Math.max(3, (month.total / maxBilled) * 100)}%` }} title={`${month.label}: ${money(month.total)}`} />
                </div>
                <span className="text-xs capitalize text-slate-500">{month.label}</span>
              </div>
            ))}
          </div>
        ) : <p className="py-16 text-center text-sm text-slate-500">Acesso restrito ao resumo financeiro.</p>}
      </section>

      <section id="pdf-vault" className="scroll-mt-6 space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-blue-600" />
            <div><h2 className="font-semibold text-slate-900 dark:text-white">Cofre de PDFs</h2><p className="text-xs text-slate-500">{vaultItems.length} documentos · orçamentos, faturas e projetos CAD</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input aria-label="Buscar PDF" value={pdfSearch} onChange={(event) => setPdfSearch(event.target.value)} placeholder="Buscar documento" className="w-48 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <select aria-label="Filtrar documentos" value={pdfFilter} onChange={(event) => setPdfFilter(event.target.value as typeof pdfFilter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="all">Todos</option><option value="quotes">Orçamentos</option><option value="invoices">Faturas</option><option value="drawings">Projetos CAD</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-xs font-medium text-slate-500 dark:border-slate-800"><th className="py-3 pr-4">Documento</th><th className="py-3 pr-4">Cliente / Projeto</th><th className="py-3 pr-4">Data</th><th className="py-3 pr-4 text-right">Valor</th><th className="py-3 text-right">Ações</th></tr></thead>
            <tbody>{filteredVault.map((item) => (
              <tr key={`${item.type}-${item.id}`} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70">
                <td className="py-3 pr-4"><span className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</span><span className="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle className="h-3 w-3" />PDF</span></td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.details}</td>
                <td className="py-3 pr-4 text-slate-500">{item.date || "—"}</td>
                <td className="py-3 pr-4 text-right font-medium text-slate-700 dark:text-slate-200">{item.amount}</td>
                <td className="py-3 text-right"><div className="inline-flex gap-1">
                  <button type="button" onClick={() => openPdf(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300" aria-label={`Ver ${item.title}`}><Eye className="h-4 w-4" /></button>
                  <button type="button" onClick={() => downloadPdf(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300" aria-label={`Baixar ${item.title}`}><Download className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}{filteredVault.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">Nenhum PDF encontrado.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <PdfViewerModal isOpen={activePdfModal.isOpen} onClose={() => setActivePdfModal((previous) => ({ ...previous, isOpen: false }))} title={activePdfModal.title} subtitle={activePdfModal.subtitle} pdfDataUri={activePdfModal.dataUri} fileName={activePdfModal.fileName} fileSizeKb={activePdfModal.sizeKb} type={activePdfModal.type} />
    </div>
  );
}
