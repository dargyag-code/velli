// ══════════════════════════════════════════════════════════════════════════
// Mensaje, enlace de WhatsApp y metadatos/utilidades de la página pública
// `/c/[token]` para enviar una cotización (docs/velli-bi/02-diseno-cotizador.md §4).
//
// Regla de privacidad: el mensaje y el link público llevan ÚNICAMENTE el
// servicio, el nombre del salón, el precio en COP y la fecha de vigencia.
// NUNCA incluyen datos clínicos ni del diagnóstico capilar.
// ══════════════════════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import { COLOR_VELLI } from '@/lib/profile';
import { APP_URL } from '@/lib/sitio';
import { enlaceWhatsApp } from '@/lib/whatsapp';
import type { CotizacionPublica } from './db';

export const TEXTO_LEGAL_COTIZACION_PUBLICA =
  'Precio para el servicio descrito, válido hasta la fecha indicada. Puede cambiar si al momento del servicio el cabello requiere un trabajo distinto.';

const ROBOTS_NOINDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export interface DatosMensajeCotizacion {
  /** Nombre de pila o nombre de la clienta (si falta, usa 'clienta'). */
  nombreClienta?: string | null;
  /** Nombre del servicio cotizado. */
  servicioNombre: string;
  /** Nombre del salón (si falta, usa 'Tu salón'). */
  salonNombre?: string | null;
  /** Precio cotizado en COP (número o texto ya formateado). */
  precio: number | string;
  /** Fecha límite de vigencia (`YYYY-MM-DD`, texto ya formateado o `Date`). */
  vigenciaHasta: string | Date;
  /** UUID v4 del link público de la cotización (`token_publico`). */
  tokenPublico: string;
  /** Override opcional de URL base (por defecto `APP_URL` de `lib/sitio.ts`). */
  appUrl?: string;
}

export interface DatosEnlaceWhatsAppCotizacion extends DatosMensajeCotizacion {
  telefonoClienta?: string | null;
}

/** Formatea un monto entero en pesos colombianos: `182000` → `"$182.000"`. */
export function formatearPrecioCop(monto: number): string {
  const entero = Math.round(Number.isFinite(monto) ? monto : 0);
  const signo = entero < 0 ? '-' : '';
  const abs = Math.abs(entero)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${abs}`;
}

/**
 * Formatea una fecha `YYYY-MM-DD` (o `Date`) a `DD/MM/YYYY` sin desfase de
 * zona horaria. Si recibe un texto en otro formato, lo conserva limpio.
 */
export function formatearFechaVigencia(fecha: string | Date): string {
  if (fecha instanceof Date) {
    const d = String(fecha.getUTCDate()).padStart(2, '0');
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const y = fecha.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }
  const limpio = fecha.trim();
  const matchIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpio);
  if (matchIso) {
    return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`;
  }
  return limpio;
}

/** Construye la URL pública `/c/<token>` usando `APP_URL` de `lib/sitio.ts`. */
export function urlPublicaCotizacion(tokenPublico: string, appUrl: string = APP_URL): string {
  const base = (appUrl || APP_URL).replace(/\/+$/, '');
  return `${base}/c/${encodeURIComponent(tokenPublico.trim())}`;
}

/**
 * Arma el texto de WhatsApp según §4 de `02-diseno-cotizador.md`:
 * `Hola {nombre}, te comparto la cotización de *{servicio}* en {salón}: *{precio}*. Válida hasta el {fecha}. {link}`
 */
export function armarMensajeWhatsAppCotizacion(datos: DatosMensajeCotizacion): string {
  const nombre = datos.nombreClienta?.trim() || 'clienta';
  const servicio = datos.servicioNombre.trim();
  const salon = datos.salonNombre?.trim() || 'Tu salón';
  const precioTexto =
    typeof datos.precio === 'number' ? formatearPrecioCop(datos.precio) : datos.precio.trim();
  const fechaTexto = formatearFechaVigencia(datos.vigenciaHasta);
  const link = urlPublicaCotizacion(datos.tokenPublico, datos.appUrl);

  return `Hola ${nombre}, te comparto la cotización de *${servicio}* en ${salon}: *${precioTexto}*. Válida hasta el ${fechaTexto}. ${link}`;
}

/**
 * Devuelve el mensaje, el link público `/c/<token>` y la URL completa `wa.me`
 * (con indicativo +57 normalizado por `lib/whatsapp.ts`).
 */
export function armarEnlaceWhatsAppCotizacion(datos: DatosEnlaceWhatsAppCotizacion): {
  mensaje: string;
  linkPublico: string;
  urlWhatsApp: string;
} {
  const linkPublico = urlPublicaCotizacion(datos.tokenPublico, datos.appUrl);
  const mensaje = armarMensajeWhatsAppCotizacion(datos);
  const urlWhatsApp = enlaceWhatsApp(datos.telefonoClienta, mensaje);
  return {
    mensaje,
    linkPublico,
    urlWhatsApp,
  };
}

/** Normaliza el color hexadecimal del salón o cae al verde Velli por defecto. */
export function normalizarColorSalon(color?: string | null): string {
  if (!color) return COLOR_VELLI;
  const limpio = color.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(limpio) ? limpio : COLOR_VELLI;
}

/** Extrae la IP del cliente desde los encabezados HTTP para rate-limiting. */
export function extraerIpDesdeHeaders(hdrs: { get(name: string): string | null }): string {
  const xff = hdrs.get('x-forwarded-for');
  if (xff) {
    const primera = xff.split(',')[0]?.trim();
    if (primera) return primera;
  }
  const realIp = hdrs.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'anon';
}

/**
 * Construye los metadatos OpenGraph y `robots: noindex` para `/c/[token]` (§4).
 * Muestra la marca Velli únicamente cuando `conMarcaVelli` es `true`.
 */
export function construirMetadataCotizacion(cotizacion: CotizacionPublica | null): Metadata {
  if (!cotizacion) {
    return {
      title: 'Cotización no disponible',
      description: 'Esta cotización no existe o ya no está disponible.',
      robots: ROBOTS_NOINDEX,
    };
  }

  const titulo = `Cotización · ${cotizacion.salon}`;
  const precioTexto = formatearPrecioCop(cotizacion.precio);
  const vigenciaTexto = formatearFechaVigencia(cotizacion.vigenciaHasta);
  const descripcionBase = `${cotizacion.servicio}: ${precioTexto} ${cotizacion.moneda} · Válida hasta el ${vigenciaTexto}.`;
  const descripcion = cotizacion.conMarcaVelli
    ? `${descripcionBase} Cotización hecha con Velli.`
    : descripcionBase;

  return {
    title: titulo,
    description: descripcion,
    robots: ROBOTS_NOINDEX,
    openGraph: {
      type: 'website',
      title: titulo,
      description: descripcion,
      siteName: cotizacion.conMarcaVelli ? 'Velli' : cotizacion.salon,
      locale: 'es_CO',
    },
    twitter: {
      card: 'summary',
      title: titulo,
      description: descripcion,
    },
  };
}
