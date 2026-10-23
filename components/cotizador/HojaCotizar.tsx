'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  X, MessageCircle, Check, AlertTriangle, ShieldAlert,
  Sparkles, User, Sliders, ChevronDown, Settings, Search,
} from 'lucide-react';
import { Btn, Chip } from '@/components/v2';
import type { Clienta, Consulta } from '@/lib/types';
import { getAllClientas, getConsultasByClienta } from '@/lib/db';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva } from '@/lib/subscription/estado';
import { diagnosticoDesdeConsulta } from '@/lib/color/integracion';
import { showToast } from '@/lib/toast';
import {
  CATALOGO_VARIABLES,
  derivarVariablesDesdeConsulta,
  evaluarAvisosEstandar,
  evaluarBloqueoServicioCotizador,
  calcularPrecioCotizacion,
  formatearPrecioCop,
  armarEnlaceWhatsAppCotizacion,
  sembrarServiciosDesdeOnboarding,
  listarPlantillasVigentes,
  publicarPlantillaPrecio,
   obtenerPlantillaVigente,
  listarEstilistas,
  crearCotizacion,
  type ClaveVariable,
  type ValorLargo,
  type ValorDensidad,
  type ValorEstadoFibra,
  type ValorCanas,
  type VariablesActivasServicio,
  type ServicioSalon,
  type PlantillaPrecio,
  type EstilistaSalon,
  type Cotizacion,
} from '@/lib/cotizador';

const STORAGE_ULTIMA_ESTILISTA = 'velli_ultima_estilista_id';

const ORDEN_VARIABLES: ClaveVariable[] = ['largo', 'densidad', 'estado', 'canas'];

const ETIQUETAS_VARIABLE: Record<ClaveVariable, string> = {
  largo: 'Largo',
  densidad: 'Densidad',
  estado: 'Estado de la fibra',
  canas: 'Porcentaje de canas',
};

export interface HojaCotizarProps {
  open: boolean;
  onClose: () => void;
  clienta?: Clienta | null;
  consulta?: Consulta | null;
  onCotizacionCreada?: (cotizacion: Cotizacion) => void;
}

export default function HojaCotizar({
  open,
  onClose,
  clienta: clientaProp,
  consulta: consultaProp,
  onCotizacionCreada,
}: HojaCotizarProps) {
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Si se abre desde el botón central sin clienta preseleccionada
  const [clientaSeleccionada, setClientaSeleccionada] = useState<Clienta | null>(clientaProp ?? null);
  const [consultaVigente, setConsultaVigente] = useState<Consulta | null>(consultaProp ?? null);
  const [todasClientas, setTodasClientas] = useState<Clienta[]>([]);
  const [busquedaClienta, setBusquedaClienta] = useState('');

  // Catálogos del salón
  const [nombreSalon, setNombreSalon] = useState('Tu salón');
  const [conMarcaVelli, setConMarcaVelli] = useState(true);
  const [servicios, setServicios] = useState<ServicioSalon[]>([]);
  const [plantillasPorServicio, setPlantillasPorServicio] = useState<Record<string, PlantillaPrecio>>({});
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);

  // Selecciones de la estilista (los 3 toques)
  const [servicioId, setServicioId] = useState<string>('');
  const [estilistaId, setEstilistaId] = useState<string>('');
  const [variableAbierta, setVariableAbierta] = useState<ClaveVariable | null>(null);
  const [manuales, setManuales] = useState<{
    largo?: ValorLargo;
    densidad?: ValorDensidad;
    estado?: ValorEstadoFibra;
    canas?: ValorCanas;
  }>({});
  const [desempateCanas, setDesempateCanas] = useState<'50_75' | '75_100' | undefined>(undefined);

  // Si el servicio aún no tiene plantilla publicada, permite definir precio base rápido
  const [precioBaseRapido, setPrecioBaseRapido] = useState<string>('120000');

  // Ajuste manual opcional (exige motivo >= 3 caracteres)
  const [mostrarAjusteManual, setMostrarAjusteManual] = useState(false);
  const [precioManualTexto, setPrecioManualTexto] = useState('');
  const [motivoManual, setMotivoManual] = useState('');

  useEffect(() => {
    setClientaSeleccionada(clientaProp ?? null);
  }, [clientaProp]);

  useEffect(() => {
    setConsultaVigente(consultaProp ?? null);
  }, [consultaProp]);

  const cargarDatosSalon = useCallback(async () => {
    setCargando(true);
    try {
      const [prof, sub, ests, plantillas] = await Promise.all([
        getProfile().catch(() => null),
        getSuscripcionEfectiva().catch(() => null),
        listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
      ]);

      if (prof?.nombreSalon?.trim()) {
        setNombreSalon(prof.nombreSalon.trim());
      } else if (prof?.nombre?.trim()) {
        setNombreSalon(prof.nombre.trim());
      }

      if (sub?.plan === 'pro_ia') {
        setConMarcaVelli(false);
      } else {
        setConMarcaVelli(true);
      }

      const svcs = await sembrarServiciosDesdeOnboarding(prof?.servicios ?? []).catch(
        () => [] as ServicioSalon[]
      );
      const activos = svcs.filter((s) => s.activo);
      setServicios(activos);

      const mapaPlantillas: Record<string, PlantillaPrecio> = {};
      for (const p of plantillas) {
        if (!p.vigenteHasta) mapaPlantillas[p.servicioId] = p;
      }
      setPlantillasPorServicio(mapaPlantillas);
      setEstilistas(ests);

      // Recordar última estilista usada en este dispositivo
      try {
        const guardada = window.localStorage.getItem(STORAGE_ULTIMA_ESTILISTA);
        if (guardada && ests.some((e) => e.id === guardada)) {
          setEstilistaId(guardada);
        } else if (ests.length === 1) {
          setEstilistaId(ests[0].id);
        }
      } catch {
        // localStorage no disponible
      }

      if (!clientaProp) {
        const lista = await getAllClientas().catch(() => [] as Clienta[]);
        setTodasClientas(lista);
      }
    } finally {
      setCargando(false);
    }
  }, [clientaProp]);

  useEffect(() => {
    if (!open) return;
    setManuales({});
    setDesempateCanas(undefined);
    setVariableAbierta(null);
    setMostrarAjusteManual(false);
    setPrecioManualTexto('');
    setMotivoManual('');
    cargarDatosSalon();
  }, [open, cargarDatosSalon]);

  // Si hay clienta pero no vino consulta explícita, cargar su última consulta
  useEffect(() => {
    if (!open || !clientaSeleccionada || consultaProp) return;
    let cancelado = false;
    getConsultasByClienta(clientaSeleccionada.id)
      .then((cs) => {
        if (cancelado) return;
        const vigente = cs.find((c) => !c.esBorrador) ?? cs[0] ?? null;
        setConsultaVigente(vigente);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [open, clientaSeleccionada, consultaProp]);

  const derivacion = useMemo(
    () =>
      derivarVariablesDesdeConsulta(consultaVigente, {
        desempateCanas,
        manuales,
      }),
    [consultaVigente, desempateCanas, manuales]
  );

  const diagnosticoColor = useMemo(
    () => diagnosticoDesdeConsulta(consultaVigente ?? undefined, clientaSeleccionada ?? undefined),
    [consultaVigente, clientaSeleccionada]
  );

  const servicioActual = useMemo(
    () => servicios.find((s) => s.id === servicioId) ?? null,
    [servicios, servicioId]
  );

  useEffect(() => {
    if (!open || servicios.length === 0) return;
    if (servicioId && servicios.some((s) => s.id === servicioId)) return;
    const primeroDisponible =
      servicios.find((s) => !evaluarBloqueoServicioCotizador(s, diagnosticoColor)) ?? servicios[0];
    if (primeroDisponible) {
      setServicioId(primeroDisponible.id);
    }
  }, [open, servicios, servicioId, diagnosticoColor]);

  const avisosEstandar = useMemo(
    () =>
      evaluarAvisosEstandar({
        estado: derivacion.variables.estado?.valor,
        canas: derivacion.variables.canas?.valor,
        categoriaServicio: servicioActual?.categoria,
        usaFormulaColor: servicioActual?.usaFormulaColor,
      }),
    [derivacion.variables.estado?.valor, derivacion.variables.canas?.valor, servicioActual]
  );

  const plantillaActual = servicioActual ? plantillasPorServicio[servicioActual.id] ?? null : null;

  const variablesActivasServicio = useMemo((): VariablesActivasServicio | undefined => {
    const ext = servicioActual?.perfilExtendido?.['variablesActivas'];
    if (Array.isArray(ext)) return ext as ClaveVariable[];
    return undefined;
  }, [servicioActual]);

  const calculoPrecio = useMemo(() => {
    if (!servicioActual) return null;
    const base = plantillaActual
      ? plantillaActual.precioBase
      : Math.max(0, Number(precioBaseRapido.replace(/\D/g, '')) || 0);
    const ajustes = plantillaActual?.ajustes ?? {};
    const redondeo = plantillaActual?.redondeo ?? 1000;

    return calcularPrecioCotizacion(
      {
        precioBase: base,
        ajustes,
        variablesActivas: variablesActivasServicio,
        redondeo,
      },
      derivacion.variables
    );
  }, [servicioActual, plantillaActual, precioBaseRapido, variablesActivasServicio, derivacion.variables]);

  const precioManualNumero = useMemo(() => {
    if (!mostrarAjusteManual || !precioManualTexto.trim()) return undefined;
    const limpio = Number(precioManualTexto.replace(/\D/g, ''));
    return Number.isFinite(limpio) && limpio >= 0 ? limpio : undefined;
  }, [mostrarAjusteManual, precioManualTexto]);

  const precioFinalMostrado =
    precioManualNumero !== undefined ? precioManualNumero : (calculoPrecio?.precioCalculado ?? 0);

  const bloqueoServicioSeleccionado = useMemo(
    () => (servicioActual ? evaluarBloqueoServicioCotizador(servicioActual, diagnosticoColor) : null),
    [servicioActual, diagnosticoColor]
  );

  const asignarVariableManual = (clave: ClaveVariable, valor: string) => {
    if (clave === 'canas' && derivacion.canasPorPrecisar && (valor === '50_75' || valor === '75_100')) {
      setDesempateCanas(valor);
    }
    setManuales((prev) => ({
      ...prev,
      [clave]: valor,
    }));
    setVariableAbierta(null);
  };

  const cambiarEstilista = (id: string) => {
    setEstilistaId(id);
    try {
      if (id) {
        window.localStorage.setItem(STORAGE_ULTIMA_ESTILISTA, id);
      } else {
        window.localStorage.removeItem(STORAGE_ULTIMA_ESTILISTA);
      }
    } catch {
      // localStorage no disponible
    }
  };

  const handleGuardarCotizacion = async (abrirWhatsApp: boolean) => {
    if (!clientaSeleccionada) {
      showToast('Selecciona primero a la clienta', 'error');
      return;
    }
    if (!servicioActual || !calculoPrecio) {
      showToast('Selecciona un servicio para cotizar', 'error');
      return;
    }
    if (bloqueoServicioSeleccionado) {
      showToast(bloqueoServicioSeleccionado.titulo, 'error');
      return;
    }
    if (precioManualNumero !== undefined && motivoManual.trim().length < 3) {
      showToast('Escribe el motivo del ajuste manual de precio (mín. 3 caracteres)', 'error');
      return;
    }

    setGuardando(true);
    try {
      let plantilla = plantillaActual;
      if (!plantilla) {
        const baseNum = Math.max(0, Number(precioBaseRapido.replace(/\D/g, '')) || 0);
        await publicarPlantillaPrecio({
          servicioId: servicioActual.id,
          precioBase: baseNum,
          ajustes: {},
          redondeo: 1000,
          vigenciaDias: 15,
        });
        plantilla = await obtenerPlantillaVigente(servicioActual.id);
        if (plantilla) {
          setPlantillasPorServicio((prev) => ({ ...prev, [servicioActual.id]: plantilla! }));
        }
      }

      const vigenciaDias = plantilla?.vigenciaDias || 15;
      const vigenciaHasta = new Date(Date.now() + vigenciaDias * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const estObj = estilistas.find((e) => e.id === estilistaId);

      const cotizacion = await crearCotizacion({
        clientaId: clientaSeleccionada.id,
        consultaId: consultaVigente?.id ?? null,
        estilistaId: estilistaId || null,
        estilistaNombre: estObj?.nombre ?? null,
        servicioId: servicioActual.id,
        plantillaId: plantilla?.id ?? null,
        plantillaVersion: plantilla?.version ?? 1,
        servicioNombre: servicioActual.nombre,
        variables: derivacion.variables,
        precioCalculado: calculoPrecio.precioCalculado,
        precioCotizado: precioFinalMostrado,
        ajusteManualMotivo: precioManualNumero !== undefined ? motivoManual.trim() : null,
        vigenciaHasta,
        estado: 'enviada',
        conMarcaVelli,
      });

      showToast('Cotización guardada', 'success');
      onCotizacionCreada?.(cotizacion);

      if (abrirWhatsApp) {
        const { urlWhatsApp } = armarEnlaceWhatsAppCotizacion({
          nombreClienta: clientaSeleccionada.nombre,
          telefonoClienta: clientaSeleccionada.telefono,
          servicioNombre: cotizacion.servicioNombre,
          salonNombre: nombreSalon,
          precio: cotizacion.precioCotizado,
          vigenciaHasta: cotizacion.vigenciaHasta,
          tokenPublico: cotizacion.tokenPublico,
        });
        window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');
      }

      onClose();
    } catch (err) {
      console.error('[cotizador.crear]', err);
      showToast(
        err instanceof Error ? err.message : 'No se pudo guardar la cotización',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  const clientasFiltradas = busquedaClienta.trim()
    ? todasClientas.filter((c) =>
        c.nombre.toLowerCase().includes(busquedaClienta.trim().toLowerCase())
      )
    : todasClientas.slice(0, 8);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(20, 36, 26, 0.62)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -12px 40px rgba(20, 36, 26, 0.28)',
          border: '1px solid var(--border-soft)',
          padding: '18px 18px 28px',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: 'var(--border-strong)',
            margin: '0 auto 14px',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
              Cotizador Velli · 3 toques
            </div>
            <h2
              style={{
                margin: '2px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {clientaSeleccionada ? `Cotizar a ${clientaSeleccionada.nombre}` : 'Nueva cotización'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cotizador"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Selector de clienta si se abrió desde el botón central sin clienta */}
        {!clientaProp && (
          <div
            className="v-card"
            style={{ padding: 12, marginBottom: 14, background: 'var(--bg-card)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="v-caps">Clienta</span>
              {clientaSeleccionada && (
                <button
                  type="button"
                  onClick={() => {
                    setClientaSeleccionada(null);
                    setConsultaVigente(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cambiar clienta
                </button>
              )}
            </div>

            {clientaSeleccionada ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                  {clientaSeleccionada.nombre}
                </span>
                {consultaVigente && (
                  <Chip tone="green" style={{ marginLeft: 'auto', fontSize: 9.5 }}>
                    Diagnóstico precargado
                  </Chip>
                )}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    marginBottom: 8,
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    value={busquedaClienta}
                    onChange={(e) => setBusquedaClienta(e.target.value)}
                    placeholder="Buscar clienta por nombre…"
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: 13,
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                  {clientasFiltradas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientaSeleccionada(c)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: 999,
                        border: '1px solid var(--border-soft)',
                        background: 'var(--bg)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {c.nombre}
                    </button>
                  ))}
                  {clientasFiltradas.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      No hay clientas registradas.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TOQUE 1 · Chips de las 4 variables (prellenadas desde diagnóstico) */}
        <section style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="v-caps">1 · Variables del cabello</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {consultaVigente ? 'Prellenado del diagnóstico · toca para ajustar' : 'Toca cada chip para elegir'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ORDEN_VARIABLES.map((clave) => {
              const opciones = CATALOGO_VARIABLES[clave];
              const actual = derivacion.variables[clave];
              const opcionActual = opciones.find((o) => o.valor === actual?.valor);
              const necesitaDesempate = clave === 'canas' && derivacion.canasPorPrecisar && !actual;
              const faltaValor = !actual;
              const activa = variableAbierta === clave;

              return (
                <div key={clave} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setVariableAbierta(activa ? null : clave)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      padding: '10px 12px',
                      borderRadius: 14,
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: necesitaDesempate
                        ? '#FFF8EB'
                        : faltaValor
                          ? 'var(--bg-card)'
                          : actual.origen === 'diagnostico'
                            ? 'var(--primary-pale)'
                            : '#FBF4EC',
                      border: necesitaDesempate
                        ? '1.5px solid #D4820A'
                        : faltaValor
                          ? '1.5px dashed var(--border-strong)'
                          : actual.origen === 'diagnostico'
                            ? '1px solid rgba(45, 90, 39, 0.28)'
                            : '1px solid rgba(138, 90, 46, 0.28)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: necesitaDesempate ? '#B46508' : 'var(--text-tertiary)',
                        }}
                      >
                        {ETIQUETAS_VARIABLE[clave]}
                        {actual ? (actual.origen === 'diagnostico' ? ' · DX' : ' · MANUAL') : ''}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: faltaValor ? 'var(--secondary-deep)' : 'var(--text-main)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {necesitaDesempate
                          ? '¿50–75 % o +75 %?'
                          : opcionActual
                            ? opcionActual.etiqueta
                            : 'Completar en 1 toque'}
                      </div>
                    </div>
                    <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  </button>

                  {necesitaDesempate && !activa && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(
                        [
                          { valor: '50_75', label: '50–75 %' },
                          { valor: '75_100', label: '75–100 %' },
                        ] as const
                      ).map((op) => (
                        <button
                          key={op.valor}
                          type="button"
                          onClick={() => asignarVariableManual('canas', op.valor)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: 10,
                            border: '1px solid #D4820A',
                            background: '#FFFDF9',
                            color: '#9A5406',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {variableAbierta && (
            <div
              className="v-card"
              style={{
                marginTop: 8,
                padding: 12,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="v-caps" style={{ marginBottom: 8 }}>
                Elegir {ETIQUETAS_VARIABLE[variableAbierta].toLowerCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CATALOGO_VARIABLES[variableAbierta].map((op) => {
                  const seleccionado = derivacion.variables[variableAbierta]?.valor === op.valor;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => asignarVariableManual(variableAbierta, op.valor)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 12,
                        border: seleccionado
                          ? '1.5px solid var(--primary)'
                          : '1px solid var(--border-soft)',
                        background: seleccionado ? 'var(--primary-pale)' : 'var(--bg)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                          {op.etiqueta}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {op.guia}
                        </div>
                      </div>
                      {seleccionado && <Check size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* TOQUE 2 · Elegir servicio (respetando guardarraíles legales) */}
        <section style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="v-caps">2 · Servicio a cotizar</span>
            <Link
              href="/configuracion/precios"
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--primary)',
                textDecoration: 'none',
              }}
            >
              <Settings size={12} /> Configurar precios
            </Link>
          </div>

          {cargando ? (
            <div className="skeleton-shimmer" style={{ height: 76, borderRadius: 14 }} />
          ) : servicios.length === 0 ? (
            <div className="v-card" style={{ padding: 14, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Aún no tienes servicios configurados.
              </p>
              <Link href="/configuracion/precios" onClick={onClose} style={{ display: 'inline-block', marginTop: 8 }}>
                <Btn size="sm" variant="primary">Crear servicios y precios</Btn>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {servicios.map((srv) => {
                const bloqueo = evaluarBloqueoServicioCotizador(srv, diagnosticoColor);
                const activo = srv.id === servicioId;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    disabled={!!bloqueo}
                    onClick={() => {
                      if (!bloqueo) setServicioId(srv.id);
                    }}
                    title={bloqueo ? `${bloqueo.titulo}: ${bloqueo.mensaje}` : srv.nombre}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 14,
                      border: bloqueo
                        ? '1px dashed rgba(160, 51, 51, 0.35)'
                        : activo
                          ? '1.5px solid var(--primary)'
                          : '1px solid var(--border-soft)',
                      background: bloqueo
                        ? '#FCEEEE'
                        : activo
                          ? 'var(--primary)'
                          : 'var(--bg-card)',
                      color: bloqueo
                        ? '#8E2D2D'
                        : activo
                          ? '#fff'
                          : 'var(--text-main)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: bloqueo ? 'not-allowed' : 'pointer',
                      opacity: bloqueo ? 0.78 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {bloqueo && <ShieldAlert size={13} />}
                    <span>{srv.nombre}</span>
                  </button>
                );
              })}
            </div>
          )}

          {servicios.some((s) => evaluarBloqueoServicioCotizador(s, diagnosticoColor)) && (
            <div
              style={{
                marginTop: 8,
                padding: '9px 12px',
                borderRadius: 12,
                background: '#FCEEEE',
                border: '1px solid rgba(160, 51, 51, 0.22)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                color: '#7A1F1F',
                fontSize: 11.5,
                lineHeight: 1.4,
              }}
            >
              <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Bloqueado por salud de la fibra:</strong>{' '}
                {
                  servicios
                    .map((s) => evaluarBloqueoServicioCotizador(s, diagnosticoColor))
                    .find(Boolean)?.titulo
                }
                . Los servicios incompatibles aparecen deshabilitados.
              </div>
            </div>
          )}

          {avisosEstandar.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: '9px 12px',
                borderRadius: 12,
                background: '#FFF8EB',
                border: '1px solid rgba(212, 130, 10, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {avisosEstandar.map((av) => (
                <div
                  key={av.codigo}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    color: '#8A5205',
                    fontWeight: av.obligatorio ? 700 : 500,
                  }}
                >
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>{av.mensaje}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tarjeta de precio calculado y desglose en vivo */}
        {servicioActual && calculoPrecio && (
          <section
            className="v-grain"
            style={{
              borderRadius: 18,
              padding: '16px 18px',
              background: 'linear-gradient(135deg, #25401E 0%, #14241A 100%)',
              color: '#F5EDDC',
              marginBottom: 16,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div>
                <div className="v-caps" style={{ color: 'rgba(232, 194, 144, 0.9)' }}>
                  {servicioActual.nombre}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 34,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                    marginTop: 4,
                  }}
                >
                  {formatearPrecioCop(precioFinalMostrado)}
                </div>
              </div>
              {precioManualNumero !== undefined && (
                <Chip tone="gold">Ajuste manual</Chip>
              )}
            </div>

            {!plantillaActual && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11.5, color: 'rgba(245, 237, 220, 0.9)' }}>
                  Precio base inicial (COP):
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={precioBaseRapido}
                  onChange={(e) => setPrecioBaseRapido(e.target.value)}
                  style={{
                    width: 120,
                    padding: '5px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(232, 194, 144, 0.4)',
                    background: 'rgba(20, 36, 26, 0.7)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid rgba(255,255,255,0.14)',
                fontSize: 11.5,
                color: 'rgba(245, 237, 220, 0.82)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 12px',
              }}
            >
              <span>Base: {formatearPrecioCop(calculoPrecio.precioBase)}</span>
              {calculoPrecio.desglose
                .filter((d) => d.activa && d.suma > 0)
                .map((d) => (
                  <span key={`s-${d.variable}`}>
                    + {formatearPrecioCop(d.suma)} ({d.variable})
                  </span>
                ))}
              {calculoPrecio.desglose
                .filter((d) => d.activa && d.porcentaje > 0)
                .map((d) => (
                  <span key={`p-${d.variable}`}>
                    +{d.porcentaje}% ({d.variable})
                  </span>
                ))}
            </div>
          </section>
        )}

        {/* Estilista + ajuste manual opcional */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {estilistas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Estilista que atiende:
              </span>
              <select
                value={estilistaId}
                onChange={(e) => cambiarEstilista(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text-main)',
                }}
              >
                <option value="">Seleccionar estilista…</option>
                {estilistas.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setMostrarAjusteManual((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--secondary-deep)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <Sliders size={13} />
              {mostrarAjusteManual ? 'Quitar ajuste manual de precio' : 'Ajustar precio manualmente'}
            </button>

            {mostrarAjusteManual && (
              <div
                className="v-card"
                style={{
                  marginTop: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      PRECIO MANUAL (COP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={precioManualTexto}
                      onChange={(e) => setPrecioManualTexto(e.target.value)}
                      placeholder={String(calculoPrecio?.precioCalculado ?? 0)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        background: 'var(--bg)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      MOTIVO DEL AJUSTE *
                    </label>
                    <input
                      type="text"
                      value={motivoManual}
                      onChange={(e) => setMotivoManual(e.target.value)}
                      placeholder="Ej. descuento fidelidad, retoque parcial…"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        background: 'var(--bg)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* TOQUE 3 · Enviar por WhatsApp o guardar en silla */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn
            variant="primary"
            size="lg"
            fullWidth
            disabled={guardando || !clientaSeleccionada || !servicioActual || !!bloqueoServicioSeleccionado}
            onClick={() => handleGuardarCotizacion(true)}
            icon={guardando ? <Sparkles size={16} /> : <MessageCircle size={16} />}
          >
            {guardando ? 'Guardando cotización…' : 'Enviar por WhatsApp'}
          </Btn>

          <Btn
            variant="outline"
            size="md"
            fullWidth
            disabled={guardando || !clientaSeleccionada || !servicioActual || !!bloqueoServicioSeleccionado}
            onClick={() => handleGuardarCotizacion(false)}
            icon={<Check size={14} />}
          >
            Guardar como enviada (sin abrir WhatsApp)
          </Btn>
        </div>
      </div>
    </div>
  );
}
