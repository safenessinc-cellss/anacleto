import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import EmployeeDirectoryActions from "./EmployeeDirectoryActions";
import { useEmployeeDirectory } from "../../hooks/useEmployeeDirectory";

type Adjustment = { id: string; employeeId: string; employeeName?: string; competence: string; kind: string; amount: number; description?: string; date: string; status?: string };
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EmployeeAdvancesModule() {
  const { employees, error: directoryError, sync, syncing } = useEmployeeDirectory();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState<"advance" | "vale">("advance");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const competence = date.slice(0, 7);
  const employee = employees.find((item) => item.id === employeeId);
  const monthItems = useMemo(() => adjustments.filter((item) => item.competence === competence), [adjustments, competence]);
  const pendingTotal = monthItems.filter((item) => !["deducted", "settled"].includes(String(item.status || "").toLowerCase())).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  useEffect(() => {
    const stopAdjustments = onSnapshot(collection(db, "payroll_adjustments"), (snap) => setAdjustments(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Adjustment))), (reason) => setError(`Falha ao carregar adiantamentos de folha: ${reason.message}`));
    return () => stopAdjustments();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!employee || !Number.isFinite(value) || value <= 0 || !date) {
      setError("Informe funcionário, data e valor maior que zero.");
      return;
    }
    setSaving(true);
    setError("");
    const adjustmentRef = editingId ? doc(db, "payroll_adjustments", editingId) : doc(collection(db, "payroll_adjustments"));
    const ledgerRef = doc(db, "ledger_entries", `employee-advance-${adjustmentRef.id}`);
    try {
      await runTransaction(db, async (transaction) => {
        const adjustmentData = {
          employeeId, employeeName: employee.name, competence, kind, amount: Number(value.toFixed(2)),
          description: description.trim(), date, source: "finance_employee_advance",
          updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || "",
        };
        if (editingId) transaction.update(adjustmentRef, adjustmentData);
        else transaction.set(adjustmentRef, { ...adjustmentData, status: "pending_deduction", createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid || "" });
        transaction.set(ledgerRef, {
          direction: "outflow", category: "employee_advance", sourceType: "payroll_adjustment",
          sourceId: adjustmentRef.id, employeeId, employeeName: employee.name,
          description: `${kind === "vale" ? "Vale" : "Adiantamento"} · ${employee.name}${description.trim() ? ` · ${description.trim()}` : ""}`,
          amount: Number(value.toFixed(2)), date, status: "posted",
          ...(editingId ? { updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || "" } : { createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" }),
        }, { merge: true });
      });
      setAmount("");
      setDescription("");
      setEditingId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar o adiantamento.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Vales vinculados à folha</p><h2 className="text-2xl font-black">Adiantamentos de Funcionários</h2><p className="mt-1 text-sm text-slate-500">Cada lançamento reduz automaticamente o líquido da competência correspondente na Folha de Pagamento.</p></header>
    <EmployeeDirectoryActions onSync={() => { void sync(); }} syncing={syncing}/>
    {(error || directoryError) && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error || directoryError}</p>}
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Vales e adiantamentos ainda não baixados nesta competência ({competence})</p><p className="text-2xl font-black">{money(pendingTotal)}</p></div>
    <form onSubmit={save} className="grid gap-3 rounded-2xl border bg-white p-5 dark:bg-slate-900 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-500">Funcionário<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="">Selecione funcionário</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-500">Tipo<select value={kind} onChange={(event) => setKind(event.target.value as "advance" | "vale")} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="advance">Adiantamento salarial</option><option value="vale">Vale</option></select></label>
      <label className="text-xs font-semibold text-slate-500">Valor (R$)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Data do adiantamento<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Motivo / obra vinculada<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: vale para instalação na obra X" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : editingId ? "Salvar correção do adiantamento" : "Registrar vale para desconto na folha"}</button>{editingId && <button type="button" disabled={saving} onClick={() => { setEditingId(null); setEmployeeId(""); setKind("advance"); setAmount(""); setDate(new Date().toISOString().slice(0, 10)); setDescription(""); }} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancelar edição</button>}</div>
    </form>
    <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-slate-900"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase dark:bg-slate-800"><tr><th className="p-3">Funcionário</th><th className="p-3">Data / competência</th><th className="p-3">Tipo</th><th className="p-3">Motivo / obra</th><th className="p-3 text-right">Valor</th><th className="p-3">Situação</th><th className="p-3">Ações</th></tr></thead><tbody>{monthItems.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.employeeName || employees.find((entry) => entry.id === item.employeeId)?.name || "Funcionário"}</td><td className="p-3">{item.date} · {item.competence}</td><td className="p-3">{item.kind === "vale" ? "Vale" : "Adiantamento"}</td><td className="p-3">{item.description || "—"}</td><td className="p-3 text-right font-bold">{money(item.amount)}</td><td className="p-3">{["deducted", "settled"].includes(String(item.status || "").toLowerCase()) ? "Descontado na folha" : "Pendente de desconto"}</td><td className="p-3"><button type="button" disabled={saving || ["deducted", "settled"].includes(String(item.status || "").toLowerCase())} onClick={() => { setEditingId(item.id); setEmployeeId(item.employeeId); setKind(item.kind === "vale" ? "vale" : "advance"); setAmount(String(item.amount)); setDate(item.date || `${item.competence}-01`); setDescription(item.description || ""); document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Editar</button>{["deducted", "settled"].includes(String(item.status || "").toLowerCase()) && <p className="mt-1 text-[10px] text-slate-500">Já descontado</p>}</td></tr>)}{!monthItems.length&&<tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum lançamento nesta competência.</td></tr>}</tbody></table></div>
  </section>;
}
