-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: proteger los campos de privilegio de profiles
-- Estado: APLICADA en producción. Vanessa lo confirmó el 2026-10-22: pg_trigger
-- muestra profiles_guard_campos_protegidos junto a set_updated_at_profiles.
-- Sigue en supabase/ hasta regenerar schema.sql; después se archiva.
--
-- Problema (docs/velli-bi/00-auditoria.md, R17): `authenticated` tiene
-- GRANT ALL sobre profiles y la policy "Users can update own profile" solo
-- limita la FILA, no las columnas. Cualquier cuenta con sesión puede hacer
--   update profiles set rol = 'corporativo' where id = auth.uid()
-- desde el cliente de Supabase y, con eso, escribir en la librería global
-- (kb_reglas, kb_flujos, kb_prompts, kb_marcas, kb_cortes) que alimenta el
-- diagnóstico de TODOS los salones.
--
-- Corrección: un trigger rechaza cambios a rol, es_fundadora y
-- feature_flags cuando vienen de una sesión de usuario (auth.uid() no nulo).
-- El SQL Editor y service_role (auth.uid() nulo) siguen asignándolos.
-- handle_new_user() corre durante el registro sin sesión: no se ve afectado.
--
-- La función es IDÉNTICA a la de migration-feature-flags.sql: se pueden
-- aplicar en cualquier orden. feature_flags se lee vía to_jsonb() para que
-- funcione también antes de que exista la columna. Un test vigila que las
-- dos copias no driftean (tests/flags.test.ts).
--
-- Idempotente: re-ejecutable sin efectos dobles. No toca datos.
-- ═══════════════════════════════════════════════════════════════════════════

-- >>> guardia-perfil (copia idéntica en migration-feature-flags.sql)
CREATE OR REPLACE FUNCTION public.profiles_guard_campos_protegidos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Sin sesión de usuario (SQL Editor, service_role, registro): permitido.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.rol IS DISTINCT FROM 'salon'
       OR NEW.es_fundadora
       OR COALESCE(to_jsonb(NEW) -> 'feature_flags', '{}'::jsonb) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'CAMPO_PROTEGIDO: rol, es_fundadora y feature_flags los asigna el equipo Velli';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.es_fundadora IS DISTINCT FROM OLD.es_fundadora
     OR (to_jsonb(NEW) -> 'feature_flags') IS DISTINCT FROM (to_jsonb(OLD) -> 'feature_flags') THEN
    RAISE EXCEPTION 'CAMPO_PROTEGIDO: rol, es_fundadora y feature_flags los asigna el equipo Velli';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_campos_protegidos ON public.profiles;
CREATE TRIGGER profiles_guard_campos_protegidos
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_campos_protegidos();
-- <<< guardia-perfil

-- Verificación sin escribir (después de aplicar):
--   select tgname from pg_trigger
--    where tgrelid = 'public.profiles'::regclass and not tgisinternal;
--   → debe listar profiles_guard_campos_protegidos y set_updated_at_profiles.
