'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import {
  mostrarAccesoPlanesPorRol,
  obtenerTabsNavegacionPorRol,
  type MainNavTabItem,
  type OrgRole,
} from '@/lib/organizations';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';
import { obtenerOrganizacionActivaPanel } from '@/lib/vitrina';
import SubscriptionBanner from '@/components/subscription/SubscriptionBanner';

let rolOrganizacionCacheado: OrgRole | null | undefined;
let slugOrganizacionCacheado: string | null | undefined;

export function VeliLogoMark({
  collapsed = false,
  size = 28,
}: {
  collapsed?: boolean;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className="rounded-lg bg-[#111111] text-white flex items-center justify-center shrink-0"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <svg
          width={Math.round(size * 0.58)}
          height={Math.round(size * 0.58)}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M3.2 3.8H6.7L10 12.6L13.3 3.8H16.8L11.6 16.4H8.4L3.2 3.8Z"
            fill="#FFFFFF"
          />
        </svg>
      </span>
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight text-[#111111] leading-none">
          Veli
        </span>
      )}
    </span>
  );
}

const TAB_ICONS: Record<
  MainNavTabItem['key'],
  React.ComponentType<{ size?: number; className?: string }>
> = {
  workspace: Scissors,
  agenda: Calendar,
  clientas: Users,
  vitrina: Store,
  reportes: BarChart3,
  calibracion: SlidersHorizontal,
};

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
  const [collapsed, setCollapsed] = useState(false);
  const [nombreLocal, setNombreLocal] = useState('Tu Estudio');
  const [ciudadLocal, setCiudadLocal] = useState('Colombia');
  const [planIALocal, setPlanIALocal] = useState(true);
  const [subLocal, setSubLocal] = useState<SuscripcionEfectiva | null>(null);
  const [slugLocal, setSlugLocal] = useState<string | null>(
    slugOrganizacionCacheado ?? null
  );
  const [rolLocal, setRolLocal] = useState<OrgRole | null | undefined>(
    rolProp !== undefined ? rolProp : rolOrganizacionCacheado
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('veli.sidebar.collapsed');
      if (saved === '1') setCollapsed(true);
    } catch {
      // Ignorar restricciones de almacenamiento privado
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('veli-has-sidebar');
    document.documentElement.style.setProperty(
      '--veli-sidebar-w',
      collapsed ? '72px' : '240px'
    );
    return () => {
      document.body.classList.remove('veli-has-sidebar');
    };
  }, [collapsed]);

  useEffect(() => {
    if (rolProp !== undefined) {
      rolOrganizacionCacheado = rolProp;
      setRolLocal(rolProp);
    }
  }, [rolProp]);

  useEffect(() => {
    const necesitaPerfil = nombreProp === undefined || ciudadProp === undefined;
    const necesitaSub = true;
    const necesitaOrg =
      (rolProp === undefined && rolOrganizacionCacheado === undefined) ||
      slugOrganizacionCacheado === undefined;
    if (!necesitaPerfil && !necesitaSub && !necesitaOrg) return;

    let cancelado = false;
    Promise.all([
      necesitaPerfil ? getProfile().catch(() => null) : Promise.resolve(null),
      necesitaSub ? getSuscripcionEfectiva().catch(() => null) : Promise.resolve(null),
      necesitaOrg ? obtenerOrganizacionActivaPanel().catch(() => null) : Promise.resolve(null),
    ]).then(([prof, sub, org]) => {
      if (cancelado) return;
      if (org) {
        rolOrganizacionCacheado = org.role;
        slugOrganizacionCacheado = org.slug || null;
        setRolLocal(org.role);
        setSlugLocal(org.slug || null);
        if (org.name?.trim()) setNombreLocal(org.name.trim());
        if (org.city?.trim()) setCiudadLocal(org.city.trim());
      } else if (necesitaOrg) {
        rolOrganizacionCacheado = null;
        slugOrganizacionCacheado = null;
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
        setSubLocal(sub);
        setPlanIALocal(sub.plan === 'pro_ia' || sub.estado === 'trialing');
      }
    });
    return () => {
      cancelado = true;
    };
  }, [nombreProp, ciudadProp, planIAProp, rolProp]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('veli.sidebar.collapsed', next ? '1' : '0');
      } catch {
        // Ignorar
      }
      return next;
    });
  };

  const nombreEfectivo = nombreProp ?? nombreLocal;
  const ciudadEfectiva = ciudadProp ?? ciudadLocal;
  const tienePlanIA = planIAProp ?? planIALocal;
  const rolEfectivo = rolProp !== undefined ? rolProp : rolLocal;
  const tabsVisibles = obtenerTabsNavegacionPorRol(rolEfectivo);
  const mostrarPlanes = mostrarAccesoPlanesPorRol(rolEfectivo);

  const isTabActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const hrefVitrinaRapida = slugLocal ? `/s/${slugLocal}` : '/vitrina';
  const mostrarAccesoVitrinaTop =
    Boolean(slugLocal) || rolEfectivo !== 'specialist';
  const mostrarBannerSuscripcion =
    !pathname.startsWith('/planes') &&
    mostrarPlanes &&
    (rolEfectivo === 'owner' || rolEfectivo === 'manager' || rolEfectivo === null);

  return (
    <>
      {/* ── SIDEBAR IZQUIERDO BLANCO COLAPSABLE (240px / 72px · Desktop) ── */}
      <aside
        aria-label="Menú lateral"
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col justify-between bg-white border-r border-[#E4E4E7] transition-[width] duration-150 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
      >
        <div className="p-3.5 space-y-4">
          <div
            className={`h-10 flex items-center ${
              collapsed ? 'justify-center' : 'justify-between px-1.5'
            }`}
          >
            <Link href="/" className="no-underline">
              <VeliLogoMark collapsed={collapsed} size={28} />
            </Link>
            {!collapsed && mostrarPlanes && (
              <span className="px-2 py-0.5 rounded-md bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-semibold text-[#52525B]">
                {tienePlanIA ? 'Pro+IA' : 'Pro'}
              </span>
            )}
          </div>

          {!collapsed && (
            <div className="px-3 py-2.5 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7]">
              <div className="text-xs font-semibold text-[#111111] truncate">
                {nombreEfectivo}
              </div>
              <div className="text-[11px] text-[#71717A] truncate mt-0.5">
                {ciudadEfectiva}
              </div>
            </div>
          )}

          <nav aria-label="Navegación principal" className="space-y-1">
            {tabsVisibles.map((tab) => {
              const Icon = TAB_ICONS[tab.key];
              const active = isTabActive(tab.href);
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  title={collapsed ? tab.label : undefined}
                  className={`relative h-10 rounded-lg flex items-center ${
                    collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } text-xs no-underline transition-colors ${
                    active
                      ? 'bg-[#F4F4F5] text-[#111111] font-semibold'
                      : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#111111] font-medium'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[#111111]" />
                  )}
                  <Icon
                    size={17}
                    className={
                      active ? 'text-[#111111] shrink-0' : 'text-[#71717A] shrink-0'
                    }
                  />
                  {!collapsed && <span className="truncate">{tab.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-[#E4E4E7] space-y-1">
          {mostrarPlanes && (
            <Link
              href="/planes"
              title={collapsed ? 'Planes y suscripción' : undefined}
              className={`h-9 rounded-lg flex items-center ${
                collapsed ? 'justify-center px-0' : 'justify-between px-3'
              } text-xs no-underline transition-colors ${
                pathname.startsWith('/planes')
                  ? 'bg-[#F4F4F5] text-[#111111] font-semibold'
                  : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#111111] font-medium'
              }`}
            >
              <span className="inline-flex items-center gap-2.5 truncate">
                <Sparkles size={16} className="text-[#71717A] shrink-0" />
                {!collapsed && (
                  <span>
                    {tienePlanIA
                      ? `Plan Pro + IA${cupoIA ? ` (${cupoIA.usados}/${cupoIA.tope})` : ''}`
                      : 'Planes'}
                  </span>
                )}
              </span>
            </Link>
          )}

          <Link
            href="/configuracion"
            title={collapsed ? 'Configuración' : undefined}
            className={`h-9 rounded-lg flex items-center ${
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-3'
            } text-xs no-underline transition-colors ${
              pathname === '/configuracion'
                ? 'bg-[#F4F4F5] text-[#111111] font-semibold'
                : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#111111] font-medium'
            }`}
          >
            <Settings size={16} className="text-[#71717A] shrink-0" />
            {!collapsed && <span>Configuración</span>}
          </Link>

          <button
            type="button"
            onClick={toggleCollapsed}
            className={`w-full h-9 rounded-lg flex items-center ${
              collapsed ? 'justify-center px-0' : 'justify-between px-3'
            } text-xs font-medium text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#111111] bg-transparent border-0 cursor-pointer transition-colors`}
            title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {!collapsed && <span>Recoger menú</span>}
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </aside>

      {/* ── TOP BAR BLANCA (56px) ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E4E4E7] px-4 lg:px-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="lg:hidden no-underline shrink-0">
            <VeliLogoMark size={26} />
          </Link>
          <span className="lg:hidden h-4 w-px bg-[#E4E4E7] shrink-0" />
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-[#111111] truncate block sm:inline">
              {nombreEfectivo}
            </span>
            <span className="hidden sm:inline text-[#E4E4E7] mx-2">·</span>
            <span className="hidden sm:inline text-xs text-[#71717A] truncate">
              {ciudadEfectiva}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mostrarAccesoVitrinaTop && (
            <Link
              href={hrefVitrinaRapida}
              target={slugLocal ? '_blank' : undefined}
              rel={slugLocal ? 'noopener noreferrer' : undefined}
              className="h-9 px-3 rounded-lg bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] text-xs font-medium inline-flex items-center gap-1.5 no-underline transition-colors"
            >
              <span>Mi vitrina</span>
              <ExternalLink size={13} className="text-[#52525B]" />
            </Link>
          )}

          <Link
            href={pathname === '/' ? '/agenda' : '/'}
            className="h-9 px-3.5 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white text-xs font-semibold inline-flex items-center gap-1.5 no-underline transition-colors"
          >
            {pathname === '/' ? (
              <>
                <Calendar size={14} />
                <span>Agenda</span>
              </>
            ) : (
              <>
                <Scissors size={14} />
                <span>Abrir silla</span>
              </>
            )}
          </Link>
        </div>
      </header>

      {mostrarBannerSuscripcion && <SubscriptionBanner suscripcion={subLocal} />}

      {/* ── BARRA INFERIOR LIMPIA MÓVIL (390px) ──────────────────────────── */}
      <nav
        aria-label="Navegación móvil"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t border-[#E4E4E7] px-1.5 flex items-center justify-around"
      >
        {tabsVisibles.slice(0, 5).map((tab) => {
          const Icon = TAB_ICONS[tab.key];
          const active = isTabActive(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex-1 py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 no-underline transition-colors ${
                active
                  ? 'text-[#111111] font-semibold'
                  : 'text-[#71717A] font-medium'
              }`}
            >
              <Icon size={17} />
              <span className="text-[10px] leading-none truncate max-w-[64px]">
                {tab.shortLabel}
              </span>
            </Link>
          );
        })}
        <Link
          href="/configuracion"
          className={`flex-1 py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 no-underline transition-colors ${
            pathname === '/configuracion'
              ? 'text-[#111111] font-semibold'
              : 'text-[#71717A] font-medium'
          }`}
        >
          <Settings size={17} />
          <span className="text-[10px] leading-none">Ajustes</span>
        </Link>
      </nav>
    </>
  );
}
