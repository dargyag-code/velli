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
import type { OrgRole } from '@/lib/organizations';
import { showToast } from '@/lib/toast';
import { obtenerOrganizacionActivaPanel } from '@/lib/vitrina';
import {
  listarCotizacionesPorCobrar,
  listarCotizacionesPorClienta,
  listarCotizacionesOperativasSilla,
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
import {
  obtenerSemillaServicio,
} from '@/lib/semilla-financiera';

export interface ListaPorCobrarProps {
  clientaId?: string;
  clientaNombre?: string;
  clientas?: Clienta[];
  estilistas?: EstilistaSalon[];
  organizationId?: string;
  rolOrganizacion?: OrgRole | null;
  refreshKey?: number;
  mostrarVacio?: boolean;
  onIrACotizar?: () => void;
  onCambio?: () => void;
  onCountChange?: (count: number) => void;
}

export default function ListaPorCobrar({
  clientaId,
  clientaNombre,
  clientas: clientasProp,
  estilistas: estilistasProp,
  organizationId: orgIdProp,
  rolOrganizacion: rolProp,
  refreshKey = 0,
  mostrarVacio = false,
  onIrACotizar,
  onCambio,
  onCountChange,
}: ListaPorCobrarProps) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [rolEfectivo, setRolEfectivo] = useState<OrgRole | null>(rolProp ?? null);
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
      let orgId = orgIdProp;
      let rolActual = rolProp;
      if (rolActual === undefined || !orgId) {
        const orgResuelta = await obtenerOrganizacionActivaPanel().catch(() => null);
        if (orgResuelta) {
          orgId = orgId ?? orgResuelta.id;
          rolActual = rolActual ?? orgResuelta.role;
        }
      }
      setRolEfectivo(rolActual ?? null);
      const esSpecialist = rolActual === 'specialist';

      if (esSpecialist && orgId) {
        const [cotsOperativas, estsRemotas] = await Promise.all([
          listarCotizacionesOperativasSilla(orgId, {
            soloPorCobrar: true,
            clientaId,
          }).catch(() => [] as Cotizacion[]),
          estilistasProp && estilistasProp.length > 0
            ? Promise.resolve(estilistasProp)
            : listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
        ]);

        setCotizaciones(cotsOperativas);
        onCountChange?.(cotsOperativas.length);
        setEstilistas(estsRemotas);

        const mapaNombresSpec: Record<string, string> = {};
        if (clientaId && clientaNombre) mapaNombresSpec[clientaId] = clientaNombre;
        if (clientasProp && clientasProp.length > 0) {
          for (const c of clientasProp) mapaNombresSpec[c.id] = c.nombre;
        } else if (!clientaId && cotsOperativas.length > 0) {
          const todas = await getAllClientas().catch(() => [] as Clienta[]);
          for (const c of todas) mapaNombresSpec[c.id] = c.nombre;
        }
        setNombresClientas(mapaNombresSpec);
        return;
      }

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
      onCountChange?.(cots.length);
      setEstilistas(ests);

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
      onCountChange?.(0);
    } finally {
      setCargando(false);
    }
  }, [clientaId, clientaNombre, clientasProp, estilistasProp, orgIdProp, rolProp, onCountChange]);

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
    const semilla = obtenerSemillaServicio({
      nombre: srv?.nombre ?? cot.servicioNombre,
      categoria: srv?.categoria,
    });
    const tintePrincipal = productos.find((p) => p.unidad === 'g');
    const oxidantePrincipal = productos.find((p) => p.unidad === 'ml');
    const consumoPlantilla = (plant?.consumo ?? {}) as ConsumoPlantillaInput;

    const gramosGuardados =
      typeof cot.formula?.['gramosTinte'] === 'number' && cot.formula['gramosTinte'] > 0
        ? (cot.formula['gramosTinte'] as number)
        : null;

    const resCosto = calcularCostoProducto({
      variables: cot.variables,
      consumo: {
        gramosTinteBase: consumoPlantilla.gramosTinteBase ?? semilla.gramosBase,
        proporcionOxidante: consumoPlantilla.proporcionOxidante ?? semilla.ratioPeroxido,
        insumosFijos:
          typeof consumoPlantilla.insumosFijos === 'number' && consumoPlantilla.insumosFijos > 0
            ? consumoPlantilla.insumosFijos
            : semilla.insumosFijosCop,
        usaFormulaColor: srv?.usaFormulaColor ?? consumoPlantilla.usaFormulaColor ?? true,
      },
      formulaFinal:
        gramosGuardados !== null
          ? {
              componentes: [{ descripcion: cot.servicioNombre, gramos: gramosGuardados }],
              proporcion: consumoPlantilla.proporcionOxidante ?? semilla.ratioPeroxido,
            }
          : null,
      aplicarFactoresAFormula: gramosGuardados !== null ? false : true,
      productoTinte: tintePrincipal
        ? { ...tintePrincipal, precioUnitario: semilla.costoGramoBaseCop }
        : {
            nombre: cot.servicioNombre,
            unidad: 'g',
            precioUnitario: semilla.costoGramoBaseCop,
          },
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
      setCotizaciones((prev) => {
        const next = prev.filter((c) => c.id !== cot.id);
        onCountChange?.(next.length);
        return next;
      });
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
      setCotizaciones((prev) => {
        const next = prev.filter((c) => c.id !== cot.id);
        onCountChange?.(next.length);
        return next;
      });
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
      <section className="bg-white rounded-2xl p-8 border border-[#EFE8E4] text-center shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]">
        <p className="font-sans text-sm text-[#6B535C]">Cargando servicios por cobrar…</p>
      </section>
    );
  }

  if (cotizaciones.length === 0) {
    if (!mostrarVacio) return null;
    return (
      <section className="bg-white rounded-3xl p-10 border border-[#EFE8E4] text-center shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]">
        <div className="w-12 h-12 rounded-2xl bg-[#F5EBE8] text-[#3B0D1E] mx-auto flex items-center justify-center mb-4">
          <Sparkles size={22} />
        </div>
        <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
          Cierre Financiero en 1 Toque
        </span>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-[#3B0D1E] mt-1">
          Todo al día en caja
        </h2>
        <p className="font-sans text-sm text-[#6B535C] mt-2 max-w-md mx-auto">
          {rolEfectivo === 'specialist'
            ? 'No hay servicios pendientes de cierre en este momento.'
            : 'No hay cotizaciones pendientes por cobrar en este momento. Crea una cotización en silla para congelar gramos, comisión y utilidad neta en 1 toque.'}
        </p>
        {onIrACotizar && (
          <button
            type="button"
            onClick={onIrACotizar}
            className="mt-6 min-h-[46px] px-6 py-3 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold tracking-wide transition-all cursor-pointer shadow-[0_10px_30px_-5px_rgba(59,13,30,0.18)]"
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
            {rolEfectivo === 'specialist'
              ? 'Cola Operativa de Silla'
              : 'Cierre Financiero en 1 Toque'}
          </span>
          <h2 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E] mt-0.5 tabular-nums">
            Servicios por Cobrar ({cotizaciones.length})
          </h2>
        </div>
        {rolEfectivo !== 'specialist' && (
          <span className="px-3 py-1.5 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] font-sans text-xs font-semibold">
            Congela insumos y comisión
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
          const gramosEstimados =
            snapPreview.costoDetalle.gramosTinte > 0
              ? Math.round(snapPreview.costoDetalle.gramosTinte)
              : null;

          return (
            <article
              key={cot.id}
              className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)] flex flex-col justify-between gap-4"
            >
              {/* Cabecera de la Cotización */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {!clientaId && (
                      <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                        {nombreCli}
                      </span>
                    )}
                    <h3 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#3B0D1E] leading-snug mt-0.5 capitalize">
                      {cot.servicioNombre}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {nombreEst && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5EBE8] text-xs font-semibold text-[#3B0D1E] capitalize">
                          <UserCheck className="text-[#3B0D1E]" size={13} />
                          <span>{nombreEst}</span>
                        </div>
                      )}
                      {gramosEstimados !== null && (
                        <span className="px-2.5 py-1 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] font-mono text-xs font-semibold tabular-nums">
                          {gramosEstimados}g
                        </span>
                      )}
                      {consentimientoAceptado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0FDFA] text-[#0D9488] text-[11px] font-bold">
                          <ShieldCheck size={12} />
                          Confirmada ✓
                        </span>
                      ) : enviadaPorWhatsApp ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-[11px] font-semibold">
                          <MessageCircle size={12} />
                          Enviada WA
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Badge No Punitivo de Rentabilidad (oculto para specialist) */}
                  {rolEfectivo !== 'specialist' ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 shrink-0 tabular-nums ${
                        esRentable
                          ? 'bg-[#F0FDFA] text-[#0D9488]'
                          : 'bg-[#FFF7F5] text-[#D97757]'
                      }`}
                    >
                      <TrendingUp size={13} /> {margenPct}%
                    </span>
                  ) : (
                    <span className="font-display text-lg font-bold text-[#3B0D1E] shrink-0 tabular-nums">
                      {formatearPrecioCop(cot.precioCotizado)}
                    </span>
                  )}
                </div>

                {/* Resumen BI antes de cerrar (estrictamente oculto para specialist) */}
                {rolEfectivo !== 'specialist' && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] grid grid-cols-3 gap-2 text-xs tabular-nums">
                    <div>
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                        Química
                      </span>
                      <span className="font-bold text-[#7C3AED] mt-0.5 block">
                        {formatearPrecioCop(snapPreview.costoProductoEstimado)}
                      </span>
                    </div>
                    <div>
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                        Comisión
                      </span>
                      <span className="font-bold text-[#3B0D1E] mt-0.5 block">
                        {formatearPrecioCop(snapPreview.comisionEstimada)}
                      </span>
                    </div>
                    <div>
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                        Utilidad Neta
                      </span>
                      <span
                        className={`font-bold mt-0.5 block ${
                          esRentable ? 'text-[#0D9488]' : 'text-[#D97757]'
                        }`}
                      >
                        {formatearPrecioCop(utilidadNeta)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Píldoras táctiles cuando la cotización no trae especialista asignada */}
                {rolEfectivo !== 'specialist' &&
                  !enEdicion &&
                  !cot.estilistaId &&
                  estilistas.length > 0 && (
                  <div className="mt-3.5">
                    <label className="flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-2">
                      <UserCheck size={13} className="text-[#3B0D1E]" />
                      Especialista asignada para liquidación
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {estilistas.map((e) => {
                        const activa = seleccionTarjeta === e.id;
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => {
                              setEstilistaPorCotizacion((prev) => ({ ...prev, [cot.id]: e.id }));
                              setEstilistaOverrideId(e.id);
                            }}
                            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer capitalize ${
                              activa
                                ? 'bg-[#F5EBE8] border-[#3B0D1E] text-[#3B0D1E]'
                                : 'bg-[#FAF7F5] border-[#EFE8E4] text-[#6B535C] hover:text-[#3B0D1E]'
                            }`}
                          >
                            {e.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones de Cierre en 1 Toque o Vista Operativa de Specialist */}
              {rolEfectivo === 'specialist' ? (
                <div className="pt-2 border-t border-[#EFE8E4] flex items-center justify-between gap-2 text-xs text-[#6B535C]">
                  <span>En espera de cierre en recepción</span>
                  <span className="font-mono font-semibold text-[#3B0D1E] tabular-nums">
                    Válida hasta {cot.vigenciaHasta}
                  </span>
                </div>
              ) : !enEdicion ? (
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => handleConfirmarCobro(cot)}
                    className="flex-1 min-h-[46px] py-3 px-4 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] disabled:opacity-60 text-[#FAF7F5] font-sans font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_8px_20px_-6px_rgba(59,13,30,0.22)] transition-all cursor-pointer tabular-nums"
                  >
                    {ocupado ? <Sparkles size={16} /> : <Check size={16} />}
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
                    className="min-h-[46px] py-3 px-4 rounded-2xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#3B0D1E] font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 size={14} />
                    <span>Ajustar</span>
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-[#EFE8E4] space-y-3.5">
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-1.5">
                      Valor final cobrado ($ COP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={otroValorTexto}
                      onChange={(e) => setOtroValorTexto(e.target.value)}
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm font-bold text-[#3B0D1E] tabular-nums"
                    />
                  </div>

                  {estilistas.length > 0 && (
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-1.5">
                        Especialista asignada
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {estilistas.map((e) => {
                          const activa = estilistaOverrideId === e.id;
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => {
                                setEstilistaOverrideId(e.id);
                                setEstilistaPorCotizacion((prev) => ({ ...prev, [cot.id]: e.id }));
                              }}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer capitalize ${
                                activa
                                  ? 'bg-[#F5EBE8] border-[#3B0D1E] text-[#3B0D1E]'
                                  : 'bg-[#FAF7F5] border-[#EFE8E4] text-[#6B535C] hover:text-[#3B0D1E]'
                              }`}
                            >
                              {e.nombre}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
                        className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#0D9488] hover:opacity-95 text-white font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check size={15} /> Confirmar cierre
                      </button>

                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => setEditandoId(null)}
                        className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C] font-sans font-bold text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => handleAnular(cot)}
                      className="min-h-[44px] px-3 text-xs font-bold text-[#D97757] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle size={14} /> Anular
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
