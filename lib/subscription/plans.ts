// ── Planes y feature flags de Velli Pro ────────────────────────────────────
// Fuente de verdad de precios/límites en el código. Las constantes de días
// (trial 14, periodo 30, gracia 3) se espejan en
// supabase/migration-suscripciones.sql — cambiar ambos lados a la vez.

export type PlanId = 'basico' | 'pro' | 'pro_ia';

export interface PlanFeatures {
  /** null = ilimitadas */
  maxClientas: number | null;
  reportes: boolean;
  /** Exportación a Excel (Pro+). El backup JSON de Configuración NO se
   *  paywallea: los datos siempre son de la estilista. */
  exportacionExcel: boolean;
  marcaPersonalizada: boolean;
  /** IA facial (Pro+IA). Llega después: además del plan, exige el feature
   *  flag global NEXT_PUBLIC_FEATURE_IA_FACIAL=true para encenderse. */
  iaFacial: boolean;
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
      'Diagnósticos ilimitados con IA capilar',
      'Agenda y historial por clienta',
      'PDF de resultados para tus clientas',
    ],
    features: {
      maxClientas: LIMITE_CLIENTAS_BASICO,
      reportes: false,
      exportacionExcel: false,
      marcaPersonalizada: false,
      iaFacial: false,
    },
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precioCop: 60_000,
    tagline: 'Para salones en crecimiento',
    destacado: true,
    beneficios: [
      'Clientas ilimitadas',
      'Todo lo del plan Básico',
      'Reportes de tu negocio',
      'Exportación a Excel',
      'Personalización de marca',
    ],
    features: {
      maxClientas: null,
      reportes: true,
      exportacionExcel: true,
      marcaPersonalizada: true,
      iaFacial: false,
    },
  },
  pro_ia: {
    id: 'pro_ia',
    nombre: 'Pro + IA',
    precioCop: 120_000,
    tagline: 'La experiencia Velli completa',
    beneficios: [
      'Todo lo del plan Pro',
      'Funciones de IA facial (próximamente)',
      'Acceso anticipado a nuevas funciones de IA',
    ],
    features: {
      maxClientas: null,
      reportes: true,
      exportacionExcel: true,
      marcaPersonalizada: true,
      iaFacial: true,
    },
  },
};

export const PLAN_IDS = Object.keys(PLANES) as PlanId[];

export function esPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLANES;
}

/** Flag global de IA facial ("llega después"). Encender requiere plan
 *  pro_ia Y este flag — así el rollout es un cambio de env, no de código. */
export function iaFacialHabilitada(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_IA_FACIAL === 'true';
}

export function formatearCop(monto: number): string {
  return `$${monto.toLocaleString('es-CO')}`;
}
