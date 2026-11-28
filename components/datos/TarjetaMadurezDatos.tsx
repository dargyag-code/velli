'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, ChevronUp, Ruler } from 'lucide-react';
import type { VerticalSalon } from '@/lib/flags/verticales';
import {
  GUIA_MEDICION_POR_VERTICAL,
  LEMA_CULTURA_DATOS_VELI,
} from '@/lib/datos/culturaDatos';
import type { ResultadoMadurezDatosNegocio } from '@/lib/datos/madurezDatos';

interface TarjetaMadurezDatosProps {
  resultado: ResultadoMadurezDatosNegocio;
  vertical: VerticalSalon;
}

export default function TarjetaMadurezDatos({
  resultado,
  vertical,
}: TarjetaMadurezDatosProps) {
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const guia = GUIA_MEDICION_POR_VERTICAL[vertical] ?? GUIA_MEDICION_POR_VERTICAL.hair_studio;

  const badgeClass =
    resultado.nivel === 'avanzado' || resultado.nivel === 'calibrado'
      ? 'bg-[#F0FDF4] border border-[#15803D]/30 text-[#15803D]'
      : 'bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111]';

  return (
    <section
      aria-label="Madurez de Datos de tu Negocio"
      className="bg-white rounded-xl border border-[#E4E4E7] p-6 space-y-5 text-[#111111]"
    >
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E4E4E7]">
        <div className="space-y-1">
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
            Precisión Operativa · Solo Administración
          </span>
          <h2 className="font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
            Madurez de Datos de tu Negocio
          </h2>
          <p className="font-sans text-xs text-[#52525B]">{LEMA_CULTURA_DATOS_VELI}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${badgeClass}`}>
            {resultado.etiquetaNivel}
          </span>
          <div className="px-3 py-1.5 rounded-lg bg-[#111111] text-white font-mono text-sm font-bold tabular-nums">
            {resultado.puntajeGlobal}%
          </div>
        </div>
      </div>

      {/* 5 Dimensiones en barras horizontales sobrias Base Neutra Veli */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resultado.dimensiones.map((dim) => (
          <div
            key={dim.clave}
            className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-xs font-bold text-[#111111]">
                {dim.etiqueta}
              </span>
              <span className="font-mono text-xs font-semibold text-[#111111] tabular-nums">
                {dim.puntaje}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#E4E4E7] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#111111] transition-all"
                style={{ width: `${Math.max(4, dim.puntaje)}%` }}
              />
            </div>
            <p className="m-0 font-sans text-[11px] text-[#71717A]">{dim.resumenEstado}</p>
          </div>
        ))}
      </div>

      {/* Única recomendación prioritaria de mayor impacto */}
      <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
            Siguiente paso de mayor impacto
          </span>
          <p className="m-0 font-sans text-sm font-bold text-[#111111]">
            {resultado.recomendacionPrioritaria.titulo}
          </p>
          <p className="m-0 font-sans text-xs text-[#52525B] leading-relaxed">
            {resultado.recomendacionPrioritaria.descripcion}
          </p>
        </div>

        <Link
          href={resultado.recomendacionPrioritaria.accionHref}
          className="min-h-[42px] px-4 py-2 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white font-sans text-xs font-bold inline-flex items-center justify-center gap-1.5 no-underline shrink-0 transition-colors"
        >
          <span>{resultado.recomendacionPrioritaria.accionLabel}</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Enlace desplegable a la guía práctica de medición de su vertical */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setMostrarGuia((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52525B] hover:text-[#111111] cursor-pointer"
        >
          <Ruler size={14} />
          <span>Guía práctica de medición · {guia.nombreVertical}</span>
          {mostrarGuia ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {mostrarGuia && (
          <div className="mt-3 p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2.5 text-xs">
            <p className="m-0 font-bold text-[#111111]">{guia.titulo}</p>
            <ul className="m-0 pl-4 space-y-1 text-[#52525B]">
              {guia.queMedir.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="m-0 text-[#52525B]">
              <strong className="text-[#111111]">Herramientas sencillas (opcionales):</strong>{' '}
              {guia.herramientasSimples.join(' · ')}.
            </p>
            <p className="m-0 text-[11px] text-[#71717A] border-t border-[#E4E4E7] pt-2">
              {guia.notaTecnicaRigor}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
