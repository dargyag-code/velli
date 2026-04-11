'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, Users, CalendarDays, TrendingUp } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import {
  getAllClientas, getStatsThisMonth, getConsultasByMonth,
  getRizoDistribution, getTratamientosDistribution,
} from '@/lib/db';
import { getTratamientoBg, getTratamientoTextColor } from '@/lib/utils';

// ── Mini barra de porcentaje ───────────────────────────────────────────────
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2.5 bg-[#F0F0F0] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Colores de tipo de rizo ────────────────────────────────────────────────
const RIZO_COLORS: Record<string, string> = {
  '1A': '#94A3B8', '1B': '#64748B', '1C': '#475569',
  '2A': '#60A5FA', '2B': '#3B82F6', '2C': '#1D4ED8',
  '3A': '#C084FC', '3B': '#A855F7', '3C': '#7C3AED',
  '4A': '#FCD34D', '4B': '#F59E0B', '4C': '#D97706',
};
const RIZO_GROUP_COLOR: Record<string, string> = {
  '1': '#64748B', '2': '#3B82F6', '3': '#7C3AED', '4': '#F59E0B',
};

// ── Últimos 6 meses ────────────────────────────────────────────────────────
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
  return d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
}

export default function ReportesPage() {
  const [totalClientas, setTotalClientas] = useState(0);
  const [thisMonth, setThisMonth] = useState(0);
  const [byMonth, setByMonth] = useState<Record<string, number>>({});
  const [rizoDistrib, setRizoDistrib] = useState<Record<string, number>>({});
  const [tratDistrib, setTratDistrib] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [all, month, months, rizo, trat] = await Promise.all([
        getAllClientas(),
        getStatsThisMonth(),
        getConsultasByMonth(),
        getRizoDistribution(),
        getTratamientosDistribution(),
      ]);
      setTotalClientas(all.length);
      setThisMonth(month);
      setByMonth(months);
      setRizoDistrib(rizo);
      setTratDistrib(trat);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const last6 = getLast6Months();
  const maxMonthVal = Math.max(...last6.map((m) => byMonth[m] ?? 0), 1);
  const totalConsultas = Object.values(byMonth).reduce((s, v) => s + v, 0);
  const promMensual = last6.length
    ? Math.round(last6.reduce((s, m) => s + (byMonth[m] ?? 0), 0) / last6.length * 10) / 10
    : 0;

  // Ordenar rizo por cantidad
  const rizoEntries = Object.entries(rizoDistrib).sort((a, b) => b[1] - a[1]);
  const maxRizo = Math.max(...rizoEntries.map((e) => e[1]), 1);

  // Ordenar tratamientos por cantidad
  const tratEntries = Object.entries(tratDistrib).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTrat = Math.max(...tratEntries.map((e) => e[1]), 1);

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header title="Reportes" />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-nav">

        {/* Métricas clave */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Clientas', value: totalClientas, icon: <Users size={16} />, color: '#2D5A27' },
            { label: 'Consultas total', value: totalConsultas, icon: <CalendarDays size={16} />, color: '#C9956B' },
            { label: 'Este mes', value: thisMonth, icon: <TrendingUp size={16} />, color: '#22C55E' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#E5E5E5] p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
              <p className="text-2xl font-extrabold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {loading ? '—' : value}
              </p>
              <p className="text-[10px] text-[#999999]">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Consultas por mes ── */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-[#2D5A27]" />
            <h2 className="text-sm font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Consultas — últimos 6 meses
            </h2>
            <span className="ml-auto text-xs text-[#999999]">~{promMensual}/mes</span>
          </div>

          {loading ? (
            <div className="h-28 loading-pulse bg-[#F0F0F0] rounded-xl" />
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {last6.map((ym) => {
                const val = byMonth[ym] ?? 0;
                const heightPct = maxMonthVal > 0 ? (val / maxMonthVal) * 100 : 0;
                const isCurrentMonth = ym === last6[last6.length - 1];
                return (
                  <div key={ym} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-[#2D5A27]">{val > 0 ? val : ''}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-lg transition-all duration-700"
                        style={{
                          height: `${Math.max(heightPct, val > 0 ? 8 : 2)}%`,
                          backgroundColor: isCurrentMonth ? '#2D5A27' : '#90B98A',
                          minHeight: val > 0 ? 8 : 2,
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] text-[#999999] capitalize"
                      style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                    >
                      {monthLabel(ym)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Distribución por tipo de rizo ── */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 mb-4">
          <h2 className="text-sm font-bold text-[#2D2D2D] mb-4" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Tipos de cabello
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-6 loading-pulse bg-[#F0F0F0] rounded" />)}
            </div>
          ) : rizoEntries.length === 0 ? (
            <p className="text-sm text-[#999999] text-center py-4">Sin datos aún</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rizoEntries.map(([tipo, count]) => (
                <div key={tipo} className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold w-7 shrink-0"
                    style={{ color: RIZO_COLORS[tipo] ?? '#999999', fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    {tipo}
                  </span>
                  <Bar pct={(count / maxRizo) * 100} color={RIZO_COLORS[tipo] ?? '#999999'} />
                  <span className="text-xs text-[#666666] w-6 text-right shrink-0">{count}</span>
                </div>
              ))}

              {/* Resumen por grupo */}
              <div className="flex gap-3 mt-2 pt-3 border-t border-[#F0F0F0]">
                {['1', '2', '3', '4'].map((g) => {
                  const total = rizoEntries.filter(([t]) => t.startsWith(g)).reduce((s, [, c]) => s + c, 0);
                  const label = g === '1' ? 'Liso' : g === '2' ? 'Ondulado' : g === '3' ? 'Rizado' : 'Afro';
                  return (
                    <div key={g} className="flex-1 text-center">
                      <p className="text-lg font-extrabold" style={{ color: RIZO_GROUP_COLOR[g], fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                        {total}
                      </p>
                      <p className="text-[10px] text-[#999999]">{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Top tratamientos ── */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 mb-4">
          <h2 className="text-sm font-bold text-[#2D2D2D] mb-4" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Tratamientos más frecuentes
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-8 loading-pulse bg-[#F0F0F0] rounded" />)}
            </div>
          ) : tratEntries.length === 0 ? (
            <p className="text-sm text-[#999999] text-center py-4">Sin datos aún</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tratEntries.map(([trat, count], idx) => {
                const bg = getTratamientoBg(trat);
                const textColor = getTratamientoTextColor(trat);
                return (
                  <div key={trat} className="flex items-center gap-3 p-2 rounded-xl" style={{ backgroundColor: bg }}>
                    <span
                      className="text-base font-extrabold w-5 shrink-0"
                      style={{ color: textColor, fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-xs font-semibold truncate" style={{ color: textColor }}>
                      {trat}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Bar pct={(count / maxTrat) * 100} color={textColor} />
                      <span className="text-xs font-bold w-5 text-right" style={{ color: textColor }}>
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#CCCCCC] pb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
          Datos almacenados localmente en este dispositivo
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
