// ══════════════════════════════════════════════════════════════════════════
// Evaluación de flags — funciones puras, sin I/O ni process.env, para que
// las pruebas fijen cualquier combinación de entorno y salón.
// ══════════════════════════════════════════════════════════════════════════

import { FLAGS, FLAG_IDS, esFlagId, type Entorno, type FlagId } from './registro';

export type OverridesFlags = Partial<Record<FlagId, boolean>>;
export type FlagsEvaluados = Record<FlagId, boolean>;

export interface ContextoFlags {
  entorno: Entorno;
  /** Overrides del entorno (NEXT_PUBLIC_VELLI_FLAGS). */
  entornoOverrides?: OverridesFlags;
  /** Overrides del salón (profiles.feature_flags). */
  salonOverrides?: OverridesFlags | null;
}

export function evaluarFlag(id: FlagId, ctx: ContextoFlags): boolean {
  const def = FLAGS[id];
  if (def.estado === 'retirado') return false;
  const salon = ctx.salonOverrides?.[id];
  if (typeof salon === 'boolean') return salon;
  const entorno = ctx.entornoOverrides?.[id];
  if (typeof entorno === 'boolean') return entorno;
  return def.porDefecto[ctx.entorno];
}

export function evaluarFlags(ctx: ContextoFlags): FlagsEvaluados {
  const out = {} as FlagsEvaluados;
  for (const id of FLAG_IDS) out[id] = evaluarFlag(id, ctx);
  return out;
}

const VERDADERO = new Set(['on', 'true', '1', 'si', 'sí']);
const FALSO = new Set(['off', 'false', '0', 'no']);

/**
 * "cortes=on, app_clientas=off" → { cortes: true, app_clientas: false }.
 * Ids desconocidos o valores que no se entienden se ignoran: un error de
 * tipeo nunca enciende un módulo congelado.
 */
export function parsearFlagsEntorno(texto: string | null | undefined): OverridesFlags {
  const out: OverridesFlags = {};
  if (!texto) return out;
  for (const parte of texto.split(',')) {
    const [clave, valor] = parte.split('=').map((s) => s.trim().toLowerCase());
    if (!clave || valor === undefined || !esFlagId(clave)) continue;
    if (VERDADERO.has(valor)) out[clave] = true;
    else if (FALSO.has(valor)) out[clave] = false;
  }
  return out;
}

/** jsonb de profiles.feature_flags → solo booleanos de flags conocidos. */
export function sanitizarFlagsSalon(valor: unknown): OverridesFlags {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const out: OverridesFlags = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (esFlagId(clave) && typeof v === 'boolean') out[clave] = v;
  }
  return out;
}

/** Claves de kb_flujos que pertenecen a módulos apagados. */
export function flujosOcultos(flags: FlagsEvaluados): string[] {
  return FLAG_IDS.filter((id) => !flags[id]).flatMap((id) => FLAGS[id].flujosKB ?? []);
}

export function filtrarFlujos<T extends { clave: string }>(
  flujos: T[],
  ocultos: readonly string[]
): T[] {
  if (ocultos.length === 0) return flujos;
  const set = new Set(ocultos);
  return flujos.filter((f) => !set.has(f.clave));
}
