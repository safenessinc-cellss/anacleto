import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, orderBy, setDoc } from "firebase/firestore";
import { db, auth, storage } from "../../firebase";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { Package, Plus, Trash2, Edit, Search, FileUp } from "lucide-react";
import Papa from "papaparse";

interface CatalogItem {
  id?: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  supplier: string;
  attachments?: { id: string; fileName: string; fileType: string; size: number; storagePath: string; downloadUrl: string; uploadedAt: string }[];
}

export default function CatalogModule() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<CatalogItem>({ sku: "", name: "", category: "Perfil", unit: "UN", price: 0, supplier: "Esquadrimax" });
  const [uploads, setUploads] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthReady(!!u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const q = query(collection(db, "catalog"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: CatalogItem[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CatalogItem));
      setItems(list);
    }, (err) => console.warn("Catalog listener:", err));
    return () => unsub();
  }, [authReady]);

  const handleSave = async () => {
    if (!form.sku || !form.name) return alert("Código e nome são obrigatórios");
    setSaving(true);
    try {
      const recordRef = editing?.id ? doc(db, "catalog", editing.id) : doc(collection(db, "catalog"));
      const attachments = [...(editing?.attachments || [])];
      const productData = { sku: form.sku, name: form.name, category: form.category, unit: form.unit, price: Number(form.price || 0), supplier: form.supplier };
      await setDoc(recordRef, { ...productData, attachments, updatedAt: new Date().toISOString(), ...(!editing?.id ? { createdAt: new Date().toISOString() } : {}) }, { merge: true });
      for (const file of uploads) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        if (!["pdf", "xls", "xlsx", "csv"].includes(extension)) throw new Error("Use somente arquivos PDF, Excel XLS/XLSX ou CSV.");
        if (file.size > 25 * 1024 * 1024) throw new Error(file.name + " excede 25 MB.");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `catalogs/${recordRef.id}/${Date.now()}-${safeName}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream" });
        attachments.push({ id: crypto.randomUUID(), fileName: file.name, fileType: extension, size: file.size, storagePath: path, downloadUrl: await getDownloadURL(fileRef), uploadedAt: new Date().toISOString() });
      }
      await updateDoc(recordRef, { attachments, updatedAt: new Date().toISOString() });
      setEditing(null);
      setUploads([]);
      setForm({ sku: "", name: "", category: "Perfil", unit: "UN", price: 0, supplier: "Esquadrimax" });
    } catch (error) {
      console.error("Catalog save failed:", error);
      alert(error instanceof Error ? error.message : "Não foi possível salvar o produto e seus arquivos.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const item = items.find(row => row.id === id);
    if (!confirm("Excluir este produto e seus arquivos anexados?")) return;
    try {
      await Promise.all((item?.attachments || []).map(file => deleteObject(storageRef(storage, file.storagePath)).catch(() => undefined)));
      await deleteDoc(doc(db, "catalog", id));
    } catch (error) {
      console.error("Catalog delete failed:", error);
      alert("Não foi possível excluir o produto.");
    }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const itemsToSave = results.data.map((row: any) => ({
          sku: row.sku || row.SKU || "",
          name: row.name || row.nome || row.Nome || "",
          category: row.category || row.categoria || "Perfil",
          unit: row.unit || row.unidade || "UN",
          price: parseFloat(row.price || row.preco || row.Preço || 0),
          supplier: row.supplier || row.fornecedor || "Importado",
        })).filter(item => item.sku && item.name);

        if (itemsToSave.length === 0) {
          alert("Nenhuma linha válida foi encontrada.");
          return;
        }

        const { writeBatch, doc, collection } = await import("firebase/firestore");
        const batch = writeBatch(db);
        itemsToSave.forEach((item) => {
          const newDocRef = doc(collection(db, "catalog"));
          batch.set(newDocRef, item);
        });
        await batch.commit();
        alert(`✅ ${itemsToSave.length} itens importados.`);
      },
    });
  };

  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Produtos</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Buscar por código ou nome..." 
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          <button onClick={() => { setEditing(null); setUploads([]); setForm({ sku: "", name: "", category: "Perfil", unit: "UN", price: 0, supplier: "Esquadrimax" }); }} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
            <Plus className="w-4 h-4" /> Novo item
          </button>
          <label className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-700">
            <FileUp className="w-4 h-4" /> Importar CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
        <h3 className="font-bold mb-3">{editing ? "Editar produto" : "Adicionar produto"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input placeholder="SKU" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="p-2 border rounded text-sm" />
          <input placeholder="Nome" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="p-2 border rounded text-sm md:col-span-2" />
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="p-2 border rounded text-sm">
            <option>Perfil</option><option>Acessório</option><option>Vidro</option><option>Ferragem</option>
          </select>
          <input placeholder="Unidade" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="p-2 border rounded text-sm" />
          <input type="number" placeholder="Preço" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} className="p-2 border rounded text-sm" />
        </div>
        <label className="mt-4 block rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Arquivos do produto · PDF, Excel XLS/XLSX ou CSV · até 25 MB por arquivo
          <input type="file" multiple accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={event => { const selected = Array.from(event.target.files || []); const valid = selected.filter(file => ["pdf","xls","xlsx","csv"].includes(file.name.split(".").pop()?.toLowerCase() || "") && file.size <= 25 * 1024 * 1024); if (valid.length !== selected.length) alert("Alguns arquivos foram ignorados. Use PDF, XLS, XLSX ou CSV até 25 MB."); setUploads(valid); event.currentTarget.value = ""; }} className="mt-2 block w-full" />
          {uploads.length > 0 && <span className="mt-2 block">{uploads.length} arquivo(s) selecionado(s).</span>}
          {!!editing?.attachments?.length && <span className="mt-2 block">{editing.attachments.length} arquivo(s) já anexado(s).</span>}
        </label>
        <button onClick={handleSave} disabled={saving} className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr><th className="p-3">SKU</th><th className="p-3">Nome</th><th className="p-3">Categoria</th><th className="p-3">Preço</th><th className="p-3">Ações</th></tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-mono text-xs">{item.sku}</td>
                <td className="p-3">{item.name}{!!item.attachments?.length && <div className="mt-1 flex flex-wrap gap-2">{item.attachments.map(file => <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline">{file.fileType.toUpperCase()} · {file.fileName}</a>)}</div>}</td>
                <td className="p-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{item.category}</span></td>
                <td className="p-3 font-bold">R$ {item.price.toFixed(2)}</td>
                <td className="p-3">
                  <button onClick={() => { setEditing(item); setUploads([]); setForm(item); }} className="p-1 text-blue-600"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(item.id!)} className="p-1 text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
