// ══════════════════════════════════════════════════════════════════════════
// RBAC Multi-Tenant · Velli Pro (`owner` | `manager` | `specialist`)
//
// Regla de seguridad: estas funciones puras espejan las políticas RLS de
// `supabase/migration-multitenant-rbac.sql` para validar permisos en Route
// Handlers, Server Components y pruebas unitarias. La barrera real siempre es
// Postgres RLS + funciones SQL (`current_user_org_ids`, `has_org_role`).
// ══════════════════════════════════════════════════════════════════════════

import type { VerticalSalon } from '@/lib/flags/verticales';

export type OrgRole = 'owner' | 'manager' | 'specialist';

export const ORG_ROLES: readonly OrgRole[] = ['owner', 'manager', 'specialist'] as const;

export type PlanOrganizacion = 'trialing' | 'basico' | 'pro' | 'pro_ia';

export interface OrganizationRecord {
  id: string;
  slug: string;
  name: string;
  vertical: VerticalSalon;
  plan: PlanOrganizacion;
  whatsappPhone?: string;
  city?: string;
  featureFlags: Record<string, unknown>;
  createdAt: string;
}

export interface OrganizationMemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  active: boolean;
  createdAt: string;
}

export type MemberContext = Pick<OrganizationMemberRecord, 'role' | 'active'> & {
  organizationId?: string;
};

export type OrgPermission =
  | 'org:manage_billing'
  | 'org:delete'
  | 'members:manage_managers'
  | 'members:manage_specialists'
  | 'brand:edit'
  | 'catalog:calibrate_costs'
  | 'commissions:manage'
  | 'reports:view_net_profit'
  | 'clients:delete'
  | 'workspace:quote_in_chair'
  | 'clients:read_write'
  | 'clinical:diagnose';

const PERMISSION_MATRIX: Record<OrgPermission, readonly OrgRole[]> = {
  // Exclusivos de `owner`
  'org:manage_billing': ['owner'],
  'org:delete': ['owner'],
  'members:manage_managers': ['owner'],

  // `owner` y `manager` (estrictamente bloqueados para `specialist`)
  'members:manage_specialists': ['owner', 'manager'],
  'brand:edit': ['owner', 'manager'],
  'catalog:calibrate_costs': ['owner', 'manager'],
  'commissions:manage': ['owner', 'manager'],
  'reports:view_net_profit': ['owner', 'manager'],
  'clients:delete': ['owner', 'manager'],

  // Operación en silla para todos los miembros activos de la organización
  'workspace:quote_in_chair': ['owner', 'manager', 'specialist'],
  'clients:read_write': ['owner', 'manager', 'specialist'],
  'clinical:diagnose': ['owner', 'manager', 'specialist'],
};

export function esOrgRole(valor: unknown): valor is OrgRole {
  return typeof valor === 'string' && (ORG_ROLES as readonly string[]).includes(valor);
}

/**
 * Espejo puro de `public.has_org_role(org_id, roles[])`.
 * Devuelve `true` solo si la membresía está activa, pertenece a la organización
 * solicitada (cuando se especifica `expectedOrgId`) y su rol figura en `allowedRoles`.
 */
export function hasOrgRole(
  member: MemberContext | null | undefined,
  allowedRoles: readonly OrgRole[],
  expectedOrgId?: string
): boolean {
  if (!member || !member.active) return false;
  if (expectedOrgId && member.organizationId && member.organizationId !== expectedOrgId) {
    return false;
  }
  if (allowedRoles.length === 0) return false;
  return allowedRoles.includes(member.role);
}

export function canPerformOrgAction(
  member: MemberContext | null | undefined,
  permission: OrgPermission,
  expectedOrgId?: string
): boolean {
  const allowed = PERMISSION_MATRIX[permission];
  return hasOrgRole(member, allowed, expectedOrgId);
}

export function canViewNetProfitReports(
  member: MemberContext | null | undefined,
  expectedOrgId?: string
): boolean {
  return canPerformOrgAction(member, 'reports:view_net_profit', expectedOrgId);
}

export function canCalibrateCosts(
  member: MemberContext | null | undefined,
  expectedOrgId?: string
): boolean {
  return canPerformOrgAction(member, 'catalog:calibrate_costs', expectedOrgId);
}

/**
 * Regla de escalamiento de miembros (espejo de las policies de `organization_members`):
 * - `owner` puede invitar/modificar cualquier rol (`owner`, `manager`, `specialist`).
 * - `manager` solo puede invitar/modificar `specialist` (nunca `owner` ni `manager`).
 * - `specialist` (o inactivo) no puede gestionar miembros.
 */
export function canAssignMemberRole(
  actor: MemberContext | null | undefined,
  targetRole: OrgRole,
  expectedOrgId?: string
): boolean {
  if (hasOrgRole(actor, ['owner'], expectedOrgId)) return true;
  if (hasOrgRole(actor, ['manager'], expectedOrgId)) {
    return targetRole === 'specialist';
  }
  return false;
}

/**
 * Proyecta una cotización según el rol del usuario en la organización.
 * Para `specialist`, redacta todos los campos de costos químicos internos,
 * fórmulas, comisiones y utilidad neta (espejando `cotizaciones_operativas_silla`).
 */
export function projectQuoteForRole<
  T extends {
    costoProductoEstimado?: unknown;
    costoDetalle?: unknown;
    comisionEstimada?: unknown;
    comisionDetalle?: unknown;
    formula?: unknown;
  },
>(
  quote: T,
  member: MemberContext | null | undefined
): T | Omit<T, 'costoProductoEstimado' | 'costoDetalle' | 'comisionEstimada' | 'comisionDetalle' | 'formula'> {
  if (hasOrgRole(member, ['owner', 'manager'])) {
    return quote;
  }
  const copia = { ...quote };
  delete copia.costoProductoEstimado;
  delete copia.costoDetalle;
  delete copia.comisionEstimada;
  delete copia.comisionDetalle;
  delete copia.formula;
  return copia;
}
