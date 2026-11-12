import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";

type DailyExpense = { id: string; description?: string; amount?: number; date?: string; category?: string; paymentMethod?: string; status?: string };
type Purchase = { id: string; number?: string; supplierName?: string; description?: string; expenseCategory?: string; status?: string; total?: number; issueDate?: string; inventoryPostedAt?: unknown; stockIncluded?: boolean };
type Payable = { id: string; purchaseId?: string; expenseCategory?: string };
type Ledger = { id: string; sourceType?: string; sourceId?: string; category?: string };

const categories = [
  ["fuel", "Combustível / Gasolina"],
  ["food", "Alimentação / Lanche"],
  ["quick_freight", "Frete / Transporte Rápido"],
  ["small_supplies", "Ferragens / Insumos Pequenos"],
  ["vehicle_maintenance", "Manutenção / Veículos"],
  ["fixed_bills", "Contas Fixas (Água, Luz, Internet, Parcela)"],
  ["other_daily", "Outras Despesas Diárias"],
] as const;
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DailyExpensesModule() {
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number][0]>("fuel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const watchers = [
      onSnapshot(collection(db, "daily_expenses"), (snap) => setExpenses(snap.docs.map((item) => ({ id: item.id, ...item.data() } as DailyExpense))), (reason) => setError(`Falha ao carregar gastos diários: ${reason.message}`)),
      onSnapshot(collection(db, "purchase_orders"), (snap) => setPurchases(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Purchase))), (reason) => setError(`Falha ao carregar compras para reclasificar: ${reason.message}`)),
      onSnapshot(collection(db, "payables"), (snap) => setPayables(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Payable))), (reason) => setError(`Falha ao carregar contas relacionadas: ${reason.message}`)),
      onSnapshot(collection(db, "ledger_entries"), (snap) => setLedger(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Ledger))), (reason) => setError(`Falha ao carregar lançamentos de caixa: ${reason.message}`)),
    ];
    return () => watchers.forEach((stop) => stop());
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0 || !date) {
      setError("Informe descrição, data e valor maior que zero.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const expenseRef = doc(collection(db, "daily_expenses"));
    const ledgerRef = doc(db, "ledger_entries", `daily-expense-${expenseRef.id}`);
    const now = new Date().toISOString();
    try {
      await runTransaction(db, async (transaction) => {
        transaction.set(expenseRef, {
          description: description.trim(), category, amount: Number(value.toFixed(2)), date,
          paymentMethod, status: "paid", createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "",
        });
        transaction.set(ledgerRef, {
          direction: "outflow", category: "daily_expense", expenseType: category,
          sourceType: "daily_expense", sourceId: expenseRef.id, description: description.trim(),
          amount: Number(value.toFixed(2)), date, paymentMethod, status: "posted",
          createdAt: now, createdBy: auth.currentUser?.email || "",
        });
      });
      setDescription("");
      setAmount("");
      setMessage("Lançado no Caixa Diário; nenhum item foi adicionado ao Estoque.");
    } catch (reason) {
      setError(`Não foi possível registrar o gasto: ${(reason as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const reclassify = async (purchase: Purchase) => {
    if (purchase.stockIncluded || purchase.inventoryPostedAt) {
      setError(`A compra ${purchase.number || purchase.id} já atualizou o Estoque. Corrija primeiro a movimentação de inventário.`);
      return;
    }
    const linkedPayables = payables.filter((item) => item.purchaseId === purchase.id);
    const linkedLedger = ledger.filter((item) => item.sourceType === "payable" && linkedPayables.some((payable) => payable.id === item.sourceId));
    const purchaseRef = doc(db, "purchase_orders", purchase.id);
    try {
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(purchaseRef);
        if (!current.exists()) throw new Error("A compra não está mais disponível.");
        if (current.data().stockIncluded || current.data().inventoryPostedAt) throw new Error("O Estoque foi atualizado desde que a lista abriu.");
        const payableRefs = linkedPayables.map((item) => doc(db, "payables", item.id));
        const ledgerRefs = linkedLedger.map((item) => doc(db, "ledger_entries", item.id));
        for (const ref of payableRefs) await transaction.get(ref);
        for (const ref of ledgerRefs) await transaction.get(ref);
        transaction.update(purchaseRef, { expenseCategory: "gastos_diarios", reclassifiedAt: serverTimestamp(), reclassifiedBy: auth.currentUser?.email || "" });
        payableRefs.forEach((ref) => transaction.update(ref, { expenseCategory: "gastos_diarios" }));
        ledgerRefs.forEach((ref) => transaction.update(ref, { category: "daily_expense", expenseType: "other_daily" }));
      });
      setMessage(`Compra ${purchase.number || purchase.id} reclasificada como Gasto Diário. Nenhuma quantidade de Estoque foi alterada.`);
      setError("");
    } catch (reason) {
      setError(`Não foi possível reclasificar a compra: ${(reason as Error).message}`);
    }
  };

  const candidates = useMemo(() => purchases.filter((purchase) => purchase.expenseCategory !== "gastos_diarios" &&
    `${purchase.number || ""} ${purchase.supplierName || ""} ${purchase.description || ""} ${purchase.expenseCategory || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (historyFilter === "all" || purchase.status === historyFilter)), [purchases, search, historyFilter]);

  return <section className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-violet-700">Saídas operacionais · fora do estoque</p><h2 className="text-2xl font-black">Gastos Diários</h2><p className="mt-1 text-sm text-slate-500">Cada gasto pago é lançado imediatamente no caixa e nunca movimenta o Almoxarifado.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <form onSubmit={save} className="grid gap-3 rounded-2xl border bg-white p-5 dark:bg-slate-900 sm:grid-cols-2">
      <h3 className="sm:col-span-2 text-lg font-black">Novo Gasto Diário</h3>
      <label className="text-xs font-semibold text-slate-600">Categoria<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800">{categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Valor (R$)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Descrição<input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: gasolina moto, parcela do carro, lubrificante" className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-600">Data do pagamento<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-600">Pago por<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></label>
      <button disabled={saving} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{saving ? "Lançando..." : "Lançar no Caixa Diário"}</button>
    </form>

    <section className="space-y-3 rounded-2xl border bg-white p-5 dark:bg-slate-900">
      <div><h3 className="text-lg font-black">Reclassificar despesas existentes</h3><p className="text-xs text-slate-500">Busque gasolina, parcela, frete, lubrificantes e ferragens já cadastrados em compras. Movimentações que já atualizaram o Estoque exigem correção do inventário antes da reclasificação.</p></div>
      <div className="flex flex-wrap gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar por descrição, fornecedor ou categoria..." className="min-w-60 flex-1 rounded-lg border p-2.5 text-sm dark:bg-slate-800"/><select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="rounded-lg border p-2.5 text-sm dark:bg-slate-800"><option value="all">Todos os status</option><option value="pending">Aguardando aprovação</option><option value="approved">Aprovadas</option><option value="received">Recebidas</option></select></div>
      <div className="space-y-2">{candidates.slice(0, 40).map((purchase) => <article key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-bold">{purchase.description || purchase.supplierName || "Despesa"} · {money(Number(purchase.total || 0))}</p><p className="text-xs text-slate-500">{purchase.number || purchase.id} · {purchase.supplierName || "Sem fornecedor"} · {purchase.expenseCategory || "sem categoria"} · {purchase.status || "—"}</p></div><button type="button" onClick={() => void reclassify(purchase)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold text-violet-800">Mover para Gastos Diários</button></article>)}{candidates.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhuma compra encontrada com este filtro.</p>}</div>
    </section>

    <section className="space-y-2"><h3 className="text-lg font-black">Histórico de Gastos Diários</h3>{expenses.length ? expenses.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((expense) => <article key={expense.id} className="flex flex-wrap justify-between gap-2 rounded-xl border bg-white p-3 dark:bg-slate-900"><div><p className="font-bold">{expense.description}</p><p className="text-xs text-slate-500">{categories.find(([id]) => id === expense.category)?.[1] || "Gasto Diário"} · {expense.date} · {expense.paymentMethod}</p></div><p className="font-black">{money(Number(expense.amount || 0))}</p></article>) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhum gasto diário registrado.</p>}</section>
  </section>;
}
