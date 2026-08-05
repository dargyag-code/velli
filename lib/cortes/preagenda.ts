// ══════════════════════════════════════════════════════════════════════════
// PR-06 · Recurrencia comercial: al confirmar la ejecución de un corte, se
// abre la ventana de pre-agendamiento de la cita de mantenimiento según el
// ciclo de vida de esa ficha.
//
// CONSUME lib/agenda/, no reimplementa: la cita se crea con
// crearCitaServicio(), así que pasa por el trigger citas_guard_legal y hereda
// el bloque extendido de los servicios tipo 4 y el rechazo de solapes.
// ══════════════════════════════════════════════════════════════════════════

import { crearCitaServicio, listarCitasServicio } from '@/lib/agenda/citas';
import {
  clasificarServicio, duracionBloqueoTipo4, solapaConBloqueoTipo4,
} from '@/lib/agenda/reglas';
import type { FichaCorte } from './tipos';

/** Nombre del servicio de mantenimiento para una ficha. */
export function servicioMantenimiento(ficha: FichaCorte): string {
  return `Mantenimiento de corte · ${ficha.nombre}`;
}

/**
 * Fecha sugerida del retoque: el punto medio del ciclo de vida, que es el
 * compromiso honesto entre "todavía se ve bien" y "ya perdió la forma".
 */
export function fechaSugeridaRetoque(ficha: FichaCorte, desde = new Date()): Date {
  const [min, max] = ficha.cicloSemanas;
  const semanas = Math.round((min + max) / 2);
  const f = new Date(desde);
  f.setDate(f.getDate() + semanas * 7);
  return f;
}

export interface PropuestaRetoque {
  ficha: FichaCorte;
  fecha: Date;
  duracionMinutos: number;
  servicio: string;
  /** true → el servicio reserva el bloque extendido de 2–4 h. */
  esBloqueExtendido: boolean;
  /** Texto para la clienta, con el ciclo real de la ficha. */
  mensaje: string;
}

/**
 * Arma la propuesta de retoque. La duración respeta el bloque extendido
 * cuando el corte es de los que lo exigen (día de lavado tipo 4 /
 * instalación protectora) — la clasificación la resuelve
 * clasificarServicio(), la misma que usa el trigger en la DB.
 */
export function proponerRetoque(params: {
  ficha: FichaCorte;
  /** Bloque configurado por el salón, en minutos. */
  bloqueoTipo4Minutos?: number;
  /** Duración normal de un corte, si el salón no la personaliza. */
  duracionCorteMinutos?: number;
  desde?: Date;
}): PropuestaRetoque {
  const servicio = servicioMantenimiento(params.ficha);
  const clase = clasificarServicio(servicio);
  const esBloqueExtendido = clase === 'bloqueo_tipo4';

  const duracionMinutos = esBloqueExtendido
    ? duracionBloqueoTipo4(params.bloqueoTipo4Minutos)
    : params.duracionCorteMinutos ?? 60;

  const [min, max] = params.ficha.cicloSemanas;

  return {
    ficha: params.ficha,
    fecha: fechaSugeridaRetoque(params.ficha, params.desde),
    duracionMinutos,
    servicio,
    esBloqueExtendido,
    mensaje: `${params.ficha.nombre} conserva su forma entre ${min} y ${max} semanas. Dejar agendado el retoque ahora mantiene el diseño en su mejor momento.`,
  };
}

/**
 * Verifica que el horario propuesto no pise un bloque extendido antes de
 * intentar crear la cita — el trigger lo rechazaría igual, pero así la
 * estilista ve el conflicto y puede mover la hora sin un error de por medio.
 */
export async function horarioDisponible(propuesta: PropuestaRetoque): Promise<boolean> {
  const existentes = await listarCitasServicio().catch(() => []);
  return !solapaConBloqueoTipo4(
    {
      fecha: propuesta.fecha.toISOString(),
      duracionMinutos: propuesta.duracionMinutos,
      servicio: propuesta.servicio,
      estado: 'pendiente',
    },
    existentes.map((c) => ({
      fecha: c.fecha,
      duracionMinutos: c.duracionMinutos,
      servicio: c.servicio,
      estado: c.estado,
    }))
  );
}

/** Crea la cita de mantenimiento usando la agenda existente. */
export async function preAgendarRetoque(params: {
  clientaId: string;
  propuesta: PropuestaRetoque;
  notas?: string;
}): Promise<void> {
  await crearCitaServicio({
    clientaId: params.clientaId,
    fecha: params.propuesta.fecha,
    duracionMinutos: params.propuesta.duracionMinutos,
    servicio: params.propuesta.servicio,
    notas: params.notas ?? params.propuesta.mensaje,
  });
}
