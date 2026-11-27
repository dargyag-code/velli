'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Star,
  FileText,
  Download,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { Clienta, Consulta, SatisfaccionNivel } from '@/lib/types';
import {
  formatDate,
  getTratamientoBg,
  getTratamientoTextColor,
  getTratamientoBorderColor,
  getRizoLabel,
} from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';
import { updateConsulta } from '@/lib/db';
import { enlaceWhatsApp } from '@/lib/whatsapp';
import { useFlags } from '@/lib/flags/useFlags';

interface Props {
  consultas: Consulta[];
  clienta: Clienta;
  onCotizacionCreada?: () => void;
}

function buildWhatsAppUrl(clienta: Clienta, consulta: Consulta): string {
  const { resultado } = consulta;
  const lines = [
    `🌿 *Velli — Diagnóstico Capilar*`,
    ``,
    `Hola *${clienta.nombre}*! Aquí está tu diagnóstico:`,
    ``,
    `📋 *Tipo de cabello:* ${consulta.tipoRizoPrincipal || '—'}`,
    consulta.porosidad ? `💧 *Porosidad:* ${consulta.porosidad}` : null,
    `🎯 *Tu tratamiento:* ${resultado.tratamientoPrincipal}`,
    ``,
    `📅 *Cronograma del mes:*`,
    `Sem 1: ${resultado.cronograma.semana1}`,
    `Sem 2: ${resultado.cronograma.semana2}`,
    `Sem 3: ${resultado.cronograma.semana3}`,
    `Sem 4: ${resultado.cronograma.semana4}`,
    ``,
    `✂️ *Técnica recomendada:* ${resultado.tecnicaDefinicion}`,
    ``,
    `🏠 *Para casa:*`,
    ...resultado.cuidadoCasa.diaLavado.slice(0, 2).map((t) => `• ${t}`),
    ...resultado.cuidadoCasa.nocturno.slice(0, 1).map((t) => `• ${t}`),
    ``,
    `Tu PDF completo te lo envío por aquí 📄`,
    ``,
    `_Generado con Veli_`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return enlaceWhatsApp(clienta.telefono, lines);
}

function ConsultaItem({
  consulta,
  clienta,
  index,
  cotizadorActivo,
}: {
  consulta: Consulta;
  clienta: Clienta;
  onCotizacionCreada?: () => void;
  index: number;
  cotizadorActivo?: boolean;
  onCotizar?: (consulta: Consulta) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [downloading, setDownloading] = useState(false);

  // Satisfacción 1–5, captura de un toque al cerrar la visita: si la
  // consulta aún no tiene calificación, las estrellas son tocables y
  // persisten de inmediato (optimista, con rollback si falla).
  const [sat, setSat] = useState<SatisfaccionNivel | undefined>(consulta.satisfaccion);
  const [savingSat, setSavingSat] = useState(false);

  const calificar = async (n: SatisfaccionNivel) => {
    if (sat || savingSat) return;
    setSat(n);
    setSavingSat(true);
    try {
      await updateConsulta({ ...consulta, satisfaccion: n });
    } catch (e) {
      console.error('[HistorialTimeline] satisfaccion error:', e);
      setSat(undefined);
    } finally {
      setSavingSat(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await generateConsultaPDF(clienta, consulta);
    } catch (e) {
      console.error('[HistorialTimeline] PDF error:', e);
    } finally {
      setDownloading(false);
    }
  };

  const { resultado } = consulta;
  const borderColor = getTratamientoBorderColor(resultado.tratamientoPrincipal);
  const treatBg = getTratamientoBg(resultado.tratamientoPrincipal);
  const treatColor = getTratamientoTextColor(resultado.tratamientoPrincipal);

  return (
    <div className="relative pl-8 mb-4 font-sans">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-4 w-6 h-6 rounded-full flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(59,13,30,0.18)] z-10"
        style={{ background: borderColor }}
      >
        <span className="text-white font-mono text-[10px] font-bold tabular-nums">
          {consulta.numeroConsulta}
        </span>
      </div>
      {/* Timeline line */}
      <div className="absolute left-3 top-10 bottom-0 w-px bg-[#E4E4E7]" />

      <div
        className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden "
        style={{ borderLeft: `4px solid ${borderColor}` }}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full min-h-[56px] flex items-center justify-between p-4 text-left bg-transparent border-none hover:bg-[#FAFAFA] transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Calendar size={13} className="text-[#71717A]" />
              <span className="font-sans text-sm font-bold text-[#111111] tabular-nums">
                {formatDate(consulta.fecha)}
              </span>
              {consulta.esBorrador && (
                <span className="inline-flex items-center gap-1 bg-[#FFFBEB] text-[#B45309] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#B45309]/30">
                  <FileText size={10} />
                  Borrador
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize"
                style={{ backgroundColor: treatBg, color: treatColor }}
              >
                {resultado.tratamientoPrincipal}
              </span>
              {consulta.tipoRizoPrincipal && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#F4F4F5] text-[#111111] text-[11px] font-semibold">
                  {getRizoLabel(consulta.tipoRizoPrincipal)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {consulta.proximaCita && (
              <span className="font-mono text-[10px] text-[#71717A] tabular-nums">
                Próx: {formatDate(consulta.proximaCita)}
              </span>
            )}
            {expanded ? (
              <ChevronUp size={17} className="text-[#52525B]" />
            ) : (
              <ChevronDown size={17} className="text-[#52525B]" />
            )}
          </div>
        </button>

        {/* Expanded */}
        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#E4E4E7] fade-in">
            {consulta.esBorrador && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-[#FFFBEB] rounded-xl border border-[#B45309]/30">
                <FileText size={14} className="text-[#B45309]" />
                <p className="m-0 text-xs font-semibold text-[#B45309]">
                  Diagnóstico express — detalles incompletos
                </p>
              </div>
            )}

            {/* Mediciones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {[
                { label: 'Porosidad', value: consulta.porosidad || '—' },
                { label: 'Densidad', value: consulta.densidad || '—' },
                { label: 'Grosor', value: consulta.grosor || '—' },
                { label: 'Elasticidad', value: consulta.elasticidad || '—' },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl px-3 py-2.5"
                >
                  <p className="m-0 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
                    {label}
                  </p>
                  <p className="m-0 mt-0.5 text-sm font-bold text-[#111111] capitalize">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Técnica */}
            <div className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl p-3">
              <p className="m-0 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1">
                Técnica sugerida
              </p>
              <p className="m-0 text-sm font-semibold text-[#111111]">
                {resultado.tecnicaDefinicion}
              </p>
            </div>

            {/* Problemas */}
            {consulta.problemas.length > 0 && (
              <div>
                <p className="m-0 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                  Condiciones tratadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {consulta.problemas.map((p) => (
                    <span
                      key={p}
                      className="text-[11px] font-semibold bg-[#FAFAFA] text-[#111111] px-2.5 py-0.5 rounded-full border border-[#E4E4E7]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            {consulta.notasEstilista && (
              <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl p-3">
                <p className="m-0 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1">
                  Notas de silla
                </p>
                <p className="m-0 text-xs text-[#111111] leading-relaxed">
                  {consulta.notasEstilista}
                </p>
              </div>
            )}

            {/* Satisfacción 1–5 — lectura si ya existe, captura de un toque si no */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
                {sat ? 'Satisfacción:' : '¿Cómo quedó tu clienta?'}
              </span>
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as SatisfaccionNivel[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!!sat || savingSat}
                    onClick={() => calificar(n)}
                    aria-label={`Calificar ${n} de 5`}
                    className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center bg-transparent border-none ${
                      sat ? 'cursor-default' : 'hover:bg-[#FAFAFA] active:scale-90 transition-all cursor-pointer'
                    }`}
                  >
                    <Star
                      size={16}
                      fill={sat && n <= sat ? '#B45309' : 'none'}
                      className={sat && n <= sat ? 'text-[#B45309]' : 'text-[#E4E4E7]'}
                    />
                  </button>
                ))}
              </div>
              {sat && (
                <span className="font-mono text-xs font-bold text-[#111111] tabular-nums">
                  {sat}/5
                </span>
              )}
              {!sat && <span className="text-[11px] text-[#71717A]">opcional · un toque</span>}
            </div>

            {/* Acciones */}
            <div className="flex gap-2 flex-wrap pt-1">
              {cotizadorActivo && (
                <Link
                  href={`/?clientaId=${clienta.id}`}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] text-xs font-bold text-[#111111] hover:bg-[#111111] hover:text-white no-underline active:scale-[0.98] transition-all"
                >
                  <Sparkles size={13} />
                  Cotizar en Silla
                </Link>
              )}

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-bold text-[#52525B] hover:border-[#111111] hover:text-[#111111] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download size={13} className={downloading ? 'animate-bounce' : ''} />
                {downloading ? 'Generando…' : 'Descargar PDF'}
              </button>

              {clienta.telefono && (
                <a
                  href={buildWhatsAppUrl(clienta, consulta)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#15803D]/30 bg-[#F0FDF4] text-xs font-bold text-[#15803D] hover:bg-[#15803D] hover:text-white no-underline active:scale-[0.98] transition-all"
                >
                  <MessageCircle size={13} />
                  Compartir WA
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistorialTimeline({ consultas, clienta }: Props) {
  const flags = useFlags();
  if (!consultas.length) {
    return (
      <div className="text-center py-10 font-sans">
        <div className="w-14 h-14 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl mx-auto mb-3 flex items-center justify-center">
          <Calendar size={24} className="text-[#111111]" />
        </div>
        <p className="m-0 font-sans text-sm font-bold text-[#111111]">
          Sin consultas registradas
        </p>
        <p className="m-0 text-xs text-[#71717A] mt-1">
          Las fichas técnicas previas aparecerán en esta línea de tiempo.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {[...consultas].reverse().map((c, i) => (
        <ConsultaItem
          key={c.id}
          consulta={c}
          clienta={clienta}
          index={i}
          cotizadorActivo={flags.cotizador}
        />
      ))}
    </div>
  );
}
