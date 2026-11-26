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
          className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]"
        >
          {label}
          {props.required && <span className="text-[#D97757] ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border text-sm font-sans bg-[#FAF7F5] focus:bg-white text-[#3B0D1E] placeholder-[#947C85] transition-all duration-200 ${
          error ? 'border-[#D97757] bg-[#FFF7F5]' : 'border-[#EFE8E4]'
        } ${className}`}
        {...props}
      />
      {error && <p className="m-0 text-xs font-medium text-[#D97757]">{error}</p>}
      {hint && !error && <p className="m-0 text-xs text-[#947C85]">{hint}</p>}
    </div>
  );
}
