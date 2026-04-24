import { createClient } from '@/lib/supabase/client';
import type {
  Clienta,
  Consulta,
  CaptureMetadata,
  CronogramaResult,
  CuidadoCasaResult,
  ProductosActuales,
  ResultadoConsulta,
} from './types';

// ══════════════════════════════════════════════════════════════════════════
// Mappers snake_case (Supabase) ⇄ camelCase (tipos TS del wizard/engine)
// Los campos JSONB (resultado, productos_actuales, capture_metadata) se
// preservan como objetos completos — el motor y el PDF los consumen sin
// transformación.
// ══════════════════════════════════════════════════════════════════════════

type ClientaRow = {
  id: string;
  user_id: string;
  nombre: string;
  edad: number | null;
  telefono: string | null;
  email: string | null;
  // La tabla real NO tiene fecha_registro — se deriva de created_at al leer.
  created_at: string | null;
  nivel_estres: 'bajo' | 'medio' | 'alto' | null;
  embarazo_lactancia: boolean | null;
  alergias: string | null;
  condiciones_medicas: string | null;
  medicamentos: string | null;
  tipo_cabello_principal: string | null;
  ultima_visita: string | null;
  total_visitas: number;
};

type ConsultaRow = {
  id: string;
  user_id: string;
  clienta_id: string;
  fecha: string;
  // Wizard técnico
  tipo_cabello: string | null;
  porosidad: 'baja' | 'media' | 'alta' | null;
  densidad: 'baja' | 'media' | 'alta' | null;
  grosor_hebra: 'fino' | 'medio' | 'grueso' | null;
  elasticidad: 'baja' | 'media' | 'alta' | null;
  balance_hp: 'hidratacion' | 'nutricion' | 'proteina' | 'equilibrado' | null;
  estado_puntas: string | null;
  nivel_dano: string | null;
  estado_transicion: string | null;
  estado_cuero_cabelludo: string[];
  // Wizard historial
  historial_quimicos: string[];
  problemas: string[];
  frecuencia_calor: string | null;
  frecuencia_lavado: string | null;
  // Motor (columnas derivadas + catch-all JSONB).
  // recomendaciones_casa y cronograma son TEXT[] en la DB — se aplanan
  // desde el objeto estructurado al escribir. La estructura original
  // completa se preserva en resultado_ia (JSONB).
  necesidad_principal: string | null;
  tecnica_definicion: string | null;
  productos_recomendados: string[] | null;
  recomendaciones_casa: string[] | null;
  resultado_esperado: string | null;
  tratamientos: string[] | null;
  cronograma: string[] | null;
  resultado_ia: ResultadoConsulta | null;
  ia_confirmada: boolean;
  // Post-consulta
  observaciones_estilista: string | null;
  satisfaccion_clienta: Consulta['satisfaccion'] | null;
  proxima_cita: string | null;
  // Fotos y captura
  foto_antes: string | null;
  foto_despues: string | null;
  foto_analisis: string[] | null;
  capture_metadata: CaptureMetadata | null;
  es_borrador: boolean;
};

function rowToClienta(r: ClientaRow): Clienta {
  return {
    id: r.id,
    nombre: r.nombre,
    edad: r.edad ?? 0,
    telefono: r.telefono ?? '',
    email: r.email ?? undefined,
    // fechaRegistro se deriva de created_at (la tabla no tiene fecha_registro).
    fechaRegistro: r.created_at ? r.created_at.substring(0, 10) : '',
    nivelEstres: r.nivel_estres ?? undefined,
    embarazo: r.embarazo_lactancia ?? undefined,
    alergias: r.alergias ?? undefined,
    condicionesMedicas: r.condiciones_medicas ?? undefined,
    medicamentos: r.medicamentos ?? undefined,
    tipoRizoPrincipal: r.tipo_cabello_principal ?? undefined,
    ultimaVisita: r.ultima_visita ?? undefined,
    totalVisitas: r.total_visitas,
  };
}

function clientaToRow(c: Clienta): Omit<ClientaRow, 'user_id' | 'created_at'> {
  return {
    id: c.id,
    nombre: c.nombre,
    edad: c.edad ?? 0,
    telefono: c.telefono ?? null,
    email: c.email ?? null,
    // nivel_estres tiene CHECK en Supabase — strings vacíos deben ir como null.
    nivel_estres: c.nivelEstres || null,
    embarazo_lactancia: c.embarazo ?? null,
    alergias: c.alergias ?? null,
    condiciones_medicas: c.condicionesMedicas ?? null,
    medicamentos: c.medicamentos ?? null,
    tipo_cabello_principal: c.tipoRizoPrincipal ?? null,
    ultima_visita: c.ultimaVisita ?? null,
    total_visitas: c.totalVisitas,
  };
}

const EMPTY_CRONOGRAMA: CronogramaResult = {
  semana1: '', semana2: '', semana3: '', semana4: '',
};
const EMPTY_CUIDADO_CASA: CuidadoCasaResult = {
  diaLavado: [], nocturno: [], refresh: [], evitar: [],
};
const EMPTY_PRODUCTOS_ACTUALES: ProductosActuales = {};

// Aplana CuidadoCasaResult → array de strings con prefijo de categoría.
function flattenCuidadoCasa(c: CuidadoCasaResult | null | undefined): string[] | null {
  if (!c) return null;
  const out: string[] = [];
  for (const s of c.diaLavado ?? []) out.push(`Día de lavado: ${s}`);
  for (const s of c.nocturno ?? []) out.push(`Nocturno: ${s}`);
  for (const s of c.refresh ?? []) out.push(`Refresh: ${s}`);
  for (const s of c.evitar ?? []) out.push(`Evitar: ${s}`);
  return out.length ? out : null;
}

// Aplana CronogramaResult → array de strings por semana.
function flattenCronograma(c: CronogramaResult | null | undefined): string[] | null {
  if (!c) return null;
  const out: string[] = [];
  if (c.semana1) out.push(`Semana 1: ${c.semana1}`);
  if (c.semana2) out.push(`Semana 2: ${c.semana2}`);
  if (c.semana3) out.push(`Semana 3: ${c.semana3}`);
  if (c.semana4) out.push(`Semana 4: ${c.semana4}`);
  return out.length ? out : null;
}

function rowToConsulta(r: ConsultaRow): Consulta {
  // Preferir resultado_ia (catch-all JSONB con la estructura original).
  // Si no está, reconstruir desde columnas split — pero cronograma y
  // cuidadoCasa se almacenan aplanados como TEXT[] y no son reconstruibles
  // a la estructura original: se usan defaults vacíos.
  const resultado: ResultadoConsulta =
    (r.resultado_ia as ResultadoConsulta | null) ?? {
      tratamientoPrincipal: r.necesidad_principal ?? '',
      tratamientosAdicionales: r.tratamientos ?? [],
      cronograma: EMPTY_CRONOGRAMA,
      tecnicaDefinicion: r.tecnica_definicion ?? '',
      tecnicaDescripcion: '',
      metodoSecado: '',
      productosPonto: r.productos_recomendados ?? [],
      cuidadoCasa: EMPTY_CUIDADO_CASA,
      intervaloSugerido: '',
      notasAdicionales: [],
    };

  return {
    id: r.id,
    clientaId: r.clienta_id,
    fecha: r.fecha,
    // numero_consulta no se almacena — se reconstruye contando en UI.
    numeroConsulta: 1,
    // Historial (los no almacenados vuelven con defaults)
    quimicos: r.historial_quimicos ?? [],
    ultimoQuimico: undefined,
    usoCalor: [],
    frecuenciaCalor: r.frecuencia_calor ?? '',
    usaProtectorTermico: false,
    frecuenciaLavado: r.frecuencia_lavado ?? '',
    metodoLavado: '',
    productosActuales: EMPTY_PRODUCTOS_ACTUALES,
    problemas: r.problemas ?? [],
    otroProblema: undefined,
    // Técnico
    tipoRizoPrincipal: r.tipo_cabello ?? '',
    tiposSecundarios: undefined,
    zonasCambio: r.estado_transicion ?? undefined,
    porosidad: r.porosidad ?? undefined,
    porosidadObs: undefined,
    densidad: r.densidad ?? undefined,
    grosor: r.grosor_hebra ?? undefined,
    elasticidad: r.elasticidad ?? undefined,
    balanceHP: r.balance_hp ?? undefined,
    estadoCueroCabelludo: r.estado_cuero_cabelludo ?? [],
    obsCueroCabelludo: undefined,
    estadoPuntas: r.estado_puntas ?? undefined,
    tipoDano: r.nivel_dano ? [r.nivel_dano] : [],
    lineaDemarcacion: undefined,
    // Salud: no vive en consultas. Se lee de clientas cuando haga falta.
    alergias: undefined,
    condicionesMedicas: undefined,
    medicamentos: undefined,
    embarazo: false,
    nivelEstres: '',
    resultado,
    satisfaccion: r.satisfaccion_clienta ?? undefined,
    // satisfaccion_estrellas no existe — no se persiste.
    satisfaccionEstrellas: undefined,
    notasEstilista: r.observaciones_estilista ?? undefined,
    proximaCita: r.proxima_cita ?? undefined,
    fotoAntes: r.foto_antes ?? undefined,
    fotoDespues: r.foto_despues ?? undefined,
    fotoAnalisis: r.foto_analisis ?? undefined,
    captureMetadata: r.capture_metadata ?? undefined,
    esBorrador: r.es_borrador,
  };
}

function consultaToRow(c: Consulta): Omit<ConsultaRow, 'user_id'> {
  return {
    id: c.id,
    clienta_id: c.clientaId,
    fecha: c.fecha,
    // Técnico (campos con CHECK usan `|| null` para normalizar '' → null).
    tipo_cabello: c.tipoRizoPrincipal || null,
    porosidad: c.porosidad || null,
    densidad: c.densidad || null,
    grosor_hebra: c.grosor || null,
    elasticidad: c.elasticidad || null,
    balance_hp: c.balanceHP || null,
    estado_puntas: c.estadoPuntas ?? null,
    // nivel_dano es single-value — tomamos el primer tipoDano si existe.
    nivel_dano: c.tipoDano?.[0] ?? null,
    estado_transicion: c.zonasCambio ?? null,
    estado_cuero_cabelludo: c.estadoCueroCabelludo,
    // Historial
    historial_quimicos: c.quimicos,
    problemas: c.problemas,
    frecuencia_calor: c.frecuenciaCalor || null,
    frecuencia_lavado: c.frecuenciaLavado || null,
    // Motor: columnas derivadas para queries + resultado_ia como catch-all.
    necesidad_principal: c.resultado?.tratamientoPrincipal || null,
    tecnica_definicion: c.resultado?.tecnicaDefinicion || null,
    productos_recomendados: c.resultado?.productosPonto ?? null,
    recomendaciones_casa: flattenCuidadoCasa(c.resultado?.cuidadoCasa),
    resultado_esperado: null,
    tratamientos: c.resultado?.tratamientosAdicionales ?? null,
    cronograma: flattenCronograma(c.resultado?.cronograma),
    resultado_ia: c.resultado ?? null,
    ia_confirmada: false,
    // Post-consulta
    observaciones_estilista: c.notasEstilista ?? null,
    // satisfaccion_clienta tiene CHECK — '' → null.
    satisfaccion_clienta: c.satisfaccion || null,
    proxima_cita: c.proximaCita ?? null,
    // Fotos y captura
    foto_antes: c.fotoAntes ?? null,
    foto_despues: c.fotoDespues ?? null,
    foto_analisis: c.fotoAnalisis ?? null,
    capture_metadata: c.captureMetadata ?? null,
    es_borrador: c.esBorrador ?? false,
  };
}

async function currentUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  return user.id;
}

// ══════════════════════════════════════════════════════════════════════════
// Clientas
// ══════════════════════════════════════════════════════════════════════════

export async function getAllClientas(): Promise<Clienta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clientas')
    .select('*')
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToClienta);
}

export async function getClientaById(id: string): Promise<Clienta | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clientas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToClienta(data) : undefined;
}

export async function createClienta(clienta: Clienta): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const { error } = await supabase
    .from('clientas')
    .insert({ ...clientaToRow(clienta), user_id: userId });
  if (error) throw error;
}

export async function updateClienta(clienta: Clienta): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const { error } = await supabase
    .from('clientas')
    .upsert({ ...clientaToRow(clienta), user_id: userId });
  if (error) throw error;
}

export async function deleteClienta(id: string): Promise<void> {
  // ON DELETE CASCADE en consultas ya borra el historial.
  const supabase = createClient();
  const { error } = await supabase.from('clientas').delete().eq('id', id);
  if (error) throw error;
}

export async function searchClientas(query: string): Promise<Clienta[]> {
  if (!query) return getAllClientas();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clientas')
    .select('*')
    .ilike('nombre', `%${query}%`)
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToClienta);
}

export async function getRecentClientas(limit = 8): Promise<Clienta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clientas')
    .select('*')
    .not('ultima_visita', 'is', null)
    .order('ultima_visita', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToClienta);
}

// ══════════════════════════════════════════════════════════════════════════
// Consultas
// ══════════════════════════════════════════════════════════════════════════

export async function getConsultasByClienta(clientaId: string): Promise<Consulta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('*')
    .eq('clienta_id', clientaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToConsulta);
}

export async function getConsultaById(id: string): Promise<Consulta | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToConsulta(data) : undefined;
}

export async function createConsulta(consulta: Consulta): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();

  const { error: insertError } = await supabase
    .from('consultas')
    .insert({ ...consultaToRow(consulta), user_id: userId });
  if (insertError) {
    console.error('[db.createConsulta] insert consulta failed', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      clientaId: consulta.clientaId,
    });
    throw insertError;
  }

  // Actualizar clienta: última visita, total de visitas, tipo de rizo principal.
  // Los errores del select/update aquí ANTES se tragaban — ahora se capturan
  // para superficiar 400s de Supabase (RLS, constraints, etc.).
  const { data: clientaRow, error: selectError } = await supabase
    .from('clientas')
    .select('total_visitas')
    .eq('id', consulta.clientaId)
    .maybeSingle();

  if (selectError) {
    console.error('[db.createConsulta] select clienta failed', {
      code: selectError.code,
      message: selectError.message,
      details: selectError.details,
      hint: selectError.hint,
      clientaId: consulta.clientaId,
    });
    throw selectError;
  }

  const nextTotal = (clientaRow?.total_visitas ?? 0) + 1;

  const { error: updateError } = await supabase
    .from('clientas')
    .update({
      ultima_visita: consulta.fecha,
      total_visitas: nextTotal,
      tipo_cabello_principal: consulta.tipoRizoPrincipal || null,
    })
    .eq('id', consulta.clientaId);

  if (updateError) {
    console.error('[db.createConsulta] update clienta failed', {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      clientaId: consulta.clientaId,
      payload: {
        ultima_visita: consulta.fecha,
        total_visitas: nextTotal,
        tipo_cabello_principal: consulta.tipoRizoPrincipal || null,
      },
    });
    throw updateError;
  }
}

export async function getStatsThisMonth(): Promise<number> {
  const supabase = createClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const { count, error } = await supabase
    .from('consultas')
    .select('*', { count: 'exact', head: true })
    .gte('fecha', startOfMonth);
  if (error) throw error;
  return count ?? 0;
}

export async function getMostFrequentTratamiento(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('necesidad_principal');
  if (error) throw error;
  if (!data || data.length === 0) return 'Sin datos';
  const counts: Record<string, number> = {};
  for (const row of data as { necesidad_principal: string | null }[]) {
    const t = row.necesidad_principal || 'Desconocido';
    counts[t] = (counts[t] || 0) + 1;
  }
  return (
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos'
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Agenda — próximas y pasadas
// ══════════════════════════════════════════════════════════════════════════

async function pairsWithClienta(
  consultas: Consulta[]
): Promise<Array<{ consulta: Consulta; clienta: Clienta }>> {
  if (consultas.length === 0) return [];
  const supabase = createClient();
  const ids = Array.from(new Set(consultas.map((c) => c.clientaId)));
  const { data, error } = await supabase
    .from('clientas')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  const clientasById = new Map<string, Clienta>();
  for (const r of data ?? []) clientasById.set(r.id, rowToClienta(r));
  return consultas
    .map((c) => {
      const cl = clientasById.get(c.clientaId);
      return cl ? { consulta: c, clienta: cl } : null;
    })
    .filter(
      (p): p is { consulta: Consulta; clienta: Clienta } => p !== null
    );
}

export async function getUpcomingCitas(): Promise<
  Array<{ consulta: Consulta; clienta: Clienta }>
> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('*')
    .gte('proxima_cita', today)
    .order('proxima_cita', { ascending: true });
  if (error) throw error;
  return pairsWithClienta((data ?? []).map(rowToConsulta));
}

export async function getPastCitas(
  limit = 20
): Promise<Array<{ consulta: Consulta; clienta: Clienta }>> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('*')
    .lt('proxima_cita', today)
    .not('proxima_cita', 'is', null)
    .order('proxima_cita', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return pairsWithClienta((data ?? []).map(rowToConsulta));
}

export async function getNextCita(): Promise<{ nombre: string; fecha: string } | null> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('proxima_cita, clienta_id')
    .gte('proxima_cita', today)
    .order('proxima_cita', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.proxima_cita) return null;

  const { data: cl } = await supabase
    .from('clientas')
    .select('nombre')
    .eq('id', data.clienta_id)
    .maybeSingle();

  return {
    nombre: cl?.nombre || 'Clienta',
    fecha: data.proxima_cita,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Reportes
// ══════════════════════════════════════════════════════════════════════════

export async function getConsultasByMonth(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('consultas').select('fecha');
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const month = (row.fecha as string).substring(0, 7);
    result[month] = (result[month] || 0) + 1;
  }
  return result;
}

export async function getRizoDistribution(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clientas')
    .select('tipo_cabello_principal');
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const t = row.tipo_cabello_principal as string | null;
    if (t) result[t] = (result[t] || 0) + 1;
  }
  return result;
}

export async function getTratamientosDistribution(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('necesidad_principal');
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const t = (row.necesidad_principal as string | null);
    if (t) result[t] = (result[t] || 0) + 1;
  }
  return result;
}

export async function getClientasInactivas(
  days = 45
): Promise<Array<Clienta & { diasInactiva: number }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clientas')
    .select('*')
    .not('ultima_visita', 'is', null)
    .lte('ultima_visita', cutoffStr);
  if (error) throw error;
  return (data ?? [])
    .map((r) => {
      const clienta = rowToClienta(r);
      const diff = Math.floor(
        (new Date(today).getTime() -
          new Date(clienta.ultimaVisita!).getTime()) /
          86400000
      );
      return { ...clienta, diasInactiva: diff };
    })
    .sort((a, b) => b.diasInactiva - a.diasInactiva);
}

export async function getConsultasBorrador(): Promise<
  Array<{ consulta: Consulta; clienta: Clienta }>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('*')
    .eq('es_borrador', true);
  if (error) throw error;
  return pairsWithClienta((data ?? []).map(rowToConsulta));
}

// Mapeo de satisfaccion_clienta (enum) → estrellas para promediar.
const SATISFACCION_SCORE: Record<NonNullable<Consulta['satisfaccion']>, number> = {
  muy_satisfecha: 5,
  satisfecha: 4,
  parcial: 3,
  necesita_ajustes: 2,
};

export async function getSatisfaccionPromedio(
  yearMonth?: string
): Promise<number | null> {
  const ym = yearMonth || new Date().toISOString().substring(0, 7);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('satisfaccion_clienta, fecha')
    .not('satisfaccion_clienta', 'is', null)
    .like('fecha', `${ym}%`);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const scores = (data as { satisfaccion_clienta: keyof typeof SATISFACCION_SCORE | null }[])
    .map((r) => (r.satisfaccion_clienta ? SATISFACCION_SCORE[r.satisfaccion_clienta] : 0))
    .filter((n) => n > 0);
  if (scores.length === 0) return null;
  const sum = scores.reduce((s, n) => s + n, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

export async function getLastTratamientosMap(
  clientaIds: string[]
): Promise<Record<string, string>> {
  if (!clientaIds.length) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('clienta_id, fecha, necesidad_principal')
    .in('clienta_id', clientaIds);
  if (error) throw error;
  const latest: Record<string, { fecha: string; tratamiento: string }> = {};
  for (const row of data ?? []) {
    const t = row.necesidad_principal as string | null;
    if (!t) continue;
    const cid = row.clienta_id as string;
    const f = row.fecha as string;
    if (!latest[cid] || f > latest[cid].fecha) {
      latest[cid] = { fecha: f, tratamiento: t };
    }
  }
  return Object.fromEntries(
    Object.entries(latest).map(([k, v]) => [k, v.tratamiento])
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Backup / borrado (usados por /configuracion)
// ══════════════════════════════════════════════════════════════════════════

export async function getAllConsultas(): Promise<Consulta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToConsulta);
}

export async function bulkUpsertClientas(clientas: Clienta[]): Promise<void> {
  if (!clientas.length) return;
  const supabase = createClient();
  const userId = await currentUserId();
  const rows = clientas.map((c) => ({ ...clientaToRow(c), user_id: userId }));
  const { error } = await supabase.from('clientas').upsert(rows);
  if (error) throw error;
}

export async function bulkUpsertConsultas(consultas: Consulta[]): Promise<void> {
  if (!consultas.length) return;
  const supabase = createClient();
  const userId = await currentUserId();
  const rows = consultas.map((c) => ({ ...consultaToRow(c), user_id: userId }));
  const { error } = await supabase.from('consultas').upsert(rows);
  if (error) throw error;
}

export async function clearAllData(): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  // consultas primero por si alguna RLS se evalúa en orden (clientas cascade también las borra).
  await supabase.from('consultas').delete().eq('user_id', userId);
  await supabase.from('clientas').delete().eq('user_id', userId);
}
