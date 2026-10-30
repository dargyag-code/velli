'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingresa tu email y contraseña');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) {
      console.error('[auth.login]', error);
      setError(friendlyAuthError(error.message));
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen w-full v-gradient-hero v-grain flex flex-col justify-between px-5 py-10 sm:px-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between z-10">
        {/* ── Header: Logo Oficial Velli Business Intelligence ────────── */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-3 select-none">
            <div className="w-11 h-11 rounded-2xl bg-[#FAF7F5]/10 border border-[#E8CFC8]/25 flex items-center justify-center shadow-sm backdrop-blur-sm">
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19.2 33.5C13.2 29.8 7.5 21.8 9.2 13.8C10.5 7.8 16.5 7.2 19.2 14.5C20.2 17.2 20.2 27.5 19.2 33.5Z"
                  fill="#FAF7F5"
                />
                <path
                  d="M20.8 33.5C26.8 29.8 32.5 21.8 30.8 13.8C29.5 7.8 23.5 7.2 20.8 14.5C19.8 17.2 19.8 27.5 20.8 33.5Z"
                  fill="#E8CFC8"
                  fillOpacity="0.85"
                />
                <circle cx="20" cy="6.5" r="2.5" fill="#D97757" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-bold tracking-tight text-[#FAF7F5] font-brand">
                velli
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold mt-1 text-[#E8CFC8]">
                Business Intelligence
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F5]/10 border border-[#E8CFC8]/20 text-[10px] font-semibold uppercase tracking-widest text-[#E8CFC8]">
            <Sparkles size={11} /> Sin Báscula
          </span>
        </div>

        {/* ── Hero Editorial + Tarjeta de Acceso ──────────────────────── */}
        <div className="my-auto py-8">
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#E8CFC8] mb-3">
              <span className="w-5 h-px bg-[#E8CFC8]" />
              Plataforma para Salones
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-[#FAF7F5] tracking-tight leading-[1.05]">
              El cabello,{' '}
              <span className="italic font-normal text-[#E8CFC8]">
                rentabilizado.
              </span>
            </h1>
            <p className="mt-3 text-sm text-[#FAF7F5]/75 leading-relaxed max-w-sm">
              Diagnóstico capilar táctil, cotización precisa sin báscula y cierre financiero en un solo toque.
            </p>
          </div>

          {/* Tarjeta Blanca / Crema de Login */}
          <form
            onSubmit={handleLogin}
            className="bg-[#FAF7F5] text-[#1C1518] rounded-3xl p-6 sm:p-7 border border-[#EFE8E4] shadow-[0_24px_60px_rgba(15,2,8,0.45)] space-y-4"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camila@salonvelli.co"
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266]">
                  Contraseña
                </label>
                <Link className="text-xs font-semibold text-[#6E1E3A] hover:underline" href="/auth/recuperar">
                  ¿Olvidaste tu clave?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] transition-all"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-[#FDF2EC] border border-[#D97757]/40 text-[#B85D3B] text-xs font-medium leading-relaxed"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-60 text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{loading ? 'Iniciando sesión…' : 'Entrar a tu salón'}</span>
              <ArrowRight size={16} />
            </button>

            <div className="pt-3 border-t border-[#EFE8E4] flex items-center justify-between text-xs text-[#6E6266]">
              <span>¿Aún no tienes cuenta?</span>
              <Link className="font-bold text-[#3B0D1E] hover:text-[#6E1E3A] underline underline-offset-4" href="/auth/registro">
                Crear cuenta de salón
              </Link>
            </div>
          </form>
        </div>

        {/* ── Footer de Seguridad Multi-tenant ────────────────────────── */}
        <div className="flex items-center justify-between text-[11px] text-[#E8CFC8]/70 pt-4 border-t border-[#E8CFC8]/15">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Datos protegidos por salón
          </span>
          <span className="v-mono text-[10px]">Velli BI · 2026</span>
        </div>
      </div>
    </div>
  );
}
