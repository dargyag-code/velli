'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  FlaskConical,
  UserCheck,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  Award,
  Settings,
  ArrowUpRight,
  MessageCircle,
  Copy,
} from 'lucide-react';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
import { getProfile } from '@/lib/profile';
import { enlaceWhatsApp } from '@/lib/whatsapp';
import { showToast } from '@/lib/toast';
import {
  listarCotizacionesSalon,
  listarEstilistas,
  formatearPrecioCop,
  type Cotizacion,
  type EstilistaSalon,
} from '@/lib/cotizador';

type PeriodoFiltro = 'semana' | 'mes_actual' | 'treinta_dias' | 'todo';

const OPCIONES_PERIODO: Array<{ key: PeriodoFiltro; label: string }> = [
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes_actual', label: 'Este mes' },
  { key: 'treinta_dias', label: '30 días' },
  { key: 'todo', label: 'Todo' },
];

function fechaLimitePeriodo(periodo: PeriodoFiltro): Date | null {
  const ahora = new Date();
  if (periodo === 'todo') return null;
  if (periodo === 'semana') {
    return new Date(ahora.getTime() - 7 * 86_400_000);
  }
  if (periodo === 'treinta_dias') {
    return new Date(ahora.getTime() - 30 * 86_400_000);
  }
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
}

interface ResumenEspecialista {
  clave: string;
  nombre: string;
  serviciosCerrados: number;
  totalFacturado: number;
  quimicaUtilizada: number;
  comisionPagar: number;
  utilidadSalon: number;
  margenPct: number;
}

interface ResumenServicio {
  servicioNombre: string;
  serviciosCerrados: number;
  totalFacturado: number;
  quimicaUtilizada: number;
  comisionTotal: number;
  utilidadNetaTotal: number;
  utilidadPromedioPorServicio: number;
  margenPct: number;
  gramosTeoricos: number;
  gramosReales: number;
}

export default function ReportesBIPage() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes_actual');
  const [cargando, setCargando] = useState(true);
  const [nombreSalon, setNombreSalon] = useState('Tu Salón');
  const [ciudadSalon, setCiudadSalon] = useState('Colombia');
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [estilistasMap, setEstilistasMap] = useState<Record<string, string>>({});

  const cargarDashboard = useCallback(async () => {
    setCargando(true);
    try {
      const [prof, cots, ests] = await Promise.all([
        getProfile().catch(() => null),
        listarCotizacionesSalon({ estados: ['cobrada', 'enviada'] }).catch(
          () => [] as Cotizacion[]
        ),
        listarEstilistas({ soloActivas: false }).catch(() => [] as EstilistaSalon[]),
      ]);

      if (prof?.nombreSalon?.trim()) {
        setNombreSalon(prof.nombreSalon.trim());
      } else if (prof?.nombre?.trim()) {
        setNombreSalon(prof.nombre.trim());
      }
      if (prof?.ciudad?.trim()) {
        setCiudadSalon(prof.ciudad.trim());
      }

      const mapaEst: Record<string, string> = {};
      for (const e of ests) mapaEst[e.id] = e.nombre;
      setEstilistasMap(mapaEst);
      setCotizaciones(cots);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();
  }, [cargarDashboard]);

  // ── Filtrado por periodo ─────────────────────────────────────────────
  const { cobradasPeriodo, enviadasPendientes } = useMemo(() => {
    const desde = fechaLimitePeriodo(periodo);
    const cobradas: Cotizacion[] = [];
    const enviadas: Cotizacion[] = [];

    for (const c of cotizaciones) {
      if (c.estado === 'enviada') {
        enviadas.push(c);
        continue;
      }
      if (c.estado === 'cobrada') {
        if (!desde) {
          cobradas.push(c);
        } else {
          const refIso = c.cobradoAt || c.createdAt;
          const f = new Date(refIso);
          if (!Number.isNaN(f.getTime()) && f >= desde) {
            cobradas.push(c);
          }
        }
      }
    }

    return { cobradasPeriodo: cobradas, enviadasPendientes: enviadas };
  }, [cotizaciones, periodo]);

  // ── Agregados Ejecutivos y KPIs ──────────────────────────────────────
  const kpis = useMemo(() => {
    let ingresosCobrados = 0;
    let totalCotizadoEnCerrados = 0;
    let inversionQuimica = 0;
    let comisionesEspecialistas = 0;
    let gramosTeoricosTotales = 0;
    let gramosRealesTotales = 0;

    for (const c of cobradasPeriodo) {
      const cobrado = c.precioCobrado ?? c.precioCotizado;
      const quimica = c.costoProductoEstimado ?? 0;
      const comision = c.comisionEstimada ?? 0;
      ingresosCobrados += cobrado;
      totalCotizadoEnCerrados += c.precioCotizado;
      inversionQuimica += quimica;
      comisionesEspecialistas += comision;

      const realesCot =
        typeof c.formula?.['gramosTinte'] === 'number'
          ? (c.formula['gramosTinte'] as number)
          : typeof c.costoDetalle?.gramosTinte === 'number'
            ? c.costoDetalle.gramosTinte
            : 0;

      const teoricosCot =
        typeof c.formula?.['gramosTeoricos'] === 'number'
          ? (c.formula['gramosTeoricos'] as number)
          : c.costoDetalle && c.costoDetalle.gramosBase > 0
            ? c.costoDetalle.gramosBase * (c.costoDetalle.factores?.total || 1)
            : realesCot;

      gramosRealesTotales += realesCot;
      gramosTeoricosTotales += teoricosCot;
    }

    const costoQuimicoMasNomina = inversionQuimica + comisionesEspecialistas;
    const utilidadNetaSalon = ingresosCobrados - costoQuimicoMasNomina;
    const margenPromedioPct =
      ingresosCobrados > 0
        ? Math.round((utilidadNetaSalon / ingresosCobrados) * 100)
        : 0;
    const pctQuimicaSobreVentas =
      ingresosCobrados > 0
        ? Math.round((inversionQuimica / ingresosCobrados) * 1000) / 10
        : 0;

    const ajusteNetoEnSilla = ingresosCobrados - totalCotizadoEnCerrados;
    const montoPorCobrar = enviadasPendientes.reduce(
      (acc, c) => acc + c.precioCotizado,
      0
    );

    const gTeoricos = Math.round(gramosTeoricosTotales);
    const gReales = Math.round(gramosRealesTotales);
    const desvioGramos = gReales - gTeoricos;

    return {
      ingresosCobrados,
      inversionQuimica,
      comisionesEspecialistas,
      costoQuimicoMasNomina,
      utilidadNetaSalon,
      margenPromedioPct,
      esOptimo: cobradasPeriodo.length === 0 || margenPromedioPct >= 30,
      pctQuimicaSobreVentas,
      gramosTeoricosTotales: gTeoricos,
      gramosRealesTotales: gReales,
      desvioGramos,
      ajusteNetoEnSilla,
      cantidadCerrados: cobradasPeriodo.length,
      cantidadPorCobrar: enviadasPendientes.length,
      montoPorCobrar,
    };
  }, [cobradasPeriodo, enviadasPendientes]);

  // ── Tarjetas de Liquidación por Especialista ─────────────────────────
  const liquidacionEspecialistas = useMemo((): ResumenEspecialista[] => {
    const grupos = new Map<string, Omit<ResumenEspecialista, 'margenPct'>>();

    for (const c of cobradasPeriodo) {
      const nombreResuelto =
        (c.estilistaId ? estilistasMap[c.estilistaId] : undefined) ||
        c.estilistaNombre?.trim() ||
        'Titular del salón';
      const clave = c.estilistaId || `nombre:${nombreResuelto.toLowerCase()}`;

      const cobrado = c.precioCobrado ?? c.precioCotizado;
      const quimica = c.costoProductoEstimado ?? 0;
      const comision = c.comisionEstimada ?? 0;
      const utilidad = cobrado - quimica - comision;

      const actual = grupos.get(clave) ?? {
        clave,
        nombre: nombreResuelto,
        serviciosCerrados: 0,
        totalFacturado: 0,
        quimicaUtilizada: 0,
        comisionPagar: 0,
        utilidadSalon: 0,
      };

      actual.serviciosCerrados += 1;
      actual.totalFacturado += cobrado;
      actual.quimicaUtilizada += quimica;
      actual.comisionPagar += comision;
      actual.utilidadSalon += utilidad;
      grupos.set(clave, actual);
    }

    return Array.from(grupos.values())
      .map((g) => ({
        ...g,
        margenPct:
          g.totalFacturado > 0
            ? Math.round((g.utilidadSalon / g.totalFacturado) * 100)
            : 0,
      }))
      .sort((a, b) => b.totalFacturado - a.totalFacturado);
  }, [cobradasPeriodo, estilistasMap]);

  // ── Ranking de Rentabilidad y Calibración de Gramos por Servicio ─────
  const rankingServicios = useMemo((): ResumenServicio[] => {
    const grupos = new Map<
      string,
      Omit<ResumenServicio, 'utilidadPromedioPorServicio' | 'margenPct'>
    >();

    for (const c of cobradasPeriodo) {
      const nombre = c.servicioNombre.trim() || 'Servicio de salón';
      const clave = nombre.toLowerCase();

      const cobrado = c.precioCobrado ?? c.precioCotizado;
      const quimica = c.costoProductoEstimado ?? 0;
      const comision = c.comisionEstimada ?? 0;
      const utilidad = cobrado - quimica - comision;

      const realesCot =
        typeof c.formula?.['gramosTinte'] === 'number'
          ? (c.formula['gramosTinte'] as number)
          : typeof c.costoDetalle?.gramosTinte === 'number'
            ? c.costoDetalle.gramosTinte
            : 0;

      const teoricosCot =
        typeof c.formula?.['gramosTeoricos'] === 'number'
          ? (c.formula['gramosTeoricos'] as number)
          : c.costoDetalle && c.costoDetalle.gramosBase > 0
            ? c.costoDetalle.gramosBase * (c.costoDetalle.factores?.total || 1)
            : realesCot;

      const actual = grupos.get(clave) ?? {
        servicioNombre: nombre,
        serviciosCerrados: 0,
        totalFacturado: 0,
        quimicaUtilizada: 0,
        comisionTotal: 0,
        utilidadNetaTotal: 0,
        gramosTeoricos: 0,
        gramosReales: 0,
      };

      actual.serviciosCerrados += 1;
      actual.totalFacturado += cobrado;
      actual.quimicaUtilizada += quimica;
      actual.comisionTotal += comision;
      actual.utilidadNetaTotal += utilidad;
      actual.gramosTeoricos += Math.round(teoricosCot);
      actual.gramosReales += Math.round(realesCot);
      grupos.set(clave, actual);
    }

    return Array.from(grupos.values())
      .map((g) => ({
        ...g,
        utilidadPromedioPorServicio:
          g.serviciosCerrados > 0
            ? Math.round(g.utilidadNetaTotal / g.serviciosCerrados)
            : 0,
        margenPct:
          g.totalFacturado > 0
            ? Math.round((g.utilidadNetaTotal / g.totalFacturado) * 100)
            : 0,
      }))
      .sort((a, b) => b.utilidadNetaTotal - a.utilidadNetaTotal);
  }, [cobradasPeriodo]);

  const maxUtilidadServicio = rankingServicios[0]?.utilidadNetaTotal || 1;
  const serviciosConGramos = useMemo(
    () => rankingServicios.filter((s) => s.gramosTeoricos > 0 || s.gramosReales > 0),
    [rankingServicios]
  );

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] pb-32 lg:pb-12">
      <VelvetTopHeader nombreSalon={nombreSalon} ciudadSalon={ciudadSalon} />
      {/* ── Sub-header Ejecutivo Velvet Studio ─────────────────────────── */}
      <div className="border-b border-[#EFE8E4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
              Velli Business Intelligence
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#3B0D1E] mt-0.5">
              Rentabilidad & Liquidación · {nombreSalon}
            </h1>
          </div>

          <Link
            href="/configuracion/precios"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-[#EFE8E4] hover:bg-[#F5EBE8] font-sans text-xs font-bold text-[#3B0D1E] shadow-[0_2px_8px_-2px_rgba(59,13,30,0.05)] no-underline transition-colors shrink-0"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Calibrar Servicios & Comisiones</span>
            <span className="sm:hidden">Calibrar</span>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        {/* ── Barra de Periodo (Segmented Control) + Acceso a Por Cobrar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#F5EBE8] border border-[#EFE8E4]">
            {OPCIONES_PERIODO.map((op) => {
              const activo = periodo === op.key;
              return (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => setPeriodo(op.key)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl font-sans text-xs font-bold transition-all cursor-pointer ${
                    activo
                      ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-[0_6px_16px_-4px_rgba(59,13,30,0.22)]'
                      : 'text-[#6B535C] hover:text-[#3B0D1E]'
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>

          {kpis.cantidadPorCobrar > 0 && (
            <Link
              href="/?tab=cierre"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-[#EFE8E4] hover:bg-[#3B0D1E] text-[#3B0D1E] hover:text-[#FAF7F5] font-sans text-xs font-bold no-underline transition-colors tabular-nums shadow-[0_4px_14px_-4px_rgba(59,13,30,0.06)]"
            >
              <CheckCircle2 size={14} />
              {kpis.cantidadPorCobrar} por cobrar ({formatearPrecioCop(kpis.montoPorCobrar)})
              <ArrowUpRight size={13} />
            </Link>
          )}
        </div>

        {/* ── 1. Bento Grid Financiero Superior (3 Tarjetas) ───────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Tarjeta 1: Ingresos Cerrados */}
          <article className="bg-white rounded-3xl p-6 border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)] flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                01 · Ingresos Cerrados
              </span>
              <span className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                <TrendingUp size={18} />
              </span>
            </div>

            <div>
              <div className="font-display text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-[#3B0D1E]">
                {cargando ? '…' : formatearPrecioCop(kpis.ingresosCobrados)}
              </div>
              <p className="font-sans text-xs text-[#6B535C] mt-2 tabular-nums">
                <strong className="text-[#3B0D1E]">{kpis.cantidadCerrados}</strong>{' '}
                {kpis.cantidadCerrados === 1 ? 'servicio cobrado' : 'servicios cobrados'} ·{' '}
                <span className="text-[#947C85]">
                  {kpis.cantidadPorCobrar} pendientes en caja
                </span>
              </p>
            </div>
          </article>

          {/* Tarjeta 2: Costo Químico + Nómina */}
          <article className="bg-white rounded-3xl p-6 border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)] flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                02 · Costo Químico + Nómina
              </span>
              <span className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center">
                <FlaskConical size={18} />
              </span>
            </div>

            <div>
              <div className="font-display text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-[#3B0D1E]">
                {cargando ? '…' : formatearPrecioCop(kpis.costoQuimicoMasNomina)}
              </div>

              <div className="mt-3 pt-3 border-t border-[#EFE8E4] grid grid-cols-2 gap-2 text-xs tabular-nums">
                <div>
                  <span className="text-[11px] text-[#6B535C] block">Química ({kpis.pctQuimicaSobreVentas}%)</span>
                  <span className="font-bold text-[#7C3AED]">
                    {formatearPrecioCop(kpis.inversionQuimica)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B535C] block">Comisiones equipo</span>
                  <span className="font-bold text-[#3B0D1E]">
                    {formatearPrecioCop(kpis.comisionesEspecialistas)}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Tarjeta 3 (Protagonista): Utilidad Neta Real */}
          <article className="bg-[#3B0D1E] rounded-3xl p-6 text-[#FAF7F5] shadow-[0_16px_40px_-8px_rgba(59,13,30,0.22)] flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#E8CFC8]">
                03 · Utilidad Neta Real
              </span>
              <span
                className={`px-3 py-1 rounded-full font-mono text-xs font-semibold tabular-nums ${
                  kpis.esOptimo
                    ? 'bg-[#0D9488] text-white'
                    : 'bg-[#D97757] text-white'
                }`}
              >
                {kpis.margenPromedioPct}% margen
              </span>
            </div>

            <div>
              <div className="font-display text-3xl md:text-4xl font-bold tabular-nums tracking-tight text-[#FAF7F5]">
                {cargando ? '…' : formatearPrecioCop(kpis.utilidadNetaSalon)}
              </div>
              <p className="font-sans text-xs text-[#E8CFC8] mt-2 leading-relaxed">
                Capital libre para el salón tras descontar insumos químicos sin báscula y liquidación de especialistas (meta saludable ≥ 30%).
              </p>
            </div>
          </article>
        </section>

        {!cargando && cobradasPeriodo.length === 0 ? (
          <section className="bg-white rounded-3xl p-10 border border-[#EFE8E4] text-center shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]">
            <div className="w-12 h-12 rounded-2xl bg-[#F5EBE8] text-[#3B0D1E] mx-auto flex items-center justify-center mb-4">
              <Sparkles size={22} />
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[#3B0D1E]">
              Aún no hay servicios cerrados en este periodo
            </h2>
            <p className="font-sans text-sm text-[#6B535C] mt-2 max-w-md mx-auto">
              Cuando confirmes un cobro en 1 toque desde «Por Cobrar», aquí verás al instante la calibración de gramos en silla, la liquidación por especialista y el ranking de rentabilidad.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="min-h-[46px] inline-flex items-center px-6 py-3 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold tracking-wide no-underline transition-colors"
              >
                Ir al Cotizador en Silla
              </Link>
              {kpis.cantidadPorCobrar > 0 && (
                <Link
                  href="/?tab=cierre"
                  className="min-h-[46px] inline-flex items-center px-6 py-3 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] text-[#3B0D1E] font-sans text-xs font-bold tracking-wide no-underline hover:bg-[#F5EBE8] transition-colors tabular-nums"
                >
                  Cerrar {kpis.cantidadPorCobrar} pendiente(s)
                </Link>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* ── 2. Calibración en Silla (Gramos Teóricos vs. Gramos Reales) ── */}
            <section className="bg-white rounded-3xl border border-[#EFE8E4] p-6 shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)] space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                    Control de Consumo sin Báscula
                  </span>
                  <h2 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E] mt-0.5">
                    Calibración en Silla · Gramos Teóricos vs. Reales
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full font-mono text-xs font-semibold tabular-nums ${
                      kpis.desvioGramos > 0
                        ? 'bg-[#FFF7F5] border border-[#D97757]/40 text-[#D97757]'
                        : 'bg-[#F0FDFA] border border-[#0D9488]/30 text-[#0D9488]'
                    }`}
                  >
                    <SlidersHorizontal size={12} className="inline mr-1" />
                    {kpis.desvioGramos === 0
                      ? 'Consumo 100% calibrado'
                      : kpis.desvioGramos > 0
                        ? `Desvío +${kpis.desvioGramos}g en silla`
                        : `Ahorro ${kpis.desvioGramos}g en silla`}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full font-sans text-xs font-bold tabular-nums ${
                      kpis.ajusteNetoEnSilla < 0
                        ? 'bg-[#FFF7F5] text-[#D97757]'
                        : 'bg-[#F5EBE8] text-[#3B0D1E]'
                    }`}
                  >
                    Caja vs. cotizado:{' '}
                    {kpis.ajusteNetoEnSilla > 0 ? '+' : ''}
                    {formatearPrecioCop(kpis.ajusteNetoEnSilla)}
                  </span>
                </div>
              </div>

              {serviciosConGramos.length === 0 ? (
                <p className="font-sans text-xs text-[#6B535C]">
                  Los servicios cerrados en este periodo no registraron fórmula de color en gramos.
                </p>
              ) : (
                <div className="space-y-4">
                  {serviciosConGramos.map((srv) => {
                    const maxG = Math.max(srv.gramosTeoricos, srv.gramosReales, 1);
                    const pctTeorico = Math.max(6, Math.round((srv.gramosTeoricos / maxG) * 100));
                    const pctReal = Math.max(6, Math.round((srv.gramosReales / maxG) * 100));
                    const diffG = srv.gramosReales - srv.gramosTeoricos;
                    const tieneSobreconsumo = diffG > 0;

                    return (
                      <div
                        key={`cal-${srv.servicioNombre}`}
                        className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-sans text-sm font-bold text-[#3B0D1E] capitalize">
                              {srv.servicioNombre}
                            </h3>
                            <span className="font-sans text-[11px] text-[#6B535C] tabular-nums">
                              {srv.serviciosCerrados}{' '}
                              {srv.serviciosCerrados === 1 ? 'aplicación' : 'aplicaciones'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] font-mono text-xs font-semibold tabular-nums">
                              Teórico: {srv.gramosTeoricos}g
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-semibold tabular-nums ${
                                tieneSobreconsumo
                                  ? 'bg-[#FFF7F5] border-[#D97757] text-[#D97757]'
                                  : 'bg-[#F0FDFA] border-[#0D9488]/40 text-[#0D9488]'
                              }`}
                            >
                              Real: {srv.gramosReales}g
                              {diffG !== 0
                                ? ` (${diffG > 0 ? `+${diffG}g` : `${diffG}g`})`
                                : ''}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="w-16 font-sans text-[11px] font-semibold text-[#6B535C] shrink-0">
                              Teórico
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-[#EFE8E4] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#7C3AED]"
                                style={{ width: `${pctTeorico}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="w-16 font-sans text-[11px] font-semibold text-[#6B535C] shrink-0">
                              Real silla
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-[#EFE8E4] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  tieneSobreconsumo ? 'bg-[#D97757]' : 'bg-[#0D9488]'
                                }`}
                                style={{ width: `${pctReal}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── 3. Liquidación por Especialista (Tarjetas Ejecutivas) ─── */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                    Nómina & Productividad
                  </span>
                  <h2 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E] mt-0.5">
                    Liquidación por Especialista
                  </h2>
                </div>
                <span className="font-sans text-xs text-[#6B535C]">
                  Calculado sobre servicios efectivamente cobrados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {liquidacionEspecialistas.map((item) => {
                  const optimo = item.margenPct >= 30;
                  const etiquetaPeriodo =
                    OPCIONES_PERIODO.find((p) => p.key === periodo)?.label ?? 'Este mes';
                  const textoColilla = [
                    `*${nombreSalon}* · Corte de Liquidación (${etiquetaPeriodo})`,
                    ``,
                    `Especialista: *${item.nombre}*`,
                    `Servicios cerrados: ${item.serviciosCerrados}`,
                    `Total facturado en silla: ${formatearPrecioCop(item.totalFacturado)} COP`,
                    `Química capilar empleada: ${formatearPrecioCop(item.quimicaUtilizada)} COP`,
                    `*Total comisión a liquidar: ${formatearPrecioCop(item.comisionPagar)} COP*`,
                    ``,
                    `_Resumen generado con Velli Business Intelligence_`,
                  ].join('\n');

                  const enviarColillaWA = () => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(textoColilla).catch(() => {});
                    }
                    const url = enlaceWhatsApp(undefined, textoColilla);
                    window.open(url, '_blank', 'noopener,noreferrer');
                  };

                  const copiarColilla = async () => {
                    try {
                      await navigator.clipboard.writeText(textoColilla);
                      showToast(`Colilla de ${item.nombre} copiada`, 'success');
                    } catch {
                      showToast('No se pudo copiar al portapapeles', 'error');
                    }
                  };

                  return (
                    <article
                      key={item.clave}
                      className="bg-white rounded-3xl p-6 border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)] flex flex-col justify-between gap-5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-[#F5EBE8] text-[#3B0D1E] flex items-center justify-center shrink-0">
                              <UserCheck size={20} />
                            </div>
                            <div>
                              <h3 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E] capitalize">
                                {item.nombre}
                              </h3>
                              <span className="font-sans text-xs text-[#6B535C] tabular-nums">
                                {item.serviciosCerrados}{' '}
                                {item.serviciosCerrados === 1
                                  ? 'servicio cerrado'
                                  : 'servicios cerrados'}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full font-mono text-xs font-semibold tabular-nums ${
                              optimo
                                ? 'bg-[#F0FDFA] text-[#0D9488]'
                                : 'bg-[#FFF7F5] text-[#D97757]'
                            }`}
                          >
                            {item.margenPct}% salón
                          </span>
                        </div>

                        {/* Comisión Neta Protagonista */}
                        <div className="rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] p-4 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                              Comisión Neta a Liquidar
                            </span>
                            <span className="font-sans text-xs text-[#947C85]">
                              Lista para pago de nómina
                            </span>
                          </div>
                          <div className="font-display text-2xl font-bold tabular-nums tracking-tight text-[#3B0D1E]">
                            {formatearPrecioCop(item.comisionPagar)}
                          </div>
                        </div>

                        {/* Desglose secundario */}
                        <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                          <div className="p-2.5 rounded-xl bg-[#FAF7F5]/70 border border-[#EFE8E4]">
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                              Facturado
                            </span>
                            <span className="font-bold text-[#3B0D1E] mt-0.5 block">
                              {formatearPrecioCop(item.totalFacturado)}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#F5F3FF]/60 border border-[#DDD6FE]">
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7C3AED] block">
                              Química
                            </span>
                            <span className="font-bold text-[#7C3AED] mt-0.5 block">
                              {formatearPrecioCop(item.quimicaUtilizada)}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#F0FDFA]/70 border border-[#0D9488]/20">
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#0D9488] block">
                              Utilidad Salón
                            </span>
                            <span
                              className={`font-bold mt-0.5 block ${
                                optimo ? 'text-[#0D9488]' : 'text-[#D97757]'
                              }`}
                            >
                              {formatearPrecioCop(item.utilidadSalon)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Acciones táctiles de colilla */}
                      <div className="flex items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={enviarColillaWA}
                          className="flex-1 min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <MessageCircle size={15} />
                          Resumen WA
                        </button>
                        <button
                          type="button"
                          onClick={copiarColilla}
                          aria-label={`Copiar colilla de ${item.nombre}`}
                          title="Copiar resumen de liquidación"
                          className="min-w-[46px] min-h-[46px] rounded-2xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#6B535C] hover:text-[#3B0D1E] inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* ── 4. Ranking de Rentabilidad por Servicio ──────────────── */}
            <section className="bg-white rounded-3xl border border-[#EFE8E4] p-6 shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                    Ingeniería de Menú
                  </span>
                  <h2 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E] mt-0.5">
                    Ranking de Rentabilidad por Servicio
                  </h2>
                </div>
                <Award size={18} className="text-[#3B0D1E]" />
              </div>

              <div className="space-y-4">
                {rankingServicios.map((srv, idx) => {
                  const anchoBarra = Math.max(
                    8,
                    Math.min(100, Math.round((srv.utilidadNetaTotal / maxUtilidadServicio) * 100))
                  );
                  const optimo = srv.margenPct >= 30;

                  return (
                    <div
                      key={srv.servicioNombre}
                      className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-[#3B0D1E] text-[#FAF7F5] font-mono text-xs font-semibold tabular-nums flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="font-sans font-bold text-base text-[#3B0D1E] capitalize">
                              {srv.servicioNombre}
                            </h3>
                            <p className="font-sans text-xs text-[#6B535C] tabular-nums">
                              {srv.serviciosCerrados}{' '}
                              {srv.serviciosCerrados === 1 ? 'cierre' : 'cierres'} · Utilidad
                              promedio{' '}
                              <strong className="text-[#3B0D1E]">
                                {formatearPrecioCop(srv.utilidadPromedioPorServicio)}
                              </strong>{' '}
                              / servicio
                            </p>
                          </div>
                        </div>

                        <div className="text-right tabular-nums">
                          <div
                            className={`font-display text-lg font-bold ${
                              optimo ? 'text-[#0D9488]' : 'text-[#D97757]'
                            }`}
                          >
                            {formatearPrecioCop(srv.utilidadNetaTotal)} netos
                          </div>
                          <span className="font-sans text-xs text-[#6B535C]">
                            {srv.margenPct}% margen · Facturado{' '}
                            {formatearPrecioCop(srv.totalFacturado)}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2.5 rounded-full bg-[#EFE8E4] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            optimo ? 'bg-[#0D9488]' : 'bg-[#D97757]'
                          }`}
                          style={{ width: `${anchoBarra}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
