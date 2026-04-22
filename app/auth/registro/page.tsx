'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Store, Check, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoLogged, setAutoLogged] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) return setError('Ingresa tu nombre');
    if (!email.trim()) return setError('Ingresa tu email');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (password !== password2) return setError('Las contraseñas no coinciden');

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nombre: nombre.trim(),
          nombre_negocio: nombreNegocio.trim() || null,
        },
      },
    });
    setLoading(false);

    if (error) {
      console.error('[auth.signUp]', error);
      setError(friendlyAuthError(error.message));
      return;
    }

    // Si Supabase tiene confirmación de email activa, no hay sesión aún.
    if (data.session) {
      setAutoLogged(true);
    } else {
      setSuccess(true);
    }
  };

  const goCompletarPerfil = () => {
    router.push('/configuracion');
    router.refresh();
  };

  const goDashboard = () => {
    router.push('/');
    router.refresh();
  };

  if (autoLogged) {
    return (
      <div className="w-full max-w-sm text-center">
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
            boxShadow: '0 8px 32px rgba(45,90,39,0.40)',
          }}
        >
          <span className="text-white text-5xl leading-none" style={serif}>V</span>
        </div>
        <h1 className="text-2xl text-[#2D5A27] mb-1" style={serif}>
          ¡Bienvenida, {nombre.split(' ')[0] || 'estilista'}!
        </h1>
        <p className="text-sm text-[#C9956B] mb-1" style={serif}>
          Tu cuenta está lista
        </p>
        <p className="text-sm text-[#666666] mb-7">
          Completa tu perfil para que tus diagnósticos y reportes salgan con tu información
          profesional.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={goCompletarPerfil}
            className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
              boxShadow: '0 4px 16px rgba(45,90,39,0.28)',
              ...serif,
            }}
          >
            Completar mi perfil <ArrowRight size={16} />
          </button>
          <button
            onClick={goDashboard}
            className="text-sm text-[#666666] hover:text-[#2D5A27]"
          >
            Ahora no, llévame al inicio
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm text-center">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2D5A27, #4A8C42)' }}
        >
          <Check size={32} className="text-white" />
        </div>
        <h1 className="text-2xl text-[#2D5A27] mb-2" style={serif}>
          ¡Cuenta creada!
        </h1>
        <p className="text-sm text-[#666666] mb-6">
          Te enviamos un email a <strong>{email}</strong> para confirmar tu cuenta.
          Revisa tu bandeja y luego inicia sesión.
        </p>
        <Link
          href="/auth/login"
          className="inline-block py-3 px-6 rounded-xl text-white font-bold text-sm"
          style={{
            background: 'linear-gradient(135deg, #2D5A27, #4A8C42)',
            ...serif,
          }}
        >
          Ir al inicio de sesión
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
        Crear cuenta
      </h1>
      <p className="text-sm text-[#C9956B] mb-6" style={serif}>
        Inteligencia capilar a tu alcance
      </p>

      <form
        onSubmit={handleSignup}
        className="w-full bg-white rounded-2xl border border-[#E5E5E5] p-6 flex flex-col gap-4"
        style={{ boxShadow: '0 4px 20px rgba(26,46,26,0.08)' }}
      >
        <div>
          <label className="text-xs text-[#666666] block mb-1" style={serif}>
            Nombre completo
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="text"
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#666666] block mb-1" style={serif}>
            Nombre del salón <span className="text-[#AAAAAA]">(opcional)</span>
          </label>
          <div className="relative">
            <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="text"
              autoComplete="organization"
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              placeholder="Velli Salón"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
            />
          </div>
        </div>

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
            Contraseña <span className="text-[#AAAAAA]">(mínimo 6 caracteres)</span>
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
            Confirmar contraseña
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
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>

      <p className="text-sm text-[#666666] mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/auth/login" className="text-[#2D5A27] font-bold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
