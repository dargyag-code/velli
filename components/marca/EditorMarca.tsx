'use client';
import React from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import { COLOR_VELLI } from '@/lib/profile';
import { showToast } from '@/lib/toast';

// ─── Editor de marca del salón (logo + color principal) ─────────────────────
// Compartido entre el paso 2 del onboarding y Configuración → "Tu marca":
// la marca se configura una vez en el wizard pero se puede ver y cambiar en
// cualquier momento sin repetir la bienvenida. Presentacional: el padre
// decide cuándo subir el logo y persistir el perfil.

export const COLORES_MARCA = [
  { hex: COLOR_VELLI, nombre: 'Verde Velli' },
  { hex: '#8A5A2E', nombre: 'Dorado' },
  { hex: '#B23A3A', nombre: 'Terracota' },
  { hex: '#1A5276', nombre: 'Azul profundo' },
  { hex: '#6B3FA0', nombre: 'Violeta' },
  { hex: '#14241A', nombre: 'Bosque noche' },
];

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

interface Props {
  /** dataURL pendiente de subir o URL ya guardada; null = sin logo. */
  logoSrc: string | null;
  /** dataURL al elegir archivo; null al quitar el logo. */
  onLogo: (dataUrl: string | null) => void;
  color: string;
  onColor: (hex: string) => void;
  /** Para la franja de vista previa del acento. */
  nombreSalon?: string;
}

export default function EditorMarca({ logoSrc, onLogo, color, onColor, nombreSalon }: Props) {
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
              tus PDF salen con la marca Velli.
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
                  color: '#B23A3A',
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

      <div>
        <LabelMarca>Color principal</LabelMarca>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {COLORES_MARCA.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => onColor(c.hex)}
              aria-label={c.nombre}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: c.hex,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  color.toLowerCase() === c.hex.toLowerCase()
                    ? '0 0 0 2px var(--bg-card), 0 0 0 4px var(--primary)'
                    : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              }}
            >
              {color.toLowerCase() === c.hex.toLowerCase() && <Check size={16} color="#fff" />}
            </button>
          ))}
          <label
            aria-label="Color personalizado"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'conic-gradient(#B23A3A, #D8A878, #4A8C42, #1A5276, #6B3FA0, #B23A3A)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: !COLORES_MARCA.some((c) => c.hex.toLowerCase() === color.toLowerCase())
                ? '0 0 0 2px var(--bg-card), 0 0 0 4px var(--primary)'
                : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => onColor(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
          </label>
        </div>
        <div
          style={{
            marginTop: 14,
            borderRadius: 12,
            padding: '12px 14px',
            background: color,
            color: '#fff',
            fontFamily: 'var(--font-serif)',
            fontSize: 14,
          }}
        >
          Así se verá el acento de tus PDF{nombreSalon ? ` · ${nombreSalon}` : ''}
        </div>
      </div>
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
