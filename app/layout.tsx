import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ToastHost from '@/components/ui/ToastHost';
import { APP_URL } from '@/lib/sitio';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

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

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  // Base de las URLs relativas de Open Graph y Twitter (vista previa en
  // WhatsApp y redes): sale de NEXT_PUBLIC_APP_URL, ver lib/sitio.ts.
  metadataBase: new URL(APP_URL),
  title: 'Velli · Business Intelligence para Salones',
  description:
    'Velli Business Intelligence: diagnóstico capilar táctil, cotización precisa sin báscula, cierre financiero en un toque y liquidación de especialistas.',
  applicationName: 'Velli BI',
  icons: {
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Velli BI',
  },
  openGraph: {
    type: 'website',
    siteName: 'Velli Business Intelligence',
    title: 'Velli · Business Intelligence para Salones',
    description:
      'Cotización capilar sin báscula, control de costo químico y rentabilidad real por servicio.',
    locale: 'es_CO',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Velli Business Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Velli · Business Intelligence para Salones',
    description: 'Cotización capilar sin báscula y rentabilidad real para salones.',
    images: ['/icons/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#3B0D1E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${dmSerifDisplay.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className="velli-grain"
        style={{
          fontFamily: 'var(--font-sans)',
          backgroundColor: 'var(--bg)',
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
