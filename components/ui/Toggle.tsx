'use client';
import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
}

export default function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || hint) && (
        <div>
          {label && (
            <p className="text-sm font-semibold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              {label}
            </p>
          )}
          {hint && <p className="text-xs text-[#999999] mt-0.5">{hint}</p>}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`
          relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300
          ${checked ? 'bg-[#2D5A27]' : 'bg-gray-200'}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
            transition-transform duration-300
            ${checked ? 'translate-x-6' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}
