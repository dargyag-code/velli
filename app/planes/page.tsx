'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  PLANES,
  PLAN_IDS_COMERCIALES,
  formatearCop,
  type PlanId,
} from '@/lib/subscription/plans';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';
import { showToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

const ESTADO_LABEL: Record<
  SuscripcionEfectiva['estado'],
  { texto: string; classes: string }
> = {
  trialing: {
    texto: 'Prueba gratuita activa',
    classes: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
  },
  active: {
    texto: 'Suscripción activa',
    classes: 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/30',
  },
  past_due: {
    texto: 'En días de gracia',
    classes: 'bg-[#FFF7F5] text-[#D97757] border-[#D97757]/30',
  },
  expired: {
    texto: 'Vencida',
    classes: 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4]',
  },
  canceled: {
    texto: 'Cancelada',
    classes: 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4]',
  },
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
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans pb-32">
      {/* Cabecera */}
      <header className="sticky top-0 z-30 bg-[#FAF7F5]/95 backdrop-blur-md border-b border-[#EFE8E4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/configuracion"
            className="min-h-[44px] inline-flex items-center gap-2 text-xs font-bold text-[#6B535C] hover:text-[#3B0D1E] no-underline transition-colors"
          >
            <ArrowLeft size={16} />
            Volver a Salón
          </Link>
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
            Velli Business Intelligence
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="mb-7">
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
            Planes & Rentabilidad
          </span>
          <h1 className="m-0 mt-1 font-display text-2xl md:text-3xl font-semibold text-[#3B0D1E] tracking-tight">
            Elige el plan para tu salón
          </h1>
          <p className="text-sm text-[#6B535C] mt-2 max-w-2xl leading-relaxed">
            Elimina el cálculo al ojo en silla, protege tu margen neto por servicio y cobra con transparencia en un solo toque.
          </p>
        </div>

        {/* Estado actual de la suscripción */}
        <div className="bg-white rounded-2xl border border-[#EFE8E4] p-4 sm:p-5 mb-7 flex flex-wrap items-center justify-between gap-3 shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]">
          <div>
            <p className="m-0 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
              Estado de tu cuenta
            </p>
            {subLoading ? (
              <p className="m-0 text-sm text-[#6B535C] mt-1">Consultando suscripción…</p>
            ) : sub ? (
              <p className="m-0 text-sm font-bold text-[#3B0D1E] mt-0.5 tabular-nums">
                {sub.plan ? `Plan ${PLANES[sub.plan].nombre}` : 'Periodo de prueba activo'}
                {sub.vence && (
                  <span className="font-normal text-[#6B535C]">
                    {' · '}
                    {sub.estado === 'expired' ? 'venció el' : 'vence el'} {formatDate(sub.vence)}
                  </span>
                )}
              </p>
            ) : (
              <p className="m-0 text-sm text-[#6B535C] mt-0.5">
                No se pudo consultar el estado de tu suscripción
              </p>
            )}
          </div>

          {estadoUi && (
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-bold border ${estadoUi.classes}`}
            >
              {estadoUi.texto}
            </span>
          )}
        </div>

        {/* Recordatorio ejecutivo de retorno de inversión (ROI en 1 servicio) */}
        <div className="mb-7 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/25 p-4 sm:p-5 flex items-start gap-3.5 shadow-[0_10px_30px_-5px_rgba(13,148,136,0.1)]">
          <div className="w-11 h-11 rounded-xl bg-white border border-[#0D9488]/20 text-[#0D9488] flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#0D9488] block">
              Retorno desde la primera silla
            </span>
            <p className="m-0 text-sm sm:text-[15px] font-bold text-[#3B0D1E] mt-0.5 leading-snug">
              Un solo servicio de color bien cotizado recupera el 100% de tu inversión mensual en{' '}
              <span className="text-[#0D9488] tabular-nums">Plan Studio BI ($89.000 COP/mes)</span> o{' '}
              <span className="text-[#0D9488] tabular-nums">Salón Pro + IA ($149.000 COP/mes)</span>.
            </p>
            <p className="m-0 text-xs text-[#6B535C] mt-1 leading-relaxed">
              Dejar de absorber gramos extra de decolorante y revelador en cabellos largos o de alta densidad paga todo tu mes desde el primer cierre.
            </p>
          </div>
        </div>

        {/* Grid de los 2 planes oficiales: Studio BI ($89.000) y Salón Pro + IA ($149.000) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {PLAN_IDS_COMERCIALES.map((id) => {
            const def = PLANES[id];
            const esDestacado = Boolean(def.destacado);
            const esActual =
              sub?.plan === id && (sub.estado === 'active' || sub.estado === 'past_due');

            return (
              <section
                key={id}
                className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between relative transition-all ${
                  esDestacado
                    ? 'bg-[#3B0D1E] text-[#FAF7F5] border-2 border-[#3B0D1E] shadow-[0_24px_55px_-14px_rgba(59,13,30,0.28)]'
                    : 'bg-white text-[#3B0D1E] border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]'
                }`}
              >
                {esDestacado && (
                  <span className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E8CFC8] text-[#3B0D1E] text-[10px] font-bold uppercase tracking-[0.08em] shadow-xs">
                    <Sparkles size={11} />
                    Más elegido por salones
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2
                          className={`m-0 font-display text-2xl font-semibold tracking-tight ${
                            esDestacado ? '!text-[#FAF7F5]' : 'text-[#3B0D1E]'
                          }`}
                        >
                          Plan {def.nombre}
                        </h2>
                        {esActual && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              esDestacado
                                ? 'bg-[#0D9488]/30 !text-[#FAF7F5]'
                                : 'bg-[#F0FDFA] text-[#0D9488]'
                            }`}
                          >
                            Tu plan
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          esDestacado ? '!text-[#E8CFC8]' : 'text-[#6B535C]'
                        }`}
                      >
                        {def.tagline}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-5 pb-5 border-b ${
                      esDestacado ? 'border-[#FAF7F5]/15' : 'border-[#EFE8E4]'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`font-display text-3xl sm:text-4xl font-bold tabular-nums tracking-tight ${
                          esDestacado ? '!text-[#FAF7F5]' : 'text-[#3B0D1E]'
                        }`}
                      >
                        {formatearCop(def.precioCop)}
                      </span>
                      <span
                        className={`text-xs font-bold uppercase tracking-[0.08em] ${
                          esDestacado ? '!text-[#E8CFC8]' : 'text-[#6B535C]'
                        }`}
                      >
                        COP / mes
                      </span>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-3 mb-7 pl-0 list-none">
                    {def.beneficios.map((beneficio, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-xs sm:text-[13px] leading-relaxed"
                      >
                        <Check
                          size={15}
                          strokeWidth={2.6}
                          className={`shrink-0 mt-0.5 ${
                            esDestacado ? 'text-[#E8CFC8]' : 'text-[#0D9488]'
                          }`}
                        />
                        <span className={esDestacado ? 'text-[#FAF7F5]/95' : 'text-[#3B0D1E]'}>
                          {beneficio}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={payingPlan !== null}
                  onClick={() => pagar(id)}
                  className={`w-full min-h-[48px] py-3.5 px-5 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-50 border-none ${
                    esDestacado
                      ? 'bg-[#E8CFC8] hover:bg-[#FAF7F5] text-[#3B0D1E] shadow-md'
                      : 'bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] shadow-[0_10px_24px_-6px_rgba(59,13,30,0.22)]'
                  }`}
                >
                  {payingPlan === id
                    ? 'Abriendo pago seguro…'
                    : esActual || (necesitaPagar && sub?.plan === id)
                      ? `Renovar Plan ${def.nombre} — 30 días`
                      : `Elegir Plan ${def.nombre}`}
                </button>
              </section>
            );
          })}
        </div>

        {/* Nota de confianza Bold */}
        <div className="mt-7 flex items-start gap-2.5 text-xs text-[#6B535C] leading-relaxed px-1">
          <ShieldCheck size={16} className="text-[#3B0D1E] shrink-0 mt-0.5" />
          <p className="m-0">
            Pago seguro procesado por Bold (PSE, Nequi y tarjetas). Modelo prepago de 30 días sin débitos automáticos: tus plantillas de precios, clientas y métricas siempre permanecen resguardadas.
          </p>
        </div>
      </main>
    </div>
  );
}
