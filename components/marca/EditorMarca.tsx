'use client';
import React from 'react';
import { ImagePlus, X } from 'lucide-react';
import { showToast } from '@/lib/toast';

// ─── Editor de marca del salón (solo logo) ─────────────────────────────────
// Compartido entre el paso 2 del onboarding y Configuración → "Tu marca".
// Desde 2026-10-24 el salón solo personaliza su logotipo: el color de acento
// es siempre la paleta oficial de Velli Business Intelligence (COLOR_VELLI).
// Presentacional: el padre decide cuándo subir el logo y persistir el perfil.

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

interface Props {
  /** dataURL pendiente de subir o URL ya guardada; null = sin logo. */
  logoSrc: string | null;
  /** dataURL al elegir archivo; null al quitar el logo. */
  onLogo: (dataUrl: string | null) => void;
  /** Para el texto de vista previa. */
  nombreSalon?: string;
}

export default function EditorMarca({ logoSrc, onLogo, nombreSalon }: Props) {
  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('El logo debe ser una imagen', 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast('El logo no puede pesar más de 3 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <LabelMarca>Tu logo (opcional)</LabelMarca>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              border: '1.5px dashed var(--border-strong)',
              background: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt="Logo del salón"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ImagePlus size={22} style={{ color: 'var(--text-tertiary)' }} />
            )}
            <input type="file" accept="image/*" onChange={onLogoFile} style={{ display: 'none' }} />
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Toca el recuadro para {logoSrc ? 'cambiar tu logo' : 'subir tu logo'}. Sin logo,
              tus PDF salen con la marca Velli{nombreSalon ? ` y el nombre ${nombreSalon}` : ''}.
            </p>
            {logoSrc && (
              <button
                type="button"
                onClick={() => onLogo(null)}
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--warning)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <X size={12} /> Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
        Tus PDF y cotizaciones usan la paleta oficial de Velli Business Intelligence.
      </p>
    </div>
  );
}

function LabelMarca({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 12,
        color: 'var(--text-tertiary)',
        marginBottom: 8,
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
      }}
    >
      {children}
    </span>
  );
}
