// ══════════════════════════════════════════════════════════════════════════
// Seed canónico — reglas de diagnóstico para cabello rizado (1A–4C).
//
// Transcripción FIEL de lib/diagnosticEngine.ts a datos. Cada string es
// idéntico al del motor legacy; la prueba de regresión
// (tests/diagnostico.regresion.test.ts) garantiza que el evaluador con
// estas reglas produce EXACTAMENTE el mismo ResultadoConsulta.
//
// Este archivo es la fuente de verdad del seed: la migración SQL
// (supabase/migration-knowledge-base.sql) se genera desde aquí con
// scripts/generar-seed-kb-sql.mjs. Si editas una regla, regenera el SQL.
// ══════════════════════════════════════════════════════════════════════════

// import type: el seed se importa también desde Node (scripts/generar-seed-
// kb-sql.mjs) vía type-stripping — no debe tener imports de runtime.
import type { ReglaKB } from '../tipos';

const LISOS = ['1A', '1B', '1C'];
const ONDULADOS = ['2A', '2B', '2C'];
const RIZADOS = ['3A', '3B', '3C'];
const AFROS = ['4A', '4B', '4C'];

const DANO_QUIMICO = 'Daño químico (decoloración, alisado)';
const DANO_TERMICO = 'Daño térmico (textura alterada por calor)';
const DANO_TRANSICION = 'En transición capilar (dos texturas visibles)';
const PUNTAS_SEVERAS = 'Puntas abiertas severas (necesita corte)';
const CUERO_BUILDUP = 'Build-up (acumulación de producto)';
const CUERO_GRASO = 'Graso (exceso de sebo)';

export const DISCLAIMER_PRODUCTOS =
  'Estas recomendaciones son técnicas y aplican a productos de cualquier marca. Tu estilista puede sugerirte marcas específicas que cumplan con estas características según tu presupuesto y disponibilidad local.';

export const REGLAS_RIZADO: ReglaKB[] = [
  // ═══ HECHOS DERIVADOS ═════════════════════════════════════════════════
  // Inferencia de balanceHP cuando la estilista no lo especificó (el
  // evaluador no sobreescribe hechos con valor): elasticidad baja →
  // proteína; porosidad alta → hidratación; baja → nutrición; default
  // hidratación. Igual que el motor legacy.
  {
    clave: 'hecho.balance_hp.proteina',
    segmento: 'hecho',
    prioridad: 10,
    condiciones: { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
    salida: { hecho: 'balanceHP', valor: 'proteina' },
  },
  {
    clave: 'hecho.balance_hp.hidratacion_por_porosidad',
    segmento: 'hecho',
    prioridad: 11,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: { hecho: 'balanceHP', valor: 'hidratacion' },
  },
  {
    clave: 'hecho.balance_hp.nutricion_por_porosidad',
    segmento: 'hecho',
    prioridad: 12,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: { hecho: 'balanceHP', valor: 'nutricion' },
  },
  {
    clave: 'hecho.balance_hp.default',
    segmento: 'hecho',
    prioridad: 13,
    condiciones: null,
    salida: { hecho: 'balanceHP', valor: 'hidratacion' },
  },
  {
    clave: 'hecho.transicion',
    segmento: 'hecho',
    prioridad: 20,
    condiciones: { hecho: 'tipoDano', op: 'incluye', valor: DANO_TRANSICION },
    salida: { hecho: 'transicion', valor: true },
  },
  {
    clave: 'hecho.dano_quimico',
    segmento: 'hecho',
    prioridad: 21,
    condiciones: { hecho: 'tipoDano', op: 'incluye', valor: DANO_QUIMICO },
    salida: { hecho: 'danoQuimico', valor: true },
  },
  {
    clave: 'hecho.dano_termico',
    segmento: 'hecho',
    prioridad: 22,
    condiciones: { hecho: 'tipoDano', op: 'incluye', valor: DANO_TERMICO },
    salida: { hecho: 'danoTermico', valor: true },
  },
  {
    clave: 'hecho.build_up',
    segmento: 'hecho',
    prioridad: 23,
    condiciones: {
      hecho: 'estadoCueroCabelludo',
      op: 'incluyeAlguno',
      valor: [CUERO_BUILDUP, CUERO_GRASO],
    },
    salida: { hecho: 'buildUp', valor: true },
  },
  {
    clave: 'hecho.puntas_severas',
    segmento: 'hecho',
    prioridad: 24,
    condiciones: { hecho: 'estadoPuntas', op: 'eq', valor: PUNTAS_SEVERAS },
    salida: { hecho: 'puntasSeveras', valor: true },
  },
  {
    clave: 'hecho.dano_severo',
    segmento: 'hecho',
    prioridad: 25,
    condiciones: {
      alguna: [
        { hecho: 'puntasSeveras', op: 'verdadero' },
        {
          todas: [
            { hecho: 'danoQuimico', op: 'verdadero' },
            { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
          ],
        },
      ],
    },
    salida: { hecho: 'danoSevero', valor: true },
  },
  {
    clave: 'hecho.trat_reconstructor',
    segmento: 'hecho',
    prioridad: 26,
    condiciones: {
      alguna: [
        { hecho: 'balanceHP', op: 'eq', valor: 'proteina' },
        { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
        { hecho: 'danoQuimico', op: 'verdadero' },
        { hecho: 'danoTermico', op: 'verdadero' },
      ],
    },
    salida: { hecho: 'tratReconstructor', valor: true },
  },
  {
    clave: 'hecho.tiene_caspa',
    segmento: 'hecho',
    prioridad: 27,
    condiciones: {
      hecho: 'estadoCueroCabelludo',
      op: 'incluyeAlguno',
      valor: ['Caspa seca', 'Dermatitis seborreica'],
    },
    salida: { hecho: 'tieneCaspa', valor: true },
  },
  {
    clave: 'hecho.tiene_caida',
    segmento: 'hecho',
    prioridad: 28,
    condiciones: { hecho: 'problemas', op: 'incluye', valor: 'Caída excesiva' },
    salida: { hecho: 'tieneCaida', valor: true },
  },
  {
    clave: 'hecho.tiene_frizz',
    segmento: 'hecho',
    prioridad: 29,
    condiciones: { hecho: 'problemas', op: 'regex', valor: 'frizz' },
    salida: { hecho: 'tieneFrizz', valor: true },
  },
  {
    clave: 'hecho.cuero_graso',
    segmento: 'hecho',
    prioridad: 30,
    condiciones: {
      hecho: 'estadoCueroCabelludo',
      op: 'incluyeAlguno',
      valor: [CUERO_GRASO, CUERO_BUILDUP],
    },
    salida: { hecho: 'cueroGraso', valor: true },
  },
  {
    clave: 'hecho.cuero_seco',
    segmento: 'hecho',
    prioridad: 31,
    condiciones: { hecho: 'estadoCueroCabelludo', op: 'regex', valor: 'seco|caspa' },
    salida: { hecho: 'cueroSeco', valor: true },
  },
  {
    clave: 'hecho.es_liso',
    segmento: 'hecho',
    prioridad: 32,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: LISOS },
    salida: { hecho: 'esLiso', valor: true },
  },
  {
    clave: 'hecho.es_ondulado',
    segmento: 'hecho',
    prioridad: 33,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ONDULADOS },
    salida: { hecho: 'esOndulado', valor: true },
  },
  {
    clave: 'hecho.es_rizado',
    segmento: 'hecho',
    prioridad: 34,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: RIZADOS },
    salida: { hecho: 'esRizado', valor: true },
  },
  {
    clave: 'hecho.es_afro',
    segmento: 'hecho',
    prioridad: 35,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: AFROS },
    salida: { hecho: 'esAfro', valor: true },
  },
  {
    clave: 'hecho.hay_dano',
    segmento: 'hecho',
    prioridad: 36,
    condiciones: {
      alguna: [
        { hecho: 'tipoDano', op: 'noVacio' },
        { hecho: 'balanceHP', op: 'eq', valor: 'proteina' },
      ],
    },
    salida: { hecho: 'hayDano', valor: true },
  },

  // ═══ DERIVACIÓN MÉDICA (bandera de seguridad) ═════════════════════════
  // Condicionan SOLO sobre dimensiones extensibles (ext.*) que el wizard de
  // rizos actual nunca llena → cero impacto en producción hoy. Cuando un
  // flujo publicado recoja estas señales, el evaluador deriva SIEMPRE.
  {
    clave: 'derivacion.alopecia',
    segmento: 'derivacion_medica',
    prioridad: 10,
    esBanderaMedica: true,
    condiciones: {
      hecho: 'ext.senalesAlopecia',
      op: 'incluyeAlguno',
      valor: ['placas_sin_cabello', 'perdida_difusa_severa', 'retroceso_linea_frontal'],
    },
    salida: {
      motivo: 'Señales clínicas compatibles con alopecia.',
      recomendaciones: [
        'Derivar a dermatología para diagnóstico (tricoscopia / exámenes).',
        'No aplicar tratamientos químicos ni térmicos hasta tener valoración médica.',
        'Documentar con fotos la zona afectada para el seguimiento.',
      ],
    },
  },
  {
    clave: 'derivacion.dermatitis_severa',
    segmento: 'derivacion_medica',
    prioridad: 11,
    esBanderaMedica: true,
    condiciones: {
      hecho: 'ext.tipoCueroCabelludo',
      op: 'en',
      valor: ['dermatitis_severa', 'psoriasis_sospecha', 'lesiones_abiertas'],
    },
    salida: {
      motivo: 'Cuero cabelludo con señales de dermatitis severa o lesiones.',
      recomendaciones: [
        'Derivar a dermatología antes de cualquier servicio de salón.',
        'Evitar productos con fragancia, alcohol o químicos agresivos en la zona.',
      ],
    },
  },

  // ═══ TRATAMIENTO PRINCIPAL (primera que matchea) ══════════════════════
  {
    clave: 'tratamiento.reconstruccion',
    segmento: 'tratamiento_principal',
    prioridad: 10,
    condiciones: {
      alguna: [
        { hecho: 'balanceHP', op: 'eq', valor: 'proteina' },
        { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
      ],
    },
    salida: { texto: 'Reconstrucción' },
  },
  {
    clave: 'tratamiento.hidratacion_profunda',
    segmento: 'tratamiento_principal',
    prioridad: 20,
    condiciones: {
      todas: [
        { hecho: 'balanceHP', op: 'eq', valor: 'hidratacion' },
        { hecho: 'porosidad', op: 'neq', valor: 'alta' },
      ],
    },
    salida: { texto: 'Hidratación profunda' },
  },
  {
    clave: 'tratamiento.hidratacion_nutricion',
    segmento: 'tratamiento_principal',
    prioridad: 30,
    condiciones: {
      todas: [
        { hecho: 'balanceHP', op: 'eq', valor: 'hidratacion' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: { texto: 'Hidratación + Nutrición (sellado)' },
  },
  {
    clave: 'tratamiento.nutricion',
    segmento: 'tratamiento_principal',
    prioridad: 40,
    condiciones: { hecho: 'balanceHP', op: 'eq', valor: 'nutricion' },
    salida: { texto: 'Nutrición' },
  },
  {
    clave: 'tratamiento.mantenimiento',
    segmento: 'tratamiento_principal',
    prioridad: 50,
    condiciones: { hecho: 'balanceHP', op: 'eq', valor: 'equilibrado' },
    salida: { texto: 'Mantenimiento' },
  },
  {
    clave: 'tratamiento.default',
    segmento: 'tratamiento_principal',
    prioridad: 60,
    condiciones: null,
    salida: { texto: 'Hidratación + Mantenimiento' },
  },

  // ═══ TRATAMIENTOS ADICIONALES (todas) ═════════════════════════════════
  {
    clave: 'adicional.repolarizacion',
    segmento: 'tratamiento_adicional',
    prioridad: 10,
    condiciones: {
      alguna: [
        { hecho: 'danoQuimico', op: 'verdadero' },
        { hecho: 'danoTermico', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Repolarización capilar' },
  },
  {
    clave: 'adicional.detox',
    segmento: 'tratamiento_adicional',
    prioridad: 20,
    condiciones: { hecho: 'buildUp', op: 'verdadero' },
    salida: { texto: 'Detox / Clarificación (paso previo al tratamiento)' },
  },
  {
    clave: 'adicional.transicion',
    segmento: 'tratamiento_adicional',
    prioridad: 30,
    condiciones: { hecho: 'transicion', op: 'verdadero' },
    salida: { texto: 'Tratamiento diferenciado zona natural / zona procesada' },
  },

  // ═══ CRONOGRAMA 4 SEMANAS (primera) ═══════════════════════════════════
  {
    clave: 'cronograma.reconstruccion_severa',
    segmento: 'cronograma',
    prioridad: 10,
    condiciones: {
      todas: [
        { hecho: 'tratamientoPrincipal', op: 'eq', valor: 'Reconstrucción' },
        { hecho: 'danoSevero', op: 'verdadero' },
      ],
    },
    salida: {
      semana1: 'Reconstrucción',
      semana2: 'Hidratación',
      semana3: 'Nutrición',
      semana4: 'Reconstrucción',
    },
  },
  {
    clave: 'cronograma.reconstruccion',
    segmento: 'cronograma',
    prioridad: 20,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'eq', valor: 'Reconstrucción' },
    salida: {
      semana1: 'Reconstrucción',
      semana2: 'Hidratación',
      semana3: 'Nutrición',
      semana4: 'Hidratación',
    },
  },
  {
    clave: 'cronograma.hidratacion_profunda',
    segmento: 'cronograma',
    prioridad: 30,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'eq', valor: 'Hidratación profunda' },
    salida: {
      semana1: 'Hidratación',
      semana2: 'Hidratación',
      semana3: 'Nutrición',
      semana4: 'Hidratación',
    },
  },
  {
    clave: 'cronograma.hidratacion_nutricion',
    segmento: 'cronograma',
    prioridad: 40,
    condiciones: {
      hecho: 'tratamientoPrincipal',
      op: 'eq',
      valor: 'Hidratación + Nutrición (sellado)',
    },
    salida: {
      semana1: 'Hidratación',
      semana2: 'Nutrición',
      semana3: 'Hidratación',
      semana4: 'Nutrición',
    },
  },
  {
    clave: 'cronograma.nutricion',
    segmento: 'cronograma',
    prioridad: 50,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'eq', valor: 'Nutrición' },
    salida: {
      semana1: 'Nutrición',
      semana2: 'Hidratación',
      semana3: 'Nutrición',
      semana4: 'Hidratación',
    },
  },
  {
    clave: 'cronograma.default',
    segmento: 'cronograma',
    prioridad: 60,
    condiciones: null,
    salida: {
      semana1: 'Hidratación',
      semana2: 'Nutrición',
      semana3: 'Hidratación',
      semana4: 'Nutrición',
    },
  },

  // ═══ TÉCNICA DE DEFINICIÓN (primera) ══════════════════════════════════
  {
    clave: 'tecnica.liso_1c',
    segmento: 'tecnica',
    prioridad: 10,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '1C' },
    salida: {
      tecnicaDefinicion: 'Secado natural',
      tecnicaDescripcion:
        'Lava con shampoo suave y acondicionador. Aplica leave-in en cabello húmedo y peina de puntas a raíz con peine de dientes anchos. Haz scrunch suave en las puntas para potenciar la ondulación sutil. Deja secar sin tocar para evitar frizz. Si usas calor, aplica protector térmico antes.',
      metodoSecado: 'Secado natural o difusor en frío',
      gelRecomendado: '',
    },
  },
  {
    clave: 'tecnica.liso_1a_1b',
    segmento: 'tecnica',
    prioridad: 20,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['1A', '1B'] },
    salida: {
      tecnicaDefinicion: 'Secado natural',
      tecnicaDescripcion:
        'Lava con shampoo suave y acondicionador hidratante. Aplica leave-in en cabello húmedo y peina con peine de dientes anchos. Deja secar sin tocar para máximo brillo y sin frizz. Evita frotar con la toalla — usa microinfibra o camiseta de algodón.',
      metodoSecado: 'Secado natural o difusor en frío',
      gelRecomendado: '',
    },
  },
  {
    clave: 'tecnica.ondulado_2a_2b',
    segmento: 'tecnica',
    prioridad: 30,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['2A', '2B'] },
    salida: {
      tecnicaDefinicion: 'Scrunch',
      tecnicaDescripcion:
        'Aplica crema de peinar en el cabello húmedo. Distribuye con rake (peine de dientes anchos) de puntas a raíz. Luego haz scrunch (aprieta el cabello de abajo hacia arriba) para reforzar las ondas. Deja secar sin tocar.',
      metodoSecado: 'Difusor en calor bajo o secado al aire libre',
      gelRecomendado: 'Gel definidor liviano',
    },
  },
  {
    clave: 'tecnica.ondulado_2c_3a',
    segmento: 'tecnica',
    prioridad: 40,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['2C', '3A'] },
    salida: {
      tecnicaDefinicion: 'Rake & Shake + Scrunch',
      tecnicaDescripcion:
        'Aplica crema de peinar sección por sección. Pasa el peine de dientes anchos (rake) de medios a puntas para separar rizos. Agita las puntas suavemente (shake) para activar el patrón. Finaliza con scrunch para compactar el gel.',
      metodoSecado: 'Difusor en calor medio',
      gelRecomendado: 'Gel definidor o crema de peinar',
    },
  },
  {
    clave: 'tecnica.rizado_3b_3c_fino',
    segmento: 'tecnica',
    prioridad: 50,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['3B', '3C'] },
        { hecho: 'grosor', op: 'eq', valor: 'fino' },
      ],
    },
    salida: {
      tecnicaDefinicion: 'Shingling suave',
      tecnicaDescripcion:
        'Divide el cabello en secciones pequeñas. Aplica crema de peinar rizo por rizo, deslizando los dedos desde la raíz hasta las puntas. Evita productos muy pesados que aplanen el volumen.',
      metodoSecado: 'Difusor en calor bajo',
      gelRecomendado: 'Crema de peinar + gel definidor',
    },
  },
  {
    clave: 'tecnica.rizado_3b_3c',
    segmento: 'tecnica',
    prioridad: 60,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['3B', '3C'] },
    salida: {
      tecnicaDefinicion: 'Praying Hands + Scrunch',
      tecnicaDescripcion:
        'Frota la crema de peinar entre las palmas y aplica deslizando ambas manos hacia abajo por cada sección (como si rezaras con el cabello dentro). Luego haz scrunch para compactar el rizo. Aplica gel encima con scrunch final.',
      metodoSecado: 'Difusor en calor bajo-medio',
      gelRecomendado: 'Crema de peinar + gel definidor',
    },
  },
  {
    clave: 'tecnica.afro_4a',
    segmento: 'tecnica',
    prioridad: 70,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '4A' },
    salida: {
      tecnicaDefinicion: 'Shingling',
      tecnicaDescripcion:
        'Divide el cabello en secciones pequeñas. Aplica gel cremoso afro rizo por rizo, deslizando los dedos desde raíz hasta punta para definir cada espiral. Trabaja con el cabello muy húmedo para mejor agarre.',
      metodoSecado: 'Difusor en calor bajo o secado al aire libre',
      gelRecomendado: 'Gel cremoso afro + crema de peinar',
    },
  },
  {
    clave: 'tecnica.afro_4b_densidad_alta',
    segmento: 'tecnica',
    prioridad: 80,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '4B' },
        { hecho: 'densidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      tecnicaDefinicion: 'Twist Out',
      tecnicaDescripcion:
        'Divide en secciones. Aplica gel cremoso y forma twist (trenzas de 2 hilos) en cada sección. Deja secar completamente antes de soltar. Para día 2-3: twist-out para revivir la definición.',
      metodoSecado: 'Secado al aire libre preferible (el calor puede dañar la estructura)',
      gelRecomendado: 'Gel cremoso afro',
    },
  },
  {
    clave: 'tecnica.afro_4b',
    segmento: 'tecnica',
    prioridad: 81,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '4B' },
    salida: {
      tecnicaDefinicion: 'Finger Coils o Shingling',
      tecnicaDescripcion:
        'Divide en secciones. Aplica gel cremoso y forma twist (trenzas de 2 hilos) en cada sección. Deja secar completamente antes de soltar. Para día 2-3: twist-out para revivir la definición.',
      metodoSecado: 'Secado al aire libre preferible (el calor puede dañar la estructura)',
      gelRecomendado: 'Gel cremoso afro',
    },
  },
  {
    clave: 'tecnica.afro_4c_densidad_alta',
    segmento: 'tecnica',
    prioridad: 82,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '4C' },
        { hecho: 'densidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      tecnicaDefinicion: 'Twist Out',
      tecnicaDescripcion:
        'Divide en secciones muy pequeñas. Envuelve cada sección alrededor de tu dedo con gel cremoso para crear una espiral. Deja secar sin tocar. Es laborioso pero da la máxima definición al tipo 4C.',
      metodoSecado: 'Secado al aire libre preferible (el calor puede dañar la estructura)',
      gelRecomendado: 'Gel cremoso afro',
    },
  },
  {
    clave: 'tecnica.afro_4c',
    segmento: 'tecnica',
    prioridad: 83,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '4C' },
    salida: {
      tecnicaDefinicion: 'Finger Coils o Shingling',
      tecnicaDescripcion:
        'Divide en secciones muy pequeñas. Envuelve cada sección alrededor de tu dedo con gel cremoso para crear una espiral. Deja secar sin tocar. Es laborioso pero da la máxima definición al tipo 4C.',
      metodoSecado: 'Secado al aire libre preferible (el calor puede dañar la estructura)',
      gelRecomendado: 'Gel cremoso afro',
    },
  },
  {
    clave: 'tecnica.default',
    segmento: 'tecnica',
    prioridad: 90,
    condiciones: null,
    salida: {
      tecnicaDefinicion: 'Rake & Shake + Scrunch',
      tecnicaDescripcion:
        'Aplica crema de peinar sección por sección con peine de dientes anchos. Agita puntas y compacta con scrunch.',
      metodoSecado: 'Difusor en calor bajo o aire libre',
      gelRecomendado: 'Gel definidor',
    },
  },

  // ═══ PRODUCTOS RESUMEN — productosPonto (todas) ═══════════════════════
  {
    clave: 'producto.mascarilla_reconstructora',
    segmento: 'producto_resumen',
    prioridad: 10,
    condiciones: { hecho: 'tratReconstructor', op: 'verdadero' },
    salida: {
      textos: ['Mascarilla reconstructora con queratina hidrolizada (base del cronograma)'],
    },
  },
  {
    clave: 'producto.mascarilla_alternada',
    segmento: 'producto_resumen',
    prioridad: 11,
    condiciones: { hecho: 'tratReconstructor', op: 'falso' },
    salida: { textos: ['Mascarilla hidratante / nutritiva alternada según cronograma'] },
  },
  {
    clave: 'producto.liso',
    segmento: 'producto_resumen',
    prioridad: 20,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: LISOS },
    salida: { textos: ['Leave-in ligero (aplicar de medios a puntas, evitar raíz)'] },
  },
  {
    clave: 'producto.liso_porosidad_alta',
    segmento: 'producto_resumen',
    prioridad: 21,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'en', valor: LISOS },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: { textos: ['Aceite ligero (jojoba o almendras) en puntas para sellar'] },
  },
  {
    clave: 'producto.ondulado_3a',
    segmento: 'producto_resumen',
    prioridad: 30,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['2A', '2B', '2C', '3A'] },
    salida: {
      textos: [
        'Crema de peinar de textura media (sin sulfatos ni parabenos)',
        'Gel definidor ligero con proteínas de trigo o seda (sin alcohol)',
      ],
    },
  },
  {
    clave: 'producto.ondulado_3a_porosidad_alta',
    segmento: 'producto_resumen',
    prioridad: 31,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['2A', '2B', '2C', '3A'] },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: { textos: ['Aceite medio (argán o jojoba) como sellador final'] },
  },
  {
    clave: 'producto.rizado_3b_3c',
    segmento: 'producto_resumen',
    prioridad: 40,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['3B', '3C'] },
    salida: {
      textos: [
        'Crema de peinar nutritiva e hidratante con humectantes (glicerina, aloe vera)',
        'Gel definidor con proteínas vegetales, sin alcohol secante',
      ],
    },
  },
  {
    clave: 'producto.rizado_3b_3c_porosidad_alta',
    segmento: 'producto_resumen',
    prioridad: 41,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['3B', '3C'] },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: { textos: ['Aceite sellador (argán, jojoba o coco según porosidad)'] },
  },
  {
    // En el motor legacy el else captura 4A-4C Y cualquier tipo no
    // reconocido (incluido vacío en modo express) — se replica con noEn.
    clave: 'producto.afro_default',
    segmento: 'producto_resumen',
    prioridad: 50,
    condiciones: {
      hecho: 'tipoRizoPrincipal',
      op: 'noEn',
      valor: [...LISOS, ...ONDULADOS, '3A', '3B', '3C'],
    },
    salida: {
      textos: [
        'Gel cremoso denso para máxima definición (con humectantes y proteínas vegetales)',
        'Crema de peinar de alta densidad con mantecas (karité, cacao)',
        'Aceite sellador pesado (ricino, coco u oliva) — método LOC/LCO obligatorio',
      ],
    },
  },

  // ═══ INGREDIENTES A EVITAR (todas, dedupe) ════════════════════════════
  {
    clave: 'evitar.base',
    segmento: 'ingrediente_evitar',
    prioridad: 10,
    condiciones: null,
    salida: {
      textos: [
        'Sulfatos agresivos (SLS, SLES)',
        'Parabenos fuertes',
        'Alcoholes secantes (alcohol denat., isopropílico)',
        'Siliconas no solubles en agua',
      ],
    },
  },
  {
    clave: 'evitar.liso',
    segmento: 'ingrediente_evitar',
    prioridad: 20,
    condiciones: { hecho: 'esLiso', op: 'verdadero' },
    salida: {
      textos: [
        'Mantecas densas en raíz (apelmazan el cabello liso)',
        'Cremas de peinar muy pesadas',
      ],
    },
  },
  {
    clave: 'evitar.ondulado',
    segmento: 'ingrediente_evitar',
    prioridad: 21,
    condiciones: { hecho: 'esOndulado', op: 'verdadero' },
    salida: { textos: ['Productos muy densos que aplasten la onda'] },
  },
  {
    clave: 'evitar.porosidad_alta',
    segmento: 'ingrediente_evitar',
    prioridad: 30,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: {
      textos: [
        'Humectantes puros en climas húmedos (provocan frizz)',
        'Calor directo sin protector térmico',
      ],
    },
  },
  {
    clave: 'evitar.porosidad_baja',
    segmento: 'ingrediente_evitar',
    prioridad: 31,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: {
      textos: [
        'Proteínas en exceso (rigidez y quiebre)',
        'Aceites pesados (coco, ricino) — no penetran, se acumulan',
      ],
    },
  },
  {
    clave: 'evitar.embarazo',
    segmento: 'ingrediente_evitar',
    prioridad: 40,
    condiciones: { hecho: 'embarazo', op: 'verdadero' },
    salida: {
      textos: [
        'Formol y derivados (alisados progresivos, keratina con formol)',
        'Fragancias sintéticas intensas',
      ],
    },
  },

  // ═══ INGREDIENTES A BUSCAR (todas, dedupe) ════════════════════════════
  {
    clave: 'buscar.liso',
    segmento: 'ingrediente_buscar',
    prioridad: 10,
    condiciones: { hecho: 'esLiso', op: 'verdadero' },
    salida: {
      textos: [
        'Humectantes ligeros (glicerina, aloe vera, panthenol)',
        'Aceites ligeros (jojoba, almendras) en poca cantidad, solo puntas',
        'Mascarillas hidratantes ligeras',
      ],
    },
  },
  {
    clave: 'buscar.ondulado',
    segmento: 'ingrediente_buscar',
    prioridad: 11,
    condiciones: { hecho: 'esOndulado', op: 'verdadero' },
    salida: {
      textos: [
        'Cremas de peinar de textura media',
        'Humectantes (glicerina, aloe vera, miel)',
        'Geles definidores ligeros (activan la onda sin cast pesado)',
      ],
    },
  },
  {
    clave: 'buscar.rizado',
    segmento: 'ingrediente_buscar',
    prioridad: 12,
    condiciones: { hecho: 'esRizado', op: 'verdadero' },
    salida: {
      textos: [
        'Cremas de peinar nutritivas e hidratantes',
        'Geles definidores con proteínas de trigo o seda',
        'Aceites medios (argán, jojoba)',
        'Mantecas medias (cacao, mango)',
      ],
    },
  },
  {
    clave: 'buscar.afro',
    segmento: 'ingrediente_buscar',
    prioridad: 13,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: {
      textos: [
        'Cremas de peinar densas y nutritivas',
        'Mantecas densas (karité, cacao, mango)',
        'Aceites pesados (ricino, coco, oliva) para sellado',
        'Geles cremosos para máxima definición',
        'Mascarillas con proteínas vegetales (trigo, soja)',
        'Método LOC o LCO (leave-in + aceite + crema)',
      ],
    },
  },
  {
    clave: 'buscar.porosidad_alta',
    segmento: 'ingrediente_buscar',
    prioridad: 20,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: {
      textos: [
        'Ingredientes selladores (mantecas y aceites pesados)',
        'Productos con pH ácido (ayudan a cerrar la cutícula)',
      ],
    },
  },
  {
    clave: 'buscar.porosidad_baja',
    segmento: 'ingrediente_buscar',
    prioridad: 21,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: { textos: ['Productos ligeros a base de agua'] },
  },
  {
    clave: 'buscar.dano',
    segmento: 'ingrediente_buscar',
    prioridad: 30,
    condiciones: { hecho: 'hayDano', op: 'verdadero' },
    salida: {
      textos: [
        'Proteínas hidrolizadas (queratina, seda, trigo)',
        'Tratamientos reconstructores con aminoácidos',
      ],
    },
  },
  {
    clave: 'buscar.frizz',
    segmento: 'ingrediente_buscar',
    prioridad: 40,
    condiciones: { hecho: 'tieneFrizz', op: 'verdadero' },
    salida: { textos: ['Combinación de humectantes + selladores (método LOC/LCO)'] },
  },
  {
    clave: 'buscar.cuero_graso',
    segmento: 'ingrediente_buscar',
    prioridad: 50,
    condiciones: { hecho: 'cueroGraso', op: 'verdadero' },
    salida: { textos: ['Champús con árbol de té, menta o salvia (equilibran el sebo)'] },
  },
  {
    clave: 'buscar.cuero_seco',
    segmento: 'ingrediente_buscar',
    prioridad: 51,
    condiciones: { hecho: 'cueroSeco', op: 'verdadero' },
    salida: { textos: ['Champús suaves sin sulfatos y masajes con aceites ligeros'] },
  },

  // ═══ RUTINA DE 6 PASOS (primera por paso+atributo) ════════════════════
  // Champú
  {
    clave: 'rutina.champu.producto',
    segmento: 'rutina',
    prioridad: 10,
    condiciones: null,
    salida: { paso: 'champu', atributo: 'producto', valor: 'Champú' },
  },
  {
    clave: 'rutina.champu.caract.graso',
    segmento: 'rutina',
    prioridad: 11,
    condiciones: { hecho: 'cueroGraso', op: 'verdadero' },
    salida: {
      paso: 'champu',
      atributo: 'caracteristicas',
      valor: 'sin sulfatos agresivos, con árbol de té o menta',
    },
  },
  {
    clave: 'rutina.champu.caract.seco',
    segmento: 'rutina',
    prioridad: 12,
    condiciones: { hecho: 'cueroSeco', op: 'verdadero' },
    salida: {
      paso: 'champu',
      atributo: 'caracteristicas',
      valor: 'suave sin sulfatos, hidratante',
    },
  },
  {
    clave: 'rutina.champu.caract.default',
    segmento: 'rutina',
    prioridad: 13,
    condiciones: null,
    salida: {
      paso: 'champu',
      atributo: 'caracteristicas',
      valor: 'sin sulfatos agresivos, con tensoactivos suaves',
    },
  },
  {
    clave: 'rutina.champu.frec.liso',
    segmento: 'rutina',
    prioridad: 14,
    condiciones: { hecho: 'esLiso', op: 'verdadero' },
    salida: { paso: 'champu', atributo: 'frecuencia', valor: '2-3 veces por semana' },
  },
  {
    clave: 'rutina.champu.frec.ondulado',
    segmento: 'rutina',
    prioridad: 15,
    condiciones: { hecho: 'esOndulado', op: 'verdadero' },
    salida: { paso: 'champu', atributo: 'frecuencia', valor: '2 veces por semana' },
  },
  {
    clave: 'rutina.champu.frec.rizado',
    segmento: 'rutina',
    prioridad: 16,
    condiciones: { hecho: 'esRizado', op: 'verdadero' },
    salida: { paso: 'champu', atributo: 'frecuencia', valor: '1-2 veces por semana' },
  },
  {
    clave: 'rutina.champu.frec.default',
    segmento: 'rutina',
    prioridad: 17,
    condiciones: null,
    salida: { paso: 'champu', atributo: 'frecuencia', valor: '1 vez por semana' },
  },
  // Acondicionador
  {
    clave: 'rutina.acond.producto',
    segmento: 'rutina',
    prioridad: 20,
    condiciones: null,
    salida: { paso: 'acondicionador', atributo: 'producto', valor: 'Acondicionador' },
  },
  {
    clave: 'rutina.acond.caract.denso',
    segmento: 'rutina',
    prioridad: 21,
    condiciones: {
      alguna: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'esRizado', op: 'verdadero' },
      ],
    },
    salida: {
      paso: 'acondicionador',
      atributo: 'caracteristicas',
      valor: 'nutritivo e hidratante con humectantes y mantecas',
    },
  },
  {
    clave: 'rutina.acond.caract.ondulado',
    segmento: 'rutina',
    prioridad: 22,
    condiciones: { hecho: 'esOndulado', op: 'verdadero' },
    salida: {
      paso: 'acondicionador',
      atributo: 'caracteristicas',
      valor: 'ligero con humectantes (glicerina, aloe vera)',
    },
  },
  {
    clave: 'rutina.acond.caract.default',
    segmento: 'rutina',
    prioridad: 23,
    condiciones: null,
    salida: {
      paso: 'acondicionador',
      atributo: 'caracteristicas',
      valor: 'muy ligero, sin siliconas pesadas',
    },
  },
  {
    clave: 'rutina.acond.frec',
    segmento: 'rutina',
    prioridad: 24,
    condiciones: null,
    salida: { paso: 'acondicionador', atributo: 'frecuencia', valor: 'cada lavado' },
  },
  // Mascarilla
  {
    clave: 'rutina.mascarilla.producto',
    segmento: 'rutina',
    prioridad: 30,
    condiciones: null,
    salida: { paso: 'mascarilla', atributo: 'producto', valor: 'Mascarilla' },
  },
  {
    clave: 'rutina.mascarilla.caract.dano',
    segmento: 'rutina',
    prioridad: 31,
    condiciones: { hecho: 'hayDano', op: 'verdadero' },
    salida: {
      paso: 'mascarilla',
      atributo: 'caracteristicas',
      valor: 'reconstructora con queratina hidrolizada y aminoácidos',
    },
  },
  {
    clave: 'rutina.mascarilla.caract.hidratacion',
    segmento: 'rutina',
    prioridad: 32,
    condiciones: { hecho: 'balanceHP', op: 'eq', valor: 'hidratacion' },
    salida: {
      paso: 'mascarilla',
      atributo: 'caracteristicas',
      valor: 'hidratante con humectantes (glicerina, aloe vera, miel)',
    },
  },
  {
    clave: 'rutina.mascarilla.caract.nutricion',
    segmento: 'rutina',
    prioridad: 33,
    condiciones: { hecho: 'balanceHP', op: 'eq', valor: 'nutricion' },
    salida: {
      paso: 'mascarilla',
      atributo: 'caracteristicas',
      valor: 'nutritiva con mantecas y aceites vegetales',
    },
  },
  {
    clave: 'rutina.mascarilla.caract.default',
    segmento: 'rutina',
    prioridad: 34,
    condiciones: null,
    salida: {
      paso: 'mascarilla',
      atributo: 'caracteristicas',
      valor: 'alternar hidratante y nutritiva según cronograma',
    },
  },
  {
    clave: 'rutina.mascarilla.frec',
    segmento: 'rutina',
    prioridad: 35,
    condiciones: null,
    salida: { paso: 'mascarilla', atributo: 'frecuencia', valor: '1 vez por semana' },
  },
  // Leave-in
  {
    clave: 'rutina.leavein.producto',
    segmento: 'rutina',
    prioridad: 40,
    condiciones: null,
    salida: { paso: 'leavein', atributo: 'producto', valor: 'Leave-in' },
  },
  {
    clave: 'rutina.leavein.caract.liso',
    segmento: 'rutina',
    prioridad: 41,
    condiciones: { hecho: 'esLiso', op: 'verdadero' },
    salida: {
      paso: 'leavein',
      atributo: 'caracteristicas',
      valor: 'ligero en spray, aplicar solo en medios y puntas',
    },
  },
  {
    clave: 'rutina.leavein.caract.afro',
    segmento: 'rutina',
    prioridad: 42,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: {
      paso: 'leavein',
      atributo: 'caracteristicas',
      valor: 'cremoso denso, aplicar de raíz a puntas',
    },
  },
  {
    clave: 'rutina.leavein.caract.rizado',
    segmento: 'rutina',
    prioridad: 43,
    condiciones: { hecho: 'esRizado', op: 'verdadero' },
    salida: {
      paso: 'leavein',
      atributo: 'caracteristicas',
      valor: 'cremoso de textura media',
    },
  },
  {
    clave: 'rutina.leavein.caract.default',
    segmento: 'rutina',
    prioridad: 44,
    condiciones: null,
    salida: { paso: 'leavein', atributo: 'caracteristicas', valor: 'cremoso ligero' },
  },
  {
    clave: 'rutina.leavein.frec',
    segmento: 'rutina',
    prioridad: 45,
    condiciones: null,
    salida: { paso: 'leavein', atributo: 'frecuencia', valor: 'cada lavado' },
  },
  // Definidor
  {
    clave: 'rutina.definidor.producto.afro',
    segmento: 'rutina',
    prioridad: 50,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: { paso: 'definidor', atributo: 'producto', valor: 'Gel cremoso afro' },
  },
  {
    clave: 'rutina.definidor.producto.rizado',
    segmento: 'rutina',
    prioridad: 51,
    condiciones: { hecho: 'esRizado', op: 'verdadero' },
    salida: { paso: 'definidor', atributo: 'producto', valor: 'Gel definidor' },
  },
  {
    clave: 'rutina.definidor.producto.ondulado',
    segmento: 'rutina',
    prioridad: 52,
    condiciones: { hecho: 'esOndulado', op: 'verdadero' },
    salida: { paso: 'definidor', atributo: 'producto', valor: 'Gel definidor ligero' },
  },
  {
    clave: 'rutina.definidor.producto.default',
    segmento: 'rutina',
    prioridad: 53,
    condiciones: null,
    salida: { paso: 'definidor', atributo: 'producto', valor: 'Definidor (opcional)' },
  },
  {
    clave: 'rutina.definidor.caract.afro',
    segmento: 'rutina',
    prioridad: 54,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: {
      paso: 'definidor',
      atributo: 'caracteristicas',
      valor: 'cremoso denso para máxima definición, con proteínas vegetales',
    },
  },
  {
    clave: 'rutina.definidor.caract.rizado',
    segmento: 'rutina',
    prioridad: 55,
    condiciones: { hecho: 'esRizado', op: 'verdadero' },
    salida: {
      paso: 'definidor',
      atributo: 'caracteristicas',
      valor: 'con proteínas de trigo o seda, sin alcohol secante',
    },
  },
  {
    clave: 'rutina.definidor.caract.ondulado',
    segmento: 'rutina',
    prioridad: 56,
    condiciones: { hecho: 'esOndulado', op: 'verdadero' },
    salida: {
      paso: 'definidor',
      atributo: 'caracteristicas',
      valor: 'ligero, activa la onda sin cast pesado',
    },
  },
  {
    clave: 'rutina.definidor.caract.default',
    segmento: 'rutina',
    prioridad: 57,
    condiciones: null,
    salida: {
      paso: 'definidor',
      atributo: 'caracteristicas',
      valor: 'muy ligero, solo si necesita control extra en puntas',
    },
  },
  {
    clave: 'rutina.definidor.frec',
    segmento: 'rutina',
    prioridad: 58,
    condiciones: null,
    salida: { paso: 'definidor', atributo: 'frecuencia', valor: 'cada lavado' },
  },
  // Aceite sellador
  {
    clave: 'rutina.aceite.producto',
    segmento: 'rutina',
    prioridad: 60,
    condiciones: null,
    salida: { paso: 'aceite', atributo: 'producto', valor: 'Aceite sellador' },
  },
  {
    clave: 'rutina.aceite.caract.porosidad_alta',
    segmento: 'rutina',
    prioridad: 61,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: {
      paso: 'aceite',
      atributo: 'caracteristicas',
      valor: 'pesado (ricino, coco u oliva)',
    },
  },
  {
    clave: 'rutina.aceite.caract.porosidad_baja',
    segmento: 'rutina',
    prioridad: 62,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: {
      paso: 'aceite',
      atributo: 'caracteristicas',
      valor: 'ligero (jojoba o almendras)',
    },
  },
  {
    clave: 'rutina.aceite.caract.default',
    segmento: 'rutina',
    prioridad: 63,
    condiciones: null,
    salida: { paso: 'aceite', atributo: 'caracteristicas', valor: 'medio (argán o jojoba)' },
  },
  {
    clave: 'rutina.aceite.frec.obligatorio',
    segmento: 'rutina',
    prioridad: 64,
    condiciones: {
      alguna: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      paso: 'aceite',
      atributo: 'frecuencia',
      valor: 'cada lavado (obligatorio para sellar)',
    },
  },
  {
    clave: 'rutina.aceite.frec.liso',
    segmento: 'rutina',
    prioridad: 65,
    condiciones: { hecho: 'esLiso', op: 'verdadero' },
    salida: {
      paso: 'aceite',
      atributo: 'frecuencia',
      valor: '1-2 veces por semana, solo en puntas',
    },
  },
  {
    clave: 'rutina.aceite.frec.default',
    segmento: 'rutina',
    prioridad: 66,
    condiciones: null,
    salida: { paso: 'aceite', atributo: 'frecuencia', valor: '2-3 veces por semana' },
  },

  // ═══ CONFIG ═══════════════════════════════════════════════════════════
  {
    clave: 'config.disclaimer_productos',
    segmento: 'config',
    prioridad: 10,
    condiciones: null,
    salida: { campo: 'disclaimerProductos', texto: DISCLAIMER_PRODUCTOS },
  },

  // ═══ NOTAS ADICIONALES (todas — prioridad = orden de push legacy) ═════
  {
    clave: 'nota.proteina',
    segmento: 'nota',
    prioridad: 10,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'eq', valor: 'Reconstrucción' },
    salida: {
      textos: [
        'Prioridad alta en proteína — usa mascarilla reconstructora con queratina hidrolizada.',
      ],
    },
  },
  {
    clave: 'nota.corte_puntas',
    segmento: 'nota',
    prioridad: 20,
    condiciones: {
      todas: [
        {
          alguna: [
            { hecho: 'danoQuimico', op: 'verdadero' },
            { hecho: 'danoTermico', op: 'verdadero' },
          ],
        },
        { hecho: 'puntasSeveras', op: 'verdadero' },
      ],
    },
    salida: { textos: ['Se recomienda corte de puntas para eliminar el daño severo.'] },
  },
  {
    clave: 'nota.transicion',
    segmento: 'nota',
    prioridad: 30,
    condiciones: { hecho: 'transicion', op: 'verdadero' },
    salida: {
      textos: [
        'Tratar zona natural y zona procesada por separado. Recomendar corte progresivo de la zona química.',
      ],
    },
  },
  {
    clave: 'nota.linea_demarcacion',
    segmento: 'nota',
    prioridad: 40,
    condiciones: {
      todas: [
        { hecho: 'transicion', op: 'verdadero' },
        { hecho: 'lineaDemarcacion', op: 'noVacio' },
      ],
    },
    salida: { textos: ['Línea de demarcación: {{lineaDemarcacion}}'] },
  },
  {
    clave: 'nota.twist_out',
    segmento: 'nota',
    prioridad: 50,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['4B', '4C'] },
        { hecho: 'densidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: { textos: ['Para día 2-3: Twist Out para revivir la definición sin relavar.'] },
  },
  {
    clave: 'nota.sellado_afro',
    segmento: 'nota',
    prioridad: 60,
    condiciones: { hecho: 'tipoRizoPrincipal', op: 'en', valor: ['4B', '4C'] },
    salida: {
      textos: ['Sella SIEMPRE con aceite después de aplicar el gel para retener humedad.'],
    },
  },
  {
    clave: 'nota.mascarilla_termica',
    segmento: 'nota',
    prioridad: 70,
    condiciones: { hecho: 'tratReconstructor', op: 'verdadero' },
    salida: {
      textos: [
        'Mascarilla reconstructora: dejar actuar 20-30 min con calor (gorro térmico) para máxima reconstrucción.',
      ],
    },
  },
  {
    clave: 'nota.porosidad_baja',
    segmento: 'nota',
    prioridad: 80,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: {
      textos: ['Porosidad baja: clarifica 1 vez al mes para remover acumulación de producto.'],
    },
  },
  {
    clave: 'nota.porosidad_alta',
    segmento: 'nota',
    prioridad: 90,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: {
      textos: [
        'Porosidad alta: sella SIEMPRE con aceite o manteca después de hidratar para retener la humedad.',
        'Usa leave-in cremoso (no en spray) para mayor nutrición.',
      ],
    },
  },
  {
    clave: 'nota.caspa',
    segmento: 'nota',
    prioridad: 100,
    condiciones: { hecho: 'tieneCaspa', op: 'verdadero' },
    salida: {
      textos: [
        'Cuero cabelludo: considerar shampoo medicado 1x por semana.',
        'Si la caspa persiste más de 4 semanas, consultar dermatólogo.',
      ],
    },
  },
  {
    clave: 'nota.embarazo',
    segmento: 'nota',
    prioridad: 110,
    condiciones: { hecho: 'embarazo', op: 'verdadero' },
    salida: {
      textos: [
        'Embarazo/lactancia: evitar keratina y productos con formol. Preferir ingredientes naturales.',
      ],
    },
  },
  {
    clave: 'nota.caida',
    segmento: 'nota',
    prioridad: 120,
    condiciones: { hecho: 'tieneCaida', op: 'verdadero' },
    salida: {
      textos: [
        'Caída excesiva: puede tener causa interna (estrés, anemia, tiroides, postparto). Recomendar consulta médica si persiste más de 3 meses.',
      ],
    },
  },
  {
    clave: 'nota.estres',
    segmento: 'nota',
    prioridad: 130,
    condiciones: { hecho: 'nivelEstres', op: 'eq', valor: 'alto' },
    salida: {
      textos: ['Nivel de estrés alto: puede contribuir a la caída y fragilidad del cabello.'],
    },
  },

  // ═══ CUIDADO EN CASA (todas, append por campo) ════════════════════════
  {
    clave: 'casa.dia_lavado.base',
    segmento: 'cuidado_casa',
    prioridad: 10,
    condiciones: null,
    salida: {
      campo: 'diaLavado',
      textos: [
        'Detangle en secciones con el acondicionador puesto (sin enjuagar)',
        'Aplica mascarilla / tratamiento según cronograma',
        'Enjuaga con agua fría para cerrar la cutícula',
        'Aplica leave-in en cabello húmedo',
        'Aplica crema de peinar + gel con la técnica indicada',
        'Seca con toalla de microfibra o camiseta de algodón (sin frotar)',
        'Usa difusor o deja secar al aire',
      ],
    },
  },
  {
    clave: 'casa.nocturno.base',
    segmento: 'cuidado_casa',
    prioridad: 20,
    condiciones: null,
    salida: {
      campo: 'nocturno',
      textos: [
        'Usa bonnet de satín o funda de almohada de seda para dormir',
        'Haz una piña suelta (ponytail en la coronilla sin apretar) para conservar los rizos',
        'Si el cabello está muy seco, aplica 1-2 gotas de aceite en las puntas antes del bonnet',
      ],
    },
  },
  {
    clave: 'casa.refresh.base',
    segmento: 'cuidado_casa',
    prioridad: 30,
    condiciones: null,
    salida: {
      campo: 'refresh',
      textos: [
        'Mezcla agua + leave-in en spray (proporción 50/50)',
        'Aplica en secciones y scruncha suavemente',
        'Si los rizos perdieron forma: aplica un poco de gel fresco y scruncha',
        'Seca con difusor en frío o deja secar al aire',
      ],
    },
  },
  {
    clave: 'casa.evitar.base',
    segmento: 'cuidado_casa',
    prioridad: 40,
    condiciones: null,
    salida: {
      campo: 'evitar',
      textos: [
        'Cepillar el cabello en seco (rompe los rizos y genera frizz)',
        'Toalla de algodón (usa microfibra o camiseta)',
        'Dormir sin protección (bonnet o funda de satín)',
        'Calor directo sin protector térmico',
      ],
    },
  },
  {
    clave: 'casa.evitar.porosidad_baja',
    segmento: 'cuidado_casa',
    prioridad: 50,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: {
      campo: 'evitar',
      textos: ['Aceites pesados (coco, ricino) — se acumulan en cutícula cerrada'],
    },
  },
  {
    clave: 'casa.dia_lavado.porosidad_baja',
    segmento: 'cuidado_casa',
    prioridad: 51,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'baja' },
    salida: {
      campo: 'diaLavado',
      textos: ['Aplica mascarilla con gorro térmico para abrir la cutícula y permitir absorción'],
    },
  },
  {
    clave: 'casa.dia_lavado.porosidad_alta',
    segmento: 'cuidado_casa',
    prioridad: 52,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: {
      campo: 'diaLavado',
      textos: [
        'Aplica técnica LOC o LCO: Leave-in → Oil (aceite) → Cream (crema) para retener humedad',
      ],
    },
  },
  {
    clave: 'casa.evitar.porosidad_alta',
    segmento: 'cuidado_casa',
    prioridad: 53,
    condiciones: { hecho: 'porosidad', op: 'eq', valor: 'alta' },
    salida: { campo: 'evitar', textos: ['Calor directo (agrava la apertura de cutícula)'] },
  },
  {
    clave: 'casa.evitar.caida',
    segmento: 'cuidado_casa',
    prioridad: 60,
    condiciones: { hecho: 'tieneCaida', op: 'verdadero' },
    salida: {
      campo: 'evitar',
      textos: ['Peinados tensos (colas apretadas, trenzas pegadas al cuero cabelludo)'],
    },
  },

  // ═══ INTERVALO DE CITA (primera) ══════════════════════════════════════
  {
    clave: 'intervalo.urgente',
    segmento: 'intervalo',
    prioridad: 10,
    condiciones: {
      alguna: [
        { hecho: 'puntasSeveras', op: 'verdadero' },
        { hecho: 'tratamientoPrincipal', op: 'eq', valor: 'Reconstrucción' },
        { hecho: 'danoQuimico', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Regresar en 2 semanas (seguimiento urgente)' },
  },
  {
    clave: 'intervalo.tratamiento',
    segmento: 'intervalo',
    prioridad: 20,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'neq', valor: 'Mantenimiento' },
    salida: { texto: 'Regresar en 3-4 semanas' },
  },
  {
    clave: 'intervalo.mantenimiento',
    segmento: 'intervalo',
    prioridad: 30,
    condiciones: null,
    salida: { texto: 'Regresar en 6-8 semanas' },
  },
];
