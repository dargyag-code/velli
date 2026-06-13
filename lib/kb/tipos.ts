// ══════════════════════════════════════════════════════════════════════════
// Knowledge Base — tipos compartidos entre el evaluador, el seed canónico,
// el panel de conocimiento y el loader de Supabase.
//
// Una regla = condiciones sobre el perfil capilar (árbol jsonb) + salida
// (jsonb cuya forma depende del segmento). Las reglas viven en kb_reglas;
// el seed TS en lib/kb/seed/ es la fuente canónica de las reglas de rizos
// y de él se genera la migración SQL (scripts/generar-seed-kb-sql.mjs).
// ══════════════════════════════════════════════════════════════════════════

export type OperadorCondicion =
  | 'eq'            // hecho === valor
  | 'neq'           // hecho !== valor
  | 'en'            // valor (array) incluye el hecho
  | 'noEn'          // valor (array) NO incluye el hecho
  | 'incluye'       // hecho (array) incluye valor
  | 'noIncluye'     // hecho (array) NO incluye valor
  | 'incluyeAlguno' // hecho (array) incluye alguno de valor (array)
  | 'regex'         // algún elemento del hecho (array o string) matchea la regex (i)
  | 'vacio'         // hecho es '', [], null o undefined
  | 'noVacio'       // negación de vacio
  | 'verdadero'     // hecho === true
  | 'falso';        // hecho !== true

export type Condicion =
  | { todas: Condicion[] }
  | { alguna: Condicion[] }
  | { no: Condicion }
  | { hecho: string; op: OperadorCondicion; valor?: unknown };

// Cada segmento corresponde a una sección del ResultadoConsulta que el
// motor legacy construía con if/else. La semántica de selección es fija
// por segmento (ver evaluador): 'primera' = gana la primera regla que
// matchea por prioridad ascendente; 'todas' = se acumulan en orden.
export type SegmentoRegla =
  | 'hecho'                 // deriva hechos intermedios (danoQuimico, transicion…)
  | 'derivacion_medica'     // bandera médica → SIEMPRE derivar, nunca plan
  | 'tratamiento_principal' // primera
  | 'tratamiento_adicional' // todas
  | 'cronograma'            // primera
  | 'tecnica'               // primera
  | 'producto_resumen'      // todas (productosPonto)
  | 'ingrediente_buscar'    // todas, dedupe conservando primera aparición
  | 'ingrediente_evitar'    // todas, dedupe conservando primera aparición
  | 'rutina'                // primera por (paso, atributo)
  | 'nota'                  // todas (notasAdicionales)
  | 'cuidado_casa'          // todas, append por campo
  | 'intervalo'             // primera
  | 'config';               // valores fijos (disclaimer)

export type EstadoKB = 'borrador' | 'publicada' | 'archivada';

// ── Salidas por segmento ────────────────────────────────────────────────────

export interface SalidaHecho {
  hecho: string;
  valor: unknown;
}

export interface SalidaTexto {
  texto: string;
}

export interface SalidaTextos {
  textos: string[];
}

export interface SalidaCronograma {
  semana1: string;
  semana2: string;
  semana3: string;
  semana4: string;
}

export interface SalidaTecnica {
  tecnicaDefinicion: string;
  tecnicaDescripcion: string;
  metodoSecado: string;
  // Conservado como dato aunque el resultado actual no lo expone (paridad
  // con el motor legacy, que lo calculaba sin retornarlo).
  gelRecomendado?: string;
}

export type RutinaPasoClave =
  | 'champu'
  | 'acondicionador'
  | 'mascarilla'
  | 'leavein'
  | 'definidor'
  | 'aceite';

export type RutinaAtributo = 'producto' | 'caracteristicas' | 'frecuencia';

export interface SalidaRutina {
  paso: RutinaPasoClave;
  atributo: RutinaAtributo;
  valor: string;
}

export type CuidadoCasaCampo = 'diaLavado' | 'nocturno' | 'refresh' | 'evitar';

export interface SalidaCuidadoCasa {
  campo: CuidadoCasaCampo;
  textos: string[];
}

export interface SalidaConfig {
  campo: 'disclaimerProductos';
  texto: string;
}

export interface SalidaDerivacionMedica {
  motivo: string;
  recomendaciones: string[];
}

export type SalidaRegla =
  | SalidaHecho
  | SalidaTexto
  | SalidaTextos
  | SalidaCronograma
  | SalidaTecnica
  | SalidaRutina
  | SalidaCuidadoCasa
  | SalidaConfig
  | SalidaDerivacionMedica;

// ── Regla ───────────────────────────────────────────────────────────────────

export interface ReglaKB {
  /** Clave estable y única (con locale) — permite seeds idempotentes. */
  clave: string;
  segmento: SegmentoRegla;
  /** Orden de evaluación dentro del segmento (ascendente). */
  prioridad: number;
  /** null = siempre aplica. */
  condiciones: Condicion | null;
  salida: SalidaRegla;
  /** true → si matchea, el evaluador SIEMPRE devuelve derivación médica. */
  esBanderaMedica?: boolean;
  locale?: string; // default 'es'
  estado?: EstadoKB; // default 'publicada' en el seed
  notasInternas?: string;
}

// Fila tal como viene de Supabase (kb_reglas).
export interface ReglaKBRow {
  id: string;
  clave: string;
  locale: string;
  segmento: SegmentoRegla;
  prioridad: number;
  condiciones: Condicion | null;
  salida: SalidaRegla;
  es_bandera_medica: boolean;
  estado: EstadoKB;
  version: number;
  notas_internas: string | null;
  updated_at: string;
}

// ── Flujos de wizard (preguntas como datos) ────────────────────────────────

export type PreguntaTipo = 'opcion' | 'multi' | 'texto' | 'booleano';

export interface OpcionPregunta {
  valor: string;
  etiqueta: string;
  /** true → seleccionar esta opción levanta la bandera médica del perfil. */
  banderaMedica?: boolean;
}

export interface PreguntaFlujo {
  /** Clave bajo la que se guarda la respuesta en perfilExtendido. */
  clave: string;
  etiqueta: string;
  ayuda?: string;
  tipo: PreguntaTipo;
  opciones?: OpcionPregunta[];
  opcional?: boolean;
}

export interface DefinicionFlujo {
  titulo: string;
  descripcion?: string;
  preguntas: PreguntaFlujo[];
}

export interface FlujoKB {
  clave: string;
  /** Tipos de cabello a los que aplica (['1A','1B','1C'] p.ej.). null = todos. */
  tiposCabello: string[] | null;
  definicion: DefinicionFlujo;
  locale?: string;
  estado?: EstadoKB;
}

export interface FlujoKBRow {
  id: string;
  clave: string;
  locale: string;
  tipos_cabello: string[] | null;
  definicion: DefinicionFlujo;
  estado: EstadoKB;
  version: number;
  updated_at: string;
}

// ── Prompts de IA ───────────────────────────────────────────────────────────

export interface PromptKB {
  clave: string;
  contenido: string;
  /** null = aplica a todos los tipos de cabello. */
  tiposCabello?: string[] | null;
  locale?: string;
  estado?: EstadoKB;
}

export interface PromptKBRow {
  id: string;
  clave: string;
  locale: string;
  tipos_cabello: string[] | null;
  contenido: string;
  estado: EstadoKB;
  version: number;
  updated_at: string;
}

// ── Dimensiones del perfil capilar extensible ──────────────────────────────

export interface DimensionKB {
  clave: string;
  etiqueta: string;
  descripcion?: string;
  tipo: PreguntaTipo;
  opciones?: OpcionPregunta[];
  /** true → cualquier valor marcado banderaMedica en esta dimensión deriva. */
  banderaMedica?: boolean;
  locale?: string;
  estado?: EstadoKB;
}

export interface DimensionKBRow {
  id: string;
  clave: string;
  locale: string;
  etiqueta: string;
  descripcion: string | null;
  tipo: PreguntaTipo;
  opciones: OpcionPregunta[] | null;
  bandera_medica: boolean;
  estado: EstadoKB;
  version: number;
  updated_at: string;
}
