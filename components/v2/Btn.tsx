'use client';
import React from 'react';

export type BtnVariant = 'primary' | 'gold' | 'dark' | 'ghost' | 'outline' | 'soft';
export type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: BtnVariant;
  size?: BtnSize;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles: Record<BtnVariant, React.CSSProperties> = {
  primary: {
    background: '#3B0D1E',
    color: '#FAF7F5',
    boxShadow: '0 10px 24px -6px rgba(59, 13, 30, 0.25)',
    border: '1px solid #3B0D1E',
  },
  gold: {
    background: '#F5EBE8',
    color: '#3B0D1E',
    boxShadow: '0 4px 14px -4px rgba(59, 13, 30, 0.08)',
    border: '1px solid #E8CFC8',
  },
  dark: {
    background: 'linear-gradient(180deg, #52142B, #3B0D1E)',
    color: '#FAF7F5',
    boxShadow: '0 10px 24px -6px rgba(59, 13, 30, 0.28)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: '#3B0D1E',
    border: 'none',
  },
  outline: {
    background: '#FFFFFF',
    color: '#3B0D1E',
    border: '1px solid #EFE8E4',
  },
  soft: {
    background: '#F5EBE8',
    color: '#3B0D1E',
    border: '1px solid #E8CFC8',
  },
};

const sizeStyles: Record<BtnSize, React.CSSProperties> = {
  sm: { minHeight: 40, padding: '8px 16px', fontSize: 12, borderRadius: 12 },
  md: { minHeight: 44, padding: '10px 18px', fontSize: 13, borderRadius: 14 },
  lg: { minHeight: 48, padding: '12px 22px', fontSize: 14, borderRadius: 16 },
};

export default function Btn({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  iconRight,
  children,
  style,
  disabled,
  className = '',
  ...rest
}: BtnProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  return (
    <button
      disabled={disabled}
      className={`active:scale-[0.98] transition-all hover:opacity-95 ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...v,
        ...s,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
