// ══════════════════════════════════════════════════════════════════════════
// Motor puro de Disponibilidad, Solapamiento en `America/Bogota` y Puente
// directo al Workspace Silla (`/`).
//
// Colombia mantiene UTC-05:00 fijo todo el año (sin horario de verano), lo que
// permite conversiones deterministas e independientes del huso del servidor.
// ══════════════════════════════════════════════════════════════════════════

import { enlaceWhatsApp } from '@/lib/whatsapp';

export const BOGOTA_TIMEZONE = 'America/Bogota';
export const BOGOTA_UTC_OFFSET = '-05:00';
export const DEFAULT_SLOT_STEP_MINUTES = 30;

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_chair'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type AppointmentSource = 'web_vitrina' | 'panel';

export interface SpecialistScheduleRule {
  id?: string;
  organizationId?: string;
  specialistId: string;
  /** 0 = domingo … 6 = sábado en `America/Bogota`. */
  dayOfWeek: number;
  /** Formato `HH:MM` (24h), ej. `'09:00'`. */
  startTime: string;
  /** Formato `HH:MM` (24h), ej. `'19:00'`. */
  endTime: string;
  active: boolean;
}

export interface BusyInterval {
  id?: string;
  specialistId: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status?: AppointmentStatus;
}

export interface AvailableSlot {
  /** Hora local en Bogotá (`HH:MM`). */
  label: string;
  /** Timestamp ISO con offset `-05:00` o UTC. */
  startsAt: string;
  endsAt: string;
}

export interface AppointmentRecord {
  id: string;
  organizationId: string;
  clientaId?: string | null;
  specialistId: string;
  specialistName?: string;
  serviceId?: string | null;
  serviceName?: string;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes?: string | null;
  createdAt: string;
}

const FECHA_YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA_HM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function esFechaYmdValida(fecha: unknown): fecha is string {
  if (typeof fecha !== 'string') return false;
  const m = FECHA_YMD_REGEX.exec(fecha.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

export function parsearMinutosHm(horaHm: string): number | null {
  const m = HORA_HM_REGEX.exec(horaHm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutosAHoraHm(totalMinutos: number): string {
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convierte una fecha `YYYY-MM-DD` y hora `HH:MM` de `America/Bogota` (-05:00)
 * a un `Date` exacto en UTC.
 */
export function bogotaLocalToUtcDate(fechaYmd: string, horaHm: string): Date {
  const hmLimpio = horaHm.trim().slice(0, 5);
  if (!esFechaYmdValida(fechaYmd) || parsearMinutosHm(hmLimpio) === null) {
    throw new Error(`Fecha u hora inválida para America/Bogota: ${fechaYmd} ${horaHm}`);
  }
  return new Date(`${fechaYmd.trim()}T${hmLimpio}:00${BOGOTA_UTC_OFFSET}`);
}

/** Devuelve `YYYY-MM-DD` en zona horaria `America/Bogota`. */
export function formatearFechaBogotaYmd(dateOrIso: Date | string): string {
  const dt = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  // UTC-5 fijo = restar 5 horas sobre UTC y leer componentes UTC
  const bogotaMs = dt.getTime() - 5 * 3_600_000;
  const b = new Date(bogotaMs);
  const y = b.getUTCFullYear();
  const m = String(b.getUTCMonth() + 1).padStart(2, '0');
  const d = String(b.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Devuelve `HH:MM` (24h) en zona horaria `America/Bogota`. */
export function formatearHoraBogotaHm(dateOrIso: Date | string): string {
  const dt = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  const bogotaMs = dt.getTime() - 5 * 3_600_000;
  const b = new Date(bogotaMs);
  const h = String(b.getUTCHours()).padStart(2, '0');
  const m = String(b.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Día de la semana `0` (domingo) a `6` (sábado) en `America/Bogota`. */
export function diaSemanaBogota(fechaYmd: string): number {
  const mediodiaBogota = bogotaLocalToUtcDate(fechaYmd, '12:00');
  const bogotaMs = mediodiaBogota.getTime() - 5 * 3_600_000;
  return new Date(bogotaMs).getUTCDay();
}

export function sumarDiasYmd(fechaYmd: string, dias: number): string {
  const base = bogotaLocalToUtcDate(fechaYmd, '12:00');
  const siguiente = new Date(base.getTime() + dias * 86_400_000);
  return formatearFechaBogotaYmd(siguiente);
}

/**
 * Horario laboral por defecto de un salón en Colombia cuando la especialista
 * aún no tiene filas personalizadas en `specialist_schedules`:
 * Lunes a sábado (1..6) de 09:00 a 19:00; domingo (0) cerrado.
 */
export function horarioPorDefectoEspecialista(
  specialistId: string,
  dayOfWeek: number
): SpecialistScheduleRule {
  if (dayOfWeek === 0) {
    return {
      specialistId,
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '17:00',
      active: false,
    };
  }
  return {
    specialistId,
    dayOfWeek,
    startTime: '09:00',
    endTime: '19:00',
    active: true,
  };
}

/**
 * Verifica si el rango `[nuevoInicio, nuevoFin)` se solapa con alguna cita
 * activa (`status` distinto de `'cancelled'` y `'no_show'`) del mismo
 * `specialistId`. Intervalos contiguos (`10:00` fin y `10:00` inicio) NO se solapan.
 */
export function haySolapamientoCitas(
  nuevoInicio: Date | string,
  nuevoFin: Date | string,
  existentes: readonly BusyInterval[],
  specialistId: string,
  excludeAppointmentId?: string
): boolean {
  const startMs =
    typeof nuevoInicio === 'string' ? new Date(nuevoInicio).getTime() : nuevoInicio.getTime();
  const endMs =
    typeof nuevoFin === 'string' ? new Date(nuevoFin).getTime() : nuevoFin.getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return true;
  }

  for (const cita of existentes) {
    if (cita.specialistId !== specialistId) continue;
    if (excludeAppointmentId && cita.id === excludeAppointmentId) continue;
    if (cita.status === 'cancelled' || cita.status === 'no_show') continue;

    const cStart =
      typeof cita.startsAt === 'string' ? new Date(cita.startsAt).getTime() : cita.startsAt.getTime();
    const cEnd =
      typeof cita.endsAt === 'string' ? new Date(cita.endsAt).getTime() : cita.endsAt.getTime();

    if (startMs < cEnd && cStart < endMs) {
      return true;
    }
  }
  return false;
}

export interface CalcularSlotsParams {
  fechaYmd: string;
  specialistId: string;
  durationMinutes: number;
  schedules?: readonly SpecialistScheduleRule[];
  busyIntervals?: readonly BusyInterval[];
  stepMinutes?: number;
  /** Referencia temporal para descartar horas ya pasadas del día actual. */
  now?: Date;
}

/**
 * Calcula los slots disponibles para una especialista en `America/Bogota`
 * respetando horarios laborales, duración del servicio, citas ocupadas y hora actual.
 */
export function calcularSlotsDisponiblesBogota(params: CalcularSlotsParams): AvailableSlot[] {
  if (!esFechaYmdValida(params.fechaYmd)) return [];

  const duracion = Math.max(15, Math.min(720, Math.round(params.durationMinutes || 60)));
  const paso = Math.max(15, Math.round(params.stepMinutes ?? DEFAULT_SLOT_STEP_MINUTES));
  const dow = diaSemanaBogota(params.fechaYmd);

  const reglasEspecialista = (params.schedules ?? []).filter(
    (s) => s.specialistId === params.specialistId
  );

  // Si la especialista tiene reglas configuradas, busca la de ese día; si no, usa el defecto.
  const reglaDia =
    reglasEspecialista.length > 0
      ? reglasEspecialista.find((s) => s.dayOfWeek === dow)
      : horarioPorDefectoEspecialista(params.specialistId, dow);

  if (!reglaDia || !reglaDia.active) return [];

  const minInicio = parsearMinutosHm(reglaDia.startTime);
  const minFin = parsearMinutosHm(reglaDia.endTime);
  if (minInicio === null || minFin === null || minFin - minInicio < duracion) {
    return [];
  }

  const nowMs = params.now ? params.now.getTime() : null;
  const ocupados = params.busyIntervals ?? [];
  const slots: AvailableSlot[] = [];

  for (let m = minInicio; m + duracion <= minFin; m += paso) {
    const labelInicio = minutosAHoraHm(m);
    const startUtc = bogotaLocalToUtcDate(params.fechaYmd, labelInicio);
    const endUtc = new Date(startUtc.getTime() + duracion * 60_000);

    if (nowMs !== null && startUtc.getTime() <= nowMs) {
      continue;
    }

    if (haySolapamientoCitas(startUtc, endUtc, ocupados, params.specialistId)) {
      continue;
    }

    slots.push({
      label: labelInicio,
      startsAt: startUtc.toISOString(),
      endsAt: endUtc.toISOString(),
    });
  }

  return slots;
}

/**
 * Construye la URL de puente directo hacia el Workspace Maestro (`/`)
 * precargando clienta, especialista, servicio y referencia de la cita.
 */
export function construirUrlAbrirEnSilla(cita: {
  id: string;
  clientaId?: string | null;
  specialistId: string;
  serviceId?: string | null;
  customerName: string;
  customerPhone: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('appointmentId', cita.id);
  if (cita.clientaId) {
    qs.set('clientaId', cita.clientaId);
  }
  qs.set('estilistaId', cita.specialistId);
  if (cita.serviceId) {
    qs.set('servicioId', cita.serviceId);
  }
  qs.set('customerName', cita.customerName.trim());
  qs.set('customerPhone', cita.customerPhone.trim());
  return `/?${qs.toString()}`;
}

export function armarMensajeWhatsAppCita(datos: {
  salonName: string;
  salonWhatsapp?: string | null;
  serviceName: string;
  specialistName: string;
  startsAtIso: string;
  customerName: string;
  customerPhone: string;
  notes?: string | null;
}): { mensaje: string; whatsappUrl: string } {
  const fechaYmd = formatearFechaBogotaYmd(datos.startsAtIso);
  const [yyyy, mm, dd] = fechaYmd.split('-');
  const fechaLegible = `${dd}/${mm}/${yyyy}`;
  const horaLegible = formatearHoraBogotaHm(datos.startsAtIso);

  const lineas = [
    `Hola *${datos.salonName.trim()}*, acabo de solicitar mi cita desde la vitrina:`,
    ``,
    `• *Servicio:* ${datos.serviceName}`,
    `• *Especialista:* ${datos.specialistName}`,
    `• *Fecha y hora:* ${fechaLegible} a las ${horaLegible}`,
    `• *Cliente:* ${datos.customerName} (${datos.customerPhone})`,
  ];

  if (datos.notes?.trim()) {
    lineas.push(`• *Nota:* ${datos.notes.trim()}`);
  }

  lineas.push(``, `¿Me confirman disponibilidad por favor?`);

  const mensaje = lineas.join('\n');
  const whatsappUrl = enlaceWhatsApp(datos.salonWhatsapp, mensaje);
  return { mensaje, whatsappUrl };
}
