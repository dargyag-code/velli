'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, BarChart2, Sparkles } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home',     href: '/',            Icon: Home,         label: 'Inicio'   },
  { key: 'clientas', href: '/clientas',    Icon: Users,        label: 'Clientas' },
  { key: 'fab',      href: '/diagnostico', Icon: null,         label: ''         },
  { key: 'agenda',   href: '/agenda',      Icon: CalendarDays, label: 'Agenda'   },
  { key: 'reports',  href: '/reportes',    Icon: BarChart2,    label: 'Métricas' },
] as const;

export default function BottomNavV2() {
  const pathname = usePathname();

  return (
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
          {NAV_ITEMS.map((item, i) => {
            if (item.key === 'fab') {
              return (
                <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <Link
                    href={item.href}
                    aria-label="Nuevo diagnóstico"
                    className="active:scale-90 transition-transform"
                    style={{
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
                    }}
                  >
                    <Sparkles size={22} strokeWidth={1.8} />
                  </Link>
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
  );
}
