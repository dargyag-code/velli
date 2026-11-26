// lib/semilla-financiera.ts
import type { AjustesPlantilla } from './cotizador/precio';

export type UnidadFisica = 'tubo_60g' | 'cazo_30g' | 'onza_30ml' | 'aplicacion_35g';

export interface ProductoQuimicoSemilla {
  codigo: string;
  nombre: string;
  categoria: 'decolorante' | 'tinte' | 'peroxido' | 'tratamiento' | 'alisado' | 'insumos';
  presentacionCantidad: number; // g o ml del envase cerrado
  unidadMedida: 'g' | 'ml' | 'kit';
  costoEnvaseCop: number;       // Precio real distribuidora Colombia 2026
  costoUnitarioCop: number;     // $/g o $/ml calculado automáticamente
  proporcionPeroxido: number;   // Ej: 1.5 para 1:1.5, 1.0 para 1:1, 0 si no usa
  unidadFisica: UnidadFisica;
  gramosPorUnidadFisica: number;
}

export interface ServicioSalonSemilla {
  slug: string;
  nombre: string;
  categoria: 'COLORACIÓN' | 'TRATAMIENTO' | 'ALISADO & FORMA';
  tarifaBaseCop: number;
  gramosBase: number;           // Para cabello Corto / Base (1.0x)
  costoGramoBaseCop: number;    // $/g del químico principal
  ratioPeroxido: number;        // Multiplicador de ml de peróxido por cada gramo
  costoMlPeroxidoCop: number;   // $/ml de oxigenta/revelador ($32/ml estándar profesional)
  insumosFijosCop: number;      // Aluminio, guantes, gorro, protector capilar (nunca $0)
  requiereQuimico: boolean;
  requierePruebaMechon: boolean;
  unidadFisica: UnidadFisica;
}

/**
 * 1. CATÁLOGO QUÍMICO SEMILLA (Precios reales distribuidora Colombia 2026)
 */
export const CATALOGO_QUIMICO_SEMILLA: ProductoQuimicoSemilla[] = [
  {
    codigo: 'DEC-PRO-450',
    nombre: 'Polvo Decolorante Profesional (Ref. BlondMe / Vario Blond)',
    categoria: 'decolorante',
    presentacionCantidad: 450,
    unidadMedida: 'g',
    costoEnvaseCop: 144000,
    costoUnitarioCop: 320, // $320 / g
    proporcionPeroxido: 1.5,
    unidadFisica: 'cazo_30g',
    gramosPorUnidadFisica: 30,
  },
  {
    codigo: 'TIN-PRO-60',
    nombre: 'Tinte Permanente Profesional (Ref. Igora Royal / Evolution)',
    categoria: 'tinte',
    presentacionCantidad: 60,
    unidadMedida: 'g',
    costoEnvaseCop: 27900,
    costoUnitarioCop: 465, // $465 / g
    proporcionPeroxido: 1.0,
    unidadFisica: 'tubo_60g',
    gramosPorUnidadFisica: 60,
  },
  {
    codigo: 'MAT-PRO-60',
    nombre: 'Tinte Tono sobre Tono / Matizante (Ref. Vibrance / Color Wear)',
    categoria: 'tinte',
    presentacionCantidad: 60,
    unidadMedida: 'g',
    costoEnvaseCop: 26400,
    costoUnitarioCop: 440, // $440 / g
    proporcionPeroxido: 1.5,
    unidadFisica: 'tubo_60g',
    gramosPorUnidadFisica: 60,
  },
  {
    codigo: 'PER-PRO-1000',
    nombre: 'Loción Activadora / Peróxido 10V-20V-30V (Botella 1 Litro)',
    categoria: 'peroxido',
    presentacionCantidad: 1000,
    unidadMedida: 'ml',
    costoEnvaseCop: 32000,
    costoUnitarioCop: 32, // $32 / ml (Corrige el $95/ml anterior)
    proporcionPeroxido: 0,
    unidadFisica: 'onza_30ml',
    gramosPorUnidadFisica: 30,
  },
  {
    codigo: 'ALI-ORG-1000',
    nombre: 'Alisado Orgánico / Aminoácidos sin Formol (1 Litro)',
    categoria: 'alisado',
    presentacionCantidad: 1000,
    unidadMedida: 'ml',
    costoEnvaseCop: 280000,
    costoUnitarioCop: 280, // $280 / ml
    proporcionPeroxido: 0,
    unidadFisica: 'onza_30ml',
    gramosPorUnidadFisica: 30,
  },
  {
    codigo: 'TRT-BACK-500',
    nombre: 'Máscara Capilar / Repolarizador Intensivo Backbar (500g)',
    categoria: 'tratamiento',
    presentacionCantidad: 500,
    unidadMedida: 'g',
    costoEnvaseCop: 90000,
    costoUnitarioCop: 180, // $180 / g
    proporcionPeroxido: 0,
    unidadFisica: 'aplicacion_35g',
    gramosPorUnidadFisica: 35,
  },
];

/**
 * 2. SERVICIOS BASE SEMILLA (Tarifas y consumos calibrados para salón en Colombia)
 */
export const SERVICIOS_BASE_SEMILLA: ServicioSalonSemilla[] = [
  {
    slug: 'balayage',
    nombre: 'Balayage / Diseño de Rubios',
    categoria: 'COLORACIÓN',
    tarifaBaseCop: 210000,      // Base Corto $210k (Medio 1.5x + $20k recargo = $230k)
    gramosBase: 60,             // 60g base (En cabello Medio 1.5x = 90g)
    costoGramoBaseCop: 320,     // $320/g (Polvo decolorante + proporción matiz)
    ratioPeroxido: 1.5,         // 1:1.5 (90g -> 135ml peróxido)
    costoMlPeroxidoCop: 32,     // $32/ml (135ml = $4.320 COP)
    insumosFijosCop: 9500,      // Papel aluminio (50 láminas), guantes, aditivo plex
    requiereQuimico: true,
    requierePruebaMechon: true,
    unidadFisica: 'cazo_30g',
  },
  {
    slug: 'tinte-global',
    nombre: 'Color Global / Cubrimiento Total',
    categoria: 'COLORACIÓN',
    tarifaBaseCop: 120000,
    gramosBase: 60,             // 1 tubo de 60g base
    costoGramoBaseCop: 465,     // $465/g (Tinte permanente profesional)
    ratioPeroxido: 1.0,         // 1:1 (60g tinte + 60ml revelador)
    costoMlPeroxidoCop: 32,     // $32/ml (60ml = $1.920 COP)
    insumosFijosCop: 3500,      // Guantes, protector de contornos y sellante ácido
    requiereQuimico: true,
    requierePruebaMechon: false,
    unidadFisica: 'tubo_60g',
  },
  {
    slug: 'alisado-organico',
    nombre: 'Alisado Orgánico & Brillo Espejo',
    categoria: 'ALISADO & FORMA',
    tarifaBaseCop: 190000,
    gramosBase: 60,             // 60ml (2 onzas base)
    costoGramoBaseCop: 280,     // $280/ml
    ratioPeroxido: 0,           // No lleva peróxido
    costoMlPeroxidoCop: 0,
    insumosFijosCop: 5000,      // Shampoo antiresiduos, guantes, tapabocas
    requiereQuimico: true,
    requierePruebaMechon: true,
    unidadFisica: 'onza_30ml',
  },
  {
    slug: 'hidratacion',
    nombre: 'Hidratación Profunda / Nutrición',
    categoria: 'TRATAMIENTO',
    tarifaBaseCop: 85000,
    gramosBase: 35,             // 35g base
    costoGramoBaseCop: 180,     // $180/g
    ratioPeroxido: 0,
    costoMlPeroxidoCop: 0,
    insumosFijosCop: 3500,      // Gorro térmico, ampolla de sellado
    requiereQuimico: false,
    requierePruebaMechon: false,
    unidadFisica: 'aplicacion_35g',
  },
];

/**
 * 3. MULTIPLICADORES TÁCTILES DE SILLA (lib/variables.ts)
 */
export const MULTIPLICADORES_DIAGNOSTICO = {
  longitud: {
    corto:      { label: 'Corto',       multGramos: 1.0,  recargoCop: 0 },
    medio:      { label: 'Medio',       multGramos: 1.5,  recargoCop: 20000 },
    largo:      { label: 'Largo',       multGramos: 2.0,  recargoCop: 45000 },
    extra_largo:{ label: 'Extra Largo', multGramos: 2.5,  recargoCop: 70000 },
  },
  densidad: {
    baja:  { label: 'Baja',  multAdicional: -0.15, recargoCop: 0 },
    media: { label: 'Media', multAdicional: 0.0,   recargoCop: 0 },
    alta:  { label: 'Alta',  multAdicional: 0.25,  recargoCop: 20000 },
  },
  porosidad: {
    baja:  { label: 'Baja',  multAdicional: 0.0 },
    media: { label: 'Media', multAdicional: 0.0 },
    alta:  { label: 'Alta',  multAdicional: 0.15 }, // Cabello poroso absorbe +15% mezcla
  },
} as const;

/**
 * 4. TRADUCTOR DE GRAMOS A LENGUAJE DE ESTILISTA (Sin Báscula)
 * - Decoloración/balayage: "≈ 3 cazos (30g) / 1.5 tubos"
 * - Color/tinte: "≈ 1 tubo (60g)"
 * - Tratamiento: "≈ 1 aplicación"
 */
export function formatearEquivalenciaFisica(
  gramos: number,
  unidad: UnidadFisica = 'tubo_60g'
): string {
  if (unidad === 'cazo_30g') {
    const cazos = +(gramos / 30).toFixed(1);
    const tubos = +(gramos / 60).toFixed(1);
    return `≈ ${cazos} ${cazos === 1 ? 'cazo' : 'cazos'} (30g) / ${tubos} ${tubos === 1 ? 'tubo' : 'tubos'}`;
  }
  if (unidad === 'tubo_60g') {
    const tubos = +(gramos / 60).toFixed(1);
    return `≈ ${tubos} ${tubos === 1 ? 'tubo' : 'tubos'} (60g)`;
  }
  if (unidad === 'onza_30ml') {
    const onzas = +(gramos / 30).toFixed(1);
    return `≈ ${onzas} oz (${gramos}ml)`;
  }
  const porciones = +(gramos / 35).toFixed(1);
  return `≈ ${porciones} ${porciones === 1 ? 'aplicación' : 'aplicaciones'}`;
}

/**
 * 5. RESOLUTOR DE SEMILLA POR SERVICIO Y NORMALIZADOR DE RECARGOS VELVET STUDIO
 */
export function obtenerSemillaServicio(
  srv?: { nombre?: string; categoria?: string; slug?: string } | null
): ServicioSalonSemilla {
  const n = (srv?.slug ?? srv?.nombre ?? '').toLowerCase();
  const cat = (srv?.categoria ?? '').toLowerCase();
  if (
    n.includes('balayage') ||
    n.includes('mecha') ||
    n.includes('rubio') ||
    cat === 'decoloracion'
  ) {
    return SERVICIOS_BASE_SEMILLA[0]; // balayage ($210k base / $230k medio, 60g, $320/g, 1:1.5, $9.500 insumos)
  }
  if (n.includes('alisado') || n.includes('keratina') || n.includes('amino')) {
    return SERVICIOS_BASE_SEMILLA[2]; // alisado-organico ($190k, 60ml, $280/ml, $5.000 insumos)
  }
  if (
    n.includes('hidratac') ||
    n.includes('nutric') ||
    n.includes('tratamiento') ||
    n.includes('repolariz') ||
    cat === 'tratamiento'
  ) {
    return SERVICIOS_BASE_SEMILLA[3]; // hidratacion ($85k, 35g, $180/g, $3.500 insumos = $9.800 base)
  }
  return SERVICIOS_BASE_SEMILLA[1]; // tinte-global ($120k, 60g, $465/g, 1:1, $3.500 insumos)
}

export const AJUSTES_VELVET_STUDIO_DEFECTO: AjustesPlantilla = {
  largo: {
    corto: { suma: 0, porcentaje: 0 },
    medio: { suma: 20000, porcentaje: 0 },
    largo: { suma: 45000, porcentaje: 0 },
    extra_largo: { suma: 70000, porcentaje: 0 },
  },
  densidad: {
    baja: { suma: 0, porcentaje: 0 },
    media: { suma: 0, porcentaje: 0 },
    alta: { suma: 20000, porcentaje: 0 },
  },
  estado: {
    sana: { suma: 0, porcentaje: 0 },
    procesada: { suma: 0, porcentaje: 0 },
    sensibilizada: { suma: 0, porcentaje: 0 },
  },
  canas: {
    '0_25': { suma: 0, porcentaje: 0 },
    '25_50': { suma: 0, porcentaje: 0 },
    '50_75': { suma: 0, porcentaje: 0 },
    '75_100': { suma: 0, porcentaje: 0 },
  },
};

export function normalizarAjustesVelvetStudio(
  ajustes?: AjustesPlantilla | null
): AjustesPlantilla {
  const base = structuredClone(AJUSTES_VELVET_STUDIO_DEFECTO);
  if (!ajustes || Object.keys(ajustes).length === 0) {
    return base;
  }

  const largo = ajustes.largo ?? {};
  const cortoSuma = largo.corto?.suma ?? 0;
  const medioSuma = largo.medio?.suma ?? 0;
  const largoSuma = largo.largo?.suma ?? 0;
  const extraSuma = largo.extra_largo?.suma ?? 0;
  const medioPct = largo.medio?.porcentaje ?? 0;
  const largoPct = largo.largo?.porcentaje ?? 0;
  const extraPct = largo.extra_largo?.porcentaje ?? 0;

  // Si tenía el legado -7000 en Corto o todos los recargos de longitud estaban en 0,
  // sincroniza los recargos reales de Velvet Studio (Corto $0, Medio +$20k, Largo +$45k, Extra largo +$70k, Densidad Alta +$20k)
  const esLegadoSinRecargos =
    cortoSuma < 0 ||
    (medioSuma === 0 &&
      largoSuma === 0 &&
      extraSuma === 0 &&
      medioPct === 0 &&
      largoPct === 0 &&
      extraPct === 0);

  if (esLegadoSinRecargos) {
    return base;
  }

  const clon = structuredClone(ajustes);
  if (clon.largo?.corto && (clon.largo.corto.suma ?? 0) < 0) {
    clon.largo.corto.suma = 0;
  }
  return clon;
}

