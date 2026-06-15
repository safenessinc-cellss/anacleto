import React, { useRef, useState } from "react";
import { Printer, X, Download, ShieldCheck, Landmark } from "lucide-react";
import { Invoice } from "../types";
import { formatCurrency, languageMeta } from "../utils";
import { translations, LanguageCode, Translation } from "../translations";
import logoImg from "../assets/images/anacleto_logo_1780594599493.png";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  t: Translation;
}

export default function InvoiceModal({ isOpen, onClose, invoice, t }: InvoiceModalProps) {
  const [printLanguage, setPrintLanguage] = useState<LanguageCode>("pt");
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  // Initialize the viewing language to whatever was the invoice's preferred client language
  const defaultLang = (invoice.language || "pt") as LanguageCode;
  const currentLang = printLanguage || defaultLang;
  
  // Fetch local translations for invoice header terms (e.g. "Invoice", "Sender", "To", "Date", etc)
  const it = translations[currentLang] || translations.pt;
  const dir = languageMeta[currentLang]?.dir || "ltr";

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Fatura-${invoice.number}`;
    window.print();
    document.title = originalTitle;
  };

  const sender = invoice.senderSnapshot || {
    name: "Anacleto Consulting Group S.A.",
    nif: "PT 502 234 450",
    address: "Avenida Infante Santo Nº 24, r/c",
    postalCode: "1350-178",
    city: "Lisboa",
    country: "Portugal",
    logoUrl: "",
    bankAccount: "PT50 0033 0000 12345678901 23 - BANCO BILBAO VIZCAYA",
    currency: "EUR"
  };

  const formattedSubtotal = formatCurrency(invoice.subtotal, sender.currency, currentLang === "pt" ? "pt-BR" : "en-US");
  const formattedTax = formatCurrency(invoice.taxAmount, sender.currency, currentLang === "pt" ? "pt-BR" : "en-US");
  const formattedTotal = formatCurrency(invoice.total, sender.currency, currentLang === "pt" ? "pt-BR" : "en-US");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overscroll-contain overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col my-8 overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors duration-300 print:absolute print:inset-0 print:m-0 print:shadow-none print:bg-white print:text-black">
        
        {/* Modal Controls Bar (Hidden during Print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {it.invoiceTitle}
            </h2>
            <p className="text-xs text-slate-500">
              {t.invoiceSourceBudget}: <span className="font-mono">{invoice.number}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Lang Translation Selector inside preview so they can print in either language instantaneously! */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ver em:</span>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-650 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              {it.invoicePrint}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Page Area */}
        <div
          ref={invoiceRef}
          dir={dir}
          className="flex-1 p-8 sm:p-12 overflow-y-auto bg-white text-slate-800 print:text-black print:p-0 print:overflow-visible transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100 print:bg-white print:dark:bg-white"
        >
          {/* Header Grid */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-8">
            <div className="space-y-3">
              <img
                src={sender.logoUrl || logoImg}
                alt="Company Logo"
                className="max-h-16 w-auto object-contain rounded-md"
                referrerPolicy="no-referrer"
              />
              
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                  {sender.name}
                </p>
                <p className="text-slate-550 dark:text-slate-400 print:text-slate-600">
                  {it.invoiceTaxId}: <span className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">{sender.nif}</span>
                </p>
                <p className="text-slate-550 dark:text-slate-400 print:text-slate-600">
                  {sender.address}, {sender.postalCode} {sender.city}
                </p>
                <p className="text-slate-550 dark:text-slate-400 print:text-slate-600">
                  {sender.country}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-2">
              <span className="inline-block px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs tracking-wider rounded-md uppercase print:border print:border-emerald-650">
                FATURA INTEGRADA M.10
              </span>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 print:text-black tracking-tight">
                {invoice.number}
              </h1>
              <div className="text-xs space-y-1">
                <p className="text-slate-500">
                  {it.invoiceDate}: <span className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{invoice.date}</span>
                </p>
                <p className="text-slate-500">
                  {it.budgetNo}: <span className="font-mono text-slate-850 dark:text-slate-250 print:text-black">{invoice.number.replace("FT-", "PRES-")}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Billing Entities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8 pb-8 border-b border-slate-150">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {it.invoiceFrom}
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-bold text-slate-950 dark:text-slate-50 print:text-black">{sender.name}</p>
                <p className="font-mono text-xs">{sender.nif}</p>
                <p className="text-slate-600 dark:text-slate-450 print:text-slate-700">{sender.address}</p>
                <p className="text-slate-600 dark:text-slate-455 print:text-slate-700">{sender.postalCode} {sender.city}, {sender.country}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {it.invoiceTo}
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-bold text-slate-950 dark:text-slate-50 print:text-black">
                  {invoice.clientName}
                </p>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-350 print:text-black">
                  {invoice.clientNif}
                </p>
                <p className="text-slate-500 font-medium">{invoice.clientEmail}</p>
                <p className="text-slate-600 dark:text-slate-450 print:text-slate-700 bg-slate-55/40 dark:bg-slate-950/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 print:bg-transparent print:border-none print:p-0">
                  {invoice.clientAddress || "Endereço não fornecido pelo adquirente."}
                </p>
              </div>
            </div>
          </div>

          {/* Items breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-2">{it.itemNameCol}</th>
                  <th className="py-3 px-2 text-center w-20">{it.itemQtyCol}</th>
                  <th className="py-3 px-2 text-right w-32">{it.itemPriceCol}</th>
                  <th className="py-3 px-2 text-right w-32">{it.itemTotalCol}</th>
                </tr>
              </thead>
              <tbody>
                {/* Check translations map structure, fallback if missing */}
                {(invoice.items || []).map((item, index) => {
                  // Resolve description depending on printable selected language
                  let desc = item.description;
                  
                  // If language selected is different from default and there are translations stored, fetch it!
                  if (invoice.language !== currentLang && (invoice as any).translations?.[currentLang]) {
                    const translatedBundle = (invoice as any).translations[currentLang];
                    const matchedItem = translatedBundle.items?.find((i: any) => i.id === item.id || i.description === item.description);
                    if (matchedItem) {
                      desc = matchedItem.description;
                    }
                  }

                  return (
                    <tr key={index} className="border-b border-slate-100 dark:border-slate-800/50 text-sm">
                      <td className="py-4 px-2 font-medium text-slate-800 dark:text-slate-200 print:text-black">
                        {desc}
                      </td>
                      <td className="py-4 px-2 text-center text-slate-600 dark:text-slate-400 print:text-black">
                        {item.quantity}
                      </td>
                      <td className="py-4 px-2 text-right text-slate-600 dark:text-slate-400 print:text-black font-mono">
                        {formatCurrency(item.unitPrice, sender.currency, currentLang === "pt" ? "pt-BR" : "en-US")}
                      </td>
                      <td className="py-4 px-2 text-right font-semibold text-slate-900 dark:text-slate-50 print:text-black font-mono">
                        {formatCurrency(item.quantity * item.unitPrice, sender.currency, currentLang === "pt" ? "pt-BR" : "en-US")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Settle Totals block */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mt-8 pt-8">
            <div className="w-full sm:w-1/2 p-4 bg-slate-50 dark:bg-slate-950/20 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800 print:border-none print:bg-transparent">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <Landmark className="w-4 h-4 text-slate-500" />
                {it.invoiceBank}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-350 print:text-black font-mono break-all leading-relaxed bg-white dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 print:p-0 print:border-none print:bg-transparent">
                {sender.bankAccount || "IBAN: N/A - Contacte suporte@anacleto.gt.tc"}
              </p>
              <p className="text-[10px] text-slate-400 pt-1 leading-snug">
                * Por favor indicar o número de fatura <span className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">{invoice.number}</span> como descritivo na transferência.
              </p>
            </div>

            <div className="w-full sm:w-1/3 space-y-2 text-right sm:self-end">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>{it.subtotal}:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 print:text-black">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>{it.tax} ({invoice.taxRate}%):</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 print:text-black">{formattedTax}</span>
              </div>
              <div className="flex justify-between items-center text-base pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 print:text-black">{it.total}:</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 print:text-black font-mono">
                  {formattedTotal}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Terms */}
          <div className="border-t border-slate-200 dark:border-slate-800 mt-12 pt-6 text-center text-[10px] text-slate-400 print:mt-16">
            <p className="font-semibold text-slate-600 dark:text-slate-400 print:text-black mb-1">
              {it.invoiceTerms}
            </p>
            <p>
              Esta fatura foi processada informaticamente através do sistema Anacleto Portal em conformidade com as regras fiscais vigentes.
            </p>
            <p className="mt-2 text-slate-350 dark:text-slate-500">
              {t.footerRights}
            </p>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden during Print) */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            {it.invoiceClose}
          </button>
        </div>

      </div>
    </div>
  );
}
