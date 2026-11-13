import type { Invoice, Quote, QuoteItem, SenderConfig, TechnicalDrawing, TechnicalDrawingReference } from "../types";

const isInlineImage = (value: unknown) =>
  typeof value === "string" && value.startsWith("data:image/");

const isOmittedReferenceValue = (key: string, value: unknown) =>
  value === null && /^(drawingId|referenceCode|reference|tipologia|medidas|linha|cor|vidro)$/i.test(key);

export function sanitizeFirestoreData<T>(value: T): T {
  const sanitize = (current: unknown): unknown => {
    if (typeof current === "function" || (typeof current === "number" && !Number.isFinite(current))) return undefined;
    if (Array.isArray(current)) {
      return current.map(sanitize).filter((item) => item !== undefined);
    }
    if (!current || typeof current !== "object") return current;

    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) return current;

    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>)
        .filter(([key, child]) => key.toLowerCase() !== "pdfdatauri" && child !== undefined && !isOmittedReferenceValue(key, child) &&
          !(typeof child === "string" && child.trim() === "" && /^(drawingId|referenceCode|reference|tipologia|medidas|linha|cor|vidro)$/i.test(key)))
        .map(([key, child]) => [key, sanitize(child)])
        .filter(([, child]) => child !== undefined),
    );
  };
  return sanitize(value) as T;
}

function stripInlineImages<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripInlineImages) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, child]) => key !== "pdfDataUri" && !(/image|photo|thumbnail/i.test(key) && isInlineImage(child)))
      .map(([key, child]) => [key, stripInlineImages(child)]),
  ) as T;
}

function technicalDrawingReference(drawing?: Quote["technicalDrawing"]): TechnicalDrawingReference | undefined {
  if (!drawing) return undefined;
  const source = drawing as Quote["technicalDrawing"] & Record<string, unknown>;
  const spec = (drawing as TechnicalDrawing).parametricSpec;
  const budgetItems = (drawing as TechnicalDrawing).budget?.items
    || (drawing as TechnicalDrawingReference).items
    || [];
  return {
    id: drawing.id,
    title: drawing.title,
    referenceCode: String(source.referenceCode || source.reference || source.code || budgetItems[0]?.sku || ""),
    tipologia: String(source.tipologia || spec?.tipologia || source.category || ""),
    medidas: String(source.medidas || `${drawing.overallDimensions?.width || 0} x ${drawing.overallDimensions?.height || 0} ${drawing.unit || ""}`),
    linha: String(source.linha || spec?.linha_aluminio || ""),
    cor: String(source.cor || spec?.cor_perfil || ""),
    vidro: String(source.vidro || spec?.tipo_vidro || ""),
    category: drawing.category,
    unit: drawing.unit,
    overallDimensions: drawing.overallDimensions,
    items: budgetItems.map((item) => ({
      description: String(item.description || ""),
      sku: String(item.sku || ""),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      subtotal: Number(item.subtotal || 0),
      cutLengthMm: Number(item.cutLengthMm || 0),
    })),
  };
}

export function compactQuoteForFirestore(quote: Quote): Quote {
  const { pdfDataUri: _pdf, pdfFileName: _fileName, pdfGeneratedAt: _generatedAt, pdfFileSizeKb: _size, senderSnapshot: _sender, ...light } = quote;
  const result = sanitizeFirestoreData(stripInlineImages({
    ...light,
    technicalDrawing: technicalDrawingReference(quote.technicalDrawing),
    items: quote.items.map((item) => {
      const { itemPhotoUrl: _photo, itemPhotoUrls: _photos, ...line } = item;
      return line;
    }),
  }));
  return assertUnder10Kb(result, "O orçamento");
}

export function compactInvoiceForFirestore(invoice: Invoice): Invoice {
  const { pdfDataUri: _pdf, pdfFileName: _fileName, pdfGeneratedAt: _generatedAt, pdfFileSizeKb: _size, ...light } = invoice;
  const sender = light.senderSnapshot;
  const compactSender = sender
    ? Object.fromEntries(Object.entries(sender).filter(([key, value]) => !(/logo|watermark/i.test(key) && isInlineImage(value)))) as SenderConfig
    : undefined;
  return assertUnder10Kb(sanitizeFirestoreData(stripInlineImages({
    ...light,
    ...(compactSender ? { senderSnapshot: compactSender } : {}),
    items: invoice.items.map((item: QuoteItem) => {
      const { itemPhotoUrl: _photo, itemPhotoUrls: _photos, ...line } = item;
      return line;
    }),
  })), "A fatura");
}

export function compactApprovalSenderSnapshot(sender?: SenderConfig): Partial<SenderConfig> | undefined {
  if (!sender) return undefined;
  const compact = {
    name: sender.name,
    nif: sender.nif,
    address: sender.address,
    postalCode: sender.postalCode,
    city: sender.city,
    country: sender.country,
    currency: sender.currency,
    bankAccount: sender.bankAccount,
    profilePhone: sender.profilePhone,
    profileEmail: sender.profileEmail,
  };
  return assertUnder10Kb(sanitizeFirestoreData(compact), "Os metadados do emissor");
}

export function withoutHeavyInlineData<T>(value: T): T {
  return stripInlineImages(value);
}

export function assertUnder10Kb<T>(value: T, label = "O documento"): T {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > 10 * 1024) throw new Error(`${label} excede 10 KB sem anexos. Reduza descrições ou a quantidade de itens.`);
  return value;
}
