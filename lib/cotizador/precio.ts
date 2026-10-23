// ══════════════════════════════════════════════════════════════════════════
// Cálculo puro del precio de una cotización (docs/velli-bi/02-diseno-cotizador.md §1.2).
//
// Fórmula:
//   precio = redondeo( (precio_base + Σ suma) × (1 + Σ porcentaje / 100) )
// aplicando únicamente las variables activas para ese servicio.
// ══════════════════════════════════════════════════════════════════════════

import {
  extraerValoresVariables,
  type ClaveVariable,
  type ValorCanas,
  type ValorDensidad,
  type ValorEstadoFibra,
  type ValorLargo,
  type ValoresVariables,
  type VariablesCotizacion,
} from './variables';

export type MultiploRedondeo = 1 | 100 | 500 | 1000 | 5000 | 10000 | number;

export interface AjusteValorVariable {
  /** Suma fija en COP (ej. 15000). */
  suma?: number;
  /** Porcentaje en puntos porcentuales (ej. 20 para +20 %). */
  porcentaje?: number;
}

export interface AjustesPlantilla {
  largo?: Partial<Record<ValorLargo, AjusteValorVariable>>;
  densidad?: Partial<Record<ValorDensidad, AjusteValorVariable>>;
  estado?: Partial<Record<ValorEstadoFibra, AjusteValorVariable>>;
  canas?: Partial<Record<ValorCanas, AjusteValorVariable>>;
}

export type VariablesActivasServicio =
  | Partial<Record<ClaveVariable, boolean>>
  | readonly ClaveVariable[];

export interface PlantillaPrecioInput {
  precioBase: number;
  ajustes?: AjustesPlantilla;
  /** Variables que afectan el precio de este servicio. Si se omite, aplican las 4. */
  variablesActivas?: VariablesActivasServicio;
  /** Múltiplo de redondeo en COP (por defecto 1000). */
  redondeo?: MultiploRedondeo;
}

export interface DesgloseVariablePrecio {
  variable: ClaveVariable;
  valor: string;
  activa: boolean;
  suma: number;
  porcentaje: number;
}

export interface ResultadoPrecioCotizacion {
  precioBase: number;
  totalSuma: number;
  totalPorcentaje: number;
  precioSinRedondear: number;
  redondeo: number;
  precioCalculado: number;
  desglose: DesgloseVariablePrecio[];
}

export const REDONDEO_DEFECTO = 1000;

/** Ajustes de ejemplo de `generar_plantilla.py` (hoja Ajustes). */
export const AJUSTES_EJEMPLO_PLANTILLA: AjustesPlantilla = {
  largo: {
    corto: { suma: 0, porcentaje: 0 },
    medio: { suma: 0, porcentaje: 20 },
    largo: { suma: 0, porcentaje: 40 },
    extra_largo: { suma: 0, porcentaje: 60 },
  },
  densidad: {
    baja: { suma: 0, porcentaje: 0 },
    media: { suma: 0, porcentaje: 0 },
    alta: { suma: 0, porcentaje: 15 },
  },
  estado: {
    sana: { suma: 0, porcentaje: 0 },
    procesada: { suma: 10000, porcentaje: 0 },
    sensibilizada: { suma: 20000, porcentaje: 0 },
  },
  canas: {
    '0_25': { suma: 0, porcentaje: 0 },
    '25_50': { suma: 10000, porcentaje: 0 },
    '50_75': { suma: 15000, porcentaje: 0 },
    '75_100': { suma: 25000, porcentaje: 0 },
  },
};

function variableEstaActiva(
  variable: ClaveVariable,
  activas?: VariablesActivasServicio
): boolean {
  if (!activas) return true;
  if (Array.isArray(activas)) {
    return activas.includes(variable);
  }
  const flag = (activas as Partial<Record<ClaveVariable, boolean>>)[variable];
  return flag ?? true;
}

/** Redondea un monto en COP al múltiplo indicado (por defecto 1000). */
export function redondearPrecio(
  monto: number,
  redondeo: MultiploRedondeo = REDONDEO_DEFECTO
): number {
  const multiplo = Math.max(1, Math.trunc(redondeo || REDONDEO_DEFECTO));
  return Math.round(monto / multiplo) * multiplo;
}

/**
 * Calcula el precio de la cotización según §1.2:
 *   precio = redondeo((precio_base + Σ suma) * (1 + Σ porcentaje / 100))
 */
export function calcularPrecioCotizacion(
  plantilla: PlantillaPrecioInput,
  variablesEntrada: VariablesCotizacion | ValoresVariables
): ResultadoPrecioCotizacion {
  const precioBase = Math.max(0, plantilla.precioBase);
  const redondeo = Math.max(1, Math.trunc(plantilla.redondeo ?? REDONDEO_DEFECTO));
  const valores = extraerValoresVariables(variablesEntrada);
  const ajustes = plantilla.ajustes ?? {};

  const ordenVariables: ClaveVariable[] = ['largo', 'densidad', 'estado', 'canas'];
  let totalSuma = 0;
  let totalPorcentaje = 0;
  const desglose: DesgloseVariablePrecio[] = [];

  for (const clave of ordenVariables) {
    const valor = valores[clave];
    const activa = variableEstaActiva(clave, plantilla.variablesActivas);
    if (!valor) continue;

    const tablaVar = ajustes[clave] as Record<string, AjusteValorVariable | undefined> | undefined;
    const ajuste = tablaVar?.[valor];
    const suma = activa && typeof ajuste?.suma === 'number' ? ajuste.suma : 0;
    const porcentaje = activa && typeof ajuste?.porcentaje === 'number' ? ajuste.porcentaje : 0;

    totalSuma += suma;
    totalPorcentaje += porcentaje;

    desglose.push({
      variable: clave,
      valor,
      activa,
      suma,
      porcentaje,
    });
  }

  const precioSinRedondear = (precioBase + totalSuma) * (1 + totalPorcentaje / 100);
  const precioCalculado = redondearPrecio(precioSinRedondear, redondeo);

  return {
    precioBase,
    totalSuma,
    totalPorcentaje,
    precioSinRedondear,
    redondeo,
    precioCalculado,
    desglose,
  };
}
