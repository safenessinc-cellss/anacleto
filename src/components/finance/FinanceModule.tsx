import React, { useState } from "react";
import { Building, Building2, TrendingDown, TrendingUp } from "lucide-react";
import SuppliersModule from "./SuppliersModule";
import PayablesModule from "./PayablesModule";
import ReceivablesModule from "./ReceivablesModule";

type FinanceTab = "payables" | "receivables" | "suppliers";

export default function FinanceModule({ language = "pt" }: { language?: string }) {
  const [tab, setTab] = useState<FinanceTab>("payables");

  const tabs = [
    { id: "payables" as FinanceTab, label: "Contas a Pagar", icon: TrendingDown },
    { id: "receivables" as FinanceTab, label: "Contas a Receber", icon: TrendingUp },
    { id: "suppliers" as FinanceTab, label: "Fornecedores", icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Financeiro</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gestão de fornecedores, boletos a pagar e cobranças a receber.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
              tab === id
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "payables" && <PayablesModule />}
      {tab === "receivables" && <ReceivablesModule />}
      {tab === "suppliers" && <SuppliersModule />}
    </div>
  );
}
