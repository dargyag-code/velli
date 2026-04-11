'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, BarChart2, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',              icon: Home,         label: 'Inicio'    },
  { href: '/clientas',      icon: Users,        label: 'Clientas'  },
  { href: '/agenda',        icon: CalendarDays, label: 'Agenda'    },
  { href: '/reportes',      icon: BarChart2,    label: 'Reportes'  },
  { href: '/configuracion', icon: Settings,     label: 'Config'    },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E5E5]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          // Para "/" solo exacto; para el resto, coincide con la sección
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive ? 'text-[#2D5A27]' : 'text-[#AAAAAA] hover:text-[#7A9B76]'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className="text-[10px] leading-none"
                style={{
                  fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0 w-6 h-0.5 bg-[#2D5A27] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
