// ══════════════════════════════════════════════════════════════════════════
// Módulo de cortes — tipos (Entrega 5, con las respuestas 4 y 5 de Keila
// mandando sobre la entrega donde difieren).
//
// Decisión de Keila (respuesta 5) que MANDA sobre la Entrega 5: el catálogo
// es ÚNICO e indexado por atributos ARQUITECTÓNICOS (largo, capas, densidad,
// textura). La Entrega 5 lo estructuraba en "sección mujeres" y "sección
// hombres"; aquí el género es solo una etiqueta de filtro opcional, nunca
// una barrera — "cualquier persona puede elegir cualquier corte".
// ══════════════════════════════════════════════════════════════════════════

// ── Formas del rostro (Entrega 5 §3) ──────────────────────────────────────

export type FormaRostro =
  | 'ovalado' | 'redondo' | 'cuadrado' | 'corazon'
  | 'alargado' | 'diamante' | 'triangulo';

export const FORMAS_ROSTRO: FormaRostro[] = [
  'ovalado', 'redondo', 'cuadrado', 'corazon', 'alargado', 'diamante', 'triangulo',
];

export interface GuiaFormaRostro {
  forma: FormaRostro;
  nombre: string;
  rasgos: string;
  /** Qué busca el corte. Redactado con el vocabulario permitido. */
  vector: string;
}

// ── Índice arquitectónico (Keila, respuesta 5) ────────────────────────────

export type LargoCorte = 'muy_corto' | 'corto' | 'medio' | 'largo' | 'muy_largo';
export type CapasCorte = 'sin_capas' | 'minimas' | 'moderadas' | 'abundantes';
export type DensidadCabello = 'baja' | 'media' | 'alta';
export type TexturaCorte = 'liso' | 'ondulado' | 'rizado' | 'afro';

/** Filtro de búsqueda OPCIONAL. Nunca excluye por sí solo. */
export type EtiquetaGenero = 'sugerido_mujeres' | 'sugerido_hombres' | 'unisex';

export type TolerarMantenimiento = 'baja' | 'media' | 'alta';

// ── Compatibilidad por tipo de cabello (PR-03) ────────────────────────────

/**
 * 'ideal'        → su hábitat natural.
 * 'condicionado' → aparece CON su nota honesta visible.
 * 'incompatible' → NI APARECE en los resultados.
 */
export type NivelCompatibilidad = 'ideal' | 'condicionado' | 'incompatible';

export interface CompatibilidadTipo {
  /** Familias de patrón: '1', '2', '3', '4' (o subtipos como '2C', '4C'). */
  tipos: string[];
  nivel: NivelCompatibilidad;
  nota?: string;
  /** Variante que resuelve la condición, si la hay. */
  variante?: string;
}

// ── Rostros ───────────────────────────────────────────────────────────────

export interface PrecaucionRostro {
  forma: FormaRostro;
  /** Nota honesta, con vocabulario permitido. */
  nota: string;
  variante?: string;
}

// ── Ficha de corte ────────────────────────────────────────────────────────

export interface FichaCorte {
  clave: string;             // 'W-01', 'M-02'…
  nombre: string;
  etiquetaGenero: EtiquetaGenero;
  // Índice arquitectónico
  largo: LargoCorte;
  capas: CapasCorte;
  densidadIdeal: DensidadCabello[];
  textura: TexturaCorte[];
  // Contenido de la ficha
  estructura: string;
  /** PR-04 · "donde termina el corte, mira el ojo". */
  lineaTermino: string;
  /** PR-02 · dónde pone su volumen este corte. */
  volumenEn: string;
  rostrosFavorece: FormaRostro[];
  rostrosPrecaucion: PrecaucionRostro[];
  compatibilidad: CompatibilidadTipo[];
  /** PR-06 · ciclo de vida útil en semanas [min, max]. */
  cicloSemanas: [number, number];
  mantenimiento: string;
  tecnicaClave: string;
  /** PR-05 · el flequillo o la raya pelean con remolinos. */
  requiereFlequillo?: boolean;
  requiereRaya?: 'central' | 'lateral' | 'cualquiera';
  notasInternas?: string;
}

// ── Perfil de crecimiento (dato nuevo de cabina, PR-05) ───────────────────

export type DireccionCrecimiento = 'hacia_adelante' | 'hacia_atras' | 'lateral' | 'irregular';

export interface PerfilCrecimiento {
  /** Remolino frontal / coronilla marcado que vota contra flequillos. */
  remolinoFrontal?: boolean;
  remolinoCoronilla?: boolean;
  direccion?: DireccionCrecimiento;
}

// ── Entradas de la matriz (§7.1) ──────────────────────────────────────────

export interface EntradaDiagnosticoCorte {
  /** Tipo/subtipo del diagnóstico vigente ('3B', '4C', '1A'…). */
  tipoCabello?: string;
  densidad?: DensidadCabello;
  grosor?: 'fino' | 'medio' | 'grueso';
  /** Tipo 4: el encogimiento redefine los largos (T4-01). */
  encogimientoAlto?: boolean;
  crecimiento?: PerfilCrecimiento;
}

export interface EntradaSesionCorte {
  formaRostro: FormaRostro;
  toleranciaMantenimiento: TolerarMantenimiento;
  /** PR-01 · lo que la clienta declara pesa MÁS que la heurística. */
  quiereDestacar?: FormaRostro extends never ? never : string[];
  largoDeseado?: LargoCorte[];
  /** Filtro opcional de búsqueda; 'todo' no filtra nada. */
  filtroGenero?: EtiquetaGenero | 'todo';
}

// ── Salida (§7.2 punto 5) ─────────────────────────────────────────────────

export interface MotivoPuntuacion {
  criterio: string;
  puntos: number;
  /** Regla PR-xx que originó el criterio. */
  regla: string;
}

export interface RecomendacionCorte {
  ficha: FichaCorte;
  puntaje: number;
  motivos: MotivoPuntuacion[];
  /** El PORQUÉ visible, en vocabulario permitido. */
  porque: string;
  varianteRecomendada?: string;
  frecuenciaRetoque: string;
  /** Nota honesta si el corte es condicionado o tiene precaución. */
  notaHonesta?: string;
}

export interface ResultadoMatriz {
  /** Top 3 (§7.2). */
  recomendaciones: RecomendacionCorte[];
  /** Cortes descartados y por qué — transparencia, no se ocultan. */
  descartados: { clave: string; nombre: string; motivo: string }[];
  /** Advertencias de remolinos que no llegaron a excluir (PR-05). */
  advertencias: string[];
}
