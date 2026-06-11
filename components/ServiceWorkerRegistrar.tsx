'use client';
import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Solo producción: en dev el SW intercepta el HMR de Turbopack y puede
    // servir un shell viejo. Si quedó uno registrado de una visita anterior
    // (p.ej. probando el build de prod en localhost), se desregistra.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  }, []);

  return null;
}
