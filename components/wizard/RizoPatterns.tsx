import React from 'react';

// SVG patterns for each curl type
const patterns: Record<string, React.ReactNode> = {
  '1A': (
    <svg viewBox="0 0 80 40" fill="none" className="w-16 h-8">
      <line x1="5" y1="20" x2="75" y2="20" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  '1B': (
    <svg viewBox="0 0 80 40" fill="none" className="w-16 h-8">
      <path
        d="M5 20 Q25 17 40 20 Q55 23 75 20"
        stroke="#64748B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '1C': (
    <svg viewBox="0 0 80 40" fill="none" className="w-16 h-8">
      <path
        d="M5 19 Q20 17 35 20 Q50 24 65 20 Q72 18 75 21"
        stroke="#64748B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '2A': (
    <svg viewBox="0 0 80 40" fill="none" className="w-16 h-8">
      <path
        d="M5 20 Q20 14 35 20 Q50 26 65 20 Q72 17 75 20"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '2B': (
    <svg viewBox="0 0 80 40" fill="none" className="w-16 h-8">
      <path
        d="M5 25 Q15 10 30 20 Q45 30 60 15 Q68 10 75 15"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '2C': (
    <svg viewBox="0 0 80 40" fill="none" className="w-16 h-8">
      <path
        d="M5 28 Q12 8 25 20 Q38 32 50 12 Q60 5 68 18 Q73 25 75 18"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '3A': (
    <svg viewBox="0 0 80 50" fill="none" className="w-16 h-10">
      <path
        d="M10 8 Q30 8 30 25 Q30 42 10 42 Q15 42 20 35 Q25 28 25 20 Q25 12 15 10"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M45 8 Q65 8 65 25 Q65 42 45 42 Q50 42 55 35 Q60 28 60 20 Q60 12 50 10"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '3B': (
    <svg viewBox="0 0 80 50" fill="none" className="w-16 h-10">
      <path
        d="M12 6 Q26 6 26 20 Q26 34 12 34 Q16 34 20 28 Q22 22 22 16 Q22 10 16 8"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 6 Q54 6 54 20 Q54 34 40 34 Q44 34 48 28 Q50 22 50 16 Q50 10 44 8"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '3C': (
    <svg viewBox="0 0 80 50" fill="none" className="w-16 h-10">
      <path
        d="M14 5 Q23 5 23 14 Q23 23 14 23 Q23 23 23 32 Q23 41 14 41"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M38 5 Q47 5 47 14 Q47 23 38 23 Q47 23 47 32 Q47 41 38 41"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M62 5 Q71 5 71 14 Q71 23 62 23 Q71 23 71 32 Q71 41 62 41"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '4A': (
    <svg viewBox="0 0 80 50" fill="none" className="w-16 h-10">
      <path
        d="M10 10 Q20 5 20 15 Q20 25 10 25 Q20 25 20 35 Q20 45 10 45"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M35 10 Q45 5 45 15 Q45 25 35 25 Q45 25 45 35 Q45 45 35 45"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 10 Q70 5 70 15 Q70 25 60 25 Q70 25 70 35 Q70 45 60 45"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  '4B': (
    <svg viewBox="0 0 80 50" fill="none" className="w-16 h-10">
      <polyline
        points="8,10 18,5 18,20 28,15 28,30 18,25 18,40 8,35"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="40,10 50,5 50,20 60,15 60,30 50,25 50,40 40,35"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  '4C': (
    <svg viewBox="0 0 80 50" fill="none" className="w-16 h-10">
      <polyline
        points="5,10 12,5 12,15 19,10 19,20 12,15 12,25 19,20 19,30 12,25 12,35 5,30"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="30,10 37,5 37,15 44,10 44,20 37,15 37,25 44,20 44,30 37,25 37,35 30,30"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="55,10 62,5 62,15 69,10 69,20 62,15 62,25 69,20 69,30 62,25 62,35 55,30"
        stroke="#C9956B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
};

export const rizoTypes = [
  {
    group: 'LISO',
    groupColor: '#64748B',
    types: [
      { id: '1A', desc: 'Completamente liso, sin cuerpo' },
      { id: '1B', desc: 'Liso con leve cuerpo y volumen' },
      { id: '1C', desc: 'Liso con ondulación sutil en las puntas' },
    ],
  },
  {
    group: 'ONDULADO',
    groupColor: '#3B82F6',
    types: [
      { id: '2A', desc: 'Ondas muy suaves en S, apenas curvas' },
      { id: '2B', desc: 'Ondas marcadas en S más pronunciadas' },
      { id: '2C', desc: 'Ondas amplias con algo de volumen' },
    ],
  },
  {
    group: 'RIZADO',
    groupColor: '#7C3AED',
    types: [
      { id: '3A', desc: 'Espiral suelta, diámetro de tiza gruesa' },
      { id: '3B', desc: 'Espiral media, diámetro de marcador' },
      { id: '3C', desc: 'Espiral apretada, diámetro de lápiz' },
    ],
  },
  {
    group: 'AFRO',
    groupColor: '#C9956B',
    types: [
      { id: '4A', desc: 'Espiral muy apretada en forma de S pequeña' },
      { id: '4B', desc: 'Zigzag apretado, patrón en Z' },
      { id: '4C', desc: 'Zigzag muy cerrado, casi sin definición' },
    ],
  },
];

export function RizoPattern({ tipo }: { tipo: string }) {
  return patterns[tipo] || null;
}
