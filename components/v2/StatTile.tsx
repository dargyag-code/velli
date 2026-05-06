import React from 'react';

export type StatAccent = 'green' | 'gold' | 'blue';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  delta?: string;
  spark?: string;
  accent?: StatAccent;
}

const accentMap: Record<StatAccent, { fg: string; bg: string }> = {
  green: { fg: '#2D5A27', bg: '#EEF5ED' },
  gold:  { fg: '#8A5A2E', bg: '#FBF4EC' },
  blue:  { fg: '#1A5276', bg: '#E8F4FD' },
};

export default function StatTile({ label, value, suffix, delta, spark, accent = 'green' }: StatTileProps) {
  const c = accentMap[accent];
  const isPositive = delta?.startsWith('+');
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="v-num">{label}</div>
        {delta && (
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: isPositive ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {delta}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 36,
            lineHeight: 1,
            color: 'var(--text-main)',
            letterSpacing: '-0.03em',
          }}
        >
          {value}
        </span>
        {suffix && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{suffix}</span>}
      </div>
      {spark && (
        <svg
          width="100%"
          height="20"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          style={{ marginTop: 8, color: c.fg }}
        >
          <polyline points={spark} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <polyline points={`${spark} 100,20 0,20`} fill={c.bg} opacity="0.6" stroke="none" />
        </svg>
      )}
    </div>
  );
}
