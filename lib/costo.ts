// En lib/costo.ts
import { formatearEquivalenciaFisica, UnidadFisica } from './semilla-financiera';

export * from './cotizador/costo';

export interface InputCotizacionSilla {
  tarifaBaseCop: number;
  recargoVariablesCop: number;
  gramosBase: number;
  multiplicadorTotal: number; // Ej: 1.5 en Cabello Medio
  ajusteManualGramos: number; // Botones -5g / +5g en silla
  costoGramoCop: number;      // Ej: $320/g
  ratioPeroxido: number;      // Ej: 1.5 (1:1.5)
  costoMlPeroxidoCop: number; // Ej: $32/ml
  insumosFijosCop: number;    // Ej: $9.500 (Aluminio + guantes + plex)
  porcentajeComision: number; // Ej: 40 (%)
  comisionSobreNetoQuimico: boolean; // true = descuenta químico antes de pagar comisión
  unidadFisica?: UnidadFisica;
}

export function calcularTicketFinancieroVivo(input: InputCotizacionSilla) {
  const precioTotalCop = input.tarifaBaseCop + input.recargoVariablesCop;

  // 1. Gramos de tinte/decolorante y mililitros de peróxido
  const gramosEstimados = Math.round(input.gramosBase * input.multiplicadorTotal);
  const gramosFinales = Math.max(10, gramosEstimados + input.ajusteManualGramos);
  const mlPeroxido = Math.round(gramosFinales * input.ratioPeroxido);

  // 2. Desglose de Costo Químico Real
  const subtotalQuimicoPrincipalCop = Math.round(gramosFinales * input.costoGramoCop);
  const subtotalPeroxidoCop = Math.round(mlPeroxido * input.costoMlPeroxidoCop);
  const costoInsumosCop = input.insumosFijosCop;

  const costoQuimicoTotalCop =
    subtotalQuimicoPrincipalCop + subtotalPeroxidoCop + costoInsumosCop;

  // 3. Comisión Especialista (Regla de protección de margen del salón)
  const baseComisionableCop = input.comisionSobreNetoQuimico
    ? Math.max(0, precioTotalCop - costoQuimicoTotalCop)
    : precioTotalCop;

  const comisionEspecialistaCop = Math.round(
    baseComisionableCop * (input.porcentajeComision / 100)
  );

  // 4. Utilidad Neta Real del Salón y Margen %
  const utilidadNetaSalonCop =
    precioTotalCop - costoQuimicoTotalCop - comisionEspecialistaCop;

  const margenNetoPct =
    precioTotalCop > 0 ? Math.round((utilidadNetaSalonCop / precioTotalCop) * 100) : 0;

  // 5. Precio sugerido para asegurar mínimo 35% de margen neto al salón
  const margenObjetivo = 0.35;
  const factorComision = input.porcentajeComision / 100;
  const tarifaCalibradaSugeridaCop = input.comisionSobreNetoQuimico
    ? Math.ceil(
        (costoQuimicoTotalCop * (1 - factorComision)) /
          (1 - factorComision - margenObjetivo) /
          1000
      ) * 1000
    : Math.ceil(
        costoQuimicoTotalCop / (1 - factorComision - margenObjetivo) / 1000
      ) * 1000;

  return {
    precioTotalCop,
    gramosFinales,
    mlPeroxido,
    equivalenciaFisica: formatearEquivalenciaFisica(gramosFinales, input.unidadFisica),
    subtotalQuimicoPrincipalCop,
    subtotalPeroxidoCop,
    costoInsumosCop,
    costoQuimicoTotalCop,
    comisionEspecialistaCop,
    utilidadNetaSalonCop,
    margenNetoPct,
    requiereCalibracion: margenNetoPct < 30,
    tarifaCalibradaSugeridaCop,
  };
}
