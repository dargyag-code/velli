'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { VeliLogoMark } from '@/components/v2/VelvetTopHeader';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';
import { LEGAL_VERSION } from '@/lib/legal';

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [nombreSalon, setNombreSalon] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoLogged, setAutoLogged] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) return setError('Ingresa tu nombre');
    if (!email.trim()) return setError('Ingresa tu correo electrónico');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (password !== password2) return setError('Las contraseñas no coinciden');
    if (!acceptedLegal) return setError('Debes aceptar los Términos y la Política de Privacidad');

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          nombre: nombre.trim(),
          nombre_salon: nombreSalon.trim() || null,
          legal_version: LEGAL_VERSION,
        },
      },
    });
    setLoading(false);

    if (error) {
      console.error('[auth.signUp]', error);
      setError(friendlyAuthError(error.message));
      return;
    }

    if (data.session) {
      setAutoLogged(true);
    } else {
      setSuccess(true);
    }
  };

  const goOnboarding = () => {
    router.push('/onboarding');
    router.refresh();
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-[#111111] flex flex-col justify-between px-4 py-8 sm:px-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <VeliLogoMark size={30} />
          <span className="px-2.5 py-1 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-semibold text-[#52525B]">
            Prueba gratuita
          </span>
        </div>

        <div className="my-auto py-8">
          {autoLogged ? (
            <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] text-center space-y-5">
              <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] text-[#15803D] mx-auto flex items-center justify-center">
                <Check size={24} />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
                  Cuenta activada
                </span>
                <h1 className="text-2xl font-bold text-[#111111]">
                  Hola, {nombre.trim().split(' ')[0] || 'Especialista'}
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Configura tu estudio en 3 pasos rápidos para dejar listos tus servicios, insumos de referencia y canal de WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={goOnboarding}
                className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <span>Configurar mi estudio</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : success ? (
            <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#E4E4E7] text-center space-y-5">
              <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] text-[#15803D] mx-auto flex items-center justify-center">
                <Check size={24} />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
                  Verifica tu correo
                </span>
                <h1 className="text-2xl font-bold text-[#111111]">
                  Tu cuenta en Veli fue creada
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Enviamos un enlace de confirmación a <strong className="text-[#111111]">{email}</strong>. Confírmalo en tu bandeja para ingresar.
                </p>
              </div>
              <Link
                href="/auth/login"
                className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] text-white font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 no-underline"
              >
                <span>Ir a iniciar sesión</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
                  Activa tu estudio en Veli
                </h1>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Cotiza sin báscula, protege tu margen químico y liquida comisiones con exactitud.
                </p>
              </div>

              <form
                onSubmit={handleSignup}
                className="bg-white rounded-xl p-6 border border-[#E4E4E7] space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Tu nombre *
                    </label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Mateo Rojas"
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Nombre del estudio
                    </label>
                    <input
                      type="text"
                      autoComplete="organization"
                      value={nombreSalon}
                      onChange={(e) => setNombreSalon(e.target.value)}
                      placeholder="Atelier Norte"
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Correo electrónico *
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Confirmar clave *
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      placeholder="Repite tu clave"
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#E4E4E7] text-sm text-[#111111] placeholder-[#71717A]"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(e) => setAcceptedLegal(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#111111] cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-[#52525B] leading-relaxed">
                    He leído y acepto los{' '}
                    <Link
                      href="/legal/terminos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#111111] font-semibold hover:underline"
                    >
                      Términos de Uso
                    </Link>{' '}
                    y la{' '}
                    <Link
                      href="/legal/privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#111111] font-semibold hover:underline"
                    >
                      Política de Privacidad
                    </Link>
                    .
                  </span>
                </label>

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
                  disabled={loading || !acceptedLegal}
                  className="w-full h-10 px-4 rounded-lg bg-[#111111] hover:bg-[#27272A] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  <span>{loading ? 'Creando cuenta…' : 'Crear cuenta en Veli'}</span>
                  <ArrowRight size={15} />
                </button>

                <div className="pt-3 border-t border-[#E4E4E7] flex items-center justify-between text-xs text-[#52525B]">
                  <span>¿Ya tienes cuenta en Veli?</span>
                  <Link
                    className="font-semibold text-[#111111] hover:underline underline-offset-4"
                    href="/auth/login"
                  >
                    Inicia sesión
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-4 border-t border-[#E4E4E7]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Datos aislados por organización
          </span>
          <span className="v-mono text-[11px]">Veli · 2026</span>
        </div>
      </div>
    </div>
  );
}
