-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Base Multi-Tenant, RBAC por Organización y Brand Settings
-- (Velli Pro · Arquitectura Multi-Tenant + Vertical Packs)
--
-- Objetivo:
-- 1. Crear `public.organizations`, `public.organization_members` y
--    `public.brand_settings` con restricciones de integridad e índices.
-- 2. Ejecutar backfill idempotente para que todo usuario/salón existente en
--    `public.profiles` quede asociado como `owner` de su propia organización
--    (`vertical = 'hair_studio'`) y conserve su identidad visual en
--    `public.brand_settings` sin pérdida de datos.
-- 3. Añadir `organization_id` de forma aditiva e idempotente a las tablas
--    operativas existentes, poblar las filas históricas y mantener un trigger
--    de compatibilidad para inserciones legacy basadas en `user_id`.
-- 4. Definir `public.current_user_org_ids()` y
--    `public.has_org_role(org_id, roles[])` y aplicar políticas RLS estrictas
--    por `organization_id` y rol, ocultando reportes de utilidad neta,
--    comisiones y calibración de costos químicos al rol `specialist`.
--
-- Idempotente y no destructiva: sin DROP TABLE, sin TRUNCATE ni borrado de
-- columnas. Re-ejecutable sin duplicar registros.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Utilidad determinista para slugs únicos de organización ─────────────
CREATE OR REPLACE FUNCTION public.slugify_organization_name(
  p_name text,
  p_fallback_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    coalesce(
      nullif(
        btrim(
          regexp_replace(
            lower(
              translate(
                coalesce(p_name, ''),
                'áéíóúàèìòùäëïöüâêîôûñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ',
                'aeiouaeiouaeiouaeiouncaeiouaeiouaeiouaeiounc'
              )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
          ),
          '-'
        ),
        ''
      ),
      'salon'
    )
    || '-'
    || left(replace(p_fallback_id::text, '-', ''), 8);
$$;

-- ── 1. Tabla principal de organizaciones (Tenants) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  vertical text NOT NULL DEFAULT 'hair_studio'
    CHECK (vertical IN ('hair_studio', 'nail_bar', 'barber_studio', 'spa_estetica', 'beauty_lounge')),
  plan text NOT NULL DEFAULT 'trialing'
    CHECK (plan IN ('trialing', 'basico', 'pro', 'pro_ia')),
  whatsapp_phone text,
  city text,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(feature_flags) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_key UNIQUE (slug),
  CONSTRAINT organizations_slug_format_check CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 96
  )
);

CREATE INDEX IF NOT EXISTS idx_organizations_vertical ON public.organizations (vertical);

DROP TRIGGER IF EXISTS set_updated_at_organizations ON public.organizations;
CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Protege `plan` y `feature_flags` de auto-escalamiento desde cliente
CREATE OR REPLACE FUNCTION public.organizations_guard_campos_protegidos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.plan IS DISTINCT FROM 'trialing'
       OR COALESCE(NEW.feature_flags, '{}'::jsonb) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'CAMPO_PROTEGIDO: plan y feature_flags de la organización los gestiona el servidor';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.feature_flags IS DISTINCT FROM OLD.feature_flags THEN
    RAISE EXCEPTION 'CAMPO_PROTEGIDO: plan y feature_flags de la organización los gestiona el servidor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_guard_campos_protegidos ON public.organizations;
CREATE TRIGGER organizations_guard_campos_protegidos
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_guard_campos_protegidos();

-- ── 2. Miembros y roles por organización (RBAC) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'specialist')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_org_user_key UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org
  ON public.organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_active
  ON public.organization_members (user_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_organization_members_org_role
  ON public.organization_members (organization_id, role) WHERE active;

-- ── 3. Configuración de marca por organización (Velvet Studio) ─────────────
CREATE TABLE IF NOT EXISTS public.brand_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  logo_url text,
  primary_color text NOT NULL DEFAULT '#3B0D1E'
    CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL DEFAULT '#E8CFC8'
    CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  custom_domain text UNIQUE,
  public_tagline text,
  legal_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_settings_org
  ON public.brand_settings (organization_id);

DROP TRIGGER IF EXISTS set_updated_at_brand_settings ON public.brand_settings;
CREATE TRIGGER set_updated_at_brand_settings
  BEFORE UPDATE ON public.brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 4. Funciones auxiliares SQL para RLS y RBAC ────────────────────────────
-- SECURITY DEFINER con search_path vacío para evitar recursión de RLS sobre
-- `organization_members`, acotadas estrictamente a `auth.uid()`.

CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = (SELECT auth.uid())
    AND om.active = true;
$$;

REVOKE ALL ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_org_role(org_id uuid, roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN org_id IS NULL OR roles IS NULL OR coalesce(array_length(roles, 1), 0) = 0 THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.active = true
        AND om.role = ANY(roles)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.has_org_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO authenticated, service_role;

-- Puente retrocompatible con `salones_del_usuario()` (velli-bi-cotizador.sql)
CREATE OR REPLACE FUNCTION public.salones_del_usuario()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.uid
  FROM (SELECT auth.uid() AS uid) u
  WHERE u.uid IS NOT NULL
  UNION
  SELECT public.current_user_org_ids();
$$;

-- ── 5. Backfill idempotente de usuarios/salones existentes ─────────────────
-- Reutiliza `id = profiles.id` para garantizar correspondencia 1:1 determinista
-- sin duplicar organizaciones al re-ejecutar la migración.

INSERT INTO public.organizations (
  id,
  slug,
  name,
  vertical,
  plan,
  whatsapp_phone,
  city,
  feature_flags,
  created_at
)
SELECT
  p.id,
  public.slugify_organization_name(
    coalesce(nullif(btrim(p.nombre_salon), ''), nullif(btrim(p.nombre), ''), 'Salon'),
    p.id
  ),
  left(coalesce(nullif(btrim(p.nombre_salon), ''), nullif(btrim(p.nombre), ''), 'Mi Salón'), 120),
  'hair_studio',
  CASE
    WHEN s.plan IN ('basico', 'pro', 'pro_ia') THEN s.plan
    ELSE 'trialing'
  END,
  nullif(btrim(p.telefono), ''),
  nullif(btrim(p.ciudad), ''),
  CASE
    WHEN jsonb_typeof(to_jsonb(p) -> 'feature_flags') = 'object' THEN (to_jsonb(p) -> 'feature_flags')
    ELSE '{}'::jsonb
  END,
  coalesce(p.created_at, now())
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (
  organization_id,
  user_id,
  role,
  active,
  created_at
)
SELECT
  p.id,
  p.id,
  'owner',
  true,
  coalesce(p.created_at, now())
FROM public.profiles p
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p.id)
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO public.brand_settings (
  organization_id,
  display_name,
  logo_url,
  primary_color,
  accent_color,
  created_at
)
SELECT
  o.id,
  o.name,
  nullif(btrim(p.logo_url), ''),
  CASE
    WHEN p.color_primario ~ '^#[0-9A-Fa-f]{6}$'
      AND upper(p.color_primario) NOT IN ('#2D5A27', '#000000')
      THEN upper(p.color_primario)
    ELSE '#3B0D1E'
  END,
  '#E8CFC8',
  o.created_at
FROM public.organizations o
LEFT JOIN public.profiles p ON p.id = o.id
ON CONFLICT (organization_id) DO NOTHING;

-- Actualizar `handle_new_user()` para aprovisionar organización, membresía
-- `owner` y `brand_settings` automáticamente en nuevos registros.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
BEGIN
  v_display_name := left(
    coalesce(
      nullif(btrim(NEW.raw_user_meta_data->>'nombre_salon'), ''),
      nullif(btrim(NEW.raw_user_meta_data->>'nombre'), ''),
      'Mi Salón'
    ),
    120
  );

  INSERT INTO public.profiles (id, nombre, nombre_salon, legal_aceptado_at, legal_version)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Estilista'),
    NULLIF(NEW.raw_user_meta_data->>'nombre_salon', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'legal_version' IS NOT NULL THEN now()
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'legal_version', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
  VALUES (NEW.id, 'trialing', now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.eventos_activacion (user_id, evento)
  VALUES (NEW.id, 'registro')
  ON CONFLICT (user_id, evento) DO NOTHING;

  INSERT INTO public.organizations (id, slug, name, vertical, plan)
  VALUES (
    NEW.id,
    public.slugify_organization_name(v_display_name, NEW.id),
    v_display_name,
    'hair_studio',
    'trialing'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organization_members (organization_id, user_id, role, active)
  VALUES (NEW.id, NEW.id, 'owner', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO public.brand_settings (organization_id, display_name, primary_color, accent_color)
  VALUES (NEW.id, v_display_name, '#3B0D1E', '#E8CFC8')
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 6. Columna `organization_id`, backfill e inferencia automática ─────────
CREATE OR REPLACE FUNCTION public.assign_default_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT om.organization_id INTO NEW.organization_id
    FROM public.organization_members om
    WHERE om.user_id = COALESCE((SELECT auth.uid()), NEW.user_id)
      AND om.active = true
    ORDER BY
      CASE om.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
      om.created_at ASC
    LIMIT 1;

    IF NEW.organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.id = NEW.user_id
    ) THEN
      NEW.organization_id := NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_default_organization_id() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
  tablas_tenant constant text[] := ARRAY[
    'clientas',
    'consultas',
    'citas',
    'consentimientos_clienta',
    'pruebas_sensibilidad',
    'servicios_color',
    'estilistas',
    'servicios_salon',
    'plantillas_precio',
    'productos_salon',
    'comisiones',
    'cotizaciones',
    'cotizacion_eventos',
    'uso_ia'
  ];
BEGIN
  FOREACH t IN ARRAY tablas_tenant LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
        'idx_' || t || '_organization_id',
        t
      );
      EXECUTE format(
        'UPDATE public.%I SET organization_id = user_id
          WHERE organization_id IS NULL
            AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = user_id)',
        t
      );
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I',
        'set_default_org_' || t,
        t
      );
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.assign_default_organization_id()',
        'set_default_org_' || t,
        t
      );
    END IF;
  END LOOP;
END $$;

-- ── 7. Row Level Security en las nuevas tablas Multi-Tenant ────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

-- 7.1 `organizations`
DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;
CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
CREATE POLICY organizations_update_admin ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_org_role(id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS organizations_delete_owner ON public.organizations;
CREATE POLICY organizations_delete_owner ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']));

-- 7.2 `organization_members`
DROP POLICY IF EXISTS organization_members_select_member ON public.organization_members;
CREATE POLICY organization_members_select_member ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS organization_members_insert_admin ON public.organization_members;
CREATE POLICY organization_members_insert_admin ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner'])
    OR (
      public.has_org_role(organization_id, ARRAY['manager'])
      AND role = 'specialist'
    )
  );

DROP POLICY IF EXISTS organization_members_update_admin ON public.organization_members;
CREATE POLICY organization_members_update_admin ON public.organization_members
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(organization_id, ARRAY['owner'])
    OR (
      public.has_org_role(organization_id, ARRAY['manager'])
      AND role = 'specialist'
    )
  )
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner'])
    OR (
      public.has_org_role(organization_id, ARRAY['manager'])
      AND role = 'specialist'
    )
  );

DROP POLICY IF EXISTS organization_members_delete_owner ON public.organization_members;
CREATE POLICY organization_members_delete_owner ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner']));

-- 7.3 `brand_settings` (lectura para miembros; edición exclusiva owner/manager)
DROP POLICY IF EXISTS brand_settings_select_member ON public.brand_settings;
CREATE POLICY brand_settings_select_member ON public.brand_settings
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS brand_settings_insert_admin ON public.brand_settings;
CREATE POLICY brand_settings_insert_admin ON public.brand_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS brand_settings_update_admin ON public.brand_settings;
CREATE POLICY brand_settings_update_admin ON public.brand_settings
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS brand_settings_delete_owner ON public.brand_settings;
CREATE POLICY brand_settings_delete_owner ON public.brand_settings
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner']));

-- ── 8. RLS estricta por `organization_id` y rol en costos y utilidad neta ──
-- Regla innegociable: el rol `specialist` NO puede leer ni modificar costos
-- de compra de química (`productos_salon`), reglas de comisiones
-- (`comisiones`), bitácora financiera (`cotizacion_eventos`) ni columnas de
-- utilidad/márgenes de `cotizaciones`, ni editar plantillas/menú del salón.

DO $$
BEGIN
  -- 8.1 Calibración de costos químicos (`productos_salon`) y `comisiones`:
  --     OCULTOS por completo al rol `specialist` (solo `owner` y `manager`).
  IF to_regclass('public.productos_salon') IS NOT NULL THEN
    DROP POLICY IF EXISTS productos_salon_select_salon ON public.productos_salon;
    DROP POLICY IF EXISTS productos_salon_insert_salon ON public.productos_salon;
    DROP POLICY IF EXISTS productos_salon_update_salon ON public.productos_salon;
    DROP POLICY IF EXISTS productos_salon_delete_salon ON public.productos_salon;

    DROP POLICY IF EXISTS productos_salon_select_admin ON public.productos_salon;
    CREATE POLICY productos_salon_select_admin ON public.productos_salon
      FOR SELECT TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS productos_salon_insert_admin ON public.productos_salon;
    CREATE POLICY productos_salon_insert_admin ON public.productos_salon
      FOR INSERT TO authenticated
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS productos_salon_update_admin ON public.productos_salon;
    CREATE POLICY productos_salon_update_admin ON public.productos_salon
      FOR UPDATE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']))
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS productos_salon_delete_admin ON public.productos_salon;
    CREATE POLICY productos_salon_delete_admin ON public.productos_salon
      FOR DELETE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));
  END IF;

  IF to_regclass('public.comisiones') IS NOT NULL THEN
    DROP POLICY IF EXISTS comisiones_select_salon ON public.comisiones;
    DROP POLICY IF EXISTS comisiones_insert_salon ON public.comisiones;
    DROP POLICY IF EXISTS comisiones_update_salon ON public.comisiones;
    DROP POLICY IF EXISTS comisiones_delete_salon ON public.comisiones;

    DROP POLICY IF EXISTS comisiones_select_admin ON public.comisiones;
    CREATE POLICY comisiones_select_admin ON public.comisiones
      FOR SELECT TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS comisiones_insert_admin ON public.comisiones;
    CREATE POLICY comisiones_insert_admin ON public.comisiones
      FOR INSERT TO authenticated
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS comisiones_update_admin ON public.comisiones;
    CREATE POLICY comisiones_update_admin ON public.comisiones
      FOR UPDATE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']))
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS comisiones_delete_admin ON public.comisiones;
    CREATE POLICY comisiones_delete_admin ON public.comisiones
      FOR DELETE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));
  END IF;

  -- 8.2 Catálogo operativo (`servicios_salon`, `estilistas`) y `plantillas_precio`:
  --     lectura para miembros activos (cotizar en silla); calibración/escritura
  --     exclusiva de `owner` y `manager`.
  IF to_regclass('public.servicios_salon') IS NOT NULL THEN
    DROP POLICY IF EXISTS servicios_salon_select_salon ON public.servicios_salon;
    DROP POLICY IF EXISTS servicios_salon_insert_salon ON public.servicios_salon;
    DROP POLICY IF EXISTS servicios_salon_update_salon ON public.servicios_salon;
    DROP POLICY IF EXISTS servicios_salon_delete_salon ON public.servicios_salon;

    DROP POLICY IF EXISTS servicios_salon_select_member ON public.servicios_salon;
    CREATE POLICY servicios_salon_select_member ON public.servicios_salon
      FOR SELECT TO authenticated
      USING (COALESCE(organization_id, user_id) IN (SELECT public.current_user_org_ids()));

    DROP POLICY IF EXISTS servicios_salon_insert_admin ON public.servicios_salon;
    CREATE POLICY servicios_salon_insert_admin ON public.servicios_salon
      FOR INSERT TO authenticated
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS servicios_salon_update_admin ON public.servicios_salon;
    CREATE POLICY servicios_salon_update_admin ON public.servicios_salon
      FOR UPDATE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']))
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS servicios_salon_delete_admin ON public.servicios_salon;
    CREATE POLICY servicios_salon_delete_admin ON public.servicios_salon
      FOR DELETE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));
  END IF;

  IF to_regclass('public.estilistas') IS NOT NULL THEN
    DROP POLICY IF EXISTS estilistas_select_salon ON public.estilistas;
    DROP POLICY IF EXISTS estilistas_insert_salon ON public.estilistas;
    DROP POLICY IF EXISTS estilistas_update_salon ON public.estilistas;
    DROP POLICY IF EXISTS estilistas_delete_salon ON public.estilistas;

    DROP POLICY IF EXISTS estilistas_select_member ON public.estilistas;
    CREATE POLICY estilistas_select_member ON public.estilistas
      FOR SELECT TO authenticated
      USING (COALESCE(organization_id, user_id) IN (SELECT public.current_user_org_ids()));

    DROP POLICY IF EXISTS estilistas_insert_admin ON public.estilistas;
    CREATE POLICY estilistas_insert_admin ON public.estilistas
      FOR INSERT TO authenticated
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS estilistas_update_admin ON public.estilistas;
    CREATE POLICY estilistas_update_admin ON public.estilistas
      FOR UPDATE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']))
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS estilistas_delete_admin ON public.estilistas;
    CREATE POLICY estilistas_delete_admin ON public.estilistas
      FOR DELETE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));
  END IF;

  IF to_regclass('public.plantillas_precio') IS NOT NULL THEN
    DROP POLICY IF EXISTS plantillas_precio_select_salon ON public.plantillas_precio;
    DROP POLICY IF EXISTS plantillas_precio_insert_salon ON public.plantillas_precio;
    DROP POLICY IF EXISTS plantillas_precio_update_salon ON public.plantillas_precio;

    DROP POLICY IF EXISTS plantillas_precio_select_member ON public.plantillas_precio;
    CREATE POLICY plantillas_precio_select_member ON public.plantillas_precio
      FOR SELECT TO authenticated
      USING (COALESCE(organization_id, user_id) IN (SELECT public.current_user_org_ids()));

    DROP POLICY IF EXISTS plantillas_precio_insert_admin ON public.plantillas_precio;
    CREATE POLICY plantillas_precio_insert_admin ON public.plantillas_precio
      FOR INSERT TO authenticated
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS plantillas_precio_update_admin ON public.plantillas_precio;
    CREATE POLICY plantillas_precio_update_admin ON public.plantillas_precio
      FOR UPDATE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']))
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));
  END IF;

  -- 8.3 Cotizaciones y eventos financieros (`cotizaciones`, `cotizacion_eventos`):
  --     La tabla cruda `cotizaciones` contiene `costo_producto_estimado`,
  --     `costo_detalle` y `comision_detalle` (utilidad neta del salón), por lo
  --     que su lectura directa y eventos BI se reservan a `owner` y `manager`.
  --     `specialist` puede registrar cotizaciones en silla y consultar la
  --     proyección operativa sin costos vía `cotizaciones_operativas_silla()`.
  IF to_regclass('public.cotizaciones') IS NOT NULL THEN
    DROP POLICY IF EXISTS cotizaciones_select_salon ON public.cotizaciones;
    DROP POLICY IF EXISTS cotizaciones_insert_salon ON public.cotizaciones;
    DROP POLICY IF EXISTS cotizaciones_update_salon ON public.cotizaciones;
    DROP POLICY IF EXISTS cotizaciones_delete_borrador ON public.cotizaciones;

    DROP POLICY IF EXISTS cotizaciones_select_admin ON public.cotizaciones;
    CREATE POLICY cotizaciones_select_admin ON public.cotizaciones
      FOR SELECT TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS cotizaciones_insert_member ON public.cotizaciones;
    CREATE POLICY cotizaciones_insert_member ON public.cotizaciones
      FOR INSERT TO authenticated
      WITH CHECK (COALESCE(organization_id, user_id) IN (SELECT public.current_user_org_ids()));

    DROP POLICY IF EXISTS cotizaciones_update_admin ON public.cotizaciones;
    CREATE POLICY cotizaciones_update_admin ON public.cotizaciones
      FOR UPDATE TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']))
      WITH CHECK (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));

    DROP POLICY IF EXISTS cotizaciones_delete_borrador_admin ON public.cotizaciones;
    CREATE POLICY cotizaciones_delete_borrador_admin ON public.cotizaciones
      FOR DELETE TO authenticated
      USING (
        public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager'])
        AND estado = 'borrador'
      );
  END IF;

  IF to_regclass('public.cotizacion_eventos') IS NOT NULL THEN
    DROP POLICY IF EXISTS cotizacion_eventos_select_salon ON public.cotizacion_eventos;

    DROP POLICY IF EXISTS cotizacion_eventos_select_admin ON public.cotizacion_eventos;
    CREATE POLICY cotizacion_eventos_select_admin ON public.cotizacion_eventos
      FOR SELECT TO authenticated
      USING (public.has_org_role(COALESCE(organization_id, user_id), ARRAY['owner', 'manager']));
  END IF;
END $$;

-- ── 9. RPCs acotadas por Rol y Privacidad Pública ──────────────────────────

-- Proyección operativa para `specialist` en silla (NUNCA expone costos ni utilidad neta)
CREATE OR REPLACE FUNCTION public.cotizaciones_operativas_silla(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  clienta_id uuid,
  estilista_id uuid,
  servicio_id uuid,
  servicio_nombre text,
  estilista_nombre text,
  variables jsonb,
  precio_cotizado integer,
  moneda text,
  vigencia_hasta date,
  estado text,
  token_publico uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_org_role(p_org_id, ARRAY['owner', 'manager', 'specialist']) THEN
    RAISE EXCEPTION 'FORBIDDEN_ORG: no perteneces a esta organización';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    COALESCE(c.organization_id, c.user_id),
    c.clienta_id,
    c.estilista_id,
    c.servicio_id,
    c.servicio_nombre,
    c.estilista_nombre,
    c.variables,
    c.precio_cotizado,
    c.moneda,
    c.vigencia_hasta,
    c.estado,
    c.token_publico,
    c.created_at
  FROM public.cotizaciones c
  WHERE COALESCE(c.organization_id, c.user_id) = p_org_id
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.cotizaciones_operativas_silla(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotizaciones_operativas_silla(uuid) TO authenticated, service_role;

-- Reporte ejecutivo de utilidad neta (estrictamente bloqueado para `specialist`)
CREATE OR REPLACE FUNCTION public.resumen_utilidad_neta_org(
  p_org_id uuid,
  p_desde timestamptz DEFAULT NULL
)
RETURNS TABLE (
  servicios_cobrados bigint,
  ingresos_cobrados bigint,
  inversion_quimica bigint,
  comisiones_equipo bigint,
  utilidad_neta_salon bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_org_role(p_org_id, ARRAY['owner', 'manager']) THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: el rol specialist no tiene acceso a reportes de utilidad neta';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint AS servicios_cobrados,
    coalesce(sum(coalesce(c.precio_cobrado, c.precio_cotizado)), 0)::bigint AS ingresos_cobrados,
    coalesce(sum(coalesce(c.costo_producto_estimado, 0)), 0)::bigint AS inversion_quimica,
    coalesce(sum(coalesce(c.comision_estimada, 0)), 0)::bigint AS comisiones_equipo,
    coalesce(
      sum(
        coalesce(c.precio_cobrado, c.precio_cotizado)
        - coalesce(c.costo_producto_estimado, 0)
        - coalesce(c.comision_estimada, 0)
      ),
      0
    )::bigint AS utilidad_neta_salon
  FROM public.cotizaciones c
  WHERE COALESCE(c.organization_id, c.user_id) = p_org_id
    AND c.estado = 'cobrada'
    AND (p_desde IS NULL OR coalesce(c.cobrado_at, c.created_at) >= p_desde);
END;
$$;

REVOKE ALL ON FUNCTION public.resumen_utilidad_neta_org(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_utilidad_neta_org(uuid, timestamptz) TO authenticated, service_role;

-- Identidad pública por slug de organización (solo campos visuales seguros)
CREATE OR REPLACE FUNCTION public.public_brand_settings(p_slug text)
RETURNS TABLE (
  organization_id uuid,
  slug text,
  display_name text,
  logo_url text,
  primary_color text,
  accent_color text,
  public_tagline text,
  legal_footer text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.id,
    o.slug,
    coalesce(nullif(btrim(bs.display_name), ''), o.name),
    bs.logo_url,
    coalesce(bs.primary_color, '#3B0D1E'),
    coalesce(bs.accent_color, '#E8CFC8'),
    bs.public_tagline,
    bs.legal_footer
  FROM public.organizations o
  LEFT JOIN public.brand_settings bs ON bs.organization_id = o.id
  WHERE o.slug = lower(btrim(p_slug));
$$;

REVOKE ALL ON FUNCTION public.public_brand_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_brand_settings(text) TO anon, authenticated, service_role;

-- Actualizar `cotizacion_publica(p_token)` para parametrizar nombre y acento
-- desde `brand_settings` manteniendo la firma exacta y cero exposición interna.
DO $$
BEGIN
  IF to_regclass('public.cotizaciones') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.cotizacion_publica(p_token uuid)
      RETURNS TABLE (
        salon text,
        color_salon text,
        servicio text,
        precio integer,
        moneda text,
        vigencia_hasta date,
        vigente boolean,
        con_marca_velli boolean
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = ''
      AS $body$
        SELECT
          coalesce(
            nullif(btrim(bs.display_name), ''),
            nullif(btrim(p.nombre_salon), ''),
            'Tu salón'
          ),
          coalesce(
            nullif(btrim(bs.primary_color), ''),
            nullif(btrim(p.color_primario), ''),
            '#3B0D1E'
          ),
          c.servicio_nombre,
          c.precio_cotizado,
          c.moneda,
          c.vigencia_hasta,
          c.vigencia_hasta >= (now() AT TIME ZONE 'America/Bogota')::date,
          c.con_marca_velli
        FROM public.cotizaciones c
        JOIN public.profiles p ON p.id = c.user_id
        LEFT JOIN public.brand_settings bs
          ON bs.organization_id = COALESCE(c.organization_id, c.user_id)
        WHERE c.token_publico = p_token
          AND c.estado IN ('enviada', 'cobrada');
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 10. Privilegios explícitos ─────────────────────────────────────────────
REVOKE ALL ON TABLE
  public.organizations,
  public.organization_members,
  public.brand_settings
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.organizations,
  public.organization_members,
  public.brand_settings
TO authenticated;

GRANT ALL ON TABLE
  public.organizations,
  public.organization_members,
  public.brand_settings
TO service_role;
