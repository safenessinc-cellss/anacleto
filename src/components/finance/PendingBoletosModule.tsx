import React, { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, addDoc, getDocs } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import { CheckCircle, XCircle, FileText, Loader2, AlertTriangle, Search, Camera, Upload, Save, ExternalLink } from "lucide-react";
import { lookupCNPJ, cnpjToSupplier, cleanCNPJ } from "../../utils/cnpjLookup";

interface PendingBoleto {
  id: string;
  fileName?: string;
  fileUrl?: string;
  filePath?: string;
  beneficiary?: string;
  cnpj?: string;
  payerCnpj?: string;
  amount?: number;
  dueDate?: string;
  digitableLine?: string;
  description?: string;
  status?: "pending" | "approved" | "rejected";
  createdAt?: string;
  extractedBy?: string;
  source?: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function PendingBoletosModule() {
  const [pending, setPending] = useState<PendingBoleto[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyName, setCompanyName] = useState("Anacleto");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PendingBoleto[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<PendingBoleto>>({});
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pending_boletos"), (snap) => {
      const list: PendingBoleto[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PendingBoleto));
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setPending(list);
    }, (err) => console.warn("Pending boletos listener:", err));
    return () => unsub();
  }, []);

  const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const value = String(reader.result || "").split(",")[1];
      value ? resolve(value) : reject(new Error("Arquivo vazio ou inválido."));
    };
    reader.readAsDataURL(file);
  });

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file); setDraft({ fileName: file.name, description: "Boleto bancário", amount: 0, dueDate: today() });
    setUploadError(""); setUploadMessage("Analisando boleto com IA...");
    const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (file.size > 10 * 1024 * 1024) { setUploadError("O arquivo deve ter no máximo 10 MB."); setUploadMessage(""); return; }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      setUploadError("Formato não suportado. Use PDF, JPG, PNG ou WEBP."); setUploadMessage(""); return;
    }
    setExtracting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Entre novamente para importar boletos.");
      const data = await readBase64(file);
      const response = await fetch("/api/ai/purchase-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ data, mimeType, fileName: file.name })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível interpretar o boleto.");
      setDraft({
        fileName: file.name,
        beneficiary: result.supplierName || "",
        cnpj: result.supplierCnpj || "",
        amount: Number(result.total) || 0,
        dueDate: result.dueDate || today(),
        description: result.description || "Boleto bancário",
        digitableLine: result.digitableLine || result.barcode || "",
        payerCnpj: companyCnpj.replace(/\D/g, ""),
        extractedBy: "Gemini",
        source: "upload"
      });
      setUploadMessage("Leitura concluída. Confira os dados e salve para deixar o boleto aguardando aprovação.");
    } catch (error) {
      setUploadError((error as Error).message || "Falha ao ler boleto.");
      setUploadMessage("Você ainda pode preencher os dados manualmente e salvar.");
    } finally { setExtracting(false); }
  };

  const saveUploadedBoleto = async () => {
    if (!selectedFile) return setUploadError("Selecione ou fotografe um boleto primeiro.");
    if (!String(draft.beneficiary || "").trim()) return setUploadError("Informe o beneficiário do boleto.");
    if (!(Number(draft.amount) > 0)) return setUploadError("Informe um valor válido.");
    setSaving(true); setUploadError("");
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Sessão expirada. Entre novamente.");
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const storagePath = "pending_boletos/" + uid + "/" + Date.now() + "-" + safeName;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, selectedFile, { contentType: selectedFile.type || "application/pdf", customMetadata: { uploadedBy: uid } });
      const fileUrl = await getDownloadURL(storageRef);
      await addDoc(collection(db, "pending_boletos"), {
        ...draft,
        fileName: selectedFile.name,
        fileUrl,
        filePath: storagePath,
        amount: Number(draft.amount) || 0,
        dueDate: String(draft.dueDate || today()),
        cnpj: String(draft.cnpj || "").replace(/\D/g, ""),
        payerCnpj: String(draft.payerCnpj || companyCnpj).replace(/\D/g, ""),
        status: "pending",
        adminApprovalRequired: true,
        createdAt: new Date().toISOString(),
        createdBy: uid
      });
      setSelectedFile(null); setDraft({}); setUploadMessage("Boleto salvo em Boletos a Revisar. Nenhum pagamento foi efetuado.");
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    } catch (error) { setUploadError((error as Error).message || "Não foi possível salvar o boleto."); }
    finally { setSaving(false); }
  };

  const searchCompanyBoletos = async () => {
    const cnpj = cleanCNPJ(companyCnpj);
    if (cnpj.length !== 14) { setSearchMessage("Informe o CNPJ da Anacleto para filtrar os boletos."); return; }
    setSearching(true); setSearchMessage("");
    try {
      const [pendingSnap, payableSnap] = await Promise.all([
        getDocs(collection(db, "pending_boletos")),
        getDocs(collection(db, "payables"))
      ]);
      const q = searchTerm.trim().toLocaleLowerCase("pt-BR");
      const docs: PendingBoleto[] = [];
      pendingSnap.forEach((d) => {
        const v = d.data() as any;
        const text = [v.beneficiary, v.cnpj, v.description, v.fileName, v.digitableLine].join(" ").toLocaleLowerCase("pt-BR");
        if (cleanCNPJ(v.payerCnpj || "") === cnpj || (q && text.includes(q))) docs.push({ id: d.id, ...v });
      });
      payableSnap.forEach((d) => {
        const v = d.data() as any;
        const text = [v.supplierName, v.supplierCnpj, v.description, v.digitableLine].join(" ").toLocaleLowerCase("pt-BR");
        if (cleanCNPJ(v.payerCnpj || v.companyCnpj || "") === cnpj || (q && text.includes(q))) {
          docs.push({ id: d.id, ...v, status: v.status === "paid" ? "approved" : "pending", beneficiary: v.supplierName || v.beneficiary });
        }
      });
      setMatches(docs);
      setSearchMessage(docs.length
        ? `${docs.length} boleto(s) encontrado(s) nos registros salvos da Anacleto.`
        : "Nenhum boleto salvo encontrado para este CNPJ. Para consultar boletos recebidos no sistema bancário, é necessária uma conexão DDA/Open Finance autorizada.");
    } catch (error) { setSearchMessage("Falha na consulta: " + (error as Error).message); }
    finally { setSearching(false); }
  };

  const approve = async (boleto: PendingBoleto) => {
    setProcessing(boleto.id);
    try {
      let supplierId = "";
      let supplierName = boleto.beneficiary || "Fornecedor desconhecido";
      if (boleto.cnpj) {
        const clean = cleanCNPJ(boleto.cnpj);
        if (clean.length === 14) {
          try {
            const cnpjData = await lookupCNPJ(clean);
            const supplierData = cnpjToSupplier(cnpjData);
            const newSupplier = await addDoc(collection(db, "suppliers"), { ...supplierData, createdAt: new Date().toISOString() });
            supplierId = newSupplier.id; supplierName = supplierData.name;
          } catch (e) { console.warn("Lookup de fornecedor indisponível; usando dados do boleto.", e); }
        }
      }
      // Se a nota fiscal já foi cadastrada em Compras, vincula o boleto à compra
      // somente quando houver uma única nota pendente compatível com o fornecedor.
      const purchasesSnap = await getDocs(collection(db, "purchase_orders"));
      const clean = (value: string) => String(value || "").replace(/\D/g, "");
      const norm = (value: string) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const supplierCnpj = clean(boleto.cnpj || "");
      const candidates = purchasesSnap.docs.filter(d => {
        const p = d.data();
        if (["cancelled", "cancelado", "rejected", "rejeitado", "received", "paid"].includes(String(p.status || "").toLowerCase())) return false;
        const sameCnpj = supplierCnpj.length === 14 && clean(p.supplierCnpj || "") === supplierCnpj;
        const sameName = norm(p.supplierName || "") === norm(supplierName);
        return sameCnpj || sameName;
      });
      const linkedPurchase = candidates.length === 1 ? candidates[0] : null;
      await addDoc(collection(db, "payables"), {
        supplierId, supplierName, supplierCnpj: boleto.cnpj || "",
        description: boleto.description || `Boleto ${boleto.fileName || ""}`.trim(),
        amount: boleto.amount || 0, dueDate: boleto.dueDate || today(),
        paymentMethod: "boleto", status: "pending", digitableLine: boleto.digitableLine || "",
        documentUrl: boleto.fileUrl || "", documentName: boleto.fileName || "",
        ...(linkedPurchase ? { purchaseId: linkedPurchase.id, purchaseNumber: String(linkedPurchase.data().number || ""), invoiceDocumentNumber: String(linkedPurchase.data().documentNumber || "") } : {}),
        notes: linkedPurchase ? `Boleto vinculado à nota fiscal ${linkedPurchase.data().documentNumber || linkedPurchase.data().number || ""}.` : `Importado via revisão de boletos${boleto.fileName ? ` — ${boleto.fileName}` : ""}`,
        createdAt: new Date().toISOString()
      });
      await deleteDoc(doc(db, "pending_boletos", boleto.id));
    } catch (e) { alert("Erro ao aprovar: " + (e as Error).message); }
    finally { setProcessing(null); }
  };

  const reject = async (id: string) => {
    if (!confirm("Rejeitar este boleto? Ele será removido da lista.")) return;
    await deleteDoc(doc(db, "pending_boletos", id));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Search className="w-4 h-4" /> Buscar boletos da Anacleto</h3>
          <p className="text-xs text-slate-500 mt-1">Pesquisa os boletos já importados na aplicação pelo CNPJ do pagador. A consulta de boletos recebidos no DDA bancário exige integração autorizada com o banco ou provedor Open Finance.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Empresa" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)} placeholder="CNPJ da Anacleto" inputMode="numeric" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Fornecedor, linha digitável ou descrição" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
        </div>
        <button onClick={() => void searchCompanyBoletos()} disabled={searching} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {searching ? "Pesquisando..." : "Buscar boletos salvos"}
        </button>
        {searchMessage && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{searchMessage}</p>}
        {matches.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{item.beneficiary || item.description || item.fileName || "Boleto"}</span>
          <span>{money(Number(item.amount || 0))}</span><span className="text-slate-500">{item.dueDate || "Sem vencimento"}</span>
          {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Abrir</a>}
        </div>)}
      </section>

      <section className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
        <div><h3 className="font-bold flex items-center gap-2"><Camera className="w-4 h-4" /> Escanear ou enviar boleto pelo celular</h3>
          <p className="text-xs text-slate-500 mt-1">No celular, use a câmera para fotografar o boleto ou escolha um PDF/imagem da galeria. A IA tenta extrair os dados; revise antes de salvar.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white"><Camera className="w-4 h-4" /> Abrir câmera</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold"><Upload className="w-4 h-4" /> Enviar PDF ou imagem</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void handleFile(e.target.files?.[0] || null)} />
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => void handleFile(e.target.files?.[0] || null)} />
        </div>
        {selectedFile && <p className="text-xs text-slate-500">Arquivo selecionado: <strong>{selectedFile.name}</strong></p>}
        {extracting && <p className="text-sm text-indigo-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lendo documento...</p>}
        {uploadMessage && <p role="status" className="text-sm text-emerald-700">{uploadMessage}</p>}
        {uploadError && <p role="alert" className="text-sm text-rose-600">{uploadError}</p>}
        {selectedFile && <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={String(draft.beneficiary || "")} onChange={e => setDraft(v => ({...v, beneficiary:e.target.value}))} placeholder="Beneficiário / fornecedor *" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={String(draft.cnpj || "")} onChange={e => setDraft(v => ({...v, cnpj:e.target.value}))} placeholder="CNPJ do beneficiário" inputMode="numeric" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={String(draft.amount ?? "")} onChange={e => setDraft(v => ({...v, amount:Number(e.target.value)}))} type="number" min="0" step="0.01" placeholder="Valor *" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={String(draft.dueDate || "")} onChange={e => setDraft(v => ({...v, dueDate:e.target.value}))} type="date" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={String(draft.digitableLine || "")} onChange={e => setDraft(v => ({...v, digitableLine:e.target.value}))} placeholder="Linha digitável / código de barras" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 md:col-span-2" />
          <input value={String(draft.description || "")} onChange={e => setDraft(v => ({...v, description:e.target.value}))} placeholder="Descrição" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 md:col-span-2" />
          <button onClick={() => void saveUploadedBoleto()} disabled={saving || extracting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar aguardando aprovação
          </button>
        </div>}
      </section>

      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" /> Boletos aguardando revisão</h2>
        <p className="text-sm text-slate-500 mt-1">Aprovar importa para Contas a Pagar. Nenhum boleto é pago automaticamente.</p>
      </div>
      {pending.length === 0 ? <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed">
        <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500 font-bold">Nenhum boleto pendente</p>
        <p className="text-xs text-slate-400 mt-1">Escaneie ou envie um boleto para começar.</p>
      </div> : <div className="grid gap-3">
        {pending.map(b => <div key={b.id} className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">AGUARDANDO APROVAÇÃO</span></div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500 text-xs">Beneficiário:</span> <strong>{b.beneficiary || "-"}</strong></div>
                <div><span className="text-slate-500 text-xs">CNPJ:</span> <strong className="font-mono">{b.cnpj || "-"}</strong></div>
                <div><span className="text-slate-500 text-xs">Vencimento:</span> <strong>{b.dueDate || "-"}</strong></div>
                <div><span className="text-slate-500 text-xs">Valor:</span> <strong>{money(Number(b.amount || 0))}</strong></div>
                {b.digitableLine && <div className="col-span-2"><span className="text-slate-500 text-xs">Linha digitável:</span><code className="block text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mt-1 break-all">{b.digitableLine}</code></div>}
                {b.fileUrl && <a href={b.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Ver arquivo original</a>}
              </div>
            </div>
            <div className="flex flex-col gap-2 min-w-[150px]">
              <button onClick={() => void approve(b)} disabled={processing === b.id} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">{processing === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} {processing === b.id ? "Processando..." : "Aceitar e importar"}</button>
              <button onClick={() => void reject(b.id)} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold"><XCircle className="w-3.5 h-3.5" /> Rejeitar</button>
            </div>
          </div>
        </div>)}
      </div>}
    </div>
  );
}
