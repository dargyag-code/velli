'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, Sparkles } from 'lucide-react';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';

// ── Banner global de suscripción (Base Neutra Veli) ─────────────────────────
// Solo aparece para administración (owner/manager) cuando hay algo accionable:
// trial por terminar (≤ 5 días), periodo de gracia (past_due) o plan vencido.
// Activa / trial holgado = cero ruido.

interface BannerContent {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  cta: string;
  containerClass: string;
  accentClass: string;
  ctaClass: string;
}

function contenido(sub: SuscripcionEfectiva): BannerContent | null {
  if (sub.estado === 'expired') {
    return {
      icono: <AlertCircle size={16} strokeWidth={2} />,
      titulo: 'Tu plan venció',
      detalle: 'Tus datos siguen intactos, pero ya no puedes crear registros nuevos.',
      cta: 'Renovar plan',
      containerClass: 'bg-[#FEF2F2] border-[#DC2626]/30',
      accentClass: 'text-[#DC2626]',
      ctaClass: 'bg-[#111111] hover:bg-[#27272A] text-white',
    };
  }
  if (sub.estado === 'past_due') {
    return {
      icono: <AlertCircle size={16} strokeWidth={2} />,
      titulo: 'Tu plan venció · estás en días de gracia',
      detalle: 'Renueva ahora para seguir registrando clientes, citas y servicios sin interrupción.',
      cta: 'Renovar',
      containerClass: 'bg-[#FFFBEB] border-[#B45309]/30',
      accentClass: 'text-[#B45309]',
      ctaClass: 'bg-[#111111] hover:bg-[#27272A] text-white',
    };
  }
  if (
    (sub.estado === 'trialing' || sub.estado === 'canceled') &&
    sub.diasRestantes !== null &&
    sub.diasRestantes <= 5
  ) {
    const dias =
      sub.diasRestantes === 0
        ? 'hoy'
        : sub.diasRestantes === 1
          ? 'mañana'
          : `en ${sub.diasRestantes} días`;
    return {
      icono: <Sparkles size={16} strokeWidth={2} />,
      titulo:
        sub.estado === 'trialing'
          ? `Tu prueba gratuita termina ${dias}`
          : `Tu plan termina ${dias}`,
      detalle: 'Elige un plan para operar sin interrupciones.',
      cta: 'Ver planes',
      containerClass: 'bg-white border-[#E4E4E7]',
      accentClass: 'text-[#111111]',
      ctaClass: 'bg-[#111111] hover:bg-[#27272A] text-white',
    };
  }
  return null;
}

export interface SubscriptionBannerProps {
  suscripcion?: SuscripcionEfectiva | null;
}

export default function SubscriptionBanner({ suscripcion }: SubscriptionBannerProps = {}) {
  const [subInterna, setSubInterna] = useState<SuscripcionEfectiva | null>(
    suscripcion ?? null
  );

  useEffect(() => {
    if (suscripcion !== undefined) {
      setSubInterna(suscripcion);
      return;
    }
    let cancelado = false;
    getSuscripcionEfectiva()
      .then((res) => {
        if (!cancelado) setSubInterna(res);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [suscripcion]);

  if (!subInterna) return null;
  const c = contenido(subInterna);
  if (!c) return null;

  return (
    <div className="border-b border-[#E4E4E7] bg-[#FAFAFA] px-4 lg:px-8 py-2.5">
      <Link
        href="/planes"
        className={`max-w-5xl mx-auto rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 no-underline transition-colors ${c.containerClass}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 flex items-center ${c.accentClass}`}>{c.icono}</span>
          <div className="min-w-0 font-sans">
            <span className={`text-xs font-bold block sm:inline ${c.accentClass}`}>
              {c.titulo}
            </span>
            <span className="hidden sm:inline text-[#71717A] mx-1.5">·</span>
            <span className="text-xs text-[#52525B] block sm:inline truncate">
              {c.detalle}
            </span>
          </div>
        </div>

        <span
          className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 tabular-nums transition-colors ${c.ctaClass}`}
        >
          <span>{c.cta}</span>
          <ChevronRight size={13} />
        </span>
      </Link>
    </div>
  );
}
