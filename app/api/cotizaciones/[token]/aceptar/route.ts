import { headers } from 'next/headers';
import { checkRateLimit, cotizacionPublicaLimiter } from '@/lib/api/rateLimit';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';
import { createAdminClient } from '@/lib/supabase/admin';
import { esUuidValido, extraerIpDesdeHeaders } from '@/lib/cotizador';

// ── POST /api/cotizaciones/[token]/aceptar ─────────────────────────────────
// Registra la aceptación digital de condiciones desde `/c/[token]` dentro de
// `cotizaciones.perfil_extendido` (ignorando cualquier payload del cliente) y,
// si la cotización está vinculada a una clienta (`clienta_id`), sincroniza el
// consentimiento químico vigente en `public.consentimientos_clienta` para que
// `SeguridadLegal.tsx` en `/clientas/[id]` lo refleje automáticamente.

function fechaBogotaIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!esUuidValido(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 400 });
  }

  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(cotizacionPublicaLimiter(), `aceptar:${ip}`);
  if (!rl.ok) {
    return Response.json(
      { error: 'Demasiados intentos. Espera un momento.' },
      { status: 429 }
    );
  }

  try {
    // Se ignora deliberadamente cualquier body enviado por el cliente.
    const admin = createAdminClient();
    const { data: fila, error: selectErr } = await admin
      .from('cotizaciones')
      .select('id, user_id, clienta_id, estado, vigencia_hasta, perfil_extendido')
      .eq('token_publico', token.trim())
      .maybeSingle();

    if (selectErr || !fila) {
      return Response.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const row = fila as {
      id: string;
      user_id: string;
      clienta_id: string | null;
      estado: string;
      vigencia_hasta: string;
      perfil_extendido: Record<string, unknown> | null;
    };

    if (row.estado !== 'enviada') {
      return Response.json(
        { error: 'Esta cotización ya no admite modificaciones de aceptación' },
        { status: 409 }
      );
    }

    const hoy = fechaBogotaIso();
    if (row.vigencia_hasta && row.vigencia_hasta < hoy) {
      return Response.json({ error: 'Cotización vencida' }, { status: 409 });
    }

    const actual = row.perfil_extendido ?? {};
    const ahoraIso = new Date().toISOString();
    const aceptadoAt =
      typeof actual['consentimientoAceptadoAt'] === 'string' && actual['consentimientoAceptadoAt']
        ? actual['consentimientoAceptadoAt']
        : ahoraIso;

    const { error: updateErr } = await admin
      .from('cotizaciones')
      .update({
        perfil_extendido: {
          ...actual,
          consentimientoAceptado: true,
          consentimientoAceptadoAt: aceptadoAt,
          consentimientoCanal: 'link_publico_whatsapp',
        },
      })
      .eq('id', row.id)
      .eq('estado', 'enviada');

    if (updateErr) {
      console.error('[cotizacion.aceptar]', updateErr);
      return Response.json({ error: 'No se pudo registrar la aceptación' }, { status: 500 });
    }

    // Sincronizar con `consentimientos_clienta` si la cotización tiene `clienta_id`
    if (row.clienta_id) {
      try {
        const versionQuimico = CONSENTIMIENTO_VERSIONES.consentimiento_quimico;
        const { data: existente } = await admin
          .from('consentimientos_clienta')
          .select('id')
          .eq('clienta_id', row.clienta_id)
          .eq('user_id', row.user_id)
          .eq('tipo', 'consentimiento_quimico')
          .eq('version_aceptada', versionQuimico)
          .eq('aceptado', true)
          .limit(1)
          .maybeSingle();

        if (!existente) {
          const { data: clientaRow } = await admin
            .from('clientas')
            .select('nombre')
            .eq('id', row.clienta_id)
            .eq('user_id', row.user_id)
            .maybeSingle();

          const nombreBase = (
            (clientaRow as { nombre?: string | null } | null)?.nombre ?? ''
          ).trim();
          // Cumple el CHECK `char_length(btrim(nombre_firmante)) >= 5`
          const nombreFirmante =
            nombreBase.length >= 5
              ? `${nombreBase} (Aceptación digital)`
              : `${nombreBase || 'Clienta'} · Aceptación digital`;

          const { error: consErr } = await admin.from('consentimientos_clienta').insert({
            user_id: row.user_id,
            clienta_id: row.clienta_id,
            tipo: 'consentimiento_quimico',
            version_aceptada: versionQuimico,
            nombre_firmante: nombreFirmante,
            aceptado: true,
            firmado_at: aceptadoAt,
          });

          if (consErr && consErr.code !== '42P01') {
            console.warn('[cotizacion.aceptar.consentimiento_clienta]', consErr);
          }
        }
      } catch (syncErr) {
        console.warn('[cotizacion.aceptar.sync]', syncErr);
      }
    }

    return Response.json({ ok: true, aceptadoAt });
  } catch (err) {
    console.error('[cotizacion.aceptar.unexpected]', err);
    return Response.json({ error: 'Servicio temporalmente no disponible' }, { status: 500 });
  }
}
