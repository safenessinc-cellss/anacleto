import React, { useState } from "react";
import { BriefcaseBusiness, Ruler, Scissors, Layers3, Tags } from "lucide-react";
import BusinessWorkspace from "../workspace/BusinessWorkspace";
import RegistryModule from "../registry/RegistryModule";
import TechnicalDrawingModule from "../technical-drawing/TechnicalDrawingModule";
import PriceTableModule from "../registry/PriceTableModule";
import { SenderConfig } from "../../types";

type WorkflowTab = "projects" | "measurement" | "cut_plan" | "profile_optimization" | "tipologias" | "technical_drawing" | "price_table";

const tabs: { id: WorkflowTab; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "projects", label: "Projetos", description: "Cadastro e acompanhamento dos projetos de esquadrias.", icon: BriefcaseBusiness },
  { id: "measurement", label: "Medições", description: "Fichas de medição e conferência das dimensões em obra.", icon: Ruler },
  { id: "cut_plan", label: "Plano de Corte", description: "Organização dos planos e validação antes da fabricação.", icon: Scissors },
  { id: "profile_optimization", label: "Otimização de Perfis", description: "Análise de barras, aproveitamento e sobras de perfis.", icon: Layers3 },
  { id: "tipologias", label: "Modelos de Esquadrias", description: "Biblioteca de tipologias, modelos e dimensões padrão.", icon: BriefcaseBusiness },
  { id: "technical_drawing", label: "Projetos Técnicos 2D", description: "Desenhos técnicos 2D vinculados ao desenvolvimento dos projetos.", icon: BriefcaseBusiness },
  { id: "price_table", label: "Tabela de Preços", description: "Preços de vidros e componentes, validade, histórico e atualização mensal.", icon: Tags },
];

export default function ProjectEngineeringModule({ language, senderConfig }: { language: string; senderConfig: SenderConfig }) {
  const [active, setActive] = useState<WorkflowTab>("projects");
  const current = tabs.find((tab) => tab.id === active)!;

  return (
    <section className="space-y-6 text-slate-900 dark:text-slate-100">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">ANACLETO • ENGENHARIA</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Projetos e Engenharia</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          Um único espaço para organizar projetos, medições, planos de corte e aproveitamento de perfis. Os registros existentes são mantidos em suas respectivas bases.
        </p>
      </header>

      <nav aria-label="Etapas de projetos e engenharia" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3 xl:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-0.5 hidden text-[11px] sm:block ${selected ? "text-blue-100" : "text-slate-400"}`}>
                  {tab.id === "projects" ? "Visão geral" : tab.id === "measurement" ? "Campo e dimensões" : tab.id === "cut_plan" ? "Preparação de corte" : tab.id === "profile_optimization" ? "Barras e sobras" : tab.id === "tipologias" ? "Biblioteca de modelos" : tab.id === "technical_drawing" ? "Desenho técnico" : "Preços e validade"}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="mb-5 border-b border-slate-100 pb-4 dark:border-slate-800">
          <h2 className="text-lg font-bold">{current.label}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{current.description}</p>
        </div>
        {active === "projects" && <BusinessWorkspace kind="projects" />}
        {active === "measurement" && <RegistryModule kind="measurement" />}
        {active === "cut_plan" && <RegistryModule kind="cut_plan" />}
        {active === "profile_optimization" && <RegistryModule kind="profile_optimization" />}
        {active === "tipologias" && <BusinessWorkspace kind="tipologias" />}
        {active === "technical_drawing" && <TechnicalDrawingModule language={language} senderConfig={senderConfig} />}
        {active === "price_table" && <PriceTableModule />}
      </div>
    </section>
  );
}
