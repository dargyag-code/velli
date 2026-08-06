// ══════════════════════════════════════════════════════════════════════════
// Serialización de fichas de corte hacia la fila de kb_cortes.
//
// Este módulo importa SOLO tipos, a propósito: así los scripts de Node
// (type stripping nativo, sin resolución de módulos) pueden importarlo
// directamente para generar el payload de carga — la misma convención que
// hace scriptables a lib/kb/seed/reglasRizado.ts y compañía.
//
// La operación inversa (fila → ficha) vive en lib/cortes/catalogo.ts, que sí
// toca el cliente de Supabase y por eso no es importable desde Node.
// ══════════════════════════════════════════════════════════════════════════

import type { FichaCorte } from './tipos';

export interface FilaCorteSeed {
  clave: string;
  locale: string;
  nombre: string;
  largo: string;
  capas: string;
  densidad_ideal: string[];
  textura: string[];
  etiqueta_genero: string;
  ficha: Record<string, unknown>;
  ciclo_semanas_min: number;
  ciclo_semanas_max: number;
  estado: string;
  notas_internas: string | null;
}

/**
 * Traduce una FichaCorte del seed canónico a la fila de kb_cortes.
 * El estado es SIEMPRE borrador: publicar es una decisión aparte que se
 * toma desde el panel de conocimiento.
 */
export function fichaAFila(f: FichaCorte): FilaCorteSeed {
  const {
    clave, nombre, largo, capas, etiquetaGenero, densidadIdeal, textura,
    cicloSemanas, notasInternas, ...resto
  } = f;
  return {
    clave,
    locale: 'es',
    nombre,
    largo,
    capas,
    densidad_ideal: densidadIdeal,
    textura,
    etiqueta_genero: etiquetaGenero,
    // El resto de la ficha viaja como jsonb: crecer el catálogo no exige
    // migración.
    ficha: { ...resto, densidadIdeal, textura, cicloSemanas },
    ciclo_semanas_min: cicloSemanas[0],
    ciclo_semanas_max: cicloSemanas[1],
    estado: 'borrador',
    notas_internas: notasInternas ?? null,
  };
}
