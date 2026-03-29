'use client';
import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { WizardData } from '@/lib/types';
import { getAllClientas } from '@/lib/db';
import Input from '../ui/Input';
import Avatar from '../ui/Avatar';
import { Clienta } from '@/lib/types';

interface Props {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export default function StepClienta({ data, onChange, errors }: Props) {
  const [existingClientas, setExistingClientas] = useState<Clienta[]>([]);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    getAllClientas().then(setExistingClientas);
  }, []);

  const filtered = existingClientas.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const selectClienta = (c: Clienta) => {
    onChange({
      clientaId: c.id,
      nombre: c.nombre,
      edad: String(c.edad || ''),
      telefono: c.telefono || '',
      email: c.email || '',
    });
    setShowSearch(false);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-5 step-enter">
      <div>
        <h2
          className="text-lg font-bold text-[#2D2D2D] mb-1"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Datos de la clienta
        </h2>
        <p className="text-sm text-[#666666]">
          ¿Es una clienta existente o nueva?
        </p>
      </div>

      {/* Select existing */}
      {existingClientas.length > 0 && (
        <div className="bg-[#F3EDF9] rounded-2xl p-4">
          <p className="text-sm font-semibold text-[#5B2D8E] mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Clienta existente
          </p>
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-[#C4A0E8] text-sm text-[#666666] hover:border-[#5B2D8E] transition-colors"
          >
            <Search size={15} />
            <span>Buscar clienta...</span>
          </button>

          {showSearch && (
            <div className="mt-2">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre de la clienta..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#C4A0E8] bg-white text-sm mb-2"
              />
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {filtered.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectClienta(c)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F3EDF9] transition-colors text-left"
                  >
                    <Avatar nombre={c.nombre} tipoRizo={c.tipoRizoPrincipal} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-[#2D2D2D]">{c.nombre}</p>
                      {c.tipoRizoPrincipal && (
                        <p className="text-xs text-[#999999]">Rizo {c.tipoRizoPrincipal} • {c.totalVisitas} visitas</p>
                      )}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-[#999999] text-center py-2">No se encontraron clientas</p>
                )}
              </div>
            </div>
          )}

          {data.clientaId && (
            <div className="mt-2 flex items-center gap-2">
              <Avatar nombre={data.nombre} tipoRizo={undefined} size="sm" />
              <div>
                <p className="text-sm font-semibold text-[#5B2D8E]">{data.nombre}</p>
                <p className="text-xs text-[#999999]">Clienta seleccionada</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ clientaId: undefined, nombre: '', edad: '', telefono: '', email: '' })}
                className="ml-auto text-xs text-[#8E2D2D] underline"
              >
                Cambiar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E5E5E5]" />
        <span className="text-xs text-[#999999] font-medium">o nueva clienta</span>
        <div className="flex-1 h-px bg-[#E5E5E5]" />
      </div>

      {/* New client form */}
      <div className="flex flex-col gap-4">
        <Input
          label="Nombre completo"
          value={data.nombre}
          onChange={(e) => onChange({ nombre: e.target.value, clientaId: undefined })}
          placeholder="Ej: María González"
          required
          error={errors.nombre}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Edad"
            type="number"
            value={data.edad}
            onChange={(e) => onChange({ edad: e.target.value })}
            placeholder="25"
            min="1"
            max="120"
          />
          <Input
            label="Teléfono / WhatsApp"
            type="tel"
            value={data.telefono}
            onChange={(e) => onChange({ telefono: e.target.value })}
            placeholder="+57 300..."
            error={errors.telefono}
          />
        </div>
        <Input
          label="Correo electrónico"
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="maria@gmail.com (opcional)"
        />
      </div>
    </div>
  );
}
