// ══════════════════════════════════════════════════════════════════════════
// Flags del entorno actual. Las variables se leen LITERALMENTE
// (process.env.NEXT_PUBLIC_…): Next solo incrusta en el bundle del cliente
// los accesos literales, y lo hace al construir — cambiar un valor exige
// redeploy de ese entorno. Para encender un módulo a un solo salón sin
// redeploy está profiles.feature_flags.
//
//   NEXT_PUBLIC_VELLI_FLAGS="cortes=on,app_clientas=off"
// ══════════════════════════════════════════════════════════════════════════

import type { Entorno } from './registro';
import { evaluarFlags, parsearFlagsEntorno, type FlagsEvaluados, type OverridesFlags } from './evaluar';
import {
  evaluarHairClinicalPack,
  parsearPacksEntorno,
  type EstadoHairClinicalPack,
  type OverridesVerticalPacks,
  type VerticalSalon,
} from './verticales';

export * from './registro';
export * from './evaluar';
export * from './verticales';

export function entornoActual(): Entorno {
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercel === 'production' || vercel === 'preview' || vercel === 'development') return vercel;
  if (process.env.NODE_ENV === 'test') return 'test';
  // Fuera de Vercel, cualquier build cuenta como producción: el lado seguro
  // para módulos congelados.
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}

export function overridesDelEntorno(): OverridesFlags {
  const overrides = parsearFlagsEntorno(process.env.NEXT_PUBLIC_VELLI_FLAGS);
  // Compatibilidad con el flag previo de IA facial.
  if (overrides.ia_facial === undefined && process.env.NEXT_PUBLIC_FEATURE_IA_FACIAL === 'true') {
    overrides.ia_facial = true;
  }
  return overrides;
}

/** Flags efectivos: entorno actual + overrides del salón si se conocen. */
export function flagsActivos(salonOverrides?: OverridesFlags | null): FlagsEvaluados {
  return evaluarFlags({
    entorno: entornoActual(),
    entornoOverrides: overridesDelEntorno(),
    salonOverrides,
  });
}

export function overridesPacksDelEntorno(): OverridesVerticalPacks {
  return parsearPacksEntorno(process.env.NEXT_PUBLIC_VELLI_FLAGS);
}

/**
 * Evalúa el `hair_clinical_pack` combinando la vertical de la organización
 * (`'hair_studio'` por defecto para cuentas existentes) con overrides de
 * entorno y de la organización/salón.
 */
export function hairClinicalPackActivo(opciones?: {
  vertical?: VerticalSalon | string | null;
  salonPackOverrides?: OverridesVerticalPacks | Record<string, unknown> | null;
}): EstadoHairClinicalPack {
  return evaluarHairClinicalPack({
    vertical: opciones?.vertical,
    entornoPackOverrides: overridesPacksDelEntorno(),
    salonPackOverrides: opciones?.salonPackOverrides,
  });
}
