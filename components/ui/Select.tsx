'use client';
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export default function Select({ label, error, hint, options, placeholder, className = '', id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-semibold text-[#2D2D2D]"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {label}
          {props.required && <span className="text-[#8E2D2D] ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full px-4 py-2.5 rounded-xl border text-sm bg-white text-[#2D2D2D]
          appearance-none cursor-pointer
          transition-all duration-200
          ${error ? 'border-[#8E2D2D]' : 'border-[#E5E5E5]'}
          ${props.value === '' ? 'text-[#BBBBBB]' : ''}
          ${className}
        `}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
          paddingRight: '36px',
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#8E2D2D]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#999999]">{hint}</p>}
    </div>
  );
}
