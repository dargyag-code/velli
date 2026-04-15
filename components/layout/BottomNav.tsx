'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, BarChart2, Settings, Plus } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',              icon: Home,         label: 'Inicio'   },
  { href: '/clientas',      icon: Users,        label: 'Clientas' },
  { href: '/diagnostico',   icon: null,         label: ''         }, // FAB slot
  { href: '/agenda',        icon: CalendarDays, label: 'Agenda'   },
  { href: '/configuracion', icon: Settings,     label: 'Config'   },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(255, 255, 255, 0.80)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="max-w-2xl mx-auto flex items-end h-16">
        {NAV_ITEMS.map(({ href, icon: Icon, label }, index) => {
          // FAB central
          if (index === 2) {
            return (
              <div key={href} className="flex-1 flex justify-center items-end pb-2">
                <Link
                  href={href}
                  className="flex items-center justify-center w-14 h-14 rounded-full text-white active:scale-90 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
                    boxShadow: '0 4px 16px rgba(45,90,39,0.40)',
                    marginTop: -20,
                  }}
                  aria-label="Nueva consulta"
                >
                  <Plus size={26} strokeWidth={2.5} />
                </Link>
              </div>
            );
          }

          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-end pb-2 pt-1 gap-0.5 relative transition-colors"
            >
              {/* Active dot */}
              {isActive && (
                <span
                  className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2D5A27]"
                />
              )}

              {Icon && (
                <Icon
                  size={22}
                  className={isActive ? 'text-[#2D5A27]' : 'text-[#BBBBBB]'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              )}

              {/* Label: solo visible si activo */}
              <span
                className="text-[10px] leading-none transition-all duration-200"
                style={{
                  fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#2D5A27' : 'transparent',
                  maxHeight: isActive ? 12 : 0,
                  overflow: 'hidden',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
