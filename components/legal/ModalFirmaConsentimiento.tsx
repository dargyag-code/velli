'use client';
// Modal de firma digital de consentimientos por clienta (validación Keila
// 6.P3): muestra el documento completo (placeholder hasta el texto definitivo
// de Keila), exige el nombre completo tecleado + checkbox, y registra la
// firma con timestamp y versión en consentimientos_clienta.
// Se usa desde la ficha de la clienta y desde el gate de cámara del wizard.

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Btn } from '@/components/v2';
import { showToast } from '@/lib/toast';
import { CONSENTIMIENTO_VERSIONES, TipoConsentimiento } from '@/lib/legal';
import { firmarConsentimiento } from '@/lib/consentimientos';
import {
  ContenidoConsentimientoQuimico,
  ContenidoConsentimientoImagenes,
} from '@/components/legal/ConsentimientoContenido';

export const TITULOS_CONSENTIMIENTO: Record<TipoConsentimiento, string> = {
  consentimiento_quimico: 'Servicios químicos',
  consentimiento_imagenes: 'Imágenes y datos de salud',
};

export default function ModalFirmaConsentimiento({
  tipo, clientaId, clientaNombre, onClose, onFirmado,
}: {
  tipo: TipoConsentimiento;
  clientaId: string;
  clientaNombre: string;
  onClose: () => void;
  onFirmado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const firmar = async () => {
    if (nombre.trim().length < 5 || !acepta) return;
    setGuardando(true);
    try {
      await firmarConsentimiento({ clientaId, tipo, nombreFirmante: nombre });
      showToast('Consentimiento firmado', 'success');
      onFirmado();
      onClose();
    } catch (e) {
      console.error('[consentimientos.firmar]', e);
      showToast('No se pudo registrar la firma. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Consentimiento · ${TITULOS_CONSENTIMIENTO[tipo]}`} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: '#FFF6E0',
            border: '2px dashed #B47900',
            fontSize: 11.5,
            color: '#7A5200',
            lineHeight: 1.45,
          }}
        >
          <strong>⚠️ Documento provisional (placeholder).</strong> El texto
          definitivo lo entrega la asesora legal. Versión:{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>
            {CONSENTIMIENTO_VERSIONES[tipo]}
          </code>
        </div>

        <div
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            border: '1px solid var(--border-soft)',
            borderRadius: 12,
          }}
        >
          <div style={{ padding: 10 }}>
            {tipo === 'consentimiento_quimico'
              ? <ContenidoConsentimientoQuimico />
              : <ContenidoConsentimientoImagenes />}
          </div>
        </div>

        <Input
          label="Nombre completo de la clienta (firma digital) *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={clientaNombre}
        />

        <label
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            fontSize: 12.5, color: 'var(--text-main)', lineHeight: 1.45,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--primary)' }}
          />
          <span>
            La clienta declara que leyó y acepta este documento (versión{' '}
            {CONSENTIMIENTO_VERSIONES[tipo]}). La firma queda registrada con
            fecha y hora en su historial.
          </span>
        </label>

        <Btn
          variant="primary"
          size="lg"
          fullWidth
          disabled={nombre.trim().length < 5 || !acepta || guardando}
          onClick={firmar}
          icon={guardando ? undefined : <Check size={15} />}
        >
          {guardando ? 'Registrando…' : 'Registrar firma'}
        </Btn>
      </div>
    </Modal>
  );
}
