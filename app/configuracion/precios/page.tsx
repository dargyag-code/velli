'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Check,
  Sparkles,
  AlertTriangle,
  Users,
  Package,
  Percent,
  Calculator,
  Trash2,
  Lock,
  Sliders,
} from 'lucide-react';
import { Btn, Chip, BottomNavV2 } from '@/components/v2';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';
import { showToast } from '@/lib/toast';
import {
  CATALOGO_VARIABLES,
  FACTORES_CONSUMO_DEFECTO,
  evaluarAvisosEstandar,
  calcularPrecioCotizacion,
  calcularCostoProducto,
  calcularPrecioUnitarioProducto,
  calcularComisionYMargen,
  formatearPrecioCop,
  listarServiciosSalon,
  sembrarServiciosDesdeOnboarding,
  sembrarBaseFinancieraSalon,
  crearServicioSalon,
  actualizarServicioSalon,
  listarPlantillasVigentes,
  obtenerPlantillaVigente,
  publicarPlantillaPrecio,
  listarEstilistas,
  crearEstilista,
  listarProductosSalon,
  crearProductoSalon,
  listarComisionesVigentes,
  crearReglaComision,
  cerrarReglaComision,
  type ClaveVariable,
  type CategoriaServicioDB,
  type ValorLargo,
  type ValorDensidad,
  type ValorEstadoFibra,
  type ValorCanas,
  type AjustesPlantilla,
  type AjusteValorVariable,
  type FactoresConsumoPlantilla,
  type BaseComision,
  type TipoComision,
  type TipoProductoSalon,
  type ServicioSalon,
  type PlantillaPrecio,
  type EstilistaSalon,
  type ProductoSalon,
  type ComisionSalon,
  type ConsumoPlantillaInput,
} from '@/lib/cotizador';

type PestanaPrecios = 'servicios' | 'quimica' | 'comisiones';

const ORDEN_VARIABLES: ClaveVariable[] = ['largo', 'densidad', 'estado', 'canas'];

const ETIQUETAS_VARIABLE: Record<ClaveVariable, string> = {
  largo: 'Largo',
  densidad: 'Densidad',
  estado: 'Estado de la fibra',
  canas: 'Porcentaje de canas',
};

const CATEGORIAS_SERVICIO: Array<{ valor: CategoriaServicioDB; etiqueta: string }> = [
  { valor: 'corte', etiqueta: 'Corte' },
  { valor: 'tratamiento', etiqueta: 'Tratamiento' },
  { valor: 'color', etiqueta: 'Color / Tinte' },
  { valor: 'decoloracion', etiqueta: 'Decoloración / Mechas' },
  { valor: 'alisado', etiqueta: 'Alisado / Queratina' },
  { valor: 'rizos', etiqueta: 'Rizos / Definición' },
  { valor: 'peinado', etiqueta: 'Peinado / Cepillado' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export default function ConfiguracionPreciosPage() {
  const router = useRouter();
  const [pestana, setPestana] = useState<PestanaPrecios>('servicios');
  const [cargando, setCargando] = useState(true);
  const [sub, setSub] = useState<SuscripcionEfectiva | null>(null);

  // Datos del salón
  const [servicios, setServicios] = useState<ServicioSalon[]>([]);
  const [plantillasMap, setPlantillasMap] = useState<Record<string, PlantillaPrecio>>({});
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);
  const [productos, setProductos] = useState<ProductoSalon[]>([]);
  const [comisiones, setComisiones] = useState<ComisionSalon[]>([]);

  // Servicio activo en el editor
  const [servicioId, setServicioId] = useState<string>('');
  const [creandoServicio, setCreandoServicio] = useState(false);
  const [nuevoServicioNombre, setNuevoServicioNombre] = useState('');
  const [nuevoServicioCategoria, setNuevoServicioCategoria] = useState<CategoriaServicioDB>('tratamiento');

  // Estado editable del servicio activo (publica automáticamente versión interna al guardar)
  const [precioBase, setPrecioBase] = useState<number>(120000);
  const [redondeo, setRedondeo] = useState<number>(1000);
  const [vigenciaDias, setVigenciaDias] = useState<number>(15);
  const [variablesActivas, setVariablesActivas] = useState<ClaveVariable[]>(['largo', 'densidad', 'estado', 'canas']);
  const [usaFormulaColor, setUsaFormulaColor] = useState<boolean>(false);
  const [ajustesEdit, setAjustesEdit] = useState<AjustesPlantilla>({});
  const [guardandoServicio, setGuardandoServicio] = useState(false);

  // Consumo químico del servicio activo
  const [gramosTinteBase, setGramosTinteBase] = useState<number>(60);
  const [proporcionOxidante, setProporcionOxidante] = useState<number>(1.5);
  const [insumosFijos, setInsumosFijos] = useState<number>(0);
  const [factoresConsumo, setFactoresConsumo] = useState<FactoresConsumoPlantilla>(FACTORES_CONSUMO_DEFECTO);

  // Formulario rápido de Especialista
  const [nuevaEstilistaNombre, setNuevaEstilistaNombre] = useState('');
  const [guardandoEstilista, setGuardandoEstilista] = useState(false);

  // Formulario rápido de Producto Químico
  const [prodNombre, setProdNombre] = useState('');
  const [prodMarca, setProdMarca] = useState('');
  const [prodTipo, setProdTipo] = useState<TipoProductoSalon>('tinte');
  const [prodUnidad, setProdUnidad] = useState<'g' | 'ml' | 'unidad'>('g');
  const [prodCantidad, setProdCantidad] = useState<string>('60');
  const [prodCosto, setProdCosto] = useState<string>('28000');
  const [guardandoProd, setGuardandoProd] = useState(false);

  // Formulario de Regla de Comisión
  const [comEstilistaId, setComEstilistaId] = useState<string>('');
  const [comServicioId, setComServicioId] = useState<string>('');
  const [comTipo, setComTipo] = useState<TipoComision>('porcentaje');
  const [comValor, setComValor] = useState<string>('40');
  const [comBase, setComBase] = useState<BaseComision>('precio');
  const [guardandoCom, setGuardandoCom] = useState(false);

  // Simulador de Margen en vivo
  const [simLargo, setSimLargo] = useState<ValorLargo>('medio');
  const [simDensidad, setSimDensidad] = useState<ValorDensidad>('media');
  const [simEstado, setSimEstado] = useState<ValorEstadoFibra>('sana');
  const [simCanas, setSimCanas] = useState<ValorCanas>('0_25');
  const [simEstilistaId, setSimEstilistaId] = useState<string>('');
  const [simTinteId, setSimTinteId] = useState<string>('');
  const [simOxidanteId, setSimOxidanteId] = useState<string>('');

  // Todo salón activo en Velli Business Intelligence tiene acceso completo
  // a Costos de Química y Liquidación de Especialistas (el candado Pro+IA se
  // reserva exclusivamente para el diagnóstico fotográfico con IA).
  const tienePlanPro = true;

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    try {
      const [prof, subEf, svcsIniciales, plantillas, ests, prods, coms] = await Promise.all([
        getProfile().catch(() => null),
        getSuscripcionEfectiva().catch(() => null),
        listarServiciosSalon({ soloActivos: false }).catch(() => [] as ServicioSalon[]),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
        listarEstilistas({ soloActivas: false }).catch(() => [] as EstilistaSalon[]),
        listarProductosSalon({ soloActivos: false }).catch(() => [] as ProductoSalon[]),
        listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
      ]);

      setSub(subEf);
      let svcs = svcsIniciales;
      if (svcs.length === 0) {
        await sembrarServiciosDesdeOnboarding(prof?.servicios ?? []).catch(() => [] as ServicioSalon[]);
        svcs = await listarServiciosSalon({ soloActivos: false }).catch(() => [] as ServicioSalon[]);
      }
      setServicios(svcs);

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

      const pMap: Record<string, PlantillaPrecio> = {};
      for (const p of plantillas) {
        if (!p.vigenteHasta) pMap[p.servicioId] = p;
      }
      setPlantillasMap(pMap);
      setEstilistas(estsEfectivas);
      setProductos(prodsEfectivos);
      setComisiones(comsEfectivas);

      if (svcs.length > 0 && !servicioId) {
        setServicioId(svcs[0].id);
      }
      const primerTinte = prodsEfectivos.find((p) => p.unidad === 'g');
      const primerOx = prodsEfectivos.find((p) => p.unidad === 'ml');
      if (primerTinte) setSimTinteId(primerTinte.id);
      if (primerOx) setSimOxidanteId(primerOx.id);
    } finally {
      setCargando(false);
    }
  }, [servicioId]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const servicioActual = useMemo(
    () => servicios.find((s) => s.id === servicioId) ?? null,
    [servicios, servicioId]
  );

  // Sincronizar campos cuando cambia el servicio seleccionado
  useEffect(() => {
    if (!servicioActual) return;
    setUsaFormulaColor(servicioActual.usaFormulaColor);
    const varsExt = servicioActual.perfilExtendido?.['variablesActivas'];
    if (Array.isArray(varsExt) && varsExt.length > 0) {
      setVariablesActivas(varsExt as ClaveVariable[]);
    } else {
      setVariablesActivas(
        servicioActual.usaFormulaColor
          ? ['largo', 'densidad', 'estado', 'canas']
          : ['largo', 'densidad', 'estado']
      );
    }

    const plant = plantillasMap[servicioActual.id];
    if (plant) {
      setPrecioBase(plant.precioBase);
      setRedondeo(plant.redondeo || 1000);
      setVigenciaDias(plant.vigenciaDias || 15);
      setAjustesEdit(plant.ajustes ?? {});
      const cons = (plant.consumo ?? {}) as ConsumoPlantillaInput;
      setGramosTinteBase(cons.gramosTinteBase ?? 60);
      setProporcionOxidante(
        typeof cons.proporcionOxidante === 'number' ? cons.proporcionOxidante : 1.5
      );
      setInsumosFijos(cons.insumosFijos ?? 0);
      setFactoresConsumo({
        largo: { ...FACTORES_CONSUMO_DEFECTO.largo, ...(cons.factores?.largo ?? {}) },
        densidad: {
          ...FACTORES_CONSUMO_DEFECTO.densidad,
          ...(cons.factores?.densidad ?? {}),
        },
        canas: { ...FACTORES_CONSUMO_DEFECTO.canas, ...(cons.factores?.canas ?? {}) },
      });
    } else {
      setPrecioBase(120000);
      setRedondeo(1000);
      setVigenciaDias(15);
      setAjustesEdit({});
      setGramosTinteBase(60);
      setProporcionOxidante(1.5);
      setInsumosFijos(0);
      setFactoresConsumo(FACTORES_CONSUMO_DEFECTO);
    }
  }, [servicioActual, plantillasMap]);

  const toggleVariableActiva = (clave: ClaveVariable) => {
    setVariablesActivas((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    );
  };

  const cambiarAjusteOpcion = (
    variable: ClaveVariable,
    opcion: string,
    campo: 'suma' | 'porcentaje',
    nuevoValor: string
  ) => {
    const num = Number(nuevoValor) || 0;
    setAjustesEdit((prev) => {
      const grupoActual = { ...(prev[variable] ?? {}) } as Record<string, AjusteValorVariable>;
      const actual: AjusteValorVariable = grupoActual[opcion] ?? { suma: 0, porcentaje: 0 };
      return {
        ...prev,
        [variable]: {
          ...grupoActual,
          [opcion]: {
            ...actual,
            [campo]: num,
          },
        },
      };
    });
  };

  const handleCrearServicio = async () => {
    if (!nuevoServicioNombre.trim()) {
      showToast('Escribe el nombre del servicio', 'error');
      return;
    }
    try {
      const esColor =
        nuevoServicioCategoria === 'color' || nuevoServicioCategoria === 'decoloracion';
      const creado = await crearServicioSalon({
        nombre: nuevoServicioNombre.trim(),
        categoria: nuevoServicioCategoria,
        usaFormulaColor: esColor,
        orden: servicios.length,
      });
      setServicios((prev) => [...prev, creado]);
      setServicioId(creado.id);
      setNuevoServicioNombre('');
      setCreandoServicio(false);
      showToast('Servicio agregado al menú', 'success');
    } catch (err) {
      console.error('[precios.crearServicio]', err);
      showToast('No se pudo crear el servicio', 'error');
    }
  };

  // Guarda cambios del servicio y publica automáticamente la nueva versión en Supabase por debajo
  const handleGuardarServicio = async () => {
    if (!servicioActual) return;
    setGuardandoServicio(true);
    try {
      const srvActualizado = await actualizarServicioSalon(servicioActual.id, {
        usaFormulaColor,
        perfilExtendido: {
          ...servicioActual.perfilExtendido,
          variablesActivas,
        },
      });
      setServicios((prev) =>
        prev.map((s) => (s.id === srvActualizado.id ? srvActualizado : s))
      );

      const consumoPayload: Record<string, unknown> = {
        usaFormulaColor,
        gramosTinteBase,
        proporcionOxidante,
        insumosFijos,
        factores: factoresConsumo,
      };

      await publicarPlantillaPrecio({
        servicioId: servicioActual.id,
        precioBase: Math.max(0, Math.round(precioBase)),
        ajustes: ajustesEdit,
        consumo: consumoPayload,
        redondeo,
        vigenciaDias,
      });

      const vigente = await obtenerPlantillaVigente(servicioActual.id);
      if (vigente) {
        setPlantillasMap((prev) => ({ ...prev, [servicioActual.id]: vigente }));
      }
      showToast(`Cambios de ${servicioActual.nombre} guardados`, 'success');
    } catch (err) {
      console.error('[precios.guardarServicio]', err);
      showToast('No se pudieron guardar los cambios del servicio', 'error');
    } finally {
      setGuardandoServicio(false);
    }
  };

  const handleAgregarEstilista = async () => {
    if (!nuevaEstilistaNombre.trim()) return;
    setGuardandoEstilista(true);
    try {
      const creada = await crearEstilista({ nombre: nuevaEstilistaNombre.trim(), activo: true });
      setEstilistas((prev) => [...prev, creada]);
      setNuevaEstilistaNombre('');
      showToast('Especialista agregada al equipo', 'success');
    } catch (err) {
      console.error('[precios.estilista]', err);
      showToast('No se pudo guardar la especialista', 'error');
    } finally {
      setGuardandoEstilista(false);
    }
  };

  const handleAgregarProducto = async () => {
    const cant = Number(prodCantidad);
    const costo = Number(prodCosto.replace(/\D/g, ''));
    if (!prodNombre.trim() || !(cant > 0) || costo < 0) {
      showToast('Completa nombre, presentación (> 0) y costo', 'error');
      return;
    }
    setGuardandoProd(true);
    try {
      const creado = await crearProductoSalon({
        nombre: prodNombre.trim(),
        marca: prodMarca.trim() || null,
        tipo: prodTipo,
        unidad: prodUnidad,
        presentacionCantidad: cant,
        precioCompra: costo,
        activo: true,
      });
      setProductos((prev) => [...prev, creado]);
      if (creado.unidad === 'g' && !simTinteId) setSimTinteId(creado.id);
      if (creado.unidad === 'ml' && !simOxidanteId) setSimOxidanteId(creado.id);
      setProdNombre('');
      setProdMarca('');
      showToast('Insumo químico guardado', 'success');
    } catch (err) {
      console.error('[precios.producto]', err);
      showToast('No se pudo guardar el producto químico', 'error');
    } finally {
      setGuardandoProd(false);
    }
  };

  const handleAgregarComision = async () => {
    const val = Number(comValor);
    if (!Number.isFinite(val) || val < 0) {
      showToast('Ingresa un valor de comisión válido', 'error');
      return;
    }
    setGuardandoCom(true);
    try {
      const creada = await crearReglaComision({
        estilistaId: comEstilistaId || null,
        servicioId: comServicioId || null,
        tipo: comTipo,
        valor: val,
        base: comBase,
      });
      setComisiones((prev) => [creada, ...prev]);
      showToast('Regla de comisión guardada', 'success');
    } catch (err) {
      console.error('[precios.comision]', err);
      showToast('No se pudo guardar la regla de comisión', 'error');
    } finally {
      setGuardandoCom(false);
    }
  };

  const handleEliminarComision = async (id: string) => {
    try {
      await cerrarReglaComision(id);
      setComisiones((prev) => prev.filter((c) => c.id !== id));
      showToast('Regla de comisión eliminada', 'success');
    } catch {
      showToast('No se pudo eliminar la regla', 'error');
    }
  };

  // ── Simulador de Margen en vivo (usa funciones puras de lib/cotizador) ───
  const simulacion = useMemo(() => {
    const resPrecio = calcularPrecioCotizacion(
      {
        precioBase,
        ajustes: ajustesEdit,
        variablesActivas,
        redondeo,
      },
      {
        largo: simLargo,
        densidad: simDensidad,
        estado: simEstado,
        canas: simCanas,
      }
    );

    const prodTinte =
      productos.find((p) => p.id === simTinteId) ?? productos.find((p) => p.unidad === 'g');
    const prodOx =
      productos.find((p) => p.id === simOxidanteId) ?? productos.find((p) => p.unidad === 'ml');

    const resCosto = calcularCostoProducto({
      variables: {
        largo: simLargo,
        densidad: simDensidad,
        canas: simCanas,
      },
      consumo: {
        usaFormulaColor,
        gramosTinteBase,
        proporcionOxidante,
        insumosFijos,
        factores: factoresConsumo,
      },
      productoTinte: prodTinte ?? null,
      productoOxidante: prodOx ?? null,
    });

    const resComision = calcularComisionYMargen({
      precio: resPrecio.precioCalculado,
      costoProducto: resCosto.costoTotal,
      reglas: comisiones,
      estilistaId: simEstilistaId || null,
      servicioId: servicioActual?.id ?? null,
      redondeo,
    });

    const avisos = evaluarAvisosEstandar({
      estado: simEstado,
      canas: simCanas,
      categoriaServicio: servicioActual?.categoria,
      usaFormulaColor,
    });

    return {
      resPrecio,
      resCosto,
      resComision,
      avisos,
    };
  }, [
    precioBase,
    ajustesEdit,
    variablesActivas,
    simLargo,
    simDensidad,
    simEstado,
    simCanas,
    redondeo,
    productos,
    simTinteId,
    simOxidanteId,
    usaFormulaColor,
    gramosTinteBase,
    proporcionOxidante,
    insumosFijos,
    factoresConsumo,
    comisiones,
    simEstilistaId,
    servicioActual,
  ]);

  const costoUnitarioPreview = useMemo(() => {
    const cant = Number(prodCantidad);
    const costo = Number(prodCosto.replace(/\D/g, ''));
    return Math.round(
      calcularPrecioUnitarioProducto({
        presentacionCantidad: cant,
        precioCompra: costo,
      })
    );
  }, [prodCantidad, prodCosto]);

  return (
    <div
      className="v-grain"
      style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 140 }}
    >
      {/* Cabecera ejecutiva */}
      <header
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: '48px 20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/configuracion')}
          aria-label="Volver a Configuración"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-main)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className="v-caps">Velli Business Intelligence · Calibración del Salón</span>
          <h1
            style={{
              margin: '2px 0 0',
              fontFamily: 'var(--font-serif)',
              fontSize: 25,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'var(--primary)',
            }}
          >
            Menú de servicios, química y comisiones
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        {/* Selector de 3 Pestañas claras de negocio */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
            gap: 6,
            padding: 5,
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setPestana('servicios')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: pestana === 'servicios' ? 'var(--primary)' : 'transparent',
              color: pestana === 'servicios' ? '#FAF7F5' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            1. Menú de Servicios
          </button>

          <button
            type="button"
            onClick={() => setPestana('quimica')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: pestana === 'quimica' ? 'var(--primary)' : 'transparent',
              color: pestana === 'quimica' ? '#FAF7F5' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>2. Costos de Química ($/g y $/ml)</span>
            {!tienePlanPro && <Lock size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setPestana('comisiones')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: pestana === 'comisiones' ? 'var(--primary)' : 'transparent',
              color: pestana === 'comisiones' ? '#FAF7F5' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>3. Especialistas y Comisiones</span>
            {!tienePlanPro && <Lock size={12} />}
          </button>
        </div>

        {/* Selector horizontal de servicio activo (visible en Pestaña 1 y 2 para calibrar tarifas y gramos) */}
        {(pestana === 'servicios' || pestana === 'quimica') && (
          <section className="v-card" style={{ padding: 16, marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <span className="v-caps">Servicios de tu salón</span>
              <button
                type="button"
                onClick={() => setCreandoServicio((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Nuevo servicio
              </button>
            </div>

            {creandoServicio && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 8 }}>
                  <input
                    type="text"
                    value={nuevoServicioNombre}
                    onChange={(e) => setNuevoServicioNombre(e.target.value)}
                    placeholder="Ej. Balayage Alta Precisión, Hidratación profunda…"
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                    }}
                  />
                  <select
                    value={nuevoServicioCategoria}
                    onChange={(e) => setNuevoServicioCategoria(e.target.value as CategoriaServicioDB)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                    }}
                  >
                    {CATEGORIAS_SERVICIO.map((cat) => (
                      <option key={cat.valor} value={cat.valor}>
                        {cat.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn size="sm" variant="primary" onClick={handleCrearServicio}>
                    Agregar servicio
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setCreandoServicio(false)}>
                    Cancelar
                  </Btn>
                </div>
              </div>
            )}

            {cargando ? (
              <div className="skeleton-shimmer" style={{ height: 42, borderRadius: 12 }} />
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {servicios.map((srv) => {
                  const activo = srv.id === servicioId;
                  const plant = plantillasMap[srv.id];
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setServicioId(srv.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: activo
                          ? '1.5px solid var(--primary)'
                          : '1px solid var(--border-soft)',
                        background: activo ? 'var(--primary-pale)' : 'var(--bg)',
                        color: activo ? 'var(--primary)' : 'var(--text-main)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{srv.nombre}</span>
                      {plant && (
                        <span className="tabular-nums" style={{ fontSize: 11, opacity: 0.78 }}>
                          · {formatearPrecioCop(plant.precioBase)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PESTAÑA 1: MENÚ DE SERVICIOS
           ═══════════════════════════════════════════════════════════════════ */}
        {pestana === 'servicios' && servicioActual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="v-card" style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <span className="v-caps">Tarifa y reglas de cobro</span>
                  <h2
                    style={{
                      margin: '2px 0 0',
                      fontFamily: 'var(--font-serif)',
                      fontSize: 21,
                      fontWeight: 700,
                      color: 'var(--primary)',
                    }}
                  >
                    {servicioActual.nombre}
                  </h2>
                </div>
                {plantillasMap[servicioActual.id] && (
                  <span
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      background: 'rgba(13, 148, 136, 0.12)',
                      color: '#0D9488',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Tarifa activa
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-tertiary)',
                      marginBottom: 4,
                    }}
                  >
                    PRECIO BASE (COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={precioBase}
                    onChange={(e) => setPrecioBase(Number(e.target.value) || 0)}
                    className="tabular-nums"
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontSize: 14,
                      fontWeight: 700,
                      background: 'var(--bg)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-tertiary)',
                      marginBottom: 4,
                    }}
                  >
                    REDONDEO COMERCIAL
                  </label>
                  <select
                    value={redondeo}
                    onChange={(e) => setRedondeo(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      background: 'var(--bg)',
                      color: 'var(--text-main)',
                    }}
                  >
                    <option value={1000}>A $1.000 COP</option>
                    <option value={500}>A $500 COP</option>
                    <option value={100}>A $100 COP</option>
                    <option value={1}>Exacto ($1)</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-tertiary)',
                      marginBottom: 4,
                    }}
                  >
                    VIGENCIA DE COTIZACIÓN (DÍAS)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={vigenciaDias}
                    onChange={(e) => setVigenciaDias(Math.max(1, Number(e.target.value) || 15))}
                    className="tabular-nums"
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      background: 'var(--bg)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="v-caps" style={{ marginBottom: 6 }}>
                  Factores capilares que ajustan el precio en silla
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ORDEN_VARIABLES.map((clave) => {
                    const activa = variablesActivas.includes(clave);
                    return (
                      <button
                        key={clave}
                        type="button"
                        onClick={() => toggleVariableActiva(clave)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 999,
                          border: activa
                            ? '1.5px solid var(--primary)'
                            : '1px solid var(--border-soft)',
                          background: activa ? 'var(--primary-pale)' : 'var(--bg)',
                          color: activa ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {activa ? '✓ ' : '+ '}
                        {ETIQUETAS_VARIABLE[clave]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ajustes por opción para cada variable activa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ORDEN_VARIABLES.filter((c) => variablesActivas.includes(c)).map((clave) => {
                  const opciones = CATALOGO_VARIABLES[clave];
                  const grupo = (ajustesEdit[clave] ?? {}) as Record<
                    string,
                    AjusteValorVariable | undefined
                  >;
                  return (
                    <div
                      key={clave}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'var(--bg)',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          marginBottom: 8,
                        }}
                      >
                        {ETIQUETAS_VARIABLE[clave]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {opciones.map((op) => {
                          const aj = grupo[op.valor] ?? { suma: 0, porcentaje: 0 };
                          return (
                            <div
                              key={op.valor}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 1fr 1fr',
                                gap: 8,
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                  }}
                                >
                                  {op.etiqueta}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                                  {op.guia}
                                </div>
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 9.5,
                                    color: 'var(--text-tertiary)',
                                  }}
                                >
                                  + SUMA ($)
                                </label>
                                <input
                                  type="number"
                                  step={1000}
                                  value={aj.suma ?? 0}
                                  onChange={(e) =>
                                    cambiarAjusteOpcion(clave, op.valor, 'suma', e.target.value)
                                  }
                                  className="tabular-nums"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    textAlign: 'right',
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 9.5,
                                    color: 'var(--text-tertiary)',
                                  }}
                                >
                                  + PORCENTAJE (%)
                                </label>
                                <input
                                  type="number"
                                  step={1}
                                  value={aj.porcentaje ?? 0}
                                  onChange={(e) =>
                                    cambiarAjusteOpcion(
                                      clave,
                                      op.valor,
                                      'porcentaje',
                                      e.target.value
                                    )
                                  }
                                  className="tabular-nums"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    textAlign: 'right',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 18 }}>
                <Btn
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={guardandoServicio}
                  onClick={handleGuardarServicio}
                  icon={guardandoServicio ? <Sparkles size={16} /> : <Check size={16} />}
                >
                  {guardandoServicio
                    ? 'Guardando cambios…'
                    : `Guardar cambios de ${servicioActual.nombre}`}
                </Btn>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PESTAÑA 2: COSTOS DE QUÍMICA ($/g y $/ml)
           ═══════════════════════════════════════════════════════════════════ */}
        {pestana === 'quimica' && (
          <>
            {!tienePlanPro ? (
              <section
                className="v-card"
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--primary-pale)',
                }}
              >
                <Lock size={28} style={{ color: 'var(--secondary-deep)', margin: '0 auto 10px' }} />
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontSize: 22,
                    color: 'var(--primary-deep)',
                  }}
                >
                  Costeo de química sin báscula en Plan Pro y Pro+IA
                </h2>
                <p
                  style={{
                    margin: '8px auto 18px',
                    maxWidth: 420,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  Registra tus tubos de tinte, decolorante y oxidantes para calcular
                  automáticamente el costo exacto por gramo ($/g) y mililitro ($/ml) en cada servicio.
                </p>
                <Link href="/planes">
                  <Btn variant="primary" size="md">
                    Mejorar a Plan Pro
                  </Btn>
                </Link>
              </section>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Consumo químico calibrado por servicio */}
                {servicioActual && (
                  <section className="v-card" style={{ padding: 18 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sliders size={16} style={{ color: '#7C3AED' }} />
                        <div>
                          <span className="v-caps" style={{ color: '#7C3AED' }}>
                            Fórmula sin báscula por servicio
                          </span>
                          <h3
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-serif)',
                              fontSize: 18,
                              fontWeight: 700,
                              color: 'var(--primary)',
                            }}
                          >
                            Consumo base · {servicioActual.nombre}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        marginBottom: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={usaFormulaColor}
                        onChange={(e) => setUsaFormulaColor(e.target.checked)}
                      />
                      Este servicio consume tinte / decolorante + oxidante
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 10,
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--text-tertiary)',
                            marginBottom: 4,
                          }}
                        >
                          GRAMOS BASE (g)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={gramosTinteBase}
                          onChange={(e) => setGramosTinteBase(Number(e.target.value) || 0)}
                          className="tabular-nums"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            fontWeight: 700,
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--text-tertiary)',
                            marginBottom: 4,
                          }}
                        >
                          PROP. OXIDANTE (1:X)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={proporcionOxidante}
                          onChange={(e) => setProporcionOxidante(Number(e.target.value) || 0)}
                          className="tabular-nums"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            fontWeight: 700,
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--text-tertiary)',
                            marginBottom: 4,
                          }}
                        >
                          INSUMOS FIJOS (ALUMINIO, GUANTES · $)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={insumosFijos}
                          onChange={(e) => setInsumosFijos(Number(e.target.value) || 0)}
                          className="tabular-nums"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            fontWeight: 700,
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                    </div>

                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={guardandoServicio}
                      onClick={handleGuardarServicio}
                    >
                      {guardandoServicio
                        ? 'Guardando…'
                        : `Guardar consumo de ${servicioActual.nombre}`}
                    </Btn>
                  </section>
                )}

                {/* Catálogo de insumos químicos ($/g y $/ml automático) */}
                <section className="v-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Package size={16} style={{ color: '#7C3AED' }} />
                    <div>
                      <span className="v-caps" style={{ color: '#7C3AED' }}>
                        Catálogo de laboratorio
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-serif)',
                          fontSize: 18,
                          fontWeight: 700,
                          color: 'var(--primary)',
                        }}
                      >
                        Costos de Química ($/g y $/ml)
                      </h3>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={prodNombre}
                      onChange={(e) => setProdNombre(e.target.value)}
                      placeholder="Ej. Tubo tinte 60g, Oxidante 20 vol"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    />
                    <input
                      type="text"
                      value={prodMarca}
                      onChange={(e) => setProdMarca(e.target.value)}
                      placeholder="Marca (ej. Wella, Schwarzkopf)"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    />
                    <select
                      value={prodTipo}
                      onChange={(e) => setProdTipo(e.target.value as TipoProductoSalon)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="tinte">Tinte</option>
                      <option value="oxidante">Oxidante / Revelador</option>
                      <option value="decolorante">Decolorante</option>
                      <option value="matizador">Matizador / Toner</option>
                      <option value="tratamiento">Tratamiento / Plex</option>
                      <option value="otro">Otro insumo</option>
                    </select>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <select
                      value={prodUnidad}
                      onChange={(e) => setProdUnidad(e.target.value as 'g' | 'ml' | 'unidad')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="g">Gramos (g)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="unidad">Unidad</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={prodCantidad}
                      onChange={(e) => setProdCantidad(e.target.value)}
                      placeholder="Presentación (ej. 60)"
                      className="tabular-nums"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={prodCosto}
                      onChange={(e) => setProdCosto(e.target.value)}
                      placeholder="Costo envase ($ COP)"
                      className="tabular-nums"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      Costo exacto por unidad:{' '}
                      <strong className="tabular-nums" style={{ color: '#7C3AED' }}>
                        {formatearPrecioCop(costoUnitarioPreview)} / {prodUnidad}
                      </strong>
                    </span>
                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={guardandoProd}
                      onClick={handleAgregarProducto}
                    >
                      Agregar insumo químico
                    </Btn>
                  </div>

                  {productos.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {productos.map((p) => {
                        const unitario = Math.round(calcularPrecioUnitarioProducto(p));
                        return (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: 12,
                              background: 'var(--bg)',
                              border: '1px solid var(--border-soft)',
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <strong style={{ color: 'var(--text-main)' }}>{p.nombre}</strong>
                              {p.marca ? ` · ${p.marca}` : ''}{' '}
                              <span style={{ color: 'var(--text-tertiary)' }}>
                                ({p.presentacionCantidad}
                                {p.unidad} · {formatearPrecioCop(p.precioCompra)})
                              </span>
                            </div>
                            <span
                              className="tabular-nums"
                              style={{
                                padding: '3px 9px',
                                borderRadius: 999,
                                background: 'rgba(124, 58, 237, 0.1)',
                                color: '#7C3AED',
                                fontSize: 11.5,
                                fontWeight: 700,
                              }}
                            >
                              {formatearPrecioCop(unitario)} / {p.unidad}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PESTAÑA 3: ESPECIALISTAS Y COMISIONES (+ SIMULADOR DE MARGEN)
           ═══════════════════════════════════════════════════════════════════ */}
        {pestana === 'comisiones' && (
          <>
            {!tienePlanPro ? (
              <section
                className="v-card"
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--primary-pale)',
                }}
              >
                <Lock size={28} style={{ color: 'var(--secondary-deep)', margin: '0 auto 10px' }} />
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontSize: 22,
                    color: 'var(--primary-deep)',
                  }}
                >
                  Liquidación de especialistas en Plan Pro y Pro+IA
                </h2>
                <p
                  style={{
                    margin: '8px auto 18px',
                    maxWidth: 420,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  Configura tu equipo de especialistas, define comisiones sobre venta total o
                  descontando química, y simula la utilidad neta del salón en vivo.
                </p>
                <Link href="/planes">
                  <Btn variant="primary" size="md">
                    Mejorar a Plan Pro
                  </Btn>
                </Link>
              </section>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* EQUIPO DE ESPECIALISTAS */}
                <section className="v-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Users size={16} style={{ color: 'var(--primary)' }} />
                    <div>
                      <span className="v-caps">Talento del salón</span>
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-serif)',
                          fontSize: 18,
                          fontWeight: 700,
                          color: 'var(--primary)',
                        }}
                      >
                        Equipo de especialistas
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                      type="text"
                      value={nuevaEstilistaNombre}
                      onChange={(e) => setNuevaEstilistaNombre(e.target.value)}
                      placeholder="Nombre de la especialista…"
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        background: 'var(--bg)',
                      }}
                    />
                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={guardandoEstilista}
                      onClick={handleAgregarEstilista}
                    >
                      Agregar
                    </Btn>
                  </div>

                  {estilistas.length > 0 ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {estilistas.map((e) => (
                        <Chip key={e.id} tone="green">
                          {e.nombre}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Agrega tus especialistas para liquidar comisiones automáticamente en Reportes BI.
                    </p>
                  )}
                </section>

                {/* REGLAS DE COMISIÓN */}
                <section className="v-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Percent size={16} style={{ color: 'var(--primary)' }} />
                    <div>
                      <span className="v-caps">Esquema de nómina</span>
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-serif)',
                          fontSize: 18,
                          fontWeight: 700,
                          color: 'var(--primary)',
                        }}
                      >
                        Reglas de comisión
                      </h3>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Prioridad automática: regla por especialista + servicio → por especialista → por
                    servicio → regla general del salón.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <select
                      value={comEstilistaId}
                      onChange={(e) => setComEstilistaId(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="">Todas las especialistas (general)</option>
                      {estilistas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                    <select
                      value={comServicioId}
                      onChange={(e) => setComServicioId(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="">Todos los servicios</option>
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <select
                      value={comTipo}
                      onChange={(e) => setComTipo(e.target.value as TipoComision)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="porcentaje">Porcentaje (%)</option>
                      <option value="fijo">Valor fijo ($ COP)</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={comValor}
                      onChange={(e) => setComValor(e.target.value)}
                      placeholder="Ej. 40"
                      className="tabular-nums"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        background: 'var(--bg)',
                      }}
                    />
                    <select
                      value={comBase}
                      onChange={(e) => setComBase(e.target.value as BaseComision)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="precio">Sobre precio cobrado</option>
                      <option value="precio_menos_producto">
                        Neto (descontando primero química)
                      </option>
                    </select>
                  </div>

                  <Btn
                    size="sm"
                    variant="primary"
                    disabled={guardandoCom}
                    onClick={handleAgregarComision}
                  >
                    Guardar regla de comisión
                  </Btn>

                  {comisiones.length > 0 && (
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}
                    >
                      {comisiones.map((c) => {
                        const nomEst =
                          estilistas.find((e) => e.id === c.estilistaId)?.nombre ??
                          'Todas las especialistas';
                        const nomSrv =
                          servicios.find((s) => s.id === c.servicioId)?.nombre ??
                          'Todos los servicios';
                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '9px 12px',
                              borderRadius: 10,
                              background: 'var(--bg)',
                              border: '1px solid var(--border-soft)',
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <strong>{nomEst}</strong> · {nomSrv} →{' '}
                              <span
                                className="tabular-nums"
                                style={{ color: 'var(--primary)', fontWeight: 700 }}
                              >
                                {c.tipo === 'porcentaje'
                                  ? `${c.valor}%`
                                  : formatearPrecioCop(c.valor)}
                              </span>{' '}
                              <span style={{ color: 'var(--text-tertiary)' }}>
                                (
                                {c.base === 'precio_menos_producto'
                                  ? 'descontando química'
                                  : 'sobre cobrado'}
                                )
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEliminarComision(c.id)}
                              aria-label="Eliminar regla"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#D97757',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* SIMULADOR DE MARGEN EN VIVO */}
                <section
                  className="v-gradient-hero"
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    color: '#FAF7F5',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div className="v-caps" style={{ color: '#E8CFC8' }}>
                        Simulador de Rentabilidad en Vivo
                      </div>
                      <h2
                        style={{
                          margin: '2px 0 0',
                          fontFamily: 'var(--font-serif)',
                          fontSize: 21,
                          fontWeight: 700,
                          color: '#FAF7F5',
                        }}
                      >
                        {servicioActual?.nombre ?? 'Servicio'}
                      </h2>
                    </div>
                    <Calculator size={20} style={{ color: '#E8CFC8' }} />
                  </div>

                  {/* Selector de servicio y especialista en el simulador */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: '#E8CFC8',
                          marginBottom: 3,
                        }}
                      >
                        SERVICIO A SIMULAR
                      </label>
                      <select
                        value={servicioId}
                        onChange={(e) => setServicioId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(31, 5, 15, 0.75)',
                          color: '#FAF7F5',
                          fontSize: 12,
                        }}
                      >
                        {servicios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: '#E8CFC8',
                          marginBottom: 3,
                        }}
                      >
                        ESPECIALISTA
                      </label>
                      <select
                        value={simEstilistaId}
                        onChange={(e) => setSimEstilistaId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(31, 5, 15, 0.75)',
                          color: '#FAF7F5',
                          fontSize: 12,
                        }}
                      >
                        <option value="">Regla general del salón</option>
                        {estilistas.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selectores capilares en el simulador */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: '#E8CFC8',
                          marginBottom: 3,
                        }}
                      >
                        LARGO
                      </label>
                      <select
                        value={simLargo}
                        onChange={(e) => setSimLargo(e.target.value as ValorLargo)}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(31, 5, 15, 0.75)',
                          color: '#FAF7F5',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.largo.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: '#E8CFC8',
                          marginBottom: 3,
                        }}
                      >
                        DENSIDAD
                      </label>
                      <select
                        value={simDensidad}
                        onChange={(e) => setSimDensidad(e.target.value as ValorDensidad)}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(31, 5, 15, 0.75)',
                          color: '#FAF7F5',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.densidad.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: '#E8CFC8',
                          marginBottom: 3,
                        }}
                      >
                        ESTADO DE LA FIBRA
                      </label>
                      <select
                        value={simEstado}
                        onChange={(e) => setSimEstado(e.target.value as ValorEstadoFibra)}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(31, 5, 15, 0.75)',
                          color: '#FAF7F5',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.estado.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: '#E8CFC8',
                          marginBottom: 3,
                        }}
                      >
                        PORCENTAJE DE CANAS
                      </label>
                      <select
                        value={simCanas}
                        onChange={(e) => setSimCanas(e.target.value as ValorCanas)}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(31, 5, 15, 0.75)',
                          color: '#FAF7F5',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.canas.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tarjetas financieras del simulador */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: '#E8CFC8' }}>
                        PRECIO AL PÚBLICO
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 22,
                          fontWeight: 700,
                          color: '#FAF7F5',
                          marginTop: 2,
                        }}
                      >
                        {formatearPrecioCop(simulacion.resPrecio.precioCalculado)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: '#E8CFC8' }}>
                        QUÍMICA ESTIMADA
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 22,
                          fontWeight: 700,
                          color: '#FAF7F5',
                          marginTop: 2,
                        }}
                      >
                        {formatearPrecioCop(simulacion.resCosto.costoTotal)}
                      </div>
                      {usaFormulaColor && (
                        <div
                          className="tabular-nums"
                          style={{ fontSize: 10.5, color: 'rgba(250,247,245,0.75)', marginTop: 2 }}
                        >
                          {simulacion.resCosto.gramosTinte}g tinte ·{' '}
                          {simulacion.resCosto.mlOxidanteRedondeado}ml ox.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: '#E8CFC8' }}>
                        COMISIÓN ESPECIALISTA
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 22,
                          fontWeight: 700,
                          color: '#FAF7F5',
                          marginTop: 2,
                        }}
                      >
                        {formatearPrecioCop(simulacion.resComision.comision)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: simulacion.resComision.alertaMargenBajo
                          ? 'rgba(217, 119, 87, 0.25)'
                          : 'rgba(13, 148, 136, 0.22)',
                        border: simulacion.resComision.alertaMargenBajo
                          ? '1px solid rgba(217, 119, 87, 0.55)'
                          : '1px solid rgba(13, 148, 136, 0.5)',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: '#E8CFC8' }}>
                        UTILIDAD NETA SALÓN
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 22,
                          fontWeight: 700,
                          color: '#FAF7F5',
                          marginTop: 2,
                        }}
                      >
                        {formatearPrecioCop(simulacion.resComision.margenSalon)}{' '}
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                          ({simulacion.resComision.margenPorcentaje}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {simulacion.resComision.alertaMargenBajo && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: '#FFF8F4',
                        color: '#8C3F27',
                        fontSize: 12,
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        <AlertTriangle size={14} /> Margen neto inferior al 20%
                      </div>
                      {Number.isFinite(simulacion.resComision.precioSugeridoProteccion) && (
                        <div>
                          • Precio sugerido para proteger un margen mínimo del 20%:{' '}
                          <strong className="tabular-nums">
                            {formatearPrecioCop(simulacion.resComision.precioSugeridoProteccion)}
                          </strong>
                          .
                        </div>
                      )}
                      <div>
                        • Si liquidas la comisión descontando primero la química, al salón le
                        quedarían{' '}
                        <strong className="tabular-nums">
                          {formatearPrecioCop(simulacion.resComision.margenConComisionNeta)}
                        </strong>
                        .
                      </div>
                    </div>
                  )}

                  {simulacion.avisos.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11.5, color: '#E8CFC8' }}>
                      {simulacion.avisos.map((a) => a.mensaje).join(' · ')}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNavV2 />
    </div>
  );
}
