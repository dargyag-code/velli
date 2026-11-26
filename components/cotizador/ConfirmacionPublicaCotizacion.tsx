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
      const mensaje = `Hola ${salon}, acepto las condiciones del diagnóstico y procedimiento capilar y confirmo mi cotización de *${servicio}* por *${precioFormateado} ${moneda}*.`;
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
    <div className="bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#3B0D1E] shrink-0" />
        <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
          Consentimiento Químico Informado
        </span>
      </div>

      {/* Casilla táctil amplia */}
      <label
        className={`min-h-[48px] p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-colors ${
          aceptoCondiciones
            ? 'bg-white border-[#3B0D1E]'
            : 'bg-white/75 border-[#EFE8E4] hover:border-[#E8CFC8]'
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
          <span className="w-6 h-6 rounded-lg border border-[#E8CFC8] bg-white peer-checked:bg-[#3B0D1E] peer-checked:border-[#3B0D1E] transition-colors flex items-center justify-center">
            {aceptoCondiciones && <Check size={14} strokeWidth={3} className="text-[#FAF7F5]" />}
          </span>
        </span>
        <span className="font-sans text-xs sm:text-[13px] text-[#3B0D1E] leading-relaxed font-medium">
          He leído el alcance del servicio y acepto las condiciones del diagnóstico presencial y procedimiento químico capilar en {salon}.
        </span>
      </label>

      {confirmado ? (
        <div className="space-y-2.5">
          <div className="w-full py-3.5 px-4 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0D9488] font-sans font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 text-center">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>Cotización y Consentimiento Digital Confirmados ✓</span>
          </div>
          <p className="font-sans text-xs text-center text-[#0D9488] font-semibold">
            {numeroSalonValido
              ? 'Consentimiento registrado · WhatsApp abierto con tu salón'
              : '¡Listo! Tu salón ya recibió tu confirmación y consentimiento digital'}
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={!aceptoCondiciones || enviando}
          onClick={handleConfirmar}
          className="bg-[#3B0D1E] hover:bg-[#52142B] disabled:bg-[#F5EBE8] disabled:text-[#947C85] text-[#FAF7F5] font-sans font-bold text-sm py-3.5 px-5 rounded-xl w-full shadow-[0_10px_24px_-6px_rgba(59,13,30,0.25)] disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {numeroSalonValido ? <MessageCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>
            {enviando
              ? 'Registrando confirmación…'
              : numeroSalonValido
                ? 'Confirmar Cotización por WhatsApp'
                : 'Confirmar Cotización y Consentimiento'}
          </span>
        </button>
      )}

      {!confirmado && (
        <div className="flex items-center justify-center gap-1.5 font-sans text-[11px] text-[#6B535C]">
          <ShieldCheck size={13} className="text-[#0D9488] shrink-0" />
          <span>Trazabilidad digital instantánea para tu salón</span>
        </div>
      )}
    </div>
  );
}
