import React, { useEffect, useState } from "react";
import { ExternalLink, PackageSearch, Search } from "lucide-react";
import { auth, db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "./ToastContext";

type TechnicalOption = {
  manufacturer: string;
  line: string;
  typology: string;
  configuration: string;
  finish?: string;
};

export default function TechnicalCalculatorModule() {
  const { showToast } = useToast();
  const [bomForm, setBomForm] = useState({
    manufacturer: "",
    line: "",
    typology: "Janela de correr 2 folhas",
    configuration: "2 folhas",
    widthMm: "1500",
    heightMm: "1200",
    quantity: "1",
    finish: "Branco",
  });
  const [bomData, setBomData] = useState<any>(null);
  const [technicalOptions, setTechnicalOptions] = useState<TechnicalOption[]>([]);
  const [technicalOptionsError, setTechnicalOptionsError] = useState("");
  const [bomError, setBomError] = useState("");
  const [isGeneratingBom, setIsGeneratingBom] = useState(false);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [bestSupplier, setBestSupplier] = useState<string | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [marketResults, setMarketResults] = useState<any[]>([]);
  const [marketSearchedAt, setMarketSearchedAt] = useState("");
  const [marketError, setMarketError] = useState("");
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);
  const [aluminumPricePerKg, setAluminumPricePerKg] = useState("");
  const [aluminumPriceSource, setAluminumPriceSource] = useState<any>(null);
  const [isSearchingAluminumPrice, setIsSearchingAluminumPrice] = useState(false);
  const aluminumPurchasedKg = (bomData?.bom || []).filter((item: any) => item.category === "aluminum_profile" && Number(item.weightKgM) > 0 && Number(item.commercialBarLengthMm) > 0)
    .reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.commercialBarLengthMm) / 1000 * Number(item.weightKgM), 0);
  const aluminumEstimatedCost = aluminumPurchasedKg * Math.max(0, Number(aluminumPricePerKg.replace(",", ".")) || 0);

  const handleSearchAluminumPrice = async () => {
    setIsSearchingAluminumPrice(true);
    setMarketError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para pesquisar o preço de referência.");
      const response = await fetch("/api/supplier/market-research", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({
          location: "Rio Grande do Sul, Brasil",
          items: [{ id: "aluminum-price-per-kg", code: "", description: "perfil de alumínio extrudado preço por kg", manufacturer: bomForm.manufacturer, line: bomForm.line, finish: bomForm.finish, unit: "kg" }],
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Não foi possível pesquisar o preço por kg.");
      const offers = (data?.results || []).flatMap((row: any) => row.offers || []);
      const candidate = offers.find((offer: any) => Array.isArray(offer.prices) && offer.prices.length > 0);
      if (!candidate) throw new Error("A pesquisa não encontrou um preço por kg explícito. Informe o valor manualmente após cotação.");
      const value = Number(candidate.prices[0]);
      setAluminumPricePerKg(value.toFixed(2));
      setAluminumPriceSource({ url: candidate.url, title: candidate.title, domain: candidate.domain, observedAt: data.searchedAt || new Date().toISOString() });
      showToast("Preço encontrado como referência não verificada. Revise e edite antes de calcular.", "success");
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Falha ao pesquisar preço por kg.");
    } finally {
      setIsSearchingAluminumPrice(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadTechnicalOptions = async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("Entre na sua conta para carregar os sistemas técnicos.");
        const response = await fetch("/api/supplier/technical-options", {
          headers: { Authorization: "Bearer " + await user.getIdToken() },
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
  }, []);

  const updateField = (key: keyof typeof bomForm, value: string) => {
    setBomForm((current) => ({ ...current, [key]: value }));
    setBomData(null);
    setComparisons([]);
    setBestSupplier(null);
    setComparisonNotice("");
  };

  const handleGenerateBom = async () => {
    setIsGeneratingBom(true);
    setBomError("");
    setBomData(null);
    setComparisons([]);
    setBestSupplier(null);
    setComparisonNotice("");
    setMarketResults([]);
    setMarketError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para gerar a lista técnica.");
      const response = await fetch("/api/supplier/generate-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({
          ...bomForm,
          widthMm: Number(bomForm.widthMm),
          heightMm: Number(bomForm.heightMm),
          quantity: Number(bomForm.quantity),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Falha ao gerar a lista técnica.");
      setBomData(data);
      if (!data.complete) setBomError("Lista parcial: corrija os dados técnicos pendentes na Biblioteca Técnica antes de usar como lista final de fabricação.");
    } catch (error) {
      setBomError(error instanceof Error ? error.message : "Não foi possível gerar a lista técnica.");
    } finally {
      setIsGeneratingBom(false);
    }
  };

  const handleCompareBom = async () => {
    if (!bomData?.bom?.length) return;
    if (!bomData.complete) {
      setComparisonNotice("A comparação final está bloqueada: complete as regras de corte e os acessórios pendentes na Biblioteca Técnica.");
      return;
    }
    setIsComparing(true);
    setComparisonNotice("");
    setComparisons([]);
    setBestSupplier(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para comparar fornecedores.");
      const response = await fetch("/api/supplier/compare-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
        body: JSON.stringify({ items: bomData.bom }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Falha ao comparar fornecedores.");
      setComparisons(Array.isArray(data?.comparisons) ? data.comparisons : []);
      setBestSupplier(data?.bestSupplier || null);
      setComparisonNotice(data?.bestSupplier
        ? "Menor custo total verificado: " + data.bestSupplier
        : data?.notice || "Não há cesta completa com preços aprovados.");
    } catch (error) {
      setComparisonNotice(error instanceof Error ? error.message : "Não foi possível comparar fornecedores.");
    } finally {
      setIsComparing(false);
    }
  };

  const handleMarketResearch = async () => {
    const validItems = (bomData?.bom || []).map((item: any) => ({ ...item, description: item.description }));
    if (!validItems.length) {
      setMarketError("Gere a lista técnica antes de pesquisar preços de mercado.");
      return;
    }
    setIsSearchingMarket(true);
    setMarketError("");
    setMarketResults([]);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Entre na sua conta para pesquisar preços.");
      const idToken = await user.getIdToken();
      if (validItems.length > 60) throw new Error("A pesquisa suporta até 60 componentes por execução. Divida a lista técnica em etapas.");
      const collected: any[] = [];
      let searchedAt = new Date().toISOString();
      for (let offset = 0; offset < validItems.length; offset += 12) {
        const response = await fetch("/api/supplier/market-research", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
          body: JSON.stringify({
            location: "Sapucaia do Sul, Rio Grande do Sul, Brasil",
            items: validItems.slice(offset, offset + 12).map((item: any) => ({
              id: item.id,
              code: item.code || item.sku || "",
              description: item.description,
              manufacturer: item.manufacturer || bomForm.manufacturer,
              line: item.system || bomForm.line,
              finish: item.finish || bomForm.finish,
              unit: item.unit || "un",
            })),
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Falha na pesquisa de mercado.");
        collected.push(...(Array.isArray(data?.results) ? data.results : []));
        searchedAt = data?.searchedAt || searchedAt;
      }
      setMarketResults(collected);
      setMarketSearchedAt(searchedAt);
      showToast("Pesquisa concluída. Confirme os preços nas fontes antes de utilizá-los.", "success");
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
        priceDate: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        validUntil: null,
        sourceUrl: offer.url,
        quoteReference: "Preço conferido manualmente pelo usuário a partir da página online",
        status: "pending_review",
        priceStatus: "pending_review",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast("Cotação registrada como pendente de validação na Biblioteca Técnica.", "success");
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Não foi possível registrar a cotação.");
    }
  };

  const filteredLines = [...new Set(technicalOptions
    .filter((option) => !bomForm.manufacturer || option.manufacturer === bomForm.manufacturer)
    .map((option) => option.line))];
  const filteredTypologies = [...new Set(technicalOptions
    .filter((option) => !bomForm.manufacturer || option.manufacturer === bomForm.manufacturer)
    .filter((option) => !bomForm.line || option.line === bomForm.line)
    .map((option) => option.typology))];
  const filteredConfigurations = [...new Set(technicalOptions
    .filter((option) => !bomForm.manufacturer || option.manufacturer === bomForm.manufacturer)
    .filter((option) => !bomForm.line || option.line === bomForm.line)
    .filter((option) => !bomForm.typology || option.typology === bomForm.typology)
    .map((option) => option.configuration))];
  const manufacturers = [...new Set(technicalOptions.map((option) => option.manufacturer))];
  const finishes = [...new Set(technicalOptions.map((option) => option.finish).filter(Boolean))];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><PackageSearch className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Calculadora Técnica de Esquadrias</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Informe o sistema e as dimensões para gerar o despiece técnico, otimizar os cortes e consultar custos de fornecedores com dados aprovados.</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Dados da esquadria</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["manufacturer", "Fabricante"],
            ["line", "Linha / sistema"],
            ["typology", "Tipologia"],
            ["configuration", "Configuração"],
            ["widthMm", "Largura (mm)"],
            ["heightMm", "Altura (mm)"],
            ["quantity", "Quantidade"],
            ["finish", "Acabamento"],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {label}
              <input
                value={bomForm[key]}
                onChange={(event) => updateField(key, event.target.value)}
                list={key === "manufacturer" ? "calc-manufacturers" : key === "line" ? "calc-lines" : key === "typology" ? "calc-typologies" : key === "configuration" ? "calc-configurations" : key === "finish" ? "calc-finishes" : undefined}
                type={["widthMm", "heightMm", "quantity"].includes(key) ? "number" : "text"}
                min={["widthMm", "heightMm", "quantity"].includes(key) ? "1" : undefined}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          ))}
        </div>
        <datalist id="calc-manufacturers">{manufacturers.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="calc-lines">{filteredLines.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="calc-typologies">{filteredTypologies.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="calc-configurations">{filteredConfigurations.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="calc-finishes">{finishes.map((value) => <option key={value} value={value} />)}</datalist>
        {technicalOptionsError && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{technicalOptionsError}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleGenerateBom} disabled={isGeneratingBom} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
            {isGeneratingBom ? "Calculando..." : "Calcular despiece técnico"}
          </button>
          <span className="text-xs text-slate-500">O cálculo utiliza somente perfis, regras e acessórios aprovados na Biblioteca Técnica.</span>
        </div>
        {bomError && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{bomError}</p>}
      </section>

      {bomData && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-900 dark:text-white">Lista técnica · {bomData.bom?.length || 0} componentes</h2>
            <span className={bomData.complete ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>{bomData.complete ? "Completa conforme dados verificados" : "Lista incompleta — requer revisão"}</span>
          </div>
          {(bomData.bom || []).map((part: any) => (
            <div key={part.id} className="flex flex-wrap justify-between gap-3 border-t border-slate-100 py-3 text-sm dark:border-slate-800">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{part.code} · {part.description}</p>
                <p className="text-xs text-slate-500">{part.manufacturer} · {part.system} · {part.finish} · {part.unit}{part.glassType ? " · " + part.glassType : ""}{part.glassThicknessMm ? " · " + part.glassThicknessMm + " mm" : ""}</p>
                {part.cutLengthsMm?.length > 0 && <p className="text-xs text-slate-500">Cortes: {part.cutLengthsMm.map((value: number) => Math.round(value) + " mm").join(", ")} · Barra {part.commercialBarLengthMm} mm</p>}
                {part.sourceDocumentId && <p className="text-xs text-slate-500">Documento: {part.sourceDocumentId}{part.sourcePage ? " · pág. " + part.sourcePage : ""}</p>}
              </div>
              <p className="font-bold tabular-nums">{part.quantity} {part.unit}</p>
            </div>
          ))}
          {(bomData.errors || []).map((error: string, index: number) => <p key={index} className="text-xs text-amber-700 dark:text-amber-300">• {error}</p>)}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[180px] flex-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Preço de referência do alumínio (R$/kg)
                <input type="number" min="0" step="0.01" value={aluminumPricePerKg} onChange={(event) => { setAluminumPricePerKg(event.target.value); setAluminumPriceSource(null); }} placeholder="Informe ou pesquise" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <button type="button" onClick={handleSearchAluminumPrice} disabled={isSearchingAluminumPrice} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50 dark:text-amber-200">{isSearchingAluminumPrice ? "Pesquisando..." : "Buscar referência na internet"}</button>
            </div>
            <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">Valor apenas sugestivo; pode ser editado neste cálculo. Não é cotação confirmada e não atualiza a tabela oficial nem outros orçamentos.</p>
            {aluminumPriceSource && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Fonte: <a href={aluminumPriceSource.url} target="_blank" rel="noreferrer" className="underline">{aluminumPriceSource.domain || aluminumPriceSource.title}</a> · pesquisado em {new Date(aluminumPriceSource.observedAt).toLocaleString("pt-BR")} · não verificado</p>}
            {aluminumPurchasedKg > 0 && <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Peso estimado das barras compradas: {aluminumPurchasedKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg · Referência de custo: {aluminumEstimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
            {aluminumPurchasedKg === 0 && <p className="mt-2 text-xs text-slate-500">O peso e o comprimento comercial verificados dos perfis são necessários para calcular o custo estimado.</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={handleMarketResearch} disabled={isSearchingMarket || !bomData.bom?.length} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><Search className="h-4 w-4" />{isSearchingMarket ? "Pesquisando..." : "Pesquisar preços de mercado"}</button>
            <button type="button" onClick={handleCompareBom} disabled={isComparing || !bomData.bom?.length} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{isComparing ? "Comparando..." : "Comparar fornecedores aprovados"}</button>
          </div>
          {comparisonNotice && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{comparisonNotice}</p>}
          {comparisons.map((basket: any) => (
            <div key={basket.supplier} className={`mt-3 rounded-xl border p-4 dark:border-slate-700 ${bestSupplier === basket.supplier ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-slate-200"}`}>
              <div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-bold">{basket.supplier}{bestSupplier === basket.supplier ? " · MENOR CUSTO TOTAL" : ""}</p><p className="text-sm font-bold">{basket.complete ? basket.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Cesta incompleta"}</p></div>
              <p className="text-xs text-slate-500">{basket.complete ? "Todos os itens e o frete têm confirmação aprovada." : "Faltam preços ou frete confirmado: " + (basket.missingItems || []).join(", ")}</p>
              <p className="text-xs text-slate-500">Materiais: {Number(basket.materialSubtotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Frete: {Number(basket.shippingCost || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              {(basket.lines || []).map((line: any, index: number) => <p key={index} className="mt-1 text-xs text-slate-600">{line.description}: {line.subtotal == null ? "Sem preço aprovado" : line.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{line.sourceUnit && line.sourceUnit !== line.unit ? " · convertido de " + line.sourceUnit : ""}</p>)}
            </div>
          ))}
        </section>
      )}

      {(marketError || marketResults.length > 0) && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-bold text-slate-900 dark:text-white">Pesquisa de preços de mercado</h2><p className="text-xs text-slate-600 dark:text-slate-400">Resultados preliminares; não são preços aprovados.</p></div>
            {marketSearchedAt && <span className="text-xs text-slate-500">{new Date(marketSearchedAt).toLocaleString("pt-BR")}</span>}
          </div>
          {marketError && <p className="mt-2 text-sm text-rose-600">{marketError}</p>}
          {marketResults.map((result: any) => (
            <div key={result.item?.id || result.searchTerm} className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{result.item?.description || "Material"}</p>
              {!result.offers?.length && <p className="mt-2 text-xs text-amber-700">Nenhuma oferta encontrada. Solicite cotação direta ao fornecedor.</p>}
              {(result.offers || []).map((offer: any, index: number) => (
                <div key={offer.url + index} className="mt-2 flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{offer.title}</p>
                    <p className="text-slate-500">{offer.domain}</p>
                    {offer.prices?.length > 0 ? <p className="font-semibold text-indigo-700">Preço candidato: {offer.prices.map((price: number) => price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })).join(" / ")}</p> : <p className="text-slate-500">Preço não identificado na pesquisa.</p>}
                    <p className="text-[10px] text-amber-700">Não verificado · confirme código, acabamento, unidade, estoque, frete e validade.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <a href={offer.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">Abrir <ExternalLink className="h-3 w-3" /></a>
                    <button type="button" onClick={() => handleSaveMarketCandidate(result, offer)} className="rounded-md border border-indigo-200 px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-50">Registrar cotação</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
