import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const mockCheckRateLimit = vi.fn();
const mockFromAdmin = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? '190.24.10.5' : null),
  }),
}));

vi.mock('@/lib/api/rateLimit', () => ({
  publicOrderLimiter: () => null,
  vitrinaPublicaLimiter: () => null,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFromAdmin(...args),
  }),
}));

import { POST } from '@/app/api/public/appointments/route';
import {
  armarMensajeWhatsAppCita,
  bogotaLocalToUtcDate,
  calcularSlotsDisponiblesBogota,
  construirUrlAbrirEnSilla,
  diaSemanaBogota,
  formatearFechaBogotaYmd,
  formatearHoraBogotaHm,
  haySolapamientoCitas,
  type BusyInterval,
  type SpecialistScheduleRule,
} from '@/lib/agenda/disponibilidad';
import {
  armarEnlaceReactivacionWhatsApp,
  calcularDiasDesdeUltimaVisita,
  fueContactadaEstaSemana,
  segmentarClientasPorReactivar,
} from '@/lib/clientas/reactivacion';
import type { Clienta } from '@/lib/types';

afterEach(() => {
  vi.clearAllMocks();
});

describe('1. Agenda en America/Bogota: huso horario UTC-5 y cálculo de slots disponibles', () => {
  it('convierte fechas y bordes nocturnos exactamente en America/Bogota (-05:00)', () => {
    const inicioUtc = bogotaLocalToUtcDate('2026-11-26', '09:30');
    expect(inicioUtc.toISOString()).toBe('2026-11-26T14:30:00.000Z');
    expect(formatearFechaBogotaYmd(inicioUtc)).toBe('2026-11-26');
    expect(formatearHoraBogotaHm(inicioUtc)).toBe('09:30');

    // 22:30 del 26 de noviembre en Bogotá equivale a 03:30Z del 27 en UTC,
    // pero en Bogotá sigue siendo el día 2026-11-26.
    const nocheBogota = bogotaLocalToUtcDate('2026-11-26', '22:30');
    expect(nocheBogota.toISOString()).toBe('2026-11-27T03:30:00.000Z');
    expect(formatearFechaBogotaYmd(nocheBogota)).toBe('2026-11-26');
    expect(formatearHoraBogotaHm(nocheBogota)).toBe('22:30');

    // 2026-11-26 es jueves (4) y 2026-11-29 es domingo (0)
    expect(diaSemanaBogota('2026-11-26')).toBe(4);
    expect(diaSemanaBogota('2026-11-29')).toBe(0);
  });

  it('genera slots disponibles respetando turno, duración del servicio, citas activas y hora actual', () => {
    const schedules: SpecialistScheduleRule[] = [
      {
        specialistId: 'spec-1',
        dayOfWeek: 4, // Jueves
        startTime: '09:00',
        endTime: '13:00',
        active: true,
      },
    ];

    const busyIntervals: BusyInterval[] = [
      {
        id: 'appt-ocupada',
        specialistId: 'spec-1',
        startsAt: bogotaLocalToUtcDate('2026-11-26', '10:00').toISOString(),
        endsAt: bogotaLocalToUtcDate('2026-11-26', '11:30').toISOString(),
        status: 'confirmed',
      },
      {
        id: 'appt-cancelada',
        specialistId: 'spec-1',
        startsAt: bogotaLocalToUtcDate('2026-11-26', '11:30').toISOString(),
        endsAt: bogotaLocalToUtcDate('2026-11-26', '12:30').toISOString(),
        status: 'cancelled',
      },
    ];

    // Servicio de 60 minutos en turno 09:00–13:00 con bloqueo [10:00, 11:30):
    // - 09:00 -> [09:00, 10:00) LIBRE (contiguo a 10:00)
    // - 09:30 -> [09:30, 10:30) SOLAPA
    // - 10:00, 10:30, 11:00 -> SOLAPAN
    // - 11:30 -> [11:30, 12:30) LIBRE (la cita cancelada no bloquea)
    // - 12:00 -> [12:00, 13:00) LIBRE
    // - 12:30 -> excede las 13:00
    const slots = calcularSlotsDisponiblesBogota({
      fechaYmd: '2026-11-26',
      specialistId: 'spec-1',
      durationMinutes: 60,
      schedules,
      busyIntervals,
    });

    expect(slots.map((s) => s.label)).toEqual(['09:00', '11:30', '12:00']);

    // Si en Bogotá ya son las 09:15 de ese mismo día, el slot 09:00 se descarta
    const slotsDesde915 = calcularSlotsDisponiblesBogota({
      fechaYmd: '2026-11-26',
      specialistId: 'spec-1',
      durationMinutes: 60,
      schedules,
      busyIntervals,
      now: bogotaLocalToUtcDate('2026-11-26', '09:15'),
    });
    expect(slotsDesde915.map((s) => s.label)).toEqual(['11:30', '12:00']);

    // Domingo cerrado por defecto cuando no hay horario personalizado
    const domingoSinHorario = calcularSlotsDisponiblesBogota({
      fechaYmd: '2026-11-29',
      specialistId: 'spec-sin-reglas',
      durationMinutes: 60,
    });
    expect(domingoSinHorario).toEqual([]);
  });
});

describe('2. Prevención de solapamiento, API de reserva y puente "Abrir en Silla"', () => {
  const existentes: BusyInterval[] = [
    {
      id: 'appt-1',
      specialistId: 'spec-ana',
      startsAt: bogotaLocalToUtcDate('2026-11-26', '14:00'),
      endsAt: bogotaLocalToUtcDate('2026-11-26', '16:00'),
      status: 'confirmed',
    },
  ];

  it('detecta solapamientos del mismo especialista, permite turnos contiguos y aísla entre especialistas', () => {
    // Solapamiento parcial (15:30 - 16:30)
    expect(
      haySolapamientoCitas(
        bogotaLocalToUtcDate('2026-11-26', '15:30'),
        bogotaLocalToUtcDate('2026-11-26', '16:30'),
        existentes,
        'spec-ana'
      )
    ).toBe(true);

    // Turnos exactamente contiguos: 13:00–14:00 y 16:00–17:00 permitidos
    expect(
      haySolapamientoCitas(
        bogotaLocalToUtcDate('2026-11-26', '13:00'),
        bogotaLocalToUtcDate('2026-11-26', '14:00'),
        existentes,
        'spec-ana'
      )
    ).toBe(false);
    expect(
      haySolapamientoCitas(
        bogotaLocalToUtcDate('2026-11-26', '16:00'),
        bogotaLocalToUtcDate('2026-11-26', '17:00'),
        existentes,
        'spec-ana'
      )
    ).toBe(false);

    // Otra especialista en el mismo horario NO se bloquea
    expect(
      haySolapamientoCitas(
        bogotaLocalToUtcDate('2026-11-26', '14:00'),
        bogotaLocalToUtcDate('2026-11-26', '16:00'),
        existentes,
        'spec-luisa'
      )
    ).toBe(false);
  });

  it('arma URL de puente "Abrir en Silla" y confirmación WhatsApp de cita', () => {
    const urlSilla = construirUrlAbrirEnSilla({
      id: 'appt-99',
      clientaId: 'cli-42',
      specialistId: 'spec-ana',
      serviceId: 'srv-balayage',
      customerName: 'Daniela Ríos',
      customerPhone: '300 777 8899',
    });

    expect(urlSilla).toContain('appointmentId=appt-99');
    expect(urlSilla).toContain('clientaId=cli-42');
    expect(urlSilla).toContain('estilistaId=spec-ana');
    expect(urlSilla).toContain('servicioId=srv-balayage');

    const { mensaje, whatsappUrl } = armarMensajeWhatsAppCita({
      salonName: 'Atelier Velvet',
      salonWhatsapp: '310 222 3344',
      serviceName: 'Balayage / Diseño de Rubios',
      specialistName: 'Ana Martínez',
      startsAtIso: bogotaLocalToUtcDate('2026-11-26', '10:00').toISOString(),
      customerName: 'Daniela Ríos',
      customerPhone: '300 777 8899',
    });

    expect(mensaje).toContain('26/11/2026 a las 10:00');
    expect(mensaje).toContain('Ana Martínez');
    expect(whatsappUrl).toMatch(/^https:\/\/wa\.me\/573102223344\?text=/);
  });

  it('POST /api/public/appointments rechaza con 409 si el slot ya está ocupado', async () => {
    const specUuid = '550e8400-e29b-41d4-a716-446655440001';
    const srvUuid = '550e8400-e29b-41d4-a716-446655440002';

    mockCheckRateLimit.mockResolvedValue({ ok: true, remaining: 10, reset: Date.now() + 60_000 });
    mockFromAdmin.mockImplementation((tabla: string) => {
      if (tabla === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'org-1', name: 'Atelier Velvet', whatsapp_phone: '3102223344' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (tabla === 'brand_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { display_name: 'Atelier Velvet' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (tabla === 'estilistas') {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ id: specUuid, nombre: 'Ana Martínez' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (tabla === 'specialist_schedules') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      if (tabla === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              neq: () => ({
                neq: () => ({
                  lt: () => ({
                    gt: async () => ({
                      data: [
                        {
                          id: 'appt-existente',
                          specialist_id: specUuid,
                          starts_at: bogotaLocalToUtcDate('2026-11-26', '10:00').toISOString(),
                          ends_at: bogotaLocalToUtcDate('2026-11-26', '11:00').toISOString(),
                          status: 'confirmed',
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            or: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: srvUuid, nombre: 'Hidratación', duracion_minutos: 60 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    });

    const res = await POST(
      new Request('http://localhost/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug: 'atelier-velvet',
          serviceId: srvUuid,
          specialistId: specUuid,
          date: '2026-11-26',
          time: '10:30',
          customerName: 'Paula Castro',
          customerPhone: '300 111 2233',
        }),
      })
    );

    expect(res.status).toBe(409);
  });
});

describe('3. Motor de Reactivación de Clientas (30 / 45 / 60 días + enfriamiento semanal)', () => {
  const ahora = bogotaLocalToUtcDate('2026-11-25', '12:00');

  const crearClientaPrueba = (
    id: string,
    nombre: string,
    ultimaVisita?: string,
    lastReactivationContactAt?: string
  ): Clienta => ({
    id,
    nombre,
    edad: 30,
    telefono: '300 555 6677',
    fechaRegistro: '2026-01-10',
    ultimaVisita,
    totalVisitas: ultimaVisita ? 3 : 0,
    lastReactivationContactAt,
  });

  it('segmenta con precisión clientas inactivas a 30, 45 y 60+ días y excluye visitas recientes', () => {
    const clientas: Clienta[] = [
      crearClientaPrueba('c-reciente', 'Sofía Reciente', '2026-11-10'), // 15 días -> activa
      crearClientaPrueba('c-32', 'Valeria 32d', '2026-10-24'), // 32 días -> tramo 30
      crearClientaPrueba('c-48', 'Natalia 48d', '2026-10-08'), // 48 días -> tramo 45
      crearClientaPrueba('c-75', 'Carolina 75d', '2026-09-11'), // 75 días -> tramo 60
      crearClientaPrueba('c-sin-visita', 'Nueva Sin Visita', undefined),
    ];

    expect(calcularDiasDesdeUltimaVisita('2026-10-24', ahora)).toBe(32);

    const seg30 = segmentarClientasPorReactivar(clientas, { umbralMinimoDias: 30, ahora });
    expect(seg30.map((x) => `${x.clienta.id}:${x.tramo}`)).toEqual([
      'c-75:60',
      'c-48:45',
      'c-32:30',
    ]);

    const seg45 = segmentarClientasPorReactivar(clientas, { umbralMinimoDias: 45, ahora });
    expect(seg45.map((x) => x.clienta.id)).toEqual(['c-75', 'c-48']);

    const seg60 = segmentarClientasPorReactivar(clientas, { umbralMinimoDias: 60, ahora });
    expect(seg60.map((x) => x.clienta.id)).toEqual(['c-75']);
  });

  it('aplica ventana de enfriamiento de 7 días sobre last_reactivation_contact_at y arma link wa.me', () => {
    const hace3Dias = new Date(ahora.getTime() - 3 * 86_400_000).toISOString();
    const hace9Dias = new Date(ahora.getTime() - 9 * 86_400_000).toISOString();

    expect(fueContactadaEstaSemana(hace3Dias, ahora)).toBe(true);
    expect(fueContactadaEstaSemana(hace9Dias, ahora)).toBe(false);

    const clientas: Clienta[] = [
      crearClientaPrueba('c-contactada', 'Juliana Contactada', '2026-09-01', hace3Dias),
      crearClientaPrueba('c-pendiente', 'Andrea Pendiente', '2026-09-15', hace9Dias),
    ];

    const soloPendientes = segmentarClientasPorReactivar(clientas, {
      umbralMinimoDias: 30,
      incluirContactadasEstaSemana: false,
      ahora,
    });
    expect(soloPendientes.map((x) => x.clienta.id)).toEqual(['c-pendiente']);

    const { mensaje, whatsappUrl } = armarEnlaceReactivacionWhatsApp({
      clienta: clientas[1],
      salonNombre: 'Atelier Velvet',
      diasInactiva: 71,
      vitrinaSlug: 'atelier-velvet',
      appUrl: 'https://app.ejemplo.co',
    });

    expect(mensaje).toContain('Hola Andrea');
    expect(mensaje).toContain('*Atelier Velvet*');
    expect(mensaje).toContain('https://app.ejemplo.co/s/atelier-velvet');
    expect(whatsappUrl).toMatch(/^https:\/\/wa\.me\/573005556677\?text=/);
  });
});

describe('4. Auditoría de migración SQL de Agenda y habilitación de ruta /agenda', () => {
  it('verifica tablas, RLS, restricción anti-solapamiento en America/Bogota y ruta /agenda activa', () => {
    const rutaSql = [
      path.resolve(__dirname, '../supabase/migration-agenda-puente.sql'),
      path.resolve(__dirname, '../supabase/_archive/migration-agenda-puente.sql'),
    ].find((p) => existsSync(p));
    expect(rutaSql).toBeDefined();

    const sqlSinComentarios = readFileSync(rutaSql!, 'utf8').replace(/--.*$/gm, '');
    expect(sqlSinComentarios).toMatch(/CREATE TABLE IF NOT EXISTS public\.specialist_schedules\b/);
    expect(sqlSinComentarios).toMatch(/CREATE TABLE IF NOT EXISTS public\.appointments\b/);
    expect(sqlSinComentarios).toMatch(/CREATE TABLE IF NOT EXISTS public\.appointment_events\b/);
    expect(sqlSinComentarios).toMatch(/ALTER TABLE public\.specialist_schedules ENABLE ROW LEVEL SECURITY/);
    expect(sqlSinComentarios).toMatch(/ALTER TABLE public\.appointments ENABLE ROW LEVEL SECURITY/);
    expect(sqlSinComentarios).toMatch(/appointments_no_specialist_overlap/);
    expect(sqlSinComentarios).toMatch(/AT TIME ZONE 'America\/Bogota'/);
    expect(sqlSinComentarios).toMatch(/ADD COLUMN IF NOT EXISTS last_reactivation_contact_at/);
    expect(sqlSinComentarios).not.toMatch(/\bDROP TABLE\b/i);
    expect(sqlSinComentarios).not.toMatch(/\bTRUNCATE\b/i);

    const nextConfig = readFileSync(path.resolve(__dirname, '../next.config.ts'), 'utf8');
    expect(nextConfig).not.toContain("source: '/agenda'");
  });
});
