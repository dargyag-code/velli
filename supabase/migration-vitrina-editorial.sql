-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Vitrina Editorial Multi-Tenant, Catálogo Retail y Pedidos Web
-- trazables a WhatsApp (`catalog_products`, `public_orders`, `public_order_events`)
--
-- Reglas cumplidas (`AGENTS.md`):
-- 1. `organization_id uuid NOT NULL` indexado + `ENABLE ROW LEVEL SECURITY` y
--    políticas explícitas de lectura/escritura en cada nueva tabla.
-- 2. Inmutabilidad transaccional (Ledger / Append-Only): `order_code`,
--    `order_type`, `items_json` y `total_cop` jamás se sobrescriben tras crear
--    el pedido; cada creación y transición de estado queda registrada en la
--    bitácora inmutable `public.public_order_events`.
-- 3. Privacidad pública estricta: `anon` no lee tablas crudas; la RPC pública
--    `public.vitrina_publica_por_slug(p_slug)` proyecta únicamente marca,
--    servicios activos con tarifa base y productos activos en stock, sin
--    exponer jamás costos químicos, precios de compra, fórmulas ni comisiones.
--
-- Idempotente y no destructiva.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Catálogo de productos retail de la vitrina (`catalog_products`) ─────
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  slug text NOT NULL CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 1 AND 120
  ),
  category text NOT NULL DEFAULT 'Cuidado Capilar'
    CHECK (char_length(btrim(category)) BETWEEN 1 AND 60),
  description text CHECK (description IS NULL OR char_length(description) <= 600),
  price_cop integer NOT NULL CHECK (price_cop >= 0),
  variants_json jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(variants_json) = 'array'),
  image_url text CHECK (image_url IS NULL OR char_length(image_url) <= 1024),
  in_stock boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_products_org_slug_key UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_organization_id
  ON public.catalog_products (organization_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_public_list
  ON public.catalog_products (organization_id, sort_order ASC, created_at DESC)
  WHERE active = true;

DROP TRIGGER IF EXISTS set_updated_at_catalog_products ON public.catalog_products;
CREATE TRIGGER set_updated_at_catalog_products
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2. Pedidos públicos trazables a WhatsApp (`public_orders`) ─────────────
CREATE TABLE IF NOT EXISTS public.public_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_code text NOT NULL,
  customer_name text NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 2 AND 100),
  customer_phone text NOT NULL CHECK (char_length(btrim(customer_phone)) BETWEEN 7 AND 24),
  order_type text NOT NULL CHECK (order_type IN ('product_cart', 'service_inquiry')),
  items_json jsonb NOT NULL CHECK (
    jsonb_typeof(items_json) = 'array' AND jsonb_array_length(items_json) BETWEEN 1 AND 50
  ),
  total_cop integer NOT NULL CHECK (total_cop >= 0),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  status text NOT NULL DEFAULT 'sent_to_whatsapp'
    CHECK (status IN ('sent_to_whatsapp', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_orders_order_code_key UNIQUE (order_code)
);

CREATE INDEX IF NOT EXISTS idx_public_orders_organization_id
  ON public.public_orders (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_orders_org_status
  ON public.public_orders (organization_id, status, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_public_orders ON public.public_orders;
CREATE TRIGGER set_updated_at_public_orders
  BEFORE UPDATE ON public.public_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. Bitácora append-only de eventos de pedido (`public_order_events`) ───
CREATE TABLE IF NOT EXISTS public.public_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.public_orders(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('created', 'confirmed', 'completed', 'cancelled')
  ),
  previous_status text,
  new_status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_order_events_organization_id
  ON public.public_order_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_order_events_order_id
  ON public.public_order_events (order_id, created_at ASC);

-- Guardarraíl de inmutabilidad: jamás mutar montos, ítems, código ni organización
CREATE OR REPLACE FUNCTION public.public_orders_inmutables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.order_code IS DISTINCT FROM OLD.order_code
       OR NEW.order_type IS DISTINCT FROM OLD.order_type
       OR NEW.items_json IS DISTINCT FROM OLD.items_json
       OR NEW.total_cop IS DISTINCT FROM OLD.total_cop THEN
      RAISE EXCEPTION 'PUBLIC_ORDER_INMUTABLE: código, ítems y total del pedido son inmutables';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'sent_to_whatsapp' AND NEW.status IN ('confirmed', 'completed', 'cancelled'))
      OR (OLD.status = 'confirmed' AND NEW.status IN ('completed', 'cancelled'))
    ) THEN
      RAISE EXCEPTION 'PUBLIC_ORDER_TRANSICION: transición inválida de % a %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS public_orders_inmutables ON public.public_orders;
CREATE TRIGGER public_orders_inmutables
  BEFORE UPDATE ON public.public_orders
  FOR EACH ROW EXECUTE FUNCTION public.public_orders_inmutables();

-- Registro automático append-only en cada creación y cambio de estado
CREATE OR REPLACE FUNCTION public.public_orders_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.public_order_events (
      organization_id,
      order_id,
      actor_user_id,
      event_type,
      previous_status,
      new_status,
      metadata
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      (SELECT auth.uid()),
      'created',
      NULL,
      NEW.status,
      jsonb_build_object(
        'order_code', NEW.order_code,
        'order_type', NEW.order_type,
        'total_cop', NEW.total_cop
      )
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.public_order_events (
      organization_id,
      order_id,
      actor_user_id,
      event_type,
      previous_status,
      new_status,
      metadata
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      (SELECT auth.uid()),
      NEW.status,
      OLD.status,
      NEW.status,
      jsonb_build_object('order_code', NEW.order_code)
    );
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.public_orders_registrar_evento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS public_orders_registrar_evento ON public.public_orders;
CREATE TRIGGER public_orders_registrar_evento
  AFTER INSERT OR UPDATE ON public.public_orders
  FOR EACH ROW EXECUTE FUNCTION public.public_orders_registrar_evento();

-- ── 4. Row Level Security (RLS) ────────────────────────────────────────────
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_order_events ENABLE ROW LEVEL SECURITY;

-- 4.1 `catalog_products`: lectura interna de miembros; CRUD exclusivo `owner` / `manager`
DROP POLICY IF EXISTS catalog_products_select_member ON public.catalog_products;
CREATE POLICY catalog_products_select_member ON public.catalog_products
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS catalog_products_insert_admin ON public.catalog_products;
CREATE POLICY catalog_products_insert_admin ON public.catalog_products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS catalog_products_update_admin ON public.catalog_products;
CREATE POLICY catalog_products_update_admin ON public.catalog_products
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS catalog_products_delete_admin ON public.catalog_products;
CREATE POLICY catalog_products_delete_admin ON public.catalog_products
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

-- 4.2 `public_orders`: lectura por miembros activos; cambio de estado `owner` / `manager`
--     Inserción pública controlada exclusivamente vía Route Handler (`service_role` + Upstash).
DROP POLICY IF EXISTS public_orders_select_member ON public.public_orders;
CREATE POLICY public_orders_select_member ON public.public_orders
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS public_orders_update_admin ON public.public_orders;
CREATE POLICY public_orders_update_admin ON public.public_orders
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

-- 4.3 `public_order_events`: solo lectura para `owner` y `manager`
DROP POLICY IF EXISTS public_order_events_select_admin ON public.public_order_events;
CREATE POLICY public_order_events_select_admin ON public.public_order_events
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

-- ── 5. RPC Pública Segura: `vitrina_publica_por_slug(p_slug)` ──────────────
-- Devuelve EXCLUSIVAMENTE metadatos visuales (`brand_settings`), servicios
-- activos con su tarifa pública base y productos retail activos.
-- JAMÁS proyecta costos químicos, precios de compra, fórmulas ni comisiones.
CREATE OR REPLACE FUNCTION public.vitrina_publica_por_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_brand jsonb;
  v_services jsonb := '[]'::jsonb;
  v_products jsonb := '[]'::jsonb;
BEGIN
  IF p_slug IS NULL OR char_length(btrim(p_slug)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_org
  FROM public.organizations o
  WHERE o.slug = lower(btrim(p_slug))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'organizationId', v_org.id,
    'displayName', coalesce(nullif(btrim(bs.display_name), ''), v_org.name),
    'logoUrl', bs.logo_url,
    'primaryColor', coalesce(bs.primary_color, '#3B0D1E'),
    'accentColor', coalesce(bs.accent_color, '#E8CFC8'),
    'publicTagline', bs.public_tagline,
    'legalFooter', bs.legal_footer
  )
  INTO v_brand
  FROM public.organizations o2
  LEFT JOIN public.brand_settings bs ON bs.organization_id = o2.id
  WHERE o2.id = v_org.id;

  IF to_regclass('public.servicios_salon') IS NOT NULL THEN
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.nombre,
          'category', s.categoria,
          'durationMinutes', s.duracion_minutos,
          'priceCop', coalesce(pp.precio_base, 0),
          'sortOrder', s.orden
        )
        ORDER BY s.orden ASC, s.nombre ASC
      ),
      '[]'::jsonb
    )
    INTO v_services
    FROM public.servicios_salon s
    LEFT JOIN public.plantillas_precio pp
      ON pp.servicio_id = s.id AND pp.vigente_hasta IS NULL
    WHERE COALESCE(s.organization_id, s.user_id) = v_org.id
      AND s.activo = true;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'name', cp.name,
        'slug', cp.slug,
        'category', cp.category,
        'description', cp.description,
        'priceCop', cp.price_cop,
        'variants', cp.variants_json,
        'imageUrl', cp.image_url,
        'inStock', cp.in_stock,
        'sortOrder', cp.sort_order
      )
      ORDER BY cp.sort_order ASC, cp.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_products
  FROM public.catalog_products cp
  WHERE cp.organization_id = v_org.id
    AND cp.active = true;

  RETURN jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name,
      'city', v_org.city,
      'vertical', v_org.vertical,
      'conMarcaVelli', (v_org.plan <> 'pro_ia')
    ),
    'brand', v_brand,
    'services', v_services,
    'products', v_products
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vitrina_publica_por_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrina_publica_por_slug(text) TO anon, authenticated, service_role;

-- ── 6. Privilegios explícitos ──────────────────────────────────────────────
REVOKE ALL ON TABLE
  public.catalog_products,
  public.public_orders,
  public.public_order_events
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_products TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.public_orders TO authenticated;
REVOKE INSERT, DELETE ON TABLE public.public_orders FROM authenticated;
GRANT SELECT ON TABLE public.public_order_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.public_order_events FROM authenticated;

GRANT ALL ON TABLE
  public.catalog_products,
  public.public_orders,
  public.public_order_events
TO service_role;
