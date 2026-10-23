// ══════════════════════════════════════════════════════════════════════════
// Cálculo puro de comisión, margen del salón y protección de rentabilidad
// (docs/velli-bi/02-diseno-cotizador.md §3 punto 6).
//
// Precedencia de reglas de comisión:
//   estilista + servicio > estilista > servicio > salón
// ══════════════════════════════════════════════════════════════════════════

import { REDONDEO_DEFECTO, type MultiploRedondeo } from './precio';

export type TipoComision = 'porcentaje' | 'fijo';
export type BaseComision = 'precio' | 'precio_menos_producto';
export type AlcanceComision = 'estilista_servicio' | 'estilista' | 'servicio' | 'salon';

export interface ReglaComision {
  id?: string;
  estilistaId?: string | null;
  servicioId?: string | null;
  tipo: TipoComision;
  /** Porcentaje (0..100, o 0..1 que se normaliza) si `tipo === 'porcentaje'`, o monto COP si `tipo === 'fijo'`. */
  valor: number;
  base?: BaseComision;
  vigenteHasta?: string | null;
}

export interface ComisionDetalleInmutable {
  reglaId?: string;
  alcance: AlcanceComision | 'sin_regla';
  tipo: TipoComision;
  valor: number;
  base: BaseComision;
  montoBaseCop: number;
  comisionCop: number;
}

export interface ResultadoComisionYMargen {
  reglaAplicada?: ReglaComision;
  alcance: AlcanceComision | 'sin_regla';
  comision: number;
  detalle: ComisionDetalleInmutable;
  /** Margen libre del salón en COP (`precio - costoProducto - comision`). */
  margenSalon: number;
  /** Porcentaje de margen en puntos porcentuales (ej. 18.06 para 18,06 %). */
  margenPorcentaje: number;
  /** Proporción de margen entre 0 y 1 (ej. 0.1806). */
  margenRatio: number;
  /** true si el margen cae por debajo del umbral mínimo configurado (por defecto 20 %). */
  alertaMargenBajo: boolean;
  /** Umbral de margen mínimo evaluado en puntos porcentuales (por defecto 20). */
  umbralMargenPorcentaje: number;
  /** Precio que debería cobrarse (redondeado hacia arriba) para conservar el margen mínimo. */
  precioSugeridoProteccion: number;
  /** Comisión en COP si se calculara sobre `precio_menos_producto`. */
  comisionSobrePrecioMenosProducto: number;
  /** Cuánto ganaría el salón en COP si la comisión se calcula sobre `precio_menos_producto`. */
  margenConComisionNeta: number;
}

export const UMBRAL_MARGEN_MINIMO_DEFECTO = 20;

/**
 * Normaliza un porcentaje que puede venir como `40` (40 %) o `0.40` (40 %).
 * Para valores entre 0 y 1 exclusivos, se interpreta como fracción si <= 1.
 */
function normalizarPorcentaje(valor: number): number {
  if (valor > 0 && valor <= 1) {
    return valor * 100;
  }
  return Math.max(0, valor);
}

/**
 * Selecciona la regla de comisión vigente de mayor especificidad (§3.6):
 *   1. estilista + servicio
 *   2. estilista (cualquier servicio)
 *   3. servicio (cualquier estilista)
 *   4. salón (general: estilista null y servicio null)
 */
export function seleccionarReglaComision(
  reglas: readonly ReglaComision[],
  contexto: { estilistaId?: string | null; servicioId?: string | null }
): { regla?: ReglaComision; alcance: AlcanceComision | 'sin_regla' } {
  const vigentes = reglas.filter((r) => r.vigenteHasta === undefined || r.vigenteHasta === null);
  const { estilistaId, servicioId } = contexto;

  if (estilistaId && servicioId) {
    const r1 = vigentes.find(
      (r) => r.estilistaId === estilistaId && r.servicioId === servicioId
    );
    if (r1) return { regla: r1, alcance: 'estilista_servicio' };
  }

  if (estilistaId) {
    const r2 = vigentes.find(
      (r) => r.estilistaId === estilistaId && !r.servicioId
    );
    if (r2) return { regla: r2, alcance: 'estilista' };
  }

  if (servicioId) {
    const r3 = vigentes.find(
      (r) => !r.estilistaId && r.servicioId === servicioId
    );
    if (r3) return { regla: r3, alcance: 'servicio' };
  }

  const r4 = vigentes.find((r) => !r.estilistaId && !r.servicioId);
  if (r4) return { regla: r4, alcance: 'salon' };

  return { alcance: 'sin_regla' };
}

function redondearHaciaArriba(monto: number, multiplo: number): number {
  const m = Math.max(1, Math.trunc(multiplo || REDONDEO_DEFECTO));
  return Math.ceil(monto / m) * m;
}

/**
 * Calcula la comisión, el margen libre del salón y las métricas de protección
 * de rentabilidad (§3.6).
 */
export function calcularComisionYMargen(entrada: {
  precio: number;
  costoProducto: number;
  /** Lista de reglas de comisión del salón (se elige por precedencia) o una regla única. */
  reglas?: readonly ReglaComision[];
  regla?: ReglaComision | null;
  estilistaId?: string | null;
  servicioId?: string | null;
  /** Umbral mínimo de margen del salón (por defecto 20 %, acepta 20 o 0.20). */
  umbralMargenMinimo?: number;
  /** Múltiplo de redondeo para `precioSugeridoProteccion` (por defecto 1000). */
  redondeo?: MultiploRedondeo;
}): ResultadoComisionYMargen {
  const precio = Math.max(0, Math.round(entrada.precio));
  const costoProducto = Math.max(0, Math.round(entrada.costoProducto));
  const umbralPct =
    entrada.umbralMargenMinimo !== undefined
      ? normalizarPorcentaje(entrada.umbralMargenMinimo)
      : UMBRAL_MARGEN_MINIMO_DEFECTO;
  const umbralRatio = umbralPct / 100;
  const multiplo = Math.max(1, Math.trunc(entrada.redondeo ?? REDONDEO_DEFECTO));

  const seleccion = entrada.regla
    ? {
        regla: entrada.regla,
        alcance: (entrada.regla.estilistaId && entrada.regla.servicioId
          ? 'estilista_servicio'
          : entrada.regla.estilistaId
            ? 'estilista'
            : entrada.regla.servicioId
              ? 'servicio'
              : 'salon') as AlcanceComision,
      }
    : seleccionarReglaComision(entrada.reglas ?? [], {
        estilistaId: entrada.estilistaId,
        servicioId: entrada.servicioId,
      });

  const regla = seleccion.regla;
  const tipo: TipoComision = regla?.tipo ?? 'porcentaje';
  const base: BaseComision = regla?.base ?? 'precio';
  const valorNormalizado = regla
    ? tipo === 'porcentaje'
      ? normalizarPorcentaje(regla.valor)
      : Math.max(0, regla.valor)
    : 0;

  const baseNeta = Math.max(0, precio - costoProducto);
  const montoBaseCop = base === 'precio_menos_producto' ? baseNeta : precio;

  const comision = regla
    ? tipo === 'porcentaje'
      ? Math.round(montoBaseCop * (valorNormalizado / 100))
      : Math.round(valorNormalizado)
    : 0;

  // Simulación con comisión sobre `precio_menos_producto`
  const comisionSobrePrecioMenosProducto = regla
    ? tipo === 'porcentaje'
      ? Math.round(baseNeta * (valorNormalizado / 100))
      : Math.round(valorNormalizado)
    : 0;
  const margenConComisionNeta = precio - costoProducto - comisionSobrePrecioMenosProducto;

  const margenSalon = precio - costoProducto - comision;
  const margenRatio = precio > 0 ? margenSalon / precio : 0;
  const margenPorcentaje = Math.round((margenRatio * 100 + Number.EPSILON) * 100) / 100;

  const alertaMargenBajo = precio === 0 ? costoProducto > 0 : margenRatio < umbralRatio - 1e-9;

  // Cálculo del precio sugerido para mantener `umbralRatio`
  let precioSugeridoProteccion = precio;
  if (alertaMargenBajo) {
    if (tipo === 'porcentaje') {
      const r = valorNormalizado / 100;
      const denominador = 1 - r - umbralRatio;
      if (denominador > 0) {
        const numerador =
          base === 'precio_menos_producto' ? costoProducto * (1 - r) : costoProducto;
        const pMin = numerador / denominador;
        precioSugeridoProteccion = Math.max(precio, redondearHaciaArriba(pMin, multiplo));
      } else {
        precioSugeridoProteccion = Infinity;
      }
    } else {
      const denominador = 1 - umbralRatio;
      if (denominador > 0) {
        const pMin = (costoProducto + valorNormalizado) / denominador;
        precioSugeridoProteccion = Math.max(precio, redondearHaciaArriba(pMin, multiplo));
      } else {
        precioSugeridoProteccion = Infinity;
      }
    }
  }

  const detalle: ComisionDetalleInmutable = {
    reglaId: regla?.id,
    alcance: seleccion.alcance,
    tipo,
    valor: valorNormalizado,
    base,
    montoBaseCop,
    comisionCop: comision,
  };

  return {
    reglaAplicada: regla,
    alcance: seleccion.alcance,
    comision,
    detalle,
    margenSalon,
    margenPorcentaje,
    margenRatio,
    alertaMargenBajo,
    umbralMargenPorcentaje: umbralPct,
    precioSugeridoProteccion,
    comisionSobrePrecioMenosProducto,
    margenConComisionNeta,
  };
}
