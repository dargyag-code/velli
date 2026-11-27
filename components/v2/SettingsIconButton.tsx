'use client';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function SettingsIconButton() {
  return (
    <Link
      href="/configuracion"
      aria-label="Configuración"
      className="min-w-[44px] min-h-[44px] rounded-full bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(59,13,30,0.05)] no-underline shrink-0 transition-colors"
    >
      <Settings size={18} strokeWidth={1.8} />
    </Link>
  );
}
