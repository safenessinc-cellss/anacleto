import React, { useState } from "react";
import { BriefcaseBusiness, Ruler, Scissors, Layers3, Tags } from "lucide-react";
import BusinessWorkspace from "../workspace/BusinessWorkspace";
import RegistryModule from "../registry/RegistryModule";
import TechnicalDrawingModule from "../technical-drawing/TechnicalDrawingModule";
import PriceTableModule from "../registry/PriceTableModule";
import { SenderConfig } from "../../types";

type WorkflowTab = "projects" | "measurement" | "cut_plan" | "profile_optimization" | "tipologias" | "technical_drawing" | "price_table";

const tabs: { id: WorkflowTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "projects", label: "Projetos", icon: BriefcaseBusiness },
  { id: "measurement", label: "Medições", icon: Ruler },
  { id: "cut_plan", label: "Plano de Corte", icon: Scissors },
  { id: "profile_optimization", label: "Otimização de Perfis", icon: Layers3 },
  { id: "tipologias", label: "Modelos de Esquadrias", icon: BriefcaseBusiness },
  { id: "technical_drawing", label: "Projetos Técnicos 2D", icon: BriefcaseBusiness },
  { id: "price_table", label: "Tabela de Preços", icon: Tags },
];

export default function ProjectEngineeringModule({ language, senderConfig }: { language: string; senderConfig: SenderConfig }) {
  const [active, setActive] = useState<WorkflowTab>("projects");
  return (
    <section className="space-y-6 text-slate-900 dark:text-slate-100">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Projetos & Oficina CAD</h1>
      </header>

      <nav aria-label="Etapas de projetos e engenharia" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={selected ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${selected ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />{tab.label}
            </button>
          );
        })}
      </nav>

      <div>
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
