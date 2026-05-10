'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, ChevronRight, ChevronLeft, CalendarX, Sparkles,
} from 'lucide-react';
import {
  Btn, Chip, AvatarV2, toneFromTipoRizo, BottomNavV2, SectionLabel, SettingsIconButton,
} from '@/components/v2';
import { getUpcomingCitas, getPastCitas } from '@/lib/db';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';

interface CitaPair {
  consulta: Consulta;
  clienta: Clienta;
}

const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diasRestantes(dateStr: string): number {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(dateStr));
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function sameDay(aISO: string, b: Date): boolean {
  const a = new Date(aISO);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getMesLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

// ── Day chip helpers ──────────────────────────────────────────────────────
function DayChip({ fecha }: { fecha: string }) {
  const dias = diasRestantes(fecha);
  if (dias === 0) return <Chip tone="green" dot>Hoy</Chip>;
  if (dias === 1) return <Chip tone="gold">Mañana</Chip>;
  if (dias <= 7) return <Chip tone="blue">En {dias} días</Chip>;
  return <Chip tone="ghost">En {dias} días</Chip>;
}

// ── Cita card ─────────────────────────────────────────────────────────────
function CitaCard({ pair, isPast = false }: { pair: CitaPair; isPast?: boolean }) {
  const { consulta, clienta } = pair;
  const tone = toneFromTipoRizo(clienta.tipoRizoPrincipal);
  const tratamiento = consulta.resultado?.tratamientoPrincipal;
  const dias = diasRestantes(consulta.proximaCita!);
  const isHoy = dias === 0 && !isPast;
  const fecha = new Date(consulta.proximaCita!);

  return (
    <Link
      href={`/clientas/${clienta.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <article
        className="stagger-item"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: 14,
          background: 'var(--bg-card)',
          borderRadius: 14,
          border: '1px solid var(--border-soft)',
          boxShadow: 'var(--shadow-xs)',
          borderLeft: isHoy ? '3px solid var(--primary)' : '1px solid var(--border-soft)',
          opacity: isPast ? 0.7 : 1,
        }}
      >
        {/* Time spine: día + número */}
        <div
          style={{
            width: 42,
            flexShrink: 0,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              color: isHoy ? 'var(--primary)' : 'var(--text-tertiary)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {DAYS_SHORT[fecha.getDay()]}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              color: isHoy ? 'var(--primary)' : 'var(--text-main)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              marginTop: 2,
            }}
          >
            {fecha.getDate()}
          </div>
        </div>

        <AvatarV2 nombre={clienta.nombre} tone={tone} size="md" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: 15,
                lineHeight: 1.2,
                color: 'var(--text-main)',
                letterSpacing: '-0.005em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {clienta.nombre}
            </h3>
            {isPast ? (
              <Chip tone="ghost">Pasada</Chip>
            ) : (
              <DayChip fecha={consulta.proximaCita!} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            {clienta.tipoRizoPrincipal && (
              <Chip tone="ghost" style={{ padding: '2px 7px', fontSize: 9.5 }}>
                {getRizoLabel(clienta.tipoRizoPrincipal)}
              </Chip>
            )}
            {tratamiento && (
              <Chip
                tone={
                  tratamiento.toLowerCase().includes('hidrat') ? 'blue'
                    : tratamiento.toLowerCase().includes('reconstr') || tratamiento.toLowerCase().includes('proteína') ? 'amber'
                      : tratamiento.toLowerCase().includes('repolariz') ? 'purple'
                        : 'green'
                }
              >
                {tratamiento.split(' ')[0]}
              </Chip>
            )}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      </article>
    </Link>
  );
}

// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════════
export default function AgendaPage() {
  const [upcoming, setUpcoming] = useState<CitaPair[]>([]);
  const [past, setPast] = useState<CitaPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const load = useCallback(async () => {
    try {
      const [up, pa] = await Promise.all([getUpcomingCitas(), getPastCitas(15)]);
      setUpcoming(up);
      setPast(pa);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Week strip: 7 days starting today + offset weeks
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    today.setDate(today.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const count = upcoming.filter((p) => sameDay(p.consulta.proximaCita!, d)).length;
      const isToday = i === 0 && weekOffset === 0;
      return { date: d, count, isToday };
    });
  }, [upcoming, weekOffset]);

  const monthLabel = useMemo(() => {
    const first = weekDays[0]?.date ?? new Date();
    return `${MONTHS_LONG[first.getMonth()]} · ${first.getFullYear()}`;
  }, [weekDays]);

  const upcomingByMonth: Record<string, CitaPair[]> = {};
  for (const pair of upcoming) {
    const key = getMesLabel(pair.consulta.proximaCita!);
    if (!upcomingByMonth[key]) upcomingByMonth[key] = [];
    upcomingByMonth[key].push(pair);
  }

  const estaSemanaCount = upcoming.filter((p) => {
    const d = diasRestantes(p.consulta.proximaCita!);
    return d >= 0 && d <= 7;
  }).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* ── Sticky header with week strip ───────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '54px 16px 16px',
          background: 'rgba(255, 254, 251, 0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <div style={{ maxWidth: 768, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 14,
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="v-caps"
                style={{ textTransform: 'capitalize' }}
              >
                {monthLabel}
              </div>
              <h1
                style={{
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 26,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                  color: 'var(--text-main)',
                }}
              >
                {weekOffset === 0 ? (
                  <>Esta <em style={{ color: 'var(--secondary-deep)' }}>semana</em></>
                ) : (
                  <>Semana <em style={{ color: 'var(--secondary-deep)' }}>{weekOffset > 0 ? `+${weekOffset}` : weekOffset}</em></>
                )}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Semana anterior"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Semana siguiente"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ChevronRight size={14} />
              </button>
              <SettingsIconButton />
            </div>
          </div>

          {/* Week strip */}
          <div style={{ display: 'flex', gap: 6 }}>
            {weekDays.map((d, i) => {
              const isSelected = d.isToday;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: '10px 0 8px',
                    borderRadius: 12,
                    background: isSelected ? 'var(--primary-deep)' : 'transparent',
                    color: isSelected ? '#F5EDDC' : 'var(--text-main)',
                    border: isSelected ? 'none' : '1px solid var(--border-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 9.5,
                      opacity: 0.7,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {DAYS_SHORT[d.date.getDay()]}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 18,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {d.date.getDate()}
                  </span>
                  {d.count > 0 ? (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: isSelected ? '#E8C290' : 'var(--secondary)',
                      }}
                    />
                  ) : (
                    <span style={{ width: 5, height: 5 }} aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px 120px' }}>
        {/* KPI strip */}
        {!loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--primary-pale)',
                borderRadius: 14,
                border: '1px solid rgba(45, 90, 39, 0.15)',
              }}
            >
              <div className="v-num" style={{ fontSize: 9, color: 'var(--primary)' }}>
                PRÓXIMAS · TOTAL
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 32,
                  lineHeight: 1,
                  color: 'var(--primary-deep)',
                  letterSpacing: '-0.025em',
                  marginTop: 4,
                }}
              >
                {upcoming.length}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--primary)', marginTop: 2 }}>
                {upcoming.length === 1 ? 'cita agendada' : 'citas agendadas'}
              </div>
            </div>
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--secondary-pale)',
                borderRadius: 14,
                border: '1px solid rgba(138, 90, 46, 0.18)',
              }}
            >
              <div className="v-num" style={{ fontSize: 9, color: 'var(--secondary-deep)' }}>
                ESTA SEMANA
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 32,
                  lineHeight: 1,
                  color: 'var(--primary-deep)',
                  letterSpacing: '-0.025em',
                  marginTop: 4,
                }}
              >
                {estaSemanaCount}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--secondary-deep)', marginTop: 2 }}>
                · próximos 7 días
              </div>
            </div>
          </div>
        )}

        {/* CTA nueva consulta */}
        <Link href="/diagnostico" style={{ textDecoration: 'none', display: 'block', marginBottom: 22 }}>
          <article
            className="active:scale-[0.98] transition-transform"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 16,
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-strong)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, var(--primary-deep), var(--primary))',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Plus size={18} strokeWidth={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 15,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.005em',
                }}
              >
                Agendar nueva consulta
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  marginTop: 2,
                }}
              >
                La fecha se asigna al finalizar el diagnóstico
              </div>
            </div>
          </article>
        </Link>

        {/* Upcoming list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 80 }} />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: 'var(--bg-card)',
              borderRadius: 18,
              border: '1px solid var(--border-soft)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: 'linear-gradient(135deg, var(--primary-pale), var(--secondary-pale))',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarX size={32} style={{ color: 'var(--primary)' }} />
            </div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                color: 'var(--primary-deep)',
                letterSpacing: '-0.02em',
              }}
            >
              Agenda <em style={{ color: 'var(--secondary-deep)' }}>en calma</em>
            </h3>
            <p
              style={{
                margin: '8px auto 18px',
                maxWidth: 320,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Aquí aparecerán tus próximas citas. Se agendan al finalizar cada diagnóstico.
            </p>
            <Link href="/diagnostico">
              <Btn variant="primary" size="md" icon={<Sparkles size={14} />}>
                Nueva consulta
              </Btn>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {Object.entries(upcomingByMonth).map(([mes, pairs], idx) => (
              <div key={mes}>
                <SectionLabel
                  num={String(idx + 1).padStart(2, '0')}
                  eyebrow={`${pairs.length} ${pairs.length === 1 ? 'cita' : 'citas'}`}
                  title={
                    <span style={{ textTransform: 'capitalize', fontSize: 18 }}>{mes}</span>
                  }
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pairs.map((pair) => (
                    <CitaCard key={pair.consulta.id} pair={pair} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past collapsible */}
        {past.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 0,
                marginBottom: 14,
              }}
            >
              <ChevronRight
                size={14}
                style={{
                  transform: showPast ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
              <span className="v-caps">
                Historial · {past.length} {past.length === 1 ? 'cita pasada' : 'citas pasadas'}
              </span>
            </button>
            {showPast && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {past.map((pair) => (
                  <CitaCard key={pair.consulta.id} pair={pair} isPast />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <BottomNavV2 />
    </div>
  );
}
