'use client';
import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Clienta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';
import Avatar from '../ui/Avatar';

interface ClientaCardProps {
  clienta: Clienta;
  ultimoTratamiento?: string;
}

const rizoColors: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: '#F5F5F5', text: '#6B6560', border: '#DDDDDD' },
  '2': { bg: '#E8F4FD', text: '#1A5276', border: '#BDD9EE' },
  '3': { bg: '#EEF5ED', text: '#2D5A27', border: '#90B98A' },
  '4': { bg: '#FBF4EC', text: '#9A6A3A', border: '#D4A882' },
};

function getRizoColors(tipo?: string) {
  if (!tipo) return rizoColors['3'];
  return rizoColors[tipo[0]] ?? rizoColors['3'];
}

function getHealthDots(tratamiento?: string): { green: number; tooltip: string } {
  if (!tratamiento) return { green: 0, tooltip: 'Sin diagnóstico' };
  const t = tratamiento.toLowerCase();
  if (t.includes('mantenimiento') || t.includes('equilibrado')) {
    return { green: 3, tooltip: 'Cabello sano' };
  }
  if (t.includes('hidratacion') || t.includes('hidratación') || t.includes('nutricion') || t.includes('nutrición')) {
    return { green: 2, tooltip: 'Necesita atención' };
  }
  if (t.includes('reconstruccion') || t.includes('reconstrucción') || t.includes('repolarizacion') || t.includes('repolarización')) {
    return { green: 1, tooltip: 'Tratamiento urgente' };
  }
  return { green: 0, tooltip: 'Sin diagnóstico' };
}

export default function ClientaCard({ clienta, ultimoTratamiento }: ClientaCardProps) {
  const rizoType = clienta.tipoRizoPrincipal;
  const colors = getRizoColors(rizoType);
  const { green: greenDots, tooltip: dotsTooltip } = getHealthDots(ultimoTratamiento);

  return (
    <Link href={`/clientas/${clienta.id}`} className="stagger-item block">
      <div
        className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-[#E5E5E5] card-hover"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}
      >
        <Avatar nombre={clienta.nombre} tipoRizo={clienta.tipoRizoPrincipal} size="md" />

        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-[#2D2D2D] text-sm truncate"
            style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
          >
            {clienta.nombre}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {rizoType && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  borderColor: colors.border,
                  fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                }}
              >
                {getRizoLabel(rizoType)}
              </span>
            )}
            <span
              className="flex items-center gap-[3px]"
              title={dotsTooltip}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: i < greenDots ? '#2D8E5B' : '#DDDDDD',
                  }}
                />
              ))}
            </span>
            {clienta.ultimaVisita && (
              <span className="text-[10px] text-[#AAAAAA]">
                {formatDate(clienta.ultimaVisita)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {clienta.totalVisitas > 0 && (
            <span
              className="text-[10px] font-bold bg-[#EEF5ED] text-[#2D5A27] px-2 py-0.5 rounded-full"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              {clienta.totalVisitas}×
            </span>
          )}
          <ChevronRight size={15} className="text-[#CCCCCC]" />
        </div>
      </div>
    </Link>
  );
}
