'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Calendar, Star, FileText, Download, MessageCircle, Pencil } from 'lucide-react';
import { Clienta, Consulta, SatisfaccionNivel } from '@/lib/types';
import { formatDate, getTratamientoBg, getTratamientoTextColor, getTratamientoBorderColor, getRizoLabel } from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';
import { updateConsulta } from '@/lib/db';

interface Props {
  consultas: Consulta[];
  clienta: Clienta;
}

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

function buildWhatsAppUrl(clienta: Clienta, consulta: Consulta): string {
  const { resultado } = consulta;
  const lines = [
    `🌿 *Velli Pro — Diagnóstico Capilar*`,
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
    `_Diagnóstico generado con Velli Pro_`,
    `_Inteligencia capilar a tu alcance_ 🌿`,
  ].filter((l) => l !== null).join('\n');

  const tel = clienta.telefono.replace(/\D/g, '');
  return `https://wa.me/${tel}?text=${encodeURIComponent(lines)}`;
}

function ConsultaItem({ consulta, clienta, index }: { consulta: Consulta; clienta: Clienta; index: number }) {
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
    try { await generateConsultaPDF(clienta, consulta); }
    catch (e) { console.error('[HistorialTimeline] PDF error:', e); }
    finally { setDownloading(false); }
  };

  const { resultado } = consulta;
  const borderColor = getTratamientoBorderColor(resultado.tratamientoPrincipal);
  const treatBg = getTratamientoBg(resultado.tratamientoPrincipal);
  const treatColor = getTratamientoTextColor(resultado.tratamientoPrincipal);

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

            {/* Satisfacción 1–5 — lectura si ya existe, captura de un toque si no */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-[#666666]" style={serif}>
                {sat ? 'Satisfacción:' : '¿Cómo quedó tu clienta?'}
              </span>
              <div className="flex gap-0.5">
                {([1, 2, 3, 4, 5] as SatisfaccionNivel[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!!sat || savingSat}
                    onClick={() => calificar(n)}
                    aria-label={`Calificar ${n} de 5`}
                    className={sat ? 'cursor-default' : 'active:scale-90 transition-transform'}
                  >
                    <Star
                      size={15}
                      fill={sat && n <= sat ? '#C9956B' : 'none'}
                      className={sat && n <= sat ? 'text-[#C9956B]' : 'text-[#D8D2C6]'}
                    />
                  </button>
                ))}
              </div>
              {sat && <span className="text-xs font-semibold text-[#9A6A3A]">{sat}/5</span>}
              {!sat && <span className="text-[10px] text-[#999999]">opcional · un toque</span>}
            </div>

            {/* Acciones */}
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/diagnostico?edit=${consulta.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E5E5] bg-white text-xs font-semibold text-[#666666] hover:border-[#2D5A27] hover:text-[#2D5A27] active:scale-95 transition-all"
              >
                <Pencil size={12} />
                Editar
              </Link>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E5E5] bg-white text-xs font-semibold text-[#666666] hover:border-[#2D5A27] hover:text-[#2D5A27] active:scale-95 transition-all disabled:opacity-50"
              >
                <Download size={12} className={downloading ? 'animate-bounce' : ''} />
                {downloading ? 'Generando...' : 'Descargar PDF'}
              </button>

              {clienta.telefono && (
                <a
                  href={buildWhatsAppUrl(clienta, consulta)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#25D366] bg-white text-xs font-semibold text-[#25D366] hover:bg-[#25D366] hover:text-white active:scale-95 transition-all"
                >
                  <MessageCircle size={12} />
                  Compartir
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
