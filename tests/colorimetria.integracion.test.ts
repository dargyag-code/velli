// ══════════════════════════════════════════════════════════════════════════
// Sprint C · integración de la calculadora con lo ya construido.
//
// Verifica que el Sprint C CONSUME la capa legal en vez de duplicarla, y que
// el seed de la KB no driftea del motor que usa la calculadora.
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { calcularColor } from '../lib/color/calculadora';
import { diagnosticoDesdeConsulta } from '../lib/color/integracion';
import { evaluarConfirmacionCita, traducirErrorAgenda } from '../lib/agenda/reglas';
import { CO09_PROTOCOLO_VERBATIM, tramoCanas } from '../lib/color/reglas';
import { REGLAS_COLORIMETRIA, ESQUEMA_CARTA_MARCA } from '../lib/kb/seed/colorimetria';
import { TABLA_ALTURAS, OXIDANTES } from '../lib/color/tablas';
import { CONSENTIMIENTO_VERSIONES } from '../lib/legal';
import type { Consulta } from '../lib/types';

// ═══ Paridad con los bloqueos legales ════════════════════════════════════

describe('paridad: la calculadora exige lo mismo que citas_guard_legal', () => {
  const fecha = new Date('2026-09-01T10:00:00Z');
  const hace = (h: number) => new Date(fecha.getTime() - h * 3600_000).toISOString();

  it('los mismos datos que bloquean la cita bloquean el plan de decoloración', () => {
    const clienta = { nuevaEnColor: true, cambioMarcaQuimica: false };
    // 1) Lo que diría la agenda al confirmar.
    const bloqueosAgenda = evaluarConfirmacionCita({
      servicio: 'Decoloración / mechas',
      fechaCita: fecha,
      clienta,
      pruebas: [],
      consentimientos: [],
    });
    expect(bloqueosAgenda.map((b) => b.codigo).sort()).toEqual([
      'consentimiento_quimico', 'parche_sensibilidad',
    ]);

    // 2) La calculadora los recibe inyectados y NO muestra fórmula.
    const r = calcularColor({
      diagnostico: { elasticidad: 'alta', porosidad: 'media' },
      sesion: {
        nivelNatural: 5, nivelActualLargos: 4, pigmentoArtificial: true,
        nivelObjetivo: 6, temperatura: 'frio',
      },
      bloqueosLegales: bloqueosAgenda.map((b) => ({
        codigo: b.codigo,
        titulo: 'x',
        mensaje: b.mensaje,
        caminoPrevio: traducirErrorAgenda(
          b.codigo === 'parche_sensibilidad'
            ? 'PARCHE_SENSIBILIDAD_REQUERIDO'
            : 'CONSENTIMIENTO_QUIMICO_REQUERIDO'
        ),
      })),
    });
    expect(r.formula).toBeUndefined();
    expect(r.bloqueos.map((b) => b.codigo)).toEqual(
      expect.arrayContaining(['parche_sensibilidad', 'consentimiento_quimico'])
    );
  });

  it('resueltos los prerrequisitos, la calculadora deja pasar', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Decoloración / mechas',
      fechaCita: fecha,
      clienta: { nuevaEnColor: true },
      pruebas: [{ aplicadoAt: hace(50), resultado: 'negativo' }],
      consentimientos: [{
        tipo: 'consentimiento_quimico',
        versionAceptada: CONSENTIMIENTO_VERSIONES.consentimiento_quimico,
        aceptado: true,
      }],
    });
    expect(bloqueos).toEqual([]);

    const r = calcularColor({
      diagnostico: { elasticidad: 'alta', porosidad: 'media' },
      sesion: {
        nivelNatural: 5, nivelActualLargos: 4, pigmentoArtificial: true,
        nivelObjetivo: 6, temperatura: 'frio',
      },
      bloqueosLegales: [],
    });
    expect(r.bloqueos).toEqual([]);
    expect(r.formula).toBeDefined();
  });

  it('los mensajes accionables salen de traducirErrorAgenda (uno solo)', () => {
    expect(traducirErrorAgenda('PARCHE_SENSIBILIDAD_REQUERIDO')).toMatch(/ficha de la clienta/i);
    expect(traducirErrorAgenda('CONSENTIMIENTO_QUIMICO_REQUERIDO')).toMatch(/firmarlo en su ficha/i);
  });
});

// ═══ CO-02 · precarga del diagnóstico vigente ════════════════════════════

function consultaBase(over: Partial<Consulta> = {}): Consulta {
  return {
    id: 'c1', clientaId: 'x', fecha: '2026-08-01', numeroConsulta: 1,
    quimicos: [], usoCalor: [], frecuenciaCalor: '', usaProtectorTermico: false,
    frecuenciaLavado: '', metodoLavado: '', productosActuales: {}, problemas: [],
    tipoRizoPrincipal: '3B', estadoCueroCabelludo: [], tipoDano: [],
    embarazo: false, nivelEstres: '',
    resultado: {
      tratamientoPrincipal: 'Hidratación profunda', tratamientosAdicionales: [],
      cronograma: { semana1: '', semana2: '', semana3: '', semana4: '' },
      tecnicaDefinicion: '', tecnicaDescripcion: '', metodoSecado: '',
      productosPonto: [], cuidadoCasa: { diaLavado: [], nocturno: [], refresh: [], evitar: [] },
      intervaloSugerido: '', notasAdicionales: [],
    },
    ...over,
  };
}

describe('CO-02: la calculadora no se abre en blanco', () => {
  it('hereda porosidad y elasticidad del diagnóstico vigente', () => {
    const dx = diagnosticoDesdeConsulta(
      consultaBase({ porosidad: 'alta', elasticidad: 'baja' })
    );
    expect(dx.porosidad).toBe('alta');
    expect(dx.elasticidad).toBe('baja');
  });

  it('infiere sospecha de henna desde el historial químico declarado', () => {
    const dx = diagnosticoDesdeConsulta(
      consultaBase({ quimicos: ['Tinte natural con henna'] })
    );
    expect(dx.hennaOMetales).toBe('dudoso');
  });

  it('detecta historial de decoloración para CO-06 y CO-10', () => {
    const dx = diagnosticoDesdeConsulta(
      consultaBase({ quimicos: ['Decoloración / mechas'] })
    );
    expect(dx.historialDecoloracion).toBe(true);
  });

  it('un plan vigente de derivación levanta la bandera médica', () => {
    const dx = diagnosticoDesdeConsulta(
      consultaBase({
        resultado: {
          ...consultaBase().resultado,
          tratamientoPrincipal: 'Derivación a dermatólogo',
        },
      })
    );
    expect(dx.banderaMedicaActiva).toBe(true);
  });

  it('el cuero cabelludo comprometido llega como bloqueo A-06', () => {
    const dx = diagnosticoDesdeConsulta(
      consultaBase({ estadoCueroCabelludo: ['Dermatitis seborreica'] })
    );
    expect(dx.cueroCabelludoLesionado).toBe(true);
    const r = calcularColor({
      diagnostico: dx,
      sesion: { nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio' },
    });
    expect(r.bloqueos.map((b) => b.codigo)).toContain('cuero_lesionado');
  });

  it('sin consulta previa devuelve un diagnóstico vacío, no rompe', () => {
    expect(diagnosticoDesdeConsulta(undefined)).toEqual({});
  });
});

// ═══ Seed de la KB ═══════════════════════════════════════════════════════

describe('seed de colorimetría: en borrador y sin drift del motor', () => {
  it('TODO el contenido nuevo entra en estado borrador', () => {
    expect(REGLAS_COLORIMETRIA.length).toBeGreaterThan(0);
    for (const r of REGLAS_COLORIMETRIA) {
      expect(r.estado).toBe('borrador');
    }
  });

  it('las claves son únicas', () => {
    const claves = REGLAS_COLORIMETRIA.map((r) => r.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('hay una regla por nivel de la tabla de Keila', () => {
    for (const fila of TABLA_ALTURAS) {
      const regla = REGLAS_COLORIMETRIA.find((r) => r.clave === `color.altura.${fila.nivel}`);
      expect(regla, `falta color.altura.${fila.nivel}`).toBeDefined();
      const texto = (regla!.salida as { texto: string }).texto;
      // El seed no puede driftear de la tabla que usa la calculadora.
      expect(texto).toContain(fila.fondoAclaracion);
      expect(texto).toContain(fila.neutralizante);
      expect(texto).toContain(fila.denominacionLatam);
    }
  });

  it('hay una regla por oxidante', () => {
    for (const o of OXIDANTES) {
      expect(
        REGLAS_COLORIMETRIA.some((r) => r.clave === `color.oxidante.${o.volumen}`)
      ).toBe(true);
    }
  });

  it('están las diez reglas de oro CO-01 … CO-10', () => {
    for (let i = 1; i <= 10; i++) {
      const clave = `color.regla.co-${String(i).padStart(2, '0')}`;
      expect(
        REGLAS_COLORIMETRIA.some((r) => r.clave === clave),
        `falta ${clave}`
      ).toBe(true);
    }
  });

  it('CO-09 va VERBATIM en el seed', () => {
    const regla = REGLAS_COLORIMETRIA.find((r) => r.clave === 'color.regla.co-09')!;
    expect((regla.salida as { texto: string }).texto).toContain(CO09_PROTOCOLO_VERBATIM);
  });

  it('CO-05 lleva los tres tramos de Keila con el candado de 20 vol', () => {
    const texto = (
      REGLAS_COLORIMETRIA.find((r) => r.clave === 'color.regla.co-05')!.salida as { texto: string }
    ).texto;
    expect(texto).toContain(tramoCanas(30)!.descripcion);
    expect(texto).toContain(tramoCanas(60)!.descripcion);
    expect(texto).toContain(tramoCanas(90)!.descripcion);
    expect(texto).toMatch(/exclusivamente a 20 vol/i);
  });

  it('el esquema de carta por marca cubre los campos de la Entrega 3 §6', () => {
    const campos = ESQUEMA_CARTA_MARCA.map((c) => c.campo);
    expect(campos).toEqual(expect.arrayContaining([
      'marcaLinea', 'fuenteVersion', 'notacion', 'proporcionEstandar',
      'volumenesDisponibles', 'reglasCanas', 'superaclarantes',
      'tiempoPausaEstandar', 'particularidades',
    ]));
  });
});

// ═══ Migración de colorimetría ═══════════════════════════════════════════

describe('migración de servicios_color', () => {
  const sql = readFileSync(
    path.resolve(__dirname, '../supabase/migration-colorimetria.sql'),
    'utf8'
  );

  it('es idempotente', () => {
    expect(sql.match(/^CREATE TABLE (?!IF NOT EXISTS)/gm)).toBeNull();
    for (const [, p] of sql.matchAll(/CREATE POLICY (\w+)/g)) {
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS ${p}\\b`));
    }
  });

  it('tiene RLS por tenant y respeta la suscripción', () => {
    expect(sql).toMatch(/ALTER TABLE public\.servicios_color ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/servicios_color_select_own[\s\S]*?auth\.uid\(\)\) = user_id/);
    expect(sql).toMatch(/guard_suscripcion_servicios_color/);
  });

  it('guarda la fórmula FINAL, no la sugerida', () => {
    expect(sql).toMatch(/formula_final jsonb NOT NULL/);
    expect(sql).toMatch(/guia_razonamiento jsonb/);
  });
});
