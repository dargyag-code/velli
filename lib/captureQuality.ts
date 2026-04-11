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

export interface DistanceResult {
  status: 'too_close' | 'perfect' | 'too_far' | 'no_face';
  faceRatio: number;
  message: string;
}

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

      if (faceRatio > 0.55) {
        return { status: 'too_close', faceRatio, message: 'Muy cerca — aléjate un poco' };
      }
      if (faceRatio < 0.25) {
        return { status: 'too_far', faceRatio, message: 'Muy lejos — acércate al cabello' };
      }
      return { status: 'perfect', faceRatio, message: 'Distancia perfecta' };
    } catch {
      return { status: 'perfect', faceRatio: -1, message: 'Captura lista' };
    }
  }
  return { status: 'perfect', faceRatio: -1, message: 'Captura lista' };
}

// ── Variable 2: Iluminación ────────────────────────────────────────────────

export interface LightResult {
  status: 'too_dark' | 'perfect' | 'too_bright';
  luminance: number;
  message: string;
}

// Reusa un canvas pequeño para no crear uno nuevo en cada llamada
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

  if (avg < 80) return { status: 'too_dark', luminance: avg, message: 'Necesitas más luz — busca una ventana' };
  if (avg > 200) return { status: 'too_bright', luminance: avg, message: 'Demasiada luz directa — muévete a la sombra' };
  return { status: 'perfect', luminance: avg, message: 'Iluminación perfecta' };
}

// ── Variable 3: Enfoque ────────────────────────────────────────────────────

export interface FocusResult {
  status: 'blurry' | 'acceptable' | 'sharp';
  sharpnessScore: number;
  message: string;
}

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

  if (variance < 100) return { status: 'blurry', sharpnessScore: variance, message: 'Imagen borrosa — mantén el celular firme' };
  if (variance < 300) return { status: 'acceptable', sharpnessScore: variance, message: 'Enfoque aceptable' };
  return { status: 'sharp', sharpnessScore: variance, message: 'Enfoque excelente' };
}

// ── Variable 4: Secuencia de ángulos ──────────────────────────────────────

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
    distanciaOk: boolean;
  }>
): CaptureQualityScore {
  const avgLuminance = fotos.reduce((s, f) => s + f.luminancia, 0) / fotos.length;
  let luzScore: number;
  if (avgLuminance >= 80 && avgLuminance <= 200) luzScore = 25;
  else if (avgLuminance >= 60 && avgLuminance <= 220) luzScore = 15;
  else luzScore = 5;

  const distanciaOkCount = fotos.filter((f) => f.distanciaOk).length;
  const distanciaScore = Math.round((distanciaOkCount / fotos.length) * 25);

  const avgSharpness = fotos.reduce((s, f) => s + f.sharpnessScore, 0) / fotos.length;
  let enfoqueScore: number;
  if (avgSharpness >= 300) enfoqueScore = 25;
  else if (avgSharpness >= 100) enfoqueScore = 15;
  else enfoqueScore = 5;

  const angulosUnicos = new Set(fotos.map((f) => f.angulo)).size;
  const angulosScore = angulosUnicos === 3 ? 25 : angulosUnicos === 2 ? 15 : 5;

  const total = luzScore + distanciaScore + enfoqueScore + angulosScore;

  let nivel: 'excelente' | 'aceptable' | 'baja';
  let mensaje: string;
  let aceptarCaptura: boolean;

  if (total >= 80) {
    nivel = 'excelente';
    mensaje = '¡Excelente calidad de captura! Los datos serán muy precisos.';
    aceptarCaptura = true;
  } else if (total >= 60) {
    nivel = 'aceptable';
    mensaje = 'Calidad aceptable. Para mayor precisión, considera retomar las fotos con mejor iluminación.';
    aceptarCaptura = true;
  } else {
    nivel = 'baja';
    mensaje = 'La calidad es baja y el análisis podría no ser preciso. Te recomendamos tomar las fotos de nuevo.';
    aceptarCaptura = false;
  }

  return { total, desglose: { luz: luzScore, distancia: distanciaScore, enfoque: enfoqueScore, angulos: angulosScore }, nivel, mensaje, aceptarCaptura };
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
