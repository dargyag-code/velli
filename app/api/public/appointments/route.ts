import { headers } from 'next/headers';
import {
  checkRateLimit,
  publicOrderLimiter,
  vitrinaPublicaLimiter,
} from '@/lib/api/rateLimit';
import {
  armarMensajeWhatsAppCita,
  bogotaLocalToUtcDate,
  calcularSlotsDisponiblesBogota,
  diaSemanaBogota,
  esFechaYmdValida,
  haySolapamientoCitas,
  parsearMinutosHm,
  sumarDiasYmd,
  type AvailableSlot,
  type BusyInterval,
  type SpecialistScheduleRule,
} from '@/lib/agenda/disponibilidad';
import { esUuidValido } from '@/lib/cotizador';
import { extraerIpDesdeHeaders } from '@/lib/cotizador/whatsapp';
import { createAdminClient } from '@/lib/supabase/admin';
import { esSlugVitrinaValido } from '@/lib/vitrina/motor';
import { numeroWhatsApp } from '@/lib/whatsapp';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

interface ContextoDisponibilidadOrg {
  orgId: string;
  salonName: string;
  salonWhatsapp: string | null;
  specialists: Array<{ id: string; name: string }>;
  schedules: SpecialistScheduleRule[];
  busyIntervals: BusyInterval[];
  durationMinutes: number;
  serviceName: string;
}

async function cargarContextoAgendaPublica(params: {
  slug: string;
  fechaYmd: string;
  serviceId?: string | null;
}): Promise<ContextoDisponibilidadOrg | null> {
  const admin = createAdminClient();
  const slugLimpio = params.slug.trim().toLowerCase();

  const { data: orgRow, error: orgErr } = await admin
    .from('organizations')
    .select('id, name, whatsapp_phone')
    .eq('slug', slugLimpio)
    .maybeSingle();

  if (orgErr || !orgRow) return null;
  const org = orgRow as { id: string; name: string; whatsapp_phone: string | null };

  const dow = diaSemanaBogota(params.fechaYmd);
  const inicioDiaUtc = bogotaLocalToUtcDate(params.fechaYmd, '00:00').toISOString();
  const finDiaUtc = bogotaLocalToUtcDate(sumarDiasYmd(params.fechaYmd, 1), '00:00').toISOString();

  const [
    { data: brandRow },
    { data: estRows },
    { data: schedRows },
    { data: apptRows },
    srvRes,
  ] = await Promise.all([
    admin
      .from('brand_settings')
      .select('display_name')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('estilistas')
      .select('id, nombre')
      .or(`organization_id.eq.${org.id},user_id.eq.${org.id}`)
      .eq('activo', true)
      .order('nombre', { ascending: true }),
    admin
      .from('specialist_schedules')
      .select('specialist_id, day_of_week, start_time, end_time, active')
      .eq('organization_id', org.id)
      .eq('day_of_week', dow),
    admin
      .from('appointments')
      .select('id, specialist_id, starts_at, ends_at, status')
      .eq('organization_id', org.id)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .lt('starts_at', finDiaUtc)
      .gt('ends_at', inicioDiaUtc),
    params.serviceId && esUuidValido(params.serviceId)
      ? admin
          .from('servicios_salon')
          .select('id, nombre, duracion_minutos')
          .eq('id', params.serviceId)
          .or(`organization_id.eq.${org.id},user_id.eq.${org.id}`)
          .eq('activo', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let salonWhatsapp = org.whatsapp_phone?.trim() || null;
  if (!salonWhatsapp) {
    const { data: profRow } = await admin
      .from('profiles')
      .select('telefono')
      .eq('id', org.id)
      .maybeSingle();
    salonWhatsapp =
      ((profRow as { telefono?: string | null } | null)?.telefono ?? '').trim() || null;
  }

  const brand = brandRow as { display_name?: string | null } | null;
  const srv = srvRes.data as { nombre?: string; duracion_minutos?: number | null } | null;

  const specialists = (estRows ?? []).map((r) => {
    const row = r as { id: string; nombre: string };
    return { id: row.id, name: row.nombre };
  });

  const schedules: SpecialistScheduleRule[] = (schedRows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      specialistId: String(row.specialist_id),
      dayOfWeek: Number(row.day_of_week),
      startTime: String(row.start_time ?? '09:00').slice(0, 5),
      endTime: String(row.end_time ?? '19:00').slice(0, 5),
      active: Boolean(row.active),
    };
  });

  const busyIntervals: BusyInterval[] = (apptRows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      specialistId: String(row.specialist_id),
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
    };
  });

  return {
    orgId: org.id,
    salonName: brand?.display_name?.trim() || org.name,
    salonWhatsapp,
    specialists,
    schedules,
    busyIntervals,
    durationMinutes:
      typeof srv?.duracion_minutos === 'number' && srv.duracion_minutos >= 15
        ? srv.duracion_minutos
        : 60,
    serviceName: srv?.nombre?.trim() || 'Servicio en salón',
  };
}

// ── GET /api/public/appointments?slug=...&date=YYYY-MM-DD&serviceId=... ────
export async function GET(req: Request) {
  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(vitrinaPublicaLimiter(), `appt_slots:${ip}`);
  if (!rl.ok) {
    return Response.json(
      { error: 'Demasiadas consultas. Intenta en unos minutos.' },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const date = url.searchParams.get('date');
  const serviceId = url.searchParams.get('serviceId');

  if (!esSlugVitrinaValido(slug) || !esFechaYmdValida(date)) {
    return Response.json(
      { error: 'Parámetros de disponibilidad inválidos' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const ctx = await cargarContextoAgendaPublica({
      slug,
      fechaYmd: date,
      serviceId,
    });
    if (!ctx) {
      return Response.json(
        { error: 'Salón no encontrado' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const ahora = new Date();
    const specialistsWithSlots: Array<{
      id: string;
      name: string;
      slots: AvailableSlot[];
    }> = ctx.specialists.map((spec) => ({
      id: spec.id,
      name: spec.name,
      slots: calcularSlotsDisponiblesBogota({
        fechaYmd: date,
        specialistId: spec.id,
        durationMinutes: ctx.durationMinutes,
        schedules: ctx.schedules,
        busyIntervals: ctx.busyIntervals,
        now: ahora,
      }),
    }));

    return Response.json(
      {
        ok: true,
        date,
        durationMinutes: ctx.durationMinutes,
        specialists: specialistsWithSlots,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('[api.public.appointments.get]', err);
    return Response.json(
      { error: 'No se pudo consultar la disponibilidad' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// ── POST /api/public/appointments ──────────────────────────────────────────
export async function POST(req: Request) {
  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(publicOrderLimiter(), `appt_create:${ip}`);
  if (!rl.ok) {
    return Response.json(
      { error: 'Demasiadas solicitudes de cita. Espera unos minutos.' },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json(
      { error: 'Solicitud inválida' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const raw = body as Record<string, unknown>;
  const slug = raw.organizationSlug;
  const serviceId = typeof raw.serviceId === 'string' ? raw.serviceId.trim() : '';
  const specialistId = typeof raw.specialistId === 'string' ? raw.specialistId.trim() : '';
  const date = raw.date;
  const time = typeof raw.time === 'string' ? raw.time.trim() : '';
  const customerName =
    typeof raw.customerName === 'string' ? raw.customerName.trim().replace(/\s+/g, ' ') : '';
  const customerPhone = typeof raw.customerPhone === 'string' ? raw.customerPhone.trim() : '';
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';

  if (!esSlugVitrinaValido(slug)) {
    return Response.json({ error: 'Organización inválida' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!esUuidValido(specialistId)) {
    return Response.json({ error: 'Selecciona una especialista válida' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (serviceId && !esUuidValido(serviceId)) {
    return Response.json({ error: 'Servicio inválido' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!esFechaYmdValida(date) || parsearMinutosHm(time) === null) {
    return Response.json({ error: 'Fecha u hora inválida' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (customerName.length < 2 || customerName.length > 100) {
    return Response.json({ error: 'Ingresa tu nombre completo' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!numeroWhatsApp(customerPhone)) {
    return Response.json({ error: 'Ingresa un número de WhatsApp válido' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (notes.length > 500) {
    return Response.json({ error: 'Las notas no pueden superar 500 caracteres' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const ctx = await cargarContextoAgendaPublica({
      slug,
      fechaYmd: date,
      serviceId: serviceId || null,
    });
    if (!ctx) {
      return Response.json({ error: 'Vitrina no disponible' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const especialista = ctx.specialists.find((s) => s.id === specialistId);
    if (!especialista) {
      return Response.json(
        { error: 'La especialista seleccionada no está disponible' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const startUtc = bogotaLocalToUtcDate(date, time);
    const endUtc = new Date(startUtc.getTime() + ctx.durationMinutes * 60_000);

    if (haySolapamientoCitas(startUtc, endUtc, ctx.busyIntervals, specialistId)) {
      return Response.json(
        { error: 'Ese horario acaba de ocuparse. Por favor elige otra hora disponible.' },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    const admin = createAdminClient();

    // Vincula automáticamente `clienta_id` si el teléfono ya pertenece a una clienta del salón
    let clientaIdMatch: string | null = null;
    const telNormalizado = numeroWhatsApp(customerPhone);
    const { data: candidatas } = await admin
      .from('clientas')
      .select('id, telefono')
      .or(`organization_id.eq.${ctx.orgId},user_id.eq.${ctx.orgId}`)
      .limit(200);

    if (telNormalizado && Array.isArray(candidatas)) {
      const encontrada = candidatas.find((c) => {
        const t = (c as { telefono?: string | null }).telefono;
        return t ? numeroWhatsApp(t) === telNormalizado : false;
      }) as { id: string } | undefined;
      if (encontrada) clientaIdMatch = encontrada.id;
    }

    const { data: insertada, error: insertErr } = await admin
      .from('appointments')
      .insert({
        organization_id: ctx.orgId,
        clienta_id: clientaIdMatch,
        specialist_id: specialistId,
        service_id: serviceId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        starts_at: startUtc.toISOString(),
        ends_at: endUtc.toISOString(),
        status: 'pending',
        source: 'web_vitrina',
        notes: notes || null,
      })
      .select('id, starts_at, ends_at')
      .single();

    if (insertErr || !insertada) {
      if (
        insertErr?.code === '23P01' ||
        (insertErr?.message ?? '').includes('APPOINTMENT_OVERLAP')
      ) {
        return Response.json(
          { error: 'Ese horario acaba de ocuparse. Por favor elige otra hora disponible.' },
          { status: 409, headers: NO_STORE_HEADERS }
        );
      }
      console.error('[api.public.appointments.insert]', insertErr);
      return Response.json(
        { error: 'No se pudo guardar tu cita. Intenta nuevamente.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const row = insertada as { id: string; starts_at: string; ends_at: string };
    const { mensaje, whatsappUrl } = armarMensajeWhatsAppCita({
      salonName: ctx.salonName,
      salonWhatsapp: ctx.salonWhatsapp,
      serviceName: ctx.serviceName,
      specialistName: especialista.name,
      startsAtIso: row.starts_at,
      customerName,
      customerPhone,
      notes: notes || null,
    });

    return Response.json(
      {
        ok: true,
        appointmentId: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        whatsappUrl,
        message: mensaje,
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('[api.public.appointments.unexpected]', err);
    return Response.json(
      { error: 'Servicio temporalmente no disponible' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
