'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Store, UserPlus, Sparkles, FileDown, Check, ChevronRight, X } from 'lucide-react';
import { updateProfile, type Profile } from '@/lib/profile';

// ─── Checklist de inicio del Dashboard ──────────────────────────────────────
// Tarjeta persistente para cuentas nuevas: 4 ítems que se marcan solos al
// cumplirse, cada uno enlaza directo a su acción. Desaparece DEFINITIVAMENTE
// (flag checklist_descartada en el perfil) al completarse los 4 o al
// descartarla con la X. Las cuentas existentes nunca la ven: la migración
// las backfillea con checklist_descartada = true.

interface Props {
  profile: Profile;
  tieneClientas: boolean;
  tieneConsultas: boolean;
  /** El padre la oculta de inmediato al descartar. */
  onDismissed: () => void;
}

export default function ChecklistInicio({ profile, tieneClientas, tieneConsultas, onDismissed }: Props) {
  const [dismissing, setDismissing] = useState(false);
  const persistedRef = useRef(false);

  const perfilCompleto = !!(profile.nombreSalon && profile.ciudad && profile.telefono);

  const items = [
    {
      done: perfilCompleto,
      icon: <Store size={15} />,
      titulo: 'Completa el perfil de tu salón',
      sub: 'Nombre, ciudad y WhatsApp para tus PDF',
      href: '/configuracion',
    },
    {
      done: tieneClientas,
      icon: <UserPlus size={15} />,
      titulo: 'Crea tu primera clienta',
      sub: 'Su ficha guarda historia y salud capilar',
      href: '/clientas/nueva',
    },
    {
      done: tieneConsultas,
      icon: <Sparkles size={15} />,
      titulo: 'Haz tu primer diagnóstico',
      sub: 'Con IA o wizard manual, en minutos',
      href: '/diagnostico',
    },
    {
      done: profile.primerPdfDescargado,
      icon: <FileDown size={15} />,
      titulo: 'Descarga tu primer PDF',
      sub: 'El informe que entregas a tu clienta',
      href: tieneConsultas ? '/clientas' : '/diagnostico',
    },
  ];

  const hechos = items.filter((i) => i.done).length;
  const completa = hechos === items.length;

  // Al completarse los 4, persistir el flag una sola vez: la tarjeta celebra
  // esta sesión y no vuelve a aparecer.
  useEffect(() => {
    if (completa && !persistedRef.current) {
      persistedRef.current = true;
      updateProfile({ checklistDescartada: true }).catch(() => {
        persistedRef.current = false;
      });
    }
  }, [completa]);

  const descartar = async () => {
    if (dismissing) return;
    setDismissing(true);
    try {
      await updateProfile({ checklistDescartada: true });
    } catch (e) {
      console.error('[checklist.dismiss]', e);
    }
    // Aunque el guardado falle (sin red), ocultarla esta sesión.
    onDismissed();
  };

  return (
    <section
      className="v-card"
      style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}
      aria-label="Checklist de inicio"
    >
      <div
        style={{
          padding: '14px 16px 12px',
          background: completa
            ? 'linear-gradient(135deg, #EEF5ED, #F5EDDC)'
            : 'linear-gradient(135deg, #FBF4EC 0%, #F5EDDC 100%)',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
            {completa ? '¡Todo listo!' : 'Empieza aquí'} · {hechos} de {items.length}
          </span>
          <h2
            style={{
              margin: '3px 0 0',
              fontFamily: 'var(--font-serif)',
              fontSize: 20,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'var(--primary-deep)',
            }}
          >
            {completa ? (
              <>Tu salón ya está <em style={{ color: 'var(--secondary-deep)' }}>andando</em></>
            ) : (
              <>Tu salón, <em style={{ color: 'var(--secondary-deep)' }}>en marcha</em></>
            )}
          </h2>
        </div>
        <button
          type="button"
          onClick={descartar}
          aria-label="Descartar checklist"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1px solid var(--border-soft)',
            background: 'rgba(255,255,255,0.6)',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Barra de progreso fina */}
      <div style={{ height: 3, background: 'var(--border-soft)' }}>
        <div
          style={{
            height: '100%',
            width: `${(hechos / items.length) * 100}%`,
            background: 'var(--primary)',
            transition: 'width 300ms ease',
          }}
        />
      </div>

      {items.map((item) => (
        <Link
          key={item.titulo}
          href={item.href}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            borderBottom: '1px solid var(--border-soft)',
            textDecoration: 'none',
            opacity: item.done ? 0.62 : 1,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: item.done ? '#EEF5ED' : 'var(--secondary-pale)',
              color: item.done ? 'var(--primary)' : 'var(--secondary-deep)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {item.done ? <Check size={15} /> : item.icon}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-main)',
                fontFamily: 'var(--font-sans)',
                textDecoration: item.done ? 'line-through' : 'none',
                textDecorationColor: 'var(--text-tertiary)',
                lineHeight: 1.2,
              }}
            >
              {item.titulo}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {item.sub}
            </span>
          </span>
          {!item.done && <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        </Link>
      ))}
    </section>
  );
}
