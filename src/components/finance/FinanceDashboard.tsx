import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

type Ledger = { id: string; date?: string; direction?: string; type?: string; amount?: number; category?: string; description?: string; status?: string };
type OpenRow = { id: string; dueDate?: string; date?: string; amount?: number; total?: number; receivedAmount?: number; status?: string; clientName?: string; supplierName?: string; description?: string };
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthId = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const parseDate = (value?: string) => value ? new Date(`${value.slice(0, 10)}T00:00:00`) : null;
const point = (cx: number, cy: number, radius: number, angle: number) => `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;

function donutPath(start: number, end: number) {
  const cx = 100, cy = 100, outer = 78, inner = 48;
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${point(cx,cy,outer,start)} A ${outer} ${outer} 0 ${large} 1 ${point(cx,cy,outer,end)} L ${point(cx,cy,inner,end)} A ${inner} ${inner} 0 ${large} 0 ${point(cx,cy,inner,start)} Z`;
}

export default function FinanceDashboard() {
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [receivables, setReceivables] = useState<OpenRow[]>([]);
  const [payables, setPayables] = useState<OpenRow[]>([]);
  const [advances, setAdvances] = useState<Array<{ amount?: number; status?: string }>>([]);
  const [adjustments, setAdjustments] = useState<Array<{ amount?: number; status?: string; competence?: string }>>([]);
  const [error, setError] = useState("");
  const [activeMonth, setActiveMonth] = useState(monthId(new Date()));
  const [activeExpense, setActiveExpense] = useState("");

  useEffect(() => {
    const watchers = [
      onSnapshot(collection(db, "ledger_entries"), (snap) => setLedger(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Ledger))), (reason) => setError(`Falha ao carregar o caixa: ${reason.message}`)),
      onSnapshot(collection(db, "receivables"), (snap) => setReceivables(snap.docs.map((item) => ({ id: item.id, ...item.data() } as OpenRow))), (reason) => setError(`Falha ao carregar recebíveis: ${reason.message}`)),
      onSnapshot(collection(db, "payables"), (snap) => setPayables(snap.docs.map((item) => ({ id: item.id, ...item.data() } as OpenRow))), (reason) => setError(`Falha ao carregar contas a pagar: ${reason.message}`)),
      onSnapshot(collection(db, "client_advances"), (snap) => setAdvances(snap.docs.map((item) => item.data() as { amount?: number; status?: string })), (reason) => setError(`Falha ao carregar sinais: ${reason.message}`)),
      onSnapshot(collection(db, "payroll_adjustments"), (snap) => setAdjustments(snap.docs.map((item) => item.data() as { amount?: number; status?: string; competence?: string })), (reason) => setError(`Falha ao carregar vales: ${reason.message}`)),
    ];
    return () => watchers.forEach((stop) => stop());
  }, []);

  const posted = ledger.filter((row) => !["cancelled", "cancelado", "void", "estornado"].includes(String(row.status || "").toLowerCase()));
  const cash = posted.reduce((sum, row) => sum + (["inflow", "income", "in", "entrada"].includes(String(row.direction || row.type || "").toLowerCase()) ? 1 : -1) * Number(row.amount || 0), 0);
  const customerAdvances = advances.filter((row) => !["cancelled", "cancelado", "refunded"].includes(String(row.status || "").toLowerCase())).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const openReceivables = receivables.filter((row) => !["received", "paid", "pago", "cancelled", "cancelado"].includes(String(row.status || "").toLowerCase())).reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? row.total ?? 0) - Number(row.receivedAmount || 0)), 0);
  const openPayables = payables.filter((row) => ["pending", "pendente", "overdue", "vencido", "pending_approval"].includes(String(row.status || "").toLowerCase())).reduce((sum, row) => sum + Number(row.amount || row.total || 0), 0);
  const pendingAdvances = adjustments.filter((row) => row.competence === monthId(new Date()) && row.status !== "deducted").reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const monthly = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index), 1);
    const key = monthId(date);
    const rows = posted.filter((row) => String(row.date || "").slice(0, 7) === key);
    return {
      key, label: date.toLocaleDateString("pt-BR", { month: "short" }),
      incoming: rows.filter((row) => ["inflow", "income", "in", "entrada"].includes(String(row.direction || row.type || "").toLowerCase())).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      outgoing: rows.filter((row) => !["inflow", "income", "in", "entrada"].includes(String(row.direction || row.type || "").toLowerCase())).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }), [posted]);
  const monthMaximum = Math.max(1, ...monthly.flatMap((item) => [item.incoming, item.outgoing]));
  const selectedMonth = monthly.find((item) => item.key === activeMonth) || monthly[monthly.length - 1];
  const expenses = useMemo(() => {
    const categories = [
      { key: "materiais", label: "Materiais / alumínio", color: "#2563eb", match: /material|alumin|perfil|compra/ },
      { key: "vidros", label: "Vidros", color: "#06b6d4", match: /vidro/ },
      { key: "vales", label: "Adiant. funcionários", color: "#f59e0b", match: /employee|funcion|vale|folha/ },
      { key: "frete", label: "Frete", color: "#8b5cf6", match: /frete|fret/ },
      { key: "fixos", label: "Fixos / outros", color: "#64748b", match: /.*/ },
    ];
    const sums = categories.map((category) => ({
      ...category,
      value: posted.filter((row) => !["inflow", "income", "in", "entrada"].includes(String(row.direction || row.type || "").toLowerCase()) &&
        (category.key === "fixos" || category.match.test(`${row.category || ""} ${row.description || ""}`)))
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }));
    const classified = sums.slice(0, -1).reduce((sum, category) => sum + category.value, 0);
    sums[sums.length - 1].value = Math.max(0, posted.filter((row) => !["inflow", "income", "in", "entrada"].includes(String(row.direction || row.type || "").toLowerCase())).reduce((sum, row) => sum + Number(row.amount || 0), 0) - classified);
    return sums;
  }, [posted]);
  const expenseTotal = expenses.reduce((sum, category) => sum + category.value, 0);
  const expenseSectors = expenses.reduce<Array<{ key: string; label: string; color: string; value: number; start: number; end: number }>>((result, category) => {
    const start = result.at(-1)?.end ?? -Math.PI / 2;
    const end = start + (expenseTotal ? category.value / expenseTotal : 0) * Math.PI * 2;
    result.push({ ...category, start, end });
    return result;
  }, []);
  const today = new Date();
  const overdue = [
    ...receivables.filter((row) => !["received", "paid", "pago", "cancelled", "cancelado"].includes(String(row.status || "").toLowerCase())).map((row) => ({ ...row, kind: "A receber" })),
    ...payables.filter((row) => ["pending", "pendente", "overdue", "vencido"].includes(String(row.status || "").toLowerCase())).map((row) => ({ ...row, kind: "A pagar" })),
  ].filter((row) => {
    const due = parseDate(row.dueDate || row.date);
    return due && (due.getTime() < new Date(today.toDateString()).getTime() || due.getTime() < Date.now() + 7 * 86400000);
  }).slice(0, 6);

  return <section className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Visão executiva · fluxo de caixa</p><h2 className="text-2xl font-black">Visão Geral & Gráficos</h2><p className="mt-1 text-sm text-slate-500">Indicadores calculados em tempo real a partir dos lançamentos, sinais, recebíveis e contas a pagar.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Saldo em Caixa (R$)", cash, "Lançamentos conciliados"], ["Adiantamentos de Clientes (Sinais)", customerAdvances, "Valores recebidos vinculados às obras"], ["A Receber de Obras", openReceivables, "Saldo aberto das cobranças"], ["Contas a Pagar / Vales", openPayables + pendingAdvances, "Fornecedores e vales pendentes na folha"]].map(([label, amount, caption]) => <article key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(Number(amount))}</p><p className="mt-1 text-[11px] text-slate-500">{caption}</p></article>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">Entradas vs. Saídas por Mês</h3><p className="text-xs text-slate-500">Movimentos efetivos do caixa</p></div><div className="text-right text-xs"><p className="font-bold">{selectedMonth?.key}</p><p className="text-emerald-700">Entradas {money(selectedMonth?.incoming || 0)}</p><p className="text-rose-700">Saídas {money(selectedMonth?.outgoing || 0)}</p></div></div>
        <svg viewBox="0 0 640 260" role="img" aria-label="Gráfico de barras de entradas e saídas mensais" className="mt-4 h-64 w-full">
          {[0,1,2,3].map((line) => <g key={line}><line x1="45" x2="625" y1={30 + line * 58} y2={30 + line * 58} stroke="#e2e8f0" strokeDasharray="4 4"/><text x="8" y={34 + line * 58} fontSize="10" fill="#64748b">{line === 0 ? "max" : ""}</text></g>)}
          {monthly.map((month, index) => {const baseX=70+index*92;const incomingHeight=month.incoming/monthMaximum*180;const outgoingHeight=month.outgoing/monthMaximum*180;return <g key={month.key} onClick={()=>setActiveMonth(month.key)} className="cursor-pointer"><rect x={baseX} y={220-incomingHeight} width="28" height={incomingHeight} rx="4" fill={activeMonth===month.key?"#059669":"#10b981"}/><rect x={baseX+32} y={220-outgoingHeight} width="28" height={outgoingHeight} rx="4" fill={activeMonth===month.key?"#e11d48":"#fb7185"}/><text x={baseX+28} y="242" textAnchor="middle" fontSize="11" fill="#475569">{month.label}</text></g>;})}
          <rect x="235" y="12" width="10" height="10" fill="#10b981"/><text x="250" y="21" fontSize="10" fill="#475569">Entradas</text><rect x="320" y="12" width="10" height="10" fill="#fb7185"/><text x="335" y="21" fontSize="10" fill="#475569">Saídas</text>
        </svg>
      </section>
      <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
        <h3 className="font-bold">Distribuição de Gastos</h3><p className="text-xs text-slate-500">Saídas de caixa por categoria</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
          <svg viewBox="0 0 200 200" role="img" aria-label="Gráfico circular de despesas" className="h-52 w-52">
            {expenseSectors.filter((sector) => sector.value > 0).map((sector) => <path key={sector.key} d={donutPath(sector.start,sector.end)} fill={sector.color} stroke="white" strokeWidth="2" onClick={()=>setActiveExpense(sector.key)} className="cursor-pointer"><title>{sector.label}: {money(sector.value)}</title></path>)}
            <text x="100" y="96" textAnchor="middle" fontSize="10" fill="#64748b">Total</text><text x="100" y="114" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">{money(expenseTotal)}</text>
          </svg>
          <div className="space-y-2">{expenseSectors.map((sector) => <button key={sector.key} onClick={()=>setActiveExpense(sector.key)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${activeExpense===sector.key?"bg-slate-100 font-bold dark:bg-slate-800":""}`}><span className="h-3 w-3 rounded-sm" style={{backgroundColor:sector.color}}/><span className="min-w-36">{sector.label}</span><span className="font-mono">{money(sector.value)}</span></button>)}</div>
        </div>
        {activeExpense&&<p className="mt-2 text-center text-xs text-slate-500">Categoria selecionada: {expenses.find((category)=>category.key===activeExpense)?.label}</p>}
      </section>
    </div>
    <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900"><h3 className="font-bold">Alertas de vencimento</h3><p className="mb-3 text-xs text-slate-500">Vencidos ou com vencimento nos próximos 7 dias</p>{overdue.length?<div className="grid gap-2 sm:grid-cols-2">{overdue.map((row)=><div key={`${row.kind}-${row.id}`} className="flex justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30"><span>{row.kind} · {row.clientName||row.supplierName||row.description||"Lançamento"}</span><span className="shrink-0 font-bold">{row.dueDate||row.date||"—"} · {money(Number(row.amount||row.total||0))}</span></div>)}</div>:<p className="text-sm text-slate-500">Nenhum vencimento próximo.</p>}</section>
  </section>;
}
