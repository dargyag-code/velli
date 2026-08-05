// ══════════════════════════════════════════════════════════════════════════
// Seed de colorimetría (Fase 3) para la knowledge base.
//
// TODO en estado BORRADOR: producción no cambia hasta publicar desde el
// panel /conocimiento. Mismo criterio que el Sprint B.
//
// Las tablas universales y las reglas CO se DERIVAN de lib/color/*, que es
// la fuente canónica que consume la calculadora — así el seed no puede
// driftear del motor (lo vigila tests/colorimetria.seed.test.ts).
//
// Lo que NO entra aquí: las cartas técnicas por marca. Esas se cargan al
// panel desde la carta oficial de cada fabricante (kb_marcas), con su
// versión y fecha. Regla de gobernanza de la Entrega 3 §6: si un dato no
// está en una carta técnica oficial, no se carga.
// ══════════════════════════════════════════════════════════════════════════

import type { ReglaKB } from '../tipos';
import {
  OXIDANTES, PARES_NEUTRALIZACION, REFLEJOS_BASE, REFLEJO_DEPENDE_DE_MARCA,
  TABLA_ALTURAS,
} from '@/lib/color/tablas';
import { CO09_PROTOCOLO_VERBATIM, tramoCanas } from '@/lib/color/reglas';

const BORRADOR = 'borrador' as const;

// ── Tablas universales como datos ─────────────────────────────────────────
// Segmento 'config': valores fijos que la calculadora consulta, sin
// condiciones sobre el perfil. Una fila por nivel para que Keila pueda
// ajustar un nivel suelto desde el panel sin tocar los demás.

const REGLAS_ALTURAS: ReglaKB[] = TABLA_ALTURAS.map((fila) => ({
  clave: `color.altura.${fila.nivel}`,
  segmento: 'config',
  prioridad: 100 + fila.nivel,
  condiciones: null,
  salida: {
    campo: 'disclaimerProductos',
    texto: `Nivel ${fila.nivel} · ${fila.nombre} — fondo de aclaración: ${fila.fondoAclaracion}; neutraliza con ${fila.neutralizante} (${fila.denominacionLatam}).`,
  },
  estado: BORRADOR,
  notasInternas:
    'Tabla 4.1 de la VALIDACIÓN de Keila (escala homologada LatAm). Manda sobre la Entrega 3 §3.2 donde difieran.',
}));

const REGLAS_NEUTRALIZACION: ReglaKB[] = PARES_NEUTRALIZACION.map((par, i) => ({
  clave: `color.neutraliza.${par.pigmento.toLowerCase().replace(/\s+/g, '_')}`,
  segmento: 'config',
  prioridad: 200 + i,
  condiciones: null,
  salida: {
    campo: 'disclaimerProductos',
    texto: `${par.pigmento} se neutraliza con ${par.neutralizaCon}.`,
  },
  estado: BORRADOR,
  notasInternas: 'Entrega 3 §3.3 · rueda de neutralización.',
}));

const REGLAS_REFLEJOS: ReglaKB[] = [
  ...REFLEJOS_BASE.map((r, i) => ({
    clave: `color.reflejo.${r.digito.replace('.', '')}`,
    segmento: 'config' as const,
    prioridad: 300 + i,
    condiciones: null,
    salida: {
      campo: 'disclaimerProductos' as const,
      texto: `${r.digito} ${r.nombre} — pigmento ${r.pigmento}${r.nota ? `. ${r.nota}` : ''}.`,
    },
    estado: BORRADOR,
    notasInternas: 'Entrega 3 §3.4 · notación base común entre marcas.',
  })),
  {
    clave: 'color.reflejo.marca',
    segmento: 'config',
    prioridad: 399,
    condiciones: null,
    salida: { campo: 'disclaimerProductos', texto: REFLEJO_DEPENDE_DE_MARCA },
    estado: BORRADOR,
    notasInternas: 'Entrega 3 §3.4 · de .7 en adelante lo define el fabricante.',
  },
];

const REGLAS_OXIDANTES: ReglaKB[] = OXIDANTES.map((o, i) => ({
  clave: `color.oxidante.${o.volumen}`,
  segmento: 'config',
  prioridad: 400 + i,
  condiciones: null,
  salida: {
    campo: 'disclaimerProductos',
    texto: `${o.volumen} vol (${o.concentracion}) — aclara ${o.aclara[0]}–${o.aclara[1]} nivel(es). ${o.usoTipico}.`,
  },
  estado: BORRADOR,
  notasInternas: 'Entrega 3 §3.5 · tabla de oxidantes.',
}));

// ── Reglas de oro CO-01 … CO-10 ───────────────────────────────────────────
// El texto es el principio y cómo lo aplica el motor. Las que Keila cerró
// con detalle (CO-05, CO-09) llevan su redacción literal.

interface DefinicionCO {
  clave: string;
  titulo: string;
  texto: string;
  nota?: string;
}

const CO: DefinicionCO[] = [
  {
    clave: 'CO-01',
    titulo: 'El tinte no aclara tinte',
    texto:
      'La coloración por oxidación aclara pigmento NATURAL, nunca pigmento ARTIFICIAL ya depositado. Si el nivel objetivo es mayor al actual en una zona con pigmento artificial, la calculadora bloquea la opción de tinte directo y exige una ruta de extracción, decapado o decoloración controlada.',
    nota: 'Redacción de Keila (validación 4.2). Implementado en decidirVia().',
  },
  {
    clave: 'CO-02',
    titulo: 'Diagnóstico antes de fórmula',
    texto:
      'Toda fórmula nace de cuatro datos: nivel natural de raíz, nivel y estado de medios-puntas, porcentaje de canas y porosidad. La calculadora no se abre en blanco: precarga el diagnóstico vigente de la clienta.',
  },
  {
    clave: 'CO-03',
    titulo: 'El volumen lo deciden los niveles a mover',
    texto:
      'Primero se calcula cuántos niveles hay entre la base y el objetivo; ese número y la tabla de la marca determinan el oxidante. Nunca más volumen del necesario: el de más castiga la fibra sin mejorar el resultado. 40 vol siempre con advertencia reforzada.',
  },
  {
    clave: 'CO-04',
    titulo: 'Neutralizar o aprovechar el fondo de aclaración',
    texto:
      'Al llegar al nivel deseado, el fondo de aclaración de ese nivel decide el reflejo: se neutraliza para resultados fríos o se aprovecha para cálidos. Ignorar el fondo es la causa número uno de "quedó naranja" y "quedó amarillo".',
  },
  {
    clave: 'CO-05',
    titulo: 'Regla de cobertura de canas universal',
    texto: [
      'Antes de consultar la carta específica de la marca, el motor calcula la mezcla base así:',
      `· ${tramoCanas(30)!.descripcion}`,
      `· ${tramoCanas(60)!.descripcion}`,
      `· ${tramoCanas(90)!.descripcion}`,
    ].join('\n'),
    nota:
      'VERBATIM de Keila (validación 4.2 CO-05). Cierra los tramos que la Entrega 3 dejaba abiertos e impone el candado de 20 vol por encima del 75 %.',
  },
  {
    clave: 'CO-06',
    titulo: 'Pre-pigmentación para oscurecer',
    texto:
      'Para bajar 2 o más niveles sobre cabello muy aclarado, primero se reponen los pigmentos cálidos del nivel intermedio; luego se deposita el tono objetivo. Sin ese paso el resultado sale verdoso, hueco o se desvanece en días.',
  },
  {
    clave: 'CO-07',
    titulo: 'La porosidad tuerce el resultado',
    texto:
      'La hebra porosa absorbe de más (sobre todo los fríos) y suelta rápido; la de porosidad baja se resiste a tomar. Porosidad alta: advertencia de sobre-matización en puntas y expectativa de duración ajustada. Porosidad baja: tiempos de pausa completos según fabricante.',
  },
  {
    clave: 'CO-08',
    titulo: 'La decoloración exige fibra que la aguante',
    texto:
      'Antes de decolorar: prueba de elasticidad obligatoria, prueba de mechón en zona discreta y decisión consciente de aplicación con o sin contacto con cuero cabelludo. Elasticidad baja = bloqueo absoluto con desvío a REP-1/REP-2 y reevaluación a 4 semanas.',
  },
  {
    clave: 'CO-09',
    titulo: 'Protocolo de incompatibilidad por henna y metales',
    texto: CO09_PROTOCOLO_VERBATIM,
    nota:
      'VERBATIM de Keila (validación 4.2 CO-09). Se muestra en pantalla tal cual ante cualquier sospecha o registro dudoso. NO reescribir.',
  },
  {
    clave: 'CO-10',
    titulo: 'La sesión honestidad técnica',
    texto:
      'Cuando la distancia entre la base actual y el objetivo supera los límites de seguridad de una sola sesión, el motor no genera una fórmula directa: diseña un Plan Multi-Sesión por Etapas, estimando los fondos intermedios, agendando tratamientos reconstructores intermedios e insertando los hitos visuales en el Pasaporte Capilar.',
    nota: 'Redacción de Keila (validación 4.2 CO-10).',
  },
];

const REGLAS_CO: ReglaKB[] = CO.map((r, i) => ({
  clave: `color.regla.${r.clave.toLowerCase()}`,
  segmento: 'config',
  prioridad: 500 + i,
  condiciones: null,
  salida: {
    campo: 'disclaimerProductos',
    texto: `${r.clave} · ${r.titulo}\n${r.texto}`,
  },
  estado: BORRADOR,
  notasInternas: r.nota ?? 'Entrega 3 §4 · reglas de oro de formulación.',
}));

// ── Checklist de seguridad innegociable (Entrega 3 §5) ────────────────────

const SEGURIDAD: string[] = [
  'Prueba de sensibilidad (parche) según las instrucciones del fabricante — la referencia habitual es 48 horas antes — en toda clienta nueva al color, con cambio de marca o con antecedente de reacción.',
  'Prueba de mechón ante cualquier duda: historial incierto, henna, fibra comprometida o resultado crítico.',
  'Cuero cabelludo íntegro: con lesiones, irritación o derivación activa no hay proceso químico (regla A-06).',
  'Tiempos y proporciones del fabricante: la carta técnica manda sobre cualquier costumbre de cabina.',
  'Guantes y ventilación siempre; el producto sobrante mezclado no se guarda.',
  'Registro en el historial: fórmula aplicada, volumen, tiempos y resultado con foto.',
];

const REGLAS_SEGURIDAD: ReglaKB[] = SEGURIDAD.map((texto, i) => ({
  clave: `color.seguridad.${i + 1}`,
  segmento: 'config',
  prioridad: 600 + i,
  condiciones: null,
  salida: { campo: 'disclaimerProductos', texto },
  estado: BORRADOR,
  notasInternas: 'Entrega 3 §5 · checklist previa a todo servicio de color.',
}));

export const REGLAS_COLORIMETRIA: ReglaKB[] = [
  ...REGLAS_ALTURAS,
  ...REGLAS_NEUTRALIZACION,
  ...REGLAS_REFLEJOS,
  ...REGLAS_OXIDANTES,
  ...REGLAS_CO,
  ...REGLAS_SEGURIDAD,
];

// ── Esquema de carta por marca (Entrega 3 §6) ─────────────────────────────
// Lo que se CARGA al panel desde la carta oficial, no se redacta. Este
// esquema documenta los campos de kb_marcas.carta y alimenta el editor.

export interface CampoCartaMarca {
  campo: string;
  etiqueta: string;
  descripcion: string;
  ejemplo: string;
}

export const ESQUEMA_CARTA_MARCA: CampoCartaMarca[] = [
  { campo: 'marcaLinea',           etiqueta: 'Marca y línea',        descripcion: 'Identificación del producto',                                                              ejemplo: '[Marca] — línea permanente' },
  { campo: 'fuenteVersion',        etiqueta: 'Fuente y versión',     descripcion: 'Carta técnica oficial, año/versión, quién la cargó y cuándo',                              ejemplo: 'Carta técnica 2026, cargada por K.M.' },
  { campo: 'notacion',             etiqueta: 'Notación de reflejos', descripcion: 'Sistema propio: punto, coma o barra; significado de .7 en adelante y dobles dígitos',      ejemplo: '6/1 = rubio oscuro ceniza' },
  { campo: 'proporcionEstandar',   etiqueta: 'Proporciones de mezcla', descripcion: 'Tinte:oxidante por línea (estándar, superaclarante, matizador)',                         ejemplo: '1:1 · 1:1,5 · 1:2' },
  { campo: 'volumenesDisponibles', etiqueta: 'Volúmenes disponibles', descripcion: 'Oxidantes propios y sus equivalencias',                                                   ejemplo: '10/20/30/40 vol' },
  { campo: 'reglasCanas',          etiqueta: 'Reglas de canas',      descripcion: 'Indicaciones del fabricante para cobertura y canas resistentes',                           ejemplo: '≥50 % canas: mitad de base' },
  { campo: 'superaclarantes',      etiqueta: 'Superaclarantes',      descripcion: 'Serie, niveles de aclaración y restricciones',                                             ejemplo: 'Serie 900: hasta 4–5 niveles s/ base natural' },
  { campo: 'tiempoPausaEstandar',  etiqueta: 'Tiempos de pausa',     descripcion: 'Por proceso, según carta',                                                                 ejemplo: '35 min estándar' },
  { campo: 'gramosPorTubo',        etiqueta: 'Gramos por tubo',      descripcion: 'Para traducir a gramos las fracciones de serie natural de CO-05',                          ejemplo: '60' },
  { campo: 'particularidades',     etiqueta: 'Particularidades',     descripcion: 'Fondo de aclaración propio si difiere, pre-pigmentación recomendada, etc.',                 ejemplo: '—' },
];

/** Plantilla vacía para el editor de marcas del panel. */
export function plantillaCartaMarca(): Record<string, string | number> {
  return {
    marcaLinea: '',
    fuenteVersion: '',
    notacion: '',
    proporcionEstandar: '',
    volumenesDisponibles: '',
    reglasCanas: '',
    superaclarantes: '',
    tiempoPausaEstandar: '',
    gramosPorTubo: 60,
    particularidades: '',
  };
}
