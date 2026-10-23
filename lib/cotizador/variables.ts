// ══════════════════════════════════════════════════════════════════════════
// Catálogo de las 4 variables estándar de Velli, derivación desde el
// diagnóstico y avisos del estándar (docs/velli-bi/02-diseno-cotizador.md §1.1).
// Funciones puras, sin efectos secundarios ni acceso a red/DB.
// ══════════════════════════════════════════════════════════════════════════

import type { Consulta } from '@/lib/types';

export type ValorLargo = 'corto' | 'medio' | 'largo' | 'extra_largo';
export type ValorDensidad = 'baja' | 'media' | 'alta';
export type ValorEstadoFibra = 'sana' | 'procesada' | 'sensibilizada';
export type ValorCanas = '0_25' | '25_50' | '50_75' | '75_100';

export type ClaveVariable = 'largo' | 'densidad' | 'estado' | 'canas';
export type OrigenVariable = 'diagnostico' | 'manual';

export interface ValorVariable<T extends string = string> {
  valor: T;
  origen: OrigenVariable;
}

export interface VariablesCotizacion {
  largo?: ValorVariable<ValorLargo>;
  densidad?: ValorVariable<ValorDensidad>;
  estado?: ValorVariable<ValorEstadoFibra>;
  canas?: ValorVariable<ValorCanas>;
}

export interface ValoresVariables {
  largo?: ValorLargo;
  densidad?: ValorDensidad;
  estado?: ValorEstadoFibra;
  canas?: ValorCanas;
}

export type CategoriaServicio =
  | 'color'
  | 'decoloracion'
  | 'decoloración'
  | 'tratamiento'
  | 'corte'
  | 'alisado'
  | 'rizos'
  | 'peinado'
  | 'cuero_cabelludo'
  | 'cuero cabelludo'
  | 'extensiones'
  | 'otro';

export interface OpcionCatalogoVariable<T extends string> {
  valor: T;
  etiqueta: string;
  guia: string;
  esReferencia?: boolean;
}

/** Catálogo estándar configurable de Velli (decisión del 2026-10-22, §1.1). */
export const CATALOGO_VARIABLES: {
  largo: readonly OpcionCatalogoVariable<ValorLargo>[];
  densidad: readonly OpcionCatalogoVariable<ValorDensidad>[];
  estado: readonly OpcionCatalogoVariable<ValorEstadoFibra>[];
  canas: readonly OpcionCatalogoVariable<ValorCanas>[];
} = {
  largo: [
    { valor: 'corto', etiqueta: 'Corto', guia: 'Hasta el mentón (referencia)', esReferencia: true },
    { valor: 'medio', etiqueta: 'Medio', guia: 'Hasta los hombros o la clavícula' },
    { valor: 'largo', etiqueta: 'Largo', guia: 'Hasta la media espalda o la tira del brasier' },
    { valor: 'extra_largo', etiqueta: 'Extra largo', guia: 'Hasta la cintura o más' },
  ],
  densidad: [
    { valor: 'baja', etiqueta: 'Baja', guia: 'Se ve el cuero cabelludo a través del cabello' },
    { valor: 'media', etiqueta: 'Media', guia: 'Se ve en parte (referencia)', esReferencia: true },
    { valor: 'alta', etiqueta: 'Alta', guia: 'No se ve el cuero cabelludo' },
  ],
  estado: [
    {
      valor: 'sana',
      etiqueta: 'Sana / virgen',
      guia: 'Sin química previa ni daño, buena elasticidad (referencia, sin recargo)',
      esReferencia: true,
    },
    {
      valor: 'procesada',
      etiqueta: 'Procesada / porosa',
      guia: 'Química previa (tinte, decoloración, alisado), porosidad alta o daño leve. Sugerir un tratamiento sellante',
    },
    {
      valor: 'sensibilizada',
      etiqueta: 'Sensibilizada / muy dañada',
      guia: 'Elasticidad baja, puntas abiertas severas o daño químico. En químicos: prueba de mechón y aditivo Plex obligatorios',
    },
  ],
  canas: [
    { valor: '0_25', etiqueta: '0–25 %', guia: 'Sin canas o canas sueltas (referencia)', esReferencia: true },
    { valor: '25_50', etiqueta: '25–50 %', guia: 'Hasta la mitad' },
    { valor: '50_75', etiqueta: '50–75 %', guia: 'Más de la mitad. +15 % de producto por saturación' },
    { valor: '75_100', etiqueta: '75–100 %', guia: 'Casi todo cano. +20 % de producto y técnica de prepigmentación' },
  ],
} as const;

const VALORES_LARGO = new Set<ValorLargo>(['corto', 'medio', 'largo', 'extra_largo']);
const VALORES_DENSIDAD = new Set<ValorDensidad>(['baja', 'media', 'alta']);

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Deriva el estado de la fibra desde los campos técnicos e historial de una
 * consulta (§1.1). Gana el nivel más alto que se cumpla:
 *   sensibilizada > procesada > sana.
 * Si no existe ninguno de los datos en la consulta, devuelve `undefined`
 * (nunca inventa datos).
 */
export function derivarEstadoFibra(
  consulta: Partial<Consulta> | null | undefined
): ValorEstadoFibra | undefined {
  if (!consulta) return undefined;

  const elasticidad = consulta.elasticidad;
  const porosidad = consulta.porosidad;
  const puntas = consulta.estadoPuntas ? normalizarTexto(consulta.estadoPuntas) : '';
  const tipoDano = (consulta.tipoDano ?? []).map(normalizarTexto).filter(Boolean);
  const quimicos = (consulta.quimicos ?? []).map(normalizarTexto).filter(Boolean);

  const perfil = (consulta.perfilExtendido ?? {}) as Record<string, unknown>;
  const procesosExt = Array.isArray(perfil['procesosQuimicos'])
    ? (perfil['procesosQuimicos'] as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map(normalizarTexto)
    : [];

  const hayAlgunDato =
    Boolean(elasticidad) ||
    Boolean(porosidad) ||
    puntas.length > 0 ||
    tipoDano.length > 0 ||
    quimicos.length > 0 ||
    procesosExt.length > 0;

  if (!hayAlgunDato) return undefined;

  // 1. Nivel más alto: Sensibilizada / muy dañada
  const puntasSeveras = puntas.includes('severa');
  const danoQuimico = tipoDano.some((d) => d.includes('quimico'));
  if (elasticidad === 'baja' || puntasSeveras || danoQuimico) {
    return 'sensibilizada';
  }

  // 2. Nivel intermedio: Procesada / porosa
  const tieneQuimicaPrevia =
    quimicos.some((q) => q !== 'ninguno' && q !== 'sin quimicos') ||
    procesosExt.some((p) => p !== 'ninguno');
  const puntasLeves = puntas.includes('abiertas leves') || puntas.includes('leve');
  const danoMecanicoOTermico = tipoDano.some(
    (d) => d.includes('mecanico') || d.includes('termico') || d.includes('transicion')
  );

  if (
    tieneQuimicaPrevia ||
    porosidad === 'alta' ||
    elasticidad === 'media' ||
    puntasLeves ||
    danoMecanicoOTermico
  ) {
    return 'procesada';
  }

  // 3. Nivel base: Sana / virgen (hay datos y ninguno activó daño ni proceso)
  return 'sana';
}

export interface ResultadoDerivacionCanas {
  valor?: ValorCanas;
  origen?: OrigenVariable;
  /** true cuando el diagnóstico tiene `mas_50` y falta el toque de desempate (50_75 vs 75_100). */
  porPrecisar: boolean;
}

/**
 * Deriva el tramo de canas desde `perfilExtendido` (§1.1 y R5).
 * Si la consulta tiene `mas_50` y no se pasa `desempateCanas`, deja `valor`
 * vacío y devuelve `porPrecisar: true` para pedir un toque.
 */
export function derivarCanasDesdePerfil(
  perfilExtendido: Record<string, unknown> | null | undefined,
  desempateCanas?: '50_75' | '75_100'
): ResultadoDerivacionCanas {
  if (!perfilExtendido) return { porPrecisar: false };

  // Si ya viene un tramo directo o el toque resuelto
  const estadoCanas = perfilExtendido['estadoCanas'];
  if (estadoCanas === 'sin_canas' || estadoCanas === 'menos_25' || estadoCanas === '0_25') {
    return { valor: '0_25', origen: 'diagnostico', porPrecisar: false };
  }
  if (estadoCanas === 'entre_25_50' || estadoCanas === '25_50') {
    return { valor: '25_50', origen: 'diagnostico', porPrecisar: false };
  }
  if (estadoCanas === 'entre_50_75' || estadoCanas === '50_75') {
    return { valor: '50_75', origen: 'diagnostico', porPrecisar: false };
  }
  if (estadoCanas === 'mas_75' || estadoCanas === '75_100') {
    return { valor: '75_100', origen: 'diagnostico', porPrecisar: false };
  }
  if (estadoCanas === 'mas_50') {
    if (desempateCanas === '50_75' || desempateCanas === '75_100') {
      return { valor: desempateCanas, origen: 'manual', porPrecisar: false };
    }
    return { porPrecisar: true };
  }

  // Respaldo numérico si existiera porcentajeCanas en perfilExtendido
  const pct = perfilExtendido['porcentajeCanas'];
  if (typeof pct === 'number' && Number.isFinite(pct) && pct >= 0) {
    if (pct <= 25) return { valor: '0_25', origen: 'diagnostico', porPrecisar: false };
    if (pct <= 50) return { valor: '25_50', origen: 'diagnostico', porPrecisar: false };
    if (pct <= 75) return { valor: '50_75', origen: 'diagnostico', porPrecisar: false };
    return { valor: '75_100', origen: 'diagnostico', porPrecisar: false };
  }

  return { porPrecisar: false };
}

export interface ResultadoDerivacionVariables {
  variables: VariablesCotizacion;
  /** Variables que quedaron sin valor y requieren 1 toque manual en el cotizador. */
  faltantes: ClaveVariable[];
  /** true cuando `estadoCanas` es `mas_50` y requiere toque de desempate entre `50_75` y `75_100`. */
  canasPorPrecisar: boolean;
}

/**
 * Deriva las 4 variables de cotización desde una consulta existente (§1.1).
 * No inventa ningún dato: lo que no esté en la consulta queda `undefined`
 * y se lista en `faltantes`.
 */
export function derivarVariablesDesdeConsulta(
  consulta: Partial<Consulta> | null | undefined,
  opciones?: {
    desempateCanas?: '50_75' | '75_100';
    manuales?: Partial<ValoresVariables>;
  }
): ResultadoDerivacionVariables {
  const variables: VariablesCotizacion = {};
  const perfil = (consulta?.perfilExtendido ?? undefined) as Record<string, unknown> | undefined;

  // 1. Largo (dimensión `largoActual` en perfilExtendido si existe)
  const largoExt = perfil?.['largoActual'];
  if (typeof largoExt === 'string' && VALORES_LARGO.has(largoExt as ValorLargo)) {
    variables.largo = { valor: largoExt as ValorLargo, origen: 'diagnostico' };
  }

  // 2. Densidad
  const densidad = consulta?.densidad;
  if (typeof densidad === 'string' && VALORES_DENSIDAD.has(densidad as ValorDensidad)) {
    variables.densidad = { valor: densidad as ValorDensidad, origen: 'diagnostico' };
  }

  // 3. Estado de la fibra
  const estado = derivarEstadoFibra(consulta);
  if (estado) {
    variables.estado = { valor: estado, origen: 'diagnostico' };
  }

  // 4. Canas
  const canasRes = derivarCanasDesdePerfil(perfil, opciones?.desempateCanas);
  if (canasRes.valor && canasRes.origen) {
    variables.canas = { valor: canasRes.valor, origen: canasRes.origen };
  }

  // Sobrescrituras manuales explícitas (cuando la estilista toca un chip)
  const manuales = opciones?.manuales;
  if (manuales?.largo) variables.largo = { valor: manuales.largo, origen: 'manual' };
  if (manuales?.densidad) variables.densidad = { valor: manuales.densidad, origen: 'manual' };
  if (manuales?.estado) variables.estado = { valor: manuales.estado, origen: 'manual' };
  if (manuales?.canas) variables.canas = { valor: manuales.canas, origen: 'manual' };

  const faltantes: ClaveVariable[] = [];
  if (!variables.largo) faltantes.push('largo');
  if (!variables.densidad) faltantes.push('densidad');
  if (!variables.estado) faltantes.push('estado');
  if (!variables.canas) faltantes.push('canas');

  return {
    variables,
    faltantes,
    canasPorPrecisar: !variables.canas && canasRes.porPrecisar,
  };
}

/** Extrae solo los valores simples de un `VariablesCotizacion` o `ValoresVariables`. */
export function extraerValoresVariables(
  entrada: VariablesCotizacion | ValoresVariables
): ValoresVariables {
  const extraer = <T extends string>(v: ValorVariable<T> | T | undefined): T | undefined => {
    if (!v) return undefined;
    return typeof v === 'string' ? v : v.valor;
  };
  return {
    largo: extraer(entrada.largo as ValorVariable<ValorLargo> | ValorLargo | undefined),
    densidad: extraer(entrada.densidad as ValorVariable<ValorDensidad> | ValorDensidad | undefined),
    estado: extraer(entrada.estado as ValorVariable<ValorEstadoFibra> | ValorEstadoFibra | undefined),
    canas: extraer(entrada.canas as ValorVariable<ValorCanas> | ValorCanas | undefined),
  };
}

// ── Avisos del estándar (§1.1 y Simulador!B21) ─────────────────────────────

export type CodigoAvisoEstandar =
  | 'prueba_mechon_plex'
  | 'tratamiento_sellante'
  | 'prepigmentacion';

export interface AvisoEstandar {
  codigo: CodigoAvisoEstandar;
  mensaje: string;
  obligatorio: boolean;
}

export function esServicioQuimico(
  categoria?: CategoriaServicio | string,
  usaFormulaColor?: boolean
): boolean {
  if (usaFormulaColor) return true;
  if (!categoria) return false;
  const norm = normalizarTexto(categoria);
  return norm === 'color' || norm === 'decoloracion' || norm === 'alisado';
}

/**
 * Devuelve los avisos del estándar de Velli (§1.1):
 * - `prueba_mechon_plex` (obligatorio): en servicios químicos con fibra `sensibilizada`.
 * - `tratamiento_sellante`: con fibra `procesada`.
 * - `prepigmentacion`: con canas `75_100` en servicios con color (`usaFormulaColor` o categoría `color`).
 */
export function evaluarAvisosEstandar(entrada: {
  estado?: ValorEstadoFibra;
  canas?: ValorCanas;
  categoriaServicio?: CategoriaServicio | string;
  usaFormulaColor?: boolean;
}): AvisoEstandar[] {
  const avisos: AvisoEstandar[] = [];
  const quimico = esServicioQuimico(entrada.categoriaServicio, entrada.usaFormulaColor);
  const usaColor =
    entrada.usaFormulaColor ??
    (entrada.categoriaServicio ? normalizarTexto(entrada.categoriaServicio) === 'color' : false);

  if (entrada.estado === 'sensibilizada' && quimico) {
    avisos.push({
      codigo: 'prueba_mechon_plex',
      mensaje: 'Obligatorio: prueba de mechón y aditivo protector Plex.',
      obligatorio: true,
    });
  } else if (entrada.estado === 'procesada') {
    avisos.push({
      codigo: 'tratamiento_sellante',
      mensaje: 'Sugerir un tratamiento sellante.',
      obligatorio: false,
    });
  }

  if (entrada.canas === '75_100' && usaColor) {
    avisos.push({
      codigo: 'prepigmentacion',
      mensaje: 'Técnica de prepigmentación.',
      obligatorio: false,
    });
  }

  return avisos;
}

/** Formatea los avisos en una sola cadena idéntica a `Simulador!B21` de la plantilla Excel. */
export function textoAvisosEstandar(avisos: readonly AvisoEstandar[]): string {
  return avisos.map((a) => a.mensaje).join(' ');
}
