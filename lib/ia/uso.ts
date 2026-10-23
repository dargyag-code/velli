// ═══════════════════════════════════════════════════════════════════════════
// Velli BI · Control de cupo y registro de consumo de IA (Etapa 2/3)
// Especificación: docs/velli-bi/01-costo-ia.md (§4, §6, §8) y
//                 supabase/borradores/velli-bi-uso-ia.sql
//
// Precios oficiales de Claude Sonnet 4.6 (Anthropic):
//   - Entrada: US$3 por millón de tokens
//   - Salida:  US$15 por millón de tokens
//
// Reglas de negocio (D1, P3):
//   - Planes `basico` y `pro` (fuera de prueba gratis): sin IA por foto.
//   - Prueba gratis (`trialing`, 14 días): tope total de 20 análisis con IA
//     (aviso al 80 % = 16 análisis).
//   - Plan `pro_ia` activo: tope de 150 análisis con IA por mes calendario en
//     hora de Colombia (`America/Bogota`, aviso al 80 % = 120 análisis).
//   - Máximo 2 llamadas a `validar` por análisis o sesión de captura.
//   - El bloqueo de IA NUNCA impide continuar con el diagnóstico manual ni
//     usar el cotizador.
// ═══════════════════════════════════════════════════════════════════════════

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { esPlanId, type PlanId } from '@/lib/subscription/plans';
import type { EstadoSuscripcion } from '@/lib/subscription/estado';

export const MODELO_CLAUDE_IA = 'claude-sonnet-4-6';
export const PROVEEDOR_IA = 'anthropic' as const;

export const PRECIO_ENTRADA_USD_POR_MILLON = 3;
export const PRECIO_SALIDA_USD_POR_MILLON = 15;

export const TOPE_IA_PRO_IA = 150;
export const TOPE_IA_TRIAL = 20;

export const UMBRAL_AVISO_PRO_IA = 120; // 80 % de 150
export const UMBRAL_AVISO_TRIAL = 16;   // 80 % de 20

export const MAX_VALIDACIONES_POR_ANALISIS = 2;

export type RutaUsoIA = 'analizar' | 'validar';
export type MotivoBloqueoCupoIA =
  | 'plan_sin_ia'
  | 'tope_ia_alcanzado'
  | 'tope_validaciones_alcanzado';
export type CodigoBloqueoCupoIA = 'PLAN_SIN_IA' | 'TOPE_IA_ALCANZADO';

export interface ResultadoCupoIA {
  permitido: boolean;
  motivo?: MotivoBloqueoCupoIA;
  codigo?: CodigoBloqueoCupoIA;
  mensaje?: string;
  usados: number;
  tope: number;
  restantes: number;
  avisoOchentaPorCiento: boolean;
  /** Indica si el cupo provino de la base de datos o parámetros explícitos (true) o de fallback pre-migración (false). */
  medido?: boolean;
}

export interface EvaluarCupoIAParams {
  estado: EstadoSuscripcion;
  plan: PlanId | null;
  usados: number;
  ruta?: RutaUsoIA;
  validacionesEnSesion?: number;
}

export interface OpcionesVerificarCupoIA {
  ruta?: RutaUsoIA;
  supabase?: SupabaseClient | null;
  /** Permite evaluar directamente en pruebas o cuando ya se conoce la suscripción. */
  suscripcion?: {
    estado: EstadoSuscripcion;
    plan: PlanId | null;
  } | null;
  usados?: number;
  validacionesEnSesion?: number;
}

export interface RegistroUsoIAInput {
  userId: string;
  ruta: RutaUsoIA;
  proveedor?: 'anthropic';
  modelo?: string;
  fotos: number;
  tokensEntrada?: number | null;
  tokensSalida?: number | null;
  ok: boolean;
}

export interface ResultadoRegistroUsoIA {
  registrado: boolean;
  costoUsd: number | null;
  error?: string;
}

// Control en memoria por usuario para limitar a máximo 2 llamadas a `validar`
// antes de un `analizar` (respalda a la consulta en BD y funciona incluso antes
// de aplicar la migración `uso_ia`).
const validacionesConsecutivas = new Map<string, number>();

export function reiniciarValidacionesSesionIA(userId?: string): void {
  if (userId) {
    validacionesConsecutivas.delete(userId);
  } else {
    validacionesConsecutivas.clear();
  }
}

export function obtenerValidacionesSesionIA(userId: string): number {
  return validacionesConsecutivas.get(userId) ?? 0;
}

/**
 * Calcula el costo estimado en USD para Claude Sonnet 4.6:
 * US$3 / 1M tokens de entrada + US$15 / 1M tokens de salida,
 * redondeado a 6 decimales (`numeric(10, 6)`).
 */
export function calcularCostoUsdIA(
  tokensEntrada?: number | null,
  tokensSalida?: number | null
): number {
  const entrada =
    typeof tokensEntrada === 'number' && Number.isFinite(tokensEntrada) && tokensEntrada > 0
      ? tokensEntrada
      : 0;
  const salida =
    typeof tokensSalida === 'number' && Number.isFinite(tokensSalida) && tokensSalida > 0
      ? tokensSalida
      : 0;
  const costo =
    (entrada * PRECIO_ENTRADA_USD_POR_MILLON + salida * PRECIO_SALIDA_USD_POR_MILLON) /
    1_000_000;
  return Math.round(costo * 1_000_000) / 1_000_000;
}

/**
 * Devuelve el inicio del mes calendario actual en hora de Colombia (`America/Bogota`, UTC-5)
 * en formato ISO UTC, equivalente a:
 * `(date_trunc('month', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota')`.
 */
export function inicioMesColombiaISO(fecha: Date = new Date()): string {
  const OFFSET_BOGOTA_MS = -5 * 60 * 60 * 1000;
  const bogotaTime = new Date(fecha.getTime() + OFFSET_BOGOTA_MS);
  const year = bogotaTime.getUTCFullYear();
  const month = bogotaTime.getUTCMonth();
  // 00:00:00 en Colombia (UTC-5) equivale a las 05:00:00 UTC del día 1.
  return new Date(Date.UTC(year, month, 1, 5, 0, 0, 0)).toISOString();
}

/**
 * Evalúa de forma pura las reglas de cupo de IA según el estado de la suscripción,
 * el plan activo, los análisis usados y las validaciones de la sesión actual.
 */
export function evaluarCupoIA(params: EvaluarCupoIAParams): ResultadoCupoIA {
  const usados = Math.max(0, Math.trunc(params.usados || 0));
  const ruta = params.ruta ?? 'analizar';
  const validaciones = Math.max(0, Math.trunc(params.validacionesEnSesion ?? 0));

  // 1. Prueba gratis (14 días): tope total de 20 análisis con IA
  if (params.estado === 'trialing') {
    const tope = TOPE_IA_TRIAL;
    const restantes = Math.max(0, tope - usados);
    const avisoOchentaPorCiento = usados >= UMBRAL_AVISO_TRIAL;

    if (usados >= tope) {
      return {
        permitido: false,
        motivo: 'tope_ia_alcanzado',
        codigo: 'TOPE_IA_ALCANZADO',
        mensaje:
          'Alcanzaste los 20 análisis con IA de la prueba gratis. Puedes seguir con el diagnóstico manual o activar el plan Pro + IA.',
        usados,
        tope,
        restantes: 0,
        avisoOchentaPorCiento: true,
        medido: true,
      };
    }

    if (ruta === 'validar' && validaciones >= MAX_VALIDACIONES_POR_ANALISIS) {
      return {
        permitido: false,
        motivo: 'tope_validaciones_alcanzado',
        codigo: 'TOPE_IA_ALCANZADO',
        mensaje: 'Se alcanzó el límite de 2 validaciones de fotos para este análisis.',
        usados,
        tope,
        restantes,
        avisoOchentaPorCiento,
        medido: true,
      };
    }

    return {
      permitido: true,
      usados,
      tope,
      restantes,
      avisoOchentaPorCiento,
      medido: true,
    };
  }

  // 2. Suscripción vencida o planes sin IA por foto (`basico`, `pro`, null)
  if (params.estado === 'expired' || params.plan !== 'pro_ia') {
    return {
      permitido: false,
      motivo: 'plan_sin_ia',
      codigo: 'PLAN_SIN_IA',
      mensaje:
        'Tu plan actual no incluye análisis con IA por foto. Puedes seguir con el diagnóstico manual o pasar al plan Pro + IA.',
      usados,
      tope: 0,
      restantes: 0,
      avisoOchentaPorCiento: false,
      medido: true,
    };
  }

  // 3. Plan `pro_ia` activo (o en periodo vigente / gracia): tope 150 análisis/mes en Colombia
  const tope = TOPE_IA_PRO_IA;
  const restantes = Math.max(0, tope - usados);
  const avisoOchentaPorCiento = usados >= UMBRAL_AVISO_PRO_IA;

  if (usados >= tope) {
    return {
      permitido: false,
      motivo: 'tope_ia_alcanzado',
      codigo: 'TOPE_IA_ALCANZADO',
      mensaje:
        'Llegaste al tope de 150 análisis con IA de este mes. Puedes seguir con el diagnóstico manual.',
      usados,
      tope,
      restantes: 0,
      avisoOchentaPorCiento: true,
      medido: true,
    };
  }

  if (ruta === 'validar' && validaciones >= MAX_VALIDACIONES_POR_ANALISIS) {
    return {
      permitido: false,
      motivo: 'tope_validaciones_alcanzado',
      codigo: 'TOPE_IA_ALCANZADO',
      mensaje: 'Se alcanzó el límite de 2 validaciones de fotos para este análisis.',
      usados,
      tope,
      restantes,
      avisoOchentaPorCiento,
      medido: true,
    };
  }

  return {
    permitido: true,
    usados,
    tope,
    restantes,
    avisoOchentaPorCiento,
    medido: true,
  };
}

function esErrorTablaNoExiste(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message ?? '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42883' ||
    code === 'PGRST202' ||
    /uso_ia|ia_analisis_del_mes|does not exist|schema cache/i.test(msg)
  );
}

function obtenerClienteConsulta(supabase?: SupabaseClient | null): SupabaseClient | null {
  if (supabase && typeof supabase.rpc === 'function') {
    return supabase;
  }
  if (
    supabase === undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      return createAdminClient();
    } catch {
      return null;
    }
  }
  return null;
}

async function consultarConteoAnalisis(
  client: SupabaseClient,
  userId: string,
  estado: EstadoSuscripcion
): Promise<{ usados: number; tablaDisponible: boolean }> {
  // En prueba gratis (`trialing`) el tope de 20 es sobre el total de la prueba.
  if (estado === 'trialing' && typeof client.from === 'function') {
    try {
      const { count, error } = await client
        .from('uso_ia')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('ruta', 'analizar')
        .eq('ok', true);

      if (!error && typeof count === 'number') {
        return { usados: count, tablaDisponible: true };
      }
      if (error && !esErrorTablaNoExiste(error)) {
        console.warn('[uso_ia] error contando trial en uso_ia:', error.message);
      }
    } catch {
      // Fallback a RPC abajo
    }
  }

  // En `pro_ia` (o como respaldo de `trialing`), usamos la RPC `ia_analisis_del_mes`.
  if (typeof client.rpc === 'function') {
    try {
      const { data, error } = await client.rpc('ia_analisis_del_mes', {
        p_user_id: userId,
      });
      if (!error && typeof data === 'number') {
        return { usados: data, tablaDisponible: true };
      }
      if (error && esErrorTablaNoExiste(error)) {
        return { usados: 0, tablaDisponible: false };
      }
    } catch {
      // Fallback a consulta directa abajo
    }
  }

  // Respaldo por consulta directa en el mes calendario de Colombia
  if (typeof client.from === 'function') {
    try {
      const { count, error } = await client
        .from('uso_ia')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('ruta', 'analizar')
        .eq('ok', true)
        .gte('created_at', inicioMesColombiaISO());

      if (!error && typeof count === 'number') {
        return { usados: count, tablaDisponible: true };
      }
    } catch {
      // Ignorar si aún no existe la tabla
    }
  }

  return { usados: 0, tablaDisponible: false };
}

async function consultarValidacionesDesdeUltimoAnalisis(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const enMemoria = obtenerValidacionesSesionIA(userId);
  if (typeof client.from !== 'function') {
    return enMemoria;
  }
  try {
    const { data, error } = await client
      .from('uso_ia')
      .select('ruta')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_VALIDACIONES_POR_ANALISIS);

    if (error || !Array.isArray(data)) {
      return enMemoria;
    }

    let seguidas = 0;
    for (const fila of data as Array<{ ruta?: string }>) {
      if (fila.ruta === 'validar') {
        seguidas += 1;
      } else {
        break;
      }
    }
    return Math.max(enMemoria, seguidas);
  } catch {
    return enMemoria;
  }
}

/**
 * Verifica en el servidor si el salón tiene cupo para usar la IA de diagnóstico
 * (`analizar` o `validar`).
 */
export async function verificarCupoIA(
  userId: string,
  opciones?: OpcionesVerificarCupoIA
): Promise<ResultadoCupoIA> {
  const ruta = opciones?.ruta ?? 'analizar';

  // 1. Si se inyectó la suscripción (ej. pruebas unitarias o contexto precargado)
  if (opciones?.suscripcion) {
    const validaciones =
      opciones.validacionesEnSesion ?? obtenerValidacionesSesionIA(userId);
    return evaluarCupoIA({
      estado: opciones.suscripcion.estado,
      plan: opciones.suscripcion.plan,
      usados: opciones.usados ?? 0,
      ruta,
      validacionesEnSesion: validaciones,
    });
  }

  // 2. Obtener cliente de Supabase para consultar suscripción y uso
  const client = obtenerClienteConsulta(opciones?.supabase);
  if (!client) {
    // Entorno sin cliente de BD configurado: comprobar al menos límite de validaciones en memoria
    const validaciones =
      opciones?.validacionesEnSesion ?? obtenerValidacionesSesionIA(userId);
    if (ruta === 'validar' && validaciones >= MAX_VALIDACIONES_POR_ANALISIS) {
      return {
        permitido: false,
        motivo: 'tope_validaciones_alcanzado',
        codigo: 'TOPE_IA_ALCANZADO',
        mensaje: 'Se alcanzó el límite de 2 validaciones de fotos para este análisis.',
        usados: 0,
        tope: TOPE_IA_PRO_IA,
        restantes: TOPE_IA_PRO_IA,
        avisoOchentaPorCiento: false,
        medido: false,
      };
    }
    return {
      permitido: true,
      usados: 0,
      tope: TOPE_IA_PRO_IA,
      restantes: TOPE_IA_PRO_IA,
      avisoOchentaPorCiento: false,
      medido: false,
    };
  }

  try {
    const { data: subData, error: subError } = await client.rpc('suscripcion_efectiva', {
      p_user_id: userId,
    });

    if (subError || !subData) {
      return {
        permitido: true,
        usados: 0,
        tope: TOPE_IA_PRO_IA,
        restantes: TOPE_IA_PRO_IA,
        avisoOchentaPorCiento: false,
        medido: false,
      };
    }

    const row = Array.isArray(subData) ? subData[0] : subData;
    if (!row || !row.estado) {
      return {
        permitido: true,
        usados: 0,
        tope: TOPE_IA_PRO_IA,
        restantes: TOPE_IA_PRO_IA,
        avisoOchentaPorCiento: false,
        medido: false,
      };
    }

    const estado = row.estado as EstadoSuscripcion;
    const plan: PlanId | null = esPlanId(row.plan) ? row.plan : null;

    // Si el plan no incluye IA (fuera de trial), bloqueamos sin necesidad de consultar uso_ia
    if (estado !== 'trialing' && (estado === 'expired' || plan !== 'pro_ia')) {
      return evaluarCupoIA({
        estado,
        plan,
        usados: 0,
        ruta,
        validacionesEnSesion: 0,
      });
    }

    const conteo =
      typeof opciones?.usados === 'number'
        ? { usados: opciones.usados, tablaDisponible: true }
        : await consultarConteoAnalisis(client, userId, estado);

    const validaciones =
      typeof opciones?.validacionesEnSesion === 'number'
        ? opciones.validacionesEnSesion
        : ruta === 'validar'
          ? await consultarValidacionesDesdeUltimoAnalisis(client, userId)
          : 0;

    const resultado = evaluarCupoIA({
      estado,
      plan,
      usados: conteo.usados,
      ruta,
      validacionesEnSesion: validaciones,
    });

    return {
      ...resultado,
      medido: conteo.tablaDisponible,
    };
  } catch (e) {
    console.warn('[uso_ia] no se pudo verificar el cupo de IA:', e);
    return {
      permitido: true,
      usados: 0,
      tope: TOPE_IA_PRO_IA,
      restantes: TOPE_IA_PRO_IA,
      avisoOchentaPorCiento: false,
      medido: false,
    };
  }
}

/**
 * Registra una llamada a la IA (`analizar` o `validar`) en `public.uso_ia`
 * usando `service_role`. Si la tabla aún no existe en la base de datos,
 * captura el error sin interrumpir el flujo y lo reporta a Sentry/log.
 */
export async function registrarUsoIA(
  input: RegistroUsoIAInput,
  opciones?: { adminClient?: SupabaseClient | null }
): Promise<ResultadoRegistroUsoIA> {
  // Actualizar contador de validaciones por sesión de captura/análisis
  if (input.ruta === 'validar') {
    const prev = validacionesConsecutivas.get(input.userId) ?? 0;
    validacionesConsecutivas.set(input.userId, prev + 1);
  } else if (input.ruta === 'analizar') {
    validacionesConsecutivas.set(input.userId, 0);
  }

  const tieneTokens =
    typeof input.tokensEntrada === 'number' || typeof input.tokensSalida === 'number';
  const costoUsd = tieneTokens
    ? calcularCostoUsdIA(input.tokensEntrada, input.tokensSalida)
    : null;

  const fotosNormalizadas = Math.max(0, Math.min(10, Math.trunc(input.fotos || 0)));

  let admin: SupabaseClient | null = opciones?.adminClient ?? null;
  if (!admin) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { registrado: false, costoUsd, error: 'service_role_no_configurado' };
    }
    try {
      admin = createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { registrado: false, costoUsd, error: msg };
    }
  }

  try {
    const { error } = await admin.from('uso_ia').insert({
      user_id: input.userId,
      ruta: input.ruta,
      proveedor: input.proveedor ?? PROVEEDOR_IA,
      modelo: input.modelo ?? MODELO_CLAUDE_IA,
      fotos: fotosNormalizadas,
      tokens_entrada: input.tokensEntrada ?? null,
      tokens_salida: input.tokensSalida ?? null,
      costo_usd: costoUsd,
      ok: input.ok,
    });

    if (error) {
      console.warn('[uso_ia] no se pudo insertar registro en uso_ia:', error.message);
      Sentry.captureException(error, {
        tags: { area: 'ia', op: 'registrar_uso_ia', ruta: input.ruta },
      });
      return { registrado: false, costoUsd, error: error.message };
    }

    return { registrado: true, costoUsd };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[uso_ia] excepción registrando uso de IA:', msg);
    Sentry.captureException(e, {
      tags: { area: 'ia', op: 'registrar_uso_ia', ruta: input.ruta },
    });
    return { registrado: false, costoUsd, error: msg };
  }
}
