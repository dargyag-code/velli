-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: modelo del cotizador y rentabilidad (Velli BI · Fase 1 · Etapa 3)
-- Estado: APLICADA en producción el 2026-10-23 (la corrió Vanessa; las 7
-- tablas del cotizador se verificaron por lectura). Sigue en supabase/ hasta
-- regenerar schema.sql.
-- Diseño y decisiones: docs/velli-bi/02-diseno-cotizador.md
--
-- Módulo 1 (cotizador) completo y lo que el módulo 2 (rentabilidad) necesita
-- leer: estilista, cotizado, cobrado, costo y comisión estimados. Los
-- módulos 3 y 4 (2027) no se construyen; el modelo les deja la historia:
-- precios versionados, cotizaciones que no se sobrescriben, eventos
-- append-only y jsonb `perfil_extendido` en cada tabla.
--
-- Base: columnas de producción verificadas por lectura (OpenAPI de
-- PostgREST) el 2026-10-19 — schema.sql está desfasado (ver README).
-- Requiere aplicada: migration-colorimetria.sql (servicios_color), que ya
-- está en producción.
--
-- Convenciones (las mismas de las migraciones existentes):
-- - user_id = el salón (cuenta del dueño). Las estilistas son registros, sin
--   login (decisión P1). Las policies pasan por salones_del_usuario(): para
--   sumar estilistas con login después se cambia SOLO esa función.
-- - Montos en COP enteros. Fechas timestamptz. Enumeraciones como text+CHECK.
-- - Idempotente: re-ejecutable sin efectos dobles. No escribe datos.
-- - Probado en un Postgres en memoria (PGlite) con las pruebas de
--   docs/velli-bi/calculos/probar_borradores.mjs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Tenencia ───────────────────────────────────────────────────────────
-- Salones a los que la sesión actual tiene acceso. Hoy: la propia cuenta.
-- Mañana, con estilistas con login:
--   select (select auth.uid())
--   union select m.salon_id from public.salon_miembros m
--          where m.miembro_id = (select auth.uid())
-- Se usa como `user_id in (select public.salones_del_usuario())`: Postgres
-- la evalúa una vez por consulta, no por fila.
CREATE OR REPLACE FUNCTION public.salones_del_usuario()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid())
$$;

-- ── 1. Estilistas del salón (sin login en la Fase 1) ──────────────────────
CREATE TABLE IF NOT EXISTS public.estilistas (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 80),
  activo boolean NOT NULL DEFAULT true,
  perfil_extendido jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(perfil_extendido) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estilistas_user ON public.estilistas (user_id);

-- ── 2. Servicios del salón ────────────────────────────────────────────────
-- Semilla: profiles.servicios del onboarding (la siembra la hace la app la
-- primera vez que se abre el cotizador; esta migración no escribe datos).
CREATE TABLE IF NOT EXISTS public.servicios_salon (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 80),
  categoria text NOT NULL DEFAULT 'otro' CHECK (categoria IN (
    'color', 'decoloracion', 'tratamiento', 'corte', 'alisado', 'rizos',
    'peinado', 'cuero_cabelludo', 'extensiones', 'otro'
  )),
  -- true → el costo de producto sale de la fórmula de colorimetría.
  usa_formula_color boolean NOT NULL DEFAULT false,
  duracion_minutos integer CHECK (duracion_minutos IS NULL OR duracion_minutos BETWEEN 5 AND 720),
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  perfil_extendido jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(perfil_extendido) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_servicios_salon_user ON public.servicios_salon (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_servicios_salon_nombre
  ON public.servicios_salon (user_id, lower(btrim(nombre))) WHERE activo;

-- ── 3. Plantilla de precios: una por servicio, VERSIONADA ─────────────────
-- Cambiar un precio = publicar una versión nueva (publicar_plantilla_precio).
-- Las versiones no se editan: la historia de precios es la materia prima de
-- recomendaciones y pronósticos.
--
-- ajustes (sin migración por variable nueva; catálogo en código,
-- lib/cotizador/variables.ts):
--   {"largo":    {"medio": {"porcentaje": 20}, "largo": {"porcentaje": 40, "suma": 10000}},
--    "densidad": {"alta":  {"porcentaje": 15}},
--    "estado":   {"comprometido": {"suma": 20000}},
--    "canas":    {"50_75": {"suma": 15000}, "mas_75": {"suma": 25000}}}
--   precio = redondeo((precio_base + Σ suma) × (1 + Σ porcentaje / 100))
-- consumo (para el costo, módulo 2):
--   {"gramos_tinte_base": 60, "factor": {"largo": {"corto": 1, "medio": 1.5,
--    "largo": 2, "extra_largo": 3}, "densidad": {"baja": 0.8, "media": 1, "alta": 1.3}},
--    "insumos_fijos": 3000}
CREATE TABLE IF NOT EXISTS public.plantillas_precio (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES public.servicios_salon(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente_hasta timestamptz,  -- null = versión vigente
  precio_base integer NOT NULL CHECK (precio_base >= 0),
  ajustes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ajustes) = 'object'),
  consumo jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(consumo) = 'object'),
  redondeo integer NOT NULL DEFAULT 1000 CHECK (redondeo IN (1, 100, 500, 1000, 5000, 10000)),
  vigencia_dias integer NOT NULL DEFAULT 15 CHECK (vigencia_dias BETWEEN 1 AND 90),
  perfil_extendido jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(perfil_extendido) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plantillas_precio_ventana CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT plantillas_precio_version_unica UNIQUE (servicio_id, version)
);
CREATE INDEX IF NOT EXISTS idx_plantillas_precio_user ON public.plantillas_precio (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_plantillas_precio_vigente
  ON public.plantillas_precio (servicio_id) WHERE vigente_hasta IS NULL;

-- ── 4. Productos del salón y su precio de compra ──────────────────────────
-- Costo por unidad = precio_compra / presentacion_cantidad (COP por g o ml).
-- Stock y punto de reorden (aviso de compra, módulo 2) llegan con su propia
-- migración cuando se construya; mientras, perfil_extendido.
CREATE TABLE IF NOT EXISTS public.productos_salon (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Marca de la librería (cartas técnicas), si existe; si no, nombre libre.
  marca_id uuid REFERENCES public.kb_marcas(id) ON DELETE SET NULL,
  marca text,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 120),
  tipo text NOT NULL CHECK (tipo IN (
    'tinte', 'oxidante', 'decolorante', 'matizador', 'tratamiento', 'otro'
  )),
  presentacion_cantidad numeric(10, 2) NOT NULL CHECK (presentacion_cantidad > 0),
  unidad text NOT NULL CHECK (unidad IN ('g', 'ml', 'unidad')),
  precio_compra integer NOT NULL CHECK (precio_compra >= 0),
  precio_actualizado_at timestamptz NOT NULL DEFAULT now(),
  activo boolean NOT NULL DEFAULT true,
  perfil_extendido jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(perfil_extendido) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_productos_salon_user ON public.productos_salon (user_id);
CREATE INDEX IF NOT EXISTS idx_productos_salon_marca
  ON public.productos_salon (marca_id) WHERE marca_id IS NOT NULL;

-- ── 5. Comisiones ─────────────────────────────────────────────────────────
-- Alcance por nulos: estilista_id null = todas, servicio_id null = todos.
-- Gana la regla más específica: estilista+servicio > estilista > servicio >
-- salón. Una sola regla vigente por alcance.
CREATE TABLE IF NOT EXISTS public.comisiones (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estilista_id uuid REFERENCES public.estilistas(id) ON DELETE CASCADE,
  servicio_id uuid REFERENCES public.servicios_salon(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('porcentaje', 'fijo')),
  valor numeric(10, 2) NOT NULL CHECK (valor >= 0),
  -- Sobre qué se calcula el porcentaje.
  base text NOT NULL DEFAULT 'precio' CHECK (base IN ('precio', 'precio_menos_producto')),
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente_hasta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comisiones_porcentaje_max CHECK (tipo <> 'porcentaje' OR valor <= 100),
  CONSTRAINT comisiones_ventana CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE INDEX IF NOT EXISTS idx_comisiones_user ON public.comisiones (user_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_estilista
  ON public.comisiones (estilista_id) WHERE estilista_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comisiones_servicio
  ON public.comisiones (servicio_id) WHERE servicio_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comisiones_vigente ON public.comisiones (
  user_id,
  COALESCE(estilista_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(servicio_id, '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE vigente_hasta IS NULL;

-- ── 6. Cotizaciones ───────────────────────────────────────────────────────
-- Las referencias son SET NULL: borrar una clienta (o "Borrar todos los
-- datos") no borra lo cobrado (R9). Lo que se cotizó queda en columnas
-- propias (servicio_nombre, variables, precios, costo, comisión).
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id uuid REFERENCES public.clientas(id) ON DELETE SET NULL,
  consulta_id uuid REFERENCES public.consultas(id) ON DELETE SET NULL,
  estilista_id uuid REFERENCES public.estilistas(id) ON DELETE SET NULL,
  servicio_id uuid REFERENCES public.servicios_salon(id) ON DELETE SET NULL,
  plantilla_id uuid REFERENCES public.plantillas_precio(id) ON DELETE SET NULL,
  servicio_color_id uuid REFERENCES public.servicios_color(id) ON DELETE SET NULL,

  -- Resumen inmutable de lo cotizado.
  servicio_nombre text NOT NULL CHECK (char_length(btrim(servicio_nombre)) BETWEEN 1 AND 80),
  estilista_nombre text,
  plantilla_version integer,
  -- {"largo": {"valor": "medio", "origen": "diagnostico"}, "canas": {"valor": "50_75", "origen": "manual"}}
  variables jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(variables) = 'object'),

  -- "El mismo servicio cuesta lo mismo": lo que da la plantilla y lo que se
  -- envió. Si difieren, el motivo es obligatorio (constraint de abajo).
  precio_calculado integer NOT NULL CHECK (precio_calculado >= 0),
  precio_cotizado integer NOT NULL CHECK (precio_cotizado >= 0),
  ajuste_manual_motivo text,
  moneda text NOT NULL DEFAULT 'COP' CHECK (moneda = 'COP'),
  vigencia_hasta date NOT NULL,

  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'enviada', 'cobrada', 'anulada')),
  enviada_at timestamptz,
  precio_cobrado integer CHECK (precio_cobrado IS NULL OR precio_cobrado >= 0),
  cobrado_at timestamptz,
  -- Para el módulo 2: diferencia de cada estilista frente a lo cotizado.
  diferencia_cobro integer GENERATED ALWAYS AS (precio_cobrado - precio_cotizado) STORED,

  -- Costo (módulo 2). Fórmula usada (formula_final de servicios_color o la
  -- sugerida por la calculadora) y el detalle de cada producto con su precio
  -- unitario de ese momento: el costo histórico no cambia si sube un tinte.
  formula jsonb,
  costo_producto_estimado integer CHECK (costo_producto_estimado IS NULL OR costo_producto_estimado >= 0),
  costo_detalle jsonb,
  comision_estimada integer CHECK (comision_estimada IS NULL OR comision_estimada >= 0),
  comision_detalle jsonb,

  -- Link público: el token es la credencial (uuid v4, 122 bits aleatorios).
  -- La página solo muestra servicio, precio, vigencia y el nombre del salón.
  con_marca_velli boolean NOT NULL DEFAULT true,
  token_publico uuid NOT NULL DEFAULT gen_random_uuid(),

  perfil_extendido jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(perfil_extendido) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cotizaciones_token_unico UNIQUE (token_publico),
  CONSTRAINT cotizaciones_ajuste_con_motivo CHECK (
    precio_cotizado = precio_calculado
    OR char_length(btrim(coalesce(ajuste_manual_motivo, ''))) >= 3
  ),
  CONSTRAINT cotizaciones_cobro_completo CHECK (
    estado <> 'cobrada' OR (precio_cobrado IS NOT NULL AND cobrado_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_user_fecha ON public.cotizaciones (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_por_cobrar
  ON public.cotizaciones (user_id, created_at DESC) WHERE estado = 'enviada';
CREATE INDEX IF NOT EXISTS idx_cotizaciones_clienta ON public.cotizaciones (clienta_id) WHERE clienta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_consulta ON public.cotizaciones (consulta_id) WHERE consulta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estilista ON public.cotizaciones (estilista_id) WHERE estilista_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_servicio ON public.cotizaciones (servicio_id) WHERE servicio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_plantilla ON public.cotizaciones (plantilla_id) WHERE plantilla_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_servicio_color
  ON public.cotizaciones (servicio_color_id) WHERE servicio_color_id IS NOT NULL;

-- ── 7. Eventos de cotización (append-only) ────────────────────────────────
-- Serie de tiempo para el resumen semanal (módulo 2) y los pronósticos.
-- Solo la escribe el trigger; nadie la edita.
CREATE TABLE IF NOT EXISTS public.cotizacion_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('creada', 'enviada', 'cobrada', 'cobro_corregido', 'anulada')),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cotizacion_eventos_cotizacion ON public.cotizacion_eventos (cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_eventos_user_fecha ON public.cotizacion_eventos (user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- updated_at (función existente)
DROP TRIGGER IF EXISTS set_updated_at_estilistas ON public.estilistas;
CREATE TRIGGER set_updated_at_estilistas BEFORE UPDATE ON public.estilistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_servicios_salon ON public.servicios_salon;
CREATE TRIGGER set_updated_at_servicios_salon BEFORE UPDATE ON public.servicios_salon
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_productos_salon ON public.productos_salon;
CREATE TRIGGER set_updated_at_productos_salon BEFORE UPDATE ON public.productos_salon
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_cotizaciones ON public.cotizaciones;
CREATE TRIGGER set_updated_at_cotizaciones BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- La suscripción gobierna la escritura, como en clientas/consultas/citas
-- (función existente; bloqueo suave: con el plan vencido se lee, no se crea).
DROP TRIGGER IF EXISTS guard_suscripcion_estilistas ON public.estilistas;
CREATE TRIGGER guard_suscripcion_estilistas BEFORE INSERT ON public.estilistas
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();
DROP TRIGGER IF EXISTS guard_suscripcion_servicios_salon ON public.servicios_salon;
CREATE TRIGGER guard_suscripcion_servicios_salon BEFORE INSERT ON public.servicios_salon
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();
DROP TRIGGER IF EXISTS guard_suscripcion_plantillas_precio ON public.plantillas_precio;
CREATE TRIGGER guard_suscripcion_plantillas_precio BEFORE INSERT ON public.plantillas_precio
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();
DROP TRIGGER IF EXISTS guard_suscripcion_productos_salon ON public.productos_salon;
CREATE TRIGGER guard_suscripcion_productos_salon BEFORE INSERT ON public.productos_salon
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();
DROP TRIGGER IF EXISTS guard_suscripcion_comisiones ON public.comisiones;
CREATE TRIGGER guard_suscripcion_comisiones BEFORE INSERT ON public.comisiones
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();
DROP TRIGGER IF EXISTS guard_suscripcion_cotizaciones ON public.cotizaciones;
CREATE TRIGGER guard_suscripcion_cotizaciones BEFORE INSERT ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();

-- Las versiones de plantilla no se editan: solo se cierran.
CREATE OR REPLACE FUNCTION public.plantillas_precio_inmutables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'vigente_hasta') IS DISTINCT FROM (to_jsonb(OLD) - 'vigente_hasta') THEN
    RAISE EXCEPTION 'PLANTILLA_INMUTABLE: publica una versión nueva en lugar de editar esta';
  END IF;
  IF OLD.vigente_hasta IS NOT NULL AND NEW.vigente_hasta IS DISTINCT FROM OLD.vigente_hasta THEN
    RAISE EXCEPTION 'PLANTILLA_INMUTABLE: una versión cerrada no se reabre';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plantillas_precio_inmutables ON public.plantillas_precio;
CREATE TRIGGER plantillas_precio_inmutables BEFORE UPDATE ON public.plantillas_precio
  FOR EACH ROW EXECUTE FUNCTION public.plantillas_precio_inmutables();

-- Una cotización solo apunta a cosas de SU salón (y la consulta, a su
-- clienta). SECURITY DEFINER para verificar sin depender de la RLS de quien
-- escribe; no expone datos: solo acepta o rechaza.
--
-- Valida al insertar y, al actualizar, solo lo que CAMBIA hacia un valor no
-- nulo. Así los ON DELETE SET NULL en cascada (borrar una clienta borra sus
-- consultas y anula las dos referencias en pasos separados) no revalidan
-- filas que ya no existen.
CREATE OR REPLACE FUNCTION public.cotizaciones_mismo_salon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_insert boolean := TG_OP = 'INSERT';
BEGIN
  IF NEW.clienta_id IS NOT NULL
     AND (v_insert OR NEW.clienta_id IS DISTINCT FROM OLD.clienta_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.clientas c WHERE c.id = NEW.clienta_id AND c.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'REFERENCIA_OTRO_SALON: la clienta no pertenece a este salón';
  END IF;
  IF NEW.consulta_id IS NOT NULL
     AND (v_insert OR NEW.consulta_id IS DISTINCT FROM OLD.consulta_id
          OR (NEW.clienta_id IS NOT NULL AND NEW.clienta_id IS DISTINCT FROM OLD.clienta_id))
     AND NOT EXISTS (
       SELECT 1 FROM public.consultas q
        WHERE q.id = NEW.consulta_id AND q.user_id = NEW.user_id
          AND (NEW.clienta_id IS NULL OR q.clienta_id = NEW.clienta_id)
     ) THEN
    RAISE EXCEPTION 'REFERENCIA_OTRO_SALON: la consulta no es de esta clienta o de este salón';
  END IF;
  IF NEW.estilista_id IS NOT NULL
     AND (v_insert OR NEW.estilista_id IS DISTINCT FROM OLD.estilista_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.estilistas e WHERE e.id = NEW.estilista_id AND e.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'REFERENCIA_OTRO_SALON: la estilista no pertenece a este salón';
  END IF;
  IF NEW.servicio_id IS NOT NULL
     AND (v_insert OR NEW.servicio_id IS DISTINCT FROM OLD.servicio_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.servicios_salon s WHERE s.id = NEW.servicio_id AND s.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'REFERENCIA_OTRO_SALON: el servicio no pertenece a este salón';
  END IF;
  IF NEW.plantilla_id IS NOT NULL
     AND (v_insert OR NEW.plantilla_id IS DISTINCT FROM OLD.plantilla_id
          OR (NEW.servicio_id IS NOT NULL AND NEW.servicio_id IS DISTINCT FROM OLD.servicio_id))
     AND NOT EXISTS (
       SELECT 1 FROM public.plantillas_precio p
        WHERE p.id = NEW.plantilla_id AND p.user_id = NEW.user_id
          AND (NEW.servicio_id IS NULL OR p.servicio_id = NEW.servicio_id)
     ) THEN
    RAISE EXCEPTION 'REFERENCIA_OTRO_SALON: la plantilla no es de este servicio o de este salón';
  END IF;
  IF NEW.servicio_color_id IS NOT NULL
     AND (v_insert OR NEW.servicio_color_id IS DISTINCT FROM OLD.servicio_color_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.servicios_color sc
        WHERE sc.id = NEW.servicio_color_id AND sc.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'REFERENCIA_OTRO_SALON: la fórmula de color no pertenece a este salón';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cotizaciones_mismo_salon() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cotizaciones_mismo_salon ON public.cotizaciones;
CREATE TRIGGER cotizaciones_mismo_salon BEFORE INSERT OR UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_mismo_salon();

-- Ciclo de vida: borrador → enviada → cobrada, y anulada desde borrador o
-- enviada. Lo enviado a la clienta no cambia (para otro precio: anular y
-- cotizar de nuevo). Lo cobrado sí se corrige (queda en eventos).
CREATE OR REPLACE FUNCTION public.cotizaciones_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.token_publico IS DISTINCT FROM OLD.token_publico THEN
      RAISE EXCEPTION 'COTIZACION_INMUTABLE: no cambian el salón ni el link';
    END IF;

    IF NEW.estado IS DISTINCT FROM OLD.estado AND NOT (
         (OLD.estado = 'borrador' AND NEW.estado IN ('enviada', 'cobrada', 'anulada'))
      OR (OLD.estado = 'enviada' AND NEW.estado IN ('cobrada', 'anulada'))
    ) THEN
      RAISE EXCEPTION 'COTIZACION_TRANSICION: de % a % no está permitido', OLD.estado, NEW.estado;
    END IF;

    IF OLD.estado <> 'borrador' AND (
         NEW.precio_cotizado IS DISTINCT FROM OLD.precio_cotizado
      OR NEW.precio_calculado IS DISTINCT FROM OLD.precio_calculado
      OR NEW.variables IS DISTINCT FROM OLD.variables
      OR NEW.servicio_nombre IS DISTINCT FROM OLD.servicio_nombre
      OR NEW.vigencia_hasta IS DISTINCT FROM OLD.vigencia_hasta
      OR NEW.con_marca_velli IS DISTINCT FROM OLD.con_marca_velli
    ) THEN
      RAISE EXCEPTION 'COTIZACION_INMUTABLE: lo enviado a la clienta no se modifica; anula y cotiza de nuevo';
    END IF;

    IF OLD.estado = 'anulada' AND NEW.precio_cobrado IS DISTINCT FROM OLD.precio_cobrado THEN
      RAISE EXCEPTION 'COTIZACION_INMUTABLE: una cotización anulada no se cobra';
    END IF;
  END IF;

  IF NEW.estado = 'enviada' AND NEW.enviada_at IS NULL THEN
    NEW.enviada_at := now();
  END IF;
  IF NEW.estado = 'cobrada' AND NEW.cobrado_at IS NULL THEN
    NEW.cobrado_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cotizaciones_ciclo ON public.cotizaciones;
CREATE TRIGGER cotizaciones_ciclo BEFORE INSERT OR UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_ciclo();

-- Bitácora: cada creación, cambio de estado y corrección de cobro.
CREATE OR REPLACE FUNCTION public.cotizaciones_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo text;
  v_datos jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tipo := 'creada';
    v_datos := jsonb_build_object(
      'estado', NEW.estado,
      'precio_calculado', NEW.precio_calculado,
      'precio_cotizado', NEW.precio_cotizado,
      'estilista_id', NEW.estilista_id
    );
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_tipo := NEW.estado;  -- enviada | cobrada | anulada
    v_datos := jsonb_build_object(
      'de', OLD.estado,
      'precio_cobrado', NEW.precio_cobrado,
      'estilista_id', NEW.estilista_id
    );
  ELSIF NEW.precio_cobrado IS DISTINCT FROM OLD.precio_cobrado THEN
    v_tipo := 'cobro_corregido';
    v_datos := jsonb_build_object('antes', OLD.precio_cobrado, 'despues', NEW.precio_cobrado);
  END IF;

  IF v_tipo IS NOT NULL THEN
    INSERT INTO public.cotizacion_eventos (cotizacion_id, user_id, tipo, datos)
    VALUES (NEW.id, NEW.user_id, v_tipo, v_datos);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cotizaciones_registrar_evento() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cotizaciones_registrar_evento ON public.cotizaciones;
CREATE TRIGGER cotizaciones_registrar_evento AFTER INSERT OR UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_registrar_evento();

-- ═══════════════════════════════════════════════════════════════════════════
-- Funciones (RPC)
-- ═══════════════════════════════════════════════════════════════════════════

-- Publica una versión nueva de la plantilla de un servicio y cierra la
-- anterior, en una sola transacción. SECURITY INVOKER: la RLS decide si la
-- cuenta puede tocar ese servicio.
CREATE OR REPLACE FUNCTION public.publicar_plantilla_precio(
  p_servicio_id uuid,
  p_precio_base integer,
  p_ajustes jsonb DEFAULT '{}'::jsonb,
  p_consumo jsonb DEFAULT '{}'::jsonb,
  p_redondeo integer DEFAULT 1000,
  p_vigencia_dias integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
  v_version integer;
  v_id uuid;
BEGIN
  -- FOR UPDATE serializa dos publicaciones simultáneas del mismo servicio.
  SELECT s.user_id INTO v_user
    FROM public.servicios_salon s
   WHERE s.id = p_servicio_id
     FOR UPDATE;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SERVICIO_NO_ENCONTRADO: el servicio no existe o no es de este salón';
  END IF;

  SELECT coalesce(max(p.version), 0) + 1 INTO v_version
    FROM public.plantillas_precio p
   WHERE p.servicio_id = p_servicio_id;

  UPDATE public.plantillas_precio
     SET vigente_hasta = now()
   WHERE servicio_id = p_servicio_id AND vigente_hasta IS NULL;

  INSERT INTO public.plantillas_precio
    (user_id, servicio_id, version, precio_base, ajustes, consumo, redondeo, vigencia_dias)
  VALUES
    (v_user, p_servicio_id, v_version, p_precio_base,
     coalesce(p_ajustes, '{}'::jsonb), coalesce(p_consumo, '{}'::jsonb),
     p_redondeo, p_vigencia_dias)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publicar_plantilla_precio(uuid, integer, jsonb, jsonb, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_plantilla_precio(uuid, integer, jsonb, jsonb, integer, integer) TO authenticated, service_role;

-- La ÚNICA puerta pública: la página /c/<token>. El token es la credencial
-- (uuid v4); no hay auth.uid() a propósito. Devuelve solo servicio, precio,
-- vigencia y la identidad del salón — nada del diagnóstico, ni de la
-- clienta, ni fotos, ni datos de salud capilar. Borradores y anuladas no
-- existen hacia afuera.
CREATE OR REPLACE FUNCTION public.cotizacion_publica(p_token uuid)
RETURNS TABLE (
  salon text,
  color_salon text,
  servicio text,
  precio integer,
  moneda text,
  vigencia_hasta date,
  vigente boolean,
  con_marca_velli boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    coalesce(nullif(btrim(p.nombre_salon), ''), 'Tu salón'),
    p.color_primario,
    c.servicio_nombre,
    c.precio_cotizado,
    c.moneda,
    c.vigencia_hasta,
    c.vigencia_hasta >= (now() AT TIME ZONE 'America/Bogota')::date,
    c.con_marca_velli
  FROM public.cotizaciones c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.token_publico = p_token
    AND c.estado IN ('enviada', 'cobrada');
$$;
REVOKE ALL ON FUNCTION public.cotizacion_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotizacion_publica(uuid) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS (por salón) y privilegios
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.estilistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_salon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_salon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_eventos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  -- Lectura y escritura del propio salón en las tablas de configuración.
  FOREACH t IN ARRAY ARRAY['estilistas', 'servicios_salon', 'productos_salon', 'comisiones', 'cotizaciones']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_salon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (user_id IN (SELECT public.salones_del_usuario()))', t || '_select_salon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_salon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (user_id IN (SELECT public.salones_del_usuario()))', t || '_insert_salon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_salon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (user_id IN (SELECT public.salones_del_usuario()))
         WITH CHECK (user_id IN (SELECT public.salones_del_usuario()))', t || '_update_salon', t);
  END LOOP;

  -- Borrado: la configuración se puede borrar; las cotizaciones solo en
  -- borrador (lo enviado se anula, no se borra).
  FOREACH t IN ARRAY ARRAY['estilistas', 'servicios_salon', 'productos_salon', 'comisiones']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_salon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (user_id IN (SELECT public.salones_del_usuario()))', t || '_delete_salon', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS cotizaciones_delete_borrador ON public.cotizaciones;
CREATE POLICY cotizaciones_delete_borrador ON public.cotizaciones FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.salones_del_usuario()) AND estado = 'borrador');

-- Plantillas: se leen y se crean versiones (la RPC); no se borran ni se
-- editan desde el cliente — la RPC cierra la anterior con su UPDATE.
DROP POLICY IF EXISTS plantillas_precio_select_salon ON public.plantillas_precio;
CREATE POLICY plantillas_precio_select_salon ON public.plantillas_precio FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.salones_del_usuario()));
DROP POLICY IF EXISTS plantillas_precio_insert_salon ON public.plantillas_precio;
CREATE POLICY plantillas_precio_insert_salon ON public.plantillas_precio FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.salones_del_usuario())
    AND EXISTS (SELECT 1 FROM public.servicios_salon s
                 WHERE s.id = servicio_id AND s.user_id = plantillas_precio.user_id)
  );
DROP POLICY IF EXISTS plantillas_precio_update_salon ON public.plantillas_precio;
CREATE POLICY plantillas_precio_update_salon ON public.plantillas_precio FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.salones_del_usuario()))
  WITH CHECK (user_id IN (SELECT public.salones_del_usuario()));

-- Eventos: solo lectura del propio salón; los escribe el trigger.
DROP POLICY IF EXISTS cotizacion_eventos_select_salon ON public.cotizacion_eventos;
CREATE POLICY cotizacion_eventos_select_salon ON public.cotizacion_eventos FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.salones_del_usuario()));

-- Privilegios. Las default privileges de public dan ALL a anon en cada
-- tabla nueva (schema.sql); aquí anon no tiene nada que hacer: lo público
-- entra solo por cotizacion_publica().
REVOKE ALL ON TABLE public.estilistas, public.servicios_salon, public.plantillas_precio,
  public.productos_salon, public.comisiones, public.cotizaciones, public.cotizacion_eventos
  FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estilistas, public.servicios_salon,
  public.productos_salon, public.comisiones, public.cotizaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.plantillas_precio TO authenticated;
REVOKE DELETE ON TABLE public.plantillas_precio FROM authenticated;
GRANT SELECT ON TABLE public.cotizacion_eventos TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.cotizacion_eventos FROM authenticated;
GRANT ALL ON TABLE public.estilistas, public.servicios_salon, public.plantillas_precio,
  public.productos_salon, public.comisiones, public.cotizaciones, public.cotizacion_eventos
  TO service_role;
