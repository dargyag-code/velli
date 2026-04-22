import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ToastHost from '@/components/ui/ToastHost';
import './globals.css';

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://velli.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Velli Pro — Inteligencia capilar a tu alcance',
  description:
    'Velli Pro es la herramienta profesional para estilistas: diagnóstico capilar con IA, planes de tratamiento personalizados e historial de clientas para todo tipo de cabello (1A–4C).',
  applicationName: 'Velli Pro',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Velli',
  },
  openGraph: {
    type: 'website',
    siteName: 'Velli Pro',
    title: 'Velli Pro — Inteligencia capilar a tu alcance',
    description:
      'Diagnóstico capilar profesional con IA y planes de tratamiento personalizados para estilistas.',
    locale: 'es_CO',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Velli Pro',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Velli Pro — Inteligencia capilar a tu alcance',
    description: 'Diagnóstico capilar profesional con IA para estilistas.',
    images: ['/icons/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#2D5A27',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSerifDisplay.variable} ${dmSans.variable}`}>
      <head>
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className="velli-grain"
        style={{
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          backgroundColor: '#F5F0E8',
          minHeight: '100vh',
        }}
      >
        {children}
        <ToastHost />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
