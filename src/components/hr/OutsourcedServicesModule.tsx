import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { Plus, Trash2, Pencil, BriefcaseBusiness } from "lucide-react";

type WorkItem = { id: string; obra: string; servico: string; detalhe: string; valor: string };
type OutsourcedRecord = { id: string; nome: string; cpf?: string; competencia: string; data: string; itens: Array<{ obra: string; servico: string; detalhe: string; valor: number }>; total: number; status?: string };
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const newItem = (): WorkItem => ({ id: crypto.randomUUID(), obra: "", servico: "", detalhe: "", valor: "" });

export default function OutsourcedServicesModule() {
  const [records, setRecords] = useState<OutsourcedRecord[]>([]);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [competencia, setCompetencia] = useState(today().slice(0, 7));
  const [data, setData] = useState(today());
  const [itens, setItens] = useState<WorkItem[]>([newItem()]);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stop = onSnapshot(collection(db, "payroll_outsourced_services"), snap => setRecords(snap.docs.map(row => ({ id: row.id, ...row.data() } as OutsourcedRecord))), reason => setError("Não foi possível carregar os serviços terceirizados: " + reason.message));
    return () => stop();
  }, []);

  const total = useMemo(() => itens.reduce((sum, item) => sum + Math.max(0, Number(item.valor) || 0), 0), [itens]);
  const monthRecords = records.filter(row => row.competencia === competencia).sort((a, b) => b.data.localeCompare(a.data));
  const monthTotal = monthRecords.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const changeItem = (id: string, field: keyof Omit<WorkItem, "id">, value: string) => setItens(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));

  const reset = () => { setNome(""); setCpf(""); setCompetencia(today().slice(0, 7)); setData(today()); setItens([newItem()]); setEditingId(""); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const validItems = itens.filter(item => item.obra.trim() && item.servico.trim() && Number(item.valor) > 0);
    if (!nome.trim() || !validItems.length || validItems.length !== itens.length) {
      setError("Informe o nome do prestador e, em cada linha, obra, serviço e valor maior que zero.");
      return;
    }
    setSaving(true); setError("");
    const payload = {
      nome: nome.trim(), cpf: cpf.trim(), competencia, data,
      itens: validItems.map(item => ({ obra: item.obra.trim(), servico: item.servico.trim(), detalhe: item.detalhe.trim(), valor: Number(Number(item.valor).toFixed(2)) })),
      total: Number(total.toFixed(2)), status: "posted",
      updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || "",
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, "payroll_outsourced_services", editingId), payload);
        await updateDoc(doc(db, "ledger_entries", `outsourced-service-${editingId}`), {
          direction: "outflow", category: "third_party_services", sourceType: "payroll_outsourced_services", sourceId: editingId,
          description: `Serviços terceirizados · ${nome.trim()} · ${competencia}`, amount: payload.total, date, status: "posted",
          updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || "",
        });
      } else {
        const created = await addDoc(collection(db, "payroll_outsourced_services"), { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "ledger_entries", `outsourced-service-${created.id}`), {
          direction: "outflow", category: "third_party_services", sourceType: "payroll_outsourced_services", sourceId: created.id,
          description: `Serviços terceirizados · ${nome.trim()} · ${competencia}`, amount: payload.total, date, status: "posted",
          createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "",
        });
      }
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o lançamento.");
    } finally { setSaving(false); }
  };

  const edit = (row: OutsourcedRecord) => {
    setEditingId(row.id); setNome(row.nome); setCpf(row.cpf || ""); setCompetencia(row.competencia); setData(row.data);
    setItens(row.itens.map(item => ({ ...item, id: crypto.randomUUID(), valor: String(item.valor) })));
    document.getElementById("outsourced-services-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const remove = async (row: OutsourcedRecord) => {
    if (!window.confirm(`Excluir o lançamento de ${row.nome} no valor de ${money(row.total)}? O movimento correspondente no caixa também será removido.`)) return;
    try {
      await deleteDoc(doc(db, "payroll_outsourced_services", row.id));
      await deleteDoc(doc(db, "ledger_entries", `outsourced-service-${row.id}`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o lançamento."); }
  };

  return <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-slate-700 dark:bg-slate-900">
    <header className="flex items-start gap-3"><div className="rounded-xl bg-violet-100 p-3 text-violet-700"><BriefcaseBusiness/></div><div><p className="text-xs font-bold uppercase tracking-widest text-violet-700">Prestadores por obra</p><h2 className="text-xl font-black">Funcionários terceirizados</h2><p className="mt-1 text-sm text-slate-500">Cadastre a pessoa uma única vez por lançamento e detalhe todos os serviços e obras. O sistema calcula um único total consolidado e registra uma única saída no caixa.</p></div></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Lançamentos na competência</p><strong className="text-xl">{monthRecords.length}</strong></div><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Total terceirizados</p><strong className="text-xl">{money(monthTotal)}</strong></div><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Obras / serviços detalhados</p><strong className="text-xl">{monthRecords.reduce((sum, row) => sum + row.itens.length, 0)}</strong></div></div>
    <form id="outsourced-services-form" onSubmit={save} className="space-y-4 rounded-xl border bg-white p-4 dark:bg-slate-800">
      <h3 className="font-bold">{editingId ? "Editar lançamento de terceiro" : "Novo lançamento de terceiro"}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Nome do prestador<input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
        <label className="text-xs font-semibold text-slate-500">CPF / CNPJ (opcional)<input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Documento" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
        <label className="text-xs font-semibold text-slate-500">Competência<input required type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
        <label className="text-xs font-semibold text-slate-500">Data do lançamento<input required type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
      </div>
      <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">Detalhamento por obra e serviço</h4><button type="button" onClick={() => setItens(current => [...current, newItem()])} className="inline-flex items-center gap-1 rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold text-violet-700"><Plus className="h-4 w-4"/>Adicionar obra / serviço</button></div>
        {itens.map((item, index) => <div key={item.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs text-slate-500">Obra / cliente<input required value={item.obra} onChange={e => changeItem(item.id, "obra", e.target.value)} placeholder="Nome da obra" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500">Serviço terceirizado<input required value={item.servico} onChange={e => changeItem(item.id, "servico", e.target.value)} placeholder="Ex.: instalação, montagem" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-1">Detalhes<input value={item.detalhe} onChange={e => changeItem(item.id, "detalhe", e.target.value)} placeholder="Quantidade / observação" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500">Valor (R$)<input required type="number" min="0.01" step="0.01" value={item.valor} onChange={e => changeItem(item.id, "valor", e.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><div className="flex items-end justify-between gap-2"><strong className="pb-2 text-sm">{money(Number(item.valor) || 0)}</strong><button type="button" disabled={itens.length === 1} onClick={() => setItens(current => current.filter(row => row.id !== item.id))} aria-label={`Remover serviço ${index + 1}`} className="rounded-lg p-2 text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4"/></button></div></div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div><p className="text-xs text-slate-500">Valor único consolidado do prestador</p><p className="text-2xl font-black text-violet-700">{money(total)}</p></div><div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Registrar total"}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancelar</button>}</div></div>
    </form>
    <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase dark:bg-slate-700"><tr><th className="p-3">Prestador</th><th className="p-3">Competência / data</th><th className="p-3">Obras e serviços</th><th className="p-3 text-right">Total único</th><th className="p-3">Ações</th></tr></thead><tbody>{monthRecords.map(row => <tr key={row.id} className="border-t align-top"><td className="p-3 font-semibold">{row.nome}<div className="text-xs text-slate-500">{row.cpf || "Documento não informado"}</div></td><td className="p-3">{row.competencia}<div className="text-xs text-slate-500">{row.data}</div></td><td className="min-w-64 p-3">{row.itens.map((item, index) => <div key={index} className="mb-2 border-b pb-2 last:border-0"><b>{item.obra}</b> · {item.servico}<div className="text-xs text-slate-500">{item.detalhe} — {money(item.valor)}</div></div>)}</td><td className="whitespace-nowrap p-3 text-right font-black">{money(row.total)}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => edit(row)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-blue-700"><Pencil className="inline h-3 w-3"/> Editar</button><button type="button" onClick={() => void remove(row)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-rose-700"><Trash2 className="inline h-3 w-3"/> Excluir</button></div></td></tr>)}{!monthRecords.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhum serviço terceirizado nesta competência.</td></tr>}</tbody></table></div>
  </section>;
}
