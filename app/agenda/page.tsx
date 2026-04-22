'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus, Clock, ChevronRight, CalendarX } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Avatar from '@/components/ui/Avatar';
import { getUpcomingCitas, getPastCitas } from '@/lib/db';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';

interface CitaPair {
  consulta: Consulta;
  clienta: Clienta;
}

// Días hasta la fecha
function diasRestantes(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function BadgeDias({ fecha }: { fecha: string }) {
  const dias = diasRestantes(fecha);
  if (dias === 0) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2D5A27] text-white">Hoy</span>
  );
  if (dias === 1) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C9956B] text-white">Mañana</span>
  );
  if (dias <= 7) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">En {dias} días</span>
  );
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#666666]">En {dias} días</span>
  );
}

function CitaCard({ pair, isPast = false }: { pair: CitaPair; isPast?: boolean }) {
  const { consulta, clienta } = pair;
  return (
    <Link href={`/clientas/${clienta.id}`}>
      <div className={`bg-white rounded-2xl border p-4 flex items-center gap-3 transition-all active:scale-[0.98] ${
        isPast ? 'border-[#E5E5E5] opacity-60' : 'border-[#E5E5E5] hover:border-[#90B98A] hover:shadow-sm'
      }`}>
        <Avatar nombre={clienta.nombre} tipoRizo={clienta.tipoRizoPrincipal} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-[#2D2D2D] truncate" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            {clienta.nombre}
          </p>
          <p className="text-xs text-[#666666] truncate">
            {clienta.tipoRizoPrincipal ? getRizoLabel(clienta.tipoRizoPrincipal) : 'Sin tipo de cabello'}
            {consulta.resultado?.tratamientoPrincipal && ` · ${consulta.resultado.tratamientoPrincipal.split(' ').slice(0, 2).join(' ')}`}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Clock size={11} className="text-[#999999]" />
            <span className="text-[11px] text-[#999999]">{formatDate(consulta.proximaCita!)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isPast && <BadgeDias fecha={consulta.proximaCita!} />}
          {isPast && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#999999]">Pasada</span>}
          <ChevronRight size={14} className="text-[#CCCCCC]" />
        </div>
      </div>
    </Link>
  );
}

// Agrupar por semana/mes para section headers
function getMesLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export default function AgendaPage() {
  const [upcoming, setUpcoming] = useState<CitaPair[]>([]);
  const [past, setPast] = useState<CitaPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

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

  // Agrupar próximas citas por mes
  const upcomingByMonth: Record<string, CitaPair[]> = {};
  for (const pair of upcoming) {
    const key = getMesLabel(pair.consulta.proximaCita!);
    if (!upcomingByMonth[key]) upcomingByMonth[key] = [];
    upcomingByMonth[key].push(pair);
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header title="Agenda" />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-nav">

        {/* Stat chips */}
        {!loading && (
          <div className="flex gap-2 mb-5">
            <div className="flex-1 bg-[#EEF5ED] rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#2D5A27]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {upcoming.length}
              </p>
              <p className="text-xs text-[#7A9B76]">Próximas citas</p>
            </div>
            <div className="flex-1 bg-[#FBF4EC] rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#C9956B]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {upcoming.filter((p) => diasRestantes(p.consulta.proximaCita!) <= 7).length}
              </p>
              <p className="text-xs text-[#B89040]">Esta semana</p>
            </div>
          </div>
        )}

        {/* CTA nueva consulta */}
        <Link href="/diagnostico">
          <div className="flex items-center gap-3 bg-white border-2 border-dashed border-[#90B98A] rounded-2xl p-4 mb-5 hover:bg-[#F0F5EF] transition-colors">
            <div className="w-9 h-9 rounded-xl bg-[#2D5A27] flex items-center justify-center shrink-0">
              <Plus size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2D5A27]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                Agendar nueva consulta
              </p>
              <p className="text-xs text-[#7A9B76]">La fecha se asigna al finalizar el diagnóstico</p>
            </div>
          </div>
        </Link>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-20 loading-pulse border border-[#E5E5E5]" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-14">
            <div
              className="w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #EEF5ED 0%, #FBF4EC 100%)' }}
            >
              <CalendarX size={40} className="text-[#2D5A27]" />
            </div>
            <p className="text-lg font-bold text-[#2D5A27] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Agenda en calma
            </p>
            <p className="text-sm text-[#666666] mb-5 max-w-xs mx-auto leading-relaxed">
              Aquí aparecerán tus próximas citas. Se agendan al finalizar cada diagnóstico.
            </p>
            <Link href="/diagnostico">
              <button
                className="px-6 py-3 rounded-2xl text-white text-sm font-bold flex items-center gap-2 mx-auto"
                style={{
                  background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
                  boxShadow: '0 6px 20px rgba(45,90,39,0.28)',
                  fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                }}
              >
                <Plus size={16} />
                Nueva consulta
              </button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(upcomingByMonth).map(([mes, pairs]) => (
              <div key={mes}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays size={14} className="text-[#2D5A27]" />
                  <h2 className="text-xs font-bold text-[#2D5A27] uppercase tracking-widest capitalize" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                    {mes}
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {pairs.map((pair) => (
                    <CitaCard key={`${pair.consulta.id}`} pair={pair} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Citas pasadas (colapsable) */}
        {past.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowPast((v) => !v)}
              className="flex items-center gap-2 text-xs text-[#999999] font-semibold mb-3 hover:text-[#666666]"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              <ChevronRight
                size={14}
                className={`transition-transform duration-200 ${showPast ? 'rotate-90' : ''}`}
              />
              Historial de citas anteriores ({past.length})
            </button>
            {showPast && (
              <div className="flex flex-col gap-2">
                {past.map((pair) => (
                  <CitaCard key={pair.consulta.id} pair={pair} isPast />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
