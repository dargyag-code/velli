'use client';
import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Clienta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

interface ClientaCardProps {
  clienta: Clienta;
}

export default function ClientaCard({ clienta }: ClientaCardProps) {
  const rizoType = clienta.tipoRizoPrincipal;
  const badgeVariant = rizoType
    ? ['2A', '2B', '2C'].includes(rizoType)
      ? 'blue'
      : ['3A', '3B', '3C'].includes(rizoType)
      ? 'purple'
      : 'gold'
    : 'gray';

  return (
    <Link href={`/clientas/${clienta.id}`}>
      <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-[#E5E5E5] hover:border-[#90B98A] hover:shadow-sm transition-all duration-200 card-hover">
        <Avatar nombre={clienta.nombre} tipoRizo={clienta.tipoRizoPrincipal} size="md" />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-[#2D2D2D] text-sm truncate"
            style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
          >
            {clienta.nombre}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {rizoType && (
              <Badge variant={badgeVariant as 'blue' | 'purple' | 'gold' | 'gray'}>
                {getRizoLabel(rizoType)}
              </Badge>
            )}
            {clienta.ultimaVisita && (
              <span className="text-xs text-[#999999]">
                {formatDate(clienta.ultimaVisita)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {clienta.totalVisitas > 0 && (
            <span
              className="text-xs font-bold bg-[#EEF5ED] text-[#2D5A27] px-2 py-0.5 rounded-full"
              style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
            >
              {clienta.totalVisitas} {clienta.totalVisitas === 1 ? 'visita' : 'visitas'}
            </span>
          )}
          <ChevronRight size={16} className="text-[#CCCCCC]" />
        </div>
      </div>
    </Link>
  );
}
