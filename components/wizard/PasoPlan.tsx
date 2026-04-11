'use client';
import React, { useState, useRef } from 'react';
import {
  Sparkles, Calendar, Check, Droplets, Leaf, Zap, Star,
  Clock, AlertCircle, FileText, Save, Camera, X as XIcon,
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
  onSave: (proximaCita: string, notas: string, esBorrador: boolean, fotoAntes?: string, fotoDespues?: string) => Promise<void>;
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
    !!data.frecuenciaLavado
  );
}

export default function PasoPlan({ consulta, clienta, wizardData, onSave, saving }: Props) {
  const { resultado } = consulta;
  const [proximaCita, setProximaCita] = useState(
    consulta.proximaCita || addWeeks(todayISO(), 4)
  );
  const [notas, setNotas] = useState(consulta.notasEstilista || '');
  const [fotoAntes, setFotoAntes] = useState<string | undefined>(consulta.fotoAntes);
  const [fotoDespues, setFotoDespues] = useState<string | undefined>(consulta.fotoDespues);
  const fotoAntesRef = useRef<HTMLInputElement>(null);
  const fotoDespuesRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<'express' | 'completo' | null>(null);

  const handleFotoAntes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoAntes(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFotoDespues = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoDespues(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const tieneDetalles = hasDetallesCompletos(wizardData);
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  const handleGuardar = async (esBorrador: boolean) => {
    vibracionConfirmacion();
    await onSave(proximaCita, notas, esBorrador, fotoAntes, fotoDespues);
    setSaved(esBorrador ? 'express' : 'completo');
  };

  return (
    <div className="flex flex-col gap-4 step-enter pb-6">
      {/* Hero card — Tipo de cabello detectado */}
      <div
        className="rounded-3xl p-5 text-white overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 60%, #3D7A35 100%)',
          boxShadow: '0 8px 32px rgba(45,90,39,0.30)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-[#FFD700]" />
              <span className="text-xs font-semibold text-[#A8D0A3]" style={serif}>
                Plan generado
              </span>
            </div>
            {clienta && (
              <p className="text-sm text-[#B8D4B5] mb-2" style={serif}>{clienta.nombre} · {formatDate(consulta.fecha)}</p>
            )}
            {/* Tipo grande */}
            <div className="flex items-end gap-3">
              <p
                className="font-extrabold text-white leading-none"
                style={{ ...serif, fontSize: 64, lineHeight: 1 }}
              >
                {consulta.tipoRizoPrincipal || '—'}
              </p>
              <div className="mb-1">
                <p className="text-sm font-semibold text-[#A8D0A3]" style={serif}>
                  {getRizoLabel(consulta.tipoRizoPrincipal)}
                </p>
              </div>
            </div>
          </div>
          <div className="opacity-30 absolute right-4 top-1/2 -translate-y-1/2">
            <RizoPattern tipo={consulta.tipoRizoPrincipal} />
          </div>
        </div>

        {/* Pills de medición */}
        {[consulta.porosidad, consulta.densidad, consulta.grosor, consulta.elasticidad].some(Boolean) && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {[
              { label: 'Por', value: consulta.porosidad },
              { label: 'Den', value: consulta.densidad },
              { label: 'Gro', value: consulta.grosor },
              { label: 'Ela', value: consulta.elasticidad },
            ].filter(({ value }) => !!value).map(({ label, value }) => (
              <div key={label} className="px-3 py-1.5 rounded-full text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <span className="text-[10px] text-[#A8D0A3]" style={serif}>{label} </span>
                <span className="text-xs font-bold text-white capitalize" style={serif}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balance + problemas */}
      <SectionCard icon={<Star size={14} />} title="Estado capilar">
        {consulta.balanceHP && (
          <div
            className={`rounded-xl px-3 py-2.5 text-center text-xs font-bold mb-2 ${
              consulta.balanceHP === 'proteina'  ? 'bg-[#FFF3E0] text-[#D4820A]'
              : consulta.balanceHP === 'hidratacion' ? 'bg-[#E8F4FD] text-[#1A5276]'
              : consulta.balanceHP === 'nutricion'   ? 'bg-[#EEF5ED] text-[#2D5A27]'
              : 'bg-[#F3EDF9] text-[#6B3FA0]'
            }`}
            style={serif}
          >
            {consulta.balanceHP === 'hidratacion' ? '💧 Necesita HIDRATACIÓN'
              : consulta.balanceHP === 'nutricion' ? '🌿 Necesita NUTRICIÓN'
              : consulta.balanceHP === 'proteina'  ? '⚡ Necesita PROTEÍNA'
              : '✨ En MANTENIMIENTO'}
          </div>
        )}
        {consulta.problemas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {consulta.problemas.map((p) => (
              <span key={p} className="text-[10px] bg-[#EEF5ED] text-[#2D5A27] px-2.5 py-1 rounded-full border border-[#90B98A]">
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

      {/* Cronograma — timeline horizontal */}
      <SectionCard icon={<Calendar size={14} />} title="Cronograma 4 semanas">
        <div className="relative flex items-start justify-between pt-2">
          {/* Línea conectora */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-[#E5E5E5] z-0" />
          {[
            { sem: 'Sem 1', t: resultado.cronograma.semana1 },
            { sem: 'Sem 2', t: resultado.cronograma.semana2 },
            { sem: 'Sem 3', t: resultado.cronograma.semana3 },
            { sem: 'Sem 4', t: resultado.cronograma.semana4 },
          ].map(({ sem, t }) => {
            const bg = getTratamientoBg(t);
            const color = getTratamientoTextColor(t);
            return (
              <div key={sem} className="flex-1 flex flex-col items-center gap-1.5 z-10">
                {/* Nodo */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                  style={{ background: bg, border: `2px solid ${color}` }}
                >
                  <TratamientoIcon t={t} />
                </div>
                <p className="text-[9px] font-bold text-[#999]" style={serif}>{sem}</p>
                <p className="text-[9px] font-bold text-center leading-tight px-0.5" style={{ color, ...serif }}>{t.split(' ')[0]}</p>
              </div>
            );
          })}
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
          className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white"
          min={todayISO()}
        />
      </div>

      {/* Fotos antes / después */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5E5E5]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-[#EEF5ED] rounded-lg flex items-center justify-center text-[#2D5A27]">
            <Camera size={14} />
          </div>
          <h3 className="text-sm font-bold text-[#2D2D2D]" style={serif}>Fotos del servicio</h3>
        </div>
        <div className="flex gap-3">
          {/* Foto antes */}
          <div className="flex-1">
            <p className="text-[10px] font-bold text-[#999] mb-1.5 uppercase" style={serif}>Antes</p>
            {fotoAntes ? (
              <div className="relative">
                <img src={fotoAntes} alt="Antes" className="w-full h-28 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setFotoAntes(undefined); if (fotoAntesRef.current) fotoAntesRef.current.value = ''; }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <XIcon size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-[#CCCCCC] cursor-pointer hover:border-[#2D5A27] transition-colors">
                <Camera size={20} className="text-[#CCCCCC] mb-1" />
                <span className="text-[10px] text-[#999]">Agregar foto</span>
                <input ref={fotoAntesRef} type="file" accept="image/*" className="hidden" onChange={handleFotoAntes} />
              </label>
            )}
          </div>
          {/* Foto después */}
          <div className="flex-1">
            <p className="text-[10px] font-bold text-[#999] mb-1.5 uppercase" style={serif}>Después</p>
            {fotoDespues ? (
              <div className="relative">
                <img src={fotoDespues} alt="Después" className="w-full h-28 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setFotoDespues(undefined); if (fotoDespuesRef.current) fotoDespuesRef.current.value = ''; }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <XIcon size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-[#CCCCCC] cursor-pointer hover:border-[#2D5A27] transition-colors">
                <Camera size={20} className="text-[#CCCCCC] mb-1" />
                <span className="text-[10px] text-[#999]">Agregar foto</span>
                <input ref={fotoDespuesRef} type="file" accept="image/*" className="hidden" onChange={handleFotoDespues} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Notas para la próxima visita */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5E5E5]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-[#EEF5ED] rounded-lg flex items-center justify-center text-[#2D5A27]">
            <FileText size={14} />
          </div>
          <h3 className="text-sm font-bold text-[#2D2D2D]" style={serif}>Notas para la próxima visita</h3>
        </div>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: le queda bien el fleco, no le gusta el gel, prefiere productos sin olor fuerte..."
          className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-[#FAFAFA] resize-none focus:outline-none focus:border-[#2D5A27]"
          rows={3}
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
