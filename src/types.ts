export interface BudgetLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type BudgetStatus = "pending" | "accepted" | "rejected" | "invoiced";

export interface Budget {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string;
  clientNif: string;
  clientAddress: string;
  date: string;
  items: BudgetLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: BudgetStatus;
  language: string;
  translations?: Record<string, {
    items: BudgetLineItem[];
    subtotal: number;
    taxAmount: number;
    total: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SenderConfig {
  name: string;
  nif: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  logoUrl: string;
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

export interface Invoice {
  id: string;
  number: string;
  budgetId: string;
  clientName: string;
  clientEmail: string;
  clientNif: string;
  clientAddress: string;
  date: string;
  items: BudgetLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  language: string;
  senderSnapshot: SenderConfig;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
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
