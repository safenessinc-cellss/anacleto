import React, { useRef, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { FileUp, FolderPlus, Globe, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { auth, db, storage } from "../../firebase";

type IntakeAsset = {
  id: string; name: string; kind: "image" | "pdf" | "reference" | "document";
  source: "device" | "browser" | "ai"; url: string; storagePath?: string;
  contentType?: string; size?: number; createdAt: string; createdBy: string;
};
type Props = { onCreated?: (projectId: string) => void };
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const safeName = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "arquivo";

export default function ProjectIntakePanel({ onCreated }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list);
    const invalid = next.find(file => file.size > MAX_FILE_SIZE);
    if (invalid) { setError(`"${invalid.name}" excede o limite de 20 MB.`); return; }
    setFiles(current => [...current, ...next].filter((file, index, all) =>
      all.findIndex(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index
    ));
    setError("");
  };

  const createProject = async () => {
    const user = auth.currentUser;
    if (!user) { setError("Faça login novamente para importar projetos."); return; }
    if (!name.trim() && !description.trim() && !files.length && !sourceUrl.trim()) {
      setError("Informe um nome, descrição, arquivo ou endereço de referência."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const now = new Date().toISOString();
    try {
      let imported: any = {};
      const jsonFile = files.find(file => file.name.toLowerCase().endsWith(".json") || file.type === "application/json");
      if (jsonFile) {
        const parsed = JSON.parse(await jsonFile.text());
        imported = parsed.project && typeof parsed.project === "object" ? parsed.project : parsed;
      }

      let aiData: any = {};
      if (description.trim()) {
        const token = await user.getIdToken();
        const response = await fetch("/api/ai/project-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: name.trim(), description: description.trim(), sourceUrl: sourceUrl.trim() })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || `A IA não conseguiu interpretar o projeto (${response.status}).`);
        aiData = data?.project || {};
      }

      const projectName = String(name.trim() || imported.name || aiData.name || files[0]?.name.replace(/\.[^.]+$/, "") || "Novo projeto").slice(0, 180);
      const assets: IntakeAsset[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) throw new Error(`O arquivo ${file.name} excede 20 MB.`);
        const allowed = file.type === "application/pdf" || file.type.startsWith("image/") ||
          file.type === "application/json" || file.type.startsWith("text/");
        if (!allowed) throw new Error(`Formato não suportado: ${file.name}. Use PDF, imagem, JSON ou texto.`);
        if (file.type === "application/json" || file.type.startsWith("text/")) {
          assets.push({
            id: crypto.randomUUID(), name: file.name, kind: "document", source: "device",
            url: "", contentType: file.type, size: file.size, createdAt: now, createdBy: user.uid
          });
          continue;
        }
        const id = crypto.randomUUID();
        const storagePath = `project-assets/${user.uid}/pending-${id}/${id}-${safeName(file.name)}`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, file, { contentType: file.type, customMetadata: { originalName: file.name, importType: "project-intake" } });
        assets.push({
          id, name: file.name, kind: file.type === "application/pdf" ? "pdf" : "image",
          source: "device", url: await getDownloadURL(fileRef), storagePath,
          contentType: file.type, size: file.size, createdAt: now, createdBy: user.uid
        });
      }

      if (sourceUrl.trim()) {
        const parsed = new URL(sourceUrl.trim());
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("O endereço de referência deve ser HTTP ou HTTPS.");
        assets.push({
          id: crypto.randomUUID(), name: parsed.hostname + parsed.pathname.slice(0, 80),
          kind: "reference", source: "browser", url: parsed.toString(), createdAt: now, createdBy: user.uid
        });
      }

      const project = {
        name: projectName,
        code: String(imported.code || aiData.code || "").slice(0, 80),
        category: String(imported.category || aiData.category || "Projeto"),
        status: String(imported.status || "Em análise"),
        client: String(client.trim() || imported.client || aiData.client || "").slice(0, 180),
        notes: String(description.trim() || imported.notes || aiData.summary || "").slice(0, 12000),
        width: Number(imported.width || aiData.width) || 0,
        height: Number(imported.height || aiData.height) || 0,
        quantity: Math.max(1, Number(imported.quantity || aiData.quantity) || 1),
        price: Math.max(0, Number(imported.price || aiData.price) || 0),
        assets, ownerUid: user.uid, importSource: sourceUrl.trim() ? "browser" : files.length ? "device" : "ai",
        importedAt: now, createdAt: now, updatedAt: now
      };
      const created = await addDoc(collection(db, "projects"), project);
      setFiles([]); setName(""); setClient(""); setDescription(""); setSourceUrl("");
      if (picker.current) picker.current.value = "";
      setNotice(`Projeto "${projectName}" criado com ${assets.length} anexo(s)/referência(s).`);
      onCreated?.(created.id);
    } catch (e) {
      console.error("Project intake failed:", e);
      setError(e instanceof Error ? e.message : "Não foi possível importar o projeto.");
    } finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 space-y-4">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-white p-3 text-blue-700"><FolderPlus className="h-5 w-5"/></div>
      <div><h2 className="font-bold text-slate-900">Importar ou criar projeto</h2><p className="text-sm text-slate-600">Um único fluxo para computador, celular, navegador e IA. Os anexos ficam associados ao novo projeto.</p></div>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do projeto" className="w-full rounded-xl border bg-white p-3"/>
      <input value={client} onChange={e=>setClient(e.target.value)} placeholder="Cliente (opcional)" className="w-full rounded-xl border bg-white p-3"/>
    </div>
    <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Descreva o projeto ou peça à IA para organizar as informações..." className="w-full rounded-xl border bg-white p-3"/>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border bg-white p-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><UploadCloud className="h-4 w-4 text-blue-600"/> Arquivos do PC ou celular</p>
        <input ref={picker} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.json,.txt,.csv,application/pdf,application/json,text/plain,text/csv,image/*" capture="environment" onChange={e=>selectFiles(e.target.files)} className="block w-full text-xs"/>
        <p className="text-xs text-slate-500">PDF, imagens/câmera, JSON e texto • até 20 MB por arquivo</p>
        {files.map((file,index)=><div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{file.name}</span><button type="button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))} aria-label="Remover arquivo"><X className="h-3.5 w-3.5"/></button></div>)}
      </div>
      <div className="rounded-xl border bg-white p-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Globe className="h-4 w-4 text-blue-600"/> Projeto ou referência do navegador</p>
        <input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://site.com/projeto" className="w-full rounded-lg border p-2 text-sm"/>
        <p className="text-xs text-slate-500">Guarda o endereço como referência do projeto. Para importar conteúdo protegido, descarregue o ficheiro e anexe-o acima.</p>
        <p className="flex items-center gap-2 text-xs text-slate-500"><Sparkles className="h-4 w-4 text-violet-600"/> A IA estrutura o projeto a partir da descrição fornecida.</p>
      </div>
    </div>
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="text-sm font-medium text-emerald-700">{notice}</p>}
    <button type="button" disabled={busy} onClick={createProject} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
      {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<FileUp className="h-4 w-4"/>}{busy?"Importando e salvando...":"Criar projeto e importar conteúdo"}
    </button>
  </section>;
}
