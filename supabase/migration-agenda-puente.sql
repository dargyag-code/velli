-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agenda Multi-Tenant, Horarios por Especialista, Puente a Silla
-- y Trazabilidad de Reactivación CRM (`specialist_schedules`, `appointments`,
-- `appointment_events`, `clientas.last_reactivation_contact_at`)
--
-- Reglas cumplidas (`AGENTS.md`):
-- 1. `organization_id uuid NOT NULL` indexado + `ENABLE ROW LEVEL SECURITY` en
--    todas las tablas nuevas.
-- 2. Prevención real en base de datos contra solapamiento de citas del mismo
--    especialista (`EXCLUDE USING gist` con `btree_gist` + trigger explícito
--    en zona horaria `America/Bogota`).
-- 3. Bitácora append-only `public.appointment_events` para trazabilidad de
--    cambios de estado (`pending`, `confirmed`, `in_chair`, `completed`,
--    `no_show`, `cancelled`).
-- 4. Disponibilidad pública acotada por RPC (`agenda_disponibilidad_publica`)
--    sin exponer jamás datos personales de otras clientas ni costos internos.
--
-- Idempotente y no destructiva.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 1. Horarios semanales por especialista (`specialist_schedules`) ────────
CREATE TABLE IF NOT EXISTS public.specialist_schedules (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES public.estilistas(id) ON DELETE CASCADE,
  -- 0 = domingo … 6 = sábado (evaluado en America/Bogota)
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT specialist_schedules_time_check CHECK (end_time > start_time),
  CONSTRAINT specialist_schedules_org_spec_day_key UNIQUE (
    organization_id,
    specialist_id,
    day_of_week
  )
);

CREATE INDEX IF NOT EXISTS idx_specialist_schedules_organization_id
  ON public.specialist_schedules (organization_id);
CREATE INDEX IF NOT EXISTS idx_specialist_schedules_specialist
  ON public.specialist_schedules (specialist_id, day_of_week)
  WHERE active = true;

DROP TRIGGER IF EXISTS set_updated_at_specialist_schedules ON public.specialist_schedules;
CREATE TRIGGER set_updated_at_specialist_schedules
  BEFORE UPDATE ON public.specialist_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2. Citas multi-tenant (`appointments`) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clienta_id uuid REFERENCES public.clientas(id) ON DELETE SET NULL,
  specialist_id uuid NOT NULL REFERENCES public.estilistas(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.servicios_salon(id) ON DELETE SET NULL,
  customer_name text NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 2 AND 100),
  customer_phone text NOT NULL CHECK (char_length(btrim(customer_phone)) BETWEEN 7 AND 24),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_chair', 'completed', 'no_show', 'cancelled')),
  source text NOT NULL DEFAULT 'panel'
    CHECK (source IN ('web_vitrina', 'panel')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_window_check CHECK (ends_at > starts_at)
);

-- Restricción física GIST contra solapamientos del mismo especialista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_no_specialist_overlap'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_specialist_overlap
      EXCLUDE USING gist (
        specialist_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status NOT IN ('cancelled', 'no_show'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_organization_starts
  ON public.appointments (organization_id, starts_at ASC);
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_starts
  ON public.appointments (specialist_id, starts_at ASC)
  WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX IF NOT EXISTS idx_appointments_clienta
  ON public.appointments (clienta_id)
  WHERE clienta_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_appointments ON public.appointments;
CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Guardarraíl en zona horaria `America/Bogota`: valida pertenencia al salón,
-- no-solapamiento del especialista y horario laboral configurado si existe.
CREATE OR REPLACE FUNCTION public.appointments_guard_bogota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_bogota timestamp;
  v_end_bogota timestamp;
  v_dow smallint;
  v_tiene_horario boolean;
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'APPOINTMENT_WINDOW_INVALID: ends_at debe ser posterior a starts_at';
  END IF;

  -- Validar que la especialista pertenezca a la misma organización
  IF NOT EXISTS (
    SELECT 1 FROM public.estilistas e
    WHERE e.id = NEW.specialist_id
      AND COALESCE(e.organization_id, e.user_id) = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'APPOINTMENT_TENANT_MISMATCH: la especialista no pertenece a esta organización';
  END IF;

  IF NEW.status NOT IN ('cancelled', 'no_show') THEN
    v_start_bogota := NEW.starts_at AT TIME ZONE 'America/Bogota';
    v_end_bogota := NEW.ends_at AT TIME ZONE 'America/Bogota';

    IF v_start_bogota::date <> v_end_bogota::date THEN
      RAISE EXCEPTION 'APPOINTMENT_CROSS_DAY_BOGOTA: la cita debe iniciar y terminar el mismo día en America/Bogota';
    END IF;

    -- Verificar solapamiento explícito del especialista
    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.organization_id = NEW.organization_id
        AND a.specialist_id = NEW.specialist_id
        AND a.id <> NEW.id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
    ) THEN
      RAISE EXCEPTION 'APPOINTMENT_OVERLAP: la especialista ya tiene una cita asignada en ese horario (America/Bogota)';
    END IF;

    -- Si la especialista tiene horarios configurados en `specialist_schedules`,
    -- exigir que la cita caiga dentro de su turno activo en `America/Bogota`.
    SELECT EXISTS (
      SELECT 1 FROM public.specialist_schedules ss
      WHERE ss.organization_id = NEW.organization_id
        AND ss.specialist_id = NEW.specialist_id
    ) INTO v_tiene_horario;

    IF v_tiene_horario THEN
      v_dow := EXTRACT(DOW FROM v_start_bogota)::smallint;
      IF NOT EXISTS (
        SELECT 1
        FROM public.specialist_schedules ss
        WHERE ss.organization_id = NEW.organization_id
          AND ss.specialist_id = NEW.specialist_id
          AND ss.day_of_week = v_dow
          AND ss.active = true
          AND v_start_bogota::time >= ss.start_time
          AND v_end_bogota::time <= ss.end_time
      ) THEN
        RAISE EXCEPTION 'APPOINTMENT_OUTSIDE_SCHEDULE: fuera del horario activo de la especialista en America/Bogota';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.appointments_guard_bogota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_guard_bogota ON public.appointments;
CREATE TRIGGER appointments_guard_bogota
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_guard_bogota();

-- ── 3. Bitácora append-only de citas (`appointment_events`) ────────────────
CREATE TABLE IF NOT EXISTS public.appointment_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status text,
  new_status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_events_org
  ON public.appointment_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_events_appointment
  ON public.appointment_events (appointment_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.appointments_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_events (
      organization_id,
      appointment_id,
      actor_user_id,
      previous_status,
      new_status,
      source
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      (SELECT auth.uid()),
      NULL,
      NEW.status,
      NEW.source
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.appointment_events (
      organization_id,
      appointment_id,
      actor_user_id,
      previous_status,
      new_status,
      source
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      (SELECT auth.uid()),
      OLD.status,
      NEW.status,
      NEW.source
    );

    -- Si la cita pasa a `completed` y tiene `clienta_id`, actualiza su última visita
    IF NEW.status = 'completed' AND NEW.clienta_id IS NOT NULL THEN
      UPDATE public.clientas
      SET ultima_visita = GREATEST(COALESCE(ultima_visita, NEW.ends_at), NEW.ends_at),
          total_visitas = COALESCE(total_visitas, 0) + 1
      WHERE id = NEW.clienta_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.appointments_registrar_evento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_registrar_evento ON public.appointments;
CREATE TRIGGER appointments_registrar_evento
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_registrar_evento();

-- ── 4. Columna de control de reactivación en `clientas` ────────────────────
ALTER TABLE public.clientas
  ADD COLUMN IF NOT EXISTS last_reactivation_contact_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clientas_reactivacion
  ON public.clientas (user_id, ultima_visita, last_reactivation_contact_at);

-- ── 5. Row Level Security (RLS) ────────────────────────────────────────────
ALTER TABLE public.specialist_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_events ENABLE ROW LEVEL SECURITY;

-- 5.1 `specialist_schedules`
DROP POLICY IF EXISTS specialist_schedules_select_member ON public.specialist_schedules;
CREATE POLICY specialist_schedules_select_member ON public.specialist_schedules
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS specialist_schedules_insert_admin ON public.specialist_schedules;
CREATE POLICY specialist_schedules_insert_admin ON public.specialist_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS specialist_schedules_update_admin ON public.specialist_schedules;
CREATE POLICY specialist_schedules_update_admin ON public.specialist_schedules
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS specialist_schedules_delete_admin ON public.specialist_schedules;
CREATE POLICY specialist_schedules_delete_admin ON public.specialist_schedules
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'manager']));

-- 5.2 `appointments`: miembros activos operan la agenda; no se eliminan filas (se cancelan)
DROP POLICY IF EXISTS appointments_select_member ON public.appointments;
CREATE POLICY appointments_select_member ON public.appointments
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS appointments_insert_member ON public.appointments;
CREATE POLICY appointments_insert_member ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS appointments_update_member ON public.appointments;
CREATE POLICY appointments_update_member ON public.appointments
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.current_user_org_ids()));

-- 5.3 `appointment_events`
DROP POLICY IF EXISTS appointment_events_select_member ON public.appointment_events;
CREATE POLICY appointment_events_select_member ON public.appointment_events
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

-- ── 6. RPC Pública de disponibilidad por día (`America/Bogota`) ────────────
-- Devuelve únicamente especialistas activas, horarios y rangos ocupados
-- (jamás nombres de clientas, teléfonos, notas ni costos).
CREATE OR REPLACE FUNCTION public.agenda_disponibilidad_publica(
  p_slug text,
  p_fecha date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_dow smallint;
  v_inicio_dia timestamptz;
  v_fin_dia timestamptz;
  v_specialists jsonb := '[]'::jsonb;
  v_schedules jsonb := '[]'::jsonb;
  v_busy jsonb := '[]'::jsonb;
BEGIN
  IF p_slug IS NULL OR p_fecha IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT o.id INTO v_org_id
  FROM public.organizations o
  WHERE o.slug = lower(btrim(p_slug))
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_dow := EXTRACT(DOW FROM p_fecha)::smallint;
  v_inicio_dia := (p_fecha::timestamp AT TIME ZONE 'America/Bogota');
  v_fin_dia := ((p_fecha + 1)::timestamp AT TIME ZONE 'America/Bogota');

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('id', e.id, 'name', e.nombre)
      ORDER BY e.nombre ASC
    ),
    '[]'::jsonb
  )
  INTO v_specialists
  FROM public.estilistas e
  WHERE COALESCE(e.organization_id, e.user_id) = v_org_id
    AND e.activo = true;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'specialistId', ss.specialist_id,
        'dayOfWeek', ss.day_of_week,
        'startTime', to_char(ss.start_time, 'HH24:MI'),
        'endTime', to_char(ss.end_time, 'HH24:MI'),
        'active', ss.active
      )
    ),
    '[]'::jsonb
  )
  INTO v_schedules
  FROM public.specialist_schedules ss
  WHERE ss.organization_id = v_org_id
    AND ss.day_of_week = v_dow;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'specialistId', a.specialist_id,
        'startsAt', a.starts_at,
        'endsAt', a.ends_at,
        'status', a.status
      )
    ),
    '[]'::jsonb
  )
  INTO v_busy
  FROM public.appointments a
  WHERE a.organization_id = v_org_id
    AND a.status NOT IN ('cancelled', 'no_show')
    AND a.starts_at < v_fin_dia
    AND a.ends_at > v_inicio_dia;

  RETURN jsonb_build_object(
    'organizationId', v_org_id,
    'date', to_char(p_fecha, 'YYYY-MM-DD'),
    'specialists', v_specialists,
    'schedules', v_schedules,
    'busyIntervals', v_busy
  );
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_disponibilidad_publica(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agenda_disponibilidad_publica(text, date) TO anon, authenticated, service_role;

-- ── 7. Privilegios explícitos ──────────────────────────────────────────────
REVOKE ALL ON TABLE
  public.specialist_schedules,
  public.appointments,
  public.appointment_events
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.specialist_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.appointments TO authenticated;
REVOKE DELETE ON TABLE public.appointments FROM authenticated;
GRANT SELECT ON TABLE public.appointment_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.appointment_events FROM authenticated;

GRANT ALL ON TABLE
  public.specialist_schedules,
  public.appointments,
  public.appointment_events
TO service_role;
