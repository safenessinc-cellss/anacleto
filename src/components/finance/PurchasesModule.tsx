import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import { AlertCircle, Camera, CheckCircle2, FileText, Loader2, Plus, ScanSearch, ShoppingCart, Upload, Pencil, X } from "lucide-react";

type Supplier = { id: string; name: string; nif?: string; email?: string; phone?: string };
type PurchaseItem = { description: string; sku: string; quantity: number; unit: string; unitPrice: number; total: number };
type PurchaseInstallment = { id: string; number: string; digitableLine: string; amount: number; dueDate: string; documentName?: string; documentUrl?: string; documentPath?: string };
type ExtractedDocument = {
  documentType?: string; supplierName?: string; supplierCnpj?: string; documentNumber?: string; accessKey?: string;
  issueDate?: string; dueDate?: string; currency?: string; total?: number; tax?: number;
  description?: string; items?: PurchaseItem[]; confidence?: string; warnings?: string[];
};
type Purchase = {
  id: string; number: string; supplierId: string; supplierName: string; supplierCnpj: string; expenseCategory?: string;
  documentNumber: string; description: string; items: PurchaseItem[]; subtotal: number;
  tax: number; total: number; issueDate: string; dueDate: string; status: "draft" | "pending" | "approved" | "received" | "cancelled";
  documentType: string; documentName: string; documentUrl: string; documentPath: string;
  payableId?: string; payableIds?: string[]; installments?: PurchaseInstallment[]; accessKey?: string; extractionConfidence?: string; extractionWarnings?: string[]; createdAt: string; updatedAt: string; createdBy: string; notes: string;
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
  const [expenseCategory, setExpenseCategory] = useState("materiais");
  const [documentNumber, setDocumentNumber] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState<PurchaseInstallment[]>([]);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
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
  const cameraRef = useRef<HTMLInputElement>(null);

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
  const updateInstallment = (index: number, key: keyof PurchaseInstallment, value: string | number) => setInstallments(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const normalizeKey = (value: string) => String(value || "").replace(/\D/g, "");
  const startEdit = (purchase: Purchase) => {
    if (!["pending", "draft"].includes(purchase.status)) return;
    setEditingPurchase(purchase); setSelectedSupplier(purchase.supplierId || ""); setSupplierName(purchase.supplierName || "");
    setSupplierCnpj(purchase.supplierCnpj || ""); setExpenseCategory(purchase.expenseCategory || "materiais");
    setDocumentNumber(purchase.documentNumber || ""); setDescription(purchase.description || "");
    setIssueDate(purchase.issueDate || today()); setDueDate(purchase.dueDate || today());
    setItems(purchase.items?.length ? purchase.items.map(item => ({ ...item })) : [emptyItem()]);
    setTax(Number(purchase.tax || 0)); setNotes(purchase.notes || "");
    setInstallments((purchase.installments || []).map((row, i) => ({ id: row.id || String(i), number: row.number || "", digitableLine: row.digitableLine || "", amount: Number(row.amount || 0), dueDate: row.dueDate || purchase.dueDate || today(), documentName: row.documentName || "", documentUrl: row.documentUrl || "", documentPath: row.documentPath || "" })));
    setDocumentFile(null); setDocumentUrl(purchase.documentUrl || ""); setDocumentPath(purchase.documentPath || "");
    setExtracted({ documentType: purchase.documentType, accessKey: purchase.accessKey || "" });
    setMessage("Editando compra existente. O número e o status serão preservados."); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const resetForm = () => {
    setEditingPurchase(null); setSelectedSupplier(""); setSupplierName(""); setSupplierCnpj(""); setDocumentNumber("");
    setDescription(""); setExpenseCategory("materiais"); setIssueDate(today()); setDueDate(today()); setItems([emptyItem()]);
    setTax(0); setNotes(""); setInstallments([]); setDocumentFile(null); setDocumentUrl(""); setDocumentPath(""); setExtracted(null);
    if (fileRef.current) fileRef.current.value = "";
  };

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
      // Ignore empty/invalid rows returned by OCR. Gemini may return an array containing
      // placeholder items even when it could not read the invoice line items.
      const validItems = Array.isArray(result.items) ? result.items
        .filter((item: any) => String(item?.description || "").trim() && Number(item?.quantity ?? 1) > 0)
        .map((item: any) => {
          const quantity = Math.max(0.01, Number(item.quantity) || 1);
          const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
          const lineTotal = Math.max(0, Number(item.total) || quantity * unitPrice);
          return {
            description: String(item.description || "").trim(), sku: String(item.sku || ""),
            quantity, unit: String(item.unit || "un"), unitPrice: unitPrice || lineTotal / quantity,
            total: lineTotal
          } as PurchaseItem;
        }) : [];
      if (validItems.length) {
        setItems(validItems);
      } else if (Number(result.total) > 0) {
        // When OCR reads the invoice total but not its individual rows, create a
        // single editable summary line so the document can still be registered.
        const documentTotal = Math.max(0, Number(result.total) || 0);
        setItems([{ description: String(result.description || result.documentType || "Total do documento"), sku: "", quantity: 1, unit: "un", unitPrice: documentTotal, total: documentTotal }]);
        setTax(0);
      } else {
        setItems([emptyItem()]);
      }
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
      const normalizedInstallments = installments.filter(row => Number(row.amount) > 0 && row.dueDate).map(row => ({ ...row, number: row.number.trim(), digitableLine: row.digitableLine.trim(), amount: Math.round(Number(row.amount) * 100) / 100 }));
      if (normalizedInstallments.length && Math.abs(normalizedInstallments.reduce((sum, row) => sum + row.amount, 0) - total) > 0.02) throw new Error("A soma dos boletos precisa corresponder ao total da nota fiscal.");
      const invoiceKey = String(extracted?.accessKey || editingPurchase?.accessKey || "").replace(/\D/g, "");
      const duplicateInvoice = purchases.find(p => p.id !== editingPurchase?.id && (
        (invoiceKey && String(p.accessKey || "").replace(/\D/g, "") === invoiceKey) ||
        (!invoiceKey && documentNumber.trim() && normalizeKey(p.supplierCnpj || "") === normalizeKey(resolvedSupplier?.nif || supplierCnpj) && p.documentNumber?.trim() === documentNumber.trim())
      ));
      if (duplicateInvoice) throw new Error("Esta nota fiscal já está registrada na compra " + duplicateInvoice.number + ". Verifique antes de continuar.");
      const knownBoletoKeys = new Set<string>();
      for (const row of normalizedInstallments) {
        const key = normalizeKey(row.digitableLine) || normalizeKey(row.number);
        if (!key) continue;
        if (knownBoletoKeys.has(key)) throw new Error("Há boletos repetidos nesta nota. Corrija o número ou a linha digitável.");
        knownBoletoKeys.add(key);
        const duplicate = purchases.find(p => p.id !== editingPurchase?.id && (p.installments || []).some(old => key === (normalizeKey(old.digitableLine) || normalizeKey(old.number))));
        if (duplicate) throw new Error("Este boleto já está vinculado à compra " + duplicate.number + ". Não será criado novamente.");
      }
      const payload: any = {
        supplierId, supplierName: resolvedSupplier?.name || supplierName.trim() || "Despesa sem fornecedor",
        supplierCnpj: resolvedSupplier?.nif || supplierCnpj, documentNumber, accessKey: invoiceKey, description: description.trim(), expenseCategory,
        items: items.filter(i => i.description.trim()).map(i => ({ ...i, total: i.quantity * i.unitPrice })),
        subtotal, tax, total, issueDate, dueDate, installments: normalizedInstallments,
        documentType: extracted?.documentType || editingPurchase?.documentType || "manual", documentName: documentFile?.name || editingPurchase?.documentName || "",
        documentUrl: url, documentPath: path, extractionConfidence: extracted?.confidence || editingPurchase?.extractionConfidence || "",
        extractionWarnings: extracted?.warnings || editingPurchase?.extractionWarnings || [], notes: notes.trim(),
        updatedAt: now
      };
      if (editingPurchase) {
        await updateDoc(doc(db, "purchase_orders", editingPurchase.id), payload);
        setMessage("Compra " + editingPurchase.number + " atualizada. Nenhuma nova compra ou conta a pagar foi criada.");
      } else {
        const purchaseNumber = "CMP-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
        await addDoc(collection(db, "purchase_orders"), { ...payload, number: purchaseNumber, status: "pending", createdAt: now, createdBy: auth.currentUser?.email || "" });
        setMessage("Compra registrada para aprovação. Nenhuma despesa será lançada até a aprovação.");
      }
      resetForm();
    } catch (e) { setError((e as Error).message || "Falha ao salvar compra."); }
    finally { setSaving(false); }
  };

  const approvePurchase = async (purchase: Purchase) => {
    if (purchase.status !== "pending") return;
    if (!confirm("Aprovar esta compra e gerar automaticamente uma conta a pagar no Financeiro?")) return;
    setError("");
    try {
      const purchaseRef = doc(db, "purchase_orders", purchase.id);
      const rows = purchase.installments?.length ? purchase.installments : [{ id: "single", number: "", digitableLine: "", amount: purchase.total, dueDate: purchase.dueDate || today(), documentUrl: purchase.documentUrl || "", documentName: purchase.documentName || "" }];
      const payableRefs = rows.map(() => doc(collection(db, "payables")));
      await runTransaction(db, async tx => {
        const current = await tx.get(purchaseRef);
        if (!current.exists() || current.data().status !== "pending" || current.data().payableId || (current.data().payableIds || []).length) throw new Error("Esta compra já foi processada ou não está pendente.");
        rows.forEach((row, index) => {
          tx.set(payableRefs[index], {
            supplierId: purchase.supplierId, supplierName: purchase.supplierName, supplierCnpj: purchase.supplierCnpj || "",
            description: (purchase.description || "Compra " + purchase.number) + (rows.length > 1 ? " · Boleto " + (row.number || (index + 1) + "/" + rows.length) : ""),
            amount: Number(row.amount || 0), dueDate: row.dueDate || purchase.dueDate || today(), paymentMethod: "boleto",
            status: "pending", purchaseId: purchase.id, purchaseNumber: purchase.number,
            boletoNumber: row.number || "", digitableLine: row.digitableLine || "",
            documentUrl: row.documentUrl || purchase.documentUrl || "", documentName: row.documentName || purchase.documentName || "",
            notes: "Gerado automaticamente pela aprovação da compra " + purchase.number,
            createdAt: new Date().toISOString(), createdBy: auth.currentUser?.uid || ""
          });
        });
        tx.update(purchaseRef, { status: "approved", payableId: payableRefs[0].id, payableIds: payableRefs.map(r => r.id), approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      setMessage("Compra aprovada e vinculada às Contas a Pagar do Financeiro.");
    } catch (e) { setError("Não foi possível aprovar: " + (e as Error).message); }
  };

  const markReceived = async (purchase: Purchase) => {
    if (purchase.status !== "approved") return;
    if (purchase.expenseCategory !== "materiais") { setError("Somente compras classificadas como materiais podem ser incluídas no estoque. Altere a categoria ou registre como compra de materiais."); return; }
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
        tx.update(purchaseRef, { status: "received", stockIncluded: true, stockIncludedAt: serverTimestamp(), receivedAt: serverTimestamp(), inventoryPostedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      setMessage("Recebimento registrado: materiais lançados no Estoque e compra vinculada ao Financeiro.");
    } catch (e) { setError((e as Error).message || "Não foi possível registrar o recebimento."); }
  };

  const visible = purchases.filter(p => filter === "all" || p.status === filter);
  const statusText: Record<string, string> = { draft: "Rascunho", pending: "Aguardando aprovação", approved: "Aprovada · a pagar", received: "Recebida", cancelled: "Cancelada" };
  const statusClass: Record<string, string> = { pending: "bg-amber-50 text-amber-700", approved: "bg-blue-50 text-blue-700", received: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-500", draft: "bg-slate-100 text-slate-600" };

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Compras e despesas registradas</p><p className="mt-1 text-2xl font-black">{purchases.length}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Em aprovação</p><p className="mt-1 text-2xl font-black">{money(pendingTotal)}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-slate-500">Aprovadas</p><p className="mt-1 text-2xl font-black">{money(approvedTotal)}</p></div>
    </div>

    <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900 space-y-4">
      <div><h3 className="flex items-center gap-2 text-lg font-black"><ShoppingCart className="h-5 w-5 text-blue-600"/> Nova compra / despesa geral</h3><p className="text-xs text-slate-500">Registre compras de materiais, serviços contratados e despesas gerais da empresa. Anexe comprovantes ou notas para conferência.</p></div>
      <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4 dark:bg-blue-950/20">
        <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => void handleFile(e.target.files?.[0] || null)}/>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void handleFile(e.target.files?.[0] || null)}/>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-sm">Documento da compra</p><p className="text-xs text-slate-500">{documentFile?.name || "PDF, JPG, PNG ou WEBP · até 10 MB"}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><Camera className="h-4 w-4"/> Escanear nota pelo celular</button><button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4"/> Anexar PDF ou imagem</button></div></div>
        {extracting && <p className="mt-3 flex items-center gap-2 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin"/> A IA está lendo o documento...</p>}
        {extracted && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/> Tipo identificado: {extracted.documentType || "documento"} · Confiança: {extracted.confidence || "não informada"}. Confira os dados antes de salvar.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Categoria da despesa<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm dark:bg-slate-950"><option value="materiais">Compra de materiais</option><option value="servicos">Serviços contratados</option><option value="administrativas">Despesas administrativas</option><option value="manutencao">Manutenção</option><option value="frete">Frete e transporte</option><option value="impostos">Impostos e taxas</option><option value="outros">Outras despesas</option></select></label>
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
      <section className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-bold text-sm">Boletos vinculados a esta nota fiscal</h4><p className="text-xs text-slate-500">Cadastre cada parcela uma única vez. Na aprovação, cada boleto gera sua própria conta a pagar.</p></div><button type="button" onClick={() => setInstallments(rows => [...rows, { id: String(Date.now()) + Math.random(), number: "", digitableLine: "", amount: 0, dueDate }])} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold dark:bg-slate-900"><Plus className="h-3.5 w-3.5"/> Adicionar boleto</button></div>
        {installments.length === 0 && <p className="text-xs text-slate-500">Nenhum boleto cadastrado. Se não houver parcelas, a aprovação criará uma conta a pagar pelo total da nota.</p>}
        {installments.map((row,index)=><div key={row.id} className="grid gap-2 rounded-lg border bg-white p-3 dark:bg-slate-900 sm:grid-cols-2">
          <label className="text-xs font-semibold">Número do boleto<input value={row.number} onChange={e=>updateInstallment(index,"number",e.target.value)} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <label className="text-xs font-semibold">Valor (R$)<input type="number" min="0" step="0.01" value={row.amount} onChange={e=>updateInstallment(index,"amount",Number(e.target.value))} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <label className="text-xs font-semibold sm:col-span-2">Linha digitável<input value={row.digitableLine} onChange={e=>updateInstallment(index,"digitableLine",e.target.value)} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <label className="text-xs font-semibold">Vencimento<input type="date" value={row.dueDate} onChange={e=>updateInstallment(index,"dueDate",e.target.value)} className="mt-1 w-full rounded border p-2 text-sm"/></label>
          <button type="button" onClick={()=>setInstallments(rows=>rows.filter((_,i)=>i!==index))} className="self-end rounded-lg px-3 py-2 text-xs font-bold text-rose-600">Remover boleto</button>
        </div>)}
        {installments.length > 0 && <p className="text-xs font-bold text-indigo-700">Total dos boletos: {money(installments.reduce((sum,row)=>sum+Math.max(0,Number(row.amount)||0),0))} · Total da nota: {money(total)}</p>}
      </section>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Impostos / taxas (R$)<input type="number" min="0" step="0.01" value={tax} onChange={e=>setTax(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label><div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p className="text-xs text-slate-500">Subtotal</p><strong>{money(subtotal)}</strong></div><div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/30"><p className="text-xs text-blue-700">Total da compra</p><strong className="text-lg">{money(total)}</strong></div></div>
      <label className="block text-xs font-bold">Observações<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950"/></label>
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={saving||extracting} onClick={()=>void savePurchase()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>} {editingPurchase ? "Salvar correções da compra" : "Registrar compra para aprovação"}</button>{editingPurchase && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><X className="h-4 w-4"/> Cancelar edição</button>}</div>
    </section>

    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-lg">Histórico de compras e despesas</h3><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-900"><option value="all">Todas</option><option value="pending">Aguardando aprovação</option><option value="approved">Aprovadas</option><option value="received">Recebidas</option><option value="cancelled">Canceladas</option></select></div>
      {visible.length===0?<div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nenhuma compra registrada.</div>:visible.map(p=><article key={p.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-600">{p.number} · {p.documentNumber||"Sem nº fiscal"}</p><h4 className="font-bold">{p.supplierName || "Despesa sem fornecedor"}</h4><p className="text-xs text-blue-600">{({materiais:"Compra de materiais",servicos:"Serviços contratados",administrativas:"Despesas administrativas",manutencao:"Manutenção",frete:"Frete e transporte",impostos:"Impostos e taxas",outros:"Outras despesas"} as Record<string,string>)[p.expenseCategory || ""] || "Compra geral"}</p><p className="text-xs text-slate-500">{p.description} · {p.items?.length||0} item(ns) · Vencimento {p.dueDate}</p><p className="mt-1 text-lg font-black">{money(p.total)}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold "+(statusClass[p.status]||statusClass.pending)}>{statusText[p.status]||p.status}</span></div>
        {p.documentUrl&&<a href={p.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600"><FileText className="h-3.5 w-3.5"/> Abrir documento original · {p.documentName}</a>}
        {p.payableId&&<p className="mt-2 text-xs font-semibold text-emerald-700">Vinculada ao Financeiro · Conta a pagar criada</p>}
        {p.installments?.length ? <p className="mt-2 text-xs text-indigo-700">{p.installments.length} boleto(s) vinculado(s) · {money(p.installments.reduce((sum,row)=>sum+Number(row.amount||0),0))}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">{["pending","draft"].includes(p.status)&&<button onClick={()=>startEdit(p)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"><Pencil className="h-3.5 w-3.5"/> Editar compra</button>}{p.status==="pending"&&<button onClick={()=>void approvePurchase(p)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Aprovar e lançar no Financeiro</button>}{p.status==="approved"&&p.expenseCategory==="materiais"&&<button onClick={()=>void markReceived(p)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700">Incluir no estoque</button>}{p.status==="received"&&<span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Estoque atualizado</span>}</div>
      </article>)}
    </section>
  </div>;
}
