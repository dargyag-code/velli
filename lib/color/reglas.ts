// ══════════════════════════════════════════════════════════════════════════
// Reglas de oro de formulación CO-01 … CO-10.
//
// Donde la VALIDACIÓN técnica fija un detalle, MANDA su versión sobre la
// Entrega 3 — el caso grande es CO-05: la Entrega 3 dejaba la proporción
// exacta "a las cartas técnicas"; la validación la cerró por tramos y añadió el
// candado de 20 volúmenes por encima del 75 % de canas.
//
// Los textos marcados VERBATIM son de la validación y no se reescriben.
// ══════════════════════════════════════════════════════════════════════════

import type { DiagnosticoColor, Bloqueo, Advertencia } from './tipos';
import type { NivelTono, Volumen } from './tablas';

// ── CO-09 · Protocolo de incompatibilidad por henna y metales ─────────────
// VERBATIM de la validación técnica firmada (sección 4.2, CO-09). Este
// texto se muestra en pantalla tal cual ante sospecha o registro dudoso.
export const CO09_PROTOCOLO_VERBATIM =
  'Realizar prueba de mechón en la nuca baja con polvo decolorante y peróxido de 20 volúmenes por 30 minutos. Si el cabello genera elevación térmica al tacto, emite olor azufrado, vira hacia tonos verdosos/azulados o pierde elasticidad, el servicio químico queda terminantemente suspendido';

// ── CO-05 · Cobertura de canas ────────────────────────────────────────────
// La validación cerró los tramos: de 25 a 50 % → 1/4 de tubo de serie natural
// obligatorio; de 50 a 75 % → 1/2 tubo; más de 75 % → 3/4 o tubo completo Y
// oxidante bloqueado exclusivamente a 20 volúmenes para garantizar el
// depósito molecular de pigmento.

export interface TramoCanas {
  /** Fracción de tubo de serie natural (.0/N) obligatoria en la mezcla. */
  fraccionBaseNatural: number;
  etiquetaFraccion: string;
  /** true → el oxidante queda bloqueado exclusivamente a 20 vol. */
  bloqueaVeinteVol: boolean;
  descripcion: string;
}

export function tramoCanas(porcentaje: number | undefined): TramoCanas | null {
  if (porcentaje === undefined || porcentaje < 25) return null;
  if (porcentaje <= 50) {
    return {
      fraccionBaseNatural: 0.25,
      etiquetaFraccion: '1/4 de tubo',
      bloqueaVeinteVol: false,
      descripcion:
        'De 25 % a 50 % de canas: incorporar de forma obligatoria 1/4 de tubo de la serie natural (.0 o N).',
    };
  }
  if (porcentaje <= 75) {
    return {
      fraccionBaseNatural: 0.5,
      etiquetaFraccion: '1/2 tubo',
      bloqueaVeinteVol: false,
      descripcion:
        'De 50 % a 75 % de canas: incorporar de forma obligatoria 1/2 tubo de la serie natural (.0 o N).',
    };
  }
  return {
    fraccionBaseNatural: 0.75,
    etiquetaFraccion: '3/4 o tubo completo',
    bloqueaVeinteVol: true,
    descripcion:
      'Más de 75 % de canas: incorporar de forma obligatoria 3/4 o el tubo completo de la serie natural (.0 o N), bloqueando el oxidante exclusivamente a 20 volúmenes para garantizar el depósito molecular de pigmento.',
  };
}

// ── Guardarraíles (Entrega 3 §2, con las reglas de la validación) ─────────────────

/**
 * Evalúa los bloqueos duros ANTES de cualquier cálculo. Si devuelve alguno,
 * la calculadora no muestra fórmula: muestra el camino previo.
 */
export function evaluarGuardarrailes(dx: DiagnosticoColor): Bloqueo[] {
  const bloqueos: Bloqueo[] = [];

  // A-06: bandera médica activa o cuero cabelludo lesionado → bloqueo total.
  // Es el blindaje legal regional; va primero porque anula todo lo demás.
  if (dx.banderaMedicaActiva) {
    bloqueos.push({
      codigo: 'bandera_medica',
      titulo: 'Bloqueo total por señal clínica activa',
      mensaje:
        'El diagnóstico tiene una bandera médica activa. No se realiza ningún proceso químico ni mecánico invasivo mientras esté vigente.',
      caminoPrevio:
        'Deriva a dermatología con el informe del Pasaporte Capilar y reevalúa el color cuando la señal esté resuelta.',
    });
  }

  if (dx.cueroCabelludoLesionado) {
    bloqueos.push({
      codigo: 'cuero_lesionado',
      titulo: 'Bloqueo total por cuero cabelludo comprometido',
      mensaje:
        'Con lesiones, pústulas, descamación severa, eritema generalizado o sangrado no hay proceso químico (regla A-06).',
      caminoPrevio:
        'Cuero cabelludo íntegro antes de cualquier aplicación: deriva y reevalúa.',
    });
  }

  // Elasticidad baja → bloqueo absoluto de decoloración/aclaración.
  if (dx.elasticidad === 'baja') {
    bloqueos.push({
      codigo: 'elasticidad_baja',
      titulo: 'Bloqueo de decoloración y aclaración',
      mensaje:
        'La elasticidad baja indica una fibra que no aguanta un proceso oxidativo: decolorar o aclarar aquí produce rotura.',
      caminoPrevio:
        'Cronograma de reconstrucción estructural REP-1 o REP-2 antes de replantear el color.',
      reevaluarEnSemanas: 4,
    });
  }

  // Henna / sales metálicas → bloqueo de peróxidos hasta prueba de mechón.
  if (
    (dx.hennaOMetales === 'si' || dx.hennaOMetales === 'dudoso') &&
    !dx.pruebaMechonSuperada
  ) {
    bloqueos.push({
      codigo: 'henna_metales',
      titulo: 'Bloqueo de peróxidos por incompatibilidad química',
      mensaje:
        dx.hennaOMetales === 'si'
          ? 'Hay henna o sales metálicas registradas en el historial: son incompatibles con peróxido.'
          : 'El historial es dudoso respecto a henna, tintes “naturales” o progresivos de procedencia incierta.',
      caminoPrevio:
        'Registra la prueba de mechón protocolizada y su resultado antes de habilitar cualquier peróxido.',
      textoVerbatim: CO09_PROTOCOLO_VERBATIM,
    });
  }

  return bloqueos;
}

// ── CO-01 · El tinte no aclara tinte ──────────────────────────────────────

export interface DecisionVia {
  via: 'tinte' | 'decapado_decoloracion' | 'cobertura' | 'deposito';
  motivo: string;
  /** true → CO-01 descartó la vía tinte. */
  bloqueaTinteDirecto: boolean;
}

export function decidirVia(params: {
  nivelPartida: NivelTono;
  nivelObjetivo: NivelTono;
  pigmentoArtificial: boolean;
  porcentajeCanas?: number;
}): DecisionVia {
  const { nivelPartida, nivelObjetivo, pigmentoArtificial } = params;

  // CO-01: subir niveles sobre pigmento artificial exige extraer, no teñir.
  if (nivelObjetivo > nivelPartida && pigmentoArtificial) {
    return {
      via: 'decapado_decoloracion',
      motivo:
        'CO-01 · El tinte no aclara tinte: la coloración por oxidación aclara pigmento natural, nunca pigmento artificial ya depositado. Para subir niveles en esta zona se requiere ruta de extracción, decapado o decoloración controlada.',
      bloqueaTinteDirecto: true,
    };
  }

  if (nivelObjetivo > nivelPartida) {
    return {
      via: 'tinte',
      motivo: 'Zona sin pigmento artificial: el tinte puede aclarar el pigmento natural.',
      bloqueaTinteDirecto: false,
    };
  }

  if (nivelObjetivo < nivelPartida) {
    return {
      via: 'deposito',
      motivo: 'El objetivo es más oscuro que la base: se deposita pigmento, no se aclara.',
      bloqueaTinteDirecto: false,
    };
  }

  const canas = params.porcentajeCanas ?? 0;
  return {
    via: canas >= 25 ? 'cobertura' : 'tinte',
    motivo:
      canas >= 25
        ? 'No hay niveles que mover: la misión es cubrir cana en el mismo nivel.'
        : 'Mismo nivel: trabajo de tono sobre tono.',
    bloqueaTinteDirecto: false,
  };
}

// ── CO-10 · La sesión honesta ─────────────────────────────────────────────
// Límite seguro de una sesión: la decoloración de un largo teñido no baja
// más de ~4 niveles de golpe, y sobre fibra ya comprometida el margen cae.

export const LIMITE_NIVELES_SESION_NATURAL = 4;
export const LIMITE_NIVELES_SESION_ARTIFICIAL = 3;
export const LIMITE_NIVELES_FIBRA_COMPROMETIDA = 2;

export function cabeEnUnaSesion(params: {
  nivelesAMover: number;
  pigmentoArtificial: boolean;
  porosidad?: 'baja' | 'media' | 'alta';
  elasticidad?: 'baja' | 'media' | 'alta';
  historialDecoloracion?: boolean;
}): { cabe: boolean; limite: number; motivo: string } {
  const subida = Math.max(0, params.nivelesAMover);

  const fibraComprometida =
    params.porosidad === 'alta' ||
    params.elasticidad === 'media' ||
    !!params.historialDecoloracion;

  let limite = params.pigmentoArtificial
    ? LIMITE_NIVELES_SESION_ARTIFICIAL
    : LIMITE_NIVELES_SESION_NATURAL;

  if (fibraComprometida) {
    limite = Math.min(limite, LIMITE_NIVELES_FIBRA_COMPROMETIDA);
  }

  if (subida <= limite) {
    return { cabe: true, limite, motivo: 'La distancia cabe en una sesión segura.' };
  }

  return {
    cabe: false,
    limite,
    motivo: `CO-10 · La distancia real (${subida} niveles) supera el límite seguro de una sesión (${limite} en estas condiciones de fibra). El sistema propone un Plan Multi-Sesión por Etapas con expectativa y costo claros desde el inicio.`,
  };
}

// ── CO-06 · Pre-pigmentación para oscurecer ───────────────────────────────

export function requierePrepigmentacion(params: {
  nivelPartida: NivelTono;
  nivelObjetivo: NivelTono;
  historialDecoloracion?: boolean;
}): boolean {
  return (
    !!params.historialDecoloracion &&
    params.nivelObjetivo <= params.nivelPartida - 2
  );
}

// ── CO-07 · La porosidad tuerce el resultado ──────────────────────────────

export function advertenciasPorosidad(
  porosidad: DiagnosticoColor['porosidad']
): Advertencia[] {
  if (porosidad === 'alta') {
    return [{
      codigo: 'porosidad_alta',
      mensaje:
        'Porosidad alta: la fibra absorbe en exceso los reflejos fríos y los pierde de forma acelerada. Rebaja el reflejo frío o protege las puntas, y ajusta con la clienta la expectativa de duración.',
    }];
  }
  if (porosidad === 'baja') {
    return [{
      codigo: 'porosidad_baja',
      mensaje:
        'Porosidad baja: la hebra se resiste a tomar el color. Respeta los tiempos de pausa completos de la carta del fabricante.',
    }];
  }
  return [];
}

// ── CO-03 · Techo de seguridad del volumen ────────────────────────────────

export function advertenciaVolumen(volumen: Volumen): Advertencia[] {
  if (volumen === 40) {
    return [{
      codigo: 'volumen_restringido',
      mensaje:
        '40 volúmenes es de uso restringido y máxima agresión: ampliamente desaconsejado en aplicación directa sobre cuero cabelludo. Verifica que la carta de la marca lo respalde para este proceso.',
    }];
  }
  return [];
}
