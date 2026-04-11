'use client';
import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[#2D5A27] text-white hover:bg-[#3D7A35] active:bg-[#4A2275] shadow-sm hover:shadow-md',
  secondary:
    'bg-[#C9956B] text-white hover:bg-[#D4A882] active:bg-[#B8963A] shadow-sm',
  ghost:
    'bg-transparent text-[#2D5A27] hover:bg-[#EEF5ED] active:bg-[#E8D9F5]',
  danger:
    'bg-[#8E2D2D] text-white hover:bg-[#A03333] active:bg-[#7A2626]',
  outline:
    'bg-transparent border-2 border-[#2D5A27] text-[#2D5A27] hover:bg-[#EEF5ED]',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
