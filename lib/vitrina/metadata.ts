import type { Metadata } from 'next';
import { APP_URL } from '@/lib/sitio';
import { sanitizarPayloadVitrinaPublica } from './motor';
import type { PublicStorefrontData } from './tipos';

function esUrlImagenPublicaSegura(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const limpia = url.trim();
  if (!limpia || limpia.length > 1024) return null;
  if (limpia.startsWith('https://')) return limpia;
  if (limpia.startsWith('/') && !limpia.startsWith('//')) {
    return `${APP_URL}${limpia}`;
  }
  return null;
}

/**
 * Construye metadatos SEO, OpenGraph y Twitter para `/s/[slug]` proyectando
 * exclusivamente campos públicos autorizados (`display_name`, `public_tagline`,
 * `logo_url`, `city`, `slug`). Si la vitrina no existe o está desactivada,
 * retorna `noindex, nofollow`.
 */
export function construirMetadataVitrinaPublica(
  storefront: PublicStorefrontData | null | undefined
): Metadata {
  const seguro = storefront ? sanitizarPayloadVitrinaPublica(storefront) : null;

  if (!seguro) {
    return {
      title: 'Vitrina no disponible',
      robots: { index: false, follow: false },
    };
  }

  const displayName = seguro.brand.displayName.trim() || seguro.organization.name.trim();
  const city = seguro.organization.city?.trim() || null;
  const publicTagline = seguro.brand.publicTagline?.trim() || null;
  const logoUrl = esUrlImagenPublicaSegura(seguro.brand.logoUrl);
  const canonicalUrl = `${APP_URL}/s/${encodeURIComponent(seguro.organization.slug)}`;

  const title = city
    ? `${displayName} · ${city} | Servicios y Tienda`
    : `${displayName} · Servicios y Tienda`;

  const description =
    publicTagline ||
    (city
      ? `Agenda tu cita y explora el menú de servicios y tienda profesional de ${displayName} en ${city}.`
      : `Agenda tu cita y explora el menú de servicios y tienda profesional de ${displayName}.`);

  const ogImages = logoUrl
    ? [{ url: logoUrl, alt: `Identidad visual de ${displayName}` }]
    : undefined;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      description,
      siteName: displayName,
      locale: 'es_CO',
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: logoUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(logoUrl ? { images: [logoUrl] } : {}),
    },
  };
}
