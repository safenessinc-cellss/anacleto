import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { CheckCircle, XCircle, FileText, Loader2, AlertTriangle, Search } from "lucide-react";
import { lookupCNPJ, cnpjToSupplier, cleanCNPJ } from "../../utils/cnpjLookup";

interface PendingBoleto {
  id: string;
  fileName?: string;
  beneficiary?: string;
  cnpj?: string;
  amount?: number;
  dueDate?: string;
  digitableLine?: string;
  description?: string;
  status?: "pending" | "approved" | "rejected";
  createdAt?: string;
  extractedBy?: string;
}

export default function PendingBoletosModule() {
  const [pending, setPending] = useState<PendingBoleto[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyName, setCompanyName] = useState("Anacleto Esquadrias");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PendingBoleto[]>([]);
  const [searchMessage, setSearchMessage] = useState("");

  const searchCompanyBoletos = async () => {
    const cnpj = cleanCNPJ(companyCnpj);
    if (cnpj.length !== 14) {
      setSearchMessage("Informe um CNPJ válido da empresa em Configurações para pesquisar.");
      return;
    }
    setSearching(true);
    setSearchMessage("");
    try {
      // Busca somente documentos já importados/armazenados na plataforma.
      // Boletos privados não são consultáveis em fontes públicas sem autorização.
      const [pendingSnap, payableSnap] = await Promise.all([
        import("firebase/firestore").then(({ getDocs }) => getDocs(collection(db, "pending_boletos"))),
        import("firebase/firestore").then(({ getDocs }) => getDocs(collection(db, "payables"))),
      ]);
      const q = searchTerm.trim().toLocaleLowerCase("pt-BR");
      const docs: PendingBoleto[] = [];
      pendingSnap.forEach((d) => {
        const v = d.data() as any;
        const text = [v.beneficiary, v.cnpj, v.description, v.fileName].join(" ").toLocaleLowerCase("pt-BR");
        if (cleanCNPJ(v.cnpj || "") === cnpj || (q && text.includes(q))) docs.push({ id: d.id, ...v });
      });
      payableSnap.forEach((d) => {
        const v = d.data() as any;
        const text = [v.supplierName, v.supplierCnpj, v.description, v.digitableLine].join(" ").toLocaleLowerCase("pt-BR");
        if (cleanCNPJ(v.supplierCnpj || v.cnpj || "") === cnpj || (q && text.includes(q))) {
          docs.push({ id: d.id, ...v, status: v.status === "paid" ? "approved" : "pending", beneficiary: v.supplierName || v.beneficiary });
        }
      });
      setMatches(docs);
      setSearchMessage(docs.length
        ? `${docs.length} documento(s) encontrado(s) nos registros da plataforma para ${companyName}.`
        : `Nenhum boleto localizado nos documentos importados para ${companyName}. Importe arquivos ou conecte uma fonte autorizada.`);
    } catch (error) {
      setSearchMessage("Não foi possível pesquisar os documentos: " + (error as Error).message);
    } finally { setSearching(false); }
  };


  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pending_boletos"), (snap) => {
      const list: PendingBoleto[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PendingBoleto));
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setPending(list);
    }, (err) => console.warn("Pending boletos listener:", err));
    return () => unsub();
  }, []);

  const approve = async (boleto: PendingBoleto) => {
    setProcessing(boleto.id);
    try {
      // 1) Buscar/criar fornecedor pelo CNPJ automaticamente
      let supplierId = "";
      let supplierName = boleto.beneficiary || "Fornecedor desconhecido";

      if (boleto.cnpj) {
        const clean = cleanCNPJ(boleto.cnpj);
        if (clean.length === 14) {
          try {
            const cnpjData = await lookupCNPJ(clean);
            const supplierData = cnpjToSupplier(cnpjData);
            const newSupplier = await addDoc(collection(db, "suppliers"), {
              ...supplierData,
              createdAt: new Date().toISOString(),
            });
            supplierId = newSupplier.id;
            supplierName = supplierData.name;
          } catch (e) {
            console.warn("Não foi possível buscar CNPJ, usando dados do boleto", e);
          }
        }
      }

      // 2) Criar payable a partir do boleto
      await addDoc(collection(db, "payables"), {
        supplierId,
        supplierName,
        description: boleto.description || `Boleto ${boleto.fileName || ""}`.trim(),
        amount: boleto.amount || 0,
        dueDate: boleto.dueDate || new Date().toISOString().split("T")[0],
        paymentMethod: "boleto",
        status: "pending",
        digitableLine: boleto.digitableLine || "",
        notes: `Importado via IA${boleto.fileName ? ` — ${boleto.fileName}` : ""}`,
        createdAt: new Date().toISOString(),
      });

      // 3) Marcar como aprovado (o eliminar de pendentes)
      await deleteDoc(doc(db, "pending_boletos", boleto.id));
    } catch (e) {
      console.error(e);
      alert("Erro ao aprovar: " + (e as Error).message);
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (id: string) => {
    if (!confirm("Rejeitar este boleto? Ele será removido da lista.")) return;
    await deleteDoc(doc(db, "pending_boletos", id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" /> Boletos aguardando revisão
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Boletos extraídos pela IA. Aceite para adicionar em Contas a Pagar, ou rejeite para descartar.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void searchCompanyBoletos(); }} className="bg-white dark:bg-slate-900 rounded-xl border p-4 space-y-3">
        <h3 className="font-bold text-slate-800 dark:text-white">Buscar boletos nos registros</h3>
        <p className="text-xs text-slate-500">Pesquisa documentos já importados para a empresa. Não consulta automaticamente bancos ou sistemas privados de terceiros.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da empresa" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} placeholder="CNPJ da empresa (14 dígitos)" inputMode="numeric" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Fornecedor, descrição ou arquivo" className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
        </div>
        <button type="submit" disabled={searching} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {searching ? "Pesquisando..." : "Buscar boletos"}
        </button>
        {searchMessage && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{searchMessage}</p>}
        {matches.length > 0 && <div className="space-y-2">{matches.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm flex flex-wrap justify-between gap-2">
          <span className="font-semibold">{item.beneficiary || item.description || item.fileName || "Boleto"}</span>
          <span>R$ {Number(item.amount || 0).toFixed(2)}</span>
          <span className="text-slate-500">{item.dueDate || "Sem vencimento"}</span>
        </div>)}</div>}
      </form>

      {pending.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-bold">Nenhum boleto pendente</p>
          <p className="text-xs text-slate-400 mt-1">
            Envie um boleto em <strong>IA Financeira</strong> para que apareça aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pending.map((b) => (
            <div key={b.id} className="bg-white dark:bg-slate-900 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[250px]">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                      AGUARDANDO APROVAÇÃO
                    </span>
                    {b.fileName && (
                      <span className="text-xs text-slate-400 font-mono">{b.fileName}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500 text-xs">Beneficiário:</span> <strong>{b.beneficiary || "-"}</strong></div>
                    <div><span className="text-slate-500 text-xs">CNPJ:</span> <strong className="font-mono">{b.cnpj || "-"}</strong></div>
                    <div><span className="text-slate-500 text-xs">Vencimento:</span> <strong>{b.dueDate || "-"}</strong></div>
                    <div><span className="text-slate-500 text-xs">Valor:</span> <strong>R$ {Number(b.amount || 0).toFixed(2)}</strong></div>
                    {b.digitableLine && (
                      <div className="col-span-2">
                        <span className="text-slate-500 text-xs">Linha digitável:</span>
                        <code className="block text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mt-1 break-all">{b.digitableLine}</code>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-[140px]">
                  <button
                    onClick={() => approve(b)}
                    disabled={processing === b.id}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {processing === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {processing === b.id ? "Processando..." : "Aceitar e importar"}
                  </button>
                  <button
                    onClick={() => reject(b.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
