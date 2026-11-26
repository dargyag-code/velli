'use client';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function SettingsIconButton() {
  return (
    <Link
      href="/configuracion"
      aria-label="Configuración"
      className="min-w-[44px] min-h-[44px] rounded-full bg-white hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(59,13,30,0.05)] no-underline shrink-0 transition-colors"
    >
      <Settings size={18} strokeWidth={1.8} />
    </Link>
  );
}
