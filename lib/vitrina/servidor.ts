import { createAdminClient } from '@/lib/supabase/admin';
import { obtenerSemillaServicio } from '@/lib/semilla-financiera';
import {
  esSlugVitrinaValido,
  sanitizarPayloadVitrinaPublica,
  sanitizarVariantesProducto,
} from './motor';
import type { PublicStorefrontData } from './tipos';

export interface VitrinaConContactoServidor {
  storefront: PublicStorefrontData;
  whatsappPhone: string | null;
}

/**
 * Carga la vitrina pública de una organización exclusivamente en el servidor.
 * Selecciona únicamente columnas públicas permitidas (nunca `productos_salon`,
 * ni costos químicos, ni fórmulas, ni comisiones).
 */
export async function cargarVitrinaServidorPorSlug(
  slug: string
): Promise<VitrinaConContactoServidor | null> {
  if (!esSlugVitrinaValido(slug)) return null;
  const slugLimpio = slug.trim().toLowerCase();

  const admin = createAdminClient();

  const { data: orgRow, error: orgErr } = await admin
    .from('organizations')
    .select('id, slug, name, city, vertical, plan, whatsapp_phone')
    .eq('slug', slugLimpio)
    .maybeSingle();

  if (orgErr || !orgRow) return null;

  const org = orgRow as {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    vertical: string | null;
    plan: string | null;
    whatsapp_phone: string | null;
  };

  // Intenta primero la RPC dedicada `vitrina_publica_por_slug`
  const { data: rpcData, error: rpcErr } = await admin.rpc('vitrina_publica_por_slug', {
    p_slug: slugLimpio,
  });

  if (!rpcErr && rpcData) {
    const sanitizado = sanitizarPayloadVitrinaPublica(rpcData);
    if (sanitizado) {
      // Si algún servicio activo aún no tenía plantilla publicada (precioCop === 0),
      // aplica la tarifa pública sugerida por categoría sin tocar costos internos.
      const serviciosConTarifa = sanitizado.services.map((s) => ({
        ...s,
        priceCop:
          s.priceCop > 0
            ? s.priceCop
            : obtenerSemillaServicio({ nombre: s.name, categoria: s.category }).tarifaBaseCop,
      }));

      return {
        storefront: {
          ...sanitizado,
          services: serviciosConTarifa,
        },
        whatsappPhone: org.whatsapp_phone?.trim() || null,
      };
    }
  }

  // Respaldo con proyección explícita de columnas públicas si la RPC aún no está desplegada
  const [brandRes, srvRes, prodRes] = await Promise.all([
    admin
      .from('brand_settings')
      .select(
        'organization_id, display_name, logo_url, primary_color, accent_color, public_tagline, legal_footer'
      )
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('servicios_salon')
      .select('id, nombre, categoria, duracion_minutos, orden')
      .or(`organization_id.eq.${org.id},user_id.eq.${org.id}`)
      .eq('activo', true)
      .order('orden', { ascending: true }),
    admin
      .from('catalog_products')
      .select(
        'id, name, slug, category, description, price_cop, variants_json, image_url, in_stock, sort_order'
      )
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const brandRow = brandRes.error ? null : brandRes.data;
  const srvRows = !srvRes.error && Array.isArray(srvRes.data) ? srvRes.data : [];
  const prodRows = !prodRes.error && Array.isArray(prodRes.data) ? prodRes.data : [];

  const serviceIds = (srvRows ?? []).map((r) => String((r as { id: unknown }).id));
  const preciosMap = new Map<string, number>();

  if (serviceIds.length > 0) {
    const { data: plantRows } = await admin
      .from('plantillas_precio')
      .select('servicio_id, precio_base')
      .in('servicio_id', serviceIds)
      .is('vigente_hasta', null);

    for (const row of plantRows ?? []) {
      const r = row as { servicio_id?: string; precio_base?: number };
      if (r.servicio_id && typeof r.precio_base === 'number') {
        preciosMap.set(r.servicio_id, r.precio_base);
      }
    }
  }

  const brand = (brandRow ?? {}) as Record<string, unknown>;
  const rawEnvelope = {
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      city: org.city,
      vertical: org.vertical,
      conMarcaVelli: org.plan !== 'pro_ia',
    },
    brand: {
      displayName: brand.display_name ?? org.name,
      logoUrl: brand.logo_url ?? null,
      primaryColor: brand.primary_color ?? null,
      accentColor: brand.accent_color ?? null,
      publicTagline: brand.public_tagline ?? null,
      legalFooter: brand.legal_footer ?? null,
    },
    services: (srvRows ?? []).map((s) => {
      const sr = s as Record<string, unknown>;
      const id = String(sr.id);
      const name = String(sr.nombre ?? '');
      const category = String(sr.categoria ?? 'otro');
      const plantPrecio = preciosMap.get(id);
      const fallbackPrecio = obtenerSemillaServicio({ nombre: name, categoria: category })
        .tarifaBaseCop;
      return {
        id,
        name,
        category,
        durationMinutes: sr.duracion_minutos,
        priceCop: plantPrecio && plantPrecio > 0 ? plantPrecio : fallbackPrecio,
        sortOrder: sr.orden ?? 0,
      };
    }),
    products: (prodRows ?? []).map((p) => {
      const pr = p as Record<string, unknown>;
      return {
        id: pr.id,
        name: pr.name,
        slug: pr.slug,
        category: pr.category,
        description: pr.description,
        priceCop: pr.price_cop,
        variants: sanitizarVariantesProducto(pr.variants_json),
        imageUrl: pr.image_url,
        inStock: pr.in_stock,
        sortOrder: pr.sort_order,
      };
    }),
  };

  const storefront = sanitizarPayloadVitrinaPublica(rawEnvelope);
  if (!storefront) return null;

  return {
    storefront,
    whatsappPhone: org.whatsapp_phone?.trim() || null,
  };
}
