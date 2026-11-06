import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot } from "firebase/firestore";
import Papa from "papaparse";
import { db } from "../../firebase";
import { AlertCircle, CheckCircle2, FileDown, FileUp, Plus, Receipt, Trash2, Upload, X } from "lucide-react";

type Expense = {
  id?: string;
  description: string;
  supplier: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  documentNumber?: string;
  notes?: string;
  source: "manual" | "csv" | "ofx" | "nfe";
  importKey?: string;
  createdAt?: string;
};
type DraftExpense = Omit<Expense, "id" | "createdAt">;

const today = () => new Date().toISOString().slice(0, 10);
const blank: DraftExpense = {
  description: "", supplier: "", category: "Materiais", amount: 0,
  date: today(), paymentMethod: "Não informado", documentNumber: "",
  notes: "", source: "manual",
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const clean = (value: unknown) => String(value ?? "").trim();
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseAmount = (value: unknown): number => {
  if (typeof value === "number") return value;
  let raw = clean(value).replace(/R\$|\s/g, "");
  if (!raw) return 0;
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (raw.includes(",")) raw = raw.replace(",", ".");
  return Number(raw) || 0;
};
const toISODate = (value: string) => {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const br = v.match(/^(\d{2})[/. -](\d{2})[/. -](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10);
};
const first = (row: Record<string, unknown>, aliases: string[]) => {
  const keys = Object.keys(row);
  const key = keys.find(k => aliases.includes(normalize(k)));
  return key ? row[key] : "";
};
const makeKey = (e: DraftExpense) => [e.date, normalize(e.supplier), normalize(e.description), e.amount.toFixed(2)].join("|");

function parseCsv(text: string): DraftExpense[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy", delimiter: "", transformHeader: h => h.trim() });
  if (parsed.errors.length && !parsed.data.length) throw new Error("Não foi possível ler o CSV. Verifique o cabeçalho e o separador.");
  return parsed.data.map(row => {
    const amount = parseAmount(first(row, ["valor", "amount", "total", "valorpago", "valorbruto", "despesa"]));
    const description = clean(first(row, ["descricao", "description", "historico", "memo", "detalhe", "produto", "servico"]));
    const supplier = clean(first(row, ["fornecedor", "supplier", "favorecido", "beneficiario", "emitente", "estabelecimento"]));
    const date = toISODate(clean(first(row, ["data", "date", "datapagamento", "emissao", "vencimento"])));
    const category = clean(first(row, ["categoria", "category", "grupo"])) || "Importado";
    const documentNumber = clean(first(row, ["documento", "numero", "numerodocumento", "nf", "nota"])) || "";
    return { ...blank, description, supplier, amount, date, category, documentNumber, source: "csv" as const };
  }).filter(e => e.description && e.amount > 0);
}
function parseOfx(text: string): DraftExpense[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  return blocks.map(block => {
    const get = (tag: string) => clean(block.match(new RegExp("<" + tag + ">([^\\r\\n<]+)", "i"))?.[1]);
    const rawAmount = parseAmount(get("TRNAMT"));
    const dateRaw = get("DTPOSTED").slice(0, 8);
    const date = dateRaw.length === 8 ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}` : today();
    const description = get("MEMO") || get("NAME") || "Movimentação bancária";
    const supplier = get("NAME") || "Não identificado";
    const fitid = get("FITID");
    return { ...blank, description, supplier, amount: Math.abs(rawAmount), date, category: "Movimentação bancária", documentNumber: fitid, paymentMethod: "Conta bancária", source: "ofx" as const, notes: rawAmount < 0 ? "Débito importado do extrato OFX" : "Crédito importado; revisar classificação" };
  }).filter(e => e.amount > 0 && (blocks.length === 0 || !/CREDIT/i.test(e.notes || "")));
}
function parseNfe(text: string): DraftExpense[] {
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("XML inválido. Envie o XML autorizado da NF-e.");
  const byLocal = (parent: Element | Document, name: string) => Array.from(parent.getElementsByTagName("*")).find(el => el.localName === name);
  const inf = byLocal(xml, "infNFe");
  if (!inf) throw new Error("Arquivo XML sem estrutura de NF-e reconhecida.");
  const emit = byLocal(inf, "emit");
  const ide = byLocal(inf, "ide");
  const total = byLocal(inf, "ICMSTot");
  const value = clean(byLocal(total || inf, "vNF")?.textContent);
  const date = clean(byLocal(ide || inf, "dhEmi")?.textContent || byLocal(ide || inf, "dEmi")?.textContent);
  const supplier = clean(byLocal(emit || inf, "xNome")?.textContent) || "Fornecedor NF-e";
  const number = clean(byLocal(ide || inf, "nNF")?.textContent);
  const products = Array.from(inf.getElementsByTagName("*")).filter(el => el.localName === "det").map(det => clean(byLocal(det, "xProd")?.textContent)).filter(Boolean);
  const amount = parseAmount(value);
  if (!amount) throw new Error("NF-e sem valor total válido.");
  return [{ ...blank, description: products.slice(0, 5).join(", ") || "Compra conforme NF-e", supplier, amount, date: toISODate(date), category: "Materiais", documentNumber: number, source: "nfe", notes: "Importado do XML da NF-e. Confira os dados antes de salvar." }];
}

export default function ExpenseRegistrationModule() {
  const [items, setItems] = useState<Expense[]>([]);
  const [form, setForm] = useState<DraftExpense>(blank);
  const [showForm, setShowForm] = useState(false);
  const [staged, setStaged] = useState<DraftExpense[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => onSnapshot(collection(db, "expenses"), snap => {
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)).sort((a,b) => b.date.localeCompare(a.date)));
  }, err => setError("Não foi possível carregar os gastos. Verifique sua permissão de acesso.")), []);

  const totalMonth = useMemo(() => {
    const month = today().slice(0, 7);
    return items.filter(i => i.date?.startsWith(month)).reduce((sum, i) => sum + Number(i.amount || 0), 0);
  }, [items]);
  const filtered = items.filter(i => [i.description, i.supplier, i.category, i.documentNumber].join(" ").toLowerCase().includes(query.toLowerCase()));
  const duplicateKeys = useMemo(() => new Set(items.map(i => i.importKey || makeKey(i))), [items]);

  const saveOne = async (entry: DraftExpense) => {
    await addDoc(collection(db, "expenses"), { ...entry, importKey: makeKey(entry), createdAt: new Date().toISOString() });
  };
  const saveManual = async () => {
    if (!form.description.trim() || !form.supplier.trim() || form.amount <= 0 || !form.date) {
      setError("Preencha descrição, fornecedor, valor maior que zero e data.");
      return;
    }
    setBusy(true); setError("");
    try { await saveOne(form); setForm(blank); setShowForm(false); }
    catch { setError("Não foi possível salvar o gasto. Verifique a conexão e as permissões."); }
    finally { setBusy(false); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setError(""); setStaged([]); setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "ofx", "xml"].includes(ext || "")) {
      setError("Formato não suportado. Use CSV, OFX ou XML de NF-e. PDF pode ser guardado como comprovante em uma próxima etapa, mas não é um formato estruturado para lançamento automático.");
      return;
    }
    try {
      const text = await file.text();
      const rows = ext === "csv" ? parseCsv(text) : ext === "ofx" ? parseOfx(text) : parseNfe(text);
      if (!rows.length) throw new Error("Nenhum lançamento válido encontrado. Confira as colunas obrigatórias: data, descrição e valor.");
      setStaged(rows);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao interpretar o arquivo."); }
  };
  const commitImport = async () => {
    const unique = staged.filter(row => !duplicateKeys.has(makeKey(row)));
    if (!unique.length) { setError("Todos os registros deste arquivo já existem ou são duplicados."); return; }
    setBusy(true); setError("");
    try {
      for (const row of unique) await saveOne(row);
      setStaged([]); setFileName("");
    } catch { setError("A importação foi interrompida. Verifique os registros salvos antes de repetir para evitar duplicidades."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div><h3 className="text-lg font-black text-slate-900 dark:text-white">Registrar Gastos</h3><p className="text-sm text-slate-500 dark:text-slate-400">Lançamentos operacionais e importação de extratos e documentos fiscais.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold cursor-pointer hover:border-blue-400"><FileUp className="w-4 h-4"/> Importar arquivo<input className="hidden" type="file" accept=".csv,.ofx,.xml,text/csv,application/xml" onChange={e => importFile(e.target.files?.[0])}/></label>
        <button onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"><Plus className="w-4 h-4"/> Novo gasto</button>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><p className="text-xs uppercase font-bold text-slate-500">Gastos no mês</p><p className="text-2xl font-black mt-1">{money(totalMonth)}</p></div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><p className="text-xs uppercase font-bold text-slate-500">Lançamentos</p><p className="text-2xl font-black mt-1">{items.length}</p></div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><p className="text-xs uppercase font-bold text-slate-500">Importados</p><p className="text-2xl font-black mt-1">{items.filter(i => i.source !== "manual").length}</p></div>
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-3 text-sm"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/><span>{error}</span><button className="ml-auto" onClick={() => setError("")} aria-label="Fechar"><X className="w-4 h-4"/></button></div>}
    {showForm && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="font-bold">Novo lançamento de gasto</h4><button onClick={() => setShowForm(false)} aria-label="Fechar"><X className="w-4 h-4"/></button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <input className="rounded-lg border p-2.5 bg-transparent text-sm" placeholder="Descrição *" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        <input className="rounded-lg border p-2.5 bg-transparent text-sm" placeholder="Fornecedor / favorecido *" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/>
        <input className="rounded-lg border p-2.5 bg-transparent text-sm" type="number" min="0.01" step="0.01" placeholder="Valor (R$) *" value={form.amount || ""} onChange={e=>setForm({...form,amount:parseAmount(e.target.value)})}/>
        <input className="rounded-lg border p-2.5 bg-transparent text-sm" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        <select className="rounded-lg border p-2.5 bg-transparent text-sm" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{["Materiais","Serviços","Frete","Energia e água","Aluguel","Folha de pagamento","Impostos e taxas","Manutenção","Administrativo","Outros"].map(v=><option key={v}>{v}</option>)}</select>
        <select className="rounded-lg border p-2.5 bg-transparent text-sm" value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})}>{["Não informado","PIX","Boleto","Transferência","Cartão","Dinheiro","Débito automático"].map(v=><option key={v}>{v}</option>)}</select>
        <input className="rounded-lg border p-2.5 bg-transparent text-sm" placeholder="Nº documento / nota fiscal" value={form.documentNumber} onChange={e=>setForm({...form,documentNumber:e.target.value})}/>
        <input className="rounded-lg border p-2.5 bg-transparent text-sm sm:col-span-2" placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
      </div>
      <div className="flex justify-end"><button disabled={busy} onClick={saveManual} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-50">{busy ? "Salvando..." : "Salvar gasto"}</button></div>
    </section>}
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center gap-2"><Upload className="w-4 h-4 text-blue-600"/><h4 className="font-bold">Importação padronizada</h4></div>
      <p className="text-sm text-slate-500 dark:text-slate-400">CSV (planilhas e extratos), OFX (extrato bancário) e XML de NF-e (nota fiscal eletrônica). Os arquivos são processados no navegador e os dados são apresentados para conferência antes da gravação.</p>
      <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-blue-50 text-blue-700 px-2.5 py-1.5">CSV</span><span className="rounded-lg bg-blue-50 text-blue-700 px-2.5 py-1.5">OFX</span><span className="rounded-lg bg-blue-50 text-blue-700 px-2.5 py-1.5">XML NF-e</span></div>
      {staged.length > 0 && <div className="border border-blue-200 dark:border-blue-900 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold text-sm">{fileName}</p><p className="text-xs text-slate-500">{staged.length} registro(s) prontos para revisão · {staged.filter(r=>!duplicateKeys.has(makeKey(r))).length} novo(s)</p></div><button onClick={()=>{setStaged([]);setFileName("");}} className="text-slate-500" aria-label="Cancelar importação"><X className="w-4 h-4"/></button></div>
        <div className="overflow-x-auto"><table className="w-full text-xs min-w-[620px]"><thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Data</th><th className="p-2">Fornecedor</th><th className="p-2">Descrição</th><th className="p-2 text-right">Valor</th><th className="p-2">Situação</th></tr></thead><tbody>{staged.slice(0,30).map((r,i)=><tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{r.date}</td><td className="p-2">{r.supplier}</td><td className="p-2">{r.description}</td><td className="p-2 text-right font-bold">{money(r.amount)}</td><td className="p-2">{duplicateKeys.has(makeKey(r)) ? <span className="text-amber-600">Possível duplicado</span> : <span className="text-emerald-600">Novo</span>}</td></tr>)}</tbody></table></div>
        {staged.length > 30 && <p className="text-xs text-slate-500">Exibindo os primeiros 30 registros; todos os {staged.length} serão considerados.</p>}
        <div className="flex justify-end"><button disabled={busy} onClick={commitImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"><CheckCircle2 className="w-4 h-4"/>{busy ? "Importando..." : "Confirmar importação"}</button></div>
      </div>}
    </section>
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between"><h4 className="font-bold">Histórico de gastos</h4><input className="rounded-lg border p-2.5 bg-white dark:bg-slate-900 text-sm w-full sm:max-w-xs" placeholder="Buscar gasto..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]"><thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Fornecedor</th><th className="p-3">Descrição</th><th className="p-3">Categoria</th><th className="p-3 text-right">Valor</th><th className="p-3">Origem</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 whitespace-nowrap">{item.date}</td><td className="p-3">{item.supplier}</td><td className="p-3">{item.description}</td><td className="p-3">{item.category}</td><td className="p-3 text-right font-bold whitespace-nowrap">{money(item.amount)}</td><td className="p-3 uppercase text-xs">{item.source}</td></tr>)}{filtered.length===0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum gasto registrado.</td></tr>}</tbody></table></div>
    </div>
  </div>;
}
