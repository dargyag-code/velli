// ══════════════════════════════════════════════════════════════════════════
// Calculadora de color — orquestador (Entrega 3 §7.2, en ese orden exacto):
//   1. Guardarraíles  2. Vía del proceso  3. Distancia/volumen
//   4. Fondo/neutralización  5. Ajustes del diagnóstico  6. Viabilidad
//
// Principio rector, con peso jurídico (Keila, respuesta 6): "Velli orienta
// la formulación y el diseño; el estilista decide y ejecuta". Esta función
// devuelve razonamiento + fórmula SUGERIDA; la UI la deja 100 % editable en
// gramos y volúmenes antes de confirmar.
//
// Funciones puras, sin I/O: los prerrequisitos legales (parche y
// consentimiento) los inyecta el caller como bloqueos ya evaluados, para no
// duplicar la lógica que ya vive en lib/agenda/reglas.ts.
// ══════════════════════════════════════════════════════════════════════════

import {
  TABLA_ALTURAS, filaAltura, oxidante, tratamientoDelFondo, volumenParaNiveles,
  type NivelTono, type Volumen,
} from './tablas';
import {
  advertenciaVolumen, advertenciasPorosidad, cabeEnUnaSesion, decidirVia,
  evaluarGuardarrailes, requierePrepigmentacion, tramoCanas,
} from './reglas';
import type {
  Advertencia, Bloqueo, DiagnosticoColor, EntradaSesion, EtapaPlan,
  FormulaSugerida, GuiaRazonamiento, PlanMultiSesion, ResultadoCalculadora,
} from './tipos';

/** Datos de la carta técnica de la marca (kb_marcas.carta). Sin marca, la
 *  calculadora trabaja en modo orientativo y lo declara en la salida. */
export interface CartaMarca {
  nombre?: string;
  proporcionEstandar?: string;
  tiempoPausaEstandar?: string;
  /** Gramos de tinte por tubo, para traducir las fracciones de CO-05. */
  gramosPorTubo?: number;
  notacion?: string;
}

const GRAMOS_TUBO_DEFECTO = 60;

// Checklist de seguridad §5 — la estilista la confirma antes de aplicar.
const CHECKLIST_BASE = [
  'Prueba de sensibilidad (parche) según el fabricante — 48 horas antes — en clienta nueva al color, con cambio de marca o antecedente de reacción.',
  'Cuero cabelludo íntegro: con lesiones, irritación o derivación activa no hay proceso químico (A-06).',
  'Tiempos y proporciones del fabricante: la carta técnica manda sobre cualquier costumbre de cabina.',
  'Guantes y ventilación siempre; el producto sobrante mezclado no se guarda.',
  'Registro en el historial: fórmula aplicada, volumen, tiempos y resultado con foto.',
];

const CHECKLIST_DECOLORACION = [
  'Prueba de elasticidad realizada y superada.',
  'Prueba de mechón en zona discreta antes de aplicar en todo el largo.',
  'Decisión consciente de aplicación con o sin contacto con cuero cabelludo según técnica y producto.',
];

export interface ParametrosCalculo {
  diagnostico: DiagnosticoColor;
  sesion: EntradaSesion;
  carta?: CartaMarca;
  /** Bloqueos legales ya evaluados por el caller (parche 48 h,
   *  consentimiento químico). Se anteponen a cualquier cálculo. */
  bloqueosLegales?: Bloqueo[];
}

export function calcularColor(params: ParametrosCalculo): ResultadoCalculadora {
  const { diagnostico: dx, sesion, carta } = params;

  // ── 1. GUARDARRAÍLES PRIMERO ───────────────────────────────────────────
  // Si algo bloquea, la calculadora no muestra fórmula: muestra el camino
  // previo (tratamiento, derivación o prueba).
  const bloqueos: Bloqueo[] = [
    ...(params.bloqueosLegales ?? []),
    ...evaluarGuardarrailes(dx),
  ];

  // La zona que gobierna el cálculo: si hay pigmento artificial en los
  // largos, esa es la cabeza que decide la vía (la raíz natural se formula
  // aparte — "son dos cabezas en una", §3.1).
  const nivelPartida: NivelTono =
    sesion.pigmentoArtificial && sesion.nivelActualLargos
      ? sesion.nivelActualLargos
      : sesion.nivelNatural;

  const nivelesAMover = sesion.nivelObjetivo - nivelPartida;

  // ── 2. VÍA DEL PROCESO ─────────────────────────────────────────────────
  const via = decidirVia({
    nivelPartida,
    nivelObjetivo: sesion.nivelObjetivo,
    pigmentoArtificial: sesion.pigmentoArtificial,
    porcentajeCanas: dx.porcentajeCanas,
  });

  const esDecoloracion = via.via === 'decapado_decoloracion';

  // La elasticidad baja solo bloquea procesos de aclaración/decoloración:
  // un depósito o una cobertura en el mismo nivel siguen siendo viables.
  const bloqueosAplicables = bloqueos.filter((b) => {
    if (b.codigo === 'elasticidad_baja') return esDecoloracion || nivelesAMover > 0;
    return true;
  });

  const checklistSeguridad = [
    ...CHECKLIST_BASE,
    ...(esDecoloracion ? CHECKLIST_DECOLORACION : []),
  ];

  if (bloqueosAplicables.length > 0) {
    return { bloqueos: bloqueosAplicables, advertencias: [], checklistSeguridad };
  }

  const advertencias: Advertencia[] = [];

  // ── 3. DISTANCIA → VOLUMEN ─────────────────────────────────────────────
  let volumen: Volumen = volumenParaNiveles(nivelesAMover);
  let volumenBloqueado = false;
  let volumenMotivo: string | undefined;

  // La cobertura de cana es el uso estándar de 20 vol: aunque no haya
  // niveles que mover, 10 vol solo deposita y no abre la cutícula de la
  // hebra blanca.
  if (via.via === 'cobertura' && volumen < 20) {
    volumen = 20;
    volumenMotivo = 'Cobertura de canas: 20 volúmenes es el estándar de cobertura.';
  }

  // ── 5a. AJUSTE POR CANAS (CO-05) ───────────────────────────────────────
  // Se resuelve aquí porque el tramo >75 % puede CERRAR el volumen.
  const tramo = tramoCanas(dx.porcentajeCanas);
  if (tramo?.bloqueaVeinteVol) {
    volumen = 20;
    volumenBloqueado = true;
    volumenMotivo =
      'CO-05 · Más de 75 % de canas: oxidante bloqueado exclusivamente a 20 volúmenes para garantizar el depósito molecular de pigmento.';
  }

  advertencias.push(...advertenciaVolumen(volumen));

  // ── 4. FONDO DE ACLARACIÓN → NEUTRALIZACIÓN ────────────────────────────
  const fondo = tratamientoDelFondo(sesion.nivelObjetivo, sesion.temperatura);
  const filaObjetivo = filaAltura(sesion.nivelObjetivo);

  // ── 5b. RESTO DE AJUSTES DEL DIAGNÓSTICO ───────────────────────────────
  advertencias.push(...advertenciasPorosidad(dx.porosidad));

  if (dx.canasResistentes) {
    advertencias.push({
      codigo: 'canas_resistentes',
      mensaje:
        'Canas marcadas como resistentes: aplica pre-pigmentación o mordentado según la carta de la marca, y respeta el tiempo completo de pausa.',
    });
  }

  const prepigmentar = requierePrepigmentacion({
    nivelPartida,
    nivelObjetivo: sesion.nivelObjetivo,
    historialDecoloracion: dx.historialDecoloracion,
  });
  if (prepigmentar) {
    advertencias.push({
      codigo: 'prepigmentacion',
      mensaje:
        'CO-06 · Oscurecer 2 o más niveles sobre cabello aclarado exige reponer antes los pigmentos cálidos del nivel intermedio. Paso obligatorio: sin él el resultado sale verdoso, hueco o se desvanece en días.',
    });
  }

  // ── 6. VIABILIDAD (CO-10) ──────────────────────────────────────────────
  const viabilidad = cabeEnUnaSesion({
    nivelesAMover,
    pigmentoArtificial: sesion.pigmentoArtificial,
    porosidad: dx.porosidad,
    elasticidad: dx.elasticidad,
    historialDecoloracion: dx.historialDecoloracion,
  });

  const guia = construirGuia({
    nivelesAMover, via, fondo, filaObjetivo, tramo, prepigmentar, volumen,
    volumenMotivo,
  });

  const formula = construirFormula({
    nivelObjetivo: sesion.nivelObjetivo,
    fondo, tramo, volumen, volumenBloqueado, volumenMotivo, carta, via: via.via,
  });

  const planMultiSesion = viabilidad.cabe
    ? undefined
    : construirPlanMultiSesion({
        nivelPartida,
        nivelObjetivo: sesion.nivelObjetivo,
        limitePorSesion: viabilidad.limite,
        motivo: viabilidad.motivo,
        esDecoloracion,
      });

  return {
    bloqueos: [],
    advertencias,
    guia,
    // CO-10: cuando hay plan por etapas, la fórmula corresponde a la meta
    // final y no debe aplicarse de una sola vez — la UI la presenta dentro
    // del plan, nunca como fórmula directa.
    formula: planMultiSesion ? undefined : formula,
    planMultiSesion,
    checklistSeguridad,
  };
}

// ── Construcción de la guía de razonamiento (§7.3) ────────────────────────

function construirGuia(p: {
  nivelesAMover: number;
  via: ReturnType<typeof decidirVia>;
  fondo: ReturnType<typeof tratamientoDelFondo>;
  filaObjetivo: ReturnType<typeof filaAltura>;
  tramo: ReturnType<typeof tramoCanas>;
  prepigmentar: boolean;
  volumen: Volumen;
  volumenMotivo?: string;
}): GuiaRazonamiento {
  const pasos: { regla: string; texto: string }[] = [
    { regla: 'CO-01', texto: p.via.motivo },
    {
      regla: 'CO-03',
      texto:
        p.volumenMotivo ??
        `Distancia de ${Math.abs(p.nivelesAMover)} nivel(es) → ${p.volumen} volúmenes (${oxidante(p.volumen).concentracion}), el mínimo que cubre el recorrido. Nunca más volumen del necesario.`,
    },
    {
      regla: 'CO-04',
      texto: `Al llegar al nivel ${p.filaObjetivo.nivel} (${p.filaObjetivo.nombre}) aflora ${p.fondo.fondo}. Objetivo ${p.fondo.accion === 'neutralizar' ? 'frío' : p.fondo.accion === 'aprovechar' ? 'cálido' : 'neutro'} → ${p.fondo.accion} con ${p.fondo.reflejo}.`,
    },
  ];

  if (p.tramo) {
    pasos.push({ regla: 'CO-05', texto: p.tramo.descripcion });
  }
  if (p.prepigmentar) {
    pasos.push({
      regla: 'CO-06',
      texto: 'Pre-pigmentación obligatoria antes de depositar el tono objetivo.',
    });
  }

  return {
    nivelesAMover: p.nivelesAMover,
    via: p.via.via,
    viaMotivo: p.via.motivo,
    fondoEsperado: p.fondo.fondo,
    accionSobreFondo: p.fondo.accion,
    neutralizacion: p.fondo.reflejo,
    denominacionLatam: p.filaObjetivo.denominacionLatam,
    pasos,
  };
}

// ── Construcción de la fórmula sugerida (editable por la estilista) ───────

function construirFormula(p: {
  nivelObjetivo: NivelTono;
  fondo: ReturnType<typeof tratamientoDelFondo>;
  tramo: ReturnType<typeof tramoCanas>;
  volumen: Volumen;
  volumenBloqueado: boolean;
  volumenMotivo?: string;
  carta?: CartaMarca;
  via: string;
}): FormulaSugerida {
  const gramosTubo = p.carta?.gramosPorTubo ?? GRAMOS_TUBO_DEFECTO;
  const componentes: FormulaSugerida['componentes'] = [];

  if (p.tramo) {
    // CO-05: la fracción de serie natural es OBLIGATORIA en la mezcla.
    const gramosBase = Math.round(gramosTubo * p.tramo.fraccionBaseNatural);
    componentes.push({
      descripcion: `Serie natural ${p.nivelObjetivo}.0 / ${p.nivelObjetivo}N (${p.tramo.etiquetaFraccion})`,
      gramos: gramosBase,
      notaRegla: 'CO-05 · obligatorio para cobertura de canas',
    });
    componentes.push({
      descripcion: `Tono ${p.nivelObjetivo} con reflejo ${p.fondo.accion === 'neutralizar' ? 'neutralizante' : 'de acompañamiento'}`,
      gramos: gramosTubo - gramosBase,
    });
  } else {
    componentes.push({
      descripcion: `Tono ${p.nivelObjetivo} · ${p.fondo.accion === 'neutralizar' ? `neutralizando ${p.fondo.fondo} con ${p.fondo.reflejo}` : p.fondo.reflejo}`,
      gramos: gramosTubo,
    });
  }

  return {
    componentes,
    volumen: p.volumen,
    volumenBloqueado: p.volumenBloqueado,
    volumenMotivo: p.volumenMotivo,
    proporcion: p.carta?.proporcionEstandar ?? '1:1,5 (orientativo — confirma en la carta de la marca)',
    tiempoPausa: p.carta?.tiempoPausaEstandar ?? '35 min (orientativo — confirma en la carta de la marca)',
    origen: p.carta ? 'carta_marca' : 'orientativo',
  };
}

// ── CO-10 · Plan Multi-Sesión por Etapas ──────────────────────────────────

function construirPlanMultiSesion(p: {
  nivelPartida: NivelTono;
  nivelObjetivo: NivelTono;
  limitePorSesion: number;
  motivo: string;
  esDecoloracion: boolean;
}): PlanMultiSesion {
  const etapas: EtapaPlan[] = [];
  let nivelActual = p.nivelPartida;
  let numero = 1;

  while (nivelActual < p.nivelObjetivo) {
    const destino = Math.min(
      p.nivelObjetivo,
      nivelActual + p.limitePorSesion
    ) as NivelTono;
    const esUltima = destino === p.nivelObjetivo;
    const fila = TABLA_ALTURAS.find((f) => f.nivel === destino);

    etapas.push({
      numero,
      titulo: esUltima
        ? `Sesión ${numero} · llegada al nivel ${destino}`
        : `Sesión ${numero} · nivel ${nivelActual} → ${destino}`,
      nivelEstimado: destino,
      fondoIntermedio: fila?.fondoAclaracion,
      acciones: [
        numero === 1 && p.esDecoloracion
          ? 'Prueba de mechón antes de aplicar en todo el largo.'
          : 'Verificar estado de la fibra antes de continuar.',
        p.esDecoloracion
          ? `Aclaración controlada hasta fondo ${fila?.fondoAclaracion ?? 'objetivo'}, siguiendo tabla y tiempos del fabricante del polvo.`
          : `Elevar hasta el nivel ${destino}.`,
        esUltima
          ? 'Matización al tono objetivo aprovechando o neutralizando el fondo según la temperatura pedida.'
          : 'Matización de seguridad para dejar el largo presentable entre sesiones.',
      ],
      tratamientoIntermedio: esUltima
        ? undefined
        : 'Cronograma de reconstrucción REP-1 entre sesiones.',
      esperaSemanas: esUltima ? undefined : 4,
    });

    nivelActual = destino;
    numero += 1;
    if (numero > 6) break; // guarda contra objetivos absurdos
  }

  return {
    motivo: p.motivo,
    etapas,
    hitosPasaporte: etapas.map(
      (e) =>
        `Foto de cierre de la sesión ${e.numero} (nivel ~${e.nivelEstimado}, fondo ${e.fondoIntermedio ?? '—'}).`
    ),
  };
}
