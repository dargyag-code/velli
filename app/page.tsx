'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, CalendarDays, TrendingUp, Clock, Plus, ChevronRight, Camera } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import StatCard from '@/components/dashboard/StatCard';
import ClientaCard from '@/components/dashboard/ClientaCard';
import SearchBar from '@/components/dashboard/SearchBar';
import Button from '@/components/ui/Button';
import {
  getAllClientas, getRecentClientas, getStatsThisMonth,
  getMostFrequentTratamiento, getNextCita,
  getClientasInactivas, getConsultasBorrador,
} from '@/lib/db';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [recentClientas, setRecentClientas] = useState<Clienta[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    nextCita: null as { nombre: string; fecha: string } | null,
    frecuente: '',
  });
  const [loading, setLoading] = useState(true);
  const [inactivas, setInactivas] = useState<Array<Clienta & { diasInactiva: number }>>([]);
  const [borradores, setBorradores] = useState<Array<{ consulta: Consulta; clienta: Clienta }>>([]);

  const loadData = useCallback(async () => {
    try {
      const [all, recent, month, frecuente, next, inact, borr] = await Promise.all([
        getAllClientas(),
        getRecentClientas(8),
        getStatsThisMonth(),
        getMostFrequentTratamiento(),
        getNextCita(),
        getClientasInactivas(45),
        getConsultasBorrador(),
      ]);
      setClientas(all);
      setRecentClientas(recent);
      setStats({ total: all.length, thisMonth: month, nextCita: next, frecuente });
      setInactivas(inact.slice(0, 3));
      setBorradores(borr.slice(0, 3));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const searchResults = search
    ? clientas.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()))
    : [];

  const displayClientas = search ? searchResults : recentClientas;

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-nav">

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-shimmer h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard title="Clientas" value={stats.total} icon={<Users size={20} />} color="green" />
            <StatCard title="Consultas este mes" value={stats.thisMonth} icon={<TrendingUp size={20} />} color="gold" />
            <StatCard
              title="Próxima cita"
              value={stats.nextCita ? formatDate(stats.nextCita.fecha) : '—'}
              icon={<CalendarDays size={20} />}
              color="blue"
              subtitle={stats.nextCita?.nombre}
            />
            <StatCard
              title="Tratamiento frecuente"
              value={stats.frecuente === 'Sin datos' ? '—' : stats.frecuente.split(' ')[0]}
              icon={<Clock size={20} />}
              color="purple"
            />
          </div>
        )}

        {/* Hero CTA */}
        <Link href="/diagnostico" className="block mb-5">
          <div
            className="cursor-pointer active:scale-[0.98] transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
              borderRadius: 20,
              padding: '20px 24px',
              boxShadow: '0 8px 32px rgba(45,90,39,0.40)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold text-[#A8D0A3] uppercase tracking-wider"
                    style={serif}
                  >
                    Diagnóstico IA
                  </span>
                </div>
                <p className="text-white text-xl font-bold leading-tight mb-1" style={serif}>
                  Nueva consulta
                </p>
                <p className="text-[#A8D0A3] text-xs">
                  Plan personalizado en minutos
                </p>
              </div>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <Plus size={32} className="text-white animate-pulse-soft" strokeWidth={2} />
              </div>
            </div>

            {/* Badge row */}
            <div className="flex gap-2 mt-3">
              {['✨ Cámara IA', '📋 Manual', '🚀 Express'].map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#D4EACE' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Link>

        {/* Camera IA hero */}
        <Link href="/diagnostico?mode=camera" className="block mb-3">
          <div
            className="flex items-center gap-4 active:scale-[0.98] transition-all duration-200 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: '0 4px 16px rgba(26,46,26,0.28)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Camera size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-base font-bold leading-tight" style={serif}>
                Escanear cabello con IA
              </p>
              <p className="text-[#A8D0A3] text-xs mt-0.5">
                Análisis automático en segundos
              </p>
            </div>
            <span
              className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#FFD700' }}
            >
              ✨ Rápido
            </span>
          </div>
        </Link>

        {/* Alertas inteligentes */}
        {!loading && (inactivas.length > 0 || borradores.length > 0) && (
          <div className="mb-5">
            <h2 className="text-sm font-bold text-[#1A2E1A] mb-2" style={serif}>Atención</h2>
            <div className="flex flex-col gap-2">
              {inactivas.map((c) => {
                const tel = c.telefono?.replace(/\D/g, '');
                const msg = encodeURIComponent(`Hola ${c.nombre}! 🌿 Han pasado ${c.diasInactiva} días desde tu última visita en Velli Pro. ¿Agendamos tu próxima consulta?`);
                return (
                  <div key={c.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-800 truncate" style={serif}>{c.nombre}</p>
                      <p className="text-[10px] text-amber-600">No viene hace {c.diasInactiva} días</p>
                    </div>
                    {tel && (
                      <a
                        href={`https://wa.me/${tel}?text=${msg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 bg-amber-600 text-white rounded-xl active:scale-95 transition-transform"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                );
              })}
              {borradores.map(({ consulta, clienta: c }) => (
                <div key={consulta.id} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                  <span className="text-base flex-shrink-0">📝</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-800 truncate" style={serif}>{c.nombre}</p>
                    <p className="text-[10px] text-blue-600">Diagnóstico borrador pendiente</p>
                  </div>
                  <Link
                    href={`/clientas/${c.id}`}
                    className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 bg-blue-600 text-white rounded-xl active:scale-95 transition-transform"
                  >
                    Completar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} />

        {/* Clientas */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#1A2E1A]" style={serif}>
              {search ? `Resultados (${searchResults.length})` : 'Clientas recientes'}
            </h2>
            {!search && (
              <Link
                href="/clientas"
                className="text-xs text-[#2D5A27] font-semibold flex items-center gap-1 hover:underline"
              >
                Ver todas <ChevronRight size={13} />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-shimmer h-16" />
              ))}
            </div>
          ) : displayClientas.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-[#EEF5ED] rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users size={32} className="text-[#90B98A]" />
              </div>
              <p className="text-base font-bold text-[#666666] mb-1" style={serif}>
                {search ? 'Sin resultados' : 'Aún no tienes clientas'}
              </p>
              <p className="text-sm text-[#999999] mb-5">
                {search ? `No se encontró "${search}"` : '¡Comienza tu primera consulta!'}
              </p>
              {!search && (
                <Link href="/diagnostico">
                  <Button variant="primary" size="md" icon={<Plus size={16} />}>Primera consulta</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {displayClientas.map((c) => <ClientaCard key={c.id} clienta={c} />)}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
