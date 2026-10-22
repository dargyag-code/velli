// ══════════════════════════════════════════════════════════════════════════
// Sprint C · Calculadora de colorimetría.
//
// La verificación que define "la calculadora está viva" son los tres casos
// pedagógicos de la Entrega 3 §8, al final de este archivo. Antes van los
// guardarraíles y las reglas duras de la validación técnica, que MANDAN sobre la Entrega 3.
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { calcularColor } from '../lib/color/calculadora';
import {
  CO09_PROTOCOLO_VERBATIM, cabeEnUnaSesion, decidirVia, evaluarGuardarrailes,
  requierePrepigmentacion, tramoCanas,
} from '../lib/color/reglas';
import {
  TABLA_ALTURAS, filaAltura, volumenParaNiveles, tratamientoDelFondo,
} from '../lib/color/tablas';
import type { DiagnosticoColor, EntradaSesion } from '../lib/color/tipos';

const DX_SANO: DiagnosticoColor = {
  porosidad: 'media',
  elasticidad: 'alta',
  hennaOMetales: 'no',
};

function calcular(dx: Partial<DiagnosticoColor>, sesion: EntradaSesion) {
  return calcularColor({ diagnostico: { ...DX_SANO, ...dx }, sesion });
}

// ═══ Tablas universales · versión de la validación técnica ════════════════════════════════

describe('tabla de alturas: manda la sección 4.1 de la validación técnica', () => {
  it('cubre la escala completa 1–10 con la columna latinoamericana', () => {
    expect(TABLA_ALTURAS).toHaveLength(10);
    for (const fila of TABLA_ALTURAS) {
      expect(fila.denominacionLatam).toBeTruthy();
    }
  });

  it('nivel 1 es "Rojo profundo" (validación técnica), no agrupado 1-3 como la Entrega 3', () => {
    expect(filaAltura(1).fondoAclaracion).toBe('Rojo profundo');
    expect(filaAltura(2).fondoAclaracion).toBe('Rojo');
    expect(filaAltura(3).fondoAclaracion).toBe('Rojo');
  });

  it('reproduce los fondos y neutralizantes de la validación técnica verbatim', () => {
    expect(filaAltura(6).fondoAclaracion).toBe('Anaranjado');
    expect(filaAltura(6).neutralizante).toBe('Azul (Ceniza)');
    expect(filaAltura(6).denominacionLatam).toBe('.1');
    expect(filaAltura(8).fondoAclaracion).toBe('Amarillo');
    expect(filaAltura(8).neutralizante).toBe('Violeta (Nacarado / Malva)');
    expect(filaAltura(8).denominacionLatam).toBe('.2');
    expect(filaAltura(10).denominacionLatam).toBe('.21 / Platino');
  });

  it('CO-03: el volumen es el mínimo que cubre los niveles a mover', () => {
    expect(volumenParaNiveles(0)).toBe(10);
    expect(volumenParaNiveles(1)).toBe(20);
    expect(volumenParaNiveles(2)).toBe(20);
    expect(volumenParaNiveles(3)).toBe(30);
    expect(volumenParaNiveles(4)).toBe(40);
  });

  it('CO-04: frío neutraliza el fondo, cálido lo aprovecha', () => {
    expect(tratamientoDelFondo(8, 'frio').accion).toBe('neutralizar');
    expect(tratamientoDelFondo(8, 'frio').reflejo).toBe('Violeta (Nacarado / Malva)');
    expect(tratamientoDelFondo(8, 'calido').accion).toBe('aprovechar');
    expect(tratamientoDelFondo(8, 'neutro').accion).toBe('equilibrar');
  });
});

// ═══ Guardarraíles duros ══════════════════════════════════════════════════

describe('guardarraíles: elasticidad, banderas médicas y henna', () => {
  const objetivo: EntradaSesion = {
    nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio',
  };

  it('elasticidad baja bloquea la aclaración y desvía a REP con 4 semanas', () => {
    const r = calcular({ elasticidad: 'baja' }, objetivo);
    const b = r.bloqueos.find((x) => x.codigo === 'elasticidad_baja');
    expect(b).toBeDefined();
    expect(b!.reevaluarEnSemanas).toBe(4);
    expect(b!.caminoPrevio).toMatch(/REP-1 o REP-2/);
    expect(r.formula).toBeUndefined();
    expect(r.guia).toBeUndefined();
  });

  it('bandera médica activa bloquea todo proceso químico (A-06)', () => {
    const r = calcular({ banderaMedicaActiva: true }, objetivo);
    expect(r.bloqueos.map((b) => b.codigo)).toContain('bandera_medica');
    expect(r.formula).toBeUndefined();
  });

  it('cuero cabelludo lesionado bloquea todo (A-06)', () => {
    const r = calcular({ cueroCabelludoLesionado: true }, objetivo);
    expect(r.bloqueos.map((b) => b.codigo)).toContain('cuero_lesionado');
    expect(r.formula).toBeUndefined();
  });

  it('henna registrada bloquea peróxidos con el protocolo CO-09 VERBATIM', () => {
    const r = calcular({ hennaOMetales: 'si' }, objetivo);
    const b = r.bloqueos.find((x) => x.codigo === 'henna_metales');
    expect(b).toBeDefined();
    expect(b!.textoVerbatim).toBe(CO09_PROTOCOLO_VERBATIM);
    expect(r.formula).toBeUndefined();
  });

  it('historial DUDOSO también bloquea (no solo el confirmado)', () => {
    const r = calcular({ hennaOMetales: 'dudoso' }, objetivo);
    expect(r.bloqueos.map((b) => b.codigo)).toContain('henna_metales');
  });

  it('la prueba de mechón superada levanta el bloqueo de henna', () => {
    const r = calcular({ hennaOMetales: 'dudoso', pruebaMechonSuperada: true }, objetivo);
    expect(r.bloqueos).toEqual([]);
    expect(r.formula).toBeDefined();
  });

  it('el texto CO-09 es literal de la validación firmada', () => {
    expect(CO09_PROTOCOLO_VERBATIM).toBe(
      'Realizar prueba de mechón en la nuca baja con polvo decolorante y peróxido de 20 volúmenes por 30 minutos. Si el cabello genera elevación térmica al tacto, emite olor azufrado, vira hacia tonos verdosos/azulados o pierde elasticidad, el servicio químico queda terminantemente suspendido'
    );
  });

  it('elasticidad baja NO bloquea una cobertura en el mismo nivel', () => {
    // El bloqueo es de decoloración y aclaración; depositar no castiga la fibra.
    const r = calcular(
      { elasticidad: 'baja', porcentajeCanas: 60 },
      { nivelNatural: 5, pigmentoArtificial: false, nivelObjetivo: 5, temperatura: 'calido' }
    );
    expect(r.bloqueos).toEqual([]);
    expect(r.formula).toBeDefined();
  });

  it('los bloqueos legales inyectados por el caller se anteponen', () => {
    const r = calcularColor({
      diagnostico: DX_SANO,
      sesion: objetivo,
      bloqueosLegales: [{
        codigo: 'parche_sensibilidad',
        titulo: 'Falta la prueba de sensibilidad',
        mensaje: 'x',
        caminoPrevio: 'y',
      }],
    });
    expect(r.bloqueos.map((b) => b.codigo)).toContain('parche_sensibilidad');
    expect(r.formula).toBeUndefined();
  });
});

// ═══ CO-05 · Cobertura de canas por tramos (regla dura de la validación técnica) ══════════

describe('CO-05: tramos de canas y candado de 20 volúmenes', () => {
  it('por debajo de 25 % no impone base natural', () => {
    expect(tramoCanas(24)).toBeNull();
    expect(tramoCanas(undefined)).toBeNull();
  });

  it('25–50 % exige 1/4 de tubo de serie natural', () => {
    for (const p of [25, 40, 50]) {
      const t = tramoCanas(p)!;
      expect(t.fraccionBaseNatural).toBe(0.25);
      expect(t.etiquetaFraccion).toBe('1/4 de tubo');
      expect(t.bloqueaVeinteVol).toBe(false);
    }
  });

  it('50–75 % exige 1/2 tubo', () => {
    for (const p of [51, 70, 75]) {
      const t = tramoCanas(p)!;
      expect(t.fraccionBaseNatural).toBe(0.5);
      expect(t.etiquetaFraccion).toBe('1/2 tubo');
      expect(t.bloqueaVeinteVol).toBe(false);
    }
  });

  it('más de 75 % exige 3/4 o tubo completo Y bloquea el oxidante a 20 vol', () => {
    for (const p of [76, 90, 100]) {
      const t = tramoCanas(p)!;
      expect(t.fraccionBaseNatural).toBe(0.75);
      expect(t.bloqueaVeinteVol).toBe(true);
    }
  });

  it('el candado de 20 vol se impone aunque la distancia pida más volumen', () => {
    // 3 niveles pedirían 30 vol; con >75 % de canas queda cerrado en 20.
    const r = calcular(
      { porcentajeCanas: 80 },
      { nivelNatural: 5, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio' }
    );
    expect(r.formula!.volumen).toBe(20);
    expect(r.formula!.volumenBloqueado).toBe(true);
    expect(r.formula!.volumenMotivo).toMatch(/exclusivamente a 20 vol/i);
  });

  it('la fracción de serie natural entra en la fórmula como componente obligatorio', () => {
    const r = calcular(
      { porcentajeCanas: 80 },
      { nivelNatural: 5, pigmentoArtificial: false, nivelObjetivo: 5, temperatura: 'calido' }
    );
    const base = r.formula!.componentes.find((c) => c.notaRegla?.includes('CO-05'));
    expect(base).toBeDefined();
    expect(base!.descripcion).toMatch(/Serie natural/);
    expect(base!.gramos).toBe(45); // 3/4 de un tubo de 60 g
  });

  it('canas resistentes activan la nota de pre-pigmentación o mordentado', () => {
    const r = calcular(
      { porcentajeCanas: 60, canasResistentes: true },
      { nivelNatural: 5, pigmentoArtificial: false, nivelObjetivo: 5, temperatura: 'calido' }
    );
    expect(r.advertencias.map((a) => a.codigo)).toContain('canas_resistentes');
  });
});

// ═══ CO-01 · El tinte no aclara tinte ════════════════════════════════════

describe('CO-01: bloqueo de tinte directo sobre pigmento artificial', () => {
  it('subir niveles sobre artificial exige extracción, decapado o decoloración', () => {
    const d = decidirVia({ nivelPartida: 4, nivelObjetivo: 7, pigmentoArtificial: true });
    expect(d.via).toBe('decapado_decoloracion');
    expect(d.bloqueaTinteDirecto).toBe(true);
    expect(d.motivo).toMatch(/no aclara tinte/i);
  });

  it('sobre cabello virgen la vía tinte sigue disponible', () => {
    const d = decidirVia({ nivelPartida: 6, nivelObjetivo: 8, pigmentoArtificial: false });
    expect(d.via).toBe('tinte');
    expect(d.bloqueaTinteDirecto).toBe(false);
  });

  it('oscurecer sobre artificial NO dispara CO-01 (no se aclara nada)', () => {
    const d = decidirVia({ nivelPartida: 7, nivelObjetivo: 5, pigmentoArtificial: true });
    expect(d.via).toBe('deposito');
    expect(d.bloqueaTinteDirecto).toBe(false);
  });

  it('mismo nivel con canas ≥25 % es cobertura', () => {
    const d = decidirVia({
      nivelPartida: 5, nivelObjetivo: 5, pigmentoArtificial: false, porcentajeCanas: 70,
    });
    expect(d.via).toBe('cobertura');
  });
});

// ═══ CO-06 y CO-07 · Ajustes del diagnóstico ═════════════════════════════

describe('CO-06 pre-pigmentación y CO-07 porosidad', () => {
  it('oscurecer 2+ niveles sobre aclarado exige pre-pigmentación', () => {
    expect(requierePrepigmentacion({
      nivelPartida: 9, nivelObjetivo: 6, historialDecoloracion: true,
    })).toBe(true);
  });

  it('sin historial de decoloración no la exige', () => {
    expect(requierePrepigmentacion({
      nivelPartida: 9, nivelObjetivo: 6, historialDecoloracion: false,
    })).toBe(false);
  });

  it('porosidad alta advierte sobre-matización y duración', () => {
    const r = calcular(
      { porosidad: 'alta' },
      { nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 7, temperatura: 'frio' }
    );
    expect(r.advertencias.map((a) => a.codigo)).toContain('porosidad_alta');
  });

  it('porosidad baja recuerda los tiempos completos de carta', () => {
    const r = calcular(
      { porosidad: 'baja' },
      { nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 7, temperatura: 'frio' }
    );
    expect(r.advertencias.map((a) => a.codigo)).toContain('porosidad_baja');
  });
});

// ═══ CO-10 · La sesión honesta ═══════════════════════════════════════════

describe('CO-10: plan multi-sesión por etapas', () => {
  it('sobre virgen y fibra sana, 4 niveles caben en una sesión', () => {
    expect(cabeEnUnaSesion({ nivelesAMover: 4, pigmentoArtificial: false }).cabe).toBe(true);
  });

  it('sobre fibra comprometida el límite baja a 2 niveles', () => {
    const v = cabeEnUnaSesion({
      nivelesAMover: 3, pigmentoArtificial: true, porosidad: 'alta',
    });
    expect(v.cabe).toBe(false);
    expect(v.limite).toBe(2);
  });

  it('el plan estima fondos intermedios y agenda reconstrucción entre etapas', () => {
    const r = calcular(
      { porosidad: 'alta', elasticidad: 'media' },
      {
        nivelNatural: 5, nivelActualLargos: 4, pigmentoArtificial: true,
        nivelObjetivo: 9, temperatura: 'frio',
      }
    );
    const plan = r.planMultiSesion!;
    expect(plan.etapas.length).toBeGreaterThan(1);
    for (const e of plan.etapas) expect(e.fondoIntermedio).toBeTruthy();
    // Todas menos la última llevan tratamiento reconstructor y espera.
    for (const e of plan.etapas.slice(0, -1)) {
      expect(e.tratamientoIntermedio).toMatch(/REP-1/);
      expect(e.esperaSemanas).toBe(4);
    }
    expect(plan.hitosPasaporte.length).toBe(plan.etapas.length);
  });

  it('con plan por etapas NO se emite fórmula directa', () => {
    const r = calcular(
      { porosidad: 'alta' },
      {
        nivelNatural: 4, nivelActualLargos: 4, pigmentoArtificial: true,
        nivelObjetivo: 9, temperatura: 'frio',
      }
    );
    expect(r.planMultiSesion).toBeDefined();
    expect(r.formula).toBeUndefined();
  });
});

// ═══ Autoridad: razonamiento visible + fórmula editable ══════════════════

describe('nivel de autoridad (validación técnica, respuesta 6)', () => {
  it('la salida expone el porqué junto a la fórmula sugerida', () => {
    const r = calcular({}, {
      nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio',
    });
    expect(r.guia).toBeDefined();
    expect(r.guia!.pasos.map((p) => p.regla)).toEqual(
      expect.arrayContaining(['CO-01', 'CO-03', 'CO-04'])
    );
    expect(r.guia!.fondoEsperado).toBeTruthy();
    expect(r.guia!.neutralizacion).toBeTruthy();
    expect(r.formula!.componentes.length).toBeGreaterThan(0);
    expect(r.formula!.componentes[0].gramos).toBeGreaterThan(0);
  });

  it('sin carta de marca, la fórmula se declara orientativa', () => {
    const r = calcular({}, {
      nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio',
    });
    expect(r.formula!.origen).toBe('orientativo');
    expect(r.formula!.proporcion).toMatch(/orientativo/i);
  });

  it('con carta cargada, proporciones y tiempos vienen de la marca', () => {
    const r = calcularColor({
      diagnostico: DX_SANO,
      sesion: { nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio' },
      carta: { nombre: 'X', proporcionEstandar: '1:1', tiempoPausaEstandar: '35 min', gramosPorTubo: 60 },
    });
    expect(r.formula!.origen).toBe('carta_marca');
    expect(r.formula!.proporcion).toBe('1:1');
  });

  it('la checklist de seguridad §5 acompaña siempre', () => {
    const r = calcular({}, {
      nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio',
    });
    expect(r.checklistSeguridad.length).toBeGreaterThanOrEqual(5);
    expect(r.checklistSeguridad.join(' ')).toMatch(/parche/i);
  });

  it('la decoloración suma la checklist específica de la Entrega 3 §5', () => {
    const r = calcular({}, {
      nivelNatural: 5, nivelActualLargos: 4, pigmentoArtificial: true,
      nivelObjetivo: 6, temperatura: 'frio',
    });
    expect(r.checklistSeguridad.join(' ')).toMatch(/prueba de mechón/i);
    expect(r.checklistSeguridad.join(' ')).toMatch(/elasticidad/i);
  });
});

// ═══ LOS TRES CASOS PEDAGÓGICOS · Entrega 3 §8 ═══════════════════════════
// "Si esos tres razonan bien, la calculadora está viva."

describe('caso 1 · de base 6 natural a rubio claro frío', () => {
  const r = calcular(
    { porosidad: 'media', elasticidad: 'alta' },
    { nivelNatural: 6, pigmentoArtificial: false, nivelObjetivo: 8, temperatura: 'frio' }
  );

  it('no hay bloqueos: fibra sana y sin química previa', () => {
    expect(r.bloqueos).toEqual([]);
  });

  it('va por vía tinte (no hay pigmento artificial)', () => {
    expect(r.guia!.via).toBe('tinte');
  });

  it('la distancia es de 2 niveles', () => {
    expect(r.guia!.nivelesAMover).toBe(2);
  });

  it('el fondo del nivel 8 es amarillo y se neutraliza con violeta', () => {
    expect(r.guia!.fondoEsperado).toBe('Amarillo');
    expect(r.guia!.accionSobreFondo).toBe('neutralizar');
    expect(r.guia!.neutralizacion).toMatch(/Violeta/);
  });

  it('la denominación latinoamericana del reflejo es .2 → fórmula tipo 8.2', () => {
    expect(r.guia!.denominacionLatam).toBe('.2');
  });

  it('cabe en una sesión: fórmula directa, sin plan por etapas', () => {
    expect(r.planMultiSesion).toBeUndefined();
    expect(r.formula).toBeDefined();
  });
});

describe('caso 2 · cobertura de 70 % de canas en su mismo nivel', () => {
  const r = calcular(
    { porcentajeCanas: 70, porosidad: 'media', elasticidad: 'alta' },
    { nivelNatural: 5, pigmentoArtificial: false, nivelObjetivo: 5, temperatura: 'calido' }
  );

  it('no hay niveles que mover: la misión es cubrir', () => {
    expect(r.guia!.nivelesAMover).toBe(0);
    expect(r.guia!.via).toBe('cobertura');
  });

  it('el oxidante es de 20 volúmenes, el estándar de cobertura', () => {
    expect(r.formula!.volumen).toBe(20);
  });

  it('la base natural domina la fórmula: 1/2 tubo obligatorio (CO-05)', () => {
    const base = r.formula!.componentes.find((c) => c.notaRegla?.includes('CO-05'))!;
    expect(base.descripcion).toMatch(/5\.0 \/ 5N/);
    expect(base.gramos).toBe(30); // 1/2 de 60 g
  });

  it('el razonamiento cita CO-05 con el texto del tramo', () => {
    const paso = r.guia!.pasos.find((p) => p.regla === 'CO-05')!;
    expect(paso.texto).toMatch(/50 % a 75 %/);
    expect(paso.texto).toMatch(/1\/2 tubo/);
  });
});

describe('caso 3 · teñida de 4 que quiere un 7 (la sesión honesta)', () => {
  const r = calcular(
    { porosidad: 'alta', elasticidad: 'media' },
    {
      nivelNatural: 5, nivelActualLargos: 4, pigmentoArtificial: true,
      nivelObjetivo: 7, temperatura: 'calido',
    }
  );

  it('CO-01 manda: la vía del largo es decapado o decoloración', () => {
    expect(r.guia!.via).toBe('decapado_decoloracion');
    expect(r.guia!.viaMotivo).toMatch(/no aclara tinte/i);
  });

  it('JAMÁS emite fórmula directa: propone plan multi-sesión', () => {
    expect(r.formula).toBeUndefined();
    expect(r.planMultiSesion).toBeDefined();
    expect(r.planMultiSesion!.motivo).toMatch(/CO-10/);
  });

  it('el plan estima fondos intermedios por etapa', () => {
    const etapas = r.planMultiSesion!.etapas;
    expect(etapas.length).toBeGreaterThanOrEqual(2);
    expect(etapas[0].fondoIntermedio).toBeTruthy();
    expect(etapas.at(-1)!.nivelEstimado).toBe(7);
  });

  it('agenda reconstrucción intermedia y deja hitos en el Pasaporte', () => {
    expect(r.planMultiSesion!.etapas[0].tratamientoIntermedio).toMatch(/REP-1/);
    expect(r.planMultiSesion!.hitosPasaporte.length).toBeGreaterThan(0);
  });

  it('advierte por la porosidad alta de las puntas', () => {
    expect(r.advertencias.map((a) => a.codigo)).toContain('porosidad_alta');
  });

  it('exige la checklist completa de decoloración (§5)', () => {
    expect(r.checklistSeguridad.join(' ')).toMatch(/prueba de mechón/i);
  });
});
