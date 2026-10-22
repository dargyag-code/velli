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
  valor, onChange,
}: {
  valor: number | null; onChange: (v: number) => void;
}) {
  const pendiente = valor === null;
  return (
    <div role="group" aria-labelledby="tramo-canas" style={{ marginBottom: 12 }}>
      <span id="tramo-canas" className="v-caps">Canas</span>
      <p
        style={{
          margin: '4px 0 6px', fontSize: 11.5, lineHeight: 1.45,
          color: pendiente ? 'var(--secondary-deep)' : 'var(--text-secondary)',
        }}
      >
        {pendiente
          ? 'El diagnóstico dice «más del 50 %». Elige el tramo para calcular la cobertura de canas (CO-05).'
          : 'Tramo de canas elegido para la cobertura (CO-05).'}
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        {TRAMOS.map(({ v, label }) => {
          const on = valor === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(v)}
              style={{
                flex: 1, padding: '9px 8px', borderRadius: 12, fontSize: 12,
                fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
                color: on ? 'var(--primary)' : 'var(--text-secondary)',
                border: `1px solid ${on ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
