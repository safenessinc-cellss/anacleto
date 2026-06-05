import React, { useRef, useState } from "react";
import { Printer, X, ShieldCheck, Landmark, Tag } from "lucide-react";
import { Budget, SenderConfig } from "../types";
import { formatCurrency, languageMeta } from "../utils";
import { translations, LanguageCode, Translation } from "../translations";

interface BudgetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: Budget | null;
  t: Translation;
  senderConfig: SenderConfig;
}

export default function BudgetPreviewModal({
  isOpen,
  onClose,
  budget,
  t,
  senderConfig,
}: BudgetPreviewModalProps) {
  const [printLanguage, setPrintLanguage] = useState<LanguageCode>("pt");
  const budgetRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !budget) return null;

  // Initialize the viewing language to whatever was the budget's default language
  const defaultLang = (budget.language || "pt") as LanguageCode;
  const currentLang = printLanguage || defaultLang;

  // Fetch local translations for budget header terms
  const it = translations[currentLang] || translations.pt;
  const dir = languageMeta[currentLang]?.dir || "ltr";

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Orcamento-${budget.number}`;
    window.print();
    document.title = originalTitle;
  };

  const formattedSubtotal = formatCurrency(budget.subtotal, senderConfig.currency, currentLang === "pt" ? "pt-BR" : "en-US");
  const formattedTax = formatCurrency(budget.taxAmount, senderConfig.currency, currentLang === "pt" ? "pt-BR" : "en-US");
  const formattedTotal = formatCurrency(budget.total, senderConfig.currency, currentLang === "pt" ? "pt-BR" : "en-US");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overscroll-contain overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col my-8 overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors duration-300 print:absolute print:inset-0 print:m-0 print:shadow-none print:bg-white print:text-black">
        
        {/* Modal Controls Bar (Hidden during Print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 print:hidden">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              Exportar Orçamentos (PDF)
            </h2>
            <p className="text-xs text-slate-500">
              Orçamento de Alta Fidelidade: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{budget.number}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Lang Translation Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2.5 py-1.5 rounded-lg">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Traduzir Para:</span>
              <select
                value={currentLang}
                onChange={(e) => setPrintLanguage(e.target.value as LanguageCode)}
                className="text-xs bg-transparent border-none text-slate-800 dark:text-slate-200 font-bold outline-hidden cursor-pointer"
              >
                {Object.entries(languageMeta).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {meta.flag} {meta.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-550 text-slate-955 font-bold rounded-xl text-xs shadow-md cursor-pointer transition transform hover:scale-102"
            >
              <Printer className="w-4 h-4" />
              {it.invoicePrint || "Imprimir / PDF"}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Budget Page Area */}
        <div
          ref={budgetRef}
          dir={dir}
          className="flex-1 p-8 sm:p-12 overflow-y-auto bg-white text-slate-850 print:text-black print:p-0 print:overflow-visible transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100 print:bg-white print:dark:bg-white"
        >
          {/* Top Visual Accent Border */}
          <div className="h-2.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-indigo-650 rounded-t-lg mb-8 print:hidden"></div>

          {/* Header Grid */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-amber-100 dark:border-slate-800 pb-8">
            <div className="space-y-4">
              {senderConfig.logoUrl ? (
                <img
                  src={senderConfig.logoUrl}
                  alt="Company Logo"
                  className="max-h-16 w-auto object-contain rounded-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-850 text-white font-black text-xl tracking-[0.152em] rounded-xl inline-flex items-center gap-2 border border-amber-400/20">
                  <ShieldCheck className="w-6 h-6 text-amber-400" />
                  {senderConfig.name.split(" ")[0].toUpperCase()}
                </div>
              )}
              
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-slate-900 dark:text-slate-100 print:text-black text-sm tracking-tight text-gradient bg-gradient-to-r from-slate-900 to-slate-700">
                  {senderConfig.name}
                </p>
                <p className="text-slate-550 dark:text-slate-400 print:text-slate-600 flex items-center gap-1">
                  <span className="font-bold text-amber-500 dark:text-amber-400">NIF:</span> 
                  <span className="font-mono text-slate-700 dark:text-slate-300 print:text-black">{senderConfig.nif}</span>
                </p>
                <p className="text-slate-550 dark:text-slate-400 print:text-slate-600">
                  {senderConfig.address}, {senderConfig.postalCode} {senderConfig.city}
                </p>
                <p className="text-slate-550 dark:text-slate-400 print:text-slate-600 font-semibold text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {senderConfig.country}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-2">
              <span className="inline-block px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 font-extrabold text-xs tracking-wider rounded-lg uppercase print:border print:border-amber-500/40">
                {it.budgetNo || "ORÇAMENTO COMERCIAL"}
              </span>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 print:text-black tracking-tight font-sans">
                {budget.number}
              </h1>
              <div className="text-xs space-y-1.5">
                <p className="text-slate-500">
                  {it.invoiceDate || "Data de Emissão"}: <span className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{budget.date}</span>
                </p>
                <p className="text-slate-500">
                  Estado: <span className="font-black uppercase text-amber-500 dark:text-amber-400">{budget.status === "invoiced" ? t.statusInvoiced : budget.status === "accepted" ? t.statusAccepted : budget.status === "rejected" ? t.statusRejected : t.statusPending}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Entities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8 pb-8 border-b border-amber-50 dark:border-slate-800/80">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                PRESTADOR / EMISSOR
              </h3>
              <div className="text-sm space-y-1 bg-slate-50/50 dark:bg-slate-950/25 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 print:bg-transparent print:border-none print:p-0">
                <p className="font-extrabold text-slate-950 dark:text-slate-50 print:text-black text-sm">{senderConfig.name}</p>
                <p className="font-mono text-xs text-slate-650 dark:text-slate-400">NIF: {senderConfig.nif}</p>
                <p className="text-slate-600 dark:text-slate-450 print:text-slate-700 text-xs">{senderConfig.address}</p>
                <p className="text-slate-600 dark:text-slate-455 print:text-slate-700 text-xs">{senderConfig.postalCode} {senderConfig.city}, {senderConfig.country}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                ADQUIRENTE / CLIENTE
              </h3>
              <div className="text-sm space-y-1 bg-slate-50/50 dark:bg-slate-950/25 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 print:bg-transparent print:border-none print:p-0">
                <p className="font-extrabold text-slate-950 dark:text-slate-50 print:text-black text-sm">{budget.clientName}</p>
                <p className="font-mono text-xs text-slate-650 dark:text-slate-400">NIF: {budget.clientNif || "Não Registrado"}</p>
                <p className="text-slate-500 font-semibold text-xs">{budget.clientEmail}</p>
                <p className="text-slate-600 dark:text-slate-450 print:text-slate-700 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 rounded-lg mt-1 print:p-0 print:border-none print:bg-transparent">
                  {budget.clientAddress || "Simulação ou Orçamento sem Morada."}
                </p>
              </div>
            </div>
          </div>

          {/* Items breakdown Table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest text-slate-400 pb-3">
                  <th className="py-3.5 px-2">{it.itemNameCol || "Item / Descrição"}</th>
                  <th className="py-3.5 px-2 text-center w-20">{it.itemQtyCol || "Qtd"}</th>
                  <th className="py-3.5 px-2 text-right w-32">{it.itemPriceCol || "Val. Unitário"}</th>
                  <th className="py-3.5 px-2 text-right w-32">{it.itemTotalCol || "Total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {budget.items.map((item, index) => {
                  let desc = item.description;
                  
                  // Translate items if requested and available
                  if (budget.language !== currentLang && budget.translations?.[currentLang]) {
                    const translatedBundle = budget.translations[currentLang];
                    const matchedItem = translatedBundle.items?.find((i: any) => i.id === item.id || i.description === item.description);
                    if (matchedItem) {
                      desc = matchedItem.description;
                    }
                  }

                  return (
                    <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-850/10 text-sm">
                      <td className="py-4 px-2 font-bold text-slate-850 dark:text-slate-100 print:text-black">
                        {desc}
                      </td>
                      <td className="py-4 px-2 text-center text-slate-600 dark:text-slate-400 print:text-black font-semibold">
                        {item.quantity}
                      </td>
                      <td className="py-4 px-2 text-right text-slate-600 dark:text-slate-400 print:text-black font-mono font-medium">
                        {formatCurrency(item.unitPrice, senderConfig.currency, currentLang === "pt" ? "pt-BR" : "en-US")}
                      </td>
                      <td className="py-4 px-2 text-right font-black text-slate-900 dark:text-slate-50 print:text-black font-mono">
                        {formatCurrency(item.quantity * item.unitPrice, senderConfig.currency, currentLang === "pt" ? "pt-BR" : "en-US")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Settle Totals block */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 mt-8 pt-8">
            <div className="w-full sm:w-1/2 p-5 bg-gradient-to-br from-slate-50 to-slate-50/60 dark:from-slate-950/20 dark:to-slate-955/20 rounded-xl space-y-2 border border-slate-150 dark:border-slate-800 print:border-none print:bg-transparent">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 uppercase tracking-widest">
                <Landmark className="w-4 h-4 text-amber-500" />
                {it.invoiceBank || "Dados de Pagamento / Canal Bancário"}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 print:text-black font-mono break-all leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-150 dark:border-slate-800 print:p-0 print:border-none print:bg-transparent">
                {senderConfig.bankAccount || "IBAN: N/A"}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug">
                * Este documento é um orçamento comercial formal. Para liquidação de valores, as instruções ou o número do orçamento <span className="font-bold text-slate-705 dark:text-slate-300 print:text-black">{budget.number}</span> devem ser referenciados.
              </p>
            </div>

            <div className="w-full sm:w-1/3 space-y-3 shrink-0">
              <div className="flex justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">{it.subtotal || "Subtotal"}</span>
                <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200 print:text-black">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">
                  IVA ({budget.taxRate || 23}%)
                </span>
                <span className="font-mono font-extrabold text-slate-855 dark:text-slate-200 print:text-black">{formattedTax}</span>
              </div>
              <div className="border-t-2 border-amber-500 pt-3 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                  {it.total || "Total Geral"}
                </span>
                <span className="text-xl font-mono font-black text-slate-950 dark:text-white print:text-black">
                  {formattedTotal}
                </span>
              </div>
            </div>
          </div>

          {/* Footer declaration */}
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center text-[10px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-500 uppercase tracking-widest">
              Obrigado pela sua preferência!
            </p>
            <p>
              Qualquer dúvida relacionada com este orçamento de esquadrias ou vidros, contacte: suporte@anacleto.gt.tc
            </p>
            <p className="opacity-40 text-[8px] font-mono">
              ANACLETO SAAS CLOUD · DIGITAL BUDGET PREVIEW
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
