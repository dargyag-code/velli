'use client';
import { useEffect, useState } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import { TOAST_EVENT_NAME, type ToastPayload } from '@/lib/toast';

const DURATION = 2600;

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const t = (ev as CustomEvent<ToastPayload>).detail;
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((p) => p.id !== t.id));
      }, DURATION);
    };
    window.addEventListener(TOAST_EVENT_NAME, handler);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((p) => p.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-24 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const palette =
          t.kind === 'success'
            ? { bg: '#2D5A27', fg: '#FFFFFF', icon: <Check size={16} /> }
            : t.kind === 'error'
            ? { bg: '#B23A48', fg: '#FFFFFF', icon: <AlertCircle size={16} /> }
            : { bg: '#1A2E1A', fg: '#FFFFFF', icon: <Info size={16} /> };

        return (
          <div
            key={t.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg pointer-events-auto velli-toast-enter max-w-sm"
            style={{ backgroundColor: palette.bg, color: palette.fg }}
          >
            <span className="shrink-0">{palette.icon}</span>
            <span className="text-sm font-semibold flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
