'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { WizardData } from '@/lib/types';
import Toggle from '../ui/Toggle';
import Select from '../ui/Select';
import Input from '../ui/Input';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

const ESTRES_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
];

export default function StepSalud({ data, onChange, errors }: Props) {
  return (
    <div className="flex flex-col gap-5 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Información de salud
        </h2>
        <p className="text-sm text-[#666666]">
          Esta información ayuda a personalizar mejor el tratamiento
        </p>
      </div>

      <div className="bg-[#FDF8EE] rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#9A7A2A]">
          Esta información es confidencial y solo se usa para adaptar el tratamiento capilar de forma segura.
        </p>
      </div>

      <Toggle
        label="¿Tiene alergias a productos capilares?"
        checked={!!data.alergias}
        onChange={(v) => onChange({ alergias: v ? ' ' : '' })}
      />

      {data.alergias !== '' && data.alergias !== undefined && (
        <div className="ml-4">
          <Input
            label="Describe las alergias"
            value={data.alergias}
            onChange={(e) => onChange({ alergias: e.target.value })}
            placeholder="Ej: alérgica a parabenos, sensible al sulfato de sodio..."
          />
        </div>
      )}

      <Input
        label="Condiciones médicas relevantes"
        value={data.condicionesMedicas}
        onChange={(e) => onChange({ condicionesMedicas: e.target.value })}
        placeholder="Ej: hipotiroidismo, anemia, SOP, alopecia..."
        hint="Condiciones que pueden afectar la salud capilar"
      />

      <Input
        label="Medicamentos que pueden afectar el cabello"
        value={data.medicamentos}
        onChange={(e) => onChange({ medicamentos: e.target.value })}
        placeholder="Ej: anticonceptivos, antidepresivos, isotretinoína..."
      />

      <div className="bg-[#F3EDF9] rounded-2xl p-4">
        <Toggle
          label="¿Embarazo o lactancia?"
          hint="Importante para evitar ciertos ingredientes"
          checked={data.embarazo}
          onChange={(v) => onChange({ embarazo: v })}
        />
        {data.embarazo && (
          <div className="mt-3 p-3 bg-white rounded-xl border border-[#C4A0E8]">
            <p className="text-xs text-[#5B2D8E] font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              ⚠️ Importante:
            </p>
            <p className="text-xs text-[#666666] mt-1">
              Se evitarán productos con formol, keratinas fuertes y químicos agresivos. Se priorizarán tratamientos con ingredientes naturales.
            </p>
          </div>
        )}
      </div>

      <Select
        label="Nivel de estrés"
        value={data.nivelEstres}
        onChange={(e) => onChange({ nivelEstres: e.target.value })}
        options={ESTRES_OPTIONS}
        placeholder="Seleccionar..."
        hint="El estrés puede acelerar la caída y fragilidad capilar"
      />
    </div>
  );
}
