'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Settings } from 'lucide-react';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva } from '@/lib/subscription/estado';

const MAIN_TABS = [
  { key: 'workspace', href: '/', label: 'Workspace (Silla)' },
  { key: 'agenda', href: '/agenda', label: 'Agenda' },
  { key: 'clientas', href: '/clientas', label: 'Clientas CRM' },
  { key: 'vitrina', href: '/vitrina', label: 'Vitrina & Pedidos' },
  { key: 'reportes', href: '/reportes', label: 'BI & Nómina' },
  { key: 'calibracion', href: '/configuracion/precios', label: 'Calibración $' },
] as const;

// ── Logo Oficial: La Gota Dual (Equilibrio sin Báscula) — Intacto ────────
function VelliLogo({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const isDark = variant === 'dark';
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
          isDark ? 'bg-[#FAF7F5]/10' : 'bg-[#3B0D1E]'
        }`}
      >
        <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M19.2 33.5C13.2 29.8 7.5 21.8 9.2 13.8C10.5 7.8 16.5 7.2 19.2 14.5C20.2 17.2 20.2 27.5 19.2 33.5Z"
            fill="#FAF7F5"
          />
          <path
            d="M20.8 33.5C26.8 29.8 32.5 21.8 30.8 13.8C29.5 7.8 23.5 7.2 20.8 14.5C19.8 17.2 19.8 27.5 20.8 33.5Z"
            fill="#E8CFC8"
            fillOpacity="0.85"
          />
          <circle cx="20" cy="6.5" r="2.5" fill="#D97757" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={`text-2xl font-bold tracking-tight font-brand ${
            isDark ? 'text-[#FAF7F5]' : 'text-[#1C1518]'
          }`}
        >
          velli
        </span>
        <span
          className={`text-[9px] uppercase tracking-[0.22em] font-semibold mt-0.5 ${
            isDark ? 'text-[#E8CFC8]' : 'text-[#6E6266]'
          }`}
        >
          Business Intelligence
        </span>
      </div>
    </div>
  );
}

export interface VelvetTopHeaderProps {
  nombreSalon?: string;
  ciudadSalon?: string;
  tienePlanIA?: boolean;
  cupoIA?: { usados: number; tope: number };
}

export default function VelvetTopHeader({
  nombreSalon: nombreProp,
  ciudadSalon: ciudadProp,
  tienePlanIA: planIAProp,
  cupoIA,
}: VelvetTopHeaderProps) {
  const pathname = usePathname();
  const [nombreLocal, setNombreLocal] = useState('Tu Salón');
  const [ciudadLocal, setCiudadLocal] = useState('Colombia');
  const [planIALocal, setPlanIALocal] = useState(true);

  useEffect(() => {
    const necesitaPerfil = nombreProp === undefined || ciudadProp === undefined;
    const necesitaSub = planIAProp === undefined;
    if (!necesitaPerfil && !necesitaSub) return;
    let cancelado = false;
    Promise.all([
      necesitaPerfil ? getProfile().catch(() => null) : Promise.resolve(null),
      necesitaSub ? getSuscripcionEfectiva().catch(() => null) : Promise.resolve(null),
    ]).then(([prof, sub]) => {
      if (cancelado) return;
      if (prof) {
        if (prof.nombreSalon?.trim()) setNombreLocal(prof.nombreSalon.trim());
        else if (prof.nombre?.trim()) setNombreLocal(prof.nombre.trim());
        if (prof.ciudad?.trim()) setCiudadLocal(prof.ciudad.trim());
      }
      if (sub) {
        setPlanIALocal(sub.plan === 'pro_ia' || sub.estado === 'trialing');
      }
    });
    return () => {
      cancelado = true;
    };
  }, [nombreProp, ciudadProp, planIAProp]);

  const nombreEfectivo = nombreProp ?? nombreLocal;
  const ciudadEfectiva = ciudadProp ?? ciudadLocal;
  const tienePlanIA = planIAProp ?? planIALocal;

  const isTabActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F5]/95 backdrop-blur-md border-b border-[#EFE8E4] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Izquierda: Logo actual intacto */}
        <Link href="/" className="no-underline shrink-0">
          <VelliLogo />
        </Link>

        {/* Centro: Navegación principal entre rutas */}
        <nav
          aria-label="Navegación principal"
          className="flex flex-wrap items-center gap-1 bg-[#F3ECE8] p-1 rounded-xl border border-[#EFE8E4]"
        >
          {MAIN_TABS.map((tab) => {
            const active = isTabActive(tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all no-underline ${
                  active
                    ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-sm'
                    : 'text-[#5C3A47] hover:text-[#3B0D1E]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Derecha: Píldora violeta del plan/cupo IA + píldora de sede/configuración */}
        <div className="flex items-center gap-2">
          <Link
            href="/planes"
            className="bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30 px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 no-underline hover:bg-[#7C3AED]/15 transition-colors tabular-nums"
          >
            <Sparkles size={13} />
            <span>
              {tienePlanIA
                ? `Salón Pro + IA${cupoIA ? ` · ${cupoIA.usados}/${cupoIA.tope}` : ''}`
                : 'Studio BI'}
            </span>
          </Link>

          <Link
            href="/configuracion"
            className="px-3 py-1.5 rounded-full bg-white border border-[#EFE8E4] hover:bg-[#F3ECE8] text-[#3B0D1E] text-xs font-semibold inline-flex items-center gap-1.5 no-underline transition-colors"
          >
            <Settings size={13} className="text-[#5C3A47] shrink-0" />
            <span className="truncate max-w-[160px] sm:max-w-[200px]">
              {nombreEfectivo} · {ciudadEfectiva}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
