import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Loader2, PackagePlus, Search } from "lucide-react";

type StockItem = { id: string; name: string; sku?: string; unit?: string; quantity: number; reservedQuantity?: number; minimumStock?: number };
type Movement = { id: string; itemId: string; itemName: string; type: "in" | "out"; quantity: number; reason: string; createdAt?: any };
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
const amount = (v: string) => Math.max(0, Number(v) || 0);

export default function InventoryModule() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("un");
  const [quantity, setQuantity] = useState("1");
  const [minimumStock, setMinimumStock] = useState("0");
  const [type, setType] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("Ajuste manual");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const a = onSnapshot(collection(db, "inventory_items"), snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockItem))), e => console.error("Inventory items:", e));
    const b = onSnapshot(query(collection(db, "inventory_movements")), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movement));
      rows.sort((x, y) => String(y.createdAt?.toDate?.() || y.createdAt || "").localeCompare(String(x.createdAt?.toDate?.() || x.createdAt || "")));
      setMovements(rows.slice(0, 100));
    }, e => console.error("Inventory movements:", e));
    return () => { a(); b(); };
  }, []);

  const filtered = useMemo(() => items.filter(i => `${i.name} ${i.sku || ""}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const lowStock = items.filter(i => Number(i.quantity || 0) - Number(i.reservedQuantity || 0) <= Number(i.minimumStock || 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemName = name.trim(); const qty = amount(quantity);
    if (!itemName || qty <= 0) { setMessage("Informe o material e uma quantidade maior que zero."); return; }
    setSaving(true); setMessage("");
    try {
      const key = slug(sku.trim() || itemName) || `item-${Date.now()}`;
      const itemRef = doc(db, "inventory_items", key);
      const movementRef = doc(collection(db, "inventory_movements"));
      await runTransaction(db, async tx => {
        const snap = await tx.get(itemRef);
        const current = snap.exists() ? Number(snap.data().quantity || 0) : 0;
        const reserved = snap.exists() ? Number(snap.data().reservedQuantity || 0) : 0;
        if (type === "out" && current - reserved < qty) throw new Error("Estoque disponível insuficiente. Parte do saldo está reservada para produção.");
        tx.set(itemRef, { name: itemName, sku: sku.trim(), unit, quantity: type === "in" ? current + qty : current - qty, reservedQuantity: reserved, minimumStock: amount(minimumStock), updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || "" }, { merge: true });
        tx.set(movementRef, { itemId: itemRef.id, itemName, type, quantity: qty, reason: reason.trim() || "Movimentação manual", createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "" });
      });
      setName(""); setSku(""); setQuantity("1"); setMessage("Movimentação registrada e saldo atualizado.");
    } catch (err) { setMessage((err as Error).message || "Não foi possível registrar a movimentação."); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Materiais cadastrados</p><p className="text-2xl font-bold">{items.length}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Itens abaixo do mínimo</p><p className="text-2xl font-bold text-amber-600">{lowStock.length}</p></div>
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Movimentações recentes</p><p className="text-2xl font-bold">{movements.length}</p></div>
    </div>
    <form onSubmit={submit} className="rounded-xl border bg-white p-4 space-y-3 dark:bg-slate-900">
      <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-blue-600"/><h3 className="font-semibold">Registrar movimentação de estoque</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <input className="rounded-lg border px-3 py-2" placeholder="Material / produto" value={name} onChange={e=>setName(e.target.value)} required/>
        <input className="rounded-lg border px-3 py-2" placeholder="SKU / código (opcional)" value={sku} onChange={e=>setSku(e.target.value)}/>
        <input className="rounded-lg border px-3 py-2" placeholder="Unidade (un, m, kg...)" value={unit} onChange={e=>setUnit(e.target.value)}/>
        <input className="rounded-lg border px-3 py-2" type="number" min="0.001" step="0.001" placeholder="Quantidade" value={quantity} onChange={e=>setQuantity(e.target.value)} required/>
        <select className="rounded-lg border px-3 py-2" value={type} onChange={e=>setType(e.target.value as "in"|"out")}><option value="in">Entrada</option><option value="out">Saída</option></select>
        <input className="rounded-lg border px-3 py-2" placeholder="Estoque mínimo" type="number" min="0" step="0.001" value={minimumStock} onChange={e=>setMinimumStock(e.target.value)}/>
        <input className="rounded-lg border px-3 py-2 md:col-span-2" placeholder="Motivo / referência" value={reason} onChange={e=>setReason(e.target.value)}/>
      </div>
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500" role="status">{message}</p><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Registrar"}</button></div>
    </form>
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Boxes className="h-5 w-5"/><h3 className="font-semibold">Saldo de materiais</h3></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className="rounded-lg border py-2 pl-9 pr-3" placeholder="Buscar material" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Material</th><th className="p-2">SKU</th><th className="p-2">Saldo físico</th><th className="p-2">Reservado</th><th className="p-2">Disponível</th><th className="p-2">Mínimo</th><th className="p-2">Situação</th></tr></thead><tbody>{filtered.map(i=>{const available=Number(i.quantity||0)-Number(i.reservedQuantity||0);const low=available<=Number(i.minimumStock||0);return <tr key={i.id} className="border-b last:border-0"><td className="p-2 font-medium">{i.name}</td><td className="p-2">{i.sku||"—"}</td><td className="p-2">{Number(i.quantity||0).toLocaleString("pt-BR")} {i.unit||"un"}</td><td className="p-2">{Number(i.reservedQuantity||0).toLocaleString("pt-BR")}</td><td className="p-2 font-semibold">{available.toLocaleString("pt-BR")}</td><td className="p-2">{Number(i.minimumStock||0).toLocaleString("pt-BR")}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs ${low?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{low?"Repor":"Normal"}</span></td></tr>})}{!filtered.length&&<tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum material cadastrado.</td></tr>}</tbody></table></div>
    </div>
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><h3 className="mb-3 font-semibold">Histórico de movimentações</h3><div className="space-y-2">{movements.slice(0,12).map(m=><div key={m.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"><div className="flex items-center gap-2">{m.type==="in"?<ArrowDownToLine className="h-4 w-4 text-emerald-600"/>:<ArrowUpFromLine className="h-4 w-4 text-rose-600"/>}<div><p className="text-sm font-medium">{m.itemName}</p><p className="text-xs text-slate-500">{m.reason}</p></div></div><p className="text-sm font-semibold">{m.type==="in"?"+":"-"}{m.quantity}</p></div>)}{!movements.length&&<p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>}</div></div>
  </div>;
}
