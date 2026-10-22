// ══════════════════════════════════════════════════════════════════════════
// Siluetas vectoriales PROPIAS — 7 formas de rostro + esquema geométrico por
// corte.
//
// Decisión de la validación técnica (respuesta 4, con peso jurídico): la app NO consume
// imágenes extraídas de buscadores de internet. Estas siluetas son
// geometría dibujada aquí mismo (paths SVG escritos a mano), sin fuente
// externa, sin dependencias y sin derechos de terceros.
//
// Son PLACEHOLDER estructural: los resultados fotográficos reales se
// poblarán del historial de antes y después de cada salón, y ese registro
// pasa por evaluarCamara() con el consentimiento de imágenes.
// ══════════════════════════════════════════════════════════════════════════

import React from 'react';
import type { FormaRostro, LargoCorte, CapasCorte } from '@/lib/cortes/tipos';

// ── Formas de rostro ──────────────────────────────────────────────────────
// Cada path describe el contorno con las cuatro referencias de la Entrega 5
// §3: ancho de frente, ancho de pómulos, ancho de mandíbula y proporción
// largo/ancho. Trazadas sobre un lienzo de 100×130.

const CONTORNOS: Record<FormaRostro, string> = {
  // Largo ≈ 1,5 × ancho, contornos suaves.
  ovalado:
    'M50 8 C70 8 82 26 82 52 C82 84 68 118 50 122 C32 118 18 84 18 52 C18 26 30 8 50 8 Z',
  // Largo ≈ ancho, pómulos como punto más ancho.
  redondo:
    'M50 12 C74 12 86 32 86 60 C86 92 70 116 50 118 C30 116 14 92 14 60 C14 32 26 12 50 12 Z',
  // Frente, pómulos y mandíbula de ancho similar; ángulo marcado.
  cuadrado:
    'M20 14 L80 14 C83 14 84 16 84 20 L84 92 C84 108 70 118 50 120 C30 118 16 108 16 92 L16 20 C16 16 17 14 20 14 Z',
  // Frente y pómulos anchos, mentón estrecho.
  corazon:
    'M18 22 C24 12 76 12 82 22 C84 44 80 74 66 98 C60 110 55 118 50 121 C45 118 40 110 34 98 C20 74 16 44 18 22 Z',
  // Largo claramente mayor que el ancho, frente alta.
  alargado:
    'M50 4 C68 4 78 20 78 46 C78 86 66 122 50 126 C34 122 22 86 22 46 C22 20 32 4 50 4 Z',
  // Pómulos como punto más ancho; frente y mentón estrechos.
  diamante:
    'M50 8 C62 12 74 30 84 62 C74 94 62 116 50 122 C38 116 26 94 16 62 C26 30 38 12 50 8 Z',
  // Mandíbula más ancha que la frente.
  triangulo:
    'M34 14 C44 10 56 10 66 14 C72 38 80 70 86 96 C82 112 66 120 50 121 C34 120 18 112 14 96 C20 70 28 38 34 14 Z',
};

export function SiluetaRostro({
  forma, size = 72, activa = false,
}: {
  forma: FormaRostro;
  size?: number;
  activa?: boolean;
}) {
  const trazo = activa ? 'var(--primary)' : 'var(--border-strong)';
  const relleno = activa ? 'var(--primary-pale)' : 'transparent';
  return (
    <svg
      width={size}
      height={(size * 130) / 100}
      viewBox="0 0 100 130"
      role="img"
      aria-label={`Silueta de rostro ${forma}`}
      style={{ display: 'block' }}
    >
      <path d={CONTORNOS[forma]} fill={relleno} stroke={trazo} strokeWidth={2.5} />
      {/* Referencias de proporción: frente, pómulos y mandíbula. */}
      <g stroke={trazo} strokeWidth={0.9} opacity={0.35} strokeDasharray="3 3">
        <line x1="10" y1="34" x2="90" y2="34" />
        <line x1="10" y1="62" x2="90" y2="62" />
        <line x1="10" y1="94" x2="90" y2="94" />
      </g>
    </svg>
  );
}

// ── Esquema geométrico por corte ──────────────────────────────────────────
// No dibuja "un peinado": representa la ARQUITECTURA del corte — hasta dónde
// baja el largo y cómo se reparte la masa. Es exactamente lo que la matriz
// razona (línea de término + dónde vive el volumen).

const ALTURA_LARGO: Record<LargoCorte, number> = {
  muy_corto: 46,
  corto: 68,
  medio: 88,
  largo: 108,
  muy_largo: 124,
};

const CAPAS_LINEAS: Record<CapasCorte, number> = {
  sin_capas: 0,
  minimas: 1,
  moderadas: 3,
  abundantes: 5,
};

export function EsquemaCorte({
  largo, capas, size = 84, destacado = false,
}: {
  largo: LargoCorte;
  capas: CapasCorte;
  size?: number;
  destacado?: boolean;
}) {
  const yFinal = ALTURA_LARGO[largo];
  const nLineas = CAPAS_LINEAS[capas];
  const trazo = destacado ? 'var(--primary)' : 'var(--text-tertiary)';
  const masa = destacado ? 'var(--primary-pale)' : 'var(--bg)';

  // Silueta de la masa de cabello: cae desde la coronilla hasta la línea de
  // término, ensanchándose según cuánto peso conserva el corte.
  const ancho = capas === 'abundantes' ? 40 : capas === 'moderadas' ? 36 : 32;
  const masaPath = `M${50 - 22} 26 C${50 - ancho} 44 ${50 - ancho} ${yFinal - 18} ${50 - ancho + 4} ${yFinal} L${50 + ancho - 4} ${yFinal} C${50 + ancho} ${yFinal - 18} ${50 + ancho} 44 ${50 + 22} 26 Z`;

  return (
    <svg
      width={size}
      height={(size * 140) / 100}
      viewBox="0 0 100 140"
      role="img"
      aria-label={`Esquema geométrico: largo ${largo}, capas ${capas}`}
      style={{ display: 'block' }}
    >
      {/* Cabeza de referencia */}
      <circle cx="50" cy="26" r="20" fill="none" stroke={trazo} strokeWidth={1.6} opacity={0.5} />
      {/* Masa de cabello */}
      <path d={masaPath} fill={masa} stroke={trazo} strokeWidth={2} strokeLinejoin="round" />
      {/* Línea de término */}
      <line
        x1={50 - ancho - 6} y1={yFinal} x2={50 + ancho + 6} y2={yFinal}
        stroke={trazo} strokeWidth={2.2} strokeLinecap="round"
      />
      {/* Capas: diagonales que indican dónde arranca cada piso */}
      {Array.from({ length: nLineas }).map((_, i) => {
        const y = 46 + ((yFinal - 52) / (nLineas + 1)) * (i + 1);
        return (
          <g key={i} stroke={trazo} strokeWidth={1.2} opacity={0.6}>
            <line x1={50 - ancho + 3} y1={y} x2={50 - 8} y2={y + 6} />
            <line x1={50 + ancho - 3} y1={y} x2={50 + 8} y2={y + 6} />
          </g>
        );
      })}
    </svg>
  );
}
