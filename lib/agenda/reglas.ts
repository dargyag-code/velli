// ══════════════════════════════════════════════════════════════════════════
// Reglas puras de la agenda (validación técnica, sección 6.P7). Sin I/O: se
// testean en tests/gobernanza.legal.test.ts. El refuerzo REAL vive en la DB
// (trigger citas_guard_legal, supabase/migration-legal-gobernanza.sql) —
// estas funciones dan la misma respuesta en el cliente para bloquear la UI
// antes de llegar al error SQL y para explicar el motivo a la estilista.
//
// IMPORTANTE: clasificarServicio() es espejo de public.clasificar_servicio()
// en la migración. Si cambias los patrones aquí, cámbialos allá.
// ══════════════════════════════════════════════════════════════════════════

import type { TipoConsentimiento } from '@/lib/legal';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';
import { tieneConsentimientoVigente } from '@/lib/consentimientos';

export type ClaseServicio = 'bloqueo_tipo4' | 'decoloracion' | 'color' | 'otro';

// Catálogo sugerido en el modal de nueva cita. El campo servicio sigue
// siendo texto libre — la clasificación es por patrones, no por catálogo.
export const SERVICIOS_AGENDA = [
  'Diagnóstico capilar',
  'Corte',
  'Tratamiento en cabina',
  'Peinado / definición',
  'Color / tinte',
  'Decoloración / mechas',
  'Día de lavado tipo 4',
  'Instalación de peinado protector',
] as const;

// Ventana de la prueba de sensibilidad cutánea (fabricantes): el parche se
// aplica al menos 48 h antes del servicio; una prueba negativa vale por un
// máximo de 14 días (la prueba es por aplicación, no de por vida).
export const PARCHE_MIN_HORAS = 48;
export const PARCHE_VALIDEZ_DIAS = 14;

// Bloque extendido para servicios tipo 4: 2–4 h, configurable por salón.
export const BLOQUEO_TIPO4_MIN_MINUTOS = 120;
export const BLOQUEO_TIPO4_MAX_MINUTOS = 240;
export const BLOQUEO_TIPO4_DEFAULT_MINUTOS = 180;

// Espejo TS de public.clasificar_servicio(text).
export function clasificarServicio(servicio: string | null | undefined): ClaseServicio {
  if (!servicio) return 'otro';
  const s = servicio.toLowerCase();
  if (
    s.includes('lavado tipo 4') ||
    s.includes('dia de lavado') ||
    s.includes('día de lavado') ||
    (s.includes('instalaci') && s.includes('protector')) ||
    s.includes('peinado protector')
  ) {
    return 'bloqueo_tipo4';
  }
  if (
    s.includes('decolor') ||
    s.includes('mecha') ||
    s.includes('balayage') ||
    s.includes('babylight') ||
    s.includes('highlight') ||
    s.includes('platino')
  ) {
    return 'decoloracion';
  }
  if (
    s.includes('tinte') ||
    s.includes('tintur') ||
    s.includes('color') ||
    s.includes('matiz')
  ) {
    return 'color';
  }
  return 'otro';
}

// Duración efectiva del bloque tipo 4 según config del salón (clamp 2–4 h).
export function duracionBloqueoTipo4(minutosConfigurados?: number | null): number {
  const m = minutosConfigurados ?? BLOQUEO_TIPO4_DEFAULT_MINUTOS;
  return Math.min(
    BLOQUEO_TIPO4_MAX_MINUTOS,
    Math.max(BLOQUEO_TIPO4_MIN_MINUTOS, m)
  );
}

// ── Prueba de sensibilidad ─────────────────────────────────────────────────

export interface PruebaSensibilidad {
  id: string;
  clientaId: string;
  aplicadoAt: string;   // ISO
  resultado: 'negativo' | 'positivo';
  notas?: string;
}

// ¿Hay un parche negativo válido para un servicio en fechaServicio?
// Válido = aplicado al menos PARCHE_MIN_HORAS antes y no más viejo que
// PARCHE_VALIDEZ_DIAS respecto de la fecha del servicio.
export function parcheValidoPara(
  pruebas: Pick<PruebaSensibilidad, 'aplicadoAt' | 'resultado'>[],
  fechaServicio: Date
): boolean {
  const limiteSuperior = fechaServicio.getTime() - PARCHE_MIN_HORAS * 3600_000;
  const limiteInferior = fechaServicio.getTime() - PARCHE_VALIDEZ_DIAS * 86400_000;
  return pruebas.some((p) => {
    if (p.resultado !== 'negativo') return false;
    const t = new Date(p.aplicadoAt).getTime();
    return t <= limiteSuperior && t >= limiteInferior;
  });
}

// ── Solapes ────────────────────────────────────────────────────────────────

export interface IntervaloCita {
  fecha: string; // ISO del inicio
  duracionMinutos: number;
  servicio?: string | null;
  estado?: string | null;
}

function intervalo(c: IntervaloCita): [number, number] {
  const inicio = new Date(c.fecha).getTime();
  return [inicio, inicio + (c.duracionMinutos || 60) * 60_000];
}

// Una cita nueva no puede pisar un bloque extendido tipo 4, ni un bloque
// tipo 4 puede pisar citas existentes. Las citas canceladas / no-show no
// bloquean.
export function solapaConBloqueoTipo4(
  nueva: IntervaloCita,
  existentes: IntervaloCita[]
): boolean {
  const activa = (c: IntervaloCita) =>
    !['cancelada', 'no_show'].includes(c.estado ?? 'pendiente');
  if (!activa(nueva)) return false;
  const nuevaEsBloqueo = clasificarServicio(nueva.servicio) === 'bloqueo_tipo4';
  const [ni, nf] = intervalo(nueva);
  return existentes.some((c) => {
    if (!activa(c)) return false;
    const esBloqueo = clasificarServicio(c.servicio) === 'bloqueo_tipo4';
    if (!nuevaEsBloqueo && !esBloqueo) return false;
    const [ci, cf] = intervalo(c);
    return ni < cf && ci < nf;
  });
}

// ── Confirmación de citas ──────────────────────────────────────────────────

export interface BloqueoConfirmacion {
  codigo: 'parche_sensibilidad' | 'consentimiento_quimico';
  mensaje: string;
}

// Evalúa los bloqueos de la confirmación de una cita (espejo del trigger).
// Devuelve [] cuando la cita puede confirmarse.
export function evaluarConfirmacionCita(params: {
  servicio: string | null | undefined;
  fechaCita: Date;
  clienta: { nuevaEnColor?: boolean; cambioMarcaQuimica?: boolean };
  pruebas: Pick<PruebaSensibilidad, 'aplicadoAt' | 'resultado'>[];
  consentimientos: { tipo: TipoConsentimiento; versionAceptada: string; aceptado: boolean }[];
  versiones?: Record<TipoConsentimiento, string>;
}): BloqueoConfirmacion[] {
  const bloqueos: BloqueoConfirmacion[] = [];
  const clase = clasificarServicio(params.servicio);
  if (clase !== 'color' && clase !== 'decoloracion') return bloqueos;

  const marcada =
    !!params.clienta.nuevaEnColor || !!params.clienta.cambioMarcaQuimica;
  if (marcada && !parcheValidoPara(params.pruebas, params.fechaCita)) {
    bloqueos.push({
      codigo: 'parche_sensibilidad',
      mensaje:
        'Clienta nueva en color o con cambio de marca química: registra una prueba de sensibilidad negativa aplicada al menos 48 horas antes de la cita (validez 14 días).',
    });
  }

  if (clase === 'decoloracion') {
    const vigente = tieneConsentimientoVigente(
      params.consentimientos,
      'consentimiento_quimico',
      params.versiones ?? CONSENTIMIENTO_VERSIONES
    );
    if (!vigente) {
      bloqueos.push({
        codigo: 'consentimiento_quimico',
        mensaje:
          'La decoloración no se confirma sin el consentimiento informado de servicios químicos firmado y vigente de la clienta.',
      });
    }
  }

  return bloqueos;
}

// Traduce los errores del trigger SQL a mensajes accionables para la UI.
export function traducirErrorAgenda(mensaje: string): string {
  if (mensaje.includes('PARCHE_SENSIBILIDAD_REQUERIDO')) {
    return 'Falta la prueba de sensibilidad: regístrala en la ficha de la clienta (aplicada al menos 48 h antes de la cita).';
  }
  if (mensaje.includes('CONSENTIMIENTO_QUIMICO_REQUERIDO')) {
    return 'Falta el consentimiento de servicios químicos: la clienta debe firmarlo en su ficha antes de confirmar la decoloración.';
  }
  if (mensaje.includes('AGENDA_BLOQUEADA')) {
    return 'Ese horario está reservado por un bloque extendido (día de lavado tipo 4 / instalación protectora). Elige otro horario.';
  }
  if (mensaje.includes('SUSCRIPCION_VENCIDA')) {
    return 'Tu suscripción está vencida: renueva tu plan para seguir agendando.';
  }
  return 'No se pudo guardar la cita. Intenta de nuevo.';
}
