// ══════════════════════════════════════════════════════════════════════════
// Puente del módulo de cortes con lo ya construido. CONSUME, no duplica:
//
// - Diagnóstico vigente: precarga tipo, subtipo, densidad, grosor y
//   encogimiento para el filtro duro (PR-03), reutilizando la lectura de
//   consultas que ya existe.
// - Remolinos y dirección de crecimiento: dato nuevo de cabina que vive en
//   consultas.perfil_extendido, igual que las dimensiones del Sprint B — sin
//   columna nueva.
// - Pre-agendamiento: lib/cortes/preagenda.ts, que a su vez usa lib/agenda/.
// ══════════════════════════════════════════════════════════════════════════

import { getConsultasByClienta } from '@/lib/db';
import type { Consulta } from '@/lib/types';
import type {
  DireccionCrecimiento, EntradaDiagnosticoCorte, PerfilCrecimiento,
} from './tipos';

/** Claves en perfil_extendido donde vive el dato de crecimiento (PR-05). */
export const CLAVE_REMOLINO_FRONTAL = 'remolinoFrontal';
export const CLAVE_REMOLINO_CORONILLA = 'remolinoCoronilla';
export const CLAVE_DIRECCION_CRECIMIENTO = 'direccionCrecimiento';

const DIRECCIONES: DireccionCrecimiento[] = [
  'hacia_adelante', 'hacia_atras', 'lateral', 'irregular',
];

/**
 * Lee el dato de crecimiento del perfil extendido.
 *
 * Devuelve undefined SOLO cuando no hay dato — es decir, cuando la estilista
 * no respondió esas preguntas (clienta anterior al flujo, o preguntas
 * omitidas por ser opcionales). Un "no" explícito SÍ es dato: se conserva,
 * aunque no dispare ningún veto. La distinción importa porque "no tiene
 * remolino" y "no lo miramos" son cosas distintas en la ficha.
 */
export function crecimientoDesdePerfil(
  perfil: Record<string, unknown> | undefined
): PerfilCrecimiento | undefined {
  if (!perfil) return undefined;

  const respondida = (clave: string) =>
    perfil[clave] !== undefined && perfil[clave] !== null && perfil[clave] !== '';

  const dir = perfil[CLAVE_DIRECCION_CRECIMIENTO];
  const direccion = DIRECCIONES.includes(dir as DireccionCrecimiento)
    ? (dir as DireccionCrecimiento)
    : undefined;

  const hayDato =
    respondida(CLAVE_REMOLINO_FRONTAL) ||
    respondida(CLAVE_REMOLINO_CORONILLA) ||
    direccion !== undefined;

  if (!hayDato) return undefined;

  return {
    remolinoFrontal: perfil[CLAVE_REMOLINO_FRONTAL] === true,
    remolinoCoronilla: perfil[CLAVE_REMOLINO_CORONILLA] === true,
    direccion,
  };
}

export function diagnosticoDesdeConsulta(
  consulta: Consulta | undefined
): EntradaDiagnosticoCorte {
  if (!consulta) return {};
  const perfil = (consulta.perfilExtendido ?? {}) as Record<string, unknown>;
  const tipo = consulta.tipoRizoPrincipal || undefined;

  return {
    tipoCabello: tipo,
    densidad: consulta.densidad,
    grosor: consulta.grosor,
    // T4-01: en tipo 4 el encogimiento redefine los largos, así que la
    // matriz lo necesita para leer las notas de las fichas condicionadas.
    encogimientoAlto: !!tipo && tipo.startsWith('4'),
    crecimiento: crecimientoDesdePerfil(perfil),
  };
}

export async function cargarDiagnosticoVigente(
  clientaId: string
): Promise<{ diagnostico: EntradaDiagnosticoCorte; consulta?: Consulta }> {
  const consultas = await getConsultasByClienta(clientaId);
  const vigente = consultas.find((c) => !c.esBorrador) ?? consultas[0];
  return { diagnostico: diagnosticoDesdeConsulta(vigente), consulta: vigente };
}
