import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { ClipboardList, Factory, PackageCheck, Truck, Search, Plus, X, Save } from "lucide-react";

type Row = { id: string; [key: string]: any };
type Stage = "planejamento" | "separacao" | "fabricacao" | "qualidade" | "pronto_entrega" | "entregue";
const stages: { id: Stage; label: string }[] = [
  { id: "planejamento", label: "Planejamento" },
  { id: "separacao", label: "Separação de materiais" },
  { id: "fabricacao", label: "Fabricação" },
  { id: "qualidade", label: "Controle de qualidade" },
  { id: "pronto_entrega", label: "Pronto para entrega" },
  { id: "entregue", label: "Entregue" },
];
const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const blank = { title: "", companyId: "", companyName: "", quoteId: "", quoteNumber: "", invoiceId: "", responsible: "", startDate: today(), dueDate: "", deliveryDate: "", priority: "normal", description: "", dimensions: "", notes: "", value: 0 };

export default function ProductionModule() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [quotes, setQuotes] = useState<Row[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "production_orders"), s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message));
    const unsubCompanies = onSnapshot(collection(db, "companies"), s => setCompanies(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message));
    const unsubQuotes = onSnapshot(collection(db, "quotes"), s => setQuotes(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message));
    return () => { unsubOrders(); unsubCompanies(); unsubQuotes(); };
  }, []);

  const filtered = useMemo(() => orders.filter(o => {
    const q = search.toLocaleLowerCase("pt-BR");
    return (stageFilter === "all" || o.stage === stageFilter) &&
      [o.orderNumber, o.title, o.companyName, o.quoteNumber, o.responsible].some(v => String(v || "").toLocaleLowerCase("pt-BR").includes(q));
  }), [orders, search, stageFilter]);

  const stats = {
    active: orders.filter(o => o.stage !== "entregue").length,
    fabrication: orders.filter(o => o.stage === "fabricacao").length,
    ready: orders.filter(o => o.stage === "pronto_entrega").length,
    delivered: orders.filter(o => o.stage === "entregue").length,
  };

  const startNew = () => { setEditing(null); setForm({ ...blank }); setError(""); setShowForm(true); };
  const startEdit = (o: Row) => {
    setEditing(o);
    setForm({ ...blank, ...o, value: Number(o.value || 0) });
    setShowForm(true);
  };
  const save = async () => {
    if (!form.title.trim()) { setError("Informe a descrição da ordem de produção."); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, updatedAt: new Date().toISOString(), ...(editing ? {} : { stage: "planejamento", createdAt: new Date().toISOString(), orderNumber: "OP-" + Date.now().toString().slice(-8) }) };
      if (editing) await updateDoc(doc(db, "production_orders", editing.id), payload);
      else await addDoc(collection(db, "production_orders"), payload);
      setShowForm(false); setEditing(null); setForm({ ...blank });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a ordem."); }
    finally { setSaving(false); }
  };
  const changeStage = async (o: Row, stage: Stage) => {
    const now = new Date().toISOString();
    await updateDoc(doc(db, "production_orders", o.id), { stage, updatedAt: now, ...(stage === "entregue" ? { deliveryDate: today() } : {}) });
  };

  return <div className="tahoe-module space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="tahoe-eyebrow">Operação industrial</p><h1 className="tahoe-heading">Produção e Entregas</h1><p className="tahoe-subtitle">Acompanhe cada ordem desde a aprovação do orçamento até a entrega ao cliente.</p></div><button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16}/> Nova ordem de produção</button></header>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[{label:"Ordens em andamento",value:stats.active,icon:ClipboardList},{label:"Em fabricação",value:stats.fabrication,icon:Factory},{label:"Prontas para entrega",value:stats.ready,icon:PackageCheck},{label:"Entregues",value:stats.delivered,icon:Truck}].map(k=><div className="tahoe-card" key={k.label}><div className="flex justify-between text-slate-500 text-xs"><span>{k.label}</span><k.icon size={17}/></div><strong className="tahoe-kpi">{k.value}</strong></div>)}</div>
    <section className="tahoe-card space-y-3"><div className="flex flex-wrap gap-2"><div className="relative flex-1 min-w-48"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className={input+" pl-9"} placeholder="Buscar ordem, cliente ou responsável" value={search} onChange={e=>setSearch(e.target.value)}/></div><select className={input+" max-w-xs"} value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">Todas as etapas</option>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {filtered.length===0 ? <div className="py-12 text-center text-sm text-slate-500"><Factory size={30} className="mx-auto mb-2 opacity-40"/>Nenhuma ordem encontrada. Crie uma ordem vinculada a um orçamento aprovado.</div> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="p-3">Ordem / Projeto</th><th className="p-3">Cliente</th><th className="p-3">Prazo</th><th className="p-3">Valor</th><th className="p-3 min-w-52">Etapa operacional</th><th className="p-3">Ação</th></tr></thead><tbody>{filtered.map(o=><tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3"><strong className="block">{o.orderNumber || "OP"}</strong><span>{o.title}</span><small className="block text-slate-400">{o.quoteNumber ? "Orçamento "+o.quoteNumber : "Sem orçamento vinculado"}</small></td><td className="p-3">{o.companyName || "—"}<small className="block text-slate-400">{o.responsible || "Sem responsável"}</small></td><td className="p-3">{o.dueDate || "—"}</td><td className="p-3 font-semibold">{money(o.value)}</td><td className="p-3"><select aria-label="Etapa da ordem" className={input} value={o.stage || "planejamento"} onChange={e=>changeStage(o,e.target.value as Stage)}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></td><td className="p-3"><button onClick={()=>startEdit(o)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-white">Detalhes</button></td></tr>)}</tbody></table></div>}
    </section>
    {showForm && <div className="fixed inset-0 z-[80] bg-slate-950/40 p-3 flex items-center justify-center"><div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl space-y-4"><div className="flex justify-between items-center"><div><h2 className="text-lg font-bold text-slate-900">{editing ? "Editar ordem de produção" : "Nova ordem de produção"}</h2><p className="text-xs text-slate-500">Vincule cliente, orçamento e faturação para rastreabilidade.</p></div><button onClick={()=>setShowForm(false)} aria-label="Fechar"><X/></button></div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Descrição do projeto<input className={input+" mt-1"} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Esquadrias residência Silva"/></label>
      <label className="text-xs font-semibold text-slate-600">Cliente<select className={input+" mt-1"} value={form.companyId} onChange={e=>{const c=companies.find(x=>x.id===e.target.value);setForm({...form,companyId:e.target.value,companyName:c?.name||c?.companyName||""})}}><option value="">Selecionar cliente</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name||c.companyName||c.id}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Orçamento<select className={input+" mt-1"} value={form.quoteId} onChange={e=>{const q=quotes.find(x=>x.id===e.target.value);setForm({...form,quoteId:e.target.value,quoteNumber:q?.number||q?.quoteNumber||q?.id||"",value:Number(q?.total||form.value)})}}><option value="">Selecionar orçamento</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.number||q.quoteNumber||q.id} · {q.clientName||q.companyName||"Cliente"} · {money(q.total)}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Fatura vinculada (opcional)<input className={input+" mt-1"} value={form.invoiceId} onChange={e=>setForm({...form,invoiceId:e.target.value})} placeholder="Número/ID da fatura"/></label>
      <label className="text-xs font-semibold text-slate-600">Responsável<input className={input+" mt-1"} value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Início<input type="date" className={input+" mt-1"} value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Prazo previsto<input type="date" className={input+" mt-1"} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Valor do projeto (R$)<input type="number" min="0" step="0.01" className={input+" mt-1"} value={form.value} onChange={e=>setForm({...form,value:Number(e.target.value)})}/></label>
      <label className="text-xs font-semibold text-slate-600">Prioridade<select className={input+" mt-1"} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Medidas / especificações<textarea className={input+" mt-1"} rows={2} value={form.dimensions} onChange={e=>setForm({...form,dimensions:e.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Descrição técnica<textarea className={input+" mt-1"} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Observações<textarea className={input+" mt-1"} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div>
      <div className="flex justify-end gap-2 pt-2"><button onClick={()=>setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Cancelar</button><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>{saving?"Salvando...":"Salvar ordem"}</button></div>
    </div></div>}
  </div>;
}
