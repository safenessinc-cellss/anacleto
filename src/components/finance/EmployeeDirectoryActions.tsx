import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { RefreshCw, UserPlus, X } from "lucide-react";
import { auth, db } from "../../firebase";

export default function EmployeeDirectoryActions({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    const baseSalary = Number(salary);
    if (!name.trim() || !Number.isFinite(baseSalary) || baseSalary <= 0) {
      setError("Informe nome e salário base maior que zero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "employees"), {
        name: name.trim(),
        role: role.trim(),
        salary: Math.round(baseSalary * 100) / 100,
        pixKey: pixKey.trim(),
        active: true,
        additions: [],
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || "",
      });
      setName("");
      setRole("");
      setSalary("");
      setPixKey("");
      setOpen(false);
    } catch (reason) {
      setError(`Não foi possível cadastrar o funcionário: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => { setError(""); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
        <UserPlus className="h-4 w-4"/> + Novo Funcionário
      </button>
      <button type="button" onClick={onSync} disabled={syncing} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}/>{syncing ? "Sincronizando..." : "Sincronizar Cadastros"}
      </button>
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={createEmployee} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">Novo Funcionário</h3><p className="text-sm text-slate-500">O cadastro será compartilhado entre Folha, Vales e Pagamentos.</p></div><button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></button></div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <label className="block text-xs font-semibold text-slate-500">Nome completo<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="block text-xs font-semibold text-slate-500">Cargo / função<input value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="block text-xs font-semibold text-slate-500">Salário base (R$)<input required type="number" min="0.01" step="0.01" value={salary} onChange={(event) => setSalary(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="block text-xs font-semibold text-slate-500">Chave PIX<input value={pixKey} onChange={(event) => setPixKey(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : "Cadastrar funcionário"}</button></div>
      </form>
    </div>}
  </>;
}
