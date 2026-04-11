'use client';
import React, { useState } from 'react';
import { Check, Camera, Sparkles } from 'lucide-react';
import { WizardData, CaptureMetadata } from '@/lib/types';
import { rizoTypes, RizoPattern } from './RizoPatterns';
import Input from '../ui/Input';
import Toggle from '../ui/Toggle';
import CameraCapture from './CameraCapture';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export default function StepTipoRizo({ data, onChange, errors }: Props) {
  const [showSecundarios, setShowSecundarios] = useState(
    data.tiposSecundarios.length > 0
  );
  const [showCamera, setShowCamera] = useState(false);

  const handleCameraComplete = (
    tipoRizoPrincipal: string,
    tiposSecundarios: string[],
    captureMetadata: CaptureMetadata,
    _analysisResult: import('@/lib/hairAnalysis').HairAnalysisResult
  ) => {
    setShowCamera(false);
    onChange({ tipoRizoPrincipal, tiposSecundarios, captureMetadata });
    if (tiposSecundarios.length > 0) setShowSecundarios(true);
  };

  const selectPrincipal = (id: string) => {
    onChange({
      tipoRizoPrincipal: id,
      tiposSecundarios: data.tiposSecundarios.filter((s) => s !== id),
    });
  };

  const toggleSecundario = (id: string) => {
    if (data.tiposSecundarios.includes(id)) {
      onChange({ tiposSecundarios: data.tiposSecundarios.filter((s) => s !== id) });
    } else if (data.tiposSecundarios.length < 2 && id !== data.tipoRizoPrincipal) {
      onChange({ tiposSecundarios: [...data.tiposSecundarios, id] });
    }
  };

  return (
    <>
    {showCamera && (
      <CameraCapture
        onComplete={handleCameraComplete}
        onCancel={() => setShowCamera(false)}
      />
    )}
    <div className="flex flex-col gap-5 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
        >
          Tipo de cabello
        </h2>
        <p className="text-sm text-[#666666]">
          Selecciona el tipo de cabello principal de tu clienta
        </p>
        {errors.tipoRizoPrincipal && (
          <p className="text-xs text-[#8E2D2D] mt-1">{errors.tipoRizoPrincipal}</p>
        )}
      </div>

      {/* Botón de análisis IA */}
      <button
        type="button"
        onClick={() => setShowCamera(true)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-[#2D5A27] bg-[#F0F5EF] hover:bg-[#EEF5ED] active:scale-[0.98] transition-all duration-200"
      >
        <div className="w-10 h-10 rounded-xl bg-[#2D5A27] flex items-center justify-center shrink-0">
          <Camera size={20} className="text-white" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-[#2D5A27]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Analizar con cámara IA
          </p>
          <p className="text-xs text-[#7A9B76]">3 fotos guiadas · diagnóstico automático</p>
        </div>
        <Sparkles size={16} className="text-[#C9956B] ml-auto" />
      </button>

      {data.captureMetadata && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <p className="text-xs text-green-700">
            Analizado con IA · score {data.captureMetadata.qualityScore}/100
          </p>
        </div>
      )}

      {rizoTypes.map(({ group, groupColor, types }) => (
        <div key={group}>
          <div
            className="text-xs font-bold tracking-widest mb-2 px-1"
            style={{ color: groupColor, fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
          >
            {group}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {types.map(({ id, desc }) => {
              const isPrimary = data.tipoRizoPrincipal === id;
              const isSecondary = data.tiposSecundarios.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectPrincipal(id)}
                  className={`
                    relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2
                    transition-all duration-200 text-center
                    ${
                      isPrimary
                        ? 'border-[#2D5A27] bg-[#EEF5ED] shadow-md shadow-green-100'
                        : 'border-[#E5E5E5] bg-white hover:border-[#90B98A] hover:bg-[#F0F5EF]'
                    }
                  `}
                >
                  {isPrimary && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#2D5A27] rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  {isSecondary && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#C9956B] rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  <RizoPattern tipo={id} />
                  <span
                    className="text-lg font-extrabold"
                    style={{ color: groupColor, fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    {id}
                  </span>
                  <p className="text-[10px] text-[#666666] leading-tight">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-2">
        <Toggle
          label="¿Tiene tipos secundarios de rizo?"
          hint="Zonas donde el patrón cambia (hasta 2 tipos adicionales)"
          checked={showSecundarios}
          onChange={(v) => {
            setShowSecundarios(v);
            if (!v) onChange({ tiposSecundarios: [] });
          }}
        />

        {showSecundarios && data.tipoRizoPrincipal && (
          <div className="mt-3 p-3 bg-[#FBF4EC] rounded-xl border border-[#E0C4A0]">
            <p className="text-xs font-semibold text-[#9A6A3A] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Selecciona hasta 2 tipos secundarios:
            </p>
            <div className="flex flex-wrap gap-2">
              {rizoTypes.flatMap((g) => g.types).map(({ id }) => {
                if (id === data.tipoRizoPrincipal) return null;
                const isSelected = data.tiposSecundarios.includes(id);
                const disabled = !isSelected && data.tiposSecundarios.length >= 2;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleSecundario(id)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                      ${isSelected ? 'bg-[#C9956B] text-white border-[#C9956B]' : ''}
                      ${!isSelected && !disabled ? 'border-[#DDDDDD] text-[#666666] hover:border-[#C9956B]' : ''}
                      ${disabled ? 'opacity-30 cursor-not-allowed border-[#DDDDDD] text-[#CCCCCC]' : ''}
                    `}
                    style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Input
        label="Zona donde cambia el patrón"
        value={data.zonasCambio}
        onChange={(e) => onChange({ zonasCambio: e.target.value })}
        placeholder="Ej: coronilla más rizada, nuca más afro"
      />
    </div>
    </>
  );
}
