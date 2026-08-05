// ══════════════════════════════════════════════════════════════════════════
// Módulo de cortes — matriz de recomendación (Entrega 5, con las respuestas
// 4 y 5 de Keila mandando sobre la entrega).
//
// El test más importante de este archivo es el de LENGUAJE: audita que
// ninguna salida de la matriz contenga términos punitivos o de corrección.
// Es la política lingüística de Keila (§5.1) y, en sus palabras, "aquí se
// juega la diferencia entre una app que empodera y una que acompleja".
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  compatibilidadPara, puntuarPorRostro, recomendarCortes, toleraMantenimiento,
  vetoRemolinos,
} from '../lib/cortes/matriz';
import { FICHAS_CORTE, GUIA_ROSTROS, fichaPorClave } from '../lib/cortes/fichas';
import {
  auditarLenguaje, lenguajeEsValido, terminosVetadosEn, VERBOS_PERMITIDOS,
} from '../lib/cortes/lenguaje';
import {
  fechaSugeridaRetoque, proponerRetoque, servicioMantenimiento,
} from '../lib/cortes/preagenda';
import { clasificarServicio, duracionBloqueoTipo4 } from '../lib/agenda/reglas';
import { FORMAS_ROSTRO, type EntradaSesionCorte } from '../lib/cortes/tipos';

const SESION_BASE: EntradaSesionCorte = {
  formaRostro: 'ovalado',
  toleranciaMantenimiento: 'media',
};

// ═══ Catálogo: decisión de Keila (respuesta 5) ═══════════════════════════

describe('catálogo único indexado por atributos arquitectónicos', () => {
  it('tiene las 16 fichas semilla (W-01..W-08, M-01..M-08)', () => {
    expect(FICHAS_CORTE).toHaveLength(16);
    for (let i = 1; i <= 8; i++) {
      expect(fichaPorClave(`W-0${i}`), `falta W-0${i}`).toBeDefined();
      expect(fichaPorClave(`M-0${i}`), `falta M-0${i}`).toBeDefined();
    }
  });

  it('cada ficha declara sus atributos arquitectónicos y su ciclo de vida', () => {
    for (const f of FICHAS_CORTE) {
      expect(f.largo, f.clave).toBeTruthy();
      expect(f.capas, f.clave).toBeTruthy();
      expect(f.densidadIdeal.length, f.clave).toBeGreaterThan(0);
      expect(f.textura.length, f.clave).toBeGreaterThan(0);
      expect(f.cicloSemanas[0], f.clave).toBeGreaterThan(0);
      expect(f.cicloSemanas[1], f.clave).toBeGreaterThanOrEqual(f.cicloSemanas[0]);
    }
  });

  it('el género es solo etiqueta de filtro, no una sección con barrera', () => {
    const etiquetas = new Set(FICHAS_CORTE.map((f) => f.etiquetaGenero));
    expect(etiquetas).toEqual(
      new Set(['sugerido_mujeres', 'sugerido_hombres', 'unisex'])
    );
    // Sin filtro declarado, el catálogo entero es candidato.
    const r = recomendarCortes({
      diagnostico: {},
      sesion: { ...SESION_BASE, toleranciaMantenimiento: 'alta' },
      top: 16,
    });
    expect(r.recomendaciones.length + r.descartados.length).toBe(16);
  });

  it('el filtro de género deja pasar siempre los unisex', () => {
    const r = recomendarCortes({
      diagnostico: {},
      sesion: {
        ...SESION_BASE,
        toleranciaMantenimiento: 'alta',
        filtroGenero: 'sugerido_hombres',
      },
      top: 16,
    });
    const claves = r.recomendaciones.map((x) => x.ficha.clave);
    // W-03 es unisex: aparece aunque el filtro sea "sugerido para hombres".
    expect(claves).toContain('W-03');
  });

  it('W-07 lleva el nombre que fijó Keila', () => {
    expect(fichaPorClave('W-07')!.nombre).toBe('Corte Arquitectónico Velli en Seco');
  });

  it('la guía cubre las 7 formas de rostro', () => {
    expect(GUIA_ROSTROS).toHaveLength(7);
    expect(GUIA_ROSTROS.map((g) => g.forma).sort()).toEqual([...FORMAS_ROSTRO].sort());
  });
});

// ═══ 1. Filtro duro por tipo de cabello (PR-03) ══════════════════════════

describe('filtro duro: lo incompatible NI APARECE', () => {
  it('el corte en seco por rizo no aparece para un patrón liso', () => {
    const r = recomendarCortes({
      diagnostico: { tipoCabello: '1A' },
      sesion: { ...SESION_BASE, toleranciaMantenimiento: 'alta' },
      top: 16,
    });
    expect(r.recomendaciones.map((x) => x.ficha.clave)).not.toContain('W-07');
    expect(r.descartados.map((d) => d.clave)).toContain('W-07');
  });

  it('el curly top fade no aparece para patrones 1 y 2', () => {
    for (const tipo of ['1B', '2A']) {
      const r = recomendarCortes({
        diagnostico: { tipoCabello: tipo },
        sesion: { ...SESION_BASE, toleranciaMantenimiento: 'alta' },
        top: 16,
      });
      expect(r.recomendaciones.map((x) => x.ficha.clave)).not.toContain('M-07');
    }
  });

  it('el condicionado SÍ aparece, con su nota honesta visible', () => {
    // W-06 recto largo sobre patrón 3: "recto solo se verá recto alisado".
    const r = recomendarCortes({
      diagnostico: { tipoCabello: '3B' },
      sesion: { ...SESION_BASE, formaRostro: 'corazon', toleranciaMantenimiento: 'alta' },
      top: 16,
    });
    const w06 = r.recomendaciones.find((x) => x.ficha.clave === 'W-06');
    expect(w06).toBeDefined();
    expect(w06!.notaHonesta).toMatch(/recto solo se verá recto alisado/i);
  });

  it('resuelve el subtipo antes que la familia', () => {
    // W-07 declara 2C como ideal y 2A/2B como condicionado.
    expect(compatibilidadPara(fichaPorClave('W-07')!, '2C')!.nivel).toBe('ideal');
    expect(compatibilidadPara(fichaPorClave('W-07')!, '2A')!.nivel).toBe('condicionado');
  });

  it('sin diagnóstico de tipo, no filtra por patrón', () => {
    expect(compatibilidadPara(fichaPorClave('W-07')!, undefined)).toBeNull();
  });
});

// ═══ 2. Filtro de mantenimiento (PR-06) ═════════════════════════════════

describe('filtro de mantenimiento: honestidad sobre el compromiso', () => {
  it('tolerancia baja descarta el fade (retoque cada 2-3 semanas)', () => {
    expect(toleraMantenimiento(fichaPorClave('M-02')!, 'baja')).toBe(false);
    expect(toleraMantenimiento(fichaPorClave('M-02')!, 'alta')).toBe(true);
  });

  it('tolerancia baja conserva los cortes nobles (8+ semanas)', () => {
    expect(toleraMantenimiento(fichaPorClave('W-02')!, 'baja')).toBe(true);
    expect(toleraMantenimiento(fichaPorClave('W-03')!, 'baja')).toBe(true);
  });

  it('el descarte explica la frecuencia real, sin ocultarla', () => {
    const r = recomendarCortes({
      diagnostico: {},
      sesion: { ...SESION_BASE, toleranciaMantenimiento: 'baja' },
      top: 16,
    });
    const fade = r.descartados.find((d) => d.clave === 'M-02');
    expect(fade).toBeDefined();
    expect(fade!.motivo).toMatch(/2 a 3 semanas/);
  });
});

// ═══ 3. Veto de remolinos (PR-05) ═══════════════════════════════════════

describe('veto de remolinos: la pelea se pierde todas las mañanas', () => {
  it('un remolino frontal excluye los cortes que dependen de flequillo', () => {
    const shag = fichaPorClave('W-04')!;
    expect(shag.requiereFlequillo).toBe(true);
    const v = vetoRemolinos(shag, { remolinoFrontal: true });
    expect(v.excluye).toBe(true);
  });

  it('el crecimiento hacia atrás también excluye el flequillo', () => {
    const v = vetoRemolinos(fichaPorClave('M-04')!, { direccion: 'hacia_atras' });
    expect(v.excluye).toBe(true);
  });

  it('el remolino de coronilla ADVIERTE sobre la raya, sin excluir', () => {
    const v = vetoRemolinos(fichaPorClave('W-02')!, { remolinoCoronilla: true });
    expect(v.excluye).toBe(false);
    expect(v.advertencia).toMatch(/raya/i);
  });

  it('sin datos de crecimiento no veta nada', () => {
    expect(vetoRemolinos(fichaPorClave('W-04')!, undefined).excluye).toBe(false);
  });

  it('la matriz saca del top los cortes vetados y explica por qué', () => {
    const r = recomendarCortes({
      diagnostico: { crecimiento: { remolinoFrontal: true } },
      sesion: { ...SESION_BASE, formaRostro: 'alargado', toleranciaMantenimiento: 'alta' },
      top: 16,
    });
    expect(r.recomendaciones.map((x) => x.ficha.clave)).not.toContain('W-04');
    expect(r.descartados.find((d) => d.clave === 'W-04')!.motivo).toMatch(/remolino/i);
  });

  it('las advertencias que no excluyen viajan en la salida', () => {
    const r = recomendarCortes({
      diagnostico: { crecimiento: { remolinoCoronilla: true } },
      sesion: { ...SESION_BASE, toleranciaMantenimiento: 'alta' },
      top: 16,
    });
    expect(r.advertencias.length).toBeGreaterThan(0);
  });
});

// ═══ 4. Puntuación por rostro ═══════════════════════════════════════════

describe('puntuación por rostro: favorece +2 / neutro +1 / precaución 0', () => {
  it('favorece suma 2', () => {
    // W-05 pixie favorece diamante.
    const { puntaje } = puntuarPorRostro(fichaPorClave('W-05')!, {
      ...SESION_BASE, formaRostro: 'diamante',
    });
    expect(puntaje).toBe(2);
  });

  it('precaución suma 0 y deja la nota visible', () => {
    // W-06 recto largo tiene precaución con alargado.
    const r = puntuarPorRostro(fichaPorClave('W-06')!, {
      ...SESION_BASE, formaRostro: 'alargado',
    });
    expect(r.puntaje).toBe(0);
    expect(r.precaucion).toBeTruthy();
    expect(r.variante).toBeTruthy();
  });

  it('neutro suma 1', () => {
    const { puntaje } = puntuarPorRostro(fichaPorClave('M-06')!, {
      ...SESION_BASE, formaRostro: 'triangulo',
    });
    expect(puntaje).toBe(1);
  });

  it('PR-01: lo que la clienta declara pesa MÁS que la heurística', () => {
    const ficha = fichaPorClave('W-05')!; // pixie: volumen en coronilla
    const sinDeseo = puntuarPorRostro(ficha, { ...SESION_BASE, formaRostro: 'redondo' });
    const conDeseo = puntuarPorRostro(ficha, {
      ...SESION_BASE, formaRostro: 'redondo', quiereDestacar: ['pomulos'],
    });
    // Con precaución para redondo el puntaje base es 0; el deseo declarado
    // lo levanta por encima de un "favorece" heurístico (2).
    expect(sinDeseo.puntaje).toBe(0);
    expect(conDeseo.puntaje).toBeGreaterThan(2);
  });

  it('el top se ordena por puntaje', () => {
    const r = recomendarCortes({
      diagnostico: { tipoCabello: '1A' },
      sesion: { ...SESION_BASE, formaRostro: 'corazon', toleranciaMantenimiento: 'alta' },
    });
    expect(r.recomendaciones).toHaveLength(3);
    for (let i = 1; i < r.recomendaciones.length; i++) {
      expect(r.recomendaciones[i - 1].puntaje).toBeGreaterThanOrEqual(
        r.recomendaciones[i].puntaje
      );
    }
  });

  it('cada recomendación trae el porqué, la frecuencia y sus motivos', () => {
    const r = recomendarCortes({
      diagnostico: { tipoCabello: '3B' },
      sesion: { ...SESION_BASE, formaRostro: 'redondo', toleranciaMantenimiento: 'media' },
    });
    for (const rec of r.recomendaciones) {
      expect(rec.porque.length).toBeGreaterThan(10);
      expect(rec.frecuenciaRetoque).toMatch(/semanas/);
      expect(rec.motivos.length).toBeGreaterThan(0);
      for (const m of rec.motivos) expect(m.regla).toMatch(/^PR-\d\d$/);
    }
  });
});

// ═══ LENGUAJE · política lingüística de Keila (§5.1) ════════════════════

describe('lenguaje: equilibrar, destacar, enmarcar, celebrar — nunca corregir', () => {
  it('los cuatro verbos permitidos son los de Keila, no los tres de la Entrega 5', () => {
    expect([...VERBOS_PERMITIDOS]).toEqual([
      'equilibrar', 'destacar', 'enmarcar', 'celebrar',
    ]);
  });

  it('detecta términos vetados', () => {
    expect(lenguajeEsValido('Este corte corrige tu rostro')).toBe(false);
    expect(terminosVetadosEn('disimula el defecto')).toEqual(
      expect.arrayContaining(['disimul', 'defecto'])
    );
    expect(lenguajeEsValido('Este corte equilibra y destaca')).toBe(true);
  });

  it('la detección ignora acentos y mayúsculas', () => {
    expect(lenguajeEsValido('CORRECCIÓN del óvalo')).toBe(false);
  });

  it('NINGUNA ficha del catálogo contiene términos vetados', () => {
    const hallazgos = auditarLenguaje(FICHAS_CORTE);
    expect(hallazgos, JSON.stringify(hallazgos, null, 2)).toEqual([]);
  });

  it('NINGUNA guía de rostro contiene términos vetados', () => {
    expect(auditarLenguaje(GUIA_ROSTROS)).toEqual([]);
  });

  it('NINGUNA salida de la matriz contiene términos vetados, para ningún rostro', () => {
    // Barrido exhaustivo: 7 rostros × 3 tolerancias × 5 patrones, auditando
    // el resultado COMPLETO (porqués, notas honestas, descartes y avisos).
    for (const forma of FORMAS_ROSTRO) {
      for (const tol of ['baja', 'media', 'alta'] as const) {
        for (const tipo of ['1A', '2B', '3B', '4C', undefined]) {
          const r = recomendarCortes({
            diagnostico: {
              tipoCabello: tipo,
              densidad: 'baja',
              crecimiento: { remolinoFrontal: true, remolinoCoronilla: true },
            },
            sesion: {
              formaRostro: forma,
              toleranciaMantenimiento: tol,
              quiereDestacar: ['pomulos', 'volumen'],
            },
            top: 16,
          });
          const hallazgos = auditarLenguaje(r);
          expect(
            hallazgos,
            `rostro=${forma} tolerancia=${tol} tipo=${tipo}: ${JSON.stringify(hallazgos)}`
          ).toEqual([]);
        }
      }
    }
  });
});

// ═══ 5. PR-06 · pre-agendamiento ════════════════════════════════════════

describe('PR-06: el retoque se pre-agenda con el ciclo de la ficha', () => {
  it('la fecha sugerida cae en el punto medio del ciclo', () => {
    const desde = new Date('2026-09-01T10:00:00Z');
    // Bob clásico: 6-8 semanas → punto medio 7.
    const f = fechaSugeridaRetoque(fichaPorClave('W-01')!, desde);
    const dias = Math.round((f.getTime() - desde.getTime()) / 86400000);
    expect(dias).toBe(49);
  });

  it('el fade se pre-agenda mucho antes que un lob', () => {
    const desde = new Date('2026-09-01T10:00:00Z');
    const fade = fechaSugeridaRetoque(fichaPorClave('M-02')!, desde);
    const lob = fechaSugeridaRetoque(fichaPorClave('W-02')!, desde);
    expect(fade.getTime()).toBeLessThan(lob.getTime());
  });

  it('la propuesta lleva el ciclo real en el mensaje', () => {
    const p = proponerRetoque({ ficha: fichaPorClave('M-02')! });
    expect(p.mensaje).toMatch(/entre 2 y 3 semanas/);
    expect(p.servicio).toContain('Mantenimiento de corte');
  });

  it('paridad con la agenda: el servicio se clasifica con la MISMA función', () => {
    // Ningún mantenimiento de corte del catálogo cae en bloqueo_tipo4: el
    // bloque extendido es de lavado tipo 4 e instalación protectora.
    for (const f of FICHAS_CORTE) {
      const clase = clasificarServicio(servicioMantenimiento(f));
      expect(clase, f.clave).not.toBe('bloqueo_tipo4');
    }
  });

  it('un servicio que SÍ es de bloque extendido hereda la duración configurada', () => {
    // Verifica la rama de bloque extendido con una ficha sintética cuyo
    // nombre cae en la clasificación de la agenda.
    const ficha = {
      ...fichaPorClave('W-07')!,
      nombre: 'Instalación de peinado protector',
    };
    const p = proponerRetoque({ ficha, bloqueoTipo4Minutos: 240 });
    expect(p.esBloqueExtendido).toBe(true);
    expect(p.duracionMinutos).toBe(duracionBloqueoTipo4(240));
  });

  it('los cortes normales usan la duración estándar', () => {
    const p = proponerRetoque({ ficha: fichaPorClave('W-01')!, duracionCorteMinutos: 45 });
    expect(p.esBloqueExtendido).toBe(false);
    expect(p.duracionMinutos).toBe(45);
  });
});

// ═══ Migración ══════════════════════════════════════════════════════════

describe('migración de cortes', () => {
  const sql = readFileSync(
    path.resolve(__dirname, '../supabase/migration-cortes.sql'),
    'utf8'
  );

  it('es idempotente', () => {
    expect(sql.match(/^CREATE TABLE (?!IF NOT EXISTS)/gm)).toBeNull();
    for (const [, p] of sql.matchAll(/CREATE POLICY (\w+)/g)) {
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS ${p}\\b`));
    }
  });

  it('las fichas base solo las escribe el rol corporativo, igual que kb_marcas', () => {
    for (const accion of ['insert', 'update', 'delete']) {
      expect(sql).toMatch(
        new RegExp(`CREATE POLICY kb_cortes_${accion}_corporativo[\\s\\S]*?es_cuenta_corporativa\\(\\)`)
      );
    }
    expect(sql).toMatch(/kb_cortes_select_publicadas[\s\S]*?estado = 'publicada'/);
  });

  it('añade los segmentos de referencia que el evaluador ignora', () => {
    expect(sql).toContain("'referencia_color'");
    expect(sql).toContain("'referencia_corte'");
  });

  it('el catálogo se indexa por atributos arquitectónicos, no por género', () => {
    expect(sql).toMatch(/idx_kb_cortes_arquitectura ON public\.kb_cortes \(largo, capas\)/);
    expect(sql).toMatch(/etiqueta_genero text NOT NULL DEFAULT 'unisex'/);
  });
});
