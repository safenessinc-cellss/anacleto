import React, { useState, useEffect } from "react";
import { Plus, Trash, X, Globe, Save, Brain, Sparkles, Wand2, Search, ExternalLink, PackageSearch } from "lucide-react";
import { Budget, BudgetLineItem } from "../types";
import { Translation } from "../translations";
import { generateBudgetTranslations, languageMeta } from "../utils";
import { useToast } from "./ToastContext";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from "firebase/firestore";

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
  const [taxRate, setTaxRate] = useState(0); // Tax rate must be configured from the company tax/accounting setup
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
  const [marketResults, setMarketResults] = useState<any[]>([]);
  const [bomForm, setBomForm] = useState({ manufacturer: "", line: "", typology: "Janela de correr 2 folhas", configuration: "2 folhas", widthMm: "1500", heightMm: "1200", quantity: "1", finish: "Branco" });
  const [bomData, setBomData] = useState<any>(null);
  const [technicalOptions, setTechnicalOptions] = useState<any[]>([]);
  const [technicalOptionsError, setTechnicalOptionsError] = useState("");
  const [bomError, setBomError] = useState("");
  const [isGeneratingBom, setIsGeneratingBom] = useState(false);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [bestSupplier, setBestSupplier] = useState<string | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [marketSearchedAt, setMarketSearchedAt] = useState("");
  const [marketError, setMarketError] = useState("");
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadTechnicalOptions = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const response = await fetch("/api/supplier/technical-options", {
          headers: { Authorization: "Bearer " + await user.getIdToken() }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Não foi possível carregar os sistemas técnicos.");
        if (active) setTechnicalOptions(Array.isArray(data?.systems) ? data.systems : []);
      } catch (error) {
        if (active) setTechnicalOptionsError(error instanceof Error ? error.message : "Falha ao carregar sistemas técnicos.");
      }
    };
    void loadTechnicalOptions();
    return () => { active = false; };
  }, [isOpen]);

  const handleGenerateBom = async () => {
    setIsGeneratingBom(true); setBomError(""); setBomData(null); setComparisons([]);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para gerar o despiece.");
      const response = await fetch("/api/supplier/generate-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({ ...bomForm, widthMm: Number(bomForm.widthMm), heightMm: Number(bomForm.heightMm), quantity: Number(bomForm.quantity) })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Falha ao gerar o despiece.");
      setBomData(data);
      if (!data.complete) setBomError("Despiece parcial: corrija os itens técnicos pendentes antes de usar como lista final de fabricação.");
    } catch (error) { setBomError(error instanceof Error ? error.message : "Não foi possível gerar o despiece."); }
    finally { setIsGeneratingBom(false); }
  };

  const handleCompareBom = async () => {
    if (!bomData?.bom?.length) return;
    if (!bomData.complete) {
      setComparisonNotice("A comparação final está bloqueada: complete as regras de corte e os acessórios pendentes na Biblioteca Técnica.");
      return;
    }
    setIsComparing(true); setComparisonNotice(""); setComparisons([]); setBestSupplier(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para comparar fornecedores.");
      const response = await fetch("/api/supplier/compare-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({ items: bomData.bom })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Falha ao comparar fornecedores.");
      setComparisons(Array.isArray(data?.comparisons) ? data.comparisons : []);
      setBestSupplier(data?.bestSupplier || null);
      setComparisonNotice(data?.bestSupplier ? "Menor custo total verificado: " + data.bestSupplier : data?.notice || "Não há cesta completa com preços aprovados.");
    } catch (error) { setComparisonNotice(error instanceof Error ? error.message : "Não foi possível comparar fornecedores."); }
    finally { setIsComparing(false); }
  };

  const handleMarketResearch = async () => {
    const validItems = (bomData?.bom?.length ? bomData.bom : items.filter((item) => item.description.trim())).map((item: any) => ({...item, description: item.description}));
    if (!validItems.length) {
      setMarketError("Adicione materiais ao orçamento antes de pesquisar preços.");
      return;
    }
    setIsSearchingMarket(true);
    setMarketError("");
    setMarketResults([]);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para pesquisar preços.");
      const idToken = await user.getIdToken();
      if (validItems.length > 60) throw new Error("A pesquisa suporta até 60 componentes por orçamento. Divida a lista técnica em etapas.");
      const collected: any[] = [];
      let searchedAt = new Date().toISOString();
      for (let offset = 0; offset < validItems.length; offset += 12) {
        const response = await fetch("/api/supplier/market-research", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
          body: JSON.stringify({
            location: "Sapucaia do Sul, Rio Grande do Sul, Brasil",
            items: validItems.slice(offset, offset + 12).map((item: any) => ({
              id: item.id, code: item.code || item.sku || "", description: item.description,
              manufacturer: item.manufacturer || bomForm.manufacturer,
              line: item.system || bomForm.line, finish: item.finish || bomForm.finish, unit: item.unit || "un"
            }))
          })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Falha na pesquisa de mercado.");
        collected.push(...(Array.isArray(data?.results) ? data.results : []));
        searchedAt = data?.searchedAt || searchedAt;
      }
      setMarketResults(collected);
      setMarketSearchedAt(searchedAt);
      showToast("Pesquisa concluída para " + collected.length + " componentes. Confirme os preços nas fontes antes de utilizá-los.", "success");
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Não foi possível pesquisar preços.");
    } finally {
      setIsSearchingMarket(false);
    }
  };

  const handleSaveMarketCandidate = async (result: any, offer: any) => {
    const defaultSupplier = String(offer.domain || "Fornecedor").replace(/^www\./, "");
    const supplier = window.prompt("Confirme o nome do fornecedor:", defaultSupplier);
    if (!supplier?.trim()) return;
    const suggested = Array.isArray(offer.prices) && offer.prices.length ? String(offer.prices[0]).replace(".", ",") : "";
    const defaultUnit = String(result.item?.unit || "un");
    const priceUnit = window.prompt("Informe a unidade exata do preço confirmado (bar, metro, kg, peça, m2):", defaultUnit);
    if (!priceUnit?.trim()) return;
    const entered = window.prompt("Informe o preço unitário confirmado na página do fornecedor (R$):", suggested);
    if (!entered?.trim()) return;
    const unitPrice = Number(entered.replace(/\./g, "").replace(",", "."));
    const freightInput = window.prompt("Informe o frete total confirmado para esta cotação (R$). Use 0 somente se retirada/frete grátis estiver confirmado:", "");
    if (freightInput === null || !freightInput.trim()) return;
    const shippingCost = Number(freightInput.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      setMarketError("Informe um frete válido. Use zero apenas quando confirmado.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setMarketError("Preço inválido. Informe o valor unitário em reais.");
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para registrar a cotação.");
      const item = result.item || {};
      await addDoc(collection(db, "supplier_prices"), {
        manufacturer: supplier.trim(),
        supplier: supplier.trim(),
        supplierUrl: "https://" + defaultSupplier,
        line: item.line || bomForm.line || "",
        code: item.code || "",
        description: item.description || offer.title || "",
        finish: item.finish || bomForm.finish || "",
        unit: priceUnit.trim(),
        unitPrice,
        shippingCost,
        shippingConfirmed: true,
        currency: "BRL",
        priceDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
        validUntil: null,
        sourceUrl: offer.url,
        quoteReference: "Preço conferido manualmente pelo usuário a partir da página online",
        status: "pending_review",
        priceStatus: "pending_review",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Cotação registrada como pendente de validação na Biblioteca Técnica.", "success");
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Não foi possível registrar a cotação.");
    }
  };

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para gerar o orçamento com IA.");
      const idToken = await user.getIdToken();
      const sourceNames = ["catalog", "supplier_catalog", "registry_items", "price_table"];
      const snapshots = await Promise.all(sourceNames.map((name) => getDocs(collection(db, name))));
      const catalog = snapshots.flatMap((snapshot, index) => snapshot.docs.map((item) => {
        const data = item.data();
        return { id: item.id, name: data.name || data.description || "", sku: data.sku || data.code || "", category: data.category || "", unit: data.unit || "un", price: Number(data.price ?? 0), source: sourceNames[index] };
      })).filter((item) => item.name);
      const response = await fetch("/api/ai/budget-items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
        body: JSON.stringify({ prompt: aiPrompt, language: documentLanguage, catalog }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Falha ao gerar orçamento (" + response.status + ").");
      if (!Array.isArray(data?.items) || !data.items.length) throw new Error("A IA não retornou linhas válidas.");
      const generatedItems: BudgetLineItem[] = data.items.map((item: any) => ({
        id: crypto.randomUUID(),
        description: String(item.description || ""),
        quantity: Number(item.qty),
        unitPrice: Number(item.price),
        sku: String(item.sku || ""),
        catalogItemId: String(item.catalogItemId || ""),
        catalogSource: item.catalogItemId ? "supplier_catalog" : "",
        priceSource: item.priceSource === "catalog" ? "catalog" : "pending",
        notes: [String(item.notes || ""), item.priceSource === "pending" ? "Preço pendente de confirmação no catálogo." : "Preço vinculado ao registro do catálogo."].filter(Boolean).join(" "),
      }));
      if (generatedItems.some(item => !item.description || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
        throw new Error("A IA devolveu dados incompletos. Revise a descrição e tente novamente.");
      }
      setItems(generatedItems);
      showToast("Itens preparados. Preços validados no catálogo; " + (data.notes ? "pendências: " + data.notes : "revise medidas e valores pendentes") + ".", "success");
    } catch (err) {
      console.error("Budget AI generation failed:", err);
      setAiError(err instanceof Error ? err.message : "A IA não conseguiu gerar o orçamento. Nenhum preço foi inventado.");
      showToast("Falha ao gerar orçamento por IA.", "error");
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
      setTaxRate(budget.taxRate !== undefined ? budget.taxRate : 0);
      setItems((budget.items || []).map((item) => budget.requestOnly ? { ...item, unitPrice: 0 } : item));
      setNifFoundInfo(budget.clientNif ? { name: budget.clientName || "", email: budget.clientEmail || "", address: budget.clientAddress || "" } : null);
    } else {
      setClientName(prefillClient?.name || "");
      setClientEmail(prefillClient?.email || "");
      setClientNif(prefillClient?.nif || "");
      setClientAddress(prefillClient?.address || "");
      setDocumentLanguage(currentLanguage);
      setTaxRate(0);
      // Novo orçamento inicia sem linhas ou preços inventados.
      setItems([]);
      setNifFoundInfo(prefillClient?.nif ? { name: prefillClient.name || "", email: prefillClient.email || "", address: prefillClient.address || "" } : null);
    }
  }, [budget, isOpen, currentLanguage, prefillClient]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const newItem: BudgetLineItem = {
      id: Math.random().toString(36).substring(2),
      description: "",
      quantity: 1,
      unitPrice: 0,
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

            {/* Technical BOM generation and supplier comparison */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 space-y-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <PackageSearch className="h-5 w-5 text-blue-700 dark:text-blue-300"/>
                <div><h4 className="text-sm font-bold text-slate-900 dark:text-white">Despiece técnico automático</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">Gera materiais usando somente perfis, regras e acessórios aprovados na Biblioteca Técnica.</p></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["manufacturer","Fabricante"],["line","Linha / sistema"],["typology","Tipologia"],["configuration","Configuração"],["widthMm","Largura (mm)"],["heightMm","Altura (mm)"],["quantity","Quantidade"],["finish","Acabamento"]
                ] as const).map(([key,label]) => <label key={key} className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}
                  <input value={bomForm[key]} onChange={e=>setBomForm(v=>({...v,[key]:e.target.value}))} list={key==="manufacturer"?"bom-manufacturers":key==="line"?"bom-lines":key==="typology"?"bom-typologies":key==="configuration"?"bom-configurations":key==="finish"?"bom-finishes":undefined} type={["widthMm","heightMm","quantity"].includes(key)?"number":"text"} min={["widthMm","heightMm","quantity"].includes(key)?"1":undefined} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
                </label>)}
              </div>
              <datalist id="bom-manufacturers">{[...new Set(technicalOptions.map((x:any)=>x.manufacturer))].map((x:any)=><option key={x} value={x}/>)}</datalist>
              <datalist id="bom-lines">{[...new Set(technicalOptions.filter((x:any)=>!bomForm.manufacturer||x.manufacturer===bomForm.manufacturer).map((x:any)=>x.line))].map((x:any)=><option key={x} value={x}/>)}</datalist>
              <datalist id="bom-typologies">{[...new Set(technicalOptions.filter((x:any)=>!bomForm.manufacturer||x.manufacturer===bomForm.manufacturer).filter((x:any)=>!bomForm.line||x.line===bomForm.line).map((x:any)=>x.typology))].map((x:any)=><option key={x} value={x}/>)}</datalist>
              <datalist id="bom-configurations">{[...new Set(technicalOptions.filter((x:any)=>!bomForm.manufacturer||x.manufacturer===bomForm.manufacturer).filter((x:any)=>!bomForm.line||x.line===bomForm.line).filter((x:any)=>!bomForm.typology||x.typology===bomForm.typology).map((x:any)=>x.configuration))].map((x:any)=><option key={x} value={x}/>)}</datalist>
              <datalist id="bom-finishes">{[...new Set(technicalOptions.map((x:any)=>x.finish).filter(Boolean))].map((x:any)=><option key={x} value={x}/>)}</datalist>
              {technicalOptionsError&&<p className="text-[10px] text-amber-700">{technicalOptionsError}</p>}
              <button type="button" onClick={handleGenerateBom} disabled={isGeneratingBom} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                {isGeneratingBom ? "Gerando despiece..." : "Gerar lista completa de materiais"}
              </button>
              {bomError && <p className="text-xs text-amber-700 dark:text-amber-300">{bomError}</p>}
              {bomData && <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-900 dark:text-white">Materiais gerados · {bomData.bom?.length || 0} itens</p><span className={bomData.complete?"text-xs font-semibold text-emerald-700":"text-xs font-semibold text-amber-700"}>{bomData.complete?"Completo conforme à Biblioteca Técnica verificada":"Despiece incompleto"}</span></div>
                {(bomData.bom||[]).map((part:any)=><div key={part.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-2 text-xs dark:border-slate-800">
                  <div><p className="font-semibold text-slate-800 dark:text-slate-100">{part.code} · {part.description}</p><p className="text-slate-500">{part.manufacturer} · {part.system} · {part.finish} · {part.unit}{part.glassType?" · "+part.glassType:""}{part.glassThicknessMm?" · "+part.glassThicknessMm+" mm":""}</p>
                  {part.cutLengthsMm?.length>0&&<p className="text-slate-500">Cortes: {part.cutLengthsMm.map((v:number)=>Math.round(v)+" mm").join(", ")} · Barra {part.commercialBarLengthMm} mm</p>}
                  {part.sourceDocumentId&&<p className="text-slate-500">Documento: {part.sourceDocumentId}{part.sourcePage? " · pág. "+part.sourcePage:""}</p>}</div>
                  <p className="font-bold tabular-nums">{part.quantity} {part.unit}</p>
                </div>)}
                {(bomData.errors||[]).map((error:string,i:number)=><p key={i} className="text-xs text-amber-700 dark:text-amber-300">• {error}</p>)}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" onClick={handleMarketResearch} disabled={isSearchingMarket||!bomData.bom?.length} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">Pesquisar preços online</button>
                  <button type="button" onClick={handleCompareBom} disabled={isComparing||!bomData.bom?.length} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{isComparing?"Comparando...":"Comparar fornecedores aprovados"}</button>
                </div>
                {comparisonNotice&&<p className="text-xs text-slate-600 dark:text-slate-300">{comparisonNotice}</p>}
                {comparisons.map((basket:any)=><div key={basket.supplier} className={`rounded-lg border p-3 dark:border-slate-700 ${bestSupplier===basket.supplier?"border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20":"border-slate-200"}`}>
                  <div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-bold">{basket.supplier}{bestSupplier===basket.supplier?" · MENOR CUSTO TOTAL":""}</p><p className="text-xs font-bold">{basket.complete?basket.total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"Cesta incompleta"}</p></div>
                  <p className="text-[10px] text-slate-500">{basket.complete?"Todos os itens e frete têm confirmação aprovada.":"Faltam preços ou frete confirmado: "+(basket.missingItems||[]).join(", ")}</p>
                  <p className="text-[10px] text-slate-500">Materiais: {Number(basket.materialSubtotal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} · Frete: {Number(basket.shippingCost||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
                  {basket.lines?.map((line:any,i:number)=><p key={i} className="mt-1 text-[10px] text-slate-600">{line.description}: {line.subtotal==null?"Sem preço aprovado":line.subtotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}{line.sourceUnit&&line.sourceUnit!==line.unit?" · convertido de "+line.sourceUnit:""}</p>)}
                </div>)}
              </div>}
            </div>

            {/* Online market research panel */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <PackageSearch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pesquisa de preços de mercado</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Pesquisa ofertas online para os materiais descritos no orçamento, considerando Sapucaia do Sul/RS.</p>
                </div>
              </div>
              <button type="button" onClick={handleMarketResearch} disabled={isSearchingMarket || !items.some((item) => item.description.trim())}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {isSearchingMarket ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Search className="h-4 w-4" />}
                {isSearchingMarket ? "Pesquisando fornecedores..." : "Pesquisar preços online"}
              </button>
              {marketError && <p className="text-xs text-rose-600">{marketError}</p>}
              {marketSearchedAt && <p className="text-[10px] text-slate-500">Pesquisa realizada em {new Date(marketSearchedAt).toLocaleString("pt-BR")} · até 60 componentes por execução.</p>}
              {marketResults.map((result: any) => (
                <div key={result.item?.id || result.searchTerm} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{result.item?.description || "Material"}</p>
                  {!result.offers?.length && <p className="text-xs text-amber-700 dark:text-amber-400">Nenhuma oferta encontrada. Solicite cotação direta ao fornecedor.</p>}
                  {(result.offers || []).map((offer: any, index: number) => (
                    <div key={offer.url + index} className="border-t border-slate-100 dark:border-slate-800 pt-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{offer.title}</p>
                          <p className="text-slate-500">{offer.domain}</p>
                          {offer.prices?.length > 0 ? <p className="font-semibold text-indigo-700 dark:text-indigo-300">Preço candidato: {offer.prices.map((price: number) => price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })).join(" / ")}</p> : <p className="text-slate-500">Preço não identificado na pesquisa.</p>}
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">Não verificado · confirme código, acabamento, unidade, estoque, frete e validade.</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <a href={offer.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                          <button type="button" onClick={() => handleSaveMarketCandidate(result, offer)} className="rounded-md border border-indigo-200 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50">Registrar cotação</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
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
