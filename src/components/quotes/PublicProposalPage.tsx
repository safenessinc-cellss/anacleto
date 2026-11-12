import React, { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

type Proposal = {
  clientName: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; subtotal: number }>;
  design: null | {
    title: string;
    description: string;
    category: string;
    overallDimensions: { width?: number; height?: number; depth?: number } | null;
    pieces: Array<{ name: string; quantity: number; dimensions: { width?: number; height?: number; unit?: string } | null; material: string }>;
  };
  taxes: { taxRate: number; taxAmount: number; discountRate: number; discountAmount: number };
  freight: number;
  total: number;
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicProposalPage() {
  const id = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1) || "");
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ id, token });
    fetch(`/api/proposta?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Link inválido ou expirado.");
        if (active) setProposal(result.proposal as Proposal);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a proposta.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, token]);

  const approve = async () => {
    setApproving(true);
    setError("");
    try {
      const response = await fetch("/api/proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id, token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível aprovar a proposta.");
      setApproved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível aprovar a proposta.");
    } finally {
      setApproving(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Carregando proposta" /></main>;
  if (!proposal) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div><h1 className="text-2xl font-black text-slate-900">Proposta indisponível</h1><p className="mt-2 text-sm text-slate-600">{error}</p></div></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-white p-6 shadow-xl sm:p-10">
        <header className="border-b pb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Anacleto Esquadrias</p>
          <h1 className="mt-2 text-3xl font-black">Proposta para {proposal.clientName}</h1>
        </header>
        {proposal.design && (
          <section>
            <h2 className="font-bold">Projeto</h2>
            <p className="mt-1 text-sm font-semibold">{proposal.design.title}</p>
            {proposal.design.description && <p className="mt-1 text-sm text-slate-600">{proposal.design.description}</p>}
            {proposal.design.overallDimensions && <p className="mt-2 text-xs text-slate-500">Dimensões: {proposal.design.overallDimensions.width || "—"} × {proposal.design.overallDimensions.height || "—"}{proposal.design.overallDimensions.depth ? ` × ${proposal.design.overallDimensions.depth}` : ""}</p>}
            {proposal.design.pieces.length > 0 && <ul className="mt-3 space-y-1 text-sm">{proposal.design.pieces.map((piece, index) => <li key={`${piece.name}-${index}`}>{piece.quantity} × {piece.name}{piece.material ? ` · ${piece.material}` : ""}</li>)}</ul>}
          </section>
        )}
        <section>
          <h2 className="font-bold">Itens</h2>
          <div className="mt-3 divide-y">
            {proposal.items.map((item, index) => <div key={`${item.description}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><div><p className="font-semibold">{item.description}</p><p className="text-slate-500">{item.quantity} × {money(item.unitPrice)}</p></div><p className="font-semibold">{money(item.subtotal)}</p></div>)}
          </div>
        </section>
        <section className="space-y-2 border-t pt-4 text-sm">
          {proposal.taxes.discountAmount > 0 && <p className="flex justify-between"><span>Desconto ({proposal.taxes.discountRate}%)</span><span>-{money(proposal.taxes.discountAmount)}</span></p>}
          <p className="flex justify-between"><span>Impostos ({proposal.taxes.taxRate}%)</span><span>{money(proposal.taxes.taxAmount)}</span></p>
          <p className="flex justify-between"><span>Frete</span><span>{money(proposal.freight)}</span></p>
          <p className="flex justify-between border-t pt-3 text-lg font-black"><span>Total</span><span>{money(proposal.total)}</span></p>
        </section>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button onClick={() => void approve()} disabled={approving || approved} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-60">
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : approved ? <CheckCircle className="h-4 w-4" /> : null}
          {approved ? "Proposta aprovada" : approving ? "Registrando aprovação..." : "Aprovar proposta"}
        </button>
      </article>
    </main>
  );
}
