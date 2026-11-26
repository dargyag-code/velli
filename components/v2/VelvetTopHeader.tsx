'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Settings } from 'lucide-react';
import {
  mostrarAccesoPlanesPorRol,
  obtenerTabsNavegacionPorRol,
  type OrgRole,
} from '@/lib/organizations';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva } from '@/lib/subscription/estado';
import { obtenerOrganizacionActivaPanel } from '@/lib/vitrina';

let rolOrganizacionCacheado: OrgRole | null | undefined;

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
  rolOrganizacion?: OrgRole | null;
}

export default function VelvetTopHeader({
  nombreSalon: nombreProp,
  ciudadSalon: ciudadProp,
  tienePlanIA: planIAProp,
  cupoIA,
  rolOrganizacion: rolProp,
}: VelvetTopHeaderProps) {
  const pathname = usePathname();
  const [nombreLocal, setNombreLocal] = useState('Tu Salón');
  const [ciudadLocal, setCiudadLocal] = useState('Colombia');
  const [planIALocal, setPlanIALocal] = useState(true);
  const [rolLocal, setRolLocal] = useState<OrgRole | null | undefined>(
    rolProp !== undefined ? rolProp : rolOrganizacionCacheado
  );

  useEffect(() => {
    if (rolProp !== undefined) {
      rolOrganizacionCacheado = rolProp;
      setRolLocal(rolProp);
    }
  }, [rolProp]);

  useEffect(() => {
    const necesitaPerfil = nombreProp === undefined || ciudadProp === undefined;
    const necesitaSub = planIAProp === undefined;
    const necesitaRol = rolProp === undefined && rolOrganizacionCacheado === undefined;
    if (!necesitaPerfil && !necesitaSub && !necesitaRol) return;
    let cancelado = false;
    Promise.all([
      necesitaPerfil ? getProfile().catch(() => null) : Promise.resolve(null),
      necesitaSub ? getSuscripcionEfectiva().catch(() => null) : Promise.resolve(null),
      necesitaRol ? obtenerOrganizacionActivaPanel().catch(() => null) : Promise.resolve(null),
    ]).then(([prof, sub, org]) => {
      if (cancelado) return;
      if (org) {
        rolOrganizacionCacheado = org.role;
        setRolLocal(org.role);
        if (org.name?.trim()) setNombreLocal(org.name.trim());
        if (org.city?.trim()) setCiudadLocal(org.city.trim());
      } else if (necesitaRol) {
        rolOrganizacionCacheado = null;
        setRolLocal(null);
      }
      if (prof) {
        if (!org?.name?.trim()) {
          if (prof.nombreSalon?.trim()) setNombreLocal(prof.nombreSalon.trim());
          else if (prof.nombre?.trim()) setNombreLocal(prof.nombre.trim());
        }
        if (!org?.city?.trim() && prof.ciudad?.trim()) setCiudadLocal(prof.ciudad.trim());
      }
      if (sub) {
        setPlanIALocal(sub.plan === 'pro_ia' || sub.estado === 'trialing');
      }
    });
    return () => {
      cancelado = true;
    };
  }, [nombreProp, ciudadProp, planIAProp, rolProp]);

  const nombreEfectivo = nombreProp ?? nombreLocal;
  const ciudadEfectiva = ciudadProp ?? ciudadLocal;
  const tienePlanIA = planIAProp ?? planIALocal;
  const rolEfectivo = rolProp !== undefined ? rolProp : rolLocal;
  const tabsVisibles = obtenerTabsNavegacionPorRol(rolEfectivo);
  const mostrarPlanes = mostrarAccesoPlanesPorRol(rolEfectivo);

  const isTabActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F5]/95 backdrop-blur-md border-b border-[#EFE8E4] px-3 sm:px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        {/* Izquierda: Logo actual intacto */}
        <Link href="/" className="no-underline shrink-0">
          <VelliLogo />
        </Link>

        {/* Derecha en móvil / tercera columna en escritorio */}
        <div className="flex items-center gap-2 order-2 lg:order-3">
          {mostrarPlanes && (
            <Link
              href="/planes"
              className="bg-[#F5EBE8] text-[#3B0D1E] border border-[#E8CFC8] px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 no-underline hover:bg-[#EFE8E4] transition-colors tabular-nums"
            >
              <Sparkles size={13} />
              <span>
                {tienePlanIA
                  ? `Pro + IA${cupoIA ? ` · ${cupoIA.usados}/${cupoIA.tope}` : ''}`
                  : 'Studio BI'}
              </span>
            </Link>
          )}

          <Link
            href="/configuracion"
            className="px-2.5 sm:px-3 py-1.5 rounded-full bg-white border border-[#EFE8E4] hover:bg-[#F3ECE8] text-[#3B0D1E] text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 no-underline transition-colors"
          >
            <Settings size={13} className="text-[#5C3A47] shrink-0" />
            <span className="truncate max-w-[115px] sm:max-w-[200px]">
              {nombreEfectivo} · {ciudadEfectiva}
            </span>
          </Link>
        </div>

        {/* Centro: Navegación principal adaptable a 390px y escritorio */}
        <nav
          aria-label="Navegación principal"
          className="order-3 lg:order-2 w-full lg:w-auto flex items-center gap-1 overflow-x-auto bg-[#F3ECE8] p-1 rounded-xl border border-[#EFE8E4]"
        >
          {tabsVisibles.map((tab) => {
            const active = isTabActive(tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all no-underline whitespace-nowrap ${
                  active
                    ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-sm'
                    : 'text-[#5C3A47] hover:text-[#3B0D1E]'
                }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
