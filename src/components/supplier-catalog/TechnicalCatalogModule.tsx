import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { auth, db } from "../../firebase";
import { queueLegacyCatalogReview } from "../../utils/technicalCatalogFirestore";
import { approveLegacyCatalogCandidate } from "../../utils/technicalCatalogApproval";
import { createSupremaTwoLeafSlidingWindowDraft } from "../../utils/manufacturingFormulas";

type ReviewRow = {
  id: string;
  suggestedSupplierName: string;
  supplierSku: string;
  suggestedDescription: string;
  suggestedCategory?: string;
  suggestedPrice?: number;
  suggestedPriceBasis?: string;
  legacyCollection: string;
  reviewIssues: string[];
  status: string;
};

type TechnicalItemRow = {
  id: string;
  canonicalCode?: string;
  description?: string;
  category?: string;
  active?: boolean;
};

const categoryLabel: Record<string, string> = {
  aluminum_profile: "Perfil de alumínio",
  glass: "Vidro",
  hardware: "Ferragem",
  accessory: "Acessório",
  fastener: "Fixador",
  seal: "Vedação",
  consumable: "Consumível",
};

export default function TechnicalCatalogModule() {
  const [authReady, setAuthReady] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [technicalItems, setTechnicalItems] = useState<TechnicalItemRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [formulaStatus, setFormulaStatus] = useState("Não cadastrado");
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [approval, setApproval] = useState({ canonicalCode: "", category: "accessory", description: "", unit: "un", supplierId: "", supplierName: "", supplierSku: "", price: "", priceBasis: "unit", validFrom: new Date().toISOString().slice(0, 10), sourceUrl: "", sourceDocument: "", weightKgPerMeter: "", commercialLengthMm: "", glassThicknessMm: "", glassType: "", colorOrFinish: "", systemLineIds: "", compatibleTipologiaIds: "" });

  useEffect(() => onAuthStateChanged(auth, (user) => setAuthReady(!!user)), []);

  useEffect(() => {
    if (!authReady) return;
    const stopReview = onSnapshot(collection(db, "technical_catalog_review"), (snapshot) => {
      setReviewRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ReviewRow)));
    }, (err) => setError("Falha ao carregar a fila de revisão: " + err.message));
    const stopItems = onSnapshot(collection(db, "technical_catalog_items"), (snapshot) => {
      setTechnicalItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as TechnicalItemRow)));
    }, (err) => setError("Falha ao carregar o catálogo técnico: " + err.message));
    return () => { stopReview(); stopItems(); };
  }, [authReady]);

  const pendingRows = useMemo(
    () => reviewRows.filter((row) => row.status === "pending_review"),
    [reviewRows],
  );
  const supplierCount = useMemo(
    () => new Set(reviewRows.map((row) => row.suggestedSupplierName).filter(Boolean)).size,
    [reviewRows],
  );

  const openReview = (row: ReviewRow) => {
    setSelectedReview(row);
    setApproval({
      canonicalCode: row.supplierSku || "",
      category: row.suggestedCategory || "accessory",
      description: row.suggestedDescription || "",
      unit: row.suggestedCategory === "aluminum_profile" ? "m" : row.suggestedCategory === "glass" ? "m2" : "un",
      supplierId: row.suggestedSupplierName || "",
      supplierName: row.suggestedSupplierName || "",
      supplierSku: row.supplierSku || "",
      price: row.suggestedPrice ? String(row.suggestedPrice) : "",
      priceBasis: row.suggestedPriceBasis || (row.suggestedCategory === "aluminum_profile" ? "kg" : row.suggestedCategory === "glass" ? "m2" : "unit"),
      validFrom: new Date().toISOString().slice(0, 10),
      sourceUrl: "",
      sourceDocument: "",
      weightKgPerMeter: "",
      commercialLengthMm: row.suggestedLengthMm ? String(row.suggestedLengthMm) : "",
      glassThicknessMm: "",
      glassType: "",
      colorOrFinish: row.suggestedFinish || "",
      systemLineIds: "",
      compatibleTipologiaIds: "",
    });
  };

  const saveApproval = async () => {
    if (!selectedReview) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await approveLegacyCatalogCandidate(db, {
        reviewId: selectedReview.id,
        ...approval,
        category: approval.category as any,
        unit: approval.unit as any,
        price: Number(approval.price),
        priceBasis: approval.priceBasis as any,
        weightKgPerMeter: approval.weightKgPerMeter ? Number(approval.weightKgPerMeter) : undefined,
        commercialLengthMm: approval.commercialLengthMm ? Number(approval.commercialLengthMm) : undefined,
        glassThicknessMm: approval.glassThicknessMm ? Number(approval.glassThicknessMm) : undefined,
        systemLineIds: approval.systemLineIds.split(",").map((value) => value.trim()).filter(Boolean),
        compatibleTipologiaIds: approval.compatibleTipologiaIds.split(",").map((value) => value.trim()).filter(Boolean),
      });
      setNotice("Item canônico criado (" + result.itemId + "). A oferta permanece pendente de aprovação documental e comercial.");
      setSelectedReview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar o cadastro.");
    } finally { setBusy(false); }
  };

  const rejectReview = async (row: ReviewRow) => {
    setBusy(true); setError("");
    try {
      await updateDoc(doc(db, "technical_catalog_review", row.id), {
        status: "rejected",
        reviewedAt: serverTimestamp(),
      });
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao rejeitar registro."); }
    finally { setBusy(false); }
  };

  const createSupremaDraft = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const definition = createSupremaTwoLeafSlidingWindowDraft(new Date().toISOString());
      const reference = doc(db, "tipologia_definitions", definition.id);
      const existing = await getDoc(reference);
      if (existing.exists()) {
        setFormulaStatus(String(existing.data().status || "draft"));
        setNotice("A fórmula Suprema de 2 folhas já existe. Nenhum dado foi sobrescrito.");
      } else {
        await setDoc(reference, definition);
        setFormulaStatus(definition.status);
        setNotice("Rascunho Suprema criado com checklist técnico. Ainda não calcula nem libera orçamento.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o rascunho da tipologia.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(doc(db, "tipologia_definitions", "janela-correr-2-folhas-suprema"), (snapshot) => {
      setFormulaStatus(snapshot.exists() ? String(snapshot.data().status || "draft") : "Não cadastrado");
    }, (err) => setError("Falha ao carregar fórmula Suprema: " + err.message));
  }, [authReady]);

  const importLegacy = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await queueLegacyCatalogReview(db);
      setNotice(
        "Auditoria concluída: " + result.scanned + " registros analisados, " +
        result.queued + " enviados para revisão e " + result.alreadyQueued + " já existentes.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível analisar os catálogos existentes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Database className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Base técnica integrada</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Central de catálogos ANACLETO</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Reúne os cadastros atuais em uma fila de normalização. Nenhum produto, preço ou compatibilidade é aprovado automaticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={importLegacy}
          disabled={!authReady || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Analisando..." : "Analisar catálogos existentes"}
        </button>
      </div>

      {notice && <div role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</div>}
      {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-500">Itens técnicos validados</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{technicalItems.length}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-500">Registros para revisão</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendingRows.length}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-500">Fornecedores identificados</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{supplierCount}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-500">Registros na fila</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{reviewRows.length}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Tipologia inicial: Suprema — janela de correr 2 folhas</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Status da fórmula: <strong>{formulaStatus}</strong>. O rascunho contém apenas a lista de verificações; não contém medidas de corte inventadas.</p>
          </div>
          <button type="button" disabled={!authReady || busy} onClick={createSupremaDraft} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Criar rascunho técnico</button>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Segurança de orçamento: perfis precisam de peso em kg/m; vidros precisam de tipo e espessura; ferragens precisam de compatibilidade confirmada. Preços sem unidade, fonte e validade ficam bloqueados para cálculo automático.
        </p>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Amostra da fila de revisão</h3>
          <span className="text-xs text-slate-500">Até 8 registros</span>
        </div>
        {reviewRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
            Nenhum registro foi analisado ainda. Execute a análise para preparar os cadastros existentes.
          </div>
        ) : (
          <div className="space-y-2">
            {reviewRows.filter((row) => row.status === "pending_review").slice(0, 30).map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.suggestedDescription || "Item sem descrição"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.suggestedSupplierName || "Fornecedor não identificado"} · {row.supplierSku || "Sem SKU"} · {categoryLabel[row.suggestedCategory || ""] || "Categoria pendente"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" /> Revisar
                  </span>
                </div>
                {row.reviewIssues?.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
                    {row.reviewIssues.slice(0, 3).map((issue, index) => <li key={index}>{issue}</li>)}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openReview(row)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Revisar e cadastrar</button>
                  <button type="button" disabled={busy} onClick={() => rejectReview(row)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="Revisar produto técnico">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Revisão técnica do produto</h3><p className="text-xs text-slate-500">O cadastro canônico é criado; a oferta comercial continua pendente de verificação.</p></div>
              <button type="button" onClick={() => setSelectedReview(null)} className="rounded-lg border px-3 py-1 text-sm">Fechar</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["Código canônico","canonicalCode"],["Descrição","description"],["Fornecedor / ID","supplierId"],["SKU original","supplierSku"],["Preço (R$)","price"],["Data inicial","validFrom"],["Fonte URL","sourceUrl"],["Documento de origem","sourceDocument"],["Peso do perfil (kg/m)","weightKgPerMeter"],["Comprimento comercial (mm)","commercialLengthMm"],["Espessura vidro (mm)","glassThicknessMm"],["Tipo de vidro","glassType"],["Acabamento","colorOrFinish"],["Linhas compatíveis (IDs separados por vírgula)","systemLineIds"],["Tipologias compatíveis (IDs separados por vírgula)","compatibleTipologiaIds"]
              ] as const).map(([label,key]) => (
                <label key={key} className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}
                  <input value={approval[key]} onChange={(event) => setApproval((current) => ({...current,[key]:event.target.value}))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
              ))}
              <label className="grid gap-1 text-xs font-medium text-slate-600">Categoria
                <select value={approval.category} onChange={(event) => setApproval((current) => ({...current,category:event.target.value}))} className="rounded-lg border px-3 py-2 text-sm">
                  {Object.entries(categoryLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-600">Unidade de estoque
                <select value={approval.unit} onChange={(event) => setApproval((current) => ({...current,unit:event.target.value}))} className="rounded-lg border px-3 py-2 text-sm">
                  {["kg","m","m2","un","barra","conjunto"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-600">Base do preço
                <select value={approval.priceBasis} onChange={(event) => setApproval((current) => ({...current,priceBasis:event.target.value}))} className="rounded-lg border px-3 py-2 text-sm">
                  {["kg","m","m2","unit","bar","set"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedReview(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
              <button type="button" disabled={busy} onClick={saveApproval} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : "Criar item técnico"}</button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="h-4 w-4" />
        Importação não destrutiva: os registros originais permanecem nos módulos atuais.
      </div>
    </section>
  );
}
