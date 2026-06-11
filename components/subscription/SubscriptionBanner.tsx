'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Sparkles, ChevronRight } from 'lucide-react';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';

// ── Banner global de suscripción ───────────────────────────────────────────
// Solo aparece cuando hay algo accionable: trial por terminar (≤5 días),
// periodo de gracia (past_due) o plan vencido. Activa/trial holgado = nada,
// cero ruido. Todo el banner navega a /planes.

interface BannerContent {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  cta: string;
  bg: string;
  border: string;
  fg: string;
}

function contenido(sub: SuscripcionEfectiva): BannerContent | null {
  if (sub.estado === 'expired') {
    return {
      icono: <AlertCircle size={16} strokeWidth={2} />,
      titulo: 'Tu plan venció',
      detalle: 'Tus datos siguen intactos, pero ya no puedes crear registros nuevos.',
      cta: 'Renovar',
      bg: '#FBEDE8',
      border: 'rgba(166, 61, 38, 0.22)',
      fg: '#A63D26',
    };
  }
  if (sub.estado === 'past_due') {
    return {
      icono: <AlertCircle size={16} strokeWidth={2} />,
      titulo: 'Tu plan venció — estás en días de gracia',
      detalle: 'Renueva ahora para no perder acceso a crear clientas y consultas.',
      cta: 'Renovar',
      bg: 'var(--treat-recon-bg)',
      border: 'rgba(212, 130, 10, 0.25)',
      fg: 'var(--treat-recon-color)',
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
      detalle: 'Elige un plan para seguir sin interrupciones.',
      cta: 'Ver planes',
      bg: 'var(--secondary-pale)',
      border: 'rgba(138, 90, 46, 0.2)',
      fg: 'var(--secondary-deep)',
    };
  }
  return null;
}

export default function SubscriptionBanner() {
  const [sub, setSub] = useState<SuscripcionEfectiva | null>(null);

  useEffect(() => {
    getSuscripcionEfectiva().then(setSub).catch(() => {});
  }, []);

  if (!sub) return null;
  const c = contenido(sub);
  if (!c) return null;

  return (
    <Link href="/planes" style={{ textDecoration: 'none', display: 'block', marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 16,
          background: c.bg,
          border: `1px solid ${c.border}`,
        }}
      >
        <span style={{ color: c.fg, flexShrink: 0, display: 'flex' }}>{c.icono}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 12.5,
              color: c.fg,
              lineHeight: 1.2,
            }}
          >
            {c.titulo}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              marginTop: 2,
              lineHeight: 1.35,
            }}
          >
            {c.detalle}
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 11.5,
            color: c.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {c.cta}
          <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  );
}
