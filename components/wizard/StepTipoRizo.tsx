'use client';
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { WizardData } from '@/lib/types';
import { rizoTypes, RizoPattern } from './RizoPatterns';
import Input from '../ui/Input';
import Toggle from '../ui/Toggle';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export default function StepTipoRizo({ data, onChange, errors }: Props) {
  const [showSecundarios, setShowSecundarios] = useState(
    data.tiposSecundarios.length > 0
  );

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
    <div className="flex flex-col gap-5 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Tipo de rizo
        </h2>
        <p className="text-sm text-[#666666]">
          Selecciona el tipo de rizo principal de tu clienta
        </p>
        {errors.tipoRizoPrincipal && (
          <p className="text-xs text-[#8E2D2D] mt-1">{errors.tipoRizoPrincipal}</p>
        )}
      </div>

      {rizoTypes.map(({ group, groupColor, types }) => (
        <div key={group}>
          <div
            className="text-xs font-bold tracking-widest mb-2 px-1"
            style={{ color: groupColor, fontFamily: "'Montserrat', sans-serif" }}
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
                        ? 'border-[#5B2D8E] bg-[#F3EDF9] shadow-md shadow-purple-100'
                        : 'border-[#E5E5E5] bg-white hover:border-[#C4A0E8] hover:bg-[#FAF6FF]'
                    }
                  `}
                >
                  {isPrimary && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#5B2D8E] rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  {isSecondary && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#C9A84C] rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  <RizoPattern tipo={id} />
                  <span
                    className="text-lg font-extrabold"
                    style={{ color: groupColor, fontFamily: "'Montserrat', sans-serif" }}
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
          <div className="mt-3 p-3 bg-[#FDF8EE] rounded-xl border border-[#E8D090]">
            <p className="text-xs font-semibold text-[#9A7A2A] mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
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
                      ${isSelected ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : ''}
                      ${!isSelected && !disabled ? 'border-[#DDDDDD] text-[#666666] hover:border-[#C9A84C]' : ''}
                      ${disabled ? 'opacity-30 cursor-not-allowed border-[#DDDDDD] text-[#CCCCCC]' : ''}
                    `}
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
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
  );
}
