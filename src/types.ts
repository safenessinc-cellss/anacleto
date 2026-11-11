export interface Company {
  id: string;
  name: string;
  taxId: string; // NIF, CIF, CNPJ, RFC, etc.
  email: string;
  phone: string;
  address: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  category?: "client" | "supplier" | "partner";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  notes?: string;
  itemId?: string;
  catalogSource?: string;
  itemPhotoUrl?: string;
  itemPhotoUrls?: string[];
  itemCategory?: string;
  itemDimensions?: string;
  sku?: string;
  catalogItemId?: string;
  priceSource?: "catalog" | "pending" | "existing" | "manual";
  priceValidation?: string;
}

export interface DeliveryEvidence {
  deliveryId: string;
  deliveryStatus: string;
  deliveredAt: string;
  photos: { url: string; path: string; capturedAt: string }[];
  signatureUrl: string;
  signaturePath: string;
  signedBy: string;
  signedAt: string;
  latitude: number;
  longitude: number;
  locationAt: string;
  operatorName: string;
}

export type QuoteStatus = "draft" | "pending" | "approved" | "accepted" | "rejected" | "invoiced" | "pendente" | "aprovado" | "rejeitado";

export interface Quote {
  id: string;
  number: string;
  companyId?: string;
  clientName: string;
  clientEmail: string;
  clientTaxId: string;
  clientAddress: string;
  date: string;
  validUntil?: string;
  items: QuoteItem[];
  itemIds?: string[];
  technicalDrawing?: TechnicalDrawing;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate?: number;
  discountAmount?: number;
  total: number;
  currency: string;
  status: QuoteStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // PDF Storage in Platform
  pdfDataUri?: string;
  pdfFileName?: string;
  pdfGeneratedAt?: string;
  pdfFileSizeKb?: number;
  approvedSnapshotId?: string;
  approvedAt?: string;
  approvedBy?: { uid: string; email: string; role: string };
  snapshotContentHash?: string;
  senderSnapshot?: SenderConfig;
  // Legacy compatibility fields
  clientNif?: string;
  language?: string;
  translations?: Record<string, any>;
  deliveryId?: string;
  deliveryStatus?: string;
  deliveredAt?: string;
  deliveryEvidence?: DeliveryEvidence;
}

export type InvoiceStatus = "pending" | "paid" | "cancelled" | "pendente" | "pago";

export interface Invoice {
  id: string;
  number: string;
  quoteId?: string;
  budgetId?: string;
  companyId?: string;
  clientName: string;
  clientEmail: string;
  clientTaxId?: string;
  clientNif?: string;
  clientAddress: string;
  date: string;
  dueDate?: string;
  items: QuoteItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate?: number;
  discountAmount?: number;
  total: number;
  currency?: string;
  status?: InvoiceStatus;
  paymentMethod?: string;
  notes?: string;
  language?: string;
  senderSnapshot?: SenderConfig;
  createdAt: string;
  updatedAt?: string;
  // PDF Storage in Platform
  pdfDataUri?: string;
  pdfFileName?: string;
  pdfGeneratedAt?: string;
  pdfFileSizeKb?: number;
  deliveryId?: string;
  deliveryStatus?: string;
  deliveredAt?: string;
  deliveryEvidence?: DeliveryEvidence;
}

export interface TechnicalPiece {
  id: string;
  pieceNumber: number;
  name: string;
  quantity: number;
  dimensions: {
    width: number;
    height: number;
    thickness?: number;
    depth?: number;
    unit: "cm" | "mm";
  };
  material: string;
  color?: string;
  cutAngle?: string;
  notes?: string;
}

export interface DimensionLine {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  label: string;
  value: number;
  unit: string;
  orientation: "horizontal" | "vertical" | "diagonal";
  offset?: number;
}

export interface TechnicalDrawingStep {
  stepNumber: number;
  title: string;
  description: string;
  phaseName: string;
  instructions: string[];
  svgElementsData?: any;
}

export interface TechnicalDrawing {
  id: string;
  title: string;
  description: string;
  category: "furniture" | "architectural" | "aluminum_window" | "glass_door" | "custom";
  unit: "cm" | "mm";
  overallDimensions: {
    width: number;
    height: number;
    depth?: number;
  };
  pieces: TechnicalPiece[];
  isDraft?: boolean;
  status?: "PRELIMINARY_CONTINGENCY" | "APPROVED_FOR_MANUFACTURING";
  draftStatus?: "preliminary" | "approved";
  draftLabel?: string;
  approvedSnapshotId?: string;
  approvedAt?: string;
  approvedBy?: { uid: string; email: string; role: string };
  snapshotContentHash?: string;
  senderSnapshot?: SenderConfig;
  // Geometria vetorial específica gerada a partir do prompt, usada na tela e no PDF.
  visualElements?: Array<Record<string, any>>;
  modelDescription?: string;
  finalAppearance?: string;
  measurementPlan?: Array<Record<string, any>>;
  cuttingPlan?: Array<Record<string, any>>;
  manufacturingSteps?: Array<Record<string, any>>;
  qualityChecklist?: string[];
  assumptions?: string[];
  dimensionLines: DimensionLine[];
  assemblyInstructions: string[];
  steps: TechnicalDrawingStep[];
  currentStep: number;
  budget?: {
    currency: string;
    items: Array<{ id?: string; pieceId?: string; description: string; sku?: string; quantity: number; unitPrice: number; subtotal: number; priceSource?: string }>;
    subtotal: number;
    labor: number;
    total: number;
    notes?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // PDF Storage in Platform
  pdfDataUri?: string;
  pdfUrl?: string;
  pdfStoragePath?: string;
  storageFormat?: "pdf-only";
  pdfFileName?: string;
  pdfGeneratedAt?: string;
  pdfFileSizeKb?: number;
  projectId?: string;
  projectName?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  referenceId?: string;
  createdAt: string;
}

export interface SenderConfig {
  name: string;
  nif: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  logoUrl: string;
  watermarkLogoUrl?: string;
  bankAccount: string;
  currency: string;
  updatedAt: string;
  websiteLogoUrl?: string;
  profileName?: string;
  profileBio?: string;
  profileRole?: string;
  profileAvatarUrl?: string;
  profilePhone?: string;
  profileEmail?: string;
  promotions?: {
    id: string;
    title: string;
    description: string;
    discountBadge: string;
    isActive: boolean;
  }[];
  publicity?: {
    id: string;
    bannerText: string;
    bannerLink?: string;
    isActive: boolean;
    bgColor?: string;
  }[];
  videos?: {
    id: string;
    title: string;
    url: string;
    description?: string;
  }[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// Backward compatibility types
export type BudgetLineItem = QuoteItem;
export type BudgetStatus = QuoteStatus;
export interface Budget extends Quote {
  clientNif: string;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}
export interface ChatSession {
  id: string;
  language: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
