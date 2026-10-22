'use client';
// ══════════════════════════════════════════════════════════════════════════
// Citas de servicio de la agenda (validación técnica 6.P7).
//
// Bloqueos que se aplican aquí (la DB los refuerza con citas_guard_legal):
//   a) Confirmar un servicio de color con clienta "nueva en color" o "cambio
//      de marca química" exige prueba de sensibilidad negativa dentro de la
//      ventana de 48 h (validez 14 días). La decoloración exige además el
//      consentimiento químico vigente.
//   b) "Día de lavado tipo 4" e "instalación de peinado protector" reservan
//      automáticamente el bloque configurado por el salón (2–4 h) y no
//      admiten citas encima.
// ══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus, Lock, ShieldAlert, Check, Clock, ChevronRight,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Btn, Chip } from '@/components/v2';
import { Clienta } from '@/lib/types';
import { getAllClientas } from '@/lib/db';
import { showToast } from '@/lib/toast';
import {
  CitaServicio,
  listarCitasServicio,
  crearCitaServicio,
  cambiarEstadoCita,
  listarPruebasSensibilidad,
} from '@/lib/agenda/citas';
import {
  SERVICIOS_AGENDA,
  clasificarServicio,
  duracionBloqueoTipo4,
  evaluarConfirmacionCita,
  solapaConBloqueoTipo4,
  traducirErrorAgenda,
  type PruebaSensibilidad,
} from '@/lib/agenda/reglas';
import { listarConsentimientos, type ConsentimientoClienta } from '@/lib/consentimientos';

function fechaHoraCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function duracionLabel(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ── Modal nueva cita ───────────────────────────────────────────────────────

function ModalNuevaCita({
  clientas, citasExistentes, bloqueoTipo4Minutos, onClose, onCreada,
}: {
  clientas: Clienta[];
  citasExistentes: CitaServicio[];
  bloqueoTipo4Minutos: number;
  onClose: () => void;
  onCreada: () => void;
}) {
  const hoy = new Date();
  const [clientaId, setClientaId] = useState('');
  const [servicio, setServicio] = useState('');
  const [fecha, setFecha] = useState(hoy.toISOString().slice(0, 10));
  const [hora, setHora] = useState('09:00');
  const [duracion, setDuracion] = useState(60);
  const [guardando, setGuardando] = useState(false);

  const clase = clasificarServicio(servicio);
  const esBloqueo = clase === 'bloqueo_tipo4';
  const duracionEfectiva = esBloqueo
    ? duracionBloqueoTipo4(bloqueoTipo4Minutos)
    : duracion;

  const inicio = fecha && hora ? new Date(`${fecha}T${hora}`) : null;

  // Aviso de solape antes de intentar guardar (el trigger es la barrera real).
  const haySolape = useMemo(() => {
    if (!inicio || Number.isNaN(inicio.getTime())) return false;
    return solapaConBloqueoTipo4(
      {
        fecha: inicio.toISOString(),
        duracionMinutos: duracionEfectiva,
        servicio,
        estado: 'pendiente',
      },
      citasExistentes.map((c) => ({
        fecha: c.fecha,
        duracionMinutos: c.duracionMinutos,
        servicio: c.servicio,
        estado: c.estado,
      }))
    );
  }, [inicio, duracionEfectiva, servicio, citasExistentes]);

  const crear = async () => {
    if (!clientaId || !servicio || !inicio) return;
    setGuardando(true);
    try {
      await crearCitaServicio({
        clientaId,
        fecha: inicio,
        duracionMinutos: duracionEfectiva,
        servicio,
      });
      showToast('Cita agendada', 'success');
      onCreada();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[agenda.crear]', e);
      showToast(traducirErrorAgenda(msg), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Nueva cita de servicio">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-caps">Clienta *</span>
          <select
            value={clientaId}
            onChange={(e) => setClientaId(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
              outline: 'none', fontSize: 13, background: 'var(--bg-card)',
              fontFamily: 'var(--font-sans)', color: 'var(--text-main)', width: '100%',
            }}
          >
            <option value="">Selecciona una clienta…</option>
            {clientas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-caps">Servicio *</span>
          <select
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
              outline: 'none', fontSize: 13, background: 'var(--bg-card)',
              fontFamily: 'var(--font-sans)', color: 'var(--text-main)', width: '100%',
            }}
          >
            <option value="">Selecciona un servicio…</option>
            {SERVICIOS_AGENDA.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input
            label="Fecha *"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Input
            label="Hora *"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>

        {esBloqueo ? (
          <div
            style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 12,
              background: 'var(--primary-pale)', border: '1px solid rgba(45, 90, 39, 0.18)',
            }}
          >
            <Lock size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--primary)', lineHeight: 1.45 }}>
              Este servicio reserva un bloque de{' '}
              <strong>{duracionLabel(duracionEfectiva)}</strong> de tu agenda.
              No se podrán programar citas cortas encima.
            </p>
          </div>
        ) : (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="v-caps">Duración</span>
            <select
              value={duracion}
              onChange={(e) => setDuracion(Number(e.target.value))}
              style={{
                padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                outline: 'none', fontSize: 13, background: 'var(--bg-card)',
                fontFamily: 'var(--font-sans)', color: 'var(--text-main)', width: '100%',
              }}
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{duracionLabel(m)}</option>
              ))}
            </select>
          </label>
        )}

        {haySolape && (
          <div
            style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 12,
              background: '#FCEEEE', border: '1px solid rgba(178,58,58,0.18)',
            }}
          >
            <ShieldAlert size={14} style={{ color: '#7A1F1F', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11.5, color: '#7A1F1F', lineHeight: 1.45 }}>
              Ese horario se cruza con un bloque extendido ya reservado. Elige
              otro horario.
            </p>
          </div>
        )}

        <Btn
          variant="primary"
          size="lg"
          fullWidth
          onClick={crear}
          disabled={!clientaId || !servicio || !inicio || haySolape || guardando}
        >
          {guardando ? 'Agendando…' : 'Agendar cita'}
        </Btn>
      </div>
    </Modal>
  );
}

// ── Tarjeta de cita con confirmación bloqueada ─────────────────────────────

function CitaServicioCard({
  cita, clienta, onCambio,
}: {
  cita: CitaServicio;
  clienta: Clienta | undefined;
  onCambio: () => void;
}) {
  const [pruebas, setPruebas] = useState<PruebaSensibilidad[]>([]);
  const [consentimientos, setConsentimientos] = useState<ConsentimientoClienta[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const clase = clasificarServicio(cita.servicio);
  const necesitaChequeo = clase === 'color' || clase === 'decoloracion';

  useEffect(() => {
    if (!necesitaChequeo || !clienta) return;
    let activo = true;
    Promise.all([
      listarPruebasSensibilidad(clienta.id),
      listarConsentimientos(clienta.id),
    ])
      .then(([ps, cs]) => {
        if (!activo) return;
        setPruebas(ps);
        setConsentimientos(cs);
      })
      .catch((e) => console.error('[agenda.chequeo]', e));
    return () => { activo = false; };
  }, [necesitaChequeo, clienta]);

  const bloqueos = clienta
    ? evaluarConfirmacionCita({
        servicio: cita.servicio,
        fechaCita: new Date(cita.fecha),
        clienta: {
          nuevaEnColor: clienta.nuevaEnColor,
          cambioMarcaQuimica: clienta.cambioMarcaQuimica,
        },
        pruebas,
        consentimientos,
      })
    : [];

  const confirmar = async () => {
    setConfirmando(true);
    try {
      await cambiarEstadoCita(cita.id, 'confirmada');
      showToast('Cita confirmada', 'success');
      onCambio();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[agenda.confirmar]', e);
      showToast(traducirErrorAgenda(msg), 'error');
    } finally {
      setConfirmando(false);
    }
  };

  const esBloqueo = clase === 'bloqueo_tipo4';

  return (
    <article
      className="v-card"
      style={{
        padding: 14,
        borderLeft: esBloqueo ? '3px solid var(--secondary-deep)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15,
              color: 'var(--text-main)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {clienta?.nombre ?? 'Clienta'}
          </h3>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
            {cita.servicio}
          </div>
        </div>
        <Chip tone={cita.estado === 'confirmada' ? 'green' : 'ghost'} dot={cita.estado === 'confirmada'}>
          {cita.estado}
        </Chip>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
          fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-tertiary)',
        }}
      >
        <Clock size={11} />
        {fechaHoraCorta(cita.fecha)} · {duracionLabel(cita.duracionMinutos)}
        {esBloqueo && (
          <span style={{ color: 'var(--secondary-deep)', fontWeight: 700 }}>
            · BLOQUE RESERVADO
          </span>
        )}
      </div>

      {bloqueos.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bloqueos.map((b) => (
            <div
              key={b.codigo}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '9px 11px', borderRadius: 10,
                background: 'var(--treat-recon-bg)',
                border: '1px solid rgba(212, 130, 10, 0.25)',
              }}
            >
              <ShieldAlert size={13} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 11, color: 'var(--treat-recon-color)', lineHeight: 1.45 }}>
                {b.mensaje}
              </p>
            </div>
          ))}
          {clienta && (
            <a
              href={`/clientas/${clienta.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, color: 'var(--primary)',
                textDecoration: 'none',
              }}
            >
              Resolver en la ficha de {clienta.nombre} <ChevronRight size={12} />
            </a>
          )}
        </div>
      )}

      {cita.estado === 'pendiente' && (
        <div style={{ marginTop: 12 }}>
          <Btn
            variant={bloqueos.length > 0 ? 'ghost' : 'primary'}
            size="sm"
            fullWidth
            disabled={bloqueos.length > 0 || confirmando}
            onClick={confirmar}
            icon={bloqueos.length > 0 ? <Lock size={12} /> : <Check size={12} />}
          >
            {bloqueos.length > 0
              ? 'Confirmación bloqueada'
              : confirmando ? 'Confirmando…' : 'Confirmar cita'}
          </Btn>
        </div>
      )}
    </article>
  );
}

// ── Sección principal ──────────────────────────────────────────────────────

export default function CitasServicio({
  bloqueoTipo4Minutos,
}: {
  bloqueoTipo4Minutos: number;
}) {
  const [citas, setCitas] = useState<CitaServicio[]>([]);
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [creando, setCreando] = useState(false);
  const [disponible, setDisponible] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const [cs, cls] = await Promise.all([listarCitasServicio(), getAllClientas()]);
      setCitas(cs);
      setClientas(cls);
      setDisponible(true);
    } catch (e) {
      console.error('[agenda.citas]', e);
      setDisponible(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const clientasById = useMemo(
    () => new Map(clientas.map((c) => [c.id, c])),
    [clientas]
  );

  if (!disponible) return null;

  return (
    <section style={{ marginBottom: 22 }}>
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 12, marginBottom: 10,
        }}
      >
        <div>
          <div className="v-caps">Servicios agendados</div>
          <h2
            style={{
              margin: '3px 0 0', fontFamily: 'var(--font-serif)', fontSize: 18,
              letterSpacing: '-0.015em', color: 'var(--text-main)',
            }}
          >
            Citas de cabina
          </h2>
        </div>
        <Btn size="sm" icon={<CalendarPlus size={13} />} onClick={() => setCreando(true)}>
          Nueva cita
        </Btn>
      </div>

      {citas.length === 0 ? (
        <div
          className="v-card"
          style={{ padding: '20px 16px', textAlign: 'center' }}
        >
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Sin citas de servicio agendadas. Los servicios de color, decoloración
            y los bloques de tipo 4 se agendan aquí con sus controles de seguridad.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {citas.map((c) => (
            <CitaServicioCard
              key={c.id}
              cita={c}
              clienta={clientasById.get(c.clientaId)}
              onCambio={cargar}
            />
          ))}
        </div>
      )}

      {creando && (
        <ModalNuevaCita
          clientas={clientas}
          citasExistentes={citas}
          bloqueoTipo4Minutos={bloqueoTipo4Minutos}
          onClose={() => setCreando(false)}
          onCreada={cargar}
        />
      )}
    </section>
  );
}
