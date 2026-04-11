'use client';
import React, { useState, useEffect } from 'react';
import { Search, Check, X } from 'lucide-react';
import { WizardData, Clienta } from '@/lib/types';
import { getAllClientas } from '@/lib/db';
import Avatar from '../ui/Avatar';
import { vibracionSutil } from '@/lib/haptics';

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export default function PasoClienta({ data, onChange, errors }: Props) {
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'search' | 'new'>(data.clientaId ? 'search' : 'new');
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    getAllClientas().then(setClientas);
  }, []);

  const filtered = clientas.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const selectClienta = (c: Clienta) => {
    vibracionSutil();
    onChange({
      clientaId: c.id,
      nombre: c.nombre,
      telefono: c.telefono || '',
      edad: String(c.edad || ''),
      email: c.email || '',
    });
    setShowList(false);
    setSearch('');
  };

  const clearClienta = () => {
    vibracionSutil();
    onChange({ clientaId: undefined, nombre: '', telefono: '', edad: '', email: '' });
  };

  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  return (
    <div className="flex flex-col gap-5 step-enter">
      <div>
        <h2 className="text-lg font-bold text-[#2D2D2D] mb-1" style={serif}>
          La clienta
        </h2>
        <p className="text-xs text-[#999999]">Paso rápido — máximo 30 segundos</p>
      </div>

      {/* Clienta ya seleccionada */}
      {data.clientaId && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#EEF5ED] rounded-2xl border-2 border-[#2D5A27]">
          <Avatar nombre={data.nombre} tipoRizo={undefined} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#2D5A27] truncate" style={serif}>{data.nombre}</p>
            {data.telefono && <p className="text-xs text-[#7A9B76]">{data.telefono}</p>}
          </div>
          <button
            type="button"
            onClick={clearClienta}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#999] hover:text-[#8E2D2D] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Buscar existente */}
      {!data.clientaId && clientas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#2D5A27] mb-2" style={serif}>
            Clienta existente
          </p>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search size={15} className="text-[#999]" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowList(true); }}
              onFocus={() => setShowList(true)}
              placeholder="Buscar por nombre..."
              className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm focus:border-[#2D5A27] focus:outline-none transition-colors"
            />
          </div>

          {showList && (search || filtered.length > 0) && (
            <div className="mt-2 bg-white rounded-2xl border border-[#E5E5E5] shadow-lg overflow-hidden max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-[#999] text-center py-4">No se encontraron clientas</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectClienta(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5FAF4] transition-colors text-left border-b border-[#F0F0F0] last:border-0"
                  >
                    <Avatar nombre={c.nombre} tipoRizo={c.tipoRizoPrincipal} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2D2D2D] truncate">{c.nombre}</p>
                      <p className="text-xs text-[#999]">
                        {c.tipoRizoPrincipal ? `Rizo ${c.tipoRizoPrincipal} · ` : ''}
                        {c.totalVisitas} visita{c.totalVisitas !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Check size={14} className="text-[#2D5A27] opacity-0 group-hover:opacity-100" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Separador */}
      {!data.clientaId && clientas.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E5E5E5]" />
          <span className="text-xs text-[#AAAAAA] font-medium">o nueva clienta</span>
          <div className="flex-1 h-px bg-[#E5E5E5]" />
        </div>
      )}

      {/* Formulario nueva clienta */}
      {!data.clientaId && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-[#2D2D2D] block mb-1.5" style={serif}>
              Nombre <span className="text-[#8E2D2D]">*</span>
            </label>
            <input
              type="text"
              value={data.nombre}
              onChange={(e) => onChange({ nombre: e.target.value })}
              placeholder="Ej: María González"
              className={`w-full px-4 py-3 rounded-2xl border-2 text-sm transition-colors focus:outline-none ${
                errors.nombre
                  ? 'border-[#8E2D2D] bg-red-50'
                  : 'border-[#E5E5E5] bg-white focus:border-[#2D5A27]'
              }`}
            />
            {errors.nombre && (
              <p className="text-xs text-[#8E2D2D] mt-1">{errors.nombre}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2D2D2D] block mb-1.5" style={serif}>
              Teléfono / WhatsApp
              <span className="text-[#AAAAAA] font-normal ml-1">(opcional)</span>
            </label>
            <input
              type="tel"
              value={data.telefono}
              onChange={(e) => onChange({ telefono: e.target.value })}
              placeholder="+57 300..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm focus:border-[#2D5A27] focus:outline-none transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}
