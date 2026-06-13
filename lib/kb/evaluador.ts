// ══════════════════════════════════════════════════════════════════════════
// Evaluador genérico de la knowledge base.
//
// Recibe el perfil capilar (WizardData + salud de la clienta) y un conjunto
// de reglas (de Supabase o del seed canónico) y produce un ResultadoConsulta.
// Con el seed de rizos produce EXACTAMENTE la misma salida que el motor
// legacy generateDiagnosis — garantizado por tests/diagnostico.regresion.
//
// Regla de seguridad incorporada (no configurable por datos): si CUALQUIER
// regla con es_bandera_medica matchea, el resultado es SIEMPRE una
// derivación a dermatólogo construida en código — nunca un plan de
// tratamiento, sin importar qué digan las demás reglas.
// ══════════════════════════════════════════════════════════════════════════

import {
  WizardData,
  ResultadoConsulta,
  CronogramaResult,
  CuidadoCasaResult,
  RutinaPaso,
} from '../types';
import { SaludClienta } from '../diagnosticEngine';
import {
  Condicion,
  ReglaKB,
  SalidaHecho,
  SalidaTexto,
  SalidaTextos,
  SalidaCronograma,
  SalidaTecnica,
  SalidaRutina,
  SalidaCuidadoCasa,
  SalidaConfig,
  SalidaDerivacionMedica,
  RutinaPasoClave,
  RutinaAtributo,
} from './tipos';

export type Hechos = Record<string, unknown>;

// ── Hechos base desde el perfil ─────────────────────────────────────────────
// Mismos defaults que generateDiagnosis (modo express incluido).

export function construirHechosBase(data: WizardData, salud?: SaludClienta): Hechos {
  const hechos: Hechos = {
    tipoRizoPrincipal: data.tipoRizoPrincipal || '',
    porosidad: data.porosidad || 'media',
    densidad: data.densidad || 'media',
    grosor: data.grosor || 'medio',
    elasticidad: data.elasticidad || 'media',
    balanceHP: data.balanceHP || '',
    tipoDano: data.tipoDano || [],
    estadoCueroCabelludo: data.estadoCueroCabelludo || [],
    estadoPuntas: data.estadoPuntas || '',
    problemas: data.problemas || [],
    lineaDemarcacion: data.lineaDemarcacion || '',
    embarazo: salud?.embarazo ?? false,
    nivelEstres: salud?.nivelEstres ?? '',
  };

  // Dimensiones extensibles (canas, alopecia, cuero cabelludo, químicos…)
  // entran al espacio de hechos con prefijo "ext." — así las reglas nuevas
  // pueden condicionar sobre ellas sin migrar el esquema.
  const ext = data.perfilExtendido;
  if (ext && typeof ext === 'object') {
    for (const [clave, valor] of Object.entries(ext)) {
      hechos[`ext.${clave}`] = valor;
    }
  }

  return hechos;
}

// ── Evaluación de condiciones ───────────────────────────────────────────────

function esVacio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function evaluarCondicion(cond: Condicion | null, hechos: Hechos): boolean {
  if (!cond) return true;
  if ('todas' in cond) return cond.todas.every((c) => evaluarCondicion(c, hechos));
  if ('alguna' in cond) return cond.alguna.some((c) => evaluarCondicion(c, hechos));
  if ('no' in cond) return !evaluarCondicion(cond.no, hechos);

  const v = hechos[cond.hecho];
  switch (cond.op) {
    case 'eq':
      return v === cond.valor;
    case 'neq':
      return v !== cond.valor;
    case 'en':
      return Array.isArray(cond.valor) && cond.valor.includes(v);
    case 'noEn':
      return Array.isArray(cond.valor) && !cond.valor.includes(v);
    case 'incluye':
      return Array.isArray(v) && v.includes(cond.valor);
    case 'noIncluye':
      return !(Array.isArray(v) && v.includes(cond.valor));
    case 'incluyeAlguno':
      return (
        Array.isArray(v) &&
        Array.isArray(cond.valor) &&
        (cond.valor as unknown[]).some((x) => v.includes(x))
      );
    case 'regex': {
      const re = new RegExp(String(cond.valor), 'i');
      if (Array.isArray(v)) return v.some((x) => re.test(String(x)));
      if (typeof v === 'string') return re.test(v);
      return false;
    }
    case 'vacio':
      return esVacio(v);
    case 'noVacio':
      return !esVacio(v);
    case 'verdadero':
      return v === true;
    case 'falso':
      return v !== true;
    default:
      return false;
  }
}

// ── Plantillas {{hecho}} en salidas de texto ────────────────────────────────

function interpolar(texto: string, hechos: Hechos): string {
  return texto.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, clave: string) =>
    String(hechos[clave] ?? '')
  );
}

// ── Utilidades de selección ─────────────────────────────────────────────────

function porSegmento(reglas: ReglaKB[], segmento: ReglaKB['segmento']): ReglaKB[] {
  return reglas
    .filter((r) => r.segmento === segmento)
    .sort((a, b) => a.prioridad - b.prioridad);
}

function primeraQueMatchea(reglas: ReglaKB[], hechos: Hechos): ReglaKB | undefined {
  return reglas.find((r) => evaluarCondicion(r.condiciones, hechos));
}

function todasLasQueMatchean(reglas: ReglaKB[], hechos: Hechos): ReglaKB[] {
  return reglas.filter((r) => evaluarCondicion(r.condiciones, hechos));
}

// Append con semántica de Set (dedupe conservando primera aparición) — igual
// que los Set<string> del motor legacy.
function pushUnico(destino: string[], textos: string[]): void {
  for (const t of textos) {
    if (!destino.includes(t)) destino.push(t);
  }
}

// ── Derivación médica ───────────────────────────────────────────────────────

export interface DerivacionMedica {
  motivo: string;
  recomendaciones: string[];
}

/** Devuelve la derivación médica si alguna regla con bandera médica matchea. */
export function detectarBanderaMedica(
  reglas: ReglaKB[],
  hechos: Hechos
): DerivacionMedica | null {
  const medicas = porSegmento(reglas, 'derivacion_medica').filter(
    (r) => r.esBanderaMedica
  );
  const activas = todasLasQueMatchean(medicas, hechos);
  if (activas.length === 0) return null;

  const motivos = activas.map((r) => (r.salida as SalidaDerivacionMedica).motivo);
  const recomendaciones: string[] = [];
  for (const r of activas) {
    pushUnico(recomendaciones, (r.salida as SalidaDerivacionMedica).recomendaciones);
  }
  return { motivo: motivos.join(' '), recomendaciones };
}

// Resultado de derivación construido EN CÓDIGO: aunque la knowledge base
// cambie, una bandera médica jamás produce cronograma ni plan de tratamiento.
function resultadoDerivacion(d: DerivacionMedica): ResultadoConsulta {
  const semana = 'Pendiente de valoración dermatológica';
  return {
    tratamientoPrincipal: 'Derivación a dermatólogo',
    tratamientosAdicionales: [],
    cronograma: { semana1: semana, semana2: semana, semana3: semana, semana4: semana },
    tecnicaDefinicion: '',
    tecnicaDescripcion: '',
    metodoSecado: '',
    productosPonto: [],
    recomendacionProductos: undefined,
    cuidadoCasa: { diaLavado: [], nocturno: [], refresh: [], evitar: [] },
    intervaloSugerido: 'Agendar control después de la valoración médica',
    notasAdicionales: [
      `⚠️ DERIVACIÓN MÉDICA: ${d.motivo}`,
      'Este perfil presenta señales clínicas que requieren valoración por dermatología antes de cualquier tratamiento cosmético.',
      ...d.recomendaciones,
    ],
  };
}

// ── Evaluador principal ─────────────────────────────────────────────────────

const PASOS_RUTINA: RutinaPasoClave[] = [
  'champu',
  'acondicionador',
  'mascarilla',
  'leavein',
  'definidor',
  'aceite',
];

const ATRIBUTOS_RUTINA: RutinaAtributo[] = ['producto', 'caracteristicas', 'frecuencia'];

export function evaluarDiagnostico(
  reglas: ReglaKB[],
  data: WizardData,
  salud?: SaludClienta
): ResultadoConsulta {
  const hechos = construirHechosBase(data, salud);

  // 1. Hechos derivados (en orden de prioridad). Un hecho ya definido con
  //    valor no vacío NO se sobreescribe — así la inferencia de balanceHP
  //    respeta el valor elegido por la estilista, igual que el motor legacy.
  for (const r of porSegmento(reglas, 'hecho')) {
    const salida = r.salida as SalidaHecho;
    const actual = hechos[salida.hecho];
    if (actual !== undefined && !esVacio(actual)) continue;
    if (evaluarCondicion(r.condiciones, hechos)) {
      hechos[salida.hecho] = salida.valor;
    }
  }
  // Hechos booleanos no definidos por ninguna regla quedan como false vía
  // el operador 'verdadero'/'falso' (undefined !== true).

  // 2. REGLA DE SEGURIDAD: bandera médica → derivación, nunca plan.
  const derivacion = detectarBanderaMedica(reglas, hechos);
  if (derivacion) return resultadoDerivacion(derivacion);

  // 3. Tratamiento principal (primera que matchea) — queda como hecho para
  //    que cronograma/intervalo/notas puedan condicionar sobre él.
  const reglaTrat = primeraQueMatchea(porSegmento(reglas, 'tratamiento_principal'), hechos);
  const tratamientoPrincipal = reglaTrat ? (reglaTrat.salida as SalidaTexto).texto : '';
  hechos['tratamientoPrincipal'] = tratamientoPrincipal;

  // 4. Tratamientos adicionales (todas, en orden).
  const tratamientosAdicionales = todasLasQueMatchean(
    porSegmento(reglas, 'tratamiento_adicional'),
    hechos
  ).map((r) => (r.salida as SalidaTexto).texto);

  // 5. Cronograma (primera).
  const reglaCrono = primeraQueMatchea(porSegmento(reglas, 'cronograma'), hechos);
  const cronograma: CronogramaResult = reglaCrono
    ? {
        semana1: (reglaCrono.salida as SalidaCronograma).semana1,
        semana2: (reglaCrono.salida as SalidaCronograma).semana2,
        semana3: (reglaCrono.salida as SalidaCronograma).semana3,
        semana4: (reglaCrono.salida as SalidaCronograma).semana4,
      }
    : { semana1: '', semana2: '', semana3: '', semana4: '' };

  // 6. Técnica de definición (primera).
  const reglaTec = primeraQueMatchea(porSegmento(reglas, 'tecnica'), hechos);
  const tec = reglaTec ? (reglaTec.salida as SalidaTecnica) : undefined;

  // 7. Productos resumen (todas).
  const productosPonto: string[] = [];
  for (const r of todasLasQueMatchean(porSegmento(reglas, 'producto_resumen'), hechos)) {
    productosPonto.push(...(r.salida as SalidaTextos).textos.map((t) => interpolar(t, hechos)));
  }

  // 8. Ingredientes (todas, dedupe como Set).
  const ingredientesBuscar: string[] = [];
  for (const r of todasLasQueMatchean(porSegmento(reglas, 'ingrediente_buscar'), hechos)) {
    pushUnico(ingredientesBuscar, (r.salida as SalidaTextos).textos);
  }
  const ingredientesEvitar: string[] = [];
  for (const r of todasLasQueMatchean(porSegmento(reglas, 'ingrediente_evitar'), hechos)) {
    pushUnico(ingredientesEvitar, (r.salida as SalidaTextos).textos);
  }

  // 9. Rutina de 6 pasos: primera que matchea por (paso, atributo).
  const reglasRutina = porSegmento(reglas, 'rutina');
  const rutina: RutinaPaso[] = PASOS_RUTINA.map((paso) => {
    const valores: Record<RutinaAtributo, string> = {
      producto: '',
      caracteristicas: '',
      frecuencia: '',
    };
    for (const atributo of ATRIBUTOS_RUTINA) {
      const candidatas = reglasRutina.filter((r) => {
        const s = r.salida as SalidaRutina;
        return s.paso === paso && s.atributo === atributo;
      });
      const ganadora = primeraQueMatchea(candidatas, hechos);
      if (ganadora) valores[atributo] = (ganadora.salida as SalidaRutina).valor;
    }
    return {
      producto: valores.producto,
      caracteristicas: valores.caracteristicas,
      frecuencia: valores.frecuencia,
    };
  });

  // 10. Config (disclaimer de productos).
  const reglaDisclaimer = primeraQueMatchea(
    porSegmento(reglas, 'config').filter(
      (r) => (r.salida as SalidaConfig).campo === 'disclaimerProductos'
    ),
    hechos
  );
  const disclaimer = reglaDisclaimer
    ? (reglaDisclaimer.salida as SalidaConfig).texto
    : '';

  // 11. Notas adicionales (todas, en orden de prioridad = orden legacy).
  const notasAdicionales: string[] = [];
  for (const r of todasLasQueMatchean(porSegmento(reglas, 'nota'), hechos)) {
    notasAdicionales.push(
      ...(r.salida as SalidaTextos).textos.map((t) => interpolar(t, hechos))
    );
  }

  // 12. Cuidado en casa (todas, append por campo).
  const cuidadoCasa: CuidadoCasaResult = { diaLavado: [], nocturno: [], refresh: [], evitar: [] };
  for (const r of todasLasQueMatchean(porSegmento(reglas, 'cuidado_casa'), hechos)) {
    const s = r.salida as SalidaCuidadoCasa;
    cuidadoCasa[s.campo].push(...s.textos.map((t) => interpolar(t, hechos)));
  }

  // 13. Intervalo de cita (primera).
  const reglaIntervalo = primeraQueMatchea(porSegmento(reglas, 'intervalo'), hechos);
  const intervaloSugerido = reglaIntervalo
    ? (reglaIntervalo.salida as SalidaTexto).texto
    : '';

  return {
    tratamientoPrincipal,
    tratamientosAdicionales,
    cronograma,
    tecnicaDefinicion: tec?.tecnicaDefinicion ?? '',
    tecnicaDescripcion: tec?.tecnicaDescripcion ?? '',
    metodoSecado: tec?.metodoSecado ?? '',
    productosPonto,
    recomendacionProductos: {
      ingredientesBuscar,
      ingredientesEvitar,
      rutina,
      disclaimer,
    },
    cuidadoCasa,
    intervaloSugerido,
    notasAdicionales,
  };
}
