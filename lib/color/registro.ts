// ══════════════════════════════════════════════════════════════════════════
// Registro del servicio de color en el historial (Entrega 3 §7.3).
// Se guarda la fórmula FINAL —la que la estilista dejó tras editarla— junto
// al razonamiento que mostró la calculadora, el proceso y la foto.
// ══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import type { FormulaSugerida, GuiaRazonamiento } from './tipos';

export interface ServicioColorRegistrado {
  id: string;
  clientaId: string;
  marcaId?: string;
  formulaFinal: FormulaSugerida;
  guiaRazonamiento?: GuiaRazonamiento;
  proceso: string;
  fotoResultado?: string;
  notas?: string;
  createdAt: string;
}

type ServicioRow = {
  id: string;
  clienta_id: string;
  marca_id: string | null;
  formula_final: FormulaSugerida;
  guia_razonamiento: GuiaRazonamiento | null;
  proceso: string;
  foto_resultado: string | null;
  notas: string | null;
  created_at: string;
};

function rowToServicio(r: ServicioRow): ServicioColorRegistrado {
  return {
    id: r.id,
    clientaId: r.clienta_id,
    marcaId: r.marca_id ?? undefined,
    formulaFinal: r.formula_final,
    guiaRazonamiento: r.guia_razonamiento ?? undefined,
    proceso: r.proceso,
    fotoResultado: r.foto_resultado ?? undefined,
    notas: r.notas ?? undefined,
    createdAt: r.created_at,
  };
}

export async function listarServiciosColor(
  clientaId: string
): Promise<ServicioColorRegistrado[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('servicios_color')
    .select('*')
    .eq('clienta_id', clientaId)
    .order('created_at', { ascending: false });
  if (error) {
    // Migración de colorimetría sin aplicar en este entorno.
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data ?? []).map(rowToServicio);
}

export async function registrarServicioColor(params: {
  clientaId: string;
  marcaId?: string;
  formulaFinal: FormulaSugerida;
  guiaRazonamiento?: GuiaRazonamiento;
  proceso: string;
  fotoResultado?: string;
  notas?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase.from('servicios_color').insert({
    user_id: user.id,
    clienta_id: params.clientaId,
    marca_id: params.marcaId ?? null,
    formula_final: params.formulaFinal,
    guia_razonamiento: params.guiaRazonamiento ?? null,
    proceso: params.proceso,
    foto_resultado: params.fotoResultado ?? null,
    notas: params.notas || null,
  });
  if (error) throw error;
}
