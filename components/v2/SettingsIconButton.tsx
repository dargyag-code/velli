'use client';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function SettingsIconButton() {
  return (
    <Link
      href="/configuracion"
      aria-label="Configuración"
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-xs)',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <Settings size={18} strokeWidth={1.7} />
    </Link>
  );
}
