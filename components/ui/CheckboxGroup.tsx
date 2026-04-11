'use client';
import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxGroupProps {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  columns?: 1 | 2;
}

export default function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
  columns = 1,
}: CheckboxGroupProps) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-sm font-semibold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
          {label}
        </p>
      )}
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-sm
                transition-all duration-200
                ${
                  isSelected
                    ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                    : 'border-[#E5E5E5] bg-white text-[#2D2D2D] hover:border-[#90B98A] hover:bg-[#F0F5EF]'
                }
              `}
            >
              <span
                className={`
                  flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center
                  transition-all duration-200
                  ${isSelected ? 'bg-[#2D5A27] border-[#2D5A27]' : 'border-[#CCCCCC]'}
                `}
              >
                {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
