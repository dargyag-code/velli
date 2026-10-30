'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';
import { LEGAL_VERSION } from '@/lib/legal';

function HeaderAuthMarca() {
  return (
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
  );
}

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
          // handle_new_user persiste versión + fecha de aceptación legal en profiles
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
    <div className="min-h-screen w-full v-gradient-hero v-grain flex flex-col justify-between px-5 py-10 sm:px-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between z-10">
        <HeaderAuthMarca />

        <div className="my-auto py-8">
          {autoLogged ? (
            <div className="bg-[#FAF7F5] text-[#1C1518] rounded-3xl p-6 sm:p-8 border border-[#EFE8E4] shadow-[0_24px_60px_rgba(15,2,8,0.45)] text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#EAF6F4] text-[#0D9488] mx-auto flex items-center justify-center">
                <Check size={28} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1E3A]">
                  Cuenta activada
                </span>
                <h1 className="text-2xl font-bold text-[#1C1518] mt-1">
                  ¡Bienvenida, {nombre.trim().split(' ')[0] || 'Especialista'}!
                </h1>
                <p className="text-sm text-[#6E6266] mt-2 leading-relaxed">
                  Configura tu salón en 3 pasos express para dejar listos tus servicios, insumos químicos de referencia y canal de WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={goOnboarding}
                className="w-full py-3.5 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Configurar mi salón ahora</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : success ? (
            <div className="bg-[#FAF7F5] text-[#1C1518] rounded-3xl p-6 sm:p-8 border border-[#EFE8E4] shadow-[0_24px_60px_rgba(15,2,8,0.45)] text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#EAF6F4] text-[#0D9488] mx-auto flex items-center justify-center">
                <Check size={28} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0D9488]">
                  Verifica tu correo
                </span>
                <h1 className="text-2xl font-bold text-[#1C1518] mt-1">
                  ¡Tu cuenta de salón fue creada!
                </h1>
                <p className="text-sm text-[#6E6266] mt-2 leading-relaxed">
                  Enviamos un enlace de confirmación a <strong className="text-[#1C1518]">{email}</strong>.
                  Confírmalo en tu bandeja y entra a calibrar tu salón.
                </p>
              </div>
              <Link
                href="/auth/login"
                className="w-full py-3.5 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all inline-flex items-center justify-center gap-2 no-underline"
              >
                <span>Ir a iniciar sesión</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#E8CFC8] mb-2.5">
                  <span className="w-5 h-px bg-[#E8CFC8]" />
                  Alta de Salón · Prueba Gratuita
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#FAF7F5] tracking-tight leading-[1.08]">
                  Activa tu salón{' '}
                  <span className="italic font-normal text-[#E8CFC8]">en minutos.</span>
                </h1>
                <p className="mt-2.5 text-sm text-[#FAF7F5]/75 leading-relaxed">
                  Cotiza sin báscula, protege tu margen químico y liquida comisiones con exactitud.
                </p>
              </div>

              <form
                onSubmit={handleSignup}
                className="bg-[#FAF7F5] text-[#1C1518] rounded-3xl p-6 sm:p-7 border border-[#EFE8E4] shadow-[0_24px_60px_rgba(15,2,8,0.45)] space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                      Tu nombre *
                    </label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Camila Restrepo"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                      Nombre del salón
                    </label>
                    <input
                      type="text"
                      autoComplete="organization"
                      value={nombreSalon}
                      onChange={(e) => setNombreSalon(e.target.value)}
                      placeholder="Atelier Camila"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                    Correo electrónico *
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="camila@salonvelli.co"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-1.5">
                      Confirmar clave *
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      placeholder="Repite tu clave"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EFE8E4] text-sm text-[#1C1518] placeholder-[#BDB0B4] focus:border-[#3B0D1E] outline-none transition-all"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(e) => setAcceptedLegal(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#3B0D1E] cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-[#6E6266] leading-relaxed">
                    He leído y acepto los{' '}
                    <Link
                      href="/legal/terminos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3B0D1E] font-bold hover:underline"
                    >
                      Términos de Servicio
                    </Link>{' '}
                    y la{' '}
                    <Link
                      href="/legal/privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3B0D1E] font-bold hover:underline"
                    >
                      Política de Privacidad
                    </Link>
                    .
                  </span>
                </label>

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
                  disabled={loading || !acceptedLegal}
                  className="w-full py-3.5 px-6 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] disabled:opacity-60 disabled:cursor-not-allowed text-[#FAF7F5] font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  <span>{loading ? 'Creando cuenta de salón…' : 'Crear cuenta de salón'}</span>
                  <ArrowRight size={16} />
                </button>

                <div className="pt-3 border-t border-[#EFE8E4] flex items-center justify-between text-xs text-[#6E6266]">
                  <span>¿Ya tienes cuenta en Velli BI?</span>
                  <Link
                    className="font-bold text-[#3B0D1E] hover:text-[#6E1E3A] underline underline-offset-4"
                    href="/auth/login"
                  >
                    Inicia sesión
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>

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
