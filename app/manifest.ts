import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Veli',
    short_name: 'Veli',
    description:
      'Control financiero sin báscula, agenda conectada a WhatsApp y rentabilidad real por servicio.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAFA',
    theme_color: '#111111',
    orientation: 'portrait',
    lang: 'es-CO',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Cotizar en silla',
        short_name: 'Silla',
        description: 'Iniciar diagnóstico y cotización sin báscula',
        url: '/',
      },
      {
        name: 'Por Cobrar',
        short_name: 'Por Cobrar',
        description: 'Cerrar servicios pendientes en un toque',
        url: '/?tab=cierre',
      },
      {
        name: 'Agenda',
        short_name: 'Agenda',
        description: 'Ver citas del día y pasar a silla',
        url: '/agenda',
      },
    ],
  };
}
