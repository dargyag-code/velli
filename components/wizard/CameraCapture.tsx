'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Camera, RotateCcw, Check, Zap, Sun, Eye, EyeOff,
  User, ArrowRight, ChevronDown, Loader2, AlertCircle, SwitchCamera,
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
} from '@/lib/captureQuality';
import { analizarCabello, HairAnalysisResult } from '@/lib/hairAnalysis';
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
    analysisResult: HairAnalysisResult
  ) => void;
  onCancel: () => void;
}

// ── Color del indicador de distancia ──────────────────────────────────────

function colorDistancia(status: DistanceResult['status'] | null): string {
  if (!status) return '#E5E5E5';
  if (status === 'perfect') return '#22C55E';
  if (status === 'too_close' || status === 'too_far') return '#EF4444';
  return '#F59E0B'; // no_face → amarillo
}

// ── Guía de ángulo (SVG overlay) ──────────────────────────────────────────

function AnguloGuide({ angulo }: { angulo: AnguloCaptura }) {
  return (
    <svg
      viewBox="0 0 200 280"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.35 }}
    >
      {angulo === 'frontal' && (
        <ellipse cx="100" cy="140" rx="60" ry="95" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
      )}
      {angulo === 'lateral' && (
        <ellipse cx="100" cy="140" rx="40" ry="95" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
      )}
      {angulo === 'corona' && (
        <circle cx="100" cy="140" r="70" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
      )}
    </svg>
  );
}

// ── Ícono de ángulo ────────────────────────────────────────────────────────

function AnguloIcon({ icono, size = 16 }: { icono: string; size?: number }) {
  if (icono === 'user') return <User size={size} />;
  if (icono === 'arrow-right') return <ArrowRight size={size} />;
  return <ChevronDown size={size} />;
}

// ── Componente principal ───────────────────────────────────────────────────

export default function CameraCapture({ onComplete, onCancel }: Props) {
  const [flowStep, setFlowStep] = useState<FlowStep>('estado');
  const [estadoCabello, setEstadoCabello] = useState<EstadoCabelloFoto | null>(null);
  const [anguloIndex, setAnguloIndex] = useState(0);
  const [fotos, setFotos] = useState<CapturedPhoto[]>([]);
  const [scoreResult, setScoreResult] = useState<CaptureQualityScore | null>(null);
  const [analysisResult, setAnalysisResult] = useState<HairAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);

  // Indicadores en tiempo real
  const [lightResult, setLightResult] = useState<LightResult | null>(null);
  const [focusResult, setFocusResult] = useState<FocusResult | null>(null);
  const [distanceResult, setDistanceResult] = useState<DistanceResult | null>(null);

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
    // Verificar que mediaDevices esté disponible (requiere HTTPS o localhost)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isLocalhost = typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isHttps = typeof window !== 'undefined' &&
        window.location.protocol === 'https:';

      const msg = (!isLocalhost && !isHttps)
        ? 'La cámara solo funciona en localhost o HTTPS. Accediste por IP sin SSL — usa la opción de subir foto desde galería.'
        : 'Tu navegador no soporta acceso a la cámara. Usa la opción de subir foto desde galería.';

      console.log('[CameraCapture] mediaDevices no disponible:', {
        mediaDevices: typeof navigator !== 'undefined' ? !!navigator.mediaDevices : 'navigator undefined',
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      });

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
      console.log('[CameraCapture] getUserMedia error:', err);
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
    // Detener solo los tracks (el intervalo de calidad sigue activo)
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
    } catch (err) {
      console.log('[CameraCapture] switchCamera error:', err);
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

  // ── Loop de calidad (asíncrono, ~500ms) ───────────────────────────────

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

    // Medir calidad en el frame capturado
    const light = evaluarIluminacion(video);
    const focus = evaluarEnfoque(video);
    const distance = await evaluarDistancia(video);
    const track = streamRef.current?.getVideoTracks()[0];

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
      // Todas las fotos capturadas → calcular score
      const scoreInput = nuevasFotos.map((f) => ({
        angulo: f.angulo,
        luminancia: f.luminancia,
        sharpnessScore: f.sharpnessScore,
        distanciaOk: f.faceRatio === -1 || (f.faceRatio >= 0.25 && f.faceRatio <= 0.55),
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

  // ── Retomar fotos ─────────────────────────────────────────────────────

  const handleRetomar = useCallback(() => {
    setFotos([]);
    setAnguloIndex(0);
    setScoreResult(null);
    setError(null);
    setFlowStep('camera');
  }, []);

  // ── Enviar a IA ───────────────────────────────────────────────────────

  const handleAnalizar = useCallback(async () => {
    if (!estadoCabello) return;
    setFlowStep('analyzing');
    setError(null);

    try {
      const result = await analizarCabello(
        fotos.map((f) => f.dataUrl),
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
  }, [fotos, estadoCabello]);

  // ── Confirmar resultado ───────────────────────────────────────────────

  const handleConfirmar = useCallback(async () => {
    // scoreResult es null en el flujo de galería — solo se requiere analysisResult y estadoCabello
    if (!analysisResult || !estadoCabello) return;

    console.log('[Confirmar] Resultado IA:', analysisResult);

    const dispositivo = obtenerMetadataDispositivo();
    const ubicacion = await obtenerUbicacionAproximada();
    const track = streamRef.current?.getVideoTracks()[0];

    const metadata: CaptureMetadata = {
      estadoCabello,
      // scoreResult solo existe en el flujo de cámara; para galería usamos 0
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
    };

    onComplete(analysisResult.tipoRizoPrincipal, analysisResult.tiposSecundarios ?? [], metadata, analysisResult);
  }, [analysisResult, estadoCabello, scoreResult, fotos, onComplete]);

  // ── Subir fotos desde galería ──────────────────────────────────────────
  // Paso 1: leer archivos → mostrar preview en 'gallery'
  // Paso 2: desde 'gallery' el usuario toca "Analizar" → handleAnalyzeUploaded

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[CameraCapture] onChange disparado');
    console.log('[CameraCapture] e.target.files:', e.target.files);
    console.log('[CameraCapture] cantidad:', e.target.files?.length);

    const files = Array.from(e.target.files || []).slice(0, 3);

    console.log('[CameraCapture] Files capturados:', files.length, files.map(f => `${f.name} (${f.size}B tipo:${f.type})`));

    if (!files.length) {
      console.log('[CameraCapture] Sin archivos, saliendo');
      return;
    }

    setError(null);

    // Leer todos los archivos con FileReader
    let completed = 0;
    const results: string[] = new Array(files.length);

    files.forEach((file, i) => {
      console.log(`[CameraCapture] Iniciando FileReader[${i}] para: ${file.name}`);
      const reader = new FileReader();

      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        console.log(`[CameraCapture] FileReader[${i}] onload OK — ${file.name} — ${dataUrl?.slice(0, 60)}...`);
        results[i] = dataUrl;
        completed += 1;

        if (completed === files.length) {
          console.log('[CameraCapture] Todos los FileReaders terminaron:', results.length, 'fotos');
          setUploadedPhotos([...results]);
          setFlowStep('gallery');
        }
      };

      reader.onerror = (ev) => {
        console.log(`[CameraCapture] FileReader[${i}] onerror:`, ev, reader.error);
        setError(`No se pudo leer ${file.name}: ${reader.error?.message || 'error desconocido'}`);
        setFlowStep('error');
      };

      reader.readAsDataURL(file);
    });
  }, []);

  // Paso 2: analizar las fotos subidas con la IA
  const handleAnalyzeUploaded = useCallback(async (photos: string[]) => {
    console.log('[CameraCapture] Iniciando análisis IA con', photos.length, 'foto(s)');
    setError(null);
    setFlowStep('analyzing');

    try {
      const angulos: AnguloCaptura[] = (['frontal', 'lateral', 'corona'] as AnguloCaptura[]).slice(0, photos.length);
      const estado: EstadoCabelloFoto = estadoCabello || 'seco_natural';

      console.log('[CameraCapture] Llamando analizarCabello — estado:', estado, 'ángulos:', angulos);
      const result = await analizarCabello(photos, estado, angulos);
      console.log('[CameraCapture] Resultado IA:', result);
      setAnalysisResult(result);
      setFlowStep('result');
    } catch (err) {
      console.log('[CameraCapture] Error análisis IA:', err);
      const msg = err instanceof Error ? err.message : 'Error al analizar las fotos';
      setError(msg);
      setFlowStep('error');
    }
  }, [estadoCabello]);

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Botón cerrar */}
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 z-10 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center text-white"
      >
        <X size={18} />
      </button>

      {/* ── PANTALLA 1: Seleccionar estado del cabello ── */}
      {flowStep === 'estado' && (
        <div className="flex-1 overflow-y-auto bg-[#F5F0E8] flex flex-col">
          <div className="px-5 pt-14 pb-4">
            <h2 className="text-xl font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              ¿En qué estado está el cabello?
            </h2>
            <p className="text-sm text-[#666666] mt-1">
              La IA ajustará su análisis según el estado actual
            </p>
          </div>

          <div className="flex-1 px-5 pb-6 grid grid-cols-1 gap-3">
            {ESTADOS_CABELLO.map(({ valor, titulo, descripcion, impactoIA }) => {
              const selected = estadoCabello === valor;
              const esIdeal = valor === 'seco_natural';
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setEstadoCabello(valor)}
                  className={`relative w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                    selected
                      ? 'border-[#2D5A27] bg-[#EEF5ED]'
                      : 'border-[#E5E5E5] bg-white hover:border-[#90B98A]'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-[#2D5A27] rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#2D2D2D] text-sm" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                      {titulo}
                    </span>
                    {esIdeal && (
                      <span className="text-[10px] font-bold bg-[#22C55E] text-white px-2 py-0.5 rounded-full">
                        IDEAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#666666]">{descripcion}</p>
                  <p className="text-[10px] text-[#7A9B76] mt-1.5 italic">{impactoIA}</p>
                </button>
              );
            })}
          </div>

          <div className="px-5 pb-6 flex flex-col gap-3">
            <button
              disabled={!estadoCabello}
              onClick={() => setFlowStep('camera')}
              className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-200 ${
                estadoCabello
                  ? 'bg-[#2D5A27] active:scale-95'
                  : 'bg-[#CCCCCC] cursor-not-allowed'
              }`}
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              Abrir cámara
            </button>

            {/* Alternativa: subir desde galería */}
            <label
              className={`w-full py-3 rounded-2xl font-bold text-center border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                estadoCabello
                  ? 'border-[#2D5A27] text-[#2D5A27] bg-white active:scale-95'
                  : 'border-[#CCCCCC] text-[#AAAAAA] cursor-not-allowed'
              }`}
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={!estadoCabello}
                onChange={handleFileUpload}
              />
              📁 Subir foto desde galería
            </label>
            <p className="text-center text-xs text-[#999999]">
              Sube 1-3 fotos del cabello · la IA las analizará igual
            </p>
          </div>
        </div>
      )}

      {/* ── PANTALLA 2: Cámara con indicadores ── */}
      {flowStep === 'camera' && error && (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F5F0E8] px-8 gap-4">
          <AlertCircle size={36} className="text-red-500" />
          <p className="text-sm text-center text-[#444]">{error}</p>
          <button onClick={() => setFlowStep('error')} className="px-6 py-3 rounded-2xl bg-[#2D5A27] text-white font-bold text-sm">
            Ver opciones alternativas
          </button>
        </div>
      )}
      {flowStep === 'camera' && !error && (
        <div className="flex-1 flex flex-col bg-black">
          {/* Barra de progreso de ángulos */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {SECUENCIA_ANGULOS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-all duration-300 ${
                  i < anguloIndex ? 'bg-[#22C55E]' : i === anguloIndex ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          {/* Video + overlays */}
          <div
            className="flex-1 relative overflow-hidden"
            style={{
              borderWidth: 4,
              borderStyle: 'solid',
              borderColor: colorDistancia(distanceResult?.status ?? null),
              transition: 'border-color 300ms ease',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Guía de ángulo */}
            <AnguloGuide angulo={SECUENCIA_ANGULOS[anguloIndex].angulo} />

            {/* Botón alternar cámara frontal/trasera */}
            <button
              type="button"
              onClick={switchCamera}
              className="absolute bg-black/50 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ top: 16, left: 16, width: 44, height: 44, zIndex: 50 }}
              aria-label={facingMode === 'environment' ? 'Cambiar a cámara frontal' : 'Cambiar a cámara trasera'}
            >
              <SwitchCamera size={20} />
            </button>

            {/* Indicador de luz */}
            <div className="absolute top-12 left-4 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                !lightResult ? 'bg-white/40'
                : lightResult.status === 'perfect' ? 'bg-green-400'
                : 'bg-yellow-400 animate-pulse'
              }`} />
              <span className="text-white text-[10px] font-medium drop-shadow">
                {lightResult?.status === 'too_dark' ? lightResult.message
                : lightResult?.status === 'too_bright' ? lightResult.message
                : null}
              </span>
            </div>

            {/* Indicador de enfoque (solo si borrosa) */}
            {focusResult?.status === 'blurry' && (
              <div className="absolute top-12 right-4 flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-lg">
                <EyeOff size={12} className="text-red-400" />
                <span className="text-white text-[10px]">Firme el celular</span>
              </div>
            )}

            {/* Mensaje de distancia */}
            {distanceResult && distanceResult.status !== 'perfect' && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-xl">
                <p className="text-white text-xs text-center">{distanceResult.message}</p>
              </div>
            )}
          </div>

          {/* Instrucción del ángulo actual */}
          <div className="px-5 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <AnguloIcon icono={SECUENCIA_ANGULOS[anguloIndex].icono} size={14} />
              <span className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {SECUENCIA_ANGULOS[anguloIndex].titulo}
              </span>
            </div>
            <p className="text-white/70 text-xs">{SECUENCIA_ANGULOS[anguloIndex].instruccion}</p>
          </div>

          {/* Botón captura + retomar */}
          <div
            className="flex items-center justify-center gap-6 pt-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
          >
            {fotos.length > 0 && (
              <button
                onClick={() => {
                  setFotos((prev) => prev.slice(0, -1));
                  setAnguloIndex((i) => Math.max(0, i - 1));
                }}
                className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              onClick={handleCapture}
              disabled={capturando}
              className="w-18 h-18 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
              style={{ width: 72, height: 72 }}
            >
              <Camera size={28} className="text-[#2D5A27]" />
            </button>
            <div className="w-11 h-11" />
          </div>
        </div>
      )}

      {/* ── PANTALLA 3: Score de calidad ── */}
      {flowStep === 'score' && scoreResult && (
        <div className="flex-1 overflow-y-auto bg-[#F5F0E8] flex flex-col">
          <div className="px-5 pt-14 pb-4">
            <h2 className="text-xl font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Calidad de captura
            </h2>
          </div>

          {/* Score circular */}
          <div className="flex flex-col items-center py-6">
            <div
              className="w-32 h-32 rounded-full border-8 flex items-center justify-center"
              style={{
                borderColor:
                  scoreResult.nivel === 'excelente' ? '#22C55E'
                  : scoreResult.nivel === 'aceptable' ? '#F59E0B'
                  : '#EF4444',
              }}
            >
              <span
                className="text-4xl font-extrabold"
                style={{
                  fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                  color:
                    scoreResult.nivel === 'excelente' ? '#22C55E'
                    : scoreResult.nivel === 'aceptable' ? '#F59E0B'
                    : '#EF4444',
                }}
              >
                {scoreResult.total}
              </span>
            </div>
            <p className="text-sm text-[#666666] mt-4 text-center px-8">{scoreResult.mensaje}</p>
          </div>

          {/* Desglose */}
          <div className="px-5 pb-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Iluminación', valor: scoreResult.desglose.luz, max: 25 },
              { label: 'Distancia', valor: scoreResult.desglose.distancia, max: 25 },
              { label: 'Enfoque', valor: scoreResult.desglose.enfoque, max: 25 },
              { label: 'Ángulos', valor: scoreResult.desglose.angulos, max: 25 },
            ].map(({ label, valor, max }) => (
              <div key={label} className="bg-white rounded-xl p-3 border border-[#E5E5E5]">
                <p className="text-xs text-[#666666] mb-1">{label}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(valor / max) * 100}%`,
                        backgroundColor: valor >= max * 0.8 ? '#22C55E' : valor >= max * 0.5 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#2D2D2D]">{valor}/{max}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Miniaturas de fotos */}
          <div className="px-5 pb-4">
            <div className="flex gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="flex-1 aspect-square rounded-xl overflow-hidden relative">
                  <img src={f.dataUrl} alt={f.angulo} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-white capitalize">
                    {f.angulo}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mx-5 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="px-5 pb-8 flex flex-col gap-3">
            {scoreResult.aceptarCaptura ? (
              <button
                onClick={handleAnalizar}
                className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D5A27] active:scale-95 transition-transform flex items-center justify-center gap-2"
                style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
              >
                <Zap size={18} />
                Analizar con IA
              </button>
            ) : null}
            <button
              onClick={handleRetomar}
              className={`w-full py-4 rounded-2xl font-bold transition-all ${
                scoreResult.aceptarCaptura
                  ? 'bg-white text-[#2D5A27] border-2 border-[#2D5A27]'
                  : 'bg-[#2D5A27] text-white'
              }`}
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              Retomar fotos
            </button>
          </div>
        </div>
      )}

      {/* ── PANTALLA 4: Analizando ── */}
      {flowStep === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F5F0E8] px-8">
          <div className="w-20 h-20 rounded-full bg-[#EEF5ED] flex items-center justify-center mb-6">
            <Loader2 size={36} className="text-[#2D5A27] animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-[#2D2D2D] text-center mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Analizando el cabello...
          </h3>
          <p className="text-sm text-[#666666] text-center">
            La IA está estudiando las 3 fotos para determinar el tipo de cabello
          </p>
        </div>
      )}

      {/* ── PANTALLA 5: Resultado de la IA ── */}
      {flowStep === 'result' && analysisResult && (
        <div className="flex-1 overflow-y-auto bg-[#F5F0E8] flex flex-col">
          <div className="px-5 pt-14 pb-4">
            <h2 className="text-xl font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Resultado del análisis
            </h2>
          </div>

          {/* Tipo de rizo detectado */}
          <div className="mx-5 mb-4 bg-white rounded-2xl border border-[#E5E5E5] p-5 text-center">
            <p className="text-sm text-[#666666] mb-2">Tipo de cabello principal</p>
            <span
              className="text-6xl font-extrabold text-[#2D5A27]"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              {analysisResult.tipoRizoPrincipal}
            </span>
            {analysisResult.tiposSecundarios?.length > 0 && (
              <p className="text-sm text-[#666666] mt-2">
                Secundarios: <strong>{analysisResult.tiposSecundarios.join(', ')}</strong>
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div className="mx-5 mb-4 bg-[#EEF5ED] rounded-2xl p-4">
            <p className="text-xs font-bold text-[#2D5A27] mb-1">Observaciones de la IA</p>
            <p className="text-sm text-[#2D2D2D]">{analysisResult.observaciones}</p>
          </div>

          {/* Confianza */}
          <div className="mx-5 mb-4 flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                analysisResult.confianza === 'alta' ? 'bg-green-500'
                : analysisResult.confianza === 'media' ? 'bg-yellow-500'
                : 'bg-red-500'
              }`}
            />
            <p className="text-xs text-[#666666]">
              Confianza: <strong className="text-[#2D2D2D] capitalize">{analysisResult.confianza}</strong>
              {analysisResult.confianza === 'baja' && ' — considera revisar manualmente'}
            </p>
          </div>

          {/* Acciones */}
          <div className="px-5 pb-8 flex flex-col gap-3 mt-auto">
            <button
              onClick={handleConfirmar}
              className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D5A27] active:scale-95 transition-transform flex items-center justify-center gap-2"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              <Check size={18} />
              Confirmar tipo {analysisResult.tipoRizoPrincipal}
            </button>
            <button
              onClick={handleRetomar}
              className="w-full py-4 rounded-2xl font-bold text-[#2D5A27] bg-white border-2 border-[#2D5A27]"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              Corregir manualmente
            </button>
          </div>
        </div>
      )}

      {/* ── PANTALLA GALERÍA: preview de fotos subidas ── */}
      {flowStep === 'gallery' && (
        <div className="flex-1 overflow-y-auto bg-[#F5F0E8] flex flex-col px-5 pt-14 pb-8 gap-5">
          <div>
            <h2 className="text-xl font-bold text-[#2D2D2D] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              {uploadedPhotos.length} foto{uploadedPhotos.length !== 1 ? 's' : ''} seleccionada{uploadedPhotos.length !== 1 ? 's' : ''}
            </h2>
            <p className="text-sm text-[#666666]">Revisa que el cabello se vea claramente antes de analizar</p>
          </div>

          {/* Miniaturas */}
          <div className={`grid gap-2 ${uploadedPhotos.length === 1 ? 'grid-cols-1' : uploadedPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {uploadedPhotos.map((url, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-[#E5E5E5] bg-black">
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-3 mt-auto">
            <button
              type="button"
              onClick={() => handleAnalyzeUploaded(uploadedPhotos)}
              className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D5A27] active:scale-95 transition-transform flex items-center justify-center gap-2"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              <Zap size={18} />
              Analizar con IA
            </button>

            <label
              className="w-full py-3.5 rounded-2xl font-bold text-center border-2 border-[#2D5A27] text-[#2D5A27] bg-white cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              Cambiar fotos
            </label>
          </div>
        </div>
      )}

      {/* ── PANTALLA DE ERROR / FALLBACK ── */}
      {flowStep === 'error' && (
        <div className="flex-1 overflow-y-auto bg-[#F5F0E8] flex flex-col px-5 pt-14 pb-8 gap-5">
          <div>
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[#2D2D2D] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Cámara no disponible
            </h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              {error || 'No se pudo acceder a la cámara.'}
            </p>
          </div>

          {/* Opción: subir desde galería */}
          <div className="bg-white rounded-2xl border-2 border-[#2D5A27] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📁</span>
              <div>
                <p className="font-bold text-[#2D2D2D] text-sm" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  Subir foto desde galería
                </p>
                <p className="text-xs text-[#666666]">La IA analizará las fotos igual de bien</p>
              </div>
            </div>

            {/* Selector de estado si no se seleccionó antes */}
            {!estadoCabello && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-[#444]">Estado del cabello en las fotos:</p>
                {(['seco_natural', 'humedo', 'con_producto', 'recien_lavado'] as EstadoCabelloFoto[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEstadoCabello(v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 text-left transition-all ${
                      estadoCabello === v
                        ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                        : 'border-[#E5E5E5] bg-white text-[#666]'
                    }`}
                  >
                    {v === 'seco_natural' ? 'Seco y sin producto (ideal)' :
                     v === 'humedo' ? 'Húmedo' :
                     v === 'con_producto' ? 'Con producto aplicado' :
                     'Recién lavado sin producto'}
                  </button>
                ))}
              </div>
            )}

            <label
              className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D5A27] text-center cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              Seleccionar fotos (1-3)
            </label>
            <p className="text-[10px] text-center text-[#999]">
              Sube fotos del cabello desde distintos ángulos para mejor resultado
            </p>
          </div>

          {/* Opción: llenar manualmente */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 rounded-2xl border-2 border-[#E5E5E5] font-bold text-[#666] bg-white text-sm"
            style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
          >
            Llenar manualmente sin cámara
          </button>
        </div>
      )}
    </div>
  );
}
