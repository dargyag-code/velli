// ══════════════════════════════════════════════════════════════════════════
// CRUD de la knowledge base para el panel de conocimiento (/conocimiento).
// Solo cuentas fundadoras: la RLS de kb_* rechaza escrituras de cualquier
// otra cuenta, y la lectura de borradores también es solo-fundadoras.
// La auditoría (quién cambió qué) la escribe un trigger en la DB.
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import { invalidarCacheKB } from './diagnostico';
import {
  ReglaKBRow,
  FlujoKBRow,
  PromptKBRow,
  DimensionKBRow,
  EstadoKB,
  Condicion,
  SalidaRegla,
  SegmentoRegla,
  DefinicionFlujo,
} from './tipos';

export interface AuditoriaRow {
  id: string;
  tabla: string;
  registro_id: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  usuario: string | null;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  created_at: string;
}

// ── Reglas ──────────────────────────────────────────────────────────────────

export async function listarReglas(locale = 'es'): Promise<ReglaKBRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_reglas')
    .select('*')
    .eq('locale', locale)
    .order('segmento', { ascending: true })
    .order('prioridad', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReglaKBRow[];
}

export interface ReglaEditable {
  id?: string;
  clave: string;
  locale?: string;
  segmento: SegmentoRegla;
  prioridad: number;
  condiciones: Condicion | null;
  salida: SalidaRegla;
  es_bandera_medica: boolean;
  estado: EstadoKB;
  notas_internas?: string | null;
}

export async function guardarRegla(regla: ReglaEditable): Promise<void> {
  const supabase = createClient();
  const payload = {
    clave: regla.clave,
    locale: regla.locale ?? 'es',
    segmento: regla.segmento,
    prioridad: regla.prioridad,
    condiciones: regla.condiciones,
    salida: regla.salida,
    es_bandera_medica: regla.es_bandera_medica,
    estado: regla.estado,
    notas_internas: regla.notas_internas ?? null,
  };
  const { error } = regla.id
    ? await supabase.from('kb_reglas').update(payload).eq('id', regla.id)
    : await supabase.from('kb_reglas').insert(payload);
  if (error) throw error;
  invalidarCacheKB();
}

export async function eliminarRegla(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_reglas').delete().eq('id', id);
  if (error) throw error;
  invalidarCacheKB();
}

export async function cambiarEstadoRegla(id: string, estado: EstadoKB): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_reglas').update({ estado }).eq('id', id);
  if (error) throw error;
  invalidarCacheKB();
}

// ── Flujos ──────────────────────────────────────────────────────────────────

export async function listarFlujos(locale = 'es'): Promise<FlujoKBRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_flujos')
    .select('*')
    .eq('locale', locale)
    .order('clave', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FlujoKBRow[];
}

export interface FlujoEditable {
  id?: string;
  clave: string;
  locale?: string;
  tipos_cabello: string[] | null;
  definicion: DefinicionFlujo;
  estado: EstadoKB;
}

export async function guardarFlujo(flujo: FlujoEditable): Promise<void> {
  const supabase = createClient();
  const payload = {
    clave: flujo.clave,
    locale: flujo.locale ?? 'es',
    tipos_cabello: flujo.tipos_cabello,
    definicion: flujo.definicion,
    estado: flujo.estado,
  };
  const { error } = flujo.id
    ? await supabase.from('kb_flujos').update(payload).eq('id', flujo.id)
    : await supabase.from('kb_flujos').insert(payload);
  if (error) throw error;
  invalidarCacheKB();
}

export async function eliminarFlujo(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_flujos').delete().eq('id', id);
  if (error) throw error;
  invalidarCacheKB();
}

export async function cambiarEstadoFlujo(id: string, estado: EstadoKB): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_flujos').update({ estado }).eq('id', id);
  if (error) throw error;
  invalidarCacheKB();
}

// ── Prompts ─────────────────────────────────────────────────────────────────

export async function listarPrompts(locale = 'es'): Promise<PromptKBRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_prompts')
    .select('*')
    .eq('locale', locale)
    .order('clave', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PromptKBRow[];
}

export interface PromptEditable {
  id?: string;
  clave: string;
  locale?: string;
  tipos_cabello: string[] | null;
  contenido: string;
  estado: EstadoKB;
}

export async function guardarPrompt(prompt: PromptEditable): Promise<void> {
  const supabase = createClient();
  const payload = {
    clave: prompt.clave,
    locale: prompt.locale ?? 'es',
    tipos_cabello: prompt.tipos_cabello,
    contenido: prompt.contenido,
    estado: prompt.estado,
  };
  const { error } = prompt.id
    ? await supabase.from('kb_prompts').update(payload).eq('id', prompt.id)
    : await supabase.from('kb_prompts').insert(payload);
  if (error) throw error;
}

export async function eliminarPrompt(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_prompts').delete().eq('id', id);
  if (error) throw error;
}

export async function cambiarEstadoPrompt(id: string, estado: EstadoKB): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_prompts').update({ estado }).eq('id', id);
  if (error) throw error;
}

// ── Dimensiones ─────────────────────────────────────────────────────────────

export async function listarDimensiones(locale = 'es'): Promise<DimensionKBRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_dimensiones')
    .select('*')
    .eq('locale', locale)
    .order('clave', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimensionKBRow[];
}

// ── Auditoría ───────────────────────────────────────────────────────────────

export async function listarAuditoria(limit = 50): Promise<AuditoriaRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditoriaRow[];
}
