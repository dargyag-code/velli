'use client';
import React from 'react';
import { Check } from 'lucide-react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function ProgressBar({ currentStep, totalSteps, stepLabels }: ProgressBarProps) {
  const pct = (currentStep / totalSteps) * 100;
  const defaultLabels = ['Clienta', 'Historial', 'Tipo de cabello', 'Diagnóstico', 'Cuero cab.', 'Salud', 'Resultado'];
  const labels = stepLabels || defaultLabels;
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  return (
    <div
      className="bg-white border-b border-[#E5E5E5] px-4 pt-4 pb-4"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
    >
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3 max-w-2xl mx-auto">
        {Array.from({ length: totalSteps + 1 }, (_, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  className="flex-1 mx-1.5 transition-all duration-500"
                  style={{
                    height: 2,
                    borderRadius: 2,
                    background: i <= currentStep
                      ? 'linear-gradient(90deg, #2D5A27, #3D7A35)'
                      : '#E5E5E5',
                  }}
                />
              )}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  text-xs font-bold transition-all duration-300
                  ${isDone ? 'bg-[#2D5A27] text-white shadow-sm'
                    : isCurrent ? 'bg-[#2D5A27] text-white pulse-ring'
                    : 'bg-white text-[#AAAAAA] border-2 border-dashed border-[#CCCCCC]'}
                `}
                style={serif}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : (
                  <span style={{ fontSize: 12 }}>{i + 1}</span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Label + sub-bar */}
      <div className="text-center mb-2">
        <p className="text-xs text-[#999999]" style={serif}>
          Paso {currentStep + 1} de {totalSteps + 1}
        </p>
        <p className="text-sm font-bold text-[#2D5A27]" style={serif}>
          {labels[currentStep]}
        </p>
      </div>

      {/* Progress line */}
      <div className="h-1 bg-[#E5E5E5] rounded-full overflow-hidden max-w-2xl mx-auto">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #2D5A27, #C9956B)',
          }}
        />
      </div>
    </div>
  );
}
