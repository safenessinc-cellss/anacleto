import React, { useState, useEffect } from "react";
import { Plus, Trash, X, Globe, Save, Brain, Sparkles, Wand2, Search } from "lucide-react";
import { Budget, BudgetLineItem } from "../types";
import { Translation } from "../translations";
import { generateBudgetTranslations, languageMeta } from "../utils";
import { useToast } from "./ToastContext";
import { db } from "../firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budgetData: Partial<Budget>) => Promise<void>;
  budget?: Budget;
  t: Translation;
  currentLanguage: string;
  prefillClient?: {
    name: string;
    email: string;
    nif?: string;
    address?: string;
  } | null;
}

export default function BudgetModal({
  isOpen,
  onClose,
  onSave,
  budget,
  t,
  currentLanguage,
  prefillClient,
}: BudgetModalProps) {
  const { showToast } = useToast();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientNif, setClientNif] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [documentLanguage, setDocumentLanguage] = useState("pt");
  const [taxRate, setTaxRate] = useState(10); // Standard Brazil tax rate (10%)
  const [items, setItems] = useState<BudgetLineItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // NIF search & auto-fill states
  const [isSearchingNif, setIsSearchingNif] = useState(false);
  const [nifFoundInfo, setNifFoundInfo] = useState<{ name: string; email: string; address?: string } | null>(null);

  const lookupNif = async (nifValue: string) => {
    const rawNif = nifValue.trim();
    if (!rawNif || rawNif.length < 4) {
      setNifFoundInfo(null);
      return;
    }

    setIsSearchingNif(true);
    try {
      // 1. Search in companies_crm
      const crmRef = collection(db, "companies_crm");
      const crmQuery = query(crmRef, where("nif", "==", rawNif), limit(1));
      const crmSnap = await getDocs(crmQuery);

      if (!crmSnap.empty) {
        const docData = crmSnap.docs[0].data();
        const found = {
          name: docData.name || "",
          email: docData.email || crmSnap.docs[0].id || "",
          address: docData.address || ""
        };

        setClientName(found.name);
        setClientEmail(found.email);
        if (found.address) setClientAddress(found.address);

        setNifFoundInfo(found);
        showToast("Cliente recorrente encontrado no CRM! Dados preenchidos automaticamente.", "success");
        setIsSearchingNif(false);
        return;
      }

      // 2. Search in budgets
      const budgetsRef = collection(db, "budgets");
      const budgetsQuery = query(
        budgetsRef,
        where("clientNif", "==", rawNif),
        limit(1)
      );
      const budgetsSnap = await getDocs(budgetsQuery);

      if (!budgetsSnap.empty) {
        const docData = budgetsSnap.docs[0].data();
        const found = {
          name: docData.clientName || "",
          email: docData.clientEmail || "",
          address: docData.clientAddress || ""
        };

        setClientName(found.name);
        setClientEmail(found.email);
        if (found.address) setClientAddress(found.address);

        setNifFoundInfo(found);
        showToast("Cliente histórico encontrado nos Orçamentos! Dados preenchidos.", "success");
        setIsSearchingNif(false);
        return;
      }

      setNifFoundInfo(null);
    } catch (error) {
      console.warn("NIF auto-fill lookup error:", error);
    } finally {
      setIsSearchingNif(false);
    }
  };

  // AI assistant states
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState("");

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError("");
    try {
      const response = await fetch("/api/ai-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, language: documentLanguage }),
      });
      if (!response.ok) {
        throw new Error("Erro na geração de orçamento por IA.");
      }
      const data = await response.json();
      if (data && data.items && Array.isArray(data.items)) {
        const generatedItems: BudgetLineItem[] = data.items.map((item: any) => ({
          id: Math.random().toString(36).substring(2),
          description: item.description,
          quantity: item.qty || 1,
          unitPrice: item.price || 100,
        }));
        setItems(generatedItems);
        showToast("Itens do orçamento criados pela IA! Edite qualquer campo abaixo se necessário.", "success");
      } else {
        throw new Error("Formato inválido.");
      }
    } catch (err) {
      console.error(err);
      setAiError("Falha na geração. Usando itens de simulação para manter o fluxo ótimo.");
      // Fallback
      setItems([
        { id: Math.random().toString(36).substring(2), description: "Janela de Alumínio Suprema 1.20x1.20m (Vidro Laminado 8mm)", quantity: 2, unitPrice: 2800 },
        { id: Math.random().toString(36).substring(2), description: "Porta de Giro Alumínio Gold 2.10x0.90m completa", quantity: 1, unitPrice: 4200 },
        { id: Math.random().toString(36).substring(2), description: "Instalação especializada com vedação de alta performance", quantity: 1, unitPrice: 850 }
      ]);
      showToast("Não foi possível conectar à IA. Simulamos itens de orçamento customizados para você editar.", "info");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Set form values on editing mode change
  useEffect(() => {
    if (budget) {
      setClientName(budget.clientName || "");
      setClientEmail(budget.clientEmail || "");
      setClientNif(budget.clientNif || "");
      setClientAddress(budget.clientAddress || "");
      setDocumentLanguage(budget.language || "pt");
      setTaxRate(budget.taxRate !== undefined ? budget.taxRate : 10);
      setItems(budget.items || []);
      setNifFoundInfo(budget.clientNif ? { name: budget.clientName || "", email: budget.clientEmail || "", address: budget.clientAddress || "" } : null);
    } else {
      setClientName(prefillClient?.name || "");
      setClientEmail(prefillClient?.email || "");
      setClientNif(prefillClient?.nif || "");
      setClientAddress(prefillClient?.address || "");
      setDocumentLanguage(currentLanguage);
      setTaxRate(10);
      setItems([
        {
          id: Math.random().toString(36).substring(2),
          description: "Esquadrias de Alumínio Customizadas (m²)",
          quantity: 1,
          unitPrice: 1200,
        },
      ]);
      setNifFoundInfo(prefillClient?.nif ? { name: prefillClient.name || "", email: prefillClient.email || "", address: prefillClient.address || "" } : null);
    }
  }, [budget, isOpen, currentLanguage, prefillClient]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const newItem: BudgetLineItem = {
      id: Math.random().toString(36).substring(2),
      description: "",
      quantity: 1,
      unitPrice: 100,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof BudgetLineItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Live total calculation
  const calculateTotals = () => {
    const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = Number((subtotal + taxAmount).toFixed(2));
    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert("Adicione pelo menos um item ao orçamento.");
      return;
    }

    setIsSaving(true);
    try {
      // Automatic Translation of budget text fields for all 10 target languages
      const translationsMap = generateBudgetTranslations(items);

      // Distribute taxes dynamically inside translated budget items
      Object.keys(translationsMap).forEach((langKey) => {
        const itemVal = translationsMap[langKey];
        itemVal.taxAmount = Number(((itemVal.subtotal * taxRate) / 100).toFixed(2));
        itemVal.total = Number((itemVal.subtotal + itemVal.taxAmount).toFixed(2));
      });

      const budgetData: Partial<Budget> = {
        clientName,
        clientEmail,
        clientNif,
        clientAddress,
        language: documentLanguage,
        taxRate,
        items,
        subtotal,
        taxAmount,
        total,
        translations: translationsMap,
        status: budget ? budget.status : "pending",
        date: budget ? budget.date : new Date().toISOString().split("T")[0],
      };

      await onSave(budgetData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-950/50">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {budget ? t.editBudgetTitle : t.newBudgetTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Grid structure for client details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.clientNameLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
                  placeholder="Ex: Empresa de Transportes Lisbon S.A."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.clientEmailLabel} *
                </label>
                <input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
                  placeholder="cliente@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>{t.clientNifLabel} *</span>
                  {isSearchingNif && (
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 animate-pulse font-medium">
                      Buscando histórico...
                    </span>
                  )}
                  {!isSearchingNif && nifFoundInfo && (
                    <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                      ✨ Cliente Recorrente!
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={clientNif}
                    onChange={(e) => {
                      setClientNif(e.target.value);
                      if (!e.target.value.trim()) {
                        setNifFoundInfo(null);
                      }
                    }}
                    onBlur={(e) => lookupNif(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
                    placeholder="Ex: PT 501 024 330"
                  />
                  <button
                    type="button"
                    onClick={() => lookupNif(clientNif)}
                    disabled={isSearchingNif || !clientNif.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer disabled:opacity-40 transition-colors"
                    title="Buscar cliente no banco de dados"
                  >
                    <Search className={`w-4 h-4 ${isSearchingNif ? 'animate-spin text-indigo-500' : ''}`} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.budgetLanguageLabel} (Default)
                </label>
                <select
                  value={documentLanguage}
                  onChange={(e) => setDocumentLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
                >
                  {Object.entries(languageMeta).map(([code, meta]) => (
                    <option key={code} value={code}>
                      {meta.flag} {meta.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.clientAddressLabel}
                </label>
                <textarea
                  rows={2}
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden transition resize-none"
                  placeholder="Av. da Liberdade Nº 100, 1250-145 Lisboa, Portugal"
                />
              </div>
            </div>

            {/* AI Glazing Budget Draft Generator panel */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-luxury-gold/30 shadow-md space-y-4 my-6">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-luxury-gold shrink-0 animate-pulse" />
                <div>
                  <h4 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                    Assistente de Orçamento por IA <span className="text-[9px] bg-luxury-gold px-1.5 py-0.5 rounded-sm text-slate-950 font-bold tracking-tight lowercase font-mono">BETA</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-400 leading-normal font-sans">
                    Descreva o projeto do cliente para que nosso Engenheiro de IA do Anacleto Esquadrias crie as linhas detalhadas do orçamento com dimensões, quantidades e precificação premium em Reais (R$). Você poderá editar qualquer detalhe gerado!
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={isGeneratingAi}
                  rows={2}
                  className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold rounded-xl text-slate-100 placeholder:text-slate-650 outline-hidden resize-none transition"
                  placeholder='Ex: "3 janelas Suprema de 1.50x1.20m cor preta com vidro temperado 8mm incolor + 1 porta Gold de 2.10x0.90m com fecho em inox"'
                />
                
                {aiError && (
                  <p className="text-[10px] text-rose-450 font-semibold">{aiError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateWithAi}
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    className="px-4 py-2 bg-luxury-gold hover:bg-yellow-500 font-bold text-slate-950 text-xs uppercase tracking-wider rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    {isGeneratingAi ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                        Modelando Peças de Alumínio...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 text-slate-950" />
                        Gerar Projeto por IA
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Line items section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-medium text-slate-800 dark:text-slate-200">
                  {t.itemsLabel}
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-150 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-750 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {t.addItemRow}
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white rounded-md focus:ring-2 focus:ring-luxury-gold outline-hidden"
                        placeholder="Nome/Descrição do Serviço (Ex: Serviços de Consultoria)"
                        list="common-services"
                      />
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                      <div className="w-20">
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-center text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-955 dark:text-white rounded-md focus:ring-2 focus:ring-luxury-gold outline-hidden"
                          placeholder="Qty"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-right text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-955 dark:text-white rounded-md focus:ring-2 focus:ring-luxury-gold outline-hidden"
                          placeholder="R$ Unit"
                        />
                      </div>

                      <div className="flex items-center justify-end w-24 text-sm font-semibold text-slate-750 dark:text-slate-300 py-1.5 font-mono">
                        R$ {(item.quantity * item.unitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-405 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Datalist for autocomplete */}
            <datalist id="common-services">
              <option value="Janela de Alumínio Suprema 1.20x1.20m (Vidro Temperado 8mm)" />
              <option value="Porta de Giro Alumínio Gold 2.10x0.90m com Fechadura Inox" />
              <option value="Janela de Correr Porta Linha Gold de Luxo Acústica" />
              <option value="Box de Vidro Temperado de Canto 8mm Incolor Elegance" />
              <option value="Kit Guarda-Corpo de Alumínio de Vidro Laminado de Segurança" />
              <option value="Instalação Especializada com Vedação de Silicone" />
            </datalist>

            {/* Tax Adjustment & Totals Display */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-slate-55/30 dark:bg-slate-950/20 p-4 rounded-xl">
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  {t.tax} (%) - ISS / ICMS / Alíquota de Imposto
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-luxury-gold"
                  />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 min-w-10 text-right">
                    {taxRate}%
                  </span>
                </div>
              </div>

              <div className="w-full md:w-1/2 space-y-1.5 text-right font-mono">
                <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                  <span>{t.subtotal}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 font-sans">
                  <span>Impostos ({taxRate}%):</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    R$ {taxAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-base pt-1 border-t border-slate-200 dark:border-slate-800 font-sans">
                  <span className="font-semibold text-slate-800 dark:text-slate-250">
                    {t.total}:
                  </span>
                  <span className="text-lg font-black text-luxury-gold font-mono">
                    R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Multilingual reassurance message */}
            <p className="text-xs text-slate-400 text-center">
              * Baseado em Real Brasileiro (R$). Ao salvar, o sistema irá traduzir e converter automaticamente os textos deste orçamento para 10 línguas globais.
            </p>

          </div>

          {/* Action buttons */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-350 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-luxury-gold hover:bg-yellow-550 text-slate-950 rounded-lg text-sm font-bold shadow-md cursor-pointer transition disabled:opacity-50"
            >
              {isSaving ? (
                "Salvando..."
              ) : (
                <>
                  <Save className="w-4 h-4 text-slate-950" />
                  {t.saveBtn}
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
