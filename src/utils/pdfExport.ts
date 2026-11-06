import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Quote, Invoice, TechnicalDrawing, SenderConfig } from "../types";

// Format helper
const formatMoney = (amount: number, currency: string = "BRL") => {
  return new Intl.NumberFormat("es-ES", {
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


// Miniatura vetorial isométrica: ilustração comercial do tipo de esquadria descrito.
const drawQuoteItemMiniature3D = (doc: jsPDF, description: string, x: number, y: number, w: number, h: number) => {
  const d = (description || "").toLowerCase();
  const isShower = /box|banheiro|ducha|shower/.test(d);
  const isDoor = /porta|door/.test(d);
  const isSliding = /corredi|correr|sliding|2 folhas|duas folhas/.test(d);
  const isCloset = /arm[aá]rio|closet|roupeiro/.test(d);
  const isWindow = /janela|esquadria|window|frame/.test(d);
  const isGeneric = !isShower && !isDoor && !isCloset && !isWindow && !isSliding;
  const pad = 4;
  const left = x + pad, top = y + 4, frontW = w - 2 * pad - 5, frontH = h - 9, depth = 4;
  const right = left + frontW, bottom = top + frontH;
  doc.setLineWidth(0.45);
  doc.setDrawColor(100, 116, 139);
  doc.setFillColor(239, 246, 255);
  if (isGeneric) {
    // Objeto genérico em perspectiva para itens/serviços sem tipologia de esquadria identificável.
    doc.rect(left + 5, top + 7, frontW - 11, frontH - 13, "FD");
    doc.line(left + 5, top + 7, left + 10, top + 3);
    doc.line(left + frontW - 6, top + 7, left + frontW - 1, top + 3);
    doc.line(left + 10, top + 3, left + frontW - 1, top + 3);
    doc.line(left + frontW - 6, bottom - 6, left + frontW - 1, bottom - 10);
    doc.line(left + frontW - 1, top + 3, left + frontW - 1, bottom - 10);
    doc.line(left + 5, top + 7, left + 10, top + 3);
  } else if (isShower) {
    // Duas folhas de vidro em canto, com profundidade lateral.
    doc.rect(left + 2, top + 2, frontW * 0.58, frontH - 3, "FD");
    doc.line(left + 2, top + 2, left + frontW * 0.58 + depth, top - 1);
    doc.line(left + frontW * 0.58, top + 2, left + frontW * 0.58 + depth, top - 1);
    doc.line(left + frontW * 0.58 + depth, top - 1, left + frontW * 0.58 + depth, bottom - 3);
    doc.line(left + 2, bottom - 1, left + frontW * 0.58 + depth, bottom - 1);
    doc.line(left + frontW * 0.58, top + 2, left + frontW * 0.58, bottom - 3);
    doc.line(left + frontW * 0.58, top + 2, left + frontW * 0.58 + depth, top - 1);
  } else {
    // Marco frontal de alumínio com lateral superior/direita em perspectiva.
    doc.rect(left, top + 2, frontW, frontH - 3, "FD");
    doc.line(left, top + 2, left + depth, top - 1);
    doc.line(right, top + 2, right + depth, top - 1);
    doc.line(left + depth, top - 1, right + depth, top - 1);
    doc.line(right, top + 2, right + depth, top - 1);
    doc.line(right + depth, top - 1, right + depth, bottom - 4);
    doc.line(right, bottom - 1, right + depth, bottom - 4);
    if (isDoor || isCloset) {
      doc.line(left + frontW * 0.72, top + 4, left + frontW * 0.72, bottom - 4);
      doc.setDrawColor(148, 163, 184);
      doc.line(left + frontW * 0.72 - 2, top + 4, right - 3, bottom - 4);
      doc.setDrawColor(100, 116, 139);
    } else if (isSliding) {
      doc.line(left + frontW / 2, top + 3, left + frontW / 2, bottom - 3);
      doc.setDrawColor(148, 163, 184);
      doc.line(left + 3, top + 5, left + frontW / 2 - 2, bottom - 5);
      doc.line(left + frontW / 2 + 2, top + 5, right - 3, bottom - 5);
      doc.setDrawColor(100, 116, 139);
    } else {
      doc.line(left + frontW / 2, top + 3, left + frontW / 2, bottom - 3);
      doc.line(left + 3, top + frontH / 2, right - 3, top + frontH / 2);
    }
  }
  // Sombra/base discreta para reforçar a leitura tridimensional.
  doc.setDrawColor(203, 213, 225);
  doc.line(left + 1, bottom + 1, right + depth + 2, bottom + 1);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
};


/** Insere a marca oficial configurada no CRM; sem upload, usa assinatura vetorial da marca. */
const drawDocumentLogo = (doc: jsPDF, sender: SenderConfig | undefined, x: number, y: number, w: number, h: number) => {
  const logo = sender?.logoUrl;
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

export const buildQuotePdf = (quote: Quote, sender?: SenderConfig): PdfDocumentResult => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const currency = quote.currency || "BRL";

  // Gold / Dark Luxury Header
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent Gold Bar
  doc.setFillColor(197, 168, 80); // Luxury Gold
  doc.rect(0, 42, pageWidth, 3, "F");

  // Logotipo do CRM presente em todos os documentos comerciais.
  drawDocumentLogo(doc, sender, 14, 7, 25, 25);
  if (sender?.watermarkLogoUrl?.startsWith("data:image/")) {
    doc.addImage(sender.watermarkLogoUrl, "PNG", pageWidth / 2 - 65, 72, 130, 130);
  }

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
  doc.text("ESQUADRIAS DE ALUMÍNIO & SOLUÇÕES TÉCNICAS", sender?.logoUrl?.startsWith("data:image/") ? 44 : 14, 27);

  // Document Type & Number
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PRESUPUESTO", pageWidth - 14, 20, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Nº: ${quote.number}`, pageWidth - 14, 27, { align: "right" });
  doc.text(`Fecha: ${quote.date}`, pageWidth - 14, 34, { align: "right" });

  // Company and Client Details (Two Columns)
  doc.setTextColor(30, 41, 59);
  let yPos = 55;

  // Column 1: Issuer
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EMISOR:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sender?.name || "Anacleto Esquadrias", 14, yPos + 6);
  doc.text(`NIF / CIF: ${sender?.nif || "B-50204533"}`, 14, yPos + 11);
  doc.text(`Dirección: ${sender?.address || "Av. Industrial 1069"}`, 14, yPos + 16);
  doc.text(`${sender?.postalCode || "08001"} ${sender?.city || "Barcelona"} - ${sender?.country || "España"}`, 14, yPos + 21);
  if (sender?.profileEmail) doc.text(`Email: ${sender.profileEmail}`, 14, yPos + 26);

  // Column 2: Client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CLIENTE:", pageWidth / 2 + 10, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(quote.clientName || "Cliente General", pageWidth / 2 + 10, yPos + 6);
  doc.text(`NIF / DNI: ${quote.clientTaxId || "No especificado"}`, pageWidth / 2 + 10, yPos + 11);
  doc.text(`Email: ${quote.clientEmail || "contacto@cliente.com"}`, pageWidth / 2 + 10, yPos + 16);
  doc.text(`Dirección: ${quote.clientAddress || "Dirección de obra"}`, pageWidth / 2 + 10, yPos + 21);
  if (quote.validUntil) doc.text(`Válido hasta: ${quote.validUntil}`, pageWidth / 2 + 10, yPos + 26);

  // Table of Items
  const tableData = quote.items.map((item, idx) => [
    idx + 1,
    "",
    item.description,
    item.quantity,
    formatMoney(item.unitPrice, currency),
    formatMoney(item.subtotal || item.quantity * item.unitPrice, currency),
  ]);

  autoTable(doc, {
    startY: yPos + 35,
    head: [["#", "Vista 3D", "Descripción del Ítem / Servicio", "Cant.", "Precio Unit.", "Subtotal"]],
    body: tableData,
    theme: "striped",
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        const item = quote.items[data.row.index];
        drawQuoteItemMiniature3D(doc, item?.description || "", data.cell.x, data.cell.y, data.cell.width, data.cell.height);
      }
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 29, halign: "center" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 29, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      minCellHeight: 29,
      valign: "middle",
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals Box
  const totalsX = pageWidth - 90;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX - 5, finalY - 4, 85, 45, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Base Imponible:", totalsX, finalY + 4);
  doc.text(formatMoney(quote.subtotal, currency), pageWidth - 14, finalY + 4, { align: "right" });

  if (quote.discountRate && quote.discountRate > 0) {
    doc.text(`Descuento (${quote.discountRate}%):`, totalsX, finalY + 11);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatMoney(quote.discountAmount || 0, currency)}`, pageWidth - 14, finalY + 11, { align: "right" });
    doc.setTextColor(71, 85, 105);
  }

  doc.text(`IVA (${quote.taxRate}%):`, totalsX, finalY + 18);
  doc.text(formatMoney(quote.taxAmount, currency), pageWidth - 14, finalY + 18, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, finalY + 23, pageWidth - 14, finalY + 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL PRESUPUESTO:", totalsX, finalY + 30);
  doc.setTextColor(180, 83, 9);
  doc.text(formatMoney(quote.total, currency), pageWidth - 14, finalY + 30, { align: "right" });

  // Notes and Terms
  if (quote.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("OBSERVACIONES Y CONDICIONES:", 14, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const splitNotes = doc.splitTextToSize(quote.notes, totalsX - 25);
    doc.text(splitNotes, 14, finalY + 17);
  }

  // Desenho 2D vinculado ao produto orçado; mantém fallback ilustrativo para esquadrias.
  const windowItem = quote.items.find((item) => /janela|porta|esquadria|window|door|box de banheiro|box banheiro/i.test(item.description || ""));
  const technicalDrawing = quote.technicalDrawing;
  if (technicalDrawing || windowItem) {
    doc.addPage();
    if (sender?.watermarkLogoUrl?.startsWith("data:image/")) {
      doc.addImage(sender.watermarkLogoUrl, "PNG", pageWidth / 2 - 65, 72, 130, 130);
    }
    drawDocumentLogo(doc, sender, 14, 7, 25, 25);
    const desc = technicalDrawing?.title || windowItem?.description || "Esquadria";
    const dimensions = desc.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
    const unitFactor = technicalDrawing?.unit === "mm" ? 1 : 10;
    const widthMm = technicalDrawing?.overallDimensions?.width
      ? Math.round(technicalDrawing.overallDimensions.width * unitFactor)
      : dimensions ? Number(dimensions[1]) * (Number(dimensions[1]) < 20 ? 100 : 10) : 1200;
    const heightMm = technicalDrawing?.overallDimensions?.height
      ? Math.round(technicalDrawing.overallDimensions.height * unitFactor)
      : dimensions ? Number(dimensions[2]) * (Number(dimensions[2]) < 20 ? 100 : 10) : 1000;
    const isDoor = /porta|door/i.test(desc) || technicalDrawing?.category === "glass_door";
    const frameX = 45, frameY = 72, frameW = 120, frameH = 105;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(technicalDrawing ? "DESENHO TÉCNICO 2D DO PRODUTO ORÇADO" : "DESENHO ILUSTRATIVO 2D DA ESQUADRIA", 14, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(desc.substring(0, 90), 14, 31);
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(2.5);
    doc.rect(frameX, frameY, frameW, frameH);
    doc.setLineWidth(1.2);
    doc.rect(frameX + 4, frameY + 4, frameW - 8, frameH - 8);
    if (/2\s*folhas|duas folhas|2 folhas|corrediça|correr|sliding/i.test(desc)) {
      doc.line(frameX + frameW / 2, frameY + 4, frameX + frameW / 2, frameY + frameH - 4);
      doc.setDrawColor(148, 163, 184);
      doc.line(frameX + 9, frameY + 9, frameX + frameW / 2 - 4, frameY + frameH - 9);
      doc.line(frameX + frameW / 2 + 4, frameY + 9, frameX + frameW - 9, frameY + frameH - 9);
    } else if (!isDoor) {
      doc.line(frameX + frameW / 2, frameY + 4, frameX + frameW / 2, frameY + frameH - 4);
      doc.line(frameX + 4, frameY + frameH / 2, frameX + frameW - 4, frameY + frameH / 2);
    } else {
      doc.setDrawColor(148, 163, 184);
      doc.line(frameX + 8, frameY + 8, frameX + frameW - 8, frameY + frameH - 8);
    }
    doc.setDrawColor(197, 168, 80);
    doc.setLineWidth(0.6);
    doc.line(frameX, frameY - 10, frameX + frameW, frameY - 10);
    doc.line(frameX, frameY - 13, frameX, frameY - 7);
    doc.line(frameX + frameW, frameY - 13, frameX + frameW, frameY - 7);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Largura: ${widthMm} mm`, frameX + frameW / 2, frameY - 14, { align: "center" });
    doc.line(frameX - 12, frameY, frameX - 12, frameY + frameH);
    doc.line(frameX - 15, frameY, frameX - 9, frameY);
    doc.line(frameX - 15, frameY + frameH, frameX - 9, frameY + frameH);
    doc.text(`Altura: ${heightMm} mm`, frameX - 16, frameY + frameH / 2, { angle: 90, align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(technicalDrawing ? "Desenho técnico vinculado; validar medidas finais antes da fabricação." : "Representação visual ilustrativa; confirmar medidas e abertura antes da fabricação.", 14, 205);
    doc.text(`Quantidade no orçamento: ${windowItem?.quantity || quote.items.find((item) => item.description.toLowerCase().includes(desc.toLowerCase()))?.quantity || 1}`, 14, 214);
  }

  // Footer
  const footerY = doc.internal.pageSize.height - 15;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Anacleto Esquadrias © ${new Date().getFullYear()} • Documento comercial oficial generado electrónicamente`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  const fileName = `Presupuesto_${quote.number || "PRE"}.pdf`;
  const dataUri = doc.output("datauristring");
  const sizeKb = Math.max(1, Math.round((dataUri.length * 0.75) / 1024));

  return { doc, dataUri, fileName, sizeKb };
};

export const exportQuotePdf = (quote: Quote, sender?: SenderConfig): PdfDocumentResult => {
  const result = buildQuotePdf(quote, sender);
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
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX - 5, finalY - 4, 85, 45, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Base Imponible:", totalsX, finalY + 4);
  doc.text(formatMoney(invoice.subtotal, currency), pageWidth - 14, finalY + 4, { align: "right" });

  if (invoice.discountRate && invoice.discountRate > 0) {
    doc.text(`Descuento (${invoice.discountRate}%):`, totalsX, finalY + 11);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatMoney(invoice.discountAmount || 0, currency)}`, pageWidth - 14, finalY + 11, { align: "right" });
    doc.setTextColor(71, 85, 105);
  }

  doc.text(`IVA (${invoice.taxRate}%):`, totalsX, finalY + 18);
  doc.text(formatMoney(invoice.taxAmount, currency), pageWidth - 14, finalY + 18, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, finalY + 23, pageWidth - 14, finalY + 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL FACTURA:", totalsX, finalY + 30);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(formatMoney(invoice.total, currency), pageWidth - 14, finalY + 30, { align: "right" });

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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setFillColor(197, 168, 80); // Gold
  doc.rect(0, 38, pageWidth, 3, "F");

  drawDocumentLogo(doc, sender, 14, 5, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("MEMORIA TÉCNICA Y PLANO ARQUITECTÓNICO", 44, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(197, 168, 80);
  doc.text("ANACLETO ESQUADRIAS • DEPARTAMENTO TÉCNICO E DESENHO 2D", 44, 26);

  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`Fecha: ${new Date().toISOString().split("T")[0]}`, pageWidth - 14, 20, { align: "right" });
  doc.text(`Ref: ${drawing.id.substring(0, 8).toUpperCase()}`, pageWidth - 14, 27, { align: "right" });

  let y = 48;

  // General Specifications
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(drawing.title.toUpperCase(), 14, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(drawing.description, 14, y + 6);

  // Overall Dimensions Badge
  const dimBoxX = 14;
  const dimBoxY = y + 12;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(dimBoxX, dimBoxY, pageWidth - 28, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `DIMENSIONES GENERALES: ${drawing.overallDimensions.width} cm (Ancho) × ${drawing.overallDimensions.height} cm (Alto)${
      drawing.overallDimensions.depth ? ` × ${drawing.overallDimensions.depth} cm (Fondo)` : ""
    }  |  UNIDADES: ${drawing.unit.toUpperCase()}  |  TOTAL PIEZAS: ${drawing.pieces.length}`,
    dimBoxX + 6,
    dimBoxY + 9
  );

  // Table of Pieces (Despiece / BOM)
  const pieceRows = drawing.pieces.map((p) => [
    p.pieceNumber,
    p.name,
    p.quantity,
    `${p.dimensions.width} × ${p.dimensions.height}${p.dimensions.depth ? ` × ${p.dimensions.depth}` : ""} ${p.dimensions.unit}`,
    p.material,
    p.cutAngle || "90°",
  ]);

  autoTable(doc, {
    startY: dimBoxY + 20,
    head: [["Nº", "Nombre de la Pieza (Tipo Puzzle)", "Cant.", "Medidas (A × H × F)", "Material", "Corte / Mecanizado"]],
    body: pieceRows,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 42, halign: "center" },
      4: { cellWidth: "auto" },
      5: { cellWidth: 30, halign: "center" },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
    },
  });

  let nextY = (doc as any).lastAutoTable.finalY + 12;

  // 5 Phases of Construction Process
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("PROCESO DE CONSTRUCCIÓN Y MONTAJE PASO A PASO (5 FASES):", 14, nextY);

  nextY += 6;

  drawing.steps.forEach((step) => {
    if (nextY > 260) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, nextY, pageWidth - 28, 16, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, nextY, pageWidth - 28, 16, 2, 2, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(197, 168, 80);
    doc.text(`[Fase ${step.stepNumber}] ${step.phaseName}: ${step.title}`, 18, nextY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(step.description, 18, nextY + 12);

    nextY += 20;
  });

  // Footer
  const footerY = doc.internal.pageSize.height - 12;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Anacleto Esquadrias © ${new Date().getFullYear()} • Documentación Técnica de Fabricación y Despiece Certificado`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  const cleanTitle = (drawing.title || "Proyecto").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Plano_Tecnico_${cleanTitle}.pdf`;
  const dataUri = doc.output("datauristring");
  const sizeKb = Math.max(1, Math.round((dataUri.length * 0.75) / 1024));

  return { doc, dataUri, fileName, sizeKb };
};

export const exportTechnicalDrawingPdf = (drawing: TechnicalDrawing, sender?: SenderConfig): PdfDocumentResult => {
  const result = buildTechnicalDrawingPdf(drawing, sender);
  result.doc.save(result.fileName);
  return result;
};
