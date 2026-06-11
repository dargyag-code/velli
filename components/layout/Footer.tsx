import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="text-center py-4 mt-6">
      <p
        className="text-xs text-[#CCCCCC]"
        style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
      >
        Velli Pro • Inteligencia capilar a tu alcance
      </p>
      <p className="text-[11px] mt-1.5">
        <Link href="/legal/terminos" className="text-[#999999] hover:text-[#2D5A27] underline-offset-2 hover:underline">
          Términos de uso
        </Link>
        <span className="text-[#CCCCCC] mx-2">·</span>
        <Link href="/legal/privacidad" className="text-[#999999] hover:text-[#2D5A27] underline-offset-2 hover:underline">
          Política de privacidad
        </Link>
      </p>
    </footer>
  );
}
