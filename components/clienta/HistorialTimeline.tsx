'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Star } from 'lucide-react';
import { Consulta } from '@/lib/types';
import { formatDate, getTratamientoBg, getTratamientoTextColor, getRizoLabel } from '@/lib/utils';
import Badge from '../ui/Badge';

interface Props {
  consultas: Consulta[];
}

function ConsultaItem({ consulta, index }: { consulta: Consulta; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
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
      <div className="absolute left-0 top-3 w-6 h-6 bg-[#5B2D8E] rounded-full flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-bold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {consulta.numeroConsulta}
        </span>
      </div>

      {/* Line */}
      <div className="absolute left-3 top-9 bottom-0 w-0.5 bg-[#E5E5E5]" />

      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-hidden mb-4">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#FAFAFA] transition-colors"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={13} className="text-[#999999]" />
              <span className="text-sm font-bold text-[#2D2D2D]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {formatDate(consulta.fecha)}
              </span>
              <Badge variant="purple">#{consulta.numeroConsulta}</Badge>
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
            {/* Diagnóstico */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: 'Porosidad', value: consulta.porosidad },
                { label: 'Densidad', value: consulta.densidad },
                { label: 'Grosor', value: consulta.grosor },
                { label: 'Elasticidad', value: consulta.elasticidad },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F9F9F9] rounded-xl px-3 py-2">
                  <p className="text-xs text-[#999999]" style={{ fontFamily: "'Montserrat', sans-serif" }}>{label}</p>
                  <p className="text-sm font-bold text-[#5B2D8E] capitalize" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Técnica */}
            <div className="bg-[#FDF8EE] rounded-xl p-3">
              <p className="text-xs font-bold text-[#9A7A2A] mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Técnica de definición
              </p>
              <p className="text-sm font-semibold text-[#C9A84C]">{resultado.tecnicaDefinicion}</p>
            </div>

            {/* Problemas */}
            {consulta.problemas.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#666666] mb-1.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Problemas tratados:
                </p>
                <div className="flex flex-wrap gap-1">
                  {consulta.problemas.map((p) => (
                    <span key={p} className="text-xs bg-[#F3EDF9] text-[#5B2D8E] px-2 py-0.5 rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Satisfacción */}
            {consulta.satisfaccion && (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-[#C9A84C]" />
                <span className={`text-xs font-semibold ${satLabels[consulta.satisfaccion]?.color}`}>
                  {satLabels[consulta.satisfaccion]?.label}
                </span>
              </div>
            )}

            {/* Notas */}
            {consulta.notasEstilista && (
              <div className="bg-[#F9F9F9] rounded-xl p-3">
                <p className="text-xs font-bold text-[#666666] mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Notas de la estilista:
                </p>
                <p className="text-xs text-[#444444]">{consulta.notasEstilista}</p>
              </div>
            )}

            {/* Próxima cita */}
            {consulta.proximaCita && (
              <div className="flex items-center gap-2 text-xs text-[#5B2D8E]">
                <Calendar size={13} />
                <span>Próxima cita: <strong>{formatDate(consulta.proximaCita)}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistorialTimeline({ consultas }: Props) {
  if (!consultas.length) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-[#F3EDF9] rounded-full mx-auto mb-3 flex items-center justify-center">
          <Calendar size={28} className="text-[#C4A0E8]" />
        </div>
        <p className="text-sm font-semibold text-[#666666]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Sin consultas registradas
        </p>
        <p className="text-xs text-[#999999] mt-1">Las consultas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {consultas.map((c, i) => (
        <ConsultaItem key={c.id} consulta={c} index={i} />
      ))}
    </div>
  );
}
