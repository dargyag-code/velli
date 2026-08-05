// ══════════════════════════════════════════════════════════════════════════
// Acceso a kb_cortes (catálogo global) y a cortes_ejecutados (historial).
//
// Gobernanza igual que kb_marcas: la escritura del catálogo base la corta la
// RLS al rol corporativo; los salones solo leen las fichas publicadas.
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import type { EstadoKB } from '@/lib/kb/tipos';
import { FICHAS_CORTE } from './fichas';
import type {
  CapasCorte, EtiquetaGenero, FichaCorte, FormaRostro, LargoCorte,
} from './tipos';

export interface CorteKBRow {
  id: string;
  clave: string;
  locale: string;
  nombre: string;
  largo: LargoCorte;
  capas: CapasCorte;
  densidad_ideal: string[] | null;
  textura: string[] | null;
  etiqueta_genero: EtiquetaGenero;
  ficha: Omit<FichaCorte, 'clave' | 'nombre' | 'largo' | 'capas' | 'etiquetaGenero'>;
  ciclo_semanas_min: number;
  ciclo_semanas_max: number;
  estado: EstadoKB;
  version: number;
  notas_internas: string | null;
}

/** Reconstruye la FichaCorte que consume la matriz desde la fila de la DB. */
export function rowToFicha(r: CorteKBRow): FichaCorte {
  return {
    ...r.ficha,
    clave: r.clave,
    nombre: r.nombre,
    largo: r.largo,
    capas: r.capas,
    etiquetaGenero: r.etiqueta_genero,
    densidadIdeal: (r.densidad_ideal ?? []) as FichaCorte['densidadIdeal'],
    textura: (r.textura ?? []) as FichaCorte['textura'],
    cicloSemanas: [r.ciclo_semanas_min, r.ciclo_semanas_max],
  };
}

/**
 * Catálogo activo para la matriz: las fichas PUBLICADAS de kb_cortes. Si la
 * migración no corrió o aún no hay nada publicado, cae al seed canónico —
 * mismo patrón que el motor de diagnóstico con su fallback.
 */
export async function cargarCatalogo(): Promise<{ fichas: FichaCorte[]; origen: 'kb' | 'seed' }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_cortes')
    .select('*')
    .eq('estado', 'publicada')
    .eq('locale', 'es');
  if (error || !data || data.length === 0) {
    return { fichas: FICHAS_CORTE, origen: 'seed' };
  }
  return { fichas: (data as CorteKBRow[]).map(rowToFicha), origen: 'kb' };
}

/** Todas las fichas, incluidos borradores (solo el rol corporativo las ve). */
export async function listarCortes(): Promise<CorteKBRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kb_cortes')
    .select('*')
    .eq('locale', 'es')
    .order('clave', { ascending: true });
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data ?? []) as CorteKBRow[];
}

export async function cambiarEstadoCorte(id: string, estado: EstadoKB): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('kb_cortes').update({ estado }).eq('id', id);
  if (error) throw error;
}

// ── Historial de cortes ejecutados ────────────────────────────────────────

export interface CorteEjecutado {
  id: string;
  clientaId: string;
  corteClave: string;
  variante?: string;
  formaRostro?: FormaRostro;
  citaMantenimientoId?: string;
  fotoAntes?: string;
  fotoDespues?: string;
  notas?: string;
  createdAt: string;
}

export async function listarCortesEjecutados(clientaId: string): Promise<CorteEjecutado[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cortes_ejecutados')
    .select('*')
    .eq('clienta_id', clientaId)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    clientaId: r.clienta_id,
    corteClave: r.corte_clave,
    variante: r.variante ?? undefined,
    formaRostro: r.forma_rostro ?? undefined,
    citaMantenimientoId: r.cita_mantenimiento_id ?? undefined,
    fotoAntes: r.foto_antes ?? undefined,
    fotoDespues: r.foto_despues ?? undefined,
    notas: r.notas ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function registrarCorteEjecutado(params: {
  clientaId: string;
  corteClave: string;
  variante?: string;
  formaRostro?: FormaRostro;
  razonamiento?: unknown;
  fotoAntes?: string;
  fotoDespues?: string;
  notas?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabase.from('cortes_ejecutados').insert({
    user_id: user.id,
    clienta_id: params.clientaId,
    corte_clave: params.corteClave,
    variante: params.variante ?? null,
    forma_rostro: params.formaRostro ?? null,
    razonamiento: params.razonamiento ?? null,
    foto_antes: params.fotoAntes ?? null,
    foto_despues: params.fotoDespues ?? null,
    notas: params.notas || null,
  });
  if (error) throw error;
}
