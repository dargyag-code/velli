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
}

export default function ConfirmacionPublicaCotizacion({
  token,
  salon,
  salonWhatsapp,
  servicio,
  precioFormateado,
  moneda,
  vigente,
}: ConfirmacionPublicaCotizacionProps) {
  const [aceptoCondiciones, setAceptoCondiciones] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const numeroSalonValido = numeroWhatsApp(salonWhatsapp);

  const handleConfirmar = async () => {
    if (!aceptoCondiciones || !vigente || enviando) return;
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

    // Fallback limpio cuando el salón aún no ha configurado su número WhatsApp en `profiles`
    await peticionAceptar;
    setConfirmado(true);
    setEnviando(false);
  };

  if (!vigente) return null;

  return (
    <div className="rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] p-4 sm:p-5 space-y-4">
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <span className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={aceptoCondiciones}
            disabled={confirmado}
            onChange={(e) => setAceptoCondiciones(e.target.checked)}
            className="peer sr-only"
          />
          <span className="w-5 h-5 rounded-md border border-[#DFC5CE] bg-white peer-checked:bg-[#3B0D1E] peer-checked:border-[#3B0D1E] transition-colors flex items-center justify-center">
            {aceptoCondiciones && <Check size={13} strokeWidth={3} className="text-[#FAF7F5]" />}
          </span>
        </span>
        <span className="text-xs sm:text-[13px] text-[#1C1518] leading-relaxed font-medium">
          Acepto las condiciones del diagnóstico y procedimiento capilar
        </span>
      </label>

      {confirmado && !numeroSalonValido ? (
        <div className="rounded-xl bg-[#EAF6F4] border border-[#0D9488]/30 p-3.5 flex items-start gap-2.5 text-xs sm:text-[13px] text-[#0D7A70] font-semibold">
          <CheckCircle2 size={17} className="text-[#0D9488] shrink-0 mt-0.5" />
          <span>¡Listo! Tu salón ya recibió tu confirmación y consentimiento digital</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={!aceptoCondiciones || enviando}
          onClick={handleConfirmar}
          className="w-full py-3.5 px-5 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:bg-[#DFC5CE]/60 disabled:text-[#96888C] text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {numeroSalonValido ? <MessageCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>
            {enviando
              ? 'Registrando confirmación…'
              : confirmado
                ? 'Consentimiento registrado · WhatsApp abierto'
                : numeroSalonValido
                  ? 'Confirmar por WhatsApp'
                  : 'Confirmar cotización y consentimiento'}
          </span>
        </button>
      )}

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#6E6266]">
        <ShieldCheck size={13} className="text-[#0D9488] shrink-0" />
        <span>
          {confirmado
            ? '¡Listo! Tu salón ya recibió tu confirmación y consentimiento digital'
            : 'Consentimiento digital directo con trazabilidad para el salón'}
        </span>
      </div>
    </div>
  );
}
