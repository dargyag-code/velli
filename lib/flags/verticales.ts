// ══════════════════════════════════════════════════════════════════════════
// Vertical Packs sobre el motor de Feature Flags (sin alterar `registro.ts`).
//
// `hair_clinical_pack` activa el bloque clínico especializado de peluquería:
// - Diagnóstico capilar clínico
// - Motor de colorimetría CO-01..CO-10
// - Visagismo y arquitectura capilar
//
// Regla de activación:
// 1. Si existe un override booleano explícito para `hair_clinical_pack`
//    (en `feature_flags` de la organización/salón o en `NEXT_PUBLIC_VELLI_FLAGS`),
//    rige ese override (`salon/org > entorno`).
// 2. Sin override explícito, se activa únicamente cuando
//    `vertical === 'hair_studio'`.
// 3. Para cuentas existentes sin vertical declarada, `hair_studio` es siempre
//    la vertical por defecto para preservar compatibilidad total.
// ══════════════════════════════════════════════════════════════════════════

export type VerticalSalon =
  | 'hair_studio'
  | 'nail_bar'
  | 'barber_studio'
  | 'spa_estetica'
  | 'beauty_lounge';

export const VERTICALES: readonly VerticalSalon[] = [
  'hair_studio',
  'nail_bar',
  'barber_studio',
  'spa_estetica',
  'beauty_lounge',
] as const;

export const VERTICAL_POR_DEFECTO: VerticalSalon = 'hair_studio';

export type VerticalPackId = 'hair_clinical_pack';

export const VERTICAL_PACK_IDS: readonly VerticalPackId[] = ['hair_clinical_pack'] as const;

export const REGLAS_COLORIMETRIA_CLINICAL = [
  'CO-01',
  'CO-02',
  'CO-03',
  'CO-04',
  'CO-05',
  'CO-06',
  'CO-07',
  'CO-08',
  'CO-09',
  'CO-10',
] as const;

export type CodigoReglaColorimetriaPack = (typeof REGLAS_COLORIMETRIA_CLINICAL)[number];

export type OverridesVerticalPacks = Partial<Record<VerticalPackId, boolean>>;

export interface ContextoVerticalFlags {
  /** Vertical de la organización. Si falta o es nula, usa `'hair_studio'`. */
  vertical?: VerticalSalon | string | null;
  /** Overrides desde variables de entorno (`NEXT_PUBLIC_VELLI_FLAGS`). */
  entornoPackOverrides?: OverridesVerticalPacks;
  /** Overrides desde `organizations.feature_flags` o `profiles.feature_flags`. */
  salonPackOverrides?: OverridesVerticalPacks | Record<string, unknown> | null;
}

export interface EstadoHairClinicalPack {
  packActivo: boolean;
  verticalEfectiva: VerticalSalon;
  diagnosticoCapilar: boolean;
  colorimetria: boolean;
  reglasColorimetria: readonly CodigoReglaColorimetriaPack[];
  visagismo: boolean;
}

export interface EvaluacionVerticalPacks {
  verticalEfectiva: VerticalSalon;
  packs: Record<VerticalPackId, boolean>;
  hairClinical: EstadoHairClinicalPack;
}

const VERDADERO = new Set(['on', 'true', '1', 'si', 'sí']);
const FALSO = new Set(['off', 'false', '0', 'no']);

export function esVerticalSalon(valor: unknown): valor is VerticalSalon {
  return typeof valor === 'string' && (VERTICALES as readonly string[]).includes(valor);
}

export function esVerticalPackId(valor: unknown): valor is VerticalPackId {
  return typeof valor === 'string' && (VERTICAL_PACK_IDS as readonly string[]).includes(valor);
}

/**
 * Normaliza la vertical de una organización. Si no viene informada (cuentas
 * existentes previas a multi-tenant) o no es reconocida, retorna `'hair_studio'`.
 */
export function normalizarVerticalSalon(valor?: string | null): VerticalSalon {
  if (!valor) return VERTICAL_POR_DEFECTO;
  const limpio = valor.trim().toLowerCase();
  return esVerticalSalon(limpio) ? limpio : VERTICAL_POR_DEFECTO;
}

/** Extrae overrides de Vertical Packs desde `NEXT_PUBLIC_VELLI_FLAGS`. */
export function parsearPacksEntorno(texto: string | null | undefined): OverridesVerticalPacks {
  const out: OverridesVerticalPacks = {};
  if (!texto) return out;
  for (const parte of texto.split(',')) {
    const [clave, valor] = parte.split('=').map((s) => s.trim().toLowerCase());
    if (!clave || valor === undefined || !esVerticalPackId(clave)) continue;
    if (VERDADERO.has(valor)) out[clave] = true;
    else if (FALSO.has(valor)) out[clave] = false;
  }
  return out;
}

/** Extrae solo booleanos válidos de packs conocidos desde un jsonb de flags. */
export function sanitizarPacksSalon(valor: unknown): OverridesVerticalPacks {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const out: OverridesVerticalPacks = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (esVerticalPackId(clave) && typeof v === 'boolean') {
      out[clave] = v;
    }
  }
  return out;
}

export function evaluarVerticalPack(
  packId: VerticalPackId,
  ctx: ContextoVerticalFlags = {}
): boolean {
  const verticalEfectiva = normalizarVerticalSalon(ctx.vertical);
  const salonPacks = sanitizarPacksSalon(ctx.salonPackOverrides);

  const overrideSalon = salonPacks[packId];
  if (typeof overrideSalon === 'boolean') return overrideSalon;

  const overrideEntorno = ctx.entornoPackOverrides?.[packId];
  if (typeof overrideEntorno === 'boolean') return overrideEntorno;

  if (packId === 'hair_clinical_pack') {
    return verticalEfectiva === 'hair_studio';
  }
  return false;
}

export function evaluarHairClinicalPack(
  ctx: ContextoVerticalFlags = {}
): EstadoHairClinicalPack {
  const verticalEfectiva = normalizarVerticalSalon(ctx.vertical);
  const packActivo = evaluarVerticalPack('hair_clinical_pack', ctx);

  return {
    packActivo,
    verticalEfectiva,
    diagnosticoCapilar: packActivo,
    colorimetria: packActivo,
    reglasColorimetria: packActivo ? REGLAS_COLORIMETRIA_CLINICAL : [],
    visagismo: packActivo,
  };
}

export function evaluarVerticalPacks(
  ctx: ContextoVerticalFlags = {}
): EvaluacionVerticalPacks {
  const hairClinical = evaluarHairClinicalPack(ctx);
  return {
    verticalEfectiva: hairClinical.verticalEfectiva,
    packs: {
      hair_clinical_pack: hairClinical.packActivo,
    },
    hairClinical,
  };
}
