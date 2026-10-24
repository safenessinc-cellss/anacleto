import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { db, auth } from "../../firebase";
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
}

export default function CatalogModule() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<CatalogItem>({ sku: "", name: "", category: "Perfil", unit: "UN", price: 0, supplier: "Esquadrimax" });

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
    if (!form.sku || !form.name) return alert("SKU y Nombre son obligatorios");
    if (editing?.id) {
      await updateDoc(doc(db, "catalog", editing.id), { ...form });
    } else {
      await addDoc(collection(db, "catalog"), { ...form });
    }
    setEditing(null);
    setForm({ sku: "", name: "", category: "Perfil", unit: "UN", price: 0, supplier: "Esquadrimax" });
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este producto?")) await deleteDoc(doc(db, "catalog", id));
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
          alert("No se encontraron filas válidas.");
          return;
        }

        const { writeBatch, doc, collection } = await import("firebase/firestore");
        const batch = writeBatch(db);
        itemsToSave.forEach((item) => {
          const newDocRef = doc(collection(db, "catalog"));
          batch.set(newDocRef, item);
        });
        await batch.commit();
        alert(`✅ ${itemsToSave.length} productos importados.`);
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
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Catálogo de Productos</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Buscar por SKU o nombre..." 
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          <button onClick={() => { setEditing(null); setForm({ sku: "", name: "", category: "Perfil", unit: "UN", price: 0, supplier: "Esquadrimax" }); }} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
          <label className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-700">
            <FileUp className="w-4 h-4" /> Importar CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
        <h3 className="font-bold mb-3">{editing ? "Editar Producto" : "Añadir Producto"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input placeholder="SKU" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="p-2 border rounded text-sm" />
          <input placeholder="Nome" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="p-2 border rounded text-sm md:col-span-2" />
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="p-2 border rounded text-sm">
            <option>Perfil</option><option>Accesorio</option><option>Vidrio</option><option>Herraje</option>
          </select>
          <input placeholder="Unidad" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="p-2 border rounded text-sm" />
          <input type="number" placeholder="Preço" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} className="p-2 border rounded text-sm" />
        </div>
        <button onClick={handleSave} className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Guardar</button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr><th className="p-3">SKU</th><th className="p-3">Nombre</th><th className="p-3">Categoría</th><th className="p-3">Precio</th><th className="p-3">Acciones</th></tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-mono text-xs">{item.sku}</td>
                <td className="p-3">{item.name}</td>
                <td className="p-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{item.category}</span></td>
                <td className="p-3 font-bold">R$ {item.price.toFixed(2)}</td>
                <td className="p-3">
                  <button onClick={() => { setEditing(item); setForm(item); }} className="p-1 text-blue-600"><Edit className="w-4 h-4" /></button>
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
