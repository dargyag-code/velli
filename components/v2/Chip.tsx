import React from 'react';

export type ChipTone = 'green' | 'gold' | 'blue' | 'purple' | 'amber' | 'ghost';

interface ChipProps {
  children: React.ReactNode;
  tone?: ChipTone;
  dot?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const toneMap: Record<ChipTone, { bg: string; fg: string; bd: string }> = {
  green:  { bg: 'var(--primary-pale)',     fg: 'var(--primary)',           bd: 'rgba(45, 90, 39, 0.16)' },
  gold:   { bg: 'var(--secondary-pale)',   fg: 'var(--secondary-deep)',    bd: 'rgba(138, 90, 46, 0.18)' },
  blue:   { bg: 'var(--treat-hidrat-bg)',  fg: 'var(--treat-hidrat-color)', bd: 'rgba(26, 82, 118, 0.15)' },
  purple: { bg: 'var(--treat-repol-bg)',   fg: 'var(--treat-repol-color)',  bd: 'rgba(107, 63, 160, 0.15)' },
  amber:  { bg: 'var(--treat-recon-bg)',   fg: 'var(--treat-recon-color)',  bd: 'rgba(212, 130, 10, 0.18)' },
  ghost:  { bg: 'transparent',             fg: 'var(--text-secondary)',     bd: 'var(--border)' },
};

export default function Chip({ children, tone = 'green', dot, style, className = '' }: ChipProps) {
  const t = toneMap[tone];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.fg, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
