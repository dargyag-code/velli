'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import ClientaCard from '@/components/dashboard/ClientaCard';
import SearchBar from '@/components/dashboard/SearchBar';
import Button from '@/components/ui/Button';
import { getAllClientas } from '@/lib/db';
import { Clienta } from '@/lib/types';

type SortKey = 'nombre' | 'ultima' | 'visitas';
type FilterRizo = 'todas' | '2' | '3' | '4';

export default function ClientasPage() {
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('ultima');
  const [filterRizo, setFilterRizo] = useState<FilterRizo>('todas');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await getAllClientas();
      setClientas(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clientas
    .filter((c) => {
      if (search && !c.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRizo !== 'todas') {
        if (!c.tipoRizoPrincipal?.startsWith(filterRizo)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'nombre') return a.nombre.localeCompare(b.nombre);
      if (sort === 'ultima') {
        return (b.ultimaVisita || '') > (a.ultimaVisita || '') ? 1 : -1;
      }
      if (sort === 'visitas') return b.totalVisitas - a.totalVisitas;
      return 0;
    });

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-nav">

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Clientas
            {!loading && (
              <span className="ml-2 text-sm font-normal text-[#999999]">({clientas.length})</span>
            )}
          </h1>
          <Link href="/clientas/nueva">
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              Nueva clienta
            </Button>
          </Link>
        </div>

        {/* Search + filters */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-shrink-0 p-2.5 rounded-xl border-2 transition-colors ${
              showFilters || filterRizo !== 'todas' || sort !== 'ultima'
                ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                : 'border-[#E5E5E5] bg-white text-[#666666]'
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 mb-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-[#666666] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                Ordenar por:
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'ultima', label: 'Última visita' },
                  { key: 'nombre', label: 'Nombre A-Z' },
                  { key: 'visitas', label: 'Más visitas' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSort(key as SortKey)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      sort === key
                        ? 'bg-[#2D5A27] text-white'
                        : 'bg-[#F0F0F0] text-[#666666] hover:bg-[#EEF5ED] hover:text-[#2D5A27]'
                    }`}
                    style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#666666] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                Filtrar por tipo de cabello:
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'todas', label: 'Todas' },
                  { key: '1', label: 'Liso (1)' },
                  { key: '2', label: 'Ondulado (2)' },
                  { key: '3', label: 'Rizado (3)' },
                  { key: '4', label: 'Tipo 4' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilterRizo(key as FilterRizo)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      filterRizo === key
                        ? 'bg-[#C9956B] text-white'
                        : 'bg-[#F0F0F0] text-[#666666] hover:bg-[#FBF4EC] hover:text-[#C9956B]'
                    }`}
                    style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-16 loading-pulse border border-[#E5E5E5]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-[#EEF5ED] rounded-full mx-auto mb-4 flex items-center justify-center">
              <Users size={32} className="text-[#90B98A]" />
            </div>
            <p className="text-base font-bold text-[#666666]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              {search || filterRizo !== 'todas' ? 'Sin resultados' : 'Aún no tienes clientas'}
            </p>
            <p className="text-sm text-[#999999] mt-1 mb-5">
              {search || filterRizo !== 'todas'
                ? 'Prueba con otros filtros'
                : 'Comienza tu primera consulta'}
            </p>
            {!search && filterRizo === 'todas' && (
              <Link href="/diagnostico">
                <Button variant="primary" size="md" icon={<Plus size={16} />}>Nueva consulta</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((c) => <ClientaCard key={c.id} clienta={c} />)}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
