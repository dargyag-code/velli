'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Star, FileText, Download } from 'lucide-react';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getTratamientoBg, getTratamientoTextColor, getTratamientoBorderColor, getRizoLabel } from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';

interface Props {
  consultas: Consulta[];
  clienta: Clienta;
}

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

function ConsultaItem({ consulta, clienta, index }: { consulta: Consulta; clienta: Clienta; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try { await generateConsultaPDF(clienta, consulta); }
    catch (e) { console.error('[HistorialTimeline] PDF error:', e); }
    finally { setDownloading(false); }
  };

  const { resultado } = consulta;
  const borderColor = getTratamientoBorderColor(resultado.tratamientoPrincipal);
  const treatBg = getTratamientoBg(resultado.tratamientoPrincipal);
  const treatColor = getTratamientoTextColor(resultado.tratamientoPrincipal);

  const satLabels: Record<string, { label: string; color: string }> = {
    muy_satisfecha:    { label: '😍 Muy satisfecha', color: 'text-green-600' },
    satisfecha:        { label: '😊 Satisfecha',     color: 'text-blue-600' },
    parcial:           { label: '🤔 Parcialmente',   color: 'text-amber-600' },
    necesita_ajustes:  { label: '⚠️ Necesita ajustes', color: 'text-red-600' },
  };

  return (
    <div className="relative pl-7 mb-4">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-4 w-5 h-5 rounded-full flex items-center justify-center shadow-sm z-10"
        style={{ background: borderColor }}
      >
        <span className="text-white text-[10px] font-bold" style={serif}>
          {consulta.numeroConsulta}
        </span>
      </div>
      {/* Timeline line */}
      <div className="absolute left-2.5 top-9 bottom-0 w-px bg-[#E5E5E5]" />

      <div
        className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-sm"
        style={{ borderLeft: `4px solid ${borderColor}` }}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F5F0E8] transition-colors"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar size={12} className="text-[#999999]" />
              <span className="text-sm font-bold text-[#2D2D2D]" style={serif}>
                {formatDate(consulta.fecha)}
              </span>
              {consulta.esBorrador && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-300">
                  <FileText size={8} />
                  Borrador
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: treatBg, color: treatColor }}
              >
                {resultado.tratamientoPrincipal}
              </span>
              <span className="text-[10px] text-[#999999]">
                {getRizoLabel(consulta.tipoRizoPrincipal)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {consulta.proximaCita && (
              <span className="text-[9px] text-[#AAAAAA]">
                Próx: {formatDate(consulta.proximaCita)}
              </span>
            )}
            {expanded
              ? <ChevronUp size={16} className="text-[#AAAAAA]" />
              : <ChevronDown size={16} className="text-[#AAAAAA]" />
            }
          </div>
        </button>

        {/* Expanded */}
        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#F0F0F0] fade-in">
            {consulta.esBorrador && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <FileText size={13} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-700">Diagnóstico express — detalles incompletos</p>
              </div>
            )}

            {/* Mediciones */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: 'Porosidad', value: consulta.porosidad || '—' },
                { label: 'Densidad', value: consulta.densidad || '—' },
                { label: 'Grosor', value: consulta.grosor || '—' },
                { label: 'Elasticidad', value: consulta.elasticidad || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F9F9F9] rounded-xl px-3 py-2">
                  <p className="text-[10px] text-[#999999]" style={serif}>{label}</p>
                  <p className="text-sm font-bold text-[#2D5A27] capitalize" style={serif}>{value}</p>
                </div>
              ))}
            </div>

            {/* Técnica */}
            <div className="bg-[#FBF4EC] rounded-xl p-3">
              <p className="text-[10px] font-bold text-[#9A6A3A] mb-1" style={serif}>Técnica</p>
              <p className="text-sm font-semibold text-[#C9956B]">{resultado.tecnicaDefinicion}</p>
            </div>

            {/* Problemas */}
            {consulta.problemas.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#666666] mb-1.5" style={serif}>Problemas tratados:</p>
                <div className="flex flex-wrap gap-1">
                  {consulta.problemas.map((p) => (
                    <span key={p} className="text-[10px] bg-[#EEF5ED] text-[#2D5A27] px-2 py-0.5 rounded-full border border-[#90B98A]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            {consulta.notasEstilista && (
              <div className="bg-[#F9F9F9] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#666666] mb-1" style={serif}>Notas:</p>
                <p className="text-xs text-[#444444] leading-relaxed">{consulta.notasEstilista}</p>
              </div>
            )}

            {/* Satisfacción */}
            {consulta.satisfaccion && (
              <div className="flex items-center gap-2">
                <Star size={13} className="text-[#C9956B]" />
                <span className={`text-xs font-semibold ${satLabels[consulta.satisfaccion]?.color}`}>
                  {satLabels[consulta.satisfaccion]?.label}
                </span>
              </div>
            )}

            {/* Descargar PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E5E5] bg-white text-xs font-semibold text-[#666666] hover:border-[#2D5A27] hover:text-[#2D5A27] active:scale-95 transition-all disabled:opacity-50"
            >
              <Download size={12} className={downloading ? 'animate-bounce' : ''} />
              {downloading ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistorialTimeline({ consultas, clienta }: Props) {
  if (!consultas.length) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-[#EEF5ED] rounded-full mx-auto mb-3 flex items-center justify-center">
          <Calendar size={28} className="text-[#90B98A]" />
        </div>
        <p className="text-sm font-semibold text-[#666666]" style={serif}>Sin consultas registradas</p>
        <p className="text-xs text-[#999999] mt-1">Las consultas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {[...consultas].reverse().map((c, i) => (
        <ConsultaItem key={c.id} consulta={c} clienta={clienta} index={i} />
      ))}
    </div>
  );
}
