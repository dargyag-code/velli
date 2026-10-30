'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Camera,
  MessageCircle,
  CheckCircle2,
  User,
  UserCheck,
  Settings,
  X,
  ShieldAlert,
  Info,
  Lock,
} from 'lucide-react';
import type { Clienta, Consulta } from '@/lib/types';
import { getAllClientas, getConsultasByClienta, createClienta } from '@/lib/db';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva } from '@/lib/subscription/estado';
import { diagnosticoDesdeConsulta, PORCENTAJE_CANAS_POR_TRAMO } from '@/lib/color/integracion';
import type { HairAnalysisResult } from '@/lib/hairAnalysis';
import SelectorTramoCanas from '@/components/color/SelectorTramoCanas';
import CameraCapture from '@/components/wizard/CameraCapture';
import ListaPorCobrar from '@/components/cotizador/ListaPorCobrar';
import BottomNavV2 from '@/components/v2/BottomNavV2';
import { showToast } from '@/lib/toast';
import {
  CATALOGO_VARIABLES,
  AJUSTES_EJEMPLO_PLANTILLA,
  derivarVariablesDesdeConsulta,
  evaluarAvisosEstandar,
  evaluarBloqueoServicioCotizador,
  calcularPrecioCotizacion,
  calcularCostoProducto,
  calcularComisionYMargen,
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
  crearCotizacion,
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
} from '@/lib/cotizador';

const STORAGE_ULTIMA_ESTILISTA = 'velli_ultima_estilista_id';

const SERVICIOS_SEMILLA_DEFECTO = [
  'Balayage Alta Precisión',
  'Babylights / Rubios Globales',
  'Corrección de Color',
  'Color Global & Cubrimiento',
] as const;

const SERVICIOS_RESPALDO_LOCAL: ServicioSalon[] = [
  {
    id: 'local-balayage',
    userId: 'local',
    nombre: 'Balayage Alta Precisión',
    categoria: 'decoloracion',
    usaFormulaColor: true,
    duracionMinutos: 240,
    activo: true,
    orden: 0,
    perfilExtendido: {},
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'local-babylights',
    userId: 'local',
    nombre: 'Babylights / Rubios Globales',
    categoria: 'decoloracion',
    usaFormulaColor: true,
    duracionMinutos: 270,
    activo: true,
    orden: 1,
    perfilExtendido: {},
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'local-correccion',
    userId: 'local',
    nombre: 'Corrección de Color',
    categoria: 'decoloracion',
    usaFormulaColor: true,
    duracionMinutos: 330,
    activo: true,
    orden: 2,
    perfilExtendido: {},
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'local-tinte',
    userId: 'local',
    nombre: 'Color Global & Cubrimiento',
    categoria: 'color',
    usaFormulaColor: true,
    duracionMinutos: 120,
    activo: true,
    orden: 3,
    perfilExtendido: {},
    createdAt: '',
    updatedAt: '',
  },
];

const ETIQUETA_CATEGORIA: Record<string, string> = {
  decoloracion: 'Diseño & Rubios',
  color: 'Coloración',
  tratamiento: 'Tratamiento',
  corte: 'Corte & Diseño',
  alisado: 'Alisado',
  rizos: 'Textura & Rizos',
  peinado: 'Styling',
  cuero_cabelludo: 'Tricología',
  extensiones: 'Extensiones',
  otro: 'Servicio Salón',
};

function precioBaseSugeridoPorCategoria(categoria: string): number {
  switch (categoria) {
    case 'decoloracion':
      return 220_000;
    case 'alisado':
    case 'extensiones':
      return 200_000;
    case 'color':
      return 140_000;
    case 'tratamiento':
    case 'rizos':
      return 110_000;
    default:
      return 95_000;
  }
}

function gramosBaseSugeridosPorCategoria(categoria: string): number {
  if (categoria === 'decoloracion') return 90;
  if (categoria === 'color') return 60;
  return 45;
}

// ── Logo Oficial: La Gota Dual (Equilibrio sin Báscula) ────────────────
function VelliLogo({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const isDark = variant === 'dark';
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
          isDark ? 'bg-[#FAF7F5]/10' : 'bg-[#3B0D1E]'
        }`}
      >
        <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <span
          className={`text-2xl font-bold tracking-tight font-brand ${
            isDark ? 'text-[#FAF7F5]' : 'text-[#1C1518]'
          }`}
        >
          velli
        </span>
        <span
          className={`text-[9px] uppercase tracking-[0.22em] font-semibold mt-0.5 ${
            isDark ? 'text-[#E8CFC8]' : 'text-[#6E6266]'
          }`}
        >
          Business Intelligence
        </span>
      </div>
    </div>
  );
}

function VelliWorkspaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabUrl = searchParams.get('tab');
  const clientaIdUrl = searchParams.get('clientaId');

  const activeTab: 'cotizador' | 'cierre' = tabUrl === 'cierre' ? 'cierre' : 'cotizador';

  const cambiarTab = useCallback(
    (next: 'cotizador' | 'cierre') => {
      router.replace(next === 'cierre' ? '/?tab=cierre' : '/', { scroll: false });
    },
    [router]
  );

  // ── Estado de catálogos reales de Supabase ───────────────────────────
  const [cargando, setCargando] = useState(true);
  const [guardandoModo, setGuardandoModo] = useState<'whatsapp' | 'cierre' | null>(null);
  const [refreshCierre, setRefreshCierre] = useState(0);

  const [nombreSalon, setNombreSalon] = useState('Tu Salón');
  const [ciudadSalon, setCiudadSalon] = useState('Colombia');
  const [conMarcaVelli, setConMarcaVelli] = useState(true);
  const [tienePlanIA, setTienePlanIA] = useState(true);

  const [servicios, setServicios] = useState<ServicioSalon[]>(SERVICIOS_RESPALDO_LOCAL);
  const [plantillasPorServicio, setPlantillasPorServicio] = useState<Record<string, PlantillaPrecio>>({});
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);
  const [productos, setProductos] = useState<ProductoSalon[]>([]);
  const [reglasComision, setReglasComision] = useState<ComisionSalon[]>([]);
  const [todasClientas, setTodasClientas] = useState<Clienta[]>([]);

  // ── Clienta & Especialista ───────────────────────────────────────────
  const [clientaSeleccionada, setClientaSeleccionada] = useState<Clienta | null>(null);
  const [consultaVigente, setConsultaVigente] = useState<Consulta | null>(null);
  const [nombreClientaTexto, setNombreClientaTexto] = useState('');
  const [telefonoClientaTexto, setTelefonoClientaTexto] = useState('');
  const [dropdownClientasAbierto, setDropdownClientasAbierto] = useState(false);
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

  // ── Cámara IA opcional ───────────────────────────────────────────────
  const [camaraIAAbierta, setCamaraIAAbierta] = useState(false);

  // ── Paso 03: Ajuste Comercial / Precio Manual ────────────────────────
  const [ajustePorcentaje, setAjustePorcentaje] = useState<number>(0);
  const [modoPrecioManual, setModoPrecioManual] = useState(false);
  const [precioManualTexto, setPrecioManualTexto] = useState('');
  const [motivoManual, setMotivoManual] = useState('');

  // ── Carga inicial desde Supabase ─────────────────────────────────────
  const cargarDatosSalon = useCallback(async () => {
    setCargando(true);
    try {
      const [prof, sub, svcsIniciales, plantillas, ests, prods, coms, listaClientas] =
        await Promise.all([
          getProfile().catch(() => null),
          getSuscripcionEfectiva().catch(() => null),
          listarServiciosSalon({ soloActivos: true }).catch(() => [] as ServicioSalon[]),
          listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
          listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
          listarProductosSalon({ soloActivos: true }).catch(() => [] as ProductoSalon[]),
          listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
          getAllClientas().catch(() => [] as Clienta[]),
        ]);

      if (prof && prof.onboardingCompleted === false) {
        router.replace('/onboarding');
        return;
      }

      if (prof?.nombreSalon?.trim()) {
        setNombreSalon(prof.nombreSalon.trim());
      } else if (prof?.nombre?.trim()) {
        setNombreSalon(prof.nombre.trim());
      }
      if (prof?.ciudad?.trim()) {
        setCiudadSalon(prof.ciudad.trim());
      }

      setConMarcaVelli(sub?.plan !== 'pro_ia');
      setTienePlanIA(!sub || sub.plan === 'pro_ia' || sub.estado === 'trialing');

      let svcs = svcsIniciales;
      if (svcs.length === 0) {
        const semilla =
          prof?.servicios && prof.servicios.length > 0
            ? prof.servicios
            : SERVICIOS_SEMILLA_DEFECTO;
        await sembrarServiciosDesdeOnboarding(semilla).catch(() => [] as ServicioSalon[]);
        svcs = await listarServiciosSalon({ soloActivos: true }).catch(
          () => [] as ServicioSalon[]
        );
      }
      setServicios(svcs.length > 0 ? svcs : SERVICIOS_RESPALDO_LOCAL);

      let estsEfectivas = ests;
      let prodsEfectivos = prods;
      let comsEfectivas = coms;
      if (prods.length === 0 || ests.length === 0 || coms.length === 0) {
        const sembrados = await sembrarBaseFinancieraSalon().catch(() => null);
        if (sembrados) {
          if (prodsEfectivos.length === 0) prodsEfectivos = sembrados.productos;
          if (estsEfectivas.length === 0) estsEfectivas = sembrados.estilistas;
          if (comsEfectivas.length === 0) comsEfectivas = sembrados.comisiones;
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
      setTodasClientas(listaClientas);

      try {
        const guardada = window.localStorage.getItem(STORAGE_ULTIMA_ESTILISTA);
        if (guardada && estsEfectivas.some((e) => e.id === guardada)) {
          setEstilistaId(guardada);
        } else if (estsEfectivas.length > 0) {
          setEstilistaId(estsEfectivas[0].id);
        }
      } catch {
        if (estsEfectivas.length > 0) {
          setEstilistaId(estsEfectivas[0].id);
        }
      }

      if (clientaIdUrl) {
        const pre = listaClientas.find((c) => c.id === clientaIdUrl);
        if (pre) {
          setClientaSeleccionada(pre);
          setNombreClientaTexto(pre.nombre);
          setTelefonoClientaTexto(pre.telefono ?? '');
        }
      }
    } finally {
      setCargando(false);
    }
  }, [router, clientaIdUrl]);

  useEffect(() => {
    cargarDatosSalon();
  }, [cargarDatosSalon]);

  // Cargar última consulta cuando se elige una clienta registrada
  useEffect(() => {
    if (!clientaSeleccionada) {
      setConsultaVigente(null);
      return;
    }
    let cancelado = false;
    getConsultasByClienta(clientaSeleccionada.id)
      .then((cs) => {
        if (cancelado) return;
        const vigente = cs.find((c) => !c.esBorrador) ?? cs[0] ?? null;
        setConsultaVigente(vigente);
        if (vigente) {
          // Permitir que las variables del diagnóstico precarguen el formulario
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

  // Asegurar que las 4 variables tengan siempre un valor táctil activo
  const variablesEfectivas: VariablesCotizacion = useMemo(
    () => ({
      largo: derivacion.variables.largo ?? { valor: 'medio', origen: 'manual' },
      densidad: derivacion.variables.densidad ?? { valor: 'media', origen: 'manual' },
      estado: derivacion.variables.estado ?? { valor: 'sana', origen: 'manual' },
      canas: derivacion.variables.canas ?? { valor: '0_25', origen: 'manual' },
    }),
    [derivacion.variables]
  );

  const diagnosticoColor = useMemo(
    () => diagnosticoDesdeConsulta(consultaVigente ?? undefined, clientaSeleccionada ?? undefined),
    [consultaVigente, clientaSeleccionada]
  );

  const servicioActual = useMemo(
    () => servicios.find((s) => s.id === servicioId) ?? servicios[0] ?? null,
    [servicios, servicioId]
  );

  useEffect(() => {
    if (servicios.length === 0) return;
    if (servicioId && servicios.some((s) => s.id === servicioId)) return;
    const primeroDisponible =
      servicios.find((s) => !evaluarBloqueoServicioCotizador(s, diagnosticoColor)) ?? servicios[0];
    if (primeroDisponible) {
      setServicioId(primeroDisponible.id);
      setPrecioBaseRapido(String(precioBaseSugeridoPorCategoria(primeroDisponible.categoria)));
    }
  }, [servicios, servicioId, diagnosticoColor]);

  const seleccionarServicio = (srv: ServicioSalon) => {
    setServicioId(srv.id);
    const plant = plantillasPorServicio[srv.id];
    if (!plant) {
      setPrecioBaseRapido(String(precioBaseSugeridoPorCategoria(srv.categoria)));
    }
  };

  const plantillaActual = servicioActual ? plantillasPorServicio[servicioActual.id] ?? null : null;

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

  // ── Cálculo en vivo: Precio + Costo sin Báscula + Comisión y Margen ──
  const calculoPrecio = useMemo(() => {
    if (!servicioActual) return null;
    const base = plantillaActual
      ? plantillaActual.precioBase
      : Math.max(0, Number(precioBaseRapido.replace(/\D/g, '')) || 0);
    const ajustes = plantillaActual ? plantillaActual.ajustes : AJUSTES_EJEMPLO_PLANTILLA;
    const redondeo = plantillaActual?.redondeo ?? 1000;

    return calcularPrecioCotizacion(
      {
        precioBase: base,
        ajustes,
        variablesActivas: variablesActivasServicio,
        redondeo,
      },
      variablesEfectivas
    );
  }, [servicioActual, plantillaActual, precioBaseRapido, variablesActivasServicio, variablesEfectivas]);

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

  const calculoCosto = useMemo(() => {
    const srv = servicioActual;
    const consumoPlantilla = (plantillaActual?.consumo ?? {}) as ConsumoPlantillaInput;
    const usaColor = srv?.usaFormulaColor ?? consumoPlantilla.usaFormulaColor ?? true;

    const prodTinteReal =
      productos.find(
        (p) =>
          (srv?.categoria === 'decoloracion' ? p.tipo === 'decolorante' : p.tipo === 'tinte') &&
          p.unidad === 'g'
      ) ?? productos.find((p) => p.unidad === 'g');

    const prodOxidanteReal =
      productos.find((p) => p.tipo === 'oxidante' && p.unidad === 'ml') ??
      productos.find((p) => p.unidad === 'ml');

    const prodTinteFallback: ProductoSalonCostoInput = {
      nombre: 'Decolorante / Tinte Estándar',
      presentacionCantidad: 60,
      unidad: 'g',
      precioCompra: 19_200, // $320 COP/g
    };

    const prodOxidanteFallback: ProductoSalonCostoInput = {
      nombre: 'Peróxido / Revelador Estándar',
      presentacionCantidad: 1_000,
      unidad: 'ml',
      precioCompra: 95_000, // $95 COP/ml
    };

    const estadoActual = variablesEfectivas.estado?.valor;
    const insumosDefecto =
      estadoActual === 'sensibilizada'
        ? 18_000
        : estadoActual === 'procesada'
          ? 9_000
          : 4_500;

    return calcularCostoProducto({
      variables: variablesEfectivas,
      consumo: {
        ...consumoPlantilla,
        usaFormulaColor: usaColor,
        gramosTinteBase:
          consumoPlantilla.gramosTinteBase ??
          gramosBaseSugeridosPorCategoria(srv?.categoria ?? 'color'),
        insumosFijos: consumoPlantilla.insumosFijos ?? insumosDefecto,
      },
      productoTinte: prodTinteReal ?? prodTinteFallback,
      productoOxidante: prodOxidanteReal ?? prodOxidanteFallback,
    });
  }, [servicioActual, plantillaActual, productos, variablesEfectivas]);

  const usaComisionReferencia = reglasComision.length === 0;

  const calculoComision = useMemo(() => {
    const reglasEfectivas: readonly ReglaComision[] =
      reglasComision.length > 0
        ? reglasComision
        : [{ tipo: 'porcentaje', valor: 35, base: 'precio_menos_producto' }];

    return calcularComisionYMargen({
      precio: precioCotizadoFinal,
      costoProducto: calculoCosto.costoTotal,
      reglas: reglasEfectivas,
      estilistaId: estilistaId || null,
      servicioId: servicioActual?.id ?? null,
      umbralMargenMinimo: 30,
      redondeo: plantillaActual?.redondeo ?? 1000,
    });
  }, [
    precioCotizadoFinal,
    calculoCosto.costoTotal,
    reglasComision,
    estilistaId,
    servicioActual,
    plantillaActual,
  ]);

  const margenPctEntero = Math.round(calculoComision.margenPorcentaje);
  const esRentabilidadOptima = calculoComision.margenPorcentaje >= 30;

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
    setClientaSeleccionada(c);
    setNombreClientaTexto(c.nombre);
    setTelefonoClientaTexto(c.telefono ?? '');
    setDropdownClientasAbierto(false);
  };

  const limpiarClienta = () => {
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
    setCamaraIAAbierta(false);
    showToast(
      `IA Capilar aplicada: densidad ${result.densidad ?? 'media'} · fibra ${nuevoEstado}. Verifica largo y canas.`,
      'success'
    );
  };

  const clientasFiltradas = useMemo(() => {
    const q = nombreClientaTexto.trim().toLowerCase();
    if (!q) return todasClientas.slice(0, 6);
    return todasClientas
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.telefono && c.telefono.includes(q))
      )
      .slice(0, 6);
  }, [todasClientas, nombreClientaTexto]);

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
            setTodasClientas((prev) => [nueva, ...prev]);
          } catch {
            // Si no pudo crear registro en clientas, guardamos igual la cotización con el nombre en formula
            clientaFinal = null;
          }
        }
      }

      // 2. Asegurar plantilla publicada si el servicio real aún no tenía versión 1
      const esServicioReal = !servicioActual.id.startsWith('local-');
      let plantilla = plantillaActual;
      if (esServicioReal && !plantilla) {
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

      // 3. Crear cotización en Supabase
      let cotizacion = await crearCotizacion({
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
          gramosTinte: calculoCosto.gramosTinte,
          mlOxidante: calculoCosto.mlOxidanteRedondeado,
          insumosFijos: calculoCosto.insumosFijos,
        },
        costoProductoEstimado: calculoCosto.costoTotal,
        costoDetalle: calculoCosto.detalle,
        comisionEstimada: calculoComision.comision,
        comisionDetalle: calculoComision.detalle,
        conMarcaVelli,
      });

      if (modo === 'whatsapp') {
        cotizacion = await enviarCotizacion(cotizacion.id);
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
        showToast('Cotización enviada por WhatsApp y lista en Por Cobrar', 'success');
      } else {
        setRefreshCierre((n) => n + 1);
        showToast('Guardada en Por Cobrar', 'success');
        cambiarTab('cierre');
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

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#1C1518] pb-28">
      {/* ── Top Navigation Bar Velvet Studio ─────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FAF7F5]/90 backdrop-blur-md border-b border-[#EFE8E4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
          <VelliLogo />

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5EFFB] border border-[#7C3AED]/20 text-[#7C3AED] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
              Cálculo sin báscula activo
            </div>
            <Link
              href="/configuracion/precios"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#EFE8E4] hover:border-[#E8CFC8] text-xs font-medium text-[#6E6266] hover:text-[#3B0D1E] shadow-xs no-underline transition-colors"
            >
              <Settings size={13} />
              <span className="truncate max-w-[170px]">
                {nombreSalon} · {ciudadSalon}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ───────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7">
        {/* Selector Superior de Pestañas */}
        <div className="mb-6 inline-flex items-center gap-1.5 p-1.5 rounded-full bg-white border border-[#EFE8E4] shadow-xs">
          <button
            type="button"
            onClick={() => cambiarTab('cotizador')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${
              activeTab === 'cotizador'
                ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-xs'
                : 'text-[#6E6266] hover:text-[#1C1518]'
            }`}
          >
            01 · Diagnóstico & Cotizador
          </button>
          <button
            type="button"
            onClick={() => cambiarTab('cierre')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${
              activeTab === 'cierre'
                ? 'bg-[#3B0D1E] text-[#FAF7F5] shadow-xs'
                : 'text-[#6E6266] hover:text-[#1C1518]'
            }`}
          >
            02 · Por Cobrar / Cierre
          </button>
        </div>

        {activeTab === 'cierre' ? (
          <div className="space-y-6">
            <ListaPorCobrar
              refreshKey={refreshCierre}
              clientas={todasClientas}
              estilistas={estilistas}
              mostrarVacio
              onIrACotizar={() => cambiarTab('cotizador')}
            />
          </div>
        ) : (
          <>
            {/* Intro Editorial */}
            <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#6E1E3A]">
                  Diagnóstico Capilar & Rentabilidad
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#1C1518] mt-1 tracking-tight">
                  Cotizador Inteligente
                </h1>
              </div>
              {cargando && (
                <span className="text-xs text-[#6E6266] font-medium">
                  Sincronizando catálogo del salón…
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* ── COLUMNA IZQUIERDA (7 cols) ───────────────────────────── */}
              <div className="lg:col-span-7 space-y-6">
                {/* Bloque de Clienta & Especialista */}
                <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[#EFE8E4] shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Selector / Búsqueda de Clienta */}
                    <div className="relative">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6E6266] mb-1.5">
                        <User size={13} className="text-[#6E1E3A]" />
                        Clienta en silla
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={nombreClientaTexto}
                          onFocus={() => setDropdownClientasAbierto(true)}
                          onBlur={() => {
                            window.setTimeout(() => setDropdownClientasAbierto(false), 160);
                          }}
                          onChange={(e) => {
                            setNombreClientaTexto(e.target.value);
                            if (
                              clientaSeleccionada &&
                              e.target.value.trim() !== clientaSeleccionada.nombre
                            ) {
                              setClientaSeleccionada(null);
                              setConsultaVigente(null);
                            }
                            setDropdownClientasAbierto(true);
                          }}
                          placeholder="Buscar o escribir nombre…"
                          className="w-full pl-3.5 pr-8 py-2.5 rounded-xl bg-[#FAF7F5]/70 border border-[#EFE8E4] focus:border-[#3B0D1E] focus:bg-white text-sm text-[#1C1518] placeholder-[#BDB0B4] outline-none transition-colors"
                        />
                        {(nombreClientaTexto || clientaSeleccionada) && (
                          <button
                            type="button"
                            onClick={limpiarClienta}
                            aria-label="Limpiar clienta"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#96888C] hover:text-[#3B0D1E] cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {dropdownClientasAbierto && clientasFiltradas.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white rounded-xl border border-[#EFE8E4] shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                          {clientasFiltradas.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                elegirClientaExistente(c);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-[#F7ECEF]/60 flex items-center justify-between text-xs border-b border-[#FAF7F5] last:border-b-0 cursor-pointer"
                            >
                              <span className="font-semibold text-[#1C1518]">{c.nombre}</span>
                              <span className="text-[#6E6266]">
                                {c.telefono || 'Registrada'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!clientaSeleccionada && nombreClientaTexto.trim().length > 0 && (
                        <input
                          type="tel"
                          value={telefonoClientaTexto}
                          onChange={(e) => setTelefonoClientaTexto(e.target.value)}
                          placeholder="WhatsApp (ej. 300 123 4567)"
                          className="mt-2 w-full px-3.5 py-2 rounded-xl bg-[#FAF7F5]/70 border border-[#EFE8E4] text-xs text-[#1C1518] placeholder-[#BDB0B4] outline-none focus:border-[#3B0D1E]"
                        />
                      )}

                      {clientaSeleccionada && (
                        <p className="text-[11px] text-[#0D9488] font-medium mt-1.5">
                          {consultaVigente
                            ? 'Ficha capilar activa precargada automáticamente'
                            : 'Clienta registrada seleccionada'}
                        </p>
                      )}
                    </div>

                    {/* Selector de Especialista */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6E6266]">
                          <UserCheck size={13} className="text-[#6E1E3A]" />
                          Especialista asignada
                        </label>
                        {estilistas.length === 0 && (
                          <Link
                            href="/configuracion/precios"
                            className="text-[11px] font-semibold text-[#6E1E3A] hover:underline no-underline"
                          >
                            + Configurar equipo
                          </Link>
                        )}
                      </div>
                      <select
                        value={estilistaId}
                        onChange={(e) => cambiarEstilista(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F5]/70 border border-[#EFE8E4] focus:border-[#3B0D1E] focus:bg-white text-sm text-[#1C1518] outline-none transition-colors"
                      >
                        <option value="">
                          {estilistas.length === 0
                            ? 'Titular del salón (por defecto)'
                            : 'Seleccionar especialista…'}
                        </option>
                        {estilistas.map((est) => (
                          <option key={est.id} value={est.id}>
                            {est.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Paso 01: Servicio del Salón */}
                <section className="bg-white rounded-2xl p-6 border border-[#EFE8E4] shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#3B0D1E] text-[#FAF7F5] text-xs font-bold flex items-center justify-center">
                        01
                      </span>
                      <h2 className="text-lg font-bold text-[#1C1518]">Servicio del Salón</h2>
                    </div>
                    <Link
                      href="/configuracion/precios"
                      className="text-xs font-semibold text-[#6E1E3A] hover:underline no-underline"
                    >
                      Menú de servicios
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {servicios.map((srv) => {
                      const active = servicioActual?.id === srv.id;
                      const plant = plantillasPorServicio[srv.id];
                      const bloqueo = evaluarBloqueoServicioCotizador(srv, diagnosticoColor);
                      const baseRef = plant
                        ? plant.precioBase
                        : precioBaseSugeridoPorCategoria(srv.categoria);

                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => seleccionarServicio(srv)}
                          className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                            active
                              ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E] shadow-md'
                              : 'bg-[#FAF7F5]/60 text-[#1C1518] border-[#EFE8E4] hover:border-[#E8CFC8] hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                                active
                                  ? 'bg-[#6E1E3A] text-[#E8CFC8]'
                                  : 'bg-[#E8CFC8]/40 text-[#6E1E3A]'
                              }`}
                            >
                              {ETIQUETA_CATEGORIA[srv.categoria] ?? 'Servicio'}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                active ? 'text-[#E8CFC8]' : 'text-[#6E6266]'
                              }`}
                            >
                              Base {formatearPrecioCop(baseRef)}
                            </span>
                          </div>
                          <p className="font-bold text-base mt-2.5">{srv.nombre}</p>
                          <p
                            className={`text-xs mt-1 ${
                              active ? 'text-[#E8CFC8]/80' : 'text-[#6E6266]'
                            }`}
                          >
                            {bloqueo
                              ? `Requiere revisión: ${bloqueo.titulo}`
                              : plant
                                ? 'Tarifa calibrada activa'
                                : srv.usaFormulaColor
                                  ? 'Fórmula estimada sin báscula'
                                  : 'Tarifa estándar del salón'}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {bloqueoServicioSeleccionado && (
                    <div className="mt-4 p-3.5 rounded-xl bg-[#FDF2EC] border border-[#D97757]/30 flex items-start gap-2.5 text-xs text-[#9A4728]">
                      <ShieldAlert size={16} className="shrink-0 mt-0.5 text-[#D97757]" />
                      <div>
                        <p className="font-bold">{bloqueoServicioSeleccionado.titulo}</p>
                        <p className="mt-0.5">{bloqueoServicioSeleccionado.mensaje}</p>
                      </div>
                    </div>
                  )}

                  {servicioActual && !plantillaActual && !servicioActual.id.startsWith('local-') && (
                    <div className="mt-4 pt-4 border-t border-[#EFE8E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#1C1518]">
                          Precio base inicial para {servicioActual.nombre}
                        </p>
                        <p className="text-[11px] text-[#6E6266]">
                          Se guardará como tarifa base del salón al confirmar tu primera cotización.
                        </p>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={precioBaseRapido}
                        onChange={(e) => setPrecioBaseRapido(e.target.value.replace(/[^\d]/g, ''))}
                        className="w-full sm:w-40 px-3.5 py-2 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-sm font-bold text-[#3B0D1E] text-right outline-none focus:border-[#3B0D1E]"
                      />
                    </div>
                  )}
                </section>

                {/* Paso 02: Diagnóstico Capilar Táctil */}
                <section className="bg-white rounded-2xl p-6 border border-[#EFE8E4] shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)] space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#3B0D1E] text-[#FAF7F5] text-xs font-bold flex items-center justify-center">
                        02
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-[#1C1518]">
                          Diagnóstico Capilar Táctil
                        </h2>
                        <p className="text-[11px] text-[#7C3AED] font-medium">
                          Ajusta gramos y precio automáticamente
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!tienePlanIA) {
                          showToast(
                            'El análisis fotográfico con IA hace parte del Plan Salón Pro + IA ($149.000/mes)',
                            'info'
                          );
                          router.push('/planes');
                          return;
                        }
                        setCamaraIAAbierta(true);
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F5EFFB] hover:bg-[#EDE2FA] border border-[#7C3AED]/25 text-[#7C3AED] text-xs font-bold transition-colors cursor-pointer"
                    >
                      {tienePlanIA ? <Camera size={14} /> : <Lock size={13} />}
                      {tienePlanIA ? 'Analizar foto con IA' : 'Analizar foto con IA · Pro+IA'}
                    </button>
                  </div>

                  {/* 1. Largo */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6266] mb-2.5">
                      Longitud de la hebra
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {CATALOGO_VARIABLES.largo.map((item) => {
                        const active = variablesEfectivas.largo?.valor === item.valor;
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() =>
                              setManuales((prev) => ({ ...prev, largo: item.valor }))
                            }
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-[#E8CFC8]/45 border-[#3B0D1E] text-[#3B0D1E] shadow-xs'
                                : 'bg-[#FAF7F5]/50 border-[#EFE8E4] text-[#1C1518] hover:bg-white'
                            }`}
                          >
                            <div className="font-bold text-sm">{item.etiqueta}</div>
                            <div className="text-[11px] text-[#6E6266] mt-0.5 line-clamp-2">
                              {item.guia}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Densidad */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6266] mb-2.5">
                      Densidad / Masa Capilar
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {CATALOGO_VARIABLES.densidad.map((item) => {
                        const active = variablesEfectivas.densidad?.valor === item.valor;
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() =>
                              setManuales((prev) => ({ ...prev, densidad: item.valor }))
                            }
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-[#E8CFC8]/45 border-[#3B0D1E] text-[#3B0D1E] shadow-xs'
                                : 'bg-[#FAF7F5]/50 border-[#EFE8E4] text-[#1C1518] hover:bg-white'
                            }`}
                          >
                            <div className="font-bold text-sm">{item.etiqueta}</div>
                            <div className="text-[11px] text-[#6E6266] mt-0.5 line-clamp-2">
                              {item.guia}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Estado de la fibra */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6266] mb-2.5">
                      Estado de la Fibra & Porosidad
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {CATALOGO_VARIABLES.estado.map((item) => {
                        const active = variablesEfectivas.estado?.valor === item.valor;
                        return (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() =>
                              setManuales((prev) => ({ ...prev, estado: item.valor }))
                            }
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-[#E8CFC8]/45 border-[#3B0D1E] text-[#3B0D1E] shadow-xs'
                                : 'bg-[#FAF7F5]/50 border-[#EFE8E4] text-[#1C1518] hover:bg-white'
                            }`}
                          >
                            <div className="font-bold text-sm">{item.etiqueta}</div>
                            <div className="text-[11px] text-[#6E6266] mt-0.5 line-clamp-2">
                              {item.guia}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Tramo de Canas */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6266] mb-2.5">
                      Porcentaje de Canas & Saturación
                    </label>

                    {derivacion.canasPorPrecisar && (
                      <div className="mb-3 p-3.5 rounded-xl bg-[#FAF7F5] border border-[#E8CFC8]">
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {CATALOGO_VARIABLES.canas.map((item) => {
                        const active = variablesEfectivas.canas?.valor === item.valor;
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
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-[#E8CFC8]/45 border-[#3B0D1E] text-[#3B0D1E] shadow-xs'
                                : 'bg-[#FAF7F5]/50 border-[#EFE8E4] text-[#1C1518] hover:bg-white'
                            }`}
                          >
                            <div className="font-bold text-sm">{item.etiqueta}</div>
                            <div className="text-[11px] text-[#6E6266] mt-0.5 line-clamp-2">
                              {item.guia}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recomendaciones técnicas del estándar */}
                  {avisosEstandar.length > 0 && (
                    <div className="pt-2 border-t border-[#EFE8E4] space-y-2">
                      {avisosEstandar.map((av) => (
                        <div
                          key={av.codigo}
                          className="p-3 rounded-xl bg-[#F7ECEF]/65 border border-[#DFC5CE] flex items-start gap-2.5 text-xs text-[#3B0D1E]"
                        >
                          <Info size={14} className="shrink-0 mt-0.5 text-[#6E1E3A]" />
                          <div>
                            <span className="font-bold">
                              {av.obligatorio ? 'Protocolo técnico' : 'Sugerencia capilar'}:{' '}
                            </span>
                            <span className="text-[#4E3A42]">{av.mensaje}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Paso 03: Ajuste Comercial / Precio Manual No Punitivo */}
                <section className="bg-white rounded-2xl p-6 border border-[#EFE8E4] shadow-[0_12px_32px_-8px_rgba(59,13,30,0.06)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#E8CFC8] text-[#3B0D1E] text-xs font-bold flex items-center justify-center">
                        03
                      </span>
                      <h2 className="text-base font-bold text-[#1C1518]">
                        Ajuste Comercial / Precio Manual
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModoPrecioManual((v) => !v);
                        if (modoPrecioManual) {
                          setPrecioManualTexto('');
                        }
                      }}
                      className="text-xs font-bold text-[#6E1E3A] hover:underline cursor-pointer"
                    >
                      {modoPrecioManual ? 'Usar deslizador %' : 'Escribir valor exacto'}
                    </button>
                  </div>

                  <p className="text-xs text-[#6E6266] mb-4">
                    Calibra una cortesía o complejidad extra viendo el impacto en margen antes de cotizar.
                  </p>

                  {!modoPrecioManual ? (
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-[#3B0D1E] mb-1.5">
                        <span>Variación sobre plantilla</span>
                        <span>
                          {ajustePorcentaje > 0 ? `+${ajustePorcentaje}%` : `${ajustePorcentaje}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-25}
                        max={25}
                        step={5}
                        value={ajustePorcentaje}
                        onChange={(e) => setAjustePorcentaje(Number(e.target.value))}
                        className="w-full accent-[#3B0D1E] cursor-pointer"
                      />
                      <div className="flex justify-between text-[11px] text-[#6E6266] mt-1">
                        <span>-25%</span>
                        <span>0% (Tarifa base)</span>
                        <span>+25%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6E6266] mb-1">
                          Precio final en COP
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={precioManualTexto}
                          onChange={(e) => setPrecioManualTexto(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder={String(calculoPrecio?.precioCalculado ?? 180000)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] focus:border-[#3B0D1E] text-sm font-bold text-[#1C1518] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6E6266] mb-1">
                          Nota del ajuste
                        </label>
                        <input
                          type="text"
                          value={motivoManual}
                          onChange={(e) => setMotivoManual(e.target.value)}
                          placeholder="Ej. Cortesía fidelidad / Extra matiz"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] focus:border-[#3B0D1E] text-sm text-[#1C1518] outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {!modoPrecioManual && ajustePorcentaje !== 0 && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={motivoManual}
                        onChange={(e) => setMotivoManual(e.target.value)}
                        placeholder={`Nota opcional (por defecto: Ajuste comercial ${ajustePorcentaje}%)`}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-xs text-[#1C1518] outline-none focus:border-[#3B0D1E]"
                      />
                    </div>
                  )}
                </section>
              </div>

              {/* ── COLUMNA DERECHA: Tarjeta Sticky BI (5 cols) ──────────── */}
              <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-5">
                <div className="bg-white rounded-3xl border border-[#EFE8E4] overflow-hidden shadow-[0_20px_50px_-12px_rgba(59,13,30,0.14)]">
                  {/* Cabecera Velvet Plum */}
                  <div className="v-gradient-hero p-6 text-[#FAF7F5]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-[#E8CFC8] font-semibold">
                        Cotización Sugerida
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                          esRentabilidadOptima
                            ? 'bg-[#0D9488]/25 text-[#5EEAD4] border border-[#0D9488]/40'
                            : 'bg-[#D97757]/25 text-[#FDBA74] border border-[#D97757]/40'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            esRentabilidadOptima ? 'bg-[#0D9488]' : 'bg-[#D97757]'
                          }`}
                        />
                        {esRentabilidadOptima ? 'Rentabilidad Óptima' : 'Oportunidad de Calibración'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-3">
                      <div>
                        <div className="text-4xl font-bold tracking-tight">
                          {formatearPrecioCop(precioCotizadoFinal)}
                        </div>
                        <p className="text-xs text-[#E8CFC8]/80 mt-1">
                          {(clientaSeleccionada?.nombre || nombreClientaTexto.trim())
                            ? `Para ${clientaSeleccionada?.nombre || nombreClientaTexto.trim()} · `
                            : ''}
                          {servicioActual?.nombre ?? 'Servicio'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold text-[#E8CFC8]">
                          {margenPctEntero}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-[#E8CFC8]/75">
                          Margen Neto
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo del Desglose Sin Báscula */}
                  <div className="p-6 space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#6E6266]">
                          Consumo Estimado (Sin Báscula)
                        </span>
                        <span className="text-[11px] font-semibold text-[#7C3AED] bg-[#F5EFFB] px-2.5 py-0.5 rounded-full">
                          Factor ×{calculoCosto.detalle.factores.total}
                        </span>
                      </div>

                      <div className="space-y-2.5 text-sm">
                        {calculoCosto.detalle.fuente !== 'sin_color' && (
                          <>
                            <div className="flex items-center justify-between py-1.5 border-b border-[#FAF7F5]">
                              <div>
                                <span className="font-medium text-[#1C1518]">
                                  {servicioActual?.categoria === 'decoloracion'
                                    ? 'Decolorante / Color'
                                    : 'Fórmula de Color'}
                                </span>
                                <span className="ml-2 text-xs text-[#7C3AED] font-semibold">
                                  {Math.round(calculoCosto.gramosTinte)} g
                                </span>
                              </div>
                              <span className="font-medium text-[#6E6266]">
                                {formatearPrecioCop(Math.round(calculoCosto.costoTinte))}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-[#FAF7F5]">
                              <div>
                                <span className="font-medium text-[#1C1518]">
                                  Peróxido / Revelador
                                </span>
                                <span className="ml-2 text-xs text-[#7C3AED] font-semibold">
                                  {calculoCosto.mlOxidanteRedondeado} ml
                                </span>
                              </div>
                              <span className="font-medium text-[#6E6266]">
                                {formatearPrecioCop(Math.round(calculoCosto.costoOxidante))}
                              </span>
                            </div>
                          </>
                        )}

                        <div className="flex items-center justify-between py-1.5 border-b border-[#FAF7F5]">
                          <div>
                            <span className="font-medium text-[#1C1518]">
                              Insumos & Protección Capilar
                            </span>
                            <span className="ml-2 text-xs text-[#7C3AED] font-semibold">
                              1 serv.
                            </span>
                          </div>
                          <span className="font-medium text-[#6E6266]">
                            {formatearPrecioCop(calculoCosto.insumosFijos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Estructura Financiera: Producto + Comisión + Utilidad Neta */}
                    <div className="bg-[#FAF7F5] rounded-2xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between text-[#6E6266]">
                        <span>Costo total de química e insumos</span>
                        <span className="font-bold text-[#1C1518]">
                          {formatearPrecioCop(calculoCosto.costoTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#6E6266]">
                        <span>
                          Comisión de Especialista
                          {usaComisionReferencia ? ' (ref. 35%)' : ''}
                        </span>
                        <span className="font-bold text-[#1C1518]">
                          {formatearPrecioCop(calculoComision.comision)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#EFE8E4] flex justify-between text-sm">
                        <span className="font-bold text-[#3B0D1E]">Utilidad Neta del Salón</span>
                        <span
                          className={`font-bold ${
                            esRentabilidadOptima ? 'text-[#0D9488]' : 'text-[#D97757]'
                          }`}
                        >
                          {formatearPrecioCop(calculoComision.margenSalon)}
                        </span>
                      </div>
                    </div>

                    {/* Mensaje No Punitivo */}
                    <div
                      className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                        esRentabilidadOptima
                          ? 'bg-[#EAF6F4] text-[#0D7A70]'
                          : 'bg-[#FDF2EC] text-[#B85D3B]'
                      }`}
                    >
                      {esRentabilidadOptima ? (
                        'Equilibrio ideal: La cotización cubre el consumo estimado sin báscula, respeta la comisión de la especialista y protege el margen libre del salón.'
                      ) : Number.isFinite(calculoComision.precioSugeridoProteccion) &&
                        calculoComision.precioSugeridoProteccion > precioCotizadoFinal ? (
                        `Oportunidad de calibración: Para alcanzar un 30% de margen neto con este consumo, el valor sugerido es ${formatearPrecioCop(
                          calculoComision.precioSugeridoProteccion
                        )}.`
                      ) : (
                        'Oportunidad de calibración: Puedes revisar la base del servicio o calcular la comisión sobre precio menos producto.'
                      )}
                    </div>

                    {/* Dos Botones de Acción Conectados a Supabase */}
                    <div className="space-y-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmarCotizacion('whatsapp')}
                        disabled={guardandoModo !== null || Boolean(bloqueoServicioSeleccionado)}
                        className="w-full py-3.5 px-5 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-50 text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageCircle size={17} />
                        {guardandoModo === 'whatsapp'
                          ? 'Generando enlace…'
                          : 'Confirmar y Enviar por WhatsApp'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConfirmarCotizacion('cierre')}
                        disabled={guardandoModo !== null || Boolean(bloqueoServicioSeleccionado)}
                        className="w-full py-3 px-5 rounded-full bg-white hover:bg-[#F7ECEF]/60 disabled:opacity-50 text-[#3B0D1E] border border-[#DFC5CE] font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 size={15} />
                        {guardandoModo === 'cierre'
                          ? 'Guardando…'
                          : 'Guardar en Por Cobrar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vista rápida inferior de servicios pendientes si existen */}
            <div className="mt-10">
              <ListaPorCobrar refreshKey={refreshCierre} clientas={todasClientas} />
            </div>
          </>
        )}
      </main>

      {/* Modal opcional de Cámara IA Capilar */}
      {camaraIAAbierta && (
        <div className="fixed inset-0 z-50 bg-[#1F050F]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EFE8E4] overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#3B0D1E] text-[#FAF7F5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#E8CFC8]" />
                <span className="text-sm font-bold">Asistente Visual IA Capilar</span>
              </div>
              <button
                type="button"
                onClick={() => setCamaraIAAbierta(false)}
                className="text-[#E8CFC8] hover:text-white cursor-pointer"
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

      <BottomNavV2 />
    </div>
  );
}

export default function VelliVelvetStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F5] flex items-center justify-center text-sm text-[#6E6266]">
          Cargando Velli Business Intelligence…
        </div>
      }
    >
      <VelliWorkspaceInner />
    </Suspense>
  );
}
