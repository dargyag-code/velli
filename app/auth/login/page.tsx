'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Btn } from '@/components/v2';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/errors';

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
      email: email.trim().toLowerCase(),
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
    // Full-bleed override del auth layout (cream centrado)
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        background: 'var(--primary-deep)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Editorial cover con grain y radial dorado */}
      <div
        className="v-grain"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(201, 149, 107, 0.32) 0%, transparent 55%), linear-gradient(180deg, #0F1A12 0%, #14241A 60%, #1F3D24 100%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 24px 32px',
          color: '#F5EDDC',
          maxWidth: 460,
          width: '100%',
          margin: '0 auto',
          minHeight: '100vh',
        }}
      >
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid rgba(232, 194, 144, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 15,
                color: '#E8C290',
                lineHeight: 1,
              }}
            >
              V
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                lineHeight: 1,
                color: '#fff',
              }}
            >
              Velli
            </div>
            <div
              className="v-num"
              style={{
                color: 'rgba(232, 194, 144, 0.85)',
                fontSize: 8.5,
                marginTop: 2,
                letterSpacing: '0.18em',
              }}
            >
              INTELIGENCIA CAPILAR
            </div>
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ marginTop: 80 }}>
          <div
            className="v-num"
            style={{
              color: 'rgba(232, 194, 144, 0.9)',
              fontSize: 9.5,
              marginBottom: 8,
              letterSpacing: '0.2em',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 18,
                height: 1,
                background: '#E8C290',
                marginRight: 8,
                verticalAlign: 'middle',
              }}
            />
            EDICIÓN PROFESIONAL
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 44,
              letterSpacing: '-0.025em',
              lineHeight: 1.0,
              color: '#fff',
            }}
          >
            El cabello,
          </h1>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 44,
              letterSpacing: '-0.025em',
              lineHeight: 1.0,
              color: '#E8C290',
            }}
          >
            entendido.
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              lineHeight: 1.5,
              color: 'rgba(245, 237, 220, 0.7)',
              maxWidth: 320,
            }}
          >
            Diagnóstico, plan y seguimiento — todo el oficio de tu salón en un solo lugar.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleLogin}
          style={{ marginTop: 'auto', paddingTop: 32 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                className="v-caps"
                style={{ color: 'rgba(232, 194, 144, 0.8)' }}
              >
                Correo
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camila@salonvelli.co"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(232, 194, 144, 0.18)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  color: '#F5EDDC',
                  fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  WebkitTextFillColor: '#F5EDDC',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                className="v-caps"
                style={{ color: 'rgba(232, 194, 144, 0.8)' }}
              >
                Contraseña
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(232, 194, 144, 0.18)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  color: '#F5EDDC',
                  fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  WebkitTextFillColor: '#F5EDDC',
                }}
              />
            </label>
          </div>

          {error && (
            <p
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(142, 45, 45, 0.18)',
                border: '1px solid rgba(142, 45, 45, 0.32)',
                color: '#FFCFCF',
                fontSize: 12,
                lineHeight: 1.4,
                fontFamily: 'var(--font-sans)',
              }}
              role="alert"
            >
              {error}
            </p>
          )}

          <Btn
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
            disabled={loading}
            iconRight={
              loading ? (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(20, 36, 26, 0.3)',
                    borderTopColor: '#14241A',
                    borderRadius: '50%',
                    animation: 'pulse-soft 1s linear infinite',
                  }}
                  className="loading-pulse"
                />
              ) : (
                <ArrowRight size={14} />
              )
            }
            style={{ marginTop: 16, color: '#14241A' }}
          >
            {loading ? 'Iniciando sesión…' : 'Entrar a tu salón'}
          </Btn>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              fontSize: 11.5,
            }}
          >
            <Link
              href="/auth/recuperar"
              style={{
                color: 'rgba(232, 194, 144, 0.85)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              ¿Olvidaste tu clave?
            </Link>
            <span
              className="v-num"
              style={{
                color: 'rgba(245, 237, 220, 0.5)',
                fontSize: 9.5,
              }}
            >
              v 1.0 · 2026
            </span>
          </div>
        </form>

        {/* Sign-up link */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: '1px solid rgba(232, 194, 144, 0.18)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'rgba(245, 237, 220, 0.7)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            ¿No tienes cuenta?{' '}
            <Link
              href="/auth/registro"
              style={{
                color: '#E8C290',
                fontWeight: 700,
                textDecoration: 'none',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 14,
              }}
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
