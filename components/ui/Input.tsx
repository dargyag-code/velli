'use client';
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5 font-sans">
      {label && (
        <label
          htmlFor={inputId}
          className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B]"
        >
          {label}
          {props.required && <span className="text-[#B45309] ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border text-sm font-sans bg-[#FAFAFA] focus:bg-white text-[#111111] placeholder-[#71717A] transition-all duration-200 ${
          error ? 'border-[#B45309] bg-[#FFFBEB]' : 'border-[#E4E4E7]'
        } ${className}`}
        {...props}
      />
      {error && <p className="m-0 text-xs font-medium text-[#B45309]">{error}</p>}
      {hint && !error && <p className="m-0 text-xs text-[#71717A]">{hint}</p>}
    </div>
  );
}
