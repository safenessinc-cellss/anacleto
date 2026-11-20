import React, { useState } from "react";
import { ArrowRight, BookOpen, Boxes, ClipboardCheck, FileSearch, PackageCheck, ShoppingCart } from "lucide-react";
import SupplierSuperCatalog from "../supplier-catalog/SupplierSuperCatalog";
import TechnicalLibraryModule from "../technical-library/TechnicalLibraryModule";

type Section = "overview" | "technical" | "suppliers";

const steps = [
  { title: "Pesquisar e importar", description: "Registre documentos oficiais, catálogos e referências de fornecedores. A origem de cada informação deve permanecer identificada.", icon: FileSearch },
  { title: "Validar e aprovar", description: "Confira códigos, medidas, unidades, compatibilidade, preços e validade. Dados importados começam pendentes e não entram automaticamente nos cálculos.", icon: ClipboardCheck },
  { title: "Gerar lista técnica", description: "O orçamento utiliza somente perfis, regras de corte e acessórios tecnicamente aprovados para a linha e tipologia escolhidas.", icon: Boxes },
  { title: "Comparar e comprar", description: "Compare ofertas comerciais compatíveis, unidades equivalentes, disponibilidade e frete. Cestas incompletas não devem ser recomendadas como vencedoras.", icon: ShoppingCart },
  { title: "Receber e atualizar estoque", description: "A compra aprovada segue para recebimento e movimentação de estoque, preservando o vínculo com o fornecedor e o orçamento de origem.", icon: PackageCheck },
];

export default function CentralMaterialsModule({ onNavigateQuotes }: { onNavigateQuotes: () => void }) {
  const [section, setSection] = useState<Section>("overview");
  const tabs: { id: Section; label: string }[] = [
    { id: "overview", label: "Visão geral" },
    { id: "technical", label: "Biblioteca técnica" },
    { id: "suppliers", label: "Fornecedores e catálogos" },
  ];

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"><Boxes className="h-6 w-6" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Central de Materiais e Inteligência Técnica</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Um único ponto de acesso para especificações técnicas, catálogos comerciais, preços e preparação de compras.</p>
            </div>
          </div>
          <button type="button" onClick={onNavigateQuotes} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Abrir orçamentos <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <nav aria-label="Seções da Central de Materiais" className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
          {tabs.map(tab => <button key={tab.id} type="button" onClick={() => setSection(tab.id)} aria-current={section === tab.id ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition ${section === tab.id ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>{tab.label}</button>)}
        </nav>
      </header>

      {section === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><BookOpen className="h-4 w-4 text-blue-600" /> Biblioteca técnica</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Define o que pode ser fabricado: perfis, códigos, pesos, barras comerciais, regras de corte, acessórios, compatibilidade e documentos de origem. Os preços aprovados e seu histórico permanecem nesta área técnica-comercial.</p>
              <button type="button" onClick={() => setSection("technical")} className="mt-3 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Abrir biblioteca técnica →</button>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><ShoppingCart className="h-4 w-4 text-blue-600" /> Fornecedores e catálogos</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Mantém produtos comerciais, códigos do fornecedor, fotos, arquivos importados e fontes externas. Um item comercial não se torna automaticamente uma especificação técnica aprovada.</p>
              <button type="button" onClick={() => setSection("suppliers")} className="mt-3 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Abrir fornecedores →</button>
            </article>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Fluxo operacional dos materiais</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return <article key={step.title} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">{index + 1}</span><Icon className="h-4 w-4 text-slate-500" /></div>
                  <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">{step.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.description}</p>
                </article>;
              })}
            </div>
          </section>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Regra de integridade:</strong> dados extraídos de PDF, pesquisas na web e cotações novas permanecem pendentes até revisão. Equivalência entre códigos, linhas ou fabricantes exige validação técnica; sem isso, o material não pode compor automaticamente uma lista de corte nem uma recomendação de compra.
          </div>
        </div>
      )}

      {section === "technical" && <TechnicalLibraryModule />}
      {section === "suppliers" && <SupplierSuperCatalog onNavigateQuotes={onNavigateQuotes} />}
    </section>
  );
}
