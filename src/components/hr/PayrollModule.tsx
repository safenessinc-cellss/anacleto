import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import logoImg from "../../assets/images/anacleto-logo-premium.svg";
import { Users, Clock3, Wallet, Plus, Calculator, FileSpreadsheet, UserRound, ShieldCheck } from "lucide-react";
import { mergeEmployeeDirectory, type EmployeeDirectoryRecord, type EmployeeDirectoryEntry } from "../../utils/employeeDirectory";

type Employee = EmployeeDirectoryEntry & { weeklyHours?: number };
// Keep each payroll type declaration on its own physical line; do not insert escaped newline text.
type EmployeePayment = { id: string; employeeId: string; competence: string; amount: number; paymentDate: string; };
type PayrollAdjustment = { id: string; employeeId: string; competence: string; kind: "advance" | "vale" | "loan"; amount: number; description?: string; date?: string; status?: string; source?: string; };
type TimeEntry = {
  id: string; employeeId: string; date: string; normalHours?: number;
  hours?: number; absences?: number; delays?: number;
  overtime50?: number; overtime100?: number; overtimeHours?: number; note?: string;
};
const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = (date: string) => (date || "").slice(0, 7);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const onlyDigits = (s: string) => s.replace(/\D/g, "");
const formatCPF = (value: string) => onlyDigits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
function validCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
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
  const [employeeRecords, setEmployeeRecords] = useState<EmployeeDirectoryRecord[]>([]);
  const employees = useMemo(() => mergeEmployeeDirectory(employeeRecords) as Employee[], [employeeRecords]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [adjustmentEmployee, setAdjustmentEmployee] = useState("");
  const [adjustmentKind, setAdjustmentKind] = useState<PayrollAdjustment["kind"]>("advance");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().slice(0,10));
  const [name, setName] = useState(""); const [cpf, setCpf] = useState("");
  const [role, setRole] = useState(""); const [salary, setSalary] = useState("2500");
  const [monthlyHours, setMonthlyHours] = useState("220"); const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0,10));
  const [department, setDepartment] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [normalHours, setNormalHours] = useState("8"); const [absences, setAbsences] = useState("0"); const [delays, setDelays] = useState("0");
  const [overtime50, setOvertime50] = useState("0"); const [overtime100, setOvertime100] = useState("0"); const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [error, setError] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAdmissionDate, setEditAdmissionDate] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editHours, setEditHours] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);
  useEffect(() => {
    const sources = ["employees", "funcionarios", "staff", "admins", "user_profiles", "pending_users", "registry_items"] as const;
    const employeeStops = sources.map(source => onSnapshot(collection(db, source), snapshot => {
      const loaded = snapshot.docs.map(item => ({ id: item.id, source, data: item.data() }) as EmployeeDirectoryRecord);
      setEmployeeRecords(current => [...current.filter(record => record.source !== source), ...loaded]);
    }, err => setError(`Não foi possível carregar funcionários de ${source}: ${err.message}`)));
    const t = onSnapshot(query(collection(db, "time_entries"), orderBy("date", "desc")), s => setEntries(s.docs.map(d => ({ id:d.id, ...d.data() } as TimeEntry))), err => setError("Não foi possível carregar os apontamentos: " + err.message));
    const p = onSnapshot(collection(db, "employee_payments"), s => setPayments(s.docs.map(d => ({ id:d.id, ...d.data() } as EmployeePayment))), err => setError("Não foi possível carregar os pagamentos: " + err.message));
    const a = onSnapshot(query(collection(db, "payroll_adjustments"), orderBy("date", "desc")), s => setAdjustments(s.docs.map(d => ({ id:d.id, ...d.data() } as PayrollAdjustment))), err => setError("Não foi possível carregar adiantamentos, vales e empréstimos: " + err.message));
    return () => { employeeStops.forEach(stop => stop()); t(); p(); a(); };
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
    const additionsAmount = additionsTotal(emp);
    const deductionsAttendance = round2((absenceHours + delayHours) * hourly);
    const gross = round2(Number(emp.salary || 0) + additionsAmount + extra50 + extra100);
    const employeeAdjustments = adjustments.filter(a => a.employeeId === emp.id && a.competence === month);
    const advances = round2(employeeAdjustments.filter(a => a.kind === "advance").reduce((sum, a) => sum + Number(a.amount || 0), 0));
    const vales = round2(employeeAdjustments.filter(a => a.kind === "vale").reduce((sum, a) => sum + Number(a.amount || 0), 0));
    const loans = round2(employeeAdjustments.filter(a => a.kind === "loan").reduce((sum, a) => sum + Number(a.amount || 0), 0));
    const estimated = round2(Math.max(0, gross - deductionsAttendance - advances - vales - loans));
    const paidAmount = payments.filter(p => p.employeeId === emp.id && p.competence === month).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { ...emp, hourly, normal, h50, h100, absenceHours, delayHours, extra50, extra100, additionsAmount, advances, vales, loans, deductionsAttendance, gross, estimated, paidAmount };
  }), [employees, entries, payments, adjustments, month]);
  const total = summary.reduce((s,e) => s + e.estimated, 0);
  const totalAdvances = summary.reduce((s,e)=>s+e.advances,0);
  const totalVales = summary.reduce((s,e)=>s+e.vales,0);
  const totalLoans = summary.reduce((s,e)=>s+e.loans,0);
  const registerPayrollPayment = async (employee: (typeof summary)[number]) => {
    const outstanding = round2(Math.max(0, employee.estimated - employee.paidAmount));
    if (!outstanding) return setError("Esta folha já está quitada para o funcionário selecionado.");
    if (!window.confirm(`Registrar pagamento de ${money(outstanding)} para ${employee.name}, competência ${month}?`)) return;
    setError("");
    try {
      const paymentRef = doc(collection(db, "employee_payments"));
      const ledgerRef = doc(db, "ledger_entries", `employee-payment-${paymentRef.id}`);
      const pendingAdvances = adjustments.filter((item) => item.employeeId === employee.id && item.competence === month && item.source === "finance_employee_advance" && item.status !== "deducted");
      const paymentDate = new Date().toISOString().slice(0, 10);
      await runTransaction(db, async (transaction) => {
        const refs = pendingAdvances.map((item) => doc(db, "payroll_adjustments", item.id));
        const snapshots = [];
        for (const ref of refs) snapshots.push(await transaction.get(ref));
        transaction.set(paymentRef, {
          employeeId: employee.id, employeeName: employee.name, employeeRole: employee.role || "",
          competence: month, amount: outstanding, paymentDate,
          method: "pix", reference: `Folha de pagamento ${month}`,
          notes: "Pagamento registrado diretamente na Folha de Pagamento.",
          status: "paid", payrollSource: "payroll", deductedAdvanceIds: pendingAdvances.map((item) => item.id),
          createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "",
        });
        transaction.set(ledgerRef, {
          direction: "outflow", category: "payroll", sourceType: "employee_payment", sourceId: paymentRef.id,
          employeeId: employee.id, employeeName: employee.name, description: `Folha de pagamento · ${employee.name} · ${month}`,
          amount: outstanding, date: paymentDate, status: "posted", paymentMethod: "pix",
          createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "",
        });
        snapshots.forEach((snapshot, index) => {
          if (snapshot.exists() && snapshot.data().status !== "deducted") {
            transaction.update(refs[index], { status: "deducted", deductedAt: serverTimestamp(), paymentId: paymentRef.id });
          }
        });
      });
    } catch (paymentError) {
      setError("Não foi possível registrar o pagamento da folha: " + (paymentError as Error).message);
    }
  };
  const addAdjustment = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError(""); const amount = Number(adjustmentAmount);
    if (!adjustmentEmployee || !Number.isFinite(amount) || amount <= 0 || !adjustmentDate) return setError("Informe funcionário, data e valor válido para o lançamento.");
    try {
      const adjustmentRef = doc(collection(db, "payroll_adjustments"));
      const ledgerRef = doc(db, "ledger_entries", `employee-advance-${adjustmentRef.id}`);
      await runTransaction(db, async transaction => {
        transaction.set(adjustmentRef, { employeeId: adjustmentEmployee, competence: monthKey(adjustmentDate), kind: adjustmentKind, amount: round2(amount), description: adjustmentDescription.trim(), date: adjustmentDate, status: "pending_deduction", source: "payroll_adjustment", createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid || null });
        if (adjustmentKind !== "loan") transaction.set(ledgerRef, { direction: "outflow", category: "employee_advance", sourceType: "payroll_adjustment", sourceId: adjustmentRef.id, employeeId: adjustmentEmployee, description: `${adjustmentKind === "vale" ? "Vale" : "Adiantamento"} · ${adjustmentDescription.trim()}`, amount: round2(amount), date: adjustmentDate, status: "posted", createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
      });
      setAdjustmentAmount(""); setAdjustmentDescription("");
    }
    catch(e) { setError("Falha ao lançar adiantamento/vale/empréstimo: " + (e as Error).message); }
  };
  const saveSalary = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError("");
    const value = Number(editSalary), hours = Number(editHours);
    const cpfDigits = onlyDigits(editCpf);
    if (!editingEmployee || !editName.trim() || !Number.isFinite(value) || value <= 0 || !Number.isFinite(hours) || hours <= 0) return setError("Informe nome, salário base e jornada mensal válidos.");
    if (cpfDigits && !validCPF(cpfDigits)) return setError("O CPF informado é inválido.");
    if (cpfDigits && employees.some(employee => employee.id !== editingEmployee.id && onlyDigits(employee.cpf || "") === cpfDigits)) return setError("Já existe outro funcionário cadastrado com este CPF.");
    setSavingSalary(true);
    try {
      const employeeRef = doc(db, "employees", editingEmployee.id);
      const profile = {
        name: editName.trim(), role: editRole.trim(), cpf: cpfDigits, department: editDepartment.trim(),
        email: editEmail.trim(), phone: editPhone.trim(), admissionDate: editAdmissionDate,
        salary: round2(value), monthlyHours: hours,
        profileUpdatedAt: serverTimestamp(), profileUpdatedBy: auth.currentUser?.email || ""
      };
      if (editingEmployee.source === "employees") await updateDoc(employeeRef, profile);
      else await setDoc(employeeRef, { ...profile, active: true, additions: editingEmployee.additions || [], createdBy: auth.currentUser?.uid || null }, { merge: true });
      setEditingEmployee(null); setEditName(""); setEditRole(""); setEditCpf(""); setEditDepartment("");
      setEditEmail(""); setEditPhone(""); setEditAdmissionDate(""); setEditSalary(""); setEditHours("");
    } catch (e) { setError("Não foi possível atualizar o cadastro: " + (e as Error).message); }
    finally { setSavingSalary(false); }
  };
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
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Users className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Funcionários ativos</p><strong className="text-2xl">{summary.length}</strong></div><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Clock3 className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Horas extras 50% / 100%</p><strong className="text-2xl">{summary.reduce((s,e)=>s+e.h50+e.h100,0).toFixed(2)} h</strong></div><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Wallet className="mb-3 text-blue-600"/><p className="text-xs text-slate-500">Total líquido estimado*</p><strong className="text-2xl">{money(total)}</strong></div><div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Wallet className="mb-3 text-amber-600"/><p className="text-xs text-slate-500">Descontos: adiantamentos + vales + empréstimos</p><strong className="text-2xl">{money(totalAdvances+totalVales+totalLoans)}</strong><p className="mt-1 text-xs text-slate-500">Adiant. {money(totalAdvances)} · Vales {money(totalVales)} · Emprést. {money(totalLoans)}</p></div></div>
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
    <form onSubmit={addAdjustment} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold">Lançar adiantamento, vale ou empréstimo</h2><p className="text-xs text-slate-500">O lançamento é vinculado ao funcionário e à competência da data; será descontado automaticamente do líquido estimado.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><select required value={adjustmentEmployee} onChange={e=>setAdjustmentEmployee(e.target.value)} className="rounded-xl border p-3 text-sm dark:bg-slate-800"><option value="">Selecione funcionário</option>{employees.filter(e=>e.active!==false).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><select value={adjustmentKind} onChange={e=>setAdjustmentKind(e.target.value as PayrollAdjustment["kind"])} className="rounded-xl border p-3 text-sm dark:bg-slate-800"><option value="advance">Adiantamento salarial</option><option value="vale">Vale</option><option value="loan">Empréstimo (parcela)</option></select><input required type="number" min="0.01" step="0.01" value={adjustmentAmount} onChange={e=>setAdjustmentAmount(e.target.value)} placeholder="Valor (R$)" className="rounded-xl border p-3 text-sm dark:bg-slate-800"/><input required type="date" value={adjustmentDate} onChange={e=>setAdjustmentDate(e.target.value)} className="rounded-xl border p-3 text-sm dark:bg-slate-800"/></div><div className="flex flex-wrap gap-2"><input value={adjustmentDescription} onChange={e=>setAdjustmentDescription(e.target.value)} placeholder="Descrição / referência / nº parcela" className="min-w-48 flex-1 rounded-xl border p-3 text-sm dark:bg-slate-800"/><button className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white">Registrar desconto</button></div></form>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="hidden print:flex items-center gap-4 border-b border-slate-300 p-5"><img src={logoImg} alt="Anacleto Esquadrias" className="h-14 w-28 object-contain"/><div><p className="text-[10px] font-bold tracking-widest text-slate-500">ANACLETO ESQUADRIAS</p><h1 className="text-lg font-bold text-slate-900">Folha de Pagamento — {month}</h1></div></div><div className="flex flex-wrap items-center justify-between gap-2 border-b p-5 dark:border-slate-700"><h2 className="flex items-center gap-2 font-bold"><Calculator className="h-4 w-4 text-blue-600"/> Resumo da folha — {month}</h2><button onClick={()=>window.print()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><FileSpreadsheet className="h-4 w-4"/> Imprimir / PDF</button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Funcionário","Horas normais","HE 50%","HE 100%","Salário base","Adicionais","Faltas/atrasos","Adiantamentos","Vales","Empréstimos","Líquido estimado","Pago na competência","Ações"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{summary.map(e=><tr key={e.id} className="border-t dark:border-slate-700"><td className="p-3"><b>{e.name}</b><div className="text-xs text-slate-500">{e.role} · CPF {e.cpf || "não informado"}</div></td><td className="p-3">{e.normal.toFixed(2)} h</td><td className="p-3">{money(e.extra50)}</td><td className="p-3">{money(e.extra100)}</td><td className="p-3">{money(e.salary)}</td><td className="p-3">{money(e.additionsAmount)}</td><td className="p-3">{money(e.deductionsAttendance)}</td><td className="p-3">{money(e.advances)}</td><td className="p-3">{money(e.vales)}</td><td className="p-3">{money(e.loans)}</td><td className="p-3 font-bold">{money(e.estimated)}</td><td className="p-3"><span className={e.paidAmount >= e.estimated ? "font-bold text-emerald-700" : "font-semibold text-amber-700"}>{money(e.paidAmount)}</span><div className="text-xs text-slate-500">{e.paidAmount >= e.estimated ? "Quitado" : `Saldo: ${money(Math.max(0, e.estimated - e.paidAmount))}`}</div></td><td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>registerPayrollPayment(e)} disabled={e.paidAmount >= e.estimated} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Registrar pagamento</button><button type="button" onClick={()=>{setEditingEmployee(e);setEditName(e.name || "");setEditRole(e.role || "");setEditCpf(formatCPF(e.cpf || ""));setEditDepartment(e.department || "");setEditEmail(e.email || "");setEditPhone(e.phone || "");setEditAdmissionDate(e.admissionDate || "");setEditSalary(String(e.salary || ""));setEditHours(String(e.monthlyHours || 220));}} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-blue-700">Editar cadastro</button></div></td></tr>)}{!summary.length&&<tr><td colSpan={13} className="p-8 text-center text-slate-500">Cadastre funcionários para iniciar a folha.</td></tr>}</tbody></table></div>
    </section>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><ShieldCheck className="mr-1 inline h-4 w-4"/> <b>Critério de cálculo:</b> valor-hora = salário base ÷ jornada mensal; HE 50% = horas × valor-hora × 1,5; HE 100% = horas × valor-hora × 2. Faltas e atrasos são estimados pelo valor-hora. O resultado ainda não é folha legal: INSS, IRRF, FGTS, DSR, férias, 13º, adicionais legais e convenções coletivas dependem de tabelas vigentes e regras aplicáveis, que precisam ser validadas pela contabilidade. Valores arredondados em centavos.</div>
    {editingEmployee && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveSalary} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div><h3 className="text-lg font-black">Editar funcionário</h3><p className="text-sm text-slate-500">Atualize os dados cadastrais e a remuneração.</p></div><label className="block text-xs font-semibold text-slate-500">Nome completo<input autoFocus required value={editName} onChange={e=>setEditName(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">CPF<input value={editCpf} onChange={e=>setEditCpf(formatCPF(e.target.value))} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">Cargo / função<input value={editRole} onChange={e=>setEditRole(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">Departamento<input value={editDepartment} onChange={e=>setEditDepartment(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">E-mail<input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">Telefone<input value={editPhone} onChange={e=>setEditPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">Data de admissão<input type="date" value={editAdmissionDate} onChange={e=>setEditAdmissionDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">Novo salário base (R$)<input type="number" min="0.01" step="0.01" required value={editSalary} onChange={e=>setEditSalary(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><label className="block text-xs font-semibold text-slate-500">Jornada mensal (horas)<input type="number" min="1" max="300" required value={editHours} onChange={e=>setEditHours(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-slate-800"/></label><p className="text-xs text-amber-700">Nome, função, salário e jornada são atualizados no cadastro. Os pagamentos já registrados permanecem no histórico com os dados da época.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditingEmployee(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={savingSalary} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingSalary ? "Salvando..." : "Salvar alterações"}</button></div></form></div>}
    <style>{`@media print { button, form, header label { display:none !important; } body { background:white !important; } }`}</style>
  </div>;
}
