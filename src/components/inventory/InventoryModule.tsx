import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Loader2, PackagePlus, Search } from "lucide-react";

type StockItem = { id: string; name: string; sku?: string; unit?: string; quantity: number; reservedQuantity?: number; minimumStock?: number };
type Movement = { id: string; itemId: string; itemName: string; type: "in" | "out"; quantity: number; reason: string; createdAt?: any };
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
const amount = (v: string) => Math.max(0, Number(v) || 0);
const nonStockTerms = ["gasolina", "cola", "lubrificante", "ferragem", "ferragens", "material moto", "mate", "mercado pago", "parcela de carro"]; 
const isNonStock = (name: string) => nonStockTerms.some(term => slug(name).includes(slug(term)));

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
  const [cleaning, setCleaning] = useState(false);
  const [limitedSources, setLimitedSources] = useState<string[]>([]);
  const [manualEntryConfirmed, setManualEntryConfirmed] = useState(false);

  useEffect(() => {
    const a = onSnapshot(query(collection(db, "inventory_items"), limit(1000)), snap => { setLimitedSources(v => snap.size >= 1000 ? [...new Set([...v, "inventory_items"])] : v.filter(x => x !== "inventory_items")); setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockItem))); }, e => console.error("Inventory items:", e));
    const b = onSnapshot(query(collection(db, "inventory_movements"), orderBy("createdAt", "desc"), limit(100)), snap => {
      setLimitedSources(v => snap.size >= 100 ? [...new Set([...v, "inventory_movements"])] : v.filter(x => x !== "inventory_movements"));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movement));
      rows.sort((x, y) => String(y.createdAt?.toDate?.() || y.createdAt || "").localeCompare(String(x.createdAt?.toDate?.() || x.createdAt || "")));
      setMovements(rows.slice(0, 100));
    }, e => console.error("Inventory movements:", e));
    return () => { a(); b(); };
  }, []);

  const productionItems = useMemo(() => items.filter(i => !isNonStock(i.name)), [items]);
  const filtered = useMemo(() => productionItems.filter(i => `${i.name} ${i.sku || ""}`.toLowerCase().includes(search.toLowerCase())), [productionItems, search]);
  const lowStock = productionItems.filter(i => Number(i.quantity || 0) - Number(i.reservedQuantity || 0) <= Number(i.minimumStock || 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemName = name.trim(); const qty = amount(quantity);
    if (!itemName || qty <= 0) { setMessage("Informe o material e uma quantidade maior que zero."); return; }
    if (isNonStock(itemName)) { setMessage("Este item não pertence ao estoque de produção."); return; }
    if (type === "in" && !manualEntryConfirmed) { setMessage("Entrada permitida somente por recebimento de nota fiscal ou mediante confirmação de lançamento manual."); return; }
    if (type === "in" && !reason.trim()) { setMessage("Informe o motivo do lançamento manual."); return; }
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
      setName(""); setSku(""); setQuantity("1"); setManualEntryConfirmed(false); setMessage("Movimentação manual registrada e saldo atualizado.");
    } catch (err) { setMessage((err as Error).message || "Não foi possível registrar a movimentação."); }
    finally { setSaving(false); }
  };

  const removeNonStockItems = async () => {
    const targets = items.filter(item => isNonStock(item.name));
    if (!targets.length) { setMessage("Não há gasolina, cola, ferragens, material de moto, mate, Mercado Pago ou parcelas de carro cadastrados no estoque."); return; }
    if (!window.confirm(`Remover ${targets.length} item(ns) que não pertencem ao estoque de produção (gasolina, cola, ferragens, material de moto, mate, Mercado Pago ou parcelas de carro)? O histórico de movimentações será preservado.`)) return;
    setCleaning(true); setMessage("");
    try {
      for (let i = 0; i < targets.length; i += 400) {
        const batch = writeBatch(db);
        targets.slice(i, i + 400).forEach(item => batch.delete(doc(db, "inventory_items", item.id)));
        await batch.commit();
      }
      setMessage(`${targets.length} item(ns) removido(s) do saldo. O histórico de movimentações foi preservado.`);
    } catch (err) { setMessage((err as Error).message || "Não foi possível limpar esses itens."); }
    finally { setCleaning(false); }
  };

  return <div className="space-y-5">
    {limitedSources.length>0&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Inventário limitado: {limitedSources.join(", ")}. Estoque ou movimentos antigos podem não aparecer; o histórico completo ainda requer paginação.</p>}
    {items.length >= 1000 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Exibindo até 1.000 materiais. A paginação do estoque completo ainda precisa ser concluída.</p>}
    <p className="text-xs text-slate-500">O histórico abaixo mostra as 100 movimentações mais recentes.</p>
    <div className="flex justify-end"><button type="button" onClick={() => void removeNonStockItems()} disabled={cleaning} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">{cleaning ? "Limpando..." : "Limpar itens que não pertencem ao estoque"}</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Materiais cadastrados</p><p className="text-2xl font-bold">{productionItems.length}</p></div>
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
        {type === "in" && <label className="md:col-span-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={manualEntryConfirmed} onChange={e=>setManualEntryConfirmed(e.target.checked)} className="mt-1"/><span><strong>Entrada manual excepcional.</strong> Confirmo que este lançamento está sendo feito manualmente, sem nota fiscal. Entradas normais devem ser feitas em Financeiro → Compras, anexando a NF-e/DANFE e registrando o recebimento.</span></label>}
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
