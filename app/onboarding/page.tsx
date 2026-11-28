'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Sparkles,
  FlaskConical,
  Check,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  UserCheck,
  ShieldCheck,
  Ruler,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getProfile, updateProfile, COLOR_VELLI } from '@/lib/profile';
import type { VerticalSalon } from '@/lib/flags/verticales';
import {
  actualizarContextoOrganizacionCliente,
  obtenerContextoOrganizacionActivaCliente,
} from '@/lib/organizations';
import {
  FACTORES_CONSUMO_DEFECTO,
  crearServicioSalon,
  formatearPrecioCop,
  listarPlantillasVigentes,
  listarServiciosSalon,
  publicarPlantillaPrecio,
  sembrarBaseFinancieraSalon,
} from '@/lib/cotizador';
import { showToast } from '@/lib/toast';
import { registrarEvento } from '@/lib/funnel';
import {
  AJUSTES_VELVET_STUDIO_DEFECTO,
  obtenerSemillaServicio,
} from '@/lib/semilla-financiera';
import { obtenerPackPopularPorVertical } from '@/lib/catalogos/catalogoMaestroColombia';
import {
  CIUDADES_COLOMBIA,
  calcularPrecioContextualColombia,
  inferirCodigoCiudadColombia,
  type CodigoCiudadColombia,
  type SegmentoMercadoColombia,
} from '@/lib/catalogos/referenciasMercadoColombia';
import {
  LEMA_CULTURA_DATOS_VELI,
  NIVELES_PRECISION_VELI,
} from '@/lib/datos/culturaDatos';
import SelectorCatalogoColombia, {
  mapearCategoriaCatalogoADb,
  type ItemCatalogoSeleccionado,
} from '@/components/catalogos/SelectorCatalogoColombia';

function construirSeleccionPopularPorDefecto(
  vertical: VerticalSalon,
  cityCode: CodigoCiudadColombia,
  segmento: SegmentoMercadoColombia
): ItemCatalogoSeleccionado[] {
  return obtenerPackPopularPorVertical(vertical)
    .filter((p) => p.veli_guardrail_action !== 'restrict_require_reps_health_license')
    .map((proc) => {
      const ref = calcularPrecioContextualColombia({
        procedimiento: proc,
        cityCode,
        segmento,
      });
      return {
        id: proc.id,
        nombre: proc.nombre,
        categoriaDb: mapearCategoriaCatalogoADb(proc),
        precioBaseCop: ref.precioSugeridoCop,
        duracionMin: proc.duracion_min,
        usaSinBascula: proc.usa_sin_bascula,
        gramosBase: proc.gramos_base_sugeridos,
        unidadBase: proc.unidad_base,
        esPrecioDesde: proc.es_precio_desde,
        cicloRetornoDias: proc.ciclo_retorno_dias,
        costTrackingMode: proc.cost_tracking_mode,
      };
    });
}

export default function OnboardingExpressPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Paso 1 · Identidad, Ciudad y Canal de Cierre
  const [orgId, setOrgId] = useState<string | null>(null);
  const [nombreSalon, setNombreSalon] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Paso 2 · Contexto de Mercado Colombia y Menú Inicial
  const [vertical, setVertical] = useState<VerticalSalon>('hair_studio');
  const [cityCode, setCityCode] = useState<CodigoCiudadColombia>('BOG');
  const [segmento, setSegmento] = useState<SegmentoMercadoColombia>('estandar');
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<
    ItemCatalogoSeleccionado[]
  >(() => construirSeleccionPopularPorDefecto('hair_studio', 'BOG', 'estandar'));

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      getProfile(),
      obtenerContextoOrganizacionActivaCliente(supabase).catch(() => null),
    ])
      .then(([p, orgCtx]) => {
        if (!p) {
          router.replace('/auth/login');
          return;
        }
        if (p.onboardingCompleted) {
          router.replace('/');
          return;
        }
        setNombreSalon(p.nombreSalon ?? '');
        const ciudadInicial = p.ciudad ?? orgCtx?.city ?? '';
        setCiudad(ciudadInicial);
        setWhatsapp(p.telefono ?? '');

        const codInferido = inferirCodigoCiudadColombia(ciudadInicial);
        setCityCode(codInferido);

        if (orgCtx) {
          setOrgId(orgCtx.organizationId);
          setVertical(orgCtx.vertical);
          setServiciosSeleccionados(
            construirSeleccionPopularPorDefecto(orgCtx.vertical, codInferido, 'estandar')
          );
        }
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router]);

  const handleSelectionChange = useCallback((items: ItemCatalogoSeleccionado[]) => {
    setServiciosSeleccionados(items);
  }, []);

  const handleCambiarCityCodeEnSelector = useCallback((nuevoCode: CodigoCiudadColombia) => {
    setCityCode(nuevoCode);
    const encontrada = CIUDADES_COLOMBIA.find((c) => c.code === nuevoCode);
    if (encontrada && nuevoCode !== 'OTRA') {
      setCiudad(encontrada.nombre);
    }
  }, []);

  const persistirMenuCalibrado = async (items: ItemCatalogoSeleccionado[]) => {
    const existentes = await listarServiciosSalon({ soloActivos: false }).catch(() => []);
    const plantillasVigentes = await listarPlantillasVigentes().catch(() => []);
    const conPlantilla = new Set(plantillasVigentes.map((p) => p.servicioId));
    const mapaExistentes = new Map(
      existentes.map((s) => [s.nombre.trim().toLowerCase(), s])
    );

    await Promise.allSettled(
      items.map(async (item, idx) => {
        const clave = item.nombre.trim().toLowerCase();
        let srv = mapaExistentes.get(clave);
        if (!srv) {
          srv = await crearServicioSalon({
            nombre: item.nombre,
            categoria: item.categoriaDb,
            usaFormulaColor: item.usaSinBascula,
            duracionMinutos: item.duracionMin,
            orden: existentes.length + idx,
            activo: true,
            perfilExtendido: {
              marketProcedureId: item.esPersonalizado ? null : item.id,
              costTrackingMode: item.costTrackingMode,
              unidadBase: item.unidadBase,
              esPrecioDesde: item.esPrecioDesde,
              cicloRetornoDias: item.cicloRetornoDias,
            },
          });
        }

        if (!conPlantilla.has(srv.id)) {
          const semillaSrv = obtenerSemillaServicio(srv);
          const gramosBase =
            item.gramosBase && item.gramosBase > 0
              ? item.gramosBase
              : semillaSrv.gramosBase;
          const usaOx =
            item.unidadBase === 'ml'
              ? 0
              : item.categoriaDb === 'decoloracion'
                ? 1.5
                : item.categoriaDb === 'color'
                  ? 1.0
                  : 0;
          await publicarPlantillaPrecio({
            servicioId: srv.id,
            precioBase: Math.max(5000, Math.round(item.precioBaseCop)),
            ajustes: AJUSTES_VELVET_STUDIO_DEFECTO,
            consumo: {
              usaFormulaColor: item.usaSinBascula,
              gramosTinteBase: gramosBase,
              unidadBase: item.unidadBase ?? 'g',
              factores: FACTORES_CONSUMO_DEFECTO,
              proporcionOxidante: usaOx,
              insumosFijos: semillaSrv.insumosFijosCop,
            },
            redondeo: 1000,
            vigenciaDias: 15,
          });
        }
      })
    );
  };

  const guardarPaso1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreSalon.trim()) {
      showToast('Ingresa el nombre de tu estudio para continuar.', 'error');
      return;
    }
    const cod = inferirCodigoCiudadColombia(ciudad);
    setCityCode(cod);

    setSaving(true);
    try {
      await updateProfile({
        nombreSalon: nombreSalon.trim(),
        ciudad: ciudad.trim(),
        telefono: whatsapp.trim(),
        colorPrimario: COLOR_VELLI,
      });
      if (orgId) {
        const supabase = createClient();
        await actualizarContextoOrganizacionCliente(supabase, {
          organizationId: orgId,
          city: ciudad.trim() || null,
        });
      }
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
      showToast('Selecciona al menos un servicio para tu menú inicial.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        ciudad: ciudad.trim() || undefined,
        servicios: serviciosSeleccionados.map((s) => s.nombre),
        colorPrimario: COLOR_VELLI,
      });
      if (orgId) {
        const supabase = createClient();
        await actualizarContextoOrganizacionCliente(supabase, {
          organizationId: orgId,
          vertical,
          city: ciudad.trim() || null,
        });
      }
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
        : construirSeleccionPopularPorDefecto(vertical, cityCode, segmento);

    setSaving(true);
    try {
      await updateProfile({
        nombreSalon: nombreSalon.trim() || undefined,
        ciudad: ciudad.trim() || undefined,
        telefono: whatsapp.trim() || undefined,
        colorPrimario: COLOR_VELLI,
        servicios: activos.map((s) => s.nombre),
        onboardingCompleted: true,
      });

      if (orgId) {
        const supabase = createClient();
        await actualizarContextoOrganizacionCliente(supabase, {
          organizationId: orgId,
          vertical,
          city: ciudad.trim() || null,
        });
      }

      await Promise.all([
        persistirMenuCalibrado(activos),
        sembrarBaseFinancieraSalon().catch(() => null),
      ]);

      registrarEvento('onboarding_completado');
      router.replace('/');
    } catch (err) {
      console.error('[onboarding.activar]', err);
      showToast('No se pudo finalizar la activación. Revisa tu conexión.', 'error');
      setSaving(false);
    }
  };

  const completarDespues = async () => {
    const respaldo =
      serviciosSeleccionados.length > 0
        ? serviciosSeleccionados
        : construirSeleccionPopularPorDefecto(vertical, cityCode, segmento);

    setSaving(true);
    try {
      await updateProfile({
        colorPrimario: COLOR_VELLI,
        servicios: respaldo.map((s) => s.nombre),
        onboardingCompleted: true,
      });
      await Promise.all([
        persistirMenuCalibrado(respaldo),
        sembrarBaseFinancieraSalon().catch(() => null),
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
      <div className="min-h-screen w-full bg-[#FAFAFA] flex items-center justify-center">
        <span className="text-sm font-semibold text-[#52525B]">Preparando tu estudio…</span>
      </div>
    );
  }

  const encabezados = {
    1: {
      titulo: 'Configura la identidad de tu estudio',
      subtitulo:
        'Estos datos encabezan tus comprobantes digitales y conectan el WhatsApp donde recibirás las confirmaciones de tus clientes.',
      icono: <Store size={18} />,
    },
    2: {
      titulo: 'Activa tu menú en 1 minuto',
      subtitulo:
        'Elige la especialidad, ciudad y segmento de tu estudio. Precargamos referencias reales de Colombia que puedes ajustar libremente.',
      icono: <Sparkles size={18} />,
    },
    3: {
      titulo: 'Motor de rentabilidad listo para operar',
      subtitulo:
        'Dejamos calibrada tu base de consumo y comisión para que desde el primer servicio conozcas tu margen real.',
      icono: <FlaskConical size={18} />,
    },
  }[paso];

  const PASOS_INDICADOR = [
    { num: 1 as const, label: '1. Identidad y WhatsApp' },
    { num: 2 as const, label: '2. Menú en 1 minuto' },
    { num: 3 as const, label: '3. Precisión y Activación' },
  ];

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-[#111111] flex flex-col justify-between pb-10">
      {/* Cabecera Base Neutra Veli */}
      <header className="bg-white border-b border-[#E4E4E7] pt-7 pb-6 px-5 sm:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="inline-flex items-center gap-2.5 select-none">
              <div className="w-9 h-9 rounded-lg bg-[#111111] text-white font-sans font-bold text-sm flex items-center justify-center">
                V
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-lg font-bold tracking-tight text-[#111111]">Veli</span>
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold mt-0.5 text-[#71717A]">
                  Rentabilidad & Operaciones
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={completarDespues}
              disabled={saving}
              className="text-xs font-semibold text-[#52525B] hover:text-[#111111] transition-colors cursor-pointer disabled:opacity-50"
            >
              Saltar configuración →
            </button>
          </div>

          <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] leading-tight">
            {encabezados.titulo}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#52525B] leading-relaxed">
            {encabezados.subtitulo}
          </p>
        </div>
      </header>

      {/* Indicador de Progreso */}
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-8 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-[#F4F4F5] p-1.5 rounded-xl border border-[#E4E4E7]">
          {PASOS_INDICADOR.map((item) => {
            const activo = paso === item.num;
            const completado = paso > item.num;
            return (
              <div
                key={item.num}
                className={`px-3 py-2 rounded-lg font-sans text-xs font-bold flex items-center justify-center gap-1.5 text-center transition-colors ${
                  activo
                    ? 'bg-[#111111] text-white'
                    : completado
                      ? 'bg-white text-[#15803D] border border-[#E4E4E7]'
                      : 'text-[#52525B]'
                }`}
              >
                {completado && <Check size={13} className="shrink-0" />}
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contenido por Paso */}
      <main className="w-full max-w-2xl mx-auto px-5 sm:px-8 pt-5 flex-1">
        {paso === 1 && (
          <form
            onSubmit={guardarPaso1}
            className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] space-y-5"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                Nombre del estudio *
              </label>
              <input
                type="text"
                value={nombreSalon}
                onChange={(e) => setNombreSalon(e.target.value)}
                placeholder="Ej. Estudio Norte · Peluquería / Barbería / Spa"
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                Ciudad en Colombia
              </label>
              <input
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ej. Bogotá, Medellín, Cali, Bucaramanga, Pereira…"
                className="w-full px-4 py-3 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                WhatsApp oficial del estudio
              </label>
              <div className="relative">
                <MessageCircle
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#15803D]"
                />
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+57 300 123 4567"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none tabular-nums"
                />
              </div>
              <div className="mt-2.5 p-3 rounded-lg bg-[#F0FDF4] border border-[#15803D]/20 text-xs text-[#111111] leading-relaxed">
                <strong className="text-[#15803D]">Canal directo sin intermediarios:</strong>{' '}
                Recibirás las reservas de tu vitrina <code className="font-mono text-[11px]">/s/[slug]</code> y las
                aceptaciones de cotización <code className="font-mono text-[11px]">/c/[token]</code>.
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 px-6 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{saving ? 'Guardando…' : 'Continuar a tu menú contextual'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <SelectorCatalogoColombia
              modo="onboarding"
              vertical={vertical}
              onChangeVertical={setVertical}
              cityCode={cityCode}
              onChangeCityCode={handleCambiarCityCodeEnSelector}
              segmento={segmento}
              onChangeSegmento={setSegmento}
              onSelectionChange={handleSelectionChange}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaso(1)}
                disabled={saving}
                className="px-5 py-3.5 rounded-lg bg-white border border-[#E4E4E7] text-[#52525B] hover:text-[#111111] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Atrás
              </button>
              <button
                type="button"
                onClick={guardarPaso2}
                disabled={saving}
                className="flex-1 py-3.5 px-6 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {saving
                    ? 'Guardando…'
                    : `Continuar con ${serviciosSeleccionados.length} servicio(s)`}
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E4E4E7]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#52525B]">
                    Calibración Inicial Lista
                  </span>
                  <h2 className="text-lg font-bold text-[#111111] mt-0.5">
                    {nombreSalon.trim() || 'Tu Estudio'} listo para proteger su margen
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#15803D]/25 text-[#15803D] text-[11px] font-bold">
                  Margen real
                </span>
              </div>

              {/* Filosofía "Cada dato cuenta": Nivel 1 -> Nivel 2 */}
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-3">
                <div className="flex items-center gap-2">
                  <Ruler size={16} className="text-[#111111]" />
                  <span className="text-xs font-bold text-[#111111]">
                    {LEMA_CULTURA_DATOS_VELI}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {NIVELES_PRECISION_VELI.map((niv) => (
                    <div
                      key={niv.id}
                      className="p-3 rounded-lg bg-white border border-[#E4E4E7] space-y-1"
                    >
                      <strong className="text-[#111111] block">{niv.etiqueta}</strong>
                      <p className="m-0 text-[#52525B] leading-relaxed">{niv.resumen}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen de lo que se siembra */}
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E4E4E7] text-[#111111] flex items-center justify-center shrink-0">
                    <FlaskConical size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="m-0 font-bold text-[#111111] text-sm">
                      Base de Insumos Colombia 2026 + Escala 1.0x Corto
                    </p>
                    <p className="m-0 text-[#52525B] mt-0.5 leading-relaxed">
                      Dejamos listos costos semilla editables (<span className="font-mono">$320/g</span>{' '}
                      decolorante, <span className="font-mono">$465/g</span> tinte,{' '}
                      <span className="font-mono">$32/ml</span> peróxido,{' '}
                      <span className="font-mono">$280/ml</span> aminoácidos) para no mostrar márgenes falsos del 100%.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E4E4E7] text-[#111111] flex items-center justify-center shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="m-0 font-bold text-[#111111] text-sm">
                      Especialista Inicial y Comisión Saludable (40% sobre neto)
                    </p>
                    <p className="m-0 text-[#52525B] mt-0.5 leading-relaxed">
                      Activamos tu <strong className="text-[#111111]">Especialista Principal</strong>{' '}
                      descontando el insumo químico antes de liquidar comisión.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#111111] text-sm tabular-nums">
                      {serviciosSeleccionados.length}{' '}
                      {serviciosSeleccionados.length === 1
                        ? 'procedimiento listo'
                        : 'procedimientos listos'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaso(2)}
                      className="text-[11px] font-bold text-[#111111] hover:underline cursor-pointer"
                    >
                      Editar selección
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {serviciosSeleccionados.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E4E4E7] text-[11px] text-[#111111]"
                      >
                        <span>{s.nombre}</span>
                        <strong className="text-[#111111] tabular-nums">
                          {formatearPrecioCop(s.precioBaseCop)}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="m-0 text-[11px] text-[#52525B] flex items-center gap-1.5 pt-1">
                <ShieldCheck size={14} className="text-[#15803D] shrink-0" />
                Puedes personalizar marcas, precios y reglas en cualquier momento desde Configuración → Precios.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaso(2)}
                disabled={saving}
                className="px-5 py-3.5 rounded-lg bg-white border border-[#E4E4E7] text-[#52525B] hover:text-[#111111] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Atrás
              </button>
              <button
                type="button"
                onClick={activarSalonYEmpezar}
                disabled={saving}
                className="flex-1 py-4 px-6 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>{saving ? 'Activando estudio…' : 'Activar estudio y empezar'}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
