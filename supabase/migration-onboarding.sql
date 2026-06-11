-- ============================================================================
-- migration-onboarding.sql — Onboarding autónomo (wizard + checklist)
-- ============================================================================
-- Agrega a public.profiles las columnas del onboarding de primera vez:
--
--   · onboarding_completed   — gate del wizard /onboarding. false solo para
--                              registros NUEVOS; las cuentas existentes se
--                              backfillean a true y nunca ven el wizard.
--   · checklist_descartada   — la tarjeta "Empieza aquí" del Dashboard
--                              desaparece definitivamente al completarse o
--                              descartarse. Backfill true para existentes.
--   · primer_pdf_descargado  — ítem 4 de la checklist; lo marca el cliente
--                              al descargar el primer PDF de diagnóstico.
--   · logo_url               — logo del salón (bucket fotos, paso 2 wizard).
--                              color_primario ya existía en profiles.
--   · servicios              — jsonb: array de strings (paso 3 wizard).
--   · horario_atencion       — jsonb: { dias: int[] (0=dom…6=sáb),
--                              desde: "HH:MM", hasta: "HH:MM" } (paso 3).
--
-- Idempotente: se puede ejecutar más de una vez sin efectos duplicados.
-- El backfill de onboarding_completed/checklist_descartada solo corre la
-- PRIMERA vez (cuando la columna no existe aún) — re-ejecutar la migración
-- jamás re-marca a usuarios nuevos que están a mitad de su onboarding.
--
-- handle_new_user() NO necesita cambios: los profiles nuevos toman los
-- DEFAULT false de las columnas.
--
-- Aplicar en SQL Editor (dev / staging / prod). Después del rollout,
-- regenerar schema.sql según supabase/README.md.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Columnas nuevas + backfill de cuentas existentes (solo primera vez)
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  primera_vez boolean;
BEGIN
  -- El guard vive sobre onboarding_completed: si la columna ya existe, la
  -- migración ya corrió y el backfill NO debe repetirse.
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'onboarding_completed'
  ) INTO primera_vez;

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS checklist_descartada boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS primer_pdf_descargado boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS logo_url text,
    ADD COLUMN IF NOT EXISTS servicios jsonb,
    ADD COLUMN IF NOT EXISTS horario_atencion jsonb;

  IF primera_vez THEN
    -- Todo tenant existente (producción y desarrollo) entra como "ya
    -- onboardeado": ni wizard ni checklist. Los registros posteriores a
    -- esta migración nacen con false por DEFAULT.
    UPDATE public.profiles
    SET onboarding_completed = true,
        checklist_descartada = true;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Refrescar el schema cache de PostgREST
-- ────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
