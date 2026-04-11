'use client';
import React from 'react';
import { WizardData } from '@/lib/types';
import CheckboxGroup from '../ui/CheckboxGroup';
import Input from '../ui/Input';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

const CUERO_OPTIONS = [
  'Saludable (limpio, sin irritación)',
  'Graso (exceso de sebo)',
  'Seco / descamación',
  'Sensible / rojizo',
  'Caspa seca',
  'Dermatitis seborreica',
  'Foliculitis',
  'Build-up (acumulación de producto)',
];

const PUNTAS_OPTIONS = [
  'Puntas sanas (selladas)',
  'Puntas abiertas leves',
  'Puntas abiertas severas (necesita corte)',
];

const DANO_OPTIONS = [
  'Daño mecánico (peinado brusco, ligas, etc.)',
  'Daño térmico (textura alterada por calor)',
  'Daño químico (decoloración, alisado)',
  'En transición capilar (dos texturas visibles)',
  'Sin daño visible',
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <h3
      className="text-sm font-bold text-[#2D5A27] border-b border-[#E5E5E5] pb-2"
      style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
    >
      {title}
    </h3>
    {children}
  </div>
);

export default function StepCueroCabelludo({ data, onChange, errors }: Props) {
  const enTransicion = data.tipoDano.includes('En transición capilar (dos texturas visibles)');

  return (
    <div className="flex flex-col gap-6 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
        >
          Cuero cabelludo y estado del cabello
        </h2>
        <p className="text-sm text-[#666666]">
          Evalúa el estado del cuero cabelludo y el nivel de daño
        </p>
      </div>

      <Section title="Estado del cuero cabelludo">
        <CheckboxGroup
          options={CUERO_OPTIONS}
          selected={data.estadoCueroCabelludo}
          onChange={(v) => onChange({ estadoCueroCabelludo: v })}
        />
        {errors.estadoCueroCabelludo && (
          <p className="text-xs text-[#8E2D2D]">{errors.estadoCueroCabelludo}</p>
        )}
        <Input
          label="Observaciones del cuero cabelludo"
          value={data.obsCueroCabelludo}
          onChange={(e) => onChange({ obsCueroCabelludo: e.target.value })}
          placeholder="Detalles adicionales..."
        />
      </Section>

      <Section title="Estado de las puntas">
        <div className="flex flex-col gap-2">
          {PUNTAS_OPTIONS.map((opt) => {
            const isSelected = data.estadoPuntas === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ estadoPuntas: opt })}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all duration-200
                  ${
                    isSelected
                      ? opt.includes('severas')
                        ? 'border-[#8E2D2D] bg-red-50 text-[#8E2D2D]'
                        : opt.includes('leves')
                        ? 'border-[#C97A4C] bg-orange-50 text-[#C97A4C]'
                        : 'border-[#2D8E5B] bg-green-50 text-[#2D8E5B]'
                      : 'border-[#E5E5E5] bg-white text-[#2D2D2D] hover:border-[#90B98A]'
                  }
                `}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    isSelected
                      ? opt.includes('severas')
                        ? 'bg-[#8E2D2D] border-[#8E2D2D]'
                        : opt.includes('leves')
                        ? 'bg-[#C97A4C] border-[#C97A4C]'
                        : 'bg-[#2D8E5B] border-[#2D8E5B]'
                      : 'border-[#CCCCCC]'
                  }`}
                />
                <span
                  className="font-medium"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
        {errors.estadoPuntas && (
          <p className="text-xs text-[#8E2D2D]">{errors.estadoPuntas}</p>
        )}
      </Section>

      <Section title="Tipo de daño">
        <CheckboxGroup
          options={DANO_OPTIONS}
          selected={data.tipoDano}
          onChange={(v) => onChange({ tipoDano: v })}
        />

        {enTransicion && (
          <div className="mt-1 p-3 bg-[#FBF4EC] rounded-xl border border-[#E0C4A0]">
            <Input
              label="Línea de demarcación"
              value={data.lineaDemarcacion}
              onChange={(e) => onChange({ lineaDemarcacion: e.target.value })}
              placeholder="Ej: 10 cm desde la raíz, zona temporal"
              hint="¿Dónde cambia la textura del cabello natural al procesado?"
            />
          </div>
        )}
      </Section>
    </div>
  );
}
