'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Sparkles,
  FlaskConical,
  Check,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  Plus,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { getProfile, updateProfile, COLOR_VELLI } from '@/lib/profile';
import {
  AJUSTES_EJEMPLO_PLANTILLA,
  FACTORES_CONSUMO_DEFECTO,
  formatearPrecioCop,
  inferirCategoriaServicio,
  listarPlantillasVigentes,
  publicarPlantillaPrecio,
  sembrarBaseFinancieraSalon,
  sembrarServiciosDesdeOnboarding,
} from '@/lib/cotizador';
import { showToast } from '@/lib/toast';
import { registrarEvento } from '@/lib/funnel';

interface ServicioOnboardingItem {
  nombre: string;
  precioBase: number;
  seleccionado: boolean;
}

const CATALOGO_INICIAL_SERVICIOS: ReadonlyArray<{ nombre: string; precioBase: number; preseleccionado: boolean }> = [
  { nombre: 'Balayage Alta Precisión', precioBase: 240_000, preseleccionado: true },
  { nombre: 'Babylights / Rubios Globales', precioBase: 260_000, preseleccionado: true },
  { nombre: 'Color Global & Cubrimiento', precioBase: 140_000, preseleccionado: true },
  { nombre: 'Corrección de Color', precioBase: 320_000, preseleccionado: true },
  { nombre: 'Keratina y Alisado', precioBase: 200_000, preseleccionado: false },
  { nombre: 'Tratamiento Capilar Profundo', precioBase: 110_000, preseleccionado: false },
  { nombre: 'Corte y Diseño', precioBase: 85_000, preseleccionado: false },
  { nombre: 'Peinado y Brushing', precioBase: 55_000, preseleccionado: false },
];

function precioSugeridoPorNombre(nombre: string): number {
  const coincidencia = CATALOGO_INICIAL_SERVICIOS.find(
    (s) => s.nombre.toLowerCase() === nombre.trim().toLowerCase()
  );
  if (coincidencia) return coincidencia.precioBase;
  const inf = inferirCategoriaServicio(nombre);
  if (inf.categoria === 'decoloracion') return 240_000;
  if (inf.categoria === 'alisado' || inf.categoria === 'extensiones') return 200_000;
  if (inf.categoria === 'color') return 140_000;
  if (inf.categoria === 'tratamiento' || inf.categoria === 'rizos') return 110_000;
  return 85_000;
}

function gramosBasePorCategoria(categoria: string): number {
  if (categoria === 'decoloracion') return 90;
  if (categoria === 'color') return 60;
  return 45;
}

export default function OnboardingExpressPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Paso 1 · Identidad y Canal de Cierre
  const [nombreSalon, setNombreSalon] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Paso 2 · Servicios y Precios Base
  const [catalogoServicios, setCatalogoServicios] = useState<ServicioOnboardingItem[]>(() =>
    CATALOGO_INICIAL_SERVICIOS.map((s) => ({
      nombre: s.nombre,
      precioBase: s.precioBase,
      seleccionado: s.preseleccionado,
    }))
  );
  const [nuevoServicioNombre, setNuevoServicioNombre] = useState('');
  const [nuevoServicioPrecio, setNuevoServicioPrecio] = useState('');

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (!p) {
          router.replace('/auth/login');
          return;
        }
        if (p.onboardingCompleted) {
          router.replace('/');
          return;
        }
        setNombreSalon(p.nombreSalon ?? '');
        setCiudad(p.ciudad ?? '');
        setWhatsapp(p.telefono ?? '');

        if (p.servicios && p.servicios.length > 0) {
          const guardadosSet = new Set(p.servicios.map((s) => s.trim().toLowerCase()));
          const base = CATALOGO_INICIAL_SERVICIOS.map((item) => ({
            nombre: item.nombre,
            precioBase: item.precioBase,
            seleccionado: guardadosSet.has(item.nombre.toLowerCase()),
          }));
          const existentesLower = new Set(base.map((b) => b.nombre.toLowerCase()));
          const extras: ServicioOnboardingItem[] = p.servicios
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !existentesLower.has(s.toLowerCase()))
            .map((nombre) => ({
              nombre,
              precioBase: precioSugeridoPorNombre(nombre),
              seleccionado: true,
            }));
          setCatalogoServicios([...extras, ...base]);
        }
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router]);

  const serviciosSeleccionados = useMemo(
    () => catalogoServicios.filter((s) => s.seleccionado),
    [catalogoServicios]
  );

  const toggleServicio = (nombre: string) => {
    setCatalogoServicios((prev) =>
      prev.map((item) =>
        item.nombre === nombre ? { ...item, seleccionado: !item.seleccionado } : item
      )
    );
  };

  const cambiarPrecioServicio = (nombre: string, texto: string) => {
    const limpio = Number(texto.replace(/\D/g, '')) || 0;
    setCatalogoServicios((prev) =>
      prev.map((item) => (item.nombre === nombre ? { ...item, precioBase: limpio } : item))
    );
  };

  const agregarServicioPersonalizado = () => {
    const limpio = nuevoServicioNombre.trim();
    if (!limpio) return;
    if (catalogoServicios.some((s) => s.nombre.toLowerCase() === limpio.toLowerCase())) {
      showToast('Ese servicio ya está en tu lista.', 'info');
      return;
    }
    const precioNum =
      Number(nuevoServicioPrecio.replace(/\D/g, '')) || precioSugeridoPorNombre(limpio);
    setCatalogoServicios((prev) => [
      { nombre: limpio, precioBase: precioNum, seleccionado: true },
      ...prev,
    ]);
    setNuevoServicioNombre('');
    setNuevoServicioPrecio('');
  };

  const guardarPaso1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreSalon.trim()) {
      showToast('Ingresa el nombre de tu salón para continuar.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        nombreSalon: nombreSalon.trim(),
        ciudad: ciudad.trim(),
        telefono: whatsapp.trim(),
        colorPrimario: COLOR_VELLI,
      });
      setPaso(2);
    } catch (err) {
      console.error('[onboarding.paso1]', err);
      showToast('No se pudo guardar. Revisa tu conexión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const guardarPaso2 = async () => {
    if (serviciosSeleccionados.length === 0) {
      showToast('Selecciona al menos un servicio principal.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        servicios: serviciosSeleccionados.map((s) => s.nombre),
        colorPrimario: COLOR_VELLI,
      });
      setPaso(3);
    } catch (err) {
      console.error('[onboarding.paso2]', err);
      showToast('No se pudieron guardar tus servicios. Revisa tu conexión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activarSalonYEmpezar = async () => {
    const activos =
      serviciosSeleccionados.length > 0
        ? serviciosSeleccionados
        : CATALOGO_INICIAL_SERVICIOS.filter((s) => s.preseleccionado).map((s) => ({
            nombre: s.nombre,
            precioBase: s.precioBase,
            seleccionado: true,
          }));

    const nombresActivos = activos.map((s) => s.nombre);
    const mapaPrecios = new Map(
      activos.map((s) => [s.nombre.trim().toLowerCase(), Math.max(10_000, s.precioBase || 95_000)])
    );

    setSaving(true);
    try {
      await updateProfile({
        nombreSalon: nombreSalon.trim() || undefined,
        ciudad: ciudad.trim() || undefined,
        telefono: whatsapp.trim() || undefined,
        colorPrimario: COLOR_VELLI,
        servicios: nombresActivos,
        onboardingCompleted: true,
      });

      const [serviciosDB, plantillasExistentes] = await Promise.all([
        sembrarServiciosDesdeOnboarding(nombresActivos).catch(() => []),
        listarPlantillasVigentes().catch(() => []),
        sembrarBaseFinancieraSalon().catch(() => null),
      ]);

      const conPlantilla = new Set(plantillasExistentes.map((p) => p.servicioId));
      await Promise.allSettled(
        serviciosDB
          .filter((srv) => !conPlantilla.has(srv.id))
          .map((srv) => {
            const tarifa =
              mapaPrecios.get(srv.nombre.trim().toLowerCase()) ??
              precioSugeridoPorNombre(srv.nombre);
            return publicarPlantillaPrecio({
              servicioId: srv.id,
              precioBase: tarifa,
              ajustes: AJUSTES_EJEMPLO_PLANTILLA,
              consumo: {
                usaFormulaColor: srv.usaFormulaColor,
                gramosTinteBase: gramosBasePorCategoria(srv.categoria),
                factores: FACTORES_CONSUMO_DEFECTO,
                proporcionOxidante: 1.5,
                insumosFijos: 3_000,
              },
              redondeo: 1_000,
              vigenciaDias: 15,
            });
          })
      );

      registrarEvento('onboarding_completado');
      router.replace('/');
    } catch (err) {
      console.error('[onboarding.activar]', err);
      showToast('No se pudo finalizar la activación. Revisa tu conexión.', 'error');
      setSaving(false);
    }
  };

  const completarDespues = async () => {
    const respaldo = CATALOGO_INICIAL_SERVICIOS.filter((s) => s.preseleccionado).map(
      (s) => s.nombre
    );
    const nombres =
      serviciosSeleccionados.length > 0
        ? serviciosSeleccionados.map((s) => s.nombre)
        : respaldo;

    setSaving(true);
    try {
      await updateProfile({
        colorPrimario: COLOR_VELLI,
        servicios: nombres,
        onboardingCompleted: true,
      });
      await Promise.allSettled([
        sembrarServiciosDesdeOnboarding(nombres),
        sembrarBaseFinancieraSalon(),
      ]);
      registrarEvento('onboarding_completado');
      router.replace('/');
    } catch (err) {
      console.error('[onboarding.skip]', err);
      showToast('No se pudo continuar. Revisa tu conexión.', 'error');
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen w-full bg-[#FAF7F5] flex items-center justify-center">
        <div className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#3B0D1E] flex items-center justify-center shadow-md animate-pulse">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M19.2 33.5C13.2 29.8 7.5 21.8 9.2 13.8C10.5 7.8 16.5 7.2 19.2 14.5C20.2 17.2 20.2 27.5 19.2 33.5Z"
                fill="#FAF7F5"
              />
              <path
                d="M20.8 33.5C26.8 29.8 32.5 21.8 30.8 13.8C29.5 7.8 23.5 7.2 20.8 14.5C19.8 17.2 19.8 27.5 20.8 33.5Z"
                fill="#E8CFC8"
                fillOpacity="0.85"
              />
              <circle cx="20" cy="6.5" r="2.5" fill="#D97757" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#6E6266]">Preparando tu salón…</span>
        </div>
      </div>
    );
  }

  const encabezados = {
    1: {
      etiqueta: 'Identidad y Canal de Cierre',
      titulo: 'Configura la identidad de tu salón',
      subtitulo:
        'Estos datos encabezan tus cotizaciones digitales y conectan el canal donde recibirás las confirmaciones de tus clientas.',
      icono: <Store size={18} />,
    },
    2: {
      etiqueta: 'Servicios y Precios Base',
      titulo: 'Elige tus servicios y tarifas base',
      subtitulo:
        'Define desde cuánto arranca cada técnica en cabello corto/sano. En silla, Velli ajustará automáticamente según largo, densidad y canas.',
      icono: <Sparkles size={18} />,
    },
    3: {
      etiqueta: 'Activación BI sin Báscula',
      titulo: 'Motor financiero listo para cotizar',
      subtitulo:
        'Dejamos calibrada tu base química y de comisión para que desde la primera clienta veas utilidad real y nunca un margen falso.',
      icono: <FlaskConical size={18} />,
    },
  }[paso];

  return (
    <div className="min-h-screen w-full bg-[#FAF7F5] text-[#1C1518] flex flex-col justify-between pb-10">
      {/* ── Top Hero Velvet Studio ──────────────────────────────────────── */}
      <header className="v-gradient-hero v-grain text-[#FAF7F5] pt-8 pb-8 px-5 sm:px-8 border-b border-[#3B0D1E]">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="inline-flex items-center gap-3 select-none">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F5]/10 border border-[#E8CFC8]/25 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M19.2 33.5C13.2 29.8 7.5 21.8 9.2 13.8C10.5 7.8 16.5 7.2 19.2 14.5C20.2 17.2 20.2 27.5 19.2 33.5Z"
                    fill="#FAF7F5"
                  />
                  <path
                    d="M20.8 33.5C26.8 29.8 32.5 21.8 30.8 13.8C29.5 7.8 23.5 7.2 20.8 14.5C19.8 17.2 19.8 27.5 20.8 33.5Z"
                    fill="#E8CFC8"
                    fillOpacity="0.85"
                  />
                  <circle cx="20" cy="6.5" r="2.5" fill="#D97757" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold tracking-tight text-[#FAF7F5] font-brand">
                  velli
                </span>
                <span className="text-[9px] uppercase tracking-[0.22em] font-semibold mt-0.5 text-[#E8CFC8]">
                  Business Intelligence
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={completarDespues}
              disabled={saving}
              className="text-xs font-semibold text-[#E8CFC8] hover:text-[#FAF7F5] transition-colors cursor-pointer disabled:opacity-50"
            >
              Saltar configuración →
            </button>
          </div>

          {/* Barra de progreso Express */}
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-[#E8CFC8] mb-2">
            <span>
              Paso {paso} de 3 · {encabezados.etiqueta}
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#FAF7F5]/10 flex items-center justify-center text-[#FAF7F5]">
              {encabezados.icono}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 rounded-full transition-all ${
                  n <= paso ? 'bg-[#E8CFC8]' : 'bg-[#FAF7F5]/20'
                }`}
              />
            ))}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF7F5] leading-tight">
            {encabezados.titulo}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#FAF7F5]/80 leading-relaxed">
            {encabezados.subtitulo}
          </p>
        </div>
      </header>

      {/* ── Contenido por Paso ──────────────────────────────────────────── */}
      <main className="w-full max-w-xl mx-auto px-5 sm:px-8 pt-6 flex-1">
        {/* PASO 1: IDENTIDAD Y CANAL DE CIERRE */}
        {paso === 1 && (
          <form
            onSubmit={guardarPaso1}
            className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE8E4] shadow-[0_14px_34px_-10px_rgba(59,13,30,0.08)] space-y-5"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                Nombre del salón *
              </label>
              <input
                type="text"
                value={nombreSalon}
                onChange={(e) => setNombreSalon(e.target.value)}
                placeholder="Ej. Atelier Camila Studio"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:bg-white focus:border-[#3B0D1E] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                Ciudad
              </label>
              <input
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ej. Bogotá, Medellín, Cali…"
                className="w-full px-4 py-3 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:bg-white focus:border-[#3B0D1E] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                WhatsApp oficial del salón
              </label>
              <div className="relative">
                <MessageCircle
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0D9488]"
                />
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+57 300 123 4567"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:bg-white focus:border-[#3B0D1E] outline-none transition-all tabular-nums"
                />
              </div>
              <div className="mt-2.5 p-3 rounded-2xl bg-[#EAF6F4] border border-[#0D9488]/20 text-xs text-[#1C1518] leading-relaxed">
                <strong className="text-[#0D9488]">Canal directo de cierre:</strong> En este número
                recibirás las confirmaciones y consentimientos digitales cuando tus clientas acepten
                su cotización desde el enlace público <code className="font-mono text-[11px]">/c/[token]</code>.
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-60 text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{saving ? 'Guardando…' : 'Continuar a Servicios y Tarifas'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* PASO 2: SERVICIOS Y PRECIOS BASE */}
        {paso === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EFE8E4] shadow-[0_14px_34px_-10px_rgba(59,13,30,0.08)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266]">
                  Servicios activos ({serviciosSeleccionados.length})
                </span>
                <span className="text-[11px] text-[#6E6266]">Tarifa base ($ COP)</span>
              </div>

              <div className="divide-y divide-[#FAF7F5]">
                {catalogoServicios.map((srv) => (
                  <div
                    key={srv.nombre}
                    className={`py-3 flex items-center justify-between gap-3 transition-opacity ${
                      srv.seleccionado ? 'opacity-100' : 'opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleServicio(srv.nombre)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                          srv.seleccionado
                            ? 'bg-[#3B0D1E] border-[#3B0D1E] text-[#FAF7F5]'
                            : 'bg-[#FAF7F5] border-[#D9CCC6] text-transparent'
                        }`}
                      >
                        <Check size={13} />
                      </span>
                      <span className="text-sm font-semibold text-[#1C1518] truncate">
                        {srv.nombre}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-[#6E6266]">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={!srv.seleccionado}
                        value={srv.precioBase > 0 ? srv.precioBase.toLocaleString('es-CO') : ''}
                        onChange={(e) => cambiarPrecioServicio(srv.nombre, e.target.value)}
                        aria-label={`Precio base de ${srv.nombre}`}
                        className="w-28 px-3 py-1.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-right text-sm font-bold text-[#1C1518] tabular-nums focus:bg-white focus:border-[#3B0D1E] outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Agregar servicio propio */}
              <div className="pt-3 border-t border-[#EFE8E4]">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-2">
                  ¿Ofreces otra especialidad? Agrégala aquí
                </span>
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={nuevoServicioNombre}
                    onChange={(e) => setNuevoServicioNombre(e.target.value)}
                    placeholder="Nombre del servicio"
                    className="flex-1 min-w-[160px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-xs text-[#1C1518] placeholder-[#BDB0B4] focus:bg-white focus:border-[#3B0D1E] outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nuevoServicioPrecio}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNuevoServicioPrecio(val ? Number(val).toLocaleString('es-CO') : '');
                    }}
                    placeholder="$ Base COP"
                    className="w-32 px-3.5 py-2.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-xs font-semibold text-[#1C1518] placeholder-[#BDB0B4] tabular-nums focus:bg-white focus:border-[#3B0D1E] outline-none"
                  />
                  <button
                    type="button"
                    onClick={agregarServicioPersonalizado}
                    className="px-3.5 py-2.5 rounded-xl bg-[#F7ECEF] hover:bg-[#E8CFC8]/50 text-[#3B0D1E] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Añadir
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaso(1)}
                disabled={saving}
                className="px-5 py-3.5 rounded-full bg-white border border-[#EFE8E4] text-[#6E6266] hover:text-[#1C1518] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Atrás
              </button>
              <button
                type="button"
                onClick={guardarPaso2}
                disabled={saving}
                className="flex-1 py-3.5 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-60 text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{saving ? 'Guardando…' : 'Revisar activación BI'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: ACTIVACIÓN BI SIN BÁSCULA */}
        {paso === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE8E4] shadow-[0_14px_34px_-10px_rgba(59,13,30,0.08)] space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFE8E4]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7C3AED]">
                    Calibración Automática Minuto 1
                  </span>
                  <h2 className="text-lg font-bold text-[#1C1518] mt-0.5">
                    {nombreSalon.trim() || 'Tu Salón'} queda listo para rentabilizar
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#EAF6F4] text-[#0D9488] text-[11px] font-bold">
                  0% Margen Falso
                </span>
              </div>

              {/* Resumen de lo que se siembra */}
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F5EFFB] text-[#7C3AED] flex items-center justify-center shrink-0">
                    <FlaskConical size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#1C1518] text-sm">
                      2 Insumos Químicos de Referencia (Sin Báscula)
                    </p>
                    <p className="text-[#6E6266] mt-0.5 leading-relaxed">
                      Sembramos{' '}
                      <strong className="text-[#1C1518] tabular-nums">
                        Decolorante / Tinte Estándar ($320 COP/g)
                      </strong>{' '}
                      y{' '}
                      <strong className="text-[#1C1518] tabular-nums">
                        Peróxido / Revelador ($95 COP/ml)
                      </strong>{' '}
                      para descontar el costo químico real en cada servicio.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F7ECEF] text-[#3B0D1E] flex items-center justify-center shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#1C1518] text-sm">
                      Especialista y Regla de Comisión Base (35%)
                    </p>
                    <p className="text-[#6E6266] mt-0.5 leading-relaxed">
                      Activamos tu <strong className="text-[#1C1518]">Especialista Principal</strong> con
                      comisión del <strong className="text-[#1C1518] tabular-nums">35%</strong> calculada
                      sobre <em className="not-italic font-semibold">precio menos química</em>, protegiendo
                      la utilidad neta del salón.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#1C1518] text-sm">
                      {serviciosSeleccionados.length}{' '}
                      {serviciosSeleccionados.length === 1
                        ? 'Servicio calibrado'
                        : 'Servicios calibrados'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaso(2)}
                      className="text-[11px] font-bold text-[#6E1E3A] hover:underline cursor-pointer"
                    >
                      Editar tarifas
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {serviciosSeleccionados.map((s) => (
                      <span
                        key={s.nombre}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#EFE8E4] text-[11px] text-[#1C1518]"
                      >
                        <span>{s.nombre}</span>
                        <strong className="text-[#3B0D1E] tabular-nums">
                          {formatearPrecioCop(s.precioBase)}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#6E6266] flex items-center gap-1.5 pt-1">
                <ShieldCheck size={14} className="text-[#0D9488] shrink-0" />
                Puedes personalizar marcas, gramos exactos y equipo cuando quieras en Configuración → Precios.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaso(2)}
                disabled={saving}
                className="px-5 py-3.5 rounded-full bg-white border border-[#EFE8E4] text-[#6E6266] hover:text-[#1C1518] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Atrás
              </button>
              <button
                type="button"
                onClick={activarSalonYEmpezar}
                disabled={saving}
                className="flex-1 py-4 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-60 text-[#FAF7F5] font-bold text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>{saving ? 'Activando motor BI…' : 'Activar mi salón y cotizar'}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
