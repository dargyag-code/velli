// ══════════════════════════════════════════════════════════════════════════
// Matriz de recomendación de cortes (Entrega 5 §7.2), en ese orden exacto:
//   1. Filtro duro por tipo de cabello (PR-03) — lo incompatible NI APARECE
//   2. Filtro de mantenimiento (PR-06)
//   3. Veto de remolinos (PR-05)
//   4. Puntuación por rostro (+2 favorece / +1 neutro / 0 precaución)
//      con re-puntuación por lo que la clienta declara (PR-01)
//   5. Salida: top 3 con el porqué visible
//
// Funciones puras, sin I/O. Toda salida usa el vocabulario permitido
// (equilibrar / destacar / enmarcar / celebrar) — lo audita el test.
// ══════════════════════════════════════════════════════════════════════════

import { FICHAS_CORTE, GUIA_ROSTROS } from './fichas';
import type {
  CompatibilidadTipo, EntradaDiagnosticoCorte, EntradaSesionCorte, FichaCorte,
  MotivoPuntuacion, RecomendacionCorte, ResultadoMatriz, TolerarMantenimiento,
} from './tipos';

// ── 1. Filtro duro por tipo de cabello (PR-03) ────────────────────────────

/**
 * Resuelve la compatibilidad de una ficha con el patrón de la clienta.
 * Busca la regla más específica: primero por subtipo exacto ('2C', '4C'),
 * luego por familia ('2', '4'). Sin diagnóstico, no filtra (todo pasa).
 */
export function compatibilidadPara(
  ficha: FichaCorte,
  tipoCabello: string | undefined
): CompatibilidadTipo | null {
  if (!tipoCabello) return null;
  const subtipo = tipoCabello.toUpperCase();
  const familia = subtipo.charAt(0);

  const porSubtipo = ficha.compatibilidad.find((c) =>
    c.tipos.some((t) => t.toUpperCase() === subtipo)
  );
  if (porSubtipo) return porSubtipo;

  return (
    ficha.compatibilidad.find((c) =>
      c.tipos.some((t) => t.toUpperCase() === familia)
    ) ?? null
  );
}

// ── 2. Filtro de mantenimiento (PR-06) ────────────────────────────────────

/** Semanas mínimas de retoque que tolera cada nivel declarado. */
const UMBRAL_MANTENIMIENTO: Record<TolerarMantenimiento, number> = {
  // Tolerancia baja: solo cortes que aguanten 8 semanas o más entre visitas.
  baja: 8,
  // Media: a partir de 4 semanas.
  media: 4,
  // Alta: cualquier frecuencia, incluido el fade de 2 semanas.
  alta: 0,
};

export function toleraMantenimiento(
  ficha: FichaCorte,
  tolerancia: TolerarMantenimiento
): boolean {
  // Se compara contra el mínimo del ciclo: un corte de 2–3 semanas exige
  // volver a las 2, no a las 3.
  return ficha.cicloSemanas[0] >= UMBRAL_MANTENIMIENTO[tolerancia];
}

// ── 3. Veto de remolinos (PR-05) ──────────────────────────────────────────

export interface VetoRemolino {
  excluye: boolean;
  advertencia?: string;
}

/**
 * "La coronilla y los remolinos VETAN flequillos y rayas que peleen contra
 * el crecimiento natural — esa pelea se pierde todas las mañanas."
 *
 * Un remolino frontal marcado EXCLUYE los cortes que dependen de flequillo;
 * un remolino en coronilla o un crecimiento irregular ADVIERTE sobre la raya
 * sin excluir, porque la raya se puede reubicar.
 */
export function vetoRemolinos(
  ficha: FichaCorte,
  crecimiento: EntradaDiagnosticoCorte['crecimiento']
): VetoRemolino {
  if (!crecimiento) return { excluye: false };

  if (ficha.requiereFlequillo && crecimiento.remolinoFrontal) {
    return {
      excluye: true,
      advertencia: `${ficha.nombre} depende de un flequillo que pelearía cada mañana con el remolino frontal registrado.`,
    };
  }

  if (ficha.requiereFlequillo && crecimiento.direccion === 'hacia_atras') {
    return {
      excluye: true,
      advertencia: `${ficha.nombre} necesita que el cabello caiga hacia adelante, y el crecimiento registrado va hacia atrás.`,
    };
  }

  if (ficha.requiereRaya && (crecimiento.remolinoCoronilla || crecimiento.direccion === 'irregular')) {
    return {
      excluye: false,
      advertencia: `En ${ficha.nombre}, ubica la raya siguiendo el remolino de la coronilla: la dirección natural manda sobre la simetría.`,
    };
  }

  return { excluye: false };
}

// ── 4. Puntuación por rostro ──────────────────────────────────────────────

const PUNTOS_FAVORECE = 2;
const PUNTOS_NEUTRO = 1;
const PUNTOS_PRECAUCION = 0;

/** Peso de lo que la clienta declara: PR-01 lo pone POR ENCIMA de la heurística. */
const PUNTOS_DECLARADO = 3;

export function puntuarPorRostro(
  ficha: FichaCorte,
  sesion: EntradaSesionCorte
): { puntaje: number; motivos: MotivoPuntuacion[]; precaucion?: string; variante?: string } {
  const motivos: MotivoPuntuacion[] = [];
  const guia = GUIA_ROSTROS.find((g) => g.forma === sesion.formaRostro)!;

  const favorece = ficha.rostrosFavorece.includes(sesion.formaRostro);
  const precaucion = ficha.rostrosPrecaucion.find((p) => p.forma === sesion.formaRostro);

  let puntaje: number;
  if (favorece) {
    puntaje = PUNTOS_FAVORECE;
    motivos.push({
      criterio: `Favorece al rostro ${guia.nombre.toLowerCase()}: ${guia.vector}`,
      puntos: PUNTOS_FAVORECE,
      regla: 'PR-02',
    });
  } else if (precaucion) {
    puntaje = PUNTOS_PRECAUCION;
    motivos.push({
      criterio: precaucion.nota,
      puntos: PUNTOS_PRECAUCION,
      regla: 'PR-02',
    });
  } else {
    puntaje = PUNTOS_NEUTRO;
    motivos.push({
      criterio: `Neutro para el rostro ${guia.nombre.toLowerCase()}: la elección puede pesar más por estilo de vida y patrón.`,
      puntos: PUNTOS_NEUTRO,
      regla: 'PR-01',
    });
  }

  // PR-01 · lo que la clienta declara pesa MÁS que la heurística.
  for (const deseo of sesion.quiereDestacar ?? []) {
    if (coincideConDeseo(ficha, deseo)) {
      puntaje += PUNTOS_DECLARADO;
      motivos.push({
        criterio: `La clienta pidió ${deseo}, y este corte lo pone en primer plano.`,
        puntos: PUNTOS_DECLARADO,
        regla: 'PR-01',
      });
    }
  }

  // PR-04 · el largo dirige la mirada a su línea final.
  if (sesion.largoDeseado?.length) {
    if (sesion.largoDeseado.includes(ficha.largo)) {
      puntaje += 1;
      motivos.push({
        criterio: `Coincide con el largo que la clienta quiere, con término en ${ficha.lineaTermino.toLowerCase()}.`,
        puntos: 1,
        regla: 'PR-04',
      });
    } else {
      puntaje -= 1;
      motivos.push({
        criterio: 'Su largo se aparta del que la clienta declaró.',
        puntos: -1,
        regla: 'PR-04',
      });
    }
  }

  return { puntaje, motivos, precaucion: precaucion?.nota, variante: precaucion?.variante };
}

/** Cruza el deseo declarado con lo que el corte destaca o enmarca. */
function coincideConDeseo(ficha: FichaCorte, deseo: string): boolean {
  const d = deseo.toLowerCase();
  const superficie = [
    ficha.volumenEn, ficha.lineaTermino, ficha.estructura,
  ].join(' ').toLowerCase();

  const sinonimos: Record<string, string[]> = {
    pomulos: ['coronilla', 'corta', 'muy_corto', 'sin volumen'],
    ojos: ['coronilla', 'flequillo', 'marco'],
    mandibula: ['mandíbula', 'clavícula', 'marco'],
    cuello: ['clavícula', 'nuca', 'corto'],
    volumen: ['volumen', 'coronilla', 'capas'],
    rizos: ['rizo', 'patrón', 'arquitectura'],
    frente: ['flequillo', 'marco'],
  };

  const claves = sinonimos[d] ?? [d];
  return claves.some((k) => superficie.includes(k));
}

// ── 5. La matriz ──────────────────────────────────────────────────────────

export interface ParametrosMatriz {
  diagnostico: EntradaDiagnosticoCorte;
  sesion: EntradaSesionCorte;
  /** Catálogo a evaluar; por defecto las 16 fichas semilla. */
  catalogo?: FichaCorte[];
  /** Cuántas recomendaciones devolver (§7.2 pide top 3). */
  top?: number;
}

export function recomendarCortes(params: ParametrosMatriz): ResultadoMatriz {
  const catalogo = params.catalogo ?? FICHAS_CORTE;
  const { diagnostico: dx, sesion } = params;

  const descartados: ResultadoMatriz['descartados'] = [];
  const advertencias: string[] = [];
  const candidatas: RecomendacionCorte[] = [];

  for (const ficha of catalogo) {
    // Filtro de búsqueda por etiqueta de género: OPCIONAL y nunca una
    // barrera — 'todo' (o sin filtro) no descarta nada, y el resultado
    // siempre puede incluir cortes de cualquier etiqueta si la persona
    // amplía la búsqueda.
    if (
      sesion.filtroGenero &&
      sesion.filtroGenero !== 'todo' &&
      ficha.etiquetaGenero !== sesion.filtroGenero &&
      ficha.etiquetaGenero !== 'unisex'
    ) {
      continue;
    }

    // ── 1. Filtro duro por tipo (PR-03) ───────────────────────────────
    const compat = compatibilidadPara(ficha, dx.tipoCabello);
    if (compat?.nivel === 'incompatible') {
      descartados.push({
        clave: ficha.clave,
        nombre: ficha.nombre,
        motivo: compat.nota ?? 'No aplica al patrón de cabello registrado.',
      });
      continue;
    }

    // ── 2. Filtro de mantenimiento (PR-06) ────────────────────────────
    if (!toleraMantenimiento(ficha, sesion.toleranciaMantenimiento)) {
      descartados.push({
        clave: ficha.clave,
        nombre: ficha.nombre,
        motivo: `Pide retoque cada ${ficha.cicloSemanas[0]} a ${ficha.cicloSemanas[1]} semanas, por encima de la frecuencia que la clienta declaró.`,
      });
      continue;
    }

    // ── 3. Veto de remolinos (PR-05) ──────────────────────────────────
    const veto = vetoRemolinos(ficha, dx.crecimiento);
    if (veto.excluye) {
      descartados.push({
        clave: ficha.clave,
        nombre: ficha.nombre,
        motivo: veto.advertencia!,
      });
      continue;
    }
    if (veto.advertencia) advertencias.push(veto.advertencia);

    // ── 4. Puntuación por rostro ──────────────────────────────────────
    const { puntaje, motivos, variante } = puntuarPorRostro(ficha, sesion);

    // Los condicionados por patrón puntúan igual, pero llevan su nota
    // honesta visible en la salida (§7.2: "aparecen con su nota").
    const notasHonestas: string[] = [];
    if (compat?.nivel === 'condicionado' && compat.nota) {
      notasHonestas.push(compat.nota);
    }
    const precaucionRostro = ficha.rostrosPrecaucion.find(
      (p) => p.forma === sesion.formaRostro
    );
    if (precaucionRostro) notasHonestas.push(precaucionRostro.nota);

    // Densidad y grosor ajustan al margen (PR-03).
    let puntajeFinal = puntaje;
    if (dx.densidad && !ficha.densidadIdeal.includes(dx.densidad)) {
      puntajeFinal -= 1;
      motivos.push({
        criterio: `Su densidad ${dx.densidad} pide un ajuste de la técnica en este corte.`,
        puntos: -1,
        regla: 'PR-03',
      });
    }

    candidatas.push({
      ficha,
      puntaje: puntajeFinal,
      motivos,
      porque: construirPorque(ficha, motivos),
      varianteRecomendada: variante ?? compat?.variante,
      frecuenciaRetoque: `Cada ${ficha.cicloSemanas[0]} a ${ficha.cicloSemanas[1]} semanas`,
      notaHonesta: notasHonestas.length ? notasHonestas.join(' ') : undefined,
    });
  }

  candidatas.sort((a, b) => {
    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
    // Empate: primero el de mantenimiento más noble (ciclo más largo).
    return b.ficha.cicloSemanas[0] - a.ficha.cicloSemanas[0];
  });

  return {
    recomendaciones: candidatas.slice(0, params.top ?? 3),
    descartados,
    advertencias,
  };
}

/** El PORQUÉ visible: el motor enseña el razonamiento, no solo el qué. */
function construirPorque(ficha: FichaCorte, motivos: MotivoPuntuacion[]): string {
  const positivos = motivos.filter((m) => m.puntos > 0).map((m) => m.criterio);
  if (positivos.length === 0) {
    return `${ficha.nombre} es una opción posible: su volumen vive en ${ficha.volumenEn.toLowerCase()} y su término en ${ficha.lineaTermino.toLowerCase()}.`;
  }
  return positivos.join(' ');
}
