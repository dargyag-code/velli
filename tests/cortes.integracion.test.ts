// ══════════════════════════════════════════════════════════════════════════
// Módulo de cortes · integración con lo ya construido y seed de la KB.
//
// Verifica que el módulo CONSUME el diagnóstico y la agenda existentes en vez
// de duplicarlos, que el contenido nuevo entra en BORRADOR, y que el seed de
// colorimetría ya no usa el segmento que contamina el diagnóstico.
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  crecimientoDesdePerfil, diagnosticoDesdeConsulta,
  CLAVE_DIRECCION_CRECIMIENTO, CLAVE_REMOLINO_CORONILLA, CLAVE_REMOLINO_FRONTAL,
} from '../lib/cortes/integracion';
import { rowToFicha, type CorteKBRow } from '../lib/cortes/catalogo';
import {
  DIMENSIONES_CORTES, FILAS_CORTES, REGLAS_CORTES, fichaAFila,
} from '../lib/kb/seed/cortes';
import { REGLAS_COLORIMETRIA } from '../lib/kb/seed/colorimetria';
import { FICHAS_CORTE, fichaPorClave } from '../lib/cortes/fichas';
import { auditarLenguaje } from '../lib/cortes/lenguaje';
import { recomendarCortes } from '../lib/cortes/matriz';
import type { Consulta } from '../lib/types';

function consultaBase(over: Partial<Consulta> = {}): Consulta {
  return {
    id: 'c1', clientaId: 'x', fecha: '2026-09-01', numeroConsulta: 1,
    quimicos: [], usoCalor: [], frecuenciaCalor: '', usaProtectorTermico: false,
    frecuenciaLavado: '', metodoLavado: '', productosActuales: {}, problemas: [],
    tipoRizoPrincipal: '3B', estadoCueroCabelludo: [], tipoDano: [],
    embarazo: false, nivelEstres: '',
    resultado: {
      tratamientoPrincipal: '', tratamientosAdicionales: [],
      cronograma: { semana1: '', semana2: '', semana3: '', semana4: '' },
      tecnicaDefinicion: '', tecnicaDescripcion: '', metodoSecado: '',
      productosPonto: [], cuidadoCasa: { diaLavado: [], nocturno: [], refresh: [], evitar: [] },
      intervaloSugerido: '', notasAdicionales: [],
    },
    ...over,
  };
}

// ═══ Precarga del diagnóstico ════════════════════════════════════════════

describe('la matriz consume el diagnóstico vigente, no lo repregunta', () => {
  it('hereda tipo, densidad y grosor', () => {
    const dx = diagnosticoDesdeConsulta(
      consultaBase({ tipoRizoPrincipal: '4C', densidad: 'alta', grosor: 'fino' })
    );
    expect(dx.tipoCabello).toBe('4C');
    expect(dx.densidad).toBe('alta');
    expect(dx.grosor).toBe('fino');
  });

  it('marca encogimiento alto en tipo 4 (T4-01)', () => {
    expect(diagnosticoDesdeConsulta(consultaBase({ tipoRizoPrincipal: '4A' })).encogimientoAlto).toBe(true);
    expect(diagnosticoDesdeConsulta(consultaBase({ tipoRizoPrincipal: '2B' })).encogimientoAlto).toBe(false);
  });

  it('el dato de remolinos viaja en perfil_extendido, sin columna nueva', () => {
    const dx = diagnosticoDesdeConsulta(consultaBase({
      perfilExtendido: {
        [CLAVE_REMOLINO_FRONTAL]: true,
        [CLAVE_REMOLINO_CORONILLA]: false,
        [CLAVE_DIRECCION_CRECIMIENTO]: 'hacia_atras',
      },
    }));
    expect(dx.crecimiento).toEqual({
      remolinoFrontal: true,
      remolinoCoronilla: false,
      direccion: 'hacia_atras',
    });
  });

  it('sin datos de crecimiento devuelve undefined, no un objeto vacío', () => {
    expect(crecimientoDesdePerfil({})).toBeUndefined();
    expect(crecimientoDesdePerfil(undefined)).toBeUndefined();
  });

  it('ignora una dirección desconocida en lugar de propagarla', () => {
    const c = crecimientoDesdePerfil({
      [CLAVE_REMOLINO_FRONTAL]: true,
      [CLAVE_DIRECCION_CRECIMIENTO]: 'diagonal_inventada',
    });
    expect(c?.direccion).toBeUndefined();
  });

  it('el diagnóstico precargado llega hasta el filtro duro', () => {
    const dx = diagnosticoDesdeConsulta(consultaBase({ tipoRizoPrincipal: '1A' }));
    const r = recomendarCortes({
      diagnostico: dx,
      sesion: { formaRostro: 'ovalado', toleranciaMantenimiento: 'alta' },
      top: 16,
    });
    // W-07 es incompatible con patrón 1: no aparece.
    expect(r.recomendaciones.map((x) => x.ficha.clave)).not.toContain('W-07');
  });
});

// ═══ Ida y vuelta con kb_cortes ══════════════════════════════════════════

describe('las fichas sobreviven el viaje a la DB y de vuelta', () => {
  it('fichaAFila y rowToFicha son inversas', () => {
    for (const original of FICHAS_CORTE) {
      const fila = fichaAFila(original);
      const row: CorteKBRow = {
        id: 'x', clave: fila.clave, locale: fila.locale, nombre: fila.nombre,
        largo: fila.largo as never, capas: fila.capas as never,
        densidad_ideal: fila.densidad_ideal, textura: fila.textura,
        etiqueta_genero: fila.etiqueta_genero as never,
        ficha: fila.ficha as never,
        ciclo_semanas_min: fila.ciclo_semanas_min,
        ciclo_semanas_max: fila.ciclo_semanas_max,
        estado: 'publicada', version: 1, notas_internas: fila.notas_internas,
      };
      const reconstruida = rowToFicha(row);
      expect(reconstruida.clave).toBe(original.clave);
      expect(reconstruida.nombre).toBe(original.nombre);
      expect(reconstruida.largo).toBe(original.largo);
      expect(reconstruida.capas).toBe(original.capas);
      expect(reconstruida.cicloSemanas).toEqual(original.cicloSemanas);
      expect(reconstruida.compatibilidad).toEqual(original.compatibilidad);
      expect(reconstruida.rostrosFavorece).toEqual(original.rostrosFavorece);
    }
  });

  it('una ficha reconstruida desde la DB funciona en la matriz', () => {
    const fichas = FILAS_CORTES.map((f) => rowToFicha({
      id: 'x', clave: f.clave, locale: f.locale, nombre: f.nombre,
      largo: f.largo as never, capas: f.capas as never,
      densidad_ideal: f.densidad_ideal, textura: f.textura,
      etiqueta_genero: f.etiqueta_genero as never, ficha: f.ficha as never,
      ciclo_semanas_min: f.ciclo_semanas_min, ciclo_semanas_max: f.ciclo_semanas_max,
      estado: 'publicada', version: 1, notas_internas: f.notas_internas,
    }));
    const r = recomendarCortes({
      diagnostico: { tipoCabello: '3B' },
      sesion: { formaRostro: 'redondo', toleranciaMantenimiento: 'media' },
      catalogo: fichas,
    });
    expect(r.recomendaciones.length).toBe(3);
    expect(auditarLenguaje(r)).toEqual([]);
  });
});

// ═══ Seed en borrador ════════════════════════════════════════════════════

describe('seed de cortes: todo en borrador y sin lenguaje vetado', () => {
  it('las reglas de referencia entran en borrador', () => {
    expect(REGLAS_CORTES.length).toBeGreaterThan(0);
    for (const r of REGLAS_CORTES) expect(r.estado).toBe('borrador');
  });

  it('las 16 fichas entran en borrador', () => {
    expect(FILAS_CORTES).toHaveLength(16);
    for (const f of FILAS_CORTES) expect(f.estado).toBe('borrador');
  });

  it('la dimensión nueva de remolinos entra en borrador', () => {
    expect(DIMENSIONES_CORTES).toHaveLength(3);
    for (const d of DIMENSIONES_CORTES) expect(d.estado).toBe('borrador');
    expect(DIMENSIONES_CORTES.map((d) => d.clave)).toEqual([
      CLAVE_REMOLINO_FRONTAL, CLAVE_REMOLINO_CORONILLA, CLAVE_DIRECCION_CRECIMIENTO,
    ]);
  });

  it('están los seis principios PR-01 … PR-06', () => {
    for (let i = 1; i <= 6; i++) {
      const clave = `corte.principio.pr-0${i}`;
      expect(REGLAS_CORTES.some((r) => r.clave === clave), `falta ${clave}`).toBe(true);
    }
  });

  it('el seed usa el segmento de referencia, que el evaluador ignora', () => {
    for (const r of REGLAS_CORTES) expect(r.segmento).toBe('referencia_corte');
  });

  it('NINGÚN texto del seed contiene lenguaje vetado', () => {
    const hallazgos = auditarLenguaje([REGLAS_CORTES, FILAS_CORTES, DIMENSIONES_CORTES]);
    expect(hallazgos, JSON.stringify(hallazgos, null, 2)).toEqual([]);
  });
});

// ═══ Regresión del bug de colorimetría ═══════════════════════════════════

describe('el seed de colorimetría ya no contamina el diagnóstico', () => {
  it('NINGUNA regla de colorimetría usa el segmento config', () => {
    // Con segmento 'config' + campo disclaimerProductos, publicar el seed
    // habría reemplazado el disclaimer de productos de TODOS los
    // diagnósticos: el evaluador toma la primera regla config que matchea.
    for (const r of REGLAS_COLORIMETRIA) {
      expect(r.segmento, r.clave).toBe('referencia_color');
    }
  });

  it('ninguna salida de colorimetría declara el campo disclaimerProductos', () => {
    for (const r of REGLAS_COLORIMETRIA) {
      expect((r.salida as unknown as Record<string, unknown>).campo, r.clave).toBeUndefined();
    }
  });
});
