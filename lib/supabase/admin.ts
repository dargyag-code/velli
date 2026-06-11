import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// ── Cliente admin (service_role) — SOLO server-side ───────────────────────
// Bypasea RLS: las tablas de pagos/suscripciones no tienen policies de
// escritura para `authenticated`, toda mutación entra por aquí (webhook,
// checkout, reconciliación). Nunca importar desde código de cliente; la
// llave vive solo en el server (sin prefijo NEXT_PUBLIC_).

let _admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no configurada. Ver .env.local.example y PAGOS.md.'
    );
  }

  _admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
