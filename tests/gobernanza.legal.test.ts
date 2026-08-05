// ══════════════════════════════════════════════════════════════════════════
// Capa legal y de gobernanza — validación firmada de Keila Moreno.
//
// Cubre los TRES bloqueos que el documento exige, en sus dos capas:
//   1. Gobernanza (6.P2): el rol salon NO puede escribir reglas base ni
//      cartas de marca — se verifica que la RLS de la migración delega toda
//      escritura kb_* en es_cuenta_corporativa().
//   2. Cámara (6.P3): bloqueada sin consentimiento_imagenes firmado y
//      vigente de esa clienta.
//   3. Agenda (6.P7): confirmación de color bloqueada sin parche dentro de
//      la ventana de 48 h; bloque de 2–4 h para servicios tipo 4.
//
// Los bloqueos 2 y 3 se testean sobre las reglas puras (lib/consentimientos,
// lib/agenda/reglas). El bloqueo 1 vive en SQL: se verifica leyendo la
// migración, que es la fuente de la RLS desplegada.
// ══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  evaluarCamara,
  tieneConsentimientoVigente,
} from '../lib/consentimientos';
import {
  clasificarServicio,
  duracionBloqueoTipo4,
  evaluarConfirmacionCita,
  parcheValidoPara,
  solapaConBloqueoTipo4,
  traducirErrorAgenda,
  BLOQUEO_TIPO4_MIN_MINUTOS,
  BLOQUEO_TIPO4_MAX_MINUTOS,
} from '../lib/agenda/reglas';
import { CONSENTIMIENTO_VERSIONES, TipoConsentimiento } from '../lib/legal';

// La migración vive en supabase/ hasta que se aplica en prod y pasa a
// _archive/. El test debe seguirla en ambos sitios: es la fuente de la RLS
// desplegada tanto antes como después del rollout.
function leerMigracion(nombre: string): string {
  const candidatos = [
    path.resolve(__dirname, `../supabase/${nombre}`),
    path.resolve(__dirname, `../supabase/_archive/${nombre}`),
  ];
  const encontrada = candidatos.find((c) => existsSync(c));
  if (!encontrada) throw new Error(`No se encontró ${nombre} en supabase/ ni en supabase/_archive/`);
  return readFileSync(encontrada, 'utf8');
}

const V = CONSENTIMIENTO_VERSIONES;

function firma(tipo: TipoConsentimiento, version = V[tipo], aceptado = true) {
  return { tipo, versionAceptada: version, aceptado };
}

// ═══ BLOQUEO 1 · Gobernanza: el rol salon no escribe la librería ═══════════

describe('bloqueo 1 · rol salon no puede escribir reglas base ni cartas', () => {
  const migracion = leerMigracion('migration-legal-gobernanza.sql');

  it('define el rol con default salon y CHECK de valores válidos', () => {
    expect(migracion).toMatch(/ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'salon'/);
    expect(migracion).toMatch(/CHECK \(rol IN \('corporativo', 'salon'\)\)/);
  });

  it('mapea las cuentas es_fundadora existentes a corporativo', () => {
    expect(migracion).toMatch(
      /UPDATE public\.profiles SET rol = 'corporativo'\s*\n\s*WHERE es_fundadora/
    );
  });

  it('es_cuenta_corporativa() solo es true para rol corporativo', () => {
    expect(migracion).toMatch(
      /CREATE OR REPLACE FUNCTION public\.es_cuenta_corporativa\(\)[\s\S]*?p\.rol = 'corporativo'/
    );
  });

  it('es_cuenta_fundadora() (usada por toda la RLS kb_*) delega en es_cuenta_corporativa()', () => {
    // Este alias es lo que cierra la escritura de kb_reglas/flujos/prompts/
    // dimensiones al rol salon sin recrear cada policy existente.
    expect(migracion).toMatch(
      /CREATE OR REPLACE FUNCTION public\.es_cuenta_fundadora\(\)[\s\S]*?select public\.es_cuenta_corporativa\(\);/
    );
  });

  it('las cartas de marca solo las escribe el rol corporativo', () => {
    for (const accion of ['insert', 'update', 'delete']) {
      const policy = new RegExp(
        `CREATE POLICY kb_marcas_${accion}_corporativo[\\s\\S]*?es_cuenta_corporativa\\(\\)`
      );
      expect(migracion).toMatch(policy);
    }
    // El salon lee solo las publicadas.
    expect(migracion).toMatch(
      /CREATE POLICY kb_marcas_select_publicadas[\s\S]*?estado = 'publicada'/
    );
  });

  it('la única escritura del salon es su selección de marcas activas', () => {
    expect(migracion).toMatch(
      /CREATE POLICY salon_marcas_insert_own[\s\S]*?auth\.uid\(\)\) = user_id/
    );
    // …y solo puede activar marcas publicadas de la librería global.
    expect(migracion).toMatch(
      /CREATE POLICY salon_marcas_insert_own[\s\S]*?m\.estado = 'publicada'/
    );
  });

  it('salon_marcas_activas y kb_marcas tienen RLS habilitada', () => {
    expect(migracion).toMatch(/ALTER TABLE public\.kb_marcas ENABLE ROW LEVEL SECURITY/);
    expect(migracion).toMatch(/ALTER TABLE public\.salon_marcas_activas ENABLE ROW LEVEL SECURITY/);
  });

  it('es idempotente: sin CREATE TABLE/POLICY sin guarda', () => {
    const creates = migracion.match(/^CREATE TABLE (?!IF NOT EXISTS)/gm);
    expect(creates).toBeNull();
    // Cada CREATE POLICY va precedido de su DROP POLICY IF EXISTS.
    const policies = [...migracion.matchAll(/CREATE POLICY (\w+)/g)].map((m) => m[1]);
    for (const p of policies) {
      expect(migracion).toMatch(new RegExp(`DROP POLICY IF EXISTS ${p}\\b`));
    }
  });
});

// ═══ BLOQUEO 2 · Cámara bloqueada sin consentimiento de imágenes ═══════════

describe('bloqueo 2 · cámara bloqueada sin firma vigente', () => {
  it('bloquea cuando la clienta no tiene ninguna firma', () => {
    const estado = evaluarCamara({
      contexto: 'analisis_alopecia',
      clientaRegistrada: true,
      firmas: [],
    });
    expect(estado.permitida).toBe(false);
    expect(estado.motivo).toBe('falta_consentimiento');
  });

  it('bloquea cuando la clienta aún no está registrada (fail-closed)', () => {
    const estado = evaluarCamara({
      contexto: 'analisis_alopecia',
      clientaRegistrada: false,
      firmas: [firma('consentimiento_imagenes')],
    });
    expect(estado.permitida).toBe(false);
    expect(estado.motivo).toBe('sin_clienta');
  });

  it('bloquea si la firma es de una versión anterior del documento', () => {
    const estado = evaluarCamara({
      contexto: 'analisis_alopecia',
      clientaRegistrada: true,
      firmas: [firma('consentimiento_imagenes', '2020-01-01-vieja')],
    });
    expect(estado.permitida).toBe(false);
    expect(estado.motivo).toBe('falta_consentimiento');
  });

  it('el consentimiento químico NO desbloquea la cámara', () => {
    const estado = evaluarCamara({
      contexto: 'analisis_alopecia',
      clientaRegistrada: true,
      firmas: [firma('consentimiento_quimico')],
    });
    expect(estado.permitida).toBe(false);
  });

  it('permite con consentimiento_imagenes firmado y vigente', () => {
    for (const contexto of ['analisis_alopecia', 'registro_servicio_quimico'] as const) {
      const estado = evaluarCamara({
        contexto,
        clientaRegistrada: true,
        firmas: [firma('consentimiento_imagenes')],
      });
      expect(estado.permitida).toBe(true);
    }
  });

  it('una firma con aceptado=false no cuenta como vigente', () => {
    expect(
      tieneConsentimientoVigente(
        [firma('consentimiento_imagenes', V.consentimiento_imagenes, false)],
        'consentimiento_imagenes'
      )
    ).toBe(false);
  });
});

// ═══ BLOQUEO 3 · Agenda ═══════════════════════════════════════════════════

describe('bloqueo 3a · confirmación de color sin prueba de sensibilidad', () => {
  const fechaCita = new Date('2026-08-20T10:00:00Z');
  const hace = (horas: number) =>
    new Date(fechaCita.getTime() - horas * 3600_000).toISOString();

  const clientaMarcada = { nuevaEnColor: true, cambioMarcaQuimica: false };
  const firmas = [firma('consentimiento_quimico')];

  it('bloquea a clienta nueva en color sin ninguna prueba', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [],
      consentimientos: firmas,
    });
    expect(bloqueos.map((b) => b.codigo)).toContain('parche_sensibilidad');
  });

  it('bloquea si el parche se aplicó hace menos de 48 h', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [{ aplicadoAt: hace(47), resultado: 'negativo' }],
      consentimientos: firmas,
    });
    expect(bloqueos.map((b) => b.codigo)).toContain('parche_sensibilidad');
  });

  it('permite con parche negativo aplicado exactamente 48 h antes', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [{ aplicadoAt: hace(48), resultado: 'negativo' }],
      consentimientos: firmas,
    });
    expect(bloqueos).toEqual([]);
  });

  it('un parche POSITIVO no habilita la confirmación', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [{ aplicadoAt: hace(72), resultado: 'positivo' }],
      consentimientos: firmas,
    });
    expect(bloqueos.map((b) => b.codigo)).toContain('parche_sensibilidad');
  });

  it('un parche de hace más de 14 días ya no es válido', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [{ aplicadoAt: hace(24 * 15), resultado: 'negativo' }],
      consentimientos: firmas,
    });
    expect(bloqueos.map((b) => b.codigo)).toContain('parche_sensibilidad');
  });

  it('también aplica a "cambio de marca química"', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: { nuevaEnColor: false, cambioMarcaQuimica: true },
      pruebas: [],
      consentimientos: firmas,
    });
    expect(bloqueos.map((b) => b.codigo)).toContain('parche_sensibilidad');
  });

  it('clienta sin banderas no requiere parche', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Color / tinte',
      fechaCita,
      clienta: { nuevaEnColor: false, cambioMarcaQuimica: false },
      pruebas: [],
      consentimientos: firmas,
    });
    expect(bloqueos).toEqual([]);
  });

  it('un servicio que no es de color no dispara el bloqueo', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Corte',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [],
      consentimientos: [],
    });
    expect(bloqueos).toEqual([]);
  });

  it('la decoloración exige además el consentimiento químico vigente', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Decoloración / mechas',
      fechaCita,
      clienta: { nuevaEnColor: false, cambioMarcaQuimica: false },
      pruebas: [],
      consentimientos: [],
    });
    expect(bloqueos.map((b) => b.codigo)).toEqual(['consentimiento_quimico']);
  });

  it('la decoloración con firma vigente y parche válido se confirma', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Decoloración / mechas',
      fechaCita,
      clienta: clientaMarcada,
      pruebas: [{ aplicadoAt: hace(50), resultado: 'negativo' }],
      consentimientos: [firma('consentimiento_quimico')],
    });
    expect(bloqueos).toEqual([]);
  });

  it('una firma química de versión anterior no habilita la decoloración', () => {
    const bloqueos = evaluarConfirmacionCita({
      servicio: 'Decoloración / mechas',
      fechaCita,
      clienta: { nuevaEnColor: false, cambioMarcaQuimica: false },
      pruebas: [],
      consentimientos: [firma('consentimiento_quimico', '2020-01-01-vieja')],
    });
    expect(bloqueos.map((b) => b.codigo)).toContain('consentimiento_quimico');
  });

  it('parcheValidoPara respeta la ventana [48 h, 14 días]', () => {
    expect(parcheValidoPara([{ aplicadoAt: hace(48), resultado: 'negativo' }], fechaCita)).toBe(true);
    expect(parcheValidoPara([{ aplicadoAt: hace(24 * 14), resultado: 'negativo' }], fechaCita)).toBe(true);
    expect(parcheValidoPara([{ aplicadoAt: hace(24), resultado: 'negativo' }], fechaCita)).toBe(false);
  });
});

describe('bloqueo 3b · bloque de 2–4 h para servicios tipo 4', () => {
  it('clasifica los servicios que reservan bloque', () => {
    expect(clasificarServicio('Día de lavado tipo 4')).toBe('bloqueo_tipo4');
    expect(clasificarServicio('Instalación de peinado protector')).toBe('bloqueo_tipo4');
    expect(clasificarServicio('Dia de lavado afro')).toBe('bloqueo_tipo4');
    expect(clasificarServicio('Corte')).toBe('otro');
  });

  it('distingue color de decoloración', () => {
    expect(clasificarServicio('Color / tinte')).toBe('color');
    expect(clasificarServicio('Decoloración / mechas')).toBe('decoloracion');
    expect(clasificarServicio('Balayage')).toBe('decoloracion');
    expect(clasificarServicio('Matizado')).toBe('color');
  });

  it('la duración configurable queda acotada al rango 2–4 h', () => {
    expect(duracionBloqueoTipo4(120)).toBe(120);
    expect(duracionBloqueoTipo4(240)).toBe(240);
    expect(duracionBloqueoTipo4(60)).toBe(BLOQUEO_TIPO4_MIN_MINUTOS);
    expect(duracionBloqueoTipo4(600)).toBe(BLOQUEO_TIPO4_MAX_MINUTOS);
    expect(duracionBloqueoTipo4(null)).toBe(180);
  });

  it('impide sobreprogramar una cita corta encima del bloque', () => {
    const bloque = {
      fecha: '2026-08-20T09:00:00Z',
      duracionMinutos: 180,
      servicio: 'Día de lavado tipo 4',
      estado: 'pendiente',
    };
    const citaCorta = {
      fecha: '2026-08-20T10:00:00Z',
      duracionMinutos: 30,
      servicio: 'Corte',
      estado: 'pendiente',
    };
    expect(solapaConBloqueoTipo4(citaCorta, [bloque])).toBe(true);
  });

  it('impide agendar un bloque encima de citas existentes', () => {
    const citaCorta = {
      fecha: '2026-08-20T10:00:00Z',
      duracionMinutos: 60,
      servicio: 'Corte',
      estado: 'pendiente',
    };
    const bloque = {
      fecha: '2026-08-20T09:00:00Z',
      duracionMinutos: 180,
      servicio: 'Instalación de peinado protector',
      estado: 'pendiente',
    };
    expect(solapaConBloqueoTipo4(bloque, [citaCorta])).toBe(true);
  });

  it('permite una cita corta justo después del bloque', () => {
    const bloque = {
      fecha: '2026-08-20T09:00:00Z',
      duracionMinutos: 180,
      servicio: 'Día de lavado tipo 4',
      estado: 'pendiente',
    };
    const despues = {
      fecha: '2026-08-20T12:00:00Z',
      duracionMinutos: 30,
      servicio: 'Corte',
      estado: 'pendiente',
    };
    expect(solapaConBloqueoTipo4(despues, [bloque])).toBe(false);
  });

  it('dos citas cortas entre sí no se bloquean (la regla es solo del bloque)', () => {
    const a = { fecha: '2026-08-20T10:00:00Z', duracionMinutos: 60, servicio: 'Corte', estado: 'pendiente' };
    const b = { fecha: '2026-08-20T10:30:00Z', duracionMinutos: 30, servicio: 'Peinado', estado: 'pendiente' };
    expect(solapaConBloqueoTipo4(b, [a])).toBe(false);
  });

  it('un bloque cancelado libera el horario', () => {
    const bloqueCancelado = {
      fecha: '2026-08-20T09:00:00Z',
      duracionMinutos: 180,
      servicio: 'Día de lavado tipo 4',
      estado: 'cancelada',
    };
    const citaCorta = {
      fecha: '2026-08-20T10:00:00Z',
      duracionMinutos: 30,
      servicio: 'Corte',
      estado: 'pendiente',
    };
    expect(solapaConBloqueoTipo4(citaCorta, [bloqueCancelado])).toBe(false);
  });
});

// ═══ Paridad TS ⇄ SQL: las reglas de la UI espejan las de la DB ════════════

describe('paridad entre las reglas del cliente y el trigger de la DB', () => {
  const migracion = leerMigracion('migration-legal-gobernanza.sql');

  it('el trigger citas_guard_legal está instalado sobre citas', () => {
    expect(migracion).toMatch(
      /CREATE TRIGGER guard_legal_citas\s*\n\s*BEFORE INSERT OR UPDATE ON public\.citas/
    );
  });

  it('la ventana de 48 h del parche es la misma en SQL', () => {
    expect(migracion).toMatch(/ps\.aplicado_at <= NEW\.fecha - interval '48 hours'/);
    expect(migracion).toMatch(/ps\.aplicado_at >= NEW\.fecha - interval '14 days'/);
    expect(migracion).toMatch(/ps\.resultado = 'negativo'/);
  });

  it('el bloque tipo 4 se acota a 2–4 h también en SQL', () => {
    expect(migracion).toMatch(/LEAST\(240, GREATEST\(120, COALESCE\(v_bloque, 180\)\)\)/);
    expect(migracion).toMatch(/CHECK \(bloqueo_tipo4_minutos BETWEEN 120 AND 240\)/);
  });

  it('clasificar_servicio cubre los mismos patrones que el cliente', () => {
    const sql = migracion.slice(
      migracion.indexOf('FUNCTION public.clasificar_servicio'),
      migracion.indexOf('REVOKE ALL ON FUNCTION public.clasificar_servicio')
    );
    for (const patron of ['lavado tipo 4', 'peinado protector', 'decolor', 'balayage', 'tinte', 'matiz']) {
      expect(sql).toContain(patron);
    }
  });

  it('el consentimiento químico se valida contra la versión vigente en DB', () => {
    expect(migracion).toMatch(
      /JOIN public\.legal_versiones lv ON lv\.tipo = 'consentimiento_quimico'[\s\S]*?cc\.version_aceptada = lv\.version/
    );
  });

  it('el seed de legal_versiones coincide con lib/legal.ts', () => {
    for (const [tipo, version] of Object.entries(V)) {
      expect(migracion).toContain(`('${tipo}',`);
      expect(migracion).toContain(`'${version}'`);
    }
  });

  it('la firma exige checkbox aceptado y nombre completo', () => {
    expect(migracion).toMatch(/CONSTRAINT consentimientos_aceptado_check CHECK \(aceptado\)/);
    expect(migracion).toMatch(/char_length\(btrim\(nombre_firmante\)\) >= 5/);
  });

  it('los errores del trigger se traducen a mensajes accionables', () => {
    expect(traducirErrorAgenda('PARCHE_SENSIBILIDAD_REQUERIDO: …')).toMatch(/prueba de sensibilidad/i);
    expect(traducirErrorAgenda('CONSENTIMIENTO_QUIMICO_REQUERIDO: …')).toMatch(/consentimiento/i);
    expect(traducirErrorAgenda('AGENDA_BLOQUEADA: …')).toMatch(/bloque extendido/i);
  });
});
