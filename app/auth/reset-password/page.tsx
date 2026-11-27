'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { VeliLogoMark } from '@/components/v2/VelvetTopHeader';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true);
      }
    });
    const t = setTimeout(() => {
      setHasSession((prev) => (prev === null ? false : prev));
    }, 2500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (password !== password2) return setError('Las contraseñas no coinciden');

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      console.error('[auth.updatePassword]', error);
      setError(friendlyAuthError(error.message));
      return;
    }

    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => {
      router.push('/auth/login');
      router.refresh();
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-[#111111] flex flex-col justify-between px-4 py-8 sm:px-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <VeliLogoMark size={30} />
          <span className="px-2.5 py-1 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-semibold text-[#52525B]">
            Nueva clave
          </span>
        </div>

        <div className="my-auto py-8">
          {done ? (
            <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] text-[#15803D] mx-auto flex items-center justify-center">
                <Check size={24} />
              </div>
              <h1 className="text-2xl font-bold text-[#111111]">Contraseña actualizada</h1>
              <p className="text-sm text-[#52525B]">Redirigiendo al inicio de sesión…</p>
            </div>
          ) : hasSession === false ? (
            <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] text-center space-y-5">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                  Enlace vencido
                </span>
                <h1 className="text-2xl font-bold text-[#111111]">
                  Este enlace ya no es válido
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Por seguridad, los enlaces de recuperación expiran tras usarse o después de unos minutos. Solicita uno nuevo.
                </p>
              </div>
              <Link
                href="/auth/recuperar"
                className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 no-underline"
              >
                <span>Solicitar nuevo enlace</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
                  Define tu nueva contraseña
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Elige una clave privada de al menos 6 caracteres para proteger tu cuenta en Veli.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl p-6 border border-[#E4E4E7] space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full h-10 px-3.5 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="Repite tu nueva clave"
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
                  disabled={loading || hasSession !== true}
                  className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  <span>
                    {loading
                      ? 'Actualizando contraseña…'
                      : hasSession === null
                        ? 'Verificando enlace…'
                        : 'Guardar nueva contraseña'}
                  </span>
                  <ArrowRight size={15} />
                </button>

                <div className="pt-3 border-t border-[#E4E4E7] flex items-center justify-between text-xs text-[#52525B]">
                  <span>¿Deseas volver sin cambiar?</span>
                  <Link
                    className="font-semibold text-[#111111] hover:underline underline-offset-4"
                    href="/auth/login"
                  >
                    Ir al inicio de sesión
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
