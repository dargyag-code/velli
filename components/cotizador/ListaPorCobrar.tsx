'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Check, Edit3, XCircle, Sparkles, UserCheck } from 'lucide-react';
import { Btn, Chip, SectionLabel } from '@/components/v2';
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
  confirmarCobroCotizacion,
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
  /** Si se pasa `clientaId`, filtra solo las cotizaciones enviadas de esa clienta. */
  clientaId?: string;
  /** Nombre de la clienta si ya se conoce en la ficha. */
  clientaNombre?: string;
  /** Lista opcional de clientas ya cargadas en el dashboard. */
  clientas?: Clienta[];
  /** Contador externo para recargar cuando se crea una nueva cotización. */
  refreshKey?: number;
  onCambio?: () => void;
}

export default function ListaPorCobrar({
  clientaId,
  clientaNombre,
  clientas: clientasProp,
  refreshKey = 0,
  onCambio,
}: ListaPorCobrarProps) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);
  const [serviciosMap, setServiciosMap] = useState<Record<string, ServicioSalon>>({});
  const [plantillasMap, setPlantillasMap] = useState<Record<string, PlantillaPrecio>>({});
  const [productos, setProductos] = useState<ProductoSalon[]>([]);
  const [reglasComision, setReglasComision] = useState<ComisionSalon[]>([]);
  const [nombresClientas, setNombresClientas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Estado para edición rápida de «Otro valor»
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [otroValorTexto, setOtroValorTexto] = useState<string>('');
  const [estilistaOverrideId, setEstilistaOverrideId] = useState<string>('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cots, ests, svcs, plants, prods, coms] = await Promise.all([
        clientaId
          ? listarCotizacionesPorClienta(clientaId).then((todas) =>
              todas.filter((c) => c.estado === 'enviada')
            )
          : listarCotizacionesPorCobrar(),
        listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
        listarServiciosSalon({ soloActivos: false }).catch(() => [] as ServicioSalon[]),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
        listarProductosSalon({ soloActivos: true }).catch(() => [] as ProductoSalon[]),
        listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
      ]);

      setCotizaciones(cots);
      setEstilistas(ests);
      const sMap: Record<string, ServicioSalon> = {};
      for (const s of svcs) sMap[s.id] = s;
      setServiciosMap(sMap);

      const pMap: Record<string, PlantillaPrecio> = {};
      for (const p of plants) pMap[p.servicioId] = p;
      setPlantillasMap(pMap);

      setProductos(prods);
      setReglasComision(coms);

      const mapaNombres: Record<string, string> = {};
      if (clientaId && clientaNombre) {
        mapaNombres[clientaId] = clientaNombre;
      }
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
  }, [clientaId, clientaNombre, clientasProp]);

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
      editandoId === cot.id ? estilistaOverrideId || null : (cot.estilistaId ?? null);
    const estObj = estilistas.find((e) => e.id === estilistaFinalId);

    setProcesandoId(cot.id);
    try {
      const snap = calcularInstantaneaCostoYComision(cot, monto, estilistaFinalId);
      await confirmarCobroCotizacion(cot.id, {
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

  if (cargando || cotizaciones.length === 0) {
    return null;
  }

  return (
    <section style={{ marginBottom: 22 }}>
      {!clientaId ? (
        <SectionLabel
          num="·"
          eyebrow="Cierre en 1 toque"
          title={`Por cobrar · ${cotizaciones.length}`}
        />
      ) : (
        <div className="v-caps" style={{ color: 'var(--secondary-deep)', marginBottom: 8 }}>
          Cotizaciones por cobrar · {cotizaciones.length}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cotizaciones.map((cot) => {
          const nombreCli =
            (cot.clientaId ? nombresClientas[cot.clientaId] : undefined) ||
            clientaNombre ||
            'Clienta';
          const est = estilistas.find((e) => e.id === cot.estilistaId);
          const nombreEst = est?.nombre ?? cot.estilistaNombre;
          const enEdicion = editandoId === cot.id;
          const ocupado = procesandoId === cot.id;

          return (
            <article
              key={cot.id}
              className="v-card"
              style={{
                padding: 14,
                border: '1px solid rgba(45, 90, 39, 0.22)',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  {!clientaId && (
                    <div
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 16,
                        color: 'var(--text-main)',
                        lineHeight: 1.15,
                      }}
                    >
                      {nombreCli}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: clientaId ? 14 : 12.5,
                      fontWeight: 600,
                      color: clientaId ? 'var(--text-main)' : 'var(--text-secondary)',
                      marginTop: clientaId ? 0 : 2,
                    }}
                  >
                    {cot.servicioNombre}
                  </div>
                  {nombreEst && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        marginTop: 3,
                      }}
                    >
                      <UserCheck size={12} /> {nombreEst}
                    </div>
                  )}
                </div>

                <Chip tone="gold">Enviada</Chip>
              </div>

              {!enEdicion ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Btn
                    variant="primary"
                    size="md"
                    disabled={ocupado}
                    onClick={() => handleConfirmarCobro(cot)}
                    icon={ocupado ? <Sparkles size={14} /> : <Check size={14} />}
                    style={{ flex: 1 }}
                  >
                    Cobrado {formatearPrecioCop(cot.precioCotizado)} ✓
                  </Btn>
                  <Btn
                    variant="outline"
                    size="md"
                    disabled={ocupado}
                    onClick={() => {
                      setEditandoId(cot.id);
                      setOtroValorTexto(String(cot.precioCotizado));
                      setEstilistaOverrideId(cot.estilistaId ?? '');
                    }}
                    icon={<Edit3 size={13} />}
                  >
                    Otro valor
                  </Btn>
                </div>
              ) : (
                <div
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: estilistas.length > 0 ? '1fr 1fr' : '1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        VALOR COBRADO (COP)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={otroValorTexto}
                        onChange={(e) => setOtroValorTexto(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          fontSize: 13,
                          fontWeight: 700,
                          background: 'var(--bg)',
                          color: 'var(--text-main)',
                        }}
                      />
                    </div>
                    {estilistas.length > 0 && (
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          ESTILISTA QUE ATENDIÓ
                        </label>
                        <select
                          value={estilistaOverrideId}
                          onChange={(e) => setEstilistaOverrideId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 12.5,
                            background: 'var(--bg)',
                            color: 'var(--text-main)',
                          }}
                        >
                          <option value="">Sin asignar</option>
                          {estilistas.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn
                      variant="primary"
                      size="sm"
                      disabled={ocupado}
                      onClick={() =>
                        handleConfirmarCobro(
                          cot,
                          Number(otroValorTexto.replace(/\D/g, ''))
                        )
                      }
                      icon={<Check size={13} />}
                    >
                      Confirmar cobro
                    </Btn>
                    <Btn
                      variant="ghost"
                      size="sm"
                      disabled={ocupado}
                      onClick={() => setEditandoId(null)}
                    >
                      Cancelar
                    </Btn>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => handleAnular(cot)}
                      style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: 'none',
                        color: '#8E2D2D',
                        fontSize: 11.5,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <XCircle size={13} /> Anular cotización
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
