'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface InnerHeaderProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Si se pasa una ruta, navega a ella. Si no, hace router.back() */
  backHref?: string;
  right?: React.ReactNode;
}

export default function InnerHeader({ title, eyebrow, backHref, right }: InnerHeaderProps) {
  const router = useRouter();

  const BackBtn = (
    <button
      type="button"
      aria-label="Volver"
      onClick={() => {
        if (!backHref) router.back();
      }}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-xs)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <ArrowLeft size={16} strokeWidth={1.8} />
    </button>
  );

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        padding: '54px 16px 14px',
        background: 'rgba(242, 235, 221, 0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {backHref ? <Link href={backHref}>{BackBtn}</Link> : BackBtn}
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && <div className="v-caps" style={{ marginBottom: 1 }}>{eyebrow}</div>}
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 18,
              color: 'var(--text-main)',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h1>
        </div>
        {right}
      </div>
    </header>
  );
}
