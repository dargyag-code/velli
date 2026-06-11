import * as Sentry from '@sentry/nextjs';

// Instrumentación de servidor (Node y Edge). El init vive en los archivos
// sentry.*.config.ts según runtime; onRequestError reporta a Sentry los
// errores de route handlers y RSC (incluidos los endpoints de pagos).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
