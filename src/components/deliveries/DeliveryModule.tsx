import React, { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Camera, CameraOff, CheckCircle2, ClipboardCheck, FileText, MapPin, PenLine, Plus, RefreshCw, Trash2, Truck, X } from "lucide-react";
import { auth, db, storage } from "../../firebase";
import type { Invoice, Quote } from "../../types";

type Photo = { blob: Blob; preview: string; capturedAt: string };
type Delivery = {
  id: string; number: string; quoteId: string; quoteNumber: string; invoiceId?: string; invoiceNumber?: string;
  clientName: string; clientAddress: string; operatorName: string; status: string; photos: { url: string; path: string; capturedAt: string }[];
  latitude: number; longitude: number; accuracy?: number; locationAt: string; signedBy: string; signatureUrl: string;
  signaturePath: string; createdAt: string; notes?: string;
};

const cameraError = (error: unknown) => error instanceof Error ? error.message : "Não foi possível acessar a câmera.";

export default function DeliveryModule() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [open, setOpen] = useState(false);
  const [quoteId, setQuoteId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signedBy, setSignedBy] = useState("");
  const [satisfied, setSatisfied] = useState(false);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy?: number; capturedAt: string } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraErrorText, setCameraErrorText] = useState("");
  const [errorText, setErrorText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "quotes"), orderBy("createdAt", "desc")), snap => setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote))), err => console.error("Orçamentos:", err)),
      onSnapshot(query(collection(db, "invoices"), orderBy("createdAt", "desc")), snap => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))), err => console.error("Faturas:", err)),
      onSnapshot(query(collection(db, "deliveries"), orderBy("createdAt", "desc")), snap => setDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Delivery))), err => console.error("Entregas:", err))
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  useEffect(() => {
    if (cameraBusy && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      void videoRef.current.play().catch(error => setCameraErrorText(cameraError(error)));
    }
  }, [cameraBusy]);
  useEffect(() => () => stopCamera(), []);

  const selectedQuote = quotes.find(q => q.id === quoteId);
  const linkedInvoices = invoices.filter(i => i.quoteId === quoteId || i.budgetId === quoteId);
  const selectedInvoice = invoices.find(i => i.id === invoiceId);
  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraBusy(false);
  };
  const startCamera = async () => {
    setCameraErrorText("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("A câmera exige um navegador atualizado e conexão HTTPS.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      cameraStreamRef.current = stream;
      setCameraBusy(true);
    } catch (error) { setCameraErrorText(cameraError(error)); }
  };
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraErrorText("A câmera ainda está iniciando. Tente novamente."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) { setCameraErrorText("Não foi possível capturar a fotografia."); return; }
    setPhotos(current => [...current, { blob, preview: URL.createObjectURL(blob), capturedAt: new Date().toISOString() }]);
  };
  const removePhoto = (index: number) => setPhotos(current => current.filter((photo, i) => {
    if (i === index) URL.revokeObjectURL(photo.preview);
    return i !== index;
  }));
  const captureLocation = () => {
    setErrorText("");
    if (!navigator.geolocation) { setErrorText("Este dispositivo não disponibiliza geolocalização."); return; }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date().toISOString() });
        setLocationBusy(false);
      },
      err => { setErrorText(err.code === 1 ? "Permita a localização nas configurações do navegador para registrar a entrega." : "Não foi possível obter o GPS. Verifique o sinal e tente novamente."); setLocationBusy(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const beginSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current; const p = point(event); const ctx = canvas?.getContext("2d");
    if (!canvas || !p || !ctx) return;
    drawingRef.current = true; canvas.setPointerCapture(event.pointerId);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#172033";
  };
  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = point(event); const ctx = signatureRef.current?.getContext("2d");
    if (p && ctx) { ctx.lineTo(p.x, p.y); ctx.stroke(); }
  };
  const endSignature = () => { drawingRef.current = false; };
  const clearSignature = () => { const canvas = signatureRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); };
  const hasSignature = () => {
    const canvas = signatureRef.current; if (!canvas) return false;
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    return !!pixels && pixels.some((value, index) => index % 4 === 3 && value > 0);
  };
  const resetForm = () => {
    stopCamera(); photos.forEach(p => URL.revokeObjectURL(p.preview)); setPhotos([]); setQuoteId(""); setInvoiceId(""); setSignedBy(""); setSatisfied(false); setNotes(""); setLocation(null); setOpen(false); setErrorText(""); setCameraErrorText(""); clearSignature();
  };
  const saveDelivery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedQuote) { setErrorText("Selecione um orçamento para vincular a entrega."); return; }
    if (!photos.length) { setErrorText("Registre pelo menos uma fotografia feita no local."); return; }
    if (!location) { setErrorText("Registre a localização GPS no local da entrega."); return; }
    if (!signedBy.trim() || !hasSignature()) { setErrorText("Informe o nome do cliente e recolha sua assinatura no quadro."); return; }
    if (!satisfied) { setErrorText("O cliente precisa confirmar expressamente que recebeu e está satisfeito com a entrega."); return; }
    const currentUser = auth.currentUser;
    if (!currentUser) { setErrorText("Sua sessão expirou. Entre novamente."); return; }
    setSaving(true); setErrorText("");
    try {
      const linkedOrders = await getDocs(query(collection(db, "production_orders"), where("quoteId", "==", selectedQuote.id)));
    const orderNotReady = linkedOrders.docs.find((orderDoc) => !["completed", "delivered"].includes(String(orderDoc.data().status || "")));
    if (orderNotReady) {
      setSaving(false);
      setErrorText("A ordem de produção precisa estar concluída antes de registrar a entrega.");
      return;
    }
      const deliveryRef = doc(collection(db, "deliveries"));
      const stamp = new Date().toISOString();
      stopCamera();
      const uploadedPhotos: Delivery["photos"] = [];
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        const path = `deliveries/${deliveryRef.id}/photo-${index + 1}.jpg`;
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, photo.blob, { contentType: "image/jpeg", customMetadata: { deliveryId: deliveryRef.id, quoteId: selectedQuote.id, capturedAt: photo.capturedAt, operatorUid: currentUser.uid } });
        uploadedPhotos.push({ url: await getDownloadURL(fileRef), path, capturedAt: photo.capturedAt });
      }
      const signatureCanvas = signatureRef.current!;
      const signatureBlob = await new Promise<Blob>((resolve, reject) => signatureCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao preparar assinatura.")), "image/png"));
      const signaturePath = `deliveries/${deliveryRef.id}/customer-signature.png`;
      const signatureRefStorage = ref(storage, signaturePath);
      await uploadBytes(signatureRefStorage, signatureBlob, { contentType: "image/png", customMetadata: { deliveryId: deliveryRef.id, quoteId: selectedQuote.id, signedBy: signedBy.trim() } });
      const signatureUrl = await getDownloadURL(signatureRefStorage);
      const operatorName = currentUser.displayName || currentUser.email || "Operador";
      const delivery: Omit<Delivery, "id"> = {
        number: `ENT-${new Date().getFullYear()}-${deliveryRef.id.slice(0, 6).toUpperCase()}`,
        quoteId: selectedQuote.id, quoteNumber: selectedQuote.number,
        ...(selectedInvoice ? { invoiceId: selectedInvoice.id, invoiceNumber: selectedInvoice.number } : {}),
        clientName: selectedQuote.clientName, clientAddress: selectedQuote.clientAddress || "",
        operatorName, status: "Entregue e recebido", photos: uploadedPhotos,
        latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
        locationAt: location.capturedAt, signedBy: signedBy.trim(), signatureUrl, signaturePath,
        createdAt: stamp, notes: notes.trim()
      };
      const postSaleRef = doc(collection(db, "post_sale_records"));
      const deliveryEvidence = { deliveryId: deliveryRef.id, deliveryStatus: "Entregue", deliveredAt: stamp, photos: uploadedPhotos, signatureUrl, signaturePath, signedBy: signedBy.trim(), signedAt: stamp, latitude: location.latitude, longitude: location.longitude, locationAt: location.capturedAt, operatorName };
      const batch = writeBatch(db);
      batch.set(deliveryRef, delivery);
      batch.set(postSaleRef, {
        kind: "satisfaction", customer: selectedQuote.clientName, orderNumber: selectedQuote.number,
        product: selectedQuote.items?.map(item => item.description).join(", ") || "Entrega",
        title: `Confirmação de entrega ${delivery.number}`, status: "Concluído",
        customerDeclaredSatisfied: true, satisfactionDeclaration: "Cliente declara que recebeu os itens e está satisfeito com a entrega e instalação.", notes: notes.trim(),
        deliveryId: deliveryRef.id, quoteId: selectedQuote.id, quoteNumber: selectedQuote.number,
        invoiceId: selectedInvoice?.id || null, invoiceNumber: selectedInvoice?.number || null,
        signatureUrl, signaturePath, signedBy: signedBy.trim(), signedAt: stamp,
        photos: uploadedPhotos, latitude: location.latitude, longitude: location.longitude,
        locationAt: location.capturedAt, operatorName, createdAt: stamp
      });
      batch.update(doc(db, "quotes", selectedQuote.id), {
        ...deliveryEvidence, deliveryEvidence, productionStatus: "delivered", updatedAt: serverTimestamp(),
      });
      if (selectedInvoice) batch.update(doc(db, "invoices", selectedInvoice.id), { ...deliveryEvidence, deliveryEvidence });
      linkedOrders.docs.forEach((orderDoc) => batch.update(orderDoc.ref, {
        status: "delivered", workflowStage: "billing", nextStep: "emitir_fatura",
        deliveryId: deliveryRef.id, deliveryStatus: "delivered", deliveredAt: stamp, updatedAt: serverTimestamp(),
      }));
      await batch.commit();
      resetForm();
    } catch (error) {
      console.error("Falha ao registrar entrega:", error);
      setErrorText(error instanceof Error ? error.message : "Não foi possível salvar a entrega. Verifique permissões do Firestore e Firebase Storage.");
    } finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Operação em campo</p><h1 className="text-2xl font-black text-slate-900 dark:text-white">Entregas e instalações</h1><p className="mt-1 text-sm text-slate-500">Registro fotográfico no local, geolocalização e aceite digital do cliente.</p></div>
      <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4"/> Registrar entrega</button>
    </header>
    <div className="grid gap-4 sm:grid-cols-3">
      {[{label:"Entregas registradas",value:deliveries.length,icon:Truck},{label:"Com aceite do cliente",value:deliveries.filter(d=>d.signatureUrl).length,icon:ClipboardCheck},{label:"Com registro GPS",value:deliveries.filter(d=>Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)).length,icon:MapPin}].map(item=><div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">{item.label}<item.icon className="h-5 w-5 text-blue-500"/></div><p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{item.value}</p></div>)}
    </div>
    <section className="space-y-3">
      <h2 className="text-sm font-black text-slate-800 dark:text-white">Histórico de entregas</h2>
      {deliveries.length===0?<div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">Nenhuma entrega registrada ainda.</div>:deliveries.map(delivery=><article key={delivery.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-600">{delivery.number}</p><h3 className="font-bold text-slate-900 dark:text-white">{delivery.clientName}</h3><p className="text-xs text-slate-500">Orçamento {delivery.quoteNumber}{delivery.invoiceNumber? ` · Fatura ${delivery.invoiceNumber}`:""} · {new Date(delivery.createdAt).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{delivery.status}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{delivery.photos.map((photo,i)=><a key={photo.path} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={`Foto da entrega ${i+1}`} className="h-28 w-full rounded-lg object-cover"/></a>)}</div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>Operador: {delivery.operatorName}</span><span>Recebido por: {delivery.signedBy}</span><a className="inline-flex items-center gap-1 text-blue-600" href={`https://maps.google.com/?q=${delivery.latitude},${delivery.longitude}`} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5"/> Ver localização</a><a className="text-blue-600" href={delivery.signatureUrl} target="_blank" rel="noreferrer">Ver assinatura</a></div>
      </article>)}
    </section>

    {open&&<div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6"><form onSubmit={saveDelivery} className="my-4 w-full max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-7">
      <div className="flex items-start justify-between"><div><h2 className="text-xl font-black text-slate-900 dark:text-white">Nova entrega</h2><p className="text-xs text-slate-500">Preencha no local da instalação. As fotos são capturadas pela câmera.</p></div><button type="button" onClick={resetForm} className="rounded-lg p-2 text-slate-500"><X/></button></div>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Orçamento vinculado *<select required value={quoteId} onChange={e=>{setQuoteId(e.target.value);setInvoiceId("");}} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione o orçamento</option>{quotes.filter(q=>["accepted","approved","invoiced","aprovado","aceito","aceita"].includes(String(q.status).toLowerCase())).map(q=><option key={q.id} value={q.id}>{q.number} · {q.clientName} · {q.total?.toLocaleString("pt-BR",{style:"currency",currency:q.currency||"BRL"})}</option>)}</select></label>
      {selectedQuote&&<div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><b>{selectedQuote.clientName}</b><p>{selectedQuote.clientAddress}</p><p>{selectedQuote.items?.map(item=>item.description).join(" · ")}</p></div>}
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Fatura relacionada<select value={invoiceId} onChange={e=>setInvoiceId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Sem fatura emitida / vincular depois</option>{linkedInvoices.map(i=><option key={i.id} value={i.id}>{i.number} · {i.clientName}</option>)}</select></label>
      <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900 dark:text-white">Fotografias no local</h3><p className="text-xs text-slate-500">A câmera traseira será utilizada. Não há seleção da biblioteca.</p></div><Camera className="h-5 w-5 text-blue-600"/></div>
        {!cameraBusy?<button type="button" onClick={startCamera} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Camera className="h-4 w-4"/> Abrir câmera</button>:<div className="space-y-2"><video ref={videoRef} playsInline muted className="max-h-72 w-full rounded-xl bg-black object-contain"/><div className="flex flex-wrap gap-2"><button type="button" onClick={capturePhoto} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Tirar fotografia</button><button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><CameraOff className="h-4 w-4"/> Fechar câmera</button></div></div>}
        {cameraErrorText&&<p className="text-xs text-rose-600">{cameraErrorText}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.map((photo,i)=><div key={photo.preview} className="relative"><img src={photo.preview} alt={`Fotografia capturada ${i+1}`} className="h-28 w-full rounded-lg object-cover"/><button type="button" onClick={()=>removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-white p-1 text-rose-600"><Trash2 className="h-3.5 w-3.5"/></button></div>)}</div>
        <p className="text-xs text-slate-500">{photos.length} fotografia(s) capturada(s)</p>
      </section>
      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900 dark:text-white">Localização da entrega *</h3><p className="text-xs text-slate-500">GPS do dispositivo no estabelecimento.</p></div><MapPin className="h-5 w-5 text-blue-600"/></div><button type="button" disabled={locationBusy} onClick={captureLocation} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 disabled:opacity-50"><MapPin className="h-4 w-4"/>{locationBusy?"Obtendo GPS...":location?"Atualizar localização":"Capturar localização GPS"}</button>{location&&<p className="text-xs text-emerald-700">GPS registrado: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} (precisão ±{Math.round(location.accuracy||0)} m)</p>}</section>
      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900 dark:text-white">Aceite e assinatura do cliente *</h3><p className="text-xs text-slate-500">O cliente assina na tela para confirmar o recebimento.</p></div><PenLine className="h-5 w-5 text-blue-600"/></div><label className="block text-xs font-bold">Nome de quem recebeu<input required value={signedBy} onChange={e=>setSignedBy(e.target.value)} placeholder="Nome completo do cliente ou responsável" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></label><label className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"><input type="checkbox" required checked={satisfied} onChange={e=>setSatisfied(e.target.checked)} className="mt-0.5"/>Declaro que recebi os itens e estou satisfeito com a entrega e a instalação.</label><div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white"><canvas ref={signatureRef} width={900} height={240} onPointerDown={beginSignature} onPointerMove={drawSignature} onPointerUp={endSignature} onPointerCancel={endSignature} className="h-40 w-full touch-none"/></div><div className="flex justify-between text-xs text-slate-500"><span>Assinatura de confirmação de recebimento</span><button type="button" onClick={clearSignature} className="font-bold text-blue-600">Limpar assinatura</button></div><p className="text-xs text-slate-500">Ao assinar, o cliente confirma que recebeu os itens e pode registrar observações abaixo.</p></section>
      <label className="block text-xs font-bold">Observações da entrega<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Ressalvas, itens pendentes, danos ou observações..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></label>
      {errorText&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errorText}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={resetForm} className="rounded-xl border px-4 py-3 text-sm font-bold">Cancelar</button><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>{saving?"Salvando entrega...":"Confirmar entrega e enviar ao Pós-venda"}</button></div>
    </form></div>}
  </div>;
}
