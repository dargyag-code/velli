// ── Configuración compartida de Sentry ──────────────────────────────────────
// Un solo lugar para DSN y opciones comunes de cliente/servidor/edge.
// Sin NEXT_PUBLIC_SENTRY_DSN el SDK queda deshabilitado (enabled: false):
// la app funciona idéntica en dev y en forks sin cuenta de Sentry.

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const SENTRY_BASE_OPTIONS = {
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Solo errores: sin tracing ni replay (menos red, menos costo, y la CSP
  // solo necesita el dominio de ingest en connect-src).
  tracesSampleRate: 0,
  // Datos de estilistas y clientas: jamás enviar PII por defecto.
  sendDefaultPii: false,
};
