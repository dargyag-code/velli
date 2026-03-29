'use client';
import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { WizardData } from '@/lib/types';
import Input from '../ui/Input';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

interface RadioOption {
  value: string;
  label: string;
  desc: string;
}

interface TestConfig {
  key: keyof WizardData;
  obsKey: keyof WizardData;
  title: string;
  help: string;
  options: RadioOption[];
  colorMap: Record<string, string>;
}

const TESTS: TestConfig[] = [
  {
    key: 'porosidad',
    obsKey: 'porosidadObs',
    title: 'Porosidad',
    help:
      'Prueba del vaso de agua: coloca un cabello limpio (sin producto) en un vaso con agua temperatura ambiente y espera 3-4 minutos. Observa dónde queda el cabello.',
    options: [
      { value: 'baja', label: 'Baja', desc: 'Flota en la superficie. Cutícula cerrada. Repele humedad. Tarda en mojarse y secarse. El producto se acumula.' },
      { value: 'media', label: 'Media', desc: 'Queda en el medio. Cutícula equilibrada. Absorbe y retiene bien. Es el estado ideal.' },
      { value: 'alta', label: 'Alta', desc: 'Se hunde al fondo rápido. Cutícula abierta/dañada. Absorbe rápido pero pierde humedad. Común en cabello procesado.' },
    ],
    colorMap: { baja: 'blue', media: 'green', alta: 'orange' },
  },
  {
    key: 'densidad',
    obsKey: 'obsCueroCabelludo',
    title: 'Densidad',
    help:
      'Prueba de la cola de caballo: recoge todo el cabello en una cola sin gel ni producto y mide cuántas vueltas da el elástico.',
    options: [
      { value: 'baja', label: 'Baja', desc: 'Se ve el cuero cabelludo fácilmente. El elástico da muchas vueltas. Cabello escaso.' },
      { value: 'media', label: 'Media', desc: 'Cuero cabelludo poco visible. Cola de caballo normal. El elástico da 1-2 vueltas.' },
      { value: 'alta', label: 'Alta', desc: 'Cuero cabelludo no visible. Mucho volumen. El elástico apenas da una vuelta.' },
    ],
    colorMap: { baja: 'blue', media: 'green', alta: 'purple' },
  },
  {
    key: 'grosor',
    obsKey: 'obsCueroCabelludo',
    title: 'Grosor de la hebra',
    help:
      'Toma una sola hebra de cabello y compárala con un hilo de coser sosteniéndola entre los dedos índice y pulgar.',
    options: [
      { value: 'fino', label: 'Fino', desc: 'Casi invisible entre los dedos. Más delgado que un hilo de coser. Muy frágil, se rompe fácilmente.' },
      { value: 'medio', label: 'Medio', desc: 'Se siente entre los dedos. Similar al grosor de un hilo de coser estándar. Equilibrado.' },
      { value: 'grueso', label: 'Grueso', desc: 'Se siente fuerte y resistente. Más grueso que un hilo. Puede sentirse algo áspero.' },
    ],
    colorMap: { fino: 'blue', medio: 'green', grueso: 'purple' },
  },
  {
    key: 'elasticidad',
    obsKey: 'obsCueroCabelludo',
    title: 'Elasticidad',
    help:
      'Toma una hebra de cabello húmedo y estírala suavemente. Observa cuánto se estira y si regresa a su forma original.',
    options: [
      { value: 'baja', label: 'Baja', desc: 'Se rompe inmediatamente al estirar sin casi ceder. Necesita proteína urgente. Sin estructura.' },
      { value: 'media', label: 'Media', desc: 'Se estira un 20-30% y regresa a su forma. Buen balance proteína-hidratación.' },
      { value: 'alta', label: 'Alta', desc: 'Se estira bastante y rebota completamente. Buena salud capilar. Fibra fuerte y flexible.' },
    ],
    colorMap: { baja: 'orange', media: 'green', alta: 'blue' },
  },
  {
    key: 'balanceHP',
    obsKey: 'obsCueroCabelludo',
    title: 'Balance humedad-proteína',
    help:
      'Este es el indicador más importante para elegir el tratamiento correcto. Evalúa cómo se siente el cabello en su estado natural.',
    options: [
      { value: 'hidratacion', label: 'Necesita hidratación', desc: 'Se siente seco, áspero, sin brillo. Frizz por falta de agua. Corte sin mucha elasticidad.' },
      { value: 'nutricion', label: 'Necesita nutrición', desc: 'Poroso, opaco, deshidratado crónico. Pierde humedad rápido. Necesita aceites y mantecas para sellar.' },
      { value: 'proteina', label: 'Necesita proteína', desc: 'Elástico como chicle o goma, se rompe mojado, sin estructura. Fatiga de hidratación. Exceso de agua sin estructura.' },
      { value: 'equilibrado', label: 'Equilibrado', desc: 'Elástico, brillante, bien definido. Solo necesita mantenimiento regular.' },
    ],
    colorMap: { hidratacion: 'blue', nutricion: 'green', proteina: 'orange', equilibrado: 'purple' },
  },
];

const optionColors: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  green: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  orange: { bg: '#FFEDD5', border: '#F97316', text: '#9A3412' },
  purple: { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' },
};

function HelpTooltip({ text, open, onClose }: { text: string; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={16} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-[#F3EDF9] rounded-full flex items-center justify-center">
            <HelpCircle size={18} className="text-[#5B2D8E]" />
          </div>
          <p className="font-bold text-[#2D2D2D] text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            ¿Cómo hacer la prueba?
          </p>
        </div>
        <p className="text-sm text-[#444444] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export default function StepDiagnostico({ data, onChange, errors }: Props) {
  const [openHelp, setOpenHelp] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Diagnóstico técnico
        </h2>
        <p className="text-sm text-[#666666]">
          Evalúa las características del cabello con estas pruebas
        </p>
      </div>

      {TESTS.map((test) => {
        const value = data[test.key] as string;
        return (
          <div key={test.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3
                className="text-sm font-bold text-[#2D2D2D]"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {test.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpenHelp(test.key)}
                className="p-1 rounded-full bg-[#F3EDF9] hover:bg-[#E8D9F5] transition-colors"
              >
                <HelpCircle size={15} className="text-[#5B2D8E]" />
              </button>
              {errors[test.key] && (
                <span className="text-xs text-[#8E2D2D] ml-auto">{errors[test.key]}</span>
              )}
            </div>

            <div className={`grid gap-2 ${test.options.length > 3 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {test.options.map((opt) => {
                const colorKey = test.colorMap[opt.value] || 'purple';
                const colors = optionColors[colorKey];
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ [test.key]: opt.value })}
                    className={`
                      text-left p-3.5 rounded-2xl border-2 transition-all duration-200
                      ${isSelected
                        ? 'shadow-md scale-[1.01]'
                        : 'border-[#E5E5E5] bg-white hover:border-[#C4A0E8] hover:bg-[#FAF6FF]'
                      }
                    `}
                    style={
                      isSelected
                        ? { backgroundColor: colors.bg, borderColor: colors.border }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                          isSelected ? 'border-0' : 'border-[#CCCCCC]'
                        }`}
                        style={isSelected ? { backgroundColor: colors.border } : {}}
                      >
                        {isSelected && (
                          <div className="w-full h-full rounded-full bg-white scale-50 m-auto" style={{ margin: '4px' }} />
                        )}
                      </div>
                      <span
                        className="text-sm font-bold"
                        style={{
                          color: isSelected ? colors.text : '#2D2D2D',
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#666666] leading-snug pl-6">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {test.key === 'porosidad' && (
              <Input
                label="Observaciones (opcional)"
                value={data.porosidadObs}
                onChange={(e) => onChange({ porosidadObs: e.target.value })}
                placeholder="Notas adicionales sobre la porosidad..."
              />
            )}

            <HelpTooltip
              text={test.help}
              open={openHelp === test.key}
              onClose={() => setOpenHelp(null)}
            />
          </div>
        );
      })}
    </div>
  );
}
