// Feature flags de Velli BI (Fase 1 · Etapa 1): congelar = apagar y ocultar,
// nunca borrar. Estas pruebas fijan las decisiones de producto
// (docs/velli-bi/00-auditoria.md) para que ningún cambio encienda por
// accidente un módulo congelado.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ENTORNOS, FLAGS, FLAG_IDS, entornoActual, evaluarFlag, evaluarFlags,
  filtrarFlujos, flagsActivos, flujosOcultos, overridesDelEntorno,
  parsearFlagsEntorno, sanitizarFlagsSalon, type FlagsEvaluados,
} from '../lib/flags';
import { FLUJO_CRECIMIENTO } from '../lib/kb/seed/cortes';
import { PLANES, iaFacialHabilitada } from '../lib/subscription/plans';
import { featuresEfectivas } from '../lib/subscription/estado';

afterEach(() => {
  vi.unstubAllEnvs();
});

const todosApagados = (): FlagsEvaluados =>
  Object.fromEntries(FLAG_IDS.map((id) => [id, false])) as FlagsEvaluados;

describe('registro de flags', () => {
  it('todo módulo congelado o retirado está apagado por defecto en cada entorno', () => {
    for (const id of FLAG_IDS) {
      const def = FLAGS[id];
      if (def.estado === 'activo') continue;
      for (const entorno of ENTORNOS) {
        expect(evaluarFlag(id, { entorno }), `${id} en ${entorno}`).toBe(false);
      }
    }
  });

  it('refleja las decisiones de la Etapa 0 y el flag cotizador de la Etapa 3', () => {
    expect(FLAGS.cotizador.estado).toBe('activo');
    expect(evaluarFlag('cotizador', { entorno: 'production' })).toBe(false);
    expect(evaluarFlag('cotizador', { entorno: 'preview' })).toBe(true);
    expect(evaluarFlag('cotizador', { entorno: 'development' })).toBe(true);
    expect(
      evaluarFlag('cotizador', { entorno: 'production', salonOverrides: { cotizador: true } })
    ).toBe(true);

    expect(FLAGS.cortes.estado).toBe('congelado');
    expect(FLAGS.ia_facial.estado).toBe('congelado');
    expect(FLAGS.app_clientas.estado).toBe('congelado');
    expect(FLAGS.marketplace.estado).toBe('congelado');
    expect(FLAGS.cuentas_cadena.estado).toBe('congelado');
    expect(FLAGS.resenas_publicas.estado).toBe('retirado');
  });

  it('el flujo de remolinos que oculta cortes es el del seed de cortes', () => {
    expect(FLAGS.cortes.flujosKB).toContain(FLUJO_CRECIMIENTO.clave);
  });
});

describe('precedencia: salón > entorno > valor por defecto', () => {
  it('sin overrides rige el valor por defecto', () => {
    expect(evaluarFlag('cortes', { entorno: 'production' })).toBe(false);
  });

  it('el entorno puede encender un módulo congelado', () => {
    expect(
      evaluarFlag('cortes', { entorno: 'preview', entornoOverrides: { cortes: true } })
    ).toBe(true);
  });

  it('el salón gana al entorno en los dos sentidos', () => {
    expect(
      evaluarFlag('cortes', {
        entorno: 'production',
        entornoOverrides: { cortes: true },
        salonOverrides: { cortes: false },
      })
    ).toBe(false);
    expect(
      evaluarFlag('cortes', {
        entorno: 'production',
        entornoOverrides: { cortes: false },
        salonOverrides: { cortes: true },
      })
    ).toBe(true);
  });

  it('un flag retirado no se enciende con ningún override', () => {
    expect(
      evaluarFlag('resenas_publicas', {
        entorno: 'development',
        entornoOverrides: { resenas_publicas: true },
        salonOverrides: { resenas_publicas: true },
      })
    ).toBe(false);
  });

  it('evaluarFlags devuelve todos los ids', () => {
    expect(Object.keys(evaluarFlags({ entorno: 'test' })).sort()).toEqual([...FLAG_IDS].sort());
  });
});

describe('parsearFlagsEntorno (NEXT_PUBLIC_VELLI_FLAGS)', () => {
  it('lee on/off con espacios y mayúsculas', () => {
    expect(parsearFlagsEntorno(' cortes = ON , app_clientas=off ')).toEqual({
      cortes: true,
      app_clientas: false,
    });
  });

  it('acepta true/false, 1/0 y sí/no', () => {
    expect(parsearFlagsEntorno('cortes=true,ia_facial=1,marketplace=sí,app_clientas=no')).toEqual({
      cortes: true,
      ia_facial: true,
      marketplace: true,
      app_clientas: false,
    });
  });

  it('ignora ids desconocidos y valores que no entiende', () => {
    expect(parsearFlagsEntorno('desconocido=on,cortes=quizas,=on,cortes,,')).toEqual({});
  });

  it('vacío o ausente → sin overrides', () => {
    expect(parsearFlagsEntorno(undefined)).toEqual({});
    expect(parsearFlagsEntorno('')).toEqual({});
  });
});

describe('sanitizarFlagsSalon (profiles.feature_flags)', () => {
  it('conserva solo booleanos de flags conocidos', () => {
    expect(
      sanitizarFlagsSalon({ cortes: true, app_clientas: 'si', otro: true, marketplace: false })
    ).toEqual({ cortes: true, marketplace: false });
  });

  it('cualquier cosa que no sea un objeto → sin overrides', () => {
    expect(sanitizarFlagsSalon(null)).toEqual({});
    expect(sanitizarFlagsSalon(undefined)).toEqual({});
    expect(sanitizarFlagsSalon('{"cortes":true}')).toEqual({});
    expect(sanitizarFlagsSalon([true])).toEqual({});
  });
});

describe('flujos del asistente', () => {
  const flujos = [
    { clave: 'flujo.liso' },
    { clave: 'flujo.crecimiento' },
    { clave: 'flujo.canas' },
    { clave: 'flujo.cabina' },
  ];

  it('con cortes apagado se oculta el flujo de remolinos y nada más', () => {
    const ocultos = flujosOcultos(todosApagados());
    expect(ocultos).toEqual(['flujo.crecimiento']);
    expect(filtrarFlujos(flujos, ocultos).map((f) => f.clave)).toEqual([
      'flujo.liso',
      'flujo.canas',
      'flujo.cabina',
    ]);
  });

  it('con cortes encendido el flujo vuelve', () => {
    const flags = { ...todosApagados(), cortes: true };
    expect(flujosOcultos(flags)).toEqual([]);
    expect(filtrarFlujos(flujos, flujosOcultos(flags))).toEqual(flujos);
  });
});

describe('lectura del entorno', () => {
  it('en pruebas el entorno es test y todo lo congelado está apagado', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_VELLI_FLAGS', '');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_IA_FACIAL', '');
    expect(entornoActual()).toBe('test');
    expect(flagsActivos()).toEqual(todosApagados());
  });

  it('respeta el entorno de Vercel', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
    expect(entornoActual()).toBe('preview');
  });

  it('NEXT_PUBLIC_VELLI_FLAGS enciende un módulo y el override del salón lo vuelve a apagar', () => {
    vi.stubEnv('NEXT_PUBLIC_VELLI_FLAGS', 'cortes=on');
    expect(flagsActivos().cortes).toBe(true);
    expect(flagsActivos({ cortes: false }).cortes).toBe(false);
  });

  it('el flag previo NEXT_PUBLIC_FEATURE_IA_FACIAL sigue funcionando', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_IA_FACIAL', 'true');
    expect(overridesDelEntorno().ia_facial).toBe(true);
    expect(iaFacialHabilitada()).toBe(true);
  });

  it('un off explícito en NEXT_PUBLIC_VELLI_FLAGS gana al flag previo', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_IA_FACIAL', 'true');
    vi.stubEnv('NEXT_PUBLIC_VELLI_FLAGS', 'ia_facial=off');
    expect(iaFacialHabilitada()).toBe(false);
  });
});

describe('planes', () => {
  it('ningún beneficio promete un módulo congelado o retirado', () => {
    const vetadas = /facial|corte|pasaporte|marketplace|reseña|cadena/i;
    for (const plan of Object.values(PLANES)) {
      for (const b of plan.beneficios) {
        expect(b, `${plan.id}: ${b}`).not.toMatch(vetadas);
      }
    }
  });

  it('la prueba gratis no enciende la IA facial mientras el flag esté apagado', () => {
    vi.stubEnv('NEXT_PUBLIC_VELLI_FLAGS', '');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_IA_FACIAL', '');
    const features = featuresEfectivas({
      estado: 'trialing',
      plan: null,
      vence: null,
      diasRestantes: 10,
    });
    expect(features.iaFacial).toBe(false);
  });

  it('los precios no cambiaron', () => {
    expect(PLANES.basico.precioCop).toBe(25_000);
    expect(PLANES.pro.precioCop).toBe(60_000);
    expect(PLANES.pro_ia.precioCop).toBe(120_000);
  });
});

describe('migraciones de perfil (borradores)', () => {
  // Viven en supabase/ hasta aplicarse y luego pasan a _archive/: el test
  // las sigue en los dos sitios, como el de gobernanza.
  const leer = (archivo: string) => {
    const candidatos = [
      path.resolve(__dirname, `../supabase/${archivo}`),
      path.resolve(__dirname, `../supabase/_archive/${archivo}`),
    ];
    const encontrada = candidatos.find((c) => existsSync(c));
    if (!encontrada) throw new Error(`No se encontró ${archivo} en supabase/ ni en supabase/_archive/`);
    return readFileSync(encontrada, 'utf8');
  };

  const guardia = (sql: string): string => {
    const m = sql.match(/-- >>> guardia-perfil[^\n]*\n([\s\S]*?)-- <<< guardia-perfil/);
    if (!m) throw new Error('bloque guardia-perfil no encontrado');
    return m[1].trim();
  };

  it('las dos migraciones traen la misma guardia: se aplican en cualquier orden', () => {
    expect(guardia(leer('migration-feature-flags.sql'))).toBe(
      guardia(leer('migration-proteger-perfil.sql'))
    );
  });

  it('la guardia protege rol, es_fundadora y feature_flags en INSERT y UPDATE', () => {
    const g = guardia(leer('migration-proteger-perfil.sql'));
    expect(g).toContain('NEW.rol IS DISTINCT FROM OLD.rol');
    expect(g).toContain('NEW.es_fundadora IS DISTINCT FROM OLD.es_fundadora');
    expect(g).toContain("(to_jsonb(NEW) -> 'feature_flags') IS DISTINCT FROM (to_jsonb(OLD) -> 'feature_flags')");
    expect(g).toContain('BEFORE INSERT OR UPDATE ON public.profiles');
    expect(g).toContain('(SELECT auth.uid()) IS NULL');
  });
});
