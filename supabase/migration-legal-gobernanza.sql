-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Capa legal y de gobernanza (validación firmada de Keila Moreno)
-- docs/conocimiento/VALIDACIÓN KEILA MORENO.docx — secciones 6.P2, 6.P3 y 6.P7
--
-- 1) Modelo de roles: profiles.rol ('corporativo' | 'salon').
--    - corporativo: administra la librería global (kb_reglas, kb_flujos,
--      kb_prompts, kb_dimensiones y la nueva kb_marcas).
--    - salon (default): NO escribe en la librería; solo selecciona qué marcas
--      publicadas están activas en su inventario (salon_marcas_activas).
--    - Las cuentas es_fundadora existentes se mapean a rol='corporativo'.
--      es_cuenta_fundadora() queda como alias legacy de es_cuenta_corporativa()
--      → TODAS las policies kb_* existentes pasan a exigir rol corporativo
--      sin recrearlas una a una.
--
-- 2) Consentimientos digitales versionados por clienta (patrón LEGAL_VERSION):
--    consentimiento_quimico y consentimiento_imagenes. Firma = nombre completo
--    tecleado + checkbox + timestamp + versión aceptada. La versión vigente
--    vive en legal_versiones (espejo de lib/legal.ts — mantener en sync).
--
-- 3) Bloqueos de agenda (trigger citas_guard_legal sobre public.citas):
--    a) confirmación de servicio de color BLOQUEADA para clientas
--       nueva_en_color / cambio_marca_quimica sin prueba de sensibilidad
--       negativa aplicada ≥48 h (y ≤14 días) antes de la cita;
--    b) decoloración NO se confirma sin consentimiento_quimico vigente;
--    c) "día de lavado tipo 4" / "instalación de peinado protector" reservan
--       un bloque de 2–4 h (profiles.bloqueo_tipo4_minutos, default 180) y
--       nadie puede sobreprogramar citas encima de ese bloque.
--
-- Idempotente: re-ejecutable sin efectos dobles (IF NOT EXISTS / OR REPLACE /
-- DROP IF EXISTS + CREATE / ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. ROLES
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'salon';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_rol_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_rol_check CHECK (rol IN ('corporativo', 'salon'));
  END IF;
END $$;

-- Mapeo de cuentas fundadoras existentes → corporativo (idempotente por predicado).
UPDATE public.profiles SET rol = 'corporativo'
 WHERE es_fundadora AND rol <> 'corporativo';

-- Helper canónico de gobernanza.
CREATE OR REPLACE FUNCTION public.es_cuenta_corporativa() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(
    (select p.rol = 'corporativo' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.es_cuenta_corporativa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_cuenta_corporativa() TO anon;
GRANT EXECUTE ON FUNCTION public.es_cuenta_corporativa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_cuenta_corporativa() TO service_role;

-- Alias legacy: las policies kb_* existentes (kb_*_insert/update/delete_fundadora)
-- llaman a esta función → al delegar en es_cuenta_corporativa(), el rol salon
-- pierde escritura sobre reglas base, flujos, prompts y dimensiones sin tocar
-- cada policy.
CREATE OR REPLACE FUNCTION public.es_cuenta_fundadora() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select public.es_cuenta_corporativa();
$$;

-- El funnel agregado pasa a ser una vista corporativa.
CREATE OR REPLACE FUNCTION public.funnel_activacion() RETURNS TABLE("evento" text, "cuentas" bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT public.es_cuenta_corporativa() THEN
    RAISE EXCEPTION 'forbidden: solo cuentas corporativas';
  END IF;

  RETURN QUERY
  SELECT e.evento, count(DISTINCT e.user_id)::bigint AS cuentas
  FROM public.eventos_activacion e
  GROUP BY e.evento;
END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. LIBRERÍA GLOBAL DE MARCAS (cartas técnicas) + selección por salón
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kb_marcas (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  clave text NOT NULL,
  locale text DEFAULT 'es' NOT NULL,
  nombre text NOT NULL,
  -- Carta técnica parametrizada (alturas, reflejos, oxidantes, series…):
  -- estructura libre jsonb, la administra solo el nivel corporativo.
  carta jsonb,
  estado text DEFAULT 'borrador' NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  notas_internas text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT kb_marcas_estado_check CHECK (estado IN ('borrador', 'publicada', 'archivada')),
  CONSTRAINT kb_marcas_clave_locale_key UNIQUE (clave, locale)
);

CREATE INDEX IF NOT EXISTS idx_kb_marcas_lookup ON public.kb_marcas (locale, estado);

ALTER TABLE public.kb_marcas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kb_marcas_select_publicadas ON public.kb_marcas;
CREATE POLICY kb_marcas_select_publicadas ON public.kb_marcas
  FOR SELECT TO authenticated
  USING (estado = 'publicada');

DROP POLICY IF EXISTS kb_marcas_select_corporativo ON public.kb_marcas;
CREATE POLICY kb_marcas_select_corporativo ON public.kb_marcas
  FOR SELECT TO authenticated
  USING ((SELECT public.es_cuenta_corporativa()));

DROP POLICY IF EXISTS kb_marcas_insert_corporativo ON public.kb_marcas;
CREATE POLICY kb_marcas_insert_corporativo ON public.kb_marcas
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.es_cuenta_corporativa()));

DROP POLICY IF EXISTS kb_marcas_update_corporativo ON public.kb_marcas;
CREATE POLICY kb_marcas_update_corporativo ON public.kb_marcas
  FOR UPDATE TO authenticated
  USING ((SELECT public.es_cuenta_corporativa()))
  WITH CHECK ((SELECT public.es_cuenta_corporativa()));

DROP POLICY IF EXISTS kb_marcas_delete_corporativo ON public.kb_marcas;
CREATE POLICY kb_marcas_delete_corporativo ON public.kb_marcas
  FOR DELETE TO authenticated
  USING ((SELECT public.es_cuenta_corporativa()));

-- Versionado + auditoría con la maquinaria kb_* existente.
DROP TRIGGER IF EXISTS kb_touch_marcas ON public.kb_marcas;
CREATE TRIGGER kb_touch_marcas BEFORE UPDATE ON public.kb_marcas
  FOR EACH ROW EXECUTE FUNCTION public.kb_touch_version();

DROP TRIGGER IF EXISTS kb_audit_marcas ON public.kb_marcas;
CREATE TRIGGER kb_audit_marcas AFTER INSERT OR DELETE OR UPDATE ON public.kb_marcas
  FOR EACH ROW EXECUTE FUNCTION public.kb_auditar();

-- Selección por salón: la ÚNICA escritura de marcas permitida al rol salon.
CREATE TABLE IF NOT EXISTS public.salon_marcas_activas (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.kb_marcas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT salon_marcas_activas_user_marca_key UNIQUE (user_id, marca_id)
);

CREATE INDEX IF NOT EXISTS idx_salon_marcas_marca ON public.salon_marcas_activas (marca_id);

ALTER TABLE public.salon_marcas_activas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salon_marcas_select_own ON public.salon_marcas_activas;
CREATE POLICY salon_marcas_select_own ON public.salon_marcas_activas
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS salon_marcas_insert_own ON public.salon_marcas_activas;
CREATE POLICY salon_marcas_insert_own ON public.salon_marcas_activas
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    -- Solo marcas publicadas de la librería global pueden activarse.
    AND EXISTS (
      SELECT 1 FROM public.kb_marcas m
      WHERE m.id = marca_id AND m.estado = 'publicada'
    )
  );

DROP POLICY IF EXISTS salon_marcas_delete_own ON public.salon_marcas_activas;
CREATE POLICY salon_marcas_delete_own ON public.salon_marcas_activas
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. CONSENTIMIENTOS DIGITALES VERSIONADOS
-- ───────────────────────────────────────────────────────────────────────────

-- Versión vigente de cada documento (espejo de lib/legal.ts).
-- Al publicar el texto definitivo de Keila: actualizar lib/legal.ts Y esta
-- tabla en el mismo despliegue (UPDATE public.legal_versiones SET version=…).
CREATE TABLE IF NOT EXISTS public.legal_versiones (
  tipo text NOT NULL PRIMARY KEY,
  version text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.legal_versiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_versiones_select_all ON public.legal_versiones;
CREATE POLICY legal_versiones_select_all ON public.legal_versiones
  FOR SELECT TO authenticated
  USING (true);
-- Sin policies de escritura: solo service_role / SQL Editor.

INSERT INTO public.legal_versiones (tipo, version) VALUES
  ('consentimiento_quimico',  '2026-08-05-placeholder'),
  ('consentimiento_imagenes', '2026-08-05-placeholder')
ON CONFLICT (tipo) DO NOTHING;

-- Firma digital por clienta: nombre completo tecleado + checkbox + timestamp
-- + versión aceptada. Registro inmutable (sin policies UPDATE/DELETE): la
-- re-aceptación de una versión nueva agrega una fila, nunca pisa la anterior.
CREATE TABLE IF NOT EXISTS public.consentimientos_clienta (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id uuid NOT NULL REFERENCES public.clientas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  version_aceptada text NOT NULL,
  nombre_firmante text NOT NULL,
  aceptado boolean NOT NULL,
  firmado_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT consentimientos_tipo_check
    CHECK (tipo IN ('consentimiento_quimico', 'consentimiento_imagenes')),
  -- La firma exige el checkbox marcado y un nombre completo real tecleado.
  CONSTRAINT consentimientos_aceptado_check CHECK (aceptado),
  CONSTRAINT consentimientos_nombre_check CHECK (char_length(btrim(nombre_firmante)) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_consentimientos_clienta
  ON public.consentimientos_clienta (clienta_id, tipo, firmado_at DESC);
CREATE INDEX IF NOT EXISTS idx_consentimientos_user
  ON public.consentimientos_clienta (user_id);

ALTER TABLE public.consentimientos_clienta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consentimientos_select_own ON public.consentimientos_clienta;
CREATE POLICY consentimientos_select_own ON public.consentimientos_clienta
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS consentimientos_insert_own ON public.consentimientos_clienta;
CREATE POLICY consentimientos_insert_own ON public.consentimientos_clienta
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.clientas c
      WHERE c.id = clienta_id AND c.user_id = (SELECT auth.uid())
    )
  );


-- ───────────────────────────────────────────────────────────────────────────
-- 4. SEGURIDAD QUÍMICA: banderas de clienta + pruebas de sensibilidad
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clientas
  ADD COLUMN IF NOT EXISTS nueva_en_color boolean NOT NULL DEFAULT false;
ALTER TABLE public.clientas
  ADD COLUMN IF NOT EXISTS cambio_marca_quimica boolean NOT NULL DEFAULT false;

-- Parche de prueba de sensibilidad cutánea: fecha/hora de aplicación + lectura.
CREATE TABLE IF NOT EXISTS public.pruebas_sensibilidad (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id uuid NOT NULL REFERENCES public.clientas(id) ON DELETE CASCADE,
  aplicado_at timestamptz NOT NULL,
  resultado text NOT NULL,
  notas text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pruebas_resultado_check CHECK (resultado IN ('negativo', 'positivo'))
);

CREATE INDEX IF NOT EXISTS idx_pruebas_clienta
  ON public.pruebas_sensibilidad (clienta_id, aplicado_at DESC);
CREATE INDEX IF NOT EXISTS idx_pruebas_user
  ON public.pruebas_sensibilidad (user_id);

ALTER TABLE public.pruebas_sensibilidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pruebas_select_own ON public.pruebas_sensibilidad;
CREATE POLICY pruebas_select_own ON public.pruebas_sensibilidad
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS pruebas_insert_own ON public.pruebas_sensibilidad;
CREATE POLICY pruebas_insert_own ON public.pruebas_sensibilidad
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.clientas c
      WHERE c.id = clienta_id AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS pruebas_delete_own ON public.pruebas_sensibilidad;
CREATE POLICY pruebas_delete_own ON public.pruebas_sensibilidad
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. BLOQUEOS DE AGENDA (trigger sobre public.citas)
-- ───────────────────────────────────────────────────────────────────────────

-- Bloque configurable por salón para servicios tipo 4 (2–4 h, en minutos).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueo_tipo4_minutos integer NOT NULL DEFAULT 180;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_bloqueo_tipo4_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_bloqueo_tipo4_check
      CHECK (bloqueo_tipo4_minutos BETWEEN 120 AND 240);
  END IF;
END $$;

-- Clasificación de servicios por nombre (espejo de lib/agenda/reglas.ts —
-- mantener en sync). Devuelve: 'bloqueo_tipo4' | 'decoloracion' | 'color' | 'otro'.
CREATE OR REPLACE FUNCTION public.clasificar_servicio(p_servicio text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case
    when p_servicio is null then 'otro'
    -- Día de lavado tipo 4 / instalación de peinado protector → bloque 2–4 h.
    when lower(p_servicio) like '%lavado tipo 4%'
      or lower(p_servicio) like '%dia de lavado%'
      or lower(p_servicio) like '%día de lavado%'
      or (lower(p_servicio) like '%instalaci%' and lower(p_servicio) like '%protector%')
      or lower(p_servicio) like '%peinado protector%'
      then 'bloqueo_tipo4'
    -- Decoloración (también es servicio de color para efectos del parche).
    when lower(p_servicio) like '%decolor%'
      or lower(p_servicio) like '%mecha%'
      or lower(p_servicio) like '%balayage%'
      or lower(p_servicio) like '%babylight%'
      or lower(p_servicio) like '%highlight%'
      or lower(p_servicio) like '%platino%'
      then 'decoloracion'
    when lower(p_servicio) like '%tinte%'
      or lower(p_servicio) like '%tintur%'
      or lower(p_servicio) like '%color%'
      or lower(p_servicio) like '%matiz%'
      then 'color'
    else 'otro'
  end;
$$;

REVOKE ALL ON FUNCTION public.clasificar_servicio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clasificar_servicio(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clasificar_servicio(text) TO service_role;

-- Guardia legal de la agenda. BEFORE INSERT OR UPDATE:
--   (1) los servicios tipo 4 fuerzan duración = bloqueo del salón (2–4 h);
--   (2) nada se solapa con un bloque extendido (ni un bloque sobre citas);
--   (3) confirmar color con clienta nueva_en_color / cambio_marca_quimica
--       exige parche negativo aplicado ≥48 h y ≤14 días antes de la cita;
--   (4) confirmar decoloración exige consentimiento_quimico VIGENTE
--       (versión aceptada = legal_versiones.version).
CREATE OR REPLACE FUNCTION public.citas_guard_legal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_tipo text;
  v_bloque integer;
  v_nueva boolean;
  v_cambio boolean;
BEGIN
  v_tipo := public.clasificar_servicio(NEW.servicio);

  -- (1) Bloque extendido automático para servicios tipo 4.
  IF v_tipo = 'bloqueo_tipo4' THEN
    SELECT p.bloqueo_tipo4_minutos INTO v_bloque
      FROM public.profiles p WHERE p.id = NEW.user_id;
    NEW.duracion_minutos := LEAST(240, GREATEST(120, COALESCE(v_bloque, 180)));
  END IF;

  -- (2) Sin solapes con bloques extendidos (en ambos sentidos).
  IF COALESCE(NEW.estado, 'pendiente') NOT IN ('cancelada', 'no_show') THEN
    IF EXISTS (
      SELECT 1 FROM public.citas c
      WHERE c.user_id = NEW.user_id
        AND c.id <> NEW.id
        AND COALESCE(c.estado, 'pendiente') NOT IN ('cancelada', 'no_show')
        AND (v_tipo = 'bloqueo_tipo4' OR public.clasificar_servicio(c.servicio) = 'bloqueo_tipo4')
        AND tstzrange(c.fecha, c.fecha + make_interval(mins => COALESCE(c.duracion_minutos, 60))) &&
            tstzrange(NEW.fecha, NEW.fecha + make_interval(mins => COALESCE(NEW.duracion_minutos, 60)))
    ) THEN
      RAISE EXCEPTION 'AGENDA_BLOQUEADA: el horario se solapa con un bloque extendido (día de lavado tipo 4 / instalación de peinado protector)';
    END IF;
  END IF;

  -- (3) y (4): solo al CONFIRMAR (transición a estado confirmada).
  IF NEW.estado = 'confirmada'
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'confirmada') THEN

    IF v_tipo IN ('color', 'decoloracion') THEN
      SELECT c.nueva_en_color, c.cambio_marca_quimica
        INTO v_nueva, v_cambio
        FROM public.clientas c WHERE c.id = NEW.clienta_id;

      IF COALESCE(v_nueva, false) OR COALESCE(v_cambio, false) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.pruebas_sensibilidad ps
          WHERE ps.clienta_id = NEW.clienta_id
            AND ps.resultado = 'negativo'
            AND ps.aplicado_at <= NEW.fecha - interval '48 hours'
            AND ps.aplicado_at >= NEW.fecha - interval '14 days'
        ) THEN
          RAISE EXCEPTION 'PARCHE_SENSIBILIDAD_REQUERIDO: registra una prueba de sensibilidad negativa aplicada al menos 48 horas antes de la cita';
        END IF;
      END IF;

      IF v_tipo = 'decoloracion' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.consentimientos_clienta cc
          JOIN public.legal_versiones lv ON lv.tipo = 'consentimiento_quimico'
          WHERE cc.clienta_id = NEW.clienta_id
            AND cc.tipo = 'consentimiento_quimico'
            AND cc.version_aceptada = lv.version
        ) THEN
          RAISE EXCEPTION 'CONSENTIMIENTO_QUIMICO_REQUERIDO: la clienta debe firmar el consentimiento informado de servicios químicos vigente antes de confirmar la decoloración';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.citas_guard_legal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.citas_guard_legal() TO service_role;

DROP TRIGGER IF EXISTS guard_legal_citas ON public.citas;
CREATE TRIGGER guard_legal_citas
  BEFORE INSERT OR UPDATE ON public.citas
  FOR EACH ROW EXECUTE FUNCTION public.citas_guard_legal();

-- Índice para la consulta de solapes (user_id + rango temporal).
CREATE INDEX IF NOT EXISTS idx_citas_user_fecha ON public.citas (user_id, fecha);


-- ───────────────────────────────────────────────────────────────────────────
-- 6. GRANTS (exposición vía Data API / PostgREST)
-- ───────────────────────────────────────────────────────────────────────────
-- Explícitos y no implícitos: ALTER DEFAULT PRIVILEGES solo cubre las tablas
-- creadas por el rol postgres. Si esta migración se aplica con otro rol, sin
-- estos GRANT las tablas quedarían invisibles para PostgREST (401/404
-- confusos). La RLS de arriba sigue siendo la que decide qué filas se ven.

GRANT ALL ON TABLE public.kb_marcas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.salon_marcas_activas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.legal_versiones TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.consentimientos_clienta TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pruebas_sensibilidad TO anon, authenticated, service_role;
