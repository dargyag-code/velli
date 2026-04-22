'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/Header';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { createClienta } from '@/lib/db';
import { Clienta } from '@/lib/types';
import { generateId, todayISO } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';

export default function NuevaClientaPage() {
  const router = useRouter();
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  // Datos de salud
  const [nivelEstres, setNivelEstres] = useState<'bajo' | 'medio' | 'alto' | ''>('');
  const [embarazo, setEmbarazo] = useState(false);
  const [alergias, setAlergias] = useState('');
  const [condicionesMedicas, setCondicionesMedicas] = useState('');
  const [medicamentos, setMedicamentos] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return; }
    setError('');
    setSaving(true);
    try {
      const nueva: Clienta = {
        id: generateId(),
        nombre: nombre.trim(),
        edad: parseInt(edad) || 0,
        telefono,
        email: email || undefined,
        fechaRegistro: todayISO(),
        nivelEstres: nivelEstres || undefined,
        embarazo: embarazo || undefined,
        alergias: alergias || undefined,
        condicionesMedicas: condicionesMedicas || undefined,
        medicamentos: medicamentos || undefined,
        totalVisitas: 0,
      };
      try {
        await createClienta(nueva);
        showToast('Clienta creada', 'success');
        router.push(`/clientas/${nueva.id}`);
      } catch (e) {
        console.error('[clientas.create]', e);
        setError(friendlyError(e));
        showToast('No se pudo guardar la clienta', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header
        showBack
        title="Nueva clienta"
        rightAction={
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-[#EEF5ED] text-[#666666]"
          >
            <ArrowLeft size={18} />
          </button>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-12 flex flex-col gap-5">

        {/* Datos personales */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-[#999999] uppercase tracking-wide" style={serif}>
            Datos personales
          </h2>
          <Input
            label="Nombre completo *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la clienta"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Edad"
              type="number"
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              placeholder="Años"
            />
            <Input
              label="Teléfono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+58 412..."
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com (opcional)"
          />
        </div>

        {/* Datos de salud */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-bold text-[#999999] uppercase tracking-wide" style={serif}>
              Datos de salud
            </h2>
            <p className="text-[10px] text-[#AAAAAA] mt-0.5">Se usarán automáticamente en cada diagnóstico</p>
          </div>

          {/* Nivel de estrés */}
          <div>
            <p className="text-xs font-semibold text-[#444] mb-2" style={serif}>Nivel de estrés</p>
            <div className="flex gap-2">
              {(['bajo', 'medio', 'alto'] as const).map((nivel) => (
                <button
                  key={nivel}
                  type="button"
                  onClick={() => setNivelEstres(nivel)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border-2 transition-all ${
                    nivelEstres === nivel
                      ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                      : 'border-[#E5E5E5] text-[#666666]'
                  }`}
                >
                  {nivel}
                </button>
              ))}
            </div>
          </div>

          {/* Embarazo / lactancia */}
          <div>
            <p className="text-xs font-semibold text-[#444] mb-2" style={serif}>¿Embarazo o lactancia?</p>
            <div className="flex gap-2">
              {([{ v: true, label: 'Sí' }, { v: false, label: 'No' }]).map(({ v, label }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setEmbarazo(v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    embarazo === v
                      ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                      : 'border-[#E5E5E5] text-[#666666]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Alergias */}
          <div>
            <label className="text-xs font-semibold text-[#444] block mb-1" style={serif}>
              Alergias a productos capilares
            </label>
            <input
              type="text"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              placeholder="Opcional — ej: sulfatos, siliconas..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white focus:outline-none focus:border-[#2D5A27]"
            />
          </div>

          {/* Condiciones médicas */}
          <div>
            <label className="text-xs font-semibold text-[#444] block mb-1" style={serif}>
              Condiciones médicas relevantes
            </label>
            <input
              type="text"
              value={condicionesMedicas}
              onChange={(e) => setCondicionesMedicas(e.target.value)}
              placeholder="tiroides, anemia, SOP, etc."
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white focus:outline-none focus:border-[#2D5A27]"
            />
          </div>

          {/* Medicamentos */}
          <div>
            <label className="text-xs font-semibold text-[#444] block mb-1" style={serif}>
              Medicamentos que afectan el cabello
            </label>
            <input
              type="text"
              value={medicamentos}
              onChange={(e) => setMedicamentos(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm bg-white focus:outline-none focus:border-[#2D5A27]"
            />
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleGuardar}
          loading={saving}
          icon={<Check size={18} />}
        >
          Guardar clienta
        </Button>
      </main>
    </div>
  );
}
