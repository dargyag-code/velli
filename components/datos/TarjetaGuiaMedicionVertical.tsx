'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Ruler, X } from 'lucide-react';
import type { VerticalSalon } from '@/lib/flags/verticales';
import {
  GUIA_MEDICION_POR_VERTICAL,
  LEMA_CULTURA_DATOS_VELI,
} from '@/lib/datos/culturaDatos';

interface TarjetaGuiaMedicionVerticalProps {
  vertical: VerticalSalon;
}

export default function TarjetaGuiaMedicionVertical({
  vertical,
}: TarjetaGuiaMedicionVerticalProps) {
  const [descartada, setDescartada] = useState(false);
  const [expandida, setExpandida] = useState(false);

  if (descartada) return null;

  const guia = GUIA_MEDICION_POR_VERTICAL[vertical] ?? GUIA_MEDICION_POR_VERTICAL.hair_studio;

  return (
    <section className="bg-white rounded-xl border border-[#E4E4E7] p-4 sm:p-5 text-[#111111]">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          className="flex items-start gap-3 text-left flex-1 cursor-pointer"
        >
          <span className="w-9 h-9 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center shrink-0 mt-0.5">
            <Ruler size={16} className="text-[#111111]" />
          </span>
          <div className="space-y-0.5">
            <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
              Pequeñas mediciones, mejores decisiones · {guia.nombreVertical}
            </span>
            <p className="m-0 text-xs sm:text-sm font-bold text-[#111111]">
              {guia.titulo}
            </p>
            <p className="m-0 text-xs text-[#52525B]">{LEMA_CULTURA_DATOS_VELI}</p>
          </div>
          <span className="text-[#52525B] mt-1 shrink-0">
            {expandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDescartada(true)}
          aria-label="Ocultar guía de medición"
          className="p-1.5 rounded-lg text-[#71717A] hover:text-[#111111] hover:bg-[#F4F4F5] cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {expandida && (
        <div className="mt-4 pt-3.5 border-t border-[#E4E4E7] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <strong className="text-[#111111] block">Qué vale la pena medir a tu ritmo:</strong>
            <ul className="m-0 pl-4 space-y-1 text-[#52525B]">
              {guia.queMedir.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="m-0 text-[#52525B]">
              <strong className="text-[#111111]">Herramientas accesibles (no obligatorias):</strong>{' '}
              {guia.herramientasSimples.join(' · ')}. Veli no requiere hardware Bluetooth propietario.
            </p>
            <p className="m-0 text-[#52525B]">
              <strong className="text-[#111111]">Qué gana tu estudio:</strong> {guia.beneficioNegocio}
            </p>
            <p className="m-0 text-[11px] text-[#71717A] bg-[#FAFAFA] p-2.5 rounded-lg border border-[#E4E4E7]">
              {guia.notaTecnicaRigor}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
