'use client';
import React, { useState } from 'react';
import {
  Sparkles, Calendar, Check, Droplets, Leaf, Zap, Star,
  Clock, AlertCircle, FileText, Save,
} from 'lucide-react';
import { Consulta, Clienta, WizardData } from '@/lib/types';
import {
  getTratamientoBg, getTratamientoTextColor,
  formatDate, addWeeks, todayISO, getRizoLabel,
} from '@/lib/utils';
import { getTratamientoPrincipalExplicacion } from '@/lib/diagnosticEngine';
import { RizoPattern } from './RizoPatterns';
import { vibracionConfirmacion, vibracionSutil } from '@/lib/haptics';

interface Props {
  consulta: Consulta;
  clienta: Clienta | null;
  wizardData: WizardData;
  onSave: (proximaCita: string, notas: string, esBorrador: boolean) => Promise<void>;
  saving: boolean;
}

const TratamientoIcon = ({ t }: { t: string }) => {
  const lower = t.toLowerCase();
  if (lower.includes('hidratac')) return <Droplets size={14} />;
  if (lower.includes('nutrici')) return <Leaf size={14} />;
  if (lower.includes('reconstru') || lower.includes('proteína') || lower.includes('proteina')) return <Zap size={14} />;
  return <Star size={14} />;
};

function CronogramaCard({ semana, tratamiento }: { semana: string; tratamiento: string }) {
  const bg = getTratamientoBg(tratamiento);
  const color = getTratamientoTextColor(tratamiento);
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };
  return (
    <div className="flex-1 rounded-2xl p-2.5 text-center border-2" style={{ backgroundColor: bg, borderColor: color + '40' }}>
      <p className="text-[10px] font-bold text-[#999] mb-1" style={serif}>{semana}</p>
      <div className="w-7 h-7 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: color + '20', color }}>
        <TratamientoIcon t={tratamiento} />
      </div>
      <p className="text-[10px] font-bold leading-tight" style={{ color, ...serif }}>{tratamiento}</p>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E5E5E5]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-[#EEF5ED] rounded-lg flex items-center justify-center text-[#2D5A27]">
          {icon}
        </div>
        <h3 className="text-sm font-bold text-[#2D2D2D]" style={serif}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Determina si hay suficientes detalles para diagnóstico "completo"
function hasDetallesCompletos(data: WizardData): boolean {
  return (
    data.estadoCueroCabelludo.length > 0 ||
    !!data.estadoPuntas ||
    data.quimicos.length > 0 ||
    !!data.frecuenciaLavado ||
    !!data.nivelEstres
  );
}

export default function PasoPlan({ consulta, clienta, wizardData, onSave, saving }: Props) {
  const { resultado } = consulta;
  const [proximaCita, setProximaCita] = useState(
    consulta.proximaCita || addWeeks(todayISO(), 4)
  );
  const [notas, setNotas] = useState(consulta.notasEstilista || '');
  const [saved, setSaved] = useState<'express' | 'completo' | null>(null);

  const tieneDetalles = hasDetallesCompletos(wizardData);
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  const handleGuardar = async (esBorrador: boolean) => {
    vibracionConfirmacion();
    await onSave(proximaCita, notas, esBorrador);
    setSaved(esBorrador ? 'express' : 'completo');
  };

  return (
    <div className="flex flex-col gap-4 step-enter pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2D5A27] to-[#3D7A35] rounded-3xl p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-[#FFD700]" />
          <span className="text-xs font-semibold text-[#B8D4B5]" style={serif}>Plan generado</span>
        </div>
        {clienta && (
          <p className="text-base font-bold mb-0.5" style={serif}>{clienta.nombre}</p>
        )}
        <p className="text-xs text-[#B8D4B5]">{formatDate(consulta.fecha)}</p>
      </div>

      {/* Diagnóstico rápido */}
      <SectionCard icon={<Star size={14} />} title="Diagnóstico">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[#F5F0E8] rounded-xl p-2.5">
            <RizoPattern tipo={consulta.tipoRizoPrincipal} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#2D5A27]" style={serif}>
              {consulta.tipoRizoPrincipal || '—'}
            </p>
            {consulta.tipoRizoPrincipal && (
              <p className="text-xs text-[#666]">{getRizoLabel(consulta.tipoRizoPrincipal)}</p>
            )}
          </div>
        </div>

        {/* Pills de medición */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {[
            { label: 'Porosidad', value: consulta.porosidad },
            { label: 'Densidad', value: consulta.densidad },
            { label: 'Grosor', value: consulta.grosor },
            { label: 'Elasticidad', value: consulta.elasticidad },
          ].filter(({ value }) => !!value).map(({ label, value }) => (
            <div key={label} className="bg-[#F5F0E8] rounded-xl p-2 text-center">
              <p className="text-[10px] text-[#999] mb-0.5" style={serif}>{label}</p>
              <p className="text-xs font-bold text-[#2D5A27] capitalize" style={serif}>{value}</p>
            </div>
          ))}
        </div>

        {/* Balance */}
        {consulta.balanceHP && (
          <div className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${
            consulta.balanceHP === 'proteina' ? 'bg-orange-100 text-orange-700'
            : consulta.balanceHP === 'hidratacion' ? 'bg-blue-100 text-blue-700'
            : consulta.balanceHP === 'nutricion' ? 'bg-green-100 text-green-700'
            : 'bg-purple-100 text-purple-700'
          }`} style={serif}>
            {consulta.balanceHP === 'hidratacion' ? '💧 Necesita HIDRATACIÓN'
              : consulta.balanceHP === 'nutricion' ? '🌿 Necesita NUTRICIÓN'
              : consulta.balanceHP === 'proteina' ? '⚡ Necesita PROTEÍNA'
              : '✨ En MANTENIMIENTO'}
          </div>
        )}

        {consulta.problemas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {consulta.problemas.map((p) => (
              <span key={p} className="text-[10px] bg-[#EEF5ED] text-[#2D5A27] px-2 py-0.5 rounded-full border border-[#90B98A]">
                {p}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Tratamiento */}
      <SectionCard icon={<Zap size={14} />} title="Tratamiento recomendado">
        <div
          className="rounded-xl p-2.5 mb-2.5 text-center font-bold text-sm"
          style={{
            backgroundColor: getTratamientoBg(resultado.tratamientoPrincipal),
            color: getTratamientoTextColor(resultado.tratamientoPrincipal),
            ...serif,
          }}
        >
          {resultado.tratamientoPrincipal}
        </div>
        <p className="text-xs text-[#555] leading-relaxed mb-2">
          {getTratamientoPrincipalExplicacion(resultado.tratamientoPrincipal, wizardData)}
        </p>
        {resultado.tratamientosAdicionales.length > 0 && (
          <div className="bg-[#FBF4EC] rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-[#9A6A3A] mb-1.5" style={serif}>Adicionales:</p>
            {resultado.tratamientosAdicionales.map((t) => (
              <div key={t} className="flex items-start gap-1.5 mb-1">
                <Check size={11} className="text-[#C9956B] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#666]">{t}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Cronograma */}
      <SectionCard icon={<Calendar size={14} />} title="Cronograma 4 semanas">
        <div className="flex gap-1.5">
          <CronogramaCard semana="Sem 1" tratamiento={resultado.cronograma.semana1} />
          <CronogramaCard semana="Sem 2" tratamiento={resultado.cronograma.semana2} />
          <CronogramaCard semana="Sem 3" tratamiento={resultado.cronograma.semana3} />
          <CronogramaCard semana="Sem 4" tratamiento={resultado.cronograma.semana4} />
        </div>
      </SectionCard>

      {/* Técnica */}
      <SectionCard icon={<Sparkles size={14} />} title="Técnica de definición">
        <div className="bg-[#FBF4EC] rounded-xl p-2.5 mb-2">
          <p className="text-sm font-bold text-[#C9956B]" style={serif}>{resultado.tecnicaDefinicion}</p>
        </div>
        <p className="text-xs text-[#555] leading-relaxed">{resultado.tecnicaDescripcion}</p>
      </SectionCard>

      {/* Notas adicionales */}
      {resultado.notasAdicionales.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-amber-600" />
            <p className="text-xs font-bold text-amber-700" style={serif}>Notas importantes</p>
          </div>
          {resultado.notasAdicionales.map((n, i) => (
            <div key={i} className="flex items-start gap-1.5 mb-1">
              <span className="text-amber-500 flex-shrink-0 text-xs">⚠</span>
              <p className="text-[10px] text-[#555]">{n}</p>
            </div>
          ))}
        </div>
      )}

      {/* Próxima cita */}
      <div className="bg-white rounded-2xl p-4 border-2 border-[#2D5A27]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-[#EEF5ED] rounded-lg flex items-center justify-center text-[#2D5A27]">
            <Clock size={14} />
          </div>
          <h3 className="text-sm font-bold text-[#2D2D2D]" style={serif}>Próxima cita</h3>
        </div>

        <p className="text-xs text-[#2D5A27] font-semibold mb-2" style={serif}>
          {resultado.intervaloSugerido}
        </p>

        <input
          type="date"
          value={proximaCita}
          onChange={(e) => setProximaCita(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white mb-3"
          min={todayISO()}
        />

        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas de la estilista (opcional)..."
          className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white resize-none focus:outline-none focus:border-[#2D5A27]"
          rows={2}
        />
      </div>

      {/* Botones de guardar */}
      {saved ? (
        <div className="flex items-center justify-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center success-bounce">
            <Check size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-green-700 text-sm" style={serif}>
              {saved === 'express' ? '¡Diagnóstico guardado como borrador!' : '¡Diagnóstico guardado!'}
            </p>
            <p className="text-xs text-green-600">
              {saved === 'express' ? 'Puedes completar los detalles después.' : 'Los datos se guardaron correctamente.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Guardar completo */}
          <button
            type="button"
            onClick={() => handleGuardar(false)}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${
              tieneDetalles
                ? 'bg-[#2D5A27] text-white shadow-lg shadow-green-900/20'
                : 'bg-[#CCCCCC] text-white cursor-not-allowed'
            }`}
            style={serif}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Guardar diagnóstico completo
          </button>

          {!tieneDetalles && (
            <p className="text-[10px] text-center text-[#AAAAAA]">
              Llena los detalles opcionales (+ Más detalles) para guardar como completo
            </p>
          )}

          {/* Guardar express / borrador */}
          <button
            type="button"
            onClick={() => handleGuardar(true)}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm border-2 border-[#2D5A27] text-[#2D5A27] bg-white transition-all active:scale-[0.98] hover:bg-[#EEF5ED]"
            style={serif}
          >
            <FileText size={16} />
            Guardar express
            <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Borrador
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
