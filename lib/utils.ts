import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function getRizoColor(tipo: string): string {
  if (['1A', '1B', '1C'].includes(tipo)) return 'bg-slate-400';
  if (['2A', '2B', '2C'].includes(tipo)) return 'bg-blue-500';
  if (['3A', '3B', '3C'].includes(tipo)) return 'bg-purple-600';
  if (['4A', '4B', '4C'].includes(tipo)) return 'bg-amber-500';
  return 'bg-gray-400';
}

export function getRizoColorHex(tipo: string): string {
  if (['1A', '1B', '1C'].includes(tipo)) return '#64748B';
  if (['2A', '2B', '2C'].includes(tipo)) return '#3B82F6';
  if (['3A', '3B', '3C'].includes(tipo)) return '#7C3AED';
  if (['4A', '4B', '4C'].includes(tipo)) return '#F59E0B';
  return '#9CA3AF';
}

export function getRizoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    '1A': 'Liso 1A',
    '1B': 'Liso 1B',
    '1C': 'Liso 1C',
    '2A': 'Ondulado 2A',
    '2B': 'Ondulado 2B',
    '2C': 'Ondulado 2C',
    '3A': 'Rizado 3A',
    '3B': 'Rizado 3B',
    '3C': 'Rizado 3C',
    '4A': 'Afro 4A',
    '4B': 'Afro 4B',
    '4C': 'Afro 4C',
  };
  return labels[tipo] || tipo;
}

export function getTratamientoColor(tratamiento: string): string {
  const t = tratamiento.toLowerCase();
  if (t.includes('hidratac')) return 'bg-blue-100 text-blue-700 border-blue-300';
  if (t.includes('nutrici')) return 'bg-green-100 text-green-700 border-green-300';
  if (t.includes('reconstru') || t.includes('proteína')) return 'bg-orange-100 text-orange-700 border-orange-300';
  if (t.includes('mantenimiento')) return 'bg-purple-100 text-purple-700 border-purple-300';
  return 'bg-gray-100 text-gray-700 border-gray-300';
}

export function getTratamientoBg(tratamiento: string): string {
  const t = tratamiento.toLowerCase();
  if (t.includes('hidratac')) return '#E8F4FD';
  if (t.includes('nutrici')) return '#EEF5ED';
  if (t.includes('reconstru') || t.includes('proteína') || t.includes('proteina')) return '#FFF3E0';
  if (t.includes('repolariz')) return '#F3EDF9';
  if (t.includes('mantenimiento')) return '#F5F5F5';
  return '#F5F5F5';
}

export function getTratamientoTextColor(tratamiento: string): string {
  const t = tratamiento.toLowerCase();
  if (t.includes('hidratac')) return '#1A5276';
  if (t.includes('nutrici')) return '#2D5A27';
  if (t.includes('reconstru') || t.includes('proteína') || t.includes('proteina')) return '#D4820A';
  if (t.includes('repolariz')) return '#6B3FA0';
  if (t.includes('mantenimiento')) return '#6B6560';
  return '#6B6560';
}

export function getTratamientoBorderColor(tratamiento: string): string {
  const t = tratamiento.toLowerCase();
  if (t.includes('hidratac')) return '#1A5276';
  if (t.includes('nutrici')) return '#2D5A27';
  if (t.includes('reconstru') || t.includes('proteína') || t.includes('proteina')) return '#D4820A';
  if (t.includes('repolariz')) return '#6B3FA0';
  return '#6B6560';
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function addWeeks(dateStr: string, weeks: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().split('T')[0];
}
