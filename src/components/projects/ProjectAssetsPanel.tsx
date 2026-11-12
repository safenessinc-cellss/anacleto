import React, { useEffect, useState } from "react";
import { arrayRemove, arrayUnion, collection, onSnapshot, query, where, updateDoc, doc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ExternalLink, FileText, ImagePlus, Link2, Trash2, UploadCloud } from "lucide-react";
import { auth, db, storage } from "../../firebase";
import { TechnicalDrawing } from "../../types";
import { sanitizeFirestoreData } from "../../utils/firestorePayloads";

type ProjectAsset = {
  id: string;
  name: string;
  kind: "image" | "pdf" | "reference";
  source: "device" | "internet" | "ai";
  url: string;
  storagePath?: string;
  contentType?: string;
  size?: number;
  createdAt: string;
  createdBy: string;
};

type Props = { projectId: string; projectName: string; assets?: ProjectAsset[] };

const safeName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "arquivo";

export default function ProjectAssetsPanel({ projectId, projectName, assets = [] }: Props) {
  const [items, setItems] = useState<ProjectAsset[]>(assets);
  const [file, setFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState("");
  const [source, setSource] = useState<"internet" | "ai">("internet");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawings, setDrawings] = useState<TechnicalDrawing[]>([]);

  useEffect(() => setItems(assets), [assets]);
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "technical_drawings"), where("projectId", "==", projectId));
    return onSnapshot(q, snap => setDrawings(snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalDrawing)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))), err => {
      console.warn("Project drawings load:", err);
    });
  }, [projectId]);

  const persistAsset = async (asset: ProjectAsset) => {
    await updateDoc(doc(db, "projects", projectId), sanitizeFirestoreData({ assets: arrayUnion(sanitizeFirestoreData(asset)), updatedAt: new Date().toISOString() }));
    setItems(current => current.some(item => item.id === asset.id) ? current : [asset, ...current]);
  };

  const upload = async () => {
    const user = auth.currentUser;
    if (!user) { setError("Entre novamente para anexar arquivos."); return; }
    if (!file) { setError("Selecione uma imagem ou PDF."); return; }
    const isPdf = file.type === "application/pdf";
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!isPdf && !isImage) { setError("Formatos permitidos: PDF, JPG, PNG e WEBP."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("O arquivo deve ter no máximo 20 MB."); return; }
    setBusy(true); setError("");
    const id = crypto.randomUUID();
    const storagePath = `project-assets/${user.uid}/${projectId}/${id}-${safeName(file.name)}`;
    try {
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file, { contentType: file.type, customMetadata: { projectId, projectName } });
      const url = await getDownloadURL(fileRef);
      const asset: ProjectAsset = {
        id, name: assetName.trim() || file.name, kind: isPdf ? "pdf" : "image", source: "device",
        url, storagePath, contentType: file.type, size: file.size,
        createdAt: new Date().toISOString(), createdBy: user.uid
      };
      await persistAsset(asset);
      setFile(null); setAssetName("");
    } catch (e) {
      console.error("Project asset upload:", e);
      setError(e instanceof Error ? e.message : "Não foi possível salvar o arquivo.");
    } finally { setBusy(false); }
  };

  const addReference = async () => {
    const user = auth.currentUser;
    if (!user) { setError("Entre novamente para salvar referências."); return; }
    let parsed: URL;
    try { parsed = new URL(imageUrl.trim()); } catch { setError("Informe uma URL válida de imagem."); return; }
    if (parsed.protocol !== "https:") { setError("A URL deve usar HTTPS."); return; }
    if (!parsed.hostname) { setError("Informe um endereço de imagem válido."); return; }
    setBusy(true); setError("");
    try {
      await persistAsset({
        id: crypto.randomUUID(), name: assetName.trim() || (source === "ai" ? "Imagem gerada por IA" : "Imagem de referência"),
        kind: "reference", source, url: parsed.toString(),
        createdAt: new Date().toISOString(), createdBy: user.uid
      });
      setImageUrl(""); setAssetName("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a referência."); }
    finally { setBusy(false); }
  };

  const removeAsset = async (asset: ProjectAsset) => {
    if (!confirm(`Remover "${asset.name}" deste projeto?`)) return;
    setBusy(true); setError("");
    try {
      if (asset.storagePath) await deleteObject(ref(storage, asset.storagePath));
      await updateDoc(doc(db, "projects", projectId), sanitizeFirestoreData({ assets: arrayRemove(sanitizeFirestoreData(asset)), updatedAt: new Date().toISOString() }));
      setItems(current => current.filter(item => item.id !== asset.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover o arquivo."); }
    finally { setBusy(false); }
  };

  return <section className="mt-4 space-y-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
    <div><h4 className="font-bold text-slate-900">Arquivos, referências e desenhos</h4><p className="text-xs text-slate-500">Tudo fica vinculado ao projeto “{projectName}”.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 rounded-xl border bg-white p-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><UploadCloud className="h-4 w-4 text-blue-600"/> Enviar do dispositivo</p>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full text-xs"/>
        <input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nome do arquivo (opcional)" className="w-full rounded-lg border p-2 text-sm"/>
        <button disabled={busy||!file} onClick={upload} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Enviando...":"Anexar imagem ou PDF"}</button>
      </div>
      <div className="space-y-2 rounded-xl border bg-white p-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-blue-600"/> Imagem da Internet ou de IA</p>
        <select value={source} onChange={e=>setSource(e.target.value as "internet"|"ai")} className="w-full rounded-lg border p-2 text-sm"><option value="internet">Referência da Internet</option><option value="ai">Imagem gerada por IA</option></select>
        <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://... link direto da imagem" className="w-full rounded-lg border p-2 text-sm"/>
        <input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nome / modelo da imagem" className="w-full rounded-lg border p-2 text-sm"/>
        <button disabled={busy||!imageUrl.trim()} onClick={addReference} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Guardar referência</button>
      </div>
    </div>
    {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
    <div className="space-y-2">
      <h5 className="text-sm font-bold text-slate-800">Arquivos do projeto ({items.length})</h5>
      {items.map(item=><article key={item.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
        {item.kind==="pdf"?<FileText className="h-7 w-7 shrink-0 text-rose-600"/>:<ImagePlus className="h-7 w-7 shrink-0 text-blue-600"/>}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{item.source==="ai"?"Imagem IA":item.source==="internet"?"Internet":"Dispositivo"} • {new Date(item.createdAt).toLocaleString()}</p></div>{item.kind!=="pdf"&&<img src={item.url} alt={item.name} loading="lazy" className="h-12 w-16 rounded-md border object-cover"/>}
        <a href={item.url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-blue-600" aria-label="Abrir arquivo"><ExternalLink className="h-4 w-4"/></a>
        <button disabled={busy} onClick={()=>removeAsset(item)} className="rounded-lg p-2 text-rose-500" aria-label="Remover arquivo"><Trash2 className="h-4 w-4"/></button>
      </article>)}
      {!items.length&&<p className="text-sm text-slate-400">Ainda não há anexos neste projeto.</p>}
    </div>
    <div className="space-y-2">
      <h5 className="text-sm font-bold text-slate-800">Modelos e desenhos técnicos associados ({drawings.length})</h5>
      {drawings.map(item=><article key={item.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
        <FileText className="h-7 w-7 shrink-0 text-indigo-600"/>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{item.category} • {item.overallDimensions?.width} × {item.overallDimensions?.height} {item.unit} • {new Date(item.createdAt).toLocaleDateString()}</p></div>
        {item.pdfDataUri&&<a href={item.pdfDataUri} download={item.pdfFileName||`${item.title}.pdf`} className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-700">PDF</a>}
      </article>)}
      {!drawings.length&&<p className="text-sm text-slate-400">Os desenhos gerados e associados ao projeto aparecerão aqui.</p>}
    </div>
  </section>;
}
