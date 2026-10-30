'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, Search, Filter, SlidersHorizontal, ChevronRight, Sparkles } from 'lucide-react';
import {
  BottomNavV2,
  Btn,
  Chip,
  AvatarV2,
  toneFromTipoRizo,
  SettingsIconButton,
} from '@/components/v2';
import { getAllClientas } from '@/lib/db';
import { Clienta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';

type SortKey = 'nombre' | 'ultima' | 'visitas';
type FilterRizo = 'todas' | '1' | '2' | '3' | '4';

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

  useEffect(() => {
    load();
  }, [load]);

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

  const counts = {
    todas: clientas.length,
    '1': clientas.filter((c) => c.tipoRizoPrincipal?.startsWith('1')).length,
    '2': clientas.filter((c) => c.tipoRizoPrincipal?.startsWith('2')).length,
    '3': clientas.filter((c) => c.tipoRizoPrincipal?.startsWith('3')).length,
    '4': clientas.filter((c) => c.tipoRizoPrincipal?.startsWith('4')).length,
  };

  const filterPills: { key: FilterRizo; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: counts.todas },
    { key: '1', label: 'Liso', count: counts['1'] },
    { key: '2', label: 'Ondulado', count: counts['2'] },
    { key: '3', label: 'Rizado', count: counts['3'] },
    { key: '4', label: 'Coily', count: counts['4'] },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#1C1518] relative">
      {/* Sticky header en Velvet Studio (#FAF7F5 / #EFE8E4 / #3B0D1E) */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '50px 16px 14px',
          background: 'rgba(250, 247, 245, 0.94)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid #EFE8E4',
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
            <div style={{ minWidth: 0 }}>
              <div className="v-caps" style={{ color: '#6E1E3A' }}>
                Directorio CRM · Retención BI
              </div>
              <h1
                style={{
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 28,
                  letterSpacing: '-0.02em',
                  color: '#1C1518',
                  lineHeight: 1.05,
                }}
              >
                Clientas{' '}
                {!loading && (
                  <em style={{ color: '#6E1E3A' }}>· {clientas.length}</em>
                )}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Link href="/clientas/nueva" className="no-underline">
                <Btn size="sm" variant="primary" icon={<Plus size={12} />}>
                  Nueva
                </Btn>
              </Link>
              <SettingsIconButton />
            </div>
          </div>

          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: '#FFFFFF',
              border: '1px solid #EFE8E4',
              borderRadius: 999,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <Search size={15} style={{ color: '#96888C', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clienta por nombre…"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: '#1C1518',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Filtros"
              style={{
                background: 'transparent',
                border: 'none',
                color: showFilters || sort !== 'ultima' ? '#3B0D1E' : '#96888C',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Filter size={13} />
              FILTROS
            </button>
          </div>

          {/* Filter pills */}
          <div
            className="v-noscroll"
            style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}
          >
            {filterPills.map((p) => {
              const active = filterRizo === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFilterRizo(p.key)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    background: active ? '#3B0D1E' : '#FFFFFF',
                    color: active ? '#FAF7F5' : '#6E6266',
                    border: active ? '1px solid #3B0D1E' : '1px solid #EFE8E4',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label} · {p.count}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Filter drawer */}
      {showFilters && (
        <section
          className="bg-white rounded-2xl border border-[#EFE8E4]"
          style={{
            margin: '14px 16px 0',
            padding: 14,
            maxWidth: 736,
            marginLeft: 'auto',
            marginRight: 'auto',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div className="v-caps" style={{ marginBottom: 8 }}>
            Ordenar por
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'ultima', label: 'Última visita' },
              { key: 'nombre', label: 'Nombre A-Z' },
              { key: 'visitas', label: 'Más visitas' },
            ].map(({ key, label }) => {
              const active = sort === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key as SortKey)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    background: active ? '#F7ECEF' : '#FAF7F5',
                    color: active ? '#3B0D1E' : '#6E6266',
                    border: `1px solid ${active ? '#DFC5CE' : '#EFE8E4'}`,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* List */}
      <main
        style={{
          maxWidth: 768,
          margin: '0 auto',
          padding: '16px 16px 120px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span className="v-num">
            {filtered.length} {filtered.length === 1 ? 'clienta' : 'clientas'}
            {sort === 'ultima'
              ? ' · ordenadas por última visita'
              : sort === 'nombre'
                ? ' · A-Z'
                : ' · más visitas'}
          </span>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#6E6266',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <SlidersHorizontal size={12} /> Ordenar
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 80 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: '#FFFFFF',
              borderRadius: 20,
              border: '1px solid #EFE8E4',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#F7ECEF',
                margin: '0 auto 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={24} style={{ color: '#3B0D1E' }} />
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                color: '#1C1518',
                letterSpacing: '-0.01em',
              }}
            >
              {search || filterRizo !== 'todas' ? 'Sin resultados' : 'Aún no tienes clientas registradas'}
            </p>
            <p
              style={{
                margin: '6px auto 16px',
                maxWidth: 320,
                fontSize: 12.5,
                color: '#6E6266',
                lineHeight: 1.5,
              }}
            >
              {search || filterRizo !== 'todas'
                ? 'Prueba ajustando tu búsqueda o cambiando el filtro activo.'
                : 'Cada clienta conserva sus cotizaciones, cierres en silla, diagnósticos y consentimientos digitales.'}
            </p>
            {!search && filterRizo === 'todas' && (
              <div className="flex flex-wrap justify-center gap-2.5">
                <Link href="/clientas/nueva" className="no-underline">
                  <Btn variant="primary" size="md" icon={<Plus size={14} />}>
                    Registrar clienta
                  </Btn>
                </Link>
                <Link href="/" className="no-underline">
                  <Btn variant="outline" size="md" icon={<Sparkles size={14} />}>
                    Ir a Cotizar
                  </Btn>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((c) => {
              const tone = toneFromTipoRizo(c.tipoRizoPrincipal);
              return (
                <Link
                  key={c.id}
                  href={`/clientas/${c.id}`}
                  className="stagger-item"
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <article
                    style={{
                      background: '#FFFFFF',
                      borderRadius: 18,
                      padding: 14,
                      boxShadow: 'var(--shadow-xs)',
                      border: '1px solid #EFE8E4',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <AvatarV2 nombre={c.nombre} tone={tone} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 8,
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-serif)',
                            fontSize: 16,
                            color: '#1C1518',
                            letterSpacing: '-0.005em',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.nombre}
                        </h3>
                        {c.ultimaVisita && (
                          <span className="v-num" style={{ fontSize: 9.5, flexShrink: 0 }}>
                            {formatDate(c.ultimaVisita)}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          marginTop: 5,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        {c.tipoRizoPrincipal && (
                          <Chip tone="ghost" style={{ padding: '2px 7px', fontSize: 9.5 }}>
                            {getRizoLabel(c.tipoRizoPrincipal)}
                          </Chip>
                        )}
                        {c.edad > 0 && (
                          <span style={{ fontSize: 11, color: '#96888C' }}>
                            · {c.edad} años
                          </span>
                        )}
                        {c.totalVisitas > 0 && (
                          <Chip
                            tone={c.totalVisitas >= 5 ? 'gold' : 'green'}
                            dot
                            style={{ marginLeft: 'auto', fontSize: 9.5 }}
                          >
                            {c.totalVisitas}× {c.totalVisitas === 1 ? 'visita' : 'visitas'}
                          </Chip>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={15} style={{ color: '#96888C', flexShrink: 0 }} />
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <BottomNavV2 />
    </div>
  );
}
