import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Quote, Invoice, TechnicalDrawing, SenderConfig } from "../types";
import officialAnacletoLogo from "../assets/images/anacleto-logo-premium.svg";

// Format helper
const formatMoney = (amount: number, currency: string = "BRL") => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export interface PdfDocumentResult {
  doc: jsPDF;
  dataUri: string;
  fileName: string;
  sizeKb: number;
}

const getOfficialLogoDataUrl = async (): Promise<string> => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não foi possível carregar o logotipo oficial da Anacleto."));
    image.src = officialAnacletoLogo;
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error("Não foi possível carregar o logotipo oficial da Anacleto."));
    }
  });

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar o logotipo oficial para o PDF.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

const svgToPngDataUrl = async (svg: string, width = 1800, height = 1170): Promise<string> => {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não foi possível renderizar a perspectiva arquitetônica para o PDF."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error("Não foi possível renderizar a perspectiva arquitetônica para o PDF."));
    }
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a perspectiva arquitetônica para o PDF.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

export const exportArchitecturalSheetPdf = async (svg: string, title: string): Promise<void> => {
  const image = await svgToPngDataUrl(svg, 2400, 3260);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
  doc.addImage(image, "PNG", 10, 22, 277, 376);
  doc.save(`Ficha_Tecnica_${title.replace(/[^a-z0-9_-]+/gi, "_") || "Esquadria"}.pdf`);
};


/** Insere a marca oficial configurada no CRM; sem upload, usa assinatura vetorial da marca. */
const drawDocumentLogo = (doc: jsPDF, sender: SenderConfig | undefined, x: number, y: number, w: number, h: number, officialLogo?: string) => {
  const logo = officialLogo || sender?.logoUrl;
  if (logo?.startsWith("data:image/")) {
    try {
      const mime = logo.slice(5, logo.indexOf(";")).toLowerCase();
      const format = mime.includes("jpeg") ? "JPEG" : mime.includes("webp") ? "WEBP" : "PNG";
      doc.addImage(logo, format, x, y, w, h);
      return;
    } catch (error) {
      console.warn("Não foi possível inserir o logotipo configurado no PDF:", error);
    }
  }
  // Fallback vetorial compacto com a identidade arquitetônica prata/dourado.
  doc.setDrawColor(197, 168, 80);
  doc.setLineWidth(1.1);
  doc.rect(x, y + 1, 20, h - 2);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(x + 10, y + 2, x + 10, y + h - 2);
  doc.line(x + 2, y + h / 2, x + 18, y + h / 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(197, 168, 80);
  doc.text("ANACLETO", x + 23, y + h / 2 - 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(203, 213, 225);
  doc.text("ESQUADRIAS", x + 23, y + h / 2 + 4);
};



/** Marca d'água discreta aplicada em todas as páginas dos PDFs comerciais e técnicos. */
const applyDocumentWatermark = (doc: jsPDF, sender?: SenderConfig) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const watermark = sender?.watermarkLogoUrl?.startsWith("data:image/")
    ? sender.watermarkLogoUrl
    : sender?.logoUrl?.startsWith("data:image/") ? sender.logoUrl : null;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (watermark) {
      try {
        const mime = watermark.slice(5, watermark.indexOf(";")).toLowerCase();
        const format = mime.includes("jpeg") ? "JPEG" : mime.includes("webp") ? "WEBP" : "PNG";
        (doc as any).setGState(new (doc as any).GState({ opacity: 0.07 }));
        doc.addImage(watermark, format, pageWidth / 2 - 42, pageHeight / 2 - 42, 84, 84, undefined, "FAST");
        (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
        continue;
      } catch (error) {
        console.warn("Não foi possível inserir a marca d'água gráfica; usando marca vetorial:", error);
      }
    }
    // Fallback vetorial: funciona mesmo sem imagem carregada/configurada no perfil.
    doc.setTextColor(245, 245, 245);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.text("ANACLETO", pageWidth / 2, pageHeight / 2, { align: "center", angle: 35 });
    doc.setFontSize(11);
    doc.text("ESQUADRIAS", pageWidth / 2, pageHeight / 2 + 10, { align: "center", angle: 35 });
  }
  doc.setPage(pageCount);
};

const loadQuoteItemPhoto = async (url?: string): Promise<string | null> => {
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível carregar a foto do item."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Foto do item ignorada no PDF (URL indisponível ou sem CORS):", error);
    return null;
  }
};

const applyQuoteWatermark = (doc: jsPDF, quote: Quote, sender?: SenderConfig, officialLogo?: string) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const configuredWatermark = sender?.watermarkLogoUrl?.startsWith("data:image/")
    ? sender.watermarkLogoUrl
    : sender?.logoUrl?.startsWith("data:image/") ? sender.logoUrl : null;
  const watermarkImage = configuredWatermark || officialLogo;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (watermarkImage) {
      try {
        const mime = watermarkImage.slice(5, watermarkImage.indexOf(";")).toLowerCase();
        const format = mime.includes("jpeg") ? "JPEG" : mime.includes("webp") ? "WEBP" : "PNG";
        (doc as any).setGState(new (doc as any).GState({ opacity: 0.075 }));
        doc.addImage(watermarkImage, format, pageWidth / 2 - 43, pageHeight / 2 - 43, 86, 86, undefined, "FAST");
        (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
        continue;
      } catch (error) {
        console.warn("Não foi possível inserir a marca d'água gráfica do orçamento:", error);
        try { (doc as any).setGState(new (doc as any).GState({ opacity: 1 })); } catch { /* sem suporte de transparência */ }
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.setTextColor(226, 232, 240);
    doc.text(quote.status === "approved" ? "APROVADO" : "ORÇAMENTO", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
  }
  doc.setPage(pageCount);
};

export const buildQuotePdf = async (quote: Quote, sender?: SenderConfig): Promise<PdfDocumentResult> => {
  const officialLogo = await getOfficialLogoDataUrl();
  const doc = new jsPDF();
  if (quote.approvedAt) {
    doc.setCreationDate(new Date(quote.approvedAt));
    if (quote.snapshotContentHash) doc.setFileId(String(quote.snapshotContentHash).slice(0, 32).toUpperCase());
  }
  const pageWidth = doc.internal.pageSize.width;
  const currency = quote.currency || "BRL";

  // Gold / Dark Luxury Header
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent Gold Bar
  doc.setFillColor(197, 168, 80); // Luxury Gold
  doc.rect(0, 42, pageWidth, 3, "F");

  // Logotipo do CRM presente em todos os documentos comerciais.
  drawDocumentLogo(doc, sender, 14, 7, 25, 25, officialLogo);

  // Brand Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text((sender?.name || "ANACLETO ESQUADRIAS").toUpperCase(), 44, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(197, 168, 80);
  doc.text("ESQUADRIAS DE ALUMÍNIO & SOLUÇÕES TÉCNICAS", 44, 27);

  // Document Type & Number
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("ORÇAMENTO", pageWidth - 14, 20, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Nº: ${quote.number}`, pageWidth - 14, 27, { align: "right" });
  doc.text(`Data: ${quote.date}`, pageWidth - 14, 34, { align: "right" });

  // Company and Client Details (Two Columns)
  doc.setTextColor(30, 41, 59);
  let yPos = 55;

  // Column 1: Issuer
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EMPRESA:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(sender?.name || "Anacleto Esquadrias", 14, yPos + 6);
  if (sender?.nif) doc.text(`CNPJ: ${sender.nif}`, 14, yPos + 11);
  else doc.text("CNPJ: Não configurado", 14, yPos + 11);
  doc.text(`Endereço: ${sender?.address || "Av. Caxias do Sul, 1069 - Rio dos Sinos"}`, 14, yPos + 16);
  doc.text(`${sender?.postalCode || "93110-000"} ${sender?.city || "São Leopoldo - RS"}${sender?.country ? ` - ${sender.country}` : " - Brasil"}`, 14, yPos + 21);
  doc.text("WhatsApp: +55 51 99819-3931", 14, yPos + 26);

  // Column 2: Client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CLIENTE:", pageWidth / 2 + 10, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(quote.clientName || "Cliente não informado", pageWidth / 2 + 10, yPos + 6);
  doc.text(`CPF / CNPJ: ${quote.clientTaxId || "Não informado"}`, pageWidth / 2 + 10, yPos + 11);
  doc.text(`E-mail: ${quote.clientEmail || "Não informado"}`, pageWidth / 2 + 10, yPos + 16);
  doc.text(`Endereço: ${quote.clientAddress || "Não informado"}`, pageWidth / 2 + 10, yPos + 21);
  if (quote.validUntil) doc.text(`Válido até: ${quote.validUntil}`, pageWidth / 2 + 10, yPos + 26);

  // Itens comerciais: sem desenhos automáticos por descrição.
  const includeItemImages = Boolean(quote.includeItemImages);
  const itemPhotoData = includeItemImages
    ? await Promise.all(quote.items.map((item) => loadQuoteItemPhoto(item.itemPhotoUrl || item.itemPhotoUrls?.[0])))
    : [];
  const tableData = quote.items.map((item, idx) => [
    idx + 1,
    ...(includeItemImages ? [""] : []),
    item.sku
      ? item.sku + " · " + item.description + (Number(item.cutLengthMm) > 0 ? " (" + item.cutLengthMm + " mm)" : "")
      : item.description,
    item.quantity,
    formatMoney(item.unitPrice, currency),
    formatMoney(item.subtotal ?? item.quantity * item.unitPrice, currency),
  ]);

  autoTable(doc, {
    startY: yPos + 35,
    head: [includeItemImages
      ? ["#", "Imagem", "Descrição do Item / Serviço", "Qtd.", "Preço Unit.", "Subtotal"]
      : ["#", "Descrição do Item / Serviço", "Qtd.", "Preço Unit.", "Subtotal"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: includeItemImages ? {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 19, halign: "center" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 13, halign: "center" },
      4: { cellWidth: 27, halign: "right" },
      5: { cellWidth: 29, halign: "right" },
    } : {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 31, halign: "right" },
      4: { cellWidth: 31, halign: "right" },
    },
    didParseCell: (data) => {
      if (includeItemImages && data.section === "body" && data.column.index === 1) {
        data.cell.styles.minCellHeight = 19;
      }
    },
    didDrawCell: (data) => {
      if (includeItemImages && data.section === "body" && data.column.index === 1) {
        const photo = itemPhotoData[data.row.index];
        if (photo) {
          try {
            const mime = photo.slice(5, photo.indexOf(";")).toLowerCase();
            const format = mime.includes("jpeg") ? "JPEG" : mime.includes("webp") ? "WEBP" : "PNG";
            const size = 15;
            doc.addImage(photo, format, data.cell.x + (data.cell.width - size) / 2, data.cell.y + 2, size, size, undefined, "FAST");
          } catch (error) {
            console.warn("Não foi possível desenhar a foto do item no PDF:", error);
          }
        }
      }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      valign: "middle",
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 8;
  const totalRows = [
    ["Materiais:", formatMoney(quote.subtotal, currency)],
    ...(Number(quote.labor || 0) > 0 ? [["Mão de obra:", formatMoney(quote.labor || 0, currency)]] : []),
    ...(Number(quote.margin || 0) > 0 ? [[`Margem (${quote.marginRate || 0}%):`, formatMoney(quote.margin || 0, currency)]] : []),
    ...(Number(quote.freight || 0) > 0 ? [["Frete:", formatMoney(quote.freight || 0, currency)]] : []),
    ...(Number(quote.discountAmount || 0) > 0 ? [[`Desconto (${quote.discountRate || 0}%):`, `-${formatMoney(quote.discountAmount || 0, currency)}`]] : []),
    ...(Number(quote.taxAmount || 0) > 0 ? [[`Imposto (${quote.taxRate || 0}%):`, formatMoney(quote.taxAmount, currency)]] : []),
  ];
  const totalsHeight = (totalRows.length + 1) * 6 + 10;
  const notesLines = quote.notes ? doc.splitTextToSize(quote.notes, pageWidth - 14 - 91 - 25) : [];
  const notesHeight = notesLines.length ? notesLines.length * 4 + 12 : 0;
  const pageBottom = doc.internal.pageSize.getHeight() - 22;

  // Se não houver espaço real para totais e condições, usa a segunda página.
  if (finalY + Math.max(totalsHeight, notesHeight) > pageBottom && doc.getNumberOfPages() < 2) {
    doc.addPage();
    finalY = 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("CONTINUAÇÃO DO ORÇAMENTO", 14, finalY);
    finalY += 10;
  }

  const totalsX = pageWidth - 91;
  const totalsBoxHeight = totalsHeight;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX - 5, finalY - 4, 82, totalsBoxHeight, 3, 3, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  totalRows.forEach(([label, amount], index) => {
    const rowY = finalY + 3 + index * 6;
    doc.text(label, totalsX, rowY);
    doc.text(amount, pageWidth - 14, rowY, { align: "right" });
  });

  const dividerY = finalY + 3 + totalRows.length * 6;
  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, dividerY, pageWidth - 14, dividerY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL GERAL:", totalsX, dividerY + 7);
  doc.setTextColor(180, 83, 9);
  doc.text(formatMoney(quote.total, currency), pageWidth - 14, dividerY + 7, { align: "right" });

  if (notesLines.length) {
    const notesY = finalY + 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("OBSERVAÇÕES E CONDIÇÕES:", 14, notesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(notesLines, 14, notesY + 6);
  }

  // Só inclui desenho quando existe projeto técnico explicitamente associado e geometria salva.
  const linkedDrawing = quote.technicalDrawing as TechnicalDrawing | undefined;
  const hasRealDrawing = Boolean(
    linkedDrawing && (
      (typeof linkedDrawing.vectorPayload?.svg === "string" && linkedDrawing.vectorPayload.svg.trim()) ||
      (Array.isArray(linkedDrawing.visualElements) && linkedDrawing.visualElements.length >= 2)
    )
  );
  if (hasRealDrawing && doc.getNumberOfPages() < 2) {
    const svg = linkedDrawing!.vectorPayload?.svg;
    if (svg) {
      const drawingImage = await svgToPngDataUrl(svg, 1800, 1170);
      doc.addPage();
      drawDocumentLogo(doc, sender, 14, 7, 25, 25, officialLogo);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("PROJETO TÉCNICO VINCULADO", 44, 19);
      doc.addImage(drawingImage, "PNG", 18, 43, pageWidth - 36, 170);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(String(linkedDrawing!.title || "Projeto"), 18, 222);
    }
  }

  // Footer
  const footerY = doc.internal.pageSize.height - 15;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Anacleto Esquadrias © ${new Date().getFullYear()} • Orçamento comercial`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  applyQuoteWatermark(doc, quote, sender, officialLogo);
  const fileName = `Orcamento_${quote.number || "PRE"}.pdf`;
  const dataUri = doc.output("datauristring");
  const sizeKb = Math.max(1, Math.round((dataUri.length * 0.75) / 1024));

  return { doc, dataUri, fileName, sizeKb };
};

export const exportQuotePdf = async (quote: Quote, sender?: SenderConfig): Promise<PdfDocumentResult> => {
  const result = await buildQuotePdf(quote, sender);
  result.doc.save(result.fileName);
  return result;
};

export const buildInvoicePdf = (invoice: Invoice, sender?: SenderConfig): PdfDocumentResult => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const currency = invoice.currency || "BRL";

  // Gold / Dark Luxury Header
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent Gold Bar
  doc.setFillColor(197, 168, 80); // Luxury Gold
  doc.rect(0, 42, pageWidth, 3, "F");

  // Logotipo do CRM no cabeçalho da fatura.
  drawDocumentLogo(doc, sender, 14, 7, 25, 25);

  // Brand Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text((sender?.name || "ANACLETO ESQUADRIAS").toUpperCase(), 44, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(197, 168, 80);
  doc.text("SISTEMA DE FACTURACIÓN Y GESTIÓN EMPRESARIAL", 44, 27);

  // Document Type & Number
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("FACTURA", pageWidth - 14, 20, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Nº: ${invoice.number}`, pageWidth - 14, 27, { align: "right" });
  doc.text(`Fecha: ${invoice.date}`, pageWidth - 14, 34, { align: "right" });

  // Two columns for Company & Client
  let yPos = 55;
  doc.setTextColor(30, 41, 59);

  // Column 1: Issuer
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS FISCALES EMISOR:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sender?.name || "Anacleto Esquadrias S.L.", 14, yPos + 6);
  doc.text(`NIF / CIF: ${sender?.nif || "B-50204533"}`, 14, yPos + 11);
  doc.text(`Domicilio: ${sender?.address || "Av. Caxias do Sul 1069"}`, 14, yPos + 16);
  doc.text(`${sender?.postalCode || "08001"} ${sender?.city || "Barcelona"} - ${sender?.country || "España"}`, 14, yPos + 21);
  if (sender?.bankAccount) doc.text(`IBAN: ${sender.bankAccount}`, 14, yPos + 26);

  // Column 2: Client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DATOS CLIENTE:", pageWidth / 2 + 10, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.clientName || "Cliente", pageWidth / 2 + 10, yPos + 6);
  doc.text(`NIF / DNI: ${invoice.clientTaxId || "No indicado"}`, pageWidth / 2 + 10, yPos + 11);
  doc.text(`Email: ${invoice.clientEmail || "-"}`, pageWidth / 2 + 10, yPos + 16);
  doc.text(`Dirección: ${invoice.clientAddress || "-"}`, pageWidth / 2 + 10, yPos + 21);
  doc.text(`Estado: ${invoice.status === "paid" ? "PAGADA" : "PENDIENTE"}`, pageWidth / 2 + 10, yPos + 26);

  // Table
  const tableData = invoice.items.map((item, idx) => [
    idx + 1,
    item.description,
    item.quantity,
    formatMoney(item.unitPrice, currency),
    formatMoney(item.subtotal || item.quantity * item.unitPrice, currency),
  ]);

  autoTable(doc, {
    startY: yPos + 35,
    head: [["#", "Concepto / Descripción del Trabajo", "Cant.", "Precio Unit.", "Importe"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals Box
  const totalsX = pageWidth - 90;
  const invoiceRows = [
    ["Materiais:", formatMoney(invoice.subtotal, currency)],
    ...(Number(invoice.labor || 0) > 0 ? [["Mão de obra:", formatMoney(invoice.labor || 0, currency)]] : []),
    ...(Number(invoice.margin || 0) > 0 ? [[`Margem (${invoice.marginRate || 0}%):`, formatMoney(invoice.margin || 0, currency)]] : []),
    ...(Number(invoice.freight || 0) > 0 ? [["Frete:", formatMoney(invoice.freight || 0, currency)]] : []),
    ...(Number(invoice.discountAmount || 0) > 0 ? [[`Desconto (${invoice.discountRate || 0}%):`, `-${formatMoney(invoice.discountAmount || 0, currency)}`]] : []),
    [`IVA (${invoice.taxRate}%):`, formatMoney(invoice.taxAmount, currency)],
  ];
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX - 5, finalY - 4, 85, (invoiceRows.length + 1) * 7 + 7, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  invoiceRows.forEach(([label, amount], index) => {
    const rowY = finalY + 4 + index * 7;
    doc.text(label, totalsX, rowY);
    if (label.startsWith("Desconto")) doc.setTextColor(220, 38, 38);
    doc.text(amount, pageWidth - 14, rowY, { align: "right" });
    doc.setTextColor(71, 85, 105);
  });
  const totalLineY = finalY + 4 + invoiceRows.length * 7;
  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, totalLineY, pageWidth - 14, totalLineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL FACTURA:", totalsX, totalLineY + 7);
  doc.setTextColor(16, 185, 129);
  doc.text(formatMoney(invoice.total, currency), pageWidth - 14, totalLineY + 7, { align: "right" });

  // Bank Info & Notes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("FORMA DE PAGO:", 14, finalY + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Método: ${invoice.paymentMethod || "Transferencia Bancaria"}`, 14, finalY + 16);
  if (sender?.bankAccount) doc.text(`Cuenta: ${sender.bankAccount}`, 14, finalY + 21);

  // Footer
  const footerY = doc.internal.pageSize.height - 15;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Anacleto Esquadrias © ${new Date().getFullYear()} • Factura electrónica válida a efectos tributarios`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  applyDocumentWatermark(doc, sender);
  const fileName = `Factura_${invoice.number || "FAC"}.pdf`;
  const dataUri = doc.output("datauristring");
  const sizeKb = Math.max(1, Math.round((dataUri.length * 0.75) / 1024));

  return { doc, dataUri, fileName, sizeKb };
};

export const exportInvoicePdf = (invoice: Invoice, sender?: SenderConfig): PdfDocumentResult => {
  const result = buildInvoicePdf(invoice, sender);
  result.doc.save(result.fileName);
  return result;
};

export const buildTechnicalDrawingPdf = (drawing: TechnicalDrawing, sender?: SenderConfig): PdfDocumentResult => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (drawing.approvedAt) {
    doc.setCreationDate(new Date(drawing.approvedAt));
    if (drawing.snapshotContentHash) doc.setFileId(String(drawing.snapshotContentHash).slice(0, 32).toUpperCase());
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const unit = drawing.unit || "cm";
  const dims = drawing.overallDimensions || { width: 0, height: 0, depth: 0 };
  const width = Number(dims.width) || 0;
  const height = Number(dims.height) || 0;
  const depth = Number(dims.depth) || 0;
  const pieces = Array.isArray(drawing.pieces) ? drawing.pieces : [];
  const drawHeader = (title: string, subtitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 27, "F");
    doc.setFillColor(197, 168, 80);
    doc.rect(0, 27, pageWidth, 2, "F");
    drawDocumentLogo(doc, sender, 10, 3, 21, 21);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(title, 36, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(226, 232, 240);
    doc.text(subtitle, 36, 19);
    doc.setFontSize(7);
    doc.text(new Date().toLocaleDateString("pt-BR"), pageWidth - 10, 12, { align: "right" });
    doc.text("Ref. " + String(drawing.id || "").slice(0, 12).toUpperCase(), pageWidth - 10, 19, { align: "right" });
  };
  const fit = (w: number, h: number, maxW: number, maxH: number) => {
    const safeW = Math.max(1, w), safeH = Math.max(1, h);
    const scale = Math.min(maxW / safeW, maxH / safeH);
    return { w: safeW * scale, h: safeH * scale };
  };
  const drawOrtho = (label: string, x: number, y: number, boxW: number, boxH: number, realW: number, realH: number, caption: string) => {
    const fitted = fit(realW, realH, boxW - 18, boxH - 30);
    const px = x + (boxW - fitted.w) / 2;
    const py = y + 16 + (boxH - 30 - fitted.h) / 2;
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(label, x + 5, y + 9);
    doc.setLineWidth(0.8);
    doc.rect(px, py, fitted.w, fitted.h, "FD");
    const visualElements = Array.isArray((drawing as any).visualElements) ? (drawing as any).visualElements : [];
    if (label === "VISTA FRONTAL" && visualElements.length > 0) {
      const sx = fitted.w / 1000, sy = fitted.h / 1000;
      const hex = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
        const raw = String(value || "").trim();
        const match = raw.match(/^#?([0-9a-f]{6})$/i);
        return match ? [parseInt(match[1].slice(0,2),16), parseInt(match[1].slice(2,4),16), parseInt(match[1].slice(4,6),16)] : fallback;
      };
      visualElements.forEach((element: any) => {
        const type = String(element.type || "rect").toLowerCase();
        const stroke = hex(element.stroke, [51,65,85]);
        const fill = hex(element.fill, [255,255,255]);
        doc.setDrawColor(...stroke);
        doc.setFillColor(...fill);
        doc.setLineWidth(Math.max(0.15, Math.min(1.5, Number(element.strokeWidth || 2) * 0.18)));
        const ex = px + Number(element.x || 0) * sx;
        const ey = py + Number(element.y || 0) * sy;
        if (type === "line") {
          doc.line(ex, py + Number(element.y1 || 0) * sy, px + Number(element.x2 || 0) * sx, py + Number(element.y2 || 0) * sy);
        } else if (type === "circle") {
          const radius = Math.max(0.3, Number(element.r || 8) * Math.min(sx, sy));
          doc.circle(px + Number(element.cx || 0) * sx, py + Number(element.cy || 0) * sy, radius, element.fill && element.fill !== "none" ? "FD" : "S");
        } else if (type === "polygon" && Array.isArray(element.points) && element.points.length >= 3) {
          const pts = element.points.map((point: any) => [px + Number(point.x || 0) * sx, py + Number(point.y || 0) * sy]);
          for (let i = 0; i < pts.length; i++) doc.line(pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]);
        } else if (type === "text") {
          doc.setFontSize(Math.max(4, Math.min(8, Number(element.fontSize || 12) * 0.35)));
          doc.setTextColor(...hex(element.fill, [15,23,42]));
          doc.text(String(element.text || "").slice(0, 60), ex, ey);
        } else {
          const rw = Math.max(0, Number(element.width || 0) * sx);
          const rh = Math.max(0, Number(element.height || 0) * sy);
          doc.rect(ex, ey, rw, rh, element.fill && element.fill !== "none" ? "FD" : "S");
          if (element.label) {
            doc.setFontSize(5);
            doc.setTextColor(15,23,42);
            doc.text(String(element.label).slice(0,35), ex + 1, ey + 3);
          }
        }
      });
    } else {
      doc.setDrawColor(148, 163, 184);
      if (/janela|esquadria|porta|box|arm[aá]rio|closet/i.test(drawing.title + " " + drawing.description)) {
        const count = /2\s*folhas|duas folhas|corredi[cç]a|correr/i.test(drawing.description + " " + drawing.title) ? 2 : 1;
        if (count === 2) doc.line(px + fitted.w / 2, py, px + fitted.w / 2, py + fitted.h);
        else if (/janela|esquadria/i.test(drawing.title + " " + drawing.description)) {
          doc.line(px + fitted.w / 2, py, px + fitted.w / 2, py + fitted.h);
          doc.line(px, py + fitted.h / 2, px + fitted.w, py + fitted.h / 2);
        }
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(caption, x + boxW / 2, y + boxH - 5, { align: "center" });
  };

  // Página 1: identificação, dimensões e as três vistas do MESMO modelo do editor.
  drawHeader("DESENHO TÉCNICO 2D — " + (drawing.title || "Projeto"), "ANACLETO ESQUADRIAS • Documento gerado a partir dos dados editáveis do projeto");
  // O selo definitivo de rascunho é aplicado a todas as páginas após a composição do documento.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(drawing.title || "Projeto técnico").slice(0, 90), 12, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const descriptionLines = doc.splitTextToSize(String(drawing.description || ""), pageWidth - 24).slice(0, 2);
  doc.text(descriptionLines, 12, 46);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(12, 55, pageWidth - 24, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("DIMENSÕES GERAIS", 17, 61);
  doc.setFont("helvetica", "normal");
  doc.text("Largura: " + width + " " + unit + "   •   Altura: " + height + " " + unit + "   •   Profundidade: " + (depth || "não informada") + (depth ? " " + unit : "") + "   •   Componentes: " + pieces.length, 17, 66);
  const gap = 6;
  const viewW = (pageWidth - 24 - gap * 2) / 3;
  const viewY = 79;
  const viewH = 105;
  drawOrtho("VISTA FRONTAL", 12, viewY, viewW, viewH, width, height, "Largura " + width + " " + unit + " × Altura " + height + " " + unit);
  drawOrtho("VISTA LATERAL", 12 + viewW + gap, viewY, viewW, viewH, depth || 1, height, "Profundidade " + (depth || "—") + " " + unit);
  drawOrtho("VISTA SUPERIOR", 12 + (viewW + gap) * 2, viewY, viewW, viewH, width, depth || 1, "Largura " + width + " " + unit + " × Prof. " + (depth || "—") + " " + unit);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const hasFaithfulGeometry = Array.isArray((drawing as any).visualElements) && (drawing as any).visualElements.length >= 2;
  doc.text(hasFaithfulGeometry
    ? "Vista frontal reproduz a geometria visual estruturada do projeto; vistas lateral e superior representam as cotas gerais."
    : "ATENÇÃO: geometria visual específica indisponível. Esta folha contém apenas vistas dimensionais esquemáticas; não usar como imagem final do produto.", 12, 194);

  // Página 2: lista de peças com as mesmas cotas armazenadas no desenho.
  doc.addPage();
  drawHeader("LISTA DE PEÇAS E PLANO DE CORTE", drawing.title || "Projeto técnico");
  const pieceRows = pieces.map((piece) => [
    piece.pieceNumber ?? "",
    piece.name || "Componente",
    piece.quantity ?? 1,
    [piece.dimensions?.width, piece.dimensions?.height, piece.dimensions?.depth ?? piece.dimensions?.thickness].filter((v) => v !== undefined && v !== null).join(" × ") + " " + (piece.dimensions?.unit || unit),
    piece.material || "A definir",
    piece.cutAngle || "A validar",
  ]);
  autoTable(doc, {
    startY: 36,
    head: [["Nº", "Peça / componente", "Qtd.", "Dimensões (L × A × P)", "Material", "Corte"]],
    body: pieceRows,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 52 }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 48 }, 4: { cellWidth: "auto" }, 5: { cellWidth: 27 } },
    didDrawPage: () => { if (doc.getNumberOfPages() > 2) drawHeader("LISTA DE PEÇAS E PLANO DE CORTE", drawing.title || "Projeto técnico"); },
  });
  let nextY = ((doc as any).lastAutoTable?.finalY || 40) + 10;
  if (nextY > pageHeight - 35) { doc.addPage(); drawHeader("MONTAGEM E OBSERVAÇÕES", drawing.title || "Projeto técnico"); nextY = 38; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("INSTRUÇÕES DE MONTAGEM", 12, nextY);
  nextY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  (drawing.assemblyInstructions || []).forEach((instruction, index) => {
    const lines = doc.splitTextToSize((index + 1) + ". " + instruction, pageWidth - 24);
    if (nextY + lines.length * 4 > pageHeight - 18) { doc.addPage(); drawHeader("MONTAGEM E OBSERVAÇÕES", drawing.title || "Projeto técnico"); nextY = 38; }
    doc.text(lines, 12, nextY);
    nextY += lines.length * 4 + 2;
  });
  (drawing.steps || []).forEach((step) => {
    if (nextY + 14 > pageHeight - 18) { doc.addPage(); drawHeader("ETAPAS DO PROJETO", drawing.title || "Projeto técnico"); nextY = 38; }
    doc.setFont("helvetica", "bold");
    doc.text("Fase " + step.stepNumber + " — " + (step.phaseName || step.title || ""), 12, nextY);
    nextY += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(step.description || ""), pageWidth - 24);
    doc.text(lines, 12, nextY);
    nextY += lines.length * 4 + 4;
  });

  applyDocumentWatermark(doc, sender);
  if ((drawing as any).isDraft !== false || (drawing as any).status !== "APPROVED_FOR_MANUFACTURING") {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(185, 28, 28);
      doc.text("BORRADOR PRELIMINAR - NO VÁLIDO PARA FABRICACIÓN", pageWidth / 2, 27, { align: "center", angle: -18 });
      doc.setFontSize(8);
    }
  }
  const cleanTitle = (drawing.title || "Projeto").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = "Desenho_Tecnico_" + cleanTitle + ".pdf";
  const dataUri = doc.output("datauristring");
  const sizeKb = Math.max(1, Math.round((dataUri.length * 0.75) / 1024));
  return { doc, dataUri, fileName, sizeKb };
};

export const exportTechnicalDrawingPdf = (drawing: TechnicalDrawing, sender?: SenderConfig): PdfDocumentResult => {
  const result = buildTechnicalDrawingPdf(drawing, sender);
  result.doc.save(result.fileName);
  return result;
};
