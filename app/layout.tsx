import type { Metadata, Viewport } from 'next';
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ToastHost from '@/components/ui/ToastHost';
import { APP_URL } from '@/lib/sitio';
import './globals.css';

// Las 3 familias son variable fonts en Google Fonts: omitir `weight` solicita
// el eje variable completo (incluyendo 400/500/600/700) en un único archivo
// .woff2 estático por subset y evita las URLs dinámicas `/l/font?kit=...&skey=...`
// que rompen el parser de queries de Turbopack en Next.js 16.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
      className={`${plusJakartaSans.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="velli-grain font-sans bg-[#FAF7F5] text-[#3B0D1E] min-h-screen antialiased">
        {children}
        <ToastHost />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
