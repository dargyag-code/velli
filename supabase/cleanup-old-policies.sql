-- ══════════════════════════════════════════════════════════════════════════
-- VELLI PRO — STORAGE: limpiar políticas antiguas duplicadas
-- ══════════════════════════════════════════════════════════════════════════
-- Elimina SOLO las políticas viejas con nombres en español que se solapan
-- con las nuevas (fotos_upload_propias, fotos_seleccionar_propia,
-- fotos_actualizar_propia, fotos_eliminar_propio).
--
-- Seguro de ejecutar: usa IF EXISTS, no toca las políticas nuevas.
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propias fotos." ON storage.objects;
DROP POLICY IF EXISTS "Los usuarios pueden subir sus propias fotos." ON storage.objects;
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propias fotos." ON storage.objects;

-- ── Verificación: listar políticas restantes ────────────────────────────
SELECT policyname
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
