import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  alt?: string;
}

export default function ImageLightbox({ images, initialIndex = 0, onClose, alt = "Foto do item" }: ImageLightboxProps) {
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((current) => (current - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setIndex((current) => (current + 1) % images.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  useEffect(() => setZoom(1), [index]);

  if (!images.length) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Visualização ampliada da foto" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-6" onClick={onClose}>
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ZoomOut className="h-5 w-5" /></button>
        <span className="min-w-14 text-center text-xs font-semibold text-white">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ZoomIn className="h-5 w-5" /></button>
        <button type="button" aria-label="Redefinir zoom" onClick={() => setZoom(1)} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><RotateCcw className="h-5 w-5" /></button>
        <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-full bg-white/15 p-3 text-white hover:bg-rose-600"><X className="h-5 w-5" /></button>
      </div>
      {images.length > 1 && <button type="button" aria-label="Foto anterior" onClick={(event) => { event.stopPropagation(); setIndex((current) => (current - 1 + images.length) % images.length); }} className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6"><ChevronLeft className="h-7 w-7" /></button>}
      <div className="flex h-full w-full items-center justify-center overflow-auto" onClick={(event) => event.stopPropagation()}>
        <img src={images[index]} alt={alt + " " + (index + 1)} className="max-h-full max-w-full object-contain transition-transform duration-150" style={{ transform: "scale(" + zoom + ")" }} />
      </div>
      {images.length > 1 && <button type="button" aria-label="Próxima foto" onClick={(event) => { event.stopPropagation(); setIndex((current) => (current + 1) % images.length); }} className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6"><ChevronRight className="h-7 w-7" /></button>}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{index + 1} / {images.length}</div>
    </div>
  );
}
