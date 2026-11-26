// ══════════════════════════════════════════════════════════════════════════
// Navegación y guardias de rutas por rol (`owner` | `manager` | `specialist`)
//
// Reglas operativas:
// - `specialist` accede a Workspace Silla (`/`), Agenda (`/agenda`),
//   Clientas CRM (`/clientas`) y su cuenta básica (`/configuracion`).
// - Para `specialist`, se ocultan en navegación y layout autenticado:
//   - `/reportes` (BI & Nómina / utilidad neta)
//   - `/configuracion/precios` (Calibración de tarifas, costos químicos y comisiones)
//   - `/planes` (Suscripción y facturación)
//   - Administración de `/vitrina` (CRUD de catálogo retail y transición de pedidos)
// - Si un `specialist` entra por URL directa a `/reportes`, `/configuracion/precios`
//   o `/planes`, el servidor redirige limpiamente a `/agenda`.
// ══════════════════════════════════════════════════════════════════════════

import type { OrgRole } from './rbac';

export interface MainNavTabItem {
  key: 'workspace' | 'agenda' | 'clientas' | 'vitrina' | 'reportes' | 'calibracion';
  href: string;
  label: string;
  shortLabel: string;
  allowedRoles: readonly OrgRole[];
}

export const MAIN_NAV_TABS: readonly MainNavTabItem[] = [
  {
    key: 'workspace',
    href: '/',
    label: 'Workspace (Silla)',
    shortLabel: 'Silla',
    allowedRoles: ['owner', 'manager', 'specialist'],
  },
  {
    key: 'agenda',
    href: '/agenda',
    label: 'Agenda',
    shortLabel: 'Agenda',
    allowedRoles: ['owner', 'manager', 'specialist'],
  },
  {
    key: 'clientas',
    href: '/clientas',
    label: 'Clientas CRM',
    shortLabel: 'Clientas',
    allowedRoles: ['owner', 'manager', 'specialist'],
  },
  {
    key: 'vitrina',
    href: '/vitrina',
    label: 'Vitrina & Pedidos',
    shortLabel: 'Vitrina',
    allowedRoles: ['owner', 'manager'],
  },
  {
    key: 'reportes',
    href: '/reportes',
    label: 'BI & Nómina',
    shortLabel: 'BI & Nómina',
    allowedRoles: ['owner', 'manager'],
  },
  {
    key: 'calibracion',
    href: '/configuracion/precios',
    label: 'Calibración $',
    shortLabel: 'Calibración',
    allowedRoles: ['owner', 'manager'],
  },
] as const;

export const SPECIALIST_RESTRICTED_PREFIXES = [
  '/reportes',
  '/configuracion/precios',
  '/planes',
] as const;

export const SPECIALIST_FALLBACK_ROUTE = '/agenda' as const;

/**
 * Devuelve las pestañas visibles en `VelvetTopHeader` según el rol activo.
 * Cuando `role` es `null`/`undefined` (cuentas previas sin migración aplicada),
 * conserva la navegación completa de titular del salón.
 */
export function obtenerTabsNavegacionPorRol(
  role: OrgRole | null | undefined
): readonly MainNavTabItem[] {
  if (role === 'specialist') {
    return MAIN_NAV_TABS.filter((tab) => tab.allowedRoles.includes('specialist'));
  }
  return MAIN_NAV_TABS;
}

export function mostrarAccesoPlanesPorRol(role: OrgRole | null | undefined): boolean {
  return role !== 'specialist';
}

export function mostrarAdministracionVitrinaPorRol(
  role: OrgRole | null | undefined
): boolean {
  if (!role) return true;
  return role === 'owner' || role === 'manager';
}

export function esRutaRestringidaParaSpecialist(pathname: string): boolean {
  const clean = pathname.trim() || '/';
  return SPECIALIST_RESTRICTED_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`)
  );
}

/**
 * Determina si una ruta privada requiere redirección limpia para el rol activo.
 * Retorna `'/agenda'` cuando un `specialist` intenta acceder a una ruta financiera
 * o administrativa restringida; en caso contrario retorna `null`.
 */
export function resolverRedireccionPorRol(
  pathname: string,
  role: OrgRole | null | undefined
): string | null {
  if (role === 'specialist' && esRutaRestringidaParaSpecialist(pathname)) {
    return SPECIALIST_FALLBACK_ROUTE;
  }
  return null;
}
