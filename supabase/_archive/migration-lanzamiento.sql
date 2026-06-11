-- ARCHIVED: Ejecutado en prod y consolidado en schema.sql el 2026-06-11
-- ============================================================================
-- migration-lanzamiento.sql — Funnel de activación (beta) + aceptación legal
-- ============================================================================
-- Sprint de lanzamiento. Dos piezas (consolidadas aquí porque ambas tocan
-- handle_new_user — una sola redefinición con todo):
--
--   A) Funnel de hitos por cuenta: registro → onboarding_completado →
--      primera_clienta → primer_diagnostico → pago. Cada etapa cuenta UNA
--      sola vez por usuaria (UNIQUE user_id+evento): mide conversión, no
--      volumen de actividad.
--   B) Aceptación legal: fecha y versión de Términos/Privacidad aceptadas
--      en el registro (profiles.legal_aceptado_at / legal_version, leídas
--      del metadata del signup). La versión vigente vive en lib/legal.ts.
--
-- Quién escribe cada evento:
--   · registro              — trigger handle_new_user (al crear el usuario).
--   · onboarding_completado — cliente, al terminar/saltar el wizard.
--   · primera_clienta       — cliente, en createClienta (dedupe por UNIQUE).
--   · primer_diagnostico    — cliente, en createConsulta (dedupe por UNIQUE).
--   · pago                  — webhook de pagos (service_role) cuando la RPC
--                             procesar_evento_pago devuelve 'applied'.
--
-- Lectura agregada: SOLO cuentas fundadoras (profiles.es_fundadora) vía la
-- RPC funnel_activacion() — SECURITY DEFINER con gate explícito. Las cuentas
-- normales solo pueden ver/insertar sus propios eventos (RLS).
--
-- Sin backfill: el funnel arranca en cero a propósito — mide a las
-- estilistas nuevas de la beta, no a las cuentas históricas.
--
-- Idempotente: se puede ejecutar más de una vez sin efectos duplicados.
-- Aplicar en SQL Editor (dev / staging / prod). Después del rollout,
-- regenerar schema.sql según supabase/README.md.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabla de eventos + RLS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.eventos_activacion (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evento     text NOT NULL CHECK (evento IN (
               'registro',
               'onboarding_completado',
               'primera_clienta',
               'primer_diagnostico',
               'pago'
             )),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Funnel de hitos: cada etapa una vez por cuenta.
  CONSTRAINT eventos_activacion_user_evento_unique UNIQUE (user_id, evento)
);

ALTER TABLE public.eventos_activacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_activacion_insert_own ON public.eventos_activacion;
CREATE POLICY eventos_activacion_insert_own
  ON public.eventos_activacion FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS eventos_activacion_select_own ON public.eventos_activacion;
CREATE POLICY eventos_activacion_select_own
  ON public.eventos_activacion FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_eventos_activacion_evento
  ON public.eventos_activacion (evento);

GRANT SELECT, INSERT ON public.eventos_activacion TO authenticated;
GRANT ALL ON public.eventos_activacion TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Flag de cuenta fundadora (lectura del funnel agregado)
-- ────────────────────────────────────────────────────────────────────────────
-- Se enciende A MANO para las cuentas del equipo:
--   UPDATE public.profiles SET es_fundadora = true WHERE id = '<uuid>';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS es_fundadora boolean NOT NULL DEFAULT false;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Aceptación legal: fecha y versión por cuenta
-- ────────────────────────────────────────────────────────────────────────────
-- El registro exige checkbox de Términos/Privacidad; el signup manda
-- legal_version en el metadata y aquí se persisten versión + timestamp.
-- Cuentas existentes quedan en NULL (aceptaron antes de versionar — si la
-- abogada lo exige, se les pedirá re-aceptar en una iteración futura).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_aceptado_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_version text;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. handle_new_user: evento 'registro' + aceptación legal en el signup
-- ────────────────────────────────────────────────────────────────────────────
-- Redefine la función completa (profile + trial + evento + legal). Mantener
-- en sync con migration-suscripciones.sql sección 6.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. RPC de lectura agregada — solo fundadoras
-- ────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER para agregar entre tenants, con gate explícito: cualquier
-- cuenta sin es_fundadora recibe una excepción (el cliente la trata como
-- "sección no disponible").

CREATE OR REPLACE FUNCTION public.funnel_activacion()
RETURNS TABLE (evento text, cuentas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.es_fundadora
  ) THEN
    RAISE EXCEPTION 'forbidden: solo cuentas fundadoras';
  END IF;

  RETURN QUERY
  SELECT e.evento, count(DISTINCT e.user_id)::bigint AS cuentas
  FROM public.eventos_activacion e
  GROUP BY e.evento;
END;
$$;

REVOKE ALL ON FUNCTION public.funnel_activacion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.funnel_activacion() TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Refrescar el schema cache de PostgREST
-- ────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
