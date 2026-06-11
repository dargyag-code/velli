import type { NextConfig } from "next";

// CSP moderada: permite 'unsafe-inline' en style-src y script-src porque la
// app usa estilos inline editorial intensivos y Next inyecta scripts inline
// para hidratación. img-src incluye data: y blob: para previsualización de
// fotos del wizard, y supabase para signed URLs. connect-src cubre supabase
// (cliente browser → DB/storage) + Anthropic/OpenAI (route handlers, no
// estrictamente necesario desde el browser pero se incluye para consistencia).
//
// Solo en desarrollo (next dev) se relaja: React requiere eval() para
// reconstruir stacks de error del servidor en el browser ('unsafe-eval' en
// script-src) y el HMR de Turbopack abre un WebSocket (ws:/wss: en
// connect-src). En producción la política queda exactamente igual.
const isDev = process.env.NODE_ENV === 'development';

const CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''} https://*.supabase.co https://*.supabase.in https://api.anthropic.com https://api.openai.com`,
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ['192.168.100.100'],
  experimental: {
    // Tope de body buffereado por el proxy. Default 10MB, aquí 5MB.
    // No rechaza el request automáticamente — sólo recorta. La validación
    // por foto vive en cada route handler (1.2MB c/u, 5 fotos máx).
    proxyClientMaxBodySize: '5mb',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
