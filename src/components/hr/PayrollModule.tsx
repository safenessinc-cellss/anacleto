import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Users, Clock3, Wallet, Plus, Calculator, FileSpreadsheet, UserRound, ShieldCheck } from "lucide-react";

type Employee = {
  id: string; name: string; cpf?: string; role: string; salary: number;
  monthlyHours?: number; weeklyHours?: number; admissionDate?: string;
  department?: string; email?: string; phone?: string; active: boolean;
  additions?: { name: string; kind: "fixed" | "percent"; value: number }[];
};
type TimeEntry = {
  id: string; employeeId: string; date: string; normalHours?: number;
  hours?: number; absences?: number; delays?: number;
  overtime50?: number; overtime100?: number; overtimeHours?: number; note?: string;
};
const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = (date: string) => (date || "").slice(0, 7);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const onlyDigits = (s: string) => s.replace(/\\D/g, "");
function validCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\\d)\\1{10}$/.test(cpf)) return false;
  const digit = (base: string, factor: number) => {
    let sum = 0; for (const char of base) sum += Number(char) * factor--;
    const rest = (sum * 10) % 11; return rest === 10 ? 0 : rest;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}
function additionsTotal(emp: Employee) {
  return round2((emp.additions || []).reduce((sum, item) => sum + (item.kind === "percent" ? emp.salary * item.value / 100 : item.value), 0));
}
export default function PayrollModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [name, setName] = useState(""); const [cpf, setCpf] = useState("");
  const [role, setRole] = useState(""); const [salary, setSalary] = useState("2500");
  const [monthlyHours, setMonthlyHours] = useState("220"); const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0,10));
  const [department, setDepartment] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [normalHours, setNormalHours] = useState("8"); const [absences, setAbsences] = useState("0"); const [delays, setDelays] = useState("0");
  const [overtime50, setOvertime50] = useState("0"); const [overtime100, setOvertime100] = useState("0"); const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [error, setError] = useState("");
  useEffect(() => {
    const e = onSnapshot(query(collection(db, "employees"), orderBy("name")), s => setEmployees(s.docs.map(d => ({ id:d.id, ...d.data() } as Employee))), err => setError("Não foi possível carregar os funcionários: " + err.message));
    const t = onSnapshot(query(collection(db, "time_entries"), orderBy("date", "desc")), s => setEntries(s.docs.map(d => ({ id:d.id, ...d.data() } as TimeEntry))), err => setError("Não foi possível carregar os apontamentos: " + err.message));
    return () => { e(); t(); };
  }, []);
  const summary = useMemo(() => employees.filter(e => e.active !== false).map(emp => {
    const rows = entries.filter(x => x.employeeId === emp.id && monthKey(x.date) === month);
    const divisor = Number(emp.monthlyHours || (emp.weeklyHours ? emp.weeklyHours * 52 / 12 : 220));
    const hourly = divisor > 0 ? Number(emp.salary || 0) / divisor : 0;
    const h50 = rows.reduce((s,x) => s + Number(x.overtime50 || 0), 0);
    const h100 = rows.reduce((s,x) => s + Number(x.overtime100 || x.overtimeHours || 0), 0);
    const absenceHours = rows.reduce((s,x) => s + Number(x.absences || 0), 0);
    const delayHours = rows.reduce((s,x) => s + Number(x.delays || 0), 0);
    const normal = rows.reduce((s,x) => s + Number(x.normalHours ?? x.hours ?? 0), 0);
    const extra50 = round2(h50 * hourly * 1.5); const extra100 = round2(h100 * hourly * 2);
    const additions = additionsTotal(emp);
    const deductionsAttendance = round2((absenceHours + delayHours) * hourly);
    const gross = round2(Number(emp.salary || 0) + additions + extra50 + extra100);
    const estimated = round2(Math.max(0, gross - deductionsAttendance));
    return { ...emp, hourly, normal, h50, h100, absenceHours, delayHours, extra50, extra100, additions, deductionsAttendance, gross, estimated };
  }), [employees, entries, month]);
  const total = summary.reduce((s,e) => s + e.estimated, 0);
  const addEmployee = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError("");
    if (!name.trim() || Number(salary) <= 0 || Number(monthlyHours) <= 0) return setError("Informe nome, salário e jornada mensal válidos.");
    if (cpf && !validCPF(cpf)) return setError("O CPF informado é inválido.");
    if (cpf && employees.some(e => e.cpf && onlyDigits(e.cpf) === onlyDigits(cpf))) return setError("Já existe funcionário cadastrado com este CPF.");
    try {
      await addDoc(collection(db, "employees"), { name:name.trim(), cpf:onlyDigits(cpf), role:role.trim(), salary:round2(Number(salary)), monthlyHours:Number(monthlyHours), admissionDate, department:department.trim(), email:email.trim(), phone:phone.trim(), active:true, additions:[], createdAt:serverTimestamp(), createdBy:auth.currentUser?.uid || null });
      setName(""); setCpf(""); setRole(""); setDepartment(""); setEmail(""); setPhone("");
    } catch (e) { setError("Falha ao cadastrar funcionário: " + (e as Error).message); }
  };
  const addEntry = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError("");
    const values = [normalHours, absences, delays, overtime50, overtime100].map(Number);
    if (!employeeId || values.some(v => !Number.isFinite(v) || v < 0) || !date) return setError("Revise o funcionário, a data e as horas informadas.");
    try {
      await addDoc(collection(db, "time_entries"), { employeeId, date, normalHours:values[0], absences:values[1], delays:values[2], overtime50:values[3], overtime100:values[4], note:note.trim(), createdAt:serverTimestamp(), createdBy:auth.currentUser?.uid || null });
      setNote(""); setOvertime50("0"); setOvertime100("0"); setAbsences("0"); setDelays("0");
    } catch (e) { setError("Falha ao registrar apontamento: " + (e as Error).message); }
  };
  return <div className="space-y-6 text-slate-800 dark:text-slate-100">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Gestão de pessoas</p><h1 className="text-3xl font-black tracking-tight">Folha de pagamento</h1><p className="mt-1 text-sm text-slate-500">Cadastro funcional, jornada, adicionais e apuração mensal estimada.</p></div><label className="text-sm font-semibold">Competência <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:bg-slate-800"/></label></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Users className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Funcionários ativos</p><strong className="text-2xl">{summary.length}</strong></div><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Clock3 className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Horas extras 50% / 100%</p><strong className="text-2xl">{summary.reduce((s,e)=>s+e.h50+e.h100,0).toFixed(2)} h</strong></div><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Wallet className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Total líquido estimado*</p><strong className="text-2xl">{money(total)}</strong></div></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={addEmployee} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-bold"><UserRound className="h-4 w-4 text-blue-600"/> Cadastrar funcionário</h2>
        <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome completo *" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/>
        <div className="grid gap-2 sm:grid-cols-2"><input value={cpf} onChange={e=>setCpf(e.target.value)} placeholder="CPF" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/><input value={role} onChange={e=>setRole(e.target.value)} placeholder="Cargo / função" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></div>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-500">Salário base (R$)<input required type="number" min="0.01" step=".01" value={salary} onChange={e=>setSalary(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Jornada mensal (horas)<input required type="number" min="1" max="300" value={monthlyHours} onChange={e=>setMonthlyHours(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label></div>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-500">Data de admissão<input type="date" value={admissionDate} onChange={e=>setAdmissionDate(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Departamento" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></div>
        <div className="grid gap-2 sm:grid-cols-2"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telefone" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></div>
        <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Salvar funcionário</button>
      </form>
      <form onSubmit={addEntry} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-bold"><Clock3 className="h-4 w-4 text-blue-600"/> Lançar jornada e ocorrências</h2>
        <select required value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"><option value="">Selecione o funcionário</option>{employees.filter(e=>e.active!==false).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Data<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Horas normais<input type="number" min="0" step=".25" value={normalHours} onChange={e=>setNormalHours(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Faltas (horas)<input type="number" min="0" step=".25" value={absences} onChange={e=>setAbsences(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Atrasos (horas)<input type="number" min="0" step=".25" value={delays} onChange={e=>setDelays(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Horas extras 50%<input type="number" min="0" step=".25" value={overtime50} onChange={e=>setOvertime50(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label><label className="text-xs text-slate-500">Horas extras 100%<input type="number" min="0" step=".25" value={overtime100} onChange={e=>setOvertime100(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:bg-slate-800"/></label></div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Observação (opcional)" className="w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/><button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Registrar apontamento</button>
      </form>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-2 border-b p-5 dark:border-slate-700"><h2 className="flex items-center gap-2 font-bold"><Calculator className="h-4 w-4 text-blue-600"/> Resumo da folha — {month}</h2><button onClick={()=>window.print()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><FileSpreadsheet className="h-4 w-4"/> Imprimir / PDF</button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Funcionário","Horas normais","HE 50%","HE 100%","Salário base","Adicionais","Descontos de faltas/atrasos","Líquido estimado"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{summary.map(e=><tr key={e.id} className="border-t dark:border-slate-700"><td className="p-3"><b>{e.name}</b><div className="text-xs text-slate-500">{e.role} · CPF {e.cpf || "não informado"}</div></td><td className="p-3">{e.normal.toFixed(2)} h</td><td className="p-3">{money(e.extra50)}</td><td className="p-3">{money(e.extra100)}</td><td className="p-3">{money(e.salary)}</td><td className="p-3">{money(e.additions)}</td><td className="p-3">{money(e.deductionsAttendance)}</td><td className="p-3 font-bold">{money(e.estimated)}</td></tr>)}{!summary.length&&<tr><td colSpan={8} className="p-8 text-center text-slate-500">Cadastre funcionários para iniciar a folha.</td></tr>}</tbody></table></div>
    </section>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><ShieldCheck className="mr-1 inline h-4 w-4"/> <b>Critério de cálculo:</b> valor-hora = salário base ÷ jornada mensal; HE 50% = horas × valor-hora × 1,5; HE 100% = horas × valor-hora × 2. Faltas e atrasos são estimados pelo valor-hora. O resultado ainda não é folha legal: INSS, IRRF, FGTS, DSR, férias, 13º, adicionais legais e convenções coletivas dependem de tabelas vigentes e regras aplicáveis, que precisam ser validadas pela contabilidade. Valores arredondados em centavos.</div>
    <style>{`@media print { button, form, header label { display:none !important; } body { background:white !important; } }`}</style>
  </div>;
}
