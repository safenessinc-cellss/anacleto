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

  // Brand Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text((sender?.name || "ANACLETO ESQUADRIAS").toUpperCase(), 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(197, 168, 80);
  doc.text("ESQUADRIAS DE ALUMÍNIO & SOLUÇÕES TÉCNICAS", 14, 27);

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
    item.description,
    item.quantity,
    formatMoney(item.unitPrice, currency),
    formatMoney(item.subtotal || item.quantity * item.unitPrice, currency),
  ]);

  autoTable(doc, {
    startY: yPos + 35,
    head: [["#", "Descripción del Ítem / Servicio", "Cant.", "Precio Unit.", "Subtotal"]],
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

  // Brand Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text((sender?.name || "ANACLETO ESQUADRIAS").toUpperCase(), 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(197, 168, 80);
  doc.text("SISTEMA DE FACTURACIÓN Y GESTIÓN EMPRESARIAL", 14, 27);

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("MEMORIA TÉCNICA Y PLANO ARQUITECTÓNICO", 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(197, 168, 80);
  doc.text("ANACLETO ESQUADRIAS • DEPARTAMENTO TÉCNICO E DESENHO 2D", 14, 26);

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
