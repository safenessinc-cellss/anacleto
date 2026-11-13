import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, Factory, RefreshCw } from "lucide-react";

type Stage = { id: string; label: string; tasks: string[] };
const STAGES: Stage[] = [
  { id: "ORCAMENTO_APROVADO", label: "Orçamento aprovado", tasks: ["Aprovação formal do cliente registrada", "Sinal de 50% recebido e confirmado", "Preço do alumínio bloqueado; aditivos registrados separadamente"] },
  { id: "MEDICAO_OBRA", label: "Medição da obra", tasks: ["Visita técnica realizada", "Vãos medidos em milímetros e conferidos", "Folgas de instalação e contramarcos validados"] },
  { id: "ENGENHARIA_E_CORTE", label: "Engenharia e corte", tasks: ["Desenho técnico e medidas finais validados", "Plano de corte de barras de 6.000 mm com serra de 4 mm revisado", "Romaneio de perfis, vidros e componentes preparado", "Rota de usinagem definida"] },
  { id: "AGUARDANDO_MATERIAL", label: "Aguardando material", tasks: ["Pedidos de alumínio e vidro enviados", "Perfis recebidos e acabamento inspecionado", "Vidros conferidos por medida e especificação", "Ferragens e componentes conferidos"] },
  { id: "EM_FABRICACAO", label: "Em fabricação", tasks: ["Perfis cortados e identificados", "Furações e usinagens executadas", "Montagem, esquadro, escovas, roldanas e vedação conferidos", "Vidros instalados com gaxetas EPDM e peças embaladas"] },
  { id: "INSTALACAO_E_ENTREGA", label: "Instalação e entrega", tasks: ["Logística e agendamento confirmados", "Esquadrias fixadas e niveladas nos vãos", "Vedação externa com PU e ajustes finais realizados", "Termo de entrega assinado e saldo recebido"] },
  { id: "POS_VENDA_E_GARANTIA", label: "Pós-venda e garantia", tasks: ["Contato de cortesia agendado para 10 dias após entrega", "NPS registrado de 1 a 10", "Certificado de garantia e manual de manutenção emitidos", "Manutenções de 6 e 12 meses programadas"] },
];
type Quote = { id: string; number?: string; clientName?: string; status?: string; total?: number; productionOrderId?: string; items?: any[] };
type WorkOrder = { id: string; number?: string; quoteId: string; quoteNumber?: string; clientName?: string; description?: string; targetDate?: string; assignedTo?: string; status?: string; workflowStage?: string; workflowStageIndex?: number; workflowChecklist?: Record<string, boolean>; signalPaid?: boolean; signalAmount?: number; quoteTotal?: number; balanceDue?: number; createdAt?: any; updatedAt?: any; history?: any[] };

const stageIndex = (order: WorkOrder) => {
  if (Number.isInteger(order.workflowStageIndex)) return Math.min(6, Math.max(0, Number(order.workflowStageIndex)));
  const found = STAGES.findIndex(stage => stage.id === order.workflowStage);
  return found >= 0 ? found : 0;
};

export default function WorkflowDashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [signalDrafts, setSignalDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const a = onSnapshot(collection(db, "quotes"), snap => setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote))), e => console.error("Workflow quotes:", e));
    const b = onSnapshot(collection(db, "production_orders"), snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder))), e => console.error("Workflow orders:", e));
    return () => { a(); b(); };
  }, []);

  const orderQuoteIds = useMemo(() => new Set(orders.map(o => o.quoteId)), [orders]);
  const approvedWithoutOrder = useMemo(() => quotes.filter(q => ["approved", "aprovado"].includes(String(q.status).toLowerCase()) && !q.productionOrderId && !orderQuoteIds.has(q.id)), [quotes, orderQuoteIds]);
  const activeOrders = useMemo(() => orders.filter(o => o.status !== "cancelled" && stageIndex(o) < 7), [orders]);
  const visibleOrders = selectedStage === "ALL" ? activeOrders : activeOrders.filter(o => STAGES[stageIndex(o)]?.id === selectedStage);
  const completedCount = orders.filter(o => o.workflowStage === "POS_VENDA_E_GARANTIA" && o.status !== "cancelled").length;

  const createTracking = async (quote: Quote) => {
    setBusyId(quote.id); setNotice("");
    try {
      const ref = doc(collection(db, "production_orders"));
      await runTransaction(db, async tx => {
        const quoteRef = doc(db, "quotes", quote.id);
        const snap = await tx.get(quoteRef);
        if (!snap.exists() || !["approved", "aprovado"].includes(String(snap.data().status).toLowerCase())) throw new Error("O orçamento não está mais aprovado.");
        if (snap.data().productionOrderId) throw new Error("Este orçamento já possui uma ordem de produção.");
        const data = snap.data();
        const number = `OP-${new Date().getFullYear()}-${ref.id.slice(0, 6).toUpperCase()}`;
        tx.set(ref, { number, quoteId: quote.id, quoteNumber: data.number || "", clientName: data.clientName || "Cliente", description: `Acompanhamento do orçamento ${data.number || ""}`, targetDate: "", assignedTo: "", status: "planned", workflowStage: STAGES[0].id, workflowStageIndex: 0, workflowChecklist: {}, signalPaid: false, signalAmount: 0, quoteTotal: Number(data.total || 0), balanceDue: Number(data.total || 0), materials: [], quoteItems: data.items || [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: auth.currentUser?.email || "", history: [{ stage: STAGES[0].id, action: "tracking_created", at: new Date().toISOString(), by: auth.currentUser?.email || "" }] });
        tx.update(quoteRef, { productionOrderId: ref.id, productionStatus: "planned", updatedAt: serverTimestamp() });
      });
      setNotice("Acompanhamento criado. O projeto entrou na etapa Orçamento aprovado.");
    } catch (e) { setNotice((e as Error).message || "Não foi possível criar o acompanhamento."); }
    finally { setBusyId(""); }
  };

  const toggleTask = async (order: WorkOrder, task: string, checked: boolean) => {
    setBusyId(order.id); setNotice("");
    try {
      const checklist = { ...(order.workflowChecklist || {}), [task]: checked };
      await updateDoc(doc(db, "production_orders", order.id), { workflowChecklist: checklist, updatedAt: serverTimestamp(), lastWorkflowUpdateBy: auth.currentUser?.email || "" });
    } catch (e) { setNotice((e as Error).message || "Falha ao atualizar checklist."); }
    finally { setBusyId(""); }
  };

  const confirmSignal = async (order: WorkOrder) => {
    const amount = Number(signalDrafts[order.id] ?? (Number(order.quoteTotal || 0) * 0.5).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(order.quoteTotal || 0)) { setNotice("Informe um sinal recebido válido, sem ultrapassar o total do orçamento."); return; }
    setBusyId(order.id); setNotice("");
    try {
      await updateDoc(doc(db, "production_orders", order.id), { signalPaid: true, signalAmount: amount, balanceDue: Math.max(0, Number(order.quoteTotal || 0) - amount), signalConfirmedAt: serverTimestamp(), signalConfirmedBy: auth.currentUser?.email || "", updatedAt: serverTimestamp() });
      setNotice("Sinal registrado como recebido. O preço aprovado permanece vinculado ao projeto.");
    } catch (e) { setNotice((e as Error).message || "Não foi possível registrar o sinal."); }
    finally { setBusyId(""); }
  };

  const advanceStage = async (order: WorkOrder) => {
    const index = stageIndex(order);
    const stage = STAGES[index];
    if (!stage) return;
    const missing = stage.tasks.filter(task => !order.workflowChecklist?.[task]);
    if (missing.length) { setNotice(`Ainda faltam ${missing.length} requisito(s) na etapa ${stage.label}.`); return; }
    if (index === 0 && !order.signalPaid) { setNotice("A etapa inicial exige confirmação real do recebimento do sinal."); return; }
    setBusyId(order.id); setNotice("");
    try {
      const next = STAGES[index + 1];
      if (!next) {
        await updateDoc(doc(db, "production_orders", order.id), { workflowCompletedAt: serverTimestamp(), status: "completed", workflowStage: "CONCLUIDO", workflowStageIndex: 7, updatedAt: serverTimestamp(), history: [...(order.history || []), { stage: stage.id, action: "completed", at: new Date().toISOString(), by: auth.currentUser?.email || "" }] });
      } else {
        await updateDoc(doc(db, "production_orders", order.id), { workflowStage: next.id, workflowStageIndex: index + 1, workflowChecklist: {}, updatedAt: serverTimestamp(), lastStageChangedAt: serverTimestamp(), lastStageChangedBy: auth.currentUser?.email || "", history: [...(order.history || []), { stage: stage.id, action: "advanced", to: next.id, at: new Date().toISOString(), by: auth.currentUser?.email || "" }] });
      }
      setNotice(next ? `Projeto avançado para: ${next.label}.` : "Fluxo concluído. Projeto encaminhado ao acompanhamento de pós-venda.");
    } catch (e) { setNotice((e as Error).message || "Não foi possível avançar a etapa."); }
    finally { setBusyId(""); }
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><Factory className="h-6 w-6 text-blue-600"/><h1 className="text-2xl font-bold tracking-tight">Fluxo de Trabalho · Obras</h1></div><p className="mt-1 text-sm text-slate-500">Acompanhe cada projeto desde a aprovação até a garantia, com etapas e pendências em tempo real.</p></div>
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><RefreshCw className="mr-1 inline h-3.5 w-3.5"/> Atualização em tempo real</span>
    </header>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Projetos ativos</p><p className="mt-1 text-2xl font-bold">{activeOrders.length + approvedWithoutOrder.length}</p></div>
      <div className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Aguardando sinal</p><p className="mt-1 text-2xl font-bold">{activeOrders.filter(o => stageIndex(o) === 0 && !o.signalPaid).length + approvedWithoutOrder.length}</p></div>
      <div className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Em fabricação</p><p className="mt-1 text-2xl font-bold">{activeOrders.filter(o => stageIndex(o) === 4).length}</p></div>
      <div className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Pós-venda / garantia</p><p className="mt-1 text-2xl font-bold">{activeOrders.filter(o => stageIndex(o) === 6).length + completedCount}</p></div>
    </div>
    {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><AlertCircle className="mr-2 inline h-4 w-4"/>{notice}</div>}
    {approvedWithoutOrder.length > 0 && <section className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><h2 className="mb-3 font-semibold">Orçamentos aprovados · iniciar acompanhamento</h2><div className="space-y-2">{approvedWithoutOrder.map(q => <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div><p className="font-semibold">{q.number || q.id} · {q.clientName || "Cliente"}</p><p className="text-xs text-slate-500">Total: R$ {Number(q.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div><button disabled={!!busyId} onClick={() => createTracking(q)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === q.id ? "Criando..." : "Iniciar fluxo"}</button></div>)}</div></section>}
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Projetos por etapa</h2><select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-900"><option value="ALL">Todas as etapas</option>{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{STAGES.map((stage, index) => { const count = activeOrders.filter(o => stageIndex(o) === index).length; return <button key={stage.id} onClick={() => setSelectedStage(stage.id)} className={`rounded-xl border p-3 text-left transition ${selectedStage === stage.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "bg-white dark:bg-slate-900"}`}><span className="text-xs text-slate-500">Etapa {index + 1}</span><p className="mt-1 text-sm font-semibold">{stage.label}</p><p className="mt-1 text-xl font-bold">{count}</p></button>; })}</div>
    </section>
    <section className="space-y-3">
      {visibleOrders.map(order => { const index = stageIndex(order); const stage = STAGES[index]; const done = stage.tasks.filter(task => order.workflowChecklist?.[task]).length; const isBlocked = index === 0 && !order.signalPaid; return <article key={order.id} className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{order.number || order.id}</h3><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{stage.label}</span>{isBlocked && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Bloqueado · sinal pendente</span>}</div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{order.clientName || "Cliente"} · Orçamento {order.quoteNumber || order.quoteId}</p><p className="text-xs text-slate-500">{order.description} · Responsável: {order.assignedTo || "Não atribuído"}</p></div><div className="text-right text-xs text-slate-500"><p>Concluído: {done}/{stage.tasks.length}</p><p>Saldo estimado: R$ {Number(order.balanceDue ?? order.quoteTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div></div>
        {index === 0 && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><label className="text-xs font-medium">Sinal recebido (R$)<input type="number" min="0.01" max={Number(order.quoteTotal || 0)} step="0.01" value={signalDrafts[order.id] ?? (Number(order.quoteTotal || 0) * 0.5).toFixed(2)} onChange={e => setSignalDrafts(prev => ({ ...prev, [order.id]: e.target.value }))} className="mt-1 block w-44 rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-900"/></label><button disabled={!!busyId || order.signalPaid} onClick={() => confirmSignal(order)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{order.signalPaid ? "Sinal confirmado" : "Confirmar recebimento"}</button><span className="text-xs text-slate-500">Padrão sugerido: 50% do orçamento. Só confirme após identificar o pagamento.</span></div>}
        <div className="mt-3 space-y-2">{stage.tasks.map(task => <label key={task} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 p-2.5 text-sm dark:border-slate-800"><input type="checkbox" checked={!!order.workflowChecklist?.[task]} disabled={!!busyId} onChange={e => toggleTask(order, task, e.target.checked)} className="mt-0.5 h-4 w-4 rounded"/><span className={order.workflowChecklist?.[task] ? "text-slate-400 line-through" : ""}>{task}</span></label>)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>Prazo: {order.targetDate || "Não definido"} · {done === stage.tasks.length ? "Checklist completo" : "Pendências em aberto"}</span><button disabled={!!busyId || done !== stage.tasks.length || (index === 0 && !order.signalPaid)} onClick={() => advanceStage(order)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busyId === order.id ? "Salvando..." : index === 6 ? "Concluir fluxo" : "Avançar etapa"} <ArrowRight className="ml-1 inline h-4 w-4"/></button></div>
      </article>; })}
      {!visibleOrders.length && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500"><ClipboardCheck className="mx-auto mb-2 h-7 w-7"/>Nenhum projeto nesta etapa.</div>}
    </section>
    <p className="text-xs text-slate-500">O fluxo registra etapas e checklist no documento da ordem de produção. Confirmações de sinal, recebimento e entrega dependem de lançamento real pela equipe; marcar uma tarefa não substitui comprovantes financeiros ou inspeções técnicas.</p>
  </div>;
}
