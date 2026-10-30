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
import BottomNavV2 from '@/components/v2/BottomNavV2';
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
  // mes_actual: día 1 del mes corriente a las 00:00 locales
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
}

export default function ReportesBIPage() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes_actual');
  const [cargando, setCargando] = useState(true);
  const [nombreSalon, setNombreSalon] = useState('Tu Salón');
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
    let gramosTotales = 0;

    for (const c of cobradasPeriodo) {
      const cobrado = c.precioCobrado ?? c.precioCotizado;
      const quimica = c.costoProductoEstimado ?? 0;
      const comision = c.comisionEstimada ?? 0;
      ingresosCobrados += cobrado;
      totalCotizadoEnCerrados += c.precioCotizado;
      inversionQuimica += quimica;
      comisionesEspecialistas += comision;

      if (typeof c.costoDetalle?.gramosTinte === 'number') {
        gramosTotales += c.costoDetalle.gramosTinte;
      }
    }

    const utilidadNetaSalon =
      ingresosCobrados - inversionQuimica - comisionesEspecialistas;
    const margenPromedioPct =
      ingresosCobrados > 0
        ? Math.round((utilidadNetaSalon / ingresosCobrados) * 100)
        : 0;
    const pctQuimicaSobreVentas =
      ingresosCobrados > 0
        ? Math.round((inversionQuimica / ingresosCobrados) * 1000) / 10
        : 0;

    // Positivo = se cobró más que lo cotizado (adicionales); Negativo = cortesías en silla
    const ajusteNetoEnSilla = ingresosCobrados - totalCotizadoEnCerrados;
    const montoPorCobrar = enviadasPendientes.reduce(
      (acc, c) => acc + c.precioCotizado,
      0
    );

    return {
      ingresosCobrados,
      inversionQuimica,
      comisionesEspecialistas,
      utilidadNetaSalon,
      margenPromedioPct,
      esOptimo: cobradasPeriodo.length === 0 || margenPromedioPct >= 30,
      pctQuimicaSobreVentas,
      gramosTotales: Math.round(gramosTotales),
      ajusteNetoEnSilla,
      cantidadCerrados: cobradasPeriodo.length,
      cantidadPorCobrar: enviadasPendientes.length,
      montoPorCobrar,
    };
  }, [cobradasPeriodo, enviadasPendientes]);

  // ── Tabla de Liquidación por Especialista ────────────────────────────
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

  // ── Ranking de Rentabilidad por Servicio ─────────────────────────────
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

      const actual = grupos.get(clave) ?? {
        servicioNombre: nombre,
        serviciosCerrados: 0,
        totalFacturado: 0,
        quimicaUtilizada: 0,
        comisionTotal: 0,
        utilidadNetaTotal: 0,
      };

      actual.serviciosCerrados += 1;
      actual.totalFacturado += cobrado;
      actual.quimicaUtilizada += quimica;
      actual.comisionTotal += comision;
      actual.utilidadNetaTotal += utilidad;
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

  const maxUtilidadServicio = rankingServicios[0]?.utilidadNetaTotal ?? 1;

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#1C1518] pb-32">
      {/* ── Top Bar Ejecutivo ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FAF7F5]/90 backdrop-blur-md border-b border-[#EFE8E4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-3 py-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6E1E3A] block">
              Velli Business Intelligence
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[#1C1518] tracking-tight">
               Rentabilidad & Liquidación · {nombreSalon}
            </h1>
          </div>

          <Link
            href="/configuracion/precios"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#EFE8E4] hover:border-[#E8CFC8] text-xs font-semibold text-[#3B0D1E] shadow-xs no-underline transition-colors"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Calibrar Servicios & Comisiones</span>
            <span className="sm:hidden">Calibrar</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 space-y-8">
        {/* ── 1. Selector de Periodo + Tarjeta Maestra Hero ────────────── */}
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-white border border-[#EFE8E4] shadow-xs">
              {OPCIONES_PERIODO.map((op) => {
                const activo = periodo === op.key;
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => setPeriodo(op.key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      activo
                        ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-xs'
                        : 'text-[#6E6266] hover:text-[#1C1518]'
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7ECEF] border border-[#DFC5CE] text-xs font-bold text-[#3B0D1E] hover:bg-[#3B0D1E] hover:text-[#FAF7F5] no-underline transition-colors"
              >
                <CheckCircle2 size={14} />
                {kpis.cantidadPorCobrar} por cobrar ({formatearPrecioCop(kpis.montoPorCobrar)})
                <ArrowUpRight size={13} />
              </Link>
            )}
          </div>

          {/* Tarjeta Maestra v-gradient-hero */}
          <div className="v-gradient-hero rounded-3xl p-6 sm:p-8 text-[#FAF7F5] shadow-[0_24px_55px_-14px_rgba(31,5,15,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[#E8CFC8] font-bold">
                Utilidad Neta Real del Salón
              </span>

              <span
                className={`px-3.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-2 ${
                  kpis.esOptimo
                    ? 'bg-[#0D9488]/25 text-[#5EEAD4] border border-[#0D9488]/45'
                    : 'bg-[#D97757]/25 text-[#FDBA74] border border-[#D97757]/45'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    kpis.esOptimo ? 'bg-[#0D9488]' : 'bg-[#D97757]'
                  }`}
                />
                {kpis.cantidadCerrados === 0
                  ? 'Listo para medir tus cierres'
                  : kpis.esOptimo
                    ? `Rentabilidad Óptima · ${kpis.margenPromedioPct}% margen neto`
                    : `Oportunidad de Calibración · ${kpis.margenPromedioPct}% margen neto`}
              </span>
            </div>

            <div className="mt-5 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                  {cargando ? '…' : formatearPrecioCop(kpis.utilidadNetaSalon)}
                </div>
                <p className="text-xs sm:text-sm text-[#E8CFC8]/85 mt-2">
                  Dinero libre para el salón después de descontar química capilar y comisiones en{' '}
                  <strong className="text-[#FAF7F5]">
                    {kpis.cantidadCerrados}{' '}
                    {kpis.cantidadCerrados === 1 ? 'servicio cerrado' : 'servicios cerrados'}
                  </strong>
                  .
                </p>
              </div>

              <div className="flex items-center gap-6 border-t md:border-t-0 border-[#FAF7F5]/15 pt-4 md:pt-0">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#E8CFC8]/75 block">
                    Margen Neto Promedio
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold text-[#E8CFC8] tabular-nums">
                    {kpis.margenPromedioPct}%
                  </span>
                </div>
                <div className="h-9 w-px bg-[#FAF7F5]/15" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#E8CFC8]/75 block">
                    Meta Saludable BI
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold text-[#5EEAD4] tabular-nums">
                    ≥ 30%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Los 4 KPIs de Desglose Financiero (tabular-nums) ──────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ingresos Cobrados */}
          <article className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_12px_28px_-10px_rgba(59,13,30,0.06)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#6E6266] mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Ingresos Cobrados
              </span>
              <TrendingUp size={16} className="text-[#0D9488]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1C1518] tabular-nums">
                {formatearPrecioCop(kpis.ingresosCobrados)}
              </div>
              <p className="text-xs text-[#6E6266] mt-1.5 tabular-nums">
                {kpis.cantidadCerrados} cerrados ·{' '}
                <span className="font-semibold text-[#6E1E3A]">
                  {kpis.cantidadPorCobrar} en Por Cobrar
                </span>
              </p>
            </div>
          </article>

          {/* KPI 2: Inversión en Química (Sin Báscula) */}
          <article className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_12px_28px_-10px_rgba(59,13,30,0.06)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#6E6266] mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Inversión en Química
              </span>
              <FlaskConical size={16} className="text-[#7C3AED]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#7C3AED] tabular-nums">
                {formatearPrecioCop(kpis.inversionQuimica)}
              </div>
              <p className="text-xs text-[#6E6266] mt-1.5 tabular-nums">
                Representa el <strong>{kpis.pctQuimicaSobreVentas}%</strong> de las ventas
                {kpis.gramosTotales > 0 ? ` · ~${kpis.gramosTotales} g` : ''}
              </p>
            </div>
          </article>

          {/* KPI 3: Comisiones de Especialistas */}
          <article className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_12px_28px_-10px_rgba(59,13,30,0.06)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#6E6266] mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Comisiones Equipo
              </span>
              <UserCheck size={16} className="text-[#3B0D1E]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1C1518] tabular-nums">
                {formatearPrecioCop(kpis.comisionesEspecialistas)}
              </div>
              <p className="text-xs text-[#6E6266] mt-1.5">
                Listas para liquidar sin hojas de cálculo
              </p>
            </div>
          </article>

          {/* KPI 4: Ajustes en Silla (No punitivo) */}
          <article className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_12px_28px_-10px_rgba(59,13,30,0.06)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#6E6266] mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Calibración en Silla
              </span>
              <SlidersHorizontal size={16} className="text-[#D97757]" />
            </div>
            <div>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  kpis.ajusteNetoEnSilla < 0 ? 'text-[#D97757]' : 'text-[#0D9488]'
                }`}
              >
                {kpis.ajusteNetoEnSilla > 0 ? '+' : ''}
                {formatearPrecioCop(kpis.ajusteNetoEnSilla)}
              </div>
              <p className="text-xs text-[#6E6266] mt-1.5">
                {kpis.ajusteNetoEnSilla === 0
                  ? '100% cobrado al valor cotizado'
                  : kpis.ajusteNetoEnSilla > 0
                    ? 'Servicios adicionales sumados al cierre'
                    : 'Cortesías comerciales aplicadas al cierre'}
              </p>
            </div>
          </article>
        </section>

        {!cargando && cobradasPeriodo.length === 0 ? (
          <section className="bg-white rounded-3xl p-10 border border-[#EFE8E4] text-center shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)]">
            <div className="w-12 h-12 rounded-2xl bg-[#F7ECEF] text-[#3B0D1E] mx-auto flex items-center justify-center mb-4">
              <Sparkles size={22} />
            </div>
            <h2 className="text-xl font-bold text-[#1C1518]">
              Aún no hay servicios cerrados en este periodo
            </h2>
            <p className="text-sm text-[#6E6266] mt-2 max-w-md mx-auto">
              Cuando confirmes un cobro en 1 toque desde «Por Cobrar», aquí verás al instante la liquidación de cada especialista y el ranking de rentabilidad por técnica.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="px-6 py-3 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] text-[#FAF7F5] text-xs font-bold tracking-wide no-underline transition-colors"
              >
                Ir al Cotizador
              </Link>
              {kpis.cantidadPorCobrar > 0 && (
                <Link
                  href="/?tab=cierre"
                  className="px-6 py-3 rounded-full bg-white border border-[#DFC5CE] text-[#3B0D1E] text-xs font-bold tracking-wide no-underline hover:bg-[#F7ECEF]/60 transition-colors"
                >
                  Cerrar {kpis.cantidadPorCobrar} pendiente(s)
                </Link>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* ── 3. Tabla de Liquidación por Especialista ─────────────── */}
            <section className="bg-white rounded-3xl border border-[#EFE8E4] overflow-hidden shadow-[0_14px_34px_-10px_rgba(59,13,30,0.07)]">
              <div className="px-6 py-5 border-b border-[#EFE8E4] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1E3A]">
                    Nómina & Productividad
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-[#1C1518] mt-0.5">
                    Liquidación por Especialista
                  </h2>
                </div>
                <span className="text-xs text-[#6E6266]">
                  Calculado sobre servicios efectivamente cobrados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF7F5] border-b border-[#EFE8E4] text-[11px] font-bold uppercase tracking-wider text-[#6E6266]">
                      <th className="py-3.5 px-6">Especialista</th>
                      <th className="py-3.5 px-4 text-right">Servicios</th>
                      <th className="py-3.5 px-4 text-right">Total Facturado</th>
                      <th className="py-3.5 px-4 text-right">Química Usada</th>
                      <th className="py-3.5 px-4 text-right text-[#3B0D1E]">Comisión a Pagar</th>
                      <th className="py-3.5 px-4 text-right">Margen Salón</th>
                      <th className="py-3.5 px-6 text-right">Colilla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FAF7F5] text-sm">
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
                        <tr key={item.clave} className="hover:bg-[#FAF7F5]/60 transition-colors">
                          <td className="py-4 px-6 font-bold text-[#1C1518]">{item.nombre}</td>
                          <td className="py-4 px-4 text-right text-[#6E6266] tabular-nums">
                            {item.serviciosCerrados}
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-[#1C1518] tabular-nums">
                            {formatearPrecioCop(item.totalFacturado)}
                          </td>
                          <td className="py-4 px-4 text-right font-medium text-[#7C3AED] tabular-nums">
                            {formatearPrecioCop(item.quimicaUtilizada)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="inline-block px-3 py-1 rounded-full bg-[#F7ECEF] text-[#3B0D1E] font-bold tabular-nums">
                              {formatearPrecioCop(item.comisionPagar)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right tabular-nums">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                optimo
                                  ? 'bg-[#EAF6F4] text-[#0D9488]'
                                  : 'bg-[#FDF2EC] text-[#D97757]'
                              }`}
                            >
                              {item.margenPct}% ({formatearPrecioCop(item.utilidadSalon)})
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={enviarColillaWA}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF7F5] hover:bg-[#EAF6F4] border border-[#EFE8E4] hover:border-[#0D9488]/40 text-xs font-bold text-[#1C1518] hover:text-[#0D9488] transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <MessageCircle size={13} className="text-[#0D9488]" />
                                Resumen WA
                              </button>
                              <button
                                type="button"
                                onClick={copiarColilla}
                                aria-label={`Copiar colilla de ${item.nombre}`}
                                title="Copiar resumen de liquidación"
                                className="w-8 h-8 rounded-full bg-[#FAF7F5] hover:bg-[#F7ECEF] border border-[#EFE8E4] text-[#6E6266] hover:text-[#3B0D1E] inline-flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 4. Ranking de Rentabilidad por Servicio ──────────────── */}
            <section className="bg-white rounded-3xl border border-[#EFE8E4] p-6 shadow-[0_14px_34px_-10px_rgba(59,13,30,0.07)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1E3A]">
                    Ingeniería de Menú
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-[#1C1518] mt-0.5">
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
                      className="p-4 rounded-2xl bg-[#FAF7F5]/75 border border-[#EFE8E4] space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-[#3B0D1E] text-[#FAF7F5] text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="font-bold text-base text-[#1C1518]">
                              {srv.servicioNombre}
                            </h3>
                            <p className="text-xs text-[#6E6266] tabular-nums">
                              {srv.serviciosCerrados}{' '}
                              {srv.serviciosCerrados === 1 ? 'cierre' : 'cierres'} · Utilidad
                              promedio{' '}
                              <strong className="text-[#1C1518]">
                                {formatearPrecioCop(srv.utilidadPromedioPorServicio)}
                              </strong>{' '}
                              / servicio
                            </p>
                          </div>
                        </div>

                        <div className="text-right tabular-nums">
                          <div
                            className={`text-lg font-bold ${
                              optimo ? 'text-[#0D9488]' : 'text-[#D97757]'
                            }`}
                          >
                            {formatearPrecioCop(srv.utilidadNetaTotal)} netos
                          </div>
                          <span className="text-xs text-[#6E6266]">
                            {srv.margenPct}% margen · Facturado{' '}
                            {formatearPrecioCop(srv.totalFacturado)}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2 rounded-full bg-[#EFE8E4] overflow-hidden">
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

      <BottomNavV2 />
    </div>
  );
}
