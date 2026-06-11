import * as Sentry from '@sentry/nextjs';
import { SENTRY_BASE_OPTIONS } from '@/lib/sentry';

// Instrumentación de cliente: errores de browser (sin replay ni tracing).
Sentry.init(SENTRY_BASE_OPTIONS);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
