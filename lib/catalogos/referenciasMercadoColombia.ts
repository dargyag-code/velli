// ══════════════════════════════════════════════════════════════════════════
// Capa 1 Estática de Referencias de Mercado · Colombia 2026 (Solo Lectura)
//
// Alimentada por `research/market-intelligence-colombia-2026/pricing/`
// (`city_price_comparison.csv` + `price_benchmarks.csv`) y `regulatory/`.
// Desacoplada 100% de la configuración privada (`organization_id`) del salón.
// ══════════════════════════════════════════════════════════════════════════

import type { VerticalSalon } from '@/lib/flags/verticales';
import {
  normalizarTextoBusqueda,
  type ProcedimientoCatalogoMaestro,
} from './catalogoMaestroColombia';

export type CodigoCiudadColombia =
  | 'BOG'
  | 'MED'
  | 'CLO'
  | 'BAQ'
  | 'BGA'
  | 'CTG'
  | 'PEI'
  | 'MZL'
  | 'AXM'
  | 'IBE'
  | 'VVC'
  | 'CUC'
  | 'SMR'
  | 'NVA'
  | 'TUN'
  | 'OTRA';

export type SegmentoMercadoColombia = 'economico' | 'estandar' | 'premium';

export type NivelConfianzaMercado = 'high' | 'medium' | 'low';

export const AVISO_TRANSPARENCIA_MUESTRA_INTERMEDIA =
  'Referencia estimada para ciudades intermedias (muestra local en construcción)';

export const AVISO_ALCANCE_ORIENTACION_PREVENTIVA =
  'Orientación preventiva operativa basada en lineamientos sanitarios vigentes en Colombia; no constituye asesoría jurídica.';

export interface CiudadMercadoColombia {
  readonly code: CodigoCiudadColombia;
  readonly nombre: string;
  readonly departamento: string;
  readonly tier: 'principal' | 'intermedia_alta' | 'intermedia';
  readonly alias: readonly string[];
}

export const CIUDADES_COLOMBIA: readonly CiudadMercadoColombia[] = [
  { code: 'BOG', nombre: 'Bogotá D.C.', departamento: 'Bogotá D.C.', tier: 'principal', alias: ['bogota', 'bogota dc', 'chico', 'usaquen', 'chapinero', 'suba'] },
  { code: 'MED', nombre: 'Medellín', departamento: 'Antioquia', tier: 'principal', alias: ['medellin', 'envigado', 'sabaneta', 'itagui', 'bello', 'el poblado', 'laureles'] },
  { code: 'CLO', nombre: 'Cali', departamento: 'Valle del Cauca', tier: 'principal', alias: ['cali', 'jamundi', 'yumbo', 'palmira'] },
  { code: 'BAQ', nombre: 'Barranquilla', departamento: 'Atlántico', tier: 'principal', alias: ['barranquilla', 'puerto colombia', 'soledad'] },
  { code: 'BGA', nombre: 'Bucaramanga', departamento: 'Santander', tier: 'intermedia_alta', alias: ['bucaramanga', 'floridablanca', 'piedecuesta', 'giron'] },
  { code: 'CTG', nombre: 'Cartagena', departamento: 'Bolívar', tier: 'intermedia_alta', alias: ['cartagena', 'cartagena de indias', 'bocagrande', 'turbaco'] },
  { code: 'PEI', nombre: 'Pereira', departamento: 'Risaralda', tier: 'intermedia', alias: ['pereira', 'dosquebradas', 'cerritos'] },
  { code: 'MZL', nombre: 'Manizales', departamento: 'Caldas', tier: 'intermedia', alias: ['manizales', 'villamaria'] },
  { code: 'AXM', nombre: 'Armenia', departamento: 'Quindío', tier: 'intermedia', alias: ['armenia', 'circasia', 'calarca'] },
  { code: 'IBE', nombre: 'Ibagué', departamento: 'Tolima', tier: 'intermedia', alias: ['ibague'] },
  { code: 'VVC', nombre: 'Villavicencio', departamento: 'Meta', tier: 'intermedia', alias: ['villavicencio', 'acacias'] },
  { code: 'CUC', nombre: 'Cúcuta', departamento: 'Norte de Santander', tier: 'intermedia', alias: ['cucuta', 'los patios', 'villa del rosario'] },
  { code: 'SMR', nombre: 'Santa Marta', departamento: 'Magdalena', tier: 'intermedia', alias: ['santa marta', 'el rodadero'] },
  { code: 'NVA', nombre: 'Neiva', departamento: 'Huila', tier: 'intermedia', alias: ['neiva'] },
  { code: 'TUN', nombre: 'Tunja', departamento: 'Boyacá', tier: 'intermedia', alias: ['tunja', 'duitama', 'sogamoso', 'villa de leyva'] },
  { code: 'OTRA', nombre: 'Otra ciudad / Municipio intermedio', departamento: 'Colombia', tier: 'intermedia', alias: ['otra', 'otro municipio'] },
] as const;

export const SEGMENTOS_MERCADO_COLOMBIA: ReadonlyArray<{
  readonly id: SegmentoMercadoColombia;
  readonly etiqueta: string;
  readonly descripcion: string;
}> = [
  {
    id: 'economico',
    etiqueta: 'Económico / Barrio',
    descripcion: 'Tarifa competitiva de barrio residencial o zona comercial popular.',
  },
  {
    id: 'estandar',
    etiqueta: 'Estándar Consolidado',
    descripcion: 'Estudio formalizado con agenda digital e insumos profesionales.',
  },
  {
    id: 'premium',
    etiqueta: 'Premium / Boutique',
    descripcion: 'Estudio de autor, corredor prime o experiencia especializada.',
  },
] as const;

interface CeldaCiudadVertical {
  readonly indice: number;
  readonly sampleCount: number;
  readonly confidence: NivelConfianzaMercado;
}

/**
 * Matriz exacta extraída de `pricing/city_price_comparison.csv` (15 ciudades × 5 verticales + OTRA).
 * Las 27 celdas con `sampleCount: 0` (más `OTRA`) activan el aviso explícito de transparencia.
 */
const MATRIZ_CIUDAD_VERTICAL: Record<
  CodigoCiudadColombia,
  Record<VerticalSalon, CeldaCiudadVertical>
> = {
  BOG: {
    hair_studio: { indice: 1.0, sampleCount: 21, confidence: 'high' },
    barber_studio: { indice: 1.0, sampleCount: 15, confidence: 'high' },
    nail_bar: { indice: 1.0, sampleCount: 23, confidence: 'high' },
    spa_estetica: { indice: 1.0, sampleCount: 14, confidence: 'high' },
    beauty_lounge: { indice: 1.0, sampleCount: 15, confidence: 'high' },
  },
  MED: {
    hair_studio: { indice: 0.98, sampleCount: 9, confidence: 'high' },
    barber_studio: { indice: 0.84, sampleCount: 2, confidence: 'medium' },
    nail_bar: { indice: 0.92, sampleCount: 12, confidence: 'high' },
    spa_estetica: { indice: 1.02, sampleCount: 12, confidence: 'high' },
    beauty_lounge: { indice: 0.88, sampleCount: 2, confidence: 'medium' },
  },
  CLO: {
    hair_studio: { indice: 0.91, sampleCount: 11, confidence: 'high' },
    barber_studio: { indice: 0.82, sampleCount: 4, confidence: 'high' },
    nail_bar: { indice: 0.88, sampleCount: 4, confidence: 'high' },
    spa_estetica: { indice: 0.9, sampleCount: 5, confidence: 'high' },
    beauty_lounge: { indice: 0.84, sampleCount: 2, confidence: 'medium' },
  },
  BAQ: {
    hair_studio: { indice: 0.89, sampleCount: 1, confidence: 'medium' },
    barber_studio: { indice: 0.76, sampleCount: 5, confidence: 'high' },
    nail_bar: { indice: 0.87, sampleCount: 11, confidence: 'high' },
    spa_estetica: { indice: 0.88, sampleCount: 1, confidence: 'medium' },
    beauty_lounge: { indice: 0.86, sampleCount: 2, confidence: 'medium' },
  },
  BGA: {
    hair_studio: { indice: 0.84, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.73, sampleCount: 2, confidence: 'medium' },
    nail_bar: { indice: 0.78, sampleCount: 12, confidence: 'high' },
    spa_estetica: { indice: 0.81, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.78, sampleCount: 0, confidence: 'low' },
  },
  CTG: {
    hair_studio: { indice: 1.02, sampleCount: 6, confidence: 'high' },
    barber_studio: { indice: 0.78, sampleCount: 2, confidence: 'medium' },
    nail_bar: { indice: 0.92, sampleCount: 4, confidence: 'high' },
    spa_estetica: { indice: 0.97, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 1.08, sampleCount: 0, confidence: 'low' },
  },
  PEI: {
    hair_studio: { indice: 0.82, sampleCount: 4, confidence: 'high' },
    barber_studio: { indice: 0.76, sampleCount: 4, confidence: 'high' },
    nail_bar: { indice: 0.83, sampleCount: 2, confidence: 'medium' },
    spa_estetica: { indice: 0.86, sampleCount: 2, confidence: 'medium' },
    beauty_lounge: { indice: 0.84, sampleCount: 1, confidence: 'medium' },
  },
  MZL: {
    hair_studio: { indice: 0.76, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.71, sampleCount: 6, confidence: 'high' },
    nail_bar: { indice: 0.78, sampleCount: 0, confidence: 'low' },
    spa_estetica: { indice: 0.8, sampleCount: 1, confidence: 'medium' },
    beauty_lounge: { indice: 0.76, sampleCount: 0, confidence: 'low' },
  },
  AXM: {
    hair_studio: { indice: 0.73, sampleCount: 1, confidence: 'medium' },
    barber_studio: { indice: 0.73, sampleCount: 5, confidence: 'high' },
    nail_bar: { indice: 0.77, sampleCount: 8, confidence: 'high' },
    spa_estetica: { indice: 0.78, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.76, sampleCount: 0, confidence: 'low' },
  },
  IBE: {
    hair_studio: { indice: 0.75, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.71, sampleCount: 4, confidence: 'high' },
    nail_bar: { indice: 0.75, sampleCount: 1, confidence: 'medium' },
    spa_estetica: { indice: 0.74, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.72, sampleCount: 0, confidence: 'low' },
  },
  VVC: {
    hair_studio: { indice: 0.76, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.76, sampleCount: 2, confidence: 'medium' },
    nail_bar: { indice: 0.72, sampleCount: 5, confidence: 'high' },
    spa_estetica: { indice: 0.74, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.73, sampleCount: 0, confidence: 'low' },
  },
  CUC: {
    hair_studio: { indice: 0.69, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.69, sampleCount: 0, confidence: 'low' },
    nail_bar: { indice: 0.67, sampleCount: 5, confidence: 'high' },
    spa_estetica: { indice: 0.68, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.68, sampleCount: 0, confidence: 'low' },
  },
  SMR: {
    hair_studio: { indice: 0.8, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.78, sampleCount: 8, confidence: 'high' },
    nail_bar: { indice: 0.77, sampleCount: 1, confidence: 'medium' },
    spa_estetica: { indice: 0.81, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.89, sampleCount: 0, confidence: 'low' },
  },
  NVA: {
    hair_studio: { indice: 0.67, sampleCount: 1, confidence: 'medium' },
    barber_studio: { indice: 0.64, sampleCount: 3, confidence: 'medium' },
    nail_bar: { indice: 0.68, sampleCount: 0, confidence: 'low' },
    spa_estetica: { indice: 0.68, sampleCount: 1, confidence: 'medium' },
    beauty_lounge: { indice: 0.66, sampleCount: 0, confidence: 'low' },
  },
  TUN: {
    hair_studio: { indice: 0.71, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.62, sampleCount: 9, confidence: 'high' },
    nail_bar: { indice: 0.75, sampleCount: 5, confidence: 'high' },
    spa_estetica: { indice: 0.7, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.68, sampleCount: 0, confidence: 'low' },
  },
  OTRA: {
    hair_studio: { indice: 0.75, sampleCount: 0, confidence: 'low' },
    barber_studio: { indice: 0.72, sampleCount: 0, confidence: 'low' },
    nail_bar: { indice: 0.75, sampleCount: 0, confidence: 'low' },
    spa_estetica: { indice: 0.75, sampleCount: 0, confidence: 'low' },
    beauty_lounge: { indice: 0.74, sampleCount: 0, confidence: 'low' },
  },
};

function redondear1000(valor: number): number {
  return Math.max(5000, Math.round(valor / 1000) * 1000);
}

/**
 * Infiere un código de ciudad normalizado a partir de texto libre (ej. "Medellín", "El Poblado").
 */
export function inferirCodigoCiudadColombia(texto?: string | null): CodigoCiudadColombia {
  if (!texto || !texto.trim()) return 'BOG';
  const limpio = normalizarTextoBusqueda(texto);
  const exactCode = CIUDADES_COLOMBIA.find((c) => c.code.toLowerCase() === limpio);
  if (exactCode) return exactCode.code;

  for (const c of CIUDADES_COLOMBIA) {
    if (c.code === 'OTRA') continue;
    if (
      normalizarTextoBusqueda(c.nombre) === limpio ||
      c.alias.some((al) => limpio.includes(al))
    ) {
      return c.code;
    }
  }
  return 'OTRA';
}

export interface ResultadoPrecioContextual {
  readonly precioSugeridoCop: number;
  readonly rangoMinCop: number;
  readonly rangoMaxCop: number;
  readonly indiceCiudad: number;
  readonly confidenceLevel: NivelConfianzaMercado;
  readonly avisoTransparencia: string | null;
}

/**
 * Calcula la referencia tarifaria contextual en COP (múltiplos de $1.000) para un
 * procedimiento según ciudad de Colombia y segmento del establecimiento.
 * El establecimiento conserva siempre el control total de sus tarifas.
 */
export function calcularPrecioContextualColombia(params: {
  procedimiento: Pick<
    ProcedimientoCatalogoMaestro,
    'vertical' | 'precio_min_cop' | 'precio_sugerido_cop' | 'precio_max_cop'
  >;
  cityCode: CodigoCiudadColombia;
  segmento: SegmentoMercadoColombia;
}): ResultadoPrecioContextual {
  const { procedimiento, cityCode, segmento } = params;
  const celda =
    MATRIZ_CIUDAD_VERTICAL[cityCode]?.[procedimiento.vertical] ??
    MATRIZ_CIUDAD_VERTICAL.OTRA[procedimiento.vertical];

  const indice = celda.indice;
  const minRaw = redondear1000(procedimiento.precio_min_cop * Math.max(0.75, 0.35 + 0.65 * indice));
  const stdRaw = redondear1000(procedimiento.precio_sugerido_cop * indice);
  const maxRaw = redondear1000(procedimiento.precio_max_cop * indice);

  const rangoMinCop = Math.min(minRaw, stdRaw);
  const precioEst = Math.max(rangoMinCop, stdRaw);
  const rangoMaxCop = Math.max(precioEst, maxRaw);

  const precioSugeridoCop =
    segmento === 'economico'
      ? rangoMinCop
      : segmento === 'premium'
        ? rangoMaxCop
        : precioEst;

  const esMuestraBaja = celda.sampleCount === 0 || celda.confidence === 'low';

  return {
    precioSugeridoCop,
    rangoMinCop,
    rangoMaxCop,
    indiceCiudad: indice,
    confidenceLevel: celda.confidence,
    avisoTransparencia: esMuestraBaja ? AVISO_TRANSPARENCIA_MUESTRA_INTERMEDIA : null,
  };
}

export interface ResultadoValidacionTerminos {
  readonly permitido: boolean;
  readonly terminoDetectado: string | null;
  readonly orientacionPreventiva: string | null;
  readonly avisoAlcance: string;
}

interface ReglaSustanciaRestringida {
  readonly etiqueta: string;
  readonly patronDeteccion: RegExp;
  readonly patronExcepcionSegura?: RegExp;
  readonly orientacion: string;
}

const REGLAS_SUSTANCIAS_RESTRINGIDAS: readonly ReglaSustanciaRestringida[] = [
  {
    etiqueta: 'Biopolímeros / PMMA',
    patronDeteccion: /\b(biopolimeros?|polimetilmetacrilato|pmma)\b/i,
    orientacion:
      'En Colombia (Ley 2316 de 2023) la aplicación de biopolímeros o sustancias modelantes no permitidas está prohibida.',
  },
  {
    etiqueta: 'Silicona líquida inyectable / modelante',
    patronDeteccion: /\b(silicona\s+liquida|aceite\s+de\s+avion|sustancias?\s+modelantes?)\b/i,
    orientacion:
      'Las sustancias modelantes permanentes como silicona líquida están prohibidas por riesgo sanitario severo.',
  },
  {
    etiqueta: 'Formol / Formaldehído',
    patronDeteccion: /\b(formol|formaldehido|aldehido\s+formico)\b/i,
    patronExcepcionSegura:
      /\b(sin\s+formol|libre\s+de\s+formol|0%?\s*formol|sin\s+formaldehido|libre\s+de\s+formaldehido)\b/i,
    orientacion:
      'INVIMA prohíbe alisadores cosméticos con formol/formaldehído libre. Si tu producto es seguro, regístralo como «sin formol» con su NSOC vigente.',
  },
  {
    etiqueta: 'Monómero MMA (Metacrilato de Metilo)',
    patronDeteccion: /\b(mma|metacrilato\s+de\s+metilo)\b/i,
    patronExcepcionSegura: /\b(sin\s+mma|libre\s+de\s+mma|100%?\s*ema)\b/i,
    orientacion:
      'El monómero MMA está restringido en uñas por daño severo a la lámina ungueal; utiliza monómero EMA con NSOC vigente.',
  },
  {
    etiqueta: 'Fotoiniciador TPO',
    patronDeteccion: /\b(tpo|trimethylbenzoyl)\b/i,
    patronExcepcionSegura: /\b(sin\s+tpo|libre\s+de\s+tpo|tpo\s*free)\b/i,
    orientacion:
      'Por Resolución CAN 2548 de 2025 e INVIMA 2026007526 (feb. 2026), los geles y bases con TPO fueron retirados sin periodo de agotamiento.',
  },
  {
    etiqueta: 'Acelerador DMPT',
    patronDeteccion: /\b(dmpt|dimetil\s*p\s*toluidina)\b/i,
    patronExcepcionSegura: /\b(sin\s+dmpt|libre\s+de\s+dmpt|dmpt\s*free)\b/i,
    orientacion:
      'Por Resolución CAN 2548 de 2025 e INVIMA 2026007526, los productos para uñas con DMPT tienen prohibida su comercialización y uso.',
  },
];

/**
 * Valida preventivamente nombres de servicios o insumos ingresados manualmente para
 * impedir el alta de sustancias prohibidas en Colombia sin generar falsos positivos
 * en descripciones legítimas (como «Keratina sin formol» o «Base libre de TPO»).
 */
export function validarTerminosRestringidosColombia(
  texto: string
): ResultadoValidacionTerminos {
  const norm = normalizarTextoBusqueda(texto);
  if (!norm) {
    return {
      permitido: true,
      terminoDetectado: null,
      orientacionPreventiva: null,
      avisoAlcance: AVISO_ALCANCE_ORIENTACION_PREVENTIVA,
    };
  }

  for (const regla of REGLAS_SUSTANCIAS_RESTRINGIDAS) {
    if (regla.patronDeteccion.test(norm)) {
      if (regla.patronExcepcionSegura && regla.patronExcepcionSegura.test(norm)) {
        continue;
      }
      return {
        permitido: false,
        terminoDetectado: regla.etiqueta,
        orientacionPreventiva: `${regla.orientacion} (${AVISO_ALCANCE_ORIENTACION_PREVENTIVA})`,
        avisoAlcance: AVISO_ALCANCE_ORIENTACION_PREVENTIVA,
      };
    }
  }

  return {
    permitido: true,
    terminoDetectado: null,
    orientacionPreventiva: null,
    avisoAlcance: AVISO_ALCANCE_ORIENTACION_PREVENTIVA,
  };
}
