import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { Plus, Trash2, Pencil, BriefcaseBusiness } from "lucide-react";

type WorkItem = { id: string; obra: string; servico: string; detalhe: string; valor: string; data: string };
type AdvanceItem = { id: string; data: string; valor: string; detalhe: string };
type SavedAdvance = { id: string; data: string; valor: number; detalhe: string };
type OutsourcedRecord = { id: string; nome: string; cpf?: string; competencia: string; data: string; itens: Array<{ obra: string; servico: string; detalhe: string; valor: number; data?: string }>; adiantamentos?: SavedAdvance[]; totalAdiantado?: number; saldoPendente?: number; total: number; status?: string };
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const newItem = (): WorkItem => ({ id: crypto.randomUUID(), obra: "", servico: "", detalhe: "", valor: "", data: today() });
const newAdvance = (): AdvanceItem => ({ id: crypto.randomUUID(), data: today(), valor: "", detalhe: "" });

export default function OutsourcedServicesModule() {
  const [records, setRecords] = useState<OutsourcedRecord[]>([]);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [competencia, setCompetencia] = useState(today().slice(0, 7));
  const [data, setData] = useState(today());
  const [itens, setItens] = useState<WorkItem[]>([newItem()]);
  const [adiantamentos, setAdiantamentos] = useState<AdvanceItem[]>([]);
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
  const monthPaid = monthRecords.reduce((sum, row) => sum + Number(row.totalAdiantado ?? (row.adiantamentos || []).reduce((a, p) => a + Number(p.valor || 0), 0)), 0);
  const obraTotals = useMemo(() => { const grouped = new Map<string, { total: number; count: number; dates: string[] }>(); monthRecords.forEach(row => row.itens.forEach(item => { const key = item.obra.trim() || "Obra não informada"; const current = grouped.get(key) || { total: 0, count: 0, dates: [] }; current.total += Number(item.valor || 0); current.count += 1; if (item.data) current.dates.push(item.data); grouped.set(key, current); })); return Array.from(grouped.entries()).sort((a,b) => a[0].localeCompare(b[0])); }, [monthRecords]);
  const paidNow = adiantamentos.reduce((sum, item) => sum + Math.max(0, Number(item.valor) || 0), 0);
  const balanceNow = Math.max(0, total - paidNow);
  const changeItem = (id: string, field: keyof Omit<WorkItem, "id">, value: string) => setItens(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));

  const reset = () => { setNome(""); setCpf(""); setCompetencia(today().slice(0, 7)); setData(today()); setItens([newItem()]); setAdiantamentos([]); setEditingId(""); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const validItems = itens.filter(item => item.obra.trim() && item.servico.trim() && Number(item.valor) > 0);
    if (!nome.trim() || !validItems.length || validItems.length !== itens.length) {
      setError("Informe o nome do prestador e, em cada linha, obra, serviço, data e valor maior que zero.");
      return;
    }
    if (paidNow > total) {
      setError("A soma dos abonos/adiantamentos não pode ser maior que o total dos serviços.");
      return;
    }
    if (adiantamentos.some(item => Number(item.valor) > 0 && !item.data)) {
      setError("Informe a data de cada abono ou adiantamento.");
      return;
    }
    setSaving(true); setError("");
    const payload = {
      nome: nome.trim(), cpf: cpf.trim(), competencia, data,
      itens: validItems.map(item => ({ obra: item.obra.trim(), servico: item.servico.trim(), detalhe: item.detalhe.trim(), valor: Number(Number(item.valor).toFixed(2)), data: item.data || data })),
      adiantamentos: adiantamentos.filter(item => Number(item.valor) > 0).map(item => ({ id: item.id, data: item.data, valor: Number(Number(item.valor).toFixed(2)), detalhe: item.detalhe.trim() })),
      total: Number(total.toFixed(2)), totalAdiantado: Number(paidNow.toFixed(2)), saldoPendente: Number(balanceNow.toFixed(2)), status: "posted",
      updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || "",
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, "payroll_outsourced_services", editingId), payload);
        await deleteDoc(doc(db, "ledger_entries", `outsourced-service-${editingId}`)).catch(() => undefined);
        const previousRecord = records.find(row => row.id === editingId);
        for (const previousPayment of previousRecord?.adiantamentos || []) if (previousPayment.id && !payload.adiantamentos.some(payment => payment.id === previousPayment.id)) await deleteDoc(doc(db, "ledger_entries", `outsourced-service-${editingId}-advance-${previousPayment.id}`));
        for (const payment of payload.adiantamentos) await setDoc(doc(db, "ledger_entries", `outsourced-service-${editingId}-advance-${payment.id}`), { direction: "outflow", category: "third_party_services", sourceType: "payroll_outsourced_services", sourceId: editingId, description: `Adiantamento · ${nome.trim()} · ${payment.detalhe || competencia}`, amount: payment.valor, date: payment.data, status: "posted", updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || "" }, { merge: true });
      } else {
        const created = await addDoc(collection(db, "payroll_outsourced_services"), { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
        for (const payment of payload.adiantamentos) await setDoc(doc(db, "ledger_entries", `outsourced-service-${created.id}-advance-${payment.id}`), { direction: "outflow", category: "third_party_services", sourceType: "payroll_outsourced_services", sourceId: created.id, description: `Adiantamento · ${nome.trim()} · ${payment.detalhe || competencia}`, amount: payment.valor, date: payment.data, status: "posted", createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
      }
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o lançamento.");
    } finally { setSaving(false); }
  };

  const edit = (row: OutsourcedRecord) => {
    setEditingId(row.id); setNome(row.nome); setCpf(row.cpf || ""); setCompetencia(row.competencia); setData(row.data);
    setItens(row.itens.map(item => ({ ...item, id: crypto.randomUUID(), valor: String(item.valor), data: item.data || row.data }))); setAdiantamentos((row.adiantamentos || []).map(item => ({ ...item, id: crypto.randomUUID(), valor: String(item.valor) })));
    document.getElementById("outsourced-services-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const remove = async (row: OutsourcedRecord) => {
    if (!window.confirm(`Excluir o lançamento de ${row.nome} no valor de ${money(row.total)}? O movimento correspondente no caixa também será removido.`)) return;
    try {
      await deleteDoc(doc(db, "payroll_outsourced_services", row.id));
      await deleteDoc(doc(db, "ledger_entries", `outsourced-service-${row.id}`));
      for (const payment of row.adiantamentos || []) if (payment.id) await deleteDoc(doc(db, "ledger_entries", `outsourced-service-${row.id}-advance-${payment.id}`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o lançamento."); }
  };

  return <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-slate-700 dark:bg-slate-900">
    <header className="flex items-start gap-3"><div className="rounded-xl bg-violet-100 p-3 text-violet-700"><BriefcaseBusiness/></div><div><p className="text-xs font-bold uppercase tracking-widest text-violet-700">Prestadores por obra</p><h2 className="text-xl font-black">Funcionários terceirizados</h2><p className="mt-1 text-sm text-slate-500">Cadastre o prestador e detalhe os serviços por obra. Cada adiantamento fica registrado separadamente com sua própria data; o saldo pendente é calculado automaticamente.</p></div></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Lançamentos na competência</p><strong className="text-xl">{monthRecords.length}</strong></div><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Total contratado</p><strong className="text-xl">{money(monthTotal)}</strong></div><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Total adiantado / pago</p><strong className="text-xl text-emerald-700">{money(monthPaid)}</strong></div><div className="rounded-xl border bg-white p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Saldo pendente</p><strong className="text-xl text-amber-700">{money(Math.max(0, monthTotal - monthPaid))}</strong></div></div>
    <form id="outsourced-services-form" onSubmit={save} className="space-y-4 rounded-xl border bg-white p-4 dark:bg-slate-800">
      <h3 className="font-bold">{editingId ? "Editar lançamento de terceiro" : "Novo lançamento de terceiro"}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Nome do prestador<input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
        <label className="text-xs font-semibold text-slate-500">CPF / CNPJ (opcional)<input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Documento" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
        <label className="text-xs font-semibold text-slate-500">Competência<input required type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
        <label className="text-xs font-semibold text-slate-500">Data do lançamento<input required type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900"/></label>
      </div>
      <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">Detalhamento por obra e serviço</h4><button type="button" onClick={() => setItens(current => [...current, newItem()])} className="inline-flex items-center gap-1 rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold text-violet-700"><Plus className="h-4 w-4"/>Adicionar obra / serviço</button></div>
        {itens.map((item, index) => <div key={item.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs text-slate-500">Obra / cliente<input required value={item.obra} onChange={e => changeItem(item.id, "obra", e.target.value)} placeholder="Nome da obra" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500">Serviço terceirizado<input required value={item.servico} onChange={e => changeItem(item.id, "servico", e.target.value)} placeholder="Ex.: instalação, montagem" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-1">Detalhes<input value={item.detalhe} onChange={e => changeItem(item.id, "detalhe", e.target.value)} placeholder="Quantidade / observação" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500">Data do serviço<input required type="date" value={item.data} onChange={e => changeItem(item.id, "data", e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500">Valor (R$)<input required type="number" min="0.01" step="0.01" value={item.valor} onChange={e => changeItem(item.id, "valor", e.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><div className="flex items-end justify-between gap-2"><strong className="pb-2 text-sm">{money(Number(item.valor) || 0)}</strong><button type="button" disabled={itens.length === 1} onClick={() => setItens(current => current.filter(row => row.id !== item.id))} aria-label={`Remover serviço ${index + 1}`} className="rounded-lg p-2 text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4"/></button></div></div>)}
      </div>
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">Abonos / adiantamentos</h4><button type="button" onClick={() => setAdiantamentos(current => [...current, newAdvance()])} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700"><Plus className="mr-1 inline h-4 w-4"/>Adicionar adiantamento</button></div>{adiantamentos.map((item, index) => <div key={item.id} className="grid gap-2 sm:grid-cols-3"><label className="text-xs text-slate-500">Data do pagamento<input type="date" value={item.data} onChange={e => setAdiantamentos(current => current.map(x => x.id === item.id ? {...x, data:e.target.value} : x))} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><label className="text-xs text-slate-500">Valor adiantado (R$)<input type="number" min="0.01" step="0.01" value={item.valor} onChange={e => setAdiantamentos(current => current.map(x => x.id === item.id ? {...x, valor:e.target.value} : x))} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/></label><div className="flex items-end gap-2"><input aria-label="Observação do adiantamento" value={item.detalhe} onChange={e => setAdiantamentos(current => current.map(x => x.id === item.id ? {...x, detalhe:e.target.value} : x))} placeholder="Observação" className="w-full rounded-lg border p-2 text-sm dark:bg-slate-900"/><button type="button" onClick={() => setAdiantamentos(current => current.filter(x => x.id !== item.id))} className="rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4"/></button></div></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div><p className="text-xs text-slate-500">Total dos serviços: {money(total)} · Adiantado: {money(paidNow)}</p><p className="text-2xl font-black text-violet-700">Saldo a pagar: {money(balanceNow)}</p></div><div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Registrar total"}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancelar</button>}</div></div>
    </form>
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-800"><h3 className="mb-3 font-bold">Total acumulado por obra na competência</h3>{obraTotals.length ? <div className="space-y-2">{obraTotals.map(([obra, info]) => <div key={obra} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"><div><b>{obra}</b><div className="text-xs text-slate-500">{info.count} serviço(s) · {info.dates.sort().join(", ") || "Sem data"}</div></div><strong>{money(info.total)}</strong></div>)}</div> : <p className="text-sm text-slate-500">Os totais por obra aparecerão após os lançamentos.</p>}</div>
    <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase dark:bg-slate-700"><tr><th className="p-3">Prestador</th><th className="p-3">Competência / data</th><th className="p-3">Obras e serviços / datas</th><th className="p-3 text-right">Total contratado</th><th className="p-3">Ações</th></tr></thead><tbody>{monthRecords.map(row => <tr key={row.id} className="border-t align-top"><td className="p-3 font-semibold">{row.nome}<div className="text-xs text-slate-500">{row.cpf || "Documento não informado"}</div></td><td className="p-3">{row.competencia}<div className="text-xs text-slate-500">{row.data}</div></td><td className="min-w-64 p-3">{row.itens.map((item, index) => <div key={index} className="mb-2 border-b pb-2 last:border-0"><b>{item.obra}</b> · {item.servico}<div className="text-xs text-slate-500">{item.data || row.data} · {item.detalhe} — {money(item.valor)}</div></div>)}<div className="mt-2 border-t pt-2 text-xs font-bold">Adiantado: {money(row.totalAdiantado ?? (row.adiantamentos || []).reduce((a,p) => a + Number(p.valor || 0),0))} · Pendente: {money(row.saldoPendente ?? Math.max(0, row.total - Number(row.totalAdiantado || 0)))}</div></td><td className="whitespace-nowrap p-3 text-right font-black">{money(row.total)}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => edit(row)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-blue-700"><Pencil className="inline h-3 w-3"/> Editar</button><button type="button" onClick={() => void remove(row)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-rose-700"><Trash2 className="inline h-3 w-3"/> Excluir</button></div></td></tr>)}{!monthRecords.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhum serviço terceirizado nesta competência.</td></tr>}</tbody></table></div>
  </section>;
}
