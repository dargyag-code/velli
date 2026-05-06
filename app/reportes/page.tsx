'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { BarChart2, Download, Sparkles } from 'lucide-react';
import {
  Btn, Chip, BottomNavV2, SectionLabel, StatTile, type StatAccent,
} from '@/components/v2';
import {
  getAllClientas, getStatsThisMonth, getConsultasByMonth,
  getRizoDistribution, getTratamientosDistribution, getSatisfaccionPromedio,
} from '@/lib/db';
import { getTratamientoBg, getTratamientoTextColor } from '@/lib/utils';

// ── Group-level colors for distribution bar ─────────────────────────────
const RIZO_GROUP_META: Record<string, { label: string; color: string; tone: StatAccent }> = {
  '1': { label: 'Liso',     color: '#6B6560', tone: 'gold' },
  '2': { label: 'Ondulado', color: '#1A5276', tone: 'blue' },
  '3': { label: 'Rizado',   color: '#2D5A27', tone: 'green' },
  '4': { label: 'Coily',    color: '#8A5A2E', tone: 'gold' },
};

// ── Últimos 6 meses ─────────────────────────────────────────────────────
function getLast6Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase();
}

function monthCapitalLabel(): string {
  const d = new Date();
  const m = d.toLocaleDateString('es-ES', { month: 'long' });
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} · ${d.getFullYear()}`;
}

export default function ReportesPage() {
  const [totalClientas, setTotalClientas] = useState(0);
  const [thisMonth, setThisMonth] = useState(0);
  const [byMonth, setByMonth] = useState<Record<string, number>>({});
  const [rizoDistrib, setRizoDistrib] = useState<Record<string, number>>({});
  const [tratDistrib, setTratDistrib] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [satisfaccionProm, setSatisfaccionProm] = useState<number | null>(null);

  const load = useCallback(async () => {
    // allSettled: si una query falla (ej. SQL error), las otras se preservan
    // y la pantalla muestra "sin datos" en esa métrica en vez de quedar todo
    // en blanco. CRÍTICO: el catch evita que la rejection se propague como
    // unhandled rejection (causa del spam de cientos de errores en consola).
    try {
      const [all, month, months, rizo, trat, sat] = await Promise.allSettled([
        getAllClientas(),
        getStatsThisMonth(),
        getConsultasByMonth(),
        getRizoDistribution(),
        getTratamientosDistribution(),
        getSatisfaccionPromedio(),
      ]);
      if (all.status === 'fulfilled') setTotalClientas(all.value.length);
      else console.error('[reportes.getAllClientas]', all.reason);
      if (month.status === 'fulfilled') setThisMonth(month.value);
      else console.error('[reportes.getStatsThisMonth]', month.reason);
      if (months.status === 'fulfilled') setByMonth(months.value);
      else console.error('[reportes.getConsultasByMonth]', months.reason);
      if (rizo.status === 'fulfilled') setRizoDistrib(rizo.value);
      else console.error('[reportes.getRizoDistribution]', rizo.reason);
      if (trat.status === 'fulfilled') setTratDistrib(trat.value);
      else console.error('[reportes.getTratamientosDistribution]', trat.reason);
      if (sat.status === 'fulfilled') setSatisfaccionProm(sat.value);
      else console.error('[reportes.getSatisfaccionPromedio]', sat.reason);
    } catch (e) {
      // No reintentar — si load() falla por un motivo no capturado por
      // allSettled, dejar los estados con sus valores iniciales y que la UI
      // muestre el empty state. El usuario tendrá que recargar manualmente.
      console.error('[reportes.load] error inesperado, no se reintenta:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const last6 = useMemo(() => getLast6Months(), []);
  const maxMonthVal = Math.max(...last6.map((m) => byMonth[m] ?? 0), 1);
  const totalConsultas = Object.values(byMonth).reduce((s, v) => s + v, 0);
  const promMensual = last6.length
    ? Math.round(last6.reduce((s, m) => s + (byMonth[m] ?? 0), 0) / last6.length * 10) / 10
    : 0;

  // Distribución por grupo (1/2/3/4) sumada
  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 };
    for (const [tipo, count] of Object.entries(rizoDistrib)) {
      const g = tipo[0];
      if (totals[g] !== undefined) totals[g] += count;
    }
    return totals;
  }, [rizoDistrib]);

  const totalRizoCount = Object.values(groupTotals).reduce((s, v) => s + v, 0);
  const distribution = (['3', '2', '4', '1'] as const)
    .map((g) => {
      const meta = RIZO_GROUP_META[g];
      const v = totalRizoCount > 0 ? Math.round((groupTotals[g] / totalRizoCount) * 100) : 0;
      return { l: `Tipo ${g} · ${meta.label}`, v, color: meta.color, count: groupTotals[g] };
    })
    .filter((d) => d.count > 0);

  const tratEntries = Object.entries(tratDistrib).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTrat = Math.max(...tratEntries.map((e) => e[1]), 1);

  const isEmpty = !loading && totalClientas === 0 && totalConsultas === 0;

  // Hero KPI: estimado de "ingreso del mes" no existe, mostramos consultas/mes vs meta=consultas+30%
  const meta = Math.max(Math.round(promMensual * 1.3), 1);
  const pctMeta = Math.min(Math.round((thisMonth / meta) * 100), 100);

  // ═══ EMPTY STATE ════════════════════════════════════════════════════════
  if (isEmpty) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
        <header
          style={{
            padding: '54px 16px 16px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
          <div style={{ maxWidth: 768, margin: '0 auto' }}>
            <div className="v-caps">{monthCapitalLabel()}</div>
            <h1
              style={{
                margin: '2px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 26,
                letterSpacing: '-0.02em',
              }}
            >
              Tu salón <em style={{ color: 'var(--secondary-deep)' }}>en cifras</em>
            </h1>
          </div>
        </header>

        <main
          style={{
            maxWidth: 768,
            margin: '0 auto',
            padding: '48px 16px 120px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: 'linear-gradient(135deg, var(--primary-pale), var(--secondary-pale))',
              margin: '0 auto 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart2 size={32} style={{ color: 'var(--primary)' }} />
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              color: 'var(--primary-deep)',
              letterSpacing: '-0.02em',
            }}
          >
            Reportes <em style={{ color: 'var(--secondary-deep)' }}>en blanco</em>
          </h2>
          <p
            style={{
              margin: '8px auto 18px',
              maxWidth: 360,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Cuando empieces a registrar diagnósticos aparecerán aquí tus tendencias: tipos
            de cabello, tratamientos más frecuentes y crecimiento mes a mes.
          </p>
          <Link href="/diagnostico">
            <Btn variant="primary" size="md" icon={<Sparkles size={14} />}>
              Empezar primer diagnóstico
            </Btn>
          </Link>
        </main>
        <BottomNavV2 />
      </div>
    );
  }

  // ═══ MAIN ════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* Sticky header */}
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
        <div
          style={{
            maxWidth: 768,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="v-caps">{monthCapitalLabel()} · cierre parcial</div>
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
              Tu salón <em style={{ color: 'var(--secondary-deep)' }}>en cifras</em>
            </h1>
          </div>
          <Btn size="sm" variant="outline" icon={<Download size={12} />} disabled>
            PDF
          </Btn>
        </div>
      </header>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px 120px' }}>
        {/* ── Headline KPI ─────────────────────────────────────────────── */}
        <section className="v-card-hi" style={{ overflow: 'hidden', marginBottom: 18 }}>
          <div
            style={{
              padding: '18px 18px 12px',
              background: 'linear-gradient(135deg, #FBF4EC 0%, #F5EDDC 100%)',
            }}
          >
            <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
              Consultas · este mes
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 44,
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                  color: 'var(--primary-deep)',
                }}
              >
                {loading ? '—' : thisMonth}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
                / {meta} meta
              </span>
              {!loading && promMensual > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: thisMonth >= promMensual ? 'var(--success)' : 'var(--text-tertiary)',
                    fontWeight: 700,
                  }}
                >
                  {thisMonth >= promMensual ? '↑' : '↓'} ~{promMensual}/mes
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Promedio últimos 6 meses · {totalConsultas} consultas en total
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ padding: '12px 18px 16px' }}>
            <div
              style={{
                height: 6,
                background: 'var(--border-soft)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pctMeta}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  borderRadius: 999,
                  transition: 'width 0.7s ease',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.04em',
              }}
            >
              <span>0</span>
              <span>{loading ? '—' : `${pctMeta}% META`}</span>
              <span>{meta}</span>
            </div>
          </div>
        </section>

        {/* ── Bar chart consultas/mes ─────────────────────────────────── */}
        <SectionLabel
          num="01"
          eyebrow="6 meses"
          title="Consultas por mes"
        />
        <section className="v-card" style={{ padding: 16, marginBottom: 22 }}>
          {loading ? (
            <div className="skeleton-shimmer" style={{ height: 140 }} />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 6,
                  height: 140,
                  paddingBottom: 6,
                  borderBottom: '1px solid var(--border-soft)',
                }}
              >
                {last6.map((ym, idx) => {
                  const val = byMonth[ym] ?? 0;
                  const heightPx = Math.round((val / maxMonthVal) * 110);
                  const cur = idx === last6.length - 1;
                  return (
                    <div
                      key={ym}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: cur ? 'var(--primary)' : 'var(--text-tertiary)',
                          fontWeight: 700,
                          minHeight: 12,
                        }}
                      >
                        {val > 0 ? val : ''}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          borderRadius: '6px 6px 0 0',
                          background: cur
                            ? 'linear-gradient(180deg, var(--primary), var(--primary-deep))'
                            : 'var(--primary-pale)',
                          border: cur ? 'none' : '1px solid var(--primary-line)',
                          height: Math.max(heightPx, val > 0 ? 8 : 2),
                          transition: 'height 0.7s ease',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {last6.map((ym) => (
                  <div
                    key={ym}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 9.5,
                      color: 'var(--text-tertiary)',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {monthLabel(ym)}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Distribución tipos de cabello ────────────────────────────── */}
        <SectionLabel
          num="02"
          eyebrow="Tipo de rizo"
          title="Distribución de clientas"
        />
        <section className="v-card" style={{ padding: 16, marginBottom: 22 }}>
          {loading ? (
            <div className="skeleton-shimmer" style={{ height: 100 }} />
          ) : distribution.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
              Sin datos aún
            </p>
          ) : (
            <>
              {/* Stacked bar */}
              <div
                style={{
                  display: 'flex',
                  height: 14,
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginBottom: 14,
                  background: 'var(--bg)',
                }}
              >
                {distribution.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${d.v}%`,
                      background: d.color,
                      transition: 'width 0.7s ease',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {distribution.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: d.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-main)' }}>
                      {d.l}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                      }}
                    >
                      {d.v}%
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-tertiary)',
                        minWidth: 26,
                        textAlign: 'right',
                      }}
                    >
                      · {d.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Tratamientos top 5 ──────────────────────────────────────── */}
        <SectionLabel
          num="03"
          eyebrow="Top 5"
          title="Tratamientos más frecuentes"
        />
        <section className="v-card" style={{ padding: 16, marginBottom: 22 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 32 }} />
              ))}
            </div>
          ) : tratEntries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
              Sin datos aún
            </p>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tratEntries.map(([trat, count], idx) => {
                const bg = getTratamientoBg(trat);
                const color = getTratamientoTextColor(trat);
                const pct = Math.round((count / maxTrat) * 100);
                return (
                  <li
                    key={trat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      background: bg,
                      borderRadius: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color,
                        opacity: 0.7,
                        minWidth: 16,
                      }}
                    >
                      0{idx + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {trat}
                    </span>
                    <div
                      style={{
                        width: 60,
                        height: 5,
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.5)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: color,
                          transition: 'width 0.7s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color,
                        minWidth: 16,
                        textAlign: 'right',
                      }}
                    >
                      {count}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ── Mini grid KPIs ──────────────────────────────────────────── */}
        <SectionLabel
          num="04"
          eyebrow="Otros indicadores"
          title="Vista rápida"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
          <StatTile
            label="CLIENTAS · TOTAL"
            value={loading ? '—' : totalClientas}
            suffix="activas"
            accent="green"
            spark="0,15 14,11 28,13 42,7 56,9 70,5 85,8 100,2"
          />
          <StatTile
            label="ESTE MES"
            value={loading ? '—' : thisMonth}
            suffix="consultas"
            accent="gold"
            spark="0,12 14,14 28,9 42,11 56,7 70,8 85,6 100,4"
          />
          <StatTile
            label="PROMEDIO"
            value={loading ? '—' : promMensual}
            suffix="/mes"
            accent="blue"
            spark="0,8 14,12 28,10 42,9 56,11 70,7 85,9 100,6"
          />
          <StatTile
            label="SATISFACCIÓN"
            value={loading ? '—' : satisfaccionProm !== null ? satisfaccionProm.toFixed(1) : '—'}
            suffix={satisfaccionProm !== null ? '/ 5 ★' : ''}
            accent="gold"
            spark="0,16 14,13 28,11 42,12 56,9 70,10 85,5 100,4"
          />
        </div>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--text-tertiary)',
            paddingTop: 18,
          }}
        >
          VELLI · CONFIDENCIAL · SOLO TÚ VES ESTOS DATOS
        </div>
      </main>

      <BottomNavV2 />
    </div>
  );
}
