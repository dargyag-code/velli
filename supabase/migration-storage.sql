-- ══════════════════════════════════════════════════════════════════════════
-- VELLI PRO — STORAGE: bucket "fotos" + políticas por usuario
-- ══════════════════════════════════════════════════════════════════════════
-- Idempotente. Pegar completo en el SQL Editor de Supabase.
--
-- Estructura de paths esperada por lib/storage.ts:
--   {user.id}/{diagnosticos/<consulta-id>/<subpath>}.(webp|png|jpg)
--
-- Las políticas validan que el primer segmento de la ruta sea el uid del
-- usuario autenticado, para que cada estilista solo pueda leer/escribir
-- su propia carpeta.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Bucket privado ────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', false)
ON CONFLICT (id) DO NOTHING;

-- ── Políticas: borrar las viejas (por si cambian) y recrear ─────────────
DROP POLICY IF EXISTS "fotos_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "fotos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "fotos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "fotos_delete_own" ON storage.objects;

CREATE POLICY "fotos_upload_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fotos_select_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fotos_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fotos_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Verificación ─────────────────────────────────────────────────────────
SELECT
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id = 'fotos';

SELECT policyname
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
