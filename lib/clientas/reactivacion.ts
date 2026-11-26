// ══════════════════════════════════════════════════════════════════════════
// Motor de Reactivación de Clientas (CRM · WhatsApp asistido en 1 clic)
//
// Segmenta clientas cuya última visita completada supera 30, 45 o 60 días y
// aplica una ventana de enfriamiento de 7 días (`lastReactivationContactAt`)
// para no repetir mensajes a la misma clienta dentro de la misma semana.
// ══════════════════════════════════════════════════════════════════════════

import { APP_URL } from '@/lib/sitio';
import type { Clienta } from '@/lib/types';
import { enlaceWhatsApp, numeroWhatsApp } from '@/lib/whatsapp';
import { bogotaLocalToUtcDate, esFechaYmdValida } from '@/lib/agenda/disponibilidad';

export type TramoInactividadDias = 30 | 45 | 60;

export const TRAMOS_REACTIVACION: readonly TramoInactividadDias[] = [30, 45, 60] as const;

export const VENTANA_ENFRIAMIENTO_DIAS = 7;

export interface ClientaPorReactivar {
  clienta: Clienta;
  diasInactiva: number;
  tramo: TramoInactividadDias;
  contactadaEstaSemana: boolean;
  tieneTelefonoValido: boolean;
}

function parsearFechaVisitaMs(fecha?: string | null): number | null {
  if (!fecha) return null;
  const limpio = fecha.trim();
  if (!limpio) return null;
  if (esFechaYmdValida(limpio)) {
    return bogotaLocalToUtcDate(limpio, '12:00').getTime();
  }
  const parsed = new Date(limpio).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function calcularDiasDesdeUltimaVisita(
  ultimaVisita?: string | null,
  ahora: Date = new Date()
): number | null {
  const visitaMs = parsearFechaVisitaMs(ultimaVisita);
  if (visitaMs === null) return null;
  const diffMs = ahora.getTime() - visitaMs;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / 86_400_000);
}

export function clasificarTramoInactividad(
  diasInactiva: number | null
): TramoInactividadDias | null {
  if (diasInactiva === null || diasInactiva < 30) return null;
  if (diasInactiva >= 60) return 60;
  if (diasInactiva >= 45) return 45;
  return 30;
}

export function fueContactadaEstaSemana(
  lastReactivationContactAt?: string | null,
  ahora: Date = new Date(),
  ventanaDias: number = VENTANA_ENFRIAMIENTO_DIAS
): boolean {
  if (!lastReactivationContactAt) return false;
  const contactoMs = new Date(lastReactivationContactAt).getTime();
  if (!Number.isFinite(contactoMs)) return false;
  const diffMs = ahora.getTime() - contactoMs;
  return diffMs >= 0 && diffMs < ventanaDias * 86_400_000;
}

export function segmentarClientasPorReactivar(
  clientas: readonly Clienta[],
  opciones?: {
    umbralMinimoDias?: TramoInactividadDias;
    incluirContactadasEstaSemana?: boolean;
    ahora?: Date;
  }
): ClientaPorReactivar[] {
  const umbral = opciones?.umbralMinimoDias ?? 30;
  const incluirContactadas = opciones?.incluirContactadasEstaSemana ?? true;
  const ahora = opciones?.ahora ?? new Date();

  const resultado: ClientaPorReactivar[] = [];

  for (const clienta of clientas) {
    const dias = calcularDiasDesdeUltimaVisita(clienta.ultimaVisita, ahora);
    const tramo = clasificarTramoInactividad(dias);
    if (dias === null || tramo === null || dias < umbral) continue;

    const contactada = fueContactadaEstaSemana(clienta.lastReactivationContactAt, ahora);
    if (!incluirContactadas && contactada) continue;

    resultado.push({
      clienta,
      diasInactiva: dias,
      tramo,
      contactadaEstaSemana: contactada,
      tieneTelefonoValido: Boolean(numeroWhatsApp(clienta.telefono)),
    });
  }

  return resultado.sort((a, b) => {
    if (a.contactadaEstaSemana !== b.contactadaEstaSemana) {
      return a.contactadaEstaSemana ? 1 : -1;
    }
    return b.diasInactiva - a.diasInactiva;
  });
}

export function armarEnlaceReactivacionWhatsApp(params: {
  clienta: Pick<Clienta, 'nombre' | 'telefono'>;
  salonNombre?: string | null;
  diasInactiva: number;
  vitrinaSlug?: string | null;
  appUrl?: string;
}): { mensaje: string; whatsappUrl: string | null } {
  const primerNombre = params.clienta.nombre.trim().split(/\s+/)[0] || 'Hola';
  const salon = params.salonNombre?.trim() || 'tu salón';
  const base = (params.appUrl || APP_URL).replace(/\/+$/, '');
  const linkVitrina = params.vitrinaSlug?.trim()
    ? ` Puedes ver nuestros servicios y elegir tu horario aquí: ${base}/s/${encodeURIComponent(params.vitrinaSlug.trim())}`
    : '';

  const mensaje =
    params.diasInactiva >= 60
      ? `Hola ${primerNombre}, te saludamos de *${salon}*. Ya pasaron más de ${params.diasInactiva} días desde tu última visita y nos encantaría consentir tu cabello para mantener su brillo y salud.${linkVitrina} ¿Te gustaría que agendemos espacio esta semana?`
      : `Hola ${primerNombre}, te escribimos de *${salon}*. Han pasado ${params.diasInactiva} días desde tu última sesión y es el momento ideal para tu mantenimiento capilar.${linkVitrina} ¿Qué día te queda cómodo visitarnos?`;

  const numeroValido = numeroWhatsApp(params.clienta.telefono);
  const whatsappUrl = numeroValido ? enlaceWhatsApp(params.clienta.telefono, mensaje) : null;

  return { mensaje, whatsappUrl };
}
