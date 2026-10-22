// ══════════════════════════════════════════════════════════════════════════
// Seed canónico — dimensiones del perfil extensible, flujos de wizard y
// prompts de IA. Igual que reglasRizado.ts, de aquí se genera el SQL.
// ══════════════════════════════════════════════════════════════════════════

// import type: el seed se importa también desde Node (scripts/generar-seed-
// kb-sql.mjs) vía type-stripping — no debe tener imports de runtime.
import type { DimensionKB, FlujoKB, PromptKB } from '../tipos';

// ── Dimensiones del perfil capilar (Fase 2: más allá del rizo) ─────────────
// Las respuestas viven en consultas.perfil_extendido (jsonb) bajo la clave
// de cada dimensión — agregar una dimensión nueva NO requiere migración.

export const DIMENSIONES: DimensionKB[] = [
  {
    clave: 'estadoCanas',
    etiqueta: 'Estado de canas',
    descripcion: 'Proporción aproximada de canas visibles.',
    tipo: 'opcion',
    opciones: [
      { valor: 'sin_canas', etiqueta: 'Sin canas' },
      { valor: 'menos_25', etiqueta: 'Menos del 25%' },
      { valor: 'entre_25_50', etiqueta: 'Entre 25% y 50%' },
      { valor: 'mas_50', etiqueta: 'Más del 50%' },
    ],
  },
  {
    clave: 'densidadPorZonas',
    etiqueta: 'Densidad por zonas',
    descripcion: 'Zonas con densidad notablemente menor al resto.',
    tipo: 'multi',
    opciones: [
      { valor: 'uniforme', etiqueta: 'Uniforme (sin zonas ralas)' },
      { valor: 'entradas', etiqueta: 'Entradas despobladas' },
      { valor: 'coronilla', etiqueta: 'Coronilla rala' },
      { valor: 'laterales', etiqueta: 'Laterales débiles' },
    ],
  },
  {
    clave: 'senalesAlopecia',
    etiqueta: 'Señales de alopecia',
    descripcion:
      'Señales clínicas observables. Las marcadas como médicas generan SIEMPRE derivación a dermatólogo.',
    tipo: 'multi',
    banderaMedica: true,
    opciones: [
      { valor: 'sin_senales', etiqueta: 'Sin señales' },
      { valor: 'caida_estacional', etiqueta: 'Caída estacional leve' },
      { valor: 'placas_sin_cabello', etiqueta: 'Placas sin cabello (calvas localizadas)', banderaMedica: true },
      { valor: 'perdida_difusa_severa', etiqueta: 'Pérdida difusa severa (cuero muy visible)', banderaMedica: true },
      { valor: 'retroceso_linea_frontal', etiqueta: 'Retroceso de la línea frontal', banderaMedica: true },
    ],
  },
  {
    clave: 'tipoCueroCabelludo',
    etiqueta: 'Tipo de cuero cabelludo',
    descripcion:
      'Estado general del cuero cabelludo. Los estados marcados como médicos generan SIEMPRE derivación a dermatólogo.',
    tipo: 'opcion',
    banderaMedica: true,
    opciones: [
      { valor: 'normal', etiqueta: 'Normal' },
      { valor: 'graso', etiqueta: 'Graso' },
      { valor: 'seco', etiqueta: 'Seco' },
      { valor: 'sensible', etiqueta: 'Sensible' },
      { valor: 'dermatitis_leve', etiqueta: 'Dermatitis leve / caspa' },
      { valor: 'dermatitis_severa', etiqueta: 'Dermatitis severa (placas, inflamación)', banderaMedica: true },
      { valor: 'psoriasis_sospecha', etiqueta: 'Sospecha de psoriasis', banderaMedica: true },
      { valor: 'lesiones_abiertas', etiqueta: 'Lesiones abiertas o costras', banderaMedica: true },
    ],
  },
  {
    clave: 'procesosQuimicos',
    etiqueta: 'Procesos químicos previos',
    descripcion: 'Procesos químicos aplicados en los últimos 12 meses.',
    tipo: 'multi',
    opciones: [
      { valor: 'ninguno', etiqueta: 'Ninguno' },
      { valor: 'tinte', etiqueta: 'Tinte / coloración' },
      { valor: 'decoloracion', etiqueta: 'Decoloración / mechas' },
      { valor: 'alisado', etiqueta: 'Alisado permanente / keratina' },
      { valor: 'permanente', etiqueta: 'Permanente (rizado químico)' },
      { valor: 'henna', etiqueta: 'Henna / tintes vegetales' },
    ],
  },

  // ── Fase 2 (Sprint B) — dimensiones nuevas, en BORRADOR ─────────────────
  // Fuentes: Entrega 1 (liso/ondulado), Entrega 2 (canas/alopecia),
  // Entrega 4 (tipos 3–4) y la validación técnica. Se publican desde el
  // panel junto con las reglas y flujos que las usan.
  {
    clave: 'grasaRaiz',
    etiqueta: '¿Qué tan rápido se engrasa la raíz?',
    descripcion: 'Oleosidad percibida del cuero cabelludo (Entrega 1).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'mismo_dia', etiqueta: 'El mismo día del lavado' },
      { valor: '1_2_dias', etiqueta: 'A los 1-2 días' },
      { valor: '3_mas_dias', etiqueta: 'A los 3 días o más' },
    ],
  },
  {
    clave: 'volumenRaiz',
    etiqueta: 'Volumen en la raíz',
    descripcion: 'Cómo luce el volumen de raíz (tipo 1).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'plano', etiqueta: 'Plano / pegado al cráneo' },
      { valor: 'medio', etiqueta: 'Medio' },
      { valor: 'abundante', etiqueta: 'Con cuerpo' },
    ],
  },
  {
    clave: 'nivelFrizz',
    etiqueta: 'Nivel de frizz',
    descripcion:
      'En tipo 2 suele ser síntoma de deshidratación; en 1C, de cutícula abierta y estática (Entrega 1).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'bajo', etiqueta: 'Bajo' },
      { valor: 'medio', etiqueta: 'Medio' },
      { valor: 'alto', etiqueta: 'Alto' },
    ],
  },
  {
    clave: 'descamacion',
    etiqueta: 'Descamación del cuero cabelludo',
    descripcion:
      'La descamación fina y blanca sin enrojecimiento es resequedad simple (L-08). Con placas, enrojecimiento o dolor es señal médica: derivación obligatoria.',
    tipo: 'opcion',
    banderaMedica: true,
    estado: 'borrador',
    opciones: [
      { valor: 'sin_descamacion', etiqueta: 'Sin descamación' },
      { valor: 'fina_blanca', etiqueta: 'Fina y blanca, sin enrojecimiento' },
      {
        valor: 'placas_enrojecimiento',
        etiqueta: 'Placas gruesas, enrojecimiento, exudado o dolor',
        banderaMedica: true,
      },
    ],
  },
  {
    clave: 'objetivoPrincipal',
    etiqueta: 'Objetivo principal',
    descripcion:
      'Una sola opción dominante: ordena el plan cuando varias reglas aplican (Entrega 1).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'volumen', etiqueta: 'Volumen' },
      { valor: 'control_frizz', etiqueta: 'Control de frizz / estática' },
      { valor: 'brillo', etiqueta: 'Brillo' },
      { valor: 'reparacion', etiqueta: 'Reparación' },
      { valor: 'definicion', etiqueta: 'Definición de onda' },
      { valor: 'mas_rizo', etiqueta: 'Maximizar definición hacia rizo' },
      { valor: 'mantenimiento', etiqueta: 'Mantenimiento' },
    ],
  },
  {
    clave: 'frecuenciaTinte',
    etiqueta: 'Frecuencia de coloración',
    descripcion: 'Activa reglas de daño acumulativo por color (L-09, C-06).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'sin_tinte', etiqueta: 'No se tiñe' },
      { valor: 'cada_3_6_semanas', etiqueta: 'Cada 3–6 semanas (cobertura)' },
      { valor: 'cada_8_semanas_o_menos', etiqueta: 'Cada 8 semanas o menos' },
      { valor: 'esporadico', etiqueta: 'Esporádico (más de 8 semanas)' },
    ],
  },
  {
    clave: 'acumulacionProducto',
    etiqueta: 'Acumulación de producto (build-up)',
    descripcion:
      'Uso habitual de siliconas insolubles, ceras o aceites minerales. Activa el detox antes que cualquier regla de definición (O-05).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'si', etiqueta: 'Sí' },
      { valor: 'no', etiqueta: 'No' },
    ],
  },
  {
    clave: 'definicionOnda',
    etiqueta: '¿Qué tan definida luce la onda hoy?',
    descripcion: 'Estado actual del patrón en tipo 2 (Entrega 1 §3.2).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'definida', etiqueta: 'Definida' },
      { valor: 'se_aplasta', etiqueta: 'Se aplasta a las pocas horas' },
      { valor: 'sin_forma', etiqueta: 'Sin forma / apagada' },
    ],
  },
  {
    clave: 'distribucionCanas',
    etiqueta: 'Distribución de las canas',
    descripcion:
      'Las canas del marco del rostro son las más visibles: priorizan técnica localizada (Entrega 2).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'sienes', etiqueta: 'Sienes' },
      { valor: 'corona', etiqueta: 'Corona' },
      { valor: 'marco_rostro', etiqueta: 'Marco del rostro' },
      { valor: 'difusa', etiqueta: 'Difusa' },
    ],
  },
  {
    clave: 'amarillamientoCanas',
    etiqueta: '¿Las canas muestran tonos amarillos o apagados?',
    descripcion:
      'El amarillo es casi siempre extrínseco: calor, agua dura, residuos, UV o nicotina (C-02).',
    tipo: 'booleano',
    estado: 'borrador',
  },
  {
    clave: 'texturaCana',
    etiqueta: 'Textura de la cana',
    descripcion: 'Activa C-03 (cana rebelde) y C-07 (cana en patrón ondulado/rizado).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'igual', etiqueta: 'Igual al resto' },
      { valor: 'mas_gruesa_aspera', etiqueta: 'Más gruesa / áspera' },
      { valor: 'patron_distinto', etiqueta: 'Patrón distinto' },
    ],
  },
  {
    clave: 'situacionColor',
    etiqueta: 'Situación de color',
    descripcion: 'La dimensión que más cambia el plan del módulo canas: activa C-05 o C-06.',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'natural', etiqueta: 'Natural' },
      { valor: 'tenida_cobertura', etiqueta: 'Teñida (cobertura)' },
      { valor: 'en_transicion', etiqueta: 'En transición' },
      { valor: 'quiere_transicion', etiqueta: 'Quiere iniciar transición' },
    ],
  },
  {
    clave: 'objetivoCana',
    etiqueta: 'Objetivo con la cana',
    descripcion:
      'Decisión de la clienta, nunca del sistema: Velli presenta opciones sin empujar (Entrega 2).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'lucirla', etiqueta: 'Lucirla' },
      { valor: 'matizarla', etiqueta: 'Matizarla' },
      { valor: 'cubrirla', etiqueta: 'Cubrirla' },
      { valor: 'transicionar', etiqueta: 'Transicionar' },
    ],
  },
  {
    clave: 'aparicionCanas',
    etiqueta: 'Aparición de las canas',
    descripcion:
      'La canicie temprana súbita activa el mensaje sereno de la validación técnica (C-08). NO es bandera roja.',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'gradual', etiqueta: 'Gradual, con los años' },
      { valor: 'subita_temprana', etiqueta: 'Abundante y rápida antes de los ~25 años' },
    ],
  },
  {
    clave: 'senalesCaida',
    etiqueta: 'Señales de caída o pérdida (guía de cabina)',
    descripcion:
      'Guía de reconocimiento de la Entrega 2: la primera pregunta es ¿rotura o caída? Rotura: hebras partidas sin bulbo (territorio cosmético). Caída: la hebra sale completa con bulbo blanquecino. Las señales médicas generan SIEMPRE derivación a dermatólogo.',
    tipo: 'multi',
    banderaMedica: true,
    estado: 'borrador',
    opciones: [
      { valor: 'sin_senales', etiqueta: 'Sin señales' },
      { valor: 'caida_normal', etiqueta: 'Caída dentro de lo normal (hasta 50–100 hebras/día)' },
      { valor: 'rotura_sin_bulbo', etiqueta: 'Rotura: hebras partidas sin bulbo, puntitas "paradas"' },
      { valor: 'traccion_sienes', etiqueta: 'Raleo en sienes/línea frontal con historia de tensión crónica' },
      {
        valor: 'parches_redondos',
        etiqueta: 'Parches redondos u ovalados, lisos y bien definidos',
        banderaMedica: true,
      },
      {
        valor: 'caida_difusa_subita',
        etiqueta: 'Caída difusa, súbita y abundante (últimos 1–3 meses)',
        banderaMedica: true,
      },
      {
        valor: 'raya_ensancha',
        etiqueta: 'Raya que se ensancha / retroceso frontal / coronilla cada vez más fina',
        banderaMedica: true,
      },
      {
        valor: 'zonas_lisas_brillantes',
        etiqueta: 'Zonas lisas y brillantes sin vello (posible fibrosis)',
        banderaMedica: true,
      },
      {
        valor: 'cuero_inflamado_pustulas',
        etiqueta: 'Inflamación, pústulas, dolor o descamación severa',
        banderaMedica: true,
      },
    ],
  },
  {
    clave: 'situacionCaida',
    etiqueta: 'Situación frente a la caída',
    descripcion:
      'Activa las reglas de acompañamiento A-01 a A-05 (clienta derivada, en manejo médico, posparto o camuflaje).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'sin_caida', etiqueta: 'Sin caída relevante' },
      { valor: 'en_evaluacion_medica', etiqueta: 'Derivada / en evaluación médica' },
      { valor: 'diagnostico_confirmado_manejo', etiqueta: 'En tratamiento dermatológico' },
      { valor: 'posparto_ventana', etiqueta: 'Posparto dentro de la ventana esperada (2–4 meses)' },
      { valor: 'perdida_estable_camuflaje', etiqueta: 'Pérdida estable: quiere verse mejor hoy' },
    ],
  },
  {
    clave: 'objetivoEstilo',
    etiqueta: 'Objetivo de estilo (tipos 3–4)',
    descripcion: 'Enruta las técnicas: wash and go, twist-out/banding o instalación protectora (Entrega 4).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'definido_natural', etiqueta: 'Definido al natural' },
      { valor: 'estirado_sin_calor', etiqueta: 'Estirado sin calor' },
      { valor: 'protector', etiqueta: 'Peinado protector' },
    ],
  },
  {
    clave: 'protectorEnUso',
    etiqueta: 'Peinado protector en uso',
    descripcion: 'Activa PROT-1, T4-05 y T4-06; controla tiempos máximos y descansos.',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'ninguno', etiqueta: 'Ninguno' },
      { valor: 'trenzas', etiqueta: 'Trenzas' },
      { valor: 'twists', etiqueta: 'Twists' },
      { valor: 'extensiones', etiqueta: 'Extensiones' },
    ],
  },
  {
    clave: 'senalesProtector',
    etiqueta: 'Señales bajo el protector',
    descripcion:
      'Dolor o tensión = aflojar o retirar. Pústulas o lesiones en la piel = derivación (Entrega 4 §8).',
    tipo: 'multi',
    banderaMedica: true,
    estado: 'borrador',
    opciones: [
      { valor: 'sin_molestias', etiqueta: 'Sin molestias' },
      { valor: 'dolor_tension_bultitos', etiqueta: 'Dolor, tirantez o "bultitos"' },
      { valor: 'picor_mal_olor', etiqueta: 'Picor intenso o mal olor persistente' },
      {
        valor: 'pustulas_lesiones',
        etiqueta: 'Pústulas o lesiones en la piel',
        banderaMedica: true,
      },
    ],
  },
  {
    clave: 'largoNaturalCm',
    etiqueta: 'Largo natural (cm, en encogimiento)',
    descripcion:
      'T4-01: registrar SIEMPRE dos largos — el Pasaporte muestra el crecimiento real que el espejo esconde.',
    tipo: 'texto',
    estado: 'borrador',
  },
  {
    clave: 'largoEstiradoCm',
    etiqueta: 'Largo estirado (cm, tracción suave en húmedo)',
    descripcion: 'T4-01: medir sobre el mismo mechón de referencia (nuca o coronilla).',
    tipo: 'texto',
    estado: 'borrador',
  },
  {
    clave: 'manipulacion',
    etiqueta: 'Frecuencia de desenredado y peinado',
    descripcion: 'El tipo 4 se rompe por manipulación: este dato calibra el plan (T4-02).',
    tipo: 'opcion',
    estado: 'borrador',
    opciones: [
      { valor: 'diaria', etiqueta: 'Diaria' },
      { valor: 'varias_semana', etiqueta: 'Varias veces por semana' },
      { valor: 'semanal_o_menos', etiqueta: 'Semanal o menos' },
    ],
  },
];

// ── Flujos de wizard (preguntas como datos) ────────────────────────────────
// El flujo de rizado actual sigue siendo el formulario hardcodeado del
// wizard (idéntico a producción). Este flujo de LISO queda en BORRADOR:
// al publicarlo desde el panel de conocimiento, el wizard muestra sus
// preguntas para tipos 1A–1C sin redeploy (Fase 2).

const OPCIONES_CUERO_CABELLUDO = [
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'graso', etiqueta: 'Graso' },
  { valor: 'seco', etiqueta: 'Seco' },
  { valor: 'sensible', etiqueta: 'Sensible' },
  { valor: 'dermatitis_leve', etiqueta: 'Dermatitis leve / caspa' },
  { valor: 'dermatitis_severa', etiqueta: 'Dermatitis severa', banderaMedica: true },
  { valor: 'psoriasis_sospecha', etiqueta: 'Sospecha de psoriasis', banderaMedica: true },
  { valor: 'lesiones_abiertas', etiqueta: 'Lesiones abiertas', banderaMedica: true },
];

const OPCIONES_PROCESOS_QUIMICOS = [
  { valor: 'ninguno', etiqueta: 'Ninguno' },
  { valor: 'tinte', etiqueta: 'Tinte / coloración' },
  { valor: 'decoloracion', etiqueta: 'Decoloración / mechas' },
  { valor: 'alisado', etiqueta: 'Alisado permanente / keratina' },
  { valor: 'permanente', etiqueta: 'Permanente (rizado químico)' },
  { valor: 'henna', etiqueta: 'Henna / tintes vegetales' },
];

const OPCIONES_NIVEL_FRIZZ = [
  { valor: 'bajo', etiqueta: 'Bajo' },
  { valor: 'medio', etiqueta: 'Medio' },
  { valor: 'alto', etiqueta: 'Alto' },
];

const OPCIONES_FRECUENCIA_TINTE = [
  { valor: 'sin_tinte', etiqueta: 'No se tiñe' },
  { valor: 'cada_3_6_semanas', etiqueta: 'Cada 3–6 semanas (cobertura)' },
  { valor: 'cada_8_semanas_o_menos', etiqueta: 'Cada 8 semanas o menos' },
  { valor: 'esporadico', etiqueta: 'Esporádico (más de 8 semanas)' },
];

const OPCIONES_DENSIDAD_ZONAS = [
  { valor: 'uniforme', etiqueta: 'Uniforme' },
  { valor: 'entradas', etiqueta: 'Entradas despobladas' },
  { valor: 'coronilla', etiqueta: 'Coronilla rala' },
  { valor: 'laterales', etiqueta: 'Laterales débiles' },
];

// Fase 2 (Sprint B): el flujo de liso (plantilla del Sprint A) queda
// completo según la Entrega 1 §3.1; se suman el flujo de ondulado (§3.2),
// el mini-módulo transversal de canas (Entrega 2 §3 — tipos_cabello null:
// se activa en CUALQUIER tipo cuando se publique), la guía de
// reconocimiento en cabina (Entrega 2 §7, también transversal) y las
// dimensiones de tipos 3–4 (Entrega 4). Todos en BORRADOR.

export const FLUJOS: FlujoKB[] = [
  {
    clave: 'flujo.liso',
    tiposCabello: ['1A', '1B', '1C'],
    estado: 'borrador',
    definicion: {
      titulo: 'Preguntas para cabello liso',
      descripcion:
        'En tipo 1 el cuero cabelludo es protagonista: el sebo viaja libre por la hebra recta. Desaparecen las preguntas de definición y entran oleosidad, volumen e historial.',
      preguntas: [
        {
          clave: 'grasaRaiz',
          etiqueta: '¿Qué tan rápido se engrasa la raíz?',
          tipo: 'opcion',
          opciones: [
            { valor: 'mismo_dia', etiqueta: 'El mismo día del lavado' },
            { valor: '1_2_dias', etiqueta: 'A los 1-2 días' },
            { valor: '3_mas_dias', etiqueta: 'A los 3 días o más' },
          ],
        },
        {
          clave: 'volumenRaiz',
          etiqueta: '¿Cómo es el volumen en la raíz?',
          tipo: 'opcion',
          opciones: [
            { valor: 'plano', etiqueta: 'Plano / pegado al cráneo' },
            { valor: 'medio', etiqueta: 'Medio' },
            { valor: 'abundante', etiqueta: 'Con cuerpo' },
          ],
        },
        {
          clave: 'tipoCueroCabelludo',
          etiqueta: 'Tipo de cuero cabelludo',
          ayuda:
            'Picor, descamación y sensaciones. Si la descamación viene con placas, enrojecimiento o dolor, el asistente corta hacia bandera roja.',
          tipo: 'opcion',
          opciones: OPCIONES_CUERO_CABELLUDO,
          opcional: true,
        },
        {
          clave: 'nivelFrizz',
          etiqueta: 'Nivel de frizz / estática',
          ayuda: 'En 1C suele ser señal de cutícula abierta y estática.',
          tipo: 'opcion',
          opciones: OPCIONES_NIVEL_FRIZZ,
          opcional: true,
        },
        {
          clave: 'procesosQuimicos',
          etiqueta: 'Procesos químicos previos (con fechas en observaciones)',
          tipo: 'multi',
          opciones: OPCIONES_PROCESOS_QUIMICOS,
          opcional: true,
        },
        {
          clave: 'frecuenciaTinte',
          etiqueta: 'Frecuencia de coloración',
          tipo: 'opcion',
          opciones: OPCIONES_FRECUENCIA_TINTE,
          opcional: true,
        },
        {
          clave: 'objetivoPrincipal',
          etiqueta: 'Objetivo principal',
          ayuda: 'Una sola opción dominante: ordena el plan cuando varias reglas aplican.',
          tipo: 'opcion',
          opciones: [
            { valor: 'volumen', etiqueta: 'Volumen' },
            { valor: 'control_frizz', etiqueta: 'Control de frizz / estática' },
            { valor: 'brillo', etiqueta: 'Brillo' },
            { valor: 'reparacion', etiqueta: 'Reparación' },
            { valor: 'mantenimiento', etiqueta: 'Mantenimiento' },
          ],
        },
        {
          clave: 'densidadPorZonas',
          etiqueta: 'Densidad por zonas',
          tipo: 'multi',
          opciones: OPCIONES_DENSIDAD_ZONAS,
          opcional: true,
        },
      ],
    },
  },
  {
    clave: 'flujo.ondulado',
    tiposCabello: ['2A', '2B', '2C'],
    estado: 'borrador',
    definicion: {
      titulo: 'Preguntas para cabello ondulado',
      descripcion:
        'En tipo 2 entran la detección de build-up y de transición post-química, además del frizz y la definición actual de la onda.',
      preguntas: [
        {
          clave: 'nivelFrizz',
          etiqueta: 'Nivel de frizz',
          ayuda: 'En tipo 2 suele ser síntoma de deshidratación.',
          tipo: 'opcion',
          opciones: OPCIONES_NIVEL_FRIZZ,
        },
        {
          clave: 'definicionOnda',
          etiqueta: '¿Qué tan definida luce la onda hoy?',
          tipo: 'opcion',
          opciones: [
            { valor: 'definida', etiqueta: 'Definida' },
            { valor: 'se_aplasta', etiqueta: 'Se aplasta a las pocas horas' },
            { valor: 'sin_forma', etiqueta: 'Sin forma / apagada' },
          ],
          opcional: true,
        },
        {
          clave: 'acumulacionProducto',
          etiqueta: '¿Usa habitualmente siliconas insolubles, ceras o aceites minerales?',
          ayuda: 'Detecta el build-up: activa el detox antes que cualquier regla de definición.',
          tipo: 'opcion',
          opciones: [
            { valor: 'si', etiqueta: 'Sí' },
            { valor: 'no', etiqueta: 'No' },
          ],
          opcional: true,
        },
        {
          clave: 'grasaRaiz',
          etiqueta: '¿Qué tan rápido se engrasa la raíz?',
          tipo: 'opcion',
          opciones: [
            { valor: 'mismo_dia', etiqueta: 'El mismo día del lavado' },
            { valor: '1_2_dias', etiqueta: 'A los 1-2 días' },
            { valor: '3_mas_dias', etiqueta: 'A los 3 días o más' },
          ],
          opcional: true,
        },
        {
          clave: 'tipoCueroCabelludo',
          etiqueta: 'Tipo de cuero cabelludo',
          tipo: 'opcion',
          opciones: OPCIONES_CUERO_CABELLUDO,
          opcional: true,
        },
        {
          clave: 'procesosQuimicos',
          etiqueta: 'Procesos químicos previos (clave para detectar transición: dos texturas visibles)',
          tipo: 'multi',
          opciones: OPCIONES_PROCESOS_QUIMICOS,
          opcional: true,
        },
        {
          clave: 'frecuenciaTinte',
          etiqueta: 'Frecuencia de coloración',
          tipo: 'opcion',
          opciones: OPCIONES_FRECUENCIA_TINTE,
          opcional: true,
        },
        {
          clave: 'objetivoPrincipal',
          etiqueta: 'Objetivo principal',
          tipo: 'opcion',
          opciones: [
            { valor: 'definicion', etiqueta: 'Definición máxima' },
            { valor: 'mas_rizo', etiqueta: 'Maximizar definición hacia rizo' },
            { valor: 'reparacion', etiqueta: 'Reparación' },
            { valor: 'control_frizz', etiqueta: 'Control de frizz' },
            { valor: 'mantenimiento', etiqueta: 'Onda suelta y natural / mantenimiento' },
          ],
        },
        {
          clave: 'densidadPorZonas',
          etiqueta: 'Densidad por zonas',
          tipo: 'multi',
          opciones: OPCIONES_DENSIDAD_ZONAS,
          opcional: true,
        },
      ],
    },
  },
  {
    clave: 'flujo.canas',
    tiposCabello: null, // transversal: se activa en cualquier tipo de cabello
    estado: 'borrador',
    definicion: {
      titulo: 'Módulo de canas',
      descripcion:
        'Mini-módulo transversal (Entrega 2): no es un flujo aparte, es una rama que se suma al flujo del tipo base. Si no hay canas, marca "Sin canas" y continúa.',
      preguntas: [
        {
          clave: 'estadoCanas',
          etiqueta: 'Porcentaje de canas',
          ayuda: 'Estimación visual con guía fotográfica.',
          tipo: 'opcion',
          opciones: [
            { valor: 'sin_canas', etiqueta: 'Sin canas' },
            { valor: 'menos_25', etiqueta: 'Menos del 25%' },
            { valor: 'entre_25_50', etiqueta: 'Entre 25% y 50%' },
            { valor: 'mas_50', etiqueta: 'Más del 50%' },
          ],
        },
        {
          clave: 'distribucionCanas',
          etiqueta: 'Distribución',
          ayuda: 'Las canas del marco del rostro priorizan técnica localizada.',
          tipo: 'opcion',
          opciones: [
            { valor: 'sienes', etiqueta: 'Sienes' },
            { valor: 'corona', etiqueta: 'Corona' },
            { valor: 'marco_rostro', etiqueta: 'Marco del rostro' },
            { valor: 'difusa', etiqueta: 'Difusa' },
          ],
          opcional: true,
        },
        {
          clave: 'amarillamientoCanas',
          etiqueta: '¿Las canas muestran tonos amarillos o apagados?',
          tipo: 'booleano',
          opcional: true,
        },
        {
          clave: 'texturaCana',
          etiqueta: 'Textura de la cana',
          tipo: 'opcion',
          opciones: [
            { valor: 'igual', etiqueta: 'Igual al resto' },
            { valor: 'mas_gruesa_aspera', etiqueta: 'Más gruesa / áspera' },
            { valor: 'patron_distinto', etiqueta: 'Patrón distinto' },
          ],
          opcional: true,
        },
        {
          clave: 'aparicionCanas',
          etiqueta: 'Aparición de las canas',
          tipo: 'opcion',
          opciones: [
            { valor: 'gradual', etiqueta: 'Gradual, con los años' },
            { valor: 'subita_temprana', etiqueta: 'Abundante y rápida antes de los ~25 años' },
          ],
          opcional: true,
        },
        {
          clave: 'situacionColor',
          etiqueta: 'Situación de color',
          tipo: 'opcion',
          opciones: [
            { valor: 'natural', etiqueta: 'Natural' },
            { valor: 'tenida_cobertura', etiqueta: 'Teñida (cobertura)' },
            { valor: 'en_transicion', etiqueta: 'En transición' },
            { valor: 'quiere_transicion', etiqueta: 'Quiere iniciar transición' },
          ],
          opcional: true,
        },
        {
          clave: 'objetivoCana',
          etiqueta: 'Objetivo con la cana',
          ayuda: 'Decisión de la clienta, nunca del sistema: presentar opciones sin empujar.',
          tipo: 'opcion',
          opciones: [
            { valor: 'lucirla', etiqueta: 'Lucirla' },
            { valor: 'matizarla', etiqueta: 'Matizarla' },
            { valor: 'cubrirla', etiqueta: 'Cubrirla' },
            { valor: 'transicionar', etiqueta: 'Transicionar' },
          ],
          opcional: true,
        },
      ],
    },
  },
  {
    clave: 'flujo.cabina',
    tiposCabello: null, // transversal: guía de reconocimiento en cabina
    estado: 'borrador',
    definicion: {
      titulo: 'Reconocimiento en cabina — caída y cuero cabelludo',
      descripcion:
        'Guía de la Entrega 2: la primera pregunta siempre es ¿rotura o caída? Las señales médicas convierten el plan en derivación a dermatólogo.',
      preguntas: [
        {
          clave: 'senalesCaida',
          etiqueta: 'Señales de caída o pérdida',
          ayuda:
            'Rotura: hebras partidas sin bulbo (cosmético). Caída: la hebra sale completa con bulbo blanquecino. Hasta 50–100 hebras al día es normal.',
          tipo: 'multi',
          opciones: [
            { valor: 'sin_senales', etiqueta: 'Sin señales' },
            { valor: 'caida_normal', etiqueta: 'Caída dentro de lo normal' },
            { valor: 'rotura_sin_bulbo', etiqueta: 'Rotura sin bulbo (puntitas "paradas")' },
            { valor: 'traccion_sienes', etiqueta: 'Raleo en sienes con tensión crónica' },
            { valor: 'parches_redondos', etiqueta: 'Parches redondos bien definidos', banderaMedica: true },
            { valor: 'caida_difusa_subita', etiqueta: 'Caída difusa y súbita (1–3 meses)', banderaMedica: true },
            { valor: 'raya_ensancha', etiqueta: 'Raya que se ensancha / coronilla fina', banderaMedica: true },
            { valor: 'zonas_lisas_brillantes', etiqueta: 'Zonas lisas y brillantes sin vello', banderaMedica: true },
            { valor: 'cuero_inflamado_pustulas', etiqueta: 'Inflamación, pústulas o dolor', banderaMedica: true },
          ],
          opcional: true,
        },
        {
          clave: 'situacionCaida',
          etiqueta: 'Situación frente a la caída',
          ayuda: 'Activa el acompañamiento A-01 a A-05 para clientas derivadas o en manejo médico.',
          tipo: 'opcion',
          opciones: [
            { valor: 'sin_caida', etiqueta: 'Sin caída relevante' },
            { valor: 'en_evaluacion_medica', etiqueta: 'Derivada / en evaluación médica' },
            { valor: 'diagnostico_confirmado_manejo', etiqueta: 'En tratamiento dermatológico' },
            { valor: 'posparto_ventana', etiqueta: 'Posparto (ventana esperada)' },
            { valor: 'perdida_estable_camuflaje', etiqueta: 'Pérdida estable: quiere verse mejor hoy' },
          ],
          opcional: true,
        },
        {
          clave: 'descamacion',
          etiqueta: 'Descamación del cuero cabelludo',
          tipo: 'opcion',
          opciones: [
            { valor: 'sin_descamacion', etiqueta: 'Sin descamación' },
            { valor: 'fina_blanca', etiqueta: 'Fina y blanca, sin enrojecimiento' },
            {
              valor: 'placas_enrojecimiento',
              etiqueta: 'Placas, enrojecimiento, exudado o dolor',
              banderaMedica: true,
            },
          ],
          opcional: true,
        },
      ],
    },
  },
  {
    clave: 'flujo.tipos34',
    tiposCabello: ['3A', '3B', '3C', '4A', '4B', '4C'],
    estado: 'borrador',
    definicion: {
      titulo: 'Dimensiones reforzadas — tipos 3 y 4',
      descripcion:
        'Complemento de la Entrega 4: encogimiento como dato, objetivo de estilo y peinados protectores. El motor de rizos existente sigue siendo la fuente de verdad.',
      preguntas: [
        {
          clave: 'objetivoEstilo',
          etiqueta: 'Objetivo de estilo',
          tipo: 'opcion',
          opciones: [
            { valor: 'definido_natural', etiqueta: 'Definido al natural' },
            { valor: 'estirado_sin_calor', etiqueta: 'Estirado sin calor' },
            { valor: 'protector', etiqueta: 'Peinado protector' },
          ],
          opcional: true,
        },
        {
          clave: 'protectorEnUso',
          etiqueta: 'Peinado protector en uso',
          tipo: 'opcion',
          opciones: [
            { valor: 'ninguno', etiqueta: 'Ninguno' },
            { valor: 'trenzas', etiqueta: 'Trenzas' },
            { valor: 'twists', etiqueta: 'Twists' },
            { valor: 'extensiones', etiqueta: 'Extensiones' },
          ],
          opcional: true,
        },
        {
          clave: 'senalesProtector',
          etiqueta: 'Señales bajo el protector',
          ayuda: 'El dolor nunca es el precio de un peinado.',
          tipo: 'multi',
          opciones: [
            { valor: 'sin_molestias', etiqueta: 'Sin molestias' },
            { valor: 'dolor_tension_bultitos', etiqueta: 'Dolor, tirantez o "bultitos"' },
            { valor: 'picor_mal_olor', etiqueta: 'Picor intenso o mal olor persistente' },
            { valor: 'pustulas_lesiones', etiqueta: 'Pústulas o lesiones en la piel', banderaMedica: true },
          ],
          opcional: true,
        },
        {
          clave: 'largoNaturalCm',
          etiqueta: 'Largo natural (cm, en encogimiento)',
          ayuda: 'T4-01: el encogimiento es dato, no defecto. Registrar ambos largos.',
          tipo: 'texto',
          opcional: true,
        },
        {
          clave: 'largoEstiradoCm',
          etiqueta: 'Largo estirado (cm, tracción suave en húmedo)',
          ayuda: 'Mismo mechón de referencia (nuca o coronilla) para comparabilidad.',
          tipo: 'texto',
          opcional: true,
        },
        {
          clave: 'manipulacion',
          etiqueta: 'Frecuencia de desenredado y peinado',
          tipo: 'opcion',
          opciones: [
            { valor: 'diaria', etiqueta: 'Diaria' },
            { valor: 'varias_semana', etiqueta: 'Varias veces por semana' },
            { valor: 'semanal_o_menos', etiqueta: 'Semanal o menos' },
          ],
          opcional: true,
        },
      ],
    },
  },
];

// ── Prompts de IA ───────────────────────────────────────────────────────────
// El contenido publicado es una copia LITERAL de lo que hoy vive hardcodeado
// en lib/hairAnalysis.ts y app/api/analyze-hair/route.ts → comportamiento
// idéntico hoy; al publicar una versión nueva, la IA la usa sin redeploy.
// tests/prompts.sync.test.ts garantiza que estas copias no driftean del
// código (este archivo no puede importar hairAnalysis: debe ser puro para
// que Node lo cargue con type-stripping al generar el SQL).

const SISTEMA_ANALISIS =
  'Eres un experto en análisis de texturas capilares. Responde SOLO con el objeto JSON solicitado. No uses backticks, no uses bloques de código markdown, no agregues texto antes ni después del JSON.';

const PROMPT_ANALISIS_SEED = `Eres un experto en análisis de texturas capilares. Analiza las fotos de cabello y determina:

1. Tipo de cabello según el sistema Andre Walker (tipos: 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B, 3C, 4A, 4B, 4C). Tipos 1 son lisos (1A completamente liso, 1B liso con leve cuerpo, 1C liso con ondulación sutil en puntas).
2. Porosidad visible: "baja" (cabello brillante/resbaladizo/liso en cutícula), "media" (normal), "alta" (cabello opaco/esponjoso/mucho frizz/absorbe agua rápido).
3. Densidad del cabello: "baja" (cuero cabelludo muy visible a través del cabello), "media" (parcialmente visible), "alta" (cuero cabelludo no visible).
4. Daño visible: "ninguno", "leve" (algunas puntas abiertas), "moderado" (puntas muy abiertas, textura alterada), "severo" (quiebre, fragilidad extrema).

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin texto adicional, sin markdown):
{
  "tipoRizoPrincipal": "3B",
  "tiposSecundarios": ["3A"],
  "observaciones": "Rizo espiral definido, porosidad alta, densidad media.",
  "confianza": "alta",
  "porosidad": "alta",
  "densidad": "media",
  "danoVisible": "leve"
}

Reglas:
- tipoRizoPrincipal: obligatorio, uno de los 12 tipos válidos (1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B, 3C, 4A, 4B, 4C)
- tiposSecundarios: array vacío [] si no hay tipos secundarios claros
- observaciones: descripción breve del estado (máx 100 caracteres)
- confianza: "alta" si el patrón es claro y todos los campos son determinables con certeza, "media" si hay duda en algún campo, "baja" si las fotos no son suficientes
- porosidad, densidad, danoVisible: incluir siempre si las fotos tienen calidad suficiente`;

const CONTEXTOS_SEED: Record<string, string> = {
  seco_natural: 'El cabello está SECO Y SIN PRODUCTO — estado ideal para diagnóstico. El patrón visible es el patrón real.',
  humedo: 'El cabello está HÚMEDO — el rizo se estira cuando está mojado. El tipo real probablemente sea más cerrado que lo visible.',
  con_producto: 'El cabello tiene PRODUCTO APLICADO — el brillo y la definición pueden estar alterados. Ajusta la evaluación de porosidad.',
  recien_lavado: 'El cabello está RECIÉN LAVADO SIN PRODUCTO — buen estado para evaluar porosidad.',
};

export const PROMPTS: PromptKB[] = [
  { clave: 'analisis_foto.sistema', contenido: SISTEMA_ANALISIS },
  { clave: 'analisis_foto.principal', contenido: PROMPT_ANALISIS_SEED },
  { clave: 'analisis_foto.contexto.seco_natural', contenido: CONTEXTOS_SEED.seco_natural },
  { clave: 'analisis_foto.contexto.humedo', contenido: CONTEXTOS_SEED.humedo },
  { clave: 'analisis_foto.contexto.con_producto', contenido: CONTEXTOS_SEED.con_producto },
  { clave: 'analisis_foto.contexto.recien_lavado', contenido: CONTEXTOS_SEED.recien_lavado },
];
