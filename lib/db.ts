import Dexie, { Table } from 'dexie';
import { Clienta, Consulta } from './types';

class VelliDatabase extends Dexie {
  clientas!: Table<Clienta>;
  consultas!: Table<Consulta>;

  constructor() {
    super('VelliDB');
    this.version(1).stores({
      clientas: 'id, nombre, fechaRegistro, ultimaVisita, tipoRizoPrincipal',
      consultas: 'id, clientaId, fecha, numeroConsulta',
    });
  }
}

export const db = new VelliDatabase();

// ── Clientas ──
export async function getAllClientas(): Promise<Clienta[]> {
  return db.clientas.orderBy('nombre').toArray();
}

export async function getClientaById(id: string): Promise<Clienta | undefined> {
  return db.clientas.get(id);
}

export async function createClienta(clienta: Clienta): Promise<void> {
  await db.clientas.add(clienta);
}

export async function updateClienta(clienta: Clienta): Promise<void> {
  await db.clientas.put(clienta);
}

export async function deleteClienta(id: string): Promise<void> {
  await db.transaction('rw', db.clientas, db.consultas, async () => {
    await db.clientas.delete(id);
    await db.consultas.where('clientaId').equals(id).delete();
  });
}

export async function searchClientas(query: string): Promise<Clienta[]> {
  if (!query) return getAllClientas();
  const lower = query.toLowerCase();
  return db.clientas
    .filter((c) => c.nombre.toLowerCase().includes(lower))
    .toArray();
}

// ── Consultas ──
export async function getConsultasByClienta(clientaId: string): Promise<Consulta[]> {
  return db.consultas
    .where('clientaId')
    .equals(clientaId)
    .reverse()
    .sortBy('fecha');
}

export async function getConsultaById(id: string): Promise<Consulta | undefined> {
  return db.consultas.get(id);
}

export async function createConsulta(consulta: Consulta): Promise<void> {
  await db.consultas.add(consulta);
  // Update clienta's last visit and total visits
  const clienta = await db.clientas.get(consulta.clientaId);
  if (clienta) {
    clienta.ultimaVisita = consulta.fecha;
    clienta.totalVisitas = (clienta.totalVisitas || 0) + 1;
    clienta.tipoRizoPrincipal = consulta.tipoRizoPrincipal;
    await db.clientas.put(clienta);
  }
}

export async function getRecentClientas(limit = 8): Promise<Clienta[]> {
  const all = await db.clientas.toArray();
  return all
    .filter((c) => c.ultimaVisita)
    .sort((a, b) => (b.ultimaVisita || '') > (a.ultimaVisita || '') ? 1 : -1)
    .slice(0, limit);
}

export async function getStatsThisMonth(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return db.consultas.where('fecha').aboveOrEqual(startOfMonth).count();
}

export async function getMostFrequentTratamiento(): Promise<string> {
  const consultas = await db.consultas.toArray();
  if (!consultas.length) return 'Sin datos';
  const counts: Record<string, number> = {};
  for (const c of consultas) {
    const t = c.resultado?.tratamientoPrincipal || 'Desconocido';
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos';
}

// ── Agenda ────────────────────────────────────────────────────────────────

export async function getUpcomingCitas(): Promise<
  Array<{ consulta: Consulta; clienta: Clienta }>
> {
  const today = new Date().toISOString().split('T')[0];
  const consultas = await db.consultas
    .filter((c) => !!c.proximaCita && c.proximaCita >= today)
    .toArray();
  consultas.sort((a, b) => (a.proximaCita! < b.proximaCita! ? -1 : 1));

  const pairs = await Promise.all(
    consultas.map(async (c) => {
      const clienta = await db.clientas.get(c.clientaId);
      return clienta ? { consulta: c, clienta } : null;
    })
  );
  return pairs.filter((p): p is { consulta: Consulta; clienta: Clienta } => p !== null);
}

export async function getPastCitas(limit = 20): Promise<
  Array<{ consulta: Consulta; clienta: Clienta }>
> {
  const today = new Date().toISOString().split('T')[0];
  const consultas = await db.consultas
    .filter((c) => !!c.proximaCita && c.proximaCita < today)
    .toArray();
  consultas.sort((a, b) => (a.proximaCita! > b.proximaCita! ? -1 : 1));
  const slice = consultas.slice(0, limit);

  const pairs = await Promise.all(
    slice.map(async (c) => {
      const clienta = await db.clientas.get(c.clientaId);
      return clienta ? { consulta: c, clienta } : null;
    })
  );
  return pairs.filter((p): p is { consulta: Consulta; clienta: Clienta } => p !== null);
}

// ── Reportes ───────────────────────────────────────────────────────────────

export async function getConsultasByMonth(): Promise<Record<string, number>> {
  const consultas = await db.consultas.toArray();
  const result: Record<string, number> = {};
  for (const c of consultas) {
    const month = c.fecha.substring(0, 7); // YYYY-MM
    result[month] = (result[month] || 0) + 1;
  }
  return result;
}

export async function getRizoDistribution(): Promise<Record<string, number>> {
  const clientas = await db.clientas.toArray();
  const result: Record<string, number> = {};
  for (const c of clientas) {
    if (c.tipoRizoPrincipal) {
      result[c.tipoRizoPrincipal] = (result[c.tipoRizoPrincipal] || 0) + 1;
    }
  }
  return result;
}

export async function getTratamientosDistribution(): Promise<Record<string, number>> {
  const consultas = await db.consultas.toArray();
  const result: Record<string, number> = {};
  for (const c of consultas) {
    const t = c.resultado?.tratamientoPrincipal;
    if (t) result[t] = (result[t] || 0) + 1;
  }
  return result;
}

export async function getClientasInactivas(days = 45): Promise<Array<Clienta & { diasInactiva: number }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const all = await db.clientas
    .filter((c) => !!c.ultimaVisita && c.ultimaVisita <= cutoffStr)
    .toArray();
  return all.map((c) => {
    const diff = Math.floor((new Date(today).getTime() - new Date(c.ultimaVisita!).getTime()) / 86400000);
    return { ...c, diasInactiva: diff };
  }).sort((a, b) => b.diasInactiva - a.diasInactiva);
}

export async function getConsultasBorrador(): Promise<Array<{ consulta: Consulta; clienta: Clienta }>> {
  const borradores = await db.consultas.filter((c) => !!c.esBorrador).toArray();
  const pairs = await Promise.all(
    borradores.map(async (c) => {
      const clienta = await db.clientas.get(c.clientaId);
      return clienta ? { consulta: c, clienta } : null;
    })
  );
  return pairs.filter((p): p is { consulta: Consulta; clienta: Clienta } => p !== null);
}

export async function getSatisfaccionPromedio(yearMonth?: string): Promise<number | null> {
  const ym = yearMonth || new Date().toISOString().substring(0, 7);
  const consultas = await db.consultas
    .filter((c) => c.fecha.startsWith(ym) && !!c.satisfaccionEstrellas)
    .toArray();
  if (!consultas.length) return null;
  const sum = consultas.reduce((s, c) => s + (c.satisfaccionEstrellas ?? 0), 0);
  return Math.round((sum / consultas.length) * 10) / 10;
}

export async function getNextCita(): Promise<{ nombre: string; fecha: string } | null> {
  const today = new Date().toISOString().split('T')[0];
  const consultas = await db.consultas
    .filter((c) => !!c.proximaCita && c.proximaCita >= today)
    .toArray();

  if (!consultas.length) return null;
  consultas.sort((a, b) => (a.proximaCita! < b.proximaCita! ? -1 : 1));

  const next = consultas[0];
  const clienta = await db.clientas.get(next.clientaId);
  return {
    nombre: clienta?.nombre || 'Clienta',
    fecha: next.proximaCita!,
  };
}
