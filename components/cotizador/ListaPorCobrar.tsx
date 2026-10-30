'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Edit3,
  XCircle,
  Sparkles,
  UserCheck,
  TrendingUp,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';
import type { Clienta } from '@/lib/types';
import { getAllClientas } from '@/lib/db';
import { showToast } from '@/lib/toast';
import {
  listarCotizacionesPorCobrar,
  listarCotizacionesPorClienta,
  listarEstilistas,
  listarServiciosSalon,
  listarPlantillasVigentes,
  listarProductosSalon,
  listarComisionesVigentes,
  sembrarBaseFinancieraSalon,
  registrarCobroCotizacion,
  anularCotizacion,
  formatearPrecioCop,
  calcularCostoProducto,
  calcularComisionYMargen,
  type Cotizacion,
  type EstilistaSalon,
  type ServicioSalon,
  type PlantillaPrecio,
  type ProductoSalon,
  type ComisionSalon,
  type ConsumoPlantillaInput,
} from '@/lib/cotizador';

export interface ListaPorCobrarProps {
  clientaId?: string;
  clientaNombre?: string;
  clientas?: Clienta[];
  estilistas?: EstilistaSalon[];
  refreshKey?: number;
  mostrarVacio?: boolean;
  onIrACotizar?: () => void;
  onCambio?: () => void;
}

export default function ListaPorCobrar({
  clientaId,
  clientaNombre,
  clientas: clientasProp,
  estilistas: estilistasProp,
  refreshKey = 0,
  mostrarVacio = false,
  onIrACotizar,
  onCambio,
}: ListaPorCobrarProps) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>(estilistasProp ?? []);
  const [serviciosMap, setServiciosMap] = useState<Record<string, ServicioSalon>>({});
  const [plantillasMap, setPlantillasMap] = useState<Record<string, PlantillaPrecio>>({});
  const [productos, setProductos] = useState<ProductoSalon[]>([]);
  const [reglasComision, setReglasComision] = useState<ComisionSalon[]>([]);
  const [nombresClientas, setNombresClientas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Selección directa por tarjeta cuando cot.estilistaId viene vacío + panel expandible «Ajustar»
  const [estilistaPorCotizacion, setEstilistaPorCotizacion] = useState<Record<string, string>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [otroValorTexto, setOtroValorTexto] = useState<string>('');
  const [estilistaOverrideId, setEstilistaOverrideId] = useState<string>('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cots, estsRemotas, svcs, plants, prodsRemotos, comsRemotas] = await Promise.all([
        clientaId
          ? listarCotizacionesPorClienta(clientaId).then((todas) =>
              todas.filter((c) => c.estado === 'enviada')
            )
          : listarCotizacionesPorCobrar(),
        estilistasProp && estilistasProp.length > 0
          ? Promise.resolve(estilistasProp)
          : listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
        listarServiciosSalon({ soloActivos: false }).catch(() => [] as ServicioSalon[]),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
        listarProductosSalon({ soloActivos: true }).catch(() => [] as ProductoSalon[]),
        listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
      ]);

      let ests = estsRemotas;
      let prods = prodsRemotos;
      let coms = comsRemotas;
      if (prods.length === 0 || ests.length === 0 || coms.length === 0) {
        const sembrados = await sembrarBaseFinancieraSalon().catch(() => null);
        if (sembrados) {
          if (prods.length === 0) prods = sembrados.productos;
          if (ests.length === 0) ests = sembrados.estilistas;
          if (coms.length === 0) coms = sembrados.comisiones;
        }
      }

      setCotizaciones(cots);
      setEstilistas(ests);

      // Preasignar especialista cuando solo hay 1 activa o conservar la de la cotización
      setEstilistaPorCotizacion((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const c of cots) {
          if (c.estilistaId) {
            next[c.id] = c.estilistaId;
          } else if (!next[c.id] && ests.length === 1) {
            next[c.id] = ests[0].id;
          }
        }
        return next;
      });

      const sMap: Record<string, ServicioSalon> = {};
      for (const s of svcs) sMap[s.id] = s;
      setServiciosMap(sMap);
      const pMap: Record<string, PlantillaPrecio> = {};
      for (const p of plants) pMap[p.servicioId] = p;
      setPlantillasMap(pMap);
      setProductos(prods);
      setReglasComision(coms);

      const mapaNombres: Record<string, string> = {};
      if (clientaId && clientaNombre) mapaNombres[clientaId] = clientaNombre;
      if (clientasProp && clientasProp.length > 0) {
        for (const c of clientasProp) mapaNombres[c.id] = c.nombre;
      } else if (!clientaId && cots.length > 0) {
        const todas = await getAllClientas().catch(() => [] as Clienta[]);
        for (const c of todas) mapaNombres[c.id] = c.nombre;
      }
      setNombresClientas(mapaNombres);
    } catch {
      setCotizaciones([]);
    } finally {
      setCargando(false);
    }
  }, [clientaId, clientaNombre, clientasProp, estilistasProp]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  const calcularInstantaneaCostoYComision = (
    cot: Cotizacion,
    precioCobrado: number,
    estilistaFinalId: string | null
  ) => {
    const srv = cot.servicioId ? serviciosMap[cot.servicioId] : undefined;
    const plant = cot.servicioId ? plantillasMap[cot.servicioId] : undefined;
    const tintePrincipal = productos.find((p) => p.unidad === 'g');
    const oxidantePrincipal = productos.find((p) => p.unidad === 'ml');
    const consumoPlantilla = (plant?.consumo ?? {}) as ConsumoPlantillaInput;
    const resCosto = calcularCostoProducto({
      variables: cot.variables,
      consumo: {
        ...consumoPlantilla,
        usaFormulaColor: srv?.usaFormulaColor ?? consumoPlantilla.usaFormulaColor ?? false,
      },
      productoTinte: tintePrincipal ?? null,
      productoOxidante: oxidantePrincipal ?? null,
    });
    const resComision = calcularComisionYMargen({
      precio: precioCobrado,
      costoProducto: resCosto.costoTotal,
      reglas: reglasComision,
      estilistaId: estilistaFinalId,
      servicioId: cot.servicioId ?? null,
    });
    return {
      costoProductoEstimado: resCosto.costoTotal,
      costoDetalle: resCosto.detalle,
      comisionEstimada: resComision.comision,
      comisionDetalle: resComision.detalle,
    };
  };

  const handleConfirmarCobro = async (cot: Cotizacion, valorCustom?: number) => {
    const monto = valorCustom !== undefined ? valorCustom : cot.precioCotizado;
    if (!Number.isFinite(monto) || monto < 0) {
      showToast('Ingresa un valor cobrado válido', 'error');
      return;
    }

    const estilistaFinalId =
      (editandoId === cot.id
        ? estilistaOverrideId
        : cot.estilistaId || estilistaPorCotizacion[cot.id]) || null;

    if (!estilistaFinalId && estilistas.length > 0) {
      showToast('Selecciona la especialista asignada para liquidar su comisión', 'error');
      return;
    }

    const estObj = estilistas.find((e) => e.id === estilistaFinalId);
    setProcesandoId(cot.id);
    try {
      const snap = calcularInstantaneaCostoYComision(cot, monto, estilistaFinalId);
      await registrarCobroCotizacion(cot.id, {
        precioCobrado: monto,
        estilistaId: estilistaFinalId,
        estilistaNombre: estObj?.nombre ?? cot.estilistaNombre ?? null,
        costoProductoEstimado: snap.costoProductoEstimado,
        costoDetalle: snap.costoDetalle,
        comisionEstimada: snap.comisionEstimada,
        comisionDetalle: snap.comisionDetalle,
      });
      setCotizaciones((prev) => prev.filter((c) => c.id !== cot.id));
      setEditandoId(null);
      showToast(`Cobro confirmado: ${formatearPrecioCop(monto)}`, 'success');
      onCambio?.();
    } catch (err) {
      console.error('[cotizador.cobrar]', err);
      showToast('No se pudo confirmar el cobro', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleAnular = async (cot: Cotizacion) => {
    setProcesandoId(cot.id);
    try {
      await anularCotizacion(cot.id);
      setCotizaciones((prev) => prev.filter((c) => c.id !== cot.id));
      setEditandoId(null);
      showToast('Cotización anulada', 'success');
      onCambio?.();
    } catch (err) {
      console.error('[cotizador.anular]', err);
      showToast('No se pudo anular la cotización', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  if (cargando) {
    if (!mostrarVacio) return null;
    return (
      <section className="bg-white rounded-2xl p-8 border border-[#EFE8E4] text-center shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)]">
        <p className="text-sm text-[#6E6266]">Cargando servicios por cobrar…</p>
      </section>
    );
  }

  if (cotizaciones.length === 0) {
    if (!mostrarVacio) return null;
    return (
      <section className="bg-white rounded-3xl p-10 border border-[#EFE8E4] text-center shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)]">
        <div className="w-12 h-12 rounded-2xl bg-[#F7ECEF] text-[#3B0D1E] mx-auto flex items-center justify-center mb-4">
          <Sparkles size={22} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1E3A]">
          Cierre Financiero en 1 Toque
        </span>
        <h2 className="text-xl font-bold text-[#1C1518] mt-1">Todo al día en caja</h2>
        <p className="text-sm text-[#6E6266] mt-2 max-w-md mx-auto">
          No hay cotizaciones pendientes por cobrar en este momento. Crea una cotización para
          congelar gramos, comisión y margen en 1 toque.
        </p>
        {onIrACotizar && (
          <button
            type="button"
            onClick={onIrACotizar}
            className="mt-5 px-6 py-3 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] text-[#FAF7F5] text-xs font-bold tracking-wide transition-all cursor-pointer"
          >
            Nueva Cotización en Silla
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="mb-8">
      {/* Encabezado de la Pestaña / Bloque de Cierre */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1E3A]">
            Cierre Financiero en 1 Toque
          </span>
          <h2 className="text-xl font-bold text-[#1C1518] tracking-tight mt-0.5">
            Servicios por Cobrar ({cotizaciones.length})
          </h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#F5EFFB] text-[#7C3AED] text-xs font-semibold">
          Congela insumos y comisión
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cotizaciones.map((cot) => {
          const nombreFormula =
            typeof cot.formula?.['clientaNombre'] === 'string'
              ? cot.formula['clientaNombre'].trim()
              : undefined;
          const nombreCli =
            (cot.clientaId ? nombresClientas[cot.clientaId] : undefined) ||
            nombreFormula ||
            clientaNombre ||
            'Clienta en salón';
          const enEdicion = editandoId === cot.id;
          const ocupado = procesandoId === cot.id;

          const seleccionTarjeta = estilistaPorCotizacion[cot.id] ?? '';
          const estilistaActualId = enEdicion
            ? estilistaOverrideId || null
            : cot.estilistaId || seleccionTarjeta || null;
          const est = estilistas.find((e) => e.id === estilistaActualId);
          const nombreEst = est?.nombre ?? cot.estilistaNombre;

          const montoPreview = enEdicion
            ? Number(otroValorTexto.replace(/\D/g, '')) || 0
            : cot.precioCotizado;

          const snapPreview = calcularInstantaneaCostoYComision(
            cot,
            montoPreview,
            estilistaActualId
          );
          const utilidadNeta =
            montoPreview -
            snapPreview.costoProductoEstimado -
            snapPreview.comisionEstimada;
          const margenPct =
            montoPreview > 0 ? Math.round((utilidadNeta / montoPreview) * 100) : 0;
          const esRentable = margenPct >= 30;
          const consentimientoAceptado =
            cot.perfilExtendido?.['consentimientoAceptado'] === true;
          const enviadaPorWhatsApp =
            cot.formula?.['enviadaPorWhatsApp'] === true || consentimientoAceptado;

          return (
            <article
              key={cot.id}
              className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_12px_32px_-8px_rgba(59,13,30,0.07)] flex flex-col justify-between gap-4"
            >
              {/* Cabecera de la Cotización */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {!clientaId && (
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6E1E3A]">
                        {nombreCli}
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-[#1C1518] leading-snug mt-0.5">
                      {cot.servicioNombre}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {nombreEst && (
                        <div className="inline-flex items-center gap-1 text-xs text-[#6E6266]">
                          <UserCheck className="text-[#3B0D1E]" size={13} />
                          <span>{nombreEst}</span>
                        </div>
                      )}
                      {consentimientoAceptado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF6F4] text-[#0D7A70] text-[10px] font-bold">
                          <ShieldCheck size={11} />
                          Consentimiento aceptado
                        </span>
                      ) : enviadaPorWhatsApp ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5EFFB] text-[#7C3AED] text-[10px] font-semibold">
                          <MessageCircle size={11} />
                          Enviada por WhatsApp
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Badge No Punitivo de Rentabilidad */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shrink-0 tabular-nums ${
                      esRentable
                        ? 'bg-[#EAF6F4] text-[#0D9488]'
                        : 'bg-[#FDF2EC] text-[#D97757]'
                    }`}
                  >
                    <TrendingUp size={12} /> {margenPct}% margen
                  </span>
                </div>

                {/* Resumen BI antes de cerrar */}
                <div className="mt-4 p-3.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] grid grid-cols-3 gap-2 text-xs tabular-nums">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#6E6266] block">
                      Química (IA)
                    </span>
                    <span className="font-bold text-[#7C3AED]">
                      {formatearPrecioCop(snapPreview.costoProductoEstimado)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#6E6266] block">
                      Comisión
                    </span>
                    <span className="font-bold text-[#1C1518]">
                      {formatearPrecioCop(snapPreview.comisionEstimada)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#6E6266] block">
                      Utilidad Salón
                    </span>
                    <span
                      className={`font-bold ${
                        esRentable ? 'text-[#0D9488]' : 'text-[#D97757]'
                      }`}
                    >
                      {formatearPrecioCop(utilidadNeta)}
                    </span>
                  </div>
                </div>

                {/* Selector directo en tarjeta cuando la cotización no trae especialista asignada */}
                {!enEdicion && !cot.estilistaId && estilistas.length > 0 && (
                  <div className="mt-3">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6E1E3A] mb-1">
                      <UserCheck size={12} />
                      Especialista asignada para liquidación
                    </label>
                    <select
                      value={seleccionTarjeta}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEstilistaPorCotizacion((prev) => ({ ...prev, [cot.id]: val }));
                        setEstilistaOverrideId(val);
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F5] border border-[#DFC5CE] text-xs font-semibold text-[#1C1518] outline-none focus:border-[#3B0D1E]"
                    >
                      <option value="">Seleccionar especialista…</option>
                      {estilistas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Acciones de Cierre en 1 Toque o Edición */}
              {!enEdicion ? (
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => handleConfirmarCobro(cot)}
                    className="flex-1 py-3 px-4 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-60 text-[#FAF7F5] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer tabular-nums"
                  >
                    {ocupado ? <Sparkles size={15} /> : <Check size={15} />}
                    <span>Cobrado {formatearPrecioCop(cot.precioCotizado)}</span>
                  </button>

                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => {
                      setEditandoId(cot.id);
                      setOtroValorTexto(String(cot.precioCotizado));
                      setEstilistaOverrideId(cot.estilistaId || seleccionTarjeta || '');
                    }}
                    className="py-3 px-4 rounded-full bg-[#FAF7F5] hover:bg-[#E8CFC8]/40 border border-[#EFE8E4] text-[#1C1518] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Ajustar</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-[#EFE8E4] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6E6266] mb-1">
                        Valor final cobrado ($ COP)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={otroValorTexto}
                        onChange={(e) => setOtroValorTexto(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm font-bold text-[#1C1518] tabular-nums"
                      />
                    </div>

                    {estilistas.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6E6266] mb-1">
                          Especialista asignada
                        </label>
                        <select
                          value={estilistaOverrideId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEstilistaOverrideId(val);
                            setEstilistaPorCotizacion((prev) => ({ ...prev, [cot.id]: val }));
                          }}
                          className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm text-[#1C1518]"
                        >
                          <option value="">Seleccionar especialista…</option>
                          {estilistas.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() =>
                          handleConfirmarCobro(
                            cot,
                            Number(otroValorTexto.replace(/\D/g, ''))
                          )
                        }
                        className="py-2.5 px-4 rounded-full bg-[#0D9488] hover:bg-[#0D7A70] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check size={14} /> Confirmar cierre
                      </button>

                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => setEditandoId(null)}
                        className="py-2.5 px-3.5 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6E6266] font-semibold text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => handleAnular(cot)}
                      className="text-xs font-semibold text-[#D97757] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle size={13} /> Anular
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
