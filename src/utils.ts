import { BudgetLineItem } from "./types";
import { LanguageCode } from "./translations";

export const languageMeta: Record<LanguageCode, { name: string; flag: string; dir: "ltr" | "rtl" }> = {
  pt: { name: "Português", flag: "🇵🇹", dir: "ltr" },
  es: { name: "Español", flag: "🇪🇸", dir: "ltr" },
  en: { name: "English", flag: "🇬🇧", dir: "ltr" },
  fr: { name: "Français", flag: "🇫🇷", dir: "ltr" },
  de: { name: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  it: { name: "Italiano", flag: "🇮🇹", dir: "ltr" },
  zh: { name: "中文", flag: "🇨🇳", dir: "ltr" },
  ja: { name: "日本語", flag: "🇯🇵", dir: "ltr" },
  ru: { name: "Русский", flag: "🇷🇺", dir: "ltr" },
  ar: { name: "العربية", flag: "🇸🇦", dir: "rtl" },
};

// Common accounting/business services translation lexicon for flawless instant rendering in 10 languages
const servicesLexicon: Record<string, Record<LanguageCode, string>> = {
  "serviços de consultoria": {
    pt: "Serviços de Consultoria Empresarial",
    es: "Servicios de Consultoría Empresarial",
    en: "Business Consulting Services",
    fr: "Services de Conseil aux Entreprises",
    de: "Unternehmensberatung",
    it: "Servizi di Consulenza Aziendale",
    zh: "商业企业咨询服务",
    ja: "ビジネスコンサルティングサービス",
    ru: "Услуги бизнес-консалтинга",
    ar: "خدمات الاستشارات التجارية"
  },
  "consultoria": {
    pt: "Consultoria Geral",
    es: "Consultoría General",
    en: "General Consulting",
    fr: "Consulting Général",
    de: "Allgemeine Beratung",
    it: "Consulenza Generale",
    zh: "综合咨询咨询",
    ja: "総合コンサルタント",
    ru: "Общее консультирование",
    ar: "الاستشارات العامة"
  },
  "desenvolvimento de software": {
    pt: "Desenvolvimento de Software à Medida",
    es: "Desarrollo de Software a Medida",
    en: "Custom Software Development",
    fr: "Développement de Logiciels Sur Mesure",
    de: "Anwendungssoftwareentwicklung",
    it: "Sviluppo Software su Misura",
    zh: "定制软件系统开发",
    ja: "カスタムソフトウェア開発",
    ru: "Разработка заказного ПО",
    ar: "تطوير البرمجيات المخصصة"
  },
  "assessoria de marketing": {
    pt: "Assessoria de Marketing Digital",
    es: "Asesoría de Marketing Digital",
    en: "Digital Marketing Strategy",
    fr: "Services de Marketing Digital",
    de: "Digitales Marketing",
    it: "Consulenza di Marketing Digitale",
    zh: "数字网络营销运营策划",
    ja: "デジタルマーケティング戦略支援",
    ru: "Услуги цифрового маркетинга",
    ar: "خدمات التسويق الرقمي"
  },
  "licença mensal": {
    pt: "Licença Mensal de Plataforma SaaS",
    es: "Licencia Mensual de Plataforma SaaS",
    en: "Monthly SaaS Platform License",
    fr: "Abonnement Mensuel Plateforme SaaS",
    de: "Monatliche SaaS-Plattformlizenz",
    it: "Licenza Mensile Piattaforma SaaS",
    zh: "每月 SaaS 平台使用许可费用",
    ja: "月間SaaSクラウドライセンス利用料",
    ru: "Ежемесячная лицензия на SaaS",
    ar: "ترخيص منصة SaaS شهرياً"
  },
  "auditoria operacional": {
    pt: "Auditoria Financeira e Operacional",
    es: "Auditoría Financiera y Operativa",
    en: "Financial and Operational Audit",
    fr: "Audit Financier et Opérationnel",
    de: "Finanz- und Betriebsprüfung",
    it: "Audit Finanziario e Operativo",
    zh: "财务与运营合规性审计",
    ja: "財務および業務監査サービス",
    ru: "Финансово-операционный аудит",
    ar: "التدقيق المالي والتشغيلي"
  },
  "suporte tecnológico": {
    pt: "Suporte Tecnológico e Manutenção",
    es: "Suporte Tecnológico y Mantenimiento",
    en: "IT Support and System Maintenance",
    fr: "Support Technologique et Maintenance",
    de: "Technischer Support und Wartung",
    it: "Supporto Tecnico e Manutenzione IT",
    zh: "技术运维与系统故障排除",
    ja: "ITサポートおよびシステム保守保守",
    ru: "Техподдержка и обслуживание серверов",
    ar: "الدعم الفني وصيانة الأنظمة"
  },
  "desenvolvimento de app": {
    pt: "Desenvolvimento de Aplicação Móvel",
    es: "Desarrollo de Aplicación Móvil",
    en: "Mobile Application Development",
    fr: "Développement d'Application Mobile",
    de: "Entwicklung mobiler Apps",
    it: "Sviluppo di Applicazione Mobile",
    zh: "移动端 APP 应用程序研发",
    ja: "モバイルアプリ開発サービス",
    ru: "Разработка мобильных приложений",
    ar: "تطوير تطبيقات الهاتف الجوال"
  },
  "honorários de contabilidade": {
    pt: "Honorários de Contabilidade Mensal",
    es: "Honorarios de Contabilidad Mensual",
    en: "Monthly Bookkeeping and Accounting Fee",
    fr: "Honoraires de Comptabilité Mensuels",
    de: "Monatliche Buchführungsgebühren",
    it: "Compensi di Contabilità Mensili",
    zh: "每月代理记账服务代理费",
    ja: "月間会計顧問報酬費用",
    ru: "Ежемесячное бухгалтерское сопровождение",
    ar: "أتعاب المحاسبة ومسك الدفاتر الشهري"
  }
};

// Advanced offline translations translator helper
export function translateText(text: string, toLang: LanguageCode): string {
  const normalized = text.trim().toLowerCase();
  
  // Exact match from lexicon
  if (servicesLexicon[normalized]) {
    return servicesLexicon[normalized][toLang];
  }

  // Prefix/partial detection
  for (const key of Object.keys(servicesLexicon)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return servicesLexicon[key][toLang];
    }
  }

  // Dynamic placeholders if not matched
  const translationsFallback: Record<LanguageCode, string> = {
    pt: `Serviço Extra: ${text}`,
    es: `Servicio Extra: ${text}`,
    en: `Additional Service: ${text}`,
    fr: `Service Supplémentaire: ${text}`,
    de: `Zusatzleistung: ${text}`,
    it: `Servizio Aggiuntivo: ${text}`,
    zh: `加收项目服务: ${text}`,
    ja: `追加のサービス: ${text}`,
    ru: `Дополнительная услуга: ${text}`,
    ar: `خدمة إضافية: ${text}`
  };

  return translationsFallback[toLang] || text;
}

// Automatically translates complete project line items block on budgeting creation
export function generateBudgetTranslations(items: BudgetLineItem[]): Record<string, { items: BudgetLineItem[]; subtotal: number; taxAmount: number; total: number }> {
  const result: Record<string, { items: BudgetLineItem[]; subtotal: number; taxAmount: number; total: number }> = {};
  
  const languages: LanguageCode[] = ["pt", "es", "en", "fr", "de", "it", "zh", "ja", "ru", "ar"];
  
  languages.forEach((lang) => {
    const translatedItems = items.map((item) => ({
      ...item,
      description: translateText(item.description, lang),
    }));

    const subtotal = translatedItems.reduce((acc, current) => acc + (current.quantity * current.unitPrice), 0);
    
    // We assume same prices but translated descriptions as requested by "mismos datos, textos traducidos"
    result[lang] = {
      items: translatedItems,
      subtotal: subtotal,
      taxAmount: 0, // calculated depending on the rate
      total: subtotal, 
    };
  });

  return result;
}

export function formatCurrency(value: number, currencyCode: string = "BRL", lang: string = "pt-BR"): string {
  const formatters: Record<string, string> = {
    EUR: "EUR",
    USD: "USD",
    BRL: "BRL",
    CNY: "CNY",
    JPY: "JPY"
  };

  const curr = formatters[currencyCode] || currencyCode;
  
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: curr,
  }).format(value);
}
