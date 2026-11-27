import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Ratelimit } from '@upstash/ratelimit';

const mockCargarVitrinaServidor = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? '181.50.10.20' : null),
  }),
}));

vi.mock('next/cache', () => ({
  unstable_noStore: () => {},
}));

vi.mock('@/lib/vitrina/servidor', () => ({
  cargarVitrinaServidorPorSlug: (...args: unknown[]) => mockCargarVitrinaServidor(...args),
}));

import nextConfig from '@/next.config';
import { checkRateLimit } from '@/lib/api/rateLimit';
import {
  construirMetadataVitrinaPublica,
  resolverUrlBasePublica,
} from '@/lib/vitrina/metadata';
import type { PublicStorefrontData } from '@/lib/vitrina/tipos';

const ROOT = path.resolve(__dirname, '..');

function crearErrorUpstashEnofoundReal(): TypeError {
  const dnsCause = Object.assign(
    new Error('getaddrinfo ENOTFOUND leading-lizard-120203.upstash.io'),
    {
      errno: -3008,
      code: 'ENOTFOUND',
      syscall: 'getaddrinfo',
      hostname: 'leading-lizard-120203.upstash.io',
    }
  );
  return new TypeError('fetch failed', { cause: dnsCause });
}

const STOREFRONT_PROD_SIN_PRODUCTOS: PublicStorefrontData = {
  organization: {
    id: 'org-76712a54',
    slug: 'velli-76712a54',
    name: 'Estudio Veli Piloto',
    city: 'Bogotá',
    vertical: 'hair_studio',
    conMarcaVelli: true,
  },
  brand: {
    organizationId: 'org-76712a54',
    displayName: 'Estudio Veli Piloto',
    logoUrl:
      'https://ejemplo.supabase.co/storage/v1/object/public/vitrina-media/org-76712a54/logo.webp',
    primaryColor: '#111111',
    accentColor: '#52525B',
    publicTagline: 'Colorimetría y diseño capilar de precisión',
    legalFooter: null,
  },
  services: [
    {
      id: 'srv-1',
      name: 'Balayage Iluminación',
      category: 'decoloracion',
      durationMinutes: 210,
      priceCop: 240000,
      sortOrder: 0,
    },
  ],
  products: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  mockCargarVitrinaServidor.mockReset();
});

describe('Resiliencia en producción de /s/[slug] (Upstash ENOTFOUND, URLs sin protocolo y Storage)', () => {
  it('degrada en modo fail-open cuando Upstash falla con TypeError: fetch failed (ENOTFOUND leading-lizard-120203.upstash.io)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const limiterCaido = {
      limit: vi.fn().mockRejectedValue(crearErrorUpstashEnofoundReal()),
    } as unknown as Ratelimit;

    const resultado = await checkRateLimit(limiterCaido, 'vitrina:181.50.10.20');

    expect(resultado.ok).toBe(true);
    expect(resultado.remaining).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('renderiza StorefrontPublicPage y generateMetadata para velli-76712a54 sin caer en global-error cuando Upstash lanza ENOTFOUND y catalog_products está vacío', async () => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://leading-lizard-120203.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token-upstash-invalido');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(crearErrorUpstashEnofoundReal());

    mockCargarVitrinaServidor.mockResolvedValue({
      storefront: STOREFRONT_PROD_SIN_PRODUCTOS,
      whatsappPhone: '573001234567',
    });

    const { default: StorefrontPublicPage, generateMetadata } = await import(
      '@/app/s/[slug]/page'
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'velli-76712a54' }),
    });
    expect(metadata.title).toContain('Estudio Veli Piloto');

    const elemento = await StorefrontPublicPage({
      params: Promise.resolve({ slug: 'velli-76712a54' }),
    });
    expect(elemento).toBeTruthy();
    expect(elemento.props.data.organization.slug).toBe('velli-76712a54');
    expect(elemento.props.data.products).toEqual([]);
    expect(fetchSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('normaliza NEXT_PUBLIC_APP_URL sin protocolo en metadata pública sin lanzar TypeError: Invalid URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'velli-three.vercel.app');

    expect(resolverUrlBasePublica()).toBe('https://velli-three.vercel.app');
    expect(resolverUrlBasePublica('miestudio.co/ruta-extra/')).toBe('https://miestudio.co');
    expect(resolverUrlBasePublica(':::url-rota:::')).toBe('https://velli-three.vercel.app');

    const meta = construirMetadataVitrinaPublica({
      ...STOREFRONT_PROD_SIN_PRODUCTOS,
      brand: {
        ...STOREFRONT_PROD_SIN_PRODUCTOS.brand,
        logoUrl: '/icon.svg',
      },
    });

    expect(meta.alternates?.canonical).toBe('https://velli-three.vercel.app/s/velli-76712a54');
    expect(meta.twitter).toMatchObject({
      images: ['https://velli-three.vercel.app/icon.svg'],
    });
  });

  it('declara remotePatterns de Supabase Storage para vitrina-media en next.config.ts y muestra marca Veli limpia en Configuración', () => {
    const patterns = nextConfig.images?.remotePatterns ?? [];
    expect(patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: 'https',
          hostname: '**.supabase.co',
          pathname: '/storage/v1/object/public/vitrina-media/**',
        }),
      ])
    );

    const configPage = readFileSync(path.join(ROOT, 'app/configuracion/page.tsx'), 'utf8');
    expect(configPage).toContain('<VeliLogoMark');
    expect(configPage).not.toContain('Business Intelligence');
    expect(configPage).not.toMatch(/>\s*velli\s*\{/i);
  });
});
