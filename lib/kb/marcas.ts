// ══════════════════════════════════════════════════════════════════════════
// Librería global de marcas (cartas técnicas) + selección por salón.
//
// Gobernanza (validación Keila, sección 6.P2):
// - kb_marcas la administra SOLO el nivel corporativo (RLS con
//   es_cuenta_corporativa()); el resto de cuentas solo lee las publicadas.
// - El rol salon selecciona cuáles marcas publicadas están activas en su
//   inventario físico vía salon_marcas_activas (su única escritura).
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import type { EstadoKB } from './tipos';

export interface MarcaKBRow {
  id: string;
  clave: string;
  locale: string;
  nombre: string;
  carta: Record<string, unknown> | null;
  estado: EstadoKB;
  version: number;
  notas_internas: string | null;
  created_at: string;
  updated_at: string;
}

// ── Librería global (lectura para todos; escritura la corta la RLS) ────────

export async function listarMarcas(locale = 'es'): Promise<MarcaKBRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_marcas')
    .select('*')
    .eq('locale', locale)
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MarcaKBRow[];
}

export interface MarcaEditable {
  id?: string;
  clave: string;
  locale?: string;
  nombre: string;
  carta: Record<string, unknown> | null;
  estado: EstadoKB;
  notas_internas?: string | null;
}

export async function guardarMarca(marca: MarcaEditable): Promise<void> {
  const supabase = createClient();
  const payload = {
    clave: marca.clave,
    locale: marca.locale ?? 'es',
    nombre: marca.nombre,
    carta: marca.carta,
    estado: marca.estado,
    notas_internas: marca.notas_internas ?? null,
  };
  const { error } = marca.id
    ? await supabase.from('kb_marcas').update(payload).eq('id', marca.id)
    : await supabase.from('kb_marcas').insert(payload);
  if (error) throw error;
}

export async function eliminarMarca(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_marcas').delete().eq('id', id);
  if (error) throw error;
}

// ── Selección del salón (salon_marcas_activas) ─────────────────────────────

export async function listarMarcasActivasIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('salon_marcas_activas')
    .select('marca_id');
  if (error) {
    if (error.code === '42P01') return new Set();
    throw error;
  }
  return new Set((data ?? []).map((r) => r.marca_id as string));
}

export async function activarMarca(marcaId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabase
    .from('salon_marcas_activas')
    .upsert(
      { user_id: user.id, marca_id: marcaId },
      { onConflict: 'user_id,marca_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function desactivarMarca(marcaId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabase
    .from('salon_marcas_activas')
    .delete()
    .eq('user_id', user.id)
    .eq('marca_id', marcaId);
  if (error) throw error;
}
