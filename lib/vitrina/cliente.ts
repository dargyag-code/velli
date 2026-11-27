import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { generarSlugProducto, sanitizarVariantesProducto } from './motor';
import type {
  CatalogProduct,
  CatalogProductVariant,
  PublicOrder,
  PublicOrderStatus,
  PublicOrderType,
  ValidatedOrderItem,
} from './tipos';

export interface OrganizacionPanelResumen {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  whatsappPhone?: string | null;
  role: 'owner' | 'manager' | 'specialist';
}

function getClient(client?: SupabaseClient): SupabaseClient {
  return client ?? (createBrowserClient() as unknown as SupabaseClient);
}

function esTablaInexistente(error: { code?: string } | null): boolean {
  return Boolean(
    error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202'
  );
}

function rowToCatalogProduct(r: Record<string, unknown>): CatalogProduct {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
    category: String(r.category ?? 'General'),
    description: typeof r.description === 'string' ? r.description : null,
    priceCop: Math.max(0, Math.round(Number(r.price_cop ?? 0))),
    variants: sanitizarVariantesProducto(r.variants_json),
    imageUrl: typeof r.image_url === 'string' ? r.image_url : null,
    inStock: Boolean(r.in_stock),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: typeof r.created_at === 'string' ? r.created_at : undefined,
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  };
}

function rowToPublicOrder(r: Record<string, unknown>): PublicOrder {
  const rawItems = Array.isArray(r.items_json) ? r.items_json : [];
  const items: ValidatedOrderItem[] = rawItems
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
    .map((it) => ({
      kind: it.kind === 'service' ? 'service' : 'product',
      itemId: String(it.itemId ?? ''),
      name: String(it.name ?? ''),
      ...(typeof it.variantId === 'string' ? { variantId: it.variantId } : {}),
      ...(typeof it.variantLabel === 'string' ? { variantLabel: it.variantLabel } : {}),
      quantity: Math.max(1, Math.round(Number(it.quantity ?? 1))),
      unitPriceCop: Math.max(0, Math.round(Number(it.unitPriceCop ?? 0))),
      lineTotalCop: Math.max(0, Math.round(Number(it.lineTotalCop ?? 0))),
    }));

  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    orderCode: String(r.order_code ?? ''),
    customerName: String(r.customer_name ?? ''),
    customerPhone: String(r.customer_phone ?? ''),
    orderType: (r.order_type as PublicOrderType) ?? 'product_cart',
    items,
    totalCop: Math.max(0, Math.round(Number(r.total_cop ?? 0))),
    notes: typeof r.notes === 'string' ? r.notes : null,
    status: (r.status as PublicOrderStatus) ?? 'sent_to_whatsapp',
    createdAt: String(r.created_at ?? ''),
  };
}

export async function obtenerOrganizacionActivaPanel(
  client?: SupabaseClient
): Promise<OrganizacionPanelResumen | null> {
  const supabase = getClient(client);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memRows, error: memErr } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (memErr) {
    if (esTablaInexistente(memErr)) return null;
    throw memErr;
  }

  const mem = (memRows?.[0] ?? null) as {
    organization_id?: string;
    role?: 'owner' | 'manager' | 'specialist';
  } | null;
  if (!mem?.organization_id || !mem.role) return null;

  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .select('id, slug, name, city, whatsapp_phone')
    .eq('id', mem.organization_id)
    .maybeSingle();

  if (orgErr || !orgRow) return null;
  const o = orgRow as Record<string, unknown>;

  return {
    id: String(o.id),
    slug: String(o.slug),
    name: String(o.name),
    city: typeof o.city === 'string' ? o.city : null,
    whatsappPhone: typeof o.whatsapp_phone === 'string' ? o.whatsapp_phone : null,
    role: mem.role,
  };
}

export async function listarCatalogProductsOrg(
  organizationId: string,
  client?: SupabaseClient
): Promise<CatalogProduct[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('catalog_products')
    .select(
      'id, organization_id, name, slug, category, description, price_cop, variants_json, image_url, in_stock, active, sort_order, created_at, updated_at'
    )
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToCatalogProduct(r as Record<string, unknown>));
}

export async function crearCatalogProduct(
  input: {
    organizationId: string;
    name: string;
    category: string;
    description?: string | null;
    priceCop: number;
    variants?: CatalogProductVariant[];
    imageUrl?: string | null;
    inStock?: boolean;
    active?: boolean;
    sortOrder?: number;
  },
  client?: SupabaseClient
): Promise<CatalogProduct> {
  const supabase = getClient(client);
  const slugBase = generarSlugProducto(input.name);
  const sufijo = Math.random().toString(36).slice(2, 6);
  const slug = `${slugBase}-${sufijo}`;

  const { data, error } = await supabase
    .from('catalog_products')
    .insert({
      organization_id: input.organizationId,
      name: input.name.trim(),
      slug,
      category: input.category.trim() || 'Cuidado Capilar',
      description: input.description?.trim() || null,
      price_cop: Math.max(0, Math.round(input.priceCop)),
      variants_json: sanitizarVariantesProducto(input.variants ?? []),
      image_url: input.imageUrl?.trim() || null,
      in_stock: input.inStock ?? true,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToCatalogProduct(data as Record<string, unknown>);
}

export async function actualizarCatalogProduct(
  id: string,
  patch: {
    name?: string;
    category?: string;
    description?: string | null;
    priceCop?: number;
    variants?: CatalogProductVariant[];
    imageUrl?: string | null;
    inStock?: boolean;
    active?: boolean;
    sortOrder?: number;
  },
  client?: SupabaseClient
): Promise<CatalogProduct> {
  const supabase = getClient(client);
  const updateObj: Record<string, unknown> = {};
  if (patch.name !== undefined) updateObj.name = patch.name.trim();
  if (patch.category !== undefined) updateObj.category = patch.category.trim() || 'General';
  if (patch.description !== undefined) updateObj.description = patch.description?.trim() || null;
  if (patch.priceCop !== undefined) updateObj.price_cop = Math.max(0, Math.round(patch.priceCop));
  if (patch.variants !== undefined) {
    updateObj.variants_json = sanitizarVariantesProducto(patch.variants);
  }
  if (patch.imageUrl !== undefined) updateObj.image_url = patch.imageUrl?.trim() || null;
  if (patch.inStock !== undefined) updateObj.in_stock = patch.inStock;
  if (patch.active !== undefined) updateObj.active = patch.active;
  if (patch.sortOrder !== undefined) updateObj.sort_order = patch.sortOrder;

  const { data, error } = await supabase
    .from('catalog_products')
    .update(updateObj)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return rowToCatalogProduct(data as Record<string, unknown>);
}

export async function eliminarCatalogProduct(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = getClient(client);
  const { error } = await supabase.from('catalog_products').delete().eq('id', id);
  if (error) throw error;
}

export async function listarPublicOrdersOrg(
  organizationId: string,
  client?: SupabaseClient
): Promise<PublicOrder[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('public_orders')
    .select(
      'id, organization_id, order_code, customer_name, customer_phone, order_type, items_json, total_cop, notes, status, created_at'
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (esTablaInexistente(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToPublicOrder(r as Record<string, unknown>));
}

export async function actualizarEstadoPublicOrder(
  orderId: string,
  nextStatus: PublicOrderStatus,
  client?: SupabaseClient
): Promise<PublicOrder> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('public_orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .select(
      'id, organization_id, order_code, customer_name, customer_phone, order_type, items_json, total_cop, notes, status, created_at'
    )
    .single();

  if (error) throw error;
  return rowToPublicOrder(data as Record<string, unknown>);
}
