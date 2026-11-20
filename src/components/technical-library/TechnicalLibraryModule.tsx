import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc
} from "firebase/firestore";
import { auth, db, storage } from "../../firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  BookOpen, FileText, Plus, Search, Layers, Ruler, Wrench, ExternalLink, Upload,
  CheckCircle2, Clock3, AlertTriangle, Trash2, X, Save, ShieldCheck
} from "lucide-react";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Section = "documents" | "profiles" | "rules" | "hardware" | "prices";
type ReviewStatus = "pending_review" | "verified" | "rejected";
type Row = { id: string; [key: string]: any };

const OFFICIAL_SOURCES = [
  {
    manufacturer: "Alusul",
    country: "Brasil · Porto Alegre/RS",
    url: "https://www.alusul.ind.br/",
    lines: "Perfis de alumínio e acessórios",
    note: "Portal oficial com Catálogo Acessórios, Catálogo Completo e Catálogo Perfis. Os PDFs são abertos no portal do fornecedor.",
    catalogs: [
      { title: "Catálogo de Perfis", line: "Perfis", url: "https://www.alusul.ind.br/" },
      { title: "Catálogo Completo", line: "Geral", url: "https://www.alusul.ind.br/" },
      { title: "Catálogo de Acessórios", line: "Acessórios", url: "https://www.alusul.ind.br/" }
    ]
  },
  {
    manufacturer: "Alusupra",
    country: "Brasil · Santa Catarina · distribuição Sul",
    url: "https://www.alusupra.com.br/catalogos",
    lines: "Perfis estruturais, linhas de esquadrias, vidro temperado, acessórios, portões, brises, solar e decorativos",
    note: "Portal oficial de catálogos de perfis e acessórios; o catálogo técnico de perfis PDF também está publicado.",
    catalogs: [
      { title: "Catálogos oficiais", line: "Geral", url: "https://www.alusupra.com.br/catalogos" },
      { title: "Catálogo de Perfis PDF", line: "Perfis · edição publicada em 2023", url: "https://www.alusupra.com.br/pdf/cat%C3%A1logo-perfil.pdf" },
      { title: "Perfis para Vidro Temperado", line: "Vidro Temperado", url: "https://www.alusupra.com.br/perfis-aluminio-vidro" }
    ]
  },
  {
    manufacturer: "Aluita",
    country: "Brasil · Rio Grande do Sul",
    url: "https://www.aluita.com.br/perfisaluminio",
    lines: "Catálogo Geral, Linha 25/30, Mega 25, Mega 32, Vidro Temperado e Módulo Prático",
    note: "Portal oficial de perfis e sistemas, com páginas específicas por linha.",
    catalogs: [
      { title: "Catálogo Geral de Perfis", line: "Geral", url: "https://www.aluita.com.br/perfisaluminio" },
      { title: "Catálogo de Perfis PDF 2019/2020", line: "Geral · edição 2019/2020", url: "https://www.aluita.com.br/_files/ugd/944141_83c94e1a3d1b403596ccabca6879df08.pdf" },
      { title: "Produtos e consulta de preços", line: "Consulta comercial", url: "https://www.catalogoaluita.com.br/perfil" },
      { title: "Linha 25/30", line: "25/30", url: "https://www.aluita.com.br/linhamega2530" },
      { title: "Linha Mega 25", line: "Mega 25", url: "https://www.aluita.com.br/linhamega25" },
      { title: "Linha Mega 32", line: "Mega 32", url: "https://www.aluita.com.br/linhamega32" },
      { title: "Perfis para Vidro Temperado", line: "Vidro Temperado", url: "https://www.aluita.com.br/perfisvidrotemperado" },
      { title: "Módulo Prático", line: "Módulo Prático", url: "https://www.aluita.com.br/m%C3%B3dulopratico" }
    ]
  },
  {
    manufacturer: "Perfil Sul",
    country: "Brasil · Santa Catarina",
    url: "https://www.perfilsulaluminio.com.br/catalogo",
    lines: "Linha 25, Box Temperado, Módulo Prático II, Linha Ouro, Integrada e demais famílias do catálogo online",
    note: "Catálogo online pesquisável, catálogo completo e PDF de perfis novos.",
    catalogs: [
      { title: "Catálogo Online", line: "Geral", url: "https://www.perfilsulaluminio.com.br/catalogo" },
      { title: "Catálogo Completo PDF", line: "Geral", url: "https://www.perfilsulaluminio.com.br/arquivos/catalogo/2022/Catalogo_Perfil_Sul_2022.pdf" },
      { title: "Perfis Novos 2024 PDF", line: "Novos 2024", url: "https://www.perfilsulaluminio.com.br/arquivos/catalogo/2022/Catalogo_Perfis_Sul_Novos_2024.pdf" },
      { title: "Linha 25", line: "Linha 25", url: "https://www.perfilsulaluminio.com.br/perfil/pesquisa/linha_25" },
      { title: "Box Temperado", line: "Box Temperado", url: "https://www.perfilsulaluminio.com.br/perfil/pesquisa/box_temperado" }
    ]
  },
  {
    manufacturer: "Perfil Alumínio",
    country: "Brasil",
    url: "https://cliente.perfilaluminio.com.br/material-tecnico/catalogos-tecnicos/",
    lines: "Gradline, Wallframe, Erus, Vantor 90º, Unnion, Ecoline 2.5, Chroma, Ecostick, Fachadas e outras linhas",
    note: "Portal técnico oficial com catálogos, materiais técnicos, laudos e arquivos BIM.",
    catalogs: [
      { title: "Catálogos Técnicos", line: "Geral", url: "https://cliente.perfilaluminio.com.br/material-tecnico/catalogos-tecnicos/" },
      { title: "Catálogo de Perfis", line: "Perfis", url: "https://cliente.perfilaluminio.com.br/catalogo/" },
      { title: "Material Técnico", line: "Documentação", url: "https://cliente.perfilaluminio.com.br/material-tecnico/" }
    ]
  },
  {
    manufacturer: "Alumiconte",
    country: "Brasil · Rio Grande do Sul",
    url: "https://www.alumiconte.com.br/catalogos/",
    lines: "Construção civil, componentes para esquadrias, fachadas, moveleiro, persianas e sistemas Nostra, Montrak, Aurum e outros",
    note: "Portal oficial de downloads com catálogos, folders por sistema e materiais técnicos.",
    catalogs: [
      { title: "Catálogos oficiais", line: "Geral", url: "https://www.alumiconte.com.br/catalogos/" },
      { title: "Catálogo Geral da Construção Civil · REV25", line: "Construção Civil", url: "https://www.alumiconte.com.br/wp-content/uploads/2026/10/Catalogo-Construcao-Civil_REV25_WEB_.pdf" },
      { title: "Catálogo Técnico de Componentes · REV26", line: "Componentes", url: "https://www.alumiconte.com.br/wp-content/uploads/2026/10/CATALOGO-TECNICO_COMPONENTES-REV-26_WEB-2.pdf" },
      { title: "Catálogo de Componentes para Esquadrias", line: "Esquadrias", url: "https://www.alumiconte.com.br/catalogos/" },
      { title: "Folders por Sistema", line: "Sistemas", url: "https://www.alumiconte.com.br/catalogos/" }
    ]
  },
  {
    manufacturer: "Esquadrimax",
    country: "Brasil · Santa Catarina · atendimento Sul",
    url: "https://www.esquadrimaxsc.com.br/",
    lines: "Linha 16, Linha 20, Módulo Prático, Slim 20, Infinity Class, Versatic 25, Deluxe 32, Box Temperado, fachadas, brises e portões",
    note: "Catálogo Construção Civil, edição setembro de 2026, hospedado no visualizador FlipHTML5.",
    catalogs: [
      { title: "Catálogo Construção Civil · Set/2026", line: "Geral", url: "https://fliphtml5.com/sacgm/mnnz/" },
      { title: "Catálogo · Perfis tabelados", line: "Tabelados", url: "https://fliphtml5.com/sacgm/mnnz/7/" },
      { title: "Catálogo · Box Temperado", line: "Box Temperado", url: "https://fliphtml5.com/sacgm/mnnz/197/" },
      { title: "Catálogo · Temperados 8 mm", line: "Temperados 8 mm", url: "https://fliphtml5.com/sacgm/mnnz/200/" },
      { title: "Catálogo · Temperados 10 mm", line: "Temperados 10 mm", url: "https://fliphtml5.com/sacgm/mnnz/205/" }
    ]
  }
];

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending_review: "Pendente de validação",
  verified: "Verificado",
  rejected: "Rejeitado"
};

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200"
};

function Status({ value }: { value?: ReviewStatus }) {
  const status = value || "pending_review";
  const Icon = status === "verified" ? CheckCircle2 : status === "rejected" ? AlertTriangle : Clock3;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}><Icon size={13}/>{STATUS_LABEL[status]}</span>;
}

export default function TechnicalLibraryModule() {
  const [section, setSection] = useState<Section>("documents");
  const [documents, setDocuments] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [rules, setRules] = useState<Row[]>([]);
  const [hardware, setHardware] = useState<Row[]>([]);
  const [prices, setPrices] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);
  const [importManufacturer, setImportManufacturer] = useState("");
  const [importLine, setImportLine] = useState("");
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const subscriptions = [
      onSnapshot(query(collection(db, "technical_documents"), orderBy("createdAt", "desc")), s => setDocuments(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "aluminum_profiles"), orderBy("createdAt", "desc")), s => setProfiles(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "cutting_rules"), orderBy("createdAt", "desc")), s => setRules(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "hardware_catalog"), orderBy("createdAt", "desc")), s => setHardware(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "supplier_prices"), orderBy("priceDate", "desc")), s => setPrices(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message))
    ];
    return () => subscriptions.forEach(unsub => unsub());
  }, []);

  const config = {
    documents: { title: "Documentos técnicos", subtitle: "Catálogos, mapas de perfis, manuais e boletins oficiais.", collection: "technical_documents", rows: documents, fields: [["manufacturer", "Fabricante"], ["line", "Linha / sistema"], ["title", "Nome do documento"], ["version", "Versão / data"], ["sourceUrl", "URL oficial"], ["pageCount", "Quantidade de páginas"]] },
    profiles: { title: "Perfis de alumínio", subtitle: "Código, peso linear e referência documental de cada perfil.", collection: "aluminum_profiles", rows: profiles, fields: [["manufacturer", "Fabricante"], ["line", "Linha / sistema"], ["code", "Código do perfil"], ["description", "Descrição"], ["weightKgM", "Peso linear (kg/m)"], ["commercialLengthMm", "Comprimento comercial (mm)"], ["documentId", "ID do documento / referência"], ["page", "Página de origem"]] },
    rules: { title: "Regras de corte", subtitle: "Fórmulas específicas por sistema, tipologia e configuração.", collection: "cutting_rules", rows: rules, fields: [["manufacturer", "Fabricante"], ["line", "Linha / sistema"], ["typology", "Tipologia"], ["configuration", "Configuração"], ["profileCode", "Código do perfil"], ["formula", "Fórmula / expressão"], ["unit", "Unidade"], ["documentId", "Documento de origem"], ["page", "Página de origem"]] },
    hardware: { title: "Acessórios e ferragens", subtitle: "Componentes vinculados ao fabricante e à linha compatível.", collection: "hardware_catalog", rows: hardware, fields: [["manufacturer", "Fabricante"], ["line", "Linha compatível"], ["code", "Código"], ["description", "Descrição"], ["unit", "Unidade"], ["documentId", "Documento de origem"], ["page", "Página de origem"]] },
    prices: { title: "Preços de fornecedores", subtitle: "Histórico de preços cotados, com validade, unidade e fonte. Cada cotação gera um registro independente.", collection: "supplier_prices", rows: prices, fields: [["manufacturer", "Fornecedor"], ["line", "Linha / sistema"], ["code", "Código do item"], ["description", "Descrição"], ["unit", "Unidade (barra, kg, peça...)"], ["unitPrice", "Preço unitário (R$)"], ["priceDate", "Data da cotação (AAAA-MM-DD)"], ["validUntil", "Validade até (AAAA-MM-DD)"], ["sourceUrl", "Fonte / link da cotação"], ["quoteReference", "Nº da cotação / observação"]] }
  } as const;

  const current = config[section];
  const filtered = useMemo(() => current.rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [current.rows, search]);

  const openNew = () => {
    setForm({});
    setError("");
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        ...form,
        status: "pending_review" as ReviewStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        sourceCountry: "Brasil"
      };
      if (section === "profiles" && form.weightKgM) payload.weightKgM = Number(form.weightKgM.replace(",", "."));
      if (section === "profiles" && form.commercialLengthMm) payload.commercialLengthMm = Number(form.commercialLengthMm);
      if (section === "documents" && form.pageCount) payload.pageCount = Number(form.pageCount);
      if (section === "prices") {
        const unitPrice = Number((form.unitPrice || "").replace(",", "."));
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("Informe um preço unitário maior que zero.");
        if (!form.priceDate) throw new Error("Informe a data da cotação.");
        payload.unitPrice = unitPrice;
        payload.currency = "BRL";
        payload.priceDate = form.priceDate;
        payload.validUntil = form.validUntil || null;
        payload.priceStatus = "pending_review";
        payload.status = "pending_review";
      }
      if (form.page) payload.page = Number(form.page);
      await addDoc(collection(db, current.collection), payload);
      setShowForm(false);
      setForm({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const importTechnicalPdf = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Envie um arquivo PDF de catálogo técnico.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("O PDF deve ter no máximo 25 MB.");
      return;
    }
    const user = auth.currentUser;
    if (!user) { setError("Entre novamente para importar o catálogo."); return; }
    if (!importManufacturer.trim() || !importLine.trim()) { setError("Informe o fabricante e a linha antes de importar o PDF."); return; }
    setImportingPdf(true);
    setError("");
    try {
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `technical-catalogs/${user.uid}/${Date.now()}-${safeName}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: "application/pdf" });
      const downloadUrl = await getDownloadURL(fileRef);
      const pdfTask = getDocument({ data: await file.arrayBuffer() });
      const pdf = await pdfTask.promise;
      const candidates: Array<{ code: string; weightKgM: number; page: number; excerpt: string }> = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const lineMap = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of content.items as any[]) {
          if (!item.str || !item.str.trim() || !Array.isArray(item.transform)) continue;
          const y = Math.round(Number(item.transform[5]) / 2) * 2;
          const line = lineMap.get(y) || [];
          line.push({ x: Number(item.transform[4]) || 0, text: item.str.trim() });
          lineMap.set(y, line);
        }
        const lines = [...lineMap.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.sort((a, b) => a.x - b.x).map(p => p.text).join(" "));
        for (const line of lines) {
          const weightMatch = line.match(/(\d{1,2}[,.]\d{2,4})\s*(?:kg\s*\/\s*m|kg\/m|kg\s*por\s*metro)/i);
          const codeMatch = line.match(/\b([A-Z]{1,5}[-.]?\d{3,6}[A-Z0-9-]*)\b/i);
          if (!weightMatch || !codeMatch) continue;
          const weight = Number(weightMatch[1].replace(",", "."));
          if (!Number.isFinite(weight) || weight <= 0 || weight > 100) continue;
          candidates.push({ code: codeMatch[1].toUpperCase(), weightKgM: weight, page: pageNumber, excerpt: line.slice(0, 280) });
        }
      }
      await pdfTask.destroy();
      const docRef = await addDoc(collection(db, "technical_documents"), {
        manufacturer: importManufacturer.trim(), line: importLine.trim(), title: file.name, version: "", sourceUrl: downloadUrl,
        storagePath: path, originalFileName: file.name, mimeType: "application/pdf",
        fileSize: file.size, pageCount: pdf.numPages, status: "pending_review",
        extractionMethod: "pdf_text_layer_regex", extractedProfileCount: candidates.length,
        createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      if (candidates.length) {
        for (const candidate of candidates) {
          await addDoc(collection(db, "aluminum_profiles"), {
            manufacturer: importManufacturer.trim(), line: importLine.trim(), code: candidate.code, description: candidate.excerpt,
            weightKgM: candidate.weightKgM, documentId: docRef.id, page: candidate.page,
            sourceUrl: downloadUrl, status: "pending_review", extractionMethod: "pdf_text_layer_regex",
            createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          });
        }
      }
      await addDoc(collection(db, "catalog_import_jobs"), {
        documentId: docRef.id, fileName: file.name, pageCount: pdf.numPages,
        extractedProfileCount: candidates.length, status: "pending_review",
        extractionMethod: "pdf_text_layer_regex", createdBy: user.uid, createdAt: serverTimestamp()
      });
      setSection("profiles");
      setNotice(candidates.length ? `${candidates.length} candidato(s) extraído(s), aguardando validação.` : "PDF salvo; a extração automática não encontrou dados em texto.");
      window.alert(candidates.length
        ? `PDF importado. ${candidates.length} candidato(s) de perfil e peso extraídos. Todos permanecem pendentes de validação.`
        : "PDF armazenado. Não foram encontrados pares código + kg/m na camada de texto. Se o catálogo for digitalizado como imagem, será necessária a etapa OCR.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar o PDF técnico.");
    } finally {
      setImportingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const registerAllOfficialCatalogs = async () => {
    setError("");
    setNotice("");
    try {
      let added = 0;
      let skipped = 0;
      for (const source of OFFICIAL_SOURCES) {
        for (const catalog of source.catalogs) {
          const exists = documents.some(row => row.sourceUrl === catalog.url && row.manufacturer === source.manufacturer);
          if (exists) { skipped++; continue; }
          await addDoc(collection(db, "technical_documents"), {
            manufacturer: source.manufacturer,
            line: catalog.line,
            title: catalog.title,
            version: source.manufacturer === "Esquadrimax" ? "Edição setembro/2026" : "",
            sourceUrl: catalog.url,
            sourcePortal: source.url,
            sourceCountry: "Brasil",
            status: "pending_review",
            extractionMethod: "official_catalog_link",
            createdBy: auth.currentUser?.uid || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          added++;
        }
      }
      setSection("documents");
      setNotice(`Registro concluído: ${added} fontes adicionadas e ${skipped} já existentes ignoradas. Os PDFs e catálogos externos permanecem vinculados à fonte oficial; importe os arquivos para extração estruturada quando disponíveis.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar os catálogos oficiais.");
    }
  };

  const registerOfficialCatalog = async (source: typeof OFFICIAL_SOURCES[number], catalog: typeof OFFICIAL_SOURCES[number]["catalogs"][number]) => {
    setError("");
    setNotice("");
    try {
      const existing = documents.find(row => row.sourceUrl === catalog.url && row.manufacturer === source.manufacturer);
      if (existing) {
        setNotice(`A fonte ${catalog.title} já está registrada na Biblioteca Técnica.`);
        setSection("documents");
        return;
      }
      await addDoc(collection(db, "technical_documents"), {
        manufacturer: source.manufacturer,
        line: catalog.line,
        title: catalog.title,
        version: source.manufacturer === "Esquadrimax" ? "Edição setembro/2026" : "",
        sourceUrl: catalog.url,
        sourcePortal: source.url,
        sourceCountry: "Brasil",
        status: "pending_review",
        extractionMethod: "official_catalog_link",
        createdBy: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSection("documents");
      setNotice(`Fonte registrada: ${source.manufacturer} · ${catalog.title}. Importe o PDF quando disponível para extrair os dados técnicos.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar a fonte oficial.");
    }
  };

  const changeStatus = async (row: Row, status: ReviewStatus) => {
    try {
      await updateDoc(doc(db, current.collection, row.id), { status, updatedAt: serverTimestamp(), reviewedAt: status === "verified" ? serverTimestamp() : null });
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar a validação."); }
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Excluir este registro técnico? Esta ação não pode ser desfeita.")) return;
    try { await deleteDoc(doc(db, current.collection, row.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir o registro."); }
  };

  const tabs: { id: Section; label: string; icon: React.ElementType; count: number }[] = [
    { id: "documents", label: "Documentos", icon: FileText, count: documents.length },
    { id: "profiles", label: "Perfis", icon: Layers, count: profiles.length },
    { id: "rules", label: "Regras de corte", icon: Ruler, count: rules.length },
    { id: "hardware", label: "Acessórios", icon: Wrench, count: hardware.length },
    { id: "prices", label: "Preços", icon: FileText, count: prices.length }
  ];

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-blue-700"><BookOpen size={19}/><span className="text-xs font-bold uppercase tracking-wider">Engenharia de esquadrias</span></div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Biblioteca Técnica</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Base técnica rastreável para alimentar despiece, consumo de alumínio, ferragens e orçamentos.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2"><button onClick={registerAllOfficialCatalogs} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"><BookOpen size={16}/>Registrar todos os catálogos</button><input value={importManufacturer} onChange={e => setImportManufacturer(e.target.value)} placeholder="Fabricante" aria-label="Fabricante do catálogo" className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/><input value={importLine} onChange={e => setImportLine(e.target.value)} placeholder="Linha / sistema" aria-label="Linha do catálogo" className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/><input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => importTechnicalPdf(e.target.files?.[0])}/><button onClick={() => pdfInputRef.current?.click()} disabled={importingPdf} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Upload size={16}/>{importingPdf ? "Importando PDF..." : "Importar catálogo PDF"}</button><button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={17}/>Novo registro</button></div>
    </header>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {OFFICIAL_SOURCES.map(source => <article key={source.manufacturer} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fonte oficial · {source.country}</p><h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{source.manufacturer}</h3></div><ShieldCheck className="shrink-0 text-blue-600" size={20}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{source.note}</p>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><b>Linhas:</b> {source.lines}</p>
        <div className="mt-3 flex flex-1 flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {source.catalogs.map(catalog => <div key={catalog.title} className="flex items-center justify-between gap-2">
            <a href={catalog.url} target="_blank" rel="noreferrer" className="min-w-0 text-xs font-semibold text-blue-700 hover:underline">{catalog.title} <ExternalLink className="inline" size={11}/></a>
            <button onClick={() => registerOfficialCatalog(source, catalog)} className="shrink-0 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">Registrar</button>
          </div>)}
        </div>
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 text-xs font-semibold text-slate-500 hover:underline">Portal do fornecedor</a>
      </article>)}
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => { setSection(tab.id); setSearch(""); setError(""); }} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${section === tab.id ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><Icon size={16}/>{tab.label}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">{tab.count}</span></button>; })}
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-bold text-slate-900 dark:text-white">{current.title}</h2><p className="text-xs text-slate-500">{current.subtitle}</p></div>
        <label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, linha ou fabricante..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/></label>
      </div>
      {notice && <div className="mx-4 mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</div>}{error && <div className="mx-4 mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {filtered.length === 0 ? <div className="px-6 py-14 text-center"><BookOpen className="mx-auto text-slate-300" size={34}/><p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">Nenhum registro nesta seção</p><p className="mt-1 text-sm text-slate-500">Cadastre os dados extraídos de um documento oficial. Eles começarão como pendentes de validação.</p></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Identificação</th><th className="px-4 py-3">Sistema / detalhe</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Validação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map(row => <tr key={row.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/40"><td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{row.code || row.title || row.typology || row.manufacturer || "Registro técnico"}</p><p className="mt-1 text-xs text-slate-500">{row.manufacturer || "Fabricante não informado"} · {row.line || "Linha não informada"}</p></td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{section === "prices" ? <>{row.description || row.code || "Item cotado"}<p className="mt-1 font-semibold text-blue-700">{row.unitPrice != null ? `${Number(row.unitPrice).toLocaleString("pt-BR", { style: "currency", currency: row.currency || "BRL" })} / ${row.unit || "unidade"}` : "Preço não informado"}</p><p className="mt-1 text-xs">Cotação: {row.priceDate || "sem data"} · Validade: {row.validUntil || "não informada"}</p></> : section === "profiles" ? <>{row.description || "Perfil"}<p className="mt-1 font-semibold">{row.weightKgM != null ? `${row.weightKgM} kg/m` : row.weightKgBar != null ? `${row.weightKgBar} kg/barra` : "Peso não informado"}</p></> : section === "rules" ? <>{row.configuration || "Configuração não informada"}<p className="mt-1 max-w-sm truncate font-mono text-xs">{row.formula}</p></> : section === "hardware" ? row.description || row.code : <>{row.title}<p className="mt-1 text-xs">{row.version || "Versão não informada"}</p></>}</td><td className="px-4 py-3 text-xs text-slate-500">{row.documentId ? `Doc. ${row.documentId}` : row.sourceUrl ? <a className="text-blue-700 hover:underline" href={row.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte</a> : "Fonte não vinculada"}{row.page ? <p>Página {row.page}</p> : null}</td><td className="px-4 py-3"><Status value={row.status}/></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button title="Marcar como verificado" onClick={() => changeStatus(row, "verified")} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><CheckCircle2 size={16}/></button><button title="Rejeitar" onClick={() => changeStatus(row, "rejected")} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><AlertTriangle size={16}/></button><button title="Excluir" onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>}
    </section>

    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><div><b>Controle de qualidade dos dados</b><p className="mt-1 text-xs leading-5">Registros pendentes ou rejeitados não devem alimentar o cálculo automático. A validação precisa conferir o código, a unidade, o peso, a fórmula e a página do catálogo original. A Biblioteca não executa expressões de fórmula como código.</p></div></div>

    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Novo registro técnico">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Novo registro · {current.title}</h3><p className="text-xs text-slate-500">O registro será salvo como pendente de validação.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
        <div className="grid gap-3 sm:grid-cols-2">{current.fields.map(([key, label]) => <label key={key} className={key === "formula" || key === "sourceUrl" || key === "description" ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>{key === "formula" || key === "description" ? <textarea required={["formula"].includes(key)} value={form[key] || ""} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/> : <input required={["manufacturer","line","code","title","sourceUrl","typology","profileCode","unit","unitPrice","priceDate"].includes(key)} type={key === "sourceUrl" ? "url" : key === "unitPrice" ? "number" : key === "priceDate" || key === "validUntil" ? "date" : "text"} value={form[key] || ""} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} step={key === "unitPrice" ? "0.01" : undefined} min={key === "unitPrice" ? "0.01" : undefined} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/>}</label>)}</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>{saving ? "Salvando..." : "Salvar pendente"}</button></div>
      </form>
    </div>}
  </div>;
}
