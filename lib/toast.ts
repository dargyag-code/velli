'use client';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastPayload {
  id: string;
  kind: ToastKind;
  message: string;
}

const TOAST_EVENT = 'velli:toast';

export function showToast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return;
  const payload: ToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    message,
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export const TOAST_EVENT_NAME = TOAST_EVENT;
