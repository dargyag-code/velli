import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
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

export const metadata: Metadata = {
  title: 'Velli Pro — Inteligencia capilar a tu alcance',
  description: 'Diagnóstico capilar profesional para todo tipo de cabello',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Velli',
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
        style={{
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          backgroundColor: '#F5F0E8',
          minHeight: '100vh',
        }}
      >
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
