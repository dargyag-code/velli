'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, CalendarDays, TrendingUp, Clock, Plus, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import StatCard from '@/components/dashboard/StatCard';
import ClientaCard from '@/components/dashboard/ClientaCard';
import SearchBar from '@/components/dashboard/SearchBar';
import Button from '@/components/ui/Button';
import {
  getAllClientas, getRecentClientas, getStatsThisMonth,
  getMostFrequentTratamiento, getNextCita,
} from '@/lib/db';
import { Clienta } from '@/lib/types';
import { formatDate } from '@/lib/utils';

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

  const loadData = useCallback(async () => {
    try {
      const [all, recent, month, frecuente, next] = await Promise.all([
        getAllClientas(),
        getRecentClientas(8),
        getStatsThisMonth(),
        getMostFrequentTratamiento(),
        getNextCita(),
      ]);
      setClientas(all);
      setRecentClientas(recent);
      setStats({ total: all.length, thisMonth: month, nextCita: next, frecuente });
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
              <div key={i} className="bg-white rounded-2xl h-24 loading-pulse border border-[#E5E5E5]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard title="Clientas" value={stats.total} icon={<Users size={18} />} color="purple" />
            <StatCard title="Consultas este mes" value={stats.thisMonth} icon={<TrendingUp size={18} />} color="gold" />
            <StatCard
              title="Próxima cita"
              value={stats.nextCita ? formatDate(stats.nextCita.fecha) : '—'}
              icon={<CalendarDays size={18} />}
              color="green"
              subtitle={stats.nextCita?.nombre}
            />
            <StatCard
              title="Tratamiento frecuente"
              value={stats.frecuente === 'Sin datos' ? '—' : stats.frecuente.split(' ')[0]}
              icon={<Clock size={18} />}
              color="blue"
            />
          </div>
        )}

        {/* CTA */}
        <Link href="/diagnostico">
          <div className="bg-gradient-to-r from-[#2D5A27] to-[#3D7A35] rounded-3xl p-5 mb-5 cursor-pointer hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-base font-bold mb-0.5" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  Nueva consulta
                </p>
                <p className="text-[#B8D4B5] text-xs">Diagnóstico completo + plan personalizado</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Plus size={24} className="text-white" />
              </div>
            </div>
          </div>
        </Link>

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} />

        {/* Clientas */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              {search ? `Resultados (${searchResults.length})` : 'Clientas recientes'}
            </h2>
            {!search && (
              <Link href="/clientas" className="text-xs text-[#2D5A27] font-semibold hover:underline flex items-center gap-1">
                Ver todas <ChevronRight size={14} />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl h-16 loading-pulse border border-[#E5E5E5]" />
              ))}
            </div>
          ) : displayClientas.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-[#EEF5ED] rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users size={32} className="text-[#90B98A]" />
              </div>
              <p className="text-base font-bold text-[#666666] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
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
