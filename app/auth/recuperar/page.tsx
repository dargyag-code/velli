'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Send, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2D5A27, #4A8C42)' }}
        >
          <Check size={32} className="text-white" />
        </div>
        <h1 className="text-2xl text-[#2D5A27] mb-2" style={serif}>
          Email enviado
        </h1>
        <p className="text-sm text-[#666666] mb-6">
          Te enviamos un email a <strong>{email}</strong> con instrucciones para
          cambiar tu contraseña.
        </p>
        <Link
          href="/auth/login"
          className="inline-block py-3 px-6 rounded-xl text-white font-bold text-sm"
          style={{
            background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
            ...serif,
          }}
        >
          Volver al inicio de sesión
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
        <span className="text-white text-6xl leading-none" style={serif}>
          V
        </span>
      </div>

      <h1 className="text-3xl text-[#2D5A27] mb-1" style={serif}>
        Recuperar contraseña
      </h1>
      <p className="text-sm text-[#C9956B] mb-6 text-center px-4" style={serif}>
        Te enviaremos un enlace para cambiar tu contraseña
      </p>

      <form
        onSubmit={handleSubmit}
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
              Enviando…
            </>
          ) : (
            <>
              <Send size={16} />
              Enviar enlace
            </>
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
