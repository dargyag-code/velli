-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sprint C · registro de servicios de color
--
-- La calculadora (Entrega 3 §7.3) registra al confirmar: fórmula final tal
-- como la dejó la estilista tras editarla, proceso y foto del resultado.
-- Ese registro es "el activo que convierte el segundo servicio en una
-- ciencia exacta" (Entrega 3 §5) y alimenta el Pasaporte Capilar.
--
-- La fórmula se guarda como jsonb porque su forma la define el motor
-- (componentes en gramos + volumen + proporción + tiempos) y evoluciona con
-- las cartas de marca sin exigir migración.
--
-- Idempotente: re-ejecutable sin efectos dobles.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.servicios_color (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id uuid NOT NULL REFERENCES public.clientas(id) ON DELETE CASCADE,
  -- Marca usada, si el salón la tenía activa en su inventario.
  marca_id uuid REFERENCES public.kb_marcas(id) ON DELETE SET NULL,
  -- Fórmula FINAL (la editada por la estilista, no la sugerida): el registro
  -- legal de lo que realmente se aplicó en cabina.
  formula_final jsonb NOT NULL,
  -- Razonamiento que mostró la calculadora, congelado como estaba al
  -- confirmar: permite auditar por qué se propuso esa ruta.
  guia_razonamiento jsonb,
  proceso text NOT NULL,
  foto_resultado text,
  notas text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT servicios_color_proceso_check CHECK (char_length(btrim(proceso)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_servicios_color_clienta
  ON public.servicios_color (clienta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_servicios_color_user
  ON public.servicios_color (user_id);

ALTER TABLE public.servicios_color ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_color_select_own ON public.servicios_color;
CREATE POLICY servicios_color_select_own ON public.servicios_color
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS servicios_color_insert_own ON public.servicios_color;
CREATE POLICY servicios_color_insert_own ON public.servicios_color
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.clientas c
      WHERE c.id = clienta_id AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS servicios_color_update_own ON public.servicios_color;
CREATE POLICY servicios_color_update_own ON public.servicios_color
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS servicios_color_delete_own ON public.servicios_color;
CREATE POLICY servicios_color_delete_own ON public.servicios_color
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- La suscripción gobierna la escritura igual que en clientas/consultas/citas.
DROP TRIGGER IF EXISTS guard_suscripcion_servicios_color ON public.servicios_color;
CREATE TRIGGER guard_suscripcion_servicios_color
  BEFORE INSERT ON public.servicios_color
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();

-- Exposición vía Data API (ver nota de GRANTs en la migración legal).
GRANT ALL ON TABLE public.servicios_color TO anon, authenticated, service_role;
