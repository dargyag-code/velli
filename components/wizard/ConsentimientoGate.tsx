'use client';
// ══════════════════════════════════════════════════════════════════════════
// GATING DURO de cámara (validación técnica 6.P3): pantalla de bloqueo que se
// muestra EN LUGAR de CameraCapture cuando la clienta no tiene el
// consentimiento de imágenes vigente. Las fotos del wizard incluyen cuero
// cabelludo (módulo transversal de alopecia) → datos sensibles de salud.
//
// Dos estados:
// - 'falta_consentimiento': clienta registrada sin firma vigente → se puede
//   firmar aquí mismo (nombre completo + checkbox) y la cámara se libera.
// - 'sin_clienta': la clienta aún no existe en el sistema → no hay a quién
//   atribuir la firma. Si el wizard ya tiene su nombre, se ofrece registrarla
//   en el acto y firmar seguido (la firma sigue precediendo a la cámara);
//   si no, se guía a crearla. La selección manual (sin fotos) siempre queda
//   disponible como salida.
// ══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { ShieldAlert, Pencil, ArrowLeft, FileSignature, UserPlus } from 'lucide-react';
import { Btn } from '@/components/v2';
import ModalFirmaConsentimiento from '@/components/legal/ModalFirmaConsentimiento';
import { showToast } from '@/lib/toast';

export default function ConsentimientoGate({
  motivo,
  clienta,
  puedeRegistrar,
  onRegistrarClienta,
  onFirmado,
  onManual,
  onCancel,
}: {
  motivo: 'sin_clienta' | 'falta_consentimiento';
  clienta: { id: string; nombre: string } | null;
  // Nombre tecleado en el paso 1 del wizard, si la clienta aún no existe.
  puedeRegistrar?: string;
  // Crea la clienta con los datos del wizard y devuelve su id.
  onRegistrarClienta?: () => Promise<{ id: string; nombre: string } | null>;
  onFirmado: () => void;
  onManual: () => void;
  onCancel: () => void;
}) {
  const [firmando, setFirmando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  // Clienta recién creada desde este gate (para firmar sin salir del wizard).
  const [creada, setCreada] = useState<{ id: string; nombre: string } | null>(null);

  const registrarYFirmar = async () => {
    if (!onRegistrarClienta) return;
    setRegistrando(true);
    try {
      const nueva = await onRegistrarClienta();
      if (!nueva) return;
      setCreada(nueva);
      setFirmando(true);
    } catch (e) {
      console.error('[gate.registrarClienta]', e);
      showToast('No se pudo registrar a la clienta. Intenta de nuevo.', 'error');
    } finally {
      setRegistrando(false);
    }
  };

  const clientaFirma = creada ?? clienta;

  return (
    <div
      className="step-enter"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}
    >
      <button
        type="button"
        onClick={onCancel}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={13} /> Volver
      </button>

      <section
        className="v-card"
        style={{ padding: 20, textAlign: 'center' }}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'var(--treat-recon-bg)',
            margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ShieldAlert size={26} style={{ color: 'var(--treat-recon-color)' }} />
        </div>

        <h2
          style={{
            margin: 0, fontFamily: 'var(--font-serif)', fontSize: 20,
            letterSpacing: '-0.015em', color: 'var(--text-main)',
          }}
        >
          Cámara bloqueada
        </h2>

        <p
          style={{
            margin: '8px auto 0', maxWidth: 400, fontSize: 12.5,
            color: 'var(--text-secondary)', lineHeight: 1.55,
          }}
        >
          Las fotos del diagnóstico incluyen el cuero cabelludo (módulo de
          alopecia) y son <strong>datos sensibles de salud</strong>. La cámara
          solo se activa con el consentimiento de imágenes{' '}
          <strong>firmado y vigente</strong> de la clienta.
        </p>

        {motivo === 'falta_consentimiento' ? (
          <div style={{ marginTop: 16 }}>
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              icon={<FileSignature size={15} />}
              onClick={() => setFirmando(true)}
            >
              Firmar consentimiento ahora
            </Btn>
          </div>
        ) : puedeRegistrar && onRegistrarClienta ? (
          <>
            <p
              style={{
                margin: '10px auto 0', maxWidth: 400, fontSize: 12,
                color: 'var(--text-tertiary)', lineHeight: 1.5,
              }}
            >
              La firma se guarda en el historial de la clienta, así que primero
              hay que registrarla.
            </p>
            <div style={{ marginTop: 14 }}>
              <Btn
                variant="primary"
                size="lg"
                fullWidth
                icon={<UserPlus size={15} />}
                disabled={registrando}
                onClick={registrarYFirmar}
              >
                {registrando
                  ? 'Registrando…'
                  : `Registrar a ${puedeRegistrar} y firmar`}
              </Btn>
            </div>
          </>
        ) : (
          <p
            style={{
              margin: '10px auto 0', maxWidth: 400, fontSize: 12,
              color: 'var(--text-tertiary)', lineHeight: 1.5,
            }}
          >
            Vuelve al primer paso y escribe el nombre de la clienta, o créala
            en Clientas → Nueva y firma su consentimiento desde la ficha.
          </p>
        )}

        <div style={{ marginTop: 10 }}>
          <Btn
            variant="soft"
            size="md"
            fullWidth
            icon={<Pencil size={13} />}
            onClick={onManual}
          >
            Continuar con selección manual (sin fotos)
          </Btn>
        </div>
      </section>

      {firmando && clientaFirma && (
        <ModalFirmaConsentimiento
          tipo="consentimiento_imagenes"
          clientaId={clientaFirma.id}
          clientaNombre={clientaFirma.nombre}
          onClose={() => setFirmando(false)}
          onFirmado={onFirmado}
        />
      )}
    </div>
  );
}
