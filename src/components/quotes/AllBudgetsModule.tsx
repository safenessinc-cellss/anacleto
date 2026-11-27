import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { FileText, Search, Pencil } from "lucide-react";
import { auth, db } from "../../firebase";
import { buildCommercialQuoteDraft } from "../../utils/budget-workflow.js";

export type BudgetWorkflow = "standard" | "smart" | "technical";
type Row = { id: string; workflow: BudgetWorkflow; number?: string; clientName?: string; status?: string; total?: number; currency?: string; createdAt?: any; request?: string; sourceData?: Record<string, any>; canonicalQuoteId?: string; technicalVisitStatus?: string; requiresTechnicalVisit?: boolean; requiresClientConfirmation?: boolean; pendingQuestions?: string[]; preliminaryOnly?: boolean };

export default function AllBudgetsModule({ onOpen }: { onOpen: (workflow: BudgetWorkflow, id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [limitedSources, setLimitedSources] = useState<string[]>([]);

  useEffect(() => {
    const collections: Array<{ name: string; workflow: BudgetWorkflow }> = [
      { name: "quotes", workflow: "standard" },
      { name: "smart_budgets", workflow: "smart" },
      { name: "technical_budgets", workflow: "technical" },
    ];
    const snapshots = new Map<string, Row[]>();
    const unsubscribers = collections.map(({ name, workflow }) =>
      onSnapshot(query(collection(db, name), orderBy("createdAt", "desc"), limit(300)), (snap) => {
        setLimitedSources((current) => snap.size >= 300 ? [...new Set([...current, name])] : current.filter((item) => item !== name));
        snapshots.set(name, snap.docs.filter((d) => !(workflow === "standard" && d.data().sourceBudgetCollection && d.data().sourceBudgetId)).map((d) => {
          const data = d.data() as any;
          return { id: d.id, workflow, number: data.number, clientName: data.clientName || data.customerName || "Cliente não informado", status: data.status || "draft", total: data.total == null && data.subtotal == null ? undefined : Number(data.total ?? data.subtotal), currency: data.currency || "BRL", createdAt: data.createdAt, request: data.request, sourceData: data, canonicalQuoteId: String(data.canonicalQuoteId || ""), technicalVisitStatus: String(data.technicalVisitStatus || "pending"), requiresTechnicalVisit: data.visitRequired === true || data.requiresTechnicalVisit === true || (workflow === "technical" && data.measurementsConfirmed !== true), requiresClientConfirmation: data.requiresClientConfirmation === true || (Array.isArray(data.pendingQuestions) && data.pendingQuestions.length > 0), pendingQuestions: Array.isArray(data.pendingQuestions) ? data.pendingQuestions : [], preliminaryOnly: data.preliminaryOnly === true };
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


  const prepareCommercialQuote = async (row: Row) => {
    if (row.workflow === "standard") return;
    setBusyId(row.workflow + ":" + row.id); setError(""); setNotice("");
    try {
      const sourceCollection = row.workflow === "smart" ? "smart_budgets" : "technical_budgets";
      const sourceRef = doc(db, sourceCollection, row.id);
      const sourceSnap = await getDoc(sourceRef);
      if (!sourceSnap.exists()) throw new Error("O orçamento original não foi encontrado.");
      const source = sourceSnap.data() as Record<string, any>;
      const quoteId = String(source.canonicalQuoteId || `from_${row.workflow}_${row.id}`);
      const quoteRef = doc(db, "quotes", quoteId);
      const existing = await getDoc(quoteRef);
      if (existing.exists()) {
        await updateDoc(sourceRef, {
          canonicalQuoteId: quoteId,
          workflowStatus: "converted_to_quote",
          ...(row.requiresTechnicalVisit ? { technicalVisitStatus: String(existing.data().technicalVisitStatus || "pending") } : {}),
          updatedAt: serverTimestamp(),
        });
        onOpen("standard", quoteId);
        setNotice("Este orçamento já possui uma proposta comercial vinculada. Abrindo o registro existente sem sobrescrever suas edições.");
        return;
      }
      const draft = buildCommercialQuoteDraft(source, row.workflow, row.id);
      await setDoc(quoteRef, { ...draft, id: quoteId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      await updateDoc(sourceRef, {
        canonicalQuoteId: quoteId,
        workflowStatus: "converted_to_quote",
        ...(row.requiresTechnicalVisit ? { technicalVisitStatus: "pending" } : {}),
        updatedAt: serverTimestamp(),
      });
      setNotice(row.workflow === "technical"
        ? (row.requiresTechnicalVisit ? "Orçamento técnico integrado como proposta preliminar. A visita técnica está pendente e a aprovação final ficará bloqueada até sua confirmação." : "Orçamento técnico integrado. Medidas confirmadas; revise os preços estimados e os dados antes de aprovar.")
        : "Orçamento inteligente integrado ao fluxo comercial. Revise as perguntas, quantidades, preços e dados antes de aprovar.");
      onOpen("standard", quoteId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível integrar o orçamento ao fluxo comercial.");
    } finally { setBusyId(""); }
  };

  const confirmTechnicalVisit = async (row: Row) => {
    if (row.workflow === "standard" || !row.requiresTechnicalVisit || !row.canonicalQuoteId) return;
    if (!auth.currentUser) { setError("Sessão expirada. Entre novamente."); return; }
    const confirmationNotes = window.prompt("Registre as medidas e condições verificadas na visita técnica:");
    if (!confirmationNotes?.trim()) { setError("Registre um resumo da visita para concluir esta etapa."); return; }
    setBusyId(row.workflow + ":" + row.id); setError(""); setNotice("");
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();
      batch.update(doc(db, "quotes", row.canonicalQuoteId), {
        technicalVisitStatus: "completed", visitRequired: false, measurementsConfirmed: true,
        technicalVisitNotes: confirmationNotes.trim(),
        technicalVisitCompletedAt: now, technicalVisitCompletedBy: auth.currentUser.uid, updatedAt: now,
      });
      batch.update(doc(db, row.workflow === "technical" ? "technical_budgets" : "smart_budgets", row.id), {
        technicalVisitStatus: "completed", visitRequired: false, measurementsConfirmed: true,
        technicalVisitNotes: confirmationNotes.trim(),
        technicalVisitCompletedAt: now, technicalVisitCompletedBy: auth.currentUser.uid, updatedAt: now,
      });
      await batch.commit();
      setNotice("Visita técnica registrada. O orçamento comercial poderá seguir para aprovação após a revisão dos preços.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar a visita técnica. Verifique sua permissão.");
    } finally { setBusyId(""); }
  };

  const workflowLabel = (workflow: BudgetWorkflow) => workflow === "smart" ? "Inteligente · IA" : workflow === "technical" ? "Esquadrias · Técnico" : "Tradicional";

  const confirmClientQuestions = async (row: Row) => {
    if (row.workflow === "standard" || !row.canonicalQuoteId || !row.pendingQuestions?.length) return;
    if (!auth.currentUser) { setError("Sessão expirada. Entre novamente."); return; }
    const notes = window.prompt("Registre as respostas confirmadas pelo cliente ou responsável técnico:");
    if (!notes?.trim()) { setError("Registre as respostas confirmadas antes de concluir as pendências."); return; }
    setBusyId(row.workflow + ":" + row.id); setError(""); setNotice("");
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const confirmation = { pendingQuestions: [], requiresClientConfirmation: false, clientConfirmationStatus: "completed", clientConfirmationNotes: notes.trim(), clientConfirmationAt: now, clientConfirmationBy: auth.currentUser.uid, updatedAt: now };
      batch.update(doc(db, "quotes", row.canonicalQuoteId), confirmation);
      batch.update(doc(db, row.workflow === "smart" ? "smart_budgets" : "technical_budgets", row.id), confirmation);
      await batch.commit();
      setNotice("Respostas registradas. Revise quantidades e preços na proposta comercial antes da aprovação final.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar as respostas pendentes.");
    } finally { setBusyId(""); }
  };

  return <main className="space-y-5">
    {limitedSources.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Histórico limitado aos 300 registros mais recentes por modalidade: {limitedSources.join(", ")}. A paginação histórica ainda precisa ser concluída.</p>}
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Todos os Orçamentos</h1>
      <p className="mt-1 text-sm text-slate-500">Histórico unificado. A edição sempre abre no fluxo em que o orçamento foi criado.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por cliente, número ou pedido" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></div>
        <select value={status} onChange={(e)=>setStatus(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">Todos os status</option><option value="draft">Rascunho</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="rejected">Rejeitado</option></select>
      </div>
    </header>
    {limitedSources.length>0&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Histórico limitado a 300 registros por modalidade ({limitedSources.join(", ")}). A paginação do acervo completo ainda está pendente.</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{rows.length ? "Nenhum orçamento corresponde à busca." : "Nenhum orçamento encontrado."}</p> : filtered.map((row) => <article key={row.workflow + ":" + row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900 dark:text-white">{row.number || row.clientName}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{workflowLabel(row.workflow)}</span>{(row.workflow === "technical" || row.requiresTechnicalVisit || (row.workflow === "smart" && row.sourceData?.items?.some((item: any) => item.priceSource !== "catalog" || Number(item.quantity) <= 0))) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Preliminar</span>}<span className="text-xs text-slate-500">{row.status}</span></div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.clientName}{row.number ? " · " + row.number : ""}</p>
          <p className="mt-1 text-xs text-slate-500">{row.createdAt?.toDate ? row.createdAt.toDate().toLocaleDateString("pt-BR") : row.createdAt ? new Date(row.createdAt).toLocaleDateString("pt-BR") : "Data não informada"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><strong className="text-sm tabular-nums text-slate-900 dark:text-white">{row.total == null ? "Valor pendente" : Number(row.total).toLocaleString("pt-BR", { style: "currency", currency: row.currency || "BRL" })}</strong>{row.workflow !== "standard" && <button type="button" disabled={!!busyId} onClick={()=>void prepareCommercialQuote(row)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">{busyId===row.workflow+":"+row.id?"Integrando...":"Preparar orçamento comercial"}</button>}{row.requiresTechnicalVisit && row.canonicalQuoteId && row.technicalVisitStatus !== "completed" && <button type="button" disabled={!!busyId} onClick={()=>void confirmTechnicalVisit(row)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Confirmar visita técnica</button>}{row.requiresClientConfirmation && row.canonicalQuoteId && <button type="button" disabled={!!busyId} onClick={()=>void confirmClientQuestions(row)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Confirmar informações</button>}{row.requiresTechnicalVisit && row.canonicalQuoteId && row.technicalVisitStatus === "completed" && <span className="text-xs font-semibold text-emerald-700">Visita concluída</span>}<button type="button" onClick={()=>onOpen(row.workflow,row.id)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Pencil className="h-3.5 w-3.5"/>Editar</button></div>
      </article>)}
    </section>
  </main>;
}
