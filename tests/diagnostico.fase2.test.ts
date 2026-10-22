// ══════════════════════════════════════════════════════════════════════════
// Fase 2 (Sprint B): perfiles dorados y seguridad.
//
// Simula el estado POST-publicación: evalúa con el seed de rizos (motor en
// producción) + el seed de Fase 2 (hoy en borrador). Garantiza:
//
//   1. PARIDAD DE RIZOS — publicar Fase 2 NO cambia el plan de los tipos
//      3–4 sin dimensiones nuevas (tipos 3 idénticos; tipo 4 solo gana las
//      notas/cuidados documentados de la Entrega 4, nunca cambia el plan).
//   2. Perfiles dorados de liso (Entrega 1), ondulado (Entrega 1), canas
//      (Entrega 2, módulo transversal) y complementos 3–4 (Entrega 4).
//   3. SEGURIDAD — las banderas rojas nuevas (guía de reconocimiento en
//      cabina) derivan SIEMPRE a dermatólogo con los bloqueos A-06, y las
//      señales que el salón sí atiende (tracción temprana, rotura) NO
//      derivan.
//   4. Correcciones VERBATIM de la validación técnica (C-08 y A-02).
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { WizardData, WIZARD_INITIAL_DATA } from '../lib/types';
import { evaluarDiagnostico } from '../lib/kb/evaluador';
import { REGLAS_RIZADO } from '../lib/kb/seed/reglasRizado';
import { REGLAS_FASE2 } from '../lib/kb/seed/reglasFase2';

// Estado post-publicación: motor de rizos + Fase 2.
const KB = [...REGLAS_RIZADO, ...REGLAS_FASE2];

function perfil(overrides: Partial<WizardData>): WizardData {
  return { ...WIZARD_INITIAL_DATA, nombre: 'Clienta Test', ...overrides };
}

const TRANSICION = 'En transición capilar (dos texturas visibles)';

// ── 1. Paridad: publicar Fase 2 no toca el motor de rizos ──────────────────

describe('fase 2: paridad del motor de rizos', () => {
  const POROSIDADES = ['', 'baja', 'media', 'alta'];
  const ELASTICIDADES = ['', 'baja', 'media'];

  it('tipos 3A–3C sin dimensiones nuevas: resultado idéntico', () => {
    for (const tipo of ['3A', '3B', '3C'])
      for (const porosidad of POROSIDADES)
        for (const elasticidad of ELASTICIDADES) {
          const data = perfil({ tipoRizoPrincipal: tipo, porosidad, elasticidad });
          expect(evaluarDiagnostico(KB, data)).toEqual(
            evaluarDiagnostico(REGLAS_RIZADO, data)
          );
        }
  });

  it('tipos 4A–4C sin dimensiones nuevas: mismo plan, solo se suman las notas de la Entrega 4', () => {
    for (const tipo of ['4A', '4B', '4C'])
      for (const porosidad of POROSIDADES)
        for (const elasticidad of ELASTICIDADES) {
          const data = perfil({ tipoRizoPrincipal: tipo, porosidad, elasticidad });
          const solo = evaluarDiagnostico(REGLAS_RIZADO, data);
          const kb = evaluarDiagnostico(KB, data);
          // El plan no cambia:
          expect(kb.tratamientoPrincipal).toBe(solo.tratamientoPrincipal);
          expect(kb.tratamientosAdicionales).toEqual(solo.tratamientosAdicionales);
          expect(kb.cronograma).toEqual(solo.cronograma);
          expect(kb.tecnicaDefinicion).toBe(solo.tecnicaDefinicion);
          expect(kb.productosPonto).toEqual(solo.productosPonto);
          expect(kb.recomendacionProductos).toEqual(solo.recomendacionProductos);
          expect(kb.intervaloSugerido).toBe(solo.intervaloSugerido);
          // Las notas y cuidados del motor se conservan (la Entrega 4 suma,
          // no reemplaza — FUSIONAR):
          for (const nota of solo.notasAdicionales) {
            expect(kb.notasAdicionales).toContain(nota);
          }
          for (const paso of solo.cuidadoCasa.diaLavado) {
            expect(kb.cuidadoCasa.diaLavado).toContain(paso);
          }
        }
  });
});

// ── 2a. Perfiles dorados: liso (Entrega 1) ─────────────────────────────────

describe('fase 2: perfiles dorados de liso', () => {
  it('L-01 · 1A raíz grasa con hebra sana → EQ-1', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '1A',
        porosidad: 'media',
        perfilExtendido: { grasaRaiz: 'mismo_dia' },
      })
    );
    expect(res.tratamientoPrincipal).toBe('Equilibrio de raíz ligera (EQ-1)');
    expect(res.cronograma.semana2).toContain('exfoliación suave del cuero cabelludo');
    expect(res.productosPonto).toContain('Champú equilibrante suave apto para uso frecuente');
    expect(res.cuidadoCasa.evitar).toContain('Nada cremoso ni oleoso en la raíz, en ninguna sesión');
    expect(res.notasAdicionales.join(' ')).toContain('acondicionador jamás en la raíz');
  });

  it('L-02 · raíz grasa + puntas abiertas → EQ-1 con sellado de puntas', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '1B',
        estadoPuntas: 'Puntas abiertas leves',
        perfilExtendido: { grasaRaiz: '1_2_dias' },
      })
    );
    expect(res.tratamientoPrincipal).toBe('Equilibrio de raíz ligera (EQ-1)');
    expect(res.productosPonto.join(' ')).toContain('Sérum de puntas sin enjuague');
    expect(res.notasAdicionales.join(' ')).toContain('dos cabellos distintos');
  });

  it('L-03 · calor 3+ veces/semana con porosidad alta → REP-1', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '1C', porosidad: 'alta', frecuenciaCalor: 'diario' })
    );
    expect(res.tratamientoPrincipal).toBe('Reparación progresiva (REP-1)');
    expect(res.cronograma.semana4).toContain('prueba de elasticidad de control');
    expect(res.cuidadoCasa.evitar).toContain('Plancha más de 1 vez por semana durante el mes');
    expect(res.notasAdicionales.join(' ')).toContain('180 °C');
  });

  it('L-04 · elasticidad baja → REP-2 con reevaluación y corte progresivo', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '1A', elasticidad: 'baja', porosidad: 'alta' })
    );
    expect(res.tratamientoPrincipal).toBe('Reconstrucción intensiva (REP-2)');
    expect(res.cuidadoCasa.evitar).toContain(
      'Cero calor y cero químicos durante las 4 semanas, sin excepciones'
    );
    expect(res.notasAdicionales.join(' ')).toContain('corte progresivo');
  });

  it('L-06 · alisado vigente (historial del wizard) → MANT-1 post-alisado', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '1A',
        quimicos: ['Alisado permanente (keratina, formol, japonés)'],
      })
    );
    expect(res.tratamientoPrincipal).toBe('Mantenimiento post-alisado (MANT-1)');
    expect(res.productosPonto).toContain('Champú sin sulfatos ni sal');
    expect(res.notasAdicionales.join(' ')).toContain('Bandera amarilla');
  });

  it('L-10 · liso sano → MANT-1 y mensaje de no sobre-tratar', () => {
    const res = evaluarDiagnostico(KB, perfil({ tipoRizoPrincipal: '1B' }));
    expect(res.tratamientoPrincipal).toBe('Mantenimiento (MANT-1)');
    expect(res.cronograma.semana1).toContain('una sesión de cuidado por semana basta');
    expect(res.notasAdicionales.join(' ')).toContain('sobre-tratarlo');
  });
});

// ── 2b. Perfiles dorados: ondulado (Entrega 1) ─────────────────────────────

describe('fase 2: perfiles dorados de ondulado', () => {
  it('O-02 · 2B sin daño → DEF-1 con secuencia crema + gel', () => {
    const res = evaluarDiagnostico(KB, perfil({ tipoRizoPrincipal: '2B' }));
    expect(res.tratamientoPrincipal).toBe('Definición de onda (DEF-1)');
    expect(res.cronograma.semana1).toContain('técnica crema + gel');
    expect(res.notasAdicionales.join(' ')).toContain('plopping');
    expect(res.cuidadoCasa.diaLavado).toContain(
      'El styling se aplica siempre sobre cabello muy húmedo'
    );
  });

  it('O-03 · 2C porosidad alta → DEF-2 (hidratación profunda innegociable)', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2C', porosidad: 'alta' })
    );
    expect(res.tratamientoPrincipal).toBe('Hidratación profunda + definición intensa (DEF-2)');
    expect(res.cronograma.semana4).toContain('día húmedo real');
    expect(res.notasAdicionales.join(' ')).toContain('síntoma de sed');
  });

  it('O-05 · build-up declarado → detox + DEF-1 y clarificación del motor (fusión)', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2A', perfilExtendido: { acumulacionProducto: 'si' } })
    );
    expect(res.tratamientoPrincipal).toBe('Detox y reinicio de definición (DEF-1)');
    // La regla de detox del motor se activa vía el mismo hecho buildUp:
    expect(res.tratamientosAdicionales).toContain(
      'Detox / Clarificación (paso previo al tratamiento)'
    );
    expect(res.notasAdicionales.join(' ')).toContain('limpiar el lienzo');
  });

  it('O-06 · transición → REP-1 conservando las notas de transición del motor', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2B', tipoDano: [TRANSICION], lineaDemarcacion: 'orejas' })
    );
    expect(res.tratamientoPrincipal).toBe('Transición post-química (REP-1)');
    // Nota legacy del motor (fusión, no reemplazo):
    expect(res.notasAdicionales).toContain(
      'Tratar zona natural y zona procesada por separado. Recomendar corte progresivo de la zona química.'
    );
    expect(res.notasAdicionales.join(' ')).toContain('cero calor');
  });

  it('O-04 · onda con elasticidad baja → REP-2', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2C', elasticidad: 'baja' })
    );
    expect(res.tratamientoPrincipal).toBe('Reconstrucción intensiva (REP-2)');
    expect(res.notasAdicionales.join(' ')).toContain('la fibra perdió memoria');
  });

  it('O-10 · quiere "más rizo" → expectativa honesta', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2B', perfilExtendido: { objetivoPrincipal: 'mas_rizo' } })
    );
    expect(res.notasAdicionales.join(' ')).toContain(
      'se convierte en su mejor versión'
    );
  });
});

// ── 2c. Perfiles dorados: módulo transversal de canas (Entrega 2) ──────────

describe('fase 2: módulo transversal de canas', () => {
  it('C-02 · 3B con canas amarillentas: el plan base del tipo NO cambia, el módulo se suma', () => {
    const base = perfil({ tipoRizoPrincipal: '3B', porosidad: 'alta' });
    const conCanas = perfil({
      tipoRizoPrincipal: '3B',
      porosidad: 'alta',
      perfilExtendido: { estadoCanas: 'entre_25_50', amarillamientoCanas: true },
    });
    const resBase = evaluarDiagnostico(KB, base);
    const res = evaluarDiagnostico(KB, conCanas);
    // Transversal: el tratamiento principal del tipo base se mantiene…
    expect(res.tratamientoPrincipal).toBe(resBase.tratamientoPrincipal);
    // …y el módulo de canas se suma: cronograma CAN-1 + adicional + productos.
    expect(res.cronograma.semana1).toContain('matización corta');
    expect(res.tratamientosAdicionales).toContain('Módulo canas: matización y brillo (CAN-1)');
    expect(res.productosPonto.join(' ')).toContain('matizadora violeta');
    expect(res.notasAdicionales.join(' ')).toContain('extrínseco');
  });

  it('C-05 · transición a canas → CAN-2 con foto mensual para el Pasaporte', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '1B',
        perfilExtendido: { estadoCanas: 'mas_50', situacionColor: 'en_transicion' },
      })
    );
    expect(res.cronograma.semana4).toContain('Pasaporte Capilar');
    expect(res.tratamientosAdicionales).toContain('Módulo canas: transición acompañada (CAN-2)');
    expect(res.intervaloSugerido).toBe('Visita mensual con foto de progreso para el Pasaporte Capilar');
    expect(res.notasAdicionales.join(' ')).toContain('nunca con química improvisada');
  });

  it('C-01 · primeras canas → solo educación (mito de arrancar), sin cambiar el plan', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2B', perfilExtendido: { estadoCanas: 'menos_25' } })
    );
    expect(res.tratamientoPrincipal).toBe('Definición de onda (DEF-1)');
    expect(res.notasAdicionales.join(' ')).toContain('no arrancar las canas');
  });

  it('C-08 · canicie prematura → texto VERBATIM de la validación técnica, sin derivación', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '1A',
        perfilExtendido: { estadoCanas: 'menos_25', aparicionCanas: 'subita_temprana' },
      })
    );
    expect(res.tratamientoPrincipal).not.toBe('Derivación a dermatólogo');
    expect(res.notasAdicionales).toContain(
      'Tus primeras canas son el reflejo de tu genética única. Si consideras que su aparición ha sido extraordinariamente súbita, coméntalo de manera casual con tu médico en tu consulta de rutina, ¡pero sonríe!, la gran mayoría de las veces es herencia pura.'
    );
  });

  it('C-07 · cana en patrón rizado → refuerzo localizado sin tocar el plan del motor', () => {
    const base = perfil({ tipoRizoPrincipal: '3C', porosidad: 'alta' });
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '3C',
        porosidad: 'alta',
        perfilExtendido: { estadoCanas: 'menos_25', texturaCana: 'mas_gruesa_aspera' },
      })
    );
    expect(res.tratamientoPrincipal).toBe(evaluarDiagnostico(KB, base).tratamientoPrincipal);
    expect(res.notasAdicionales.join(' ')).toContain('sed puntual de esas hebras');
  });
});

// ── 2d. Perfiles dorados: complementos tipos 3–4 (Entrega 4) ───────────────

describe('fase 2: complementos de tipos 3 y 4', () => {
  it('T4-01/T4-02 · tipo 4: encogimiento como dato y protocolo de desenredado', () => {
    const res = evaluarDiagnostico(KB, perfil({ tipoRizoPrincipal: '4C', porosidad: 'alta' }));
    const notas = res.notasAdicionales.join(' ');
    expect(notas).toContain('El encogimiento es dato, no defecto');
    expect(notas).toContain('se corta el nudo');
    expect(res.cuidadoCasa.diaLavado.join(' ')).toContain('PROTOCOLO DÍA DE LAVADO TIPO 4');
  });

  it('PROT-1 · protector instalado → plan, cronograma, retiro agendado y kit', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '4B', perfilExtendido: { protectorEnUso: 'trenzas' } })
    );
    expect(res.tratamientoPrincipal).toBe('Cuidado bajo peinado protector (PROT-1)');
    expect(res.cronograma.semana2).toContain('Revisión de tensión');
    expect(res.intervaloSugerido).toContain('retiro de la instalación');
    expect(res.productosPonto).toContain('Champú suave diluible con botella aplicadora');
    expect(res.notasAdicionales.join(' ')).toContain('bordes y línea frontal SIEMPRE con holgura');
  });

  it('T4-07 · transición tipo 4: énfasis nuevo + notas del motor conservadas (FUSIONAR)', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '4C', tipoDano: [TRANSICION] })
    );
    expect(res.notasAdicionales).toContain(
      'Tratar zona natural y zona procesada por separado. Recomendar corte progresivo de la zona química.'
    );
    expect(res.notasAdicionales.join(' ')).toContain('la línea que se rompe');
  });

  it('R3-02 · rizo 3 decolorado → prueba de elasticidad por zonas', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '3B',
        perfilExtendido: { procesosQuimicos: ['decoloracion'] },
      })
    );
    expect(res.notasAdicionales.join(' ')).toContain('POR ZONAS');
  });

  it('T4-08 · objetivo estirado sin calor → técnicas y expectativa de humedad', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '4A', perfilExtendido: { objetivoEstilo: 'estirado_sin_calor' } })
    );
    const notas = res.notasAdicionales.join(' ');
    expect(notas).toContain('twist-out');
    expect(notas).toContain('expectativa honesta de duración');
  });
});

// ── 3. Seguridad: banderas rojas nuevas derivan SIEMPRE ────────────────────

describe('fase 2: seguridad — banderas nuevas', () => {
  const SENALES_MEDICAS = [
    'parches_redondos',
    'caida_difusa_subita',
    'raya_ensancha',
    'zonas_lisas_brillantes',
    'cuero_inflamado_pustulas',
  ];

  it.each(SENALES_MEDICAS)('señal médica "%s" → derivación con bloqueos A-06, nunca plan', (senal) => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2B', perfilExtendido: { senalesCaida: [senal] } })
    );
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
    expect(res.tratamientosAdicionales).toEqual([]);
    expect(res.productosPonto).toEqual([]);
    expect(res.cronograma.semana1).toBe('Pendiente de valoración dermatológica');
    expect(res.notasAdicionales[0]).toContain('DERIVACIÓN MÉDICA');
    expect(res.notasAdicionales.join(' ')).toContain('BLOQUEO A-06');
  });

  it('descamación con placas → derivación (límite de L-08)', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '1A', perfilExtendido: { descamacion: 'placas_enrojecimiento' } })
    );
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
    expect(res.notasAdicionales.join(' ')).toContain('BLOQUEO A-06');
  });

  it('pústulas bajo el protector → retiro + derivación', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '4B',
        perfilExtendido: { protectorEnUso: 'trenzas', senalesProtector: ['pustulas_lesiones'] },
      })
    );
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
    expect(res.notasAdicionales.join(' ')).toContain('Retirar la instalación');
  });

  it('las banderas de la Entrega 1 (Sprint A) siguen derivando igual', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '1A', perfilExtendido: { senalesAlopecia: ['placas_sin_cabello'] } })
    );
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
  });

  it('A-02 · tracción temprana SIN fibrosis: el salón actúa — NO deriva, copy VERBATIM de la validación técnica', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '4B', perfilExtendido: { senalesCaida: ['traccion_sienes'] } })
    );
    expect(res.tratamientoPrincipal).not.toBe('Derivación a dermatólogo');
    expect(res.notasAdicionales).toContain(
      'Amar tu cabello también es soltarlo. La tensión constante en el mismo punto debilita la raíz hasta apagarla. Dale un respiro a tu línea frontal.'
    );
    expect(res.notasAdicionales.join(' ')).toContain('cero tensión por 8–12 semanas');
  });

  it('A-02 con zonas lisas y brillantes → la derivación gana (fibrosis)', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '4B',
        perfilExtendido: { senalesCaida: ['traccion_sienes', 'zonas_lisas_brillantes'] },
      })
    );
    expect(res.tratamientoPrincipal).toBe('Derivación a dermatólogo');
  });

  it('A-03 · rotura sin bulbo: cosmético — REP-2, no derivación', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '3B', perfilExtendido: { senalesCaida: ['rotura_sin_bulbo'] } })
    );
    expect(res.tratamientoPrincipal).toBe('Reconstrucción intensiva (REP-2)');
    expect(res.notasAdicionales.join(' ')).toContain('bulbo/no-bulbo');
  });

  it('A-01 · en manejo médico → acompañamiento de mínima agresión, no derivación', () => {
    const res = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '2B',
        perfilExtendido: { situacionCaida: 'diagnostico_confirmado_manejo' },
      })
    );
    expect(res.tratamientoPrincipal).not.toBe('Derivación a dermatólogo');
    expect(res.tratamientosAdicionales).toContain(
      'Acompañamiento bajo manejo médico (A-01): cuidado de mínima agresión'
    );
    expect(res.notasAdicionales.join(' ')).toContain(
      'nunca sugiere modificar, complementar ni suspender un tratamiento médico'
    );
  });

  it('A-04/A-05 · posparto y camuflaje → notas honestas sin promesas', () => {
    const posparto = evaluarDiagnostico(
      KB,
      perfil({ tipoRizoPrincipal: '2A', perfilExtendido: { situacionCaida: 'posparto_ventana' } })
    );
    expect(posparto.notasAdicionales.join(' ')).toContain('baby hairs');
    const camuflaje = evaluarDiagnostico(
      KB,
      perfil({
        tipoRizoPrincipal: '1B',
        perfilExtendido: { situacionCaida: 'perdida_estable_camuflaje' },
      })
    );
    expect(camuflaje.notasAdicionales.join(' ')).toContain('salud emocional');
    expect(camuflaje.productosPonto.join(' ')).toContain('densificadores');
  });
});
