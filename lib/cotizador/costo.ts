// ══════════════════════════════════════════════════════════════════════════
// Cálculo puro del costo de producto de una cotización
// (docs/velli-bi/02-diseno-cotizador.md §3).
//
// Regla de arquitectura: las reglas CO-01 a CO-10 de la calculadora de
// color NO se tocan. El cotizador lee su fórmula o los gramos base de la
// plantilla, aplica los factores de consumo (largo × densidad × canas) y
// devuelve el total en COP junto con `costo_detalle` inmutable.
// ══════════════════════════════════════════════════════════════════════════

import {
  extraerValoresVariables,
  type ValorCanas,
  type ValorDensidad,
  type ValorLargo,
  type ValoresVariables,
  type VariablesCotizacion,
} from './variables';

export const GRAMOS_TINTE_BASE_DEFECTO = 60;
export const PROPORCION_OXIDANTE_DEFECTO = 1.5;

export interface FactoresConsumoPlantilla {
  largo?: Partial<Record<ValorLargo, number>>;
  densidad?: Partial<Record<ValorDensidad, number>>;
  canas?: Partial<Record<ValorCanas, number>>;
}

/** Factores por defecto del estándar de Velli (§1.1, §3 y hoja Consumo). */
export const FACTORES_CONSUMO_DEFECTO: {
  largo: Record<ValorLargo, number>;
  densidad: Record<ValorDensidad, number>;
  canas: Record<ValorCanas, number>;
} = {
  largo: {
    corto: 1.0,
    medio: 1.5,
    largo: 2.0,
    extra_largo: 3.0,
  },
  densidad: {
    baja: 0.8,
    media: 1.0,
    alta: 1.3,
  },
  canas: {
    '0_25': 1.0,
    '25_50': 1.0,
    '50_75': 1.15,
    '75_100': 1.2,
  },
};

export interface ProductoSalonCostoInput {
  id?: string;
  nombre?: string;
  marca?: string;
  /** Cantidad de la presentación (ej. 60 para tubo de 60g, 1000 para botella de 1000ml). */
  presentacionCantidad?: number;
  unidad?: 'g' | 'ml' | 'unidad';
  /** Precio de compra de la presentación en COP (ej. 30000). */
  precioCompra?: number;
  /** Precio directo por gramo o ml en COP (alternativa a precioCompra / presentacionCantidad). */
  precioUnitario?: number;
}

export interface ComponenteFormulaCostoInput {
  descripcion: string;
  gramos: number;
  notaRegla?: string;
  producto?: ProductoSalonCostoInput;
}

export interface FormulaColorCostoInput {
  componentes: readonly ComponenteFormulaCostoInput[];
  /** Proporción tinte:oxidante, ej. "1:1,5", "1:2" o 1.5. */
  proporcion?: string | number;
  volumen?: number;
}

export interface ConsumoPlantillaInput {
  /** Si el servicio no usa fórmula de color, el costo de tinte y oxidante es 0 (solo insumos fijos). Por defecto true. */
  usaFormulaColor?: boolean;
  /** Gramos base para fuente estimada (por defecto 60g). */
  gramosTinteBase?: number;
  /** Factores multiplicativos por largo, densidad y canas. */
  factores?: FactoresConsumoPlantilla;
  /** Proporción de oxidante por gramo de tinte (por defecto 1.5). */
  proporcionOxidante?: number | string;
  /** Insumos fijos del servicio en COP (guantes, aluminio, capa, aditivo, etc.). */
  insumosFijos?: number;
}

export interface DetalleProductoCosto {
  tipo: 'tinte' | 'oxidante' | 'insumos_fijos';
  productoId?: string;
  descripcion: string;
  cantidad: number;
  unidad: 'g' | 'ml' | 'servicio';
  precioUnitarioCop: number;
  subtotalCop: number;
}

export interface CostoDetalleInmutable {
  fuente: 'precisa' | 'estimada' | 'sin_color';
  gramosBase: number;
  factores: {
    largo: number;
    densidad: number;
    canas: number;
    total: number;
  };
  gramosTinte: number;
  proporcionOxidante: number;
  mlOxidante: number;
  /** ml de oxidante redondeado a 1 decimal (como en la tabla de §3: 201,8 ml). */
  mlOxidanteRedondeado: number;
  costoTinte: number;
  costoOxidante: number;
  insumosFijos: number;
  items: DetalleProductoCosto[];
}

export interface ResultadoCostoProducto {
  costoTinte: number;
  costoOxidante: number;
  insumosFijos: number;
  /** Costo total de producto en COP enteros (`costo_producto_estimado`). */
  costoTotal: number;
  /** Costo total sin redondear (para cálculos encadenados de alta precisión). */
  costoTotalExacto: number;
  gramosTinte: number;
  mlOxidante: number;
  mlOxidanteRedondeado: number;
  detalle: CostoDetalleInmutable;
}

/**
 * Extrae el factor numérico de proporción de oxidante (ej. "1:1,5" -> 1.5, "1 : 2" -> 2).
 */
export function parsearProporcionOxidante(
  proporcion?: number | string | null
): number {
  if (typeof proporcion === 'number' && Number.isFinite(proporcion) && proporcion > 0) {
    return proporcion;
  }
  if (typeof proporcion === 'string') {
    const limpio = proporcion.replace(',', '.').trim();
    const partes = limpio.split(':');
    if (partes.length === 2) {
      const base = Number.parseFloat(partes[0]);
      const ox = Number.parseFloat(partes[1]);
      if (Number.isFinite(base) && base > 0 && Number.isFinite(ox) && ox >= 0) {
        return ox / base;
      }
    }
    const directo = Number.parseFloat(limpio);
    if (Number.isFinite(directo) && directo > 0) {
      return directo;
    }
  }
  return PROPORCION_OXIDANTE_DEFECTO;
}

/** Calcula el precio por gramo o mililitro de un producto del salón. */
export function calcularPrecioUnitarioProducto(
  producto?: ProductoSalonCostoInput | null
): number {
  if (!producto) return 0;
  if (typeof producto.precioUnitario === 'number' && Number.isFinite(producto.precioUnitario)) {
    return Math.max(0, producto.precioUnitario);
  }
  const cantidad = producto.presentacionCantidad ?? 0;
  const compra = producto.precioCompra ?? 0;
  if (cantidad <= 0 || compra <= 0) return 0;
  return compra / cantidad;
}

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function redondear1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Calcula el costo de producto de una cotización (§3).
 * Soporta tanto fuente precisa (`formulaFinal` de `servicios_color`) como
 * fuente estimada (`gramosTinteBase` de la plantilla, por defecto 60g).
 */
export function calcularCostoProducto(entrada: {
  variables?: VariablesCotizacion | ValoresVariables;
  consumo?: ConsumoPlantillaInput;
  /** Si se pasa `formulaFinal` con componentes, se usa como fuente `precisa`. */
  formulaFinal?: FormulaColorCostoInput | null;
  /** Si `false`, no multiplica los gramos de `formulaFinal` por los factores de consumo. Por defecto `true`. */
  aplicarFactoresAFormula?: boolean;
  /** Producto de tinte por defecto (cuando los componentes no traen precio propio o en fuente estimada). */
  productoTinte?: ProductoSalonCostoInput | null;
  /** Producto oxidante. */
  productoOxidante?: ProductoSalonCostoInput | null;
}): ResultadoCostoProducto {
  const consumo = entrada.consumo ?? {};
  const usaFormulaColor = consumo.usaFormulaColor ?? true;
  const insumosFijos = Math.max(0, Math.round(consumo.insumosFijos ?? 0));

  const valores = entrada.variables ? extraerValoresVariables(entrada.variables) : {};
  const factorLargo =
    (valores.largo
      ? consumo.factores?.largo?.[valores.largo] ?? FACTORES_CONSUMO_DEFECTO.largo[valores.largo]
      : 1.0) ?? 1.0;
  const factorDensidad =
    (valores.densidad
      ? consumo.factores?.densidad?.[valores.densidad] ??
        FACTORES_CONSUMO_DEFECTO.densidad[valores.densidad]
      : 1.0) ?? 1.0;
  const factorCanas =
    (valores.canas
      ? consumo.factores?.canas?.[valores.canas] ?? FACTORES_CONSUMO_DEFECTO.canas[valores.canas]
      : 1.0) ?? 1.0;

  const factorTotal = redondear2(factorLargo * factorDensidad * factorCanas * 100) / 100;
  const factorMultiplicador = factorLargo * factorDensidad * factorCanas;

  // Si el servicio no usa fórmula de color y no se pasó fórmula explícita
  const tieneFormulaPrecisa =
    Boolean(entrada.formulaFinal) && (entrada.formulaFinal?.componentes.length ?? 0) > 0;

  if (!usaFormulaColor && !tieneFormulaPrecisa) {
    const items: DetalleProductoCosto[] = [];
    if (insumosFijos > 0) {
      items.push({
        tipo: 'insumos_fijos',
        descripcion: 'Insumos fijos',
        cantidad: 1,
        unidad: 'servicio',
        precioUnitarioCop: insumosFijos,
        subtotalCop: insumosFijos,
      });
    }
    const detalle: CostoDetalleInmutable = {
      fuente: 'sin_color',
      gramosBase: 0,
      factores: { largo: factorLargo, densidad: factorDensidad, canas: factorCanas, total: factorTotal },
      gramosTinte: 0,
      proporcionOxidante: parsearProporcionOxidante(consumo.proporcionOxidante),
      mlOxidante: 0,
      mlOxidanteRedondeado: 0,
      costoTinte: 0,
      costoOxidante: 0,
      insumosFijos,
      items,
    };
    return {
      costoTinte: 0,
      costoOxidante: 0,
      insumosFijos,
      costoTotal: insumosFijos,
      costoTotalExacto: insumosFijos,
      gramosTinte: 0,
      mlOxidante: 0,
      mlOxidanteRedondeado: 0,
      detalle,
    };
  }

  const precioGramoDefecto = calcularPrecioUnitarioProducto(entrada.productoTinte);
  const precioMlOxidante = calcularPrecioUnitarioProducto(entrada.productoOxidante);
  const proporcionOxidante = parsearProporcionOxidante(
    entrada.formulaFinal?.proporcion ?? consumo.proporcionOxidante
  );

  const items: DetalleProductoCosto[] = [];
  let gramosBase = 0;
  let gramosTinteExactos = 0;
  let costoTinteExacto = 0;

  if (tieneFormulaPrecisa && entrada.formulaFinal) {
    const escala = entrada.aplicarFactoresAFormula === false ? 1 : factorMultiplicador;
    for (const comp of entrada.formulaFinal.componentes) {
      const gBase = Math.max(0, comp.gramos);
      gramosBase += gBase;
      const gEscalados = gBase * escala;
      const precioG =
        comp.producto !== undefined
          ? calcularPrecioUnitarioProducto(comp.producto)
          : precioGramoDefecto;
      const subtotal = gEscalados * precioG;
      gramosTinteExactos += gEscalados;
      costoTinteExacto += subtotal;

      items.push({
        tipo: 'tinte',
        productoId: comp.producto?.id ?? entrada.productoTinte?.id,
        descripcion: comp.descripcion,
        cantidad: redondear2(gEscalados),
        unidad: 'g',
        precioUnitarioCop: redondear2(precioG),
        subtotalCop: Math.round(subtotal),
      });
    }
  } else {
    gramosBase = Math.max(0, consumo.gramosTinteBase ?? GRAMOS_TINTE_BASE_DEFECTO);
    gramosTinteExactos = redondear2(gramosBase * factorMultiplicador);
    costoTinteExacto = gramosTinteExactos * precioGramoDefecto;

    items.push({
      tipo: 'tinte',
      productoId: entrada.productoTinte?.id,
      descripcion: entrada.productoTinte?.nombre ?? 'Tinte',
      cantidad: gramosTinteExactos,
      unidad: 'g',
      precioUnitarioCop: redondear2(precioGramoDefecto),
      subtotalCop: Math.round(costoTinteExacto),
    });
  }

  const gramosTinte = redondear2(gramosTinteExactos);
  const mlOxidante = redondear2(gramosTinte * proporcionOxidante * 10) / 10;
  const mlOxidanteExacto = gramosTinte * proporcionOxidante;
  const mlOxidanteRedondeado = redondear1(mlOxidanteExacto);
  const costoOxidanteExacto = mlOxidanteExacto * precioMlOxidante;

  items.push({
    tipo: 'oxidante',
    productoId: entrada.productoOxidante?.id,
    descripcion: entrada.productoOxidante?.nombre ?? 'Oxidante',
    cantidad: mlOxidanteRedondeado,
    unidad: 'ml',
    precioUnitarioCop: redondear2(precioMlOxidante),
    subtotalCop: Math.round(costoOxidanteExacto),
  });

  if (insumosFijos > 0) {
    items.push({
      tipo: 'insumos_fijos',
      descripcion: 'Insumos fijos',
      cantidad: 1,
      unidad: 'servicio',
      precioUnitarioCop: insumosFijos,
      subtotalCop: insumosFijos,
    });
  }

  const costoTinte = Math.round(costoTinteExacto);
  const costoOxidante = Math.round(costoOxidanteExacto);
  const costoTotalExacto = costoTinteExacto + costoOxidanteExacto + insumosFijos;
  const costoTotal = Math.round(costoTotalExacto);

  const detalle: CostoDetalleInmutable = {
    fuente: tieneFormulaPrecisa ? 'precisa' : 'estimada',
    gramosBase: redondear2(gramosBase),
    factores: {
      largo: factorLargo,
      densidad: factorDensidad,
      canas: factorCanas,
      total: factorTotal,
    },
    gramosTinte,
    proporcionOxidante,
    mlOxidante: mlOxidanteExacto,
    mlOxidanteRedondeado,
    costoTinte,
    costoOxidante,
    insumosFijos,
    items,
  };

  return {
    costoTinte,
    costoOxidante,
    insumosFijos,
    costoTotal,
    costoTotalExacto,
    gramosTinte,
    mlOxidante: mlOxidanteExacto,
    mlOxidanteRedondeado,
    detalle,
  };
}
