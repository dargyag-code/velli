import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CorreoSoporte from '@/components/legal/CorreoSoporte';
import { VeliLogoMark } from '@/components/v2/VelvetTopHeader';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans">
      <header className="sticky top-0 z-40 h-14 bg-white border-b border-[#E4E4E7] px-4 flex items-center">
        <div className="w-full flex items-center gap-3 max-w-2xl mx-auto">
          <Link
            href="/"
            aria-label="Volver"
            className="w-9 h-9 rounded-lg bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#111111] flex items-center justify-center transition-colors no-underline"
          >
            <ArrowLeft size={16} />
          </Link>
          <VeliLogoMark size={26} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
        <p className="text-center text-xs text-[#71717A] mt-8 pb-4">
          ¿Dudas o correcciones? <CorreoSoporte />
        </p>
      </main>
    </div>
  );
}
