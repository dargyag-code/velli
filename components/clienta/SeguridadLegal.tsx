'use client';
// ══════════════════════════════════════════════════════════════════════════
// Ficha de la clienta · capa legal y de seguridad química (validación Keila).
//
// 1) Consentimientos digitales versionados (6.P3): firma = nombre completo
//    tecleado + checkbox + timestamp + versión. Sin consentimiento_imagenes
//    vigente la cámara queda bloqueada en el módulo de alopecia y en el
//    registro fotográfico de servicios químicos; sin consentimiento_quimico
//    vigente no se confirman decoloraciones.
// 2) Seguridad química (6.P7): banderas "nueva en color" / "cambio de marca
//    química" + registro del parche de prueba de sensibilidad (fecha/hora y
//    resultado). Con bandera activa y sin parche negativo dentro de la
//    ventana de 48 h, la confirmación del servicio de color se bloquea
//    (UI + trigger citas_guard_legal en la DB).
// ══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, ShieldAlert, FlaskConical, ExternalLink, Plus,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Btn, Chip } from '@/components/v2';
import { Clienta } from '@/lib/types';
import { updateClienta } from '@/lib/db';
import { showToast } from '@/lib/toast';
import { TipoConsentimiento } from '@/lib/legal';
import {
  ConsentimientoClienta,
  listarConsentimientos,
  tieneConsentimientoVigente,
} from '@/lib/consentimientos';
import {
  listarPruebasSensibilidad,
  registrarPruebaSensibilidad,
} from '@/lib/agenda/citas';
import {
  PruebaSensibilidad,
  PARCHE_MIN_HORAS,
  PARCHE_VALIDEZ_DIAS,
} from '@/lib/agenda/reglas';
import ModalFirmaConsentimiento, {
  TITULOS_CONSENTIMIENTO,
} from '@/components/legal/ModalFirmaConsentimiento';

const DOCS: Record<TipoConsentimiento, { titulo: string; href: string }> = {
  consentimiento_quimico: {
    titulo: TITULOS_CONSENTIMIENTO.consentimiento_quimico,
    href: '/legal/consentimiento-quimico',
  },
  consentimiento_imagenes: {
    titulo: TITULOS_CONSENTIMIENTO.consentimiento_imagenes,
    href: '/legal/consentimiento-imagenes',
  },
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Modal de parche ────────────────────────────────────────────────────────

function ModalParche({
  clienta, onClose, onRegistrado,
}: {
  clienta: Clienta;
  onClose: () => void;
  onRegistrado: () => void;
}) {
  const ahora = new Date();
  const [fecha, setFecha] = useState(ahora.toISOString().slice(0, 10));
  const [hora, setHora] = useState(ahora.toTimeString().slice(0, 5));
  const [resultado, setResultado] = useState<'negativo' | 'positivo' | ''>('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const registrar = async () => {
    if (!fecha || !hora || !resultado) return;
    setGuardando(true);
    try {
      const aplicadoAt = new Date(`${fecha}T${hora}`);
      await registrarPruebaSensibilidad({
        clientaId: clienta.id,
        aplicadoAt,
        resultado,
        notas: notas.trim() || undefined,
      });
      showToast('Prueba de sensibilidad registrada', 'success');
      onRegistrado();
      onClose();
    } catch (e) {
      console.error('[pruebas.registrar]', e);
      showToast('No se pudo registrar la prueba. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Registrar prueba de sensibilidad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Parche cutáneo en la nuca baja. El servicio de color solo se puede
          confirmar con un resultado <strong>sin reacción</strong> aplicado al
          menos {PARCHE_MIN_HORAS} horas antes de la cita (validez{' '}
          {PARCHE_VALIDEZ_DIAS} días).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input
            label="Fecha de aplicación *"
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
        <div>
          <p className="v-caps" style={{ marginBottom: 8 }}>Resultado de la lectura</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { v: 'negativo' as const, label: 'Sin reacción (negativo)' },
              { v: 'positivo' as const, label: 'Con reacción (positivo)' },
            ]).map(({ v, label }) => {
              const on = resultado === v;
              const esAlerta = v === 'positivo';
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setResultado(v)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    background: on
                      ? esAlerta ? '#FCEEEE' : 'var(--primary-pale)'
                      : 'var(--bg-card)',
                    color: on
                      ? esAlerta ? '#7A1F1F' : 'var(--primary)'
                      : 'var(--text-secondary)',
                    border: `1px solid ${
                      on
                        ? esAlerta ? 'rgba(178,58,58,0.35)' : 'rgba(45, 90, 39, 0.3)'
                        : 'var(--border-soft)'
                    }`,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {resultado === 'positivo' && (
          <p
            style={{
              margin: 0, padding: '10px 12px', borderRadius: 12,
              background: '#FCEEEE', border: '1px solid rgba(178,58,58,0.18)',
              fontSize: 11.5, color: '#7A1F1F', lineHeight: 1.45,
            }}
          >
            Con reacción positiva el servicio químico queda suspendido: deriva
            a la clienta y no apliques el producto.
          </p>
        )}
        <Input
          label="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Opcional — producto probado, zona, observaciones…"
        />
        <Btn
          variant="primary"
          size="lg"
          fullWidth
          disabled={!fecha || !hora || !resultado || guardando}
          onClick={registrar}
        >
          {guardando ? 'Guardando…' : 'Registrar parche'}
        </Btn>
      </div>
    </Modal>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function SeguridadLegal({
  clienta,
  onClientaChange,
}: {
  clienta: Clienta;
  onClientaChange: (c: Clienta) => void;
}) {
  const [consentimientos, setConsentimientos] = useState<ConsentimientoClienta[]>([]);
  const [pruebas, setPruebas] = useState<PruebaSensibilidad[]>([]);
  const [firmando, setFirmando] = useState<TipoConsentimiento | null>(null);
  const [registrandoParche, setRegistrandoParche] = useState(false);
  const [guardandoFlag, setGuardandoFlag] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [cs, ps] = await Promise.all([
        listarConsentimientos(clienta.id),
        listarPruebasSensibilidad(clienta.id),
      ]);
      setConsentimientos(cs);
      setPruebas(ps);
    } catch (e) {
      console.error('[seguridadLegal.cargar]', e);
    }
  }, [clienta.id]);

  useEffect(() => { recargar(); }, [recargar]);

  const toggleFlag = async (campo: 'nuevaEnColor' | 'cambioMarcaQuimica') => {
    setGuardandoFlag(campo);
    try {
      const updated: Clienta = { ...clienta, [campo]: !clienta[campo] };
      await updateClienta(updated);
      onClientaChange(updated);
    } catch (e) {
      console.error('[seguridadLegal.flag]', e);
      showToast('No se pudo guardar el cambio', 'error');
    } finally {
      setGuardandoFlag(null);
    }
  };

  const marcada = !!clienta.nuevaEnColor || !!clienta.cambioMarcaQuimica;

  return (
    <>
      {/* ── Consentimientos ─────────────────────────────────────────────── */}
      <article className="v-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
          <div className="v-caps">Consentimientos digitales</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(Object.keys(DOCS) as TipoConsentimiento[]).map((tipo) => {
            const vigente = tieneConsentimientoVigente(consentimientos, tipo);
            const ultima = consentimientos.find((c) => c.tipo === tipo);
            return (
              <div
                key={tipo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>
                    {DOCS[tipo].titulo}
                    <Link
                      href={DOCS[tipo].href}
                      aria-label={`Ver documento: ${DOCS[tipo].titulo}`}
                      style={{ marginLeft: 6, color: 'var(--text-tertiary)', verticalAlign: 'middle' }}
                    >
                      <ExternalLink size={11} style={{ display: 'inline' }} />
                    </Link>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {vigente && ultima
                      ? `Firmado por ${ultima.nombreFirmante} · ${fechaCorta(ultima.firmadoAt)} · v. ${ultima.versionAceptada}`
                      : ultima
                        ? `Firma de versión anterior (${ultima.versionAceptada}) — se requiere re-firma`
                        : 'Sin firma registrada'}
                  </div>
                </div>
                {vigente ? (
                  <Chip tone="green" dot>Vigente</Chip>
                ) : (
                  <Btn variant="soft" size="sm" onClick={() => setFirmando(tipo)}>
                    Firmar
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
          Sin el consentimiento de imágenes vigente, la cámara queda bloqueada
          en el módulo de alopecia y en las fotos de servicios químicos. La
          decoloración no se confirma sin el consentimiento químico.
        </p>
      </article>

      {/* ── Seguridad química ───────────────────────────────────────────── */}
      <article className="v-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <FlaskConical size={14} style={{ color: 'var(--secondary-deep)' }} />
          <div className="v-caps">Seguridad química</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            { campo: 'nuevaEnColor' as const, label: 'Nueva en color', sub: 'Primer servicio de color en el salón' },
            { campo: 'cambioMarcaQuimica' as const, label: 'Cambio de marca química', sub: 'Se cambió la marca del producto químico' },
          ]).map(({ campo, label, sub }) => {
            const on = !!clienta[campo];
            return (
              <button
                key={campo}
                type="button"
                onClick={() => toggleFlag(campo)}
                disabled={guardandoFlag === campo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, textAlign: 'left',
                  background: on ? 'var(--secondary-pale)' : 'var(--bg-card)',
                  border: `1px solid ${on ? 'rgba(138, 90, 46, 0.3)' : 'var(--border-soft)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? 'var(--secondary-deep)' : 'var(--text-main)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</div>
                </div>
                <span
                  aria-hidden
                  style={{
                    width: 34, height: 20, borderRadius: 999, position: 'relative',
                    background: on ? 'var(--secondary-deep)' : 'var(--border)',
                    transition: 'background 0.15s ease', flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', top: 2, left: on ? 16 : 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {marcada && (
          <div
            style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              margin: '10px 0 0', padding: '10px 12px', borderRadius: 12,
              background: 'var(--treat-recon-bg)',
              border: '1px solid rgba(212, 130, 10, 0.25)',
            }}
          >
            <ShieldAlert size={14} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11, color: 'var(--treat-recon-color)', lineHeight: 1.45 }}>
              Los servicios de color de esta clienta requieren una prueba de
              sensibilidad negativa aplicada al menos {PARCHE_MIN_HORAS} h antes
              de la cita. La agenda bloquea la confirmación sin ese registro.
            </p>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="v-caps">Pruebas de sensibilidad</span>
            <Btn
              variant="soft"
              size="sm"
              icon={<Plus size={12} />}
              onClick={() => setRegistrandoParche(true)}
            >
              Registrar parche
            </Btn>
          </div>
          {pruebas.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              Sin pruebas registradas.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pruebas.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 11.5, color: 'var(--text-main)',
                  }}
                >
                  <Chip tone={p.resultado === 'negativo' ? 'green' : 'gold'}>
                    {p.resultado === 'negativo' ? 'Sin reacción' : 'Con reacción'}
                  </Chip>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                    {fechaHora(p.aplicadoAt)}
                  </span>
                  {p.notas && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      · {p.notas}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      {firmando && (
        <ModalFirmaConsentimiento
          tipo={firmando}
          clientaId={clienta.id}
          clientaNombre={clienta.nombre}
          onClose={() => setFirmando(null)}
          onFirmado={recargar}
        />
      )}
      {registrandoParche && (
        <ModalParche
          clienta={clienta}
          onClose={() => setRegistrandoParche(false)}
          onRegistrado={recargar}
        />
      )}
    </>
  );
}
