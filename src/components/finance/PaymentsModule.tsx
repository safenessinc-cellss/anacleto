import React, { useEffect, useState } from "react";
import {
  collection, onSnapshot, addDoc, doc, updateDoc, query, orderBy, where,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import {
  CreditCard, QrCode, Banknote, CheckCircle, Clock, X, Search,
  Receipt, Loader2, AlertCircle, DollarSign, Building2, Download,
} from "lucide-react";

interface Payable {
  id: string;
  supplierId: string;
  supplierName: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentMethod: string;
  status: "pending" | "paid" | "cancelled";
  paidAt?: string;
  digitableLine?: string;
}

interface Payment {
  id: string;
  payableId: string;
  payableDescription: string;
  supplierName: string;
  amount: number;
  method: "pix" | "credit_card" | "debit_card" | "transfer" | "cash" | "check" | "boleto";
  status: "completed" | "pending" | "failed";
  reference?: string;
  receiptUrl?: string;
  paidBy: string;
  paidAt: string;
  notes?: string;
}

const METHODS = [
  { id: "pix", label: "PIX", icon: QrCode, color: "emerald" },
  { id: "credit_card", label: "Cartão Crédito", icon: CreditCard, color: "blue" },
  { id: "debit_card", label: "Cartão Débito", icon: CreditCard, color: "indigo" },
  { id: "transfer", label: "Transferência", icon: Building2, color: "purple" },
  { id: "cash", label: "Dinheiro", icon: Banknote, color: "amber" },
  { id: "check", label: "Cheque", icon: Receipt, color: "slate" },
] as const;

type PaymentMethod = typeof METHODS[number]["id"];

export default function PaymentsModule() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [payables, setPayables] = useState<Payable[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Payable | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [processing, setProcessing] = useState(false);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "payables"), (snap) => {
      const list: Payable[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Payable));
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setPayables(list);
    }, (err) => console.warn("Payables listener:", err));

    const u2 = onSnapshot(
      query(collection(db, "payments"), orderBy("paidAt", "desc")),
      (snap) => {
        const list: Payment[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Payment));
        setPayments(list);
      },
      (err) => console.warn("Payments listener:", err)
    );

    return () => { u1(); u2(); };
  }, []);

  const pendingPayables = payables.filter((p) => p.status === "pending");

  const filteredPending = pendingPayables.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.description.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      (p.digitableLine && p.digitableLine.toLowerCase().includes(q))
    );
  });

  const filteredHistory = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.payableDescription.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      (p.reference && p.reference.toLowerCase().includes(q))
    );
  });

  const totals = {
    pending: pendingPayables.reduce((s, p) => s + p.amount, 0),
    paidThisMonth: payments
      .filter((p) => {
        const d = new Date(p.paidAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0),
  };

  const startPayment = (payable: Payable) => {
    setSelected(payable);
    setMethod("pix");
    setPixQr(null);
    setReference("");
    setNotes("");
  };

  const generatePix = async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/payments/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selected.amount,
          description: selected.description,
          payerName: selected.supplierName,
        }),
      });
      const data = await res.json();
      if (data.qrCode) {
        setPixQr(data.qrCode);
      } else {
        // Placeholder si no hay Mercado Pago configurado
        setPixQr("PIX_PLACEHOLDER");
        alert(
          "⚠️ PIX real no configurado.\n\n" +
          "Añade MERCADO_PAGO_ACCESS_TOKEN en Vercel → Settings → Environment Variables.\n\n" +
          "Mientras tanto, puedes registrar el pago manualmente con el método 'Transferência'."
        );
      }
    } catch (e) {
      alert("Erro ao gerar PIX: " + (e as Error).message);
    }
  };

  const confirmPayment = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      // 1) Registrar el pago
      await addDoc(collection(db, "payments"), {
        payableId: selected.id,
        payableDescription: selected.description,
        supplierName: selected.supplierName,
        amount: selected.amount,
        method,
        status: "completed",
        reference: reference || "",
        paidBy: auth.currentUser?.email || "",
        paidAt: new Date().toISOString(),
        notes: notes || "",
      });

      // 2) Marcar el payable como pagado
      await updateDoc(doc(db, "payables", selected.id), {
        status: "paid",
        paidAt: new Date().toISOString(),
        paidMethod: method,
      });

      // 3) Cerrar modal
      setSelected(null);
      setPixQr(null);
      setReference("");
      setNotes("");
      alert("✅ Pagamento registrado com sucesso!");
    } catch (e) {
      alert("Erro ao registrar pagamento: " + (e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const methodIcon = (m: string) => {
    const found = METHODS.find((x) => x.id === m);
    return found ? found.icon : Receipt;
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
            <Clock className="w-3.5 h-3.5" /> A pagar
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            R$ {totals.pending.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{pendingPayables.length} boletos</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-600">
            <CheckCircle className="w-3.5 h-3.5" /> Pago este mês
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            R$ {totals.paidThisMonth.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{payments.length} pagamentos total</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-600">
            <DollarSign className="w-3.5 h-3.5" /> Formas de pagamento
          </div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-2">
            PIX · Cartão · Transferência · Boleto · Dinheiro · Cheque
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
            tab === "pending"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" /> Boletos a Pagar ({pendingPayables.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
            tab === "history"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Receipt className="w-4 h-4" /> Histórico ({payments.length})
        </button>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por fornecedor, descrição ou referência..."
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800"
        />
      </div>

      {/* Lista de pendientes */}
      {tab === "pending" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredPending.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">{p.supplierName}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{p.description}</td>
                  <td className="p-3 font-bold">R$ {p.amount.toFixed(2)}</td>
                  <td className="p-3 font-mono text-xs">{p.dueDate}</td>
                  <td className="p-3">
                    <button
                      onClick={() => startPayment(p)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Pagar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPending.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">
                  {search ? "Nenhum boleto encontrado" : "Nenhum boleto pendente"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Historial */}
      {tab === "history" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Método</th>
                <th className="p-3">Referência</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((p) => {
                const Icon = methodIcon(p.method);
                return (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-mono text-xs">{new Date(p.paidAt).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3 font-bold">{p.supplierName}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{p.payableDescription}</td>
                    <td className="p-3 font-bold text-emerald-600">R$ {p.amount.toFixed(2)}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <Icon className="w-3 h-3" /> {METHODS.find((m) => m.id === p.method)?.label || p.method}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500 font-mono">{p.reference || "-"}</td>
                  </tr>
                );
              })}
              {filteredHistory.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">
                  {search ? "Nenhum pagamento encontrado" : "Nenhum pagamento registrado"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE PAGO */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-black text-lg">Pagar Boleto</h3>
                <p className="text-xs text-slate-500">{selected.supplierName}</p>
              </div>
              <button onClick={() => { setSelected(null); setPixQr(null); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detalle */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-300">{selected.description}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">Vencimento: {selected.dueDate}</span>
                <span className="text-2xl font-black text-emerald-600">R$ {selected.amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Métodos */}
            <div className="p-4">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Forma de pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-xs font-bold transition ${
                        method === m.id
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {m.label}
                    </button>
                  );
                })}
              </div>

              {/* PIX */}
              {method === "pix" && (
                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  {!pixQr ? (
                    <button
                      onClick={generatePix}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
                    >
                      <QrCode className="w-4 h-4" /> Gerar QR Code PIX
                    </button>
                  ) : pixQr === "PIX_PLACEHOLDER" ? (
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-xs text-amber-800 dark:text-amber-300 font-bold">
                        PIX real não configurado. Registre manualmente com o botão abaixo.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <img src={pixQr} alt="PIX QR" className="w-48 h-48 mx-auto" />
                      <p className="text-xs text-slate-500 mt-2">Escaneie ou copie o código PIX</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tarjeta */}
              {(method === "credit_card" || method === "debit_card") && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Integração com gateway de cartão não configurada.</strong><br />
                    Configure <code className="bg-blue-100 px-1 rounded">MERCADO_PAGO_ACCESS_TOKEN</code> em Vercel para ativar checkout real.
                  </p>
                </div>
              )}

              {/* Referencia */}
              <div className="mt-3">
                <label className="text-xs font-bold text-slate-500 uppercase">Referência / Comprovante</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Nº do comprovante, ID da transação..."
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              {/* Notas */}
              <div className="mt-3">
                <label className="text-xs font-bold text-slate-500 uppercase">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => { setSelected(null); setPixQr(null); }}
                disabled={processing}
                className="flex-1 px-4 py-2.5 text-sm font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPayment}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {processing ? "Processando..." : "Confirmar Pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
