'use client';
import Link from 'next/link';
import { UserCog, UserPlus, Sparkles, ArrowRight, Check } from 'lucide-react';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

interface Props {
  nombre?: string | null;
  profileCompleto: boolean;
}

export default function Onboarding({ nombre, profileCompleto }: Props) {
  const primer = nombre?.split(' ')[0] || 'estilista';

  const pasos = [
    {
      done: profileCompleto,
      icon: <UserCog size={22} />,
      titulo: 'Completa tu perfil',
      texto: 'Salón, teléfono y ciudad para que tus diagnósticos salgan con tu información.',
      href: '/configuracion',
      cta: profileCompleto ? 'Revisar perfil' : 'Ir a mi perfil',
    },
    {
      done: false,
      icon: <UserPlus size={22} />,
      titulo: 'Registra tu primera clienta',
      texto: 'Datos básicos y salud capilar para empezar a construir su historia.',
      href: '/clientas/nueva',
      cta: 'Nueva clienta',
    },
    {
      done: false,
      icon: <Sparkles size={22} />,
      titulo: 'Haz tu primer diagnóstico',
      texto: 'Análisis con cámara IA o wizard manual — plan completo en minutos.',
      href: '/diagnostico',
      cta: 'Empezar diagnóstico',
      hintIfDisabled: 'Disponible después de registrar una clienta',
    },
  ];

  return (
    <div className="fade-in">
      {/* Welcome hero */}
      <div
        className="rounded-3xl p-6 mb-5 text-center"
        style={{
          background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
          boxShadow: '0 10px 36px rgba(26,46,26,0.35)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <span className="text-white text-3xl leading-none" style={serif}>V</span>
        </div>
        <h1 className="text-2xl text-white mb-1" style={serif}>
          Bienvenida a Velli Pro,{' '}
          <span className="text-[#FFD9A8]">{primer}</span>
        </h1>
        <p className="text-sm text-[#B8D4B5]">
          Tu espacio profesional para diagnósticos capilares inteligentes.
        </p>
      </div>

      <h2 className="text-sm font-bold text-[#1A2E1A] mb-3 px-1" style={serif}>
        Empieza en 3 pasos
      </h2>

      <div className="flex flex-col gap-3">
        {pasos.map((p, i) => (
          <Link
            key={p.titulo}
            href={p.href}
            className="block bg-white rounded-2xl border border-[#E5E5E5] p-4 active:scale-[0.99] transition-all hover:border-[#90B98A] hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  p.done ? 'bg-[#EEF5ED] text-[#2D5A27]' : 'bg-[#FBF4EC] text-[#C9956B]'
                }`}
              >
                {p.done ? <Check size={22} /> : p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest text-[#999999]"
                    style={serif}
                  >
                    Paso {i + 1}
                  </span>
                  {p.done && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2D5A27] text-white">
                      Hecho
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#2D2D2D] leading-tight" style={serif}>
                  {p.titulo}
                </p>
                <p className="text-xs text-[#666666] mt-1 leading-relaxed">{p.texto}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#2D5A27]">
                  {p.cta} <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center text-[11px] text-[#999999] mt-6">
        ¿Dudas? Escríbenos a{' '}
        <a href="mailto:soporte@velli.app" className="text-[#2D5A27] font-semibold hover:underline">
          soporte@velli.app
        </a>
      </p>
    </div>
  );
}
