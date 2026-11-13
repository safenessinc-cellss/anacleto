import React, { useMemo } from "react";
import type { TechnicalDrawing } from "../../types";
import { buildArchitecturalIsometricSvg, resolveAluminumSpec, svgDataUri } from "../../utils/architecturalSvg";

type Props = { drawing: TechnicalDrawing };

export default function DrawingThreePreview({ drawing }: Props) {
  const preview = useMemo(
    () => svgDataUri(buildArchitecturalIsometricSvg(drawing)),
    [drawing],
  );
  const spec = resolveAluminumSpec(drawing);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#f7f9f9]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-900 px-4 py-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Perspectiva isométrica arquitetônica</h3>
          <p className="mt-1 text-[10px] text-slate-400">Vista vetorial SVG · perfil extrudido de {Math.round(spec.depth)} mm</p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">SVG vetorial</span>
      </div>
      <img
        src={preview}
        alt={`Perspectiva isométrica técnica de ${drawing.title || "esquadria de alumínio"}`}
        className="block h-auto max-h-[540px] w-full object-contain"
      />
    </section>
  );
}
