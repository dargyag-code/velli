'use client';
import React from 'react';
import { Check } from 'lucide-react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function ProgressBar({ currentStep, totalSteps, stepLabels }: ProgressBarProps) {
  const pct = ((currentStep) / totalSteps) * 100;

  const defaultLabels = ['Clienta', 'Historial', 'Tipo de rizo', 'Diagnóstico', 'Cuero cab.', 'Salud', 'Resultado'];

  const labels = stepLabels || defaultLabels;

  return (
    <div className="bg-white border-b border-[#E5E5E5] px-4 pt-3 pb-4">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3 max-w-2xl mx-auto">
        {Array.from({ length: totalSteps + 1 }, (_, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 mx-1 transition-all duration-500 ${
                    i <= currentStep ? 'bg-[#5B2D8E]' : 'bg-[#E5E5E5]'
                  }`}
                />
              )}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                  text-xs font-bold transition-all duration-300
                  ${
                    isDone
                      ? 'bg-[#C9A84C] text-white'
                      : isCurrent
                      ? 'bg-[#5B2D8E] text-white ring-4 ring-[#F3EDF9]'
                      : 'bg-[#E5E5E5] text-[#AAAAAA]'
                  }
                `}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {isDone ? <Check size={13} strokeWidth={3} /> : i + 1}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-xs text-[#999999]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Paso {currentStep + 1} de {totalSteps + 1}
        </p>
        <p className="text-sm font-bold text-[#5B2D8E]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {labels[currentStep]}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-[#E5E5E5] rounded-full overflow-hidden max-w-2xl mx-auto">
        <div
          className="h-full bg-gradient-to-r from-[#5B2D8E] to-[#C9A84C] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
