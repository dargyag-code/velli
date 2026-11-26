'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Camera,
  MessageCircle,
  CheckCircle2,
  X,
  ShieldAlert,
  ShieldCheck,
  Info,
  Lock,
  RotateCcw,
  FlaskConical,
  SlidersHorizontal,
} from 'lucide-react';
import type { Clienta, Consulta } from '@/lib/types';
import { getAllClientas, getConsultasByClienta, createClienta } from '@/lib/db';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva } from '@/lib/subscription/estado';
import { createClient } from '@/lib/supabase/client';
import { diagnosticoDesdeConsulta, PORCENTAJE_CANAS_POR_TRAMO } from '@/lib/color/integracion';
import type { HairAnalysisResult } from '@/lib/hairAnalysis';
import SelectorTramoCanas from '@/components/color/SelectorTramoCanas';
import CameraCapture from '@/components/wizard/CameraCapture';
import ListaPorCobrar from '@/components/cotizador/ListaPorCobrar';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
import { showToast } from '@/lib/toast';
import { obtenerOrganizacionActivaPanel, type OrganizacionPanelResumen } from '@/lib/vitrina';
import { numeroWhatsApp } from '@/lib/whatsapp';
import {
  CATALOGO_VARIABLES,
  AJUSTES_EJEMPLO_PLANTILLA,
  FACTORES_CONSUMO_DEFECTO,
  derivarVariablesDesdeConsulta,
  evaluarAvisosEstandar,
  evaluarBloqueoServicioCotizador,
  esServicioQuimico,
  calcularPrecioCotizacion,
  calcularCostoProducto,
  calcularPrecioUnitarioProducto,
  calcularComisionYMargen,
  seleccionarReglaComision,
  formatearPrecioCop,
  armarEnlaceWhatsAppCotizacion,
  sembrarServiciosDesdeOnboarding,
  sembrarBaseFinancieraSalon,
  listarServiciosSalon,
  listarPlantillasVigentes,
  publicarPlantillaPrecio,
  obtenerPlantillaVigente,
  listarEstilistas,
  listarProductosSalon,
  listarComisionesVigentes,
  listarCotizacionesPorCobrar,
  listarCotizacionesOperativasSilla,
  crearCotizacion,
  crearCotizacionOperativaSilla,
  enviarCotizacion,
  type ClaveVariable,
  type ValorLargo,
  type ValorDensidad,
  type ValorEstadoFibra,
  type ValorCanas,
  type VariablesCotizacion,
  type VariablesActivasServicio,
  type ServicioSalon,
  type PlantillaPrecio,
  type EstilistaSalon,
  type ProductoSalon,
  type ComisionSalon,
  type ConsumoPlantillaInput,
  type ProductoSalonCostoInput,
  type ReglaComision,
  type AjusteValorVariable,
} from '@/lib/cotizador';
import {
  SERVICIOS_BASE_SEMILLA,
  normalizarAjustesVelvetStudio,
  type ServicioSalonSemilla,
} from '@/lib/semilla-financiera';
import { calcularTicketFinancieroVivo } from '@/lib/costo';
import {
  PORCENTAJE_COMISION_SALUDABLE_DEFECTO,
  REGLA_COMISION_SALUDABLE_DEFECTO,
} from '@/lib/comision';

const STORAGE_ULTIMA_ESTILISTA = 'velli_ultima_estilista_id';

const SERVICIOS_SEMILLA_DEFECTO = SERVICIOS_BASE_SEMILLA.map((s) => s.nombre);

const SERVICIOS_RESPALDO_LOCAL: ServicioSalon[] = SERVICIOS_BASE_SEMILLA.map((semilla, idx) => ({
  id: `local-${semilla.slug}`,
  userId: 'local',
  nombre: semilla.nombre,
  categoria:
    semilla.slug === 'balayage'
      ? 'decoloracion'
      : semilla.slug === 'tinte-global'
        ? 'color'
        : semilla.slug === 'alisado-organico'
          ? 'alisado'
          : 'tratamiento',
  usaFormulaColor: semilla.requiereQuimico,
  duracionMinutos:
    semilla.slug === 'balayage'
      ? 240
      : semilla.slug === 'alisado-organico'
        ? 210
        : semilla.slug === 'tinte-global'
          ? 120
          : 75,
  activo: true,
  orden: idx,
  perfilExtendido: { slugSemilla: semilla.slug },
  createdAt: '',
  updatedAt: '',
}));

function obtenerSemillaServicio(srv?: ServicioSalon | null): ServicioSalonSemilla {
  if (!srv) return SERVICIOS_BASE_SEMILLA[0];
  const slugExt = srv.perfilExtendido?.['slugSemilla'];
  if (typeof slugExt === 'string') {
    const porSlug = SERVICIOS_BASE_SEMILLA.find((s) => s.slug === slugExt);
    if (porSlug) return porSlug;
  }
  const n = srv.nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (n.includes('balayage') || n.includes('rubio') || n.includes('babylight') || n.includes('decolor') || n.includes('correccion')) {
    return SERVICIOS_BASE_SEMILLA[0];
  }
  if (n.includes('alisado') || n.includes('keratina') || n.includes('organico') || n.includes('aminoacido')) {
    return SERVICIOS_BASE_SEMILLA[2];
  }
  if (n.includes('hidratac') || n.includes('nutric') || n.includes('tratamiento') || n.includes('repolariz')) {
    return SERVICIOS_BASE_SEMILLA[3];
  }
  if (n.includes('color') || n.includes('tinte') || n.includes('cubrimiento')) {
    return SERVICIOS_BASE_SEMILLA[1];
  }
  if (srv.categoria === 'decoloracion') return SERVICIOS_BASE_SEMILLA[0];
  if (srv.categoria === 'alisado') return SERVICIOS_BASE_SEMILLA[2];
  if (srv.categoria === 'tratamiento') return SERVICIOS_BASE_SEMILLA[3];
  return SERVICIOS_BASE_SEMILLA[1];
}

const PASOS_AJUSTE_COMERCIAL = [-15, -10, -5, 0, 5, 10, 15] as const;

const ETIQUETA_ESTADO_COMPACTA: Record<ValorEstadoFibra, string> = {
  sana: 'Baja (Sana)',
  procesada: 'Media (Porosa)',
  sensibilizada: 'Alta (Sensibilizada)',
};

const ETIQUETA_LARGO_TICKET: Record<ValorLargo, string> = {
  corto: 'Corto',
  medio: 'Medio',
  largo: 'Largo',
  extra_largo: 'Extra Largo',
};

const ETIQUETA_DENSIDAD_TICKET: Record<ValorDensidad, string> = {
  baja: 'Densidad Baja',
  media: 'Densidad Media',
  alta: 'Densidad Alta',
};

function precioBaseSugeridoPorServicio(srv?: ServicioSalon | null): number {
  return obtenerSemillaServicio(srv).tarifaBaseCop;
}

function gramosBaseSugeridosPorServicio(srv?: ServicioSalon | null): number {
  return obtenerSemillaServicio(srv).gramosBase;
}

function formatearMontoCortoCop(monto: number): string {
  if (monto <= 0) return 'Base';
  if (monto >= 1_000) {
    const miles = Math.round(monto / 1_000);
    return `+$${miles}k`;
  }
  return `+$${Math.round(monto)}`;
}

function calcularMontoImpactoVariable(
  precioBase: number,
  ajuste?: AjusteValorVariable
): number {
  if (!ajuste) return 0;
  const suma = typeof ajuste.suma === 'number' ? ajuste.suma : 0;
  const pct = typeof ajuste.porcentaje === 'number' ? ajuste.porcentaje : 0;
  return Math.round(suma + (precioBase * pct) / 100);
}

function VelliWorkspaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabUrl = searchParams.get('tab');
  const clientaIdUrl = searchParams.get('clientaId');
  const estilistaIdUrl = searchParams.get('estilistaId') || searchParams.get('specialistId');
  const servicioIdUrl = searchParams.get('servicioId') || searchParams.get('serviceId');
  const customerNameUrl = searchParams.get('customerName');
  const customerPhoneUrl = searchParams.get('customerPhone');

  const tab: 'cotizar' | 'cierre' = tabUrl === 'cierre' ? 'cierre' : 'cotizar';

  const setTab = useCallback(
    (next: 'cotizar' | 'cierre') => {
      router.replace(next === 'cierre' ? '/?tab=cierre' : '/', { scroll: false });
    },
    [router]
  );

  // ── Estado de catálogos reales de Supabase ───────────────────────────
  const [cargando, setCargando] = useState(true);
  const [guardandoModo, setGuardandoModo] = useState<'whatsapp' | 'cierre' | null>(null);
  const [refreshCierre, setRefreshCierre] = useState(0);
  const [porCobrarCount, setPorCobrarCount] = useState(0);

  const [nombreSalon, setNombreSalon] = useState('Tu Salón');
  const [ciudadSalon, setCiudadSalon] = useState('Colombia');
  const [orgActiva, setOrgActiva] = useState<OrganizacionPanelResumen | null>(null);
  const [conMarcaVelli, setConMarcaVelli] = useState(true);
  const [tienePlanIA, setTienePlanIA] = useState(true);
  const [cupoIA, setCupoIA] = useState<{ usados: number; tope: number }>({ usados: 0, tope: 150 });

  const [servicios, setServicios] = useState<ServicioSalon[]>(SERVICIOS_RESPALDO_LOCAL);
  const [plantillasPorServicio, setPlantillasPorServicio] = useState<Record<string, PlantillaPrecio>>({});
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);
  const [productos, setProductos] = useState<ProductoSalon[]>([]);
  const [reglasComision, setReglasComision] = useState<ComisionSalon[]>([]);
  const [todasClientas, setTodasClientas] = useState<Clienta[]>([]);

  // ── Clienta & Especialista ───────────────────────────────────────────
  const [clientaSeleccionada, setClientaSeleccionada] = useState<Clienta | null>(null);
  const [modoClientaRapida, setModoClientaRapida] = useState(false);
  const [consultaVigente, setConsultaVigente] = useState<Consulta | null>(null);
  const [nombreClientaTexto, setNombreClientaTexto] = useState('');
  const [telefonoClientaTexto, setTelefonoClientaTexto] = useState('');
  const [estilistaId, setEstilistaId] = useState('');

  // ── Selección de Servicio & Variables Capilares ──────────────────────
  const [servicioId, setServicioId] = useState<string>('');
  const [precioBaseRapido, setPrecioBaseRapido] = useState<string>('220000');

  const [manuales, setManuales] = useState<{
    largo?: ValorLargo;
    densidad?: ValorDensidad;
    estado?: ValorEstadoFibra;
    canas?: ValorCanas;
  }>({
    largo: 'medio',
    densidad: 'media',
    estado: 'sana',
    canas: '0_25',
  });
  const [desempateCanas, setDesempateCanas] = useState<'50_75' | '75_100' | undefined>(undefined);

  // ── Guardarraíles clínicos en silla + Steppers sin báscula ───────────
  const [sospechaHennaSilla, setSospechaHennaSilla] = useState(false);
  const [elasticidadBajaSilla, setElasticidadBajaSilla] = useState(false);
  const [cueroIrritadoSilla, setCueroIrritadoSilla] = useState(false);
  const [pruebaMechonSuperada, setPruebaMechonSuperada] = useState(false);
  const [deltaGramosSilla, setDeltaGramosSilla] = useState<number>(0);

  // ── Cámara IA opcional ───────────────────────────────────────────────
  const [camaraIAAbierta, setCamaraIAAbierta] = useState(false);

  // ── Ajuste Comercial Opcional (plegable dentro del ticket) ───────────
  const [mostrarAjusteComercial, setMostrarAjusteComercial] = useState(false);
  const [ajustePorcentaje, setAjustePorcentaje] = useState<number>(0);
  const [modoPrecioManual, setModoPrecioManual] = useState(false);
  const [precioManualTexto, setPrecioManualTexto] = useState('');
  const [motivoManual, setMotivoManual] = useState('');

  // ── Carga inicial desde Supabase ─────────────────────────────────────
  const cargarDatosSalon = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = createClient();
      const org = await obtenerOrganizacionActivaPanel().catch(() => null);
      setOrgActiva(org);
      const esSpecialistCarga = org?.role === 'specialist';

      const [
        prof,
        sub,
        svcsIniciales,
        plantillas,
        ests,
        prods,
        coms,
        listaClientas,
        pendientesCobro,
        iaDelMesRes,
      ] = await Promise.all([
        getProfile().catch(() => null),
        getSuscripcionEfectiva().catch(() => null),
        listarServiciosSalon({ soloActivos: true }).catch(() => [] as ServicioSalon[]),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
        listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
        esSpecialistCarga
          ? Promise.resolve([] as ProductoSalon[])
          : listarProductosSalon({ soloActivos: true }).catch(() => [] as ProductoSalon[]),
        esSpecialistCarga
          ? Promise.resolve([] as ComisionSalon[])
          : listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
        getAllClientas().catch(() => [] as Clienta[]),
        esSpecialistCarga && org
          ? listarCotizacionesOperativasSilla(org.id, { soloPorCobrar: true }).catch(() => [])
          : listarCotizacionesPorCobrar().catch(() => []),
        Promise.resolve(supabase.rpc('ia_analisis_del_mes')).catch(() => ({ data: 0 })),
      ]);

      if (!esSpecialistCarga && prof && prof.onboardingCompleted === false) {
        router.replace('/onboarding');
        return;
      }

      if (org?.name?.trim()) {
        setNombreSalon(org.name.trim());
      } else if (prof?.nombreSalon?.trim()) {
        setNombreSalon(prof.nombreSalon.trim());
      } else if (prof?.nombre?.trim()) {
        setNombreSalon(prof.nombre.trim());
      }
      if (org?.city?.trim()) {
        setCiudadSalon(org.city.trim());
      } else if (prof?.ciudad?.trim()) {
        setCiudadSalon(prof.ciudad.trim());
      }

      const planIA = !sub || sub.plan === 'pro_ia' || sub.estado === 'trialing';
      setConMarcaVelli(sub?.plan !== 'pro_ia');
      setTienePlanIA(planIA);
      setPorCobrarCount(pendientesCobro.length);

      const usadosMes =
        typeof iaDelMesRes?.data === 'number' && Number.isFinite(iaDelMesRes.data)
          ? Math.max(0, iaDelMesRes.data)
          : 0;
      const topeMes = sub?.estado === 'trialing' ? 20 : 150;
      setCupoIA({ usados: usadosMes, tope: topeMes });

      let svcs = svcsIniciales;
      if (!esSpecialistCarga && svcs.length === 0) {
        const semilla =
          prof?.servicios && prof.servicios.length > 0
            ? prof.servicios
            : SERVICIOS_SEMILLA_DEFECTO;
        await sembrarServiciosDesdeOnboarding(semilla).catch(() => [] as ServicioSalon[]);
        svcs = await listarServiciosSalon({ soloActivos: true }).catch(
          () => [] as ServicioSalon[]
        );
      }
      const svcsFinales = svcs.length > 0 ? svcs : SERVICIOS_RESPALDO_LOCAL;
      setServicios(svcsFinales);
      if (servicioIdUrl) {
        const srvPre = svcsFinales.find((s) => s.id === servicioIdUrl);
        if (srvPre) {
          setServicioId(srvPre.id);
          setPrecioBaseRapido(String(precioBaseSugeridoPorServicio(srvPre)));
        }
      }

      let estsEfectivas = ests;
      let prodsEfectivos = prods;
      let comsEfectivas = coms;
      const requiereActualizarSemilla =
        !esSpecialistCarga &&
        (prods.length === 0 ||
          ests.length === 0 ||
          coms.length === 0 ||
          prods.some((p) => p.tipo === 'oxidante' && p.precioCompra === 95_000) ||
          !prods.some(
            (p) => p.tipo === 'tinte' && p.presentacionCantidad === 60 && p.precioCompra === 27_900
          ) ||
          coms.some(
            (c) =>
              c.estilistaId === null &&
              c.servicioId === null &&
              c.tipo === 'porcentaje' &&
              (c.valor === 35 || (c.valor === 40 && c.base === 'precio'))
          ));

      if (requiereActualizarSemilla) {
        const sembrados = await sembrarBaseFinancieraSalon().catch(() => null);
        if (sembrados) {
          if (sembrados.productos.length > 0) prodsEfectivos = sembrados.productos;
          if (estsEfectivas.length === 0) estsEfectivas = sembrados.estilistas;
          if (sembrados.comisiones.length > 0) comsEfectivas = sembrados.comisiones;
        }
      }

      const mapaPlantillas: Record<string, PlantillaPrecio> = {};
      for (const p of plantillas) {
        if (!p.vigenteHasta) mapaPlantillas[p.servicioId] = p;
      }
      setPlantillasPorServicio(mapaPlantillas);
      setEstilistas(estsEfectivas);
      setProductos(prodsEfectivos);
      setReglasComision(comsEfectivas);

      // Deduplicar clientas por nombre normalizado e ID para evitar píldoras repetidas
      const nombresVistos = new Set<string>();
      const clientasUnicas: Clienta[] = [];
      for (const c of listaClientas) {
        const claveNombre = c.nombre.trim().toLowerCase();
        if (!claveNombre || nombresVistos.has(claveNombre)) continue;
        nombresVistos.add(claveNombre);
        clientasUnicas.push(c);
      }
      setTodasClientas(clientasUnicas);

      try {
        if (estilistaIdUrl && estsEfectivas.some((e) => e.id === estilistaIdUrl)) {
          setEstilistaId(estilistaIdUrl);
        } else {
          const guardada = window.localStorage.getItem(STORAGE_ULTIMA_ESTILISTA);
          if (guardada && estsEfectivas.some((e) => e.id === guardada)) {
            setEstilistaId(guardada);
          } else if (estsEfectivas.length > 0) {
            setEstilistaId(estsEfectivas[0].id);
          }
        }
      } catch {
        if (estilistaIdUrl && estsEfectivas.some((e) => e.id === estilistaIdUrl)) {
          setEstilistaId(estilistaIdUrl);
        } else if (estsEfectivas.length > 0) {
          setEstilistaId(estsEfectivas[0].id);
        }
      }

      const telCitaNormalizado = customerPhoneUrl ? numeroWhatsApp(customerPhoneUrl) : null;
      const preClienta =
        (clientaIdUrl ? listaClientas.find((c) => c.id === clientaIdUrl) : undefined) ??
        (telCitaNormalizado
          ? listaClientas.find((c) => numeroWhatsApp(c.telefono) === telCitaNormalizado)
          : undefined);

      if (preClienta) {
        setModoClientaRapida(false);
        setClientaSeleccionada(preClienta);
        setNombreClientaTexto(preClienta.nombre);
        setTelefonoClientaTexto(preClienta.telefono ?? '');
      } else if (customerNameUrl?.trim() || customerPhoneUrl?.trim()) {
        setModoClientaRapida(true);
        setClientaSeleccionada(null);
        setNombreClientaTexto(customerNameUrl?.trim() ?? '');
        setTelefonoClientaTexto(customerPhoneUrl?.trim() ?? '');
      } else if (listaClientas.length > 0) {
        setClientaSeleccionada(listaClientas[0]);
        setNombreClientaTexto(listaClientas[0].nombre);
        setTelefonoClientaTexto(listaClientas[0].telefono ?? '');
      }
    } finally {
      setCargando(false);
    }
  }, [router, clientaIdUrl, estilistaIdUrl, servicioIdUrl, customerNameUrl, customerPhoneUrl]);

  useEffect(() => {
    cargarDatosSalon();
  }, [cargarDatosSalon]);

  // Cargar última consulta cuando se elige una clienta registrada
  useEffect(() => {
    if (!clientaSeleccionada) {
      setConsultaVigente(null);
      setPruebaMechonSuperada(false);
      return;
    }
    let cancelado = false;
    getConsultasByClienta(clientaSeleccionada.id)
      .then((cs) => {
        if (cancelado) return;
        const vigente = cs.find((c) => !c.esBorrador) ?? cs[0] ?? null;
        setConsultaVigente(vigente);
        setPruebaMechonSuperada(false);
        if (vigente) {
          setManuales((prev) => ({
            largo: prev.largo ?? 'medio',
            densidad: undefined,
            estado: undefined,
            canas: undefined,
          }));
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [clientaSeleccionada]);

  const derivacion = useMemo(
    () =>
      derivarVariablesDesdeConsulta(consultaVigente, {
        desempateCanas,
        manuales,
      }),
    [consultaVigente, desempateCanas, manuales]
  );

  const variablesEfectivas: VariablesCotizacion = useMemo(
    () => ({
      largo: derivacion.variables.largo ?? { valor: 'medio', origen: 'manual' },
      densidad: derivacion.variables.densidad ?? { valor: 'media', origen: 'manual' },
      estado: derivacion.variables.estado ?? { valor: 'sana', origen: 'manual' },
      canas: derivacion.variables.canas ?? { valor: '0_25', origen: 'manual' },
    }),
    [derivacion.variables]
  );

  const diagnosticoColorBase = useMemo(
    () => diagnosticoDesdeConsulta(consultaVigente ?? undefined, clientaSeleccionada ?? undefined),
    [consultaVigente, clientaSeleccionada]
  );

  const hennaActiva =
    sospechaHennaSilla ||
    diagnosticoColorBase.hennaOMetales === 'si' ||
    diagnosticoColorBase.hennaOMetales === 'dudoso';
  const elasticidadActiva =
    elasticidadBajaSilla || diagnosticoColorBase.elasticidad === 'baja';
  const cueroIrritadoActivo =
    cueroIrritadoSilla || Boolean(diagnosticoColorBase.cueroCabelludoLesionado);

  const diagnosticoColor = useMemo(
    () => ({
      ...diagnosticoColorBase,
      ...(sospechaHennaSilla && !diagnosticoColorBase.hennaOMetales
        ? { hennaOMetales: 'dudoso' as const }
        : {}),
      ...(elasticidadBajaSilla
        ? { elasticidad: pruebaMechonSuperada ? ('media' as const) : ('baja' as const) }
        : {}),
      ...(cueroIrritadoSilla ? { cueroCabelludoLesionado: true } : {}),
      ...(pruebaMechonSuperada ? { pruebaMechonSuperada: true } : {}),
    }),
    [
      diagnosticoColorBase,
      sospechaHennaSilla,
      elasticidadBajaSilla,
      cueroIrritadoSilla,
      pruebaMechonSuperada,
    ]
  );

  const servicioActual = useMemo(
    () => servicios.find((s) => s.id === servicioId) ?? servicios[0] ?? null,
    [servicios, servicioId]
  );

  useEffect(() => {
    if (servicios.length === 0) return;
    if (servicioId && servicios.some((s) => s.id === servicioId)) return;
    const primeroDisponible =
      servicios.find((s) => !evaluarBloqueoServicioCotizador(s, diagnosticoColorBase)) ??
      servicios[0];
    if (primeroDisponible) {
      setServicioId(primeroDisponible.id);
      setPrecioBaseRapido(String(precioBaseSugeridoPorServicio(primeroDisponible)));
    }
  }, [servicios, servicioId, diagnosticoColorBase]);

  const seleccionarServicio = (srv: ServicioSalon) => {
    setServicioId(srv.id);
    setDeltaGramosSilla(0);
    const plant = plantillasPorServicio[srv.id];
    if (!plant) {
      setPrecioBaseRapido(String(precioBaseSugeridoPorServicio(srv)));
    }
  };

  const plantillaActual = servicioActual ? plantillasPorServicio[servicioActual.id] ?? null : null;
  const semillaActual = useMemo(() => obtenerSemillaServicio(servicioActual), [servicioActual]);

  const variablesActivasServicio = useMemo((): VariablesActivasServicio | undefined => {
    const ext = servicioActual?.perfilExtendido?.['variablesActivas'];
    if (Array.isArray(ext)) return ext as ClaveVariable[];
    return undefined;
  }, [servicioActual]);

  const avisosEstandar = useMemo(
    () =>
      evaluarAvisosEstandar({
        estado: variablesEfectivas.estado?.valor,
        canas: variablesEfectivas.canas?.valor,
        categoriaServicio: servicioActual?.categoria,
        usaFormulaColor: servicioActual?.usaFormulaColor,
      }),
    [variablesEfectivas.estado?.valor, variablesEfectivas.canas?.valor, servicioActual]
  );

  const bloqueoServicioSeleccionado = useMemo(
    () => (servicioActual ? evaluarBloqueoServicioCotizador(servicioActual, diagnosticoColor) : null),
    [servicioActual, diagnosticoColor]
  );

  const esQuimicoActual = useMemo(
    () =>
      servicioActual
        ? esServicioQuimico(servicioActual.categoria, servicioActual.usaFormulaColor)
        : true,
    [servicioActual]
  );

  const requierePruebaMechonClinica = useMemo(() => {
    if (bloqueoServicioSeleccionado?.codigo === 'henna_metales') return true;
    return avisosEstandar.some((a) => a.codigo === 'prueba_mechon_plex');
  }, [bloqueoServicioSeleccionado, avisosEstandar]);

  const hayGuardarrailesActivos =
    esQuimicoActual &&
    (hennaActiva ||
      elasticidadActiva ||
      cueroIrritadoActivo ||
      Boolean(bloqueoServicioSeleccionado) ||
      requierePruebaMechonClinica);

  // ── Cálculo en vivo: Precio + Costo sin Báscula + Comisión y Margen ──
  const precioBaseActual = useMemo(() => {
    if (!servicioActual) return 0;
    if (plantillaActual) {
      if (
        (semillaActual.slug === 'balayage' || semillaActual.slug === 'hidratacion') &&
        plantillaActual.precioBase === 120_000
      ) {
        return semillaActual.tarifaBaseCop;
      }
      return plantillaActual.precioBase;
    }
    return Math.max(0, Number(precioBaseRapido.replace(/\D/g, '')) || 0);
  }, [servicioActual, plantillaActual, semillaActual, precioBaseRapido]);

  const ajustesActivos = useMemo(
    () => normalizarAjustesVelvetStudio(plantillaActual?.ajustes),
    [plantillaActual]
  );

  const factoresConsumoActivos = useMemo(() => {
    const f = (plantillaActual?.consumo as ConsumoPlantillaInput | undefined)?.factores;
    return {
      largo: { ...FACTORES_CONSUMO_DEFECTO.largo, ...(f?.largo ?? {}) },
      densidad: { ...FACTORES_CONSUMO_DEFECTO.densidad, ...(f?.densidad ?? {}) },
      canas: { ...FACTORES_CONSUMO_DEFECTO.canas, ...(f?.canas ?? {}) },
    };
  }, [plantillaActual]);

  const calculoPrecio = useMemo(() => {
    if (!servicioActual) return null;
    const redondeo = plantillaActual?.redondeo ?? 1000;

    return calcularPrecioCotizacion(
      {
        precioBase: precioBaseActual,
        ajustes: ajustesActivos,
        variablesActivas: variablesActivasServicio,
        redondeo,
      },
      variablesEfectivas
    );
  }, [
    servicioActual,
    precioBaseActual,
    ajustesActivos,
    variablesActivasServicio,
    plantillaActual,
    variablesEfectivas,
  ]);

  const precioCotizadoFinal = useMemo(() => {
    const baseCalculado = calculoPrecio?.precioCalculado ?? 0;
    const redondeo = plantillaActual?.redondeo ?? 1000;

    if (modoPrecioManual && precioManualTexto.trim()) {
      const limpio = Number(precioManualTexto.replace(/\D/g, ''));
      if (Number.isFinite(limpio) && limpio >= 0) return limpio;
    }

    if (ajustePorcentaje !== 0) {
      const ajustado = baseCalculado * (1 + ajustePorcentaje / 100);
      return Math.max(0, Math.round(ajustado / redondeo) * redondeo);
    }

    return baseCalculado;
  }, [calculoPrecio, plantillaActual, modoPrecioManual, precioManualTexto, ajustePorcentaje]);

  const recargosDiagnosticoCop = precioCotizadoFinal - precioBaseActual;

  const { calculoCostoTeorico, calculoCosto, costoPorGramoRef } = useMemo(() => {
    const srv = servicioActual;
    const semilla = semillaActual;
    const consumoPlantilla = (plantillaActual?.consumo ?? {}) as ConsumoPlantillaInput;

    // Todos los servicios de SERVICIOS_BASE_SEMILLA calculan gramos/ml base (60g, 60ml, 35g)
    const usaCalculoGramos =
      srv?.categoria === 'corte' || srv?.categoria === 'peinado'
        ? Boolean(srv?.usaFormulaColor || consumoPlantilla.usaFormulaColor)
        : true;

    const prodPrincipalReal = productos.find((p) => {
      if (semilla.slug === 'balayage') return p.tipo === 'decolorante';
      if (semilla.slug === 'tinte-global') return p.tipo === 'tinte' && !p.nombre.toLowerCase().includes('estándar');
      if (semilla.slug === 'alisado-organico') return p.unidad === 'ml' && p.tipo === 'tratamiento';
      if (semilla.slug === 'hidratacion') return p.unidad === 'g' && p.tipo === 'tratamiento';
      return false;
    });

    const prodOxidanteReal = productos.find(
      (p) =>
        p.tipo === 'oxidante' &&
        p.unidad === 'ml' &&
        !(p.presentacionCantidad === 1000 && p.precioCompra === 95_000)
    );

    const prodPrincipalFallback: ProductoSalonCostoInput = {
      nombre: semilla.nombre,
      precioUnitario: semilla.costoGramoBaseCop,
    };

    const prodOxidanteFallback: ProductoSalonCostoInput = {
      nombre: 'Loción Activadora / Peróxido 10V-20V-30V (Botella 1 Litro)',
      presentacionCantidad: 1_000,
      unidad: 'ml',
      precioCompra: 32_000, // $32 COP/ml (CATALOGO_QUIMICO_SEMILLA)
      precioUnitario: semilla.ratioPeroxido > 0 ? semilla.costoMlPeroxidoCop : 0,
    };

    const productoTinteUsado = prodPrincipalReal ?? prodPrincipalFallback;
    const productoOxidanteUsado =
      semilla.ratioPeroxido > 0
        ? prodOxidanteReal ?? prodOxidanteFallback
        : { nombre: 'Sin peróxido', precioUnitario: 0 };

    const unitarioGramo =
      calcularPrecioUnitarioProducto(productoTinteUsado) || semilla.costoGramoBaseCop;

    const estadoActual = variablesEfectivas.estado?.valor;
    const recargoEstadoInsumos =
      estadoActual === 'sensibilizada' ? 4_500 : estadoActual === 'procesada' ? 2_000 : 0;

    // Ignorar el legado de onboarding anterior (90g en balayage o $3.000 fijos en decoloración)
    const gramosPlantilla = consumoPlantilla.gramosTinteBase;
    const gramosBaseEfectivos =
      semilla.slug === 'balayage' && gramosPlantilla === 90
        ? semilla.gramosBase
        : gramosPlantilla ?? gramosBaseSugeridosPorServicio(srv);

    const propPlantilla = consumoPlantilla.proporcionOxidante;
    const proporcionEfectiva =
      semilla.slug === 'tinte-global' && propPlantilla === 1.5
        ? semilla.ratioPeroxido
        : propPlantilla ?? (semilla.ratioPeroxido > 0 ? semilla.ratioPeroxido : 1);

    const insumosBaseServicio = Math.max(
      semilla.insumosFijosCop,
      consumoPlantilla.insumosFijos ?? 0
    );

    const consumoBase: ConsumoPlantillaInput = {
      ...consumoPlantilla,
      usaFormulaColor: usaCalculoGramos,
      gramosTinteBase: gramosBaseEfectivos,
      proporcionOxidante: proporcionEfectiva,
      insumosFijos: insumosBaseServicio + recargoEstadoInsumos,
    };

    const teorico = calcularCostoProducto({
      variables: variablesEfectivas,
      consumo: consumoBase,
      productoTinte: productoTinteUsado,
      productoOxidante: productoOxidanteUsado,
    });

    if (!usaCalculoGramos || deltaGramosSilla === 0) {
      return {
        calculoCostoTeorico: teorico,
        calculoCosto: teorico,
        costoPorGramoRef: unitarioGramo,
      };
    }

    const gramosAjustados = Math.max(5, Math.round(teorico.gramosTinte) + deltaGramosSilla);
    const efectivo = calcularCostoProducto({
      variables: variablesEfectivas,
      consumo: consumoBase,
      formulaFinal: {
        componentes: [
          {
            descripcion: semilla.nombre,
            gramos: gramosAjustados,
          },
        ],
        proporcion: teorico.detalle.proporcionOxidante,
      },
      aplicarFactoresAFormula: false,
      productoTinte: productoTinteUsado,
      productoOxidante: productoOxidanteUsado,
    });

    return {
      calculoCostoTeorico: teorico,
      calculoCosto: efectivo,
      costoPorGramoRef: unitarioGramo,
    };
  }, [servicioActual, semillaActual, plantillaActual, productos, variablesEfectivas, deltaGramosSilla]);

  const reglasComisionEfectivas: readonly ReglaComision[] = useMemo(
    () =>
      reglasComision.length > 0
        ? reglasComision.map((r) =>
            r.estilistaId === null &&
            r.servicioId === null &&
            r.tipo === 'porcentaje' &&
            (r.valor === 35 || (r.valor === 40 && r.base === 'precio'))
              ? { ...r, valor: 40, base: 'precio_menos_producto' as const }
              : r
          )
        : [REGLA_COMISION_SALUDABLE_DEFECTO],
    [reglasComision]
  );

  const calculoComision = useMemo(
    () =>
      calcularComisionYMargen({
        precio: precioCotizadoFinal,
        costoProducto: calculoCosto.costoTotal,
        reglas: reglasComisionEfectivas,
        estilistaId: estilistaId || null,
        servicioId: servicioActual?.id ?? null,
        umbralMargenMinimo: 30,
        redondeo: plantillaActual?.redondeo ?? 1000,
      }),
    [
      precioCotizadoFinal,
      calculoCosto.costoTotal,
      reglasComisionEfectivas,
      estilistaId,
      servicioActual,
      plantillaActual,
    ]
  );

  const obtenerEtiquetaComisionEstilista = useCallback(
    (idEst: string) => {
      const sel = seleccionarReglaComision(reglasComisionEfectivas, {
        estilistaId: idEst,
        servicioId: servicioActual?.id ?? null,
      });
      if (!sel.regla) return `${PORCENTAJE_COMISION_SALUDABLE_DEFECTO}%`;
      if (sel.regla.tipo === 'porcentaje') {
        const pct =
          sel.regla.valor > 0 && sel.regla.valor <= 1 ? sel.regla.valor * 100 : sel.regla.valor;
        return `${Math.round(pct)}%`;
      }
      return formatearPrecioCop(sel.regla.valor);
    },
    [reglasComisionEfectivas, servicioActual]
  );

  const margenPctEntero = Math.round(calculoComision.margenPorcentaje);
  const esRentabilidadOptima =
    !calculoComision.alertaMargenBajo && calculoComision.margenPorcentaje >= 30;

  const ticketVivo = useMemo(() => {
    const pctComision =
      calculoComision.detalle.tipo === 'porcentaje'
        ? calculoComision.detalle.valor
        : PORCENTAJE_COMISION_SALUDABLE_DEFECTO;
    return calcularTicketFinancieroVivo({
      tarifaBaseCop: precioBaseActual,
      recargoVariablesCop: recargosDiagnosticoCop,
      gramosBase: calculoCostoTeorico.detalle.gramosBase || semillaActual.gramosBase,
      multiplicadorTotal: calculoCostoTeorico.detalle.factores.total || 1,
      ajusteManualGramos: deltaGramosSilla,
      costoGramoCop: costoPorGramoRef,
      ratioPeroxido: semillaActual.ratioPeroxido,
      costoMlPeroxidoCop: semillaActual.ratioPeroxido > 0 ? semillaActual.costoMlPeroxidoCop : 0,
      insumosFijosCop: calculoCosto.insumosFijos,
      porcentajeComision: pctComision,
      comisionSobreNetoQuimico: true,
      unidadFisica: semillaActual.unidadFisica,
    });
  }, [
    precioBaseActual,
    recargosDiagnosticoCop,
    calculoCostoTeorico,
    semillaActual,
    deltaGramosSilla,
    costoPorGramoRef,
    calculoCosto.insumosFijos,
    calculoComision.detalle,
  ]);

  // ── Handlers de interacción ──────────────────────────────────────────
  const cambiarEstilista = (id: string) => {
    setEstilistaId(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_ULTIMA_ESTILISTA, id);
      else window.localStorage.removeItem(STORAGE_ULTIMA_ESTILISTA);
    } catch {
      // localStorage no disponible
    }
  };

  const elegirClientaExistente = (c: Clienta) => {
    setModoClientaRapida(false);
    setClientaSeleccionada(c);
    setNombreClientaTexto(c.nombre);
    setTelefonoClientaTexto(c.telefono ?? '');
  };

  const activarClientaRapida = () => {
    setModoClientaRapida(true);
    setClientaSeleccionada(null);
    setConsultaVigente(null);
    setNombreClientaTexto('');
    setTelefonoClientaTexto('');
  };

  const aplicarResultadoIA = (result: HairAnalysisResult) => {
    const nuevoEstado: ValorEstadoFibra =
      result.danoVisible === 'severo'
        ? 'sensibilizada'
        : result.porosidad === 'alta' ||
            result.danoVisible === 'moderado' ||
            result.danoVisible === 'leve'
          ? 'procesada'
          : 'sana';

    setManuales((prev) => ({
      ...prev,
      densidad: result.densidad ?? prev.densidad ?? 'media',
      estado: nuevoEstado,
    }));
    setCupoIA((prev) => ({ ...prev, usados: prev.usados + 1 }));
    setCamaraIAAbierta(false);
    showToast(
      `IA Capilar aplicada: densidad ${result.densidad ?? 'media'} · fibra ${nuevoEstado}. Verifica largo y canas.`,
      'success'
    );
  };

  const handleConfirmarCotizacion = async (modo: 'whatsapp' | 'cierre') => {
    if (guardandoModo || !servicioActual || !calculoPrecio) return;

    if (bloqueoServicioSeleccionado) {
      showToast(bloqueoServicioSeleccionado.titulo, 'error');
      return;
    }

    const precioCalculado = Math.round(calculoPrecio.precioCalculado);
    const precioCotizado = Math.round(precioCotizadoFinal);
    const difierePrecio = precioCotizado !== precioCalculado;

    const motivoEfectivo =
      motivoManual.trim() ||
      (ajustePorcentaje !== 0
        ? `Ajuste comercial ${ajustePorcentaje > 0 ? `+${ajustePorcentaje}` : ajustePorcentaje}%`
        : difierePrecio
          ? 'Ajuste comercial en silla'
          : '');

    if (difierePrecio && motivoEfectivo.length < 3) {
      showToast('Indica brevemente la nota del ajuste comercial (mín. 3 caracteres)', 'error');
      return;
    }

    setGuardandoModo(modo);
    try {
      // 1. Resolver o crear clienta si escribió nombre nuevo
      let clientaFinal = clientaSeleccionada;
      const nombreLimpio = nombreClientaTexto.trim();
      const telLimpio = telefonoClientaTexto.trim();

      if (!clientaFinal && nombreLimpio.length >= 2) {
        const coincidencia = todasClientas.find(
          (c) => c.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase()
        );
        if (coincidencia) {
          clientaFinal = coincidencia;
        } else {
          const nueva: Clienta = {
            id: crypto.randomUUID(),
            nombre: nombreLimpio,
            edad: 0,
            telefono: telLimpio,
            fechaRegistro: new Date().toISOString().slice(0, 10),
            totalVisitas: 0,
          };
          try {
            await createClienta(nueva);
            clientaFinal = nueva;
            setClientaSeleccionada(nueva);
            setModoClientaRapida(false);
            setTodasClientas((prev) => [nueva, ...prev]);
          } catch {
            clientaFinal = null;
          }
        }
      }

      // 2. Asegurar plantilla publicada si el servicio real aún no tenía versión 1
      const esServicioReal = !servicioActual.id.startsWith('local-');
      let plantilla = plantillaActual;
      if (esServicioReal && !plantilla && orgActiva?.role !== 'specialist') {
        const baseNum = Math.max(0, Number(precioBaseRapido.replace(/\D/g, '')) || 0);
        try {
          await publicarPlantillaPrecio({
            servicioId: servicioActual.id,
            precioBase: baseNum,
            ajustes: AJUSTES_EJEMPLO_PLANTILLA,
            redondeo: 1000,
            vigenciaDias: 15,
          });
          plantilla = await obtenerPlantillaVigente(servicioActual.id);
          if (plantilla) {
            setPlantillasPorServicio((prev) => ({ ...prev, [servicioActual.id]: plantilla! }));
          }
        } catch {
          // Continúa con cálculo directo si la RPC no está disponible
        }
      }

      const vigenciaDias = plantilla?.vigenciaDias || 15;
      const vigenciaHasta = new Date(Date.now() + vigenciaDias * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const estObj = estilistas.find((e) => e.id === estilistaId);

      // 3. Crear cotización en Supabase (vía RPC operativa para specialist)
      const esSpecialistActual = orgActiva?.role === 'specialist';
      let cotizacion =
        esSpecialistActual && orgActiva
          ? await crearCotizacionOperativaSilla(orgActiva.id, {
              clientaId: clientaFinal?.id ?? null,
              consultaId: consultaVigente?.id ?? null,
              estilistaId: estilistaId || null,
              estilistaNombre: estObj?.nombre ?? null,
              servicioId: esServicioReal ? servicioActual.id : null,
              plantillaId: plantilla?.id ?? null,
              plantillaVersion: plantilla?.version ?? 1,
              servicioNombre: servicioActual.nombre,
              variables: variablesEfectivas,
              precioCalculado,
              precioCotizado,
              ajusteManualMotivo: difierePrecio ? motivoEfectivo : null,
              vigenciaHasta,
              conMarcaVelli,
            })
          : await crearCotizacion({
              clientaId: clientaFinal?.id ?? null,
              consultaId: consultaVigente?.id ?? null,
              estilistaId: estilistaId || null,
              estilistaNombre: estObj?.nombre ?? null,
              servicioId: esServicioReal ? servicioActual.id : null,
              plantillaId: plantilla?.id ?? null,
              plantillaVersion: plantilla?.version ?? 1,
              servicioNombre: servicioActual.nombre,
              variables: variablesEfectivas,
              precioCalculado,
              precioCotizado,
              ajusteManualMotivo: difierePrecio ? motivoEfectivo : null,
              vigenciaHasta,
              estado: modo === 'whatsapp' ? 'borrador' : 'enviada',
              formula: {
                clientaNombre: clientaFinal?.nombre || nombreLimpio || undefined,
                enviadaPorWhatsApp: modo === 'whatsapp',
                gramosTeoricos: Math.round(calculoCostoTeorico.gramosTinte),
                gramosTinte: Math.round(calculoCosto.gramosTinte),
                deltaGramosSilla,
                mlOxidante: calculoCosto.mlOxidanteRedondeado,
                insumosFijos: calculoCosto.insumosFijos,
                pruebaMechonSuperada: pruebaMechonSuperada || undefined,
              },
              costoProductoEstimado: calculoCosto.costoTotal,
              costoDetalle: calculoCosto.detalle,
              comisionEstimada: calculoComision.comision,
              comisionDetalle: calculoComision.detalle,
              conMarcaVelli,
            });

      if (modo === 'whatsapp') {
        if (!esSpecialistActual) {
          cotizacion = await enviarCotizacion(cotizacion.id);
        }
        const { urlWhatsApp } = armarEnlaceWhatsAppCotizacion({
          nombreClienta: clientaFinal?.nombre || nombreLimpio || 'clienta',
          telefonoClienta: clientaFinal?.telefono || telLimpio || null,
          servicioNombre: cotizacion.servicioNombre,
          salonNombre: nombreSalon,
          precio: cotizacion.precioCotizado,
          vigenciaHasta: cotizacion.vigenciaHasta,
          tokenPublico: cotizacion.tokenPublico,
        });
        window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');
        setRefreshCierre((n) => n + 1);
        setPorCobrarCount((n) => n + 1);
        showToast('Cotización enviada por WhatsApp y lista en Por Cobrar', 'success');
      } else {
        setRefreshCierre((n) => n + 1);
        setPorCobrarCount((n) => n + 1);
        showToast('Guardada en Por Cobrar', 'success');
        setTab('cierre');
      }
    } catch (err) {
      console.error('[cotizador.workspace]', err);
      showToast(
        err instanceof Error ? err.message : 'No se pudo guardar la cotización',
        'error'
      );
    } finally {
      setGuardandoModo(null);
    }
  };

  const estSeleccionadaObj = estilistas.find((e) => e.id === estilistaId);
  const etiquetaPctEstilistaActiva = estilistaId
    ? obtenerEtiquetaComisionEstilista(estilistaId)
    : calculoComision.detalle.tipo === 'porcentaje'
      ? `${Math.round(calculoComision.detalle.valor)}%`
      : formatearPrecioCop(calculoComision.detalle.valor);

  const resumenVariablesTicket = `${
    ETIQUETA_LARGO_TICKET[variablesEfectivas.largo?.valor ?? 'medio']
  } · ${ETIQUETA_DENSIDAD_TICKET[variablesEfectivas.densidad?.valor ?? 'media']}`;

  const esSpecialist = orgActiva?.role === 'specialist';

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] pb-12">
      {/* ── 1. HEADER SUPERIOR UNIFICADO (Sin barra inferior fija) ───────── */}
      <VelvetTopHeader
        nombreSalon={nombreSalon}
        ciudadSalon={ciudadSalon}
        tienePlanIA={tienePlanIA}
        cupoIA={cupoIA}
        rolOrganizacion={orgActiva?.role ?? null}
      />

      {/* ── 2. SUB-HEADER Y WORKSPACE PRINCIPAL ─────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-[#3B0D1E] tracking-tight font-display">
              Workspace Maestro en Silla
            </h1>
            <p className="text-xs text-[#6E4F5D]">
              Diagnóstico táctil, cotización precisa sin báscula y cierre en 1 toque
              {cargando ? ' · Sincronizando salón…' : ''}
            </p>
          </div>

          {/* Conmutador ?tab=cierre */}
          <div className="inline-flex bg-white p-1.5 rounded-2xl border border-[#EFE8E4] shadow-sm self-start">
            <button
              type="button"
              onClick={() => setTab('cotizar')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === 'cotizar'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-sm'
                  : 'text-[#6E4F5D] hover:text-[#3B0D1E]'
              }`}
            >
              Cotizar en Silla
            </button>
            <button
              type="button"
              onClick={() => setTab('cierre')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                tab === 'cierre'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-sm'
                  : 'text-[#6E4F5D] hover:text-[#3B0D1E]'
              }`}
            >
              Por Cobrar
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#D97757] text-white font-bold tabular-nums">
                {porCobrarCount}
              </span>
            </button>
          </div>
        </div>

        {tab === 'cierre' ? (
          <div className="space-y-6">
            <ListaPorCobrar
              refreshKey={refreshCierre}
              clientas={todasClientas}
              estilistas={estilistas}
              organizationId={orgActiva?.id}
              rolOrganizacion={orgActiva?.role ?? null}
              mostrarVacio
              onIrACotizar={() => setTab('cotizar')}
              onCountChange={setPorCobrarCount}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ══════════════════════════════════════════════════════════════
                COLUMNA IZQUIERDA (7 cols): 2 TARJETAS MAESTRAS UNIFICADAS
               ══════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-7 space-y-5">
              {/* ── TARJETA 1: 1. Clienta, Especialista y Servicio ───────── */}
              <section className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)]">
                {/* Cabecera de Tarjeta 1 */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#3B0D1E] text-white text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                      1
                    </span>
                    <h2 className="font-sans text-base font-bold tracking-tight text-[#3B0D1E]">
                      Clienta, Especialista y Servicio
                    </h2>
                  </div>
                </div>

                {/* Fila Superior: Clienta en Silla + Especialista Asignada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  {/* Columna A: CLIENTA EN SILLA */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                        CLIENTA EN SILLA
                      </label>
                      <Link
                        href="/clientas/nueva"
                        className="font-sans text-[11px] font-bold text-[#7C3AED] hover:underline no-underline"
                      >
                        + Nueva Clienta
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {todasClientas.slice(0, 6).map((c) => {
                        const seleccionada = !modoClientaRapida && clientaSeleccionada?.id === c.id;
                        const texturaBadge =
                          c.tipoRizoPrincipal ||
                          (seleccionada ? consultaVigente?.tipoRizoPrincipal : undefined) ||
                          '2B';
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => elegirClientaExistente(c)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                              seleccionada
                                ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                                : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                            }`}
                          >
                            <span className="truncate max-w-[125px] capitalize">{c.nombre}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                                seleccionada
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#EFE8E4]/80 text-[#6B535C]'
                              }`}
                            >
                              {texturaBadge}
                            </span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={activarClientaRapida}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                          modoClientaRapida || todasClientas.length === 0
                            ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                            : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                        }`}
                      >
                        <span>
                          {todasClientas.length === 0 ? 'Clienta Directa' : 'En silla (rápida)'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                            modoClientaRapida || todasClientas.length === 0
                              ? 'bg-white/20 text-white'
                              : 'bg-[#EFE8E4]/80 text-[#6B535C]'
                          }`}
                        >
                          Express
                        </span>
                      </button>
                    </div>

                    {(modoClientaRapida || todasClientas.length === 0) && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={nombreClientaTexto}
                          onChange={(e) => setNombreClientaTexto(e.target.value)}
                          placeholder="Nombre clienta (opcional)"
                          className="px-3 py-1.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] font-sans text-xs font-medium text-[#3B0D1E] placeholder-[#947C85] outline-none focus:border-[#3B0D1E]"
                        />
                        <input
                          type="tel"
                          value={telefonoClientaTexto}
                          onChange={(e) => setTelefonoClientaTexto(e.target.value)}
                          placeholder="WhatsApp (opcional)"
                          className="px-3 py-1.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] font-sans text-xs font-medium text-[#3B0D1E] placeholder-[#947C85] outline-none focus:border-[#3B0D1E] tabular-nums"
                        />
                      </div>
                    )}
                  </div>

                  {/* Columna B: ESPECIALISTA ASIGNADA */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                        ESPECIALISTA ASIGNADA
                      </label>
                      {!esSpecialist && (
                        <Link
                          href="/configuracion/precios"
                          className="font-sans text-[11px] font-bold text-[#6B535C] hover:text-[#3B0D1E] no-underline"
                        >
                          Equipo
                        </Link>
                      )}
                    </div>

                    {estilistas.length === 0 ? (
                      <div className="px-3 py-2 rounded-xl bg-[#3B0D1E] text-white border border-[#3B0D1E] inline-flex items-center gap-1.5 text-xs font-semibold">
                        <span>Especialista Principal</span>
                        {!esSpecialist && (
                          <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded-md tabular-nums">
                            40%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {estilistas.map((est) => {
                          const activa = estilistaId === est.id;
                          const pctLabel = obtenerEtiquetaComisionEstilista(est.id);
                          return (
                            <button
                              key={est.id}
                              type="button"
                              onClick={() => cambiarEstilista(est.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                activa
                                  ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                                  : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                              }`}
                            >
                              <span className="capitalize">{est.nombre}</span>
                              {!esSpecialist && (
                                <span
                                  className={`font-mono text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                                    activa
                                      ? 'bg-white/20 text-white'
                                      : 'bg-[#EFE8E4]/80 text-[#6B535C]'
                                  }`}
                                >
                                  {pctLabel}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fila Inferior: PROCEDIMIENTO / SERVICIO BASE */}
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-2.5">
                    PROCEDIMIENTO / SERVICIO BASE
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {servicios.map((srv) => {
                      const active = servicioActual?.id === srv.id;
                      const plant = plantillasPorServicio[srv.id];
                      const semSrv = obtenerSemillaServicio(srv);
                       const baseRef =
                        plant &&
                        !(
                          (semSrv.slug === 'balayage' || semSrv.slug === 'hidratacion') &&
                          plant.precioBase === 120_000
                        )
                          ? plant.precioBase
                          : precioBaseSugeridoPorServicio(srv);
                      const gramosPlant = (plant?.consumo as ConsumoPlantillaInput | undefined)
                        ?.gramosTinteBase;
                      const gramosBaseSrv =
                        semSrv.slug === 'balayage' && gramosPlant === 90
                          ? semSrv.gramosBase
                          : semSrv.slug === 'hidratacion' && (!gramosPlant || gramosPlant === 60)
                            ? semSrv.gramosBase
                            : gramosPlant ?? gramosBaseSugeridosPorServicio(srv);
                      const sufijoUnidadSrv = semSrv.unidadFisica === 'onza_30ml' ? 'ml' : 'g';

                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => seleccionarServicio(srv)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E] shadow-md'
                              : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-sans font-bold text-sm leading-snug capitalize">
                              {srv.nombre}
                            </span>
                            <span
                              className={`font-sans text-sm font-bold tabular-nums shrink-0 ${
                                active ? 'text-[#FAF7F5]' : 'text-[#3B0D1E]'
                              }`}
                            >
                              {formatearPrecioCop(baseRef)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span
                              className={`font-mono text-[11px] tabular-nums ${
                                active ? 'text-[#E8CFC8]' : 'text-[#6B535C]'
                              }`}
                            >
                              {`${gramosBaseSrv}${sufijoUnidadSrv} base`}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-md font-sans text-[10px] font-bold ${
                                active
                                  ? 'bg-white/15 text-[#E8CFC8]'
                                  : 'bg-[#F5EBE8] text-[#6B535C]'
                              }`}
                            >
                              {semSrv.requiereQuimico ? 'Químico / Decoloración' : semSrv.categoria}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* ── TARJETA 2: 2. Diagnóstico Capilar Táctil + IA ────────── */}
              <section className="bg-white rounded-2xl p-5 border border-[#EFE8E4] shadow-[0_10px_30px_-5px_rgba(59,13,30,0.05)] space-y-4">
                {/* Cabecera con Botón IA Destacado */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#3B0D1E] text-white text-xs font-bold flex items-center justify-center tabular-nums shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <h2 className="font-sans text-base font-bold tracking-tight text-[#3B0D1E]">
                        Diagnóstico Capilar Táctil + IA
                      </h2>
                      <p className="font-sans text-xs text-[#6B535C]">
                        Recalcula gramos, mililitros y tarifa en tiempo real
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!tienePlanIA) {
                        showToast(
                          esSpecialist
                            ? 'El análisis fotográfico con IA lo habilita la administración del salón'
                            : 'El análisis fotográfico con IA hace parte del Plan Salón Pro + IA ($149.000/mes)',
                          'info'
                        );
                        if (!esSpecialist) {
                          router.push('/planes');
                        }
                        return;
                      }
                      setCamaraIAAbierta(true);
                    }}
                    className="self-start sm:self-auto bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] px-3.5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                  >
                    {tienePlanIA ? <Camera size={14} /> : <Lock size={14} />}
                    <span>Analizar Foto con IA (Claude Vision)</span>
                    {tienePlanIA && (
                      <span className="font-mono text-[11px] font-bold tabular-nums">
                        ({cupoIA.usados}/{cupoIA.tope})
                      </span>
                    )}
                  </button>
                </div>

                {/* Selectores de Variables Compactos en Píldoras */}
                <div className="space-y-3.5">
                  {/* Longitud (grid-cols-4) */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-1.5">
                      Longitud
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {CATALOGO_VARIABLES.largo.map((item) => {
                        const active = variablesEfectivas.largo?.valor === item.valor;
                        const deltaCop = calcularMontoImpactoVariable(
                          precioBaseActual,
                          ajustesActivos?.largo?.[item.valor]
                        );
                        const factor = factoresConsumoActivos.largo[item.valor] ?? 1;
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() =>
                              setManuales((prev) => ({ ...prev, largo: item.valor }))
                            }
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
                              active
                                ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                                : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                            }`}
                          >
                            <div className="font-bold leading-tight truncate">{item.etiqueta}</div>
                            <div
                              className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                                active ? 'text-[#E8CFC8]' : 'text-[#6B535C]'
                              }`}
                            >
                              {formatearMontoCortoCop(deltaCop)} · {factor}x
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Densidad (grid-cols-3) */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-1.5">
                      Densidad
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CATALOGO_VARIABLES.densidad.map((item) => {
                        const active = variablesEfectivas.densidad?.valor === item.valor;
                        const deltaCop = calcularMontoImpactoVariable(
                          precioBaseActual,
                          ajustesActivos?.densidad?.[item.valor]
                        );
                        const factor = factoresConsumoActivos.densidad[item.valor] ?? 1;
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() =>
                              setManuales((prev) => ({ ...prev, densidad: item.valor }))
                            }
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
                              active
                                ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                                : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                            }`}
                          >
                            <div className="font-bold leading-tight">{item.etiqueta}</div>
                            <div
                              className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                                active ? 'text-[#E8CFC8]' : 'text-[#6B535C]'
                              }`}
                            >
                              {formatearMontoCortoCop(deltaCop)} · {factor}x
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Porosidad (grid-cols-3) */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-1.5">
                      Porosidad
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CATALOGO_VARIABLES.estado.map((item) => {
                        const active = variablesEfectivas.estado?.valor === item.valor;
                        const deltaCop = calcularMontoImpactoVariable(
                          precioBaseActual,
                          ajustesActivos?.estado?.[item.valor]
                        );
                        const tagAditivo =
                          item.valor === 'sensibilizada'
                            ? '+Plex'
                            : item.valor === 'procesada'
                              ? 'Sellante'
                              : '1.0x';
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() =>
                              setManuales((prev) => ({ ...prev, estado: item.valor }))
                            }
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
                              active
                                ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                                : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                            }`}
                          >
                            <div className="font-bold leading-tight truncate">
                              {ETIQUETA_ESTADO_COMPACTA[item.valor]}
                            </div>
                            <div
                              className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                                active ? 'text-[#E8CFC8]' : 'text-[#6B535C]'
                              }`}
                            >
                              {formatearMontoCortoCop(deltaCop)} · {tagAditivo}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Canas (grid-cols-4) */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-1.5">
                      Porcentaje de Canas
                    </label>

                    {derivacion.canasPorPrecisar && (
                      <div className="mb-2.5 p-3 rounded-xl bg-[#FAF7F5] border border-[#E8CFC8]">
                        <SelectorTramoCanas
                          valor={
                            desempateCanas === '50_75'
                              ? PORCENTAJE_CANAS_POR_TRAMO.entre_50_75
                              : desempateCanas === '75_100'
                                ? PORCENTAJE_CANAS_POR_TRAMO.mas_75
                                : null
                          }
                          onChange={(v) => {
                            const tramo =
                              v === PORCENTAJE_CANAS_POR_TRAMO.mas_75 ? '75_100' : '50_75';
                            setDesempateCanas(tramo);
                            setManuales((prev) => ({ ...prev, canas: tramo }));
                          }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                      {CATALOGO_VARIABLES.canas.map((item) => {
                        const active = variablesEfectivas.canas?.valor === item.valor;
                        const deltaCop = calcularMontoImpactoVariable(
                          precioBaseActual,
                          ajustesActivos?.canas?.[item.valor]
                        );
                        const factor = factoresConsumoActivos.canas[item.valor] ?? 1;
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() => {
                              if (item.valor === '50_75' || item.valor === '75_100') {
                                setDesempateCanas(item.valor);
                              }
                              setManuales((prev) => ({ ...prev, canas: item.valor }));
                            }}
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer tabular-nums ${
                              active
                                ? 'bg-[#3B0D1E] text-white border-[#3B0D1E] shadow-sm'
                                : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white hover:border-[#E8CFC8]'
                            }`}
                          >
                            <div className="font-bold leading-tight">{item.etiqueta}</div>
                            <div
                              className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                                active ? 'text-[#E8CFC8]' : 'text-[#6B535C]'
                              }`}
                            >
                              {formatearMontoCortoCop(deltaCop)} · {factor}x
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sección Inferior: Guardarraíles Clínicos (lib/color/reglas.ts) */}
                <div className="pt-3 border-t border-[#EFE8E4] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                      Guardarraíles Clínicos (lib/color/reglas.ts)
                    </span>
                  </div>

                  {/* 3 Toggles clínicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSospechaHennaSilla((v) => !v);
                        if (sospechaHennaSilla) setPruebaMechonSuperada(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between gap-1.5 cursor-pointer ${
                        hennaActiva
                          ? 'bg-[#FFF7F5] border-[#D97757] text-[#D97757]'
                          : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white'
                      }`}
                    >
                      <span className="leading-snug">Henna / Sales Metálicas</span>
                      <ShieldAlert
                        size={14}
                        className={`shrink-0 ${hennaActiva ? 'text-[#D97757]' : 'text-[#947C85]'}`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setElasticidadBajaSilla((v) => !v);
                        if (elasticidadBajaSilla) setPruebaMechonSuperada(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between gap-1.5 cursor-pointer ${
                        elasticidadActiva
                          ? 'bg-[#FFF7F5] border-[#D97757] text-[#D97757]'
                          : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white'
                      }`}
                    >
                      <span className="leading-snug">Elasticidad Baja / Tricoptilosis</span>
                      <ShieldAlert
                        size={14}
                        className={`shrink-0 ${
                          elasticidadActiva ? 'bg-[#D97757]' : 'text-[#947C85]'
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCueroIrritadoSilla((v) => !v);
                        if (cueroIrritadoSilla) setPruebaMechonSuperada(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between gap-1.5 cursor-pointer ${
                        cueroIrritadoActivo
                          ? 'bg-[#FFF7F5] border-[#D97757] text-[#D97757]'
                          : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-white'
                      }`}
                    >
                      <span className="leading-snug">Cuero Cabelludo Irritado</span>
                      <ShieldAlert
                        size={14}
                        className={`shrink-0 ${
                          cueroIrritadoActivo ? 'text-[#D97757]' : 'text-[#947C85]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Banner de bloqueo en #FFF7F5 con borde #D97757 y botón Prueba de Mechón Superada */}
                  {hayGuardarrailesActivos && (
                    <div
                      className={`rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        pruebaMechonSuperada && !bloqueoServicioSeleccionado
                          ? 'bg-[#F0FDFA] border-[#0D9488]/40'
                          : 'bg-[#FFF7F5] border-[#D97757]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {pruebaMechonSuperada && !bloqueoServicioSeleccionado ? (
                          <ShieldCheck size={18} className="text-[#0D9488] shrink-0 mt-0.5" />
                        ) : (
                          <ShieldAlert size={18} className="text-[#D97757] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-sans text-xs font-bold text-[#3B0D1E]">
                            {bloqueoServicioSeleccionado
                              ? bloqueoServicioSeleccionado.titulo
                              : pruebaMechonSuperada
                                ? 'Prueba de mechón registrada y superada en silla'
                                : 'Protocolo preventivo activo en servicio químico'}
                          </p>
                          <p className="font-sans text-[11px] text-[#6B535C] mt-0.5 leading-relaxed">
                            {bloqueoServicioSeleccionado
                              ? bloqueoServicioSeleccionado.mensaje
                              : pruebaMechonSuperada
                                ? 'Resistencia elástica y térmica validada antes de aplicar fórmula.'
                                : 'Valida resistencia térmica y elástica con prueba de mechón y aditivo Plex.'}
                          </p>
                        </div>
                      </div>

                      {bloqueoServicioSeleccionado?.codigo !== 'cuero_lesionado' &&
                        bloqueoServicioSeleccionado?.codigo !== 'bandera_medica' && (
                          <button
                            type="button"
                            onClick={() => setPruebaMechonSuperada((v) => !v)}
                            className={`px-3.5 py-2 rounded-xl font-sans text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                              pruebaMechonSuperada
                                ? 'bg-[#0D9488] text-white shadow-sm'
                                : 'bg-white border border-[#0D9488] text-[#0D9488] hover:bg-[#F0FDFA]'
                            }`}
                          >
                            <ShieldCheck size={14} />
                            <span>Prueba de Mechón Superada ✓</span>
                          </button>
                        )}
                    </div>
                  )}

                  {!hayGuardarrailesActivos && avisosEstandar.length > 0 && (
                    <div className="space-y-1.5">
                      {avisosEstandar.map((av) => (
                        <div
                          key={av.codigo}
                          className="px-3 py-2 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] flex items-center gap-2 text-[11px] text-[#6B535C]"
                        >
                          <Info size={13} className="text-[#3B0D1E] shrink-0" />
                          <span>{av.mensaje}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                COLUMNA DERECHA (5 cols): TICKET FINANCIERO (sticky top-24)
               ══════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <div className="bg-white rounded-3xl border border-[#EFE8E4] overflow-hidden shadow-[0_10px_30px_-5px_rgba(59,13,30,0.08)]">
                {/* 1. Cabecera Ciruela */}
                <div className="bg-[#3B0D1E] text-[#FAF7F5] p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] text-[#E8CFC8]">
                      MOTOR FINANCIERO SIN BÁSCULA
                    </span>
                    <span className="bg-white/10 px-2.5 py-1 rounded-full text-[11px] font-mono text-[#FAF7F5]">
                      PRECIO PÚBLICO SUGERIDO
                    </span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="font-display text-3xl font-bold tabular-nums tracking-tight text-[#FAF7F5]">
                      {formatearPrecioCop(precioCotizadoFinal)}
                    </div>

                    <div className="text-right min-w-0">
                      <p className="font-sans text-xs font-bold !text-[#FAF7F5] truncate capitalize">
                        {servicioActual?.nombre ?? 'Servicio'}
                      </p>
                      <p className="font-sans text-[11px] text-[#E8CFC8] truncate mt-0.5">
                        {resumenVariablesTicket}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Cuerpo del Ticket */}
                <div className="p-6 space-y-4">
                  {/* Desglose superior (2 filas simples antes de la caja violeta) */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#6B535C]">
                      <span>Tarifa Base Servicio</span>
                      <span className="font-semibold text-[#3B0D1E] tabular-nums">
                        {formatearPrecioCop(precioBaseActual)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#6B535C]">
                      <span className="inline-flex items-center gap-1.5">
                        <span>Recargos Diagnóstico (Longitud/Densidad)</span>
                        <button
                          type="button"
                          onClick={() => setMostrarAjusteComercial((v) => !v)}
                          title="Ajuste comercial opcional en silla"
                          className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            mostrarAjusteComercial || ajustePorcentaje !== 0 || modoPrecioManual
                              ? 'bg-[#3B0D1E] text-white border-[#3B0D1E]'
                              : 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4] hover:text-[#3B0D1E]'
                          }`}
                        >
                          <SlidersHorizontal size={10} />
                          <span>%</span>
                        </button>
                      </span>
                      <span className="font-semibold text-[#3B0D1E] tabular-nums">
                        {recargosDiagnosticoCop >= 0 ? '+' : '-'}
                        {formatearPrecioCop(Math.abs(recargosDiagnosticoCop))}
                      </span>
                    </div>

                    {mostrarAjusteComercial && (
                      <div className="pt-2 pb-1 px-3 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                            Ajuste comercial en silla
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setModoPrecioManual((v) => !v);
                              if (modoPrecioManual) setPrecioManualTexto('');
                            }}
                            className="font-sans text-[11px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
                          >
                            {modoPrecioManual ? 'Usar %' : 'Valor manual'}
                          </button>
                        </div>

                        {!modoPrecioManual ? (
                          <div className="grid grid-cols-7 gap-1">
                            {PASOS_AJUSTE_COMERCIAL.map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setAjustePorcentaje(pct)}
                                className={`py-1.5 rounded-lg border font-mono text-[10px] font-bold tabular-nums cursor-pointer ${
                                  ajustePorcentaje === pct
                                    ? 'bg-[#3B0D1E] text-white border-[#3B0D1E]'
                                    : 'bg-white text-[#6B535C] border-[#EFE8E4]'
                                }`}
                              >
                                {pct > 0 ? `+${pct}%` : `${pct}%`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={precioManualTexto}
                              onChange={(e) =>
                                setPrecioManualTexto(e.target.value.replace(/[^\d]/g, ''))
                              }
                              placeholder={String(calculoPrecio?.precioCalculado ?? 180000)}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EFE8E4] font-sans text-xs font-bold text-[#3B0D1E] outline-none tabular-nums"
                            />
                            <input
                              type="text"
                              value={motivoManual}
                              onChange={(e) => setMotivoManual(e.target.value)}
                              placeholder="Motivo del ajuste"
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EFE8E4] font-sans text-xs text-[#3B0D1E] placeholder-[#947C85] outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Caja de Dosificación Sin Báscula (oculta costos internos para specialist) */}
                  <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#7C3AED]">
                        <FlaskConical size={14} />
                        <span>
                          {esSpecialist
                            ? 'DOSIFICACIÓN OPERATIVA SIN BÁSCULA'
                            : 'CÁLCULO QUÍMICO SIN BÁSCULA'}
                        </span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-[#DDD6FE] font-mono text-[10px] font-bold text-[#7C3AED]">
                        {esSpecialist ? 'MEZCLA EN SILLA' : 'LIB/COSTO.TS'}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl p-2.5 border border-[#EDE9FE] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block font-sans text-[11px] text-[#6B535C]">
                          Fórmula estimada (g / ml)
                        </span>
                        <div className="flex items-baseline flex-wrap gap-1.5 mt-0.5">
                          <span className="font-mono text-lg font-bold text-[#7C3AED] tabular-nums">
                            {Math.round(calculoCosto.gramosTinte)}
                            {semillaActual.unidadFisica === 'onza_30ml' ? 'ml' : 'g'}
                          </span>
                          {semillaActual.ratioPeroxido > 0 && (
                            <span className="font-mono text-xs font-semibold text-[#6B535C] tabular-nums">
                              + {calculoCosto.mlOxidanteRedondeado}ml
                            </span>
                          )}
                          {!esSpecialist && (
                            <span className="font-mono text-[11px] text-[#947C85] tabular-nums">
                              ({formatearPrecioCop(Math.round(costoPorGramoRef))}/
                              {semillaActual.unidadFisica === 'onza_30ml' ? 'ml' : 'g'})
                            </span>
                          )}
                          {deltaGramosSilla !== 0 && (
                            <button
                              type="button"
                              onClick={() => setDeltaGramosSilla(0)}
                              title="Restablecer gramos teóricos"
                              className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-[#D97757] hover:underline cursor-pointer tabular-nums"
                            >
                              <RotateCcw size={10} />
                              {deltaGramosSilla > 0
                                ? `+${deltaGramosSilla}g`
                                : `${deltaGramosSilla}g`}
                            </button>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-[#6E4F5D] tabular-nums mt-1">
                          {Math.round(calculoCosto.gramosTinte)}
                          {semillaActual.unidadFisica === 'onza_30ml' ? 'ml' : 'g'} ·{' '}
                          {ticketVivo.equivalenciaFisica}
                        </p>
                        {!esSpecialist && (
                          <p className="font-mono text-[10px] text-[#7C3AED] font-semibold tabular-nums mt-0.5">
                            Químico {formatearPrecioCop(ticketVivo.subtotalQuimicoPrincipalCop)}
                            {semillaActual.ratioPeroxido > 0
                              ? ` + Peróxido ${formatearPrecioCop(ticketVivo.subtotalPeroxidoCop)} ($32/ml)`
                              : ''}
                            {` + Insumos ${formatearPrecioCop(ticketVivo.costoInsumosCop)}`}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setDeltaGramosSilla((prev) =>
                              Math.max(5 - Math.round(calculoCostoTeorico.gramosTinte), prev - 5)
                            )
                          }
                          aria-label="Restar 5 gramos"
                          className="px-2.5 py-1.5 rounded-lg bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-mono text-xs font-bold tabular-nums transition-colors cursor-pointer"
                        >
                          -5g
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeltaGramosSilla((prev) => prev + 5)}
                          aria-label="Sumar 5 gramos"
                          className="px-2.5 py-1.5 rounded-lg bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-mono text-xs font-bold tabular-nums transition-colors cursor-pointer"
                        >
                          +5g
                        </button>
                      </div>
                    </div>

                    {!esSpecialist && (
                      <div className="border-t border-[#DDD6FE] pt-2 flex items-center justify-between text-xs">
                        <span className="font-sans font-semibold text-[#3B0D1E]">
                          Costo Químico Descontado
                        </span>
                        <span className="font-mono font-bold text-[#7C3AED] tabular-nums">
                          -{formatearPrecioCop(calculoCosto.costoTotal)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Fila de Comisión y Caja de Utilidad Neta (exclusivas de owner / manager) */}
                  {!esSpecialist && (
                    <>
                      <div className="px-1 py-1 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-sans text-xs font-bold text-[#3B0D1E]">
                            Comisión Especialista (
                            <span className="capitalize">
                              {estSeleccionadaObj?.nombre ?? 'Especialista Principal'}
                            </span>{' '}
                            · {etiquetaPctEstilistaActiva})
                          </p>
                          <p className="font-sans text-[11px] text-[#6B535C]">
                            {etiquetaPctEstilistaActiva} sobre base libre de química
                          </p>
                        </div>
                        <span className="font-semibold text-[#D97757] tabular-nums text-xs sm:text-sm shrink-0">
                          -{formatearPrecioCop(calculoComision.comision)}
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                          esRentabilidadOptima
                            ? 'bg-[#F0FDFA] border-[#CCFBF1]'
                            : 'bg-[#FFF7F5] border-[#D97757]/40'
                        }`}
                      >
                        <div>
                          <span
                            className={`block font-sans text-[11px] font-bold uppercase ${
                              esRentabilidadOptima ? 'text-[#0D9488]' : 'text-[#D97757]'
                            }`}
                          >
                            UTILIDAD NETA REAL DEL SALÓN
                          </span>
                          <div
                            className={`font-display text-2xl font-bold tabular-nums mt-0.5 ${
                              esRentabilidadOptima ? 'text-[#0D9488]' : 'text-[#D97757]'
                            }`}
                          >
                            {formatearPrecioCop(calculoComision.margenSalon)}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums text-white ${
                              esRentabilidadOptima ? 'bg-[#0D9488]' : 'bg-[#D97757]'
                            }`}
                          >
                            Margen Neto: {margenPctEntero}%
                          </span>
                          <span className="block font-sans text-[11px] text-[#6B535C] mt-1">
                            {esRentabilidadOptima
                              ? 'Sembrado financiero activo'
                              : `Sugerido 35%: ${formatearPrecioCop(ticketVivo.tarifaCalibradaSugeridaCop)}`}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Doble Botón de Acción al Pie */}
                  <div className="pt-2 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleConfirmarCotizacion('whatsapp')}
                      disabled={guardandoModo !== null || Boolean(bloqueoServicioSeleccionado)}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#3B0D1E] hover:bg-[#52142B] disabled:opacity-50 text-[#FAF7F5] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle size={15} />
                      <span>
                        {guardandoModo === 'whatsapp'
                          ? 'Generando enlace…'
                          : 'Enviar Cotización y Consentimiento por WA (/c/token)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConfirmarCotizacion('cierre')}
                      disabled={guardandoModo !== null || Boolean(bloqueoServicioSeleccionado)}
                      className="w-full py-3 px-4 rounded-xl bg-[#FAF7F5] hover:bg-[#EFE8E4] disabled:opacity-50 text-[#3B0D1E] border border-[#EFE8E4] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 size={15} className="text-[#0D9488]" />
                      <span>
                        {guardandoModo === 'cierre'
                          ? 'Pasando a Por Cobrar…'
                          : 'Pasar a "Por Cobrar" / Cierre en 1 Toque'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal opcional de Cámara IA Capilar */}
      {camaraIAAbierta && (
        <div className="fixed inset-0 z-50 bg-[#1F050F]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EFE8E4] overflow-hidden shadow-[0_24px_60px_-12px_rgba(59,13,30,0.3)]">
            <div className="px-5 py-4 bg-[#3B0D1E] text-[#FAF7F5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#E8CFC8]" />
                <span className="font-sans text-sm font-bold">Asistente Visual IA Capilar</span>
              </div>
              <button
                type="button"
                onClick={() => setCamaraIAAbierta(false)}
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#E8CFC8] hover:text-white cursor-pointer"
                aria-label="Cerrar cámara"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 max-h-[82vh] overflow-y-auto">
              <CameraCapture
                onComplete={(_tipo, _sec, _meta, result) => aplicarResultadoIA(result)}
                onCorrectAI={(_ia, _meta, result) => aplicarResultadoIA(result)}
                onCancel={() => setCamaraIAAbierta(false)}
                onManual={() => setCamaraIAAbierta(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VelliVelvetStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F5] flex items-center justify-center font-sans text-sm text-[#6B535C]">
          Cargando Velli Business Intelligence…
        </div>
      }
    >
      <VelliWorkspaceInner />
    </Suspense>
  );
}
