import React, { useState, useEffect } from "react";
import { DollarSign, Plus, Trash, ArrowDownLeft, ArrowUpRight, TrendingUp, Receipt, Calendar, Sparkles } from "lucide-react";
import { Invoice } from "../types";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

interface LedgerTabProps {
  invoices: Invoice[];
  t: any;
}

interface LedgerEntry {
  id: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
}

export default function LedgerTab({ invoices, t }: LedgerTabProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Matéria-Prima Alumínio");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch persistent expenses from firestore, then combine dynamically with closed invoices
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "ledger_entries"), orderBy("date", "desc")),
      (snapshot) => {
        const loaded: LedgerEntry[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as LedgerEntry);
        });

        // Map closed invoices as income automatically to generate a unified financial ledger
        const invoiceIncomeEntries: LedgerEntry[] = invoices.map((inv) => ({
          id: `inv_flow_${inv.id}`,
          description: `Fatura Paga: ${inv.clientName} (${inv.number})`,
          type: "income",
          category: "Receita de Projetos",
          amount: inv.total || 0,
          date: inv.date || new Date().toISOString().split("T")[0],
        }));

        // Merge and sort everything by latest date
        const combined = [...loaded, ...invoiceIncomeEntries];
        combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(combined);
      },
      (err) => console.warn("Ledger tracking permissions error: ", err)
    );

    return () => unsub();
  }, [invoices]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert("Por favor preencha todos os campos obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      const entryId = "led_" + Math.random().toString(36).substring(2);
      const docRef = doc(db, "ledger_entries", entryId);
      
      const newEntry: LedgerEntry = {
        id: entryId,
        description,
        type,
        category,
        amount,
        date,
      };

      await setDoc(docRef, newEntry);
      setIsAdding(false);
      setDescription("");
      setAmount(0);
    } catch (err) {
      console.error(err);
      alert("Não foi possível salvar o lançamento contábil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (id.startsWith("inv_flow_")) {
      alert("Lançamento automático de receita faturada não pode ser deletado manualmente. Delete ou edite a fatura na aba de faturas.");
      return;
    }

    if (!confirm("Tem certeza que deseja deletar este lançamento contábil?")) return;

    try {
      await deleteDoc(doc(db, "ledger_entries", id));
    } catch (err) {
      console.error(err);
      alert("Falha ao remover o registro.");
    }
  };

  const calculateFinancialTotals = () => {
    const totalIncome = entries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = entries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "0.0";
    return { totalIncome, totalExpenses, netBalance, profitMargin };
  };

  const { totalIncome, totalExpenses, netBalance, profitMargin } = calculateFinancialTotals();

  // Simple quick expense templates for the admin
  const handleInsertTemplate = async (tmplDesc: string, tmplCat: string, tmplAmt: number) => {
    try {
      const entryId = "led_" + Math.random().toString(36).substring(2);
      const docRef = doc(db, "ledger_entries", entryId);
      await setDoc(docRef, {
        id: entryId,
        description: tmplDesc,
        type: "expense",
        category: tmplCat,
        amount: tmplAmt,
        date: new Date().toISOString().split("T")[0],
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-55/30 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-luxury-gold" />
            Controladoria e Razão Financeiro da Empresa
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhe o faturamento automatizado de faturas em tempo real e insira despesas operacionais da fábrica.
          </p>
        </div>
        
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-4 py-2 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 text-xs font-black uppercase rounded-xl transition shadow-sm cursor-pointer ml-auto"
        >
          <Plus className="w-4 h-4" />
          {isAdding ? "Fechar Painel" : "Lançar Despesa da Fábrica"}
        </button>
      </div>

      {/* Grid summarizing balance, income, expenses and margins */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <ArrowUpRight className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Faturamento Bruto</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-emerald-400 font-mono">
            R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Faturado em faturas pagas</span>
        </div>

        <div className="p-4 bg-rose-500/[0.04] border border-rose-500/20 rounded-2xl">
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Custos Operacionais</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-rose-450 font-mono">
            R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Silicone, perfis, vidro, logística</span>
        </div>

        <div className={`p-4 rounded-2xl border ${netBalance >= 0 ? "bg-luxury-gold/[0.04] border-luxury-gold/20" : "bg-rose-500/[0.08] border-rose-450/30"}`}>
          <div className="flex items-center gap-2 text-luxury-gold dark:text-luxury-gold-light mb-1">
            <DollarSign className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Resultado Líquido</span>
          </div>
          <p className={`text-xl font-black font-mono ${netBalance >= 0 ? "text-luxury-gold" : "text-rose-600 dark:text-rose-500"}`}>
            R$ {netBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Margem líquida de lucro: {profitMargin}%</span>
        </div>

        <div className="p-4 bg-amber-500/[0.04] border border-amber-500/20 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Margem de Lucro</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-amber-500 font-mono">
            {profitMargin}%
          </p>
          <span className="text-[10px] text-slate-400">Eficiência de geração real</span>
        </div>
      </div>

      {/* Adding Ledger Record layout */}
      {isAdding && (
        <form onSubmit={handleCreateEntry} className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-100 tracking-wider">Novo Lançamento Financeiro Manual</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Descrição Comercial</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Aquisição de 10 perfis de Alumínio Supra Alcoa"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-950 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Valor Unitário (R$)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0.1"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-950 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Competência</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-950 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Tipo Fluxo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-950 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
              >
                <option value="expense">Despesa Operacional (-)</option>
                <option value="income">Receita de Serviços Exclusiva (+)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Categoria Contábil</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-950 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
              >
                <option value="Matéria-Prima Alumínio">Matéria-Prima Alumínio</option>
                <option value="Placas Vidros de Segurança">Placas Vidros de Segurança</option>
                <option value="Componentes e Ferragens">Componentes e Ferragens</option>
                <option value="Logística & Combustível Frota">Logística & Combustível Frota</option>
                <option value="Mão de Obra Montagem">Mão de Obra Fábrica / Montagem</option>
                <option value="Marketing & Anúncios">Marketing & Anúncios</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl text-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 rounded-xl font-black transition disabled:opacity-45 cursor-pointer"
            >
              {isSaving ? "Gravando..." : "Registrar Lançamento"}
            </button>
          </div>
        </form>
      )}

      {/* Fast Preset inserts */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
        <h4 className="text-xs font-black text-slate-550 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Modelos Rápidos de Despesas Comuns
        </h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleInsertTemplate("Compra Perfis Alumínio Suprema (Alcoa Lda)", "Matéria-Prima Alumínio", 1540)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-lg border border-slate-250 dark:border-slate-800 transition cursor-pointer"
          >
            📦 Lote Alumínio Suprema (-R$1.540)
          </button>
          <button
            type="button"
            onClick={() => handleInsertTemplate("Placas Vidro Laminado 10mm Duplo Saint-Gobain", "Placas Vidros de Segurança", 2430)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-lg border border-slate-250 dark:border-slate-800 transition cursor-pointer"
          >
            🔮 Lote Vidros Saint-Gobain (-R$2.430)
          </button>
          <button
            type="button"
            onClick={() => handleInsertTemplate("Kit Fechaduras Inox, Roldanas e Vedadores", "Componentes e Ferragens", 420)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-lg border border-slate-250 dark:border-slate-800 transition cursor-pointer"
          >
            ⚙️ Roldanas & Ferragens (-R$420)
          </button>
          <button
            type="button"
            onClick={() => handleInsertTemplate("Manutenção e Afiação Disco de Corte CNC Alumínio", "Componentes e Ferragens", 350)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-lg border border-slate-250 dark:border-slate-800 transition cursor-pointer"
          >
            🔧 CNC Afiação Disco (-R$350)
          </button>
        </div>
      </div>

      {/* Ledger Table listing dynamic elements */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 overflow-hidden">
        <div className="p-4 bg-slate-55/40 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-450 tracking-wider">Lançamentos Contábeis</span>
          <span className="text-[10px] font-bold text-slate-400">Faturamento Real + Lançamentos Manuais</span>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Nenhum lançamento no livro razão disponível.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="px-5 py-3">Visual / Data</th>
                  <th className="px-5 py-3">Lançamento / Descrição</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3 text-right">Montante (EUR)</th>
                  <th className="px-5 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/65">
                {entries.map((entry) => {
                  const isIncome = entry.type === "income";
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition">
                      <td className="px-5 py-3.5 space-y-0.5">
                        <span className={`inline-flex items-center gap-1 font-bold ${isIncome ? "text-emerald-550" : "text-rose-500"}`}>
                          {isIncome ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          {isIncome ? "RECEITA" : "DESPESA"}
                        </span>
                        <div className="text-[9px] text-slate-400 font-medium font-mono">{entry.date}</div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {entry.description}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-semibold">
                        {entry.category}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-black font-mono text-sm ${isIncome ? "text-emerald-600" : "text-rose-500"}`}>
                        {isIncome ? "+" : "-"} R$ {entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {entry.id.startsWith("inv_flow_") ? (
                          <span className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-sm border border-emerald-400/20">Automatizado</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition"
                            title="Remover Despesa"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
