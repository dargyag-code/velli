// ══════════════════════════════════════════════════════════════════════════
// Diagnóstico vía knowledge base con fallback al motor legacy.
//
// El wizard llama generarDiagnostico(): intenta cargar las reglas
// PUBLICADAS desde Supabase (caché en memoria, 5 min) y evaluarlas; si la
// KB no está disponible (migración sin aplicar, sin red, tabla vacía) cae
// al motor legacy generateDiagnosis. La prueba de regresión garantiza que
// con el seed ambos caminos producen exactamente el mismo resultado.
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import { WizardData, ResultadoConsulta } from '@/lib/types';
import { generateDiagnosis, SaludClienta } from '@/lib/diagnosticEngine';
import { evaluarDiagnostico } from './evaluador';
import { ReglaKB, ReglaKBRow, FlujoKBRow } from './tipos';

const TTL_MS = 5 * 60 * 1000;

type CacheReglas = { reglas: ReglaKB[]; expira: number } | null;
type CacheFlujos = { flujos: FlujoKBRow[]; expira: number } | null;

let cacheReglas: CacheReglas = null;
let cacheFlujos: CacheFlujos = null;

/** Vacía los cachés en memoria (lo usa el panel tras publicar cambios). */
export function invalidarCacheKB(): void {
  cacheReglas = null;
  cacheFlujos = null;
}

export function rowToRegla(r: ReglaKBRow): ReglaKB {
  return {
    clave: r.clave,
    segmento: r.segmento,
    prioridad: r.prioridad,
    condiciones: r.condiciones,
    salida: r.salida,
    esBanderaMedica: r.es_bandera_medica,
    locale: r.locale,
    estado: r.estado,
  };
}

/**
 * Reglas publicadas desde Supabase. Devuelve null si la KB no está
 * disponible o está vacía — la señal para usar el motor legacy.
 */
export async function cargarReglasPublicadas(locale = 'es'): Promise<ReglaKB[] | null> {
  if (cacheReglas && cacheReglas.expira > Date.now()) return cacheReglas.reglas;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('kb_reglas')
      .select('*')
      .eq('locale', locale)
      .eq('estado', 'publicada')
      .order('segmento', { ascending: true })
      .order('prioridad', { ascending: true });
    if (error || !data || data.length === 0) return null;
    const reglas = (data as ReglaKBRow[]).map(rowToRegla);
    cacheReglas = { reglas, expira: Date.now() + TTL_MS };
    return reglas;
  } catch {
    return null;
  }
}

/**
 * Genera el diagnóstico. Usa la knowledge base publicada cuando existe;
 * si no, el motor legacy (mismo resultado, garantizado por regresión).
 */
export async function generarDiagnostico(
  data: WizardData,
  salud?: SaludClienta
): Promise<{ resultado: ResultadoConsulta; fuente: 'kb' | 'legacy' }> {
  const reglas = await cargarReglasPublicadas();
  if (reglas) {
    try {
      return { resultado: evaluarDiagnostico(reglas, data, salud), fuente: 'kb' };
    } catch (e) {
      // Una regla malformada publicada por error no debe tumbar el wizard.
      console.error('[kb] evaluación falló, usando motor legacy:', e);
    }
  }
  return { resultado: generateDiagnosis(data, salud), fuente: 'legacy' };
}

/**
 * Flujo de wizard PUBLICADO aplicable al tipo de cabello (o null).
 * Solo los flujos publicados activan preguntas dinámicas — los borradores
 * (p.ej. el flujo de liso del seed) no afectan producción.
 */
export async function cargarFlujoParaTipo(
  tipoCabello: string,
  locale = 'es'
): Promise<FlujoKBRow | null> {
  if (!tipoCabello) return null;
  try {
    if (!cacheFlujos || cacheFlujos.expira <= Date.now()) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('kb_flujos')
        .select('*')
        .eq('locale', locale)
        .eq('estado', 'publicada');
      if (error || !data) return null;
      cacheFlujos = { flujos: data as FlujoKBRow[], expira: Date.now() + TTL_MS };
    }
    return (
      cacheFlujos.flujos.find(
        (f) => f.tipos_cabello === null || f.tipos_cabello.includes(tipoCabello)
      ) ?? null
    );
  } catch {
    return null;
  }
}
