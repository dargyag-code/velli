'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Camera, RotateCcw, Check, Sparkles, EyeOff,
  User, ArrowRight, ChevronDown, Loader2, AlertCircle, SwitchCamera, Image as ImageIcon,
} from 'lucide-react';
import {
  EstadoCabelloFoto, AnguloCaptura, CaptureMetadata,
} from '@/lib/types';
import {
  ESTADOS_CABELLO, SECUENCIA_ANGULOS,
  evaluarIluminacion, evaluarEnfoque, evaluarDistancia,
  capturarFrame, detectarFormato, calcularScoreCaptura,
  CaptureQualityScore, LightResult, FocusResult, DistanceResult,
  obtenerMetadataDispositivo, obtenerUbicacionAproximada, detectarFlash,
  validarFotosSonDeCabello, type HairPhotoValidationResult,
} from '@/lib/captureQuality';
import { analizarCabello, HairAnalysisResult } from '@/lib/hairAnalysis';
import { Btn, Chip } from '@/components/v2';
import { vibracionSutil, vibracionConfirmacion, vibracionError, sonidoCaptura, sonidoScoreAlto } from '@/lib/haptics';

// ── Tipos internos ─────────────────────────────────────────────────────────
type FlowStep = 'estado' | 'camera' | 'score' | 'gallery' | 'analyzing' | 'result' | 'error';

interface CapturedPhoto {
  dataUrl: string;
  angulo: AnguloCaptura;
  luminancia: number;
  sharpnessScore: number;
  faceRatio: number;
  resolucion: { width: number; height: number };
  formato: 'webp' | 'jpeg';
  timestamp: string;
}

interface Props {
  onComplete: (
    tipoRizoPrincipal: string,
    tiposSecundarios: string[],
    captureMetadata: CaptureMetadata,
    analysisResult: HairAnalysisResult,
    fotoUrls: string[]
  ) => void;
  onCorrectAI: (
    iaTipoSugerido: string,
    captureMetadata: CaptureMetadata,
    analysisResult: HairAnalysisResult,
    fotoUrls: string[]
  ) => void;
  onCancel: () => void;
}

// ── Color del indicador de distancia ──────────────────────────────────────
function colorDistancia(status: DistanceResult['status'] | null): string {
  if (!status) return 'rgba(232, 194, 144, 0.4)';
  if (status === 'perfect') return '#E8C290';
  if (status === 'too_close' || status === 'too_far') return '#EF4444';
  return '#F59E0B';
}

// ── Guía de ángulo (SVG overlay) ──────────────────────────────────────────
function AnguloGuide({ angulo }: { angulo: AnguloCaptura }) {
  return (
    <svg
      viewBox="0 0 200 280"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.35 }}
    >
      {angulo === 'frontal' && (
        <ellipse cx="100" cy="140" rx="60" ry="95" fill="none" stroke="#E8C290" strokeWidth="2" strokeDasharray="8 4" />
      )}
      {angulo === 'lateral' && (
        <ellipse cx="100" cy="140" rx="40" ry="95" fill="none" stroke="#E8C290" strokeWidth="2" strokeDasharray="8 4" />
      )}
      {angulo === 'corona' && (
        <circle cx="100" cy="140" r="70" fill="none" stroke="#E8C290" strokeWidth="2" strokeDasharray="8 4" />
      )}
    </svg>
  );
}

function AnguloIcon({ icono, size = 16 }: { icono: string; size?: number }) {
  if (icono === 'user') return <User size={size} />;
  if (icono === 'arrow-right') return <ArrowRight size={size} />;
  return <ChevronDown size={size} />;
}

// ── Targeting frame corners (estilo CameraV2 del diseño) ──────────────────
function TargetingCorners() {
  const corners: Array<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    borders: ('top' | 'bottom' | 'left' | 'right')[];
  }> = [
    { top: 0, left: 0, borders: ['top', 'left'] },
    { top: 0, right: 0, borders: ['top', 'right'] },
    { bottom: 0, left: 0, borders: ['bottom', 'left'] },
    { bottom: 0, right: 0, borders: ['bottom', 'right'] },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 24,
            height: 24,
            top: c.top,
            bottom: c.bottom,
            left: c.left,
            right: c.right,
            borderTop: c.borders.includes('top') ? '2px solid #E8C290' : 'none',
            borderBottom: c.borders.includes('bottom') ? '2px solid #E8C290' : 'none',
            borderLeft: c.borders.includes('left') ? '2px solid #E8C290' : 'none',
            borderRight: c.borders.includes('right') ? '2px solid #E8C290' : 'none',
          }}
        />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════
export default function CameraCapture({ onComplete, onCorrectAI, onCancel }: Props) {
  const [flowStep, setFlowStep] = useState<FlowStep>('estado');
  const [estadoCabello, setEstadoCabello] = useState<EstadoCabelloFoto | null>(null);
  const [anguloIndex, setAnguloIndex] = useState(0);
  const [fotos, setFotos] = useState<CapturedPhoto[]>([]);
  const [scoreResult, setScoreResult] = useState<CaptureQualityScore | null>(null);
  const [analysisResult, setAnalysisResult] = useState<HairAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);

  const [lightResult, setLightResult] = useState<LightResult | null>(null);
  const [focusResult, setFocusResult] = useState<FocusResult | null>(null);
  const [distanceResult, setDistanceResult] = useState<DistanceResult | null>(null);
  // BUG-2: resultado de validación GPT-4o "es realmente cabello".
  // Sólo se llena si score < 80 y se ejecutó la 2ª capa.
  const [hairValidation, setHairValidation] = useState<HairPhotoValidationResult | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const facingModeRef = useRef<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  // ── Cámara ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isLocalhost = typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isHttps = typeof window !== 'undefined' &&
        window.location.protocol === 'https:';

      const msg = (!isLocalhost && !isHttps)
        ? 'La cámara solo funciona en localhost o HTTPS. Accediste por IP sin SSL — usa la opción de subir foto desde galería.'
        : 'Tu navegador no soporta acceso a la cámara. Usa la opción de subir foto desde galería.';

      setError(msg);
      setFlowStep('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const e = err as Error;
      let msg = 'No se pudo acceder a la cámara.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = 'Permiso de cámara denegado. Ve a los permisos del navegador y permite el acceso a la cámara, o usa la opción de subir foto desde galería.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        msg = 'No se encontró ninguna cámara en este dispositivo. Usa la opción de subir foto desde galería.';
      } else if (e.name === 'NotReadableError') {
        msg = 'La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.';
      } else if (e.message) {
        msg = `Error de cámara: ${e.message}`;
      }
      setError(msg);
      setFlowStep('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const next: 'environment' | 'user' = facingModeRef.current === 'environment' ? 'user' : 'environment';
    facingModeRef.current = next;
    setFacingMode(next);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // Silenciar — el botón quedará disponible para reintentar.
    }
  }, []);

  useEffect(() => {
    if (flowStep === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
  }, [flowStep, startCamera, stopCamera]);

  // ── Loop de calidad ───────────────────────────────────────────────────
  useEffect(() => {
    if (flowStep !== 'camera') return;

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || processingRef.current) return;
      processingRef.current = true;
      try {
        const light = evaluarIluminacion(video);
        const focus = evaluarEnfoque(video);
        const distance = await evaluarDistancia(video);
        setLightResult(light);
        setFocusResult(focus);
        setDistanceResult(distance);
      } finally {
        processingRef.current = false;
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flowStep]);

  // ── Capturar foto ─────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturando) return;
    setCapturando(true);

    const angulo = SECUENCIA_ANGULOS[anguloIndex].angulo;
    const dataUrl = capturarFrame(video);
    const formato = detectarFormato(dataUrl);

    const light = evaluarIluminacion(video);
    const focus = evaluarEnfoque(video);
    const distance = await evaluarDistancia(video);

    const foto: CapturedPhoto = {
      dataUrl,
      angulo,
      luminancia: light.luminance,
      sharpnessScore: focus.sharpnessScore,
      faceRatio: distance.faceRatio,
      resolucion: { width: video.videoWidth, height: video.videoHeight },
      formato,
      timestamp: new Date().toISOString(),
    };

    vibracionSutil();
    sonidoCaptura();

    const nuevasFotos = [...fotos, foto];
    setFotos(nuevasFotos);

    if (anguloIndex < SECUENCIA_ANGULOS.length - 1) {
      setAnguloIndex(anguloIndex + 1);
    } else {
      // BUG-2: rango estricto 0.35-0.65 y faceRatio === -1 (no se midió)
      // ya NO se considera ok automáticamente.
      const scoreInput = nuevasFotos.map((f) => ({
        angulo: f.angulo,
        luminancia: f.luminancia,
        sharpnessScore: f.sharpnessScore,
        distanciaOk: f.faceRatio >= 0.35 && f.faceRatio <= 0.65,
      }));
      const score = calcularScoreCaptura(scoreInput);
      setScoreResult(score);

      if (score.nivel === 'excelente') {
        vibracionConfirmacion();
        sonidoScoreAlto();
      } else if (!score.aceptarCaptura) {
        vibracionError();
      }

      stopCamera();
      setFlowStep('score');
    }

    setCapturando(false);
  }, [anguloIndex, fotos, capturando, stopCamera]);

  const handleRetomar = useCallback(() => {
    setFotos([]);
    setAnguloIndex(0);
    setScoreResult(null);
    setError(null);
    setFlowStep('camera');
  }, []);

  const handleAnalizar = useCallback(async () => {
    if (!estadoCabello) return;
    setFlowStep('analyzing');
    setError(null);

    try {
      // BUG-2: 2ª capa de validación GPT-4o sólo cuando score < 80
      const fotoUrls = fotos.map((f) => f.dataUrl);
      const score = scoreResult?.total ?? 0;
      if (score < 80) {
        console.log('[BUG-2] score', score, '< 80 — ejecutando validación GPT-4o de cabello');
        const validation = await validarFotosSonDeCabello(fotoUrls);
        console.log('[BUG-2] validación GPT-4o:', validation);
        setHairValidation(validation);

        if (validation.blocked) {
          // Las 3 fotos NO muestran cabello → bloquear y volver al score con mensaje
          setError(validation.message);
          setFlowStep('score');
          vibracionError();
          return;
        }
        // warning (1-2 fotos NO) o todas válidas → continuamos
      }

      const result = await analizarCabello(
        fotoUrls,
        estadoCabello,
        fotos.map((f) => f.angulo)
      );
      setAnalysisResult(result);
      setFlowStep('result');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al analizar el cabello';
      setError(msg);
      setFlowStep('score');
    }
  }, [fotos, estadoCabello, scoreResult]);

  const buildMetadata = useCallback(async (): Promise<CaptureMetadata | null> => {
    if (!estadoCabello) return null;
    const dispositivo = obtenerMetadataDispositivo();
    const ubicacion = await obtenerUbicacionAproximada();
    const track = streamRef.current?.getVideoTracks()[0];
    return {
      estadoCabello,
      qualityScore: scoreResult?.total ?? 0,
      qualityDesglose: scoreResult?.desglose ?? { luz: 0, distancia: 0, enfoque: 0, angulos: 0 },
      fotos: fotos.map((f) => ({
        angulo: f.angulo,
        timestamp: f.timestamp,
        luminanciaPromedio: f.luminancia,
        sharpnessScore: f.sharpnessScore,
        faceRatio: f.faceRatio,
        resolucion: f.resolucion,
        formato: f.formato,
        flashActivo: track ? detectarFlash(track) : false,
        orientacion: f.resolucion.width > f.resolucion.height ? 'landscape' : 'portrait',
      })),
      dispositivo,
      ubicacion,
      // BUG-2: incluye el resultado de la validación GPT-4o si se ejecutó
      hairPhotoValidation: hairValidation ?? undefined,
    };
  }, [estadoCabello, scoreResult, fotos, hairValidation]);

  const handleCorregirManual = useCallback(async () => {
    // BUG-1 LOG · cada paso de la función
    console.log('[BUG-1] handleCorregirManual: ENTRÓ');
    console.log('[BUG-1] handleCorregirManual: analysisResult?', !!analysisResult, 'estadoCabello?', !!estadoCabello);
    if (!analysisResult || !estadoCabello) {
      console.log('[BUG-1] handleCorregirManual: SALIDA temprana (falta analysisResult o estadoCabello)');
      return;
    }
    console.log('[BUG-1] handleCorregirManual: llamando buildMetadata...');
    const metadata = await buildMetadata();
    console.log('[BUG-1] handleCorregirManual: buildMetadata devolvió', !!metadata);
    if (!metadata) {
      console.log('[BUG-1] handleCorregirManual: SALIDA por metadata null');
      return;
    }
    const fotoUrls = fotos.length > 0 ? fotos.map((f) => f.dataUrl) : uploadedPhotos;
    console.log('[BUG-1] handleCorregirManual: fotoUrls.length =', fotoUrls.length, '· iaTipoSugerido =', analysisResult.tipoRizoPrincipal);
    console.log('[BUG-1] handleCorregirManual: llamando onCorrectAI(...)');
    onCorrectAI(analysisResult.tipoRizoPrincipal, metadata, analysisResult, fotoUrls);
    console.log('[BUG-1] handleCorregirManual: onCorrectAI retornó');
  }, [analysisResult, estadoCabello, buildMetadata, fotos, uploadedPhotos, onCorrectAI]);

  const handleConfirmar = useCallback(async () => {
    if (!analysisResult || !estadoCabello) return;
    const metadata = await buildMetadata();
    if (!metadata) return;
    const fotoUrls = fotos.length > 0 ? fotos.map((f) => f.dataUrl) : uploadedPhotos;
    onComplete(analysisResult.tipoRizoPrincipal, analysisResult.tiposSecundarios ?? [], metadata, analysisResult, fotoUrls);
  }, [analysisResult, estadoCabello, buildMetadata, fotos, uploadedPhotos, onComplete]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (!files.length) return;

    setError(null);

    let completed = 0;
    const results: string[] = new Array(files.length);

    files.forEach((file, i) => {
      const reader = new FileReader();

      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        results[i] = dataUrl;
        completed += 1;

        if (completed === files.length) {
          setUploadedPhotos([...results]);
          setFlowStep('gallery');
        }
      };

      reader.onerror = () => {
        setError(`No se pudo leer ${file.name}: ${reader.error?.message || 'error desconocido'}`);
        setFlowStep('error');
      };

      reader.readAsDataURL(file);
    });
  }, []);

  const handleAnalyzeUploaded = useCallback(async (photos: string[]) => {
    setError(null);
    setFlowStep('analyzing');

    try {
      // BUG-2: para fotos subidas (sin score nativo), SIEMPRE validamos con GPT-4o
      // — no tenemos métricas de calidad que justifiquen saltarse la validación.
      console.log('[BUG-2] fotos subidas — validando con GPT-4o (no hay score nativo)');
      const validation = await validarFotosSonDeCabello(photos);
      console.log('[BUG-2] validación GPT-4o (gallery):', validation);
      setHairValidation(validation);

      if (validation.blocked) {
        setError(validation.message);
        setFlowStep('gallery');
        vibracionError();
        return;
      }

      const angulos: AnguloCaptura[] = (['frontal', 'lateral', 'corona'] as AnguloCaptura[]).slice(0, photos.length);
      const estado: EstadoCabelloFoto = estadoCabello || 'seco_natural';
      const result = await analizarCabello(photos, estado, angulos);
      setAnalysisResult(result);
      setFlowStep('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al analizar las fotos';
      setError(msg);
      setFlowStep('error');
    }
  }, [estadoCabello]);

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: flowStep === 'camera' ? '#0A100D' : 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Cerrar global (sólo en pantallas no-cámara) ─────────────────── */}
      {flowStep !== 'camera' && (
        <button
          onClick={onCancel}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: 50,
            right: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <X size={16} />
        </button>
      )}

      {/* ═══ ESTADO ════════════════════════════════════════════════════════ */}
      {flowStep === 'estado' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 768,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ padding: '60px 20px 14px' }}>
            <div className="v-caps">Capítulo · Cámara IA</div>
            <h2
              style={{
                margin: '4px 0 6px',
                fontFamily: 'var(--font-serif)',
                fontSize: 26,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--text-main)',
              }}
            >
              ¿En qué <em style={{ color: 'var(--secondary-deep)' }}>estado</em> está el cabello?
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              La IA ajustará su análisis según el estado actual.
            </p>
          </div>

          <div style={{ flex: 1, padding: '0 20px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ESTADOS_CABELLO.map(({ valor, titulo, descripcion, impactoIA }) => {
              const selected = estadoCabello === valor;
              const esIdeal = valor === 'seco_natural';
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setEstadoCabello(valor)}
                  className="active:scale-[0.98] transition-transform"
                  style={{
                    position: 'relative',
                    width: '100%',
                    textAlign: 'left',
                    padding: 14,
                    borderRadius: 16,
                    border: selected
                      ? '1px solid var(--primary)'
                      : '1px solid var(--border-soft)',
                    background: selected ? 'var(--primary-pale)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    boxShadow: selected ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                  }}
                >
                  {selected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'linear-gradient(180deg, #3D7A35, #2D5A27)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 16,
                        color: selected ? 'var(--primary-deep)' : 'var(--text-main)',
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {titulo}
                    </span>
                    {esIdeal && <Chip tone="green" dot>Ideal</Chip>}
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {descripcion}
                  </p>
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontFamily: 'var(--font-serif)',
                      fontStyle: 'italic',
                      fontSize: 11.5,
                      color: 'var(--secondary-deep)',
                      lineHeight: 1.4,
                    }}
                  >
                    {impactoIA}
                  </p>
                </button>
              );
            })}
          </div>

          <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              disabled={!estadoCabello}
              icon={<Camera size={14} />}
              onClick={() => setFlowStep('camera')}
            >
              Abrir cámara
            </Btn>

            <label
              className="active:scale-[0.98] transition-transform"
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: estadoCabello ? 'var(--text-main)' : 'var(--text-tertiary)',
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                textAlign: 'center',
                cursor: estadoCabello ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: estadoCabello ? 1 : 0.5,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                disabled={!estadoCabello}
                onChange={handleFileUpload}
              />
              <ImageIcon size={14} /> Subir foto desde galería
            </label>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
              Sube 1–3 fotos del cabello · la IA las analizará igual.
            </p>
          </div>
        </div>
      )}

      {/* ═══ CAMERA · viewfinder editorial ════════════════════════════════ */}
      {flowStep === 'camera' && error && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 28px',
            gap: 14,
            color: 'var(--text-main)',
          }}
        >
          <AlertCircle size={36} style={{ color: 'var(--danger)' }} />
          <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--text-secondary)' }}>{error}</p>
          <Btn variant="primary" size="md" onClick={() => setFlowStep('error')}>
            Ver opciones alternativas
          </Btn>
        </div>
      )}

      {flowStep === 'camera' && !error && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0A100D' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Distance border indicator (overlay) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              border: `4px solid ${colorDistancia(distanceResult?.status ?? null)}`,
              transition: 'border-color 300ms ease',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />

          {/* Top bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '54px 16px 14px',
              background: 'linear-gradient(180deg, rgba(10,16,13,0.85) 0%, transparent 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10,
              color: '#F5EDDC',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cerrar"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(245, 237, 220, 0.2)',
                color: '#F5EDDC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div className="v-num" style={{ color: 'rgba(232, 194, 144, 0.9)', fontSize: 9 }}>
                EN VIVO · IA
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#fff' }}>
                Cámara capilar
              </div>
            </div>
            <button
              type="button"
              onClick={switchCamera}
              aria-label={facingMode === 'environment' ? 'Cámara frontal' : 'Cámara trasera'}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(245, 237, 220, 0.2)',
                color: '#F5EDDC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <SwitchCamera size={15} />
            </button>
          </div>

          {/* Progress dots de ángulos */}
          <div
            style={{
              position: 'absolute',
              top: 110,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 8,
              display: 'flex',
              gap: 8,
            }}
          >
            {SECUENCIA_ANGULOS.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 3,
                  width: 28,
                  borderRadius: 999,
                  background: i < anguloIndex ? '#E8C290' : i === anguloIndex ? '#fff' : 'rgba(255,255,255,0.25)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Targeting frame center */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 240,
              height: 240,
              borderRadius: 8,
              zIndex: 6,
              pointerEvents: 'none',
            }}
          >
            <TargetingCorners />
            {/* Scan shimmer */}
            <div
              className="v-shimmer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: 'rgba(232, 194, 144, 0.5)',
              }}
            />
            {/* Ángulo guide dentro del frame */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <AnguloGuide angulo={SECUENCIA_ANGULOS[anguloIndex].angulo} />
            </div>
          </div>

          {/* Live readout dual */}
          <div
            style={{
              position: 'absolute',
              top: 150,
              left: 16,
              right: 16,
              zIndex: 6,
              display: 'flex',
              gap: 10,
            }}
          >
            <div
              style={{
                background: 'rgba(10,16,13,0.7)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(232, 194, 144, 0.18)',
                borderRadius: 10,
                padding: '8px 10px',
                flex: 1,
              }}
            >
              <div className="v-num" style={{ color: 'rgba(232, 194, 144, 0.85)', fontSize: 8.5 }}>
                ÁNGULO
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#fff', marginTop: 2, textTransform: 'capitalize' }}>
                {SECUENCIA_ANGULOS[anguloIndex].titulo}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(245, 237, 220, 0.7)', marginTop: 1 }}>
                {SECUENCIA_ANGULOS[anguloIndex].instruccion}
              </div>
            </div>
            <div
              style={{
                background: 'rgba(10,16,13,0.7)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(232, 194, 144, 0.18)',
                borderRadius: 10,
                padding: '8px 10px',
                flex: 1,
              }}
            >
              <div className="v-num" style={{ color: 'rgba(232, 194, 144, 0.85)', fontSize: 8.5 }}>
                CALIDAD
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: !lightResult
                      ? 'rgba(255,255,255,0.4)'
                      : lightResult.status === 'perfect'
                        ? '#22C55E'
                        : '#F59E0B',
                    animation: lightResult && lightResult.status !== 'perfect' ? 'pulse-soft 1.4s ease-in-out infinite' : undefined,
                  }}
                />
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                  {lightResult?.status === 'too_dark'
                    ? 'OSCURO'
                    : lightResult?.status === 'too_bright'
                      ? 'BRILLO'
                      : lightResult?.status === 'perfect'
                        ? 'OK'
                        : 'MIDIENDO'}
                </span>
              </div>
              {focusResult?.status === 'blurry' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <EyeOff size={11} style={{ color: '#EF4444' }} />
                  <span style={{ fontSize: 10, color: '#FFCFCF' }}>Firme el celular</span>
                </div>
              )}
            </div>
          </div>

          {/* Mensaje de distancia (centro inferior) */}
          {distanceResult && distanceResult.status !== 'perfect' && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 200,
                transform: 'translateX(-50%)',
                background: 'rgba(10,16,13,0.7)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(232, 194, 144, 0.18)',
                borderRadius: 999,
                padding: '6px 14px',
                zIndex: 6,
              }}
            >
              <p style={{ margin: 0, color: '#fff', fontSize: 11, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                {distanceResult.message}
              </p>
            </div>
          )}

          {/* Bottom dock con shutter dorado */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '24px 18px 30px',
              background: 'linear-gradient(180deg, transparent 0%, rgba(10,16,13,0.92) 50%)',
              zIndex: 10,
              color: '#F5EDDC',
            }}
          >
            <div
              className="v-rule"
              style={{ marginBottom: 18, background: 'linear-gradient(to right, rgba(232, 194, 144, 0.5), transparent)' }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* Deshacer */}
              <button
                type="button"
                onClick={
                  fotos.length > 0
                    ? () => {
                        setFotos((prev) => prev.slice(0, -1));
                        setAnguloIndex((i) => Math.max(0, i - 1));
                      }
                    : undefined
                }
                aria-label="Deshacer última foto"
                disabled={fotos.length === 0}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(245, 237, 220, 0.18)',
                  color: '#F5EDDC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: fotos.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: fotos.length === 0 ? 0.4 : 1,
                }}
              >
                <RotateCcw size={16} />
              </button>

              {/* Shutter dorado */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={capturando}
                aria-label="Capturar"
                className="active:scale-90 transition-transform"
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '4px solid rgba(245, 237, 220, 0.3)',
                  position: 'relative',
                  boxShadow: '0 0 0 2px #E8C290',
                  cursor: capturando ? 'not-allowed' : 'pointer',
                  opacity: capturando ? 0.7 : 1,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 6,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #E8C290, #B47E4D)',
                  }}
                />
              </button>

              {/* Switch cam (placeholder · ya está arriba) */}
              <button
                type="button"
                onClick={switchCamera}
                aria-label="Cambiar cámara"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(245, 237, 220, 0.18)',
                  color: '#F5EDDC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Camera size={16} />
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                color: 'rgba(232, 194, 144, 0.7)',
                letterSpacing: '0.15em',
              }}
            >
              ENFOCA EL CABELLO · {anguloIndex + 1} / {SECUENCIA_ANGULOS.length}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCORE ════════════════════════════════════════════════════════ */}
      {flowStep === 'score' && scoreResult && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 768,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ padding: '60px 20px 8px' }}>
            <div className="v-caps">Cámara IA · resultado</div>
            <h2
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 26,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--text-main)',
              }}
            >
              Calidad <em style={{ color: 'var(--secondary-deep)' }}>de captura</em>
            </h2>
          </div>

          {/* Score circular */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: '50%',
                border: `8px solid ${
                  scoreResult.nivel === 'excelente'
                    ? 'var(--success)'
                    : scoreResult.nivel === 'aceptable'
                      ? 'var(--warning)'
                      : 'var(--danger)'
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 44,
                  letterSpacing: '-0.025em',
                  color:
                    scoreResult.nivel === 'excelente'
                      ? 'var(--success)'
                      : scoreResult.nivel === 'aceptable'
                        ? 'var(--warning)'
                        : 'var(--danger)',
                }}
              >
                {scoreResult.total}
              </span>
            </div>
            <p
              style={{
                margin: '14px 24px 0',
                fontSize: 13,
                color: 'var(--text-secondary)',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {scoreResult.mensaje}
            </p>
          </div>

          {/* Desglose */}
          <div style={{ padding: '0 20px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Iluminación', valor: scoreResult.desglose.luz, max: 25 },
              { label: 'Distancia', valor: scoreResult.desglose.distancia, max: 25 },
              { label: 'Enfoque', valor: scoreResult.desglose.enfoque, max: 25 },
              { label: 'Ángulos', valor: scoreResult.desglose.angulos, max: 25 },
            ].map(({ label, valor, max }) => {
              const ratio = valor / max;
              const color = ratio >= 0.8 ? 'var(--success)' : ratio >= 0.5 ? 'var(--warning)' : 'var(--danger)';
              return (
                <div
                  key={label}
                  className="v-card"
                  style={{ padding: 12 }}
                >
                  <div className="v-caps" style={{ marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 5,
                        background: 'var(--bg)',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${(valor / max) * 100}%`,
                          height: '100%',
                          background: color,
                          borderRadius: 999,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-main)',
                      }}
                    >
                      {valor}/{max}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Miniaturas */}
          <div style={{ padding: '0 20px 14px' }}>
            <div className="v-caps" style={{ marginBottom: 8 }}>Tus capturas · {fotos.length}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {fotos.map((f, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: '1',
                    borderRadius: 12,
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.dataUrl} alt={f.angulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      background: 'rgba(20, 36, 26, 0.7)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 9,
                      color: '#fff',
                      textTransform: 'capitalize',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {f.angulo}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                margin: '0 20px 14px',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(142, 45, 45, 0.08)',
                border: '1px solid rgba(142, 45, 45, 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--danger)', lineHeight: 1.4 }}>{error}</p>
            </div>
          )}

          <div style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            {scoreResult.aceptarCaptura && (
              <Btn
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleAnalizar}
                icon={<Sparkles size={14} />}
              >
                Analizar con IA
              </Btn>
            )}
            <Btn
              variant={scoreResult.aceptarCaptura ? 'outline' : 'primary'}
              size="lg"
              fullWidth
              onClick={handleRetomar}
              icon={<RotateCcw size={14} />}
            >
              Retomar fotos
            </Btn>
          </div>
        </div>
      )}

      {/* ═══ ANALYZING ════════════════════════════════════════════════════ */}
      {flowStep === 'analyzing' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              background: 'linear-gradient(135deg, var(--primary-pale), var(--secondary-pale))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Loader2 size={36} style={{ color: 'var(--primary)' }} className="animate-spin" />
          </div>
          <div className="v-caps" style={{ marginBottom: 6 }}>Inteligencia capilar</div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
            }}
          >
            Analizando <em style={{ color: 'var(--secondary-deep)' }}>el cabello…</em>
          </h3>
          <p
            style={{
              marginTop: 10,
              maxWidth: 320,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            La IA está estudiando las {fotos.length || uploadedPhotos.length} fotos para determinar el tipo de cabello.
          </p>
        </div>
      )}

      {/* ═══ RESULT ═══════════════════════════════════════════════════════ */}
      {flowStep === 'result' && analysisResult && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 768,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ padding: '60px 20px 8px' }}>
            <div className="v-caps">Resultado de la cámara IA</div>
            <h2
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 26,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--text-main)',
              }}
            >
              Análisis <em style={{ color: 'var(--secondary-deep)' }}>completado</em>
            </h2>
          </div>

          {/* Tipo de rizo grande */}
          <div
            style={{
              margin: '20px 20px 14px',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, var(--primary-deep) 0%, var(--primary) 100%)',
              color: '#F5EDDC',
              padding: '24px 20px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-md)',
            }}
            className="v-grain"
          >
            <div className="v-num" style={{ color: 'rgba(232, 194, 144, 0.95)', fontSize: 9.5 }}>
              TIPO DE CABELLO PRINCIPAL
            </div>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 80,
                letterSpacing: '-0.04em',
                color: '#E8C290',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {analysisResult.tipoRizoPrincipal}
            </span>
            {analysisResult.tiposSecundarios?.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                {analysisResult.tiposSecundarios.map((s) => (
                  <Chip
                    key={s}
                    tone="ghost"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      color: '#F5EDDC',
                      borderColor: 'rgba(232, 194, 144, 0.3)',
                    }}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {/* BUG-2: warning si la validación GPT-4o detectó fotos no-cabello */}
          {hairValidation?.warning && (
            <div
              style={{
                margin: '0 20px 14px',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--treat-recon-bg)',
                border: '1px solid rgba(212, 130, 10, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={14} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--treat-recon-color)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Validación · advertencia
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--treat-recon-color)', lineHeight: 1.4 }}>
                  {hairValidation.message}
                </p>
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div
            style={{
              margin: '0 20px 14px',
              padding: '16px 18px',
              borderLeft: '3px solid var(--secondary)',
              background: 'var(--secondary-pale)',
              borderRadius: '0 14px 14px 0',
            }}
          >
            <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
              Observaciones de la IA
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 14,
                lineHeight: 1.45,
                color: 'var(--primary-deep)',
              }}
            >
              «{analysisResult.observaciones}»
            </p>
          </div>

          {/* Confianza */}
          <div style={{ margin: '0 20px 22px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  analysisResult.confianza === 'alta'
                    ? 'var(--success)'
                    : analysisResult.confianza === 'media'
                      ? 'var(--warning)'
                      : 'var(--danger)',
              }}
            />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              Confianza:{' '}
              <strong
                style={{
                  color: 'var(--text-main)',
                  textTransform: 'capitalize',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                }}
              >
                {analysisResult.confianza}
              </strong>
              {analysisResult.confianza === 'baja' && ' — considera revisar manualmente'}
            </p>
          </div>

          <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleConfirmar}
              icon={<Check size={14} />}
            >
              Confirmar tipo {analysisResult.tipoRizoPrincipal}
            </Btn>
            <Btn
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => {
                console.log('[BUG-1] Click corregir');
                handleCorregirManual();
              }}
            >
              Corregir manualmente
            </Btn>
          </div>
        </div>
      )}

      {/* ═══ GALLERY UPLOAD PREVIEW ═══════════════════════════════════════ */}
      {flowStep === 'gallery' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 768,
            margin: '0 auto',
            width: '100%',
            padding: '60px 20px 28px',
            gap: 18,
          }}
        >
          <div>
            <div className="v-caps">Cámara IA · galería</div>
            <h2
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--text-main)',
              }}
            >
              {uploadedPhotos.length} foto{uploadedPhotos.length !== 1 ? 's' : ''}{' '}
              <em style={{ color: 'var(--secondary-deep)' }}>seleccionada{uploadedPhotos.length !== 1 ? 's' : ''}</em>
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Revisa que el cabello se vea claramente antes de analizar.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                uploadedPhotos.length === 1
                  ? '1fr'
                  : uploadedPhotos.length === 2
                    ? '1fr 1fr'
                    : 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {uploadedPhotos.map((url, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '1px solid var(--border-soft)',
                  background: '#000',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handleAnalyzeUploaded(uploadedPhotos)}
              icon={<Sparkles size={14} />}
            >
              Analizar con IA
            </Btn>
            <label
              className="active:scale-[0.98] transition-transform"
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <RotateCcw size={13} /> Cambiar fotos
            </label>
          </div>
        </div>
      )}

      {/* ═══ ERROR / FALLBACK ═════════════════════════════════════════════ */}
      {flowStep === 'error' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 768,
            margin: '0 auto',
            width: '100%',
            padding: '60px 20px 28px',
            gap: 18,
          }}
        >
          <div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'rgba(142, 45, 45, 0.08)',
                border: '1px solid rgba(142, 45, 45, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <AlertCircle size={26} style={{ color: 'var(--danger)' }} />
            </div>
            <div className="v-caps">Cámara · sin acceso</div>
            <h2
              style={{
                margin: '4px 0 6px',
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--text-main)',
              }}
            >
              Cámara <em style={{ color: 'var(--secondary-deep)' }}>no disponible</em>
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {error || 'No se pudo acceder a la cámara.'}
            </p>
          </div>

          {/* Subir desde galería */}
          <section
            className="v-card"
            style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--primary-pale)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ImageIcon size={18} strokeWidth={1.7} />
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text-main)' }}>
                  Subir foto desde galería
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  La IA analizará las fotos igual de bien
                </p>
              </div>
            </div>

            {!estadoCabello && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="v-caps">Estado del cabello en las fotos</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['seco_natural', 'humedo', 'con_producto', 'recien_lavado'] as EstadoCabelloFoto[]).map((v) => {
                    const active = estadoCabello === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEstadoCabello(v)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'var(--font-sans)',
                          textAlign: 'left',
                          background: active ? 'var(--primary-pale)' : 'var(--bg)',
                          color: active ? 'var(--primary)' : 'var(--text-secondary)',
                          border: `1px solid ${active ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {v === 'seco_natural'
                          ? 'Seco y sin producto · ideal'
                          : v === 'humedo'
                            ? 'Húmedo'
                            : v === 'con_producto'
                              ? 'Con producto aplicado'
                              : 'Recién lavado sin producto'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label
              className="active:scale-[0.98] transition-transform"
              style={{
                width: '100%',
                padding: '14px 22px',
                borderRadius: 999,
                background: 'linear-gradient(180deg, #3D7A35, #2D5A27)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                fontFamily: 'var(--font-sans)',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(45, 90, 39, 0.32)',
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              Seleccionar fotos · 1–3
            </label>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
              Sube fotos del cabello desde distintos ángulos para mejor resultado
            </p>
          </section>

          <Btn
            variant="ghost"
            size="md"
            fullWidth
            onClick={onCancel}
          >
            Llenar manualmente sin cámara
          </Btn>
        </div>
      )}
    </div>
  );
}
