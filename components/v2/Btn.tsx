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
    background: 'linear-gradient(180deg, #3D7A35, #2D5A27)',
    color: '#fff',
    boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(45, 90, 39, 0.32)',
    border: 'none',
  },
  gold: {
    background: 'linear-gradient(180deg, #D8A878, #B47E4D)',
    color: '#fff',
    boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(180, 126, 77, 0.32)',
    border: 'none',
  },
  dark: {
    background: 'linear-gradient(180deg, #25401E, #14241A)',
    color: '#F5EDDC',
    boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 14px rgba(20, 36, 26, 0.4)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--primary)',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-main)',
    border: '1px solid var(--border-strong)',
  },
  soft: {
    background: 'var(--primary-pale)',
    color: 'var(--primary)',
    border: 'none',
  },
};

const sizeStyles: Record<BtnSize, React.CSSProperties> = {
  sm: { padding: '7px 14px', fontSize: 12, borderRadius: 999 },
  md: { padding: '10px 18px', fontSize: 13, borderRadius: 999 },
  lg: { padding: '14px 22px', fontSize: 14, borderRadius: 999 },
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
      className={`active:scale-95 transition-transform ${className}`}
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
