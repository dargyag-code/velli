'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Star, FileText, Download } from 'lucide-react';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getTratamientoBg, getTratamientoTextColor, getRizoLabel } from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';
import Badge from '../ui/Badge';

interface Props {
  consultas: Consulta[];
  clienta: Clienta;
}

function ConsultaItem({ consulta, clienta, index }: { consulta: Consulta; clienta: Clienta; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await generateConsultaPDF(clienta, consulta);
    } catch (e) {
      console.error('[HistorialTimeline] Error generando PDF:', e);
    } finally {
      setDownloading(false);
    }
  };
  const { resultado } = consulta;

  const satLabels: Record<string, { label: string; color: string }> = {
    muy_satisfecha: { label: '😍 Muy satisfecha', color: 'text-green-600' },
    satisfecha: { label: '😊 Satisfecha', color: 'text-blue-600' },
    parcial: { label: '🤔 Parcialmente', color: 'text-amber-600' },
    necesita_ajustes: { label: '⚠️ Necesita ajustes', color: 'text-red-600' },
  };

  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className="absolute left-0 top-3 w-6 h-6 bg-[#2D5A27] rounded-full flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-bold" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
          {consulta.numeroConsulta}
        </span>
      </div>

      {/* Line */}
      <div className="absolute left-3 top-9 bottom-0 w-0.5 bg-[#E5E5E5]" />

      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-hidden mb-4">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F5F0E8] transition-colors"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={13} className="text-[#999999]" />
              <span className="text-sm font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {formatDate(consulta.fecha)}
              </span>
              <Badge variant="purple">#{consulta.numeroConsulta}</Badge>
              {consulta.esBorrador && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  <FileText size={9} />
                  Borrador
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: getTratamientoBg(resultado.tratamientoPrincipal),
                  color: getTratamientoTextColor(resultado.tratamientoPrincipal),
                }}
              >
                {resultado.tratamientoPrincipal}
              </span>
              <span className="text-xs text-[#999999]">
                {getRizoLabel(consulta.tipoRizoPrincipal)}
              </span>
            </div>
          </div>
          {expanded ? (
            <ChevronUp size={18} className="text-[#999999]" />
          ) : (
            <ChevronDown size={18} className="text-[#999999]" />
          )}
        </button>

        {/* Expanded */}
        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#F0F0F0]">
            {consulta.esBorrador && (
              <div className="flex items-center justify-between mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-amber-600" />
                  <p className="text-xs font-semibold text-amber-700">Diagnóstico express — detalles incompletos</p>
                </div>
              </div>
            )}
            {/* Diagnóstico */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: 'Porosidad', value: consulta.porosidad || '—' },
                { label: 'Densidad', value: consulta.densidad || '—' },
                { label: 'Grosor', value: consulta.grosor || '—' },
                { label: 'Elasticidad', value: consulta.elasticidad || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F9F9F9] rounded-xl px-3 py-2">
                  <p className="text-xs text-[#999999]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>{label}</p>
                  <p className="text-sm font-bold text-[#2D5A27] capitalize" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Técnica */}
            <div className="bg-[#FBF4EC] rounded-xl p-3">
              <p className="text-xs font-bold text-[#9A6A3A] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                Técnica de definición
              </p>
              <p className="text-sm font-semibold text-[#C9956B]">{resultado.tecnicaDefinicion}</p>
            </div>

            {/* Problemas */}
            {consulta.problemas.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#666666] mb-1.5" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  Problemas tratados:
                </p>
                <div className="flex flex-wrap gap-1">
                  {consulta.problemas.map((p) => (
                    <span key={p} className="text-xs bg-[#EEF5ED] text-[#2D5A27] px-2 py-0.5 rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Satisfacción */}
            {consulta.satisfaccion && (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-[#C9956B]" />
                <span className={`text-xs font-semibold ${satLabels[consulta.satisfaccion]?.color}`}>
                  {satLabels[consulta.satisfaccion]?.label}
                </span>
              </div>
            )}

            {/* Notas */}
            {consulta.notasEstilista && (
              <div className="bg-[#F9F9F9] rounded-xl p-3">
                <p className="text-xs font-bold text-[#666666] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  Notas de la estilista:
                </p>
                <p className="text-xs text-[#444444]">{consulta.notasEstilista}</p>
              </div>
            )}

            {/* Próxima cita */}
            {consulta.proximaCita && (
              <div className="flex items-center gap-2 text-xs text-[#2D5A27]">
                <Calendar size={13} />
                <span>Próxima cita: <strong>{formatDate(consulta.proximaCita)}</strong></span>
              </div>
            )}

            {/* Descargar PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E5E5] bg-white text-xs font-semibold text-[#666666] hover:border-[#2D5A27] hover:text-[#2D5A27] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={13} className={downloading ? 'animate-bounce' : ''} />
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
        <p className="text-sm font-semibold text-[#666666]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
          Sin consultas registradas
        </p>
        <p className="text-xs text-[#999999] mt-1">Las consultas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {consultas.map((c, i) => (
        <ConsultaItem key={c.id} consulta={c} clienta={clienta} index={i} />
      ))}
    </div>
  );
}
