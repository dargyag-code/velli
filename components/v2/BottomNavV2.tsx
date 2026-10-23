'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, BarChart2, Sparkles, Calculator, X } from 'lucide-react';
import { useFlags } from '@/lib/flags/useFlags';
import HojaCotizar from '@/components/cotizador/HojaCotizar';

const NAV_ITEMS = [
  { key: 'home',     href: '/',            Icon: Home,         label: 'Inicio'   },
  { key: 'clientas', href: '/clientas',    Icon: Users,        label: 'Clientas' },
  { key: 'fab',      href: '/diagnostico', Icon: null,         label: ''         },
  { key: 'agenda',   href: '/agenda',      Icon: CalendarDays, label: 'Agenda'   },
  { key: 'reports',  href: '/reportes',    Icon: BarChart2,    label: 'Métricas' },
] as const;

export default function BottomNavV2() {
  const pathname = usePathname();
  const flags = useFlags();
  const [hojaRapidaAbierta, setHojaRapidaAbierta] = useState(false);
  const [cotizadorAbierto, setCotizadorAbierto] = useState(false);

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: 88,
          pointerEvents: 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ position: 'relative', maxWidth: 768, margin: '0 auto', height: 88 }}>
          {/* Curved nav background SVG */}
          <svg
            viewBox="0 0 390 88"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          >
            <defs>
              <filter id="navshadowV2" x="-10%" y="-50%" width="120%" height="200%">
                <feDropShadow dx="0" dy="-3" stdDeviation="8" floodColor="#14241A" floodOpacity="0.10" />
              </filter>
            </defs>
            <path
              filter="url(#navshadowV2)"
              d="M0 18 L160 18 Q175 18 178 30 Q187 56 212 56 Q237 56 246 30 Q249 18 264 18 L390 18 L390 88 L0 88 Z"
              fill="#FFFEFB"
              stroke="rgba(229, 223, 210, 0.7)"
              strokeWidth="0.5"
            />
          </svg>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              height: 88,
              alignItems: 'flex-start',
              paddingTop: 24,
              pointerEvents: 'auto',
            }}
          >
            {NAV_ITEMS.map((item) => {
              if (item.key === 'fab') {
                const fabStyle: React.CSSProperties = {
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2D5A27 0%, #1F3D24 100%)',
                  color: '#fff',
                  border: '4px solid #FFFEFB',
                  marginTop: -28,
                  boxShadow: '0 12px 28px rgba(45,90,39,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                };

                return (
                  <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {flags.cotizador ? (
                      <button
                        type="button"
                        aria-label="Acciones rápidas: Cotizar o Nuevo diagnóstico"
                        onClick={() => setHojaRapidaAbierta((v) => !v)}
                        className="active:scale-90 transition-transform"
                        style={fabStyle}
                      >
                        <Sparkles size={22} strokeWidth={1.8} />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        aria-label="Nuevo diagnóstico"
                        className="active:scale-90 transition-transform"
                        style={fabStyle}
                      >
                        <Sparkles size={22} strokeWidth={1.8} />
                      </Link>
                    )}
                  </div>
                );
              }
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const Icon = item.Icon!;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: isActive ? 'var(--primary)' : 'var(--text-tertiary)',
                    textDecoration: 'none',
                  }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Hoja rápida del botón central (Decisión E5, §2.4): Cotizar | Nuevo diagnóstico */}
      {flags.cotizador && hojaRapidaAbierta && (
        <div
          onClick={() => setHojaRapidaAbierta(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(20, 36, 26, 0.52)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px 16px 104px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg-card)',
              borderRadius: 22,
              padding: 16,
              border: '1px solid var(--border-soft)',
              boxShadow: '0 16px 40px rgba(20, 36, 26, 0.28)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
                Acción rápida
              </span>
              <button
                type="button"
                onClick={() => setHojaRapidaAbierta(false)}
                aria-label="Cerrar"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setHojaRapidaAbierta(false);
                setCotizadorAbierto(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 16,
                border: '1px solid rgba(138, 90, 46, 0.25)',
                background: 'linear-gradient(135deg, #FBF4EC 0%, #F5EDDC 100%)',
                color: 'var(--primary-deep)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--secondary-deep)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Calculator size={18} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700 }}>
                  Cotizar
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--secondary-deep)' }}>
                  Precio exacto en 3 toques y envío por WhatsApp
                </div>
              </div>
            </button>

            <Link
              href="/diagnostico"
              onClick={() => setHojaRapidaAbierta(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 16,
                border: 'none',
                background: 'linear-gradient(135deg, #25401E 0%, #14241A 100%)',
                color: '#F5EDDC',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.14)',
                  color: '#E8C290',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: '#fff' }}>
                  Nuevo diagnóstico
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(245, 237, 220, 0.8)' }}>
                  Evaluación capilar paso a paso · 3 min
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {flags.cotizador && (
        <HojaCotizar
          open={cotizadorAbierto}
          onClose={() => setCotizadorAbierto(false)}
        />
      )}
    </>
  );
}
