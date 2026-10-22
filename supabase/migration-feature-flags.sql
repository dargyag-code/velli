-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: feature flags por salón (Velli BI · Fase 1 · Etapa 1)
-- Estado: APLICADA en producción el 2026-10-22 (la corrió Vanessa; la columna
-- se verificó por lectura). Sigue en supabase/ hasta regenerar schema.sql.
--
-- profiles.feature_flags guarda los overrides de un salón sobre los flags
-- del entorno (registro en lib/flags/registro.ts). Precedencia:
-- salón > entorno (NEXT_PUBLIC_VELLI_FLAGS) > valor por defecto. Un flag
-- 'retirado' no se enciende con ningún override.
--
-- El código ya funciona sin esta columna: lib/profile.ts la lee si existe y,
-- si no, rigen los valores del entorno. Por eso se puede desplegar antes.
--
-- Los overrides los asigna el equipo por SQL. La guardia (idéntica a la de
-- migration-proteger-perfil.sql) impide que una cuenta se los cambie.
--
-- Encender cortes a un salón piloto (SQL Editor):
--   update public.profiles
--      set feature_flags = feature_flags || '{"cortes": true}'::jsonb
--    where id = '<uuid del salón>';
-- Quitar el override:
--   update public.profiles set feature_flags = feature_flags - 'cortes'
--    where id = '<uuid del salón>';
--
-- Idempotente: re-ejecutable sin efectos dobles. No cambia filas existentes
-- más allá del default '{}' de la columna nueva.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_feature_flags_objeto'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_feature_flags_objeto
      CHECK (jsonb_typeof(feature_flags) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.feature_flags IS
  'Overrides de feature flags del salón (lib/flags). Solo SQL Editor / service_role.';

-- >>> guardia-perfil (copia idéntica en migration-proteger-perfil.sql)
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
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name = 'feature_flags';
