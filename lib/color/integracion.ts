// ══════════════════════════════════════════════════════════════════════════
// Puente entre la calculadora y lo ya construido. CONSUME, no duplica:
//
// - Marcas: lee el inventario del salón desde salon_marcas_activas, cruzado
//   con las cartas publicadas de kb_marcas (lib/kb/marcas.ts).
// - Diagnóstico: precarga el diagnóstico vigente de la clienta (CO-02: la
//   calculadora no se abre "en blanco") desde su última consulta.
// - Prerrequisitos legales: antes de mostrar un plan de decoloración se
//   verifican los MISMOS requisitos que exige el trigger citas_guard_legal
//   (parche negativo en ventana 48 h–14 días + consentimiento_quimico
//   vigente), reutilizando lib/agenda/reglas.ts. Así la estilista ve el
//   motivo accionable en la calculadora en vez de chocarse con el bloqueo
//   al confirmar la cita.
// ══════════════════════════════════════════════════════════════════════════

import { getConsultasByClienta } from '@/lib/db';
import { listarConsentimientos } from '@/lib/consentimientos';
import { listarPruebasSensibilidad } from '@/lib/agenda/citas';
import { evaluarConfirmacionCita, traducirErrorAgenda } from '@/lib/agenda/reglas';
import { listarMarcas, listarMarcasActivasIds, type MarcaKBRow } from '@/lib/kb/marcas';
import type { Clienta, Consulta } from '@/lib/types';
import type { Bloqueo, DiagnosticoColor } from './tipos';
import type { CartaMarca } from './calculadora';

// ── Marcas del inventario del salón ───────────────────────────────────────

/** Marcas publicadas que el salón declaró activas en su inventario físico. */
export async function marcasDelSalon(): Promise<MarcaKBRow[]> {
  const [todas, activas] = await Promise.all([
    listarMarcas(),
    listarMarcasActivasIds(),
  ]);
  return todas.filter((m) => m.estado === 'publicada' && activas.has(m.id));
}

/** Traduce el jsonb de la carta al shape que consume la calculadora. */
export function cartaDesdeMarca(marca: MarcaKBRow | undefined): CartaMarca | undefined {
  if (!marca?.carta) return undefined;
  const c = marca.carta as Record<string, unknown>;
  const texto = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : undefined);
  const numero = (k: string) => (typeof c[k] === 'number' ? (c[k] as number) : undefined);
  return {
    nombre: marca.nombre,
    proporcionEstandar: texto('proporcionEstandar'),
    tiempoPausaEstandar: texto('tiempoPausaEstandar'),
    gramosPorTubo: numero('gramosPorTubo'),
    notacion: texto('notacion'),
  };
}

// ── R5 · Canas: del tramo del asistente al porcentaje de CO-05 ────────────
// El asistente guarda las canas por tramos (perfil_extendido.estadoCanas) y
// CO-05 pide un porcentaje. Cada tramo se traduce a un valor representativo,
// lejos de los bordes de CO-05 (25, 50 y 75 %). «Más del 50 %» abarca dos
// tramos de CO-05, así que no se adivina: la estilista lo precisa en la
// calculadora. Los tramos 50–75 y 75–100 son los del estándar de Velli.

export const PORCENTAJE_CANAS_POR_TRAMO = {
  sin_canas: 0,
  menos_25: 12,
  entre_25_50: 37,
  entre_50_75: 62,
  mas_75: 87,
} as const;

export type TramoCanasAsistente = keyof typeof PORCENTAJE_CANAS_POR_TRAMO;

/** Porcentaje de canas para CO-05; un número guardado manda sobre el tramo. */
export function porcentajeCanasDesdePerfil(perfil: Record<string, unknown>): {
  porcentaje?: number;
  porPrecisar: boolean;
} {
  const numero = perfil['porcentajeCanas'];
  if (typeof numero === 'number') return { porcentaje: numero, porPrecisar: false };
  const tramo = perfil['estadoCanas'];
  if (typeof tramo === 'string' && tramo in PORCENTAJE_CANAS_POR_TRAMO) {
    return { porcentaje: PORCENTAJE_CANAS_POR_TRAMO[tramo as TramoCanasAsistente], porPrecisar: false };
  }
  return { porPrecisar: tramo === 'mas_50' };
}

// ── CO-02 · Precarga del diagnóstico vigente ──────────────────────────────

/**
 * Deriva las entradas de color desde la última consulta de la clienta.
 * Los campos que el diagnóstico no cubre (nivel natural, objetivo) los
 * completa la estilista en la sesión.
 */
export function diagnosticoDesdeConsulta(
  consulta: Consulta | undefined,
  clienta?: Clienta
): DiagnosticoColor {
  if (!consulta) return {};

  const perfil = (consulta.perfilExtendido ?? {}) as Record<string, unknown>;
  const quimicos = consulta.quimicos ?? [];
  const cuero = consulta.estadoCueroCabelludo ?? [];

  const textoIncluye = (arr: string[], ...claves: string[]) =>
    arr.some((x) => claves.some((k) => x.toLowerCase().includes(k)));

  // Henna / sales metálicas: dimensión del perfil extendido si existe; si no,
  // se infiere del historial químico declarado en el wizard.
  const hennaPerfil = perfil['hennaOMetales'];
  const hennaOMetales: DiagnosticoColor['hennaOMetales'] =
    hennaPerfil === 'si' || hennaPerfil === 'dudoso' || hennaPerfil === 'no'
      ? hennaPerfil
      : textoIncluye(quimicos, 'henna', 'progresiv', 'natural')
        ? 'dudoso'
        : 'no';

  const canas = porcentajeCanasDesdePerfil(perfil);

  return {
    porosidad: consulta.porosidad,
    elasticidad: consulta.elasticidad,
    // Cuero cabelludo comprometido: mismas señales que la regla A-06.
    cueroCabelludoLesionado: textoIncluye(
      cuero, 'dermatitis', 'lesion', 'lesión', 'sensible', 'rojiz'
    ),
    hennaOMetales,
    pruebaMechonSuperada: perfil['pruebaMechonSuperada'] === true,
    porcentajeCanas: canas.porcentaje,
    ...(canas.porPrecisar ? { canasPorPrecisar: true } : {}),
    canasResistentes: perfil['canasResistentes'] === true,
    historialDecoloracion: textoIncluye(quimicos, 'decolor', 'mecha'),
    // La bandera médica vive en el resultado del diagnóstico: si el plan
    // vigente es una derivación, no hay proceso químico posible.
    banderaMedicaActiva: /deriva|dermat[oó]log/i.test(
      consulta.resultado?.tratamientoPrincipal ?? ''
    ),
  };
}

export async function cargarDiagnosticoVigente(
  clientaId: string
): Promise<{ diagnostico: DiagnosticoColor; consulta?: Consulta }> {
  const consultas = await getConsultasByClienta(clientaId);
  // getConsultasByClienta ordena por fecha descendente: la primera es la vigente.
  const vigente = consultas.find((c) => !c.esBorrador) ?? consultas[0];
  return { diagnostico: diagnosticoDesdeConsulta(vigente), consulta: vigente };
}

// ── Prerrequisitos legales de la decoloración ─────────────────────────────

/**
 * Mismos requisitos que exige el trigger citas_guard_legal al confirmar una
 * cita de decoloración. Se evalúan ANTES de mostrar el plan para que la
 * estilista los resuelva en la ficha, no al final del proceso.
 *
 * `servicio` se pasa como 'Decoloración' para reutilizar la clasificación
 * existente sin duplicar la lógica de patrones.
 */
export async function prerrequisitosDecoloracion(
  clienta: Clienta,
  fechaServicio: Date = new Date()
): Promise<Bloqueo[]> {
  const [pruebas, consentimientos] = await Promise.all([
    listarPruebasSensibilidad(clienta.id),
    listarConsentimientos(clienta.id),
  ]);

  const bloqueosAgenda = evaluarConfirmacionCita({
    servicio: 'Decoloración',
    fechaCita: fechaServicio,
    clienta: {
      nuevaEnColor: clienta.nuevaEnColor,
      cambioMarcaQuimica: clienta.cambioMarcaQuimica,
    },
    pruebas,
    consentimientos,
  });

  return bloqueosAgenda.map((b) => ({
    codigo: b.codigo === 'parche_sensibilidad'
      ? ('parche_sensibilidad' as const)
      : ('consentimiento_quimico' as const),
    titulo: b.codigo === 'parche_sensibilidad'
      ? 'Falta la prueba de sensibilidad'
      : 'Falta el consentimiento de servicios químicos',
    mensaje: b.mensaje,
    // El mismo texto accionable que muestra la agenda al chocar con el
    // trigger, para que la estilista lea siempre la misma instrucción.
    caminoPrevio: traducirErrorAgenda(
      b.codigo === 'parche_sensibilidad'
        ? 'PARCHE_SENSIBILIDAD_REQUERIDO'
        : 'CONSENTIMIENTO_QUIMICO_REQUERIDO'
    ),
  }));
}
