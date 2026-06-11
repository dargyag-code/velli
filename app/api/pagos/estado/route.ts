import { requireUser } from '@/lib/api/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments';

// ── GET /api/pagos/estado?ref=… ────────────────────────────────────────────
// Estado de un pago propio + reconciliación activa: si sigue pending,
// consulta al proveedor directamente — cubre el caso "pagué pero el webhook
// no ha llegado" cuando la estilista vuelve del checkout. La aplicación del
// pago pasa por la MISMA RPC idempotente que el webhook: si ambos caminos
// corren, el segundo es no-op.
// Respuesta: { pago, suscripcion: { estado, plan, vence, diasRestantes } }

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  const ref = new URL(req.url).searchParams.get('ref');
  if (!ref) {
    return Response.json({ error: 'Falta el parámetro ref' }, { status: 400 });
  }

  // Lectura con el cliente del usuario: RLS (payments_select_own) garantiza
  // que solo ve sus propios pagos — un ref ajeno devuelve 404, no datos.
  const { data: pago, error } = await supabase
    .from('payments')
    .select('id, status, plan, provider_link_id')
    .eq('reference', ref)
    .maybeSingle();

  if (error) {
    console.error('[pagos.estado] lectura falló:', error);
    return Response.json({ error: 'No se pudo consultar el pago' }, { status: 500 });
  }
  if (!pago) {
    return Response.json({ error: 'Pago no encontrado' }, { status: 404 });
  }

  let estadoPago: string = pago.status;

  if (estadoPago === 'pending' && pago.provider_link_id) {
    try {
      const provider = getPaymentProvider();
      const remoto = await provider.getCheckoutStatus(pago.provider_link_id);
      const admin = createAdminClient();

      if (remoto.estado === 'pagado') {
        const { data: resultado, error: rpcError } = await admin.rpc('procesar_evento_pago', {
          p_tipo: 'approved',
          p_reference: ref,
          p_provider_payment_id: remoto.providerPaymentId,
          p_amount: null,
          p_metodo: remoto.metodo,
          p_raw: remoto.crudo,
        });
        if (rpcError) {
          console.error('[pagos.estado] reconciliación falló:', rpcError);
        } else if (resultado === 'applied' || resultado === 'already_applied') {
          estadoPago = 'approved';
        }
      } else if (remoto.estado === 'rechazado' || remoto.estado === 'cancelado') {
        const tipo = remoto.estado === 'cancelado' ? 'voided' : 'rejected';
        await admin.rpc('procesar_evento_pago', {
          p_tipo: tipo,
          p_reference: ref,
          p_provider_payment_id: remoto.providerPaymentId,
          p_amount: null,
          p_metodo: remoto.metodo,
          p_raw: remoto.crudo,
        });
        estadoPago = tipo === 'voided' ? 'voided' : 'rejected';
      } else if (remoto.estado === 'expirado') {
        // La RPC no maneja 'expired' (no afecta la suscripción): update directo.
        await admin.from('payments').update({ status: 'expired' }).eq('id', pago.id);
        estadoPago = 'expired';
      }
      // 'activo' / 'procesando' / 'desconocido': sigue pending, se reintenta.
    } catch (e) {
      // Reconciliación es best-effort: si el proveedor no responde, se
      // devuelve pending y el polling del cliente reintenta.
      console.warn('[pagos.estado] proveedor no respondió:', e);
    }
  }

  // Estado efectivo de la suscripción (con el JWT del usuario: auth.uid()).
  const { data: subRows, error: subError } = await supabase.rpc('suscripcion_efectiva');
  if (subError) {
    console.error('[pagos.estado] suscripcion_efectiva falló:', subError);
  }
  const sub = Array.isArray(subRows) ? subRows[0] : subRows;

  return Response.json({
    pago: estadoPago,
    plan: pago.plan,
    suscripcion: sub
      ? {
          estado: sub.estado as string,
          plan: (sub.plan as string | null) ?? null,
          vence: (sub.vence as string | null) ?? null,
          diasRestantes: (sub.dias_restantes as number | null) ?? null,
        }
      : null,
  });
}
