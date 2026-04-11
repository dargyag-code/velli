'use client';
import React, { useState } from 'react';
import { Camera, Pencil, Sparkles, ChevronDown, ChevronUp, X, Check, Bot } from 'lucide-react';
import { WizardData, CaptureMetadata } from '@/lib/types';
import { HairAnalysisResult } from '@/lib/hairAnalysis';
import { rizoTypes, RizoPattern } from './RizoPatterns';
import CameraCapture from './CameraCapture';
import { vibracionSutil, vibracionConfirmacion } from '@/lib/haptics';

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
  onExpressReady?: () => void;
}

type Mode = 'choose' | 'camera' | 'form';

// Campos con IA pre-rellenos
type IACampos = Set<string>;

// ── Componente pill selector de 3 opciones ──────────────────────────────────
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
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 shrink-0">
        <span className="text-xs font-semibold text-[#444]" style={serif}>{label}</span>
        {iaFilled && value && (
          <div className="inline-flex items-center gap-0.5 ml-1 bg-[#EEF5ED] text-[#2D5A27] rounded-full px-1 py-0.5">
            <Bot size={8} />
            <span style={{ fontSize: '9px' }}>IA</span>
          </div>
        )}
      </div>
      <div className="flex gap-1.5 flex-1">
        {options.map(({ v, label: lbl }) => (
          <button
            key={v}
            type="button"
            onClick={() => { vibracionSutil(); onSelect(v); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-150 active:scale-95 ${
              value === v
                ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#90B98A]'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Chip multiselect ─────────────────────────────────────────────────────────
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
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-150 active:scale-95 ${
              on
                ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#90B98A]'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Opciones del formulario ──────────────────────────────────────────────────

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
  { v: 'hidratacion', label: '💧 Hid.' },
  { v: 'nutricion', label: '🌿 Nutr.' },
  { v: 'proteina', label: '⚡ Prot.' },
  { v: 'equilibrado', label: '✨ Equil.' },
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

// ── Opciones del drawer de detalles ──────────────────────────────────────────

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

const ESTRES = [
  { v: 'bajo', label: 'Bajo' },
  { v: 'medio', label: 'Medio' },
  { v: 'alto', label: 'Alto' },
];

// ── Componente principal ─────────────────────────────────────────────────────

export default function PasoCabello({ data, onChange, errors, onExpressReady }: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [iaCampos, setIaCampos] = useState<IACampos>(new Set());
  const [expressReady, setExpressReady] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);

  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  // ── Camera complete ─────────────────────────────────────────────────────
  const handleCameraComplete = (
    tipoRizoPrincipal: string,
    tiposSecundarios: string[],
    captureMetadata: CaptureMetadata,
    analysisResult: HairAnalysisResult,
    fotoUrls: string[]
  ) => {
    console.log('[PasoCabello] Datos recibidos de cámara:', { tipoRizoPrincipal, tiposSecundarios, captureMetadata, analysisResult });

    const camposIA = new Set<string>(['tipoRizoPrincipal']);
    const patch: Partial<WizardData> = {
      tipoRizoPrincipal,
      tiposSecundarios,
      captureMetadata,
      fotoAnalisis: fotoUrls,
    };

    // Pre-llenar campos desde IA
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

    // Modo express: confianza alta + porosidad + densidad detectados
    const isExpress =
      analysisResult.confianza === 'alta' &&
      !!analysisResult.porosidad &&
      !!analysisResult.densidad;

    setExpressReady(isExpress);
    setMode('form');
  };

  // ── Rizo principal ───────────────────────────────────────────────────────
  const selectRizo = (id: string) => {
    vibracionSutil();
    onChange({ tipoRizoPrincipal: id, tiposSecundarios: data.tiposSecundarios.filter((s) => s !== id) });
  };

  // ── Express confirm ──────────────────────────────────────────────────────
  const handleExpressConfirm = () => {
    vibracionConfirmacion();
    onExpressReady?.();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Estado: elegir modo
  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-5 step-enter">
        <div>
          <h2 className="text-lg font-bold text-[#2D2D2D] mb-1" style={serif}>
            El cabello
          </h2>
          <p className="text-xs text-[#999999]">¿Cómo quieres diagnosticar?</p>
        </div>

        {/* Botón principal: cámara */}
        <button
          type="button"
          onClick={() => setMode('camera')}
          className="w-full flex flex-col items-center gap-3 px-5 py-6 rounded-3xl bg-[#2D5A27] active:scale-[0.98] transition-all shadow-lg shadow-green-900/20"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <Camera size={28} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-white" style={serif}>
              Escanear con cámara IA
            </p>
            <p className="text-xs text-[#B8D4B5] mt-1">
              Recomendado · 3 fotos · diagnóstico automático
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
            <Sparkles size={12} className="text-[#FFD700]" />
            <span className="text-xs text-white font-semibold">Modo Express disponible</span>
          </div>
        </button>

        {/* Botón secundario: manual */}
        <button
          type="button"
          onClick={() => setMode('form')}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-3xl bg-white border-2 border-[#E5E5E5] active:scale-[0.98] transition-all hover:border-[#90B98A]"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center">
            <Pencil size={18} className="text-[#666]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[#2D2D2D]" style={serif}>
              Llenar manualmente
            </p>
            <p className="text-xs text-[#999]">Selección rápida paso a paso</p>
          </div>
        </button>
      </div>
    );
  }

  // Estado: cámara
  if (mode === 'camera') {
    return (
      <CameraCapture
        onComplete={handleCameraComplete}
        onCancel={() => setMode('choose')}
      />
    );
  }

  // Estado: formulario (manual o revisión post-cámara)
  return (
    <>
      <div className="flex flex-col gap-4 step-enter">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#2D2D2D]" style={serif}>
            El cabello
          </h2>
          {mode === 'form' && !iaCampos.size && (
            <button
              type="button"
              onClick={() => setMode('camera')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EEF5ED] text-xs font-semibold text-[#2D5A27] border border-[#90B98A]"
            >
              <Camera size={12} />
              Usar cámara
            </button>
          )}
        </div>

        {/* Banner express */}
        {expressReady && (
          <div className="flex flex-col gap-3 bg-gradient-to-r from-[#2D5A27] to-[#3D7A35] rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-[#FFD700]" />
              <p className="text-sm font-bold" style={serif}>
                La IA completó el diagnóstico automáticamente
              </p>
            </div>
            <p className="text-xs text-[#B8D4B5]">
              Revisa los campos seleccionados y confirma si estás de acuerdo.
            </p>
            <button
              type="button"
              onClick={handleExpressConfirm}
              className="w-full py-3 rounded-xl bg-white text-[#2D5A27] font-bold text-sm active:scale-[0.98] transition-all"
              style={serif}
            >
              Confirmar y generar plan
            </button>
          </div>
        )}

        {/* IA badge info */}
        {iaCampos.size > 0 && !expressReady && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF5ED] rounded-xl border border-[#90B98A]">
            <Bot size={14} className="text-[#2D5A27]" />
            <p className="text-xs text-[#2D5A27]">
              Campos pre-llenados por IA. Revisa y ajusta si es necesario.
            </p>
          </div>
        )}

        {/* Error tipo rizo */}
        {errors.tipoRizoPrincipal && (
          <p className="text-xs text-[#8E2D2D] -mb-1">{errors.tipoRizoPrincipal}</p>
        )}

        {/* Tipo de cabello — grid compacto */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-bold text-[#444]" style={serif}>Tipo de cabello</p>
            {iaCampos.has('tipoRizoPrincipal') && data.tipoRizoPrincipal && (
              <span className="inline-flex items-center gap-0.5 bg-[#EEF5ED] text-[#2D5A27] rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                <Bot size={8} /> IA
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {rizoTypes.flatMap((g) =>
              g.types.map(({ id }) => {
                const isPrimary = data.tipoRizoPrincipal === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectRizo(id)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-150 active:scale-95 ${
                      isPrimary
                        ? 'border-[#2D5A27] bg-[#EEF5ED] shadow-sm'
                        : 'border-[#E5E5E5] bg-white hover:border-[#90B98A]'
                    }`}
                  >
                    {isPrimary && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#2D5A27] rounded-full flex items-center justify-center">
                        <Check size={9} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                    <div className="scale-75 -my-1">
                      <RizoPattern tipo={id} />
                    </div>
                    <span className="text-xs font-extrabold text-[#2D5A27]" style={serif}>{id}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Separador */}
        <div className="h-px bg-[#F0F0F0]" />

        {/* Mediciones — pill rows */}
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold text-[#444]" style={serif}>Mediciones</p>
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

        {/* Balance H/P */}
        <div>
          <p className="text-xs font-bold text-[#444] mb-2" style={serif}>
            Balance H/P
            <span className="text-[#AAAAAA] font-normal ml-1">(opcional)</span>
          </p>
          <div className="flex gap-1.5">
            {BALANCE_HP.map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => { vibracionSutil(); onChange({ balanceHP: v as WizardData['balanceHP'] }); }}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all duration-150 active:scale-95 ${
                  data.balanceHP === v
                    ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                    : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#90B98A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Problemas */}
        <div>
          <p className="text-xs font-bold text-[#444] mb-2" style={serif}>
            Problemas principales
          </p>
          <ChipGroup
            options={PROBLEMAS_RAPIDOS}
            selected={data.problemas}
            onChange={(v) => onChange({ problemas: v })}
          />
        </div>

        {/* Botón + Más detalles */}
        <button
          type="button"
          onClick={() => { vibracionSutil(); setShowDetalle(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#CCCCCC] text-xs font-semibold text-[#888] hover:border-[#90B98A] hover:text-[#2D5A27] transition-colors"
        >
          {showDetalle ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          + Más detalles (historial, cuero cabelludo)
        </button>
      </div>

      {/* ── Drawer de detalles opcionales ── */}
      {showDetalle && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setShowDetalle(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F0F0]">
              <div>
                <div className="w-10 h-1 bg-[#DDDDDD] rounded-full mx-auto mb-2" />
                <p className="text-sm font-bold text-[#2D2D2D]" style={serif}>
                  Detalles opcionales
                </p>
                <p className="text-xs text-[#999]">Enriquecen el diagnóstico pero no son obligatorios</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetalle(false)}
                className="w-8 h-8 rounded-full bg-[#F0F0F0] flex items-center justify-center"
              >
                <X size={14} className="text-[#666]" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-5 pb-10">
              {/* Historial químico */}
              <Section title="Tratamientos químicos previos" serif={serif}>
                <ChipGroup
                  options={QUIMICOS}
                  selected={data.quimicos}
                  onChange={(v) => onChange({ quimicos: v })}
                />
              </Section>

              {/* Frecuencia de calor */}
              <Section title="Frecuencia de calor" serif={serif}>
                <div className="flex gap-1.5 flex-wrap">
                  {FRECUENCIA_CALOR.map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { vibracionSutil(); onChange({ frecuenciaCalor: v }); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all active:scale-95 ${
                        data.frecuenciaCalor === v
                          ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                          : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#90B98A]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Frecuencia de lavado */}
              <Section title="Frecuencia de lavado" serif={serif}>
                <div className="flex gap-1.5 flex-wrap">
                  {FRECUENCIA_LAVADO.map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { vibracionSutil(); onChange({ frecuenciaLavado: v }); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all active:scale-95 ${
                        data.frecuenciaLavado === v
                          ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                          : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#90B98A]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Cuero cabelludo */}
              <Section title="Estado del cuero cabelludo" serif={serif}>
                <ChipGroup
                  options={CUERO_OPTIONS}
                  selected={data.estadoCueroCabelludo}
                  onChange={(v) => onChange({ estadoCueroCabelludo: v })}
                />
              </Section>

              {/* Estado de puntas */}
              <Section title="Estado de las puntas" serif={serif}>
                <div className="flex gap-1.5 flex-wrap">
                  {PUNTAS_OPTIONS.map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { vibracionSutil(); onChange({ estadoPuntas: v }); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all active:scale-95 ${
                        data.estadoPuntas === v
                          ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                          : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#90B98A]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Tipo de daño */}
              <Section title="Tipo de daño" serif={serif}>
                <ChipGroup
                  options={DANO_OPTIONS}
                  selected={data.tipoDano}
                  onChange={(v) => onChange({ tipoDano: v })}
                />
              </Section>

              {/* Botón cerrar */}
              <button
                type="button"
                onClick={() => { vibracionSutil(); setShowDetalle(false); }}
                className="w-full py-3 rounded-2xl bg-[#2D5A27] text-white font-bold text-sm"
                style={serif}
              >
                Listo — cerrar detalles
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sección del drawer ────────────────────────────────────────────────────────
function Section({
  title,
  children,
  serif,
}: {
  title: string;
  children: React.ReactNode;
  serif: React.CSSProperties;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-[#2D5A27] pb-1 border-b border-[#EEEEEE]" style={serif}>
        {title}
      </p>
      {children}
    </div>
  );
}
