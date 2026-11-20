import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import { FileText, Pencil, Search } from "lucide-react";

export type BudgetWorkflow = "standard" | "smart_ai" | "technical";
export interface BudgetRecord {
  id: string;
  workflow: BudgetWorkflow;
  clientName: string;
  number?: string;
  status: string;
  total: number;
  currency?: string;
  createdAt?: any;
  items?: any[];
  sourceCollection: string;
}

interface AllBudgetsModuleProps {
  onEdit: (record: BudgetRecord) => void;
}

const statusLabel = (status: string) => ({
  draft: "Rascunho", pending: "Pendente", pendente: "Pendente",
  approved: "Aprovado", accepted: "Aprovado", rejected: "Rejeitado",
  rejeitado: "Rejeitado", sent: "Enviado", invoiced: "Faturado",
}[String(status || "").toLowerCase()] || status || "Sem status");

const workflowLabel = (workflow: BudgetWorkflow) => ({
  standard: "Orçamento e proposta",
  smart_ai: "Orçamento inteligente",
  technical: "Orçamento de esquadrias",
}[workflow]);

export default function AllBudgetsModule({ onEdit }: AllBudgetsModuleProps) {
  const [records, setRecords] = useState<BudgetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const sources = [
      { collectionName: "quotes", workflow: "standard" as const },
      { collectionName: "smart_budgets", workflow: "smart_ai" as const },
      { collectionName: "technical_budgets", workflow: "technical" as const },
    ];
    const snapshots = new Map<string, BudgetRecord[]>();
    const unsubscribers = sources.map(({ collectionName, workflow }) =>
      onSnapshot(query(collection(db, collectionName), orderBy("createdAt", "desc")), (snapshot) => {
        snapshots.set(collectionName, snapshot.docs.map((document) => {
          const data = document.data();
          return {
            ...data,
            id: document.id,
            workflow: data.workflow === "smart_ai" ? "smart_ai" : workflow,
            clientName: data.clientName || data.customerName || "Cliente não informado",
            number: data.number || data.budgetNumber || undefined,
            status: data.status || "draft",
            total: Number(data.total ?? data.subtotal ?? 0),
            currency: data.currency || "BRL",
            sourceCollection: collectionName,
          } as BudgetRecord;
        }));
        setRecords([...snapshots.values()].flat().sort((a, b) => {
          const date = (value: any) => value?.toMillis?.() ?? (value ? new Date(value).getTime() : 0);
          return date(b.createdAt) - date(a.createdAt);
        }));
        setLoading(false);
        setError("");
      }, (cause) => {
        console.error("All budgets listener:", collectionName, cause);
        setError("Não foi possível carregar todos os orçamentos. Verifique as permissões do Firestore.");
        setLoading(false);
      })
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const filtered = useMemo(() => records.filter((record) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const matchesTerm = !term || [record.clientName, record.number, workflowLabel(record.workflow)]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
    const matchesStatus = status === "all" || String(record.status).toLowerCase() === status;
    return matchesTerm && matchesStatus;
  }), [records, search, status]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600" />
          <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Todos os orçamentos</h2>
            <p className="text-sm text-slate-500">Registro geral de todas as modalidades, com edição no fluxo de origem.</p></div>
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{records.length} registros</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
          <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente, número ou modalidade..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="all">Todos os status</option><option value="draft">Rascunhos</option><option value="pending">Pendentes</option><option value="pendente">Pendentes</option><option value="approved">Aprovados</option><option value="accepted">Aceitos</option><option value="rejected">Rejeitados</option><option value="sent">Enviados</option>
          </select>
        </div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? <p className="p-6 text-sm text-slate-500">Carregando orçamentos...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhum orçamento encontrado.</p> : filtered.map((record) => (
          <article key={record.sourceCollection + ":" + record.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800">
            <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900 dark:text-white">{record.clientName}</p>
              <p className="mt-1 text-xs text-slate-500">{record.number || record.id} · {workflowLabel(record.workflow)} · {statusLabel(record.status)}</p></div>
            <strong className="text-sm tabular-nums text-slate-800 dark:text-slate-100">{record.total.toLocaleString("pt-BR", { style: "currency", currency: record.currency || "BRL" })}</strong>
            <button type="button" onClick={() => onEdit(record)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"><Pencil className="h-4 w-4" />Editar</button>
          </article>
        ))}
      </div>
    </section>
  );
}
