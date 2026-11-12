import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Plus, Scissors } from "lucide-react";

type CutInput = { id: string; label: string; lengthMm: string; quantity: string };
type CutPiece = { id: string; label: string; lengthMm: number; kerfMm: number };
type BarPlan = { pieces: CutPiece[]; remainingMm: number };
type ProductionOrder = { id: string; number: string; clientName: string; quoteItems?: Array<{ description?: string }> };

const BAR_LENGTH_MM = 6000;
const KERF_MM = 4;
const blankCut = (): CutInput => ({ id: crypto.randomUUID(), label: "", lengthMm: "", quantity: "1" });

export function packCutsFirstFitDecreasing(cuts: Array<{ label: string; lengthMm: number; quantity: number }>): BarPlan[] {
  const pieces = cuts.flatMap((cut) => Array.from({ length: cut.quantity }, (_, index) => ({
    id: `${cut.label}-${cut.lengthMm}-${index}-${crypto.randomUUID()}`,
    label: cut.label,
    lengthMm: cut.lengthMm,
    kerfMm: KERF_MM,
  }))).sort((a, b) => b.lengthMm - a.lengthMm);
  const bars: BarPlan[] = [];

  for (const piece of pieces) {
    const requiredMm = piece.lengthMm + piece.kerfMm;
    let target = bars.find((bar) => bar.remainingMm >= requiredMm);
    if (!target) {
      target = { pieces: [], remainingMm: BAR_LENGTH_MM };
      bars.push(target);
    }
    target.pieces.push(piece);
    target.remainingMm -= requiredMm;
  }
  return bars;
}

export default function CuttingPlanTab({ orders }: { orders: ProductionOrder[] }) {
  const [orderId, setOrderId] = useState("");
  const [cuts, setCuts] = useState<CutInput[]>([blankCut()]);
  const [error, setError] = useState("");
  const selectedOrder = orders.find((order) => order.id === orderId);
  const validCuts = useMemo(() => cuts.map((cut) => ({
    label: cut.label.trim() || `Peça ${cut.lengthMm} mm`,
    lengthMm: Number(cut.lengthMm),
    quantity: Number(cut.quantity),
  })).filter((cut) => Number.isInteger(cut.lengthMm) && cut.lengthMm > 0 && Number.isInteger(cut.quantity) && cut.quantity > 0 && cut.lengthMm + KERF_MM <= BAR_LENGTH_MM), [cuts]);
  const plan = useMemo(() => packCutsFirstFitDecreasing(validCuts), [validCuts]);
  const invalidRows = cuts.some((cut) => cut.lengthMm || cut.label || cut.quantity !== "1") && validCuts.length === 0;

  const updateCut = (id: string, field: keyof Omit<CutInput, "id">, value: string) => {
    setCuts((current) => current.map((cut) => cut.id === id ? { ...cut, [field]: value } : cut));
  };

  const exportPdf = () => {
    if (!plan.length || !selectedOrder) {
      setError("Selecione uma ordem e informe comprimentos válidos antes de exportar.");
      return;
    }
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("Plano de corte · barras de 6000 mm", 14, 18);
    pdf.setFontSize(10);
    pdf.text(`Ordem: ${selectedOrder.number} · Cliente: ${selectedOrder.clientName}`, 14, 27);
    pdf.text(`Folga de corte: ${KERF_MM} mm por peça · Barras necessárias: ${plan.length}`, 14, 34);
    let y = 44;
    plan.forEach((bar, index) => {
      const description = bar.pieces.map((piece) => `${piece.label} (${piece.lengthMm} mm)`).join(" + ");
      const lines = pdf.splitTextToSize(`${index + 1}. ${description} · Retalho: ${bar.remainingMm} mm`, 180);
      if (y + lines.length * 5 > 280) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(lines, 14, y);
      y += lines.length * 5 + 4;
    });
    pdf.save(`plano-corte-${selectedOrder.number}.pdf`);
    setError("");
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold"><Scissors className="h-5 w-5 text-indigo-600" />Plano de corte · barras de 6 m</h3>
          <p className="mt-1 text-sm text-slate-500">First-Fit Decreasing com 4 mm de perda por corte. Informe cada comprimento em milímetros.</p>
        </div>
        <button type="button" onClick={exportPdf} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Exportar PDF</button>
      </header>

      <label className="block text-sm font-semibold">Ordem de produção
        <select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-900">
          <option value="">Selecione uma ordem</option>
          {orders.map((order) => <option key={order.id} value={order.id}>{order.number} · {order.clientName}</option>)}
        </select>
      </label>

      {selectedOrder?.quoteItems?.length ? <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800">Orçamento vinculado: {selectedOrder.quoteItems.map((item) => item.description).filter(Boolean).join(" · ")}</p> : null}

      <div className="space-y-2">
        {cuts.map((cut, index) => (
          <div key={cut.id} className="grid gap-2 sm:grid-cols-[1fr_150px_110px_auto]">
            <input aria-label={`Descrição do corte ${index + 1}`} value={cut.label} onChange={(event) => updateCut(cut.id, "label", event.target.value)} placeholder="Peça / perfil" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <input aria-label={`Comprimento do corte ${index + 1} em milímetros`} type="number" min="1" max={BAR_LENGTH_MM - KERF_MM} value={cut.lengthMm} onChange={(event) => updateCut(cut.id, "lengthMm", event.target.value)} placeholder="Comprimento (mm)" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <input aria-label={`Quantidade do corte ${index + 1}`} type="number" min="1" step="1" value={cut.quantity} onChange={(event) => updateCut(cut.id, "quantity", event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <button type="button" onClick={() => setCuts((current) => current.filter((row) => row.id !== cut.id))} aria-label={`Remover corte ${index + 1}`} className="rounded-lg border px-3 py-2 text-sm text-rose-600">Remover</button>
          </div>
        ))}
        <button type="button" onClick={() => setCuts((current) => [...current, blankCut()])} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />Adicionar comprimento</button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {invalidRows && <p role="alert" className="text-sm text-rose-600">Use comprimentos inteiros entre 1 e 5996 mm e quantidades inteiras maiores que zero.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Barras a comprar</p><p className="text-2xl font-black">{plan.length}</p></div>
        <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Peças a cortar</p><p className="text-2xl font-black">{plan.reduce((sum, bar) => sum + bar.pieces.length, 0)}</p></div>
        <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Sobra total / retalhos</p><p className="text-2xl font-black">{plan.reduce((sum, bar) => sum + bar.remainingMm, 0)} mm</p></div>
      </div>

      <div className="space-y-4">
        {plan.map((bar, index) => {
          const used = BAR_LENGTH_MM - bar.remainingMm;
          return (
            <article key={index} className="rounded-xl border p-4">
              <div className="mb-2 flex justify-between text-sm font-bold"><span>Barra {index + 1} · 6000 mm</span><span className="text-amber-700">Retalho: {bar.remainingMm} mm</span></div>
              <div className="flex h-12 overflow-hidden rounded-lg border bg-amber-50" aria-label={`Visualização da barra ${index + 1}`}>
                {bar.pieces.map((piece, pieceIndex) => <div key={piece.id} title={`${piece.label}: ${piece.lengthMm} mm + corte ${KERF_MM} mm`} style={{ width: `${((piece.lengthMm + piece.kerfMm) / BAR_LENGTH_MM) * 100}%` }} className={`flex shrink-0 items-center justify-center truncate border-r border-white px-1 text-[10px] font-bold text-white ${pieceIndex % 2 ? "bg-blue-600" : "bg-indigo-600"}`}>{piece.lengthMm} mm</div>)}
                <div style={{ width: `${(bar.remainingMm / BAR_LENGTH_MM) * 100}%` }} className="flex min-w-0 items-center justify-center bg-amber-200 px-1 text-[10px] font-bold text-amber-900">Retalho {bar.remainingMm} mm</div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Comprimento utilizado: {used} mm, incluindo {bar.pieces.length * KERF_MM} mm de cortes.</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
