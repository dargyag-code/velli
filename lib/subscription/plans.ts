// ── Planes y feature flags de Velli Pro ────────────────────────────────────
// Fuente de verdad de precios/límites en el código. Las constantes de días
// (trial 14, periodo 30, gracia 3) se espejan en
// supabase/migration-suscripciones.sql — cambiar ambos lados a la vez.

import { flagsActivos } from '@/lib/flags';

export type PlanId = 'basico' | 'pro' | 'pro_ia';

export interface PlanFeatures {
  /** null = ilimitadas */
  maxClientas: number | null;
  reportes: boolean;
  /** Exportación a Excel (Pro+). El backup JSON de Configuración NO se
   *  paywallea: los datos siempre son de la estilista. */
  exportacionExcel: boolean;
  marcaPersonalizada: boolean;
  /** Calculadora de colorimetría (Pro+). La colorimetría MANUAL entra en Pro;
   *  el análisis de color por foto queda para Pro+IA bajo iaFacial. */
  calculadoraColor: boolean;
  /** IA facial (Pro+IA). Llega después: además del plan, exige el feature
   *  flag global NEXT_PUBLIC_FEATURE_IA_FACIAL=true para encenderse. */
  iaFacial: boolean;
  /** Cotizador en 3 toques y plantillas de precio (todos los planes). */
  cotizador: boolean;
  /** Rentabilidad: costos de producto, comisiones y margen por servicio (Pro+). */
  rentabilidad: boolean;
  /** Diagnóstico capilar con IA por foto (Pro+IA, hasta 150/mes; 20 en prueba gratis). */
  diagnosticoIA: boolean;
  /** Tope mensual de análisis con IA en plan pagado (150 en Pro+IA). */
  topeAnalisisIAMensual: number;
  /** Cotización pública (/c/[token]) sin sello de marca Velli (Pro+IA). */
  cotizacionSinMarca: boolean;
}

export interface PlanDef {
  id: PlanId;
  nombre: string;
  precioCop: number;       // por periodo de 30 días, sin decimales
  tagline: string;
  beneficios: string[];    // bullets de la página de planes
  destacado?: boolean;
  features: PlanFeatures;
}

export const TRIAL_DIAS = 14;
export const PERIODO_DIAS = 30;
export const GRACIA_DIAS = 3;
export const LIMITE_CLIENTAS_BASICO = 50;

export const PLANES: Record<PlanId, PlanDef> = {
  basico: {
    id: 'basico',
    nombre: 'Básico',
    precioCop: 25_000,
    tagline: 'Para empezar con tus primeras clientas',
    beneficios: [
      'Hasta 50 clientas',
      'Cotizador en 3 toques por WhatsApp',
      'Diagnóstico capilar guiado (manual)',
      'Agenda e historial por clienta',
      'PDF de resultados para tus clientas',
    ],
    features: {
      maxClientas: LIMITE_CLIENTAS_BASICO,
      reportes: false,
      exportacionExcel: false,
      marcaPersonalizada: false,
      calculadoraColor: false,
      iaFacial: false,
      cotizador: true,
      rentabilidad: false,
      diagnosticoIA: false,
      topeAnalisisIAMensual: 0,
      cotizacionSinMarca: false,
    },
  },
  pro: {
    id: 'pro',
    nombre: 'Studio BI',
    precioCop: 89_000,
    tagline: 'Control de precios, costos sin báscula y rentabilidad por servicio',
    beneficios: [
      'Cotizador ilimitado sin báscula',
      'Cierre en 1 toque («Por Cobrar»)',
      'Comprobantes por WhatsApp (/c/[token])',
      'Dashboard BI de Utilidad Neta y Liquidación de Especialistas',
      'Clientas ilimitadas y respaldo de datos',
    ],
    features: {
      maxClientas: null,
      reportes: true,
      exportacionExcel: true,
      marcaPersonalizada: true,
      calculadoraColor: true,
      iaFacial: false,
      cotizador: true,
      rentabilidad: true,
      diagnosticoIA: false,
      topeAnalisisIAMensual: 0,
      cotizacionSinMarca: false,
    },
  },
  pro_ia: {
    id: 'pro_ia',
    nombre: 'Salón Pro + IA',
    precioCop: 149_000,
    tagline: 'Inteligencia Artificial capilar, múltiples especialistas y marca blanca',
    destacado: true,
    beneficios: [
      'Todo lo de Plan Studio BI',
      'Diagnóstico fotográfico con IA (hasta 150 análisis/mes)',
      'Asistente visual IA de porosidad, densidad y canas',
      'Comprobante público sin marca Velli',
      'Soporte prioritario',
    ],
    features: {
      maxClientas: null,
      reportes: true,
      exportacionExcel: true,
      marcaPersonalizada: true,
      calculadoraColor: true,
      iaFacial: true,
      cotizador: true,
      rentabilidad: true,
      diagnosticoIA: true,
      topeAnalisisIAMensual: 150,
      cotizacionSinMarca: true,
    },
  },
};

export const PLAN_IDS = Object.keys(PLANES) as PlanId[];

/** Planes activos comercialmente en Velli Business Intelligence (sin plan básico legado). */
export const PLAN_IDS_COMERCIALES: readonly PlanId[] = ['pro', 'pro_ia'];

export function esPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLANES;
}

/** Flag global de IA facial ("llega después"). Encender requiere plan
 *  pro_ia Y el flag `ia_facial` del entorno (lib/flags; acepta todavía
 *  NEXT_PUBLIC_FEATURE_IA_FACIAL=true) — el rollout es un cambio de env. */
export function iaFacialHabilitada(): boolean {
  return flagsActivos().ia_facial;
}

export function formatearCop(monto: number): string {
  return `$${monto.toLocaleString('es-CO')}`;
}
