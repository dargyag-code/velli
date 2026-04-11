'use client';
import React from 'react';
import { WizardData } from '@/lib/types';
import CheckboxGroup from '../ui/CheckboxGroup';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import Input from '../ui/Input';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

const QUIMICOS = [
  'Tinte permanente',
  'Decoloración / mechas',
  'Alisado permanente (keratina, formol, japonés)',
  'Relaxer / desrizado químico',
  'Permanente (rizado químico)',
  'Ninguno',
];

const USO_CALOR = [
  'Secador con difusor',
  'Secador sin difusor (directo)',
  'Plancha / alisadora',
  'Tenaza / rizadora',
  'No usa calor',
];

const FRECUENCIA_CALOR = [
  { value: 'diario', label: 'Diario' },
  { value: '2-3-semana', label: '2-3 veces por semana' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'nunca', label: 'Nunca' },
];

const FRECUENCIA_LAVADO = [
  { value: 'diario', label: 'Diario' },
  { value: 'cada-2-dias', label: 'Cada 2 días' },
  { value: '2-semana', label: '2 veces por semana' },
  { value: '1-semana', label: '1 vez por semana' },
  { value: 'cada-2-semanas', label: 'Cada 2 semanas' },
  { value: 'menos', label: 'Menos frecuente' },
];

const METODO_LAVADO = [
  { value: 'shampoo-tradicional', label: 'Shampoo tradicional' },
  { value: 'low-poo', label: 'Low poo (sin sulfatos)' },
  { value: 'co-wash', label: 'Co-wash (solo acondicionador)' },
  { value: 'no-poo', label: 'No poo (sin shampoo)' },
  { value: 'no-sabe', label: 'No sabe' },
];

const PROBLEMAS = [
  'Frizz excesivo',
  'Resequedad / falta de hidratación',
  'Rizos poco definidos o sin forma',
  'Quiebre / puntas abiertas',
  'Caída excesiva',
  'Encogimiento (shrinkage) excesivo',
  'Nudos de hada (single strand knots)',
  'Cuero cabelludo sensible / irritado',
  'Caspa o dermatitis seborreica',
  'Grasa excesiva en raíz',
  'Daño por calor o químicos',
  'Transición capilar',
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <h3
      className="text-sm font-bold text-[#2D5A27] border-b border-[#E5E5E5] pb-2"
      style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
    >
      {title}
    </h3>
    {children}
  </div>
);

export default function StepHistorial({ data, onChange, errors }: Props) {
  return (
    <div className="flex flex-col gap-6 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
        >
          Historial capilar
        </h2>
        <p className="text-sm text-[#666666]">
          Cuéntame sobre la historia del cabello de tu clienta
        </p>
      </div>

      <Section title="Tratamientos químicos previos">
        <CheckboxGroup
          options={QUIMICOS}
          selected={data.quimicos}
          onChange={(v) => onChange({ quimicos: v })}
        />
        <Input
          label="Último tratamiento químico (cuál y fecha aproximada)"
          value={data.ultimoQuimico}
          onChange={(e) => onChange({ ultimoQuimico: e.target.value })}
          placeholder="Ej: Keratina hace 6 meses"
        />
      </Section>

      <Section title="Uso de calor">
        <CheckboxGroup
          options={USO_CALOR}
          selected={data.usoCalor}
          onChange={(v) => onChange({ usoCalor: v })}
          columns={2}
        />
        <Select
          label="Frecuencia de uso de calor"
          value={data.frecuenciaCalor}
          onChange={(e) => onChange({ frecuenciaCalor: e.target.value })}
          options={FRECUENCIA_CALOR}
          placeholder="Seleccionar..."
        />
        <Toggle
          label="¿Usa protector térmico?"
          checked={data.usaProtectorTermico}
          onChange={(v) => onChange({ usaProtectorTermico: v })}
        />
      </Section>

      <Section title="Rutina de lavado">
        <Select
          label="Frecuencia de lavado"
          value={data.frecuenciaLavado}
          onChange={(e) => onChange({ frecuenciaLavado: e.target.value })}
          options={FRECUENCIA_LAVADO}
          placeholder="Seleccionar..."
        />
        <Select
          label="Método de lavado"
          value={data.metodoLavado}
          onChange={(e) => onChange({ metodoLavado: e.target.value })}
          options={METODO_LAVADO}
          placeholder="Seleccionar..."
        />
      </Section>

      <Section title="Productos que usa actualmente">
        <div className="grid grid-cols-1 gap-3">
          {[
            { key: 'shampoo', label: 'Shampoo', placeholder: 'Marca o nombre' },
            { key: 'acondicionador', label: 'Acondicionador', placeholder: 'Marca o nombre' },
            { key: 'mascarilla', label: 'Mascarilla / tratamiento', placeholder: 'Marca o nombre' },
            { key: 'leaveIn', label: 'Leave-in / crema de peinar', placeholder: 'Marca o nombre' },
            { key: 'gel', label: 'Gel / mousse / definidor', placeholder: 'Marca o nombre' },
            { key: 'aceites', label: 'Aceites o serums', placeholder: 'Marca o nombre' },
          ].map(({ key, label, placeholder }) => (
            <Input
              key={key}
              label={label}
              value={(data.productosActuales as Record<string, string>)[key] || ''}
              onChange={(e) =>
                onChange({
                  productosActuales: {
                    ...data.productosActuales,
                    [key]: e.target.value,
                  },
                })
              }
              placeholder={placeholder}
            />
          ))}
        </div>
      </Section>

      <Section title="Problemas principales">
        <p className="text-xs text-[#999999]">Selecciona todos los que apliquen (mínimo 1)</p>
        <CheckboxGroup
          options={PROBLEMAS}
          selected={data.problemas}
          onChange={(v) => onChange({ problemas: v })}
        />
        {errors.problemas && (
          <p className="text-xs text-[#8E2D2D]">{errors.problemas}</p>
        )}
        <Input
          label="Otro problema (especificar)"
          value={data.otroProblema}
          onChange={(e) => onChange({ otroProblema: e.target.value })}
          placeholder="Describir..."
        />
      </Section>
    </div>
  );
}
