'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Supabase JS procesa el hash (#access_token=...&type=recovery) en window.location
  // y emite PASSWORD_RECOVERY. Esperamos a tener una sesión antes de permitir el cambio.
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
    setDone(true);
    setTimeout(() => {
      router.push('/auth/login');
      router.refresh();
    }, 1500);
  };

  if (done) {
    return (
      <div className="w-full max-w-sm text-center">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2D5A27, #4A8C42)' }}
        >
          <Check size={32} className="text-white" />
        </div>
        <h1 className="text-2xl text-[#2D5A27] mb-2" style={serif}>
          Contraseña actualizada
        </h1>
        <p className="text-sm text-[#666666]">
          Redirigiendo al inicio de sesión…
        </p>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl text-[#2D5A27] mb-2" style={serif}>
          Enlace no válido
        </h1>
        <p className="text-sm text-[#666666] mb-6">
          Este enlace ha expirado o ya fue usado. Solicita uno nuevo.
        </p>
        <Link
          href="/auth/recuperar"
          className="inline-block py-3 px-6 rounded-xl text-white font-bold text-sm"
          style={{
            background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
            ...serif,
          }}
        >
          Solicitar nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
          boxShadow: '0 10px 36px rgba(45,90,39,0.42)',
        }}
      >
        <span className="text-white text-6xl leading-none" style={serif}>V</span>
      </div>

      <h1 className="text-3xl text-[#2D5A27] mb-1" style={serif}>
        Nueva contraseña
      </h1>
      <p className="text-sm text-[#C9956B] mb-6 text-center px-4" style={serif}>
        Elige una contraseña que solo tú conozcas
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full bg-white rounded-2xl border border-[#E5E5E5] p-6 flex flex-col gap-4"
        style={{ boxShadow: '0 4px 20px rgba(26,46,26,0.08)' }}
      >
        <div>
          <label className="text-xs text-[#666666] block mb-1" style={serif}>
            Nueva contraseña <span className="text-[#AAAAAA]">(mínimo 6 caracteres)</span>
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#666666] block mb-1" style={serif}>
            Confirmar nueva contraseña
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || hasSession !== true}
          className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
            fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
            boxShadow: '0 4px 16px rgba(45,90,39,0.28)',
          }}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando…
            </>
          ) : hasSession === null ? (
            'Verificando enlace…'
          ) : (
            'Guardar nueva contraseña'
          )}
        </button>
      </form>

      <p className="text-sm text-[#666666] mt-6">
        <Link href="/auth/login" className="text-[#2D5A27] font-bold hover:underline">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
