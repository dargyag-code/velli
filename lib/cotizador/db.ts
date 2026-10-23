// ══════════════════════════════════════════════════════════════════════════
// Capa de acceso a datos del cotizador (docs/velli-bi/02-diseno-cotizador.md §1 y §4).
// Espeja el esquema de `supabase/borradores/velli-bi-cotizador.sql`.
//
// Si las tablas aún no existen en el entorno (código 42P01 / PGRST205), las
// lecturas devuelven arreglos vacíos o `null` sin tumbar la interfaz.
// ══════════════════════════════════════════════════════════════════════════

import { createClient as createSupabaseAnonClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { AjustesPlantilla } from './precio';
import type { VariablesCotizacion } from './variables';
import type { CostoDetalleInmutable } from './costo';
import type { BaseComision, ComisionDetalleInmutable, ReglaComision, TipoComision } from './comision';

// ── Tipos de dominio (camelCase) ───────────────────────────────────────────

export type CategoriaServicioDB =
  | 'color'
  | 'decoloracion'
  | 'tratamiento'
  | 'corte'
  | 'alisado'
  | 'rizos'
  | 'peinado'
  | 'cuero_cabelludo'
  | 'extensiones'
  | 'otro';

export type TipoProductoSalon =
  | 'tinte'
  | 'oxidante'
  | 'decolorante'
  | 'matizador'
  | 'tratamiento'
  | 'otro';

export type EstadoCotizacion = 'borrador' | 'enviada' | 'cobrada' | 'anulada';

export interface EstilistaSalon {
  id: string;
  userId: string;
  nombre: string;
  activo: boolean;
  perfilExtendido: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ServicioSalon {
  id: string;
  userId: string;
  nombre: string;
  categoria: CategoriaServicioDB;
  usaFormulaColor: boolean;
  duracionMinutos?: number;
  activo: boolean;
  orden: number;
  perfilExtendido: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlantillaPrecio {
  id: string;
  userId: string;
  servicioId: string;
  version: number;
  vigenteDesde: string;
  vigenteHasta?: string;
  precioBase: number;
  ajustes: AjustesPlantilla;
  consumo: Record<string, unknown>;
  redondeo: number;
  vigenciaDias: number;
  perfilExtendido: Record<string, unknown>;
  createdAt: string;
}

export interface ProductoSalon {
  id: string;
  userId: string;
  marcaId?: string;
  marca?: string;
  nombre: string;
  tipo: TipoProductoSalon;
  presentacionCantidad: number;
  unidad: 'g' | 'ml' | 'unidad';
  precioCompra: number;
  precioActualizadoAt: string;
  activo: boolean;
  perfilExtendido: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ComisionSalon extends ReglaComision {
  id: string;
  userId: string;
  vigenteDesde: string;
  createdAt: string;
}

export interface Cotizacion {
  id: string;
  userId: string;
  clientaId?: string;
  consultaId?: string;
  estilistaId?: string;
  servicioId?: string;
  plantillaId?: string;
  servicioColorId?: string;
  servicioNombre: string;
  estilistaNombre?: string;
  plantillaVersion?: number;
  variables: VariablesCotizacion;
  precioCalculado: number;
  precioCotizado: number;
  ajusteManualMotivo?: string;
  moneda: 'COP';
  vigenciaHasta: string;
  estado: EstadoCotizacion;
  enviadaAt?: string;
  precioCobrado?: number;
  cobradoAt?: string;
  diferenciaCobro?: number;
  formula?: Record<string, unknown>;
  costoProductoEstimado?: number;
  costoDetalle?: CostoDetalleInmutable;
  comisionEstimada?: number;
  comisionDetalle?: ComisionDetalleInmutable;
  conMarcaVelli: boolean;
  tokenPublico: string;
  perfilExtendido: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Lo único que devuelve la RPC `cotizacion_publica(p_token)` hacia afuera (§4). */
export interface CotizacionPublica {
  salon: string;
  colorSalon?: string;
  servicio: string;
  precio: number;
  moneda: string;
  vigenciaHasta: string;
  vigente: boolean;
  conMarcaVelli: boolean;
}

// ── Validación de UUID y helpers ───────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida que un string tenga formato UUID antes de consultar la base de datos. */
export function esUuidValido(valor: string | null | undefined): valor is string {
  if (typeof valor !== 'string') return false;
  return UUID_REGEX.test(valor.trim());
}

function esTablaInexistente(error: { code?: string } | null): boolean {
  if (!error?.code) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202';
}

function obtenerClienteAutenticado(client?: SupabaseClient): SupabaseClient {
  return client ?? (createBrowserSupabaseClient() as unknown as SupabaseClient);
}

function obtenerClienteAnonimo(client?: SupabaseClient): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no configuradas');
  }
  return createSupabaseAnonClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requerirUserId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  return user.id;
}

// ── Mappers snake_case ⇄ camelCase ─────────────────────────────────────────

function rowToEstilista(r: Record<string, unknown>): EstilistaSalon {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    nombre: String(r.nombre),
    activo: Boolean(r.activo),
    perfilExtendido: (r.perfil_extendido as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function rowToServicioSalon(r: Record<string, unknown>): ServicioSalon {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    nombre: String(r.nombre),
    categoria: (r.categoria as CategoriaServicioDB) ?? 'otro',
    usaFormulaColor: Boolean(r.usa_formula_color),
    duracionMinutos: typeof r.duracion_minutos === 'number' ? r.duracion_minutos : undefined,
    activo: Boolean(r.activo),
    orden: typeof r.orden === 'number' ? r.orden : 0,
    perfilExtendido: (r.perfil_extendido as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function rowToPlantilla(r: Record<string, unknown>): PlantillaPrecio {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    servicioId: String(r.servicio_id),
    version: Number(r.version),
    vigenteDesde: String(r.vigente_desde),
    vigenteHasta: r.vigente_hasta ? String(r.vigente_hasta) : undefined,
    precioBase: Number(r.precio_base),
    ajustes: (r.ajustes as AjustesPlantilla) ?? {},
    consumo: (r.consumo as Record<string, unknown>) ?? {},
    redondeo: Number(r.redondeo ?? 1000),
    vigenciaDias: Number(r.vigencia_dias ?? 15),
    perfilExtendido: (r.perfil_extendido as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
  };
}

function rowToProducto(r: Record<string, unknown>): ProductoSalon {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    marcaId: r.marca_id ? String(r.marca_id) : undefined,
    marca: r.marca ? String(r.marca) : undefined,
    nombre: String(r.nombre),
    tipo: (r.tipo as TipoProductoSalon) ?? 'otro',
    presentacionCantidad: Number(r.presentacion_cantidad),
    unidad: (r.unidad as 'g' | 'ml' | 'unidad') ?? 'g',
    precioCompra: Number(r.precio_compra),
    precioActualizadoAt: String(r.precio_actualizado_at),
    activo: Boolean(r.activo),
    perfilExtendido: (r.perfil_extendido as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function rowToComision(r: Record<string, unknown>): ComisionSalon {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    estilistaId: r.estilista_id ? String(r.estilista_id) : null,
    servicioId: r.servicio_id ? String(r.servicio_id) : null,
    tipo: (r.tipo as TipoComision) ?? 'porcentaje',
    valor: Number(r.valor),
    base: (r.base as BaseComision) ?? 'precio',
    vigenteDesde: String(r.vigente_desde),
    vigenteHasta: r.vigente_hasta ? String(r.vigente_hasta) : null,
    createdAt: String(r.created_at),
  };
}

function rowToCotizacion(r: Record<string, unknown>): Cotizacion {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    clientaId: r.clienta_id ? String(r.clienta_id) : undefined,
    consultaId: r.consulta_id ? String(r.consulta_id) : undefined,
    estilistaId: r.estilista_id ? String(r.estilista_id) : undefined,
    servicioId: r.servicio_id ? String(r.servicio_id) : undefined,
    plantillaId: r.plantilla_id ? String(r.plantilla_id) : undefined,
    servicioColorId: r.servicio_color_id ? String(r.servicio_color_id) : undefined,
    servicioNombre: String(r.servicio_nombre),
    estilistaNombre: r.estilista_nombre ? String(r.estilista_nombre) : undefined,
    plantillaVersion: typeof r.plantilla_version === 'number' ? r.plantilla_version : undefined,
    variables: (r.variables as VariablesCotizacion) ?? {},
    precioCalculado: Number(r.precio_calculado),
    precioCotizado: Number(r.precio_cotizado),
    ajusteManualMotivo: r.ajuste_manual_motivo ? String(r.ajuste_manual_motivo) : undefined,
    moneda: 'COP',
    vigenciaHasta: String(r.vigencia_hasta),
    estado: (r.estado as EstadoCotizacion) ?? 'borrador',
    enviadaAt: r.enviada_at ? String(r.enviada_at) : undefined,
    precioCobrado: typeof r.precio_cobrado === 'number' ? r.precio_cobrado : undefined,
    cobradoAt: r.cobrado_at ? String(r.cobrado_at) : undefined,
    diferenciaCobro: typeof r.diferencia_cobro === 'number' ? r.diferencia_cobro : undefined,
    formula: (r.formula as Record<string, unknown>) ?? undefined,
    costoProductoEstimado:
      typeof r.costo_producto_estimado === 'number' ? r.costo_producto_estimado : undefined,
    costoDetalle: (r.costo_detalle as CostoDetalleInmutable) ?? undefined,
    comisionEstimada: typeof r.comision_estimada === 'number' ? r.comision_estimada : undefined,
    comisionDetalle: (r.comision_detalle as ComisionDetalleInmutable) ?? undefined,
    conMarcaVelli: r.con_marca_velli !== false,
    tokenPublico: String(r.token_publico),
    perfilExtendido: (r.perfil_extendido as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ── 1. Estilistas ──────────────────────────────────────────────────────────

export async function listarEstilistas(opciones?: {
  soloActivas?: boolean;
  client?: SupabaseClient;
}): Promise<EstilistaSalon[]> {
  const supabase = obtenerClienteAutenticado(opciones?.client);
  let query = supabase.from('estilistas').select('*').order('nombre', { ascending: true });
  if (opciones?.soloActivas !== false) {
    query = query.eq('activo', true);
  }
  const { data, error } = await query;
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToEstilista(r as Record<string, unknown>));
}

export async function crearEstilista(
  input: { nombre: string; activo?: boolean; perfilExtendido?: Record<string, unknown> },
  client?: SupabaseClient
): Promise<EstilistaSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const userId = await requerirUserId(supabase);
  const { data, error } = await supabase
    .from('estilistas')
    .insert({
      user_id: userId,
      nombre: input.nombre.trim(),
      activo: input.activo ?? true,
      perfil_extendido: input.perfilExtendido ?? {},
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToEstilista(data as Record<string, unknown>);
}

export async function actualizarEstilista(
  id: string,
  patch: { nombre?: string; activo?: boolean; perfilExtendido?: Record<string, unknown> },
  client?: SupabaseClient
): Promise<EstilistaSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const updateObj: Record<string, unknown> = {};
  if (patch.nombre !== undefined) updateObj.nombre = patch.nombre.trim();
  if (patch.activo !== undefined) updateObj.activo = patch.activo;
  if (patch.perfilExtendido !== undefined) updateObj.perfil_extendido = patch.perfilExtendido;

  const { data, error } = await supabase
    .from('estilistas')
    .update(updateObj)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToEstilista(data as Record<string, unknown>);
}

// ── 2. Servicios del salón (y semilla desde onboarding) ────────────────────

/** Infiere la categoría y si usa fórmula de color a partir del nombre del servicio. */
export function inferirCategoriaServicio(nombre: string): {
  categoria: CategoriaServicioDB;
  usaFormulaColor: boolean;
} {
  const n = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (n.includes('decolor') || n.includes('balayage') || n.includes('iluminac')) {
    return { categoria: 'decoloracion', usaFormulaColor: true };
  }
  if (n.includes('color') || n.includes('tinte') || n.includes('mecha') || n.includes('matiz') || n.includes('cana')) {
    return { categoria: 'color', usaFormulaColor: true };
  }
  if (n.includes('corte')) return { categoria: 'corte', usaFormulaColor: false };
  if (n.includes('keratina') || n.includes('alisado') || n.includes('aminoacido')) {
    return { categoria: 'alisado', usaFormulaColor: false };
  }
  if (n.includes('tratamiento') || n.includes('hidratac') || n.includes('nutric') || n.includes('reconstruc')) {
    return { categoria: 'tratamiento', usaFormulaColor: false };
  }
  if (n.includes('rizo') || n.includes('definic') || n.includes('afro')) {
    return { categoria: 'rizos', usaFormulaColor: false };
  }
  if (n.includes('peinado') || n.includes('brushing') || n.includes('cepillado')) {
    return { categoria: 'peinado', usaFormulaColor: false };
  }
  if (n.includes('cuero cabelludo') || n.includes('detox') || n.includes('tricolog')) {
    return { categoria: 'cuero_cabelludo', usaFormulaColor: false };
  }
  if (n.includes('extension')) return { categoria: 'extensiones', usaFormulaColor: false };
  return { categoria: 'otro', usaFormulaColor: false };
}

export async function listarServiciosSalon(opciones?: {
  soloActivos?: boolean;
  client?: SupabaseClient;
}): Promise<ServicioSalon[]> {
  const supabase = obtenerClienteAutenticado(opciones?.client);
  let query = supabase
    .from('servicios_salon')
    .select('*')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });
  if (opciones?.soloActivos !== false) {
    query = query.eq('activo', true);
  }
  const { data, error } = await query;
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToServicioSalon(r as Record<string, unknown>));
}

export async function crearServicioSalon(
  input: {
    nombre: string;
    categoria?: CategoriaServicioDB;
    usaFormulaColor?: boolean;
    duracionMinutos?: number | null;
    orden?: number;
    activo?: boolean;
  },
  client?: SupabaseClient
): Promise<ServicioSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const userId = await requerirUserId(supabase);
  const inferido = inferirCategoriaServicio(input.nombre);

  const { data, error } = await supabase
    .from('servicios_salon')
    .insert({
      user_id: userId,
      nombre: input.nombre.trim(),
      categoria: input.categoria ?? inferido.categoria,
      usa_formula_color: input.usaFormulaColor ?? inferido.usaFormulaColor,
      duracion_minutos: input.duracionMinutos ?? null,
      orden: input.orden ?? 0,
      activo: input.activo ?? true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToServicioSalon(data as Record<string, unknown>);
}

export async function actualizarServicioSalon(
  id: string,
  patch: {
    nombre?: string;
    categoria?: CategoriaServicioDB;
    usaFormulaColor?: boolean;
    duracionMinutos?: number | null;
    orden?: number;
    activo?: boolean;
    perfilExtendido?: Record<string, unknown>;
  },
  client?: SupabaseClient
): Promise<ServicioSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const updateObj: Record<string, unknown> = {};
  if (patch.nombre !== undefined) updateObj.nombre = patch.nombre.trim();
  if (patch.categoria !== undefined) updateObj.categoria = patch.categoria;
  if (patch.usaFormulaColor !== undefined) updateObj.usa_formula_color = patch.usaFormulaColor;
  if (patch.duracionMinutos !== undefined) updateObj.duracion_minutos = patch.duracionMinutos;
  if (patch.orden !== undefined) updateObj.orden = patch.orden;
  if (patch.activo !== undefined) updateObj.activo = patch.activo;
  if (patch.perfilExtendido !== undefined) updateObj.perfil_extendido = patch.perfilExtendido;

  const { data, error } = await supabase
    .from('servicios_salon')
    .update(updateObj)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToServicioSalon(data as Record<string, unknown>);
}

/**
 * Siembra `servicios_salon` con los servicios de `profiles.servicios` (paso 3
 * del onboarding) si el salón aún no tiene servicios creados.
 */
export async function sembrarServiciosDesdeOnboarding(
  nombresSemilla?: readonly string[],
  client?: SupabaseClient
): Promise<ServicioSalon[]> {
  const supabase = obtenerClienteAutenticado(client);
  const existentes = await listarServiciosSalon({ soloActivos: false, client: supabase });
  if (existentes.length > 0) return existentes;

  const userId = await requerirUserId(supabase);
  let nombres = nombresSemilla ? [...nombresSemilla] : [];

  if (nombres.length === 0) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('servicios')
      .eq('id', userId)
      .maybeSingle();
    const servs = (perfil as { servicios?: unknown } | null)?.servicios;
    if (Array.isArray(servs)) {
      nombres = servs.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    }
  }

  const limpios = Array.from(new Set(nombres.map((n) => n.trim()).filter(Boolean)));
  if (limpios.length === 0) return [];

  const filas = limpios.map((nombre, idx) => {
    const inf = inferirCategoriaServicio(nombre);
    return {
      user_id: userId,
      nombre,
      categoria: inf.categoria,
      usa_formula_color: inf.usaFormulaColor,
      orden: idx,
      activo: true,
    };
  });

  const { data, error } = await supabase.from('servicios_salon').insert(filas).select('*');
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToServicioSalon(r as Record<string, unknown>));
}

// ── 3. Plantillas de precio (versionadas e inmutables) ─────────────────────

export async function obtenerPlantillaVigente(
  servicioId: string,
  client?: SupabaseClient
): Promise<PlantillaPrecio | null> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('plantillas_precio')
    .select('*')
    .eq('servicio_id', servicioId)
    .is('vigente_hasta', null)
    .maybeSingle();
  if (error) {
    if (esTablaInexistente(error)) return null;
    throw error;
  }
  return data ? rowToPlantilla(data as Record<string, unknown>) : null;
}

export async function listarPlantillasVigentes(
  client?: SupabaseClient
): Promise<PlantillaPrecio[]> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('plantillas_precio')
    .select('*')
    .is('vigente_hasta', null);
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToPlantilla(r as Record<string, unknown>));
}

/**
 * Publica una nueva versión de plantilla llamando a la RPC
 * `publicar_plantilla_precio` (cierra la anterior y crea la siguiente en una
 * sola transacción).
 */
export async function publicarPlantillaPrecio(
  input: {
    servicioId: string;
    precioBase: number;
    ajustes?: AjustesPlantilla;
    consumo?: Record<string, unknown>;
    redondeo?: number;
    vigenciaDias?: number;
  },
  client?: SupabaseClient
): Promise<string> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase.rpc('publicar_plantilla_precio', {
    p_servicio_id: input.servicioId,
    p_precio_base: Math.round(input.precioBase),
    p_ajustes: input.ajustes ?? {},
    p_consumo: input.consumo ?? {},
    p_redondeo: input.redondeo ?? 1000,
    p_vigencia_dias: input.vigenciaDias ?? 15,
  });
  if (error) throw error;
  return String(data);
}

// ── 4. Productos del salón ─────────────────────────────────────────────────

export async function listarProductosSalon(opciones?: {
  soloActivos?: boolean;
  client?: SupabaseClient;
}): Promise<ProductoSalon[]> {
  const supabase = obtenerClienteAutenticado(opciones?.client);
  let query = supabase.from('productos_salon').select('*').order('nombre', { ascending: true });
  if (opciones?.soloActivos !== false) {
    query = query.eq('activo', true);
  }
  const { data, error } = await query;
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToProducto(r as Record<string, unknown>));
}

export async function crearProductoSalon(
  input: {
    nombre: string;
    marcaId?: string | null;
    marca?: string | null;
    tipo: TipoProductoSalon;
    presentacionCantidad: number;
    unidad: 'g' | 'ml' | 'unidad';
    precioCompra: number;
    activo?: boolean;
  },
  client?: SupabaseClient
): Promise<ProductoSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const userId = await requerirUserId(supabase);
  const { data, error } = await supabase
    .from('productos_salon')
    .insert({
      user_id: userId,
      nombre: input.nombre.trim(),
      marca_id: input.marcaId ?? null,
      marca: input.marca ?? null,
      tipo: input.tipo,
      presentacion_cantidad: input.presentacionCantidad,
      unidad: input.unidad,
      precio_compra: Math.round(input.precioCompra),
      activo: input.activo ?? true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToProducto(data as Record<string, unknown>);
}

export async function actualizarProductoSalon(
  id: string,
  patch: {
    nombre?: string;
    marcaId?: string | null;
    marca?: string | null;
    tipo?: TipoProductoSalon;
    presentacionCantidad?: number;
    unidad?: 'g' | 'ml' | 'unidad';
    precioCompra?: number;
    activo?: boolean;
  },
  client?: SupabaseClient
): Promise<ProductoSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const updateObj: Record<string, unknown> = {};
  if (patch.nombre !== undefined) updateObj.nombre = patch.nombre.trim();
  if (patch.marcaId !== undefined) updateObj.marca_id = patch.marcaId;
  if (patch.marca !== undefined) updateObj.marca = patch.marca;
  if (patch.tipo !== undefined) updateObj.tipo = patch.tipo;
  if (patch.presentacionCantidad !== undefined) {
    updateObj.presentacion_cantidad = patch.presentacionCantidad;
  }
  if (patch.unidad !== undefined) updateObj.unidad = patch.unidad;
  if (patch.precioCompra !== undefined) {
    updateObj.precio_compra = Math.round(patch.precioCompra);
    updateObj.precio_actualizado_at = new Date().toISOString();
  }
  if (patch.activo !== undefined) updateObj.activo = patch.activo;

  const { data, error } = await supabase
    .from('productos_salon')
    .update(updateObj)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToProducto(data as Record<string, unknown>);
}

// ── 5. Comisiones ──────────────────────────────────────────────────────────

export async function listarComisionesVigentes(
  client?: SupabaseClient
): Promise<ComisionSalon[]> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('comisiones')
    .select('*')
    .is('vigente_hasta', null)
    .order('created_at', { ascending: false });
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToComision(r as Record<string, unknown>));
}

export async function crearReglaComision(
  input: {
    estilistaId?: string | null;
    servicioId?: string | null;
    tipo: TipoComision;
    valor: number;
    base?: BaseComision;
  },
  client?: SupabaseClient
): Promise<ComisionSalon> {
  const supabase = obtenerClienteAutenticado(client);
  const userId = await requerirUserId(supabase);
  const { data, error } = await supabase
    .from('comisiones')
    .insert({
      user_id: userId,
      estilista_id: input.estilistaId ?? null,
      servicio_id: input.servicioId ?? null,
      tipo: input.tipo,
      valor: input.valor,
      base: input.base ?? 'precio',
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToComision(data as Record<string, unknown>);
}

// ── 6. Cotizaciones y lectura pública ──────────────────────────────────────

export async function cerrarReglaComision(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = obtenerClienteAutenticado(client);
  const { error } = await supabase
    .from('comisiones')
    .update({ vigente_hasta: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export interface CrearCotizacionInput {
  clientaId?: string | null;
  consultaId?: string | null;
  estilistaId?: string | null;
  servicioId?: string | null;
  plantillaId?: string | null;
  servicioColorId?: string | null;
  servicioNombre: string;
  estilistaNombre?: string | null;
  plantillaVersion?: number | null;
  variables?: VariablesCotizacion;
  precioCalculado: number;
  precioCotizado: number;
  ajusteManualMotivo?: string | null;
  vigenciaHasta: string;
  estado?: 'borrador' | 'enviada';
  formula?: Record<string, unknown> | null;
  costoProductoEstimado?: number | null;
  costoDetalle?: CostoDetalleInmutable | null;
  comisionEstimada?: number | null;
  comisionDetalle?: ComisionDetalleInmutable | null;
  conMarcaVelli?: boolean;
}

export async function crearCotizacion(
  input: CrearCotizacionInput,
  client?: SupabaseClient
): Promise<Cotizacion> {
  const precioCalc = Math.round(input.precioCalculado);
  const precioCot = Math.round(input.precioCotizado);
  const motivo = input.ajusteManualMotivo?.trim() ?? '';

  if (precioCot !== precioCalc && motivo.length < 3) {
    throw new Error(
      'MOTIVO_REQUERIDO: Cuando el precio cotizado difiere del calculado por la plantilla, debes indicar un motivo (mínimo 3 caracteres).'
    );
  }

  const supabase = obtenerClienteAutenticado(client);
  const userId = await requerirUserId(supabase);

  const { data, error } = await supabase
    .from('cotizaciones')
    .insert({
      user_id: userId,
      clienta_id: input.clientaId ?? null,
      consulta_id: input.consultaId ?? null,
      estilista_id: input.estilistaId ?? null,
      servicio_id: input.servicioId ?? null,
      plantilla_id: input.plantillaId ?? null,
      servicio_color_id: input.servicioColorId ?? null,
      servicio_nombre: input.servicioNombre.trim(),
      estilista_nombre: input.estilistaNombre?.trim() || null,
      plantilla_version: input.plantillaVersion ?? null,
      variables: input.variables ?? {},
      precio_calculado: precioCalc,
      precio_cotizado: precioCot,
      ajuste_manual_motivo: motivo || null,
      vigencia_hasta: input.vigenciaHasta,
      estado: input.estado ?? 'enviada',
      formula: input.formula ?? null,
      costo_producto_estimado:
        input.costoProductoEstimado != null ? Math.round(input.costoProductoEstimado) : null,
      costo_detalle: input.costoDetalle ?? null,
      comision_estimada:
        input.comisionEstimada != null ? Math.round(input.comisionEstimada) : null,
      comision_detalle: input.comisionDetalle ?? null,
      con_marca_velli: input.conMarcaVelli ?? true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToCotizacion(data as Record<string, unknown>);
}

export async function enviarCotizacion(
  cotizacionId: string,
  client?: SupabaseClient
): Promise<Cotizacion> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('cotizaciones')
    .update({ estado: 'enviada' })
    .eq('id', cotizacionId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToCotizacion(data as Record<string, unknown>);
}

/** Lista las cotizaciones en estado `'enviada'` («Por cobrar», §2.2). */
export async function listarCotizacionesPorCobrar(
  client?: SupabaseClient
): Promise<Cotizacion[]> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('estado', 'enviada')
    .order('created_at', { ascending: false });
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToCotizacion(r as Record<string, unknown>));
}

export async function listarCotizacionesPorClienta(
  clientaId: string,
  client?: SupabaseClient
): Promise<Cotizacion[]> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('clienta_id', clientaId)
    .order('created_at', { ascending: false });
  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToCotizacion(r as Record<string, unknown>));
}

/**
 * Confirma lo cobrado en 1 toque (§2.2):
 * - Si no se pasa `precioCobrado`, cobra exactamente `precioCotizado`.
 * - Permite cambiar quién atendió al momento de cobrar (`estilistaId`).
 */
export async function confirmarCobroCotizacion(
  cotizacionId: string,
  opciones: {
    precioCobrado: number;
    estilistaId?: string | null;
    estilistaNombre?: string | null;
    costoProductoEstimado?: number | null;
    costoDetalle?: CostoDetalleInmutable | null;
    comisionEstimada?: number | null;
    comisionDetalle?: ComisionDetalleInmutable | null;
  },
  client?: SupabaseClient
): Promise<Cotizacion> {
  const supabase = obtenerClienteAutenticado(client);
  const patch: Record<string, unknown> = {
    estado: 'cobrada',
    precio_cobrado: Math.max(0, Math.round(opciones.precioCobrado)),
    cobrado_at: new Date().toISOString(),
  };
  if (opciones.estilistaId !== undefined) patch.estilista_id = opciones.estilistaId;
  if (opciones.estilistaNombre !== undefined) patch.estilista_nombre = opciones.estilistaNombre;
  if (opciones.costoProductoEstimado !== undefined) {
    patch.costo_producto_estimado =
      opciones.costoProductoEstimado != null ? Math.round(opciones.costoProductoEstimado) : null;
  }
  if (opciones.costoDetalle !== undefined) patch.costo_detalle = opciones.costoDetalle;
  if (opciones.comisionEstimada !== undefined) {
    patch.comision_estimada =
      opciones.comisionEstimada != null ? Math.round(opciones.comisionEstimada) : null;
  }
  if (opciones.comisionDetalle !== undefined) patch.comision_detalle = opciones.comisionDetalle;

  const { data, error } = await supabase
    .from('cotizaciones')
    .update(patch)
    .eq('id', cotizacionId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToCotizacion(data as Record<string, unknown>);
}

/** Corrige el valor cobrado de una cotización ya cobrada (queda en `cotizacion_eventos`). */
export async function corregirCobroCotizacion(
  cotizacionId: string,
  nuevoPrecioCobrado: number,
  client?: SupabaseClient
): Promise<Cotizacion> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('cotizaciones')
    .update({
      precio_cobrado: Math.max(0, Math.round(nuevoPrecioCobrado)),
    })
    .eq('id', cotizacionId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToCotizacion(data as Record<string, unknown>);
}

export async function anularCotizacion(
  cotizacionId: string,
  client?: SupabaseClient
): Promise<Cotizacion> {
  const supabase = obtenerClienteAutenticado(client);
  const { data, error } = await supabase
    .from('cotizaciones')
    .update({ estado: 'anulada' })
    .eq('id', cotizacionId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToCotizacion(data as Record<string, unknown>);
}

/**
 * Puerta pública única (`/c/[token]`): valida formato UUID y consulta la RPC
 * `cotizacion_publica(p_token)` con la llave anónima (§4 de 02-diseno-cotizador.md).
 */
export async function obtenerCotizacionPublica(
  token: string | null | undefined,
  client?: Pick<SupabaseClient, 'rpc'>
): Promise<CotizacionPublica | null> {
  if (!esUuidValido(token)) return null;

  const supabase = client ?? obtenerClienteAnonimo();
  const { data, error } = await supabase.rpc('cotizacion_publica', {
    p_token: token.trim(),
  });

  if (error) {
    if (esTablaInexistente(error)) return null;
    throw error;
  }

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila || typeof fila !== 'object') return null;

  const r = fila as Record<string, unknown>;
  if (typeof r.servicio !== 'string' || typeof r.precio !== 'number') return null;

  return {
    salon: typeof r.salon === 'string' && r.salon.trim() ? r.salon.trim() : 'Tu salón',
    colorSalon: typeof r.color_salon === 'string' && r.color_salon.trim() ? r.color_salon.trim() : undefined,
    servicio: r.servicio,
    precio: r.precio,
    moneda: typeof r.moneda === 'string' ? r.moneda : 'COP',
    vigenciaHasta: String(r.vigencia_hasta),
    vigente: Boolean(r.vigente),
    conMarcaVelli: r.con_marca_velli !== false,
  };
}
