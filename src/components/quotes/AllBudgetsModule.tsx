import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { FileText, Search, Pencil } from "lucide-react";
import { auth, db } from "../../firebase";

export type BudgetWorkflow = "standard" | "smart" | "technical";
type Row = { id: string; workflow: BudgetWorkflow; number?: string; clientName?: string; status?: string; total?: number; currency?: string; createdAt?: any; request?: string; data: any };

export default function AllBudgetsModule({ onOpen }: { onOpen: (workflow: BudgetWorkflow, id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState("");

  useEffect(() => {
    const collections: Array<{ name: string; workflow: BudgetWorkflow }> = [
      { name: "quotes", workflow: "standard" },
      { name: "smart_budgets", workflow: "smart" },
      { name: "technical_budgets", workflow: "technical" },
    ];
    const snapshots = new Map<string, Row[]>();
    const unsubscribers = collections.map(({ name, workflow }) =>
      onSnapshot(query(collection(db, name), orderBy("createdAt", "desc"), limit(300)), (snap) => {
        snapshots.set(name, snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, workflow, number: data.number, clientName: data.clientName || data.customerName || "Cliente não informado", status: data.status || "draft", total: data.total == null && data.subtotal == null ? undefined : Number(data.total ?? data.subtotal), currency: data.currency || "BRL", createdAt: data.createdAt, request: data.request, data };
        }));
        setRows(collections.flatMap((entry) => snapshots.get(entry.name) || []).sort((a, b) => {
          const date = (v: any) => v?.toDate ? v.toDate().getTime() : new Date(v || 0).getTime();
          return date(b.createdAt) - date(a.createdAt);
        }));
        setError("");
      }, (e) => setError("Não foi possível carregar todos os orçamentos: " + e.message))
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.number, row.clientName, row.request].some((v) => String(v || "").toLowerCase().includes(term));
    const currentStatus = String(row.status || "").toLowerCase();
    const statusMatches = status === "all" || (status === "draft" && currentStatus === "draft") || (status === "pending" && ["pending", "pendente"].includes(currentStatus)) || (status === "approved" && ["approved", "aprovado"].includes(currentStatus)) || (status === "rejected" && ["rejected", "rejeitado"].includes(currentStatus));
    return matches && statusMatches;
  }), [rows, search, status]);

  const workflowLabel = (workflow: BudgetWorkflow) => workflow === "smart" ? "Inteligente · IA" : workflow === "technical" ? "Esquadrias · Técnico" : "Tradicional";
  const approvalIssue = (row: Row): string => {
    const data = row.data || {};
    if (row.workflow === "smart") {
      if (data.visitRequired === true) return "Visita técnica pendente.";
      if (Array.isArray(data.pendingQuestions) && data.pendingQuestions.length) return "Há perguntas pendentes para o cliente.";
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) return "O orçamento não contém itens.";
      if (items.some((item: any) => item.quantityPending === true || !(Number(item.quantity) > 0))) return "Há itens sem quantidade ou medição confirmada.";
      if (items.some((item: any) => !(Number(item.unitPrice) > 0) || !["catalog", "manual", "confirmed_manual"].includes(String(item.priceSource || "")))) return "Há itens sem preço confirmado ou estimativa revisada.";
      return "";
    }
    if (row.workflow === "technical") {
      if (data.bomData?.complete !== true) return "A lista técnica ainda está incompleta.";
      if (!data.bestSupplier || !Array.isArray(data.comparisons) || !data.comparisons.some((basket: any) => basket.complete === true && basket.supplier === data.bestSupplier)) return "Falta uma cesta completa com preços de fornecedor verificados.";
      return "";
    }
    return "";
  };

  const approveForProduction = async (row: Row) => {
    const issue = approvalIssue(row);
    if (issue) { setError(issue); return; }
    const collectionName = row.workflow === "smart" ? "smart_budgets" : row.workflow === "technical" ? "technical_budgets" : "quotes";
    setApprovingId(row.id); setError("");
    try {
      const data: any = { status: "approved", pricingStatus: "confirmed", approvedAt: serverTimestamp(), approvedBy: auth.currentUser?.uid || "", updatedAt: serverTimestamp() };
      if (row.workflow === "smart") data.items = (Array.isArray(row.data.items) ? row.data.items : []).map((item: any) => ({ ...item, priceSource: item.priceSource === "manual" ? "confirmed_manual" : item.priceSource }));
      await updateDoc(doc(db, collectionName, row.id), data);
    } catch (e) {
      setError("Não foi possível aprovar para produção: " + (e instanceof Error ? e.message : "erro desconhecido"));
    } finally { setApprovingId(""); }
  };

  return <main className="space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Todos os Orçamentos</h1>
      <p className="mt-1 text-sm text-slate-500">Histórico unificado. A edição sempre abre no fluxo em que o orçamento foi criado. Exibindo os 300 registros mais recentes de cada modalidade.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por cliente, número ou pedido" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></div>
        <select value={status} onChange={(e)=>setStatus(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">Todos os status</option><option value="draft">Rascunho</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="rejected">Rejeitado</option></select>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{rows.length ? "Nenhum orçamento corresponde à busca." : "Nenhum orçamento encontrado."}</p> : filtered.map((row) => <article key={row.workflow + ":" + row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900 dark:text-white">{row.number || row.clientName}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{workflowLabel(row.workflow)}</span><span className="text-xs text-slate-500">{row.status}</span></div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.clientName}{row.number ? " · " + row.number : ""}</p>
          <p className="mt-1 text-xs text-slate-500">{row.createdAt?.toDate ? row.createdAt.toDate().toLocaleDateString("pt-BR") : row.createdAt ? new Date(row.createdAt).toLocaleDateString("pt-BR") : "Data não informada"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><strong className="text-sm tabular-nums text-slate-900 dark:text-white">{row.total == null ? "Valor pendente" : Number(row.total).toLocaleString("pt-BR", { style: "currency", currency: row.currency || "BRL" })}</strong>{row.workflow !== "standard" && !["approved","aprovado"].includes(String(row.status || "").toLowerCase()) && <div className="max-w-xs"><button type="button" disabled={!!approvalIssue(row) || approvingId===row.id} title={approvalIssue(row) || "Confirma os preços e libera a criação da ordem de produção"} onClick={()=>void approveForProduction(row)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{approvingId===row.id?"Aprovando...":"Aprovar para produção"}</button>{approvalIssue(row)&&<p className="mt-1 text-[11px] text-amber-700">{approvalIssue(row)}</p>}</div>}<button type="button" onClick={()=>onOpen(row.workflow,row.id)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Pencil className="h-3.5 w-3.5"/>Editar</button></div>
      </article>)}
    </section>
  </main>;
}
