'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Check, Sparkles, AlertTriangle,
  Users, Package, Percent, Calculator, Trash2, Lock, Sliders,
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
  sembrarServiciosDesdeOnboarding,
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

type PestanaPrecios = 'plantillas' | 'rentabilidad';

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
  const [pestana, setPestana] = useState<PestanaPrecios>('plantillas');
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

  // Estado editable del servicio y plantilla activa
  const [precioBase, setPrecioBase] = useState<number>(120000);
  const [redondeo, setRedondeo] = useState<number>(1000);
  const [vigenciaDias, setVigenciaDias] = useState<number>(15);
  const [variablesActivas, setVariablesActivas] = useState<ClaveVariable[]>(['largo', 'densidad', 'estado', 'canas']);
  const [usaFormulaColor, setUsaFormulaColor] = useState<boolean>(false);
  const [ajustesEdit, setAjustesEdit] = useState<AjustesPlantilla>({});
  const [publicando, setPublicando] = useState(false);

  // Consumo y factores del servicio activo (Pro / Pro+IA)
  const [gramosTinteBase, setGramosTinteBase] = useState<number>(60);
  const [proporcionOxidante, setProporcionOxidante] = useState<number>(1.5);
  const [insumosFijos, setInsumosFijos] = useState<number>(0);
  const [factoresConsumo, setFactoresConsumo] = useState<FactoresConsumoPlantilla>(FACTORES_CONSUMO_DEFECTO);

  // Formulario rápido de Estilista
  const [nuevaEstilistaNombre, setNuevaEstilistaNombre] = useState('');
  const [guardandoEstilista, setGuardandoEstilista] = useState(false);

  // Formulario rápido de Producto
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

  const tienePlanPro = useMemo(() => {
    if (!sub) return true;
    return sub.plan === 'pro' || sub.plan === 'pro_ia' || sub.estado === 'trialing';
  }, [sub]);

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    try {
      const [prof, subEf, plantillas, ests, prods, coms] = await Promise.all([
        getProfile().catch(() => null),
        getSuscripcionEfectiva().catch(() => null),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
        listarEstilistas({ soloActivas: false }).catch(() => [] as EstilistaSalon[]),
        listarProductosSalon({ soloActivos: false }).catch(() => [] as ProductoSalon[]),
        listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
      ]);

      setSub(subEf);
      const svcs = await sembrarServiciosDesdeOnboarding(prof?.servicios ?? []).catch(
        () => [] as ServicioSalon[]
      );
      setServicios(svcs);

      const pMap: Record<string, PlantillaPrecio> = {};
      for (const p of plantillas) {
        if (!p.vigenteHasta) pMap[p.servicioId] = p;
      }
      setPlantillasMap(pMap);
      setEstilistas(ests);
      setProductos(prods);
      setComisiones(coms);

      if (svcs.length > 0 && !servicioId) {
        setServicioId(svcs[0].id);
      }
      const primerTinte = prods.find((p) => p.unidad === 'g');
      const primerOx = prods.find((p) => p.unidad === 'ml');
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
      showToast('Servicio creado', 'success');
    } catch (err) {
      console.error('[precios.crearServicio]', err);
      showToast('No se pudo crear el servicio', 'error');
    }
  };

  const handlePublicarPlantilla = async () => {
    if (!servicioActual) return;
    setPublicando(true);
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
        showToast(`Plantilla v${vigente.version} publicada`, 'success');
      } else {
        showToast('Plantilla publicada', 'success');
      }
    } catch (err) {
      console.error('[precios.publicar]', err);
      showToast('No se pudo publicar la plantilla', 'error');
    } finally {
      setPublicando(false);
    }
  };

  const handleAgregarEstilista = async () => {
    if (!nuevaEstilistaNombre.trim()) return;
    setGuardandoEstilista(true);
    try {
      const creada = await crearEstilista({ nombre: nuevaEstilistaNombre.trim(), activo: true });
      setEstilistas((prev) => [...prev, creada]);
      setNuevaEstilistaNombre('');
      showToast('Estilista agregada', 'success');
    } catch (err) {
      console.error('[precios.estilista]', err);
      showToast('No se pudo guardar la estilista', 'error');
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
      showToast('Producto guardado en el catálogo', 'success');
    } catch (err) {
      console.error('[precios.producto]', err);
      showToast('No se pudo guardar el producto', 'error');
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
      showToast('Regla cerrada', 'success');
    } catch {
      showToast('No se pudo cerrar la regla', 'error');
    }
  };

  // ── Simulador de Margen en vivo (usa las funciones puras de lib/cotizador) ──
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
      {/* Cabecera editorial */}
      <div style={{ padding: '54px 20px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => router.push('/configuracion')}
          aria-label="Volver a Configuración"
          style={{
            width: 36,
            height: 36,
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
          <span className="v-caps">Velli Business Intelligence</span>
          <h1
            style={{
              margin: '2px 0 0',
              fontFamily: 'var(--font-serif)',
              fontSize: 25,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
            }}
          >
            Precios, productos y{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--secondary-deep)' }}>comisiones</span>
          </h1>
        </div>
      </div>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px' }}>
        {/* Selector de sección (Pestaña 1: Todos los planes | Pestaña 2: Pro y Pro+IA) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            padding: 4,
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setPestana('plantillas')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: pestana === 'plantillas' ? 'var(--primary)' : 'transparent',
              color: pestana === 'plantillas' ? '#fff' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            1 · Servicios y Precios
          </button>
          <button
            type="button"
            onClick={() => setPestana('rentabilidad')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: pestana === 'rentabilidad' ? 'var(--primary)' : 'transparent',
              color: pestana === 'rentabilidad' ? '#fff' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>2 · Costos, Comisión y Margen</span>
            {!tienePlanPro && <Lock size={12} />}
          </button>
        </div>

        {/* Selector horizontal de servicio activo */}
        <section className="v-card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
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
                  placeholder="Ej. Balayage + Tono, Hidratación profunda…"
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
                  Guardar servicio
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
                      <span style={{ fontSize: 10.5, opacity: 0.75 }}>
                        · {formatearPrecioCop(plant.precioBase)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ═══ PESTAÑA 1: SERVICIOS Y PLANTILLAS DE PRECIO (TODOS LOS PLANES) ═══ */}
        {pestana === 'plantillas' && servicioActual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="v-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span className="v-caps">Plantilla de precio</span>
                  <h2 style={{ margin: '2px 0 0', fontFamily: 'var(--font-serif)', fontSize: 20 }}>
                    {servicioActual.nombre}
                  </h2>
                </div>
                {plantillasMap[servicioActual.id] && (
                  <Chip tone="green">
                    Versión v{plantillasMap[servicioActual.id].version} vigente
                  </Chip>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    PRECIO BASE (COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={precioBase}
                    onChange={(e) => setPrecioBase(Number(e.target.value) || 0)}
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
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    REDONDEO
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
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    VIGENCIA (DÍAS)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={vigenciaDias}
                    onChange={(e) => setVigenciaDias(Math.max(1, Number(e.target.value) || 15))}
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
                  Variables que modifican el precio de este servicio
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
                          border: activa ? '1.5px solid var(--primary)' : '1px solid var(--border-soft)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ORDEN_VARIABLES.filter((c) => variablesActivas.includes(c)).map((clave) => {
                  const opciones = CATALOGO_VARIABLES[clave];
                  const grupo = (ajustesEdit[clave] ?? {}) as Record<string, AjusteValorVariable | undefined>;
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
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
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
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)' }}>
                                  {op.etiqueta}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                                  {op.guia}
                                </div>
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                                  + SUMA ($)
                                </label>
                                <input
                                  type="number"
                                  step={1000}
                                  value={aj.suma ?? 0}
                                  onChange={(e) =>
                                    cambiarAjusteOpcion(clave, op.valor, 'suma', e.target.value)
                                  }
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
                                <label style={{ display: 'block', fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                                  + PORCENTAJE (%)
                                </label>
                                <input
                                  type="number"
                                  step={1}
                                  value={aj.porcentaje ?? 0}
                                  onChange={(e) =>
                                    cambiarAjusteOpcion(clave, op.valor, 'porcentaje', e.target.value)
                                  }
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

              <div style={{ marginTop: 16 }}>
                <Btn
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={publicando}
                  onClick={handlePublicarPlantilla}
                  icon={publicando ? <Sparkles size={16} /> : <Check size={16} />}
                >
                  {publicando ? 'Publicando plantilla…' : 'Publicar plantilla'}
                </Btn>
              </div>
            </section>
          </div>
        )}

        {/* ═══ PESTAÑA 2: ESTILISTAS, PRODUCTOS, COMISIONES Y SIMULADOR (PRO / PRO+IA) ═══ */}
        {pestana === 'rentabilidad' && (
          <>
            {!tienePlanPro ? (
              <section
                className="v-card"
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  border: '1px solid rgba(138, 90, 46, 0.28)',
                  background: 'linear-gradient(135deg, #FBF4EC 0%, #F5EDDC 100%)',
                }}
              >
                <Lock size={28} style={{ color: 'var(--secondary-deep)', margin: '0 auto 10px' }} />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--primary-deep)' }}>
                  Rentabilidad real en Plan Pro y Pro+IA
                </h2>
                <p style={{ margin: '8px auto 18px', maxWidth: 420, fontSize: 13, color: 'var(--secondary-deep)', lineHeight: 1.5 }}>
                  Activa el control de inventario por gramo/ml, factores de consumo por largo y densidad,
                  liquidación de comisiones por estilista y el Simulador de Margen en vivo.
                </p>
                <Link href="/planes">
                  <Btn variant="primary" size="md">
                    Mejorar a Plan Pro
                  </Btn>
                </Link>
              </section>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* SIMULADOR DE MARGEN EN VIVO */}
                <section
                  className="v-grain"
                  style={{
                    borderRadius: 20,
                    padding: 18,
                    background: 'linear-gradient(135deg, #25401E 0%, #14241A 100%)',
                    color: '#F5EDDC',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div className="v-caps" style={{ color: 'rgba(232, 194, 144, 0.92)' }}>
                        Simulador de Margen en vivo
                      </div>
                      <h2 style={{ margin: '2px 0 0', fontFamily: 'var(--font-serif)', fontSize: 22, color: '#fff' }}>
                        {servicioActual?.nombre ?? 'Servicio'}
                      </h2>
                    </div>
                    <Calculator size={20} style={{ color: '#E8C290' }} />
                  </div>

                  {/* Selectores de combinación en el simulador */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'rgba(232,194,144,0.85)', marginBottom: 3 }}>
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
                          background: 'rgba(20, 36, 26, 0.75)',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.largo.map((o) => (
                          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'rgba(232,194,144,0.85)', marginBottom: 3 }}>
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
                          background: 'rgba(20, 36, 26, 0.75)',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.densidad.map((o) => (
                          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'rgba(232,194,144,0.85)', marginBottom: 3 }}>
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
                          background: 'rgba(20, 36, 26, 0.75)',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.estado.map((o) => (
                          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'rgba(232,194,144,0.85)', marginBottom: 3 }}>
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
                          background: 'rgba(20, 36, 26, 0.75)',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      >
                        {CATALOGO_VARIABLES.canas.map((o) => (
                          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tarjetas de resultado del simulador */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(232,194,144,0.85)' }}>
                        PRECIO AL PÚBLICO
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                        {formatearPrecioCop(simulacion.resPrecio.precioCalculado)}
                      </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(232,194,144,0.85)' }}>
                        COSTO DE PRODUCTO
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                        {formatearPrecioCop(simulacion.resCosto.costoTotal)}
                      </div>
                      {usaFormulaColor && (
                        <div style={{ fontSize: 10.5, color: 'rgba(245,237,220,0.75)', marginTop: 2 }}>
                          {simulacion.resCosto.gramosTinte}g tinte ·{' '}
                          {simulacion.resCosto.mlOxidanteRedondeado}ml ox.
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(232,194,144,0.85)' }}>
                        COMISIÓN ESTILISTA
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                        {formatearPrecioCop(simulacion.resComision.comision)}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: simulacion.resComision.alertaMargenBajo
                          ? 'rgba(180, 60, 60, 0.35)'
                          : 'rgba(232, 194, 144, 0.18)',
                        border: simulacion.resComision.alertaMargenBajo
                          ? '1px solid rgba(255, 160, 160, 0.45)'
                          : '1px solid rgba(232, 194, 144, 0.35)',
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: '#E8C290' }}>
                        QUEDA AL SALÓN
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                        {formatearPrecioCop(simulacion.resComision.margenSalon)}{' '}
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
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
                        background: '#FFF8EB',
                        color: '#7A4304',
                        fontSize: 12,
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                        <AlertTriangle size={14} /> Alerta de margen bajo (&lt; 20 %)
                      </div>
                      {Number.isFinite(simulacion.resComision.precioSugeridoProteccion) && (
                        <div>
                          • Para proteger un margen mínimo del 20 %, el precio sugerido es{' '}
                          <strong>{formatearPrecioCop(simulacion.resComision.precioSugeridoProteccion)}</strong>.
                        </div>
                      )}
                      <div>
                        • O si liquidas la comisión descontando primero el producto, al salón le quedarían{' '}
                        <strong>
                          {formatearPrecioCop(simulacion.resComision.margenConComisionNeta)}
                        </strong>.
                      </div>
                    </div>
                  )}

                  {simulacion.avisos.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11.5, color: '#E8C290' }}>
                      {simulacion.avisos.map((a) => a.mensaje).join(' · ')}
                    </div>
                  )}
                </section>

                {/* CONSUMO Y FACTORES MULTIPLICATIVOS POR SERVICIO */}
                {servicioActual && (
                  <section className="v-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Sliders size={16} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18 }}>
                        Consumo de producto · {servicioActual.nombre}
                      </h3>
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={usaFormulaColor}
                        onChange={(e) => setUsaFormulaColor(e.target.checked)}
                      />
                      Este servicio consume tinte / decolorante + oxidante
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          GRAMOS BASE (g)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={gramosTinteBase}
                          onChange={(e) => setGramosTinteBase(Number(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          PROP. OXIDANTE (1:X)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={proporcionOxidante}
                          onChange={(e) => setProporcionOxidante(Number(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                          INSUMOS FIJOS ($)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={insumosFijos}
                          onChange={(e) => setInsumosFijos(Number(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                    </div>

                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={publicando}
                      onClick={handlePublicarPlantilla}
                    >
                      {publicando ? 'Publicando…' : 'Publicar consumo y plantilla'}
                    </Btn>
                  </section>
                )}

                {/* CATÁLOGO DE PRODUCTOS ($/g y $/ml automático) */}
                <section className="v-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Package size={16} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18 }}>
                      Productos de inventario ($/g y $/ml)
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={prodNombre}
                      onChange={(e) => setProdNombre(e.target.value)}
                      placeholder="Nombre (ej. Tubo tinte 60g, Oxidante 20 vol)"
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
                      placeholder="Marca (opcional)"
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
                      <option value="oxidante">Oxidante</option>
                      <option value="decolorante">Decolorante</option>
                      <option value="matizador">Matizador</option>
                      <option value="tratamiento">Tratamiento</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginBottom: 10 }}>
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
                      placeholder="Cant. (ej. 60)"
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
                      placeholder="Costo presentación ($)"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12.5,
                        background: 'var(--bg)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Costo unitario calculado:{' '}
                      <strong>
                        {formatearPrecioCop(costoUnitarioPreview)} / {prodUnidad}
                      </strong>
                    </span>
                    <Btn size="sm" variant="primary" disabled={guardandoProd} onClick={handleAgregarProducto}>
                      Agregar producto
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
                              padding: '8px 10px',
                              borderRadius: 10,
                              background: 'var(--bg)',
                              fontSize: 12.5,
                            }}
                          >
                            <span>
                              <strong>{p.nombre}</strong>
                              {p.marca ? ` · ${p.marca}` : ''} ({p.presentacionCantidad}
                              {p.unidad})
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--primary)' }}>
                              {formatearPrecioCop(unitario)}/{p.unidad}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* ESTILISTAS DEL SALÓN */}
                <section className="v-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Users size={16} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18 }}>
                      Equipo de estilistas
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input
                      type="text"
                      value={nuevaEstilistaNombre}
                      onChange={(e) => setNuevaEstilistaNombre(e.target.value)}
                      placeholder="Nombre de la estilista…"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        background: 'var(--bg)',
                      }}
                    />
                    <Btn size="sm" variant="primary" disabled={guardandoEstilista} onClick={handleAgregarEstilista}>
                      Agregar
                    </Btn>
                  </div>

                  {estilistas.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {estilistas.map((e) => (
                        <Chip key={e.id} tone="green">
                          {e.nombre}
                        </Chip>
                      ))}
                    </div>
                  )}
                </section>

                {/* REGLAS DE COMISIÓN (Precedencia: estilista+servicio > estilista > servicio > salón) */}
                <section className="v-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Percent size={16} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18 }}>
                      Reglas de comisión
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    Precedencia automática: estilista + servicio &gt; estilista &gt; servicio &gt; regla general del salón.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <select
                      value={comEstilistaId}
                      onChange={(e) => setComEstilistaId(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="">Todas las estilistas (salón)</option>
                      {estilistas.map((e) => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                    <select
                      value={comServicioId}
                      onChange={(e) => setComServicioId(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="">Todos los servicios</option>
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginBottom: 10 }}>
                    <select
                      value={comTipo}
                      onChange={(e) => setComTipo(e.target.value as TipoComision)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="porcentaje">Porcentaje (%)</option>
                      <option value="fijo">Valor fijo ($)</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={comValor}
                      onChange={(e) => setComValor(e.target.value)}
                      placeholder="Ej. 40"
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
                        fontSize: 12,
                        background: 'var(--bg)',
                      }}
                    >
                      <option value="precio">Sobre precio cobrado</option>
                      <option value="precio_menos_producto">Neto (precio menos producto)</option>
                    </select>
                  </div>

                  <Btn size="sm" variant="primary" disabled={guardandoCom} onClick={handleAgregarComision}>
                    Guardar regla de comisión
                  </Btn>

                  {comisiones.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                      {comisiones.map((c) => {
                        const nomEst = estilistas.find((e) => e.id === c.estilistaId)?.nombre ?? 'Todas las estilistas';
                        const nomSrv = servicios.find((s) => s.id === c.servicioId)?.nombre ?? 'Todos los servicios';
                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 10px',
                              borderRadius: 10,
                              background: 'var(--bg)',
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <strong>{nomEst}</strong> · {nomSrv} →{' '}
                              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                {c.tipo === 'porcentaje' ? `${c.valor}%` : formatearPrecioCop(c.valor)}
                              </span>{' '}
                              ({c.base === 'precio_menos_producto' ? 'neto de producto' : 'sobre cobrado'})
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEliminarComision(c.id)}
                              aria-label="Cerrar regla"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#8E2D2D',
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
              </div>
            )}
          </>
        )}
      </main>

      <BottomNavV2 />
    </div>
  );
}
