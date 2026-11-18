import React from "react";

type PublicPrice = { code: string; description: string; barPrice: number; lengthM: number; regularPrice?: number };
const bogoniPrices: PublicPrice[] = [
  { code: "SU008", description: "Batente lateral", barPrice: 82.53, lengthM: 6, regularPrice: 104.16 },
  { code: "SU102", description: "Baguete para fixação de vidro", barPrice: 45.72, lengthM: 6, regularPrice: 57.71 },
  { code: "SU047", description: "Montante mão de amigo para porta", barPrice: 444.98, lengthM: 6, regularPrice: 561.62 },
  { code: "SU049", description: "Montante mão de amigo", barPrice: 440.62, lengthM: 6, regularPrice: 556.12 },
  { code: "SU225", description: "Montante inferior para porta", barPrice: 432.90, lengthM: 6, regularPrice: 554.33 },
  { code: "SU006", description: "Travessa da bandeira", barPrice: 421.22, lengthM: 6, regularPrice: 531.64 },
  { code: "SU280", description: "Montante para porta", barPrice: 313.45, lengthM: 6, regularPrice: 404.61 },
  { code: "SU230", description: "Marco inferior para porta 3 folhas", barPrice: 309.65, lengthM: 6, regularPrice: 399.71 },
  { code: "SU242", description: "Montante mão de amigo", barPrice: 269.13, lengthM: 6, regularPrice: 347.39 },
  { code: "SU227", description: "Travessa", barPrice: 266.57, lengthM: 6, regularPrice: 344.10 },
  { code: "SU279", description: "Montante do caixilho da porta", barPrice: 257.58, lengthM: 6, regularPrice: 332.49 },
  { code: "SU001", description: "Trilho superior", barPrice: 256.24, lengthM: 6, regularPrice: 323.41 },
  { code: "SU039", description: "Montante para janela", barPrice: 240.03, lengthM: 6 },
];

const suppliers = [
  { name: "Bogoni Alumínios", status: "Preço público encontrado", detail: "13 preços de perfis Suprema com barra de 6 m publicados online.", url: "https://www.bogonialuminios.com.br/perfis-de-aluminios-e-componentes-para-linha-suprema?p=1" },
  { name: "Alumínios Forten", status: "Cotação necessária", detail: "Catálogo técnico e pesos kg/m disponíveis; preço não publicado.", url: "https://www.aluminiosforten.com.br/produtos/linha/linha-suprema/" },
  { name: "Grupo Alucentro", status: "Cotação necessária", detail: "Catálogos técnicos Suprema e Gold disponíveis; preço não publicado no catálogo.", url: "https://grupoalucentro.com.br/a-alucentro/catalogos/" },
  { name: "Poliformas", status: "Cotação necessária", detail: "Catálogo técnico com códigos, pesos e barras; preço não publicado.", url: "https://www.poliformas.com.br/wp-content/uploads/2026/03/Linha-Suprema.pdf" },
  { name: "Marte Alumínio", status: "Cotação necessária", detail: "Perfis e pesos kg/m publicados; produtos marcados como sob consulta.", url: "https://www.martealuminio.com.br/linhas/perfis-linha-suprema" },
];

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicSupplierPriceCatalog() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Catálogos e preços públicos — Linha Suprema</h3>
          <p className="mt-1 text-xs text-slate-500">Pesquisa registrada em 18/11/2026. Valores de varejo online; confirmar estoque, cor, impostos e frete antes de comprar.</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Não liberado para orçamento</span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {suppliers.map((supplier) => (
          <a key={supplier.name} href={supplier.url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-3 hover:border-blue-400 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-slate-900 dark:text-white">{supplier.name}</strong>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{supplier.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{supplier.detail}</p>
            <span className="mt-2 inline-block text-xs font-semibold text-blue-600 dark:text-blue-300">Abrir catálogo do fornecedor ↗</span>
          </a>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto">
        <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Bogoni — preços publicados por barra</h4>
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead><tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700"><th className="py-2 pr-3">Código</th><th className="py-2 pr-3">Descrição</th><th className="py-2 pr-3">Barra</th><th className="py-2 pr-3">Preço / barra</th><th className="py-2 pr-3">Equiv. / metro</th></tr></thead>
          <tbody>
            {bogoniPrices.map((item) => (
              <tr key={item.code} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{item.code}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{item.description}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{item.lengthM.toFixed(2).replace(".", ",")} m</td>
                <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{brl(item.barPrice)}</td>
                <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{brl(item.barPrice / item.lengthM)}/m</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-500">O equivalente por metro é apenas preço da barra dividido por 6; não representa preço por kg. O fornecedor não publica peso kg/m nesta página, portanto estes valores ainda não alimentam o cálculo técnico por kg.</p>
      </div>
      <p className="mt-3 text-xs text-slate-500">Fonte dos preços: página pública da Bogoni Alumínios. A oferta fica como referência comercial pendente de confirmação e não será usada automaticamente no cálculo de orçamento.</p>
    </div>
  );
}
