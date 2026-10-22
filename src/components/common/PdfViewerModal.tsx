import React, { useEffect } from "react";
import { X, Download, ExternalLink, CheckCircle, FileText, FileCheck, Compass, ShieldCheck } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  pdfDataUri?: string;
  fileName?: string;
  fileSizeKb?: number;
  storedAt?: string;
  type?: "quote" | "invoice" | "drawing" | "generic";
}

export default function PdfViewerModal({
  isOpen,
  onClose,
  title,
  subtitle,
  pdfDataUri,
  fileName = "documento.pdf",
  fileSizeKb,
  storedAt,
  type = "generic",
}: PdfViewerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!pdfDataUri) return;
    const a = document.createElement("a");
    a.href = pdfDataUri;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    if (!pdfDataUri) return;
    try {
      // Convert data URI to Blob to avoid browser security restrictions with large data URIs
      const parts = pdfDataUri.split(",");
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      const newWin = window.open(blobUrl, "_blank");
      if (!newWin) {
        // Fallback
        window.location.href = pdfDataUri;
      }
    } catch {
      window.open(pdfDataUri, "_blank");
    }
  };

  const renderTypeIcon = () => {
    switch (type) {
      case "quote":
        return <FileText className="w-5 h-5 text-amber-400" />;
      case "invoice":
        return <FileCheck className="w-5 h-5 text-emerald-400" />;
      case "drawing":
        return <Compass className="w-5 h-5 text-amber-400" />;
      default:
        return <ShieldCheck className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              {renderTypeIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 shrink-0">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Almacenado en Plataforma
                </span>
                {storedAt && (
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    • {new Date(storedAt).toLocaleString("es-ES")}
                  </span>
                )}
                {fileSizeKb && (
                  <span className="text-[10px] text-amber-400/90 font-mono hidden sm:inline">
                    ({fileSizeKb} KB)
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-black text-white truncate uppercase tracking-tight mt-0.5">
                {title}
              </h2>
              {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenInNewTab}
              title="Abrir en pestaña completa"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Pantalla Completa</span>
            </button>
            <button
              onClick={handleDownload}
              title="Descargar archivo PDF"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-hidden relative flex flex-col items-center justify-center">
          {pdfDataUri ? (
            <iframe
              src={pdfDataUri}
              className="w-full h-full rounded-2xl border border-slate-800 bg-white"
              title={fileName}
            />
          ) : (
            <div className="text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <FileText className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white">Generando archivo PDF en memoria...</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                El documento está siendo compilado y procesado para su almacenamiento en la plataforma.
              </p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-300 font-bold">{fileName}</span>
            <span>•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Seguro en Firestore Cloud
            </span>
          </div>
          <span className="font-mono text-slate-500 text-[10px]">Anacleto Pro PDF Vault</span>
        </div>
      </div>
    </div>
  );
}
