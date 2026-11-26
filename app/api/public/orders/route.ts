import { headers } from 'next/headers';
import { checkRateLimit, publicOrderLimiter } from '@/lib/api/rateLimit';
import { extraerIpDesdeHeaders } from '@/lib/cotizador/whatsapp';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  armarMensajeWhatsAppPedido,
  esSlugVitrinaValido,
  generarCodigoPedido,
  validarYCalcularPedidoPublico,
} from '@/lib/vitrina/motor';
import { cargarVitrinaServidorPorSlug } from '@/lib/vitrina/servidor';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function POST(req: Request) {
  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(publicOrderLimiter(), `public_order:${ip}`);
  if (!rl.ok) {
    return Response.json(
      { error: 'Demasiados pedidos desde tu red. Espera unos minutos e intenta de nuevo.' },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json(
      { error: 'Solicitud inválida' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const slugRaw = (body as { organizationSlug?: unknown }).organizationSlug;
  if (!esSlugVitrinaValido(slugRaw)) {
    return Response.json(
      { error: 'Organización no encontrada' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const cargado = await cargarVitrinaServidorPorSlug(slugRaw);
    if (!cargado) {
      return Response.json(
        { error: 'Vitrina no disponible' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const validacion = validarYCalcularPedidoPublico(body, {
      products: cargado.storefront.products,
      services: cargado.storefront.services,
    });

    if (!validacion.ok) {
      return Response.json(
        { error: validacion.error },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const admin = createAdminClient();
    const orgId = cargado.storefront.organization.id;

    // Resuelve teléfono WhatsApp del salón (desde `organizations` o perfil del owner)
    let salonWhatsapp = cargado.whatsappPhone;
    if (!salonWhatsapp) {
      const { data: profRow } = await admin
        .from('profiles')
        .select('telefono')
        .eq('id', orgId)
        .maybeSingle();
      salonWhatsapp =
        ((profRow as { telefono?: string | null } | null)?.telefono ?? '').trim() || null;
    }

    // Persistir el pedido en `public_orders` ANTES de devolver el enlace `wa.me`
    let orderId = '';
    let orderCode = '';
    let guardado = false;

    for (let intento = 0; intento < 3; intento += 1) {
      const candidatoCodigo = generarCodigoPedido();
      const { data: insertado, error: insertErr } = await admin
        .from('public_orders')
        .insert({
          organization_id: orgId,
          order_code: candidatoCodigo,
          customer_name: validacion.customerName,
          customer_phone: validacion.customerPhone,
          order_type: validacion.orderType,
          items_json: validacion.items,
          total_cop: validacion.totalCop,
          notes: validacion.notes,
          status: 'sent_to_whatsapp',
        })
        .select('id, order_code')
        .single();

      if (!insertErr && insertado) {
        const row = insertado as { id: string; order_code: string };
        orderId = row.id;
        orderCode = row.order_code;
        guardado = true;
        break;
      }

      // 23505 = colisión de `order_code` único; reintenta con nuevo código
      if (insertErr?.code !== '23505') {
        console.error('[api.public.orders.insert]', insertErr);
        return Response.json(
          { error: 'No se pudo registrar tu pedido. Intenta nuevamente.' },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }
    }

    if (!guardado || !orderCode) {
      return Response.json(
        { error: 'No se pudo generar el código de pedido. Intenta nuevamente.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const { mensaje, whatsappUrl } = armarMensajeWhatsAppPedido({
      orderCode,
      salonName: cargado.storefront.brand.displayName,
      salonWhatsapp,
      customerName: validacion.customerName,
      customerPhone: validacion.customerPhone,
      orderType: validacion.orderType,
      items: validacion.items,
      totalCop: validacion.totalCop,
      notes: validacion.notes,
    });

    return Response.json(
      {
        ok: true,
        orderId,
        orderCode,
        totalCop: validacion.totalCop,
        whatsappUrl,
        message: mensaje,
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('[api.public.orders.unexpected]', err);
    return Response.json(
      { error: 'Servicio temporalmente no disponible' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
