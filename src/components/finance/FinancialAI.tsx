import React, { useRef, useState } from "react";
import { Sparkles, Upload, CheckCircle, Loader2, FileText, Save, AlertTriangle } from "lucide-react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, auth, storage } from "../../firebase";

type ExtractedItem = { description: string; sku?: string; quantity: number; unit?: string; unitPrice: number; total: number };
type ExtractedDocument = { documentType?: string; supplierName?: string; supplierCnpj?: string; documentNumber?: string; accessKey?: string; issueDate?: string; dueDate?: string; total?: number; tax?: number; description?: string; items?: ExtractedItem[]; confidence?: string; warnings?: string[] };
type InvoiceBoleto = { id: string; number: string; digitableLine: string; amount: number; dueDate: string };
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

export default function FinancialAI() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExtractedDocument | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCnpj, setSupplierCnpj] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [total, setTotal] = useState("");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [boletos, setBoletos] = useState<InvoiceBoleto[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const readBase64 = (selected: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => { const encoded = String(reader.result || "").split(",")[1]; encoded ? resolve(encoded) : reject(new Error("Arquivo vazio ou inválido.")); };
    reader.readAsDataURL(selected);
  });

  const handleUpload = async () => {
    if (!file) return setError("Selecione uma nota fiscal, boleto, recibo ou documento de compra.");
    if (file.size > 10 * 1024 * 1024) return setError("O arquivo deve ter no máximo 10 MB.");
    const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) return setError("Formato não suportado. Use PDF, JPG, PNG ou WEBP.");
    setExtracting(true); setError(""); setMessage(""); setResult(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Entre na sua conta para processar documentos financeiros.");
      const data = await readBase64(file);
      const response = await fetch("/api/ai/purchase-extract", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken }, body: JSON.stringify({ data, mimeType, fileName: file.name }) });
      const parsed = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parsed.error || "A IA não conseguiu interpretar o documento.");
      if (!Number(parsed.total) || Number(parsed.total) <= 0) throw new Error("A IA não identificou um valor total válido. Tente uma imagem mais nítida ou preencha manualmente em Compras Gerais.");
      setResult(parsed); setSupplierName(String(parsed.supplierName || "")); setSupplierCnpj(String(parsed.supplierCnpj || ""));
      setDocumentNumber(String(parsed.documentNumber || "")); setDescription(String(parsed.description || parsed.documentType || "Documento financeiro"));
      setIssueDate(String(parsed.issueDate || today())); setDueDate(String(parsed.dueDate || today()));
      setTotal(String(Number(parsed.total).toFixed(2))); setTax(String(Number(parsed.tax || 0).toFixed(2)));
      setNotes(Array.isArray(parsed.warnings) ? parsed.warnings.join("; ") : "");
      setMessage("Leitura concluída. Confira e corrija os dados antes de enviar para aprovação no Financeiro.");
    } catch (e) { setError((e as Error).message || "Falha ao interpretar o documento."); }
    finally { setExtracting(false); }
  };

  const saveToFinance = async () => {
    if (!file || !result) return setError("Leia um documento antes de salvar.");
    const amount = Number(total), taxes = Number(tax) || 0;
    if (!supplierName.trim()) return setError("Informe o fornecedor / emitente.");
    if (!Number.isFinite(amount) || amount <= 0 || taxes < 0 || taxes > amount) return setError("Confira o valor total e os tributos.");
    if (!dueDate) return setError("Informe a data de vencimento.");
    setSaving(true); setError(""); setMessage("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      const normalizedBoletos = boletos.filter(b => Number(b.amount) > 0 && b.dueDate).map(b => ({ ...b, number: b.number.trim(), digitableLine: b.digitableLine.trim(), amount: Math.round(Number(b.amount) * 100) / 100 }));
      const keys = normalizedBoletos.map(b => b.digitableLine.replace(/\D/g, "") || b.number.replace(/\D/g, "")).filter(Boolean);
      if (normalizedBoletos.length && Math.abs(normalizedBoletos.reduce((sum, row) => sum + row.amount, 0) - amount) > 0.02) throw new Error("A soma dos boletos precisa corresponder ao valor total da nota fiscal.");
      if (new Set(keys).size !== keys.length) throw new Error("Há boletos repetidos nesta nota fiscal. Corrija os números ou linhas digitáveis.");
      const [existing, pendingBoletoDocs, payableDocs, catalogDocs] = await Promise.all([
        getDocs(collection(db, "purchase_orders")),
        getDocs(collection(db, "pending_boletos")),
        getDocs(collection(db, "payables")),
        getDocs(collection(db, "supplier_catalog"))
      ]);
      const invoiceKey = String(result.accessKey || "").replace(/\\D/g, "");
      const duplicateInvoice = existing.docs.find(d => {
        const p = d.data();
        return (invoiceKey && String(p.accessKey || "").replace(/\\D/g, "") === invoiceKey) ||
          (!invoiceKey && documentNumber.trim() && String(p.supplierCnpj || "").replace(/\\D/g, "") === supplierCnpj.replace(/\\D/g, "") && String(p.documentNumber || "").trim() === documentNumber.trim());
      });
      if (duplicateInvoice) throw new Error("Esta nota fiscal já está cadastrada no Financeiro. Abra Compras Gerais para corrigir o registro existente.");
      const boletoKeys = normalizedBoletos.map(row => row.digitableLine.replace(/\\D/g, "") || row.number.replace(/\\D/g, "")).filter(Boolean);
      const existingBoletoKeys = new Set<string>();
      existing.docs.forEach(d => (d.data().installments || []).forEach((row: any) => {
        const key = String(row.digitableLine || "").replace(/\\D/g, "") || String(row.number || "").replace(/\\D/g, "");
        if (key) existingBoletoKeys.add(key);
      }));
      pendingBoletoDocs.docs.forEach(d => { const key = String(d.data().digitableLine || "").replace(/\\D/g, ""); if (key) existingBoletoKeys.add(key); });
      payableDocs.docs.forEach(d => { const row = d.data(); const key = String(row.digitableLine || "").replace(/\\D/g, "") || String(row.boletoNumber || "").replace(/\\D/g, ""); if (key) existingBoletoKeys.add(key); });
      if (boletoKeys.some(key => existingBoletoKeys.has(key))) throw new Error("Um ou mais boletos já estão cadastrados em Compras, Boletos a Revisar ou Contas a Pagar. Não será criado um lançamento duplicado.");
      const normalize = (value: string) => String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const supplierCatalog = catalogDocs.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(row => normalize(row.supplier) === normalize(supplierName));
      const extractedItems = Array.isArray(result.items) ? result.items.filter(item => String(item.description || "").trim() && Number(item.quantity) > 0).map(item => {
        const code = normalize(String(item.sku || ""));
        const name = normalize(String(item.description || ""));
        const match = supplierCatalog.find(row => code && normalize(row.code || "") === code) || supplierCatalog.find(row => name && normalize(row.name || "") === name);
        return { description: String(item.description).slice(0, 300), sku: String(item.sku || "").slice(0, 80), quantity: Math.max(0.01, Number(item.quantity) || 1), unit: String(match?.unit || item.unit || "un").slice(0, 20), unitPrice: Math.max(0, Number(item.unitPrice) || 0), total: Math.max(0, Number(item.total) || 0), supplierCatalogId: match?.id || "", supplierCatalogName: match?.name || "", supplierCatalogCategory: match?.category || "" };
      }) : [];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const storagePath = "purchases/" + user.uid + "/" + Date.now() + "-" + safeName;
      await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || "application/pdf", customMetadata: { uploadedBy: user.uid, source: "financial-ai" } });
      const documentUrl = await getDownloadURL(ref(storage, storagePath));
      const subtotal = Math.round((amount - taxes + Number.EPSILON) * 100) / 100;
      const extractedItems = Array.isArray(result.items) ? result.items.filter(item => String(item.description || "").trim() && Number(item.quantity) > 0).map(item => ({
        description: String(item.description).slice(0, 300), sku: String(item.sku || "").slice(0, 80), quantity: Math.max(0.01, Number(item.quantity) || 1),
        unit: String(item.unit || "un").slice(0, 20), unitPrice: Math.max(0, Number(item.unitPrice) || 0), total: Math.max(0, Number(item.total) || 0)
      })) : [];
      const items = extractedItems.length ? extractedItems : [{ description: description.trim() || "Total do documento", sku: "", quantity: 1, unit: "un", unitPrice: subtotal, total: subtotal }];
      const number = "CMP-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      await addDoc(collection(db, "purchase_orders"), {
        number, supplierId: "", supplierName: supplierName.trim(), supplierCnpj: supplierCnpj.replace(/\D/g, "").slice(0, 14),
        documentNumber: documentNumber.trim(), accessKey: String(result.accessKey || "").replace(/\D/g, "").slice(0, 44),
        description: description.trim() || "Documento financeiro", expenseCategory: "materiais", items, subtotal, tax: taxes,
        total: Math.round((amount + Number.EPSILON) * 100) / 100, issueDate, dueDate, status: "pending",
        documentType: result.documentType || "other", documentName: file.name, documentUrl, documentPath: storagePath, installments: normalizedBoletos,
        extractionConfidence: result.confidence || "", extractionWarnings: result.warnings || [], notes: notes.trim(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: user.email || "", source: "financial-ai"
      });
      setMessage("Documento enviado para Compras Gerais, aguardando aprovação. Os boletos vinculados serão lançados separadamente em Contas a Pagar.");
      setFile(null); setResult(null); setNotes(""); setBoletos([]); if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setError((e as Error).message || "Não foi possível enviar o documento ao Financeiro."); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6 text-slate-800 dark:text-slate-100">
    <header><h2 className="flex items-center gap-2 text-2xl font-black"><Sparkles className="h-6 w-6 text-indigo-600"/> IA Financeira</h2><p className="mt-1 text-sm text-slate-500">Leia notas fiscais, boletos, recibos e documentos de compra com IA. Revise os dados e envie ao Financeiro sem lançar pagamentos automaticamente.</p></header>
    <section className="space-y-4 rounded-2xl border bg-white p-5 dark:bg-slate-900">
      <div onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }} className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-indigo-500 hover:bg-indigo-50/30">
        <Upload className="mx-auto mb-2 h-10 w-10 text-slate-400"/><p className="font-bold">Enviar nota fiscal, boleto ou recibo (PDF ou imagem)</p><p className="mt-1 text-xs text-slate-500">{file ? file.name : "Nenhum arquivo selecionado"}</p>
        <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setMessage(""); setError(""); }} className="hidden"/>
      </div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void handleUpload()} disabled={!file || extracting || saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{extracting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}{extracting ? "Lendo documento..." : "Ler documento com IA"}</button>{file && <button onClick={() => { setFile(null); setResult(null); setMessage(""); setError(""); if (fileRef.current) fileRef.current.value = ""; }} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Limpar arquivo</button>}</div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    </section>
    {result && <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 dark:bg-slate-900">
      <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-600"/><h3 className="font-bold">Dados identificados — revise antes de salvar</h3></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">Fornecedor / emitente<input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">CNPJ / CPF<input value={supplierCnpj} onChange={e => setSupplierCnpj(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">Número do documento<input value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">Descrição<input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">Data de emissão<input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">Vencimento<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">Valor total (R$)<input type="number" min="0.01" step="0.01" value={total} onChange={e => setTotal(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
        <label className="text-xs font-semibold text-slate-500">Tributos destacados (R$)<input type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      </div>
      {Array.isArray(result.warnings) && result.warnings.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="mr-1 inline h-4 w-4"/> Confira os alertas da IA: {result.warnings.join(" · ")}</div>}
      <section className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="flex items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-slate-800">Boletos desta nota fiscal</h4><p className="text-xs text-slate-500">Cadastre as parcelas agora para evitar lançamentos duplicados.</p></div><button type="button" onClick={() => setBoletos(rows => [...rows, { id: String(Date.now()) + Math.random(), number: "", digitableLine: "", amount: 0, dueDate }])} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">+ Adicionar boleto</button></div>
        {boletos.map((b,i)=><div key={b.id} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Número do boleto<input value={b.number} onChange={e=>setBoletos(rows=>rows.map((r,j)=>j===i?{...r,number:e.target.value}:r))} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <label className="text-xs font-semibold">Valor (R$)<input type="number" min="0" step="0.01" value={b.amount} onChange={e=>setBoletos(rows=>rows.map((r,j)=>j===i?{...r,amount:Number(e.target.value)}:r))} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <label className="text-xs font-semibold sm:col-span-2">Linha digitável<input value={b.digitableLine} onChange={e=>setBoletos(rows=>rows.map((r,j)=>j===i?{...r,digitableLine:e.target.value}:r))} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <label className="text-xs font-semibold">Vencimento<input type="date" value={b.dueDate} onChange={e=>setBoletos(rows=>rows.map((r,j)=>j===i?{...r,dueDate:e.target.value}:r))} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <button type="button" onClick={()=>setBoletos(rows=>rows.filter((_,j)=>j!==i))} className="self-end text-xs font-bold text-rose-600">Remover</button>
        </div>)}
      </section>
      <label className="block text-xs font-semibold text-slate-500">Observações<input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-800"/></label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div><p className="text-xs text-slate-500">Total a registrar no Financeiro</p><p className="text-xl font-black">{money(Number(total))}</p><p className="text-xs text-slate-500">Status inicial: aguardando aprovação</p></div><button onClick={() => void saveToFinance()} disabled={saving || extracting} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{saving ? "Enviando..." : "Enviar para o Financeiro"}</button></div>
    </section>}
    <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900"><FileText className="mr-1 inline h-4 w-4"/> O documento original será anexado à compra. A aprovação em Compras Gerais gera uma única conta em Contas a Pagar; a IA nunca efetua o pagamento.</section>
  </div>;
}
