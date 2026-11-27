'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { VeliLogoMark } from '@/components/v2/VelvetTopHeader';
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
      setError('Ingresa tu correo y contraseña');
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
    <div className="min-h-screen w-full bg-[#FAFAFA] text-[#111111] flex flex-col justify-between px-4 py-8 sm:px-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <VeliLogoMark size={30} />
          <span className="px-2.5 py-1 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-semibold text-[#52525B]">
            Sin Báscula
          </span>
        </div>

        <div className="my-auto py-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
              Inicia sesión en Veli
            </h1>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Control operativo en silla, agenda conectada a WhatsApp y rentabilidad real por servicio.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-white rounded-xl p-6 border border-[#E4E4E7] space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hola@tuestudio.co"
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#111111]">
                  Contraseña
                </label>
                <Link
                  className="text-xs font-medium text-[#52525B] hover:text-[#111111] underline underline-offset-4"
                  href="/auth/recuperar"
                >
                  ¿Olvidaste tu clave?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-[#DC2626] text-xs font-medium leading-relaxed"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              <span>{loading ? 'Iniciando sesión…' : 'Entrar al estudio'}</span>
              <ArrowRight size={15} />
            </button>

            <div className="pt-3 border-t border-[#E4E4E7] flex items-center justify-between text-xs text-[#52525B]">
              <span>¿Aún no tienes cuenta?</span>
              <Link
                className="font-semibold text-[#111111] hover:underline underline-offset-4"
                href="/auth/registro"
              >
                Crear cuenta
              </Link>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-4 border-t border-[#E4E4E7]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Aislamiento multi-tenant activo
          </span>
          <span className="v-mono text-[11px]">Veli · 2026</span>
        </div>
      </div>
    </div>
  );
}
