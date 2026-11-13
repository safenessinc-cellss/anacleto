import React, { useMemo } from "react";
import type { TechnicalDrawing } from "../../types";
import { buildArchitecturalIsometricSvg, resolveAluminumSpec, svgDataUri } from "../../utils/architecturalSvg";

type Props = { drawing: TechnicalDrawing };

/** Pré-visualização 3D vetorial; não inicializa Three.js nem depende de WebGL. */
export default function DrawingThreePreview({ drawing }: Props) {
  const spec = useMemo(() => resolveAluminumSpec(drawing), [drawing]);
  const preview = useMemo(() => {
    try {
      return svgDataUri(buildArchitecturalIsometricSvg(drawing));
    } catch (error) {
      console.error("Falha ao gerar a perspectiva isométrica:", error);
      return "";
    }
  }, [drawing]);

  if (!preview) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-50">
        <div className="border-b border-slate-300 bg-slate-900 px-4 py-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Perspectiva isométrica arquitetônica</h3>
        </div>
        <p className="p-5 text-sm text-slate-600">
          Não foi possível gerar a perspectiva SVG deste desenho. Verifique a tipologia e as medidas.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f7f9f9]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-900 px-4 py-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Perspectiva isométrica arquitetônica</h3>
          <p className="mt-1 text-[10px] text-slate-400">
            SVG vetorial · perfil extrudido de {Math.round(spec.depth)} mm · {spec.leaves} folha(s)
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">SEM WEBGL</span>
      </div>
      <img
        src={preview}
        alt={"Perspectiva isométrica técnica de " + (drawing.title || "esquadria de alumínio")}
        loading="eager"
        decoding="sync"
        draggable={false}
        className="block h-auto max-h-[540px] w-full object-contain"
      />
    </section>
  );
}
