// ══════════════════════════════════════════════════════════════════════════
// Consentimientos digitales por clienta (validación técnica, sección 6.P3).
//
// Firma digital = nombre completo tecleado + checkbox de aceptación +
// timestamp + versión aceptada, guardada por clienta en su historial
// (public.consentimientos_clienta, registro inmutable — la RLS no permite
// UPDATE/DELETE). "Vigente" = la versión aceptada coincide con la versión
// actual del documento (CONSENTIMIENTO_VERSIONES / legal_versiones en DB).
//
// GATING DURO de cámara: las fotografías del cuero cabelludo (módulo de
// alopecia — flujo transversal de cabina del wizard) y el registro
// fotográfico de servicios químicos son datos sensibles de salud. La cámara
// NO se activa en esos contextos sin consentimiento_imagenes vigente de la
// clienta. La confirmación de decoloraciones exige además
// consentimiento_quimico vigente (eso lo refuerza el trigger
// citas_guard_legal en la DB — ver lib/agenda/reglas.ts).
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import {
  CONSENTIMIENTO_VERSIONES,
  TipoConsentimiento,
} from '@/lib/legal';

export interface ConsentimientoClienta {
  id: string;
  clientaId: string;
  tipo: TipoConsentimiento;
  versionAceptada: string;
  nombreFirmante: string;
  aceptado: boolean;
  firmadoAt: string;
}

// ── Reglas puras (testeadas en tests/gobernanza.legal.test.ts) ─────────────

// ¿Existe una firma vigente (versión actual) de este tipo para la clienta?
export function tieneConsentimientoVigente(
  firmas: Pick<ConsentimientoClienta, 'tipo' | 'versionAceptada' | 'aceptado'>[],
  tipo: TipoConsentimiento,
  versiones: Record<TipoConsentimiento, string> = CONSENTIMIENTO_VERSIONES
): boolean {
  return firmas.some(
    (f) => f.tipo === tipo && f.aceptado && f.versionAceptada === versiones[tipo]
  );
}

export type ContextoCamara =
  // Cámara del wizard de diagnóstico: sus fotos incluyen cuero cabelludo y
  // alimentan el módulo transversal de alopecia (flujo de cabina, Fase 2).
  | 'analisis_alopecia'
  // Fotos antes/después cuando la consulta registra procesos químicos.
  | 'registro_servicio_quimico';

export interface EstadoCamara {
  permitida: boolean;
  motivo?: 'sin_clienta' | 'falta_consentimiento';
}

// GATING DURO: sin clienta registrada no hay a quién atribuir la firma →
// bloqueada; con clienta, exige consentimiento_imagenes vigente.
export function evaluarCamara(params: {
  contexto: ContextoCamara;
  clientaRegistrada: boolean;
  firmas: Pick<ConsentimientoClienta, 'tipo' | 'versionAceptada' | 'aceptado'>[];
  versiones?: Record<TipoConsentimiento, string>;
}): EstadoCamara {
  if (!params.clientaRegistrada) {
    return { permitida: false, motivo: 'sin_clienta' };
  }
  const vigente = tieneConsentimientoVigente(
    params.firmas,
    'consentimiento_imagenes',
    params.versiones ?? CONSENTIMIENTO_VERSIONES
  );
  return vigente
    ? { permitida: true }
    : { permitida: false, motivo: 'falta_consentimiento' };
}

// ── Acceso a datos ─────────────────────────────────────────────────────────

type ConsentimientoRow = {
  id: string;
  clienta_id: string;
  tipo: TipoConsentimiento;
  version_aceptada: string;
  nombre_firmante: string;
  aceptado: boolean;
  firmado_at: string;
};

function rowToConsentimiento(r: ConsentimientoRow): ConsentimientoClienta {
  return {
    id: r.id,
    clientaId: r.clienta_id,
    tipo: r.tipo,
    versionAceptada: r.version_aceptada,
    nombreFirmante: r.nombre_firmante,
    aceptado: r.aceptado,
    firmadoAt: r.firmado_at,
  };
}

export async function listarConsentimientos(
  clientaId: string
): Promise<ConsentimientoClienta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consentimientos_clienta')
    .select('*')
    .eq('clienta_id', clientaId)
    .order('firmado_at', { ascending: false });
  if (error) {
    // Tabla inexistente → la migración legal-gobernanza no corrió en este
    // entorno. Tratar como "sin firmas": el gating queda cerrado (seguro).
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data ?? []).map(rowToConsentimiento);
}

export async function firmarConsentimiento(params: {
  clientaId: string;
  tipo: TipoConsentimiento;
  nombreFirmante: string;
}): Promise<ConsentimientoClienta> {
  const nombre = params.nombreFirmante.trim();
  if (nombre.length < 5) {
    throw new Error('Escribe el nombre completo de la clienta (firma digital).');
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('consentimientos_clienta')
    .insert({
      user_id: user.id,
      clienta_id: params.clientaId,
      tipo: params.tipo,
      version_aceptada: CONSENTIMIENTO_VERSIONES[params.tipo],
      nombre_firmante: nombre,
      aceptado: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToConsentimiento(data as ConsentimientoRow);
}
