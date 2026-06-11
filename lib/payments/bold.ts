import crypto from 'crypto';
import type {
  CheckoutParams,
  CheckoutResult,
  EstadoCheckoutResult,
  EventoPago,
  PaymentProvider,
  TipoEventoPago,
} from './types';

// ── Bold Colombia — API Link de Pagos ──────────────────────────────────────
// Docs: https://developers.bold.co
//   · POST /online/link/v1  (crear link) — header `Authorization: x-api-key …`
//   · GET  /online/link/v1/{LNK_xxx}  (estado del link)
//   · Webhook: header `x-bold-signature` = HMAC-SHA256(hex) sobre el
//     base64 del raw body, firmado con la llave secreta. En el ambiente de
//     pruebas Bold firma con llave secreta VACÍA ("").
// La misma URL base sirve pruebas y producción: el ambiente lo determina la
// llave usada (llaves de prueba ⇒ checkout sandbox, is_sandbox=true).

const BOLD_API_BASE = 'https://integrations.api.bold.co';

// Estados que reporta GET /online/link/v1/{id}
const ESTADO_LINK: Record<string, EstadoCheckoutResult['estado']> = {
  ACTIVE: 'activo',
  PROCESSING: 'procesando',
  PAID: 'pagado',
  REJECTED: 'rechazado',
  CANCELLED: 'cancelado',
  EXPIRED: 'expirado',
};

const TIPO_EVENTO: Record<string, TipoEventoPago> = {
  SALE_APPROVED: 'approved',
  SALE_REJECTED: 'rejected',
  VOID_APPROVED: 'voided',
  // VOID_REJECTED: la anulación falló ⇒ el pago sigue como estaba. Se ignora.
};

interface BoldEnv {
  apiKey: string;     // llave de identidad (x-api-key)
  secretKey: string;  // llave secreta (firma de webhooks)
  sandbox: boolean;
}

function env(): BoldEnv {
  const apiKey = process.env.BOLD_API_KEY;
  const secretKey = process.env.BOLD_SECRET_KEY;
  if (!apiKey || secretKey === undefined) {
    throw new Error(
      'BOLD_API_KEY / BOLD_SECRET_KEY no configuradas. Ver .env.local.example y PAGOS.md.'
    );
  }
  return { apiKey, secretKey, sandbox: process.env.BOLD_SANDBOX === 'true' };
}

interface BoldLinkResponse {
  payload?: { payment_link?: string; url?: string };
  errors?: Array<{ message?: string; code?: string } | string>;
}

export class BoldProvider implements PaymentProvider {
  readonly nombre = 'bold';

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const { apiKey } = env();

    // expiration_date va en NANOSEGUNDOS desde epoch (así lo exige Bold).
    const expiraMs = Date.now() + (params.expiraEnMs ?? 48 * 60 * 60 * 1000);

    const body: Record<string, unknown> = {
      amount_type: 'CLOSE',
      amount: {
        currency: 'COP',
        tip_amount: 0,
        taxes: [],
        total_amount: params.montoCop,
      },
      reference: params.referencia,
      description: params.descripcion.slice(0, 100),
      expiration_date: expiraMs * 1_000_000,
    };
    if (params.emailPagador) body.payer_email = params.emailPagador;
    if (params.urlRetorno?.startsWith('https://')) body.callback_url = params.urlRetorno;

    const res = await fetch(`${BOLD_API_BASE}/online/link/v1`, {
      method: 'POST',
      headers: {
        Authorization: `x-api-key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as BoldLinkResponse;
    const errores = (data.errors ?? [])
      .map((e) => (typeof e === 'string' ? e : e.message ?? e.code ?? ''))
      .filter(Boolean);

    if (!res.ok || errores.length > 0 || !data.payload?.url) {
      throw new Error(
        `Bold createCheckout falló (HTTP ${res.status}): ${errores.join('; ') || 'respuesta sin payload.url'}`
      );
    }

    return {
      url: data.payload.url,
      providerLinkId: data.payload.payment_link ?? '',
    };
  }

  verifyWebhook(rawBody: string, firma: string | null): boolean {
    if (!firma) return false;
    const { secretKey, sandbox } = env();

    // Bold firma el BASE64 del raw body con HMAC-SHA256 y manda el hex.
    const candidatos = sandbox ? [secretKey, ''] : [secretKey];
    const encoded = Buffer.from(rawBody, 'utf8').toString('base64');

    return candidatos.some((secreto) => {
      const esperado = crypto
        .createHmac('sha256', secreto)
        .update(encoded)
        .digest('hex');
      const a = Buffer.from(esperado, 'utf8');
      const b = Buffer.from(firma.trim().toLowerCase(), 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
  }

  parseWebhook(rawBody: string): EventoPago | null {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    const tipo = TIPO_EVENTO[String(payload.type ?? '')];
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    const amount = (data.amount ?? {}) as Record<string, unknown>;

    if (!tipo) {
      // Evento que no nos interesa (VOID_REJECTED u otros futuros).
      return payload.type
        ? { tipo: 'ignored', providerPaymentId: null, referencia: null, montoCop: null, moneda: null, metodo: null, crudo: payload }
        : null;
    }

    return {
      tipo,
      providerPaymentId: data.payment_id ? String(data.payment_id) : null,
      referencia: metadata.reference ? String(metadata.reference) : null,
      montoCop: typeof amount.total === 'number' ? Math.round(amount.total) : null,
      moneda: amount.currency ? String(amount.currency) : null,
      metodo: data.payment_method ? String(data.payment_method) : null,
      crudo: payload,
    };
  }

  async getCheckoutStatus(providerLinkId: string): Promise<EstadoCheckoutResult> {
    const { apiKey } = env();
    const res = await fetch(`${BOLD_API_BASE}/online/link/v1/${encodeURIComponent(providerLinkId)}`, {
      method: 'GET',
      headers: { Authorization: `x-api-key ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Bold getCheckoutStatus falló (HTTP ${res.status})`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      estado: ESTADO_LINK[String(data.status ?? '')] ?? 'desconocido',
      providerPaymentId: data.transaction_id ? String(data.transaction_id) : null,
      metodo: data.payment_method ? String(data.payment_method) : null,
      crudo: data,
    };
  }
}
