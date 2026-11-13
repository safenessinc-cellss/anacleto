import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { CheckCircle2, Factory, Loader2, PackageCheck, Play, Plus, XCircle } from "lucide-react";
import CuttingPlanTab from "./CuttingPlanTab";
import type { TechnicalDrawing } from "../../types";

type QuoteRecord = { id: string; number?: string; clientName?: string; status?: string; productionOrderId?: string; items?: any[]; total?: number; drawingId?: string; technicalDrawing?: { id?: string } };
type Material = { id: string; name: string; sku?: string; unit?: string; quantity: number; reservedQuantity?: number };
type ReservedMaterial = { itemId: string; name: string; sku?: string; unit: string; quantity: number };
type WorkOrder = {
  id: string; number: string; quoteId: string; quoteNumber: string; clientName: string;
  description: string; targetDate: string; assignedTo: string;
  status: "planned" | "in_progress" | "completed" | "delivered" | "quality_approved" | "invoiced" | "paid" | "cancelled";
  workflowStage?: string; nextStep?: string; invoiceId?: string;
  materials: ReservedMaterial[]; drawingId?: string; quoteItems?: QuoteRecord["items"]; createdAt?: any;
};

export default function ProductionModule({ onNavigateDelivery, onNavigateQuality, onNavigateInvoice }: { onNavigateDelivery?: () => void; onNavigateQuality?: () => void; onNavigateInvoice?: () => void } = {}) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [drawings, setDrawings] = useState<TechnicalDrawing[]>([]);
  const [stock, setStock] = useState<Material[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [materialQty, setMaterialQty] = useState("1");
  const [materials, setMaterials] = useState<ReservedMaterial[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"orders" | "cutting">("orders");

  useEffect(() => {
    const a = onSnapshot(collection(db, "quotes"), snap => setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuoteRecord))), e => console.error("Production quotes:", e));
    const b = onSnapshot(collection(db, "inventory_items"), snap => setStock(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material))), e => console.error("Production stock:", e));
    const c = onSnapshot(collection(db, "production_orders"), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder));
      rows.sort((x,y) => String(y.createdAt?.toDate?.() || y.createdAt || "").localeCompare(String(x.createdAt?.toDate?.() || x.createdAt || "")));
      setOrders(rows);
    }, e => console.error("Production orders:", e));
    const d = onSnapshot(collection(db, "technical_drawings"), snap => setDrawings(snap.docs.map(row => ({ id: row.id, ...row.data() } as TechnicalDrawing))), e => console.error("Production drawings:", e));
    return () => { a(); b(); c(); d(); };
  }, []);

  const approvedQuotes = useMemo(() => quotes.filter(q => (q.status === "approved" || q.status === "aprovado") && !q.productionOrderId), [quotes]);
  const selectedStock = stock.find(x => x.id === materialId);
  const addMaterial = () => {
    const qty = Number(materialQty);
    if (!selectedStock || !Number.isFinite(qty) || qty <= 0) return;
    setMaterials(prev => {
      const existing = prev.find(x => x.itemId === selectedStock.id);
      return existing ? prev.map(x => x.itemId === selectedStock.id ? { ...x, quantity: x.quantity + qty } : x) : [...prev, { itemId: selectedStock.id, name: selectedStock.name, sku: selectedStock.sku, unit: selectedStock.unit || "un", quantity: qty }];
    });
    setMaterialId(""); setMaterialQty("1");
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const quote = approvedQuotes.find(q => q.id === quoteId);
    if (!quote) { setMessage("Selecione um orçamento aprovado."); return; }
    setSaving(true); setMessage("");
    const orderRef = doc(collection(db, "production_orders"));
    try {
      await runTransaction(db, async tx => {
        const quoteRef = doc(db, "quotes", quote.id);
        const quoteSnap = await tx.get(quoteRef);
        if (!quoteSnap.exists() || !["approved", "aprovado"].includes(String(quoteSnap.data().status))) throw new Error("O orçamento deixou de estar aprovado.");
        const materialRefs = materials.map(m => doc(db, "inventory_items", m.itemId));
        const materialSnaps = [];
        for (const ref of materialRefs) materialSnaps.push(await tx.get(ref));
        for (let i = 0; i < materialRefs.length; i++) {
          const snap = materialSnaps[i]; const requested = materials[i].quantity;
          if (!snap.exists()) throw new Error(`Material ${materials[i].name} não encontrado no estoque.`);
          const data = snap.data(); const available = Number(data.quantity || 0) - Number(data.reservedQuantity || 0);
          if (available < requested) throw new Error(`Estoque disponível insuficiente para ${materials[i].name}. Disponível: ${available}.`);
          tx.update(materialRefs[i], { reservedQuantity: Number(data.reservedQuantity || 0) + requested, updatedAt: serverTimestamp() });
        }
        const number = `OP-${new Date().getFullYear()}-${orderRef.id.slice(0, 6).toUpperCase()}`;
        tx.set(orderRef, { number, quoteId: quote.id, quoteNumber: quote.number || "", clientName: quote.clientName || "Cliente", description: description.trim() || `Produção do orçamento ${quote.number || ""}`, targetDate, assignedTo: assignedTo.trim(), status: "planned", workflowStage: "production", nextStep: "iniciar_producao", materials, quoteItems: quote.items || [], ...(quote.technicalDrawing?.id || quote.drawingId ? { drawingId: quote.technicalDrawing?.id || quote.drawingId } : {}), quoteTotal: Number(quote.total || 0), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
        tx.update(quoteRef, { productionOrderId: orderRef.id, productionStatus: "planned", updatedAt: serverTimestamp() });
      });
      setQuoteId(""); setDescription(""); setTargetDate(""); setAssignedTo(""); setMaterials([]); setMessage("Ordem criada. Os materiais foram reservados e vinculados ao orçamento.");
    } catch (err) { setMessage((err as Error).message || "Não foi possível criar a ordem."); }
    finally { setSaving(false); }
  };

  const updateOrder = async (order: WorkOrder, action: "start" | "complete" | "cancel") => {
    const orderRef = doc(db, "production_orders", order.id);
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) throw new Error("Ordem de produção não encontrada.");
        const current = snap.data() as any;
        if (action === "start") {
          if (current.status !== "planned") throw new Error("Somente ordens planejadas podem iniciar.");
          const quoteRef = doc(db, "quotes", order.quoteId);
          const quoteSnap = await tx.get(quoteRef);
          tx.update(orderRef, { status: "in_progress", workflowStage: "production", nextStep: "concluir_producao", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
          if (quoteSnap.exists()) tx.update(quoteRef, { productionStatus: "in_progress", updatedAt: serverTimestamp() });
          return;
        }
        if (!["planned", "in_progress"].includes(current.status)) throw new Error("Esta ordem já foi encerrada.");
        const reserved: ReservedMaterial[] = current.materials || [];
        const refs = reserved.map(m => doc(db, "inventory_items", m.itemId));
        const snapshots = [];
        for (const ref of refs) snapshots.push(await tx.get(ref));
        const quoteRef = doc(db, "quotes", order.quoteId);
        const quoteSnap = await tx.get(quoteRef);
        for (let i = 0; i < refs.length; i++) {
          const material = reserved[i]; const stockSnap = snapshots[i];
          if (!stockSnap.exists()) throw new Error(`Material ${material.name} não encontrado.`);
          const data = stockSnap.data(); const reservedQty = Number(data.reservedQuantity || 0);
          if (reservedQty < material.quantity) throw new Error(`Reserva inconsistente para ${material.name}.`);
          const update: any = { reservedQuantity: reservedQty - material.quantity, updatedAt: serverTimestamp() };
          if (action === "complete") {
            const currentQty = Number(data.quantity || 0);
            if (currentQty < material.quantity) throw new Error(`Saldo físico insuficiente para consumir ${material.name}.`);
            update.quantity = currentQty - material.quantity;
            const movementRef = doc(collection(db, "inventory_movements"));
            tx.set(movementRef, { itemId: material.itemId, itemName: material.name, type: "out", quantity: material.quantity, reason: `Consumo da ordem ${current.number}`, reference: order.id, createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
          }
          tx.update(refs[i], update);
        }
        tx.update(orderRef, action === "complete"
          ? { status: "completed", workflowStage: "delivery", nextStep: "registrar_entrega", completedAt: serverTimestamp(), updatedAt: serverTimestamp() }
          : { status: "cancelled", workflowStage: "cancelled", nextStep: "encerrado", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
        if (quoteSnap.exists()) tx.update(quoteRef, {
          productionStatus: action === "complete" ? "ready_for_delivery" : "cancelled",
          updatedAt: serverTimestamp(),
        });
      });
      setMessage(action === "complete" ? "Produção concluída. Materiais consumidos e estoque atualizado." : action === "cancel" ? "Ordem cancelada. As reservas foram devolvidas ao estoque." : "Produção iniciada.");
    } catch (err) { setMessage((err as Error).message || "Não foi possível atualizar a ordem."); }
  };

  const statusLabel: Record<string,string> = {
    planned: "Aguardando produção", in_progress: "Em produção", completed: "Pronta para entrega",
    delivered: "Entregue · aguardando qualidade", quality_approved: "Qualidade aprovada · aguardando fatura", invoiced: "Faturada · aguardando pagamento",
    paid: "Concluída e recebida", cancelled: "Cancelada",
  };
  return <div className="space-y-5">
    <nav className="flex gap-2 border-b pb-3">
      <button type="button" onClick={() => setActiveTab("orders")} aria-current={activeTab === "orders" ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${activeTab === "orders" ? "bg-indigo-600 text-white" : "border"}`}>Ordens de Produção</button>
      <button type="button" onClick={() => setActiveTab("cutting")} aria-current={activeTab === "cutting" ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${activeTab === "cutting" ? "bg-indigo-600 text-white" : "border"}`}>Plano de Corte 6M</button>
    </nav>
    {activeTab === "cutting" ? <CuttingPlanTab orders={orders} drawings={drawings} /> : <>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Ordens abertas</p><p className="text-2xl font-bold">{orders.filter(o => ["planned","in_progress"].includes(o.status)).length}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Em produção</p><p className="text-2xl font-bold">{orders.filter(o => o.status === "in_progress").length}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Materiais cadastrados</p><p className="text-2xl font-bold">{stock.length}</p></div>
    </div>
    <form onSubmit={createOrder} className="rounded-xl border bg-white p-4 space-y-3 dark:bg-slate-900">
      <div className="flex items-center gap-2"><Factory className="h-5 w-5 text-indigo-600"/><h3 className="font-semibold">Nova ordem de produção</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select className="rounded-lg border px-3 py-2" value={quoteId} onChange={e=>setQuoteId(e.target.value)} required><option value="">Selecionar orçamento aprovado</option>{approvedQuotes.map(q=><option key={q.id} value={q.id}>{q.number || q.id} · {q.clientName || "Cliente"}</option>)}</select>
        <input className="rounded-lg border px-3 py-2" placeholder="Descrição / etapa de fabricação" value={description} onChange={e=>setDescription(e.target.value)}/>
        <input className="rounded-lg border px-3 py-2" type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
        <input className="rounded-lg border px-3 py-2" placeholder="Responsável pela produção" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}/>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="mb-2 text-sm font-semibold">Reservar materiais do estoque</p><div className="flex flex-wrap gap-2"><select className="min-w-0 flex-1 rounded-lg border px-3 py-2" value={materialId} onChange={e=>setMaterialId(e.target.value)}><option value="">Selecionar material</option>{stock.map(m=><option key={m.id} value={m.id}>{m.name} · disponível {Math.max(0,Number(m.quantity||0)-Number(m.reservedQuantity||0))} {m.unit || "un"}</option>)}</select><input className="w-24 rounded-lg border px-3 py-2" type="number" min="0.001" step="0.001" value={materialQty} onChange={e=>setMaterialQty(e.target.value)}/><button type="button" onClick={addMaterial} className="rounded-lg border px-3 py-2"><Plus className="h-4 w-4"/></button></div>{materials.map(m=><div key={m.itemId} className="mt-2 flex items-center justify-between text-sm"><span>{m.name}</span><span>{m.quantity} {m.unit} <button type="button" onClick={()=>setMaterials(prev=>prev.filter(x=>x.itemId!==m.itemId))} className="ml-2 text-rose-600"><XCircle className="inline h-4 w-4"/></button></span></div>)}</div>
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500" role="status">{message}</p><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Criar ordem"}</button></div>
    </form>
    <div className="space-y-3">{orders.map(order=><div key={order.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-bold">{order.number}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{statusLabel[order.status] || order.status}</span></div><p className="text-sm text-slate-600 dark:text-slate-300">{order.clientName} · {order.quoteNumber}</p><p className="text-sm text-slate-500">{order.description}</p><p className="mt-1 text-xs text-slate-500">Prazo: {order.targetDate || "Não definido"} · Responsável: {order.assignedTo || "Não atribuído"}</p></div><div className="flex flex-wrap gap-2">{order.status === "planned" && <button onClick={()=>updateOrder(order,"start")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"><Play className="mr-1 inline h-4 w-4"/>Iniciar</button>}{["planned","in_progress"].includes(order.status) && <><button onClick={()=>updateOrder(order,"complete")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Concluir produção</button><button onClick={()=>updateOrder(order,"cancel")} className="rounded-lg border px-3 py-2 text-sm"><XCircle className="mr-1 inline h-4 w-4"/>Cancelar</button></>}{order.status === "completed" && <button onClick={onNavigateDelivery} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Próxima etapa: entrega →</button>}{order.status === "delivered" && <button onClick={onNavigateQuality} className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white">Próxima etapa: qualidade →</button>}{order.status === "quality_approved" && <button onClick={onNavigateInvoice} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Próxima etapa: emitir fatura →</button>}{order.status === "invoiced" && <button onClick={onNavigateInvoice} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">Próxima etapa: registrar recebimento →</button>}</div></div><div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Etapa: <b>{order.workflowStage === "delivery" ? "Entrega e instalação" : order.workflowStage === "quality" ? "Inspeção de qualidade" : order.workflowStage === "billing" || order.workflowStage === "payment" ? "Faturamento e recebimento" : order.workflowStage === "closed" ? "Finalizada" : "Produção"}</b> · Próximo passo: {order.nextStep === "concluir_producao" ? "Concluir fabricação" : order.nextStep === "registrar_entrega" ? "Registrar entrega" : order.nextStep === "registrar_qualidade" ? "Registrar inspeção de qualidade" : order.nextStep === "emitir_fatura" ? "Emitir fatura" : order.nextStep === "registrar_recebimento" ? "Registrar recebimento" : order.nextStep === "concluido" ? "Nenhum — processo concluído" : "Iniciar fabricação"}</div><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">{(order.materials || []).map(m=><span key={m.itemId} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"><PackageCheck className="mr-1 inline h-3 w-3"/>{m.name}: {m.quantity} {m.unit}</span>)}</div></div>)}{!orders.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500 dark:bg-slate-900">Nenhuma ordem de produção registrada.</div>}</div>
    </>}
  </div>;
}
