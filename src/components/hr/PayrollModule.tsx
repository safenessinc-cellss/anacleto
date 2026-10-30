import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Users, Clock3, Wallet, Plus, Calculator, FileSpreadsheet } from "lucide-react";

type Employee = { id: string; name: string; role: string; salary: number; weeklyHours: number; overtimeMultiplier: number; active: boolean };
type TimeEntry = { id: string; employeeId: string; date: string; hours: number; note?: string };

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = (date: string) => date.slice(0, 7);

export default function PayrollModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("2500");
  const [weeklyHours, setWeeklyHours] = useState("44");
  const [multiplier, setMultiplier] = useState("1.5");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [hours, setHours] = useState("8");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));

  useEffect(() => {
    const e = onSnapshot(query(collection(db, "employees"), orderBy("name")), s => setEmployees(s.docs.map(d => ({ id:d.id, ...d.data() } as Employee))), err => console.error("Falha ao carregar funcionários", err));
    const t = onSnapshot(query(collection(db, "time_entries"), orderBy("date", "desc")), s => setEntries(s.docs.map(d => ({ id:d.id, ...d.data() } as TimeEntry))), err => console.error("Falha ao carregar ponto", err));
    return () => { e(); t(); };
  }, []);

  const summary = useMemo(() => employees.filter(e => e.active !== false).map(emp => {
    const rows = entries.filter(x => x.employeeId === emp.id && monthKey(x.date) === month);
    const regularTarget = emp.weeklyHours * 52 / 12;
    const worked = rows.reduce((s,x) => s + Number(x.hours || 0), 0);
    const overtime = Math.max(0, worked - regularTarget);
    const hourly = emp.salary / (emp.weeklyHours * 52 / 12);
    const overtimePay = overtime * hourly * (emp.overtimeMultiplier || 1.5);
    return { ...emp, worked, regularTarget, overtime, overtimePay, estimated: emp.salary + overtimePay, hourly };
  }), [employees, entries, month]);
  const total = summary.reduce((s,e) => s + e.estimated, 0);

  const addEmployee = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim() || Number(salary) <= 0 || Number(weeklyHours) <= 0) return;
    await addDoc(collection(db, "employees"), { name:name.trim(), role:role.trim(), salary:Number(salary), weeklyHours:Number(weeklyHours), overtimeMultiplier:Number(multiplier), active:true, createdAt:serverTimestamp() });
    setName(""); setRole("");
  };
  const addEntry = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!employeeId || Number(hours) <= 0) return;
    await addDoc(collection(db, "time_entries"), { employeeId, date, hours:Number(hours), note:note.trim(), createdAt:serverTimestamp() });
    setNote("");
  };

  return <div className="space-y-6 text-slate-800 dark:text-slate-100">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Gestão de pessoas</p><h1 className="text-3xl font-black tracking-tight">Folha de pagamento</h1><p className="mt-1 text-sm text-slate-500">Funcionários, jornada, apontamentos e estimativa mensal de horas extras.</p></div>
      <label className="text-sm font-semibold">Competência <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:bg-slate-800"/></label>
    </header>
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Users className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Funcionários ativos</p><strong className="text-2xl">{summary.length}</strong></div>
      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Clock3 className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Horas extras apontadas</p><strong className="text-2xl">{summary.reduce((s,e)=>s+e.overtime,0).toFixed(1)} h</strong></div>
      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Wallet className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Total estimado da folha</p><strong className="text-2xl">{money(total)}</strong></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={addEmployee} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-bold"><Plus className="h-4 w-4 text-blue-600"/> Cadastrar funcionário</h2>
        <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/>
        <input value={role} onChange={e=>setRole(e.target.value)} placeholder="Cargo / função" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-500">Salário mensal (R$)<input type="number" min="0" step=".01" value={salary} onChange={e=>setSalary(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label>
          <label className="text-xs text-slate-500">Horas / semana<input type="number" min="1" max="60" value={weeklyHours} onChange={e=>setWeeklyHours(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label>
          <label className="text-xs text-slate-500">Fator extra<input type="number" min="1" step=".05" value={multiplier} onChange={e=>setMultiplier(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label>
        </div>
        <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Salvar funcionário</button>
      </form>
      <form onSubmit={addEntry} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-bold"><Clock3 className="h-4 w-4 text-blue-600"/> Lançar horas trabalhadas</h2>
        <select required value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"><option value="">Selecione o funcionário</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Total de horas<input type="number" min=".1" step=".25" value={hours} onChange={e=>setHours(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label></div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Observação (opcional)" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/>
        <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Registrar apontamento</button>
      </form>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b p-5 dark:border-slate-700"><h2 className="flex items-center gap-2 font-bold"><Calculator className="h-4 w-4 text-blue-600"/> Resumo da folha — {month}</h2><button onClick={()=>window.print()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><FileSpreadsheet className="h-4 w-4"/> Imprimir / PDF</button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Funcionário","Jornada mensal","Horas lançadas","Horas extras","Salário base","Extras estimadas","Total estimado"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{summary.map(e=><tr key={e.id} className="border-t dark:border-slate-700"><td className="p-3"><b>{e.name}</b><div className="text-xs text-slate-500">{e.role}</div></td><td className="p-3">{e.regularTarget.toFixed(1)} h</td><td className="p-3">{e.worked.toFixed(1)} h</td><td className="p-3 font-semibold text-amber-600">{e.overtime.toFixed(1)} h</td><td className="p-3">{money(e.salary)}</td><td className="p-3">{money(e.overtimePay)}</td><td className="p-3 font-bold">{money(e.estimated)}</td></tr>)}{!summary.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">Cadastre funcionários para iniciar a folha.</td></tr>}</tbody></table></div>
    </section>
    <p className="text-xs leading-relaxed text-slate-500">A apuração atual é uma estimativa gerencial: compara o total de horas lançadas no mês com a jornada mensal proporcional (horas semanais × 52 ÷ 12). O fator de horas extras é configurável por funcionário. Não calcula automaticamente INSS, FGTS, IRRF, DSR, férias, 13º, adicional noturno, feriados ou regras de convenção coletiva. Antes de usar como folha oficial, valide a jornada, os apontamentos e os adicionais com a contabilidade / DP e a legislação aplicável.</p>
  </div>;
}
