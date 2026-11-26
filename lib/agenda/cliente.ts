import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import {
  type AppointmentRecord,
  type AppointmentSource,
  type AppointmentStatus,
  type SpecialistScheduleRule,
} from './disponibilidad';

function getClient(client?: SupabaseClient): SupabaseClient {
  return client ?? (createBrowserClient() as unknown as SupabaseClient);
}

function esTablaInexistente(error: { code?: string } | null): boolean {
  return Boolean(
    error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202'
  );
}

function rowToAppointment(r: Record<string, unknown>): AppointmentRecord {
  const specJoin = r.estilistas as { nombre?: string } | null | undefined;
  const srvJoin = r.servicios_salon as { nombre?: string } | null | undefined;

  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    clientaId: typeof r.clienta_id === 'string' ? r.clienta_id : null,
    specialistId: String(r.specialist_id),
    specialistName: specJoin?.nombre ?? undefined,
    serviceId: typeof r.service_id === 'string' ? r.service_id : null,
    serviceName: srvJoin?.nombre ?? undefined,
    customerName: String(r.customer_name ?? ''),
    customerPhone: String(r.customer_phone ?? ''),
    startsAt: String(r.starts_at),
    endsAt: String(r.ends_at),
    status: (r.status as AppointmentStatus) ?? 'pending',
    source: (r.source as AppointmentSource) ?? 'panel',
    notes: typeof r.notes === 'string' ? r.notes : null,
    createdAt: String(r.created_at ?? ''),
  };
}

export async function listarAppointmentsRango(
  params: {
    organizationId: string;
    desdeIso: string;
    hastaIso: string;
  },
  client?: SupabaseClient
): Promise<AppointmentRecord[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, organization_id, clienta_id, specialist_id, service_id, customer_name, customer_phone, starts_at, ends_at, status, source, notes, created_at, estilistas(nombre), servicios_salon(nombre)'
    )
    .eq('organization_id', params.organizationId)
    .gte('starts_at', params.desdeIso)
    .lt('starts_at', params.hastaIso)
    .order('starts_at', { ascending: true });

  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToAppointment(r as Record<string, unknown>));
}

export async function crearAppointmentPanel(
  input: {
    organizationId: string;
    clientaId?: string | null;
    specialistId: string;
    serviceId?: string | null;
    customerName: string;
    customerPhone: string;
    startsAtIso: string;
    endsAtIso: string;
    notes?: string | null;
    status?: AppointmentStatus;
  },
  client?: SupabaseClient
): Promise<AppointmentRecord> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      organization_id: input.organizationId,
      clienta_id: input.clientaId ?? null,
      specialist_id: input.specialistId,
      service_id: input.serviceId ?? null,
      customer_name: input.customerName.trim(),
      customer_phone: input.customerPhone.trim(),
      starts_at: input.startsAtIso,
      ends_at: input.endsAtIso,
      status: input.status ?? 'confirmed',
      source: 'panel',
      notes: input.notes?.trim() || null,
    })
    .select(
      'id, organization_id, clienta_id, specialist_id, service_id, customer_name, customer_phone, starts_at, ends_at, status, source, notes, created_at, estilistas(nombre), servicios_salon(nombre)'
    )
    .single();

  if (error) throw error;
  return rowToAppointment(data as Record<string, unknown>);
}

export async function actualizarEstadoAppointment(
  appointmentId: string,
  nextStatus: AppointmentStatus,
  client?: SupabaseClient
): Promise<AppointmentRecord> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: nextStatus })
    .eq('id', appointmentId)
    .select(
      'id, organization_id, clienta_id, specialist_id, service_id, customer_name, customer_phone, starts_at, ends_at, status, source, notes, created_at, estilistas(nombre), servicios_salon(nombre)'
    )
    .single();

  if (error) throw error;
  return rowToAppointment(data as Record<string, unknown>);
}

export async function listarSchedulesOrg(
  organizationId: string,
  client?: SupabaseClient
): Promise<SpecialistScheduleRule[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('specialist_schedules')
    .select('id, organization_id, specialist_id, day_of_week, start_time, end_time, active')
    .eq('organization_id', organizationId);

  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      organizationId: String(row.organization_id),
      specialistId: String(row.specialist_id),
      dayOfWeek: Number(row.day_of_week),
      startTime: String(row.start_time ?? '09:00').slice(0, 5),
      endTime: String(row.end_time ?? '19:00').slice(0, 5),
      active: Boolean(row.active),
    };
  });
}

export async function guardarScheduleEspecialista(
  rule: {
    organizationId: string;
    specialistId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    active: boolean;
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = getClient(client);
  const { error } = await supabase.from('specialist_schedules').upsert(
    {
      organization_id: rule.organizationId,
      specialist_id: rule.specialistId,
      day_of_week: rule.dayOfWeek,
      start_time: rule.startTime,
      end_time: rule.endTime,
      active: rule.active,
    },
    { onConflict: 'organization_id,specialist_id,day_of_week' }
  );
  if (error) throw error;
}
