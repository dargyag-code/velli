'use client';
// ══════════════════════════════════════════════════════════════════════════
// R5 · Canas «más del 50 %». El asistente guarda ese tramo, que abarca dos
// de CO-05: 1/2 tubo de serie natural (50–75 %) o 3/4 con el oxidante
// bloqueado a 20 vol (75–100 %). La estilista elige con un toque; mientras no
// elija, la calculadora no muestra guía ni fórmula.
// ══════════════════════════════════════════════════════════════════════════

import { PORCENTAJE_CANAS_POR_TRAMO } from '@/lib/color/integracion';

const TRAMOS: { v: number; label: string }[] = [
  { v: PORCENTAJE_CANAS_POR_TRAMO.entre_50_75, label: 'Entre 50 y 75 %' },
  { v: PORCENTAJE_CANAS_POR_TRAMO.mas_75, label: 'Más del 75 %' },
];

export default function SelectorTramoCanas({
  valor,
  onChange,
}: {
  valor: number | null;
  onChange: (v: number) => void;
}) {
  const pendiente = valor === null;
  return (
    <div role="group" aria-labelledby="tramo-canas" className="mb-3 font-sans">
      <span
        id="tramo-canas"
        className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block"
      >
        Tramo preciso de canas (CO-05)
      </span>
      <p
        className={`mt-1 mb-2 text-xs leading-relaxed ${
          pendiente ? 'text-[#52142B] font-medium' : 'text-[#6B535C]'
        }`}
      >
        {pendiente
          ? 'El diagnóstico reporta «más del 50 %». Elige el tramo exacto para calcular la cobertura de canas.'
          : 'Tramo de canas seleccionado para la cobertura técnica (CO-05).'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TRAMOS.map(({ v, label }) => {
          const on = valor === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(v)}
              className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold tabular-nums border transition-all cursor-pointer ${
                on
                  ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]'
                  : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8] hover:text-[#3B0D1E]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
