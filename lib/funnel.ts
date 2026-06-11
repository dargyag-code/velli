import { createClient } from '@/lib/supabase/client';

// ── Funnel de activación (beta) ─────────────────────────────────────────────
// Hitos por cuenta, una sola vez cada uno (UNIQUE en DB). Registrar un
// evento es fire-and-forget: jamás bloquea ni rompe el flujo de la app —
// si la migración no corrió o no hay red, se pierde el evento y ya.
// 'registro' lo escribe la DB (handle_new_user); 'pago' el webhook.

export type EventoActivacion =
  | 'registro'
  | 'onboarding_completado'
  | 'primera_clienta'
  | 'primer_diagnostico'
  | 'pago';

export const ETAPAS_FUNNEL: { evento: EventoActivacion; label: string }[] = [
  { evento: 'registro', label: 'Registro' },
  { evento: 'onboarding_completado', label: 'Onboarding completado' },
  { evento: 'primera_clienta', label: 'Primera clienta' },
  { evento: 'primer_diagnostico', label: 'Primer diagnóstico' },
  { evento: 'pago', label: 'Pago' },
];

export function registrarEvento(evento: EventoActivacion): void {
  void (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // ignoreDuplicates: el segundo disparo del mismo hito es un no-op
      // silencioso (sin error de unique en consola).
      await supabase
        .from('eventos_activacion')
        .upsert(
          { user_id: user.id, evento },
          { onConflict: 'user_id,evento', ignoreDuplicates: true }
        );
    } catch {
      // Silencio deliberado: el funnel es best-effort.
    }
  })();
}

/** Resumen agregado del funnel (todas las cuentas). Solo responde para
 *  cuentas fundadoras — para el resto la RPC lanza y devolvemos null
 *  (la UI oculta la sección). */
export async function getFunnelActivacion(): Promise<Record<EventoActivacion, number> | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('funnel_activacion');
    if (error || !data) return null;
    const out: Record<EventoActivacion, number> = {
      registro: 0,
      onboarding_completado: 0,
      primera_clienta: 0,
      primer_diagnostico: 0,
      pago: 0,
    };
    for (const row of data as { evento: string; cuentas: number }[]) {
      if (row.evento in out) out[row.evento as EventoActivacion] = Number(row.cuentas);
    }
    return out;
  } catch {
    return null;
  }
}
