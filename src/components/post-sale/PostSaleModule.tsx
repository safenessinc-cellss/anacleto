import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import logoImg from "../../assets/images/anacleto-logo-premium.svg";
import { Award, ClipboardCheck, MessageSquareHeart, Plus, Search, Trash2, Wrench, X } from "lucide-react";

type Kind = "quality_certificate" | "satisfaction" | "service";
type Entry = { id: string; kind: Kind; customer: string; orderNumber: string; product: string; title: string; status: string; rating?: number; notes: string; serialNumber?: string; inspection?: string; createdAt: string };
const labels: Record<Kind, string> = { quality_certificate: "Certificado de qualidade", satisfaction: "Pesquisa de satisfação", service: "Assistência técnica" };
const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (char) => { if (char === "&") return "&amp;"; if (char === "<") return "&lt;"; if (char === ">") return "&gt;"; if (char === '"') return "&quot;"; return "&#39;"; });

export default function PostSaleModule() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("quality_certificate");
  const [customer, setCustomer] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [product, setProduct] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Em andamento");
  const [rating, setRating] = useState(5);
  const [serialNumber, setSerialNumber] = useState("");
  const [inspection, setInspection] = useState("Aprovado");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, "post_sale_records"), orderBy("createdAt", "desc")), snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Entry))), err => console.error("Erro ao carregar pós-venda:", err)), []);
  const visible = useMemo(() => entries.filter(e => (filter === "all" || e.kind === filter) && [e.customer, e.orderNumber, e.product, e.title].join(" ").toLowerCase().includes(search.toLowerCase())), [entries, filter, search]);
  const ratings = entries.filter(e => e.kind === "satisfaction" && e.rating);
  const average = ratings.length ? (ratings.reduce((sum, e) => sum + (e.rating || 0), 0) / ratings.length).toFixed(1) : "—";
  const reset = () => { setOpen(false); setCustomer(""); setOrderNumber(""); setProduct(""); setTitle(""); setStatus("Em andamento"); setRating(5); setSerialNumber(""); setInspection("Aprovado"); setNotes(""); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customer.trim() || !title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "post_sale_records"), { kind, customer: customer.trim(), orderNumber: orderNumber.trim(), product: product.trim(), title: title.trim(), status, rating: kind === "satisfaction" ? rating : null, serialNumber: kind === "quality_certificate" ? serialNumber.trim() : "", inspection: kind === "quality_certificate" ? inspection : "", notes: notes.trim(), createdAt: new Date().toISOString() });
      reset();
    } catch (error) { console.error(error); window.alert("Não foi possível salvar. Verifique as permissões do Firestore."); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Deseja excluir este registro?")) return;
    try { await deleteDoc(doc(db, "post_sale_records", id)); }
    catch (error) { console.error(error); window.alert("Não foi possível excluir o registro."); }
  };
  const printCertificate = (entry: Entry) => {
    const popup = window.open("", "_blank");
    if (!popup) { window.alert("Permita a abertura de janelas para imprimir."); return; }
    const value = (input: unknown) => escapeHtml(input);
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificado de Qualidade</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:36px;color:#172033;max-width:900px;margin:auto}
      header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #c6a45c;padding-bottom:18px}
      header img{width:116px;height:64px;object-fit:contain}h1{font-size:22px;margin:4px 0}p{line-height:1.55}
      .eyebrow{font-size:10px;letter-spacing:2px;color:#64748b;font-weight:700}.box{border:1px solid #cbd5e1;border-radius:12px;padding:22px;margin-top:26px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px}.field{padding:8px 0;border-bottom:1px solid #e2e8f0}
      footer{margin-top:62px;border-top:1px solid #cbd5e1;padding-top:18px;font-size:12px}
      @media print{body{padding:12mm}button{display:none}}
    </style></head><body>
      <header><img src="${logoImg}" alt="Anacleto Esquadrias"><div><div class="eyebrow">ANACLETO ESQUADRIAS · QUALIDADE</div><h1>CERTIFICADO DE QUALIDADE DO PRODUTO</h1><p>Registro de inspeção e conformidade</p></div></header>
      <section class="box"><div class="grid">
        <div class="field"><b>Cliente</b><br>${value(entry.customer)}</div>
        <div class="field"><b>Pedido / orçamento</b><br>${value(entry.orderNumber)}</div>
        <div class="field"><b>Produto</b><br>${value(entry.product || entry.title)}</div>
        <div class="field"><b>Identificação / série</b><br>${value(entry.serialNumber)}</div>
        <div class="field"><b>Resultado da inspeção</b><br>${value(entry.inspection)}</div>
        <div class="field"><b>Data</b><br>${value(new Date(entry.createdAt).toLocaleDateString("pt-BR"))}</div>
      </div><p><b>Observações:</b><br>${value(entry.notes)}</p></section>
      <footer><b>Responsável técnico:</b> ________________________________ &nbsp; <b>Assinatura:</b> ________________________________</footer>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    popup.document.close();
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Relacionamento com o cliente</p><h1 className="text-2xl font-black text-slate-900 dark:text-white">Pós-venda</h1><p className="mt-1 text-sm text-slate-500">Qualidade do produto, satisfação e continuidade do atendimento.</p></div>
      <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4"/> Novo registro</button>
    </header>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:"Certificados",value:entries.filter(e=>e.kind==="quality_certificate").length,icon:Award},{label:"Avaliações",value:ratings.length,icon:MessageSquareHeart},{label:"Atendimentos",value:entries.filter(e=>e.kind==="service").length,icon:Wrench},{label:"Média de satisfação",value:average+(average==="—"?"":"/5"),icon:ClipboardCheck}].map(card=><div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between text-xs font-semibold text-slate-500">{card.label}<card.icon className="h-5 w-5 text-blue-500"/></div><p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{card.value}</p></div>)}
    </div>
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{[{id:"all",label:"Todos"},{id:"quality_certificate",label:"Qualidade"},{id:"satisfaction",label:"Satisfação"},{id:"service",label:"Assistência"}].map(tab=><button key={tab.id} onClick={()=>setFilter(tab.id as "all"|Kind)} className={"rounded-xl px-3 py-2 text-xs font-bold "+(filter===tab.id?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>{tab.label}</button>)}</div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente, pedido ou produto" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 lg:w-72"/></div></div>
      {visible.length===0?<div className="py-12 text-center text-sm text-slate-500">Nenhum registro encontrado. Cadastre certificados, avaliações ou atendimentos.</div>:<div className="space-y-3">{visible.map(entry=><div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 md:flex-row md:items-center dark:border-slate-800"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950">{entry.kind==="quality_certificate"?<Award/>:entry.kind==="satisfaction"?<MessageSquareHeart/>:<Wrench/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-800 dark:text-white">{entry.title}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800">{labels[entry.kind]}</span></div><p className="mt-1 text-xs text-slate-500">{entry.customer} · {entry.orderNumber||"Sem pedido"} · {entry.product||"Produto não informado"}</p><p className="mt-1 text-xs text-slate-400">{entry.status} · {new Date(entry.createdAt).toLocaleDateString("pt-BR")}{entry.rating?" · "+entry.rating+"/5":""}</p>{entry.notes&&<p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{entry.notes}</p>}</div>{entry.kind==="quality_certificate"&&<button onClick={()=>printCertificate(entry)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700">Imprimir certificado</button>}<button onClick={()=>remove(entry.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>}
    </section>
    {open&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black dark:text-white">Novo registro de pós-venda</h2><p className="text-xs text-slate-500">Registre a experiência do cliente.</p></div><button type="button" onClick={reset} className="p-2 text-slate-400"><X/></button></div>
      <label className="block text-xs font-bold">Tipo de registro<select value={kind} onChange={e=>setKind(e.target.value as Kind)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="quality_certificate">Certificado de qualidade</option><option value="satisfaction">Pesquisa de satisfação</option><option value="service">Atendimento / assistência técnica</option></select></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[{label:"Cliente *",value:customer,set:setCustomer,required:true},{label:"Orçamento / pedido",value:orderNumber,set:setOrderNumber},{label:"Produto / serviço",value:product,set:setProduct},{label:"Título do registro *",value:title,set:setTitle,required:true}].map(field=><label key={field.label} className="text-xs font-bold">{field.label}<input required={!!field.required} value={field.value} onChange={e=>field.set(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></label>)}
      {kind==="quality_certificate"&&<><label className="text-xs font-bold">Número de série / identificação<input value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></label><label className="text-xs font-bold">Resultado da inspeção<select value={inspection} onChange={e=>setInspection(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option>Aprovado</option><option>Aprovado com ressalvas</option><option>Reprovado</option></select></label></>}
      {kind==="satisfaction"&&<label className="text-xs font-bold">Nota de satisfação<select value={rating} onChange={e=>setRating(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>}
      <label className="text-xs font-bold">Status<select value={status} onChange={e=>setStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">{["Em andamento","Concluído","Aguardando cliente","Requer retorno","Não conformidade"].map(s=><option key={s}>{s}</option>)}</select></label></div>
      <label className="block text-xs font-bold">Observações / comentários<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="Inspeções, feedback, reclamações, garantia, instalação ou providências..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={reset} className="rounded-xl border px-4 py-2 text-sm font-bold">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving?"Salvando...":"Salvar registro"}</button></div>
    </form></div>}
  </div>;
}
