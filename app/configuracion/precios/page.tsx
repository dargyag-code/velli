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
import { Btn, VelvetTopHeader } from '@/components/v2';
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
  type ReglaComision,
} from '@/lib/cotizador';
import {
  obtenerSemillaServicio,
  AJUSTES_VELVET_STUDIO_DEFECTO,
  normalizarAjustesVelvetStudio,
} from '@/lib/semilla-financiera';
import { REGLA_COMISION_SALUDABLE_DEFECTO } from '@/lib/comision';
import { createClient } from '@/lib/supabase/client';
import type { VerticalSalon } from '@/lib/flags/verticales';
import { obtenerContextoOrganizacionActivaCliente } from '@/lib/organizations';
import { normalizarTextoBusqueda } from '@/lib/catalogos/catalogoMaestroColombia';
import {
  inferirCodigoCiudadColombia,
  validarTerminosRestringidosColombia,
  type CodigoCiudadColombia,
  type SegmentoMercadoColombia,
} from '@/lib/catalogos/referenciasMercadoColombia';
import SelectorCatalogoColombia, {
  type ItemCatalogoSeleccionado,
} from '@/components/catalogos/SelectorCatalogoColombia';
import TarjetaGuiaMedicionVertical from '@/components/datos/TarjetaGuiaMedicionVertical';

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

const TIPOS_PRODUCTO: Array<{ valor: TipoProductoSalon; etiqueta: string }> = [
  { valor: 'tinte', etiqueta: 'Tinte' },
  { valor: 'oxidante', etiqueta: 'Oxidante / Revelador' },
  { valor: 'decolorante', etiqueta: 'Decolorante' },
  { valor: 'matizador', etiqueta: 'Matizador / Toner' },
  { valor: 'tratamiento', etiqueta: 'Tratamiento / Plex' },
  { valor: 'otro', etiqueta: 'Otro insumo' },
];

const OPCIONES_REDONDEO: Array<{ valor: number; etiqueta: string }> = [
  { valor: 1000, etiqueta: '$1.000' },
  { valor: 500, etiqueta: '$500' },
  { valor: 100, etiqueta: '$100' },
  { valor: 1, etiqueta: 'Exacto' },
];

export default function ConfiguracionPreciosPage() {
  const router = useRouter();
  const [pestana, setPestana] = useState<PestanaPrecios>('servicios');
  const [cargando, setCargando] = useState(true);
  const [, setSub] = useState<SuscripcionEfectiva | null>(null);

  // Datos del salón
  const [servicios, setServicios] = useState<ServicioSalon[]>([]);
  const [plantillasMap, setPlantillasMap] = useState<Record<string, PlantillaPrecio>>({});
  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);
  const [productos, setProductos] = useState<ProductoSalon[]>([]);
  const [comisiones, setComisiones] = useState<ComisionSalon[]>([]);

  // Servicio activo en el editor
  const [servicioId, setServicioId] = useState<string>('');
  const [creandoServicio, setCreandoServicio] = useState(false);
  const [importandoCatalogo, setImportandoCatalogo] = useState(false);
  const [guardandoImportacion, setGuardandoImportacion] = useState(false);
  const [verticalOrg, setVerticalOrg] = useState<VerticalSalon>('hair_studio');
  const [cityCodeCatalogo, setCityCodeCatalogo] = useState<CodigoCiudadColombia>('BOG');
  const [segmentoCatalogo, setSegmentoCatalogo] = useState<SegmentoMercadoColombia>('estandar');
  const [errorRestriccionServicio, setErrorRestriccionServicio] = useState<string | null>(null);
  const [errorRestriccionProd, setErrorRestriccionProd] = useState<string | null>(null);
  const [nuevoServicioNombre, setNuevoServicioNombre] = useState('');
  const [nuevoServicioCategoria, setNuevoServicioCategoria] =
    useState<CategoriaServicioDB>('tratamiento');

  // Estado editable del servicio activo (publica automáticamente versión interna al guardar)
  const [precioBase, setPrecioBase] = useState<number>(120000);
  const [redondeo, setRedondeo] = useState<number>(1000);
  const [vigenciaDias, setVigenciaDias] = useState<number>(15);
  const [variablesActivas, setVariablesActivas] = useState<ClaveVariable[]>([
    'largo',
    'densidad',
    'estado',
    'canas',
  ]);
  const [usaFormulaColor, setUsaFormulaColor] = useState<boolean>(false);
  const [ajustesEdit, setAjustesEdit] = useState<AjustesPlantilla>({});
  const [guardandoServicio, setGuardandoServicio] = useState(false);

  // Consumo químico del servicio activo
  const [gramosTinteBase, setGramosTinteBase] = useState<number>(60);
  const [proporcionOxidante, setProporcionOxidante] = useState<number>(1.5);
  const [insumosFijos, setInsumosFijos] = useState<number>(9500);
  const [factoresConsumo, setFactoresConsumo] =
    useState<FactoresConsumoPlantilla>(FACTORES_CONSUMO_DEFECTO);

  // Formulario rápido de Especialista
  const [nuevaEstilistaNombre, setNuevaEstilistaNombre] = useState('');
  const [guardandoEstilista, setGuardandoEstilista] = useState(false);

  // Formulario rápido de Producto Químico
  const [prodNombre, setProdNombre] = useState('');
  const [prodMarca, setProdMarca] = useState('');
  const [prodTipo, setProdTipo] = useState<TipoProductoSalon>('tinte');
  const [prodUnidad, setProdUnidad] = useState<'g' | 'ml' | 'unidad'>('g');
  const [prodCantidad, setProdCantidad] = useState<string>('60');
  const [prodCosto, setProdCosto] = useState<string>('27900');
  const [guardandoProd, setGuardandoProd] = useState(false);

  // Formulario de Regla de Comisión
  const [comEstilistaId, setComEstilistaId] = useState<string>('');
  const [comServicioId, setComServicioId] = useState<string>('');
  const [comTipo, setComTipo] = useState<TipoComision>('porcentaje');
  const [comValor, setComValor] = useState<string>('40');
  const [comBase, setComBase] = useState<BaseComision>('precio_menos_producto');
  const [guardandoCom, setGuardandoCom] = useState(false);

  // Simulador de Margen en vivo
  const [simLargo, setSimLargo] = useState<ValorLargo>('medio');
  const [simDensidad, setSimDensidad] = useState<ValorDensidad>('media');
  const [simEstado, setSimEstado] = useState<ValorEstadoFibra>('sana');
  const [simCanas, setSimCanas] = useState<ValorCanas>('0_25');
  const [simEstilistaId, setSimEstilistaId] = useState<string>('');
  const [simTinteId, setSimTinteId] = useState<string>('');
  const [simOxidanteId, setSimOxidanteId] = useState<string>('');

  // Todo salón activo en Veli tiene acceso completo
  // a Costos de Química y Liquidación de Especialistas (el candado Pro+IA se
  // reserva exclusivamente para el diagnóstico fotográfico con IA).
  const tienePlanPro = true;

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = createClient();
      const [prof, orgCtx, subEf, svcsIniciales, plantillas, ests, prods, coms] = await Promise.all([
        getProfile().catch(() => null),
        obtenerContextoOrganizacionActivaCliente(supabase).catch(() => null),
        getSuscripcionEfectiva().catch(() => null),
        listarServiciosSalon({ soloActivos: false }).catch(() => [] as ServicioSalon[]),
        listarPlantillasVigentes().catch(() => [] as PlantillaPrecio[]),
        listarEstilistas({ soloActivas: false }).catch(() => [] as EstilistaSalon[]),
        listarProductosSalon({ soloActivos: false }).catch(() => [] as ProductoSalon[]),
        listarComisionesVigentes().catch(() => [] as ComisionSalon[]),
      ]);

      if (orgCtx?.vertical) setVerticalOrg(orgCtx.vertical);
      setCityCodeCatalogo(inferirCodigoCiudadColombia(orgCtx?.city ?? prof?.ciudad));
      setSub(subEf);
      let svcs = svcsIniciales;
      if (svcs.length === 0) {
        await sembrarServiciosDesdeOnboarding(prof?.servicios ?? []).catch(
          () => [] as ServicioSalon[]
        );
        svcs = await listarServiciosSalon({ soloActivos: false }).catch(
          () => [] as ServicioSalon[]
        );
      }
      setServicios(svcs);

      let estsEfectivas = ests;
      let prodsEfectivos = prods;
      let comsEfectivas = coms;
      const sembrados = await sembrarBaseFinancieraSalon().catch(() => null);
      if (sembrados) {
        if (sembrados.productos.length > 0) prodsEfectivos = sembrados.productos;
        if (sembrados.estilistas.length > 0) estsEfectivas = sembrados.estilistas;
        if (sembrados.comisiones.length > 0) comsEfectivas = sembrados.comisiones;
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
    const semilla = obtenerSemillaServicio(servicioActual);
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

    const prodMatch = productos.find((p) => {
      if (semilla.slug === 'balayage') return p.tipo === 'decolorante';
      if (semilla.slug === 'tinte-global') return p.tipo === 'tinte';
      if (semilla.slug === 'alisado-organico') return p.unidad === 'ml' && p.tipo === 'tratamiento';
      if (semilla.slug === 'hidratacion') return p.unidad === 'g' && p.tipo === 'tratamiento';
      return false;
    });
    if (prodMatch) {
      setSimTinteId(prodMatch.id);
    }

    const plant = plantillasMap[servicioActual.id];
    if (plant) {
      const precioPlantilla =
        (semilla.slug === 'balayage' || semilla.slug === 'hidratacion') &&
        plant.precioBase === 120000
          ? semilla.tarifaBaseCop
          : plant.precioBase || semilla.tarifaBaseCop;
      setPrecioBase(precioPlantilla);
      setRedondeo(plant.redondeo || 1000);
      setVigenciaDias(plant.vigenciaDias || 15);
      setAjustesEdit(normalizarAjustesVelvetStudio(plant.ajustes));
      const cons = (plant.consumo ?? {}) as ConsumoPlantillaInput;
      const gramosNorm =
        semilla.slug === 'balayage' && cons.gramosTinteBase === 90
          ? semilla.gramosBase
          : semilla.slug === 'hidratacion' && (!cons.gramosTinteBase || cons.gramosTinteBase === 60)
            ? semilla.gramosBase
            : cons.gramosTinteBase ?? semilla.gramosBase;
      setGramosTinteBase(gramosNorm);
      const propNorm =
        semilla.ratioPeroxido === 0
          ? 0
          : semilla.slug === 'tinte-global' && cons.proporcionOxidante === 1.5
            ? semilla.ratioPeroxido
            : typeof cons.proporcionOxidante === 'number'
              ? cons.proporcionOxidante
              : semilla.ratioPeroxido;
      setProporcionOxidante(propNorm);
      setInsumosFijos(Math.max(semilla.insumosFijosCop, cons.insumosFijos ?? 0));
      setFactoresConsumo({
        largo: { ...FACTORES_CONSUMO_DEFECTO.largo, ...(cons.factores?.largo ?? {}) },
        densidad: {
          ...FACTORES_CONSUMO_DEFECTO.densidad,
          ...(cons.factores?.densidad ?? {}),
        },
        canas: { ...FACTORES_CONSUMO_DEFECTO.canas, ...(cons.factores?.canas ?? {}) },
      });
    } else {
      setPrecioBase(semilla.tarifaBaseCop);
      setRedondeo(1000);
      setVigenciaDias(15);
      setAjustesEdit(normalizarAjustesVelvetStudio(undefined));
      setGramosTinteBase(semilla.gramosBase);
      setProporcionOxidante(semilla.ratioPeroxido);
      setInsumosFijos(semilla.insumosFijosCop);
      setFactoresConsumo(FACTORES_CONSUMO_DEFECTO);
    }
  }, [servicioActual, plantillasMap, productos]);

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
    const validacion = validarTerminosRestringidosColombia(nuevoServicioNombre);
    if (!validacion.permitido) {
      setErrorRestriccionServicio(validacion.orientacionPreventiva);
      showToast('Nombre bloqueado por lineamiento sanitario preventivo', 'error');
      return;
    }
    setErrorRestriccionServicio(null);
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

  const handleImportarDesdeCatalogo = async (items: ItemCatalogoSeleccionado[]) => {
    if (items.length === 0) return;
    setGuardandoImportacion(true);
    try {
      const nombresActuales = new Set(servicios.map((s) => normalizarTextoBusqueda(s.nombre)));
      const aCrear = items.filter((it) => !nombresActuales.has(normalizarTextoBusqueda(it.nombre)));
      if (aCrear.length === 0) {
        showToast('Todos los servicios seleccionados ya existen en tu menú.', 'info');
        return;
      }

      const nuevosServicios: ServicioSalon[] = [];
      const nuevasPlantillas: Record<string, PlantillaPrecio> = {};

      for (let i = 0; i < aCrear.length; i++) {
        const item = aCrear[i];
        const creado = await crearServicioSalon({
          nombre: item.nombre,
          categoria: item.categoriaDb,
          usaFormulaColor: item.usaSinBascula,
          duracionMinutos: item.duracionMin,
          orden: servicios.length + i,
          activo: true,
          perfilExtendido: {
            marketProcedureId: item.esPersonalizado ? null : item.id,
            costTrackingMode: item.costTrackingMode,
            unidadBase: item.unidadBase,
            esPrecioDesde: item.esPrecioDesde,
            cicloRetornoDias: item.cicloRetornoDias,
          },
        });
        const semillaSrv = obtenerSemillaServicio(creado);
        const usaOx =
          item.unidadBase === 'ml'
            ? 0
            : item.categoriaDb === 'decoloracion'
              ? 1.5
              : item.categoriaDb === 'color'
                ? 1.0
                : 0;

        await publicarPlantillaPrecio({
          servicioId: creado.id,
          precioBase: Math.max(5000, Math.round(item.precioBaseCop)),
          ajustes: AJUSTES_VELVET_STUDIO_DEFECTO,
          consumo: {
            usaFormulaColor: item.usaSinBascula,
            gramosTinteBase:
              item.gramosBase && item.gramosBase > 0 ? item.gramosBase : semillaSrv.gramosBase,
            unidadBase: item.unidadBase ?? 'g',
            factores: FACTORES_CONSUMO_DEFECTO,
            proporcionOxidante: usaOx,
            insumosFijos: semillaSrv.insumosFijosCop,
          },
          redondeo: 1000,
          vigenciaDias: 15,
        });
        const vigente = await obtenerPlantillaVigente(creado.id);
        if (vigente) nuevasPlantillas[creado.id] = vigente;
        nuevosServicios.push(creado);
      }

      setServicios((prev) => [...prev, ...nuevosServicios]);
      setPlantillasMap((prev) => ({ ...prev, ...nuevasPlantillas }));
      if (nuevosServicios[0]) setServicioId(nuevosServicios[0].id);
      setImportandoCatalogo(false);
      showToast(
        `${nuevosServicios.length} servicio(s) agregados sin modificar tus tarifas existentes`,
        'success'
      );
    } catch (err) {
      console.error('[precios.importarCatalogo]', err);
      showToast('No se pudieron importar todos los servicios', 'error');
    } finally {
      setGuardandoImportacion(false);
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
    const validacionProd = validarTerminosRestringidosColombia(
      `${prodNombre} ${prodMarca}`
    );
    if (!validacionProd.permitido) {
      setErrorRestriccionProd(validacionProd.orientacionPreventiva);
      showToast('Insumo bloqueado por lineamiento sanitario preventivo', 'error');
      return;
    }
    setErrorRestriccionProd(null);
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

  const reglasComisionEfectivas: readonly ReglaComision[] = useMemo(
    () =>
      comisiones.length > 0
        ? comisiones.map((r) =>
            r.estilistaId === null &&
            r.servicioId === null &&
            r.tipo === 'porcentaje' &&
            (r.valor === 35 || (r.valor === 40 && r.base === 'precio'))
              ? { ...r, valor: 40, base: 'precio_menos_producto' as const }
              : r
          )
        : [REGLA_COMISION_SALUDABLE_DEFECTO],
    [comisiones]
  );

  // ── Simulador de Margen en vivo (usa funciones puras de lib/cotizador) ───
  const simulacion = useMemo(() => {
    const semillaSim = obtenerSemillaServicio(servicioActual);

    const resPrecio = calcularPrecioCotizacion(
      {
        precioBase: precioBase || semillaSim.tarifaBaseCop,
        ajustes: normalizarAjustesVelvetStudio(ajustesEdit),
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

    const prodTinteReal =
      productos.find((p) => {
        if (semillaSim.slug === 'balayage') return p.tipo === 'decolorante';
        if (semillaSim.slug === 'tinte-global') return p.tipo === 'tinte';
        if (semillaSim.slug === 'alisado-organico') return p.unidad === 'ml' && p.tipo === 'tratamiento';
        if (semillaSim.slug === 'hidratacion') return p.unidad === 'g' && p.tipo === 'tratamiento';
        return p.id === simTinteId;
      }) ??
      productos.find((p) => p.id === simTinteId) ??
      productos.find((p) => p.unidad === 'g');

    const prodOxReal =
      productos.find(
        (p) =>
          p.tipo === 'oxidante' &&
          p.unidad === 'ml' &&
          !(p.presentacionCantidad === 1000 && p.precioCompra === 95_000)
      ) ??
      productos.find((p) => p.id === simOxidanteId) ??
      productos.find((p) => p.unidad === 'ml');

    const prodTinteUsado = prodTinteReal ?? {
      nombre: semillaSim.nombre,
      precioUnitario: semillaSim.costoGramoBaseCop,
    };

    const usaOx = (proporcionOxidante ?? semillaSim.ratioPeroxido) > 0 && semillaSim.ratioPeroxido > 0;
    const prodOxUsado = usaOx
      ? prodOxReal ?? {
          nombre: 'Loción Activadora / Peróxido 10V-20V-30V (Botella 1 Litro)',
          precioUnitario: semillaSim.costoMlPeroxidoCop,
        }
      : { nombre: 'Sin peróxido', precioUnitario: 0 };

    const gramosEfectivos = gramosTinteBase > 0 ? gramosTinteBase : semillaSim.gramosBase;
    const insumosEfectivos = Math.max(semillaSim.insumosFijosCop, insumosFijos);

    const resCosto = calcularCostoProducto({
      variables: {
        largo: simLargo,
        densidad: simDensidad,
        canas: simCanas,
      },
      consumo: {
        usaFormulaColor: true,
        gramosTinteBase: gramosEfectivos,
        proporcionOxidante: usaOx ? proporcionOxidante || semillaSim.ratioPeroxido : 0,
        insumosFijos: insumosEfectivos,
        factores: factoresConsumo,
      },
      ...(!usaFormulaColor
        ? {
            formulaFinal: {
              componentes: [
                {
                  descripcion: semillaSim.nombre,
                  gramos: gramosEfectivos,
                },
              ],
              proporcion: 0,
            },
            aplicarFactoresAFormula: false,
          }
        : {}),
      productoTinte: prodTinteUsado,
      productoOxidante: prodOxUsado,
    });

    const resComision = calcularComisionYMargen({
      precio: resPrecio.precioCalculado,
      costoProducto: resCosto.costoTotal,
      reglas: reglasComisionEfectivas,
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
      usaOx,
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
    reglasComisionEfectivas,
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
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans pb-36 lg:pb-12">
      <VelvetTopHeader />
      {/* Sub-cabecera ejecutiva */}
      <div className="border-b border-[#E4E4E7] px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => router.push('/configuracion')}
            aria-label="Volver a Configuración"
            className="min-w-[44px] min-h-[44px] rounded-full bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(59,13,30,0.05)] cursor-pointer shrink-0 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
              Veli · Calibración del Salón
            </span>
            <h1 className="m-0 mt-0.5 font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#111111] leading-tight truncate">
              Servicios, catálogo químico y comisiones
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Segmented Control de las 3 Pestañas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-white border border-[#E4E4E7] ">
          <button
            type="button"
            onClick={() => setPestana('servicios')}
            className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
              pestana === 'servicios'
                ? 'bg-[#111111] text-white shadow-[0_6px_16px_-4px_rgba(59,13,30,0.22)]'
                : 'bg-transparent text-[#52525B] hover:bg-[#FAFAFA] hover:text-[#111111]'
            }`}
          >
            1. Servicios y Tarifas
          </button>

          <button
            type="button"
            onClick={() => setPestana('quimica')}
            className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none inline-flex items-center justify-center gap-1.5 ${
              pestana === 'quimica'
                ? 'bg-[#111111] text-white shadow-[0_6px_16px_-4px_rgba(59,13,30,0.22)]'
                : 'bg-transparent text-[#52525B] hover:bg-[#FAFAFA] hover:text-[#111111]'
            }`}
          >
            <span>2. Catálogo Químico ($/g y $/ml)</span>
            {!tienePlanPro && <Lock size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setPestana('comisiones')}
            className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none inline-flex items-center justify-center gap-1.5 ${
              pestana === 'comisiones'
                ? 'bg-[#111111] text-white shadow-[0_6px_16px_-4px_rgba(59,13,30,0.22)]'
                : 'bg-transparent text-[#52525B] hover:bg-[#FAFAFA] hover:text-[#111111]'
            }`}
          >
            <span>3. Equipo y Comisiones</span>
            {!tienePlanPro && <Lock size={12} />}
          </button>
        </div>

        {/* Guía educativa colapsable/descartable adaptada a la vertical */}
        <TarjetaGuiaMedicionVertical vertical={verticalOrg} />

        {/* Selector horizontal de servicio activo (visible en Pestaña 1 y 2) */}
        {(pestana === 'servicios' || pestana === 'quimica') && (
          <section className="bg-white rounded-xl border border-[#E4E4E7] p-5  space-y-3.5">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
                Servicios de tu estudio
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportandoCatalogo((v) => !v);
                    setCreandoServicio(false);
                  }}
                  className="min-h-[40px] px-3.5 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles size={13} /> Importar desde Catálogo Colombia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreandoServicio((v) => !v);
                    setImportandoCatalogo(false);
                  }}
                  className="min-h-[40px] px-3.5 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7]/60 border border-[#E4E4E7] text-[#111111] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus size={14} /> Nuevo servicio
                </button>
              </div>
            </div>

            {importandoCatalogo && (
              <SelectorCatalogoColombia
                modo="importacion"
                vertical={verticalOrg}
                onChangeVertical={setVerticalOrg}
                cityCode={cityCodeCatalogo}
                onChangeCityCode={setCityCodeCatalogo}
                segmento={segmentoCatalogo}
                onChangeSegmento={setSegmentoCatalogo}
                nombresYaExistentes={servicios.map((s) => s.nombre)}
                onConfirmImport={handleImportarDesdeCatalogo}
                importando={guardandoImportacion}
              />
            )}

            {creandoServicio && (
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-3">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Nombre del servicio
                  </label>
                  <input
                    type="text"
                    value={nuevoServicioNombre}
                    onChange={(e) => setNuevoServicioNombre(e.target.value)}
                    placeholder="Ej. Balayage Alta Precisión, Hidratación profunda…"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-white text-sm text-[#111111] placeholder-[#71717A]"
                  />
                </div>
                <div>
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Categoría técnica
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS_SERVICIO.map((cat) => {
                      const active = nuevoServicioCategoria === cat.valor;
                      return (
                        <button
                          key={cat.valor}
                          type="button"
                          onClick={() => setNuevoServicioCategoria(cat.valor)}
                          className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#111111] text-white border-[#111111]'
                              : 'bg-white text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                          }`}
                        >
                          {cat.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Btn size="md" variant="primary" onClick={handleCrearServicio}>
                    Agregar servicio
                  </Btn>
                  <Btn size="md" variant="outline" onClick={() => setCreandoServicio(false)}>
                    Cancelar
                  </Btn>
                </div>
                {errorRestriccionServicio && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#DC2626]"
                  >
                    {errorRestriccionServicio}
                  </div>
                )}
              </div>
            )}

            {cargando ? (
              <div className="skeleton-shimmer h-12 rounded-xl" />
            ) : (
              <div className="flex gap-2 flex-wrap">
                {servicios.map((srv) => {
                  const activo = srv.id === servicioId;
                  const plant = plantillasMap[srv.id];
                  const semillaSrv = obtenerSemillaServicio(srv);
                  const tarifaChip =
                    plant &&
                    !(
                      (semillaSrv.slug === 'balayage' || semillaSrv.slug === 'hidratacion') &&
                      plant.precioBase === 120000
                    )
                      ? plant.precioBase
                      : semillaSrv.tarifaBaseCop;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setServicioId(srv.id)}
                      className={`min-h-[46px] px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        activo
                          ? 'bg-[#111111] text-white border-[#111111] shadow-[0_6px_16px_-4px_rgba(59,13,30,0.2)]'
                          : 'bg-[#FAFAFA] text-[#111111] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:border-[#E4E4E7]'
                      }`}
                    >
                      <span className="capitalize">{srv.nombre}</span>
                      <span
                        className={`tabular-nums text-[11px] font-semibold ${
                          activo ? 'text-[#E4E4E7]' : 'text-[#52525B]'
                        }`}
                      >
                        · {formatearPrecioCop(tarifaChip)}
                      </span>
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
          <div className="space-y-5">
            <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-5">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
                    Tarifa y reglas de cobro
                  </span>
                  <h2 className="m-0 mt-0.5 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
                    {servicioActual.nombre}
                  </h2>
                </div>
                {plantillasMap[servicioActual.id] && (
                  <span className="px-3 py-1 rounded-full bg-[#F0FDF4] border border-[#15803D]/25 text-[#15803D] text-xs font-bold">
                    Tarifa activa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Precio base ($ COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={precioBase}
                    onChange={(e) => setPrecioBase(Number(e.target.value) || 0)}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-base font-bold text-[#111111] tabular-nums"
                  />
                </div>

                <div>
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Redondeo comercial
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {OPCIONES_REDONDEO.map((op) => {
                      const active = redondeo === op.valor;
                      return (
                        <button
                          key={op.valor}
                          type="button"
                          onClick={() => setRedondeo(op.valor)}
                          className={`min-h-[48px] px-2 rounded-xl text-xs font-bold tabular-nums border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#F4F4F5] text-[#111111] border-[#E4E4E7]'
                              : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:text-[#111111]'
                          }`}
                        >
                          {op.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Vigencia de cotización (días)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={vigenciaDias}
                    onChange={(e) => setVigenciaDias(Math.max(1, Number(e.target.value) || 15))}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-base font-bold text-[#111111] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-2">
                  Factores capilares que ajustan el precio en silla
                </span>
                <div className="flex gap-2 flex-wrap">
                  {ORDEN_VARIABLES.map((clave) => {
                    const activa = variablesActivas.includes(clave);
                    return (
                      <button
                        key={clave}
                        type="button"
                        onClick={() => toggleVariableActiva(clave)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          activa
                            ? 'bg-[#F4F4F5] text-[#111111] border-[#111111]'
                            : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:border-[#E4E4E7] hover:text-[#111111]'
                        }`}
                      >
                        {activa ? '✓ ' : '+ '}
                        {ETIQUETAS_VARIABLE[clave]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ajustes por opción para cada variable activa */}
              <div className="space-y-3.5">
                {ORDEN_VARIABLES.filter((c) => variablesActivas.includes(c)).map((clave) => {
                  const opciones = CATALOGO_VARIABLES[clave];
                  const grupo = (ajustesEdit[clave] ?? {}) as Record<
                    string,
                    AjusteValorVariable | undefined
                  >;
                  return (
                    <div
                      key={clave}
                      className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-3"
                    >
                      <h3 className="m-0 font-sans text-sm font-bold text-[#111111]">
                        {ETIQUETAS_VARIABLE[clave]}
                      </h3>
                      <div className="space-y-2.5">
                        {opciones.map((op) => {
                          const aj = grupo[op.valor] ?? { suma: 0, porcentaje: 0 };
                          return (
                            <div
                              key={op.valor}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-white p-3 rounded-xl border border-[#E4E4E7]"
                            >
                              <div className="sm:col-span-5">
                                <div className="text-xs font-bold text-[#111111]">
                                  {op.etiqueta}
                                </div>
                                <div className="text-[11px] text-[#71717A]">{op.guia}</div>
                              </div>
                              <div className="sm:col-span-4">
                                <label className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1">
                                  + Suma ($ COP)
                                </label>
                                <input
                                  type="number"
                                  step={1000}
                                  value={aj.suma ?? 0}
                                  onChange={(e) =>
                                    cambiarAjusteOpcion(clave, op.valor, 'suma', e.target.value)
                                  }
                                  className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-xs font-bold text-[#111111] text-right tabular-nums"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1">
                                  + Porcentaje (%)
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
                                  className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-xs font-bold text-[#111111] text-right tabular-nums"
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

              <div className="pt-2">
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
          <div className="space-y-5">
            {/* Consumo químico calibrado por servicio */}
            {servicioActual && (
              <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center shrink-0">
                    <Sliders size={17} className="text-[#111111]" />
                  </div>
                  <div>
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] block">
                      Fórmula sin báscula por servicio
                    </span>
                    <h2 className="m-0 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
                      Consumo base · {servicioActual.nombre}
                    </h2>
                  </div>
                </div>

                <label className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center gap-3 text-xs font-bold text-[#111111] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usaFormulaColor}
                    onChange={(e) => setUsaFormulaColor(e.target.checked)}
                    className="w-5 h-5 accent-[#111111] cursor-pointer"
                  />
                  <span>Este servicio consume tinte / decolorante + oxidante</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                      Gramos base (g)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={gramosTinteBase}
                      onChange={(e) => setGramosTinteBase(Number(e.target.value) || 0)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white font-mono text-sm font-bold text-[#111111] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                      Prop. oxidante (1:X)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={proporcionOxidante}
                      onChange={(e) => setProporcionOxidante(Number(e.target.value) || 0)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white font-mono text-sm font-bold text-[#111111] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                      Insumos fijos (aluminio, guantes · $)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={insumosFijos}
                      onChange={(e) => setInsumosFijos(Number(e.target.value) || 0)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-sm font-bold text-[#111111] tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <Btn
                    size="md"
                    variant="primary"
                    disabled={guardandoServicio}
                    onClick={handleGuardarServicio}
                  >
                    {guardandoServicio
                      ? 'Guardando…'
                      : `Guardar consumo de ${servicioActual.nombre}`}
                  </Btn>
                </div>
              </section>
            )}

            {/* Catálogo de insumos químicos ($/g y $/ml automático) */}
            <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center shrink-0">
                  <Package size={17} className="text-[#111111]" />
                </div>
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] block">
                    Catálogo de laboratorio
                  </span>
                  <h2 className="m-0 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
                    Catálogo Químico ($/g y $/ml)
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Nombre del insumo
                  </label>
                  <input
                    type="text"
                    value={prodNombre}
                    onChange={(e) => setProdNombre(e.target.value)}
                    placeholder="Ej. Tubo tinte 60g, Oxidante 20 vol"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-sm text-[#111111] placeholder-[#71717A]"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Marca comercial
                  </label>
                  <input
                    type="text"
                    value={prodMarca}
                    onChange={(e) => setProdMarca(e.target.value)}
                    placeholder="Ej. Wella, Schwarzkopf, Alfaparf"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-sm text-[#111111] placeholder-[#71717A]"
                  />
                </div>
              </div>

              <div>
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                  Tipo de producto químico
                </span>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_PRODUCTO.map((t) => {
                    const active = prodTipo === t.valor;
                    return (
                      <button
                        key={t.valor}
                        type="button"
                        onClick={() => setProdTipo(t.valor)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                        }`}
                      >
                        {t.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Unidad de medida
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { v: 'g', label: 'g' },
                        { v: 'ml', label: 'ml' },
                        { v: 'unidad', label: 'Und.' },
                      ] as const
                    ).map(({ v, label }) => {
                      const active = prodUnidad === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setProdUnidad(v)}
                          className={`min-h-[46px] rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#F4F4F5] text-[#111111] border-[#111111]'
                              : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:text-[#111111]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Presentación ({prodUnidad})
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={prodCantidad}
                    onChange={(e) => setProdCantidad(e.target.value)}
                    placeholder="Ej. 60"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white font-mono text-sm font-bold text-[#111111] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Costo envase ($ COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={prodCosto}
                    onChange={(e) => setProdCosto(e.target.value)}
                    placeholder="Ej. 28000"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-sm font-bold text-[#111111] tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-3 p-4 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7]">
                <span className="text-xs font-semibold text-[#52525B]">
                  Costo exacto calculado:{' '}
                  <strong className="font-mono text-sm font-bold text-[#111111] tabular-nums">
                    {formatearPrecioCop(costoUnitarioPreview)} / {prodUnidad}
                  </strong>
                </span>
                <Btn
                  size="md"
                  variant="primary"
                  disabled={guardandoProd}
                  onClick={handleAgregarProducto}
                >
                  Agregar insumo químico
                </Btn>
              </div>

              {errorRestriccionProd && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#DC2626]"
                >
                  {errorRestriccionProd}
                </div>
              )}

              {productos.length > 0 && (
                <div className="space-y-2 pt-1">
                  {productos.map((p) => {
                    const unitario = Math.round(calcularPrecioUnitarioProducto(p));
                    return (
                      <div
                        key={p.id}
                        className="flex justify-between items-center gap-3 p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7]"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#111111] truncate">
                            {p.nombre}
                            {p.marca ? (
                              <span className="font-normal text-[#52525B]"> · {p.marca}</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[#71717A] tabular-nums mt-0.5">
                            Presentación:{' '}
                            <span className="font-mono font-semibold">
                              {p.presentacionCantidad}
                              {p.unidad}
                            </span>{' '}
                            · Compra: {formatearPrecioCop(p.precioCompra)}
                          </div>
                        </div>
                        <span className="shrink-0 px-3 py-1 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] font-mono text-xs font-semibold tabular-nums">
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

        {/* ═══════════════════════════════════════════════════════════════════
            PESTAÑA 3: ESPECIALISTAS Y COMISIONES (+ SIMULADOR DE MARGEN)
           ═══════════════════════════════════════════════════════════════════ */}
        {pestana === 'comisiones' && (
          <div className="space-y-5">
            {/* EQUIPO DE ESPECIALISTAS */}
            <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center shrink-0">
                  <Users size={17} className="text-[#111111]" />
                </div>
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
                    Talento del salón
                  </span>
                  <h2 className="m-0 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
                    Equipo de especialistas
                  </h2>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={nuevaEstilistaNombre}
                  onChange={(e) => setNuevaEstilistaNombre(e.target.value)}
                  placeholder="Nombre de la especialista…"
                  className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-sm text-[#111111] placeholder-[#71717A]"
                />
                <Btn
                  size="md"
                  variant="primary"
                  disabled={guardandoEstilista}
                  onClick={handleAgregarEstilista}
                >
                  Agregar especialista
                </Btn>
              </div>

              {estilistas.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {estilistas.map((e) => (
                    <span
                      key={e.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-xs font-bold text-[#111111] capitalize"
                    >
                      {e.nombre}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-xs text-[#71717A]">
                  Agrega tus especialistas para liquidar comisiones automáticamente en Reportes BI.
                </p>
              )}
            </section>

            {/* REGLAS DE COMISIÓN */}
            <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center shrink-0">
                  <Percent size={17} className="text-[#111111]" />
                </div>
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
                    Esquema de nómina
                  </span>
                  <h2 className="m-0 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
                    Reglas de comisión
                  </h2>
                </div>
              </div>
              <p className="m-0 text-xs text-[#52525B] leading-relaxed">
                Prioridad automática: regla por especialista + servicio → por especialista → por servicio → regla general del salón.
              </p>

              {/* Alcance por especialista */}
              <div>
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                  Especialista aplicable
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setComEstilistaId('')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      comEstilistaId === ''
                        ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
                        : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                    }`}
                  >
                    Todas (regla general)
                  </button>
                  {estilistas.map((e) => {
                    const active = comEstilistaId === e.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setComEstilistaId(e.id)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
                            : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                        }`}
                      >
                        {e.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alcance por servicio */}
              <div>
                <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                  Servicio aplicable
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setComServicioId('')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      comServicioId === ''
                        ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
                        : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                    }`}
                  >
                    Todos los servicios
                  </button>
                  {servicios.map((s) => {
                    const active = comServicioId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setComServicioId(s.id)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
                            : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                        }`}
                      >
                        {s.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Modalidad
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { v: 'porcentaje', label: 'Porcentaje (%)' },
                        { v: 'fijo', label: 'Fijo ($ COP)' },
                      ] as const
                    ).map(({ v, label }) => {
                      const active = comTipo === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setComTipo(v)}
                          className={`min-h-[46px] px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
                              : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:text-[#111111]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Valor ({comTipo === 'porcentaje' ? '%' : '$ COP'})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={comValor}
                    onChange={(e) => setComValor(e.target.value)}
                    placeholder="Ej. 40"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] focus:bg-white text-sm font-bold text-[#111111] tabular-nums"
                  />
                </div>

                <div>
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                    Base de liquidación
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { v: 'precio', label: 'Sobre cobrado' },
                        { v: 'precio_menos_producto', label: 'Menos química' },
                      ] as const
                    ).map(({ v, label }) => {
                      const active = comBase === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setComBase(v)}
                          className={`min-h-[46px] px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
                              : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:text-[#111111]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <Btn
                  size="md"
                  variant="primary"
                  disabled={guardandoCom}
                  onClick={handleAgregarComision}
                >
                  Guardar regla de comisión
                </Btn>
              </div>

              {reglasComisionEfectivas.length > 0 && (
                <div className="space-y-2 pt-2">
                  {reglasComisionEfectivas.map((c) => {
                    const nomEst =
                      estilistas.find((e) => e.id === c.estilistaId)?.nombre ??
                      'Todas las especialistas';
                    const nomSrv =
                      servicios.find((s) => s.id === c.servicioId)?.nombre ?? 'Todos los servicios';
                    return (
                      <div
                        key={c.id ?? 'regla-general'}
                        className="flex justify-between items-center gap-3 p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-xs"
                      >
                        <div className="min-w-0">
                          <strong className="text-[#111111] capitalize">{nomEst}</strong>{' '}
                          <span className="text-[#52525B] capitalize">· {nomSrv} →</span>{' '}
                          <span className="font-bold text-[#111111] tabular-nums">
                            {c.tipo === 'porcentaje' ? `${c.valor}%` : formatearPrecioCop(c.valor)}
                          </span>{' '}
                          <span className="text-[#71717A]">
                            (
                            {c.base === 'precio_menos_producto'
                              ? 'Menos química'
                              : 'Sobre cobrado'}
                            )
                          </span>
                        </div>
                        {c.id && c.id !== 'regla-saludable-defecto' && (
                          <button
                            type="button"
                            onClick={() => handleEliminarComision(c.id!)}
                            aria-label="Eliminar regla"
                            className="min-w-[40px] min-h-[40px] rounded-xl bg-white hover:bg-[#FFFBEB] border border-[#E4E4E7] text-[#B45309] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SIMULADOR DE MARGEN EN VIVO */}
            <section className="v-gradient-hero rounded-xl p-5 sm:p-6 text-white shadow-[0_18px_44px_-10px_rgba(59,13,30,0.28)] space-y-4">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] block">
                    Simulador de Rentabilidad en Vivo
                  </span>
                  <h2 className="m-0 mt-0.5 font-display text-2xl font-semibold tracking-tight !text-white capitalize">
                    {servicioActual?.nombre ?? 'Servicio'}
                  </h2>
                </div>
                <div className="w-11 h-11 rounded-xl bg-white/10 border border-[#E4E4E7]/25 flex items-center justify-center shrink-0">
                  <Calculator size={20} className="text-[#E4E4E7]" />
                </div>
              </div>

              {/* Píldoras táctiles de servicio en el simulador */}
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-1.5">
                  Servicio a simular
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {servicios.map((s) => {
                    const active = servicioId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setServicioId(s.id)}
                        className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                          active
                            ? 'bg-[#E4E4E7] text-[#111111] border-[#E4E4E7]'
                            : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                        }`}
                      >
                        {s.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Píldoras de especialista en el simulador */}
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-1.5">
                  Especialista
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSimEstilistaId('')}
                    className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      simEstilistaId === ''
                        ? 'bg-[#E4E4E7] text-[#111111] border-[#E4E4E7]'
                        : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                    }`}
                  >
                    Regla general del salón
                  </button>
                  {estilistas.map((e) => {
                    const active = simEstilistaId === e.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSimEstilistaId(e.id)}
                        className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                          active
                            ? 'bg-[#E4E4E7] text-[#111111] border-[#E4E4E7]'
                            : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                        }`}
                      >
                        {e.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Píldoras capilares táctiles en el simulador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-1.5">
                    Largo
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATALOGO_VARIABLES.largo.map((o) => {
                      const active = simLargo === o.valor;
                      return (
                        <button
                          key={o.valor}
                          type="button"
                          onClick={() => setSimLargo(o.valor)}
                          className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#FAFAFA] text-[#111111] border-[#FAFAFA]'
                              : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                          }`}
                        >
                          {o.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-1.5">
                    Densidad
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATALOGO_VARIABLES.densidad.map((o) => {
                      const active = simDensidad === o.valor;
                      return (
                        <button
                          key={o.valor}
                          type="button"
                          onClick={() => setSimDensidad(o.valor)}
                          className={`min-h-[42px] px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#FAFAFA] text-[#111111] border-[#FAFAFA]'
                              : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                          }`}
                        >
                          {o.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-1.5">
                    Estado de la fibra
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATALOGO_VARIABLES.estado.map((o) => {
                      const active = simEstado === o.valor;
                      return (
                        <button
                          key={o.valor}
                          type="button"
                          onClick={() => setSimEstado(o.valor)}
                          className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#FAFAFA] text-[#111111] border-[#FAFAFA]'
                              : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                          }`}
                        >
                          {o.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-1.5">
                    Porcentaje de canas
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATALOGO_VARIABLES.canas.map((o) => {
                      const active = simCanas === o.valor;
                      return (
                        <button
                          key={o.valor}
                          type="button"
                          onClick={() => setSimCanas(o.valor)}
                          className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold tabular-nums border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#FAFAFA] text-[#111111] border-[#FAFAFA]'
                              : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                          }`}
                        >
                          {o.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tarjetas financieras del simulador */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
                  <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7]">
                    Precio al público
                  </div>
                  <div className="font-display text-xl md:text-2xl font-bold text-white tabular-nums tracking-tight mt-1">
                    {formatearPrecioCop(simulacion.resPrecio.precioCalculado)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
                  <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7]">
                    Química estimada
                  </div>
                  <div className="font-display text-xl md:text-2xl font-bold text-white tabular-nums tracking-tight mt-1">
                    {formatearPrecioCop(simulacion.resCosto.costoTotal)}
                  </div>
                  {simulacion.resCosto.gramosTinte > 0 && (
                    <div className="font-mono text-[11px] font-semibold text-[#E4E4E7] tabular-nums mt-1">
                      {simulacion.resCosto.gramosTinte}g
                      {simulacion.usaOx
                        ? ` · ${simulacion.resCosto.mlOxidanteRedondeado}ml`
                        : ` · +${formatearPrecioCop(simulacion.resCosto.insumosFijos)} insumos`}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15">
                  <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7]">
                    Comisión especialista
                  </div>
                  <div className="font-display text-xl md:text-2xl font-bold text-white tabular-nums tracking-tight mt-1">
                    {formatearPrecioCop(simulacion.resComision.comision)}
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    simulacion.resComision.alertaMargenBajo
                      ? 'bg-[#B45309]/25 border-[#B45309]/60'
                      : 'bg-[#15803D]/25 border-[#15803D]/60'
                  }`}
                >
                  <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                    Utilidad neta salón
                  </div>
                  <div className="font-display text-xl md:text-2xl font-bold text-white tabular-nums tracking-tight mt-1">
                    {formatearPrecioCop(simulacion.resComision.margenSalon)}
                  </div>
                  <div className="font-mono text-xs font-semibold text-white/90 tabular-nums mt-0.5">
                    Margen: {simulacion.resComision.margenPorcentaje}%
                  </div>
                </div>
              </div>

              {simulacion.resComision.alertaMargenBajo && (
                <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#B45309]/40 text-[#111111] text-xs leading-relaxed space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[#B45309]">
                    <AlertTriangle size={15} /> Margen neto inferior al 20%
                  </div>
                  {Number.isFinite(simulacion.resComision.precioSugeridoProteccion) && (
                    <div>
                      • Precio sugerido para proteger un margen mínimo del 20%:{' '}
                      <strong className="tabular-nums text-[#111111]">
                        {formatearPrecioCop(simulacion.resComision.precioSugeridoProteccion)}
                      </strong>
                      .
                    </div>
                  )}
                  <div>
                    • Si liquidas la comisión descontando primero la química, al salón le quedarían{' '}
                    <strong className="tabular-nums text-[#111111]">
                      {formatearPrecioCop(simulacion.resComision.margenConComisionNeta)}
                    </strong>
                    .
                  </div>
                </div>
              )}

              {simulacion.avisos.length > 0 && (
                <div className="text-xs text-[#E4E4E7] leading-relaxed">
                  {simulacion.avisos.map((a) => a.mensaje).join(' · ')}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
