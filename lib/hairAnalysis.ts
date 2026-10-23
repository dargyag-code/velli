import { EstadoCabelloFoto, AnguloCaptura } from './types';

export interface HairAnalysisResult {
  tipoRizoPrincipal: string;
  tiposSecundarios: string[];
  observaciones: string;
  confianza: 'alta' | 'media' | 'baja';
  // Campos extendidos para modo express
  porosidad?: 'baja' | 'media' | 'alta';
  densidad?: 'baja' | 'media' | 'alta';
  danoVisible?: 'ninguno' | 'leve' | 'moderado' | 'severo';
  // Información de cupo IA (D1 / P3)
  restantes?: number;
  avisoOchentaPorCiento?: boolean;
}

const CONTEXTO_ESTADO: Record<EstadoCabelloFoto, string> = {
  seco_natural: 'El cabello está SECO Y SIN PRODUCTO — estado ideal para diagnóstico. El patrón visible es el patrón real.',
  humedo: 'El cabello está HÚMEDO — el rizo se estira cuando está mojado. El tipo real probablemente sea más cerrado que lo visible.',
  con_producto: 'El cabello tiene PRODUCTO APLICADO — el brillo y la definición pueden estar alterados. Ajusta la evaluación de porosidad.',
  recien_lavado: 'El cabello está RECIÉN LAVADO SIN PRODUCTO — buen estado para evaluar porosidad.',
};

const PROMPT_ANALISIS = `Eres un experto en análisis de texturas capilares. Analiza las fotos de cabello y determina:

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

// Sin respaldo de otro proveedor (decisión D2, docs/velli-bi/01-costo-ia.md):
// cuando la IA no puede responder, la cámara ofrece seguir con el diagnóstico
// manual en vez de mostrar el error técnico. `message` es la causa, en
// palabras de la estilista.
export type MotivoSinIA =
  | 'sin_conexion'
  | 'sin_respuesta'
  | 'limite_hora'
  | 'plan_sin_ia'
  | 'tope_ia_alcanzado';

export class IANoDisponibleError extends Error {
  readonly motivo: MotivoSinIA;
  readonly codigo?: 'PLAN_SIN_IA' | 'TOPE_IA_ALCANZADO';

  constructor(
    motivo: MotivoSinIA,
    message: string,
    codigo?: 'PLAN_SIN_IA' | 'TOPE_IA_ALCANZADO'
  ) {
    super(message);
    this.name = 'IANoDisponibleError';
    this.motivo = motivo;
    this.codigo = codigo;
  }
}

function mensajeLimiteHora(retryAfter: string | null): string {
  const base = 'Llegaste al límite de análisis con IA por hora.';
  const segundos = Number(retryAfter);
  if (!Number.isFinite(segundos) || segundos <= 0) return base;
  const minutos = Math.ceil(segundos / 60);
  return `${base} Vuelve a estar disponible en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;
}

export async function analizarCabello(
  fotos: string[],
  estadoCabello: EstadoCabelloFoto,
  angulos: AnguloCaptura[]
): Promise<HairAnalysisResult> {
  let response: Response;
  try {
    response = await fetch('/api/analyze-hair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fotos, estadoCabello, angulos }),
    });
  } catch {
    // fetch solo se rechaza cuando la petición no llega al servidor.
    throw new IANoDisponibleError('sin_conexion', 'No hay conexión a internet para usar la IA.');
  }

  if (response.status === 429) {
    const err429 = await response.json().catch(() => ({}));
    if (err429?.codigo === 'TOPE_IA_ALCANZADO') {
      throw new IANoDisponibleError(
        'tope_ia_alcanzado',
        err429.error || 'Alcanzaste el tope de análisis con IA de este mes.',
        'TOPE_IA_ALCANZADO'
      );
    }
    throw new IANoDisponibleError('limite_hora', mensajeLimiteHora(response.headers.get('Retry-After')));
  }
  // 5xx: Claude falló, falta la llave o la función se agotó (504 sin JSON).
  if (response.status >= 500) {
    throw new IANoDisponibleError('sin_respuesta', 'La IA no respondió esta vez.');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err?.codigo === 'PLAN_SIN_IA') {
      throw new IANoDisponibleError(
        'plan_sin_ia',
        err.error || 'Tu plan actual no incluye análisis con IA por foto.',
        'PLAN_SIN_IA'
      );
    }
    if (err?.codigo === 'TOPE_IA_ALCANZADO') {
      throw new IANoDisponibleError(
        'tope_ia_alcanzado',
        err.error || 'Alcanzaste el tope de análisis con IA de este mes.',
        'TOPE_IA_ALCANZADO'
      );
    }
    throw new Error(err.error || `Error ${response.status} del servidor`);
  }

  const data = await response.json();
  return data as HairAnalysisResult;
}

export { PROMPT_ANALISIS, CONTEXTO_ESTADO };
