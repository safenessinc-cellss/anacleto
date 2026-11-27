import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, startAfter, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { Invoice, Quote } from "../../types";
import { BarChart3, BriefcaseBusiness, Layers3, Plus, Trash2, Pencil, Save, UserRound, Lightbulb, TrendingUp, Wallet, FolderKanban, Paperclip } from "lucide-react";
import ProjectAssetsPanel from "../projects/ProjectAssetsPanel";
import ProjectIntakePanel from "../projects/ProjectIntakePanel";
import ProjectProductionWorkflow from "../projects/ProjectProductionWorkflow";

type RecordItem = { id: string; name: string; code?: string; category?: string; status?: string; notes?: string; client?: string; width?: number; height?: number; quantity?: number; quantityPending?: boolean; price?: number; createdAt?: string; updatedAt?: string };
type Props = { kind: "reports" | "tipologias" | "projects" | "profile" | "suggestions"; quotes?: Quote[]; invoices?: Invoice[] };
const money = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const collectionByKind = { tipologias:"tipologias", projects:"projects", suggestions:"user_suggestions" } as const;

export default function BusinessWorkspace({kind,quotes=[],invoices=[]}:Props) {
 const [rows,setRows]=useState<RecordItem[]>([]);
 const [uid,setUid]=useState("");
 const [email,setEmail]=useState("");
 const [name,setName]=useState("");
 const [phone,setPhone]=useState("");
 const [search,setSearch]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [expandedProject,setExpandedProject]=useState<string|null>(null);
 const [form,setForm]=useState({name:"",code:"",category:kind==="tipologias"?"Janela":"Projeto",status:"Em andamento",notes:"",client:"",width:"",height:"",quantity:"",price:""});
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [hasMore,setHasMore]=useState(false);
 const [loadingMore,setLoadingMore]=useState(false);
 const cursorRef=useRef<any>(null);
 const pagesLoadedRef=useRef(1);
 const hasMoreRef=useRef(false);
 const isRecord=kind==="tipologias"||kind==="projects"||kind==="suggestions";
 useEffect(()=>onAuthStateChanged(auth,u=>{setUid(u?.uid||"");setEmail(u?.email||"");setName(u?.displayName||"");}),[]);
 useEffect(()=>{
  if(!uid||!isRecord)return;
  const col=collectionByKind[kind as keyof typeof collectionByKind];
  cursorRef.current=null; pagesLoadedRef.current=1; hasMoreRef.current=false;
  setRows([]); setHasMore(false);
  const unsub=onSnapshot(query(collection(db,col),orderBy("createdAt","desc"),limit(500)),s=>{
    if(pagesLoadedRef.current===1){
      cursorRef.current=s.docs[s.docs.length-1]||null;
      hasMoreRef.current=s.size>=500;
      setHasMore(hasMoreRef.current);
    }
    const incoming=s.docs.map(d=>({id:d.id,...d.data()} as RecordItem));
    setRows(current=>{
      const merged=new Map(current.map(row=>[row.id,row]));
      incoming.forEach(row=>merged.set(row.id,row));
      return [...merged.values()].sort((a:any,b:any)=>{
        const date=(v:any)=>v?.toDate?v.toDate().getTime():new Date(v||0).getTime();
        return date(b.createdAt)-date(a.createdAt);
      });
    });
    setError("");
  },e=>setError("Não foi possível carregar os registros: "+e.message));
  return ()=>unsub();
 },[uid,kind]);
 const save=async()=>{
  if(!form.name.trim()){setError("Informe um nome ou título.");return;}
  setSaving(true);setError("");
  const payload={...form,width:Number(form.width)||0,height:Number(form.height)||0,quantity:Number(form.quantity)>0?Number(form.quantity):0,quantityPending:!(Number(form.quantity)>0),price:Number(form.price)>0?Number(form.price):0,ownerUid:uid,updatedAt:new Date().toISOString()};
  try{const col=collectionByKind[kind as keyof typeof collectionByKind]; if(editing)await updateDoc(doc(db,col,editing),payload);else await addDoc(collection(db,col),{...payload,createdAt:new Date().toISOString()});setEditing(null);setForm({name:"",code:"",category:kind==="tipologias"?"Janela":"Projeto",status:"Em andamento",notes:"",client:"",width:"",height:"",quantity:"",price:""});}
  catch(e){setError(e instanceof Error?e.message:"Falha ao salvar.");}finally{setSaving(false);}
 };
 const remove=async(id:string)=>{if(!confirm("Excluir este registro?"))return;try{await deleteDoc(doc(db,collectionByKind[kind as keyof typeof collectionByKind],id));setRows(current=>current.filter(row=>row.id!==id));}catch(e){setError(e instanceof Error?e.message:"Falha ao excluir.");}};
 const loadMore=async()=>{
  if(!hasMoreRef.current||!cursorRef.current||loadingMore)return;
  setLoadingMore(true);setError("");
  try{
   const col=collectionByKind[kind as keyof typeof collectionByKind];
   const snap=await getDocs(query(collection(db,col),orderBy("createdAt","desc"),startAfter(cursorRef.current),limit(500)));
   if(snap.docs.length){
    cursorRef.current=snap.docs[snap.docs.length-1];
    pagesLoadedRef.current+=1;
    const incoming=snap.docs.map(d=>({id:d.id,...d.data()} as RecordItem));
    setRows(current=>{
     const merged=new Map(current.map(row=>[row.id,row]));
     incoming.forEach(row=>merged.set(row.id,row));
     return [...merged.values()].sort((a:any,b:any)=>{
      const date=(v:any)=>v?.toDate?v.toDate().getTime():new Date(v||0).getTime();
      return date(b.createdAt)-date(a.createdAt);
     });
    });
   }
   hasMoreRef.current=snap.size>=500;
   setHasMore(hasMoreRef.current);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar mais registros.");}
  finally{setLoadingMore(false);}
 };
 const filtered=useMemo(()=>rows.filter(r=>[r.name,r.code,r.category,r.client,r.status].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))),[rows,search]);
 if(kind==="reports"){
  const invoiced=invoices.reduce((s,i)=>s+(Number(i.total)||0),0);
  const paid=invoices.filter(i=>i.status==="paid"||String(i.status)==="pago").reduce((s,i)=>s+(Number(i.total)||0),0);
  const openQuotes=quotes.filter(q=>!["rejected","invoiced"].includes(q.status)).reduce((s,q)=>s+(Number(q.total)||0),0);
  const expenses=invoices.reduce((s,i)=>s+(i.items||[]).reduce((a,x)=>a+(Number(x.quantity)||0)*(Number(x.unitPrice)||0),0),0);
  const margin=paid-expenses;
  return <section className="space-y-6"><header><p className="text-sm font-semibold text-blue-600">GESTÃO • INDICADORES</p><h1 className="text-3xl font-bold text-slate-900">Relatórios de Vendas e Custos</h1><p className="text-slate-500 mt-1">Indicadores calculados a partir dos orçamentos e das faturas cadastradas.</p></header>
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Vendas faturadas",value:money(invoiced),icon:TrendingUp},{label:"Valores recebidos",value:money(paid),icon:Wallet},{label:"Orçamentos em aberto",value:money(openQuotes),icon:BarChart3},{label:"Custos dos itens faturados",value:money(expenses),icon:Layers3}].map(c=><div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><c.icon className="h-5 w-5 text-blue-600"/><p className="mt-4 text-sm text-slate-500">{c.label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p></div>)}</div>
   <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-6"><h2 className="font-bold text-slate-900">Resumo financeiro</h2><div className="mt-5 flex justify-between border-b py-3"><span className="text-slate-500">Recebido</span><b>{money(paid)}</b></div><div className="flex justify-between border-b py-3"><span className="text-slate-500">Custo estimado dos itens</span><b>{money(expenses)}</b></div><div className="flex justify-between py-3"><span className="text-slate-500">Diferença estimada</span><b className={margin>=0?"text-emerald-600":"text-rose-600"}>{money(margin)}</b></div><p className="mt-3 text-xs text-slate-400">Estimativa simplificada: os itens das faturas são tratados como custo pelo preço unitário informado. Despesas operacionais, impostos e folha só entram quando lançados em seus módulos.</p></div><div className="rounded-2xl border bg-white p-6"><h2 className="font-bold text-slate-900">Documentos e conversão</h2><p className="mt-4 text-sm text-slate-500">{invoices.length} faturas • {quotes.length} orçamentos</p><p className="mt-2 text-sm text-slate-500">Taxa de faturamento sobre orçamentos ativos</p><p className="mt-1 text-3xl font-bold text-blue-600">{quotes.length?Math.round(invoices.length/quotes.length*100):0}%</p><p className="mt-3 text-xs text-slate-400">Indicador operacional, não representa margem contábil ou lucro líquido.</p></div></div></section>;
 }
 if(kind==="profile")return <section className="max-w-3xl space-y-6"><header><p className="text-sm font-semibold text-blue-600">CONTA</p><h1 className="text-3xl font-bold text-slate-900">Meu Perfil</h1><p className="text-slate-500">Informações da conta autenticada.</p></header><div className="rounded-2xl border bg-white p-6"><div className="flex items-center gap-4"><div className="rounded-2xl bg-blue-50 p-4 text-blue-600"><UserRound/></div><div><h2 className="font-bold text-slate-900">{name||"Usuário Anacleto"}</h2><p className="text-sm text-slate-500">{email}</p></div></div><label className="mt-6 block text-sm font-semibold text-slate-700">Nome de exibição</label><input value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border p-3"/><label className="mt-4 block text-sm font-semibold text-slate-700">Telefone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(00) 00000-0000" className="mt-2 w-full rounded-xl border p-3"/><button onClick={async()=>{try{await setDoc(doc(db,"user_profiles",uid),{name,phone,email,updatedAt:new Date().toISOString()},{merge:true});alert("Perfil atualizado.");}catch(e){setError("Crie o perfil ao salvar: "+(e instanceof Error?e.message:"erro"));}}} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Salvar perfil</button><p className="mt-3 text-xs text-slate-400">O e-mail é fornecido pelo login e não é alterado aqui.</p>{error&&<p className="mt-3 text-sm text-rose-600">{error}</p>}</div></section>;
 const title=kind==="tipologias"?"Tipologias":"Projetos";
 const subtitle=kind==="tipologias"?"Biblioteca de modelos e tipologias de esquadrias, com dimensões e materiais.":kind==="projects"?"Acompanhe projetos, clientes, dimensões, quantidades e valores previstos.":"Envie ideias e melhorias para a equipe Anacleto.";
 return <section className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-blue-600">CADASTROS E OPERAÇÃO</p><h1 className="text-3xl font-bold text-slate-900">{kind==="suggestions"?"Sugestões":title}</h1><p className="mt-1 text-slate-500">{subtitle}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{rows.length} registros</span></header>{hasMore&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Há registros anteriores. Carregue mais para consultar o histórico completo.</p>}
 {kind==="projects"&&<ProjectIntakePanel onCreated={id=>setExpandedProject(id)}/>}
 <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]"><div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">{editing?"Editar registro":kind==="suggestions"?"Nova sugestão":"Novo registro"}</h2><div className="mt-4 space-y-3"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={kind==="suggestions"?"Título da sugestão":"Nome / título"} className="w-full rounded-xl border p-3"/>{kind!=="suggestions"&&<><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="Código (opcional)" className="w-full rounded-xl border p-3"/><input value={form.client} onChange={e=>setForm({...form,client:e.target.value})} placeholder="Cliente / referência" className="w-full rounded-xl border p-3"/><div className="grid grid-cols-2 gap-3"><input type="number" value={form.width} onChange={e=>setForm({...form,width:e.target.value})} placeholder="Largura (mm)" className="w-full rounded-xl border p-3"/><input type="number" value={form.height} onChange={e=>setForm({...form,height:e.target.value})} placeholder="Altura (mm)" className="w-full rounded-xl border p-3"/><input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="Quantidade" className="w-full rounded-xl border p-3"/><input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Valor previsto (R$)" className="w-full rounded-xl border p-3"/></div></>}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full rounded-xl border p-3"><option>Em andamento</option><option>Em análise</option><option>Aprovado</option><option>Concluído</option><option>Arquivado</option></select><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder={kind==="suggestions"?"Descreva sua ideia ou melhoria":"Descrição, materiais e observações"} rows={4} className="w-full rounded-xl border p-3"/><button disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Salvando...":"Salvar"}</button>{error&&<p className="text-sm text-rose-600">{error}</p>}</div></div>
 <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">Registros salvos</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="max-w-48 rounded-lg border p-2 text-sm"/></div><div className="mt-4 space-y-3">{filtered.map(r=><article key={r.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-slate-900">{r.name}</h3><p className="text-xs text-slate-500">{[r.code,r.client,r.category,r.status].filter(Boolean).join(" • ")}</p>{(r.width||r.height)&&<p className="mt-2 text-xs text-slate-500">{r.width||0} × {r.height||0} mm • {r.quantityPending?"Quantidade pendente":(r.quantity||"Quantidade pendente")} • {money(Number(r.price)||0)}</p>}{kind==="projects"&&r.quantityPending&&!(r.width||r.height)&&<p className="mt-2 text-xs font-medium text-amber-700">Quantidade e medição ainda não confirmadas.</p>}<p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{r.notes}</p>
{kind==="projects"&&(((r as any).workItems?.length)||((r as any).pendingQuestions?.length)||(r as any).visitRequired)&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
  <b>Escopo e avaliação do projeto</b>
  {(r as any).visitRequired&&<p className="mt-1"><b>Visita técnica pendente:</b> {(r as any).visitReason||"Avaliação presencial necessária."}</p>}
  {!!(r as any).workItems?.length&&<ul className="mt-2 list-disc space-y-1 pl-5">{(r as any).workItems.map((item:any,index:number)=><li key={index}><b>{item.title||item.category||"Serviço"}:</b> {item.description||"Descrição pendente"}{item.measurementPending?" · quantidade/medição pendente":item.quantity>0?(" · "+item.quantity+" "+(item.unit||"un.")):""}</li>)}</ul>}
  {!!(r as any).pendingQuestions?.length&&<div className="mt-2"><b>Informações necessárias:</b><ul className="list-disc pl-5">{(r as any).pendingQuestions.map((q:string,index:number)=><li key={index}>{q}</li>)}</ul></div>}
  {!!(r as any).assumptions?.length&&<div className="mt-2"><b>Hipóteses não confirmadas:</b><ul className="list-disc pl-5">{(r as any).assumptions.map((a:string,index:number)=><li key={index}>{a}</li>)}</ul></div>}
</div>}</div><div className="flex gap-1">{kind==="projects"&&<button onClick={()=>setExpandedProject(expandedProject===r.id?null:r.id)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" title="Arquivos e desenhos do projeto"><Paperclip className="h-4 w-4"/></button>}<button onClick={()=>{setEditing(r.id);setForm({name:r.name||"",code:r.code||"",category:r.category||"Janela",status:r.status||"Em andamento",notes:r.notes||"",client:r.client||"",width:String(r.width||""),height:String(r.height||""),quantity:String(r.quantity??""),price:String(r.price||0)});}} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(r.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button></div></div>{kind==="projects"&&expandedProject===r.id&&<><ProjectAssetsPanel projectId={r.id} projectName={r.name} assets={(r as any).assets||[]}/><ProjectProductionWorkflow projectId={r.id} projectName={r.name} projectNotes={[r.notes||"",Array.isArray((r as any).workItems)? "Escopo identificado: "+JSON.stringify((r as any).workItems):"",Array.isArray((r as any).pendingQuestions)? "Perguntas pendentes: "+(r as any).pendingQuestions.join("; "):"", (r as any).visitRequired?"Visita técnica pendente: "+String((r as any).visitReason||""): ""].filter(Boolean).join("\n\n")} assets={(r as any).assets||[]}/></>}</article>)}{!filtered.length&&<p className="py-10 text-center text-sm text-slate-400">Nenhum registro encontrado.</p>}</div>{hasMore&&<div className="mt-4 flex justify-center"><button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-lg border px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{loadingMore?"Carregando...":"Carregar mais registros"}</button></div>}</div></div></section>;
}
