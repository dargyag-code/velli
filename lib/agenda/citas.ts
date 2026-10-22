// ══════════════════════════════════════════════════════════════════════════
// Citas de servicio (tabla public.citas) + pruebas de sensibilidad.
//
// La tabla citas existía sin uso (la agenda solo mostraba
// consultas.proxima_cita); los bloqueos de la validación técnica viven
// aquí: el trigger citas_guard_legal fuerza en la DB el bloque tipo 4, los
// solapes y los requisitos de confirmación (parche 48 h + consentimiento
// químico). Este módulo expone el CRUD y deja que la UI muestre los motivos
// con lib/agenda/reglas.ts.
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import type { PruebaSensibilidad } from './reglas';

export type EstadoCita =
  | 'pendiente'
  | 'confirmada'
  | 'completada'
  | 'cancelada'
  | 'no_show';

export interface CitaServicio {
  id: string;
  clientaId: string;
  fecha: string; // ISO timestamp del inicio (incluye la hora)
  duracionMinutos: number;
  servicio: string;
  estado: EstadoCita;
  notas?: string;
}

type CitaRow = {
  id: string;
  user_id: string;
  clienta_id: string;
  fecha: string;
  hora: string | null;
  duracion_minutos: number | null;
  servicio: string | null;
  estado: string | null;
  notas: string | null;
};

function rowToCita(r: CitaRow): CitaServicio {
  return {
    id: r.id,
    clientaId: r.clienta_id,
    fecha: r.fecha,
    duracionMinutos: r.duracion_minutos ?? 60,
    servicio: r.servicio ?? '',
    estado: (r.estado as EstadoCita) ?? 'pendiente',
    notas: r.notas ?? undefined,
  };
}

// Citas desde hoy (incluye las de hoy ya pasadas para ver el día completo).
export async function listarCitasServicio(): Promise<CitaServicio[]> {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('citas')
    .select('*')
    .gte('fecha', inicioHoy.toISOString())
    .order('fecha', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCita);
}

export async function crearCitaServicio(params: {
  clientaId: string;
  fecha: Date;
  duracionMinutos: number;
  servicio: string;
  notas?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabase.from('citas').insert({
    user_id: user.id,
    clienta_id: params.clientaId,
    fecha: params.fecha.toISOString(),
    hora: params.fecha.toTimeString().slice(0, 5),
    duracion_minutos: params.duracionMinutos,
    servicio: params.servicio,
    estado: 'pendiente',
    notas: params.notas || null,
  });
  if (error) throw error;
}

// Cambia el estado. La confirmación puede rechazarla el trigger
// citas_guard_legal (parche / consentimiento) — el error sube al caller.
export async function cambiarEstadoCita(
  id: string,
  estado: EstadoCita
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('citas')
    .update({ estado })
    .eq('id', id);
  if (error) throw error;
}

// ── Pruebas de sensibilidad (parche cutáneo) ───────────────────────────────

type PruebaRow = {
  id: string;
  clienta_id: string;
  aplicado_at: string;
  resultado: 'negativo' | 'positivo';
  notas: string | null;
};

function rowToPrueba(r: PruebaRow): PruebaSensibilidad {
  return {
    id: r.id,
    clientaId: r.clienta_id,
    aplicadoAt: r.aplicado_at,
    resultado: r.resultado,
    notas: r.notas ?? undefined,
  };
}

export async function listarPruebasSensibilidad(
  clientaId: string
): Promise<PruebaSensibilidad[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pruebas_sensibilidad')
    .select('*')
    .eq('clienta_id', clientaId)
    .order('aplicado_at', { ascending: false });
  if (error) {
    // Migración legal-gobernanza sin aplicar → sin registros (gating cerrado).
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data ?? []).map(rowToPrueba);
}

export async function registrarPruebaSensibilidad(params: {
  clientaId: string;
  aplicadoAt: Date;
  resultado: 'negativo' | 'positivo';
  notas?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabase.from('pruebas_sensibilidad').insert({
    user_id: user.id,
    clienta_id: params.clientaId,
    aplicado_at: params.aplicadoAt.toISOString(),
    resultado: params.resultado,
    notas: params.notas || null,
  });
  if (error) throw error;
}
