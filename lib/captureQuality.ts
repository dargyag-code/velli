import { AnguloCaptura, EstadoCabelloFoto, CaptureMetadata } from './types';

// ── Capturar frame ─────────────────────────────────────────────────────────

export function capturarFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  const webp = canvas.toDataURL('image/webp', 0.92);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', 0.90);
}

export function detectarFormato(dataUrl: string): 'webp' | 'jpeg' {
  return dataUrl.startsWith('data:image/webp') ? 'webp' : 'jpeg';
}

// ── Variable 1: Distancia ──────────────────────────────────────────────────
// BUG-2 RECALIBRACIÓN: rango estricto 35%-65% (antes 25%-55%).
// El cabello/cara debe ocupar entre 35% y 65% del frame.
// Fuera de ese rango, la foto NO sirve para análisis capilar fiable.

export interface DistanceResult {
  status: 'too_close' | 'perfect' | 'too_far' | 'no_face';
  faceRatio: number;
  message: string;
}

const DIST_MIN = 0.35;
const DIST_MAX = 0.65;

export async function evaluarDistancia(video: HTMLVideoElement): Promise<DistanceResult> {
  if ('FaceDetector' in window) {
    try {
      const detector = new (window as any).FaceDetector({ fastMode: true });
      const faces = await detector.detect(video);

      if (faces.length === 0) {
        return { status: 'no_face', faceRatio: 0, message: 'No se detecta el rostro — enfoca a la clienta' };
      }

      const face = faces[0].boundingBox;
      const faceRatio = face.height / video.videoHeight;

      if (faceRatio > DIST_MAX) {
        return { status: 'too_close', faceRatio, message: 'Muy cerca — aléjate un poco (rostro <65% del frame)' };
      }
      if (faceRatio < DIST_MIN) {
        return { status: 'too_far', faceRatio, message: 'Muy lejos — acércate (rostro >35% del frame)' };
      }
      return { status: 'perfect', faceRatio, message: 'Distancia perfecta' };
    } catch {
      // Si FaceDetector falla, no podemos validar distancia → marcamos faceRatio = -1
      // y el score le da 0 puntos (en vez de los 25 que daba antes por defecto).
      return { status: 'no_face', faceRatio: -1, message: 'No se pudo medir distancia' };
    }
  }
  // Sin FaceDetector API disponible (Firefox, etc.) → faceRatio = -1, score = 0
  return { status: 'no_face', faceRatio: -1, message: 'Tu navegador no permite detección de rostro' };
}

// ── Variable 2: Iluminación ────────────────────────────────────────────────
// BUG-2 RECALIBRACIÓN: rango óptimo estricto 100-180 (BT.601), antes era 80-200.
// Fuera del rango óptimo, score < 25 (parcial o cero, sin tolerancia generosa).

export interface LightResult {
  status: 'too_dark' | 'perfect' | 'too_bright';
  luminance: number;
  message: string;
}

const LIGHT_OPT_MIN = 100;
const LIGHT_OPT_MAX = 180;

let _lightCanvas: HTMLCanvasElement | null = null;

export function evaluarIluminacion(video: HTMLVideoElement): LightResult {
  if (!_lightCanvas) {
    _lightCanvas = document.createElement('canvas');
    _lightCanvas.width = 160;
    _lightCanvas.height = 120;
  }
  const canvas = _lightCanvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, 160, 120);

  const imageData = ctx.getImageData(0, 0, 160, 120);
  const pixels = imageData.data;
  let total = 0;
  const pixelCount = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    total += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }
  const avg = total / pixelCount;

  if (avg < LIGHT_OPT_MIN) return { status: 'too_dark', luminance: avg, message: 'Necesitas más luz — busca una ventana' };
  if (avg > LIGHT_OPT_MAX) return { status: 'too_bright', luminance: avg, message: 'Demasiada luz directa — muévete a la sombra' };
  return { status: 'perfect', luminance: avg, message: 'Iluminación perfecta' };
}

// ── Variable 3: Enfoque (Laplacian Variance) ───────────────────────────────
// BUG-2 RECALIBRACIÓN: thresholds más estrictos.
// > 250 → 25/25 (sharp), 100-250 → parcial (15/25), < 100 → 0/25 (rechazo).

export interface FocusResult {
  status: 'blurry' | 'acceptable' | 'sharp';
  sharpnessScore: number;
  message: string;
}

const FOCUS_SHARP = 250;
const FOCUS_MIN = 100;

let _focusCanvas: HTMLCanvasElement | null = null;

export function evaluarEnfoque(video: HTMLVideoElement): FocusResult {
  const W = 200;
  const H = 150;
  if (!_focusCanvas) {
    _focusCanvas = document.createElement('canvas');
    _focusCanvas.width = W;
    _focusCanvas.height = H;
  }
  const canvas = _focusCanvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  const gray = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
  }

  let sum = 0;
  let sqSum = 0;
  let count = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      const lap =
        -gray[idx - W - 1] - gray[idx - W] - gray[idx - W + 1]
        - gray[idx - 1] + 8 * gray[idx] - gray[idx + 1]
        - gray[idx + W - 1] - gray[idx + W] - gray[idx + W + 1];
      sum += lap;
      sqSum += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sqSum / count - mean * mean;

  if (variance < FOCUS_MIN) return { status: 'blurry', sharpnessScore: variance, message: 'Imagen borrosa — mantén el celular firme' };
  if (variance < FOCUS_SHARP) return { status: 'acceptable', sharpnessScore: variance, message: 'Enfoque aceptable' };
  return { status: 'sharp', sharpnessScore: variance, message: 'Enfoque excelente' };
}

// ── Variable 4: Secuencia de ángulos + DeviceOrientation real ─────────────

export const SECUENCIA_ANGULOS: Array<{
  angulo: AnguloCaptura;
  titulo: string;
  instruccion: string;
  icono: string;
}> = [
  {
    angulo: 'frontal',
    titulo: 'Toma 1: Frontal',
    instruccion: 'Cámara a la altura de los ojos. Cabello caído de forma natural.',
    icono: 'user',
  },
  {
    angulo: 'lateral',
    titulo: 'Toma 2: Lateral',
    instruccion: 'Gira a la clienta 90° de perfil. Muestra el volumen y la densidad del cabello.',
    icono: 'arrow-right',
  },
  {
    angulo: 'corona',
    titulo: 'Toma 3: Corona',
    instruccion: 'Desde arriba de la cabeza. Muestra el patrón de la coronilla.',
    icono: 'chevron-down',
  },
];

// BUG-2: validación de pose con DeviceOrientation API real.
// Para "corona" la cámara debe apuntar HACIA ABAJO (beta cerca de 0 o negativo
// según orientación). Para frontal/lateral la cámara está casi vertical (beta ~90°).
// Este es un check best-effort: si la API no está disponible o la pose no
// matchea, no bloqueamos pero registramos en metadata.

export interface OrientationSnapshot {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  matchesAngulo: boolean | null; // null si no se pudo medir
  available: boolean;
}

let _lastOrientation: { alpha: number | null; beta: number | null; gamma: number | null } | null = null;
let _orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;

export function startOrientationTracking(): void {
  if (typeof window === 'undefined') return;
  if (_orientationListener) return;
  _orientationListener = (e: DeviceOrientationEvent) => {
    _lastOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
  };
  window.addEventListener('deviceorientation', _orientationListener);
}

export function stopOrientationTracking(): void {
  if (typeof window === 'undefined' || !_orientationListener) return;
  window.removeEventListener('deviceorientation', _orientationListener);
  _orientationListener = null;
  _lastOrientation = null;
}

export function evaluarOrientacion(angulo: AnguloCaptura): OrientationSnapshot {
  if (!_lastOrientation) {
    return { alpha: null, beta: null, gamma: null, matchesAngulo: null, available: false };
  }
  const { alpha, beta, gamma } = _lastOrientation;
  if (beta === null) {
    return { alpha, beta, gamma, matchesAngulo: null, available: false };
  }

  // Para `corona` (cámara apunta hacia abajo) beta debería estar entre -45 y 45,
  // o > 135 (depende de cómo se sostenga el celular).
  // Para `frontal` y `lateral` el celular está vertical: beta entre 60 y 110.
  let matchesAngulo: boolean;
  if (angulo === 'corona') {
    matchesAngulo = Math.abs(beta) < 45 || Math.abs(beta) > 135;
  } else {
    matchesAngulo = beta > 60 && beta < 110;
  }
  return { alpha, beta, gamma, matchesAngulo, available: true };
}

// ── Variable 5: Estado del cabello ────────────────────────────────────────

export const ESTADOS_CABELLO: Array<{
  valor: EstadoCabelloFoto;
  titulo: string;
  descripcion: string;
  impactoIA: string;
}> = [
  {
    valor: 'seco_natural',
    titulo: 'Seco y natural',
    descripcion: 'Sin producto aplicado, sin lavar hoy',
    impactoIA: 'Estado ideal para el análisis — muestra el patrón real del rizo',
  },
  {
    valor: 'humedo',
    titulo: 'Húmedo',
    descripcion: 'Recién mojado o lavado hace poco',
    impactoIA: 'El rizo se estira cuando está mojado — la IA lo tendrá en cuenta',
  },
  {
    valor: 'con_producto',
    titulo: 'Con producto',
    descripcion: 'Tiene crema, gel u otro producto visible',
    impactoIA: 'El producto altera el brillo y la definición aparente del rizo',
  },
  {
    valor: 'recien_lavado',
    titulo: 'Recién lavado sin producto',
    descripcion: 'Limpio, sin dejar secar completamente',
    impactoIA: 'Buen estado para ver la porosidad real',
  },
];

// ── Score de calidad ───────────────────────────────────────────────────────
// BUG-2 RECALIBRACIÓN COMPLETA:
// Ya no se otorgan "puntos de consolación". Cada eje da 25 sólo si pasa el
// threshold estricto, parcial sólo en zona ámbar, y CERO si está fuera.

export interface CaptureQualityScore {
  total: number;
  desglose: {
    luz: number;
    distancia: number;
    enfoque: number;
    angulos: number;
  };
  nivel: 'excelente' | 'aceptable' | 'baja';
  mensaje: string;
  aceptarCaptura: boolean;
}

export function calcularScoreCaptura(
  fotos: Array<{
    angulo: AnguloCaptura;
    luminancia: number;
    sharpnessScore: number;
    distanciaOk: boolean; // true sólo si faceRatio ∈ [0.35, 0.65]
  }>
): CaptureQualityScore {
  // ── LUZ: 25 si TODAS las fotos en óptimo, parcial si solo algunas, 0 si todas fuera
  const luzPerfecta = fotos.filter((f) => f.luminancia >= LIGHT_OPT_MIN && f.luminancia <= LIGHT_OPT_MAX).length;
  const luzAceptable = fotos.filter(
    (f) => f.luminancia >= LIGHT_OPT_MIN - 30 && f.luminancia <= LIGHT_OPT_MAX + 30
  ).length;
  let luzScore: number;
  if (luzPerfecta === fotos.length) luzScore = 25;
  else if (luzAceptable === fotos.length) luzScore = 12;
  else if (luzAceptable >= 2) luzScore = 6;
  else luzScore = 0;

  // ── DISTANCIA: 25 sólo si TODAS las fotos en rango 35-65%
  // Si faceRatio = -1 (no se pudo medir / no_face), NO contamos como ok.
  const distanciaOkCount = fotos.filter((f) => f.distanciaOk).length;
  let distanciaScore: number;
  if (distanciaOkCount === fotos.length) distanciaScore = 25;
  else if (distanciaOkCount === fotos.length - 1) distanciaScore = 10;
  else distanciaScore = 0;

  // ── ENFOQUE: > 250 todas → 25, todas > 100 → 12, alguna < 100 → 0
  const enfoqueSharp = fotos.filter((f) => f.sharpnessScore > FOCUS_SHARP).length;
  const enfoqueAceptable = fotos.filter((f) => f.sharpnessScore >= FOCUS_MIN).length;
  let enfoqueScore: number;
  if (enfoqueSharp === fotos.length) enfoqueScore = 25;
  else if (enfoqueAceptable === fotos.length) enfoqueScore = 12;
  else enfoqueScore = 0;

  // ── ÁNGULOS: 25 si los 3 ángulos únicos están presentes
  const angulosUnicos = new Set(fotos.map((f) => f.angulo)).size;
  const angulosScore = angulosUnicos === 3 ? 25 : angulosUnicos === 2 ? 12 : 0;

  const total = luzScore + distanciaScore + enfoqueScore + angulosScore;

  let nivel: 'excelente' | 'aceptable' | 'baja';
  let mensaje: string;
  let aceptarCaptura: boolean;

  if (total >= 85) {
    nivel = 'excelente';
    mensaje = 'Excelente calidad de captura. Los datos serán muy precisos.';
    aceptarCaptura = true;
  } else if (total >= 60) {
    nivel = 'aceptable';
    mensaje = 'Calidad aceptable. La IA validará las fotos antes del análisis.';
    aceptarCaptura = true;
  } else {
    nivel = 'baja';
    mensaje = 'La calidad es baja y el análisis no será fiable. Te recomendamos repetir las fotos.';
    aceptarCaptura = false;
  }

  return { total, desglose: { luz: luzScore, distancia: distanciaScore, enfoque: enfoqueScore, angulos: angulosScore }, nivel, mensaje, aceptarCaptura };
}

// ── Validación GPT-4o "es realmente foto de cabello" (segunda capa) ───────
// BUG-2: cuando score < 80, llamamos a /api/validate-hair-photo para verificar
// que las fotos realmente muestran cabello (no rostro completo, no pared, no
// cualquier objeto). Resultado: { sí|no por foto, breakdown }.

export interface HairPhotoValidationResult {
  validas: number;       // cuántas fotos pasaron la validación
  total: number;
  perFoto: Array<{ index: number; isHair: boolean }>;
  blocked: boolean;      // true si 0/total son válidas → bloquear flujo
  warning: boolean;      // true si al menos 1 inválida pero hay otras válidas
  message: string;
}

export async function validarFotosSonDeCabello(fotos: string[]): Promise<HairPhotoValidationResult> {
  try {
    const res = await fetch('/api/validate-hair-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fotos }),
    });
    if (!res.ok) {
      // En caso de fallo del endpoint, NO bloqueamos (failsafe permisivo).
      console.warn('[validarFotosSonDeCabello] API respondió', res.status, '— continuando sin validación');
      return {
        validas: fotos.length,
        total: fotos.length,
        perFoto: fotos.map((_, i) => ({ index: i, isHair: true })),
        blocked: false,
        warning: false,
        message: 'Validación no disponible — continuando.',
      };
    }
    return await res.json();
  } catch (e) {
    console.warn('[validarFotosSonDeCabello] excepción:', e);
    return {
      validas: fotos.length,
      total: fotos.length,
      perFoto: fotos.map((_, i) => ({ index: i, isHair: true })),
      blocked: false,
      warning: false,
      message: 'Validación no disponible — continuando.',
    };
  }
}

// ── Metadata del dispositivo ───────────────────────────────────────────────

export function obtenerMetadataDispositivo(): CaptureMetadata['dispositivo'] {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

export async function obtenerUbicacionAproximada(): Promise<CaptureMetadata['ubicacion'] | undefined> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 3600000,
      });
    });
    return {
      latApprox: Math.round(pos.coords.latitude * 10) / 10,
      lonApprox: Math.round(pos.coords.longitude * 10) / 10,
    };
  } catch {
    return undefined;
  }
}

export function detectarFlash(track: MediaStreamTrack): boolean {
  try {
    const capabilities = (track as any).getCapabilities?.();
    const settings = (track as any).getSettings?.();
    if (capabilities?.torch !== undefined) return settings?.torch === true;
  } catch {}
  return false;
}
