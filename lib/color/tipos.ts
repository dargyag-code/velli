// ══════════════════════════════════════════════════════════════════════════
// Calculadora de color — tipos de entrada y salida (Entrega 3 §7).
// ══════════════════════════════════════════════════════════════════════════

import type { NivelTono, Temperatura, Volumen } from './tablas';

// ── §7.1 Entradas ─────────────────────────────────────────────────────────

/** Del diagnóstico vigente (precargado, CO-02: nunca se abre "en blanco"). */
export interface DiagnosticoColor {
  porosidad?: 'baja' | 'media' | 'alta';
  elasticidad?: 'baja' | 'media' | 'alta';
  /** Bandera médica activa del diagnóstico (Entrega 2 / regla A-06). */
  banderaMedicaActiva?: boolean;
  /** Cuero cabelludo con lesiones, pústulas, descamación severa o sangrado. */
  cueroCabelludoLesionado?: boolean;
  /** Historial de henna, tintes "naturales" o progresivos de procedencia dudosa. */
  hennaOMetales?: 'no' | 'si' | 'dudoso';
  /** Prueba de mechón registrada y superada tras sospecha de henna/metales. */
  pruebaMechonSuperada?: boolean;
  /** Porcentaje de canas 0–100. */
  porcentajeCanas?: number;
  /**
   * El diagnóstico dice «más del 50 %» sin precisar: abarca dos tramos de
   * CO-05 (1/2 tubo, o 3/4 con 20 vol), así que la estilista elige uno.
   */
  canasPorPrecisar?: boolean;
  /** Canas marcadas como resistentes en el diagnóstico. */
  canasResistentes?: boolean;
  /** Historial de decoloración previa (para CO-06). */
  historialDecoloracion?: boolean;
}

/** De la sesión: lo que la estilista completa en la calculadora. */
export interface EntradaSesion {
  /** Nivel natural de la raíz. */
  nivelNatural: NivelTono;
  /** Nivel actual de medios y puntas (si hay artificial). */
  nivelActualLargos?: NivelTono;
  /** true → la zona a trabajar tiene pigmento artificial depositado. */
  pigmentoArtificial: boolean;
  nivelObjetivo: NivelTono;
  temperatura: Temperatura;
  /** Marca seleccionada del inventario activo del salón (kb_marcas). */
  marcaId?: string;
}

// ── §7.3 Salidas ──────────────────────────────────────────────────────────

/** Guardarraíl que impide continuar. La calculadora NO muestra fórmula. */
export interface Bloqueo {
  codigo:
    | 'elasticidad_baja'
    | 'bandera_medica'
    | 'cuero_lesionado'
    | 'henna_metales'
    | 'consentimiento_quimico'
    | 'parche_sensibilidad';
  titulo: string;
  mensaje: string;
  /** Camino previo que la calculadora propone en lugar de la fórmula. */
  caminoPrevio: string;
  /** Texto que debe mostrarse VERBATIM (protocolo de la validación técnica). */
  textoVerbatim?: string;
  /** Semanas de bloqueo antes de reevaluar (REP-1/REP-2 → 4 semanas). */
  reevaluarEnSemanas?: number;
}

export interface Advertencia {
  codigo:
    | 'porosidad_alta'
    | 'porosidad_baja'
    | 'canas_resistentes'
    | 'volumen_restringido'
    | 'prepigmentacion';
  mensaje: string;
}

export type ViaProceso = 'tinte' | 'decapado_decoloracion' | 'cobertura' | 'deposito';

/** §7.3 · "el razonamiento visible": la estilista ve el porqué, no solo el qué. */
export interface GuiaRazonamiento {
  /** Niveles a mover (negativo = oscurecer). */
  nivelesAMover: number;
  via: ViaProceso;
  viaMotivo: string;
  fondoEsperado: string;
  accionSobreFondo: 'neutralizar' | 'aprovechar' | 'equilibrar';
  neutralizacion: string;
  /** Denominación latinoamericana del reflejo (columna 4.1 de la validación). */
  denominacionLatam: string;
  /** Pasos en orden, con su regla de origen (CO-xx). */
  pasos: { regla: string; texto: string }[];
}

/** §7.3 · Fórmula esquemática. 100% EDITABLE por la estilista (validación técnica, resp. 6). */
export interface FormulaSugerida {
  /** Componentes de la mezcla en gramos. */
  componentes: { descripcion: string; gramos: number; notaRegla?: string }[];
  volumen: Volumen;
  /** true → el volumen está bloqueado por regla (CO-05 >75% canas = 20 vol). */
  volumenBloqueado: boolean;
  volumenMotivo?: string;
  proporcion: string;
  tiempoPausa: string;
  /** Origen de proporciones/tiempos: 'carta' o 'orientativo' si no hay marca. */
  origen: 'carta_marca' | 'orientativo';
}

/** CO-10 · Plan Multi-Sesión por Etapas. */
export interface EtapaPlan {
  numero: number;
  titulo: string;
  /** Fondo intermedio estimado al terminar la etapa. */
  fondoIntermedio?: string;
  nivelEstimado?: NivelTono;
  acciones: string[];
  /** Tratamiento reconstructor intermedio agendable. */
  tratamientoIntermedio?: string;
  /** Semanas de espera antes de la siguiente etapa. */
  esperaSemanas?: number;
}

export interface PlanMultiSesion {
  motivo: string;
  etapas: EtapaPlan[];
  /** Hitos visuales para el Pasaporte Capilar. */
  hitosPasaporte: string[];
}

export interface ResultadoCalculadora {
  /** Si hay bloqueos, `formula` y `guia` van undefined: no se muestra fórmula. */
  bloqueos: Bloqueo[];
  advertencias: Advertencia[];
  guia?: GuiaRazonamiento;
  formula?: FormulaSugerida;
  /** Presente cuando el objetivo no cabe en una sesión segura (CO-10). */
  planMultiSesion?: PlanMultiSesion;
  /** Checklist de seguridad §5 que la estilista confirma antes de aplicar. */
  checklistSeguridad: string[];
}

/** Lo que se registra en el historial al confirmar (§7.3). */
export interface RegistroServicioColor {
  clientaId: string;
  formulaFinal: FormulaSugerida;
  proceso: string;
  /** Path de la foto del resultado — pasa por el gating de consentimiento. */
  fotoResultado?: string;
  notas?: string;
}
