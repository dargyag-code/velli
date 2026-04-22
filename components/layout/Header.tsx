'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProfile } from '@/lib/profile';

interface HeaderProps {
  showBack?: boolean;
  title?: string;
  rightAction?: React.ReactNode;
}

export default function Header({ showBack, title, rightAction }: HeaderProps) {
  const pathname = usePathname();
  const [stylistName, setStylistName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((p) => {
        if (active) setStylistName(p?.nombre ?? '');
      })
      .catch(() => {
        if (active) setStylistName('');
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Header de detalle / wizard ──────────────────────────────────────────
  if (showBack) {
    return (
      <header
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E5E5E5] px-4 py-3"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link
            href={pathname.startsWith('/clientas/') ? '/clientas' : '/'}
            className="p-2 rounded-xl hover:bg-[#EEF5ED] transition-colors text-[#2D5A27]"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1
            className="text-base text-[#2D2D2D] flex-1 truncate font-semibold"
            style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
          >
            {title}
          </h1>
          {rightAction}
        </div>
      </header>
    );
  }

  // ── Header principal con gradiente ─────────────────────────────────────
  const saludo = stylistName ? `Hola, ${stylistName}` : stylistName === '' ? 'Hola' : null;

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
        boxShadow: '0 2px 16px rgba(26,46,26,0.28)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex flex-col leading-none gap-0.5">
          <span
            className="text-2xl text-white tracking-tight"
            style={{
              fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            Velli
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              letterSpacing: '0.14em',
              color: '#C9956B',
            }}
          >
            Inteligencia Capilar
          </span>
        </Link>

        {saludo !== null && (
          <div
            className="text-sm text-[#B8D4B5] flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            <span>{saludo}</span>
            <span
              className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-base"
              role="img"
              aria-label="planta"
            >
              🌿
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
