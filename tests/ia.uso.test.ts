import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

import {
  MAX_VALIDACIONES_POR_ANALISIS,
  MODELO_CLAUDE_IA,
  TOPE_IA_PRO_IA,
  TOPE_IA_TRIAL,
  UMBRAL_AVISO_PRO_IA,
  UMBRAL_AVISO_TRIAL,
  calcularCostoUsdIA,
  evaluarCupoIA,
  inicioMesColombiaISO,
  obtenerValidacionesSesionIA,
  registrarUsoIA,
  reiniciarValidacionesSesionIA,
  verificarCupoIA,
} from '../lib/ia/uso';
import { IANoDisponibleError, analizarCabello } from '../lib/hairAnalysis';

describe('lib/ia/uso · cálculo de costo en USD (Claude Sonnet 4.6)', () => {
  it('calcula US$3/M de entrada y US$15/M de salida', () => {
    expect(calcularCostoUsdIA(1_000_000, 0)).toBe(3);
    expect(calcularCostoUsdIA(0, 1_000_000)).toBe(15);
    expect(calcularCostoUsdIA(1_000_000, 1_000_000)).toBe(18);
  });

  it('reproduce los costos medidos en docs/velli-bi/01-costo-ia.md (§3 y §4)', () => {
    // Análisis con 3 fotos de cámara: 4.361 entrada + 110 salida = US$0,014733
    const costoAnalisis = calcularCostoUsdIA(4361, 110);
    expect(costoAnalisis).toBe(0.014733);

    // Validación con 3 fotos de cámara: 3.923 entrada + 81 salida = US$0,012984
    const costoValidacion = calcularCostoUsdIA(3923, 81);
    expect(costoValidacion).toBe(0.012984);

    // Escenario A típico (validación + análisis): ~US$0,0277
    expect(Number((costoAnalisis + costoValidacion).toFixed(4))).toBe(0.0277);
  });

  it('maneja valores nulos, indefinidos o negativos devolviendo 0', () => {
    expect(calcularCostoUsdIA(null, undefined)).toBe(0);
    expect(calcularCostoUsdIA(-100, -50)).toBe(0);
  });

  it('calcula el inicio de mes en hora de Colombia (America/Bogota, UTC-5)', () => {
    // 2026-10-01 02:00 UTC sigue siendo 2026-09-30 21:00 en Colombia → inicio de septiembre
    const finSeptiembreColombia = new Date('2026-10-01T02:00:00.000Z');
    expect(inicioMesColombiaISO(finSeptiembreColombia)).toBe('2026-09-01T05:00:00.000Z');

    // 2026-10-01 06:00 UTC ya es 2026-10-01 01:00 en Colombia → inicio de octubre
    const inicioOctubreColombia = new Date('2026-10-01T06:00:00.000Z');
    expect(inicioMesColombiaISO(inicioOctubreColombia)).toBe('2026-10-01T05:00:00.000Z');
  });
});

describe('lib/ia/uso · reglas de cupo por plan y estado (D1, P3)', () => {
  beforeEach(() => {
    reiniciarValidacionesSesionIA();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sentry.captureException.mockClear();
  });

  it('bloquea planes basico y pro fuera de la prueba gratis con PLAN_SIN_IA', async () => {
    const basico = await verificarCupoIA('user-basico', {
      suscripcion: { estado: 'active', plan: 'basico' },
      usados: 0,
    });
    expect(basico.permitido).toBe(false);
    expect(basico.motivo).toBe('plan_sin_ia');
    expect(basico.codigo).toBe('PLAN_SIN_IA');
    expect(basico.tope).toBe(0);
    expect(basico.restantes).toBe(0);

    const pro = await verificarCupoIA('user-pro', {
      suscripcion: { estado: 'active', plan: 'pro' },
      usados: 5,
    });
    expect(pro.permitido).toBe(false);
    expect(pro.motivo).toBe('plan_sin_ia');
    expect(pro.codigo).toBe('PLAN_SIN_IA');
  });

  it('aplica tope de 20 análisis en prueba gratis (trialing) y aviso al 80% (16 análisis)', async () => {
    expect(TOPE_IA_TRIAL).toBe(20);
    expect(UMBRAL_AVISO_TRIAL).toBe(16);

    const enQuince = await verificarCupoIA('user-trial', {
      suscripcion: { estado: 'trialing', plan: null },
      usados: 15,
    });
    expect(enQuince).toMatchObject({
      permitido: true,
      usados: 15,
      tope: 20,
      restantes: 5,
      avisoOchentaPorCiento: false,
    });

    const enDieciseis = await verificarCupoIA('user-trial', {
      suscripcion: { estado: 'trialing', plan: null },
      usados: 16,
    });
    expect(enDieciseis).toMatchObject({
      permitido: true,
      usados: 16,
      tope: 20,
      restantes: 4,
      avisoOchentaPorCiento: true,
    });

    const agotado = await verificarCupoIA('user-trial', {
      suscripcion: { estado: 'trialing', plan: null },
      usados: 20,
    });
    expect(agotado).toMatchObject({
      permitido: false,
      motivo: 'tope_ia_alcanzado',
      codigo: 'TOPE_IA_ALCANZADO',
      usados: 20,
      tope: 20,
      restantes: 0,
      avisoOchentaPorCiento: true,
    });
  });

  it('aplica tope de 150 análisis/mes en Pro+IA y activa aviso al 80% en 120 análisis', async () => {
    expect(TOPE_IA_PRO_IA).toBe(150);
    expect(UMBRAL_AVISO_PRO_IA).toBe(120);

    const antesDelAviso = evaluarCupoIA({
      estado: 'active',
      plan: 'pro_ia',
      usados: 119,
    });
    expect(antesDelAviso).toMatchObject({
      permitido: true,
      usados: 119,
      tope: 150,
      restantes: 31,
      avisoOchentaPorCiento: false,
    });

    const enCientoVeinte = evaluarCupoIA({
      estado: 'active',
      plan: 'pro_ia',
      usados: 120,
    });
    expect(enCientoVeinte).toMatchObject({
      permitido: true,
      usados: 120,
      tope: 150,
      restantes: 30,
      avisoOchentaPorCiento: true,
    });

    const enTope = evaluarCupoIA({
      estado: 'active',
      plan: 'pro_ia',
      usados: 150,
    });
    expect(enTope).toMatchObject({
      permitido: false,
      motivo: 'tope_ia_alcanzado',
      codigo: 'TOPE_IA_ALCANZADO',
      usados: 150,
      tope: 150,
      restantes: 0,
      avisoOchentaPorCiento: true,
    });
  });

  it('permite máximo 2 llamadas a validar por análisis y reinicia el conteo tras analizar', async () => {
    expect(MAX_VALIDACIONES_POR_ANALISIS).toBe(2);
    const userId = 'estilista-val';

    // 1ª validación permitida
    const v1 = await verificarCupoIA(userId, {
      ruta: 'validar',
      suscripcion: { estado: 'active', plan: 'pro_ia' },
      usados: 10,
    });
    expect(v1.permitido).toBe(true);
    await registrarUsoIA({
      userId,
      ruta: 'validar',
      fotos: 3,
      tokensEntrada: 3923,
      tokensSalida: 81,
      ok: true,
    });

    // 2ª validación permitida
    const v2 = await verificarCupoIA(userId, {
      ruta: 'validar',
      suscripcion: { estado: 'active', plan: 'pro_ia' },
      usados: 10,
    });
    expect(v2.permitido).toBe(true);
    await registrarUsoIA({
      userId,
      ruta: 'validar',
      fotos: 3,
      tokensEntrada: 3923,
      tokensSalida: 81,
      ok: true,
    });
    expect(obtenerValidacionesSesionIA(userId)).toBe(2);

    // 3ª validación consecutiva bloqueada
    const v3 = await verificarCupoIA(userId, {
      ruta: 'validar',
      suscripcion: { estado: 'active', plan: 'pro_ia' },
      usados: 10,
    });
    expect(v3.permitido).toBe(false);
    expect(v3.motivo).toBe('tope_validaciones_alcanzado');
    expect(v3.codigo).toBe('TOPE_IA_ALCANZADO');

    // Al ejecutar analizar, el contador de validaciones se reinicia
    await registrarUsoIA({
      userId,
      ruta: 'analizar',
      fotos: 3,
      tokensEntrada: 4361,
      tokensSalida: 110,
      ok: true,
    });
    expect(obtenerValidacionesSesionIA(userId)).toBe(0);
  });
});

describe('lib/ia/uso · registrarUsoIA y tolerancia pre-migración', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sentry.captureException.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserta en public.uso_ia con el costo calculado en USD', async () => {
    const filasInsertadas: unknown[] = [];
    const mockAdmin = {
      from: (tabla: string) => {
        expect(tabla).toBe('uso_ia');
        return {
          insert: async (fila: unknown) => {
            filasInsertadas.push(fila);
            return { error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    const res = await registrarUsoIA(
      {
        userId: 'user-123',
        ruta: 'analizar',
        fotos: 3,
        tokensEntrada: 4361,
        tokensSalida: 110,
        ok: true,
      },
      { adminClient: mockAdmin }
    );

    expect(res).toEqual({
      registrado: true,
      costoUsd: 0.014733,
    });
    expect(filasInsertadas).toEqual([
      {
        user_id: 'user-123',
        ruta: 'analizar',
        proveedor: 'anthropic',
        modelo: MODELO_CLAUDE_IA,
        fotos: 3,
        tokens_entrada: 4361,
        tokens_salida: 110,
        costo_usd: 0.014733,
        ok: true,
      },
    ]);
  });

  it('no rompe el flujo y reporta a Sentry si la tabla uso_ia aún no existe', async () => {
    const mockAdmin = {
      from: () => ({
        insert: async () => ({
          error: { code: '42P01', message: 'relation "public.uso_ia" does not exist' },
        }),
      }),
    } as unknown as SupabaseClient;

    const res = await registrarUsoIA(
      {
        userId: 'user-123',
        ruta: 'analizar',
        fotos: 3,
        tokensEntrada: 4000,
        tokensSalida: 100,
        ok: true,
      },
      { adminClient: mockAdmin }
    );

    expect(res.registrado).toBe(false);
    expect(res.costoUsd).toBe(0.0135);
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });
});

describe('analizarCabello · manejo de PLAN_SIN_IA y TOPE_IA_ALCANZADO en cliente', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('convierte 403 PLAN_SIN_IA en IANoDisponibleError con motivo plan_sin_ia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: 'Tu plan actual no incluye análisis con IA por foto.',
            codigo: 'PLAN_SIN_IA',
          },
          { status: 403 }
        )
      )
    );

    await expect(
      analizarCabello(['data:image/webp;base64,AAAA'], 'seco_natural', ['frontal'])
    ).rejects.toMatchObject({
      name: 'IANoDisponibleError',
      motivo: 'plan_sin_ia',
      codigo: 'PLAN_SIN_IA',
    } satisfies Partial<IANoDisponibleError>);
  });

  it('convierte 429 TOPE_IA_ALCANZADO en IANoDisponibleError con motivo tope_ia_alcanzado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: 'Llegaste al tope de 150 análisis con IA de este mes.',
            codigo: 'TOPE_IA_ALCANZADO',
          },
          { status: 429 }
        )
      )
    );

    await expect(
      analizarCabello(['data:image/webp;base64,AAAA'], 'seco_natural', ['frontal'])
    ).rejects.toMatchObject({
      name: 'IANoDisponibleError',
      motivo: 'tope_ia_alcanzado',
      codigo: 'TOPE_IA_ALCANZADO',
    } satisfies Partial<IANoDisponibleError>);
  });
});
