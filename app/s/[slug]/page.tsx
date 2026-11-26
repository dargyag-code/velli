import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { checkRateLimit, vitrinaPublicaLimiter } from '@/lib/api/rateLimit';
import { extraerIpDesdeHeaders } from '@/lib/cotizador/whatsapp';
import { APP_HOST } from '@/lib/sitio';
import VitrinaPublicaClient from '@/components/vitrina/VitrinaPublicaClient';
import { esSlugVitrinaValido } from '@/lib/vitrina/motor';
import { cargarVitrinaServidorPorSlug } from '@/lib/vitrina/servidor';
import type { PublicStorefrontData } from '@/lib/vitrina/tipos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface EstadoCargaVitrina {
  estado: 'ok' | 'no_encontrada' | 'rate_limited';
  storefront: PublicStorefrontData | null;
}

const cargarVitrinaEnPeticion = cache(async (slug: string): Promise<EstadoCargaVitrina> => {
  noStore();

  if (!esSlugVitrinaValido(slug)) {
    return { estado: 'no_encontrada', storefront: null };
  }

  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(vitrinaPublicaLimiter(), `vitrina:${ip}`);
  if (!rl.ok) {
    return { estado: 'rate_limited', storefront: null };
  }

  try {
    const res = await cargarVitrinaServidorPorSlug(slug);
    if (!res) {
      return { estado: 'no_encontrada', storefront: null };
    }
    return { estado: 'ok', storefront: res.storefront };
  } catch (err) {
    console.error('[vitrina-publica]', err);
    return { estado: 'no_encontrada', storefront: null };
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { storefront } = await cargarVitrinaEnPeticion(slug);

  if (!storefront) {
    return {
      title: 'Vitrina no disponible',
      robots: { index: false, follow: false },
    };
  }

  const title = `${storefront.brand.displayName} · Servicios y Tienda`;
  const description =
    storefront.brand.publicTagline ||
    `Explora el menú de servicios y productos profesionales de ${storefront.brand.displayName}.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: storefront.brand.displayName,
      locale: 'es_CO',
    },
  };
}

export default async function StorefrontPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { estado, storefront } = await cargarVitrinaEnPeticion(slug);

  if (estado === 'rate_limited') {
    return (
      <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md mx-auto bg-white rounded-3xl border border-[#EFE8E4] p-7 text-center shadow-velvet">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#3B0D1E] mb-2">
            Demasiadas consultas
          </h1>
          <p className="font-sans text-sm text-[#6B535C]">
            Por favor espera unos minutos antes de volver a abrir esta vitrina.
          </p>
        </section>
      </main>
    );
  }

  if (!storefront) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md mx-auto bg-white rounded-3xl border border-[#EFE8E4] p-7 text-center shadow-velvet">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#3B0D1E] mb-2">
            Vitrina no encontrada
          </h1>
          <p className="font-sans text-sm text-[#6B535C]">
            Verifica el enlace compartido por tu salón o solicita uno actualizado.
          </p>
        </section>
      </main>
    );
  }

  return <VitrinaPublicaClient data={storefront} appHost={APP_HOST} />;
}
