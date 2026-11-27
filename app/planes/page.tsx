'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles, ShieldCheck, TrendingUp } from 'lucide-react';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
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
    classes: 'bg-[#F4F4F5] text-[#111111] border-[#E4E4E7]',
  },
  active: {
    texto: 'Suscripción activa',
    classes: 'bg-[#F0FDF4] text-[#15803D] border-[#15803D]/30',
  },
  past_due: {
    texto: 'En días de gracia',
    classes: 'bg-[#FFFBEB] text-[#B45309] border-[#B45309]/30',
  },
  expired: {
    texto: 'Vencida',
    classes: 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7]',
  },
  canceled: {
    texto: 'Cancelada',
    classes: 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7]',
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
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans pb-32">
      <VelvetTopHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="mb-7">
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
            Planes & Rentabilidad
          </span>
          <h1 className="m-0 mt-1 font-display text-2xl md:text-3xl font-semibold text-[#111111] tracking-tight">
            Elige el plan para tu salón
          </h1>
          <p className="text-sm text-[#52525B] mt-2 max-w-2xl leading-relaxed">
            Elimina el cálculo al ojo en silla, protege tu margen neto por servicio y cobra con transparencia en un solo toque.
          </p>
        </div>

        {/* Estado actual de la suscripción */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 sm:p-5 mb-7 flex flex-wrap items-center justify-between gap-3 ">
          <div>
            <p className="m-0 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
              Estado de tu cuenta
            </p>
            {subLoading ? (
              <p className="m-0 text-sm text-[#52525B] mt-1">Consultando suscripción…</p>
            ) : sub ? (
              <p className="m-0 text-sm font-bold text-[#111111] mt-0.5 tabular-nums">
                {sub.plan ? `Plan ${PLANES[sub.plan].nombre}` : 'Periodo de prueba activo'}
                {sub.vence && (
                  <span className="font-normal text-[#52525B]">
                    {' · '}
                    {sub.estado === 'expired' ? 'venció el' : 'vence el'} {formatDate(sub.vence)}
                  </span>
                )}
              </p>
            ) : (
              <p className="m-0 text-sm text-[#52525B] mt-0.5">
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
        <div className="mb-7 rounded-xl bg-[#F0FDF4] border border-[#15803D]/25 p-4 sm:p-5 flex items-start gap-3.5 ">
          <div className="w-11 h-11 rounded-xl bg-white border border-[#15803D]/20 text-[#15803D] flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#15803D] block">
              Retorno desde la primera silla
            </span>
            <p className="m-0 text-sm sm:text-[15px] font-bold text-[#111111] mt-0.5 leading-snug">
              Un solo servicio de color bien cotizado recupera el 100% de tu inversión mensual en{' '}
              <span className="text-[#15803D] tabular-nums">Plan Studio BI ($89.000 COP/mes)</span> o{' '}
              <span className="text-[#15803D] tabular-nums">Salón Pro + IA ($149.000 COP/mes)</span>.
            </p>
            <p className="m-0 text-xs text-[#52525B] mt-1 leading-relaxed">
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
                className={`rounded-xl p-6 sm:p-7 flex flex-col justify-between relative transition-all ${
                  esDestacado
                    ? 'bg-[#111111] text-white border-2 border-[#111111] shadow-[0_24px_55px_-14px_rgba(59,13,30,0.28)]'
                    : 'bg-white text-[#111111] border border-[#E4E4E7] '
                }`}
              >
                {esDestacado && (
                  <span className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E4E4E7] text-[#111111] text-[10px] font-bold uppercase tracking-[0.08em] shadow-xs">
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
                            esDestacado ? '!text-white' : 'text-[#111111]'
                          }`}
                        >
                          Plan {def.nombre}
                        </h2>
                        {esActual && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              esDestacado
                                ? 'bg-[#15803D]/30 !text-white'
                                : 'bg-[#F0FDF4] text-[#15803D]'
                            }`}
                          >
                            Tu plan
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          esDestacado ? '!text-[#E4E4E7]' : 'text-[#52525B]'
                        }`}
                      >
                        {def.tagline}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-5 pb-5 border-b ${
                      esDestacado ? 'border-[#FAFAFA]/15' : 'border-[#E4E4E7]'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`font-display text-3xl sm:text-4xl font-bold tabular-nums tracking-tight ${
                          esDestacado ? '!text-white' : 'text-[#111111]'
                        }`}
                      >
                        {formatearCop(def.precioCop)}
                      </span>
                      <span
                        className={`text-xs font-bold uppercase tracking-[0.08em] ${
                          esDestacado ? '!text-[#E4E4E7]' : 'text-[#52525B]'
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
                            esDestacado ? 'text-[#E4E4E7]' : 'text-[#15803D]'
                          }`}
                        />
                        <span className={esDestacado ? 'text-white/95' : 'text-[#111111]'}>
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
                  className={`w-full min-h-[48px] py-3.5 px-5 rounded-xl font-bold text-sm transition-all cursor-pointer disabled:opacity-50 border-none ${
                    esDestacado
                      ? 'bg-[#E4E4E7] hover:bg-[#FAFAFA] text-[#111111] shadow-md'
                      : 'bg-[#111111] hover:bg-[#27272A] text-white shadow-[0_10px_24px_-6px_rgba(59,13,30,0.22)]'
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
        <div className="mt-7 flex items-start gap-2.5 text-xs text-[#52525B] leading-relaxed px-1">
          <ShieldCheck size={16} className="text-[#111111] shrink-0 mt-0.5" />
          <p className="m-0">
            Pago seguro procesado por Bold (PSE, Nequi y tarjetas). Modelo prepago de 30 días sin débitos automáticos: tus plantillas de precios, clientas y métricas siempre permanecen resguardadas.
          </p>
        </div>
      </main>
    </div>
  );
}
