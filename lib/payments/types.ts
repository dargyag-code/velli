// ── Capa de proveedor de pagos agnóstica ──────────────────────────────────
// La lógica de negocio (rutas, suscripciones) habla SOLO contra esta
// interfaz. Añadir Wompi/Stripe = nueva implementación + registrarla en
// lib/payments/index.ts, sin tocar nada más.

export interface CheckoutParams {
  /** Referencia única nuestra (payments.reference). El proveedor la devuelve
   *  en el webhook y es la llave de match. Alfanumérico + `_` `-`, ≤60. */
  referencia: string;
  /** Monto total en COP, sin decimales. */
  montoCop: number;
  /** Descripción visible en el checkout (Bold exige 2–100 chars). */
  descripcion: string;
  /** Email de la pagadora (el proveedor puede enviarle el recibo). */
  emailPagador?: string;
  /** URL https a la que vuelve la pagadora al terminar. Omitir si no es https. */
  urlRetorno?: string;
  /** Vida útil del checkout en milisegundos (default del provider si se omite). */
  expiraEnMs?: number;
}

export interface CheckoutResult {
  /** URL del checkout hospedado por el proveedor (nunca capturamos tarjeta). */
  url: string;
  /** Identificador del link/checkout en el proveedor (ej. LNK_xxx de Bold). */
  providerLinkId: string;
}

export type TipoEventoPago = 'approved' | 'rejected' | 'voided' | 'ignored';

export interface EventoPago {
  tipo: TipoEventoPago;
  /** payment_id del proveedor — llave de idempotencia dura. */
  providerPaymentId: string | null;
  /** Nuestra referencia (CheckoutParams.referencia) devuelta por el proveedor. */
  referencia: string | null;
  montoCop: number | null;
  moneda: string | null;
  metodo: string | null;
  /** Payload crudo completo, se persiste en payments.raw_webhook. */
  crudo: unknown;
}

export type EstadoCheckout =
  | 'activo'      // creado, sin pagar
  | 'procesando'
  | 'pagado'
  | 'rechazado'
  | 'cancelado'
  | 'expirado'
  | 'desconocido';

export interface EstadoCheckoutResult {
  estado: EstadoCheckout;
  /** transaction/payment id si el proveedor ya lo asignó (para idempotencia). */
  providerPaymentId: string | null;
  metodo: string | null;
  crudo: unknown;
}

export interface PaymentProvider {
  readonly nombre: string;

  /** Crea un checkout hospedado y devuelve su URL. */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;

  /** Verifica la firma/integridad del webhook (timing-safe). */
  verifyWebhook(rawBody: string, firma: string | null): boolean;

  /** Interpreta el payload del webhook. `null` si no es un evento de pago. */
  parseWebhook(rawBody: string): EventoPago | null;

  /** Consulta el estado de un checkout (reconciliación si el webhook no llegó). */
  getCheckoutStatus(providerLinkId: string): Promise<EstadoCheckoutResult>;
}
