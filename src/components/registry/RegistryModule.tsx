import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../../firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Check, FileUp, Pencil, Plus, Search, Trash2, X, ImagePlus, ExternalLink, FileText, FileSpreadsheet, FileImage, FileArchive } from "lucide-react";
import ImageLightbox from "../common/ImageLightbox";
import PdfPageThumbnails, { countPdfPages } from "../common/PdfPageThumbnails";
import Papa from "papaparse";

export type RegistryKind = "items" | "products" | "esquadrias" | "services" | "payment_methods" | "measurement" | "contracts" | "cut_plan" | "profile_optimization" | "materials";

type CatalogAttachment = { id: string; fileName: string; fileType: string; mimeType: string; size: number; storagePath: string; downloadUrl: string; pageCount?: number; uploadedAt: string };
type RecordRow = { id: string; name: string; code?: string; category?: string; unit?: string; price?: number; status?: string; notes?: string; width?: number; height?: number; depth?: number; catalogFiles?: CatalogAttachment[]; itemPhotoUrls?: string[]; itemPhotoStoragePaths?: string[]; itemThumbnailUrls?: string[]; createdAt?: string; updatedAt?: string };
const config: Record<RegistryKind, { title: string; subtitle: string; collection: string; codeLabel: string; categories: string[]; unitLabel: string }> = {
  items: { title: "Cadastro de Itens", subtitle: "Cadastro geral de componentes e insumos.", collection: "registry_items", codeLabel: "Código / SKU", categories: ["Perfil", "Vidro", "Ferragem", "Acessório", "Outro"], unitLabel: "Unidade" },
  products: { title: "Produtos", subtitle: "Produtos e componentes comerciais disponíveis para orçamento.", collection: "registry_products", codeLabel: "Código do produto", categories: ["Perfil", "Vidro", "Ferragem", "Acessório", "Kit", "Outro"], unitLabel: "Unidade" },
  esquadrias: { title: "Esquadrias", subtitle: "Biblioteca de modelos de janelas, portas, fachadas e boxes para reutilização em projetos e orçamentos.", collection: "registry_esquadrias", codeLabel: "Código da esquadria", categories: ["Janela de correr", "Janela maxim-ar", "Janela basculante", "Porta de correr", "Porta de giro", "Porta pivotante", "Box de banheiro", "Fachada", "Outro"], unitLabel: "Unidade" },
  services: { title: "Serviços", subtitle: "Serviços e mão de obra que podem compor um orçamento.", collection: "registry_services", codeLabel: "Código do serviço", categories: ["Instalação", "Medição", "Manutenção", "Fabricação", "Outro"], unitLabel: "Unidade" },
  payment_methods: { title: "Formas de Pagamento", subtitle: "Condições de pagamento oferecidas aos clientes.", collection: "payment_methods", codeLabel: "Código", categories: ["PIX", "Dinheiro", "Cartão", "Transferência", "Boleto", "Outro"], unitLabel: "Condição" },
  measurement: { title: "Ficha de Medição", subtitle: "Registre medições feitas no local antes de liberar o orçamento para fabricação.", collection: "measurement_sheets", codeLabel: "Nº da ficha", categories: ["Janela", "Porta", "Box de banheiro", "Outro"], unitLabel: "mm" },
  contracts: { title: "Contratos", subtitle: "Controle de contratos relacionados a orçamentos aprovados.", collection: "contracts", codeLabel: "Nº do contrato", categories: ["Aguardando assinatura", "Assinado", "Encerrado"], unitLabel: "Unidade" },
  cut_plan: { title: "Plano de Corte", subtitle: "Registre planos de corte. Comprimentos só devem ser liberados após validar o sistema e as fórmulas do perfil.", collection: "cut_plans", codeLabel: "Nº do plano", categories: ["A validar", "Validado", "Liberado para produção"], unitLabel: "mm" },
  profile_optimization: { title: "Aproveitamento de Perfis", subtitle: "Cadastre análises de barras e sobras. Não substitui a otimização técnica validada.", collection: "profile_optimization", codeLabel: "Nº da análise", categories: ["Em análise", "Otimizado", "Revisar"], unitLabel: "mm" },
  materials: { title: "Lista de Materiais", subtitle: "Materiais associados a um orçamento ou ordem de produção.", collection: "material_lists", codeLabel: "Código / SKU", categories: ["Perfil", "Vidro", "Ferragem", "Acessório", "Consumível", "Outro"], unitLabel: "Unidade" },
};

export default function RegistryModule({ kind }: { kind: RegistryKind }) {
  const meta = config[kind];
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalogUploads, setCatalogUploads] = useState<File[]>([]);
  const [photoUploads, setPhotoUploads] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const empty = { name: "", code: "", category: meta.categories[0], unit: meta.unitLabel, price: "0", status: "Em elaboração", notes: "", width: "", height: "", depth: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setAuthReady(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(query(collection(db, meta.collection), orderBy("name", "asc")), (snap) => {
      setRows(snap.docs.map((item) => ({ id: item.id, ...item.data() } as RecordRow)));
      setError("");
    }, (err) => setError(err.message || "Não foi possível carregar os registros. Verifique as permissões do Firestore."));
    return () => unsub();
  }, [authReady, meta.collection]);

  const filtered = useMemo(() => rows.filter((row) => [row.name, row.code, row.category, row.status, row.width, row.height, row.depth].some((value) => String(value || "").toLowerCase().includes(search.toLowerCase()))), [rows, search]);
  const reset = () => { setEditing(null); setForm({ ...empty }); setCatalogUploads([]); setPhotoUploads([]); setUploadProgress(0); setError(""); };
  const editingRow = rows.find((row) => row.id === editing);
  const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() || "arquivo";
  const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / (1024 * 1024)).toFixed(2) + " MB";
  const allowedCatalogExtensions = new Set(["pdf","xls","xlsx","csv"]);
  const validateCatalogFiles = (files: File[]) => files.filter((file) => {
    const ext = extensionOf(file.name);
    const mime = file.type;
    const validMime = !mime || mime === "application/octet-stream" || mime.startsWith("image/") || mime.startsWith("text/") || mime === "application/pdf" || mime.includes("word") || mime.includes("excel") || mime.includes("spreadsheet") || mime.includes("zip") || mime.includes("presentation") || mime.includes("opendocument");
    if (!allowedCatalogExtensions.has(ext) || !validMime) { setError("Formato de catálogo não permitido: " + file.name); return false; }
    if (file.size > 25 * 1024 * 1024) { setError("O arquivo " + file.name + " excede o limite de 25 MB."); return false; }
    return true;
  });
  const validatePhotoFiles = (files: File[]) => files.filter((file) => {
    const ext = extensionOf(file.name);
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || !["jpg","jpeg","png","webp"].includes(ext)) { setError("A foto " + file.name + " deve estar em JPG, PNG ou WEBP."); return false; }
    if (file.size > 5 * 1024 * 1024) { setError("A foto " + file.name + " excede o limite de 5 MB."); return false; }
    return true;
  });
  const uploadFile = (file: File, path: string) => new Promise<{ url: string; path: string }>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type || "application/octet-stream" });
    task.on("state_changed", (snapshot) => setUploadProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, async () => {
      try { resolve({ url: await getDownloadURL(task.snapshot.ref), path }); } catch (e) { reject(e); }
    });
  });
  const removeStorageFile = async (path: string) => {
    try { await deleteObject(storageRef(storage, path)); }
    catch (e: any) { if (e?.code !== "storage/object-not-found") throw e; }
  };
  const removeAttachment = async (row: RecordRow, file: CatalogAttachment) => {
    try {
      await removeStorageFile(file.storagePath);
      await updateDoc(doc(db, meta.collection, row.id), { catalogFiles: (row.catalogFiles || []).filter((entry) => entry.id !== file.id), itemUpdatedAt: new Date().toISOString() });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover o anexo."); }
  };
  const removePhoto = async (row: RecordRow, index: number) => {
    const paths = row.itemPhotoStoragePaths || [];
    try {
      if (paths[index]) await removeStorageFile(paths[index]);
      await updateDoc(doc(db, meta.collection, row.id), {
        itemPhotoUrls: (row.itemPhotoUrls || []).filter((_, i) => i !== index),
        itemPhotoStoragePaths: paths.filter((_, i) => i !== index),
        itemThumbnailUrls: (row.itemThumbnailUrls || row.itemPhotoUrls || []).filter((_, i) => i !== index),
        itemUpdatedAt: new Date().toISOString()
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover a foto."); }
  };

  const save = async () => {
    if (!form.name.trim()) { setError("O nome/descrição é obrigatório."); return; }
    setSaving(true); setError(""); setUploadProgress(0);
    const now = new Date().toISOString();
    const uploadedPaths: string[] = [];
    const payload = { name: form.name.trim(), code: form.code.trim(), category: form.category, unit: form.unit.trim() || meta.unitLabel, price: Number(form.price) || 0, status: form.status, notes: form.notes.trim(), width: Number(form.width) || 0, height: Number(form.height) || 0, depth: Number(form.depth) || 0, updatedAt: now };
    try {
      const recordRef = editing ? doc(db, meta.collection, editing) : doc(collection(db, meta.collection));
      const current = editingRow || {} as RecordRow;
      const catalogFiles = [...(current.catalogFiles || [])];
      const itemPhotoUrls = [...(current.itemPhotoUrls || [])];
      const itemPhotoStoragePaths = [...(current.itemPhotoStoragePaths || [])];
      const total = catalogUploads.length + photoUploads.length;
      let done = 0;
      for (const file of catalogUploads) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = "catalogs/" + recordRef.id + "/" + Date.now() + "-" + safeName;
        const uploaded = await uploadFile(file, storagePath);
        uploadedPaths.push(uploaded.path);
        const pageCount = extensionOf(file.name) === "pdf" ? await countPdfPages(file) : undefined;
        catalogFiles.push({ id: crypto.randomUUID(), fileName: file.name, fileType: extensionOf(file.name), mimeType: file.type || "application/octet-stream", size: file.size, storagePath: uploaded.path, downloadUrl: uploaded.url, ...(pageCount ? { pageCount } : {}), uploadedAt: new Date().toISOString() });
        done++; setUploadProgress(Math.round(done / Math.max(total, 1) * 100));
      }
      for (const file of photoUploads) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = "items/" + recordRef.id + "/photos/" + Date.now() + "-" + safeName;
        const uploaded = await uploadFile(file, storagePath);
        uploadedPaths.push(uploaded.path);
        itemPhotoUrls.push(uploaded.url); itemPhotoStoragePaths.push(uploaded.path);
        done++; setUploadProgress(Math.round(done / Math.max(total, 1) * 100));
      }
      await setDoc(recordRef, { ...payload, catalogFiles, itemPhotoUrls, itemPhotoStoragePaths, itemThumbnailUrls: itemPhotoUrls, itemUpdatedAt: now, ...(editing ? {} : { createdAt: now }) }, { merge: true });
      reset();
    } catch (e) {
      await Promise.allSettled(uploadedPaths.map(removeStorageFile));
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Verifique as permissões do Firestore e do Storage.");
    } finally { setSaving(false); setUploadProgress(0); }
  };

  const importRegistryCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSaving(true);
    setError("");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const imported = results.data.map((raw) => {
          const row: Record<string, string> = {};
          Object.entries(raw).forEach(([key, value]) => { row[normalize(key)] = String(value ?? "").trim(); });
          const priceText = (row.preco || row.valor || row.price || "0").replace(/R\$\s?/gi, "").replace(/\./g, "").replace(",", ".");
          return {
            name: row.nome || row.descricao || row.servico || row.name || row.description || "",
            code: row.codigo || row.cod || row.code || row.sku || "",
            category: row.categoria || row.tipo || row.category || meta.categories[0],
            unit: row.unidade || row.unit || meta.unitLabel,
            price: Math.max(0, Number.parseFloat(priceText) || 0),
            status: row.estado || row.status || "Ativo",
            notes: row.observacoes || row.observacao || row.notas || row.notes || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }).filter((item) => item.name);
        if (results.errors.length > 0 && imported.length === 0) {
          setError("Não foi possível ler o CSV. Confira o separador e os cabeçalhos.");
          setSaving(false);
          return;
        }
        if (imported.length === 0) {
          setError("Nenhum registro válido encontrado. O CSV precisa ter uma coluna Nome, Produto, Item, Serviço ou Descrição.");
          setSaving(false);
          return;
        }
        try {
          for (const item of imported) await addDoc(collection(db, meta.collection), item);
          setError("");
          window.alert(`${imported.length} registro(s) importado(s) com sucesso.`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao importar serviços. Verifique as permissões do Firestore.");
        } finally {
          setSaving(false);
        }
      },
      error: () => {
        setError("Não foi possível abrir o arquivo CSV.");
        setSaving(false);
      },
    });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Deseja excluir este item e todas as suas fotos e anexos? Esta ação não pode ser desfeita.")) return;
    const row = rows.find((item) => item.id === id);
    try {
      const paths = [...(row?.itemPhotoStoragePaths || []), ...(row?.catalogFiles || []).map((file) => file.storagePath)].filter(Boolean);
      const outcomes = await Promise.allSettled(paths.map(removeStorageFile));
      const failure = outcomes.find((result) => result.status === "rejected");
      if (failure) throw (failure as PromiseRejectedResult).reason;
      await deleteDoc(doc(db, meta.collection, id));
      if (editing === id) reset();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível excluir o item e seus arquivos."); }
  };

  return <section className="space-y-6 text-slate-900 dark:text-slate-100">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">ANACLETO ESQUADRIAS</p><h2 className="mt-1 text-2xl font-black">{meta.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p></div>
      <div className="flex flex-wrap gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"/></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"><FileUp className="h-4 w-4"/>{saving ? "Importando..." : "Importar CSV"}<input type="file" accept=".csv,text/csv" onChange={importRegistryCSV} disabled={saving} className="hidden"/></label><button onClick={reset} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4"/> Novo</button></div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {!authReady && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Aguardando autenticação para carregar os dados.</p>}
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{editing ? "Editar registro" : "Novo registro"}</h3>{editing && <button onClick={reset} className="text-slate-500"><X className="h-4 w-4"/></button>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-500">{meta.codeLabel}<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Nome / descrição *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500">Categoria / tipo<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{meta.categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-500">{meta.unitLabel}<input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500">Preço / valor (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500">Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option>Em elaboração</option><option>Ativo</option><option>Aguardando validação</option><option>Aprovado</option><option>Concluído</option><option>Bloqueado</option></select></label>
        {["items", "products", "esquadrias"].includes(kind) && <>
          <label className="text-xs font-semibold text-slate-500">Largura<input type="number" min="0" step="0.01" value={form.width} onChange={e=>setForm({...form,width:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
          <label className="text-xs font-semibold text-slate-500">Altura<input type="number" min="0" step="0.01" value={form.height} onChange={e=>setForm({...form,height:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
          <label className="text-xs font-semibold text-slate-500">Profundidade<input type="number" min="0" step="0.01" value={form.depth} onChange={e=>setForm({...form,depth:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
          <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 p-3 space-y-4 dark:border-slate-700">
            <div><label className="mb-2 flex items-center gap-2 text-sm font-bold"><ImagePlus className="h-4 w-4 text-blue-600"/> Fotos do item (JPG, PNG ou WEBP · até 5 MB por foto)</label>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={e=>{setPhotoUploads(validatePhotoFiles(Array.from(e.target.files || [])));e.currentTarget.value="";}} className="block w-full text-xs"/>
              {photoUploads.length > 0 && <p className="mt-1 text-xs text-slate-500">{photoUploads.length} foto(s) selecionada(s).</p>}
              {!!editingRow?.itemPhotoUrls?.length && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{editingRow.itemPhotoUrls.map((url,index)=><div key={url} className="relative"><button type="button" onClick={()=>setLightbox({images:editingRow.itemPhotoUrls || [],index})} className="block h-20 w-full overflow-hidden rounded-lg border border-slate-200"><img src={url} alt={"Foto do item "+(index+1)} className="h-full w-full object-cover"/></button><button type="button" onClick={()=>void removePhoto(editingRow,index)} aria-label="Remover foto" className="absolute -right-1 -top-1 rounded-full bg-rose-600 p-1 text-white"><X className="h-3 w-3"/></button></div>)}</div>}
            </div>
            <div><label className="mb-2 flex items-center gap-2 text-sm font-bold"><FileUp className="h-4 w-4 text-emerald-600"/> Arquivos de referência (PDF, Excel XLS/XLSX ou CSV · até 25 MB por arquivo)</label>
              <input type="file" accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" multiple onChange={e=>{setCatalogUploads(validateCatalogFiles(Array.from(e.target.files || [])));e.currentTarget.value="";}} className="block w-full text-xs"/>
              {catalogUploads.length > 0 && <p className="mt-1 text-xs text-slate-500">{catalogUploads.length} anexo(s) selecionado(s).</p>}
              {!!editingRow?.catalogFiles?.length && <ul className="mt-3 space-y-2">{editingRow.catalogFiles.map(file=><li key={file.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800"><span className="flex min-w-0 items-center gap-2 truncate">{file.fileType === "pdf" ? <FileText className="h-4 w-4 shrink-0 text-rose-600"/> : ["xls","xlsx","csv"].includes(file.fileType) ? <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600"/> : ["jpg","jpeg","png","webp"].includes(file.fileType) ? <FileImage className="h-4 w-4 shrink-0 text-blue-600"/> : file.fileType === "zip" ? <FileArchive className="h-4 w-4 shrink-0 text-amber-600"/> : <FileText className="h-4 w-4 shrink-0 text-slate-500"/>}<span className="truncate">{file.fileType.toUpperCase()} · {file.fileName} · {formatBytes(file.size)}{file.pageCount ? " · " + file.pageCount + " páginas" : ""} · {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}</span></span><span className="flex gap-2"><a href={file.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600"><ExternalLink className="h-3.5 w-3.5"/> Abrir em nova aba</a><button type="button" onClick={()=>void removeAttachment(editingRow,file)} className="text-rose-600">Remover</button></span>{file.fileType === "pdf" ? <PdfPageThumbnails url={file.downloadUrl} pageLimit={3}/> : ["jpg","jpeg","png","webp"].includes(file.fileType) ? <img src={file.downloadUrl} alt={"Prévia de "+file.fileName} className="h-20 w-24 rounded border object-contain"/> : null}</li>)}</ul>}
            </div>
            {saving && <div className="text-xs text-blue-700">Enviando arquivos... {uploadProgress}%<div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{width:uploadProgress+"%"}}/></div></div>}
          </div>
        </>}
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2 lg:col-span-3">Notas<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
      </div>
      <div className="mt-3 flex gap-2"><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4"/>{saving ? "Salvando..." : "Guardar registro"}</button><button onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Limpar</button></div>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800"><h3 className="font-bold">Registros salvos</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{filtered.length} registro(s)</span></div>
      {filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhum registro encontrado. Adicione o primeiro usando o formulário acima.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">{meta.codeLabel}</th><th className="p-3">Nome / descrição</th><th className="p-3">Categoria</th><th className="p-3">Unidade</th><th className="p-3">Valor</th><th className="p-3">Estado</th><th className="p-3">Ações</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{row.code || "—"}</td><td className="p-3 font-semibold">{row.name}<p className="max-w-xs truncate text-xs font-normal text-slate-500">{row.notes}</p>{["items", "products", "esquadrias"].includes(kind) && <div className="mt-2 flex flex-wrap items-center gap-2">{(row.itemPhotoUrls || []).slice(0,4).map((url,index)=><button key={url} type="button" onClick={()=>setLightbox({images:row.itemPhotoUrls || [],index})} className="h-10 w-10 overflow-hidden rounded border"><img src={url} alt={"Foto "+(index+1)+" de "+row.name} className="h-full w-full object-cover"/></button>)}{(row.catalogFiles || []).length > 0 && <div className="mt-2 space-y-1">{row.catalogFiles.map(file=><div key={file.id} className="flex items-center gap-2 text-[10px] font-normal"><a href={file.downloadUrl} target="_blank" rel="noreferrer" className="max-w-[180px] truncate text-blue-600 underline">{file.fileType.toUpperCase()} · {file.fileName} · {formatBytes(file.size)}</a><button type="button" onClick={()=>void removeAttachment(row,file)} className="text-rose-600">Remover</button></div>)}</div>}</div>}</td><td className="p-3">{row.category || "—"}{["items", "products", "esquadrias"].includes(kind) && (row.width || row.height || row.depth) ? <p className="text-[10px] text-slate-500">{row.width || "—"} × {row.height || "—"} × {row.depth || "—"} mm</p> : null}</td><td className="p-3">{row.unit || "—"}</td><td className="p-3">{Number(row.price || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{row.status || "—"}</span></td><td className="p-3"><div className="flex gap-2"><button aria-label="Editar" onClick={()=>{setEditing(row.id);setForm({name:row.name||"",code:row.code||"",category:row.category||meta.categories[0],unit:row.unit||meta.unitLabel,price:String(row.price||0),status:row.status||"Em elaboração",notes:row.notes||"",width:String(row.width||""),height:String(row.height||""),depth:String(row.depth||"")});}} className="text-blue-600"><Pencil className="h-4 w-4"/></button><button aria-label="Eliminar" onClick={()=>void remove(row.id)} className="text-rose-600"><Trash2 className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div>}
    </div>
    {lightbox && <ImageLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={()=>setLightbox(null)} />}
  </section>;
}
