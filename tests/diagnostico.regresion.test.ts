// ══════════════════════════════════════════════════════════════════════════
// Prueba de regresión: motor legacy vs knowledge base.
//
// generateDiagnosis (lib/diagnosticEngine.ts) y el evaluador genérico con
// el seed canónico (lib/kb/seed/reglasRizado.ts) deben producir EXACTAMENTE
// el mismo ResultadoConsulta para cualquier perfil de clienta. Esta prueba
// es la definición de terminado de la migración a datos: si está en verde,
// los salones en producción siguen diagnosticando idéntico a hoy.
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { WizardData, WIZARD_INITIAL_DATA } from '../lib/types';
import { generateDiagnosis, SaludClienta } from '../lib/diagnosticEngine';
import { evaluarDiagnostico } from '../lib/kb/evaluador';
import { REGLAS_RIZADO } from '../lib/kb/seed/reglasRizado';

function perfil(overrides: Partial<WizardData>): WizardData {
  return { ...WIZARD_INITIAL_DATA, nombre: 'Clienta Test', ...overrides };
}

function comparar(data: WizardData, salud?: SaludClienta) {
  const legacy = generateDiagnosis(data, salud);
  const kb = evaluarDiagnostico(REGLAS_RIZADO, data, salud);
  expect(kb).toEqual(legacy);
}

// ── Perfiles representativos (casos reales y bordes) ───────────────────────

const DANO_QUIMICO = 'Daño químico (decoloración, alisado)';
const DANO_TERMICO = 'Daño térmico (textura alterada por calor)';
const TRANSICION = 'En transición capilar (dos texturas visibles)';
const PUNTAS_SEVERAS = 'Puntas abiertas severas (necesita corte)';

describe('regresión: perfiles representativos', () => {
  it('rizada 3B con porosidad alta y frizz (perfil típico)', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '3B',
        porosidad: 'alta',
        densidad: 'media',
        grosor: 'medio',
        elasticidad: 'media',
        problemas: ['Frizz excesivo', 'Resequedad'],
      })
    );
  });

  it('afro 4C densidad alta con daño químico y puntas severas', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '4C',
        porosidad: 'alta',
        densidad: 'alta',
        elasticidad: 'baja',
        tipoDano: [DANO_QUIMICO],
        estadoPuntas: PUNTAS_SEVERAS,
        problemas: ['Caída excesiva'],
      })
    );
  });

  it('transición capilar con línea de demarcación', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '3C',
        tipoDano: [TRANSICION, DANO_QUIMICO],
        lineaDemarcacion: 'A la altura de las orejas',
        estadoCueroCabelludo: ['Build-up (acumulación de producto)'],
      })
    );
  });

  it('embarazo + estrés alto + caspa (datos de salud del perfil)', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '2C',
        porosidad: 'baja',
        estadoCueroCabelludo: ['Caspa seca', 'Graso (exceso de sebo)'],
      }),
      { embarazo: true, nivelEstres: 'alto' }
    );
  });

  it('modo express: solo tipo de rizo, todo lo demás default', () => {
    comparar(perfil({ tipoRizoPrincipal: '3A' }));
  });

  it('modo express sin tipo de rizo (cae al else afro del legacy)', () => {
    comparar(perfil({}));
  });

  it('liso 1B con balance equilibrado (mantenimiento)', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '1B',
        balanceHP: 'equilibrado',
        porosidad: 'media',
      })
    );
  });

  it('3B fino (shingling suave) vs 3B grueso (praying hands)', () => {
    comparar(perfil({ tipoRizoPrincipal: '3B', grosor: 'fino' }));
    comparar(perfil({ tipoRizoPrincipal: '3B', grosor: 'grueso' }));
  });

  it('4B con densidad media (finger coils) y daño térmico', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '4B',
        densidad: 'media',
        tipoDano: [DANO_TERMICO],
        estadoPuntas: 'Puntas abiertas leves',
      })
    );
  });

  it('"Sin daño visible" cuenta como daño para ingredientes (paridad de bug legacy)', () => {
    // El motor legacy trata tipoDano no vacío como hayDano aunque sea
    // 'Sin daño visible' — la KB replica ese comportamiento exacto.
    comparar(perfil({ tipoRizoPrincipal: '2A', tipoDano: ['Sin daño visible'] }));
  });

  it('dermatitis seborreica hoy NO deriva — solo nota (paridad)', () => {
    comparar(
      perfil({
        tipoRizoPrincipal: '3C',
        estadoCueroCabelludo: ['Dermatitis seborreica'],
      })
    );
  });
});

// ── Barrido exhaustivo de combinaciones ─────────────────────────────────────

describe('regresión: barrido de combinaciones', () => {
  const TIPOS = ['', '1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C', '4A', '4B', '4C'];
  const POROSIDADES = ['', 'baja', 'media', 'alta'];
  const ELASTICIDADES = ['', 'baja', 'media'];
  const BALANCES = ['', 'hidratacion', 'nutricion', 'proteina', 'equilibrado'];
  const DANOS: string[][] = [[], [DANO_QUIMICO], [DANO_TERMICO, TRANSICION], ['Sin daño visible']];
  const PUNTAS = ['', PUNTAS_SEVERAS];

  it('tipos × porosidad × elasticidad', () => {
    for (const tipo of TIPOS)
      for (const porosidad of POROSIDADES)
        for (const elasticidad of ELASTICIDADES)
          comparar(perfil({ tipoRizoPrincipal: tipo, porosidad, elasticidad }));
  });

  it('tipos × balanceHP × daño × puntas', () => {
    for (const tipo of TIPOS)
      for (const balanceHP of BALANCES)
        for (const tipoDano of DANOS)
          for (const estadoPuntas of PUNTAS)
            comparar(perfil({ tipoRizoPrincipal: tipo, balanceHP, tipoDano, estadoPuntas }));
  });

  it('densidad/grosor × tipos clave + cuero cabelludo y problemas', () => {
    const CUEROS: string[][] = [
      [],
      ['Graso (exceso de sebo)'],
      ['Caspa seca'],
      ['Build-up (acumulación de producto)', 'Seco / descamación'],
    ];
    const PROBLEMAS: string[][] = [[], ['Frizz excesivo'], ['Caída excesiva', 'Frizz excesivo']];
    for (const tipo of ['1A', '2B', '3B', '3C', '4B', '4C'])
      for (const densidad of ['baja', 'alta'])
        for (const grosor of ['fino', 'grueso'])
          for (const estadoCueroCabelludo of CUEROS)
            for (const problemas of PROBLEMAS)
              comparar(
                perfil({ tipoRizoPrincipal: tipo, densidad, grosor, estadoCueroCabelludo, problemas })
              );
  });

  it('salud de la clienta: embarazo × estrés × transición', () => {
    for (const embarazo of [false, true])
      for (const nivelEstres of ['', 'medio', 'alto'])
        for (const tipoDano of [[], [TRANSICION]])
          comparar(
            perfil({ tipoRizoPrincipal: '3B', tipoDano, lineaDemarcacion: tipoDano.length ? 'media melena' : '' }),
            { embarazo, nivelEstres }
          );
  });
});

// ── Regla de seguridad: bandera médica ──────────────────────────────────────

describe('seguridad: bandera médica deriva SIEMPRE', () => {
  it('señales de alopecia → derivación a dermatólogo, nunca plan', () => {
    const data = perfil({
      tipoRizoPrincipal: '1A',
      perfilExtendido: { senalesAlopecia: ['placas_sin_cabello'] },
    });
    const res = evaluarDiagnostico(REGLAS_RIZADO, data);
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
    expect(res.tratamientosAdicionales).toEqual([]);
    expect(res.cronograma.semana1).not.toMatch(/Hidratación|Nutrición|Reconstrucción/);
    expect(res.notasAdicionales[0]).toContain('DERIVACIÓN MÉDICA');
  });

  it('dermatitis severa (dimensión extendida) → derivación', () => {
    const data = perfil({
      tipoRizoPrincipal: '3B',
      porosidad: 'alta',
      perfilExtendido: { tipoCueroCabelludo: 'dermatitis_severa' },
    });
    const res = evaluarDiagnostico(REGLAS_RIZADO, data);
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
    expect(res.productosPonto).toEqual([]);
  });

  it('señales benignas NO derivan (sigue el plan normal)', () => {
    const data = perfil({
      tipoRizoPrincipal: '3B',
      perfilExtendido: { senalesAlopecia: ['sin_senales'], tipoCueroCabelludo: 'graso' },
    });
    const res = evaluarDiagnostico(REGLAS_RIZADO, data);
    expect(res.tratamientoPrincipal).not.toBe('Derivación a dermatólogo');
  });
});
