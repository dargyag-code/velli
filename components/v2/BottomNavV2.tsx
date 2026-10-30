'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sparkles, CheckCircle2, Users, BarChart2, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'cotizar',  href: '/',              Icon: Sparkles,     label: 'Cotizar'    },
  { key: 'cierre',   href: '/?tab=cierre',   Icon: CheckCircle2, label: 'Por Cobrar' },
  { key: 'clientas', href: '/clientas',      Icon: Users,        label: 'Clientas'   },
  { key: 'reportes', href: '/reportes',      Icon: BarChart2,    label: 'Métricas'   },
  { key: 'config',   href: '/configuracion', Icon: Settings,     label: 'Salón'      },
] as const;

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EFE8E4] pb-safe shadow-[0_-8px_30px_rgba(59,13,30,0.06)]">
      <div className="max-w-3xl mx-auto px-2 h-16 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isCierreTab = item.key === 'cierre' && pathname === '/' && currentTab === 'cierre';
          const isCotizarTab = item.key === 'cotizar' && pathname === '/' && currentTab !== 'cierre';
          const isOtherActive =
            item.key !== 'cotizar' &&
            item.key !== 'cierre' &&
            pathname.startsWith(item.href);

          const isActive = isCierreTab || isCotizarTab || isOtherActive;
          const Icon = item.Icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 no-underline transition-all ${
                isActive ? 'text-[#3B0D1E]' : 'text-[#96888C] hover:text-[#6E6266]'
              }`}
            >
              <div
                className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
                  isActive ? 'bg-[#E8CFC8]/45 text-[#3B0D1E]' : 'bg-transparent'
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.3 : 1.7} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function BottomNavV2() {
  return (
    <Suspense
      fallback={
        <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-[#EFE8E4] pb-safe" />
      }
    >
      <BottomNavInner />
    </Suspense>
  );
}
