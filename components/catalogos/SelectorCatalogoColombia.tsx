'use client';

import React, { useMemo, useState } from 'react';
import { Check, Search, ShieldAlert, Info, Plus } from 'lucide-react';
import type { VerticalSalon } from '@/lib/flags/verticales';
import {
  buscarEnCatalogoMaestro,
  listarCatalogoPorVertical,
  normalizarTextoBusqueda,
  type ProcedimientoCatalogoMaestro,
} from '@/lib/catalogos/catalogoMaestroColombia';
import {
  AVISO_ALCANCE_ORIENTACION_PREVENTIVA,
  CIUDADES_COLOMBIA,
  SEGMENTOS_MERCADO_COLOMBIA,
  calcularPrecioContextualColombia,
  validarTerminosRestringidosColombia,
  type CodigoCiudadColombia,
  type SegmentoMercadoColombia,
} from '@/lib/catalogos/referenciasMercadoColombia';
import { formatearPrecioCop, type CategoriaServicioDB } from '@/lib/cotizador';

export interface ItemCatalogoSeleccionado {
  id: string;
  nombre: string;
  categoriaDb: CategoriaServicioDB;
  precioBaseCop: number;
  duracionMin: number;
  usaSinBascula: boolean;
  gramosBase: number | null;
  unidadBase: 'g' | 'ml' | null;
  esPrecioDesde: boolean;
  cicloRetornoDias: number;
  costTrackingMode: string;
  esPersonalizado?: boolean;
}

const OPCIONES_VERTICAL: ReadonlyArray<{ id: VerticalSalon; label: string }> = [
  { id: 'hair_studio', label: 'Peluquería y Color' },
  { id: 'barber_studio', label: 'Barbería' },
  { id: 'nail_bar', label: 'Uñas, Cejas y Pestañas' },
  { id: 'spa_estetica', label: 'Spa y Estética' },
  { id: 'beauty_lounge', label: 'Maquillaje y Eventos' },
];

export function mapearCategoriaCatalogoADb(
  proc: Pick<ProcedimientoCatalogoMaestro, 'vertical' | 'categoria' | 'usa_sin_bascula' | 'id'>
): CategoriaServicioDB {
  const cat = normalizarTextoBusqueda(proc.categoria);
  const id = proc.id;
  if (cat.includes('decoloracion') || id.includes('balayage') || id.includes('platinado')) {
    return 'decoloracion';
  }
  if (cat.includes('color') || cat.includes('canas')) return 'color';
  if (cat.includes('alisado') || cat.includes('keratina')) return 'alisado';
  if (cat.includes('rizo') || cat.includes('textura')) return 'rizos';
  if (cat.includes('corte')) return 'corte';
  if (cat.includes('cepillado') || cat.includes('peinado') || cat.includes('onda')) {
    return 'peinado';
  }
  if (id.includes('detox-cuero-cabelludo')) return 'cuero_cabelludo';
  if (cat.includes('tratamiento')) return 'tratamiento';
  return 'otro';
}

interface SelectorCatalogoColombiaProps {
  modo: 'onboarding' | 'importacion';
  vertical: VerticalSalon;
  onChangeVertical: (vertical: VerticalSalon) => void;
  cityCode: CodigoCiudadColombia;
  onChangeCityCode: (city: CodigoCiudadColombia) => void;
  segmento: SegmentoMercadoColombia;
  onChangeSegmento: (seg: SegmentoMercadoColombia) => void;
  nombresYaExistentes?: readonly string[];
  onSelectionChange?: (items: ItemCatalogoSeleccionado[]) => void;
  onConfirmImport?: (items: ItemCatalogoSeleccionado[]) => Promise<void> | void;
  importando?: boolean;
}

export default function SelectorCatalogoColombia({
  modo,
  vertical,
  onChangeVertical,
  cityCode,
  onChangeCityCode,
  segmento,
  onChangeSegmento,
  nombresYaExistentes = [],
  onSelectionChange,
  onConfirmImport,
  importando = false,
}: SelectorCatalogoColombiaProps) {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS');
  const [confirmacionReps, setConfirmacionReps] = useState(false);

  // Estado de selección por ID de catálogo y precios editados manualmente
  const [seleccionadosIds, setSeleccionadosIds] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {};
    const existentesNorm = new Set(nombresYaExistentes.map(normalizarTextoBusqueda));
    for (const item of listarCatalogoPorVertical(vertical)) {
      if (
        item.popular &&
        item.veli_guardrail_action !== 'restrict_require_reps_health_license' &&
        !existentesNorm.has(normalizarTextoBusqueda(item.nombre))
      ) {
        inicial[item.id] = true;
      }
    }
    return inicial;
  });

  const [preciosManuales, setPreciosManuales] = useState<Record<string, number>>({});
  const [personalizados, setPersonalizados] = useState<ItemCatalogoSeleccionado[]>([]);

  // Alta manual con validación preventiva
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [errorTerminoRestringido, setErrorTerminoRestringido] = useState<string | null>(null);

  const existentesSet = useMemo(
    () => new Set(nombresYaExistentes.map(normalizarTextoBusqueda)),
    [nombresYaExistentes]
  );

  const todosVertical = useMemo(() => listarCatalogoPorVertical(vertical), [vertical]);

  const categoriasDisponibles = useMemo(() => {
    const unicas = Array.from(new Set(todosVertical.map((i) => i.categoria)));
    return ['TODAS', ...unicas];
  }, [todosVertical]);

  const itemsVisibles = useMemo(() => {
    const filtradosTexto = buscarEnCatalogoMaestro(busqueda, vertical);
    if (categoriaFiltro === 'TODAS') return filtradosTexto;
    return filtradosTexto.filter((i) => i.categoria === categoriaFiltro);
  }, [busqueda, vertical, categoriaFiltro]);

  // Calcular referencia contextual de la combinación ciudad + vertical + segmento
  const muestraContexto = useMemo(() => {
    const ref = todosVertical[0];
    if (!ref) return null;
    return calcularPrecioContextualColombia({
      procedimiento: ref,
      cityCode,
      segmento,
    });
  }, [todosVertical, cityCode, segmento]);

  const tieneItemsRepsEnVertical = useMemo(
    () =>
      todosVertical.some(
        (i) => i.veli_guardrail_action === 'restrict_require_reps_health_license'
      ),
    [todosVertical]
  );

  // Construir lista final consolidada y notificar al padre cuando cambia
  const listaSeleccionadaFinal = useMemo((): ItemCatalogoSeleccionado[] => {
    const delCatalogo: ItemCatalogoSeleccionado[] = [];
    for (const proc of todosVertical) {
      if (!seleccionadosIds[proc.id]) continue;
      if (existentesSet.has(normalizarTextoBusqueda(proc.nombre))) continue;
      if (
        proc.veli_guardrail_action === 'restrict_require_reps_health_license' &&
        !confirmacionReps
      ) {
        continue;
      }
      const ref = calcularPrecioContextualColombia({
        procedimiento: proc,
        cityCode,
        segmento,
      });
      const precioEfectivo = preciosManuales[proc.id] ?? ref.precioSugeridoCop;
      delCatalogo.push({
        id: proc.id,
        nombre: proc.nombre,
        categoriaDb: mapearCategoriaCatalogoADb(proc),
        precioBaseCop: precioEfectivo,
        duracionMin: proc.duracion_min,
        usaSinBascula: proc.usa_sin_bascula,
        gramosBase: proc.gramos_base_sugeridos,
        unidadBase: proc.unidad_base,
        esPrecioDesde: proc.es_precio_desde,
        cicloRetornoDias: proc.ciclo_retorno_dias,
        costTrackingMode: proc.cost_tracking_mode,
      });
    }
    return [...personalizados, ...delCatalogo];
  }, [
    todosVertical,
    seleccionadosIds,
    existentesSet,
    confirmacionReps,
    cityCode,
    segmento,
    preciosManuales,
    personalizados,
  ]);

  React.useEffect(() => {
    onSelectionChange?.(listaSeleccionadaFinal);
  }, [listaSeleccionadaFinal, onSelectionChange]);

  const cambiarVertical = (nuevaVertical: VerticalSalon) => {
    onChangeVertical(nuevaVertical);
    setCategoriaFiltro('TODAS');
    setBusqueda('');
    // Si cambia de vertical en onboarding, precargar el pack popular de esa vertical
    const nuevos: Record<string, boolean> = {};
    for (const item of listarCatalogoPorVertical(nuevaVertical)) {
      if (
        item.popular &&
        item.veli_guardrail_action !== 'restrict_require_reps_health_license' &&
        !existentesSet.has(normalizarTextoBusqueda(item.nombre))
      ) {
        nuevos[item.id] = true;
      }
    }
    setSeleccionadosIds(nuevos);
  };

  const toggleItem = (proc: ProcedimientoCatalogoMaestro) => {
    if (existentesSet.has(normalizarTextoBusqueda(proc.nombre))) return;
    if (
      proc.veli_guardrail_action === 'restrict_require_reps_health_license' &&
      !confirmacionReps
    ) {
      return;
    }
    setSeleccionadosIds((prev) => ({ ...prev, [proc.id]: !prev[proc.id] }));
  };

  const editarPrecioItem = (id: string, valorTexto: string) => {
    const limpio = Number(valorTexto.replace(/\D/g, '')) || 0;
    setPreciosManuales((prev) => ({ ...prev, [id]: limpio }));
  };

  const agregarPersonalizado = () => {
    const limpio = nuevoNombre.trim();
    if (!limpio) return;

    const validacion = validarTerminosRestringidosColombia(limpio);
    if (!validacion.permitido) {
      setErrorTerminoRestringido(validacion.orientacionPreventiva);
      return;
    }
    setErrorTerminoRestringido(null);

    if (
      existentesSet.has(normalizarTextoBusqueda(limpio)) ||
      personalizados.some((p) => normalizarTextoBusqueda(p.nombre) === normalizarTextoBusqueda(limpio))
    ) {
      return;
    }

    const monto = Math.max(10000, Number(nuevoPrecio.replace(/\D/g, '')) || 65000);
    const nuevo: ItemCatalogoSeleccionado = {
      id: `custom-${Date.now()}`,
      nombre: limpio,
      categoriaDb: 'otro',
      precioBaseCop: monto,
      duracionMin: 60,
      usaSinBascula: false,
      gramosBase: null,
      unidadBase: null,
      esPrecioDesde: false,
      cicloRetornoDias: 30,
      costTrackingMode: 'consumibles_fijos',
      esPersonalizado: true,
    };
    setPersonalizados((prev) => [nuevo, ...prev]);
    setNuevoNombre('');
    setNuevoPrecio('');
  };

  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 sm:p-5 space-y-4 text-[#111111]">
      {/* 1. Contexto: Vertical + Ciudad + Segmento */}
      <div className="space-y-3 pb-4 border-b border-[#E4E4E7]">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
            Especialidad principal del estudio
          </span>
          <div className="flex flex-wrap gap-1.5">
            {OPCIONES_VERTICAL.map((op) => {
              const activa = vertical === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => cambiarVertical(op.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    activa
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="selector-ciudad-colombia"
              className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1"
            >
              Ciudad de referencia (Colombia)
            </label>
            <select
              id="selector-ciudad-colombia"
              value={cityCode}
              onChange={(e) => onChangeCityCode(e.target.value as CodigoCiudadColombia)}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-xs font-semibold text-[#111111] focus:bg-white focus:border-[#111111]"
            >
              {CIUDADES_COLOMBIA.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1">
              Segmento tarifario sugerido
            </span>
            <div className="grid grid-cols-3 gap-1 bg-[#F4F4F5] p-1 rounded-lg border border-[#E4E4E7]">
              {SEGMENTOS_MERCADO_COLOMBIA.map((seg) => {
                const activo = segmento === seg.id;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => onChangeSegmento(seg.id)}
                    className={`min-h-[32px] px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      activo
                        ? 'bg-[#111111] text-white'
                        : 'text-[#52525B] hover:text-[#111111]'
                    }`}
                  >
                    {seg.id === 'economico'
                      ? 'Económico'
                      : seg.id === 'estandar'
                        ? 'Estándar'
                        : 'Premium'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {muestraContexto?.avisoTransparencia && (
          <div className="p-2.5 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] flex items-start gap-2 text-xs text-[#52525B]">
            <Info size={14} className="text-[#52525B] shrink-0 mt-0.5" />
            <span>
              {muestraContexto.avisoTransparencia}. Conservas control total para ajustar cada tarifa.
            </span>
          </div>
        )}
      </div>

      {/* 2. Buscador por sinónimos colombianos + Filtro de categorías */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar procedimiento o sinónimo (ej. blower, fade, rubber, capul, cejas)…"
            className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-xs text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 v-noscroll">
          {categoriasDisponibles.map((cat) => {
            const activa = categoriaFiltro === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaFiltro(cat)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                  activa
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:text-[#111111]'
                }`}
              >
                {cat === 'TODAS' ? 'Todas las categorías' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Guardarraíl de habilitación en salud REPS (solo visible cuando aplica) */}
      {tieneItemsRepsEnVertical && (
        <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] space-y-2">
          <div className="flex items-start gap-2 text-xs text-[#52525B]">
            <ShieldAlert size={15} className="text-[#B45309] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#111111]">
                Procedimientos sujetos a habilitación en salud (REPS):
              </strong>{' '}
              Opciones como láser diodo, microneedling con agujas o drenaje postoperatorio permanecen
              desmarcadas por defecto. {AVISO_ALCANCE_ORIENTACION_PREVENTIVA}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#111111] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={confirmacionReps}
              onChange={(e) => setConfirmacionReps(e.target.checked)}
              className="w-4 h-4 accent-[#111111] cursor-pointer"
            />
            <span>
              Mi establecimiento cuenta con habilitación REPS vigente y profesional en RETHUS
            </span>
          </label>
        </div>
      )}

      {/* 4. Lista de procedimientos con edición en línea */}
      <div className="divide-y divide-[#E4E4E7] max-h-[420px] overflow-y-auto pr-1">
        {personalizados.map((custom) => (
          <div key={custom.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-5 h-5 rounded-md bg-[#111111] text-white flex items-center justify-center shrink-0">
                <Check size={12} />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#111111] truncate">{custom.nombre}</div>
                <span className="text-[11px] text-[#71717A]">Servicio propio del estudio</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#111111] tabular-nums">
                {formatearPrecioCop(custom.precioBaseCop)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPersonalizados((prev) => prev.filter((p) => p.id !== custom.id))
                }
                className="text-[11px] font-semibold text-[#71717A] hover:text-[#DC2626] cursor-pointer"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}

        {itemsVisibles.map((proc) => {
          const yaExiste = existentesSet.has(normalizarTextoBusqueda(proc.nombre));
          const requiereReps =
            proc.veli_guardrail_action === 'restrict_require_reps_health_license';
          const bloqueadoReps = requiereReps && !confirmacionReps;
          const seleccionado = Boolean(seleccionadosIds[proc.id]) && !yaExiste && !bloqueadoReps;

          const refContextual = calcularPrecioContextualColombia({
            procedimiento: proc,
            cityCode,
            segmento,
          });
          const precioMostrado = preciosManuales[proc.id] ?? refContextual.precioSugeridoCop;

          return (
            <div
              key={proc.id}
              className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                yaExiste || bloqueadoReps ? 'opacity-55' : ''
              }`}
            >
              <button
                type="button"
                disabled={yaExiste || bloqueadoReps}
                onClick={() => toggleItem(proc)}
                className="flex items-start gap-2.5 text-left flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed"
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                    seleccionado
                      ? 'bg-[#111111] border-[#111111] text-white'
                      : 'bg-[#FAFAFA] border-[#E4E4E7] text-transparent'
                  }`}
                >
                  <Check size={12} />
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-[#111111]">
                      {proc.nombre}
                    </span>
                    <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
                      · {proc.duracion_min} min
                    </span>
                    {proc.usa_sin_bascula && proc.gramos_base_sugeridos && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#F4F4F5] border border-[#E4E4E7] font-mono text-[10px] font-semibold text-[#52525B] tabular-nums">
                        Base {proc.gramos_base_sugeridos} {proc.unidad_base ?? 'g'}
                      </span>
                    )}
                    {yaExiste && (
                      <span className="px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#52525B] text-[10px] font-bold">
                        Ya en tu menú
                      </span>
                    )}
                  </div>

                  <p className="m-0 text-[11px] text-[#71717A] leading-snug">
                    {proc.descripcion_corta}
                  </p>

                  {/* Badges discretos de guardarraíl solo donde aplican */}
                  {proc.veli_guardrail_action === 'allow_with_chemical_or_patch_consent' && (
                    <span className="inline-block text-[10px] font-semibold text-[#52525B]">
                      Sugerido: consentimiento químico / prueba de sensibilidad
                    </span>
                  )}
                  {proc.veli_guardrail_action ===
                    'allow_with_cosmetologist_and_invima_warning' && (
                    <span className="inline-block text-[10px] font-semibold text-[#52525B]">
                      Verificar registro NSOC / INVIMA vigente en insumos y equipos
                    </span>
                  )}
                  {requiereReps && (
                    <span className="inline-block text-[10px] font-semibold text-[#B45309]">
                      Requiere habilitación en salud REPS (Res. 3100/2019)
                    </span>
                  )}
                </div>
              </button>

              <div className="flex items-center justify-between sm:justify-end gap-2 pl-7 sm:pl-0 shrink-0">
                <span className="text-[10px] text-[#71717A] tabular-nums">
                  Ref: {formatearPrecioCop(refContextual.rangoMinCop)}–
                  {formatearPrecioCop(refContextual.rangoMaxCop)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-[#52525B]">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!seleccionado}
                    value={precioMostrado.toLocaleString('es-CO')}
                    onChange={(e) => editarPrecioItem(proc.id, e.target.value)}
                    aria-label={`Tarifa base de ${proc.nombre}`}
                    className="w-24 sm:w-28 px-2.5 py-1.5 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-right text-xs font-bold text-[#111111] tabular-nums focus:bg-white focus:border-[#111111] disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Alta manual rápida con validador preventivo de sustancias restringidas */}
      <div className="pt-3 border-t border-[#E4E4E7] space-y-2">
        <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
          ¿Ofreces otro servicio propio? Agrégalo
        </span>
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => {
              setNuevoNombre(e.target.value);
              if (errorTerminoRestringido) setErrorTerminoRestringido(null);
            }}
            placeholder="Nombre del servicio (ej. Hidratación con ozono)"
            className="flex-1 min-w-[160px] min-h-[40px] px-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-xs text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111]"
          />
          <input
            type="text"
            inputMode="numeric"
            value={nuevoPrecio}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setNuevoPrecio(v ? Number(v).toLocaleString('es-CO') : '');
            }}
            placeholder="$ COP"
            className="w-28 min-h-[40px] px-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-xs font-semibold text-[#111111] placeholder-[#71717A] tabular-nums focus:bg-white focus:border-[#111111]"
          />
          <button
            type="button"
            onClick={agregarPersonalizado}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#E4E4E7] text-[#111111] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>

        {errorTerminoRestringido && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#DC2626] leading-relaxed"
          >
            {errorTerminoRestringido}
          </div>
        )}
      </div>

      {/* 6. Acción directa cuando se usa en modo importación (/configuracion/precios) */}
      {modo === 'importacion' && onConfirmImport && (
        <div className="pt-3 border-t border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#52525B] tabular-nums">
            <strong className="text-[#111111]">{listaSeleccionadaFinal.length}</strong>{' '}
            {listaSeleccionadaFinal.length === 1
              ? 'procedimiento nuevo por agregar'
              : 'procedimientos nuevos por agregar'}{' '}
            (sin alterar tus tarifas actuales)
          </span>
          <button
            type="button"
            disabled={importando || listaSeleccionadaFinal.length === 0}
            onClick={() => onConfirmImport(listaSeleccionadaFinal)}
            className="min-h-[42px] px-5 py-2 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            {importando
              ? 'Importando servicios…'
              : `Agregar ${listaSeleccionadaFinal.length} al menú del estudio`}
          </button>
        </div>
      )}
    </div>
  );
}
