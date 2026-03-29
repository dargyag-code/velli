import React from 'react';
import { getInitials } from '@/lib/utils';

interface AvatarProps {
  nombre: string;
  tipoRizo?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: { container: 'w-8 h-8 text-xs', text: 'text-xs' },
  md: { container: 'w-10 h-10 text-sm', text: 'text-sm' },
  lg: { container: 'w-14 h-14 text-xl', text: 'text-xl' },
  xl: { container: 'w-20 h-20 text-3xl', text: 'text-3xl' },
};

function getBgColor(tipoRizo?: string): string {
  if (!tipoRizo) return 'linear-gradient(135deg, #5B2D8E, #7B4DB0)';
  if (['2A', '2B', '2C'].includes(tipoRizo)) return 'linear-gradient(135deg, #3B82F6, #60A5FA)';
  if (['3A', '3B', '3C'].includes(tipoRizo)) return 'linear-gradient(135deg, #5B2D8E, #7B4DB0)';
  if (['4A', '4B', '4C'].includes(tipoRizo)) return 'linear-gradient(135deg, #C9A84C, #D4B56A)';
  return 'linear-gradient(135deg, #5B2D8E, #7B4DB0)';
}

export default function Avatar({ nombre, tipoRizo, size = 'md' }: AvatarProps) {
  const s = sizeMap[size];
  return (
    <div
      className={`${s.container} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}
      style={{ background: getBgColor(tipoRizo) }}
    >
      <span
        className={`${s.text} font-bold text-white`}
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {getInitials(nombre)}
      </span>
    </div>
  );
}
