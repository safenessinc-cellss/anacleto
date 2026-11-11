import React, { useEffect, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPageThumbnailsProps {
  url: string;
  pageLimit?: number;
}

export default function PdfPageThumbnails({ url, pageLimit = 3 }: PdfPageThumbnailsProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof getDocument> | undefined;
    setPages([]);
    setLoading(true);
    setError("");

    loadingTask = getDocument({ url });
    loadingTask.promise.then(async (pdf) => {
      const rendered: string[] = [];
      const count = Math.min(pdf.numPages, Math.max(1, pageLimit));
      for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.42 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        rendered.push(canvas.toDataURL("image/png"));
      }
      if (!cancelled) {
        setPages(rendered);
        setLoading(false);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Não foi possível gerar as miniaturas do PDF.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [url, pageLimit]);

  if (loading) return <p className="mt-2 text-[10px] text-slate-400">Gerando miniaturas do PDF...</p>;
  if (error || pages.length === 0) return <p className="mt-2 text-[10px] text-slate-400">Pré-visualização indisponível. Use Abrir em nova aba.</p>;

  return (
    <div className="mt-2 flex flex-wrap gap-2" aria-label="Miniaturas das páginas do PDF">
      {pages.map((src, index) => (
        <div key={index} className="w-20 overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700">
          <img src={src} alt={"Miniatura da página " + (index + 1) + " do PDF"} className="h-24 w-full object-contain" />
          <p className="border-t border-slate-100 py-1 text-center text-[9px] text-slate-500">Página {index + 1}</p>
        </div>
      ))}
    </div>
  );
}
