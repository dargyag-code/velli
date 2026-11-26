'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Plus,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
import {
  actualizarEstadoAppointment,
  crearAppointmentPanel,
  guardarScheduleEspecialista,
  listarAppointmentsRango,
  listarSchedulesOrg,
} from '@/lib/agenda/cliente';
import {
  bogotaLocalToUtcDate,
  calcularSlotsDisponiblesBogota,
  construirUrlAbrirEnSilla,
  diaSemanaBogota,
  formatearFechaBogotaYmd,
  formatearHoraBogotaHm,
  haySolapamientoCitas,
  horarioPorDefectoEspecialista,
  sumarDiasYmd,
  type AppointmentRecord,
  type AppointmentStatus,
  type SpecialistScheduleRule,
} from '@/lib/agenda/disponibilidad';
import {
  listarEstilistas,
  listarServiciosSalon,
  type EstilistaSalon,
  type ServicioSalon,
} from '@/lib/cotizador';
import { getAllClientas } from '@/lib/db';
import { showToast } from '@/lib/toast';
import type { Clienta } from '@/lib/types';
import { obtenerOrganizacionActivaPanel, type OrganizacionPanelResumen } from '@/lib/vitrina';
import { enlaceWhatsApp } from '@/lib/whatsapp';

const DIAS_SEMANA_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const DIAS_SEMANA_LARGOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

const STATUS_BADGE: Record<
  AppointmentStatus,
  { label: string; classes: string }
> = {
  pending: {
    label: 'Por confirmar',
    classes: 'bg-[#F5EBE8] text-[#3B0D1E] border-[#E8CFC8]',
  },
  confirmed: {
    label: 'Confirmada',
    classes: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
  },
  in_chair: {
    label: 'En silla',
    classes: 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]',
  },
  completed: {
    label: 'Completada',
    classes: 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/30',
  },
  no_show: {
    label: 'No asistió',
    classes: 'bg-[#FFF7F5] text-[#D97757] border-[#D97757]/30',
  },
  cancelled: {
    label: 'Cancelada',
    classes: 'bg-[#FAF7F5] text-[#947C85] border-[#EFE8E4]',
  },
};

function inicioSemanaLunesYmd(fechaYmd: string): string {
  const dow = diaSemanaBogota(fechaYmd);
  const retroceso = dow === 0 ? -6 : 1 - dow;
  return sumarDiasYmd(fechaYmd, retroceso);
}

function formatearTituloDia(fechaYmd: string): string {
  const [yyyy, mm, dd] = fechaYmd.split('-');
  const dow = diaSemanaBogota(fechaYmd);
  return `${DIAS_SEMANA_LARGOS[dow]} ${dd}/${mm}/${yyyy}`;
}

export default function AgendaPage() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [org, setOrg] = useState<OrganizacionPanelResumen | null>(null);
  const [vista, setVista] = useState<'dia' | 'semana'>('dia');
  const [fechaBaseYmd, setFechaBaseYmd] = useState<string>(() =>
    formatearFechaBogotaYmd(new Date())
  );
  const [filtroEspecialistaId, setFiltroEspecialistaId] = useState<string>('todas');

  const [estilistas, setEstilistas] = useState<EstilistaSalon[]>([]);
  const [servicios, setServicios] = useState<ServicioSalon[]>([]);
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [schedules, setSchedules] = useState<SpecialistScheduleRule[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);

  // Modal Nueva Cita
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaClientaId, setNuevaClientaId] = useState<string>('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoServicioId, setNuevoServicioId] = useState<string>('');
  const [nuevaEspecialistaId, setNuevaEspecialistaId] = useState<string>('');
  const [nuevaFecha, setNuevaFecha] = useState<string>(() =>
    formatearFechaBogotaYmd(new Date())
  );
  const [nuevaHora, setNuevaHora] = useState<string>('10:00');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [guardandoCita, setGuardandoCita] = useState(false);

  // Modal Horarios por Especialista
  const [modalHorarios, setModalHorarios] = useState(false);
  const [horarioSpecId, setHorarioSpecId] = useState<string>('');
  const [guardandoHorarioDia, setGuardandoHorarioDia] = useState<number | null>(null);

  const esAdmin = org?.role === 'owner' || org?.role === 'manager';

  const rangoConsulta = useMemo(() => {
    if (vista === 'dia') {
      const desde = bogotaLocalToUtcDate(fechaBaseYmd, '00:00').toISOString();
      const hasta = bogotaLocalToUtcDate(sumarDiasYmd(fechaBaseYmd, 1), '00:00').toISOString();
      return { desde, hasta, diasYmd: [fechaBaseYmd] };
    }
    const lunes = inicioSemanaLunesYmd(fechaBaseYmd);
    const diasYmd = Array.from({ length: 7 }, (_, idx) => sumarDiasYmd(lunes, idx));
    const desde = bogotaLocalToUtcDate(lunes, '00:00').toISOString();
    const hasta = bogotaLocalToUtcDate(sumarDiasYmd(lunes, 7), '00:00').toISOString();
    return { desde, hasta, diasYmd };
  }, [vista, fechaBaseYmd]);

  const cargarAgenda = useCallback(async () => {
    setCargando(true);
    try {
      const [orgActiva, ests, svcs, clis] = await Promise.all([
        obtenerOrganizacionActivaPanel().catch(() => null),
        listarEstilistas({ soloActivas: true }).catch(() => [] as EstilistaSalon[]),
        listarServiciosSalon({ soloActivos: true }).catch(() => [] as ServicioSalon[]),
        getAllClientas().catch(() => [] as Clienta[]),
      ]);

      setOrg(orgActiva);
      setEstilistas(ests);
      setServicios(svcs);
      setClientas(clis);

      if (ests[0]) {
        setNuevaEspecialistaId((prev) => prev || ests[0].id);
        setHorarioSpecId((prev) => prev || ests[0].id);
      }
      if (svcs[0]) {
        setNuevoServicioId((prev) => prev || svcs[0].id);
      }

      if (orgActiva) {
        const [citasRango, reglasHorario] = await Promise.all([
          listarAppointmentsRango({
            organizationId: orgActiva.id,
            desdeIso: rangoConsulta.desde,
            hastaIso: rangoConsulta.hasta,
          }),
          listarSchedulesOrg(orgActiva.id),
        ]);
        setAppointments(citasRango);
        setSchedules(reglasHorario);
      }
    } finally {
      setCargando(false);
    }
  }, [rangoConsulta.desde, rangoConsulta.hasta]);

  useEffect(() => {
    cargarAgenda();
  }, [cargarAgenda]);

  const citasFiltradas = useMemo(
    () =>
      filtroEspecialistaId === 'todas'
        ? appointments
        : appointments.filter((c) => c.specialistId === filtroEspecialistaId),
    [appointments, filtroEspecialistaId]
  );

  const moverPeriodo = (direccion: -1 | 1) => {
    const salto = vista === 'dia' ? direccion : direccion * 7;
    setFechaBaseYmd((prev) => sumarDiasYmd(prev, salto));
  };

  const abrirEnSilla = async (cita: AppointmentRecord) => {
    if (cita.status === 'pending' || cita.status === 'confirmed') {
      actualizarEstadoAppointment(cita.id, 'in_chair').catch(() => {});
    }
    router.push(construirUrlAbrirEnSilla(cita));
  };

  const cambiarEstado = async (cita: AppointmentRecord, next: AppointmentStatus) => {
    try {
      const actualizada = await actualizarEstadoAppointment(cita.id, next);
      setAppointments((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)));
      showToast('Estado de cita actualizado', 'success');
    } catch {
      showToast('No se pudo actualizar la cita', 'error');
    }
  };

  const slotsModalNueva = useMemo(() => {
    if (!nuevaEspecialistaId) return [];
    const srv = servicios.find((s) => s.id === nuevoServicioId);
    return calcularSlotsDisponiblesBogota({
      fechaYmd: nuevaFecha,
      specialistId: nuevaEspecialistaId,
      durationMinutes: srv?.duracionMinutos ?? 60,
      schedules,
      busyIntervals: appointments,
    });
  }, [nuevaFecha, nuevaEspecialistaId, nuevoServicioId, servicios, schedules, appointments]);

  const crearCitaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !nuevaEspecialistaId || guardandoCita) return;

    const srv = servicios.find((s) => s.id === nuevoServicioId);
    const duracion = srv?.duracionMinutos ?? 60;
    const startUtc = bogotaLocalToUtcDate(nuevaFecha, nuevaHora);
    const endUtc = new Date(startUtc.getTime() + duracion * 60_000);

    if (haySolapamientoCitas(startUtc, endUtc, appointments, nuevaEspecialistaId)) {
      showToast('La especialista ya tiene una cita en ese horario', 'error');
      return;
    }

    setGuardandoCita(true);
    try {
      const creada = await crearAppointmentPanel({
        organizationId: org.id,
        clientaId: nuevaClientaId || null,
        specialistId: nuevaEspecialistaId,
        serviceId: nuevoServicioId || null,
        customerName: nuevoNombre,
        customerPhone: nuevoTelefono,
        startsAtIso: startUtc.toISOString(),
        endsAtIso: endUtc.toISOString(),
        notes: nuevasNotas,
        status: 'confirmed',
      });
      setAppointments((prev) =>
        [...prev, creada].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      );
      setModalNueva(false);
      setNuevaClientaId('');
      setNuevoNombre('');
      setNuevoTelefono('');
      setNuevasNotas('');
      showToast('Cita agendada correctamente', 'success');
    } catch (err) {
      console.error('[agenda.crear]', err);
      showToast('No se pudo guardar la cita (verifica horario o solapamiento)', 'error');
    } finally {
      setGuardandoCita(false);
    }
  };

  const obtenerReglaDia = (specialistId: string, dow: number): SpecialistScheduleRule => {
    return (
      schedules.find((s) => s.specialistId === specialistId && s.dayOfWeek === dow) ??
      horarioPorDefectoEspecialista(specialistId, dow)
    );
  };

  const actualizarReglaDia = async (
    dow: number,
    patch: Partial<Pick<SpecialistScheduleRule, 'startTime' | 'endTime' | 'active'>>
  ) => {
    if (!org || !horarioSpecId || !esAdmin) return;
    const actual = obtenerReglaDia(horarioSpecId, dow);
    const siguiente: SpecialistScheduleRule = {
      ...actual,
      ...patch,
      specialistId: horarioSpecId,
      dayOfWeek: dow,
    };
    setGuardandoHorarioDia(dow);
    try {
      await guardarScheduleEspecialista({
        organizationId: org.id,
        specialistId: horarioSpecId,
        dayOfWeek: dow,
        startTime: siguiente.startTime,
        endTime: siguiente.endTime,
        active: siguiente.active,
      });
      setSchedules((prev) => {
        const resto = prev.filter(
          (s) => !(s.specialistId === horarioSpecId && s.dayOfWeek === dow)
        );
        return [...resto, siguiente];
      });
      showToast('Horario actualizado', 'success');
    } catch {
      showToast('Verifica que la hora final sea mayor a la inicial', 'error');
    } finally {
      setGuardandoHorarioDia(null);
    }
  };

  const estilistaMap = useMemo(
    () => Object.fromEntries(estilistas.map((e) => [e.id, e.nombre])),
    [estilistas]
  );
  const servicioMap = useMemo(
    () => Object.fromEntries(servicios.map((s) => [s.id, s.nombre])),
    [servicios]
  );

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans pb-16">
      <VelvetTopHeader nombreSalon={org?.name} ciudadSalon={org?.city ?? undefined} />

      {/* Sub-header Agenda */}
      <div className="border-b border-[#EFE8E4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
              Puente Operativo · Zona Horaria Bogotá (UTC-5)
            </span>
            <h1 className="m-0 mt-0.5 font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#3B0D1E]">
              Agenda & Silla
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {esAdmin && estilistas.length > 0 && (
              <button
                type="button"
                onClick={() => setModalHorarios(true)}
                className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white hover:bg-[#F5EBE8] border border-[#EFE8E4] text-xs font-bold text-[#3B0D1E] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal size={14} />
                <span>Horarios equipo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setNuevaFecha(fechaBaseYmd);
                setModalNueva(true);
              }}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Plus size={14} />
              <span>Nueva cita</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Controles de vista (Diaria / Semanal), Navegación de fecha y Filtro por especialista */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F5EBE8] border border-[#EFE8E4]">
            <button
              type="button"
              onClick={() => setVista('dia')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl font-sans text-xs font-bold cursor-pointer border-none ${
                vista === 'dia'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5]'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
            >
              Vista diaria
            </button>
            <button
              type="button"
              onClick={() => setVista('semana')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl font-sans text-xs font-bold cursor-pointer border-none ${
                vista === 'semana'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5]'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
            >
              Vista semanal
            </button>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-white border border-[#EFE8E4] rounded-2xl p-1 shadow-velvet">
            <button
              type="button"
              onClick={() => moverPeriodo(-1)}
              aria-label="Periodo anterior"
              className="w-9 h-9 rounded-xl bg-transparent hover:bg-[#FAF7F5] border-none text-[#3B0D1E] flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setFechaBaseYmd(formatearFechaBogotaYmd(new Date()))}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-[#FAF7F5] border-none font-sans text-xs font-bold text-[#3B0D1E] cursor-pointer"
            >
              {vista === 'dia'
                ? formatearTituloDia(fechaBaseYmd)
                : `Semana ${rangoConsulta.diasYmd[0]} → ${rangoConsulta.diasYmd[6]}`}
            </button>
            <button
              type="button"
              onClick={() => moverPeriodo(1)}
              aria-label="Periodo siguiente"
              className="w-9 h-9 rounded-xl bg-transparent hover:bg-[#FAF7F5] border-none text-[#3B0D1E] flex items-center justify-center cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Filtro por especialista */}
        {estilistas.length > 0 && (
          <div className="v-noscroll flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFiltroEspecialistaId('todas')}
              className={`min-h-[38px] shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                filtroEspecialistaId === 'todas'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]'
                  : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8]'
              }`}
            >
              Todo el equipo
            </button>
            {estilistas.map((est) => {
              const activa = filtroEspecialistaId === est.id;
              return (
                <button
                  key={est.id}
                  type="button"
                  onClick={() => setFiltroEspecialistaId(est.id)}
                  className={`min-h-[38px] shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                    activa
                      ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]'
                      : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8]'
                  }`}
                >
                  <UserCheck size={13} />
                  <span>{est.nombre}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Cuerpo de citas (Diaria o Semanal) */}
        {cargando ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-28 rounded-3xl" />
            ))}
          </div>
        ) : vista === 'dia' ? (
          citasFiltradas.length === 0 ? (
            <section className="bg-white rounded-3xl border border-[#EFE8E4] p-10 text-center shadow-velvet">
              <CalendarIcon size={26} className="text-[#947C85] mx-auto mb-3" />
              <h2 className="m-0 font-display text-xl font-semibold text-[#3B0D1E]">
                Sin citas programadas para este día
              </h2>
              <p className="mt-1.5 mb-0 text-xs text-[#6B535C] max-w-sm mx-auto leading-relaxed">
                Las reservas confirmadas desde tu vitrina pública `/s/{org?.slug ?? 'salon'}` o registradas manualmente aparecerán aquí listas para abrir en silla.
              </p>
            </section>
          ) : (
            <div className="space-y-3.5">
              {citasFiltradas.map((cita) => (
                <TarjetaCitaAgenda
                  key={cita.id}
                  cita={cita}
                  specialistName={cita.specialistName ?? estilistaMap[cita.specialistId] ?? 'Especialista'}
                  serviceName={
                    cita.serviceName ??
                    (cita.serviceId ? servicioMap[cita.serviceId] : undefined) ??
                    'Servicio capilar'
                  }
                  salonName={org?.name ?? 'Tu Salón'}
                  onAbrirEnSilla={() => abrirEnSilla(cita)}
                  onCambiarEstado={(st) => cambiarEstado(cita, st)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {rangoConsulta.diasYmd.map((diaYmd) => {
              const dow = diaSemanaBogota(diaYmd);
              const [, mm, dd] = diaYmd.split('-');
              const citasDia = citasFiltradas.filter(
                (c) => formatearFechaBogotaYmd(c.startsAt) === diaYmd
              );
              const esHoy = diaYmd === formatearFechaBogotaYmd(new Date());

              return (
                <section
                  key={diaYmd}
                  className={`bg-white rounded-3xl border p-3.5 shadow-velvet flex flex-col gap-2.5 min-h-[220px] ${
                    esHoy ? 'border-[#3B0D1E]' : 'border-[#EFE8E4]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFechaBaseYmd(diaYmd);
                      setVista('dia');
                    }}
                    className="w-full text-left bg-transparent border-none p-0 pb-2 border-b border-[#EFE8E4] flex items-baseline justify-between cursor-pointer"
                  >
                    <span className="font-sans text-xs font-bold uppercase tracking-[0.06em] text-[#6B535C]">
                      {DIAS_SEMANA_CORTOS[dow]}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#3B0D1E] tabular-nums">
                      {dd}/{mm}
                    </span>
                  </button>

                  {citasDia.length === 0 ? (
                    <span className="text-[11px] text-[#947C85] py-4 text-center">Libre</span>
                  ) : (
                    <div className="space-y-2">
                      {citasDia.map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[11px] font-bold text-[#3B0D1E] tabular-nums">
                              {formatearHoraBogotaHm(c.startsAt)}
                            </span>
                            <span className="text-[10px] font-semibold text-[#6B535C] truncate">
                              {c.specialistName ?? estilistaMap[c.specialistId] ?? ''}
                            </span>
                          </div>
                          <div className="font-sans text-xs font-bold text-[#3B0D1E] truncate">
                            {c.customerName}
                          </div>
                          {c.status !== 'cancelled' && c.status !== 'no_show' && (
                            <button
                              type="button"
                              onClick={() => abrirEnSilla(c)}
                              className="w-full py-1 px-2 rounded-xl bg-[#3B0D1E] text-[#FAF7F5] font-sans text-[10px] font-bold cursor-pointer border-none"
                            >
                              Abrir en Silla
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal Nueva Cita */}
      {modalNueva && (
        <div
          onClick={() => !guardandoCita && setModalNueva(false)}
          className="fixed inset-0 z-50 bg-[#1F050F]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl border border-[#EFE8E4] p-6 sm:p-7 shadow-velvet pb-safe"
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="m-0 font-display text-2xl font-semibold text-[#3B0D1E]">
                Agendar cita en salón
              </h2>
              <button
                type="button"
                onClick={() => setModalNueva(false)}
                className="w-9 h-9 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={crearCitaManual} className="space-y-3.5">
              {clientas.length > 0 && (
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Clienta registrada (opcional)
                  </span>
                  <select
                    value={nuevaClientaId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNuevaClientaId(id);
                      const cli = clientas.find((c) => c.id === id);
                      if (cli) {
                        setNuevoNombre(cli.nombre);
                        setNuevoTelefono(cli.telefono);
                      }
                    }}
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                  >
                    <option value="">— Nueva / ingreso rápido —</option>
                    {clientas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.telefono ? `· ${c.telefono}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Nombre clienta *
                  </span>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Teléfono / WhatsApp *
                  </span>
                  <input
                    type="tel"
                    required
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    placeholder="300 123 4567"
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Especialista *
                  </span>
                  <select
                    required
                    value={nuevaEspecialistaId}
                    onChange={(e) => setNuevaEspecialistaId(e.target.value)}
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                  >
                    {estilistas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Servicio
                  </span>
                  <select
                    value={nuevoServicioId}
                    onChange={(e) => setNuevoServicioId(e.target.value)}
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                  >
                    {servicios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Fecha *
                  </span>
                  <input
                    type="date"
                    required
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Hora disponible *
                  </span>
                  {slotsModalNueva.length > 0 ? (
                    <select
                      value={
                        slotsModalNueva.some((s) => s.label === nuevaHora)
                          ? nuevaHora
                          : slotsModalNueva[0].label
                      }
                      onChange={(e) => setNuevaHora(e.target.value)}
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                    >
                      {slotsModalNueva.map((slot) => (
                        <option key={slot.label} value={slot.label}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="time"
                      required
                      value={nuevaHora}
                      onChange={(e) => setNuevaHora(e.target.value)}
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                    />
                  )}
                </label>
              </div>

              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                  Notas
                </span>
                <input
                  type="text"
                  maxLength={400}
                  value={nuevasNotas}
                  onChange={(e) => setNuevasNotas(e.target.value)}
                  placeholder="Opcional…"
                  className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                />
              </label>

              <button
                type="submit"
                disabled={guardandoCita || estilistas.length === 0}
                className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-sm font-bold cursor-pointer disabled:opacity-50 border-none"
              >
                {guardandoCita ? 'Guardando cita…' : 'Guardar cita'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Horarios por Especialista */}
      {modalHorarios && esAdmin && (
        <div
          onClick={() => setModalHorarios(false)}
          className="fixed inset-0 z-50 bg-[#1F050F]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl border border-[#EFE8E4] p-6 sm:p-7 shadow-velvet pb-safe space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 font-display text-2xl font-semibold text-[#3B0D1E]">
                Horarios por especialista
              </h2>
              <button
                type="button"
                onClick={() => setModalHorarios(false)}
                className="w-9 h-9 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <select
              value={horarioSpecId}
              onChange={(e) => setHorarioSpecId(e.target.value)}
              className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-bold text-[#3B0D1E]"
            >
              {estilistas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>

            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const regla = obtenerReglaDia(horarioSpecId, dow);
                return (
                  <div
                    key={dow}
                    className="p-3 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] flex flex-wrap items-center justify-between gap-2"
                  >
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#3B0D1E] cursor-pointer min-w-[105px]">
                      <input
                        type="checkbox"
                        checked={regla.active}
                        disabled={guardandoHorarioDia === dow}
                        onChange={(e) => actualizarReglaDia(dow, { active: e.target.checked })}
                      />
                      <span>{DIAS_SEMANA_LARGOS[dow]}</span>
                    </label>

                    {regla.active ? (
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
                        <input
                          type="time"
                          value={regla.startTime}
                          onChange={(e) =>
                            actualizarReglaDia(dow, { startTime: e.target.value })
                          }
                          className="bg-white border border-[#EFE8E4] rounded-xl px-2 py-1 text-xs text-[#3B0D1E]"
                        />
                        <span>–</span>
                        <input
                          type="time"
                          value={regla.endTime}
                          onChange={(e) => actualizarReglaDia(dow, { endTime: e.target.value })}
                          className="bg-white border border-[#EFE8E4] rounded-xl px-2 py-1 text-xs text-[#3B0D1E]"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[#947C85]">Día libre</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaCitaAgenda({
  cita,
  specialistName,
  serviceName,
  salonName,
  onAbrirEnSilla,
  onCambiarEstado,
}: {
  cita: AppointmentRecord;
  specialistName: string;
  serviceName: string;
  salonName: string;
  onAbrirEnSilla: () => void;
  onCambiarEstado: (st: AppointmentStatus) => void;
}) {
  const badge = STATUS_BADGE[cita.status];
  const horaInicio = formatearHoraBogotaHm(cita.startsAt);
  const horaFin = formatearHoraBogotaHm(cita.endsAt);
  const chatUrl = enlaceWhatsApp(
    cita.customerPhone,
    `Hola ${cita.customerName}, te confirmamos tu cita de *${serviceName}* en *${salonName}* a las ${horaInicio}.`
  );
  const activaParaSilla = cita.status !== 'cancelled' && cita.status !== 'no_show';

  return (
    <article className="bg-white rounded-3xl border border-[#EFE8E4] p-5 sm:p-6 shadow-velvet flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] font-mono text-xs font-bold text-[#3B0D1E] tabular-nums">
            <Clock size={13} />
            {horaInicio} – {horaFin}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.classes}`}>
            {badge.label}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[11px] font-semibold text-[#6B535C]">
            {cita.source === 'web_vitrina' ? 'Vitrina Web' : 'Salón'}
          </span>
        </div>

        <div>
          <h3 className="m-0 font-sans text-base sm:text-lg font-bold text-[#3B0D1E]">
            {cita.customerName}{' '}
            <span className="font-mono text-xs font-normal text-[#6B535C] tabular-nums">
              · {cita.customerPhone}
            </span>
          </h3>
          <p className="m-0 mt-0.5 text-xs text-[#6B535C]">
            <strong className="text-[#3B0D1E]">{serviceName}</strong> · Especialista:{' '}
            <span className="font-semibold text-[#3B0D1E]">{specialistName}</span>
          </p>
          {cita.notes && (
            <p className="m-0 mt-1 text-xs text-[#947C85] italic">“{cita.notes}”</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {activaParaSilla && (
          <button
            type="button"
            onClick={onAbrirEnSilla}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer border-none"
          >
            <Sparkles size={14} />
            <span>Abrir en Silla</span>
            <ArrowRight size={13} />
          </button>
        )}

        {cita.status === 'pending' && (
          <button
            type="button"
            onClick={() => onCambiarEstado('confirmed')}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#F0FDFA] hover:opacity-95 border border-[#0D9488]/30 text-[#0D9488] font-sans text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Check size={14} />
            <span>Confirmar</span>
          </button>
        )}

        {(cita.status === 'confirmed' || cita.status === 'in_chair') && (
          <button
            type="button"
            onClick={() => onCambiarEstado('completed')}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#F0FDFA] border border-[#0D9488]/30 text-[#0D9488] font-sans text-xs font-bold cursor-pointer"
          >
            Completada
          </button>
        )}

        {chatUrl && (
          <a
            href={chatUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escribir por WhatsApp"
            className="w-10 h-10 rounded-xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center no-underline"
          >
            <MessageCircle size={15} />
          </a>
        )}

        {activaParaSilla && cita.status !== 'completed' && (
          <button
            type="button"
            onClick={() => onCambiarEstado('cancelled')}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#FFF7F5] border border-[#D97757]/30 text-[#D97757] font-sans text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
        )}
      </div>
    </article>
  );
}
