-- ═══════════════════════════════════════════════════════════════════════════
-- BORRADOR — NO APLICAR. Velli BI · Etapa 2/3: registro de uso de la IA.
-- Propuesta y números: docs/velli-bi/01-costo-ia.md (§6).
--
-- Cada llamada a /api/analyze-hair y /api/validate-hair-photo deja una fila
-- con los tokens que reporta el proveedor (campo `usage`). Sirve para dos
-- cosas: medir el costo real (hoy no se guarda nada) y hacer cumplir el tope
-- mensual de Pro+IA en el SERVIDOR.
--
-- Quién escribe: la ruta del servidor con service_role (lib/supabase/admin).
-- Las cuentas solo leen lo suyo: no pueden borrar filas para "recuperar"
-- cupo ni inflar las de otro salón.
--
-- Idempotente. No escribe datos. Probado en PGlite
-- (docs/velli-bi/calculos/probar_borradores.mjs), nunca contra producción.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.uso_ia (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ruta text NOT NULL CHECK (ruta IN ('analizar', 'validar')),
  proveedor text NOT NULL CHECK (proveedor IN ('anthropic', 'openai')),
  modelo text NOT NULL,
  fotos smallint NOT NULL CHECK (fotos BETWEEN 0 AND 10),
  tokens_entrada integer CHECK (tokens_entrada IS NULL OR tokens_entrada >= 0),
  tokens_salida integer CHECK (tokens_salida IS NULL OR tokens_salida >= 0),
  costo_usd numeric(10, 6) CHECK (costo_usd IS NULL OR costo_usd >= 0),
  ok boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uso_ia_user_fecha ON public.uso_ia (user_id, created_at DESC);

ALTER TABLE public.uso_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uso_ia_select_own ON public.uso_ia;
CREATE POLICY uso_ia_select_own ON public.uso_ia FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.uso_ia FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.uso_ia FROM authenticated;
GRANT SELECT ON TABLE public.uso_ia TO authenticated;
GRANT ALL ON TABLE public.uso_ia TO service_role;

-- Análisis con IA usados en el mes calendario de Colombia. Lo consulta la
-- interfaz ("te quedan N") y la ruta antes de llamar al proveedor. El tope
-- por plan vive en el código (lib/subscription/plans.ts), no aquí.
CREATE OR REPLACE FUNCTION public.ia_analisis_del_mes(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer
    FROM public.uso_ia u
   WHERE u.user_id = coalesce((SELECT auth.uid()), p_user_id)
     AND u.ruta = 'analizar'
     AND u.ok
     AND u.created_at >= (date_trunc('month', now() AT TIME ZONE 'America/Bogota')
                          AT TIME ZONE 'America/Bogota');
$$;
-- Una sesión de usuario solo cuenta lo suyo (auth.uid() manda sobre el
-- parámetro); el parámetro es para service_role.
REVOKE ALL ON FUNCTION public.ia_analisis_del_mes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_analisis_del_mes(uuid) TO authenticated, service_role;
