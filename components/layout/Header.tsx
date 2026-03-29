'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Plus, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  showBack?: boolean;
  title?: string;
  rightAction?: React.ReactNode;
}

export default function Header({ showBack, title, rightAction }: HeaderProps) {
  const pathname = usePathname();

  if (showBack) {
    return (
      <header
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E5E5E5] px-4 py-3"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link
            href={pathname.startsWith('/clientas/') ? '/clientas' : '/'}
            className="p-2 rounded-xl hover:bg-[#F3EDF9] transition-colors text-[#5B2D8E]"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1
            className="text-base font-bold text-[#2D2D2D] flex-1 truncate"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {title}
          </h1>
          {rightAction}
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E5E5E5]"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex flex-col leading-none">
            <span
              className="text-xl font-extrabold text-[#5B2D8E] tracking-wide"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              KEYSHOP
            </span>
            <span
              className="text-[10px] font-bold text-[#C9A84C] tracking-widest uppercase"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Always Curly
            </span>
            <span
              className="text-[9px] text-[#999999] italic"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              by Keila Moreno
            </span>
          </Link>

          {/* Saludo */}
          <div className="flex items-center gap-1 text-sm text-[#666666]">
            <span>Hola, Keila</span>
            <span>✨</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="max-w-2xl mx-auto px-4 pb-2">
        <nav className="flex gap-1">
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname === '/'
                ? 'bg-[#5B2D8E] text-white'
                : 'text-[#666666] hover:bg-[#F3EDF9] hover:text-[#5B2D8E]'
            }`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <Home size={13} />
            Inicio
          </Link>
          <Link
            href="/clientas"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname.startsWith('/clientas')
                ? 'bg-[#5B2D8E] text-white'
                : 'text-[#666666] hover:bg-[#F3EDF9] hover:text-[#5B2D8E]'
            }`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <Users size={13} />
            Clientas
          </Link>
          <Link
            href="/diagnostico"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname === '/diagnostico'
                ? 'bg-[#C9A84C] text-white'
                : 'text-[#666666] hover:bg-[#FDF8EE] hover:text-[#C9A84C]'
            }`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <Plus size={13} />
            Nueva consulta
          </Link>
        </nav>
      </div>
    </header>
  );
}
