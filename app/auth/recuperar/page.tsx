'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { VeliLogoMark } from '@/components/v2/VelvetTopHeader';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Ingresa el correo electrónico de tu cuenta');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      console.error('[auth.resetPassword]', error);
      setError(friendlyAuthError(error.message));
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-[#111111] flex flex-col justify-between px-4 py-8 sm:px-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <VeliLogoMark size={30} />
          <span className="px-2.5 py-1 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-semibold text-[#52525B]">
            Recuperación
          </span>
        </div>

        <div className="my-auto py-8">
          {sent ? (
            <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] text-center space-y-5">
              <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] text-[#15803D] mx-auto flex items-center justify-center">
                <Check size={24} />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
                  Enlace enviado
                </span>
                <h1 className="text-2xl font-bold text-[#111111]">
                  Revisa tu correo electrónico
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Enviamos a <strong className="text-[#111111]">{email}</strong> un enlace seguro para definir tu nueva contraseña.
                </p>
              </div>
              <Link
                href="/auth/login"
                className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 no-underline"
              >
                <ArrowLeft size={15} />
                <span>Volver al inicio de sesión</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
                  Recuperar contraseña
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Te enviaremos un enlace seguro a tu correo para actualizar tu clave.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl p-6 border border-[#E4E4E7] space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Correo electrónico registrado
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
                  <span>{loading ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}</span>
                  <ArrowRight size={15} />
                </button>

                <div className="pt-3 border-t border-[#E4E4E7] flex items-center justify-between text-xs text-[#52525B]">
                  <span>¿Recordaste tu contraseña?</span>
                  <Link
                    className="font-semibold text-[#111111] hover:underline underline-offset-4"
                    href="/auth/login"
                  >
                    Volver a entrar
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-4 border-t border-[#E4E4E7]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Acceso seguro
          </span>
          <span className="v-mono text-[11px]">Veli · 2026</span>
        </div>
      </div>
    </div>
  );
}
