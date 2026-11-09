import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Download, FileText, Printer, TrendingDown, TrendingUp } from "lucide-react";

type Row = { id: string; date: string; description: string; category: string; party: string; direction: "in" | "out"; amount: number; status: string; source: string; sourceId?: string; };
const today = new Date().toISOString().slice(0,10);
const monthStart = today.slice(0,8) + "01";
const money = (n:number) => Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateOf = (v:any) => {
  if (typeof v === "string") return v.slice(0,10);
  if (v?.toDate) return v.toDate().toISOString().slice(0,10);
  if (typeof v === "number") return new Date(v).toISOString().slice(0,10);
  return "";
};
function normalize(id:string,d:any,source:string):Row|null {
  if (source === "payables" && d.status !== "pending") return null;
  const rawAmount = source === "receivables" ? Number(d.receivedAmount || 0) : Number(d.amount ?? d.total ?? d.value ?? 0);
  const amount = rawAmount;
  if(!Number.isFinite(amount)||amount===0) return null;
  const date=dateOf(d.date || d.paidAt || d.paymentDate || d.dueDate || d.createdAt || d.updatedAt);
  const isIn = source==="receivables" || d.direction==="inflow" || d.direction==="in" || source==="employee_payments" && false;
  const isOut = source==="payables" || source==="purchases" || source==="employee_payments" || source==="payments" || d.direction==="outflow" || d.direction==="out";
  return {
    id, date, description:String(d.description || d.payableDescription || d.employeeName && "Pagamento de funcionário: "+d.employeeName || d.category || source),
    category:String(d.expenseCategory || d.category || source), party:String(d.supplierName || d.clientName || d.employeeName || d.name || "—"),
    direction:isIn?"in":isOut?"out":d.direction==="in"?"in":"out",
    amount, status:String(d.status || "registrado"), source
  };
}
export default function FinancialReportsModule(){
  const [records,setRecords]=useState<Row[]>([]);
  const [from,setFrom]=useState(monthStart);
  const [to,setTo]=useState(today);
  const [kind,setKind]=useState("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const sources=["ledger_entries","payables","payments","receivables","purchases","employee_payments"];
    const stops=sources.map(source=>onSnapshot(collection(db,source),snap=>{
      const rows=snap.docs.map(doc=>normalize(doc.id,doc.data(),source)).filter((x):x is Row=>!!x);
      setRecords(current=>[...current.filter(x=>x.source!==source),...rows]);
      setLoading(false);
    },err=>{setError("Não foi possível consultar "+source+": "+err.message);setLoading(false);}));
    return ()=>stops.forEach(stop=>stop());
  },[]);
  const filtered=useMemo(()=>records.filter(r=>!!r.date && r.date>=from && r.date<=to && (kind==="all" || r.direction===kind) && !((r.source==="receivables" || r.source==="payments") && records.some(x=>x.source==="ledger_entries" && !!r.sourceId && x.sourceId===r.sourceId))),[records,from,to,kind]);
  const incoming=filtered.filter(r=>r.direction==="in").reduce((s,r)=>s+r.amount,0);
  const outgoing=filtered.filter(r=>r.direction==="out").reduce((s,r)=>s+r.amount,0);
  const download=()=>{
    const rows=[["Data","Tipo","Categoria","Descrição","Cliente/Fornecedor/Funcionário","Valor","Status","Origem"],...filtered.map(r=>[r.date,r.direction==="in"?"Entrada":"Saída",r.category,r.description,r.party,String(r.amount.toFixed(2)),r.status,r.source])];
    const csv="\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    const a=document.createElement("a");a.href=url;a.download="relatorio-financeiro-"+from+"-a-"+to+".csv";a.click();URL.revokeObjectURL(url);
  };
  return <div className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Análise financeira</p><h2 className="text-2xl font-black">Relatórios financeiros</h2><p className="text-sm text-slate-500">Gere um relatório quando precisar, selecionando o período e o tipo de movimentação. Os dados são consolidados dos registros do Financeiro.</p></header>
    {error&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
    <div className="grid gap-3 rounded-2xl border bg-white p-4 dark:bg-slate-900 sm:grid-cols-4">
      <label className="text-xs font-semibold text-slate-500">Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Data final<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Movimentação<select value={kind} onChange={e=>setKind(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="all">Entradas e saídas</option><option value="in">Somente entradas</option><option value="out">Somente saídas</option></select></label>
      <div className="flex items-end gap-2"><button onClick={()=>window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold"><Printer className="h-4 w-4"/> Imprimir / PDF</button><button onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white"><Download className="h-4 w-4"/> CSV</button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><TrendingUp className="mb-2 text-emerald-600"/><p className="text-xs text-slate-500">Total de entradas</p><strong className="text-xl">{money(incoming)}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><TrendingDown className="mb-2 text-rose-600"/><p className="text-xs text-slate-500">Total de saídas</p><strong className="text-xl">{money(outgoing)}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><FileText className="mb-2 text-blue-600"/><p className="text-xs text-slate-500">Saldo do período</p><strong className="text-xl">{money(incoming-outgoing)}</strong></div>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4 dark:border-slate-700"><h3 className="font-bold">Movimentações do relatório</h3><span className="text-xs text-slate-500">{loading?"Carregando dados...":filtered.length+" registros · "+from+" a "+to}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Data</th><th className="p-3">Tipo</th><th className="p-3">Categoria</th><th className="p-3">Descrição</th><th className="p-3">Parte relacionada</th><th className="p-3 text-right">Valor</th><th className="p-3">Status</th></tr></thead><tbody>{filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(r=><tr key={r.source+"-"+r.id} className="border-t dark:border-slate-700"><td className="p-3">{r.date||"—"}</td><td className="p-3">{r.direction==="in"?"Entrada":"Saída"}</td><td className="p-3">{r.category}</td><td className="p-3">{r.description}</td><td className="p-3">{r.party}</td><td className="p-3 text-right font-bold">{money(r.amount)}</td><td className="p-3">{r.status}</td></tr>)}{!filtered.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading?"Carregando...":"Nenhum lançamento encontrado para o período."}</td></tr>}</tbody></table></div>
    </section>
    <style>{`@media print { button, input, select { display:none !important; } body { background:white !important; } }`}</style>
  </div>;
}
