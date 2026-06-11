'use client';
import React, { useEffect, useState } from 'react';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';
import { InnerHeader, BottomNavV2, Btn, Chip } from '@/components/v2';
import { PLANES, PLAN_IDS, formatearCop, type PlanId } from '@/lib/subscription/plans';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';
import { showToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

// ─── Página de Planes ──────────────────────────────────────────────────────
// Estado actual de la suscripción + cards de los 3 planes. El pago abre el
// checkout hospedado del proveedor (Bold) — nunca capturamos tarjeta.
// Modelo prepago: cada pago suma 30 días, sin cobro automático.

const ESTADO_LABEL: Record<SuscripcionEfectiva['estado'], { texto: string; tone: 'green' | 'gold' | 'amber' | 'ghost' }> = {
  trialing: { texto: 'Prueba gratuita', tone: 'gold' },
  active: { texto: 'Activa', tone: 'green' },
  past_due: { texto: 'En días de gracia', tone: 'amber' },
  expired: { texto: 'Vencida', tone: 'ghost' },
  canceled: { texto: 'Cancelada', tone: 'ghost' },
};

export default function PlanesPage() {
  const [sub, setSub] = useState<SuscripcionEfectiva | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    getSuscripcionEfectiva()
      .then(setSub)
      .finally(() => setSubLoading(false));
  }, []);

  const pagar = async (plan: PlanId) => {
    if (payingPlan) return;
    setPayingPlan(plan);
    try {
      const res = await fetch('/api/pagos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        showToast(data.error ?? 'No se pudo iniciar el pago', 'error');
        setPayingPlan(null);
        return;
      }
      // Redirige al checkout de Bold; al terminar vuelve a /planes/confirmacion.
      window.location.href = data.url;
    } catch (e) {
      console.error('[planes.pagar]', e);
      showToast('Sin conexión. Revisa tu internet e intenta de nuevo.', 'error');
      setPayingPlan(null);
    }
  };

  const estadoUi = sub ? ESTADO_LABEL[sub.estado] : null;
  const necesitaPagar = sub && (sub.estado === 'past_due' || sub.estado === 'expired');

  return (
    <div className="v-grain" style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <InnerHeader eyebrow="Tu suscripción" title="Planes Velli Pro" backHref="/configuracion" />

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '18px 16px 140px' }}>

        {/* ── Estado actual ─────────────────────────────────────────────── */}
        <div
          className="v-card"
          style={{
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v-caps" style={{ marginBottom: 3 }}>Estado actual</div>
            {subLoading ? (
              <div className="skeleton-shimmer" style={{ height: 14, width: '60%' }} />
            ) : sub ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-main)' }}>
                {sub.plan ? `Plan ${PLANES[sub.plan].nombre}` : 'Sin plan elegido'}
                {sub.vence && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {' · '}
                    {sub.estado === 'expired' ? 'venció el' : 'vence el'} {formatDate(sub.vence)}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                No se pudo consultar tu suscripción
              </div>
            )}
          </div>
          {estadoUi && <Chip tone={estadoUi.tone} dot>{estadoUi.texto}</Chip>}
        </div>

        {/* ── Cards de planes ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PLAN_IDS.map((id) => {
            const def = PLANES[id];
            const esActual = sub?.plan === id && (sub.estado === 'active' || sub.estado === 'past_due');
            return (
              <section
                key={id}
                className="v-card-hi"
                style={{
                  padding: '18px 18px 16px',
                  position: 'relative',
                  border: def.destacado
                    ? '1.5px solid var(--primary)'
                    : '1px solid var(--border)',
                }}
              >
                {def.destacado && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -9,
                      right: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'linear-gradient(180deg, #3D7A35, #2D5A27)',
                      color: '#fff',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Sparkles size={10} /> Recomendado
                  </span>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-serif)',
                        fontSize: 20,
                        letterSpacing: '-0.01em',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {def.nombre}
                      {esActual && <Chip tone="green">Tu plan</Chip>}
                    </h2>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {def.tagline}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 22,
                        color: 'var(--primary-deep)',
                        lineHeight: 1,
                      }}
                    >
                      {formatearCop(def.precioCop)}
                    </div>
                    <div className="v-caps" style={{ marginTop: 3 }}>COP / 30 días</div>
                  </div>
                </div>

                <ul style={{ listStyle: 'none', margin: '14px 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {def.beneficios.map((b, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 12.5,
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.35,
                      }}
                    >
                      <Check size={13} strokeWidth={2.4} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                      {b}
                    </li>
                  ))}
                </ul>

                <Btn
                  fullWidth
                  variant={def.destacado ? 'primary' : 'outline'}
                  disabled={payingPlan !== null}
                  onClick={() => pagar(id)}
                >
                  {payingPlan === id
                    ? 'Abriendo pago seguro…'
                    : esActual || (necesitaPagar && sub?.plan === id)
                      ? `Renovar ${def.nombre} — 30 días`
                      : `Elegir ${def.nombre}`}
                </Btn>
              </section>
            );
          })}
        </div>

        {/* ── Nota de confianza ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 18,
            padding: '0 6px',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
          }}
        >
          <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} />
          <span>
            Pago seguro procesado por Bold (PSE, Nequi, tarjetas). Modelo prepago:
            cada pago suma 30 días y no hay cobros automáticos. Tus datos nunca se
            borran al vencer el plan.
          </span>
        </div>
      </main>

      <BottomNavV2 />
    </div>
  );
}
