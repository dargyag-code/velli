'use client';
import React, { useState, useEffect } from 'react';
import {
  Camera, Pencil, Sparkles, ChevronDown, ChevronUp, X, Check,
  Bot, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { WizardData, CaptureMetadata } from '@/lib/types';
import { HairAnalysisResult } from '@/lib/hairAnalysis';
import { rizoTypes, RizoPattern } from './RizoPatterns';
import CameraCapture from './CameraCapture';
import { Btn, Chip } from '@/components/v2';
import { vibracionSutil, vibracionConfirmacion } from '@/lib/haptics';

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
  onExpressReady?: () => void;
  autoCamera?: boolean;
}

type Mode = 'choose' | 'camera' | 'form';

type IACampos = Set<string>;

// ── PillRow editorial ──────────────────────────────────────────────────────
function PillRow({
  label,
  options,
  value,
  onSelect,
  iaFilled,
}: {
  label: string;
  options: { v: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
  iaFilled?: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className="v-caps">{label}</span>
        {iaFilled && value && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'var(--primary-pale)',
              color: 'var(--primary)',
              borderRadius: 999,
              padding: '1px 6px',
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Bot size={8} /> IA
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length},1fr)`, gap: 6 }}>
        {options.map(({ v, label: lbl }) => {
          const sel = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => { vibracionSutil(); onSelect(v); }}
              className="active:scale-95 transition-transform"
              style={{
                padding: '10px 8px',
                borderRadius: 12,
                background: sel ? 'var(--primary)' : 'var(--bg-card)',
                color: sel ? '#fff' : 'var(--text-main)',
                border: sel ? 'none' : '1px solid var(--border-soft)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                boxShadow: sel ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
              }}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── ChipGroup editorial ────────────────────────────────────────────────────
function ChipGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    vibracionSutil();
    if (selected.includes(opt)) {
      onChange(selected.filter((x) => x !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="active:scale-95 transition-transform"
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
              color: on ? 'var(--primary)' : 'var(--text-secondary)',
              border: `1px solid ${on ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
              cursor: 'pointer',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Opciones del formulario ────────────────────────────────────────────────
const POROSIDAD = [
  { v: 'baja', label: 'Baja' },
  { v: 'media', label: 'Media' },
  { v: 'alta', label: 'Alta' },
];

const DENSIDAD = [
  { v: 'baja', label: 'Baja' },
  { v: 'media', label: 'Media' },
  { v: 'alta', label: 'Alta' },
];

const GROSOR = [
  { v: 'fino', label: 'Fino' },
  { v: 'medio', label: 'Medio' },
  { v: 'grueso', label: 'Grueso' },
];

const ELASTICIDAD = [
  { v: 'baja', label: 'Baja' },
  { v: 'media', label: 'Media' },
  { v: 'alta', label: 'Alta' },
];

const BALANCE_HP = [
  { v: 'hidratacion', label: 'Hid.' },
  { v: 'nutricion', label: 'Nutr.' },
  { v: 'proteina', label: 'Prot.' },
  { v: 'equilibrado', label: 'Equil.' },
];

const PROBLEMAS_RAPIDOS = [
  'Frizz excesivo',
  'Resequedad',
  'Rizos poco definidos',
  'Quiebre / puntas abiertas',
  'Caída excesiva',
  'Daño por calor o químicos',
  'Transición capilar',
];

// ── Drawer options ─────────────────────────────────────────────────────────
const QUIMICOS = [
  'Tinte permanente',
  'Decoloración / mechas',
  'Alisado permanente (keratina, formol, japonés)',
  'Relaxer / desrizado químico',
  'Permanente (rizado químico)',
  'Ninguno',
];

const CUERO_OPTIONS = [
  'Saludable (limpio, sin irritación)',
  'Graso (exceso de sebo)',
  'Seco / descamación',
  'Sensible / rojizo',
  'Caspa seca',
  'Dermatitis seborreica',
  'Build-up (acumulación de producto)',
];

const PUNTAS_OPTIONS = [
  { v: 'Puntas sanas (selladas)', label: 'Sanas' },
  { v: 'Puntas abiertas leves', label: 'Abiertas leves' },
  { v: 'Puntas abiertas severas (necesita corte)', label: 'Severas (necesita corte)' },
];

const DANO_OPTIONS = [
  'Sin daño visible',
  'Daño mecánico (peinado brusco, ligas, etc.)',
  'Daño térmico (textura alterada por calor)',
  'Daño químico (decoloración, alisado)',
  'En transición capilar (dos texturas visibles)',
];

const FRECUENCIA_CALOR = [
  { v: 'nunca', label: 'Nunca' },
  { v: 'mensual', label: 'Mensual' },
  { v: 'semanal', label: 'Semanal' },
  { v: '2-3-semana', label: '2-3x/sem' },
  { v: 'diario', label: 'Diario' },
];

const FRECUENCIA_LAVADO = [
  { v: 'menos', label: 'Quincenal' },
  { v: '1-semana', label: '1x/sem' },
  { v: '2-semana', label: '2x/sem' },
  { v: 'cada-2-dias', label: 'C/2 días' },
  { v: 'diario', label: 'Diario' },
];

// ── Componente principal ───────────────────────────────────────────────────
export default function PasoCabello({ data, onChange, errors, onExpressReady, autoCamera }: Props) {
  const [mode, setMode] = useState<Mode>(autoCamera ? 'camera' : 'choose');
  const [iaCampos, setIaCampos] = useState<IACampos>(new Set());
  const [expressReady, setExpressReady] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);

  // Garantía defensiva: si IA sugirió y no hay tipo confirmado, fuerza form
  useEffect(() => {
    if (data.iaTipoSugerido && !data.tipoRizoPrincipal && mode !== 'form') {
      setMode('form');
    }
  }, [data.iaTipoSugerido, data.tipoRizoPrincipal, mode]);

  // ── Corrección de IA ──────────────────────────────────────────────────
  const handleCorrectAI = (
    iaTipoSugerido: string,
    captureMetadata: CaptureMetadata,
    analysisResult: HairAnalysisResult,
    fotoUrls: string[]
  ) => {
    const camposIA = new Set<string>();
    const patch: Partial<WizardData> = {
      tipoRizoPrincipal: '',
      tiposSecundarios: [],
      captureMetadata,
      fotoAnalisis: fotoUrls,
      iaTipoSugerido,
      iaCorreccion: '',
    };

    if (analysisResult.porosidad) {
      patch.porosidad = analysisResult.porosidad;
      camposIA.add('porosidad');
    }
    if (analysisResult.densidad) {
      patch.densidad = analysisResult.densidad;
      camposIA.add('densidad');
    }
    if (analysisResult.danoVisible && analysisResult.danoVisible !== 'ninguno') {
      const mapDano: Record<string, string> = {
        leve: 'Daño mecánico (peinado brusco, ligas, etc.)',
        moderado: 'Daño térmico (textura alterada por calor)',
        severo: 'Daño químico (decoloración, alisado)',
      };
      const danoVal = mapDano[analysisResult.danoVisible];
      if (danoVal) {
        patch.tipoDano = [danoVal];
        camposIA.add('tipoDano');
      }
    } else if (analysisResult.danoVisible === 'ninguno') {
      patch.tipoDano = ['Sin daño visible'];
    }

    setMode('form');
    setIaCampos(camposIA);
    setExpressReady(false);
    onChange(patch);
  };

  // ── Camera complete ───────────────────────────────────────────────────
  const handleCameraComplete = (
    tipoRizoPrincipal: string,
    tiposSecundarios: string[],
    captureMetadata: CaptureMetadata,
    analysisResult: HairAnalysisResult,
    fotoUrls: string[]
  ) => {
    const camposIA = new Set<string>(['tipoRizoPrincipal']);
    const patch: Partial<WizardData> = {
      tipoRizoPrincipal,
      tiposSecundarios,
      captureMetadata,
      fotoAnalisis: fotoUrls,
    };

    if (analysisResult.porosidad) {
      patch.porosidad = analysisResult.porosidad;
      camposIA.add('porosidad');
    }
    if (analysisResult.densidad) {
      patch.densidad = analysisResult.densidad;
      camposIA.add('densidad');
    }
    if (analysisResult.danoVisible && analysisResult.danoVisible !== 'ninguno') {
      const mapDano: Record<string, string> = {
        leve: 'Daño mecánico (peinado brusco, ligas, etc.)',
        moderado: 'Daño térmico (textura alterada por calor)',
        severo: 'Daño químico (decoloración, alisado)',
      };
      const danoVal = mapDano[analysisResult.danoVisible];
      if (danoVal) {
        patch.tipoDano = [danoVal];
        camposIA.add('tipoDano');
      }
    } else if (analysisResult.danoVisible === 'ninguno') {
      patch.tipoDano = ['Sin daño visible'];
    }

    onChange(patch);
    setIaCampos(camposIA);

    const isExpress =
      analysisResult.confianza === 'alta' &&
      !!analysisResult.porosidad &&
      !!analysisResult.densidad;

    setExpressReady(isExpress);
    setMode('form');
  };

  // ── Rizo principal ────────────────────────────────────────────────────
  const selectRizo = (id: string) => {
    vibracionSutil();
    onChange({
      tipoRizoPrincipal: id,
      tiposSecundarios: data.tiposSecundarios.filter((s) => s !== id),
    });
  };

  const handleExpressConfirm = () => {
    vibracionConfirmacion();
    onExpressReady?.();
  };

  // ═══ RENDER · MODO CHOOSE ═════════════════════════════════════════════
  if (mode === 'choose') {
    return (
      <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="v-caps">Capítulo 02 · La materia</div>
          <h1
            style={{
              margin: '4px 0 6px',
              fontFamily: 'var(--font-serif)',
              fontSize: 28,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: 'var(--text-main)',
            }}
          >
            Identifica <em style={{ color: 'var(--secondary-deep)' }}>el patrón</em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Toca una imagen, o usa la cámara IA para una clasificación automática
            (1A–4C, escala Walker).
          </p>
        </div>

        {/* Cámara IA — CTA principal */}
        <button
          type="button"
          onClick={() => setMode('camera')}
          className="active:scale-[0.98] transition-transform"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: 14,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--primary-deep), var(--primary))',
            color: '#F5EDDC',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(232, 194, 144, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Camera size={20} style={{ color: '#E8C290' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15 }}>
              Clasificación con IA
            </div>
            <div
              style={{
                fontSize: 10.5,
                opacity: 0.7,
                letterSpacing: '0.05em',
                marginTop: 2,
              }}
            >
              Cámara · 30 seg · resultado en pantalla
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(232, 194, 144, 0.22)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 9.5,
              fontWeight: 700,
              color: '#E8C290',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            <Sparkles size={10} />
            EXPRESS
          </div>
        </button>

        {/* Manual — secundario */}
        <button
          type="button"
          onClick={() => setMode('form')}
          className="active:scale-[0.98] transition-transform"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: 14,
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--primary-pale)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Pencil size={18} strokeWidth={1.7} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 15,
                color: 'var(--text-main)',
              }}
            >
              Selección manual
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-tertiary)',
                marginTop: 2,
                letterSpacing: '0.04em',
              }}
            >
              Patrón de rizo + atributos paso a paso
            </div>
          </div>
        </button>
      </div>
    );
  }

  // ═══ RENDER · MODO CAMERA ═════════════════════════════════════════════
  if (mode === 'camera') {
    return (
      <CameraCapture
        onComplete={handleCameraComplete}
        onCorrectAI={handleCorrectAI}
        onCancel={() => setMode('choose')}
      />
    );
  }

  // ═══ RENDER · MODO FORM ═══════════════════════════════════════════════
  return (
    <>
      <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="v-caps">Capítulo 02 · La materia</div>
            <h1
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--text-main)',
              }}
            >
              El <em style={{ color: 'var(--secondary-deep)' }}>cabello</em>
            </h1>
          </div>
          {!iaCampos.size && (
            <Btn variant="soft" size="sm" onClick={() => setMode('camera')} icon={<Camera size={12} />}>
              Cámara
            </Btn>
          )}
        </div>

        {/* Banner express */}
        {expressReady && (
          <section
            className="v-grain"
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: 16,
              borderRadius: 16,
              background: 'linear-gradient(135deg, var(--primary-deep) 0%, var(--primary) 100%)',
              color: '#F5EDDC',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={16} style={{ color: '#E8C290' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  letterSpacing: '0.18em',
                  color: 'rgba(232, 194, 144, 0.95)',
                  textTransform: 'uppercase',
                }}
              >
                Modo express
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 16,
                lineHeight: 1.35,
                color: '#fff',
              }}
            >
              «La IA completó el diagnóstico automáticamente. Revisa los campos y confirma.»
            </p>
            <div style={{ marginTop: 14 }}>
              <Btn variant="gold" size="md" fullWidth onClick={handleExpressConfirm}>
                Confirmar y generar plan
              </Btn>
            </div>
          </section>
        )}

        {/* IA badge info */}
        {iaCampos.size > 0 && !expressReady && !data.iaTipoSugerido && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--primary-pale)',
              border: '1px solid rgba(45, 90, 39, 0.18)',
            }}
          >
            <Bot size={14} style={{ color: 'var(--primary)' }} />
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--primary)' }}>
              Campos pre-llenados por IA. Revisa y ajusta si es necesario.
            </p>
          </div>
        )}

        {/* Banner: corrección de IA en curso */}
        {data.iaTipoSugerido && !data.tipoRizoPrincipal && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--treat-recon-bg)',
              border: '1px solid rgba(212, 130, 10, 0.25)',
            }}
          >
            <AlertTriangle size={16} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--treat-recon-color)', lineHeight: 1.4 }}>
              <strong>Corrigiendo diagnóstico de la IA</strong> — La IA sugirió{' '}
              <strong>{data.iaTipoSugerido}</strong>. Selecciona el tipo correcto.
            </p>
          </div>
        )}

        {/* Indicador post-corrección */}
        {data.iaTipoSugerido && data.tipoRizoPrincipal && data.tipoRizoPrincipal !== data.iaTipoSugerido && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--treat-recon-bg)',
              border: '1px solid rgba(212, 130, 10, 0.25)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--treat-recon-color)' }}>
              IA: {data.iaTipoSugerido}
            </span>
            <ArrowRight size={12} style={{ color: 'var(--treat-recon-color)' }} />
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
              Corregido: {data.tipoRizoPrincipal}
            </span>
          </div>
        )}

        {/* Error tipo rizo */}
        {errors.tipoRizoPrincipal && (
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: 'var(--danger)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {errors.tipoRizoPrincipal}
          </p>
        )}

        {/* Tipo de cabello — grid editorial 4×3 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span className="v-caps">Patrón de rizo</span>
            {iaCampos.has('tipoRizoPrincipal') && data.tipoRizoPrincipal && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'var(--primary-pale)',
                  color: 'var(--primary)',
                  borderRadius: 999,
                  padding: '1px 6px',
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <Bot size={8} /> IA
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {rizoTypes.flatMap((g) =>
              g.types.map(({ id }) => {
                const isPrimary = data.tipoRizoPrincipal === id;
                const isIASuggestion = data.iaTipoSugerido === id && !isPrimary;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectRizo(id)}
                    className="active:scale-95 transition-transform"
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1.1',
                      borderRadius: 14,
                      padding: 8,
                      background: isPrimary
                        ? 'var(--primary-deep)'
                        : isIASuggestion
                          ? 'var(--bg-card)'
                          : 'var(--bg-card)',
                      color: isPrimary ? '#F5EDDC' : 'var(--text-main)',
                      border: isPrimary
                        ? 'none'
                        : isIASuggestion
                          ? '1px dashed var(--treat-recon-color)'
                          : '1px solid var(--border-soft)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      overflow: 'hidden',
                      boxShadow: isPrimary ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                    }}
                  >
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: isPrimary ? 'rgba(232, 194, 144, 0.9)' : 'var(--text-tertiary)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {id}
                      </span>
                      {isPrimary && (
                        <Check size={10} strokeWidth={3} style={{ color: '#E8C290' }} />
                      )}
                      {isIASuggestion && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 8,
                            fontWeight: 700,
                            color: 'var(--treat-recon-color)',
                            letterSpacing: '0.1em',
                          }}
                        >
                          IA
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        transform: 'scale(0.8)',
                        margin: '-4px 0',
                        filter: isPrimary ? 'invert(1) hue-rotate(160deg) brightness(1.5)' : undefined,
                        opacity: isPrimary ? 0.85 : 1,
                      }}
                    >
                      <RizoPattern tipo={id} />
                    </div>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: isPrimary ? '#F5EDDC' : 'var(--text-secondary)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {g.group}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected highlight card */}
        {data.tipoRizoPrincipal && (
          <section
            className="v-card"
            style={{
              padding: 14,
              background: 'var(--secondary-pale)',
              border: '1px solid rgba(138, 90, 46, 0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 32,
                  color: 'var(--secondary-deep)',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {data.tipoRizoPrincipal}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
                  Has seleccionado
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, marginTop: 1 }}>
                  {rizoTypes
                    .flatMap((g) => g.types)
                    .find((t) => t.id === data.tipoRizoPrincipal)?.desc ?? ''}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Nota opcional: ¿por qué la IA se equivocó? */}
        {data.iaTipoSugerido && data.tipoRizoPrincipal && data.tipoRizoPrincipal !== data.iaTipoSugerido && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="v-caps">
              ¿Por qué la IA se equivocó? <span style={{ color: 'var(--text-muted)' }}>· opcional</span>
            </span>
            <textarea
              value={data.iaCorreccion ?? ''}
              onChange={(e) => onChange({ iaCorreccion: e.target.value })}
              placeholder="Ej: este no es un cabello 3A, es 2C porque las ondas son más abiertas"
              rows={3}
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--border)',
                outline: 'none',
                fontSize: 13,
                background: 'var(--bg-card)',
                resize: 'none',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-main)',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Esto nos ayuda a mejorar la IA con el tiempo
            </span>
          </label>
        )}

        {/* Mediciones */}
        <div>
          <div className="v-caps" style={{ marginBottom: 10 }}>Atributos del cabello</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PillRow
              label="Porosidad"
              options={POROSIDAD}
              value={data.porosidad || ''}
              onSelect={(v) => onChange({ porosidad: v as WizardData['porosidad'] })}
              iaFilled={iaCampos.has('porosidad')}
            />
            <PillRow
              label="Densidad"
              options={DENSIDAD}
              value={data.densidad || ''}
              onSelect={(v) => onChange({ densidad: v as WizardData['densidad'] })}
              iaFilled={iaCampos.has('densidad')}
            />
            <PillRow
              label="Grosor"
              options={GROSOR}
              value={data.grosor || ''}
              onSelect={(v) => onChange({ grosor: v as WizardData['grosor'] })}
            />
            <PillRow
              label="Elasticidad"
              options={ELASTICIDAD}
              value={data.elasticidad || ''}
              onSelect={(v) => onChange({ elasticidad: v as WizardData['elasticidad'] })}
            />
          </div>
        </div>

        {/* Balance H/P */}
        <div>
          <div className="v-caps" style={{ marginBottom: 8 }}>
            Balance H/P <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· opcional</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {BALANCE_HP.map(({ v, label }) => {
              const sel = data.balanceHP === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => { vibracionSutil(); onChange({ balanceHP: v as WizardData['balanceHP'] }); }}
                  className="active:scale-95 transition-transform"
                  style={{
                    padding: '8px 6px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                    background: sel ? 'var(--primary-pale)' : 'var(--bg-card)',
                    color: sel ? 'var(--primary)' : 'var(--text-secondary)',
                    border: `1px solid ${sel ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Problemas */}
        <div>
          <div className="v-caps" style={{ marginBottom: 8 }}>Problemas principales</div>
          <ChipGroup
            options={PROBLEMAS_RAPIDOS}
            selected={data.problemas}
            onChange={(v) => onChange({ problemas: v })}
          />
        </div>

        {/* + Más detalles */}
        <button
          type="button"
          onClick={() => { vibracionSutil(); setShowDetalle(true); }}
          className="active:scale-[0.98] transition-transform"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 16px',
            borderRadius: 14,
            border: '1px dashed var(--border-strong)',
            background: 'transparent',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {showDetalle ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Más detalles · historial · cuero · puntas · daño
        </button>
      </div>

      {/* ═══ Drawer de detalles ═══════════════════════════════════════════ */}
      {showDetalle && (
        <div
          onClick={() => setShowDetalle(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'rgba(20, 36, 26, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-hi)',
            }}
          >
            {/* Handle + header */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: 'var(--bg-card)',
                padding: '12px 18px 14px',
                borderBottom: '1px solid var(--border-soft)',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--border-strong)',
                  margin: '0 auto 12px',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="v-caps">Capítulo 02 · Detalles</div>
                  <h2
                    style={{
                      margin: '2px 0 0',
                      fontFamily: 'var(--font-serif)',
                      fontSize: 20,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Atributos opcionales
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    Enriquecen el diagnóstico pero no son obligatorios.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetalle(false)}
                  aria-label="Cerrar"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            <div style={{ padding: '18px 18px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <DrawerSection title="Tratamientos químicos previos">
                <ChipGroup
                  options={QUIMICOS}
                  selected={data.quimicos}
                  onChange={(v) => onChange({ quimicos: v })}
                />
              </DrawerSection>

              <DrawerSection title="Frecuencia de calor">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FRECUENCIA_CALOR.map(({ v, label }) => {
                    const sel = data.frecuenciaCalor === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { vibracionSutil(); onChange({ frecuenciaCalor: v }); }}
                        className="active:scale-95 transition-transform"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: sel ? 'var(--primary)' : 'var(--bg-card)',
                          color: sel ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-soft)'}`,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </DrawerSection>

              <DrawerSection title="Frecuencia de lavado">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FRECUENCIA_LAVADO.map(({ v, label }) => {
                    const sel = data.frecuenciaLavado === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { vibracionSutil(); onChange({ frecuenciaLavado: v }); }}
                        className="active:scale-95 transition-transform"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: sel ? 'var(--primary)' : 'var(--bg-card)',
                          color: sel ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-soft)'}`,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </DrawerSection>

              <DrawerSection title="Estado del cuero cabelludo">
                <ChipGroup
                  options={CUERO_OPTIONS}
                  selected={data.estadoCueroCabelludo}
                  onChange={(v) => onChange({ estadoCueroCabelludo: v })}
                />
              </DrawerSection>

              <DrawerSection title="Estado de las puntas">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PUNTAS_OPTIONS.map(({ v, label }) => {
                    const sel = data.estadoPuntas === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { vibracionSutil(); onChange({ estadoPuntas: v }); }}
                        className="active:scale-95 transition-transform"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: sel ? 'var(--primary)' : 'var(--bg-card)',
                          color: sel ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-soft)'}`,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </DrawerSection>

              <DrawerSection title="Tipo de daño">
                <ChipGroup
                  options={DANO_OPTIONS}
                  selected={data.tipoDano}
                  onChange={(v) => onChange({ tipoDano: v })}
                />
              </DrawerSection>

              <Btn
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => { vibracionSutil(); setShowDetalle(false); }}
              >
                Listo · cerrar detalles
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Drawer section helper ──────────────────────────────────────────────────
function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border-soft)',
          marginBottom: 10,
        }}
      >
        <span className="v-caps" style={{ color: 'var(--primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
