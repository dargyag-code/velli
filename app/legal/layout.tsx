import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CorreoSoporte from '@/components/legal/CorreoSoporte';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#1C1518]">
      <header className="sticky top-0 z-40 bg-[#FAF7F5]/95 backdrop-blur-md border-b border-[#EFE8E4] px-4 py-3.5">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link
            href="/"
            aria-label="Volver"
            className="w-9 h-9 rounded-full bg-white border border-[#EFE8E4] hover:border-[#3B0D1E] text-[#1C1518] flex items-center justify-center transition-colors no-underline"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="inline-flex items-center gap-2.5 select-none">
            <div className="w-8 h-8 rounded-xl bg-[#3B0D1E] flex items-center justify-center shadow-xs">
              <svg width="19" height="19" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              <span className="text-lg font-bold tracking-tight text-[#1C1518] font-brand">
                velli
              </span>
              <span className="text-[8px] uppercase tracking-[0.2em] font-semibold mt-0.5 text-[#6E6266]">
                Business Intelligence
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
        <p className="text-center text-[11px] text-[#6E6266] mt-8 pb-4">
          ¿Dudas o correcciones? <CorreoSoporte />
        </p>
      </main>
    </div>
  );
}
