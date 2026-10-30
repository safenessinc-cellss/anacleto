import React, { useRef, useState } from "react";
import { Sparkles, Upload, CheckCircle, Loader2, FileText, QrCode } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";

export default function FinancialAI() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [payerEmail, setPayerEmail] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixCopyPaste, setPixCopyPaste] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("O arquivo deve ter no máximo 10 MB."); return; }
    setExtracting(true);
    setResult(null);
    setPixQr(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
        reader.onload = () => {
          const value = String(reader.result || "");
          const encoded = value.split(",")[1];
          if (!encoded) reject(new Error("Arquivo vazio ou formato não suportado."));
          else resolve(encoded);
        };
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ai/financial-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/pdf", data: base64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao extrair os dados do boleto.");
      if (!data || (!data.beneficiary && !data.amount && !data.digitableLine)) throw new Error("A IA não encontrou dados suficientes. Envie um PDF ou imagem mais nítida.");
      setResult(data);
      await addDoc(collection(db, "pending_boletos"), {
        fileName: file.name, beneficiary: data.beneficiary || "", cnpj: data.cnpj || "",
        amount: Number(data.amount) || 0, dueDate: data.dueDate || "",
        digitableLine: data.digitableLine || "", description: data.description || "",
        status: "pending", createdAt: new Date().toISOString(),
        extractedBy: auth.currentUser?.email || "",
      });
    } catch (e) {
      alert("Erro ao processar boleto: " + (e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const generatePix = async () => {
    if (!result) return;
    if (!payerEmail.trim()) { alert("Informe o e-mail do pagador para gerar o PIX."); return; }
    setPixLoading(true);
    try {
      const res = await fetch("/api/payments/pix", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(result.amount), description: result.description || "Boleto", payerEmail: payerEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar a cobrança PIX.");
      if (!data.qrCode || !data.copyPaste) throw new Error("O Mercado Pago não devolveu o QR Code e o código PIX.");
      setPixQr(data.qrCode);
      setPixCopyPaste(data.copyPaste);
    } catch (e) {
      alert("Erro ao gerar PIX: " + (e as Error).message);
    } finally { setPixLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" /> IA Financeira
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Envie o PDF/imagem do boleto e a IA extrai automaticamente os dados para você.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition"
        >
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="font-bold text-slate-700">Clique para enviar boleto (PDF ou imagem)</p>
          <p className="text-xs text-slate-500 mt-1">{file ? file.name : "Nenhum arquivo selecionado"}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={extracting}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {extracting ? "Processando..." : "Extrair com IA"}
          </button>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900">Dados extraídos</h3>
            <p className="text-xs text-emerald-600 font-bold">Salvo em "Boletos a Revisar" — aceite lá para importar</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Beneficiário:</span> <strong>{result.beneficiary || "-"}</strong></div>
            <div><span className="text-slate-500">CNPJ:</span> <strong>{result.cnpj || "-"}</strong></div>
            <div><span className="text-slate-500">Vencimento:</span> <strong>{result.dueDate || "-"}</strong></div>
            <div><span className="text-slate-500">Valor:</span> <strong>R$ {Number(result.amount || 0).toFixed(2)}</strong></div>
            <div className="col-span-2"><span className="text-slate-500">Linha digitável:</span> <code className="text-xs bg-slate-100 px-2 py-1 rounded">{result.digitableLine || "-"}</code></div>
          </div>
          <button
            onClick={generatePix}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700"
          >
            <QrCode className="w-4 h-4" /> Pagar via PIX
          </button>
          {pixQr && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl text-center">
              <div className="text-xs text-slate-500 mb-2">Escaneie o QR Code</div>
              <img src={pixQr} alt="PIX QR Code" className="w-48 h-48 mx-auto" /><textarea readOnly value={pixCopyPaste} rows={3} className="w-full mt-3 p-2 text-xs border rounded-lg break-all" /><button onClick={() => { navigator.clipboard.writeText(pixCopyPaste); alert("Código PIX copiado."); }} className="mt-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold">Copiar código PIX</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
