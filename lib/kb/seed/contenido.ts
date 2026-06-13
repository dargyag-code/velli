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
];

// ── Flujos de wizard (preguntas como datos) ────────────────────────────────
// El flujo de rizado actual sigue siendo el formulario hardcodeado del
// wizard (idéntico a producción). Este flujo de LISO queda en BORRADOR:
// al publicarlo desde el panel de conocimiento, el wizard muestra sus
// preguntas para tipos 1A–1C sin redeploy (Fase 2).

export const FLUJOS: FlujoKB[] = [
  {
    clave: 'flujo.liso',
    tiposCabello: ['1A', '1B', '1C'],
    estado: 'borrador',
    definicion: {
      titulo: 'Preguntas para cabello liso',
      descripcion:
        'El cabello liso no se evalúa igual que el rizado: pesa más la grasa en raíz, el volumen y las zonas de densidad.',
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
          clave: 'estadoCanas',
          etiqueta: 'Estado de canas',
          tipo: 'opcion',
          opciones: [
            { valor: 'sin_canas', etiqueta: 'Sin canas' },
            { valor: 'menos_25', etiqueta: 'Menos del 25%' },
            { valor: 'entre_25_50', etiqueta: 'Entre 25% y 50%' },
            { valor: 'mas_50', etiqueta: 'Más del 50%' },
          ],
          opcional: true,
        },
        {
          clave: 'densidadPorZonas',
          etiqueta: 'Densidad por zonas',
          tipo: 'multi',
          opciones: [
            { valor: 'uniforme', etiqueta: 'Uniforme' },
            { valor: 'entradas', etiqueta: 'Entradas despobladas' },
            { valor: 'coronilla', etiqueta: 'Coronilla rala' },
            { valor: 'laterales', etiqueta: 'Laterales débiles' },
          ],
          opcional: true,
        },
        {
          clave: 'senalesAlopecia',
          etiqueta: 'Señales de alopecia',
          ayuda: 'Si hay señales clínicas, el sistema deriva a dermatólogo.',
          tipo: 'multi',
          opciones: [
            { valor: 'sin_senales', etiqueta: 'Sin señales' },
            { valor: 'caida_estacional', etiqueta: 'Caída estacional leve' },
            { valor: 'placas_sin_cabello', etiqueta: 'Placas sin cabello', banderaMedica: true },
            { valor: 'perdida_difusa_severa', etiqueta: 'Pérdida difusa severa', banderaMedica: true },
            { valor: 'retroceso_linea_frontal', etiqueta: 'Retroceso de línea frontal', banderaMedica: true },
          ],
          opcional: true,
        },
        {
          clave: 'tipoCueroCabelludo',
          etiqueta: 'Tipo de cuero cabelludo',
          tipo: 'opcion',
          opciones: [
            { valor: 'normal', etiqueta: 'Normal' },
            { valor: 'graso', etiqueta: 'Graso' },
            { valor: 'seco', etiqueta: 'Seco' },
            { valor: 'sensible', etiqueta: 'Sensible' },
            { valor: 'dermatitis_leve', etiqueta: 'Dermatitis leve / caspa' },
            { valor: 'dermatitis_severa', etiqueta: 'Dermatitis severa', banderaMedica: true },
            { valor: 'psoriasis_sospecha', etiqueta: 'Sospecha de psoriasis', banderaMedica: true },
            { valor: 'lesiones_abiertas', etiqueta: 'Lesiones abiertas', banderaMedica: true },
          ],
          opcional: true,
        },
        {
          clave: 'procesosQuimicos',
          etiqueta: 'Procesos químicos previos (últimos 12 meses)',
          tipo: 'multi',
          opciones: [
            { valor: 'ninguno', etiqueta: 'Ninguno' },
            { valor: 'tinte', etiqueta: 'Tinte / coloración' },
            { valor: 'decoloracion', etiqueta: 'Decoloración / mechas' },
            { valor: 'alisado', etiqueta: 'Alisado permanente / keratina' },
            { valor: 'permanente', etiqueta: 'Permanente (rizado químico)' },
            { valor: 'henna', etiqueta: 'Henna / tintes vegetales' },
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
