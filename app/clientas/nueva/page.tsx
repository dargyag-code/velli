'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowLeft, Sparkles, ShieldAlert, UserPlus } from 'lucide-react';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
import { createClienta } from '@/lib/db';
import { Clienta } from '@/lib/types';
import { generateId, todayISO } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';

export default function NuevaClientaPage() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  // Datos de salud y seguridad química
  const [nivelEstres, setNivelEstres] = useState<'bajo' | 'medio' | 'alto' | ''>('');
  const [embarazo, setEmbarazo] = useState(false);
  const [alergias, setAlergias] = useState('');
  const [condicionesMedicas, setCondicionesMedicas] = useState('');
  const [medicamentos, setMedicamentos] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const guardarClienta = async (irDirectoACotizar: boolean) => {
    if (!nombre.trim()) {
      setError('El nombre de la clienta es obligatorio');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const nueva: Clienta = {
        id: generateId(),
        nombre: nombre.trim(),
        edad: parseInt(edad, 10) || 0,
        telefono: telefono.trim(),
        email: email.trim() || undefined,
        fechaRegistro: todayISO(),
        nivelEstres: nivelEstres || undefined,
        embarazo: embarazo || undefined,
        alergias: alergias.trim() || undefined,
        condicionesMedicas: condicionesMedicas.trim() || undefined,
        medicamentos: medicamentos.trim() || undefined,
        totalVisitas: 0,
      };

      await createClienta(nueva);
      showToast('Clienta registrada en tu salón', 'success');
      if (irDirectoACotizar) {
        router.push(`/?clientaId=${nueva.id}`);
      } else {
        router.push(`/clientas/${nueva.id}`);
      }
    } catch (e) {
      console.error('[clientas.create]', e);
      setError(friendlyError(e));
      showToast('No se pudo guardar la clienta', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans pb-16">
      <VelvetTopHeader />
      {/* ── Sub-header Velvet Studio ────────────────────────────────────── */}
      <div className="border-b border-[#E4E4E7] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/clientas"
              aria-label="Volver a clientas"
              className="min-w-[44px] min-h-[44px] rounded-full bg-white border border-[#E4E4E7] text-[#111111] hover:bg-[#F4F4F5] flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(59,13,30,0.05)] transition-colors shrink-0 no-underline"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
                CRM · Ficha Nueva
              </span>
              <h1 className="m-0 font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#111111] truncate">
                Registrar clienta
              </h1>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] text-xs font-bold">
            <UserPlus size={13} /> Perfil & Salud Capilar
          </span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ── 1. Datos de contacto ──────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
          <div>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
              Identidad y WhatsApp
            </span>
            <h2 className="m-0 mt-0.5 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
              Datos personales
            </h2>
          </div>

          <div>
            <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
              Nombre completo *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Valentina Gómez"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#B45309]/40 text-xs font-semibold text-[#B45309]"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                WhatsApp / Celular
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+57 300 123 4567"
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all tabular-nums"
              />
            </div>

            <div>
              <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                Edad (opcional)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
                placeholder="Años"
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
              Correo electrónico (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="valentina@ejemplo.co"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all"
            />
          </div>
        </section>

        {/* ── 2. Seguridad química y salud capilar ──────────────────────── */}
        <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#B45309] block">
                Guardarraíles Clínicos
              </span>
              <h2 className="m-0 mt-0.5 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111]">
                Antecedentes y salud capilar
              </h2>
              <p className="m-0 mt-0.5 text-xs text-[#52525B]">
                Se sincronizan automáticamente al cotizar procesos químicos en silla.
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] border border-[#B45309]/25 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} className="text-[#B45309]" />
            </div>
          </div>

          {/* Embarazo / lactancia */}
          <div>
            <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-2">
              ¿Embarazo o lactancia?
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { v: false, label: 'No' },
                  { v: true, label: 'Sí' },
                ] as const
              ).map(({ v, label }) => {
                const activo = embarazo === v;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setEmbarazo(v)}
                    className={`min-h-[46px] py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      activo
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nivel de estrés */}
          <div>
            <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-2">
              Nivel de estrés reportado
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['bajo', 'medio', 'alto'] as const).map((nivel) => {
                const activo = nivelEstres === nivel;
                return (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => setNivelEstres(activo ? '' : nivel)}
                    className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                      activo
                        ? 'bg-[#F4F4F5] text-[#111111] border-[#E4E4E7]'
                        : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                    }`}
                  >
                    {nivel}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
              Alergias o sensibilidad química
            </label>
            <input
              type="text"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              placeholder="Opcional — ej. PPD, amoníaco, decolorantes…"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                Condiciones médicas
              </label>
              <input
                type="text"
                value={condicionesMedicas}
                onChange={(e) => setCondicionesMedicas(e.target.value)}
                placeholder="Tiroides, dermatitis, etc."
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] mb-1.5">
                Medicamentos relevantes
              </label>
              <input
                type="text"
                value={medicamentos}
                onChange={(e) => setMedicamentos(e.target.value)}
                placeholder="Opcional"
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A] focus:bg-white focus:border-[#111111] outline-none transition-all"
              />
            </div>
          </div>
        </section>

        {/* ── Acciones de guardado ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => guardarClienta(true)}
            className="flex-1 min-h-[48px] py-3.5 px-6 rounded-xl bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 text-white font-bold text-sm shadow-[0_10px_24px_-6px_rgba(59,13,30,0.28)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={16} />
            <span>{saving ? 'Guardando…' : 'Guardar y cotizar en silla'}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => guardarClienta(false)}
            className="min-h-[48px] py-3.5 px-6 rounded-xl bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] disabled:opacity-60 text-[#111111] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check size={16} />
            <span>Solo guardar ficha</span>
          </button>
        </div>
      </main>
    </div>
  );
}
