-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Módulo de cortes (Entrega 5) + segmentos de referencia de la KB
--
-- 1) Segmentos de REFERENCIA en kb_reglas ('referencia_color',
--    'referencia_corte'). Corrige un defecto del seed de colorimetría: usaba
--    el segmento 'config', cuyo campo disclaimerProductos SÍ se inyecta en
--    el resultado de cada diagnóstico — publicarlo habría reemplazado el
--    disclaimer de productos de todas las clientas. Los segmentos de
--    referencia el evaluador los ignora por completo.
--
-- 2) kb_cortes: catálogo ÚNICO indexado por atributos arquitectónicos
--    (largo, capas, densidad, textura), decisión de Keila (respuesta 5) que
--    manda sobre las secciones por género de la Entrega 5. La etiqueta de
--    género es solo un filtro de búsqueda opcional. Misma gobernanza que
--    kb_marcas: escritura solo del rol corporativo.
--
-- 3) cortes_ejecutados: registro del corte confirmado, que dispara el
--    pre-agendamiento del retoque según el ciclo de vida de la ficha (PR-06).
--
-- Idempotente: re-ejecutable sin efectos dobles.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. SEGMENTOS DE REFERENCIA
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.kb_reglas DROP CONSTRAINT IF EXISTS kb_reglas_segmento_check;
ALTER TABLE public.kb_reglas ADD CONSTRAINT kb_reglas_segmento_check CHECK (
  segmento = ANY (ARRAY[
    'hecho'::text, 'derivacion_medica'::text, 'tratamiento_principal'::text,
    'tratamiento_adicional'::text, 'cronograma'::text, 'tecnica'::text,
    'producto_resumen'::text, 'ingrediente_buscar'::text,
    'ingrediente_evitar'::text, 'rutina'::text, 'nota'::text,
    'cuidado_casa'::text, 'intervalo'::text, 'config'::text,
    -- Nuevos: contenido consultable que el evaluador IGNORA.
    'referencia_color'::text, 'referencia_corte'::text
  ])
);


-- ───────────────────────────────────────────────────────────────────────────
-- 2. CATÁLOGO DE CORTES
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kb_cortes (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  clave text NOT NULL,
  locale text DEFAULT 'es' NOT NULL,
  nombre text NOT NULL,
  -- Índice arquitectónico (Keila, respuesta 5): estos cuatro atributos son
  -- los ejes reales del buscador; el género NO lo es.
  largo text NOT NULL,
  capas text NOT NULL,
  densidad_ideal text[],
  textura text[],
  -- Filtro de búsqueda OPCIONAL, nunca una barrera: cualquier persona puede
  -- elegir cualquier corte del catálogo.
  etiqueta_genero text NOT NULL DEFAULT 'unisex',
  -- Ficha completa (estructura, rostros, compatibilidad por tipo, técnica…):
  -- jsonb para que crecer el catálogo no exija migración.
  ficha jsonb NOT NULL,
  -- Ciclo de vida útil en semanas [min, max] — PR-06, alimenta el
  -- pre-agendamiento del retoque.
  ciclo_semanas_min integer NOT NULL,
  ciclo_semanas_max integer NOT NULL,
  estado text DEFAULT 'borrador' NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  notas_internas text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT kb_cortes_clave_locale_key UNIQUE (clave, locale),
  CONSTRAINT kb_cortes_estado_check CHECK (estado IN ('borrador', 'publicada', 'archivada')),
  CONSTRAINT kb_cortes_genero_check CHECK (
    etiqueta_genero IN ('sugerido_mujeres', 'sugerido_hombres', 'unisex')
  ),
  CONSTRAINT kb_cortes_largo_check CHECK (
    largo IN ('muy_corto', 'corto', 'medio', 'largo', 'muy_largo')
  ),
  CONSTRAINT kb_cortes_capas_check CHECK (
    capas IN ('sin_capas', 'minimas', 'moderadas', 'abundantes')
  ),
  CONSTRAINT kb_cortes_ciclo_check CHECK (
    ciclo_semanas_min > 0 AND ciclo_semanas_max >= ciclo_semanas_min
  )
);

CREATE INDEX IF NOT EXISTS idx_kb_cortes_lookup ON public.kb_cortes (locale, estado);
CREATE INDEX IF NOT EXISTS idx_kb_cortes_arquitectura ON public.kb_cortes (largo, capas);

ALTER TABLE public.kb_cortes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kb_cortes_select_publicadas ON public.kb_cortes;
CREATE POLICY kb_cortes_select_publicadas ON public.kb_cortes
  FOR SELECT TO authenticated
  USING (estado = 'publicada');

DROP POLICY IF EXISTS kb_cortes_select_corporativo ON public.kb_cortes;
CREATE POLICY kb_cortes_select_corporativo ON public.kb_cortes
  FOR SELECT TO authenticated
  USING ((SELECT public.es_cuenta_corporativa()));

DROP POLICY IF EXISTS kb_cortes_insert_corporativo ON public.kb_cortes;
CREATE POLICY kb_cortes_insert_corporativo ON public.kb_cortes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.es_cuenta_corporativa()));

DROP POLICY IF EXISTS kb_cortes_update_corporativo ON public.kb_cortes;
CREATE POLICY kb_cortes_update_corporativo ON public.kb_cortes
  FOR UPDATE TO authenticated
  USING ((SELECT public.es_cuenta_corporativa()))
  WITH CHECK ((SELECT public.es_cuenta_corporativa()));

DROP POLICY IF EXISTS kb_cortes_delete_corporativo ON public.kb_cortes;
CREATE POLICY kb_cortes_delete_corporativo ON public.kb_cortes
  FOR DELETE TO authenticated
  USING ((SELECT public.es_cuenta_corporativa()));

DROP TRIGGER IF EXISTS kb_touch_cortes ON public.kb_cortes;
CREATE TRIGGER kb_touch_cortes BEFORE UPDATE ON public.kb_cortes
  FOR EACH ROW EXECUTE FUNCTION public.kb_touch_version();

DROP TRIGGER IF EXISTS kb_audit_cortes ON public.kb_cortes;
CREATE TRIGGER kb_audit_cortes AFTER INSERT OR DELETE OR UPDATE ON public.kb_cortes
  FOR EACH ROW EXECUTE FUNCTION public.kb_auditar();


-- ───────────────────────────────────────────────────────────────────────────
-- 3. CORTES EJECUTADOS (PR-06 · recurrencia comercial)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cortes_ejecutados (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id uuid NOT NULL REFERENCES public.clientas(id) ON DELETE CASCADE,
  corte_id uuid REFERENCES public.kb_cortes(id) ON DELETE SET NULL,
  corte_clave text NOT NULL,
  variante text,
  forma_rostro text,
  -- Razonamiento que mostró la matriz, congelado al confirmar.
  razonamiento jsonb,
  -- Cita de mantenimiento pre-agendada, si la clienta la aceptó.
  cita_mantenimiento_id uuid REFERENCES public.citas(id) ON DELETE SET NULL,
  foto_antes text,
  foto_despues text,
  notas text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cortes_ejec_clienta
  ON public.cortes_ejecutados (clienta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cortes_ejec_user
  ON public.cortes_ejecutados (user_id);

ALTER TABLE public.cortes_ejecutados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cortes_ejec_select_own ON public.cortes_ejecutados;
CREATE POLICY cortes_ejec_select_own ON public.cortes_ejecutados
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS cortes_ejec_insert_own ON public.cortes_ejecutados;
CREATE POLICY cortes_ejec_insert_own ON public.cortes_ejecutados
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.clientas c
      WHERE c.id = clienta_id AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cortes_ejec_update_own ON public.cortes_ejecutados;
CREATE POLICY cortes_ejec_update_own ON public.cortes_ejecutados
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS cortes_ejec_delete_own ON public.cortes_ejecutados;
CREATE POLICY cortes_ejec_delete_own ON public.cortes_ejecutados
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP TRIGGER IF EXISTS guard_suscripcion_cortes_ejec ON public.cortes_ejecutados;
CREATE TRIGGER guard_suscripcion_cortes_ejec
  BEFORE INSERT ON public.cortes_ejecutados
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();


-- ───────────────────────────────────────────────────────────────────────────
-- 4. GRANTS (exposición vía Data API)
-- ───────────────────────────────────────────────────────────────────────────

GRANT ALL ON TABLE public.kb_cortes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.cortes_ejecutados TO anon, authenticated, service_role;
