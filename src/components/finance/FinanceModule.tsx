import React, { useState } from "react";
import { BarChart3, BriefcaseBusiness, FileText, HandCoins, Receipt, Users } from "lucide-react";
import type { SenderConfig } from "../../types";
import ClientAdvancesModule from "./ClientAdvancesModule";
import EmployeeAdvancesModule from "./EmployeeAdvancesModule";
import FinanceDashboard from "./FinanceDashboard";
import FinancialReportsModule from "./FinancialReportsModule";
import FiscalDocumentsModule from "./FiscalDocumentsModule";
import PendingBoletosModule from "./PendingBoletosModule";
import PayablesModule from "./PayablesModule";
import PurchasesModule from "./PurchasesModule";
import SuppliersModule from "./SuppliersModule";
import InventoryModule from "../inventory/InventoryModule";
import EmployeePaymentsModule from "./EmployeePaymentsModule";
import PayrollModule from "../hr/PayrollModule";
import InvoicesModule from "../invoices/InvoicesModule";
import DailyExpensesModule from "./DailyExpensesModule";

type FinanceTab = "overview" | "client_advances" | "employee_advances" | "daily_expenses" | "payables" | "reports";
type Subsection = "purchases" | "payables" | "suppliers" | "inventory" | "reports" | "fiscal" | "boletos" | "invoices" | "payroll" | "payments";

const primaryTabs: Array<{ id: FinanceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Visão Geral & Gráficos", icon: BarChart3 },
  { id: "client_advances", label: "Adiantamentos de Clientes (Sinal)", icon: HandCoins },
  { id: "employee_advances", label: "Adiantamentos de Funcionários (Vales)", icon: Users },
  { id: "daily_expenses", label: "Gastos Diários", icon: Receipt },
  { id: "payables", label: "Contas a Pagar & Fornecedores", icon: BriefcaseBusiness },
  { id: "reports", label: "Relatórios & Notas Fiscais", icon: FileText },
];

export default function FinanceModule({ language = "pt", senderConfig, canManageFinance = false }: { language?: string; senderConfig: SenderConfig; canManageFinance?: boolean }) {
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [subsection, setSubsection] = useState<Subsection>("purchases");
  const subsections: Record<"payables" | "reports", Array<{ id: Subsection; label: string }>> = {
    payables: [
      { id: "purchases", label: "Compras de obra" }, { id: "payables", label: "Contas a pagar" },
      { id: "suppliers", label: "Fornecedores" }, { id: "inventory", label: "Estoque" },
    ],
    reports: [
      { id: "reports", label: "Relatórios" }, { id: "invoices", label: "Notas emitidas" },
      { id: "fiscal", label: "Notas fiscais" }, { id: "boletos", label: "Boletos pendentes" },
      { id: "payroll", label: "Folha" }, { id: "payments", label: "Pagamentos" },
    ],
  };
  const activeSubsections = tab === "payables" || tab === "reports" ? subsections[tab] : [];

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <header><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financeiro</h1></header>
      <nav aria-label="Seções do financeiro" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        {primaryTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); if (id === "payables") setSubsection("purchases"); if (id === "reports") setSubsection("reports"); }} aria-current={tab === id ? "page" : undefined} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${tab === id ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}><Icon className="h-4 w-4"/>{label}</button>)}
      </nav>
      {tab === "overview" && <FinanceDashboard />}
      {tab === "client_advances" && <ClientAdvancesModule />}
      {tab === "employee_advances" && <EmployeeAdvancesModule />}
      {tab === "daily_expenses" && <DailyExpensesModule />}
      {(tab === "payables" || tab === "reports") && <>
        <nav aria-label="Subseções financeiras" className="flex flex-wrap gap-2 border-b pb-3">{activeSubsections.map((item) => <button key={item.id} type="button" onClick={() => setSubsection(item.id)} aria-current={subsection === item.id ? "page" : undefined} className={`rounded-lg px-3 py-2 text-xs font-bold ${subsection === item.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border bg-white dark:bg-slate-900"}`}>{item.label}</button>)}</nav>
        {subsection === "purchases" && tab === "payables" && <PurchasesModule />}
        {subsection === "payables" && tab === "payables" && <PayablesModule />}
        {subsection === "suppliers" && tab === "payables" && <SuppliersModule />}
        {subsection === "inventory" && tab === "payables" && <InventoryModule />}
        {subsection === "reports" && tab === "reports" && <FinancialReportsModule />}
        {subsection === "invoices" && tab === "reports" && <InvoicesModule language={language} senderConfig={senderConfig} canManageFinance={canManageFinance} />}
        {subsection === "fiscal" && tab === "reports" && <FiscalDocumentsModule />}
        {subsection === "boletos" && tab === "reports" && <PendingBoletosModule />}
        {subsection === "payroll" && tab === "reports" && <PayrollModule />}
        {subsection === "payments" && tab === "reports" && <EmployeePaymentsModule />}
      </>}
    </div>
  );
}
