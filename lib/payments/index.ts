import type { PaymentProvider } from './types';
import { BoldProvider } from './bold';

export type { PaymentProvider } from './types';
export type {
  CheckoutParams,
  CheckoutResult,
  EventoPago,
  EstadoCheckoutResult,
  TipoEventoPago,
} from './types';

// Registro de proveedores. PAYMENT_PROVIDER selecciona el activo (default
// bold). Añadir Wompi/Stripe = implementar PaymentProvider + sumarlo aquí.
const PROVIDERS: Record<string, () => PaymentProvider> = {
  bold: () => new BoldProvider(),
};

let _provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;
  const nombre = (process.env.PAYMENT_PROVIDER ?? 'bold').toLowerCase();
  const factory = PROVIDERS[nombre];
  if (!factory) {
    throw new Error(
      `PAYMENT_PROVIDER="${nombre}" no soportado. Disponibles: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  _provider = factory();
  return _provider;
}
