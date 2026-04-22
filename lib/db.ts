import { createClient } from '@/lib/supabase/client';
import type {
  Clienta,
  Consulta,
  CaptureMetadata,
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
  fecha_registro: string;
  nivel_estres: 'bajo' | 'medio' | 'alto' | null;
  embarazo: boolean | null;
  alergias: string | null;
  condiciones_medicas: string | null;
  medicamentos: string | null;
  tipo_rizo_principal: string | null;
  ultima_visita: string | null;
  total_visitas: number;
};

type ConsultaRow = {
  id: string;
  user_id: string;
  clienta_id: string;
  fecha: string;
  numero_consulta: number;
  quimicos: string[];
  ultimo_quimico: string | null;
  uso_calor: string[];
  frecuencia_calor: string | null;
  usa_protector_termico: boolean;
  frecuencia_lavado: string | null;
  metodo_lavado: string | null;
  productos_actuales: ProductosActuales;
  problemas: string[];
  otro_problema: string | null;
  tipo_rizo_principal: string | null;
  tipos_secundarios: string[] | null;
  zonas_cambio: string | null;
  porosidad: 'baja' | 'media' | 'alta' | null;
  porosidad_obs: string | null;
  densidad: 'baja' | 'media' | 'alta' | null;
  grosor: 'fino' | 'medio' | 'grueso' | null;
  elasticidad: 'baja' | 'media' | 'alta' | null;
  balance_hp: 'hidratacion' | 'nutricion' | 'proteina' | 'equilibrado' | null;
  estado_cuero_cabelludo: string[];
  obs_cuero_cabelludo: string | null;
  estado_puntas: string | null;
  tipo_dano: string[];
  linea_demarcacion: string | null;
  alergias: string | null;
  condiciones_medicas: string | null;
  medicamentos: string | null;
  embarazo: boolean;
  nivel_estres: string;
  resultado: ResultadoConsulta;
  satisfaccion: Consulta['satisfaccion'] | null;
  satisfaccion_estrellas: number | null;
  notas_estilista: string | null;
  proxima_cita: string | null;
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
    fechaRegistro: r.fecha_registro,
    nivelEstres: r.nivel_estres ?? undefined,
    embarazo: r.embarazo ?? undefined,
    alergias: r.alergias ?? undefined,
    condicionesMedicas: r.condiciones_medicas ?? undefined,
    medicamentos: r.medicamentos ?? undefined,
    tipoRizoPrincipal: r.tipo_rizo_principal ?? undefined,
    ultimaVisita: r.ultima_visita ?? undefined,
    totalVisitas: r.total_visitas,
  };
}

function clientaToRow(c: Clienta): Omit<ClientaRow, 'user_id'> {
  return {
    id: c.id,
    nombre: c.nombre,
    edad: c.edad ?? 0,
    telefono: c.telefono ?? null,
    email: c.email ?? null,
    fecha_registro: c.fechaRegistro,
    nivel_estres: c.nivelEstres ?? null,
    embarazo: c.embarazo ?? null,
    alergias: c.alergias ?? null,
    condiciones_medicas: c.condicionesMedicas ?? null,
    medicamentos: c.medicamentos ?? null,
    tipo_rizo_principal: c.tipoRizoPrincipal ?? null,
    ultima_visita: c.ultimaVisita ?? null,
    total_visitas: c.totalVisitas,
  };
}

function rowToConsulta(r: ConsultaRow): Consulta {
  return {
    id: r.id,
    clientaId: r.clienta_id,
    fecha: r.fecha,
    numeroConsulta: r.numero_consulta,
    quimicos: r.quimicos,
    ultimoQuimico: r.ultimo_quimico ?? undefined,
    usoCalor: r.uso_calor,
    frecuenciaCalor: r.frecuencia_calor ?? '',
    usaProtectorTermico: r.usa_protector_termico,
    frecuenciaLavado: r.frecuencia_lavado ?? '',
    metodoLavado: r.metodo_lavado ?? '',
    productosActuales: r.productos_actuales ?? {},
    problemas: r.problemas,
    otroProblema: r.otro_problema ?? undefined,
    tipoRizoPrincipal: r.tipo_rizo_principal ?? '',
    tiposSecundarios: r.tipos_secundarios ?? undefined,
    zonasCambio: r.zonas_cambio ?? undefined,
    porosidad: r.porosidad ?? undefined,
    porosidadObs: r.porosidad_obs ?? undefined,
    densidad: r.densidad ?? undefined,
    grosor: r.grosor ?? undefined,
    elasticidad: r.elasticidad ?? undefined,
    balanceHP: r.balance_hp ?? undefined,
    estadoCueroCabelludo: r.estado_cuero_cabelludo,
    obsCueroCabelludo: r.obs_cuero_cabelludo ?? undefined,
    estadoPuntas: r.estado_puntas ?? undefined,
    tipoDano: r.tipo_dano,
    lineaDemarcacion: r.linea_demarcacion ?? undefined,
    alergias: r.alergias ?? undefined,
    condicionesMedicas: r.condiciones_medicas ?? undefined,
    medicamentos: r.medicamentos ?? undefined,
    embarazo: r.embarazo,
    nivelEstres: r.nivel_estres,
    resultado: r.resultado,
    satisfaccion: r.satisfaccion ?? undefined,
    satisfaccionEstrellas:
      r.satisfaccion_estrellas != null
        ? (r.satisfaccion_estrellas as 1 | 2 | 3 | 4 | 5)
        : undefined,
    notasEstilista: r.notas_estilista ?? undefined,
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
    numero_consulta: c.numeroConsulta,
    quimicos: c.quimicos,
    ultimo_quimico: c.ultimoQuimico ?? null,
    uso_calor: c.usoCalor,
    frecuencia_calor: c.frecuenciaCalor || null,
    usa_protector_termico: c.usaProtectorTermico,
    frecuencia_lavado: c.frecuenciaLavado || null,
    metodo_lavado: c.metodoLavado || null,
    productos_actuales: c.productosActuales,
    problemas: c.problemas,
    otro_problema: c.otroProblema ?? null,
    tipo_rizo_principal: c.tipoRizoPrincipal || null,
    tipos_secundarios: c.tiposSecundarios ?? null,
    zonas_cambio: c.zonasCambio ?? null,
    porosidad: c.porosidad ?? null,
    porosidad_obs: c.porosidadObs ?? null,
    densidad: c.densidad ?? null,
    grosor: c.grosor ?? null,
    elasticidad: c.elasticidad ?? null,
    balance_hp: c.balanceHP ?? null,
    estado_cuero_cabelludo: c.estadoCueroCabelludo,
    obs_cuero_cabelludo: c.obsCueroCabelludo ?? null,
    estado_puntas: c.estadoPuntas ?? null,
    tipo_dano: c.tipoDano,
    linea_demarcacion: c.lineaDemarcacion ?? null,
    alergias: c.alergias ?? null,
    condiciones_medicas: c.condicionesMedicas ?? null,
    medicamentos: c.medicamentos ?? null,
    embarazo: c.embarazo,
    nivel_estres: c.nivelEstres,
    resultado: c.resultado,
    satisfaccion: c.satisfaccion ?? null,
    satisfaccion_estrellas: c.satisfaccionEstrellas ?? null,
    notas_estilista: c.notasEstilista ?? null,
    proxima_cita: c.proximaCita ?? null,
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

  const { error } = await supabase
    .from('consultas')
    .insert({ ...consultaToRow(consulta), user_id: userId });
  if (error) throw error;

  // Actualizar clienta: última visita, total de visitas, tipo de rizo principal
  const { data: clientaRow } = await supabase
    .from('clientas')
    .select('total_visitas')
    .eq('id', consulta.clientaId)
    .maybeSingle();

  const nextTotal = (clientaRow?.total_visitas ?? 0) + 1;

  await supabase
    .from('clientas')
    .update({
      ultima_visita: consulta.fecha,
      total_visitas: nextTotal,
      tipo_rizo_principal: consulta.tipoRizoPrincipal || null,
    })
    .eq('id', consulta.clientaId);
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
  const { data, error } = await supabase.from('consultas').select('resultado');
  if (error) throw error;
  if (!data || data.length === 0) return 'Sin datos';
  const counts: Record<string, number> = {};
  for (const row of data as { resultado: ResultadoConsulta }[]) {
    const t = row.resultado?.tratamientoPrincipal || 'Desconocido';
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
    .select('tipo_rizo_principal');
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const t = row.tipo_rizo_principal as string | null;
    if (t) result[t] = (result[t] || 0) + 1;
  }
  return result;
}

export async function getTratamientosDistribution(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('consultas').select('resultado');
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const t = (row.resultado as ResultadoConsulta | null)?.tratamientoPrincipal;
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

export async function getSatisfaccionPromedio(
  yearMonth?: string
): Promise<number | null> {
  const ym = yearMonth || new Date().toISOString().substring(0, 7);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('satisfaccion_estrellas, fecha')
    .not('satisfaccion_estrellas', 'is', null)
    .like('fecha', `${ym}%`);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const sum = data.reduce(
    (s, c) => s + ((c.satisfaccion_estrellas as number | null) ?? 0),
    0
  );
  return Math.round((sum / data.length) * 10) / 10;
}

export async function getLastTratamientosMap(
  clientaIds: string[]
): Promise<Record<string, string>> {
  if (!clientaIds.length) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from('consultas')
    .select('clienta_id, fecha, resultado')
    .in('clienta_id', clientaIds);
  if (error) throw error;
  const latest: Record<string, { fecha: string; tratamiento: string }> = {};
  for (const row of data ?? []) {
    const t = (row.resultado as ResultadoConsulta | null)?.tratamientoPrincipal;
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
