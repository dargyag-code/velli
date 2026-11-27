import type { PublicBrandProjection } from '@/lib/organizations/brand';
import type { VerticalSalon } from '@/lib/flags/verticales';

export type VariantGroupKind = 'ml' | 'talla' | 'aroma' | 'presentacion';

export interface CatalogProductVariant {
  id: string;
  label: string;
  group?: VariantGroupKind;
  /** Precio absoluto en COP de esta variante (si se define, reemplaza `priceCop`). */
  priceOverrideCop?: number;
  /** Delta en COP sumado a `priceCop` cuando no hay `priceOverrideCop`. */
  priceDeltaCop?: number;
  inStock?: boolean;
}

export interface CatalogProduct {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  priceCop: number;
  variants: CatalogProductVariant[];
  imageUrl?: string | null;
  inStock: boolean;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Proyección pública de un producto activo para `/s/[slug]`. */
export type PublicCatalogProduct = Omit<
  CatalogProduct,
  'organizationId' | 'active' | 'createdAt' | 'updatedAt'
>;

/** Proyección pública de un servicio activo configurado en `/configuracion/precios`. */
export interface PublicServiceItem {
  id: string;
  name: string;
  category: string;
  durationMinutes?: number | null;
  priceCop: number;
  sortOrder: number;
}

export interface PublicStorefrontOrganization {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  vertical: VerticalSalon;
  conMarcaVelli: boolean;
}

export interface PublicStorefrontData {
  organization: PublicStorefrontOrganization;
  brand: PublicBrandProjection;
  services: PublicServiceItem[];
  products: PublicCatalogProduct[];
}

export type PublicOrderType = 'product_cart' | 'service_inquiry';

export type PublicOrderStatus =
  | 'sent_to_whatsapp'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface CartItemInput {
  kind: 'product' | 'service';
  itemId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CreatePublicOrderInput {
  organizationSlug: string;
  customerName: string;
  customerPhone: string;
  orderType: PublicOrderType;
  items: CartItemInput[];
  notes?: string | null;
}

export interface ValidatedOrderItem {
  kind: 'product' | 'service';
  itemId: string;
  name: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  unitPriceCop: number;
  lineTotalCop: number;
}

export interface PublicOrder {
  id: string;
  organizationId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderType: PublicOrderType;
  items: ValidatedOrderItem[];
  totalCop: number;
  notes?: string | null;
  status: PublicOrderStatus;
  createdAt: string;
}
