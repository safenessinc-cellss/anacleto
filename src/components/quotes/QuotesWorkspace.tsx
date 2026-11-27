import React, { lazy, Suspense, useState } from "react";
import { Calculator, FileText, Sparkles } from "lucide-react";
import type { Company, SenderConfig } from "../../types";
import type { BudgetWorkflow } from "./AllBudgetsModule";
const QuotesModule = lazy(() => import("./QuotesModule"));
const SmartBudgetModule = lazy(() => import("./SmartBudgetModule"));
const TechnicalCalculatorModule = lazy(() => import("../TechnicalCalculatorModule"));
const AllBudgetsModule = lazy(() => import("./AllBudgetsModule"));






type BudgetTab = "all" | "standard" | "smart" | "technical";

interface QuotesWorkspaceProps {
  senderConfig: SenderConfig;
  companies: Company[];
  onConvertToInvoice?: (quote: any) => void;
  language?: string;
}

const tabs: Array<{ id: BudgetTab; label: string; description: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: "all", label: "Todos os Orçamentos", description: "Histórico geral e edição por modalidade", Icon: FileText },
  { id: "standard", label: "Orçamento", description: "Orçamento comercial tradicional", Icon: FileText },
  { id: "smart", label: "Orçamento Inteligente", description: "Elaboração assistida por IA", Icon: Sparkles },
  { id: "technical", label: "Orçamento de Esquadrias", description: "Dimensionamento e composição técnica", Icon: Calculator },
];

/**
 * Central de orçamentos: three independent workflows presented as tabs.
 * Each workflow keeps its own component state, Firestore collection and history.
 * Only customer/company data is shared through the props passed to the standard flow.
 */
export default function QuotesWorkspace({
  senderConfig,
  companies,
  onConvertToInvoice,
  language = "pt",
}: QuotesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<BudgetTab>("all");
  const [visitedTabs, setVisitedTabs] = useState<Set<BudgetTab>>(() => new Set(["all"]));
  const [editingIds, setEditingIds] = useState<{ standard?: string; smart?: string; technical?: string }>({});
  const selectTab = (tab: BudgetTab) => { setActiveTab(tab); setVisitedTabs((current) => new Set([...current, tab])); };
  const openBudget = (workflow: BudgetWorkflow, id: string) => { setEditingIds((current) => ({ ...current, [workflow]: id })); selectTab(workflow); };

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Orçamentos</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Três processos independentes em um único espaço. Cada modalidade mantém seus próprios dados e histórico.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
            Área comercial
          </span>
        </div>
        <nav className="mt-5 grid grid-cols-1 gap-2 border-b border-slate-200 pb-3 sm:grid-cols-4 dark:border-slate-700" role="tablist" aria-label="Modalidades de orçamento">
          {tabs.map(({ id, label, description, Icon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`budget-tab-${id}`}
                aria-selected={selected}
                aria-controls={`budget-panel-${id}`}
                onClick={() => selectTab(id)}
                className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${selected
                  ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
                  : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-700"}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs opacity-75">{description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <Suspense fallback={<div className="flex min-h-48 items-center justify-center text-sm text-slate-500">Carregando modalidade de orçamento...</div>}>
        {visitedTabs.has("all") && <div id="budget-panel-all" role="tabpanel" hidden={activeTab !== "all"}><AllBudgetsModule onOpen={openBudget} /></div>}
        {visitedTabs.has("standard") && <div id="budget-panel-standard" role="tabpanel" aria-labelledby="budget-tab-standard" hidden={activeTab !== "standard"}>
          <QuotesModule language={language} senderConfig={senderConfig} companies={companies} onConvertToInvoice={onConvertToInvoice} initialQuoteId={editingIds.standard} hideHistory />
        </div>}
        {visitedTabs.has("smart") && <div id="budget-panel-smart" role="tabpanel" aria-labelledby="budget-tab-smart" hidden={activeTab !== "smart"}>
          <SmartBudgetModule initialBudgetId={editingIds.smart} hideHistory />
        </div>}
        {visitedTabs.has("technical") && <div id="budget-panel-technical" role="tabpanel" aria-labelledby="budget-tab-technical" hidden={activeTab !== "technical"}>
          <TechnicalCalculatorModule initialBudgetId={editingIds.technical} />
        </div>}
      </Suspense>
    </section>
  );
}
