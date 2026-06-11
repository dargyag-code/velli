'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Último recurso: errores de render no capturados en todo el árbol.
// Reemplaza al layout raíz, por eso lleva <html>/<body> propios.
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
          background: '#FAF6EF',
          color: '#2A241C',
          fontFamily: "Georgia, 'Times New Roman', serif",
          textAlign: 'center',
          padding: 24,
        }}
      >
        <main>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 13,
              background: 'linear-gradient(160deg, #2D5A27 0%, #14241A 100%)',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontStyle: 'italic',
              fontSize: 34,
              color: '#E8C290',
            }}
          >
            V
          </div>
          <h1 style={{ fontSize: 24, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Algo salió <em style={{ color: '#8A5A2E' }}>mal</em>
          </h1>
          <p
            style={{
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
              fontSize: 14,
              color: '#6B6256',
              maxWidth: 320,
              margin: '0 auto 20px',
              lineHeight: 1.5,
            }}
          >
            Ya registramos el error y vamos a revisarlo. Tus datos están a salvo —
            intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontFamily: "-apple-system, 'Segoe UI', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              color: '#fff',
              background: '#2D5A27',
              border: 'none',
              borderRadius: 999,
              padding: '13px 28px',
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
