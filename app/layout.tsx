import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ToastHost from '@/components/ui/ToastHost';
import { APP_URL } from '@/lib/sitio';
import './globals.css';

// Fuentes variables en Google Fonts: se omite `weight` para compatibilidad
// total con Turbopack en Next.js 16.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: 'Veli · Gestión y Rentabilidad en Cabina',
  description:
    'Veli: control financiero sin báscula, agenda conectada a WhatsApp, vitrina propia y liquidación transparente para negocios de belleza.',
  applicationName: 'Veli',
  icons: {
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Veli',
  },
  openGraph: {
    type: 'website',
    siteName: 'Veli',
    title: 'Veli · Gestión y Rentabilidad en Cabina',
    description:
      'Control de insumos sin báscula, agenda conectada a WhatsApp y utilidad neta real por servicio.',
    locale: 'es_CO',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Veli',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Veli · Gestión y Rentabilidad en Cabina',
    description: 'Cotización sin báscula, agenda y rentabilidad real para estudios.',
    images: ['/icons/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans bg-[#FAFAFA] text-[#111111] min-h-screen antialiased">
        {children}
        <ToastHost />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
