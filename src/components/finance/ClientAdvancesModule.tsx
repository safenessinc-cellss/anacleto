import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { sanitizeFirestoreData } from "../../utils/firestorePayloads";

type QuoteRow = { id: string; number?: string; clientName?: string; total?: number; clientAdvanceTotal?: number; depositAmount?: number; advancePaid?: number; sinal?: number; entrada?: number; balanceDue?: number; status?: string; projectId?: string; updatedAt?: string };
type Advance = { id: string; quoteId: string; quoteNumber: string; clientName: string; amount: number; date: string; method: string; status: string; projectId?: string; sourceId?: string; sourceType?: string };
type LedgerRow = { id: string; amount?: number; date?: string; status?: string; direction?: string; category?: string; sourceType?: string; sourceId?: string; quoteId?: string; projectId?: string; description?: string; paymentMethod?: string };
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const advanceKey = (row: { projectId?: string; quoteId?: string; id: string }) => row.projectId || row.quoteId || row.id;
const storedSignal = (row: QuoteRow) => Math.max(0, ...[row.clientAdvanceTotal, row.depositAmount, row.advancePaid, row.sinal, row.entrada].map(Number).filter(Number.isFinite));

export default function ClientAdvancesModule() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [budgets, setBudgets] = useState<QuoteRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [amount, setAmount] = useState("");
  const [releasePercent, setReleasePercent] = useState("40");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("pix");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stopQuotes = onSnapshot(collection(db, "quotes"), (snap) => setQuotes(snap.docs.map((item) => ({ id: item.id, ...item.data() } as QuoteRow))), (reason) => setError(`Falha ao carregar orçamentos: ${reason.message}`));
    const stopBudgets = onSnapshot(collection(db, "budgets"), (snap) => setBudgets(snap.docs.map((item) => ({ id: item.id, ...item.data() } as QuoteRow))), (reason) => setError(`Falha ao carregar orçamentos históricos: ${reason.message}`));
    const stopAdvances = onSnapshot(collection(db, "client_advances"), (snap) => setAdvances(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Advance))), (reason) => setError(`Falha ao carregar sinais de clientes: ${reason.message}`));
    const stopLedger = onSnapshot(collection(db, "ledger_entries"), (snap) => setLedger(snap.docs.map((item) => ({ id: item.id, ...item.data() } as LedgerRow))), (reason) => setError(`Falha ao carregar recebimentos históricos: ${reason.message}`));
    return () => { stopQuotes(); stopBudgets(); stopAdvances(); stopLedger(); };
  }, []);

  const eligibleQuotes = useMemo(() => quotes.filter((quote) => ["approved", "aprovado", "accepted", "invoiced"].includes(String(quote.status || "").toLowerCase())), [quotes]);
  const selected = eligibleQuotes.find((quote) => quote.id === quoteId);
  const due = selected ? Math.max(0, Number(selected.total || 0) - Number(selected.clientAdvanceTotal || 0)) : 0;
  const visibleAdvances = useMemo(() => {
    const registered = advances.map((row) => ({
      ...row,
      quoteId: row.quoteId || "",
      quoteNumber: row.quoteNumber || row.quoteId || "",
      clientName: row.clientName || "Cliente",
      date: row.date || "",
      method: row.method || "—",
    }));
    const advanceIds = new Set(registered.map((row) => row.id));
    const ledgerSignals = ledger.filter((row) => !["cancelled", "cancelado", "void", "estornado"].includes(String(row.status || "").toLowerCase()) &&
      ["inflow", "income", "in", "entrada"].includes(String(row.direction || "").toLowerCase()) &&
      (row.category === "customer_advance" || row.sourceType === "client_advance" || /sinal|adiantamento/i.test(row.description || "")));
    const additionalLedger = ledgerSignals.filter((row) => !advanceIds.has(row.sourceId || row.id)).map((row): Advance => ({
      id: `ledger:${row.id}`,
      quoteId: row.quoteId || "",
      quoteNumber: row.quoteId || "",
      clientName: row.description || "Sinal histórico",
      amount: Number(row.amount || 0),
      date: row.date || "",
      method: row.paymentMethod || "—",
      status: row.status || "received",
      projectId: row.projectId,
      sourceId: row.sourceId,
      sourceType: "ledger",
    })).filter((row) => row.amount > 0);

    const knownByReference = new Map<string, number>();
    for (const row of [...registered, ...additionalLedger]) {
      const key = advanceKey(row);
      knownByReference.set(key, (knownByReference.get(key) || 0) + Number(row.amount || 0));
    }
    const storedByReference = new Map<string, { amount: number; row: QuoteRow }>();
    for (const row of [...quotes, ...budgets]) {
      const amount = storedSignal(row);
      if (!amount) continue;
      const key = advanceKey(row);
      const current = storedByReference.get(key);
      if (!current || amount > current.amount) storedByReference.set(key, { amount, row });
    }
    const legacy = [...storedByReference.entries()].flatMap(([key, stored]) => {
      const missing = Math.max(0, stored.amount - (knownByReference.get(key) || 0));
      if (!missing) return [];
      const quote = stored.row;
      return [{
        id: `historical:${key}`,
        quoteId: quote.id,
        quoteNumber: quote.number || quote.id,
        clientName: quote.clientName || "Cliente",
        amount: missing,
        date: quote.updatedAt || "",
        method: "Histórico",
        status: "received",
        projectId: quote.projectId,
        sourceType: "legacy",
      } satisfies Advance];
    });
    return [...registered, ...additionalLedger, ...legacy]
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [advances, budgets, ledger, quotes]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    const threshold = Number(releasePercent);
    if (!selected || !Number.isFinite(value) || value <= 0 || value > due || !Number.isFinite(threshold) || threshold < 1 || threshold > 100 || !date) {
      setError("Selecione um orçamento e informe sinal válido, percentual de liberação (1–100%) e data.");
      return;
    }
    setSaving(true);
    setError("");
    const quoteRef = doc(db, "quotes", selected.id);
    const advanceRef = doc(collection(db, "client_advances"));
    const ledgerRef = doc(db, "ledger_entries", `client-advance-${advanceRef.id}`);
    const projectRef = selected.projectId ? doc(db, "projects", selected.projectId) : null;
    try {
      await runTransaction(db, async (transaction) => {
        const quoteSnapshot = await transaction.get(quoteRef);
        const projectSnapshot = projectRef ? await transaction.get(projectRef) : null;
        if (!quoteSnapshot.exists()) throw new Error("O orçamento selecionado não está mais disponível.");
        const quote = quoteSnapshot.data();
        const total = Number(quote.total || 0);
        const received = Number(quote.clientAdvanceTotal || 0);
        const nextReceived = Number((received + value).toFixed(2));
        if (value > total - received) throw new Error("O sinal excede o saldo pendente atualizado do orçamento.");
        const releaseTarget = total * threshold / 100;
        const releaseForProduction = nextReceived >= releaseTarget;
        const advanceData = {
          quoteId: selected.id, quoteNumber: String(quote.number || ""), projectId: String(quote.projectId || ""),
          clientName: String(quote.clientName || ""), amount: value, date, method, status: "received",
          releasePercent: threshold, createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "",
        };
        transaction.set(advanceRef, sanitizeFirestoreData(advanceData));
        transaction.set(ledgerRef, sanitizeFirestoreData({
          direction: "inflow", category: "customer_advance", sourceType: "client_advance",
          sourceId: advanceRef.id, quoteId: selected.id, projectId: String(quote.projectId || ""),
          description: `Sinal de produção · ${quote.number || selected.id} · ${quote.clientName || "Cliente"}`,
          amount: value, date, status: "posted", paymentMethod: method, createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.email || "",
        }));
        transaction.update(quoteRef, sanitizeFirestoreData({
          clientAdvanceTotal: nextReceived, balanceDue: Number(Math.max(0, total - nextReceived).toFixed(2)),
          productionStatus: releaseForProduction ? "released_for_production" : "awaiting_advance",
          updatedAt: serverTimestamp(),
        }));
        if (projectRef && projectSnapshot?.exists() && releaseForProduction) {
          transaction.update(projectRef, sanitizeFirestoreData({ productionStatus: "released_for_production", updatedAt: serverTimestamp() }));
        }
      });
      setAmount("");
      setQuoteId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar o sinal.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Sinal vinculado à obra</p><h2 className="text-2xl font-black">Adiantamentos de Clientes</h2><p className="mt-1 text-sm text-slate-500">O sinal é registrado no caixa e reduz o saldo do orçamento. Ao atingir o percentual combinado, a obra é liberada para produção.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <form onSubmit={save} className="grid gap-3 rounded-2xl border bg-white p-5 dark:bg-slate-900 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Orçamento / projeto<select required value={quoteId} onChange={(event) => setQuoteId(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="">Selecione orçamento aprovado</option>{eligibleQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.number || quote.id} · {quote.clientName || "Cliente"} · saldo {money(Math.max(0, Number(quote.total || 0) - Number(quote.clientAdvanceTotal || 0)))}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-500">Valor do sinal (R$)<input required type="number" min="0.01" step="0.01" max={due} value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Liberação para produção (%)<input required type="number" min="1" max="100" step="1" value={releasePercent} onChange={(event) => setReleasePercent(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Data do recebimento<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option></select></label>
      {selected && <p className="text-sm font-bold text-slate-700 dark:text-slate-200 sm:col-span-2">Saldo pendente: {money(due)}{Number(amount) > 0 ? ` · após este sinal: ${money(Math.max(0, due - Number(amount)))}` : ""}</p>}
      <button disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{saving ? "Registrando..." : "Registrar sinal e atualizar saldo da obra"}</button>
    </form>
    <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-slate-900"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase dark:bg-slate-800"><tr><th className="p-3">Data</th><th className="p-3">Cliente / obra</th><th className="p-3">Orçamento</th><th className="p-3">Forma</th><th className="p-3 text-right">Sinal</th></tr></thead><tbody>{visibleAdvances.map((advance)=><tr key={advance.id} className="border-t"><td className="p-3">{advance.date || "—"}</td><td className="p-3">{advance.clientName}</td><td className="p-3">{advance.quoteNumber}</td><td className="p-3">{advance.method}</td><td className="p-3 text-right font-bold">{money(advance.amount)}</td></tr>)}{!visibleAdvances.length&&<tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhum sinal registrado.</td></tr>}</tbody></table></div>
  </section>;
}
