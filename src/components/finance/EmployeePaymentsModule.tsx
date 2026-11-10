import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { CheckCircle2, Clock3, CreditCard, Users } from "lucide-react";

type Employee = { id: string; name: string; role?: string; salary?: number; cpf?: string; email?: string; phone?: string; department?: string; admissionDate?: string; monthlyHours?: number; active?: boolean };
type EmployeePayment = {
  id: string; employeeId: string; employeeName: string; competence: string;
  amount: number; paymentDate: string; method: string; reference?: string; notes?: string;
  createdAt?: any; createdBy?: string;
};
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = new Date().toISOString().slice(0, 10);
const onlyDigits = (value: string) => value.replace(/\D/g, "");
const formatCPF = (value: string) => onlyDigits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const validCPF = (value: string) => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base: string, factor: number) => {
    let sum = 0; for (const char of base) sum += Number(char) * factor--;
    const rest = (sum * 10) % 11; return rest === 10 ? 0 : rest;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
};

export default function EmployeePaymentsModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [competence, setCompetence] = useState(today.slice(0, 7));
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState("pix");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editAdmissionDate, setEditAdmissionDate] = useState("");
  const [editMonthlyHours, setEditMonthlyHours] = useState("220");
  const [savingEmployee, setSavingEmployee] = useState(false);

  useEffect(() => {
    const stopEmployees = onSnapshot(collection(db, "employees"), snap =>
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)).filter(e => e.active !== false)),
      err => setError("Não foi possível carregar funcionários: " + err.message)
    );
    const stopPayments = onSnapshot(query(collection(db, "employee_payments"), orderBy("paymentDate", "desc")), snap =>
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeePayment))),
      err => setError("Não foi possível carregar pagamentos: " + err.message)
    );
    return () => { stopEmployees(); stopPayments(); };
  }, []);

  const selected = employees.find(e => e.id === employeeId);
  const monthPayments = useMemo(() => payments.filter(p => p.competence === competence), [payments, competence]);
  const totalPaid = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const beginEdit = (employee: Employee) => {
    setEditing(employee); setEditName(employee.name || ""); setEditRole(employee.role || "");
    setEditCpf(formatCPF(employee.cpf || "")); setEditSalary(String(employee.salary || ""));
    setEditEmail(employee.email || ""); setEditPhone(employee.phone || "");
    setEditDepartment(employee.department || ""); setEditAdmissionDate(employee.admissionDate || "");
    setEditMonthlyHours(String(employee.monthlyHours || 220));
  };

  const saveEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editName.trim() || !(Number(editSalary) > 0) || !(Number(editMonthlyHours) > 0)) { setError("Informe nome, salário e jornada mensal válidos."); return; }
    const cpfDigits = onlyDigits(editCpf);
    if (cpfDigits && !validCPF(cpfDigits)) { setError("O CPF informado é inválido."); return; }
    if (cpfDigits && employees.some(e => e.id !== editing.id && (e.cpf || "").replace(/\\D/g, "") === cpfDigits)) { setError("Já existe outro funcionário com este CPF."); return; }
    setSavingEmployee(true); setError("");
    try {
      await updateDoc(doc(db, "employees", editing.id), { name: editName.trim(), role: editRole.trim(), cpf: cpfDigits, salary: Math.round(Number(editSalary) * 100) / 100, email: editEmail.trim(), phone: editPhone.trim(), department: editDepartment.trim(), admissionDate: editAdmissionDate, monthlyHours: Number(editMonthlyHours), profileUpdatedAt: serverTimestamp(), profileUpdatedBy: auth.currentUser?.email || "" });
      setEditing(null);
    } catch (e) { setError("Não foi possível atualizar o funcionário: " + (e as Error).message); }
    finally { setSavingEmployee(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const value = Number(amount);
    if (!selected) return setError("Selecione um funcionário cadastrado na Folha de Pagamento.");
    if (!competence || !paymentDate || !Number.isFinite(value) || value <= 0) return setError("Informe competência, data e valor válido.");
    setSaving(true);
    try {
      await addDoc(collection(db, "employee_payments"), {
        employeeId: selected.id, employeeName: selected.name, employeeRole: selected.role || "",
        competence, amount: Math.round(value * 100) / 100, paymentDate, method,
        reference: reference.trim(), notes: notes.trim(), status: "paid",
        payrollSource: "employees", createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || ""
      });
      setAmount(""); setReference(""); setNotes("");
    } catch (e) {
      setError("Não foi possível registrar o pagamento: " + (e as Error).message);
    } finally { setSaving(false); }
  };

  return <div className="space-y-5 text-slate-800 dark:text-slate-100">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Folha de pagamento vinculada</p><h2 className="text-2xl font-black">Pagamento funcionário</h2><p className="mt-1 text-sm text-slate-500">Registre os valores efetivamente pagos aos funcionários cadastrados na Folha de Pagamento. O registro fica vinculado ao funcionário e à competência.</p></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><Users className="mb-2 text-blue-600"/><p className="text-xs text-slate-500">Funcionários ativos</p><strong className="text-2xl">{employees.length}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><CheckCircle2 className="mb-2 text-emerald-600"/><p className="text-xs text-slate-500">Pagamentos registrados na competência</p><strong className="text-2xl">{monthPayments.length}</strong></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><CreditCard className="mb-2 text-indigo-600"/><p className="text-xs text-slate-500">Total efetivamente pago</p><strong className="text-2xl">{money(totalPaid)}</strong></div>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-900">
      <div className="border-b p-4 dark:border-slate-700"><h3 className="font-bold">Salários base vinculados à Folha de Pagamento</h3><p className="text-xs text-slate-500">Valor atual do cadastro funcional; alterações são feitas na Folha de Pagamento e refletidas aqui.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Funcionário</th><th className="p-3">Função</th><th className="p-3 text-right">Salário base atual</th><th className="p-3 text-right">Pago na competência</th><th className="p-3 text-right">Diferença</th><th className="p-3">Cadastro</th></tr></thead><tbody>{employees.map(e=>{const paid=monthPayments.filter(p=>p.employeeId===e.id).reduce((s,p)=>s+Number(p.amount||0),0);const base=Number(e.salary||0);return <tr key={e.id} className="border-t dark:border-slate-700"><td className="p-3 font-semibold">{e.name}<div className="text-xs text-slate-500">CPF: {e.cpf || "não informado"}</div></td><td className="p-3 text-slate-500">{e.role||"—"}</td><td className="p-3 text-right font-semibold">{money(base)}</td><td className="p-3 text-right">{money(paid)}</td><td className="p-3 text-right">{money(base-paid)}</td><td className="p-3"><button type="button" onClick={()=>beginEdit(e)} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-blue-700">Editar funcionário</button></td></tr>;})}{!employees.length&&<tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum funcionário cadastrado na Folha.</td></tr>}</tbody></table></div>
    </section>
    <form onSubmit={save} className="grid gap-3 rounded-2xl border bg-white p-5 dark:bg-slate-900 sm:grid-cols-2">
      <h3 className="sm:col-span-2 font-bold">Registrar pagamento realizado</h3>
      <label className="text-xs font-semibold text-slate-500">Funcionário<select required value={employeeId} onChange={e => { setEmployeeId(e.target.value); const item=employees.find(x=>x.id===e.target.value); setAmount(item?.salary ? String(item.salary) : ""); }} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="">Selecione o funcionário</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.role || "Sem função"}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-500">Competência da folha<input required type="month" value={competence} onChange={e=>setCompetence(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Valor pago (R$)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Data do pagamento<input required type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Forma de pagamento<select value={method} onChange={e=>setMethod(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option><option value="cheque">Cheque</option><option value="outro">Outro</option></select></label>
      <label className="text-xs font-semibold text-slate-500">Comprovante / referência<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="ID da transferência ou comprovante" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      {selected && <p className="text-xs text-slate-500 sm:col-span-2">Salário base cadastrado na folha: {money(Number(selected.salary || 0))}. O valor acima representa o pagamento efetivo informado, não um cálculo automático de encargos.</p>}
      <div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Registrando..." : "Registrar pagamento"}</button></div>
    </form>
    <section className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 dark:border-slate-700"><h3 className="font-bold">Histórico de pagamentos</h3><label className="text-xs font-semibold">Competência <input type="month" value={competence} onChange={e=>setCompetence(e.target.value)} className="ml-2 rounded-lg border p-2 dark:bg-slate-800"/></label></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Funcionário</th><th className="p-3">Data</th><th className="p-3">Forma</th><th className="p-3">Referência</th><th className="p-3 text-right">Valor pago</th><th className="p-3">Status</th></tr></thead><tbody>{monthPayments.map(p=><tr key={p.id} className="border-t dark:border-slate-700"><td className="p-3 font-semibold">{p.employeeName}</td><td className="p-3">{p.paymentDate}</td><td className="p-3">{p.method}</td><td className="p-3">{p.reference || "—"}</td><td className="p-3 text-right font-bold">{money(p.amount)}</td><td className="p-3"><span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5"/> Pago</span></td></tr>)}{!monthPayments.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500"><Clock3 className="mx-auto mb-2"/>Nenhum pagamento registrado nesta competência.</td></tr>}</tbody></table></div>
    </section>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveEmployee} className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
      <div><h3 className="text-lg font-black">Editar cadastro do funcionário</h3><p className="text-xs text-slate-500">As alterações serão refletidas na Folha de Pagamento e nos próximos pagamentos.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Nome completo<input required value={editName} onChange={e=>setEditName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">CPF<input value={editCpf} onChange={e=>setEditCpf(formatCPF(e.target.value))} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">Cargo / função<input value={editRole} onChange={e=>setEditRole(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">Salário base (R$)<input required type="number" min="0.01" step="0.01" value={editSalary} onChange={e=>setEditSalary(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">E-mail<input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">Telefone<input value={editPhone} onChange={e=>setEditPhone(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">Departamento<input value={editDepartment} onChange={e=>setEditDepartment(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">Data de admissão<input type="date" value={editAdmissionDate} onChange={e=>setEditAdmissionDate(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold">Jornada mensal (horas)<input type="number" min="1" max="300" value={editMonthlyHours} onChange={e=>setEditMonthlyHours(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-slate-800"/></label>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={savingEmployee} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingEmployee ? "Salvando..." : "Salvar cadastro"}</button></div>
    </form></div>}
  </div>;
}
