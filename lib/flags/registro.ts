// ══════════════════════════════════════════════════════════════════════════
// Feature flags de Velli — registro único (Velli BI · Fase 1 · Etapa 1).
//
// Congelar un módulo = apagar su flag y ocultarlo de la interfaz. NUNCA se
// borra código, datos, tablas, roles ni políticas RLS: encender el flag
// devuelve el módulo tal como estaba.
//
// Precedencia (lib/flags/evaluar.ts): salón > entorno > valor por defecto
// del entorno. Un flag 'retirado' no se enciende con ningún override.
// Decisiones de producto: docs/velli-bi/00-auditoria.md.
// ══════════════════════════════════════════════════════════════════════════

export type Entorno = 'production' | 'preview' | 'development' | 'test';

export const ENTORNOS: readonly Entorno[] = ['production', 'preview', 'development', 'test'];

export type FlagId =
  | 'cotizador'
  | 'cortes'
  | 'ia_facial'
  | 'app_clientas'
  | 'marketplace'
  | 'cuentas_cadena'
  | 'resenas_publicas';

/** 'congelado' se puede encender por entorno o por salón (pilotos);
 *  'retirado' salió del producto y queda apagado siempre. */
export type EstadoFlag = 'activo' | 'congelado' | 'retirado';

export interface DefinicionFlag {
  id: FlagId;
  nombre: string;
  estado: EstadoFlag;
  descripcion: string;
  /** Valor sin overrides, por entorno. */
  porDefecto: Record<Entorno, boolean>;
  /** Flujos de kb_flujos que pertenecen al módulo: con el flag apagado el
   *  asistente no los muestra, aunque sigan publicados en la base. */
  flujosKB?: readonly string[];
}

const APAGADO: Record<Entorno, boolean> = {
  production: false,
  preview: false,
  development: false,
  test: false,
};

export const FLAGS: Record<FlagId, DefinicionFlag> = {
  cotizador: {
    id: 'cotizador',
    nombre: 'Cotizador y precios',
    estado: 'activo',
    descripcion:
      'Módulo 1 de Velli BI: plantilla de precios versionada, cotización en 3 toques por WhatsApp y confirmación de cobro. Apagado por defecto en producción hasta aplicar la migración SQL.',
    porDefecto: {
      production: false,
      preview: true,
      development: true,
      test: false,
    },
  },
  cortes: {
    id: 'cortes',
    nombre: 'Corte por forma de rostro',
    estado: 'congelado',
    descripcion:
      'Matriz de cortes (/cortes), botón «Cortes» en la ficha de la clienta y flujo de remolinos del asistente. lib/cortes/preagenda.ts se conserva para los futuros avisos de retoque.',
    porDefecto: APAGADO,
    flujosKB: ['flujo.crecimiento'],
  },
  ia_facial: {
    id: 'ia_facial',
    nombre: 'IA facial para cortes',
    estado: 'congelado',
    descripcion:
      'Detección facial con IA (Pro+IA). Antes era NEXT_PUBLIC_FEATURE_IA_FACIAL, que sigue funcionando como override de entorno.',
    porDefecto: APAGADO,
  },
  app_clientas: {
    id: 'app_clientas',
    nombre: 'App para clientas y Pasaporte Capilar',
    estado: 'congelado',
    descripcion:
      'Sin código propio. El flag oculta las menciones al Pasaporte Capilar en la interfaz de la estilista; los textos de la base de conocimiento no se tocan.',
    porDefecto: APAGADO,
  },
  marketplace: {
    id: 'marketplace',
    nombre: 'Marketplace de salones',
    estado: 'congelado',
    descripcion: 'Sin código. Reservado para que lo que se construya nazca detrás del flag.',
    porDefecto: APAGADO,
  },
  cuentas_cadena: {
    id: 'cuentas_cadena',
    nombre: 'Cuentas para cadenas de salones',
    estado: 'congelado',
    descripcion:
      'Sin código. No es el rol corporativo (equipo Velli que administra la librería), que sigue activo.',
    porDefecto: APAGADO,
  },
  resenas_publicas: {
    id: 'resenas_publicas',
    nombre: 'Reseñas públicas de «precio respetado»',
    estado: 'retirado',
    descripcion: 'Salió del producto. Sin código; ningún override la enciende.',
    porDefecto: APAGADO,
  },
};

export const FLAG_IDS = Object.keys(FLAGS) as FlagId[];

export function esFlagId(v: string): v is FlagId {
  return Object.prototype.hasOwnProperty.call(FLAGS, v);
}
