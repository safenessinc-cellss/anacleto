import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import { AlertCircle, CheckCircle2, FileText, Loader2, Plus, ScanSearch, ShoppingCart, Upload } from "lucide-react";

type Supplier = { id: string; name: string; nif?: string; email?: string; phone?: string };
type PurchaseItem = { description: string; sku: string; quantity: number; unit: string; unitPrice: number; total: number };
type ExtractedDocument = {
  documentType?: string; supplierName?: string; supplierCnpj?: string; documentNumber?: string;
  issueDate?: string; dueDate?: string; currency?: string; total?: number; tax?: number;
  description?: string; items?: PurchaseItem[]; confidence?: string; warnings?: string[];
};
type Purchase = {
  id: string; number: string; supplierId: string; supplierName: string; supplierCnpj: string;
  documentNumber: string; description: string; items: PurchaseItem[]; subtotal: number;
  tax: number; total: number; issueDate: string; dueDate: string; status: "draft" | "pending" | "approved" | "received" | "cancelled";
  documentType: string; documentName: string; documentUrl: string; documentPath: string;
  payableId?: string; createdAt: string; updatedAt: string; createdBy: string; notes: string;
};

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): PurchaseItem => ({ description: "", sku: "", quantity: 1, unit: "un", unitPrice: 0, total: 0 });

export default function PurchasesModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCnpj, setSupplierCnpj] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentPath, setDocumentPath] = useState("");
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const a = onSnapshot(collection(db, "suppliers"), snap => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))));
    const b = onSnapshot(collection(db, "purchase_orders"), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
      rows.sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
      setPurchases(rows);
    }, err => setError("Falha ao carregar compras: " + err.message));
    return () => { a(); b(); };
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0), 0), [items]);
  const total = subtotal + Math.max(0, tax);
  const pendingTotal = purchases.filter(p => p.status === "pending" || p.status === "draft").reduce((sum, p) => sum + p.total, 0);
  const approvedTotal = purchases.filter(p => p.status === "approved").reduce((sum, p) => sum + p.total, 0);

  const updateItem = (index: number, key: keyof PurchaseItem, value: string | number) => setItems(current => current.map((item, i) => {
    if (i !== index) return item;
    const next = { ...item, [key]: value };
    next.total = Math.max(0, Number(next.quantity) || 0) * Math.max(0, Number(next.unitPrice) || 0);
    return next;
  }));

  const readFileBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const encoded = String(reader.result || "").split(",")[1];
      if (!encoded) reject(new Error("Arquivo vazio ou inválido."));
      else resolve(encoded);
    };
    reader.readAsDataURL(file);
  });

  const recognizeDocument = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 10 MB.");
    const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("Formato inválido. Envie PDF, JPG, PNG ou WEBP.");
    setExtracting(true); setError(""); setMessage("Lendo documento com IA...");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Entre novamente para processar documentos.");
      const data = await readFileBase64(file);
      const response = await fetch("/api/ai/purchase-extract", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ data, mimeType, fileName: file.name })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível interpretar o documento.");
      setExtracted(result);
      setSupplierName(result.supplierName || "");
      setSupplierCnpj(result.supplierCnpj || "");
      setDocumentNumber(result.documentNumber || "");
      setDescription(result.description || result.documentType || "Documento de compra");
      setIssueDate(result.issueDate || today());
      setDueDate(result.dueDate || today());
      setTax(Number(result.tax) || 0);
      if (Array.isArray(result.items) && result.items.length) setItems(result.items.map((item: PurchaseItem) => ({
        description: item.description || "", sku: item.sku || "", quantity: Number(item.quantity) || 1,
        unit: item.unit || "un", unitPrice: Number(item.unitPrice) || 0,
        total: Number(item.total) || (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)
      })));
      else if (Number(result.total) > 0) setItems([{ description: result.description || "Itens do documento", sku: "", quantity: 1, unit: "un", unitPrice: Number(result.total), total: Number(result.total) }]);
      const match = suppliers.find(s => (result.supplierCnpj && (s.nif || "").replace(/\D/g, "") === String(result.supplierCnpj).replace(/\D/g, "")) || (result.supplierName && s.name.toLowerCase() === String(result.supplierName).toLowerCase()));
      if (match) setSelectedSupplier(match.id);
      setMessage("Documento interpretado. Confira todos os campos antes de salvar; a IA pode cometer erros.");
    } finally { setExtracting(false); }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setDocumentFile(file); setExtracted(null); setDocumentUrl(""); setDocumentPath("");
    try { await recognizeDocument(file); }
    catch (e) { setError((e as Error).message); setMessage(""); }
  };

  const savePurchase = async () => {
    setError(""); setMessage("");
    if (!supplierName.trim() && !selectedSupplier) return setError("Informe ou selecione o fornecedor.");
    if (!items.some(i => i.description.trim() && i.quantity > 0)) return setError("Adicione pelo menos um item válido.");
    if (total <= 0) return setError("O total da compra deve ser maior que zero.");
    setSaving(true);
    try {
      let supplierId = selectedSupplier;
      let resolvedSupplier = suppliers.find(s => s.id === supplierId);
      if (!resolvedSupplier && supplierName.trim()) {
        const created = await (await import("firebase/firestore")).addDoc(collection(db, "suppliers"), {
          name: supplierName.trim(), nif: supplierCnpj.trim(), email: "", phone: "", address: "", notes: "Cadastrado automaticamente a partir de documento de compra.", createdAt: new Date().toISOString()
        });
        supplierId = created.id;
        resolvedSupplier = { id: created.id, name: supplierName.trim(), nif: supplierCnpj };
      }
      let url = documentUrl, path = documentPath;
      if (documentFile && !path) {
        const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
        path = "purchases/" + Date.now() + "-" + safeName;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, documentFile, { contentType: documentFile.type || "application/pdf", customMetadata: { supplierId, uploadedBy: auth.currentUser?.uid || "" } });
        url = await getDownloadURL(storageRef);
      }
      const now = new Date().toISOString();
      const purchaseNumber = "CMP-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      const payload = {
        number: purchaseNumber, supplierId, supplierName: resolvedSupplier?.name || supplierName.trim(),
        supplierCnpj: resolvedSupplier?.nif || supplierCnpj, documentNumber, description: description.trim(),
        items: items.filter(i => i.description.trim()).map(i => ({ ...i, total: i.quantity * i.unitPrice })),
        subtotal, tax, total, issueDate, dueDate, status: "pending",
        documentType: extracted?.documentType || "manual", documentName: documentFile?.name || "",
        documentUrl: url, documentPath: path, extractionConfidence: extracted?.confidence || "",
        extractionWarnings: extracted?.warnings || [], notes: notes.trim(),
        createdAt: now, updatedAt: now, createdBy: auth.currentUser?.email || ""
      };
      await addDoc(collection(db, "purchase_orders"), payload);
      setSelectedSupplier(""); setSupplierName(""); setSupplierCnpj(""); setDocumentNumber(""); setDescription("");
      setIssueDate(today()); setDueDate(today()); setItems([emptyItem()]); setTax(0); setNotes("");
      setDocumentFile(null); setDocumentUrl(""); setDocumentPath(""); setExtracted(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Compra registrada para aprovação. Nenhuma despesa será lançada até a aprovação.");
    } catch (e) { setError((e as Error).message || "Falha ao salvar compra."); }
    finally { setSaving(false); }
  };

  const approvePurchase = async (purchase: Purchase) => {
    if (purchase.status !== "pending") return;
    if (!confirm("Aprovar esta compra e gerar automaticamente uma conta a pagar no Financeiro?")) return;
    setError("");
    try {
      const purchaseRef = doc(db, "purchase_orders", purchase.id);
      const payableRef = doc(collection(db, "payables"));
      await runTransaction(db, async tx => {
        const current = await tx.get(purchaseRef);
        if (!current.exists() || current.data().status !== "pending" || current.data().payableId) throw new Error("Esta compra já foi processada ou não está pendente.");
        tx.set(payableRef, {
          supplierId: purchase.supplierId, supplierName: purchase.supplierName, supplierCnpj: purchase.supplierCnpj || "",
          description: purchase.description || "Compra " + purchase.number,
          amount: purchase.total, dueDate: purchase.dueDate || today(), paymentMethod: "boleto",
          status: "pending", purchaseId: purchase.id, purchaseNumber: purchase.number,
          documentUrl: purchase.documentUrl || "", documentName: purchase.documentName || "",
          notes: "Gerado automaticamente pela aprovação da compra " + purchase.number,
          createdAt: new Date().toISOString(), createdBy: auth.currentUser?.uid || ""
        });
        tx.update(purchaseRef, { status: "approved", payableId: payableRef.id, approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      setMessage("Compra aprovada e vinculada às Contas a Pagar do Financeiro.");
    } catch (e) { setError("Não foi possível aprovar: " + (e as Error).message); }
  };

  const markReceived = async (purchase: Purchase) => {
    if (purchase.status !== "approved") return;
    try {
      const purchaseRef = doc(db, "purchase_orders", purchase.id);
      const aggregates = new Map<string, PurchaseItem>();
      (purchase.items || []).forEach(item => {
        if (!item.description?.trim() || Number(item.quantity) <= 0) return;
        const identity = (item.sku?.trim() || item.description).normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
        if (!identity) return;
        const existing = aggregates.get(identity);
        aggregates.set(identity, existing ? { ...existing, quantity: existing.quantity + Number(item.quantity), total: existing.total + Number(item.total || 0) } : { ...item, sku: identity, quantity: Number(item.quantity) });
      });
      const entries = [...aggregates.entries()];
      const stockRefs = entries.map(([key]) => doc(db, "inventory_items", key));
      const movementRefs = entries.map(() => doc(collection(db, "inventory_movements")));
      await runTransaction(db, async tx => {
        const current = await tx.get(purchaseRef);
        if (!current.exists() || current.data().status !== "approved" || current.data().inventoryPostedAt) throw new Error("O recebimento já foi registrado ou a compra não está aprovada.");
        const stockSnapshots = [];
        for (const ref of stockRefs) stockSnapshots.push(await tx.get(ref));
        for (let i = 0; i < stockRefs.length; i++) {
          const [key, item] = entries[i];
          const snap = stockSnapshots[i];
          const currentQty = snap.exists() ? Number(snap.data().quantity || 0) : 0;
          tx.set(stockRefs[i], {
            name: item.description, sku: item.sku || key, unit: item.unit || "un",
            quantity: currentQty + Number(item.quantity || 0),
            reservedQuantity: Number(snap.exists() ? snap.data().reservedQuantity || 0 : 0),
            minimumStock: Number(snap.exists() ? snap.data().minimumStock || 0 : 0),
            updatedAt: serverTimestamp(), lastPurchaseId: purchase.id
          }, { merge: true });
          tx.set(movementRefs[i], {
            itemId: stockRefs[i].id, itemName: item.description, type: "in", quantity: Number(item.quantity || 0),
            reason: "Recebimento da compra " + purchase.number, reference: purchase.id,
            supplierId: purchase.supplierId, supplierName: purchase.supplierName,
            createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || ""
          });
        }
        tx.update(purchaseRef, { status: "received", receivedAt: serverTimestamp(), inventoryPostedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      setMessage("Recebimento registrado: materiais lançados no Estoque e compra vinculada ao Financeiro.");
    } catch (e) { setError((e as Error).message || "Não foi possível registrar o recebimento."); }
  };

  const visible = purchases.filter(p => filter === "all" || p.status === filter);
  const statusText: Record<string, string> = { draft: "Rascunho", pending: "Aguardando aprovação", approved: "Aprovada · a pagar", received: "Recebida", cancelled: "Cancelada" };
  const statusClass: Record<string, string> = { pending: "bg-amber-50 text-amber-700", approved: "bg-blue-50 text-blue-700", received: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-500", draft: "bg-slate-100 text-slate-600" };

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Compras registradas</p><p className="mt-1 text-2xl font-black">{purchases.length}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Em aprovação</p><p className="mt-1 text-2xl font-black">{money(pendingTotal)}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Aprovadas</p><p className="mt-1 text-2xl font-black">{money(approvedTotal)}</p></div>
    </div>

    <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900 space-y-4">
      <div><h3 className="flex items-center gap-2 text-lg font-black"><ShoppingCart className="h-5 w-5 text-blue-600"/> Nova compra</h3><p className="text-xs text-slate-500">Anexe uma nota fiscal, orçamento, pedido ou boleto. A IA identifica o documento e preenche os campos para revisão.</p></div>
      <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4 dark:bg-blue-950/20">
        <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => void handleFile(e.target.files?.[0] || null)}/>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-sm">Documento da compra</p><p className="text-xs text-slate-500">{documentFile?.name || "PDF, JPG, PNG ou WEBP · até 10 MB"}</p></div><button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4"/> Anexar arquivo</button></div>
        {extracting && <p className="mt-3 flex items-center gap-2 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin"/> A IA está lendo o documento...</p>}
        {extracted && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/> Tipo identificado: {extracted.documentType || "documento"} · Confiança: {extracted.confidence || "não informada"}. Confira os dados antes de salvar.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Fornecedor cadastrado<select value={selectedSupplier} onChange={e => {setSelectedSupplier(e.target.value); const s=suppliers.find(x=>x.id===e.target.value); if(s){setSupplierName(s.name);setSupplierCnpj(s.nif||"");}}} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm dark:bg-slate-950"><option value="">Selecionar ou cadastrar pelo documento</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name} · {s.nif||"sem CNPJ"}</option>)}</select></label>
        <label className="text-xs font-bold">Razão social<input value={supplierName} onChange={e=>setSupplierName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
        <label className="text-xs font-bold">CNPJ / CPF<input value={supplierCnpj} onChange={e=>setSupplierCnpj(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
        <label className="text-xs font-bold">Número do documento<input value={documentNumber} onChange={e=>setDocumentNumber(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
        <label className="text-xs font-bold sm:col-span-2">Descrição<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
        <label className="text-xs font-bold">Data de emissão<input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
        <label className="text-xs font-bold">Vencimento<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
      </div>

      <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="font-bold text-sm">Itens da compra</h4><button type="button" onClick={()=>setItems(v=>[...v,emptyItem()])} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><Plus className="h-3.5 w-3.5"/> Adicionar item</button></div>
        {items.map((item,index)=><div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
          <input placeholder="Descrição do material / serviço" value={item.description} onChange={e=>updateItem(index,"description",e.target.value)} className="rounded border p-2 text-sm sm:col-span-5"/>
          <input placeholder="SKU" value={item.sku} onChange={e=>updateItem(index,"sku",e.target.value)} className="rounded border p-2 text-sm sm:col-span-2"/>
          <input type="number" min="0" step="0.01" placeholder="Qtd." value={item.quantity} onChange={e=>updateItem(index,"quantity",Number(e.target.value))} className="rounded border p-2 text-sm sm:col-span-1"/>
          <input placeholder="Un." value={item.unit} onChange={e=>updateItem(index,"unit",e.target.value)} className="rounded border p-2 text-sm sm:col-span-1"/>
          <input type="number" min="0" step="0.01" placeholder="Preço unit." value={item.unitPrice} onChange={e=>updateItem(index,"unitPrice",Number(e.target.value))} className="rounded border p-2 text-sm sm:col-span-2"/>
          <button type="button" disabled={items.length===1} onClick={()=>setItems(v=>v.filter((_,i)=>i!==index))} className="text-xs font-bold text-rose-600 disabled:opacity-30 sm:col-span-1">Remover</button>
          <p className="text-right text-xs font-bold text-slate-500 sm:col-span-12">Subtotal: {money(item.quantity*item.unitPrice)}</p>
        </div>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Impostos / taxas (R$)<input type="number" min="0" step="0.01" value={tax} onChange={e=>setTax(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label><div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p className="text-xs text-slate-500">Subtotal</p><strong>{money(subtotal)}</strong></div><div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/30"><p className="text-xs text-blue-700">Total da compra</p><strong className="text-lg">{money(total)}</strong></div></div>
      <label className="block text-xs font-bold">Observações<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button type="button" disabled={saving||extracting} onClick={()=>void savePurchase()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>} Registrar compra para aprovação</button>
    </section>

    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-lg">Histórico de compras</h3><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-900"><option value="all">Todas</option><option value="pending">Aguardando aprovação</option><option value="approved">Aprovadas</option><option value="received">Recebidas</option><option value="cancelled">Canceladas</option></select></div>
      {visible.length===0?<div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nenhuma compra registrada.</div>:visible.map(p=><article key={p.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-600">{p.number} · {p.documentNumber||"Sem nº fiscal"}</p><h4 className="font-bold">{p.supplierName}</h4><p className="text-xs text-slate-500">{p.description} · {p.items?.length||0} item(ns) · Vencimento {p.dueDate}</p><p className="mt-1 text-lg font-black">{money(p.total)}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold "+(statusClass[p.status]||statusClass.pending)}>{statusText[p.status]||p.status}</span></div>
        {p.documentUrl&&<a href={p.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600"><FileText className="h-3.5 w-3.5"/> Abrir documento original · {p.documentName}</a>}
        {p.payableId&&<p className="mt-2 text-xs font-semibold text-emerald-700">Vinculada ao Financeiro · Conta a pagar criada</p>}
        <div className="mt-3 flex flex-wrap gap-2">{p.status==="pending"&&<button onClick={()=>void approvePurchase(p)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Aprovar e lançar no Financeiro</button>}{p.status==="approved"&&<button onClick={()=>void markReceived(p)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700">Confirmar recebimento</button>}</div>
      </article>)}
    </section>
  </div>;
}
