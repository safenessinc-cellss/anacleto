import React,{useEffect,useMemo,useState} from "react";
import {addDoc,collection,doc,getDocs,onSnapshot,query,updateDoc,where} from "firebase/firestore";
import {onAuthStateChanged} from "firebase/auth";
import Papa from "papaparse";
import {auth,db} from "../../firebase";
import {Bell,CalendarClock,FileUp,History,Plus,Search,Tags,RefreshCw,CheckCircle2,AlertTriangle} from "lucide-react";

type PriceItem={id:string;name:string;code?:string;category?:string;unit?:string;price?:number;priceValidUntil?:string;priceUpdatedAt?:string;priceSource?:string;priceSupplier?:string;status?:string;sourceCollection?:string;sourceItemId?:string};
type Notice={id:string;title:string;message:string;createdAt:string;read?:boolean;type?:string};
const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const keyOf=(r:any)=>r.code? "code:"+norm(r.code):"name:"+norm(r.name)+"|"+norm(r.category)+"|"+norm(r.unit);
const parsePrice=(v:unknown)=>{const s=String(v??"0").replace(/R\$\s?/gi,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,"");return Math.max(0,Number.parseFloat(s)||0);};
const money=(n:number)=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function PriceTableModule(){
 const [collectionRows,setCollectionRows]=useState<Record<string,PriceItem[]>>({});const [uid,setUid]=useState("");const [email,setEmail]=useState("");const [search,setSearch]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [alerts,setAlerts]=useState<Notice[]>([]);
 const [form,setForm]=useState({name:"",code:"",category:"Vidro",unit:"m²",price:"",supplier:"",validUntil:"",source:"Cadastro manual"});
 useEffect(()=>onAuthStateChanged(auth,u=>{setUid(u?.uid||"");setEmail(u?.email?.toLowerCase()||"");}),[]);
 useEffect(()=>{if(!uid)return;const names=["price_table","registry_items","supplier_catalog","catalog"];const unsubs=names.map(name=>onSnapshot(collection(db,name),s=>setCollectionRows(current=>({...current,[name]:s.docs.map(d=>({id:d.id,sourceCollection:name,sourceItemId:d.id,...d.data()} as PriceItem))})),e=>setError("Falha ao carregar "+name+": "+e.message)));return()=>unsubs.forEach(unsub=>unsub());},[uid]);
 const items=useMemo(()=>{const map=new Map<string,PriceItem>();for(const name of ["price_table","registry_items","supplier_catalog","catalog"]){for(const item of collectionRows[name]||[]){const key=keyOf(item);if(!map.has(key))map.set(key,item);}}return Array.from(map.values());},[collectionRows]);
 useEffect(()=>{if(!email)return;return onSnapshot(query(collection(db,"notifications"),where("targetEmail","==",email)),s=>setAlerts(s.docs.map(d=>({id:d.id,...d.data()} as Notice)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))),()=>{});},[email]);
 const today=new Date().toISOString().slice(0,10);const expiring=useMemo(()=>items.filter(i=>i.priceValidUntil&&i.priceValidUntil>=today&&i.priceValidUntil<=new Date(Date.now()+15*86400000).toISOString().slice(0,10)),[items,today]);
 const filtered=useMemo(()=>items.filter(i=>[i.name,i.code,i.category,i.priceSupplier].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))),[items,search]);
 const savePrice=async()=>{
  if(!form.name.trim()||Number(form.price)<0||!form.price){setError("Informe item e preço válido.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const candidate={name:form.name,code:form.code,category:form.category,unit:form.unit};
   const sources=["price_table","registry_items","supplier_catalog","catalog"];const snapshots=await Promise.all(sources.map(name=>getDocs(collection(db,name))));
   let existing:{collection:string;id:string;data:any}|undefined;for(let i=0;i<snapshots.length&&!existing;i++){const found=snapshots[i].docs.find(d=>keyOf(d.data())===keyOf(candidate));if(found)existing={collection:sources[i],id:found.id,data:found.data()};}
   const now=new Date().toISOString();const price=Number(form.price);
   if(existing){const old=existing.data();await updateDoc(doc(db,"price_table",existing.id),{price,priceUpdatedAt:now,priceValidUntil:form.validUntil||"",priceSource:form.source,priceSupplier:form.supplier,updatedAt:now});await addDoc(collection(db,"price_history"),{itemId:existing.id,itemName:old.name,oldPrice:Number(old.price)||0,newPrice:price,source:form.source,supplier:form.supplier,validUntil:form.validUntil||"",changedAt:now,changedBy:uid});setNotice("Preço atualizado. O cadastro do item foi preservado.");}
   else{const created=await addDoc(collection(db,"price_table"),{...candidate,price,priceUpdatedAt:now,priceValidUntil:form.validUntil||"",priceSource:form.source,priceSupplier:form.supplier,status:"Ativo",createdAt:now,updatedAt:now});await addDoc(collection(db,"price_history"),{itemId:created.id,itemName:form.name,oldPrice:0,newPrice:price,source:form.source,supplier:form.supplier,validUntil:form.validUntil||"",changedAt:now,changedBy:uid});setNotice("Novo item incluído na tabela de preços.");}
   setForm({name:"",code:"",category:"Vidro",unit:"m²",price:"",supplier:"",validUntil:"",source:"Cadastro manual"});
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar o preço.");}finally{setBusy(false);}
 };
 const importCsv=(file?:File)=>{
  if(!file)return;setBusy(true);setError("");setNotice("");
  Papa.parse<Record<string,string>>(file,{header:true,skipEmptyLines:true,complete:async result=>{
   const rows=result.data.map(raw=>{const r:Record<string,string>={};Object.entries(raw).forEach(([k,v])=>r[norm(k)]=String(v??"").trim());return{name:r.nome||r.descricao||r.item||r.name||r.description||"",code:r.codigo||r.cod||r.code||r.sku||"",category:r.categoria||r.tipo||r.category||"Componente",unit:r.unidade||r.unit||"un",price:parsePrice(r.preco||r.valor||r.price),supplier:r.fornecedor||r.supplier||"",validUntil:r.validade||r.vencimento||r.validuntil||"",source:file.name};}).filter(r=>r.name);
   if(!rows.length){setError("CSV sem itens válidos. Esperado: nome, código, categoria, unidade, preço e validade.");setBusy(false);return;}
   try{
    const [priceSnap,registrySnap,supplierSnap,catalogSnap]=await Promise.all(["price_table","registry_items","supplier_catalog","catalog"].map(c=>getDocs(collection(db,c))));
    const collections=[{name:"price_table",snap:priceSnap},{name:"registry_items",snap:registrySnap},{name:"supplier_catalog",snap:supplierSnap},{name:"catalog",snap:catalogSnap}];
    const index=new Map<string,{collection:string;id:string;data:any}>();
    for(const group of collections)for(const d of group.snap.docs){const data=d.data();const k=keyOf(data);if(!index.has(k))index.set(k,{collection:group.name,id:d.id,data});}
    const seen=new Set<string>();let updated=0,created=0,skipped=0;
    for(const row of rows){
     const key=keyOf(row);if(seen.has(key)){skipped++;continue;}seen.add(key);
     const match=index.get(key);const now=new Date().toISOString();const price=row.price;
     if(match){
      await updateDoc(doc(db,match.collection,match.id),{price,priceUpdatedAt:now,priceValidUntil:row.validUntil||"",priceSource:row.source,priceSupplier:row.supplier,updatedAt:now});
      await addDoc(collection(db,"price_history"),{itemId:match.id,itemCollection:match.collection,itemName:match.data.name||row.name,oldPrice:Number(match.data.price)||0,newPrice:price,source:row.source,supplier:row.supplier,validUntil:row.validUntil||"",changedAt:now,changedBy:uid});
      updated++;
     }else{
      const createdDoc=await addDoc(collection(db,"price_table"),{...row,price,priceUpdatedAt:now,priceValidUntil:row.validUntil||"",priceSource:row.source,priceSupplier:row.supplier,status:"Ativo",createdAt:now,updatedAt:now});
      await addDoc(collection(db,"price_history"),{itemId:createdDoc.id,itemName:row.name,oldPrice:0,newPrice:price,source:row.source,supplier:row.supplier,validUntil:row.validUntil||"",changedAt:now,changedBy:uid});created++;
     }
    }
    setNotice("Importação concluída: "+updated+" preços atualizados, "+created+" itens novos, "+skipped+" duplicados no arquivo ignorados. Descrições e códigos existentes foram preservados.");
   }catch(e){setError(e instanceof Error?e.message:"Falha na comparação/importação do CSV.");}
   finally{setBusy(false);}
  },error:()=>{setError("Não foi possível ler o CSV.");setBusy(false);}});
 };
 const markRead=async(n:Notice)=>{try{await updateDoc(doc(db,"notifications",n.id),{read:true,readAt:new Date().toISOString()});}catch(e){setError(e instanceof Error?e.message:"Não foi possível marcar o aviso.");}};
 return <section className="space-y-5 text-slate-900">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Suprimentos • custos</p><h2 className="text-2xl font-black">Tabela de Preços</h2><p className="text-sm text-slate-500">Vidros, perfis, ferragens, acessórios e demais componentes. Histórico e validade de cada preço.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><FileUp className="h-4 w-4"/> Importar tabela CSV<input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={e=>{importCsv(e.target.files?.[0]);e.target.value="";}}/></label></header>
  {alerts.filter(n=>!n.read).slice(0,5).map(n=><div key={n.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><Bell className="mt-0.5 h-4 w-4 text-amber-700"/><div className="min-w-0 flex-1"><b className="text-sm text-amber-900">{n.title}</b><p className="text-sm text-amber-800">{n.message}</p></div><button onClick={()=>markRead(n)} className="text-xs font-bold text-amber-800">Lido</button></div>)}
  {expiring.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle className="h-4 w-4"/> {expiring.length} preço(s) vencem nos próximos 15 dias</p><p className="mt-1 text-sm text-amber-800">{expiring.map(x=>x.name+" ("+x.priceValidUntil+")").join(" • ")}</p></div>}
  {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <div className="grid gap-4 xl:grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)]">
   <div className="rounded-2xl border bg-white p-4"><h3 className="flex items-center gap-2 font-bold"><Plus className="h-4 w-4"/> Atualizar ou incluir preço</h3><p className="my-2 text-xs text-slate-500">Se o item já existir, apenas os campos de preço/validade serão atualizados; o cadastro não será duplicado.</p><div className="space-y-2"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome do vidro ou componente" className="w-full rounded-lg border p-2.5 text-sm"/><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="Código / SKU (preferencial)" className="w-full rounded-lg border p-2.5 text-sm"/><div className="grid grid-cols-2 gap-2"><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Categoria" className="w-full rounded-lg border p-2.5 text-sm"/><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="Unidade (m², barra...)" className="w-full rounded-lg border p-2.5 text-sm"/></div><input type="number" min="0" step=".01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Preço em R$" className="w-full rounded-lg border p-2.5 text-sm"/><input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} placeholder="Fornecedor / tabela de origem" className="w-full rounded-lg border p-2.5 text-sm"/><label className="block text-xs font-semibold text-slate-500">Preço válido até<input type="date" value={form.validUntil} onChange={e=>setForm({...form,validUntil:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label><input value={form.source} onChange={e=>setForm({...form,source:e.target.value})} placeholder="Origem / nome da tabela" className="w-full rounded-lg border p-2.5 text-sm"/><button disabled={busy} onClick={savePrice} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Processando...":"Salvar preço sem duplicar item"}</button></div></div>
   <div className="min-w-0 rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Itens e preços ({filtered.length})</h3><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar item, SKU, fornecedor" className="rounded-lg border py-2 pl-9 pr-3 text-sm"/></div></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Item</th><th className="p-3">Categoria</th><th className="p-3">Un.</th><th className="p-3">Preço</th><th className="p-3">Fornecedor / origem</th><th className="p-3">Validade</th></tr></thead><tbody>{filtered.map(i=><tr key={i.id} className="border-t"><td className="p-3 font-mono text-xs">{i.code||"—"}</td><td className="p-3 font-semibold">{i.name}</td><td className="p-3">{i.category||"—"}</td><td className="p-3">{i.unit||"—"}</td><td className="p-3 font-bold">{money(Number(i.price)||0)}</td><td className="p-3">{i.priceSupplier||i.priceSource||"—"}</td><td className="p-3">{i.priceValidUntil||"Sem validade"}</td></tr>)}</tbody></table>{!filtered.length&&<p className="p-8 text-center text-sm text-slate-500">Nenhum item cadastrado na tabela.</p>}</div></div>
  </div>
  <div className="rounded-xl border bg-slate-50 p-4"><h3 className="flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4"/> Rotina mensal e notificações</h3><p className="mt-2 text-sm text-slate-600">A rotina de revisão está prevista para o primeiro dia de cada mês. O sistema deve avisar sobre preços que vencem em até 15 dias; a atualização dos valores é feita por importação da tabela vigente ou lançamento confirmado do fornecedor. O sistema não inventa nem raspa preços sem fonte.</p><p className="mt-2 text-xs text-slate-500">Última atualização visível: {items.reduce((latest,item)=>String(item.priceUpdatedAt||"")>latest?String(item.priceUpdatedAt):latest,"—")}</p></div>
 </section>;
}
