'use client';
// ══════════════════════════════════════════════════════════════════════════
// Preguntas dinámicas del wizard, definidas como datos en la knowledge base
// (kb_flujos). Solo los flujos PUBLICADOS para el tipo de cabello
// seleccionado se renderizan — los borradores no afectan producción, así
// que el flujo de rizado actual sigue idéntico mientras no se publique
// nada que lo cubra. Las respuestas van a WizardData.perfilExtendido.
//
// Si la estilista marca una opción con bandera médica, se muestra el aviso
// de derivación: el evaluador convertirá el diagnóstico en derivación a
// dermatólogo (regla de seguridad en lib/kb/evaluador.ts).
// ══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen } from 'lucide-react';
import { cargarFlujoParaTipo } from '@/lib/kb/diagnostico';
import { FlujoKBRow, PreguntaFlujo } from '@/lib/kb/tipos';
import { vibracionSutil } from '@/lib/haptics';

interface Props {
  tipoCabello: string;
  valores: Record<string, unknown> | undefined;
  onChange: (perfilExtendido: Record<string, unknown>) => void;
}

function esOpcionMedica(pregunta: PreguntaFlujo, valor: unknown): boolean {
  if (!pregunta.opciones) return false;
  const valores = Array.isArray(valor) ? valor : [valor];
  return pregunta.opciones.some(
    (o) => o.banderaMedica && valores.includes(o.valor)
  );
}

export default function PreguntasFlujo({ tipoCabello, valores, onChange }: Props) {
  const [flujo, setFlujo] = useState<FlujoKBRow | null>(null);

  useEffect(() => {
    let activo = true;
    if (!tipoCabello) {
      setFlujo(null);
      return;
    }
    cargarFlujoParaTipo(tipoCabello).then((f) => {
      if (activo) setFlujo(f);
    });
    return () => {
      activo = false;
    };
  }, [tipoCabello]);

  if (!flujo) return null;

  const respuestas = valores ?? {};
  const setRespuesta = (clave: string, valor: unknown) => {
    onChange({ ...respuestas, [clave]: valor });
  };

  const hayBanderaMedica = flujo.definicion.preguntas.some((p) =>
    esOpcionMedica(p, respuestas[p.clave])
  );

  return (
    <section
      className="v-card"
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={14} style={{ color: 'var(--primary)' }} />
        <div>
          <div className="v-caps" style={{ color: 'var(--primary)' }}>
            {flujo.definicion.titulo}
          </div>
          {flujo.definicion.descripcion && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {flujo.definicion.descripcion}
            </p>
          )}
        </div>
      </div>

      {hayBanderaMedica && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--treat-recon-bg)',
            border: '1px solid rgba(212, 130, 10, 0.25)',
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--treat-recon-color)', lineHeight: 1.4 }}>
            <strong>Señal clínica detectada</strong> — el plan será una derivación a
            dermatólogo, no un tratamiento de salón.
          </p>
        </div>
      )}

      {flujo.definicion.preguntas.map((p) => (
        <Pregunta
          key={p.clave}
          pregunta={p}
          valor={respuestas[p.clave]}
          onSelect={(v) => setRespuesta(p.clave, v)}
        />
      ))}
    </section>
  );
}

function Pregunta({
  pregunta,
  valor,
  onSelect,
}: {
  pregunta: PreguntaFlujo;
  valor: unknown;
  onSelect: (v: unknown) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className="v-caps">
          {pregunta.etiqueta}
          {pregunta.opcional && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · opcional</span>
          )}
        </span>
      </div>
      {pregunta.ayuda && (
        <p style={{ margin: '0 0 6px', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
          {pregunta.ayuda}
        </p>
      )}
      {pregunta.tipo === 'texto' ? (
        <input
          type="text"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onSelect(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid var(--border)',
            outline: 'none',
            fontSize: 13,
            background: 'var(--bg-card)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-main)',
          }}
        />
      ) : pregunta.tipo === 'booleano' ? (
        <OpcionesChips
          opciones={[
            { valor: 'si', etiqueta: 'Sí' },
            { valor: 'no', etiqueta: 'No' },
          ]}
          seleccion={valor === true ? ['si'] : valor === false ? ['no'] : []}
          onToggle={(v) => onSelect(v === 'si')}
        />
      ) : (
        <OpcionesChips
          opciones={pregunta.opciones ?? []}
          seleccion={
            pregunta.tipo === 'multi'
              ? Array.isArray(valor)
                ? (valor as string[])
                : []
              : typeof valor === 'string'
                ? [valor]
                : []
          }
          onToggle={(v) => {
            if (pregunta.tipo === 'multi') {
              const actual = Array.isArray(valor) ? (valor as string[]) : [];
              onSelect(
                actual.includes(v) ? actual.filter((x) => x !== v) : [...actual, v]
              );
            } else {
              onSelect(valor === v ? '' : v);
            }
          }}
        />
      )}
    </div>
  );
}

function OpcionesChips({
  opciones,
  seleccion,
  onToggle,
}: {
  opciones: { valor: string; etiqueta: string; banderaMedica?: boolean }[];
  seleccion: string[];
  onToggle: (valor: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opciones.map((o) => {
        const on = seleccion.includes(o.valor);
        const medica = !!o.banderaMedica;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={on}
            onClick={() => {
              vibracionSutil();
              onToggle(o.valor);
            }}
            className="active:scale-95 transition-transform"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              background: on
                ? medica
                  ? 'var(--treat-recon-bg)'
                  : 'var(--primary-pale)'
                : 'var(--bg-card)',
              color: on
                ? medica
                  ? 'var(--treat-recon-color)'
                  : 'var(--primary)'
                : 'var(--text-secondary)',
              border: `1px solid ${
                on
                  ? medica
                    ? 'rgba(212, 130, 10, 0.4)'
                    : 'rgba(45, 90, 39, 0.3)'
                  : 'var(--border-soft)'
              }`,
              cursor: 'pointer',
            }}
          >
            {medica && <AlertTriangle size={10} />}
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
