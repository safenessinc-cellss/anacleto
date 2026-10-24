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
  | "usuario";

export type NavigationTab =
  | "dashboard"
  | "crm"
  | "quotes"
  | "invoices"
  | "technical_drawing"
  | "agenda"
  | "catalog"
  | "finance"
  | "financial_ai"
  | "admin"
  | "settings"
  | "theme";

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
  "agenda", "catalog", "finance", "financial_ai", "admin", "settings", "theme",
];

export const ROLES: Record<Role, RoleConfig> = {
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    labelPT: "Super Administrador",
    level: 100,
    color: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Propietario del sistema. Acceso total y único que puede eliminar a otros super admins.",
    tabs: ALL_TABS,
    canManageUsers: true,
    canManageRolesBelow: ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "usuario"],
  },
  ceo: {
    id: "ceo",
    label: "CEO",
    labelPT: "CEO",
    level: 95,
    color: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Dirección ejecutiva. 100% de acceso: puede gestionar todos los usuarios y roles.",
    tabs: ALL_TABS,
    canManageUsers: true,
    canManageRolesBelow: ["super_admin", "super_usuario", "admin", "supervisor", "colaborador", "usuario"],
  },
  super_usuario: {
    id: "super_usuario",
    label: "Super Usuario",
    labelPT: "Super Usuário",
    level: 90,
    color: "bg-orange-100 text-orange-800 border-orange-300",
    description: "Gestión avanzada. Puede administrar admins, supervisores, colaboradores y usuarios.",
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
    description: "Gestión completa del negocio. Puede aprobar supervisores, colaboradores y usuarios.",
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
    description: "Supervisa equipos. Acceso a todos los módulos operativos y finanzas.",
    tabs: ["dashboard", "crm", "quotes", "invoices", "technical_drawing", "agenda", "catalog", "finance", "financial_ai", "theme"],
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
    tabs: ["dashboard", "crm", "quotes", "invoices", "technical_drawing", "agenda", "catalog", "theme"],
    canManageUsers: false,
    canManageRolesBelow: [],
  },
  usuario: {
    id: "usuario",
    label: "Usuario",
    labelPT: "Usuário",
    level: 10,
    color: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Acceso básico de solo lectura a dashboard, CRM, presupuestos y agenda.",
    tabs: ["dashboard", "crm", "quotes", "agenda", "theme"],
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
