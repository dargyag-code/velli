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
  '1': { bg: '#F4F4F5', fg: '#111111' },
  '2': { bg: '#E4E4E7', fg: '#111111' },
  '3': { bg: '#111111', fg: '#FAFAFA' },
  '4': { bg: '#F4F4F5', fg: '#27272A' },
};

const sizeMap: Record<AvatarSize, number> = { sm: 34, md: 44, lg: 56, xl: 72 };

/** Auto-asigna tono editorial a partir del tipo de rizo si no se pasa explícito */
export function toneFromTipoRizo(tipoRizo?: string): AvatarTone {
  if (!tipoRizo) return '1';
  const g = tipoRizo[0];
  if (g === '1') return '1';
  if (g === '2') return '2';
  if (g === '3') return '3';
  if (g === '4') return '4';
  return '1';
}

export default function AvatarV2({ nombre, tone = '1', size = 'md', ring }: AvatarV2Props) {
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
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: dim * 0.4,
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 3px ${ring}, 0 0 0 4px #FFFFFF` : undefined,
      }}
    >
      {initials}
    </div>
  );
}
