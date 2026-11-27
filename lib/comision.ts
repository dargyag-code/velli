// lib/comision.ts
import type { ReglaComision } from './cotizador/comision';

export * from './cotizador/comision';

export const PORCENTAJE_COMISION_SALUDABLE_DEFECTO = 40;

/**
 * Regla de comisión saludable por defecto en Colombia:
 * 40% calculado sobre la base neta libre de química (`precio_menos_producto`).
 */
export const REGLA_COMISION_SALUDABLE_DEFECTO: ReglaComision = {
  tipo: 'porcentaje',
  valor: PORCENTAJE_COMISION_SALUDABLE_DEFECTO,
  base: 'precio_menos_producto',
};
