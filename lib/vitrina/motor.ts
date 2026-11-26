// ══════════════════════════════════════════════════════════════════════════
// Motor puro de la Vitrina Editorial y Checkout trazable a WhatsApp.
//
// Reglas innegociables (`AGENTS.md`):
// 1. El servidor jamás confía en precios enviados por el cliente: resuelve
//    cada producto/variante o servicio contra el catálogo activo de la
//    organización y calcula `total_cop` en enteros COP.
// 2. Ningún payload público puede contener costos químicos internos, precios
//    de compra de insumos, fórmulas privadas ni comisiones.
// ══════════════════════════════════════════════════════════════════════════

import { formatearPrecioCop } from '@/lib/cotizador/whatsapp';
import {
  proyectarBrandPublico,
  resolverBrandSettings,
} from '@/lib/organizations/brand';
import { normalizarVerticalSalon } from '@/lib/flags/verticales';
import { enlaceWhatsApp, numeroWhatsApp } from '@/lib/whatsapp';
import type {
  CatalogProductVariant,
  CreatePublicOrderInput,
  PublicCatalogProduct,
  PublicOrderStatus,
  PublicOrderType,
  PublicServiceItem,
  PublicStorefrontData,
  ValidatedOrderItem,
  VariantGroupKind,
} from './tipos';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GRUPOS_VARIANTE_VALIDOS = new Set<VariantGroupKind>([
  'ml',
  'talla',
  'aroma',
  'presentacion',
]);

/** Lista explícita de campos privados prohibidos en cualquier respuesta pública. */
export const CAMPOS_PRIVADOS_PROHIBIDOS = [
  'costo_producto_estimado',
  'costoProductoEstimado',
  'costo_detalle',
  'costoDetalle',
  'comision_estimada',
  'comisionEstimada',
  'comision_detalle',
  'comisionDetalle',
  'precio_compra',
  'precioCompra',
  'costoUnitarioCop',
  'costoGramoBaseCop',
  'insumosFijosCop',
  'formula',
  'formula_final',
  'consumo',
] as const;

export function esSlugVitrinaValido(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    slug.trim().length >= 2 &&
    slug.trim().length <= 96 &&
    SLUG_REGEX.test(slug.trim().toLowerCase())
  );
}

export function generarSlugProducto(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return limpio || 'producto';
}

export function generarCodigoPedido(
  fecha: Date = new Date(),
  sufijoManual?: string
): string {
  const yy = String(fecha.getUTCFullYear()).slice(-2);
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getUTCDate()).padStart(2, '0');
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sufijo = '';
  if (sufijoManual && /^[A-Z0-9]{4,8}$/i.test(sufijoManual.trim())) {
    sufijo = sufijoManual.trim().toUpperCase();
  } else {
    for (let i = 0; i < 4; i += 1) {
      sufijo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    }
  }
  return `VP-${yy}${mm}${dd}-${sufijo}`;
}

export function sanitizarVariantesProducto(raw: unknown): CatalogProductVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogProductVariant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    const label = typeof obj.label === 'string' ? obj.label.trim() : '';
    if (!id || !label) continue;

    const groupRaw = typeof obj.group === 'string' ? obj.group.trim().toLowerCase() : undefined;
    const group =
      groupRaw && GRUPOS_VARIANTE_VALIDOS.has(groupRaw as VariantGroupKind)
        ? (groupRaw as VariantGroupKind)
        : undefined;

    const override =
      typeof obj.priceOverrideCop === 'number' &&
      Number.isFinite(obj.priceOverrideCop) &&
      obj.priceOverrideCop >= 0
        ? Math.round(obj.priceOverrideCop)
        : undefined;

    const delta =
      typeof obj.priceDeltaCop === 'number' && Number.isFinite(obj.priceDeltaCop)
        ? Math.round(obj.priceDeltaCop)
        : undefined;

    out.push({
      id: id.slice(0, 48),
      label: label.slice(0, 64),
      ...(group ? { group } : {}),
      ...(override !== undefined ? { priceOverrideCop: override } : {}),
      ...(delta !== undefined ? { priceDeltaCop: delta } : {}),
      inStock: obj.inStock === false ? false : true,
    });
  }
  return out;
}

export function resolverPrecioVariante(
  precioBaseCop: number,
  variante?: CatalogProductVariant | null
): number {
  const base = Math.max(0, Math.round(Number.isFinite(precioBaseCop) ? precioBaseCop : 0));
  if (!variante) return base;
  if (typeof variante.priceOverrideCop === 'number' && variante.priceOverrideCop >= 0) {
    return Math.round(variante.priceOverrideCop);
  }
  if (typeof variante.priceDeltaCop === 'number') {
    return Math.max(0, Math.round(base + variante.priceDeltaCop));
  }
  return base;
}

export type ResultadoValidacionPedido =
  | {
      ok: true;
      organizationSlug: string;
      customerName: string;
      customerPhone: string;
      normalizedCustomerWhatsapp: string;
      orderType: PublicOrderType;
      items: ValidatedOrderItem[];
      totalCop: number;
      notes: string | null;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Valida estrictamente el payload de `POST /api/public/orders` y recalcula
 * cada precio unitario y el `total_cop` contra el catálogo oficial del servidor.
 */
export function validarYCalcularPedidoPublico(
  payload: unknown,
  catalogo: {
    products: readonly PublicCatalogProduct[];
    services: readonly PublicServiceItem[];
  }
): ResultadoValidacionPedido {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Solicitud inválida' };
  }

  const raw = payload as Partial<CreatePublicOrderInput> & Record<string, unknown>;

  if (!esSlugVitrinaValido(raw.organizationSlug)) {
    return { ok: false, error: 'Organización inválida' };
  }
  const organizationSlug = raw.organizationSlug.trim().toLowerCase();

  const customerName =
    typeof raw.customerName === 'string' ? raw.customerName.trim().replace(/\s+/g, ' ') : '';
  if (customerName.length < 2 || customerName.length > 100) {
    return { ok: false, error: 'Ingresa tu nombre completo (entre 2 y 100 caracteres)' };
  }

  const customerPhone =
    typeof raw.customerPhone === 'string' ? raw.customerPhone.trim() : '';
  const normalizedWhatsapp = numeroWhatsApp(customerPhone);
  if (!normalizedWhatsapp) {
    return { ok: false, error: 'Ingresa un número de WhatsApp o celular válido' };
  }

  if (raw.orderType !== 'product_cart' && raw.orderType !== 'service_inquiry') {
    return { ok: false, error: 'Tipo de pedido inválido' };
  }
  const orderType: PublicOrderType = raw.orderType;

  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > 30) {
    return { ok: false, error: 'El carrito debe contener entre 1 y 30 ítems' };
  }

  const notesRaw = typeof raw.notes === 'string' ? raw.notes.trim() : '';
  if (notesRaw.length > 500) {
    return { ok: false, error: 'Las notas no pueden superar 500 caracteres' };
  }

  const prodMap = new Map(catalogo.products.map((p) => [p.id, p]));
  const srvMap = new Map(catalogo.services.map((s) => [s.id, s]));

  const validatedItems: ValidatedOrderItem[] = [];
  let totalCop = 0;

  for (const item of raw.items as unknown[]) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Ítem del carrito inválido' };
    }
    const obj = item as Record<string, unknown>;
    const kind = obj.kind;
    const itemId = typeof obj.itemId === 'string' ? obj.itemId.trim() : '';
    const quantity = obj.quantity;

    if ((kind !== 'product' && kind !== 'service') || !itemId) {
      return { ok: false, error: 'Referencia de producto o servicio inválida' };
    }
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      return { ok: false, error: 'La cantidad por ítem debe ser un entero entre 1 y 50' };
    }

    if (kind === 'product') {
      const prod = prodMap.get(itemId);
      if (!prod || !prod.inStock) {
        return { ok: false, error: 'Uno de los productos seleccionados no está disponible' };
      }

      const variantId =
        typeof obj.variantId === 'string' && obj.variantId.trim()
          ? obj.variantId.trim()
          : undefined;

      let varianteElegida: CatalogProductVariant | undefined;
      if (prod.variants.length > 0) {
        varianteElegida = variantId
          ? prod.variants.find((v) => v.id === variantId)
          : prod.variants.find((v) => v.inStock !== false);

        if (!varianteElegida || varianteElegida.inStock === false) {
          return {
            ok: false,
            error: `La presentación seleccionada de "${prod.name}" no está disponible`,
          };
        }
      } else if (variantId) {
        return { ok: false, error: `Variante desconocida para "${prod.name}"` };
      }

      const unitPriceCop = resolverPrecioVariante(prod.priceCop, varianteElegida);
      const lineTotalCop = unitPriceCop * quantity;
      totalCop += lineTotalCop;

      validatedItems.push({
        kind: 'product',
        itemId: prod.id,
        name: prod.name,
        ...(varianteElegida
          ? { variantId: varianteElegida.id, variantLabel: varianteElegida.label }
          : {}),
        quantity,
        unitPriceCop,
        lineTotalCop,
      });
    } else {
      const srv = srvMap.get(itemId);
      if (!srv) {
        return { ok: false, error: 'Uno de los servicios seleccionados no está disponible' };
      }

      const unitPriceCop = Math.max(0, Math.round(srv.priceCop));
      const lineTotalCop = unitPriceCop * quantity;
      totalCop += lineTotalCop;

      validatedItems.push({
        kind: 'service',
        itemId: srv.id,
        name: srv.name,
        quantity,
        unitPriceCop,
        lineTotalCop,
      });
    }
  }

  return {
    ok: true,
    organizationSlug,
    customerName,
    customerPhone,
    normalizedCustomerWhatsapp: normalizedWhatsapp,
    orderType,
    items: validatedItems,
    totalCop,
    notes: notesRaw || null,
  };
}

export interface DatosMensajePedidoWhatsApp {
  orderCode: string;
  salonName: string;
  salonWhatsapp?: string | null;
  customerName: string;
  customerPhone: string;
  orderType: PublicOrderType;
  items: readonly ValidatedOrderItem[];
  totalCop: number;
  notes?: string | null;
}

export function armarMensajeWhatsAppPedido(datos: DatosMensajePedidoWhatsApp): {
  mensaje: string;
  whatsappUrl: string;
} {
  const encabezado =
    datos.orderType === 'service_inquiry'
      ? `Hola *${datos.salonName.trim()}*, quiero agendar / consultar estos servicios:`
      : `Hola *${datos.salonName.trim()}*, quiero confirmar mi pedido de tienda:`;

  const lineasItems = datos.items.map((it) => {
    const etiquetaVariante = it.variantLabel ? ` (${it.variantLabel})` : '';
    const prefijoPrecio = it.kind === 'service' ? 'desde ' : '';
    return `• ${it.quantity}× ${it.name}${etiquetaVariante} — ${prefijoPrecio}${formatearPrecioCop(it.lineTotalCop)}`;
  });

  const etiquetaTotal =
    datos.orderType === 'service_inquiry' ? 'Total orientativo' : 'Total pedido';

  const bloques = [
    encabezado,
    ``,
    `*Código:* ${datos.orderCode}`,
    `*Cliente:* ${datos.customerName}`,
    `*Contacto:* ${datos.customerPhone}`,
    ``,
    ...lineasItems,
    ``,
    `*${etiquetaTotal}: ${formatearPrecioCop(datos.totalCop)} COP*`,
  ];

  if (datos.notes?.trim()) {
    bloques.push(`*Nota:* ${datos.notes.trim()}`);
  }

  const mensaje = bloques.join('\n');
  const whatsappUrl = enlaceWhatsApp(datos.salonWhatsapp, mensaje);

  return { mensaje, whatsappUrl };
}

/**
 * Sanitiza y proyecta estrictamente los campos públicos de la vitrina.
 * Elimina cualquier propiedad ajena al contrato público (costos químicos,
 * precios de compra de insumos, fórmulas privadas o comisiones).
 */
export function sanitizarPayloadVitrinaPublica(raw: unknown): PublicStorefrontData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const orgRaw = (obj.organization ?? {}) as Record<string, unknown>;
  const brandRaw = (obj.brand ?? {}) as Record<string, unknown>;

  const orgId = typeof orgRaw.id === 'string' ? orgRaw.id.trim() : '';
  const orgSlug = typeof orgRaw.slug === 'string' ? orgRaw.slug.trim().toLowerCase() : '';
  const orgName = typeof orgRaw.name === 'string' ? orgRaw.name.trim() : '';
  if (!orgId || !orgSlug || !orgName) return null;

  const brandResolved = resolverBrandSettings(
    {
      organizationId: orgId,
      displayName: typeof brandRaw.displayName === 'string' ? brandRaw.displayName : orgName,
      logoUrl: typeof brandRaw.logoUrl === 'string' ? brandRaw.logoUrl : null,
      primaryColor: typeof brandRaw.primaryColor === 'string' ? brandRaw.primaryColor : null,
      accentColor: typeof brandRaw.accentColor === 'string' ? brandRaw.accentColor : null,
      publicTagline: typeof brandRaw.publicTagline === 'string' ? brandRaw.publicTagline : null,
      legalFooter: typeof brandRaw.legalFooter === 'string' ? brandRaw.legalFooter : null,
    },
    { organizationId: orgId, nombreSalon: orgName }
  );

  const servicesRaw = Array.isArray(obj.services) ? obj.services : [];
  const services: PublicServiceItem[] = [];
  for (const s of servicesRaw) {
    if (!s || typeof s !== 'object') continue;
    const sr = s as Record<string, unknown>;
    const id = typeof sr.id === 'string' ? sr.id.trim() : '';
    const name = typeof sr.name === 'string' ? sr.name.trim() : '';
    if (!id || !name) continue;
    services.push({
      id,
      name,
      category: typeof sr.category === 'string' && sr.category.trim() ? sr.category.trim() : 'otro',
      durationMinutes:
        typeof sr.durationMinutes === 'number' && sr.durationMinutes > 0
          ? Math.round(sr.durationMinutes)
          : null,
      priceCop:
        typeof sr.priceCop === 'number' && Number.isFinite(sr.priceCop) && sr.priceCop >= 0
          ? Math.round(sr.priceCop)
          : 0,
      sortOrder: typeof sr.sortOrder === 'number' ? Math.round(sr.sortOrder) : 0,
    });
  }

  const productsRaw = Array.isArray(obj.products) ? obj.products : [];
  const products: PublicCatalogProduct[] = [];
  for (const p of productsRaw) {
    if (!p || typeof p !== 'object') continue;
    const pr = p as Record<string, unknown>;
    const id = typeof pr.id === 'string' ? pr.id.trim() : '';
    const name = typeof pr.name === 'string' ? pr.name.trim() : '';
    const slug = typeof pr.slug === 'string' ? pr.slug.trim() : generarSlugProducto(name);
    if (!id || !name) continue;
    products.push({
      id,
      name,
      slug,
      category:
        typeof pr.category === 'string' && pr.category.trim() ? pr.category.trim() : 'General',
      description: typeof pr.description === 'string' ? pr.description.trim() || null : null,
      priceCop:
        typeof pr.priceCop === 'number' && Number.isFinite(pr.priceCop) && pr.priceCop >= 0
          ? Math.round(pr.priceCop)
          : 0,
      variants: sanitizarVariantesProducto(pr.variants),
      imageUrl: typeof pr.imageUrl === 'string' ? pr.imageUrl.trim() || null : null,
      inStock: pr.inStock === false ? false : true,
      sortOrder: typeof pr.sortOrder === 'number' ? Math.round(pr.sortOrder) : 0,
    });
  }

  return {
    organization: {
      id: orgId,
      slug: orgSlug,
      name: orgName,
      city: typeof orgRaw.city === 'string' ? orgRaw.city.trim() || null : null,
      vertical: normalizarVerticalSalon(
        typeof orgRaw.vertical === 'string' ? orgRaw.vertical : undefined
      ),
      conMarcaVelli: orgRaw.conMarcaVelli !== false,
    },
    brand: proyectarBrandPublico(brandResolved),
    services,
    products,
  };
}

export function puedeTransicionarEstadoPedido(
  actual: PublicOrderStatus,
  siguiente: PublicOrderStatus
): boolean {
  if (actual === siguiente) return false;
  if (actual === 'sent_to_whatsapp') {
    return siguiente === 'confirmed' || siguiente === 'completed' || siguiente === 'cancelled';
  }
  if (actual === 'confirmed') {
    return siguiente === 'completed' || siguiente === 'cancelled';
  }
  return false;
}
