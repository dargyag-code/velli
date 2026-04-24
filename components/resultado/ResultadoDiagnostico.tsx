'use client';
import React, { useState } from 'react';
import {
  Sparkles, Calendar, Download, MessageCircle, Check,
  Droplets, Leaf, Zap, Star, Clock, AlertCircle
} from 'lucide-react';
import { Consulta, Clienta, WizardData } from '@/lib/types';
import { getTratamientoColor, getTratamientoBg, getTratamientoTextColor, formatDate, addWeeks, todayISO, getRizoLabel } from '@/lib/utils';
import { getTratamientoPrincipalExplicacion } from '@/lib/diagnosticEngine';
import { RizoPattern } from '../wizard/RizoPatterns';
import Button from '../ui/Button';

interface Props {
  consulta: Consulta;
  clienta: Clienta | null;
  wizardData: WizardData;
  onSave: (proximaCita?: string, notas?: string) => void;
  onExportPDF: () => void;
  saving: boolean;
}

const TratamientoIcon = ({ t }: { t: string }) => {
  const lower = t.toLowerCase();
  if (lower.includes('hidratac')) return <Droplets size={16} />;
  if (lower.includes('nutrici')) return <Leaf size={16} />;
  if (lower.includes('reconstru') || lower.includes('proteína')) return <Zap size={16} />;
  return <Star size={16} />;
};

const CronogramaCard = ({ semana, tratamiento }: { semana: string; tratamiento: string }) => {
  const bg = getTratamientoBg(tratamiento);
  const color = getTratamientoTextColor(tratamiento);
  return (
    <div
      className="flex-1 rounded-2xl p-3 text-center border-2"
      style={{ backgroundColor: bg, borderColor: color + '50' }}
    >
      <p className="text-xs font-bold text-[#999999] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
        {semana}
      </p>
      <div
        className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
        style={{ backgroundColor: color + '20', color }}
      >
        <TratamientoIcon t={tratamiento} />
      </div>
      <p className="text-xs font-bold leading-tight" style={{ color, fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
        {tratamiento}
      </p>
    </div>
  );
};

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-8 h-8 bg-[#EEF5ED] rounded-xl flex items-center justify-center text-[#2D5A27]">
      {icon}
    </div>
    <h3
      className="text-base font-bold text-[#2D2D2D]"
      style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
    >
      {title}
    </h3>
  </div>
);

export default function ResultadoDiagnostico({ consulta, clienta, wizardData, onSave, onExportPDF, saving }: Props) {
  const { resultado } = consulta;
  const [proximaCita, setProximaCita] = useState(
    consulta.proximaCita || addWeeks(todayISO(), 4)
  );
  const [notas, setNotas] = useState(consulta.notasEstilista || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(proximaCita, notas);
    setSaved(true);
  };

  const handleWhatsApp = () => {
    const nombre = clienta?.nombre || 'clienta';
    const msg = encodeURIComponent(
      `Hola ${nombre}! 🌸 Aquí tu resumen de diagnóstico capilar de Velli — Inteligencia capilar a tu alcance:\n\n` +
      `✨ Tipo de cabello: ${getRizoLabel(consulta.tipoRizoPrincipal)}\n` +
      `💧 Porosidad: ${consulta.porosidad}\n` +
      `⚖️ Balance: ${consulta.balanceHP}\n\n` +
      `🎯 Tratamiento: ${resultado.tratamientoPrincipal}\n\n` +
      `📅 Próxima cita sugerida: ${formatDate(proximaCita)}\n\n` +
      `Con amor por tu cabello — Velli Pro, Inteligencia capilar a tu alcance 💚`
    );
    const tel = clienta?.telefono?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-5 step-enter">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2D5A27] to-[#3D7A35] rounded-3xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-[#C9956B]" />
          <span className="text-sm font-semibold text-[#B8D4B5]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Plan de tratamiento generado
          </span>
        </div>
        {clienta && (
          <p className="text-lg font-bold mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            {clienta.nombre}
          </p>
        )}
        <p className="text-sm text-[#B8D4B5]">{formatDate(consulta.fecha)}</p>
      </div>

      {/* 1. Resumen del diagnóstico */}
      <div className="bg-[#EEF5ED] rounded-3xl p-4">
        <SectionTitle icon={<Star size={16} />} title="Diagnóstico" />

        {/* Rizo type */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <RizoPattern tipo={consulta.tipoRizoPrincipal} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#2D5A27]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              {consulta.tipoRizoPrincipal}
            </p>
            <p className="text-sm text-[#666666]">{getRizoLabel(consulta.tipoRizoPrincipal)}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: 'Porosidad', value: consulta.porosidad },
            { label: 'Densidad', value: consulta.densidad },
            { label: 'Grosor', value: consulta.grosor },
            { label: 'Elasticidad', value: consulta.elasticidad },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl p-2.5 text-center shadow-sm">
              <p className="text-xs text-[#999999] mb-0.5" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {label}
              </p>
              <p className="text-sm font-bold text-[#2D5A27] capitalize" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Balance */}
        <div
          className={`rounded-2xl p-3 text-center font-bold text-sm ${
            consulta.balanceHP === 'proteina'
              ? 'bg-orange-100 text-orange-700'
              : consulta.balanceHP === 'hidratacion'
              ? 'bg-blue-100 text-blue-700'
              : consulta.balanceHP === 'nutricion'
              ? 'bg-green-100 text-green-700'
              : 'bg-purple-100 text-purple-700'
          }`}
          style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
        >
          Tu cabello necesita:{' '}
          {consulta.balanceHP === 'hidratacion'
            ? '💧 HIDRATACIÓN'
            : consulta.balanceHP === 'nutricion'
            ? '🌿 NUTRICIÓN'
            : consulta.balanceHP === 'proteina'
            ? '⚡ PROTEÍNA'
            : '✨ MANTENIMIENTO'}
        </div>

        {consulta.problemas.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[#666666] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Problemas detectados:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {consulta.problemas.map((p) => (
                <span
                  key={p}
                  className="text-xs bg-white text-[#2D5A27] px-2 py-1 rounded-full border border-[#90B98A]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Tratamiento */}
      <div className="bg-white rounded-3xl p-4 border-2 border-[#C9956B] shadow-sm">
        <SectionTitle icon={<Zap size={16} />} title="Tratamiento recomendado" />

        <div
          className="rounded-2xl p-3 mb-3 text-center font-bold text-base"
          style={{
            backgroundColor: getTratamientoBg(resultado.tratamientoPrincipal),
            color: getTratamientoTextColor(resultado.tratamientoPrincipal),
            fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
          }}
        >
          {resultado.tratamientoPrincipal}
        </div>

        <p className="text-sm text-[#444444] leading-relaxed mb-3">
          {getTratamientoPrincipalExplicacion(resultado.tratamientoPrincipal, wizardData)}
        </p>

        {resultado.tratamientosAdicionales.length > 0 && (
          <div className="bg-[#FBF4EC] rounded-xl p-3">
            <p className="text-xs font-bold text-[#9A6A3A] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Tratamientos adicionales:
            </p>
            {resultado.tratamientosAdicionales.map((t) => (
              <div key={t} className="flex items-start gap-2 mb-1.5">
                <Check size={14} className="text-[#C9956B] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#666666]">{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Cronograma */}
      <div className="bg-white rounded-3xl p-4 border border-[#E5E5E5] shadow-sm">
        <SectionTitle icon={<Calendar size={16} />} title="Cronograma 4 semanas" />
        <div className="flex gap-2">
          <CronogramaCard semana="Sem 1" tratamiento={resultado.cronograma.semana1} />
          <CronogramaCard semana="Sem 2" tratamiento={resultado.cronograma.semana2} />
          <CronogramaCard semana="Sem 3" tratamiento={resultado.cronograma.semana3} />
          <CronogramaCard semana="Sem 4" tratamiento={resultado.cronograma.semana4} />
        </div>
      </div>

      {/* 4. Técnica */}
      <div className="bg-white rounded-3xl p-4 border border-[#E5E5E5] shadow-sm">
        <SectionTitle icon={<Sparkles size={16} />} title="Técnica de definición" />

        <div className="bg-[#FBF4EC] rounded-2xl p-3 mb-3">
          <p className="text-base font-bold text-[#C9956B]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            {resultado.tecnicaDefinicion}
          </p>
        </div>

        <p className="text-sm text-[#444444] leading-relaxed mb-3">
          {resultado.tecnicaDescripcion}
        </p>

        <div className="flex items-center gap-2 text-sm text-[#666666]">
          <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
            <Droplets size={13} className="text-blue-500" />
          </div>
          <span>{resultado.metodoSecado}</span>
        </div>
      </div>

      {/* 5. Rutina en casa */}
      <div className="bg-white rounded-3xl p-4 border border-[#E5E5E5] shadow-sm">
        <SectionTitle icon={<Leaf size={16} />} title="Rutina para casa" />

        {[
          { title: 'Día de lavado (Wash day)', items: resultado.cuidadoCasa.diaLavado, color: '#2D5A27', bg: '#EEF5ED' },
          { title: 'Mantenimiento nocturno', items: resultado.cuidadoCasa.nocturno, color: '#3B82F6', bg: '#EFF6FF' },
          { title: 'Refresh día 2-3', items: resultado.cuidadoCasa.refresh, color: '#2D8E5B', bg: '#F0FDF4' },
        ].map(({ title, items, color, bg }) => (
          <div key={title} className="mb-4">
            <div
              className="rounded-xl p-2.5 mb-2"
              style={{ backgroundColor: bg }}
            >
              <p
                className="text-xs font-bold"
                style={{ color, fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
              >
                {title}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pl-1">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="text-xs font-bold flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white mt-0.5"
                    style={{ backgroundColor: color, fontSize: '9px', fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-xs text-[#444444] leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Evitar */}
        <div className="bg-red-50 rounded-2xl p-3">
          <p className="text-xs font-bold text-[#8E2D2D] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            ❌ Evitar:
          </p>
          {resultado.cuidadoCasa.evitar.map((item, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <span className="text-[#8E2D2D] flex-shrink-0 text-xs mt-0.5">✗</span>
              <p className="text-xs text-[#666666]">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Productos */}
      <div className="bg-white rounded-3xl p-4 border border-[#E5E5E5] shadow-sm">
        <SectionTitle icon={<Star size={16} />} title="Productos recomendados" />
        <div className="flex flex-col gap-2">
          {resultado.productosPonto.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 bg-[#FBF4EC] rounded-xl">
              <div className="w-6 h-6 bg-[#C9956B] rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={12} className="text-white" strokeWidth={3} />
              </div>
              <p className="text-xs text-[#444444] leading-snug">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Notas adicionales */}
      {resultado.notasAdicionales.length > 0 && (
        <div className="bg-amber-50 rounded-3xl p-4 border border-amber-200">
          <SectionTitle icon={<AlertCircle size={16} />} title="Notas importantes" />
          <div className="flex flex-col gap-2">
            {resultado.notasAdicionales.map((n, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
                <p className="text-xs text-[#666666] leading-snug">{n}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Próxima cita */}
      <div className="bg-white rounded-3xl p-4 border-2 border-[#2D5A27] shadow-sm">
        <SectionTitle icon={<Clock size={16} />} title="Próxima cita" />

        <div className="bg-[#EEF5ED] rounded-2xl p-3 mb-4">
          <p className="text-xs text-[#999999] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            Intervalo recomendado:
          </p>
          <p className="text-sm font-bold text-[#2D5A27]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
            {resultado.intervaloSugerido}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label
              className="text-xs font-semibold text-[#2D2D2D] block mb-1.5"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              Fecha de próxima cita:
            </label>
            <input
              type="date"
              value={proximaCita}
              onChange={(e) => setProximaCita(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white"
              min={todayISO()}
            />
          </div>
          <div>
            <label
              className="text-xs font-semibold text-[#2D2D2D] block mb-1.5"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              Notas de la estilista:
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones adicionales, reacciones, recordatorios..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white resize-none"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pb-6">
        {saved ? (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center success-bounce">
              <Check size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-green-700 text-sm" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                ¡Consulta guardada!
              </p>
              <p className="text-xs text-green-600">Los datos se guardaron correctamente</p>
            </div>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSave}
            loading={saving}
            icon={<Check size={18} />}
          >
            Guardar consulta
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={onExportPDF}
            icon={<Download size={16} />}
          >
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleWhatsApp}
            icon={<MessageCircle size={16} />}
          >
            WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
