import { createClient } from '@/lib/supabase/client';
import { PLANES, iaFacialHabilitada, type PlanFeatures, type PlanId, esPlanId } from './plans';

// ── Estado efectivo de la suscripción (lado cliente) ───────────────────────
// Envuelve la RPC public.suscripcion_efectiva(): el estado REAL considerando
// fechas (past_due/expired), no la columna status cruda. La DB es la fuente
// de verdad — esto solo es para pintar UI (banners, gates de features); el
// enforcement duro vive en los triggers de la migración.

export type EstadoSuscripcion = 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';

export interface SuscripcionEfectiva {
  estado: EstadoSuscripcion;
  plan: PlanId | null;
  /** ISO timestamp del vencimiento (trial o periodo pagado). */
  vence: string | null;
  diasRestantes: number | null;
}

export async function getSuscripcionEfectiva(): Promise<SuscripcionEfectiva | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('suscripcion_efectiva');
  if (error) {
    // Sin red o migración no aplicada: no bloquear la UI por el banner.
    console.warn('[suscripcion] no se pudo consultar el estado:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    estado: row.estado as EstadoSuscripcion,
    plan: esPlanId(row.plan) ? row.plan : null,
    vence: (row.vence as string | null) ?? null,
    diasRestantes: (row.dias_restantes as number | null) ?? null,
  };
}

/** Features visibles según el estado efectivo. Durante el trial la estilista
 *  prueba la experiencia completa (Pro+IA). Vencida (expired) conserva
 *  lectura pero pierde features premium de UI. */
export function featuresEfectivas(sub: SuscripcionEfectiva | null): PlanFeatures {
  const sinPlan: PlanFeatures = {
    maxClientas: PLANES.basico.features.maxClientas,
    reportes: false,
    exportacionExcel: false,
    marcaPersonalizada: false,
    iaFacial: false,
  };
  if (!sub) return sinPlan;

  let base: PlanFeatures;
  if (sub.estado === 'trialing') {
    base = PLANES.pro_ia.features;
  } else if (sub.estado === 'expired') {
    return sinPlan;
  } else {
    base = sub.plan ? PLANES[sub.plan].features : sinPlan;
  }

  // IA facial exige además el flag global de rollout.
  return { ...base, iaFacial: base.iaFacial && iaFacialHabilitada() };
}
