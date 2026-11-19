// ============================================================
// SISTEMA DE ROLES Y PERMISOS - ANACLETO PRO
// ============================================================

export type Role =
  | "super_admin"
  | "super_usuario"
  | "ceo"
  | "admin"
  | "supervisor"
  | "colaborador"
  | "usuario"
  | "financeiro"
  | "rh"
  | "qualidade"
  | "estoque"
  | "producao";

export type NavigationTab =
  | "dashboard"
  | "crm"
  | "quotes"
  | "invoices"
  | "technical_drawing"
  | "agenda"
  | "catalog"
  | "financial_ai"
  | "admin"
  | "settings"
  | "theme"
  | "payroll"
  | "finance"
  | "reports"
  | "tipologias"
  | "projects"
  | "profile"
  | "suggestions"
  | "post_sale"
  | "deliveries"
  | "inventory"
  | "production"
  | "workflow";

export interface RoleConfig {
  id: Role;
  label: string;
  labelPT: string;
  level: number;
  color: string;
  description: string;
  tabs: NavigationTab[];
  canManageUsers: boolean;
  canManageRolesBelow: Role[];
}

const ALL_TABS: NavigationTab[] = [
  "dashboard", "crm", "quotes", "invoices", "technical_drawing",
  "agenda", "catalog", "finance", "financial_ai", "admin", "settings", "theme", "reports", "tipologias", "projects", "profile", "suggestions", "post_sale", "deliveries", "inventory", "production", "workflow",
];

export const ROLES: Record<Role, RoleConfig> = {
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    labelPT: "Super Administrador",
    level: 100,
    color: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Propietario único del sistema. Acceso total; su cuenta no puede ser eliminada ni degradada por ningún otro perfil.",
    tabs: ALL_TABS,
    canManageUsers: true,
    canManageRolesBelow: ["super_usuario", "ceo", "admin", "supervisor", "colaborador", "usuario", "financeiro", "rh", "qualidade", "estoque", "producao"],
  },
  ceo: {
    id: "ceo",
    label: "CEO",
    labelPT: "CEO",
    level: 95,
    color: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Dirección ejecutiva. Acceso operativo y estratégico; la administración de cuentas queda reservada al propietario.",
    tabs: ALL_TABS,
    canManageUsers: true,
    canManageRolesBelow: ["super_usuario", "admin", "supervisor", "colaborador", "usuario"],
  },
  super_usuario: {
    id: "super_usuario",
    label: "Super Usuario",
    labelPT: "Super Usuário",
    level: 90,
    color: "bg-orange-100 text-orange-800 border-orange-300",
    description: "Gestión avanzada de la operación; la administración de cuentas queda reservada al propietario.",
    tabs: ALL_TABS,
    canManageUsers: true,
    canManageRolesBelow: ["admin", "supervisor", "colaborador", "usuario"],
  },
  admin: {
    id: "admin",
    label: "Administrador",
    labelPT: "Administrador",
    level: 60,
    color: "bg-indigo-100 text-indigo-800 border-indigo-300",
    description: "Acceso completo a las secciones y gestiones del sistema.",
    tabs: ALL_TABS,
    canManageUsers: true,
    canManageRolesBelow: ["supervisor", "colaborador", "usuario"],
  },
  supervisor: {
    id: "supervisor",
    label: "Supervisor",
    labelPT: "Supervisor",
    level: 40,
    color: "bg-blue-100 text-blue-800 border-blue-300",
    description: "Supervisa equipos y operaciones. El acceso financiero y de nómina requiere un perfil autorizado.",
    tabs: ["dashboard", "crm", "quotes", "invoices", "technical_drawing", "agenda", "catalog", "theme", "reports", "tipologias", "projects", "profile", "suggestions", "post_sale", "deliveries", "production", "workflow"],
    canManageUsers: false,
    canManageRolesBelow: [],
  },
  colaborador: {
    id: "colaborador",
    label: "Colaborador",
    labelPT: "Colaborador",
    level: 20,
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    description: "Empleado. Crea presupuestos, facturas, dibujos y gestiona catálogo. Sin finanzas.",
    tabs: ["dashboard", "crm", "quotes", "invoices", "technical_drawing", "agenda", "catalog", "theme", "tipologias", "projects", "profile", "suggestions", "deliveries"],
    canManageUsers: false,
    canManageRolesBelow: [],
  },
  financeiro: {
    id: "financeiro", label: "Financeiro", labelPT: "Financeiro", level: 35,
    color: "bg-cyan-100 text-cyan-800 border-cyan-300",
    description: "Contas a pagar e receber, compras, fornecedores, pagamentos e relatórios financeiros.",
    tabs: ["dashboard", "finance", "financial_ai", "reports", "profile", "suggestions"],
    canManageUsers: false, canManageRolesBelow: [],
  },
  rh: {
    id: "rh", label: "Recursos Humanos", labelPT: "Recursos Humanos", level: 35,
    color: "bg-pink-100 text-pink-800 border-pink-300",
    description: "Gestão confidencial de colaboradores, ponto e folha salarial.",
    tabs: ["dashboard", "payroll", "profile", "suggestions"],
    canManageUsers: false, canManageRolesBelow: [],
  },
  qualidade: {
    id: "qualidade", label: "Qualidade", labelPT: "Qualidade", level: 30,
    color: "bg-teal-100 text-teal-800 border-teal-300",
    description: "Inspeções, entregas, garantias e pós-venda.",
    tabs: ["dashboard", "post_sale", "deliveries", "workflow", "reports", "profile", "suggestions"],
    canManageUsers: false, canManageRolesBelow: [],
  },
  estoque: {
    id: "estoque", label: "Estoque", labelPT: "Estoque", level: 25,
    color: "bg-lime-100 text-lime-800 border-lime-300",
    description: "Movimentações, recebimento, reservas e inventário de materiais.",
    tabs: ["dashboard", "inventory", "profile", "suggestions"],
    canManageUsers: false, canManageRolesBelow: [],
  },
  producao: {
    id: "producao", label: "Produção", labelPT: "Produção", level: 25,
    color: "bg-violet-100 text-violet-800 border-violet-300",
    description: "Ordens de produção, etapas, consumo de materiais e apontamentos.",
    tabs: ["dashboard", "production", "workflow", "technical_drawing", "projects", "inventory", "profile", "suggestions"],
    canManageUsers: false, canManageRolesBelow: [],
  },
  usuario: {
    id: "usuario",
    label: "Usuario",
    labelPT: "Usuário",
    level: 10,
    color: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Acceso básico de solo lectura a dashboard, CRM, presupuestos y agenda.",
    tabs: ["dashboard", "crm", "quotes", "agenda", "theme", "profile", "suggestions"],
    canManageUsers: false,
    canManageRolesBelow: [],
  },
};

export const SUPER_ADMIN_EMAIL = "safeness.c.a@gmail.com";

export const getRoleConfig = (role: Role | undefined | null): RoleConfig => {
  if (!role) return ROLES.usuario;
  return ROLES[role] || ROLES.usuario;
};

export const hasAccessToTab = (role: Role | undefined | null, tab: NavigationTab): boolean => {
  return getRoleConfig(role).tabs.includes(tab);
};

export const canManageRole = (
  currentUserRole: Role | undefined | null,
  targetRole: Role
): boolean => {
  const config = getRoleConfig(currentUserRole);
  return config.canManageRolesBelow.includes(targetRole);
};

export const getAllRoles = (): RoleConfig[] => {
  return Object.values(ROLES).sort((a, b) => b.level - a.level);
};

export const getAssignableRoles = (currentUserRole: Role | undefined | null): RoleConfig[] => {
  const config = getRoleConfig(currentUserRole);
  return config.canManageRolesBelow.map((r) => ROLES[r]);
};

// Aliases de compatibilidade usados pelo módulo de administração.
export type Perfile = Role;
export const getPerfileConfig = getRoleConfig;
export const getAssignablePerfiles = getAssignableRoles;
