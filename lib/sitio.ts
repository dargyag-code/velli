// ── URL pública de la app y correo de soporte ──────────────────────────────
// Un solo lugar para el dominio y el correo: metadatos (vistas previas en
// WhatsApp y redes), pie de los PDF, Configuración y textos legales. Velli no
// tiene dominio propio, así que por defecto se usa el alias de Vercel.
//
//   NEXT_PUBLIC_APP_URL="https://velli-three.vercel.app"
//   NEXT_PUBLIC_SUPPORT_EMAIL="soporte@tu-dominio.com"
//
// Las variables se leen LITERALMENTE (process.env.NEXT_PUBLIC_…): Next solo
// incrusta en el bundle del cliente los accesos literales, al construir.
// Cambiar un valor exige redeploy.

const APP_URL_POR_DEFECTO = 'https://velli-three.vercel.app';

function urlBase(valor: string | undefined): URL {
  try {
    const url = new URL(valor?.trim() || APP_URL_POR_DEFECTO);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url;
  } catch {
    // Valor mal escrito (p. ej. sin https://): se usa el de por defecto.
  }
  return new URL(APP_URL_POR_DEFECTO);
}

const base = urlBase(process.env.NEXT_PUBLIC_APP_URL);

/** Origen público de la app, sin barra final: `https://velli-three.vercel.app`. */
export const APP_URL = base.origin;

/** Dominio sin protocolo, para mostrar (pie del PDF). */
export const APP_HOST = base.host;

const correo = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

/**
 * Correo de soporte, o null si la variable falta o no es un correo. Sin
 * correo, Configuración oculta el contacto y los textos legales lo marcan
 * como pendiente: nunca se inventa una dirección.
 */
export const SOPORTE_EMAIL: string | null =
  correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : null;

/** `mailto:` al soporte con el asunto dado, o null si no hay correo. */
export function enlaceSoporte(asunto?: string): string | null {
  if (!SOPORTE_EMAIL) return null;
  return `mailto:${SOPORTE_EMAIL}${asunto ? `?subject=${encodeURIComponent(asunto)}` : ''}`;
}
