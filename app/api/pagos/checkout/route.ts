import crypto from 'crypto';
import * as Sentry from '@sentry/nextjs';
import { requireUser } from '@/lib/api/auth';
import { checkoutLimiter, checkRateLimit } from '@/lib/api/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments';
import { PLANES, esPlanId } from '@/lib/subscription/plans';

// ── POST /api/pagos/checkout ───────────────────────────────────────────────
// Crea el payment (pending) y el link de pago hospedado del proveedor.
// El precio sale SIEMPRE de lib/subscription/plans.ts — el cliente solo
// manda el id del plan, nunca el monto.
// Respuesta: { url } para redirigir al checkout.

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const rl = await checkRateLimit(checkoutLimiter(), user.id);
  if (!rl.ok) {
    return Response.json(
      { error: 'Demasiados intentos de pago. Espera unos minutos.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const plan = (body as { plan?: unknown })?.plan;
  if (!esPlanId(plan)) {
    return Response.json({ error: 'Plan desconocido' }, { status: 400 });
  }
  const def = PLANES[plan];

  // Referencia única (≤60 chars, alfanumérico + `_` `-`): llave de match
  // cuando el webhook del proveedor la devuelva en metadata.reference.
  const referencia = `velli_${plan}_${Date.now().toString(36)}_${crypto
    .randomBytes(4)
    .toString('hex')}`;

  const admin = createAdminClient();

  // 1. Persistir el intento ANTES de crear el link: si el webhook llegara
  //    inmediatamente, la referencia ya existe y el match no falla.
  const { data: pago, error: insertError } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      reference: referencia,
      plan,
      amount: def.precioCop,
      currency: 'COP',
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !pago) {
    console.error('[pagos.checkout] insert payments falló:', insertError);
    return Response.json(
      { error: 'No se pudo iniciar el pago. Intenta de nuevo.' },
      { status: 500 }
    );
  }

  // 2. Crear el checkout en el proveedor. urlRetorno trae a la estilista de
  //    vuelta a /planes/confirmacion, donde se reconcilia el estado.
  const origin = new URL(req.url).origin;
  try {
    const provider = getPaymentProvider();
    const checkout = await provider.createCheckout({
      referencia,
      montoCop: def.precioCop,
      descripcion: `Velli Pro — plan ${def.nombre} (30 días)`,
      emailPagador: user.email ?? undefined,
      urlRetorno: `${origin}/planes/confirmacion?ref=${referencia}`,
    });

    await admin
      .from('payments')
      .update({
        checkout_url: checkout.url,
        provider_link_id: checkout.providerLinkId,
      })
      .eq('id', pago.id);

    return Response.json({ url: checkout.url, referencia });
  } catch (e) {
    console.error('[pagos.checkout] proveedor falló:', e);
    Sentry.captureException(e, { tags: { area: 'pagos', endpoint: 'checkout' } });
    await admin.from('payments').update({ status: 'error' }).eq('id', pago.id);
    return Response.json(
      { error: 'La pasarela de pago no respondió. Intenta de nuevo en un momento.' },
      { status: 502 }
    );
  }
}
