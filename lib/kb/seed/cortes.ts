// ══════════════════════════════════════════════════════════════════════════
// Seed del módulo de cortes (Entrega 5) para la knowledge base.
//
// TODO en estado BORRADOR: producción no cambia hasta publicar desde el
// panel /conocimiento.
//
// Tres piezas:
//   1. Principios PR-01…PR-06 y la guía de rostros, como reglas de segmento
//      'referencia_corte' — que el evaluador de diagnóstico IGNORA (nunca
//      'config': su disclaimerProductos se inyecta en cada diagnóstico).
//   2. Las 16 fichas, listas para insertarse en kb_cortes.
//   3. La dimensión nueva de remolinos y dirección de crecimiento (PR-05),
//      que alimenta perfil_extendido igual que las dimensiones del Sprint B.
// ══════════════════════════════════════════════════════════════════════════

import type { DimensionKB, FlujoKB, PreguntaFlujo, ReglaKB } from '../tipos';
import { FICHAS_CORTE, GUIA_ROSTROS } from '../../cortes/fichas';
import { GLOSARIO_VERBOS } from '../../cortes/lenguaje';
import { fichaAFila as _fichaAFila, type FilaCorteSeed } from '../../cortes/serializacion';

const BORRADOR = 'borrador' as const;

// ── 1. Principios y guía de rostros ───────────────────────────────────────

const PRINCIPIOS: { clave: string; titulo: string; texto: string; nota?: string }[] = [
  {
    clave: 'PR-01',
    titulo: 'El óvalo es referencia, no ideal',
    texto:
      'La heurística clásica usa el óvalo como punto de equilibrio visual. Es una herramienta de proporción, no un estándar de belleza. El lenguaje de salida nunca describe el rostro como algo a intervenir: dice que el corte equilibra, destaca, enmarca o celebra. La clienta puede declarar qué quiere destacar, y eso pesa más que la heurística.',
    nota:
      'Vocabulario cerrado por Keila (validación §5.1): equilibrar, destacar, enmarcar y celebrar. La Entrega 5 listaba solo los tres primeros. tests/cortes.test.ts audita cada salida.',
  },
  {
    clave: 'PR-02',
    titulo: 'Volumen donde falta, suavidad donde sobra',
    texto:
      'La proporción se gestiona con masa: los rostros anchos se equilibran con altura o largo; los alargados, con ancho lateral; los ángulos marcados se enmarcan con capas y ondas, o se celebran con líneas limpias si la clienta lo prefiere. Cada forma tiene su vector de equilibrio y cada corte declara dónde pone su volumen; la matriz cruza ambos.',
  },
  {
    clave: 'PR-03',
    titulo: 'El tipo de cabello veta o habilita',
    texto:
      'El patrón manda sobre el catálogo: la densidad expande los bobs, el encogimiento del tipo 4 redefine los largos (T4-01), la hebra fina no sostiene capas vaciadas y el rizo convierte cualquier línea recta en una sugerencia. El diagnóstico vigente filtra el catálogo ANTES de puntuar por rostro: un corte incompatible ni aparece.',
  },
  {
    clave: 'PR-04',
    titulo: 'Donde termina el corte, mira el ojo',
    texto:
      'El largo dirige la atención a su línea final: un corte a la mandíbula la subraya; a la clavícula, alarga el cuello; el volumen a la altura de las mejillas destaca esa zona. Las fichas declaran su línea de término y la matriz la cruza con lo que la forma del rostro busca.',
  },
  {
    clave: 'PR-05',
    titulo: 'El flequillo es herramienta de proporción, y los remolinos votan',
    texto:
      'El flequillo enmarca la frente y equilibra los rostros alargados; pero la coronilla y los remolinos vetan flequillos y rayas que peleen contra el crecimiento natural, porque esa pelea se pierde todas las mañanas. El perfil registra remolinos y dirección de crecimiento, y el motor advierte el conflicto antes de recomendar.',
  },
  {
    clave: 'PR-06',
    titulo: 'El mantenimiento es parte del corte',
    texto:
      'Un fade impecable exige retoque cada 2 a 3 semanas; un pixie, cada 4 a 6. Recomendar un corte que la persona no va a mantener es recomendar un corte que se verá distinto la mayor parte del tiempo. La clienta declara su tolerancia y la matriz filtra con honestidad. Al confirmar la ejecución, el retoque se pre-agenda según el ciclo de vida de la ficha.',
    nota: 'Keila (validación §5.2) fija la recurrencia comercial: el ciclo de vida en semanas vive en la ficha y abre la ventana de preventa de la agenda.',
  },
];

const REGLAS_PRINCIPIOS: ReglaKB[] = PRINCIPIOS.map((p, i) => ({
  clave: `corte.principio.${p.clave.toLowerCase()}`,
  segmento: 'referencia_corte',
  prioridad: 100 + i,
  condiciones: null,
  salida: { texto: `${p.clave} · ${p.titulo}\n${p.texto}` },
  estado: BORRADOR,
  notasInternas: p.nota ?? 'Entrega 5 §4 · principios de recomendación.',
}));

const REGLAS_ROSTROS: ReglaKB[] = GUIA_ROSTROS.map((g, i) => ({
  clave: `corte.rostro.${g.forma}`,
  segmento: 'referencia_corte',
  prioridad: 200 + i,
  condiciones: null,
  salida: { texto: `${g.nombre} — ${g.rasgos} ${g.vector}` },
  estado: BORRADOR,
  notasInternas: 'Entrega 5 §3 · guía de identificación de formas del rostro.',
}));

const REGLAS_VOCABULARIO: ReglaKB[] = Object.entries(GLOSARIO_VERBOS).map(
  ([verbo, definicion], i) => ({
    clave: `corte.vocabulario.${verbo}`,
    segmento: 'referencia_corte' as const,
    prioridad: 300 + i,
    condiciones: null,
    salida: { texto: `${verbo}: ${definicion}` },
    estado: BORRADOR,
    notasInternas:
      'Validación de Keila §5.1 · política lingüística. Los cuatro términos son los ÚNICOS permitidos en las salidas.',
  })
);

export const REGLAS_CORTES: ReglaKB[] = [
  ...REGLAS_PRINCIPIOS,
  ...REGLAS_ROSTROS,
  ...REGLAS_VOCABULARIO,
];

// ── 2. Fichas para kb_cortes ──────────────────────────────────────────────
// fichaAFila vive en lib/cortes/serializacion.ts porque ese módulo importa
// solo tipos y por eso los scripts de Node pueden usarlo directamente.

export { fichaAFila } from '../../cortes/serializacion';
export type { FilaCorteSeed } from '../../cortes/serializacion';

export const FILAS_CORTES: FilaCorteSeed[] = FICHAS_CORTE.map(_fichaAFila);

// ── 3. Dimensión nueva: remolinos y dirección de crecimiento (PR-05) ──────

export const DIMENSIONES_CORTES: DimensionKB[] = [
  {
    clave: 'remolinoFrontal',
    etiqueta: '¿Tiene remolino frontal marcado?',
    descripcion:
      'Observación de cabina. Un remolino frontal marcado vota en contra de los cortes que dependen de flequillo.',
    tipo: 'booleano',
    estado: BORRADOR,
  },
  {
    clave: 'remolinoCoronilla',
    etiqueta: '¿Tiene remolino marcado en la coronilla?',
    descripcion:
      'Define dónde puede caer la raya: la dirección natural manda sobre la simetría.',
    tipo: 'booleano',
    estado: BORRADOR,
  },
  {
    clave: 'direccionCrecimiento',
    etiqueta: 'Dirección de crecimiento dominante',
    descripcion: 'Hacia dónde cae el cabello por sí solo en la zona frontal.',
    tipo: 'opcion',
    opciones: [
      { valor: 'hacia_adelante', etiqueta: 'Hacia adelante' },
      { valor: 'hacia_atras', etiqueta: 'Hacia atrás' },
      { valor: 'lateral', etiqueta: 'Lateral' },
      { valor: 'irregular', etiqueta: 'Irregular' },
    ],
    estado: BORRADOR,
  },
];

// ── 4. Flujo del wizard que captura ese dato ──────────────────────────────
// El wizard renderiza desde kb_flujos, no desde kb_dimensiones. Las
// preguntas se DERIVAN de las dimensiones para que no puedan driftear: si
// Keila ajusta una etiqueta o una opción en la dimensión, la pregunta la
// hereda.
//
// Las tres son OPCIONALES a propósito. El dato es una observación de cabina
// que muchas clientas ya registradas no tienen, y el veto de PR-05 solo
// actúa cuando hay dato: sin él, la matriz se comporta igual que antes.

export function dimensionAPregunta(d: DimensionKB): PreguntaFlujo {
  return {
    clave: d.clave,
    etiqueta: d.etiqueta,
    ayuda: d.descripcion,
    tipo: d.tipo,
    opciones: d.opciones,
    opcional: true,
  };
}

export const FLUJO_CRECIMIENTO: FlujoKB = {
  clave: 'flujo.crecimiento',
  // Transversal: el remolino no depende del patrón de rizo, y el veto de
  // PR-05 aplica a cualquier tipo de cabello.
  tiposCabello: null,
  estado: BORRADOR,
  definicion: {
    titulo: 'Remolinos y dirección de crecimiento',
    descripcion:
      'Observación de cabina para el módulo de cortes (PR-05): la coronilla y los remolinos vetan flequillos y rayas que peleen contra el crecimiento natural. Es opcional — si no lo observaste, continúa sin marcar nada.',
    preguntas: DIMENSIONES_CORTES.map(dimensionAPregunta),
  },
};

export const FLUJOS_CORTES: FlujoKB[] = [FLUJO_CRECIMIENTO];
