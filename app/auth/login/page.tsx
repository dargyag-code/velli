'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

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
      email: email.trim(),
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
    <div className="w-full max-w-sm flex flex-col items-center">
      {/* Logo V */}
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
          boxShadow: '0 10px 36px rgba(45,90,39,0.42)',
        }}
      >
        <span className="text-white text-6xl leading-none" style={serif}>
          V
        </span>
      </div>

      <h1 className="text-3xl text-[#2D5A27] mb-1" style={serif}>
        Velli Pro
      </h1>
      <p className="text-sm text-[#C9956B] mb-8" style={serif}>
        Inteligencia capilar a tu alcance
      </p>

      <form
        onSubmit={handleLogin}
        className="w-full bg-white rounded-2xl border border-[#E5E5E5] p-6 flex flex-col gap-4"
        style={{ boxShadow: '0 4px 20px rgba(26,46,26,0.08)' }}
      >
        <div>
          <label className="text-xs text-[#666666] block mb-1" style={serif}>
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#666666] block mb-1" style={serif}>
            Contraseña
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          disabled={loading}
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
              Iniciando sesión…
            </>
          ) : (
            <>
              <LogIn size={16} />
              Iniciar sesión
            </>
          )}
        </button>

        <Link
          href="/auth/recuperar"
          className="text-xs text-[#666666] hover:text-[#2D5A27] text-center"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>

      <p className="text-sm text-[#666666] mt-6">
        ¿No tienes cuenta?{' '}
        <Link href="/auth/registro" className="text-[#2D5A27] font-bold hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
