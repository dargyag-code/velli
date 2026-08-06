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
  DIMENSIONES_CORTES, FILAS_CORTES, FLUJOS_CORTES, FLUJO_CRECIMIENTO,
  REGLAS_CORTES, dimensionAPregunta, fichaAFila,
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

// ═══ PR-05 · el wizard captura el dato y la matriz lo veta ══════════════

describe('flujo del wizard para remolinos y dirección de crecimiento', () => {
  it('es transversal: aplica a cualquier tipo de cabello', () => {
    expect(FLUJO_CRECIMIENTO.tiposCabello).toBeNull();
    expect(FLUJOS_CORTES).toHaveLength(1);
  });

  it('entra en borrador, como todo el contenido nuevo', () => {
    expect(FLUJO_CRECIMIENTO.estado).toBe('borrador');
  });

  it('sus preguntas se derivan de las dimensiones, sin duplicar definiciones', () => {
    const preguntas = FLUJO_CRECIMIENTO.definicion.preguntas;
    expect(preguntas).toHaveLength(DIMENSIONES_CORTES.length);
    for (const [i, d] of DIMENSIONES_CORTES.entries()) {
      expect(preguntas[i].clave).toBe(d.clave);
      expect(preguntas[i].etiqueta).toBe(d.etiqueta);
      expect(preguntas[i].tipo).toBe(d.tipo);
      expect(preguntas[i].opciones).toEqual(d.opciones);
    }
  });

  it('TODAS las preguntas son opcionales: el dato no se le exige a nadie', () => {
    for (const p of FLUJO_CRECIMIENTO.definicion.preguntas) {
      expect(p.opcional, p.clave).toBe(true);
    }
  });

  it('las claves del flujo coinciden con las que lee la matriz', () => {
    const claves = FLUJO_CRECIMIENTO.definicion.preguntas.map((p) => p.clave);
    expect(claves).toEqual([
      CLAVE_REMOLINO_FRONTAL, CLAVE_REMOLINO_CORONILLA, CLAVE_DIRECCION_CRECIMIENTO,
    ]);
  });

  it('dimensionAPregunta arrastra la descripción como ayuda de cabina', () => {
    const p = dimensionAPregunta(DIMENSIONES_CORTES[0]);
    expect(p.ayuda).toBe(DIMENSIONES_CORTES[0].descripcion);
  });
});

describe('el veto de PR-05 solo actúa cuando hay dato', () => {
  // Shag (W-04) depende de flequillo: es el corte que el remolino frontal veta.
  const sesion = {
    formaRostro: 'alargado' as const,
    toleranciaMantenimiento: 'alta' as const,
  };
  const claves = (perfil?: Record<string, unknown>) =>
    recomendarCortes({
      diagnostico: diagnosticoDesdeConsulta(
        consultaBase({ tipoRizoPrincipal: '2B', perfilExtendido: perfil })
      ),
      sesion,
      top: 16,
    });

  it('SIN dato: la matriz se comporta como antes — W-04 sigue disponible', () => {
    const r = claves(undefined);
    expect(r.recomendaciones.map((x) => x.ficha.clave)).toContain('W-04');
    expect(r.descartados.map((d) => d.clave)).not.toContain('W-04');
    expect(r.advertencias).toEqual([]);
  });

  it('con perfil extendido pero SIN estas preguntas: tampoco veta', () => {
    const r = claves({ estadoCanas: 'sin_canas', otraCosa: true });
    expect(r.recomendaciones.map((x) => x.ficha.clave)).toContain('W-04');
  });

  it('CON dato afirmativo: el veto actúa y explica el motivo', () => {
    const r = claves({ [CLAVE_REMOLINO_FRONTAL]: true });
    expect(r.recomendaciones.map((x) => x.ficha.clave)).not.toContain('W-04');
    expect(r.descartados.find((d) => d.clave === 'W-04')!.motivo).toMatch(/remolino frontal/i);
  });

  it('CON dato negativo: hay dato, pero no veta nada', () => {
    const r = claves({ [CLAVE_REMOLINO_FRONTAL]: false, [CLAVE_REMOLINO_CORONILLA]: false });
    expect(r.recomendaciones.map((x) => x.ficha.clave)).toContain('W-04');
    expect(r.descartados.map((d) => d.clave)).not.toContain('W-04');
  });

  it('un "no" explícito SÍ se conserva como dato observado', () => {
    // "No tiene remolino" y "no lo miramos" son cosas distintas en la ficha.
    const c = crecimientoDesdePerfil({ [CLAVE_REMOLINO_FRONTAL]: false });
    expect(c).toBeDefined();
    expect(c!.remolinoFrontal).toBe(false);
  });

  it('sin ninguna de las tres claves no hay dato', () => {
    expect(crecimientoDesdePerfil({})).toBeUndefined();
    expect(crecimientoDesdePerfil({ estadoCanas: 'mas_50' })).toBeUndefined();
  });

  it('una dirección vacía o inválida no cuenta como dato', () => {
    expect(crecimientoDesdePerfil({ [CLAVE_DIRECCION_CRECIMIENTO]: '' })).toBeUndefined();
    expect(crecimientoDesdePerfil({ [CLAVE_DIRECCION_CRECIMIENTO]: 'inventada' })).toBeUndefined();
  });

  it('la dirección sola basta para que haya dato y para vetar', () => {
    const r = claves({ [CLAVE_DIRECCION_CRECIMIENTO]: 'hacia_atras' });
    expect(r.recomendaciones.map((x) => x.ficha.clave)).not.toContain('W-04');
  });

  it('el remolino de coronilla advierte sin sacar el corte del top', () => {
    const r = claves({ [CLAVE_REMOLINO_CORONILLA]: true });
    expect(r.advertencias.length).toBeGreaterThan(0);
    expect(r.advertencias.join(' ')).toMatch(/raya/i);
    // W-02 declara raya y sigue siendo recomendable.
    expect(r.descartados.map((d) => d.clave)).not.toContain('W-02');
  });

  it('el dato viaja del wizard a la matriz sin transformación intermedia', () => {
    // Lo que PreguntasFlujo guarda para un booleano es true/false directo.
    const dx = diagnosticoDesdeConsulta(
      consultaBase({
        perfilExtendido: {
          [CLAVE_REMOLINO_FRONTAL]: true,
          [CLAVE_REMOLINO_CORONILLA]: false,
          [CLAVE_DIRECCION_CRECIMIENTO]: 'lateral',
        },
      })
    );
    expect(dx.crecimiento).toEqual({
      remolinoFrontal: true, remolinoCoronilla: false, direccion: 'lateral',
    });
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
