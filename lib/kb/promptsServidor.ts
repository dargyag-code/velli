// ══════════════════════════════════════════════════════════════════════════
// Composición de prompts de IA desde la knowledge base (lado servidor).
//
// El route handler de análisis compone su prompt con los segmentos
// PUBLICADOS de kb_prompts (caché en memoria ~60s): al publicar una versión
// nueva desde el panel de conocimiento, la IA la usa sin redeploy. Si la KB
// no está disponible, cae a las constantes hardcodeadas — comportamiento
// idéntico al actual (tests/prompts.sync.test.ts lo garantiza).
//
// Claves reconocidas:
//   analisis_foto.sistema              → system prompt
//   analisis_foto.principal            → instrucciones de análisis
//   analisis_foto.contexto.<estado>    → contexto por estado del cabello
//   analisis_foto.extra*               → segmentos adicionales; si tienen
//     tipos_cabello, solo se incluyen cuando el request trae tipoEstimado
//     que matchee (conocimiento específico por tipo de cabello).
// ══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { EstadoCabelloFoto } from '@/lib/types';
import { PROMPT_ANALISIS, CONTEXTO_ESTADO } from '@/lib/hairAnalysis';

// Fallback hardcodeado (antes vivía solo en app/api/analyze-hair/route.ts).
export const SYSTEM_PROMPT_ANALISIS =
  'Eres un experto en análisis de texturas capilares. Responde SOLO con el objeto JSON solicitado. No uses backticks, no uses bloques de código markdown, no agregues texto antes ni después del JSON.';

export interface PromptsAnalisis {
  sistema: string;
  usuario: string;
  fuente: 'kb' | 'codigo';
}

interface PromptRowMin {
  clave: string;
  contenido: string;
  tipos_cabello: string[] | null;
}

const TTL_MS = 60 * 1000;
let cache: { rows: PromptRowMin[]; expira: number } | null = null;

async function cargarPromptsPublicados(
  supabase: SupabaseClient,
  locale: string
): Promise<PromptRowMin[] | null> {
  if (cache && cache.expira > Date.now()) return cache.rows;
  try {
    const { data, error } = await supabase
      .from('kb_prompts')
      .select('clave, contenido, tipos_cabello')
      .eq('locale', locale)
      .eq('estado', 'publicada')
      .order('clave', { ascending: true });
    if (error || !data || data.length === 0) return null;
    cache = { rows: data as PromptRowMin[], expira: Date.now() + TTL_MS };
    return cache.rows;
  } catch {
    return null;
  }
}

export async function componerPromptsAnalisis(
  supabase: SupabaseClient,
  estadoCabello: EstadoCabelloFoto,
  tipoEstimado?: string,
  locale = 'es'
): Promise<PromptsAnalisis> {
  const rows = await cargarPromptsPublicados(supabase, locale);

  const contextoFallback = CONTEXTO_ESTADO[estadoCabello] ?? '';
  if (!rows) {
    return {
      sistema: SYSTEM_PROMPT_ANALISIS,
      usuario: `CONTEXTO DE CAPTURA:\n${contextoFallback}\n\n${PROMPT_ANALISIS}`,
      fuente: 'codigo',
    };
  }

  const porClave = new Map(rows.map((r) => [r.clave, r]));
  const sistema = porClave.get('analisis_foto.sistema')?.contenido ?? SYSTEM_PROMPT_ANALISIS;
  const principal = porClave.get('analisis_foto.principal')?.contenido ?? PROMPT_ANALISIS;
  const contexto =
    porClave.get(`analisis_foto.contexto.${estadoCabello}`)?.contenido ?? contextoFallback;

  // Segmentos extra: generales (tipos_cabello null) siempre; específicos
  // solo si el tipo estimado matchea. Publicar conocimiento nuevo por tipo
  // de cabello = crear un prompt analisis_foto.extra.* con esos tipos.
  const extras = rows
    .filter(
      (r) =>
        r.clave.startsWith('analisis_foto.extra') &&
        (r.tipos_cabello === null ||
          (!!tipoEstimado && r.tipos_cabello.includes(tipoEstimado)))
    )
    .map((r) => r.contenido);

  const usuario = [`CONTEXTO DE CAPTURA:\n${contexto}`, principal, ...extras].join('\n\n');
  return { sistema, usuario, fuente: 'kb' };
}
