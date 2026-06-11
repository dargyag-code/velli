import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments';

// ── POST /api/pagos/webhook ────────────────────────────────────────────────
// Endpoint público que recibe los eventos de pago del proveedor (Bold).
// Seguridad: firma HMAC verificada timing-safe ANTES de parsear nada; sin
// firma válida no se toca la DB. Idempotencia: vive en la RPC
// procesar_evento_pago (reintentos del proveedor = no-op).
// Regla de respuesta: 2xx para todo evento entendido (aunque se ignore),
// para que el proveedor no reintente eternamente; 5xx solo en fallas
// transitorias nuestras (DB caída) donde SÍ queremos el reintento.

export async function POST(req: Request) {
  const rawBody = await req.text();
  const firma = req.headers.get('x-bold-signature');

  const provider = getPaymentProvider();
  if (!provider.verifyWebhook(rawBody, firma)) {
    console.warn('[pagos.webhook] firma inválida — evento descartado');
    return Response.json({ error: 'Firma inválida' }, { status: 401 });
  }

  const evento = provider.parseWebhook(rawBody);
  if (!evento) {
    return Response.json({ error: 'Payload inválido' }, { status: 400 });
  }

  if (evento.tipo === 'ignored') {
    return Response.json({ ok: true, resultado: 'ignored' });
  }

  if (!evento.referencia) {
    // Pago hecho fuera de nuestros links (sin metadata.reference). Se loguea
    // para auditoría manual, pero no hay fila contra la cual aplicarlo.
    console.warn('[pagos.webhook] evento sin referencia:', evento.providerPaymentId);
    return Response.json({ ok: true, resultado: 'sin_referencia' });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('procesar_evento_pago', {
      p_tipo: evento.tipo,
      p_reference: evento.referencia,
      p_provider_payment_id: evento.providerPaymentId,
      p_amount: evento.montoCop,
      p_metodo: evento.metodo,
      p_raw: evento.crudo,
    });

    if (error) {
      console.error('[pagos.webhook] procesar_evento_pago falló:', error);
      Sentry.captureException(error, {
        tags: { area: 'pagos', endpoint: 'webhook', etapa: 'rpc' },
      });
      return Response.json({ error: 'Error procesando el evento' }, { status: 500 });
    }

    if (data === 'unknown_reference') {
      console.warn('[pagos.webhook] referencia desconocida:', evento.referencia);
    }

    // Funnel beta: primer pago aplicado de la cuenta. Best-effort (el UNIQUE
    // en DB dedupe los siguientes); jamás afecta la respuesta al proveedor.
    if (data === 'applied') {
      const { data: pago } = await admin
        .from('payments')
        .select('user_id')
        .eq('reference', evento.referencia)
        .maybeSingle();
      if (pago?.user_id) {
        await admin
          .from('eventos_activacion')
          .upsert(
            { user_id: pago.user_id, evento: 'pago' },
            { onConflict: 'user_id,evento', ignoreDuplicates: true }
          );
      }
    }

    return Response.json({ ok: true, resultado: data });
  } catch (e) {
    console.error('[pagos.webhook] error inesperado:', e);
    Sentry.captureException(e, { tags: { area: 'pagos', endpoint: 'webhook' } });
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
