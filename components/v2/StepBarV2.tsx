'use client';
import React from 'react';
import { Check } from 'lucide-react';

interface StepBarV2Props {
  /** Paso actual, 0-indexed */
  currentStep: number;
  /** Total de pasos - 1 (compat con la API antigua de ProgressBar). Si se pasa stepLabels, ese length tiene precedencia. */
  totalSteps?: number;
  stepLabels?: string[];
}

const DEFAULT_LABELS = ['La clienta', 'El cabello', 'El plan'];

export default function StepBarV2({ currentStep, totalSteps, stepLabels }: StepBarV2Props) {
  const labels = stepLabels && stepLabels.length > 0
    ? stepLabels
    : Array.from({ length: (totalSteps ?? DEFAULT_LABELS.length - 1) + 1 }, (_, i) => DEFAULT_LABELS[i] ?? `Paso ${i + 1}`);

  return (
    <div
      style={{
        padding: '54px 16px 18px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 768, margin: '0 auto' }}>
        {labels.map((label, i) => {
          const done = i < currentStep;
          const cur = i === currentStep;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: i <= currentStep ? 'var(--primary)' : 'var(--border)',
                    margin: '0 8px',
                    position: 'relative',
                    top: -8,
                    transition: 'background 0.4s ease',
                  }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div
                  className={cur ? 'v-pulse' : ''}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: done || cur ? 'linear-gradient(180deg, #3D7A35, #2D5A27)' : 'transparent',
                    border: !done && !cur ? '1px dashed var(--border-strong)' : 'none',
                    color: done || cur ? '#fff' : 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-serif)',
                    fontSize: 14,
                    fontStyle: 'italic',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : <span>{i + 1}</span>}
                </div>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: cur ? 700 : 500,
                    color: cur ? 'var(--text-main)' : 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
