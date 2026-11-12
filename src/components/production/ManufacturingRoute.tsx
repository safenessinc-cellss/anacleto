import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import type { QuoteItem, TechnicalDrawing, TechnicalPiece } from "../../types";

type RoutePiece = { key: string; sku: string; name: string; material: string; lengthMm: number; quantity: number; angle: string };
type GlassCut = { name: string; widthMm: number; heightMm: number; quantity: number; thickness: string; color: string; estimated: boolean };
type Bar = { pieces: Array<{ label: string; lengthMm: number; angle: string }>; remainingMm: number };

const BAR_LENGTH_MM = 6000;
const KERF_MM = 4;
const mm = (value: number, unit?: string) => Math.round(value * (unit === "m" ? 1000 : unit === "cm" ? 10 : 1));
const safeQty = (value: unknown) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.floor(quantity)) : 1;
};

function packBars(pieces: RoutePiece[]): Bar[] {
  const bars: Bar[] = [];
  const expanded = pieces.flatMap((piece) => Array.from({ length: piece.quantity }, () => ({
    label: `${piece.sku || piece.name} · ${piece.lengthMm} mm`,
    lengthMm: piece.lengthMm,
    angle: piece.angle,
  }))).filter((piece) => piece.lengthMm > 0 && piece.lengthMm + KERF_MM <= BAR_LENGTH_MM).sort((a, b) => b.lengthMm - a.lengthMm);
  for (const piece of expanded) {
    const needed = piece.lengthMm + KERF_MM;
    let bar = bars.find((item) => item.remainingMm >= needed);
    if (!bar) {
      bar = { pieces: [], remainingMm: BAR_LENGTH_MM };
      bars.push(bar);
    }
    bar.pieces.push(piece);
    bar.remainingMm -= needed;
  }
  return bars;
}

function dimensionsFromText(value?: string) {
  const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  if (!match) return undefined;
  const firstUnit = match[2]?.toLowerCase();
  const secondUnit = match[4]?.toLowerCase() || firstUnit;
  const convert = (raw: string, unit?: string) => {
    const number = Number(raw.replace(",", "."));
    const factor = unit === "m" ? 1000 : unit === "cm" ? 10 : unit === "mm" ? 1 : number < 10 ? 1000 : number < 100 ? 10 : 1;
    return Math.round(number * factor);
  };
  return { widthMm: convert(match[1], firstUnit), heightMm: convert(match[3], secondUnit) };
}

function getGlassCuts(drawing?: TechnicalDrawing, items: QuoteItem[] = []): GlassCut[] {
  const explicit = ((drawing as (TechnicalDrawing & { glassCutPlan?: Array<Record<string, unknown>> }) | undefined)?.glassCutPlan || [])
    .map((row): GlassCut | null => {
      const widthMm = Number(row.widthMm || mm(Number(row.width), String(row.unit || "mm")));
      const heightMm = Number(row.heightMm || mm(Number(row.height), String(row.unit || "mm")));
      if (!(widthMm > 0 && heightMm > 0)) return null;
      return {
        name: String(row.name || row.description || "Vidro"),
        widthMm: Math.round(widthMm),
        heightMm: Math.round(heightMm),
        quantity: safeQty(row.quantity),
        thickness: String(row.thickness || row.thicknessMm || drawing?.parametricSpec?.espessura_mm || "A confirmar"),
        color: String(row.color || drawing?.vidro || drawing?.parametricSpec?.cor_vidro || drawing?.parametricSpec?.tipo_vidro || "A confirmar"),
        estimated: row.estimated === true,
      };
    }).filter((row): row is GlassCut => Boolean(row));
  if (explicit.length) return explicit;

  const fromQuote = items.filter((item) => /vidro|glass/i.test(`${item.description} ${item.itemCategory || ""}`)).flatMap((item) => {
    const size = dimensionsFromText(item.itemDimensions);
    return size ? [{
      name: item.description,
      ...size,
      quantity: safeQty(item.quantity),
      thickness: (() => {
        const match = item.description.match(/(?:temperado|templado|laminado|insulado|duplo|comum|float)[^·]*?(\d+(?:[.,]\d+)?)\s*mm/i);
        return match ? `${match[1]} mm` : "A confirmar";
      })(),
      color: item.description.match(/\b(incolor|bronze|verde|fum[eê]|cinza)\b/i)?.[1] || "A confirmar",
      estimated: /estimad|preliminar|validar/i.test(String(item.notes || "")),
    }] : [];
  });
  if (fromQuote.length) return fromQuote;

  const spec = drawing?.parametricSpec;
  if (!spec) return [];
  const count = safeQty(spec.folhas);
  return [{
    name: `${spec.tipo_vidro} · painel paramétrico`,
    widthMm: Math.max(0, Math.round(spec.largura_mm / count - 50)),
    heightMm: Math.max(0, spec.altura_mm - 80),
    quantity: count,
    thickness: `${spec.espessura_mm} mm`,
    color: spec.cor_vidro || spec.tipo_vidro,
    estimated: true,
  }];
}

function getProfilePieces(drawing?: TechnicalDrawing, items: QuoteItem[] = []): RoutePiece[] {
  const pieces = (drawing?.pieces || []).filter((piece) => !/vidro|glass/i.test(`${piece.name} ${piece.material}`));
  if (pieces.length) {
    return pieces.flatMap((piece: TechnicalPiece) => {
      const budgetItem = drawing?.budget?.items.find((item) => item.pieceId === piece.id);
      const lengthMm = mm(Number(piece.dimensions?.width || 0), piece.dimensions?.unit);
      return lengthMm > 0 ? [{
        key: piece.id,
        sku: budgetItem?.sku || "",
        name: piece.name,
        material: piece.material,
        lengthMm,
        quantity: safeQty(piece.quantity),
        angle: piece.cutAngle || "90°/45° conforme o esquadro",
      }] : [];
    });
  }
  return items.filter((item) => !/vidro|glass/i.test(`${item.description} ${item.itemCategory || ""}`)).flatMap((item, index) => {
    const length = Number((item as QuoteItem & { cutLengthMm?: number }).cutLengthMm || 0);
    return length > 0 ? [{
      key: item.id || String(index),
      sku: item.sku || "",
      name: item.description,
      material: item.itemCategory || "Perfil / componente",
      lengthMm: Math.round(length),
      quantity: safeQty(item.quantity),
      angle: item.cutAngle || "45°/90° conforme o esquadro",
    }] : [];
  });
}

function makeRoutePdf(title: string, pieces: RoutePiece[], barsByProfile: Array<{ name: string; bars: Bar[] }>, glass: GlassCut[]) {
  const pdf = new jsPDF();
  let y = 18;
  const write = (value: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value, 180);
    if (y + lines.length * 5 > 278) {
      pdf.addPage();
      y = 18;
    }
    pdf.text(lines, 14, y);
    y += lines.length * 5 + 2;
  };
  write("ROTEIRO PASSO A PASSO DE CORTE E MONTAGEM", 14, true);
  write(title, 10, true);
  write("Prévia técnica: confirme as fórmulas e folgas oficiais da linha antes de cortar.", 9);
  write("PASSO 1 · CORTE DE PERFIS DE ALUMÍNIO (BARRAS 6000 mm)", 11, true);
  if (!pieces.length) write("Cortes de perfil pendentes de desenho técnico ou comprimentos validados.");
  for (const group of barsByProfile) {
    write(`${group.name}:`);
    group.bars.forEach((bar, index) => write(`Barra ${index + 1}: ${bar.pieces.map((piece) => piece.label).join(" + ")} · retalho ${bar.remainingMm} mm`));
  }
  write("PASSO 2 · MEDIDA DE CORTE DOS VIDROS", 11, true);
  if (!glass.length) write("Medidas de vidro pendentes; informar largura, altura, espessura e folgas de encaixe/EPDM.");
  glass.forEach((item) => write(`${item.name}: ${item.widthMm} × ${item.heightMm} mm · ${item.thickness} · ${item.color} · área ${(item.widthMm * item.heightMm * item.quantity / 1_000_000).toFixed(3)} m²${item.estimated ? " · estimativa a validar" : ""}`));
  write("PASSO 3 · USINAGEM, FURAÇÃO E MONTAGEM", 11, true);
  ["Furar e desobstruir drenos", "Conferir encaixe de roldanas e fechos", "Aplicar escovas e guarnições EPDM", "Montar folhas e verificar esquadro/deslizamento"].forEach((item, index) => write(`${index + 1}. [ ] ${item}`));
  write("PASSO 4 · CONFERÊNCIA FINAL E KIT DE INSTALAÇÃO", 11, true);
  ["Contramarco", "Silicone", "Parafusos e buchas", "Escovas/guarnições e ferragens", "Embalagem e proteção"].forEach((item, index) => write(`${index + 1}. [ ] ${item}`));
  pdf.save(`roteiro-fabricacao-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
}

export default function ManufacturingRoute({ drawing, items = [], title }: { drawing?: TechnicalDrawing; items?: QuoteItem[]; title: string }) {
  const [checked, setChecked] = useState<string[]>([]);
  const profiles = useMemo(() => getProfilePieces(drawing, items), [drawing, items]);
  const overlongProfiles = profiles.filter((piece) => piece.lengthMm + KERF_MM > BAR_LENGTH_MM);
  const grouped = useMemo(() => {
    const groups = new Map<string, RoutePiece[]>();
    for (const piece of profiles) {
      const key = piece.sku || piece.name;
      groups.set(key, [...(groups.get(key) || []), piece]);
    }
    return [...groups.entries()].map(([name, group]) => ({ name, bars: packBars(group) }));
  }, [profiles]);
  const glass = useMemo(() => getGlassCuts(drawing, items), [drawing, items]);
  const glassArea = glass.reduce((sum, item) => sum + item.widthMm * item.heightMm * item.quantity / 1_000_000, 0);
  const toggle = (item: string) => setChecked((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const machining = ["Furação de drenos e limpeza dos canais", "Encaixe de roldanas, fechos e ferragens", "Aplicação de escova e guarnições EPDM", "Montagem das folhas e conferência do esquadro"];
  const installationKit = ["Contramarco", "Silicone", "Parafusos e buchas", "Escovas, guarnições e ferragens", "Embalagem e proteção para transporte"];

  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-black">Roteiro Passo a Passo de Corte e Montagem</h3><p className="text-xs text-amber-700">Valores paramétricos são preliminares. Validar descontos e folgas da linha com o responsável técnico antes da fabricação.</p></div>
      <button type="button" onClick={() => makeRoutePdf(title, profiles, grouped, glass)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Exportar Ficha Técnica / Passo a Passo (PDF)</button>
    </header>
    <section className="rounded-xl border p-4">
      <h4 className="font-bold">Passo 1 · Corte de Perfis de Alumínio (Barras 6000 mm)</h4>
      {profiles.length ? <div className="mt-3 space-y-3">
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Código / Perfil</th><th className="p-2">Corte</th><th className="p-2">Ângulo</th><th className="p-2">Qtd.</th></tr></thead><tbody>
          {profiles.map((piece) => <tr key={piece.key} className="border-b"><td className="p-2">{piece.sku || piece.name}</td><td className="p-2">{piece.lengthMm} mm</td><td className="p-2">{piece.angle}</td><td className="p-2">{piece.quantity}</td></tr>)}
        </tbody></table></div>
        {grouped.map((group) => <div key={group.name}><p className="text-xs font-bold">{group.name}</p>{group.bars.map((bar, index) => <p key={`${group.name}-${index}`} className="mt-1 text-xs text-slate-600 dark:text-slate-300">Barra 6000 mm · {bar.pieces.map((piece) => `${piece.label} (${piece.angle})`).join(" + ")} · sobra / retalho: {bar.remainingMm} mm</p>)}</div>)}
        {overlongProfiles.length > 0 && <p role="alert" className="text-xs font-bold text-rose-700">Cortes acima de 5996 mm não foram agrupados: {overlongProfiles.map((piece) => piece.name).join(", ")}.</p>}
      </div> : <p className="mt-2 text-sm text-slate-500">Comprimentos de perfil aparecem ao vincular um desenho técnico ou informar cortes validados no Plano de Corte.</p>}
    </section>
    <section className="rounded-xl border p-4">
      <h4 className="font-bold">Passo 2 · Medida Exata de Corte dos Vidros</h4>
      {glass.length ? <><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Vidro</th><th className="p-2">Largura × altura</th><th className="p-2">Espessura / cor</th><th className="p-2">Área total</th></tr></thead><tbody>{glass.map((item, index) => <tr key={`${item.name}-${index}`} className="border-b"><td className="p-2">{item.name}{item.estimated ? " · estimado" : ""} × {item.quantity}</td><td className="p-2">{item.widthMm} × {item.heightMm} mm</td><td className="p-2">{item.thickness} · {item.color}</td><td className="p-2">{(item.widthMm * item.heightMm * item.quantity / 1_000_000).toFixed(3)} m²</td></tr>)}</tbody></table></div>{glass.some((item) => item.estimated) && <p className="mt-2 text-xs text-amber-700">Dimensão gerada por template (abatimentos paramétricos de 50 mm na largura e 80 mm na altura); confirmar encaixe e goma EPDM da linha.</p>}<p className="mt-2 text-xs font-bold">Área total: {glassArea.toFixed(3)} m²</p></> : <p className="mt-2 text-sm text-slate-500">Informe dimensões, espessura, cor e folgas de encaixe/EPDM do sistema para liberar o corte do vidro.</p>}
    </section>
    <section className="rounded-xl border p-4">
      <h4 className="font-bold">Passo 3 · Usinagem, Furação e Montagem</h4>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{machining.map((item) => <label key={item} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)}/>{item}</label>)}</div>
    </section>
    <section className="rounded-xl border p-4">
      <h4 className="font-bold">Passo 4 · Conferência Final e Kit de Instalação</h4>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{installationKit.map((item) => <label key={item} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)}/>{item}</label>)}</div>
    </section>
  </section>;
}
