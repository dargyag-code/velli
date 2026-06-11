'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Palette, CalendarClock, Check, ArrowRight } from 'lucide-react';
import { Btn } from '@/components/v2';
import EditorMarca from '@/components/marca/EditorMarca';
import { getProfile, updateProfile, COLOR_VELLI } from '@/lib/profile';
import { uploadFoto } from '@/lib/storage';
import { showToast } from '@/lib/toast';

// ─── Wizard de primera vez (solo cuentas nuevas) ───────────────────────────
// 3 pasos, todos saltables con "Completar después". Gateado por
// profile.onboarding_completed: el Dashboard redirige aquí cuando es false y
// esta página redirige a / cuando ya es true (cuentas existentes jamás lo ven).
// Cada "Continuar" persiste su paso — si la estilista abandona a medias, lo
// hecho no se pierde.

const SERVICIOS_SUGERIDOS = [
  'Corte',
  'Color y mechas',
  'Tratamiento capilar',
  'Keratina y alisado',
  'Rizos y definición',
  'Peinado y brushing',
  'Cuero cabelludo',
  'Extensiones',
];

const DIAS_LABEL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Paso 1 · El salón
  const [nombreSalon, setNombreSalon] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Paso 2 · La marca
  const [logoPreview, setLogoPreview] = useState<string | null>(null); // dataURL pendiente de subir
  const [logoActual, setLogoActual] = useState<string | null>(null);   // ya guardado en el perfil
  const [color, setColor] = useState(COLOR_VELLI);

  // Paso 3 · La operación
  const [servicios, setServicios] = useState<string[]>([]);
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5, 6]); // L–S por defecto
  const [desde, setDesde] = useState('09:00');
  const [hasta, setHasta] = useState('18:00');

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (!p) {
          router.replace('/auth/login');
          return;
        }
        if (p.onboardingCompleted) {
          router.replace('/');
          return;
        }
        setNombreSalon(p.nombreSalon ?? '');
        setCiudad(p.ciudad ?? '');
        setWhatsapp(p.telefono ?? '');
        if (p.colorPrimario) setColor(p.colorPrimario);
        if (p.logoUrl) setLogoActual(p.logoUrl);
        if (p.servicios?.length) setServicios(p.servicios);
        if (p.horarioAtencion) {
          setDias(p.horarioAtencion.dias);
          setDesde(p.horarioAtencion.desde);
          setHasta(p.horarioAtencion.hasta);
        }
        setChecking(false);
      })
      .catch(() => {
        // Sin red o perfil ilegible: dejar entrar al wizard; los guardados
        // individuales avisarán con toast si fallan.
        setChecking(false);
      });
  }, [router]);

  const guardarPaso1 = async () => {
    setSaving(true);
    try {
      await updateProfile({
        nombreSalon: nombreSalon.trim(),
        ciudad: ciudad.trim(),
        telefono: whatsapp.trim(),
      });
      setPaso(2);
    } catch (e) {
      console.error('[onboarding.paso1]', e);
      showToast('No se pudo guardar. Revisa tu conexión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const guardarPaso2 = async () => {
    setSaving(true);
    try {
      // '' persiste null (logo quitado); una URL existente se conserva.
      let logoUrl = logoActual ?? '';
      if (logoPreview) {
        logoUrl = await uploadFoto(logoPreview, 'branding/logo');
        setLogoActual(logoUrl);
        setLogoPreview(null);
      }
      await updateProfile({ logoUrl, colorPrimario: color });
      setPaso(3);
    } catch (e) {
      console.error('[onboarding.paso2]', e);
      showToast('No se pudo guardar tu marca. Revisa tu conexión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const terminar = async () => {
    if (dias.length > 0 && desde >= hasta) {
      showToast('La hora de cierre debe ser después de la de apertura', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        servicios,
        horarioAtencion: dias.length > 0 ? { dias: [...dias].sort(), desde, hasta } : undefined,
        onboardingCompleted: true,
      });
      router.replace('/');
    } catch (e) {
      console.error('[onboarding.paso3]', e);
      showToast('No se pudo guardar. Revisa tu conexión.', 'error');
      setSaving(false);
    }
  };

  const completarDespues = async () => {
    setSaving(true);
    try {
      await updateProfile({ onboardingCompleted: true });
      router.replace('/');
    } catch (e) {
      console.error('[onboarding.skip]', e);
      showToast('No se pudo continuar. Revisa tu conexión.', 'error');
      setSaving(false);
    }
  };

  const toggleServicio = (s: string) =>
    setServicios((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  if (checking) {
    return (
      <div
        className="v-grain"
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 30,
            color: 'var(--secondary-deep)',
          }}
        >
          V
        </span>
      </div>
    );
  }

  const meta = {
    1: { icon: <Store size={18} />, eyebrow: 'Tu salón', titulo: <>¿Dónde haces tu <em style={{ color: 'var(--secondary-deep)' }}>magia</em>?</>, sub: 'Estos datos salen en tus PDF y en los recordatorios a tus clientas.' },
    2: { icon: <Palette size={18} />, eyebrow: 'Tu marca', titulo: <>Dale tu <em style={{ color: 'var(--secondary-deep)' }}>sello</em></>, sub: 'Tu logo y color visten los diagnósticos que entregas. Si lo prefieres, te prestamos la marca Velli.' },
    3: { icon: <CalendarClock size={18} />, eyebrow: 'Tu operación', titulo: <>¿Cómo <em style={{ color: 'var(--secondary-deep)' }}>trabajas</em>?</>, sub: 'Tus servicios y horario alimentan la agenda y la disponibilidad.' },
  }[paso];

  return (
    <div
      className="v-grain"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          padding: '54px 20px 0',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Progreso ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="v-caps">Paso {paso} de 3 · {meta.eyebrow}</span>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--primary-pale)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {meta.icon}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                background: n <= paso ? 'var(--primary)' : 'var(--border-strong)',
                transition: 'background 200ms ease',
              }}
            />
          ))}
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 30,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--text-main)',
          }}
        >
          {meta.titulo}
        </h1>
        <p style={{ margin: '8px 0 20px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {meta.sub}
        </p>

        {/* ── Paso 1 · El salón ─────────────────────────────────────────── */}
        {paso === 1 && (
          <div className="v-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Campo
              label="Nombre de tu salón"
              value={nombreSalon}
              onChange={setNombreSalon}
              placeholder="Ej. Estudio Rizos & Café"
              autoFocus
            />
            <Campo label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Ej. Bogotá" />
            <Campo
              label="WhatsApp de contacto"
              value={whatsapp}
              onChange={setWhatsapp}
              placeholder="+57 300 123 4567"
              type="tel"
            />
          </div>
        )}

        {/* ── Paso 2 · La marca ─────────────────────────────────────────── */}
        {paso === 2 && (
          <div className="v-card" style={{ padding: 16 }}>
            <EditorMarca
              logoSrc={logoPreview ?? logoActual}
              onLogo={(dataUrl) => {
                if (dataUrl) {
                  setLogoPreview(dataUrl);
                } else {
                  setLogoPreview(null);
                  setLogoActual(null);
                }
              }}
              color={color}
              onColor={setColor}
              nombreSalon={nombreSalon || undefined}
            />
          </div>
        )}

        {/* ── Paso 3 · La operación ─────────────────────────────────────── */}
        {paso === 3 && (
          <div className="v-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <LabelCampo>¿Qué servicios ofreces?</LabelCampo>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SERVICIOS_SUGERIDOS.map((s) => {
                  const activo = servicios.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleServicio(s)}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 999,
                        border: activo ? '1px solid var(--primary)' : '1px solid var(--border-strong)',
                        background: activo ? 'var(--primary-pale)' : 'transparent',
                        color: activo ? 'var(--primary)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      {activo && <Check size={12} />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <LabelCampo>Días de atención</LabelCampo>
              <div style={{ display: 'flex', gap: 6 }}>
                {DIAS_LABEL.map((label, d) => {
                  const activo = dias.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDia(d)}
                      aria-pressed={activo}
                      style={{
                        flex: 1,
                        aspectRatio: '1',
                        maxWidth: 48,
                        borderRadius: 12,
                        border: activo ? 'none' : '1px solid var(--border-strong)',
                        background: activo ? 'var(--primary-deep)' : 'transparent',
                        color: activo ? '#F5EDDC' : 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Campo label="Abres a las" value={desde} onChange={setDesde} type="time" />
              <Campo label="Cierras a las" value={hasta} onChange={setHasta} type="time" />
            </div>
          </div>
        )}
      </div>

      {/* ── Acciones · sticky abajo, pulgar-friendly ─────────────────────── */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn
            variant="primary"
            size="lg"
            fullWidth
            disabled={saving}
            iconRight={<ArrowRight size={15} />}
            onClick={paso === 1 ? guardarPaso1 : paso === 2 ? guardarPaso2 : terminar}
          >
            {saving ? 'Guardando…' : paso === 3 ? 'Terminar y empezar' : 'Continuar'}
          </Btn>
          <button
            type="button"
            onClick={completarDespues}
            disabled={saving}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 0',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--text-tertiary)',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Completar después
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function LabelCampo({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 12,
        color: 'var(--text-tertiary)',
        marginBottom: 8,
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
      }}
    >
      {children}
    </span>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <LabelCampo>{label}</LabelCampo>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          // 16px: evita el zoom automático de iOS al enfocar el input.
          fontSize: 16,
          color: 'var(--text-main)',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />
    </label>
  );
}
