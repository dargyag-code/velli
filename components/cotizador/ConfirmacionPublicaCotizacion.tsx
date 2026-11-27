'use client';

import React, { useState } from 'react';
import { Check, CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import { enlaceWhatsApp, numeroWhatsApp } from '@/lib/whatsapp';

interface ConfirmacionPublicaCotizacionProps {
  token: string;
  salon: string;
  salonWhatsapp?: string | null;
  servicio: string;
  precioFormateado: string;
  moneda: string;
  vigente: boolean;
  confirmadoInicial?: boolean;
  primaryColor?: string;
}

export default function ConfirmacionPublicaCotizacion({
  token,
  salon,
  salonWhatsapp,
  servicio,
  precioFormateado,
  moneda,
  vigente,
  confirmadoInicial = false,
  primaryColor = '#111111',
}: ConfirmacionPublicaCotizacionProps) {
  const [aceptoCondiciones, setAceptoCondiciones] = useState(confirmadoInicial);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(confirmadoInicial);

  const numeroSalonValido = numeroWhatsApp(salonWhatsapp);

  const handleConfirmar = async () => {
    if (!aceptoCondiciones || !vigente || enviando || confirmado) return;
    setEnviando(true);

    const peticionAceptar = fetch(`/api/cotizaciones/${encodeURIComponent(token)}/aceptar`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => null);

    if (numeroSalonValido) {
      const mensaje = `Hola ${salon}, acepto las condiciones del diagnóstico y procedimiento y confirmo mi cotización de *${servicio}* por *${precioFormateado} ${moneda}*.`;
      const url = enlaceWhatsApp(numeroSalonValido, mensaje);
      setConfirmado(true);
      setEnviando(false);
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    await peticionAceptar;
    setConfirmado(true);
    setEnviando(false);
  };

  if (!vigente && !confirmado) return null;

  return (
    <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#111111] shrink-0" />
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-[#52525B]">
          Consentimiento Informado
        </span>
      </div>

      <label
        className={`min-h-[48px] p-3.5 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-colors ${
          aceptoCondiciones
            ? 'bg-white border-[#111111]'
            : 'bg-white border-[#E4E4E7] hover:border-[#71717A]'
        }`}
      >
        <span className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={aceptoCondiciones}
            disabled={confirmado}
            onChange={(e) => setAceptoCondiciones(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className="w-5 h-5 rounded-md border flex items-center justify-center transition-colors"
            style={
              aceptoCondiciones
                ? { backgroundColor: primaryColor, borderColor: primaryColor }
                : { backgroundColor: '#FFFFFF', borderColor: '#D4D4D8' }
            }
          >
            {aceptoCondiciones && <Check size={13} strokeWidth={3} className="text-white" />}
          </span>
        </span>
        <span className="font-sans text-xs sm:text-[13px] text-[#111111] leading-relaxed font-medium">
          He leído el alcance del servicio y acepto las condiciones del diagnóstico presencial y procedimiento en {salon}.
        </span>
      </label>

      {confirmado ? (
        <div className="space-y-2">
          <div className="w-full py-3 px-4 rounded-lg bg-[#F0FDF4] border border-[#15803D]/30 text-[#15803D] font-sans font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 text-center">
            <CheckCircle2 size={17} className="shrink-0" />
            <span>Cotización y consentimiento confirmados</span>
          </div>
          <p className="font-sans text-xs text-center text-[#15803D] font-medium">
            {numeroSalonValido
              ? 'Consentimiento registrado · WhatsApp abierto con el estudio'
              : 'El estudio ya recibió tu confirmación digital'}
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={!aceptoCondiciones || enviando}
          onClick={handleConfirmar}
          style={
            aceptoCondiciones && !enviando
              ? { backgroundColor: primaryColor, color: '#FFFFFF' }
              : undefined
          }
          className="disabled:bg-[#F4F4F5] disabled:text-[#71717A] text-white font-sans font-semibold text-sm py-3 px-5 rounded-lg w-full transition-opacity hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-0"
        >
          {numeroSalonValido ? <MessageCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>
            {enviando
              ? 'Registrando confirmación…'
              : numeroSalonValido
                ? 'Confirmar cotización por WhatsApp'
                : 'Confirmar cotización y consentimiento'}
          </span>
        </button>
      )}

      {!confirmado && (
        <div className="flex items-center justify-center gap-1.5 font-sans text-[11px] text-[#71717A]">
          <ShieldCheck size={13} className="text-[#15803D] shrink-0" />
          <span>Trazabilidad digital instantánea para el estudio</span>
        </div>
      )}
    </div>
  );
}
