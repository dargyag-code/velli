// ══════════════════════════════════════════════════════════════════════════
// Brand Settings · Velvet Studio (`public.brand_settings`)
//
// Parametriza identidad pública por organización (nombre comercial, logotipo,
// color primario/acento, dominio personalizado, tagline y pie legal) usando
// siempre la paleta Velvet Studio (`#3B0D1E` / `#E8CFC8`) como fallback seguro
// y rechazando colores inválidos, negro puro (`#000000`) o valores maliciosos.
// ══════════════════════════════════════════════════════════════════════════

export const VELVET_DEFAULT_PRIMARY_COLOR = '#111111';
export const VELVET_DEFAULT_ACCENT_COLOR = '#F4F4F5';
export const VELI_DEFAULT_PRIMARY_COLOR = VELVET_DEFAULT_PRIMARY_COLOR;
export const VELI_DEFAULT_ACCENT_COLOR = VELVET_DEFAULT_ACCENT_COLOR;

const HEX_6_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DOMINIO_SEGURO_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

// Colores heredados o prohibidos por el sistema Velvet Studio (`AGENTS.md` §2)
const COLORES_RECHAZADOS = new Set(['#000000', '#2D5A27']);

export interface BrandSettingsInput {
  organizationId: string;
  displayName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  customDomain?: string | null;
  publicTagline?: string | null;
  legalFooter?: string | null;
}

export interface BrandSettingsResolved {
  organizationId: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain: string | null;
  publicTagline: string | null;
  legalFooter: string | null;
}

export type PublicBrandProjection = Omit<BrandSettingsResolved, 'customDomain'>;

export interface LegacySalonBrandFallback {
  organizationId?: string;
  nombreSalon?: string | null;
  logoUrl?: string | null;
  colorPrimario?: string | null;
}

export function normalizarHexVelvet(
  color: string | null | undefined,
  fallback: string = VELVET_DEFAULT_PRIMARY_COLOR
): string {
  if (typeof color !== 'string') return fallback;
  const limpio = color.trim().toUpperCase();
  if (!HEX_6_REGEX.test(limpio)) return fallback;
  if (COLORES_RECHAZADOS.has(limpio)) return fallback;
  return limpio;
}

export function normalizarDominioPersonalizado(
  dominio: string | null | undefined
): string | null {
  if (typeof dominio !== 'string') return null;
  const limpio = dominio
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!limpio || !DOMINIO_SEGURO_REGEX.test(limpio)) return null;
  return limpio;
}

function limpiarTextoOpcional(
  valor: string | null | undefined,
  maxLen: number
): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  if (!limpio) return null;
  return limpio.slice(0, maxLen);
}

/**
 * Resuelve `brand_settings` combinando la fila de la organización con los
 * valores de respaldo del salón (`profiles`) y los defaults de Velvet Studio.
 */
export function resolverBrandSettings(
  brand?: Partial<BrandSettingsInput> | null,
  fallback?: LegacySalonBrandFallback | null
): BrandSettingsResolved {
  const organizationId =
    brand?.organizationId?.trim() || fallback?.organizationId?.trim() || '';

  const displayName =
    limpiarTextoOpcional(brand?.displayName, 120) ??
    limpiarTextoOpcional(fallback?.nombreSalon, 120) ??
    'Tu Salón';

  const logoUrl =
    limpiarTextoOpcional(brand?.logoUrl, 1024) ??
    limpiarTextoOpcional(fallback?.logoUrl, 1024);

  const primaryColor = normalizarHexVelvet(
    brand?.primaryColor ?? fallback?.colorPrimario,
    VELVET_DEFAULT_PRIMARY_COLOR
  );

  const accentColor = normalizarHexVelvet(
    brand?.accentColor,
    VELVET_DEFAULT_ACCENT_COLOR
  );

  return {
    organizationId,
    displayName,
    logoUrl,
    primaryColor,
    accentColor,
    customDomain: normalizarDominioPersonalizado(brand?.customDomain),
    publicTagline: limpiarTextoOpcional(brand?.publicTagline, 180),
    legalFooter: limpiarTextoOpcional(brand?.legalFooter, 280),
  };
}

/** Proyección estricta de marca para vistas públicas (`/c/[token]`, etc.). */
export function proyectarBrandPublico(
  resolved: BrandSettingsResolved
): PublicBrandProjection {
  return {
    organizationId: resolved.organizationId,
    displayName: resolved.displayName,
    logoUrl: resolved.logoUrl,
    primaryColor: resolved.primaryColor,
    accentColor: resolved.accentColor,
    publicTagline: resolved.publicTagline,
    legalFooter: resolved.legalFooter,
  };
}

/** Genera un slug limpio y estable (espejo de `slugify_organization_name` en SQL). */
export function generarSlugOrganizacion(
  nombre: string | null | undefined,
  sufijoUuid?: string | null
): string {
  const base = (nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const raiz = base || 'salon';
  if (!sufijoUuid) return raiz.slice(0, 80);

  const sufijo = sufijoUuid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
  return sufijo ? `${raiz.slice(0, 80)}-${sufijo}` : raiz.slice(0, 80);
}
