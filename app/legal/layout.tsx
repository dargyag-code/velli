import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <header
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E5E5E5] px-4 py-3"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link
            href="/configuracion"
            className="p-2 rounded-xl hover:bg-[#EEF5ED] text-[#2D5A27]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)' }}
            >
              <span className="text-white text-base leading-none" style={serif}>V</span>
            </div>
            <span className="text-base font-semibold text-[#2D5A27]" style={serif}>
              Velli Pro
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
        <p className="text-center text-[11px] text-[#999999] mt-8 pb-4">
          ¿Dudas o correcciones?{' '}
          <a href="mailto:soporte@velli.app" className="text-[#2D5A27] font-semibold hover:underline">
            soporte@velli.app
          </a>
        </p>
      </main>
    </div>
  );
}
