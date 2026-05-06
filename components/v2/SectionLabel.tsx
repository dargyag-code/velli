import React from 'react';

interface SectionLabelProps {
  num?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function SectionLabel({ num, eyebrow, title, action, style }: SectionLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        margin: '8px 0 14px',
        ...style,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {num && <span className="v-num" style={{ fontSize: 10 }}>· {num}</span>}
          {eyebrow && <span className="v-caps">{eyebrow}</span>}
        </div>
        <h2
          style={{
            margin: '4px 0 0',
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--text-main)',
          }}
        >
          {title}
        </h2>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
