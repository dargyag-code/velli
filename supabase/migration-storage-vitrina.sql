-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Supabase Storage para Vitrina Editorial y Marca (`vitrina-media`)
--
-- Reglas cumplidas (`AGENTS.md`):
-- 1. Bucket público `vitrina-media` acotado estrictamente a 3 MB (3.145.728 B)
--    y tipos MIME seguros (`image/jpeg`, `image/png`, `image/webp`).
-- 2. Lectura pública de activos visuales comerciales (productos de tienda y
--    logotipo de marca); las fotos clínicas privadas de clientas permanecen en
--    el bucket privado `fotos`.
-- 3. Escritura, edición y borrado en `storage.objects` restringidos por RLS
--    real exclusivamente a rutas `{organization_id}/products/*` y
--    `{organization_id}/brand/*` cuando el usuario autenticado posee
--    `public.has_org_role(organization_id, ARRAY['owner', 'manager'])`.
--
-- Idempotente y no destructiva.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'vitrina-media',
  'vitrina-media',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Valida estructura de ruta `{organization_id}/(products|brand)/<archivo>`
-- sin saltos de directorio y exige rol `owner` o `manager` en esa organización.
CREATE OR REPLACE FUNCTION public.can_manage_vitrina_media_object(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_object_name IS NULL
     OR p_object_name LIKE '%..%'
     OR p_object_name LIKE '%//%'
     OR p_object_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(products|brand)/[A-Za-z0-9._-]+$' THEN
    RETURN false;
  END IF;

  v_org_id := (pg_catalog.split_part(p_object_name, '/', 1))::uuid;
  RETURN public.has_org_role(v_org_id, ARRAY['owner', 'manager']);
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_vitrina_media_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_vitrina_media_object(text) TO authenticated, service_role;

-- Políticas RLS sobre `storage.objects` para el bucket `vitrina-media`
DROP POLICY IF EXISTS vitrina_media_select_public ON storage.objects;
CREATE POLICY vitrina_media_select_public ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'vitrina-media');

DROP POLICY IF EXISTS vitrina_media_insert_admin ON storage.objects;
CREATE POLICY vitrina_media_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vitrina-media'
    AND public.can_manage_vitrina_media_object(name)
  );

DROP POLICY IF EXISTS vitrina_media_update_admin ON storage.objects;
CREATE POLICY vitrina_media_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vitrina-media'
    AND public.can_manage_vitrina_media_object(name)
  )
  WITH CHECK (
    bucket_id = 'vitrina-media'
    AND public.can_manage_vitrina_media_object(name)
  );

DROP POLICY IF EXISTS vitrina_media_delete_admin ON storage.objects;
CREATE POLICY vitrina_media_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vitrina-media'
    AND public.can_manage_vitrina_media_object(name)
  );
