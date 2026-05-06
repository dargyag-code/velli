import React from 'react';
import { getInitials } from '@/lib/utils';

export type AvatarTone = '1' | '2' | '3' | '4';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarV2Props {
  nombre: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  ring?: string;
}

const toneMap: Record<AvatarTone, { bg: string; fg: string }> = {
  '1': { bg: '#F0EBDF', fg: '#5C544A' },
  '2': { bg: '#E2F0E6', fg: '#1F3D24' },
  '3': { bg: '#EEF5ED', fg: '#2D5A27' },
  '4': { bg: '#FBF4EC', fg: '#8A5A2E' },
};

const sizeMap: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 56, xl: 72 };

/** Auto-asigna tono editorial a partir del tipo de rizo si no se pasa explícito */
export function toneFromTipoRizo(tipoRizo?: string): AvatarTone {
  if (!tipoRizo) return '3';
  const g = tipoRizo[0];
  if (g === '1') return '1';
  if (g === '2') return '2';
  if (g === '3') return '3';
  if (g === '4') return '4';
  return '3';
}

export default function AvatarV2({ nombre, tone = '3', size = 'md', ring }: AvatarV2Props) {
  const c = toneMap[tone];
  const dim = sizeMap[size];
  const initials = nombre ? getInitials(nombre) : '?';
  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        background: c.bg,
        color: c.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-serif)',
        fontSize: dim * 0.42,
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 3px ${ring}, 0 0 0 4px var(--bg-card)` : undefined,
      }}
    >
      {initials}
    </div>
  );
}
