import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { AlertTriangle, ClipboardCheck, HardHat, Plus, Search, ShieldCheck } from "lucide-react";
import { db } from "../../firebase";
import type { Company, Quote } from "../../types";

type ProtectionType = "incident" | "inspection" | "asset" | "corrective_action";
type ProtectionRecord = {
  id: string; recordType: ProtectionType; title: string; location: string;
  responsible: string; date: string; status: "open" | "in_progress" | "closed";
  severity: "low" | "medium" | "high" | "critical"; companyId?: string;
  companyName?: string; quoteId?: string; quoteNumber?: string;
  description: string; action?: string; createdAt: string;
};
const types: {value:ProtectionType;label:string}[] = [
  {value:"incident",label:"Incidente / ocorrência"},
  {value:"inspection",label:"Inspeção de segurança"},
  {value:"asset",label:"Ativo / equipamento"},
  {value:"corrective_action",label:"Ação preventiva ou corretiva"}
];
const statusLabel = {open:"Aberto",in_progress:"Em andamento",closed:"Concluído"};
const severityLabel = {low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
const today = () => new Date().toISOString().slice(0,10);
const initial = {recordType:"incident" as ProtectionType,title:"",location:"",responsible:"",date:today(),status:"open" as const,severity:"medium" as const,companyId:"",quoteId:"",description:"",action:""};

export default function ProtectionModule() {
  const [records,setRecords] = useState<ProtectionRecord[]>([]);
  const [companies,setCompanies] = useState<Company[]>([]);
  const [quotes,setQuotes] = useState<Quote[]>([]);
  const [form,setForm] = useState(initial);
  const [open,setOpen] = useState(false);
  const [search,setSearch] = useState("");
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);
  useEffect(()=>onSnapshot(query(collection(db,"protection_records"),orderBy("createdAt","desc")),s=>setRecords(s.docs.map(d=>({id:d.id,...d.data()} as ProtectionRecord))),()=>setError("Não foi possível carregar os registros de proteção.")),[]);
  useEffect(()=>onSnapshot(collection(db,"companies"),s=>setCompanies(s.docs.map(d=>({id:d.id,...d.data()} as Company))),()=>{}),[]);
  useEffect(()=>onSnapshot(collection(db,"quotes"),s=>setQuotes(s.docs.map(d=>({id:d.id,...d.data()} as Quote))),()=>{}),[]);
  const filtered=useMemo(()=>records.filter(r=>[r.title,r.location,r.responsible,r.companyName,r.description].join(" ").toLowerCase().includes(search.toLowerCase())),[records,search]);
  const save=async(e:React.FormEvent)=>{e.preventDefault();if(!form.title.trim()||!form.description.trim()||!form.responsible.trim()){setError("Informe título, descrição e responsável.");return;}setSaving(true);setError("");try{const company=companies.find(c=>c.id===form.companyId);const quote=quotes.find(q=>q.id===form.quoteId);await addDoc(collection(db,"protection_records"),{...form,companyId:company?.id||"",companyName:company?.name||"",quoteId:quote?.id||"",quoteNumber:quote?.number||"",createdAt:new Date().toISOString()});setForm(initial);setOpen(false);}catch{setError("Não foi possível salvar. Verifique sua permissão de acesso.");}finally{setSaving(false);}};
  const openCount=records.filter(r=>r.status!=="closed").length;
  const critical=records.filter(r=>r.severity==="critical"&&r.status!=="closed").length;
  return <div className="tahoe-module space-y-5">
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"><div><p className="tahoe-eyebrow">Governança operacional</p><h1 className="tahoe-heading">Proteção e Segurança</h1><p className="tahoe-subtitle">Controle de incidentes, inspeções, ativos e ações preventivas vinculadas à operação.</p></div><button className="tahoe-primary" onClick={()=>setOpen(v=>!v)}><Plus size={16}/> Novo registro</button></header>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="tahoe-card"><span className="tahoe-label">Registros</span><strong className="tahoe-kpi">{records.length}</strong></div><div className="tahoe-card"><span className="tahoe-label">Em aberto</span><strong className="tahoe-kpi">{openCount}</strong></div><div className="tahoe-card"><span className="tahoe-label">Críticos pendentes</span><strong className="tahoe-kpi">{critical}</strong></div></div>
    {error&&<p role="alert" className="tahoe-alert">{error}</p>}
    {open&&<form onSubmit={save} className="tahoe-card space-y-4"><div className="flex items-center gap-2"><ShieldCheck size={18}/><h2 className="font-semibold">Novo registro de proteção</h2></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <label className="tahoe-field">Tipo<select value={form.recordType} onChange={e=>setForm({...form,recordType:e.target.value as ProtectionType})}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <label className="tahoe-field">Título *<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required placeholder="Ex.: Inspeção de instalação"/></label>
      <label className="tahoe-field">Local / setor<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Obra, oficina, depósito..."/></label>
      <label className="tahoe-field">Responsável *<input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})} required/></label>
      <label className="tahoe-field">Data<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      <label className="tahoe-field">Gravidade<select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value as typeof form.severity})}>{Object.entries(severityLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="tahoe-field">Situação<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as typeof form.status})}>{Object.entries(statusLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="tahoe-field">Cliente relacionado<select value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value,quoteId:""})}><option value="">Sem vínculo</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="tahoe-field">Orçamento / projeto<select value={form.quoteId} onChange={e=>setForm({...form,quoteId:e.target.value})}><option value="">Sem vínculo</option>{quotes.filter(q=>!form.companyId||q.companyId===form.companyId).map(q=><option key={q.id} value={q.id}>{q.number} · {q.clientName}</option>)}</select></label>
      <label className="tahoe-field sm:col-span-2 lg:col-span-3">Descrição *<textarea rows={3} required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="tahoe-field sm:col-span-2 lg:col-span-3">Ação / plano de controle<textarea rows={2} value={form.action} onChange={e=>setForm({...form,action:e.target.value})} placeholder="Medida imediata, responsável e prazo..."/></label>
    </div><div className="flex justify-end gap-2"><button type="button" className="tahoe-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button disabled={saving} className="tahoe-primary" type="submit">{saving?"Salvando...":"Salvar registro"}</button></div></form>}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h2 className="font-semibold">Registros e acompanhamento</h2><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input className="tahoe-search" placeholder="Buscar registros..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{filtered.map(r=><article className="tahoe-card space-y-3" key={r.id}><div className="flex justify-between gap-3"><div className="flex gap-3"><span className="tahoe-icon"><HardHat size={18}/></span><div><h3 className="font-semibold">{r.title}</h3><p className="text-sm text-slate-500">{types.find(t=>t.value===r.recordType)?.label} · {r.date}</p></div></div><span className={`tahoe-status ${r.severity==="critical"||r.severity==="high"?"is-warning":""}`}>{severityLabel[r.severity]}</span></div><p className="text-sm text-slate-600">{r.description}</p>{r.action&&<p className="text-sm"><strong>Plano:</strong> {r.action}</p>}<div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70"><span className="text-xs text-slate-500">{r.companyName||"Sem cliente"}{r.quoteNumber? ` · Orçamento ${r.quoteNumber}`:""} · {r.responsible}</span><span className="tahoe-status">{statusLabel[r.status]}</span></div></article>)}{filtered.length===0&&<div className="tahoe-card text-center text-sm text-slate-500 xl:col-span-2"><ClipboardCheck className="mx-auto mb-2" size={22}/>Nenhum registro encontrado.</div>}</div>
    <p className="text-xs text-slate-500 flex items-center gap-2"><AlertTriangle size={14}/> Registros de proteção são operacionais e não substituem laudos técnicos, inspeções legais ou procedimentos de SST exigidos.</p>
  </div>;
}
