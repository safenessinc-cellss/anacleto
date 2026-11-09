import React, { useState } from "react";
import { Building2, TrendingDown, TrendingUp, FileText, CreditCard, ShoppingCart, Wallet } from "lucide-react";
import SuppliersModule from "./SuppliersModule";
import PayablesModule from "./PayablesModule";
import ReceivablesModule from "./ReceivablesModule";
import PendingBoletosModule from "./PendingBoletosModule";
import PaymentsModule from "./PaymentsModule";
import PurchasesModule from "./PurchasesModule";
import InventoryModule from "../inventory/InventoryModule";
import EmployeePaymentsModule from "./EmployeePaymentsModule";
import FinancialReportsModule from "./FinancialReportsModule";
import PayrollModule from "../hr/PayrollModule";

type FinanceTab = "inventory" | "purchases" | "payables" | "receivables" | "suppliers" | "pending_boletos" | "payments" | "employee_payments" | "payroll" | "reports";

export default function FinanceModule({ language = "pt" }: { language?: string }) {
  const [tab, setTab] = useState<FinanceTab>("payables");

  const tabs = [
    { id: "inventory" as FinanceTab, label: "Estoque", icon: Building2 },
    { id: "purchases" as FinanceTab, label: "Compras gerais", icon: ShoppingCart },
    { id: "payables" as FinanceTab, label: "Despesas e Contas a Pagar", icon: TrendingDown },
    { id: "receivables" as FinanceTab, label: "Contas a Receber", icon: TrendingUp },
    { id: "suppliers" as FinanceTab, label: "Fornecedores", icon: Building2 },
    { id: "pending_boletos" as FinanceTab, label: "Boletos a Revisar", icon: FileText },
    { id: "payments" as FinanceTab, label: "Pagamentos", icon: CreditCard },
    { id: "employee_payments" as FinanceTab, label: "Pagamento funcionário", icon: CreditCard },
    { id: "payroll" as FinanceTab, label: "Folha de Pagamento", icon: Wallet },
    { id: "reports" as FinanceTab, label: "Relatórios", icon: FileText },
    ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Financeiro</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gestão integrada de fornecedores, compras, despesas, pagamentos e recebimentos.
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

      {tab === "inventory" && <InventoryModule />}
      {tab === "purchases" && <PurchasesModule />}
      {tab === "payables" && <PayablesModule />}
      {tab === "receivables" && <ReceivablesModule />}
      {tab === "suppliers" && <SuppliersModule />}
      {tab === "pending_boletos" && <PendingBoletosModule />}
      {tab === "payments" && <PaymentsModule />}
      {tab === "employee_payments" && <EmployeePaymentsModule />}
      {tab === "payroll" && <PayrollModule />}
      {tab === "reports" && <FinancialReportsModule />}
    </div>
  );
}
