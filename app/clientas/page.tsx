'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  MessageCircle,
  Check,
  Clock,
} from 'lucide-react';
import {
  VelvetTopHeader,
  Btn,
  AvatarV2,
  toneFromTipoRizo,
  SettingsIconButton,
} from '@/components/v2';
import {
  armarEnlaceReactivacionWhatsApp,
  segmentarClientasPorReactivar,
  type ClientaPorReactivar,
  type TramoInactividadDias,
} from '@/lib/clientas/reactivacion';
import { getAllClientas, registrarContactoReactivacion } from '@/lib/db';
import { getProfile } from '@/lib/profile';
import { showToast } from '@/lib/toast';
import { Clienta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';
import { obtenerOrganizacionActivaPanel } from '@/lib/vitrina';

type SortKey = 'nombre' | 'ultima' | 'visitas';
type FilterRizo = 'todas' | '1' | '2' | '3' | '4';
type TabCRM = 'directorio' | 'reactivar';

export default function ClientasPage() {
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabCrm, setTabCrm] = useState<TabCRM>('directorio');
  const [umbralDias, setUmbralDias] = useState<TramoInactividadDias>(30);
  const [salonNombre, setSalonNombre] = useState<string>('Tu Salón');
  const [vitrinaSlug, setVitrinaSlug] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('ultima');
  const [filterRizo, setFilterRizo] = useState<FilterRizo>('todas');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, prof, org] = await Promise.all([
        getAllClientas(),
        getProfile().catch(() => null),
        obtenerOrganizacionActivaPanel().catch(() => null),
      ]);
      setClientas(all);
      if (org?.name) {
        setSalonNombre(org.name);
        setVitrinaSlug(org.slug);
      } else if (prof?.nombreSalon?.trim()) {
        setSalonNombre(prof.nombreSalon.trim());
      } else if (prof?.nombre?.trim()) {
        setSalonNombre(prof.nombre.trim());
      }
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

  // Segmentación automática del Motor de Reactivación (30 / 45 / 60+ días)
  const todasInactivas30 = useMemo(
    () => segmentarClientasPorReactivar(clientas, { umbralMinimoDias: 30 }),
    [clientas]
  );

  const conteosReactivacion = useMemo(
    () => ({
      30: todasInactivas30.length,
      45: todasInactivas30.filter((item) => item.diasInactiva >= 45).length,
      60: todasInactivas30.filter((item) => item.diasInactiva >= 60).length,
      pendientesHoy: todasInactivas30.filter((item) => !item.contactadaEstaSemana).length,
    }),
    [todasInactivas30]
  );

  const listaReactivacion = useMemo(
    () =>
      todasInactivas30.filter((item) => {
        if (item.diasInactiva < umbralDias) return false;
        if (
          search &&
          !item.clienta.nombre.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [todasInactivas30, umbralDias, search]
  );

  const enviarMensajeReactivacion = async (item: ClientaPorReactivar) => {
    if (item.contactadaEstaSemana) {
      showToast('Ya escribiste a esta clienta durante los últimos 7 días', 'info');
      return;
    }

    const { whatsappUrl } = armarEnlaceReactivacionWhatsApp({
      clienta: item.clienta,
      salonNombre,
      diasInactiva: item.diasInactiva,
      vitrinaSlug,
    });

    if (!whatsappUrl) {
      showToast('Esta clienta no tiene un número de WhatsApp válido', 'error');
      return;
    }

    const iso = await registrarContactoReactivacion(item.clienta.id);
    setClientas((prev) =>
      prev.map((c) =>
        c.id === item.clienta.id ? { ...c, lastReactivationContactAt: iso } : c
      )
    );

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    showToast(`Mensaje de reactivación preparado para ${item.clienta.nombre}`, 'success');
  };

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
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans relative pb-24 lg:pb-12">
      <VelvetTopHeader />

      {/* Sub-header CRM */}
      <div className="border-b border-[#EFE8E4] pt-6 pb-4 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div className="min-w-0">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                Directorio CRM · Retención BI
              </span>
              <h1 className="m-0 mt-0.5 font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#3B0D1E] leading-tight">
                Clientas{' '}
                {!loading && (
                  <span className="text-[#6B535C] font-normal tabular-nums">
                    · {clientas.length}
                  </span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/clientas/nueva" className="no-underline">
                <Btn size="md" variant="primary" icon={<Plus size={14} />}>
                  Nueva
                </Btn>
              </Link>
              <SettingsIconButton />
            </div>
          </div>

          {/* Selector de Pestañas: Directorio / Por reactivar */}
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F5EBE8] border border-[#EFE8E4] mb-3.5">
            <button
              type="button"
              onClick={() => setTabCrm('directorio')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl font-sans text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-none transition-all ${
                tabCrm === 'directorio'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5]'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
            >
              <Users size={14} />
              <span>Directorio ({clientas.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabCrm('reactivar')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl font-sans text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-none transition-all ${
                tabCrm === 'reactivar'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5]'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
            >
              <Clock size={14} />
              <span>Por reactivar</span>
              {!loading && conteosReactivacion.pendientesHoy > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold tabular-nums ${
                    tabCrm === 'reactivar'
                      ? 'bg-[#D97757] text-white'
                      : 'bg-[#FFF7F5] text-[#D97757] border border-[#D97757]/30'
                  }`}
                >
                  {conteosReactivacion.pendientesHoy}
                </span>
              )}
            </button>
          </div>

          {/* Search bar */}
          <div className="min-h-[48px] flex items-center gap-2.5 px-4 bg-white border border-[#EFE8E4] rounded-2xl shadow-velvet">
            <Search size={16} className="text-[#947C85] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clienta por nombre…"
              className="flex-1 min-w-0 py-2 border-none bg-transparent outline-none text-sm font-sans text-[#3B0D1E] placeholder-[#947C85]"
            />
            {tabCrm === 'directorio' && (
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-label="Filtros"
                className={`min-h-[38px] px-3 rounded-xl border-none flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
                  showFilters || sort !== 'ultima'
                    ? 'bg-[#F5EBE8] text-[#3B0D1E]'
                    : 'bg-transparent text-[#6B535C] hover:bg-[#FAF7F5] hover:text-[#3B0D1E]'
                }`}
              >
                <Filter size={13} />
                Filtros
              </button>
            )}
          </div>

          {tabCrm === 'directorio' ? (
            <div className="v-noscroll flex gap-2 mt-3 overflow-x-auto pb-1">
              {filterPills.map((p) => {
                const active = filterRizo === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setFilterRizo(p.key)}
                    className={`min-h-[44px] shrink-0 px-4 py-2 rounded-xl text-xs font-bold tabular-nums border transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]'
                        : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8] hover:text-[#3B0D1E]'
                    }`}
                  >
                    {p.label}{' '}
                    <span className={active ? 'text-[#E8CFC8]' : 'text-[#947C85]'}>
                      · {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="v-noscroll flex gap-2 mt-3 overflow-x-auto pb-1">
              {(
                [
                  { dias: 30 as const, label: '30+ días sin visita', count: conteosReactivacion[30] },
                  { dias: 45 as const, label: '45+ días', count: conteosReactivacion[45] },
                  { dias: 60 as const, label: '60+ días (prioridad)', count: conteosReactivacion[60] },
                ]
              ).map((t) => {
                const activo = umbralDias === t.dias;
                return (
                  <button
                    key={t.dias}
                    type="button"
                    onClick={() => setUmbralDias(t.dias)}
                    className={`min-h-[42px] shrink-0 px-4 py-2 rounded-xl text-xs font-bold tabular-nums border transition-all whitespace-nowrap cursor-pointer ${
                      activo
                        ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]'
                        : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8] hover:text-[#3B0D1E]'
                    }`}
                  >
                    {t.label}{' '}
                    <span className={activo ? 'text-[#E8CFC8]' : 'text-[#947C85]'}>
                      · {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filter drawer */}
      {tabCrm === 'directorio' && showFilters && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3.5">
          <section className="bg-white rounded-2xl border border-[#EFE8E4] p-4 shadow-velvet">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block mb-2.5">
              Ordenar directorio por
            </span>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'ultima', label: 'Última visita' },
                { key: 'nombre', label: 'Nombre A–Z' },
                { key: 'visitas', label: 'Más visitas' },
              ].map(({ key, label }) => {
                const active = sort === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key as SortKey)}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#F5EBE8] text-[#3B0D1E] border-[#E8CFC8]'
                        : 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4] hover:border-[#E8CFC8] hover:text-[#3B0D1E]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
        {tabCrm === 'reactivar' ? (
          loading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer h-24 rounded-3xl" />
              ))}
            </div>
          ) : listaReactivacion.length === 0 ? (
            <section className="text-center py-12 px-5 bg-white rounded-3xl border border-[#EFE8E4] shadow-velvet">
              <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/25 mx-auto mb-3.5 flex items-center justify-center text-[#0D9488]">
                <Check size={24} />
              </div>
              <h2 className="m-0 font-display text-xl font-semibold text-[#3B0D1E]">
                Sin clientas inactivas en el tramo de {umbralDias}+ días
              </h2>
              <p className="mt-1.5 mb-0 max-w-sm mx-auto text-xs text-[#6B535C] leading-relaxed">
                Tus clientas habituales están al día con su frecuencia de visita en este segmento.
              </p>
            </section>
          ) : (
            <div className="space-y-3">
              {listaReactivacion.map((item) => {
                const { clienta: c, diasInactiva, tramo, contactadaEstaSemana, tieneTelefonoValido } =
                  item;
                const tone = toneFromTipoRizo(c.tipoRizoPrincipal);

                return (
                  <article
                    key={c.id}
                    className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-velvet flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <AvatarV2 nombre={c.nombre} tone={tone} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/clientas/${c.id}`}
                            className="font-sans text-base font-bold text-[#3B0D1E] hover:underline no-underline truncate"
                          >
                            {c.nombre}
                          </Link>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold tabular-nums border ${
                              tramo === 60
                                ? 'bg-[#FFF7F5] text-[#D97757] border-[#D97757]/35'
                                : tramo === 45
                                  ? 'bg-[#F5EBE8] text-[#52142B] border-[#E8CFC8]'
                                  : 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4]'
                            }`}
                          >
                            Hace {diasInactiva} días
                          </span>
                        </div>

                        <p className="m-0 mt-1 text-xs text-[#6B535C] tabular-nums">
                          Última visita: {c.ultimaVisita ? formatDate(c.ultimaVisita) : '—'}
                          {c.totalVisitas > 0 ? ` · ${c.totalVisitas} visitas` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {contactadaEstaSemana ? (
                        <span className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/25 text-[#0D9488] font-sans text-xs font-bold inline-flex items-center gap-1.5">
                          <Check size={14} />
                          <span>Contactada esta semana</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!tieneTelefonoValido}
                          onClick={() => enviarMensajeReactivacion(item)}
                          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none"
                        >
                          <MessageCircle size={15} />
                          <span>Reactivar por WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <>
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-xs font-semibold text-[#947C85] tabular-nums">
                {filtered.length} {filtered.length === 1 ? 'clienta' : 'clientas'}
                {sort === 'ultima'
                  ? ' · ordenadas por última visita'
                  : sort === 'nombre'
                    ? ' · A–Z'
                    : ' · más visitas'}
              </span>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="min-h-[38px] px-2.5 rounded-lg bg-transparent border-none flex items-center gap-1.5 text-[#6B535C] hover:text-[#3B0D1E] text-xs font-bold cursor-pointer"
              >
                <SlidersHorizontal size={13} /> Ordenar
              </button>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-shimmer h-20 rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-5 bg-white rounded-3xl border border-[#EFE8E4] shadow-velvet">
                <div className="w-14 h-14 rounded-2xl bg-[#F5EBE8] border border-[#E8CFC8] mx-auto mb-3.5 flex items-center justify-center">
                  <Users size={24} className="text-[#3B0D1E]" />
                </div>
                <h2 className="m-0 font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E]">
                  {search || filterRizo !== 'todas'
                    ? 'Sin resultados para este filtro'
                    : 'Aún no tienes clientas registradas'}
                </h2>
                <p className="mt-1.5 mb-5 max-w-sm mx-auto text-xs text-[#6B535C] leading-relaxed">
                  {search || filterRizo !== 'todas'
                    ? 'Prueba ajustando el nombre buscado o seleccionando otra textura capilar.'
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
              <div className="space-y-2.5">
                {filtered.map((c) => {
                  const tone = toneFromTipoRizo(c.tipoRizoPrincipal);
                  return (
                    <Link
                      key={c.id}
                      href={`/clientas/${c.id}`}
                      className="stagger-item block no-underline"
                    >
                      <article className="bg-white rounded-3xl p-4 border border-[#EFE8E4] hover:border-[#E8CFC8] shadow-velvet transition-all flex items-center gap-3.5">
                        <AvatarV2 nombre={c.nombre} tone={tone} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline gap-2">
                            <h3 className="m-0 font-sans text-base font-bold tracking-tight text-[#3B0D1E] truncate">
                              {c.nombre}
                            </h3>
                            {c.ultimaVisita && (
                              <span className="font-mono text-[11px] font-semibold text-[#947C85] tabular-nums shrink-0">
                                {formatDate(c.ultimaVisita)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {c.tipoRizoPrincipal && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#F5EBE8] border border-[#E8CFC8] text-[#3B0D1E] text-[11px] font-bold">
                                {getRizoLabel(c.tipoRizoPrincipal)}
                              </span>
                            )}
                            {c.edad > 0 && (
                              <span className="text-xs text-[#6B535C] tabular-nums">
                                · {c.edad} años
                              </span>
                            )}
                            {c.totalVisitas > 0 && (
                              <span
                                className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums border ${
                                  c.totalVisitas >= 5
                                    ? 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/25'
                                    : 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4]'
                                }`}
                              >
                                {c.totalVisitas}× {c.totalVisitas === 1 ? 'visita' : 'visitas'}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={17} className="text-[#947C85] shrink-0" />
                      </article>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
