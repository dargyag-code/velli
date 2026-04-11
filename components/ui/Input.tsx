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
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-[#2D2D2D]"
          style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
        >
          {label}
          {props.required && <span className="text-[#8E2D2D] ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-4 py-2.5 rounded-xl border text-sm
          bg-white text-[#2D2D2D] placeholder-[#BBBBBB]
          transition-all duration-200
          ${error ? 'border-[#8E2D2D] bg-red-50' : 'border-[#E5E5E5]'}
          ${className}
        `}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
        {...props}
      />
      {error && <p className="text-xs text-[#8E2D2D]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#999999]">{hint}</p>}
    </div>
  );
}
