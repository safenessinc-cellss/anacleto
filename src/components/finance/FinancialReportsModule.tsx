import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Download, Printer, TrendingDown, TrendingUp, Wallet, Clock, FileText } from "lucide-react";
import { jsPDF } from "jspdf";

type ModuleName = "Caixa" | "Vendas" | "Compras" | "Folha" | "Contas a receber" | "Contas a pagar";
type Row = {
  id: string; date: string; description: string; category: string; party: string;
  direction: "in" | "out"; amount: number; status: string; source: string;
  kind: "cash" | "receivable" | "payable" | "purchase"; module: ModuleName;
};
const today = new Date().toISOString().slice(0,10);
const monthStart = today.slice(0,8) + "01";
const money = (n:number) => Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateOf = (v:any):string => {
  if (typeof v === "string") return v.slice(0,10);
  if (v?.toDate) return v.toDate().toISOString().slice(0,10);
  if (typeof v === "number") return new Date(v).toISOString().slice(0,10);
  return "";
};
const amountOf = (d:any) => {
  const n=Number(d.amount ?? d.total ?? d.value ?? 0);
  return Number.isFinite(n) ? Math.max(0,n) : 0;
};
function normalizeLedger(id:string,d:any):Row|null {
  const amount=amountOf(d);
  const date=dateOf(d.date || d.paidAt || d.paymentDate || d.createdAt);
  if(!amount || !date || ["void","cancelled","cancelado","estornado"].includes(String(d.status||"").toLowerCase())) return null;
  const dir=String(d.direction||d.type||"").toLowerCase();
  const direction: "in"|"out" = ["in","inflow","income","entrada","income"].includes(dir) ? "in" : "out";
  const category=String(d.category||"Não categorizado");
  const module:ModuleName=/sale|venda|receiv/i.test(category+" "+String(d.sourceType||"")) ? "Vendas" : /payroll|employee|folha/i.test(category+" "+String(d.sourceType||"")) ? "Folha" : "Caixa";
  return {id,date,description:String(d.description||category||"Lançamento financeiro"),category,party:String(d.clientName||d.supplierName||d.employeeName||d.party||"—"),direction,amount,status:String(d.status||"registrado"),source:"ledger_entries",kind:"cash",module};
}
function normalizeEmployeePayment(id:string,d:any):Row|null {
  const amount=amountOf(d), date=dateOf(d.paymentDate||d.paidAt||d.createdAt);
  if(!amount||!date||["cancelled","cancelado","void"].includes(String(d.status||"").toLowerCase())) return null;
  return {id,date,description:String(d.notes||"Pagamento de funcionário"),category:"Folha de pagamento",party:String(d.employeeName||"Funcionário"),direction:"out",amount,status:String(d.status||"paid"),source:"employee_payments",kind:"cash",module:"Folha"};
}
function normalizeOpen(id:string,d:any,source:"receivables"|"payables"):Row|null {
  const status=String(d.status||"pending").toLowerCase();
  const active=source==="receivables" ? !["received","paid","pago","cancelled","cancelado"].includes(status) : ["pending","pendente","overdue","vencido","pending_approval"].includes(status);
  if(!active) return null;
  const total=amountOf(d);
  const received=source==="receivables" ? Math.min(total,Math.max(0,Number(d.receivedAmount||0))) : 0;
  const amount=source==="receivables" ? Math.max(0,total-received) : total;
  const date=dateOf(d.dueDate||d.date||d.createdAt);
  if(!amount || !date) return null;
  return {id,date,description:String(d.description||d.payableDescription||(source==="receivables"?"Conta a receber":"Conta a pagar")),category:source==="receivables"?"Contas a receber":"Contas a pagar",party:String(d.clientName||d.supplierName||d.employeeName||"—"),direction:source==="receivables"?"in":"out",amount,status,source,kind:source==="receivables"?"receivable":"payable",module:source==="receivables"?"Contas a receber":"Contas a pagar"};
}
function normalizePurchase(id:string,d:any):Row|null {
  const status=String(d.status||"pending").toLowerCase();
  if(["cancelled","cancelado","rejected","rejeitado"].includes(status)) return null;
  const amount=amountOf(d), date=dateOf(d.issueDate||d.createdAt);
  if(!amount||!date) return null;
  return {id,date,description:"Nota fiscal "+String(d.documentNumber||d.number||"de compra")+" · "+String(d.description||"Compra registrada"),category:String(d.expenseCategory||"Compras"),party:String(d.supplierName||"Fornecedor"),direction:"out",amount,status,source:"purchase_orders",kind:"purchase",module:"Compras"};
}
export default function FinancialReportsModule(){
  const [records,setRecords]=useState<Row[]>([]);
  const [from,setFrom]=useState(monthStart);
  const [to,setTo]=useState(today);
  const [direction,setDirection]=useState("all");
  const [module,setModule]=useState("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const stops=[
      onSnapshot(collection(db,"ledger_entries"),snap=>{const rows=snap.docs.map(d=>normalizeLedger(d.id,d.data())).filter((x):x is Row=>!!x);setRecords(c=>[...c.filter(x=>x.source!=="ledger_entries"),...rows]);setLoading(false);},err=>{setError("Falha ao carregar caixa: "+err.message);setLoading(false);}),
      onSnapshot(collection(db,"receivables"),snap=>{const rows=snap.docs.map(d=>normalizeOpen(d.id,d.data(),"receivables")).filter((x):x is Row=>!!x);setRecords(c=>[...c.filter(x=>x.source!=="receivables"),...rows]);setLoading(false);},err=>{setError("Falha ao carregar recebíveis: "+err.message);setLoading(false);}),
      onSnapshot(collection(db,"payables"),snap=>{const rows=snap.docs.map(d=>normalizeOpen(d.id,d.data(),"payables")).filter((x):x is Row=>!!x);setRecords(c=>[...c.filter(x=>x.source!=="payables"),...rows]);setLoading(false);},err=>{setError("Falha ao carregar contas a pagar: "+err.message);setLoading(false);}),
      onSnapshot(collection(db,"employee_payments"),snap=>{const rows=snap.docs.map(d=>normalizeEmployeePayment(d.id,d.data())).filter((x):x is Row=>!!x);setRecords(c=>[...c.filter(x=>x.source!=="employee_payments"),...rows]);setLoading(false);},err=>{setError("Falha ao carregar folha: "+err.message);setLoading(false);}),
      onSnapshot(collection(db,"purchase_orders"),snap=>{const rows=snap.docs.map(d=>normalizePurchase(d.id,d.data())).filter((x):x is Row=>!!x);setRecords(c=>[...c.filter(x=>x.source!=="purchase_orders"),...rows]);setLoading(false);},err=>{setError("Falha ao carregar notas fiscais de compra: "+err.message);setLoading(false);})
    ];
    return ()=>stops.forEach(stop=>stop());
  },[]);
  const filtered=useMemo(()=>records.filter(r=>r.date>=from&&r.date<=to&&(direction==="all"||r.direction===direction)&&(module==="all"||r.module===module)),[records,from,to,direction,module]);
  const cash=filtered.filter(r=>r.kind==="cash");
  const incoming=cash.filter(r=>r.direction==="in").reduce((s,r)=>s+r.amount,0);
  const outgoing=cash.filter(r=>r.direction==="out").reduce((s,r)=>s+r.amount,0);
  const openReceivables=filtered.filter(r=>r.kind==="receivable").reduce((s,r)=>s+r.amount,0);
  const openPayables=filtered.filter(r=>r.kind==="payable").reduce((s,r)=>s+r.amount,0);
  const purchaseTotal=filtered.filter(r=>r.kind==="purchase").reduce((s,r)=>s+r.amount,0);
  const download=()=>{
    const rows=[["Data","Módulo","Natureza","Tipo","Categoria","Descrição","Cliente/Fornecedor","Valor","Status","Fonte"],...filtered.map(r=>[r.date,r.module,r.kind==="cash"?"Fluxo de caixa":r.kind==="receivable"?"Em aberto a receber":r.kind==="payable"?"Em aberto a pagar":"Nota fiscal registrada (não é pagamento)",r.direction==="in"?"Entrada":"Saída",r.category,r.description,r.party,String(r.amount.toFixed(2)),r.status,r.source])];
    const csv="\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    const a=document.createElement("a");a.href=url;a.download="relatorio-financeiro-"+from+"-a-"+to+".csv";a.click();URL.revokeObjectURL(url);
  };
  const exportPdf=()=>{
    const pdf=new jsPDF({orientation:"landscape"});
    pdf.setFontSize(18);pdf.text("Relatório Financeiro · Anacleto",14,18);
    pdf.setFontSize(10);pdf.text(`Período: ${from} a ${to} · Registros: ${filtered.length}`,14,26);
    pdf.text(`Entradas em caixa: ${money(incoming)} · Saídas: ${money(outgoing)} · Saldo: ${money(incoming-outgoing)}`,14,33);
    let y=45;
    const header=["Data","Módulo","Natureza","Descrição / parte","Cliente / fornecedor","Valor","Status"];
    const widths=[22,28,30,73,45,28,30];
    const drawRow=(values:string[],bold=false)=>{
      let x=14;let maxHeight=5;
      const wrapped=values.map((value,index)=>pdf.splitTextToSize(value,widths[index]-2));
      maxHeight=Math.max(5,...wrapped.map(lines=>lines.length*4.5));
      if(y+maxHeight>195){pdf.addPage();y=18;}
      pdf.setFont("helvetica",bold?"bold":"normal");
      wrapped.forEach((lines,index)=>{pdf.text(lines,x+1,y+4);x+=widths[index];});
      pdf.setDrawColor(220);pdf.line(14,y+maxHeight,270,y+maxHeight);y+=maxHeight;
    };
    drawRow(header,true);
    filtered.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(row=>drawRow([
      row.date,row.module,row.kind==="cash"?"Caixa":row.kind==="receivable"?"A receber":row.kind==="payable"?"A pagar":"Nota fiscal",
      row.description,row.party,money(row.amount),row.status,
    ]));
    pdf.save(`relatorio-financeiro-${from}-a-${to}.pdf`);
  };
  return <div className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Análise financeira · Brasil (R$)</p><h2 className="text-2xl font-black">Relatório financeiro por módulos</h2><p className="text-sm text-slate-500">Entradas e saídas efetivas aparecem no Caixa. Notas fiscais de compras ficam no módulo Compras como custo registrado; boletos ficam em Contas a Pagar. Assim, a nota fiscal não é somada novamente como se fosse um pagamento.</p></header>
    {error&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
    <div className="grid gap-3 rounded-2xl border bg-white p-4 dark:bg-slate-900 sm:grid-cols-5">
      <label className="text-xs font-semibold text-slate-500">Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Data final<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Módulo<select value={module} onChange={e=>setModule(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="all">Todos os módulos</option>{["Caixa","Vendas","Compras","Folha","Contas a receber","Contas a pagar"].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-500">Movimentação<select value={direction} onChange={e=>setDirection(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="all">Entradas e saídas</option><option value="in">Entradas</option><option value="out">Saídas</option></select></label>
      <div className="flex items-end gap-2"><button onClick={exportPdf} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold"><Printer className="h-4 w-4"/> PDF profissional</button><button onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white"><Download className="h-4 w-4"/> CSV / Excel</button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><TrendingUp className="mb-2 text-emerald-600"/><p className="text-xs text-slate-500">Entradas efetivas (caixa)</p><strong className="text-xl">{money(incoming)}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><TrendingDown className="mb-2 text-rose-600"/><p className="text-xs text-slate-500">Saídas efetivas (caixa)</p><strong className="text-xl">{money(outgoing)}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><Wallet className="mb-2 text-blue-600"/><p className="text-xs text-slate-500">Saldo de caixa do período</p><strong className="text-xl">{money(incoming-outgoing)}</strong></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><FileText className="mb-2 text-indigo-600"/><p className="text-xs text-slate-500">Notas fiscais de compras (registradas)</p><strong className="text-xl">{money(purchaseTotal)}</strong><p className="mt-1 text-[11px] text-slate-500">Custo documental; não representa saída de caixa.</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><Clock className="mb-2 text-amber-600"/><p className="text-xs text-slate-500">Em aberto a receber</p><strong className="text-xl">{money(openReceivables)}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><Clock className="mb-2 text-rose-600"/><p className="text-xs text-slate-500">Em aberto a pagar (boletos/contas)</p><strong className="text-xl">{money(openPayables)}</strong></div>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4 dark:border-slate-700"><h3 className="font-bold">Detalhamento por módulo</h3><span className="text-xs text-slate-500">{loading?"Carregando dados...":filtered.length+" registros · "+from+" a "+to}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Data</th><th className="p-3">Módulo</th><th className="p-3">Natureza</th><th className="p-3">Descrição</th><th className="p-3">Cliente/Fornecedor</th><th className="p-3 text-right">Valor</th><th className="p-3">Status</th></tr></thead><tbody>{filtered.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=><tr key={r.kind+"-"+r.source+"-"+r.id} className="border-t dark:border-slate-700"><td className="p-3 whitespace-nowrap">{r.date}</td><td className="p-3 font-semibold">{r.module}</td><td className="p-3">{r.kind==="cash"?"Caixa":r.kind==="receivable"?"A receber":r.kind==="payable"?"A pagar":"Nota fiscal"}</td><td className="p-3">{r.description}</td><td className="p-3">{r.party}</td><td className="p-3 text-right font-bold">{money(r.amount)}</td><td className="p-3">{r.status}</td></tr>)}{!filtered.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading?"Carregando...":"Nenhum lançamento encontrado para o período."}</td></tr>}</tbody></table></div>
    </section>
    <p className="text-xs text-slate-500">Importante: compras são exibidas como documentos de custo e os boletos como obrigações a pagar; somente o pagamento conciliado entra nas saídas de caixa. Vendas/faturamento devem ser conciliados com documentos emitidos e recebimentos para refletir a receita efetiva.</p>
    <style>{`@media print { button, input, select { display:none !important; } body { background:white !important; } }`}</style>
  </div>;
}
