'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface InnerHeaderProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Si se pasa una ruta, navega a ella. Si no, hace router.back() */
  backHref?: string;
  right?: React.ReactNode;
}

export default function InnerHeader({ title, eyebrow, backHref, right }: InnerHeaderProps) {
  const router = useRouter();

  const BackBtn = (
    <button
      type="button"
      aria-label="Volver"
      onClick={() => {
        if (!backHref) router.back();
      }}
      className="min-w-[44px] min-h-[44px] rounded-full bg-white border border-[#EFE8E4] text-[#3B0D1E] hover:bg-[#F5EBE8] transition-colors flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(59,13,30,0.05)] cursor-pointer shrink-0"
    >
      <ArrowLeft size={18} strokeWidth={2} />
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F5]/95 backdrop-blur-md border-b border-[#EFE8E4] px-4 py-3.5">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        {backHref ? <Link href={backHref} className="no-underline">{BackBtn}</Link> : BackBtn}
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <div className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-0.5">
              {eyebrow}
            </div>
          )}
          <h1 className="m-0 font-display text-xl md:text-2xl font-semibold tracking-tight text-[#3B0D1E] truncate">
            {title}
          </h1>
        </div>
        {right}
      </div>
    </header>
  );
}
