'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAFAFA',
          color: '#111111',
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: 'center',
          padding: 24,
        }}
      >
        <main
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E7',
            borderRadius: 12,
            padding: '32px 24px',
            maxWidth: 380,
            width: '100%',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: '#111111',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 20,
              color: '#FFFFFF',
            }}
          >
            V
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Algo salió mal
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#52525B',
              margin: '0 auto 20px',
              lineHeight: 1.5,
            }}
          >
            Ya registramos el error para revisarlo. Tus datos están seguros; intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: '#FFFFFF',
              background: '#111111',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </main>
      </body>
    </html>
  );
}
