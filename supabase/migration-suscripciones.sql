-- ============================================================================
-- migration-suscripciones.sql — Sistema de suscripciones prepago (Bold)
-- ============================================================================
-- Crea: subscriptions, payments, subscription_notifications + RLS estricta,
-- función de estado efectivo, triggers de límite (50 clientas plan básico) y
-- bloqueo suave por vencimiento, procesamiento idempotente de webhooks de
-- pago, extensión de handle_new_user (trial 14 días + nombre_salon) y
-- backfill de usuarios existentes.
--
-- Idempotente: se puede ejecutar más de una vez sin efectos duplicados.
-- Aplicar en SQL Editor (dev / staging / prod). Después del rollout,
-- regenerar schema.sql según supabase/README.md.
--
-- Modelo de negocio (ver PAGOS.md):
--   · Trial 14 días sin tarjeta al registrarse (features de Pro+IA).
--   · Prepago por periodo: cada pago aprobado extiende current_period_end
--     +30 días desde max(now, current_period_end).
--   · Gracia de 3 días tras vencer (estado efectivo past_due).
--   · Vencida la gracia: bloqueo suave — puede VER datos, no CREAR
--     clientas / consultas / citas (enforced aquí, a nivel de DB).
--   · Las constantes 14 / 30 / 3 días viven aquí y se espejan en
--     lib/subscription/plans.ts — cambiar ambos lados a la vez.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- plan es NULL durante el trial (aún no ha elegido/pagado ninguno)
  plan               text CHECK (plan IN ('basico', 'pro', 'pro_ia')),
  -- status ALMACENADO: solo cambia por eventos (signup, pago, cancelación).
  -- El estado EFECTIVO (past_due/expired por fechas) se calcula con
  -- public.suscripcion_efectiva() — nunca confiar solo en esta columna.
  status             text NOT NULL DEFAULT 'trialing'
                     CHECK (status IN ('trialing', 'active', 'past_due', 'expired', 'canceled')),
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  canceled_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id     uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider            text NOT NULL DEFAULT 'bold',
  -- Referencia única generada por nosotros y enviada al proveedor.
  -- El webhook la devuelve en data.metadata.reference → es la llave de match.
  reference           text NOT NULL UNIQUE,
  -- payment_id del proveedor (Bold). UNIQUE = idempotencia dura: un mismo
  -- evento de pago no puede aplicarse dos veces ni a dos payments distintos.
  provider_payment_id text UNIQUE,
  provider_link_id    text,
  checkout_url        text,
  plan                text NOT NULL CHECK (plan IN ('basico', 'pro', 'pro_ia')),
  amount              integer NOT NULL CHECK (amount > 0),  -- COP, sin decimales
  currency            text NOT NULL DEFAULT 'COP',
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'voided', 'expired', 'error')),
  metodo              text,           -- payment_method reportado por el proveedor
  raw_webhook         jsonb,          -- payload crudo del webhook (auditoría)
  paid_at             timestamptz,
  period_start        timestamptz,    -- periodo que compró este pago (auditoría)
  period_end          timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Capa de notificaciones de renovación. El cron (in-app) escribe aquí con
-- dedupe por (user, tipo, canal, vencimiento); email/whatsapp reutilizan la
-- misma tabla con otro `canal` cuando se implementen.
CREATE TABLE IF NOT EXISTS public.subscription_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('vence_5d', 'vence_1d', 'gracia', 'vencida')),
  canal      text NOT NULL DEFAULT 'in_app' CHECK (canal IN ('in_app', 'email', 'whatsapp')),
  -- El vencimiento al que refiere el recordatorio: dedupe natural por periodo.
  vence_ref  timestamptz NOT NULL,
  mensaje    text NOT NULL,
  leida_at   timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, tipo, canal, vence_ref)
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subnotif_user
  ON public.subscription_notifications (user_id, created_at DESC);

-- updated_at automático (reutiliza public.update_updated_at existente)
DROP TRIGGER IF EXISTS set_updated_at_subscriptions ON public.subscriptions;
CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments;
CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS — lectura del propio tenant; escrituras SOLO service_role
-- ────────────────────────────────────────────────────────────────────────────
-- Sin policies de INSERT/UPDATE/DELETE para authenticated: toda mutación pasa
-- por el backend (service_role bypasea RLS). Esto impide falsificar pagos o
-- extender suscripciones desde el cliente.

ALTER TABLE public.subscriptions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "subnotif_select_own" ON public.subscription_notifications;
CREATE POLICY "subnotif_select_own" ON public.subscription_notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Marcar como leída: único UPDATE permitido al cliente (no puede reasignar
-- la fila a otro user gracias al WITH CHECK).
DROP POLICY IF EXISTS "subnotif_update_own" ON public.subscription_notifications;
CREATE POLICY "subnotif_update_own" ON public.subscription_notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Estado efectivo de la suscripción
-- ────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER (owner postgres, bypasea RLS) porque la usan los triggers
-- de clientas/consultas/citas ejecutándose como `authenticated`, que solo ve
-- su propia fila. Anti-abuso: si hay un JWT (auth.uid() no nulo) SIEMPRE se
-- ignora p_user_id y se usa el uid del token — un usuario autenticado no
-- puede sondear el estado de otro tenant. anon no tiene EXECUTE.

CREATE OR REPLACE FUNCTION public.suscripcion_efectiva(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (estado text, plan text, vence timestamptz, dias_restantes integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_sub public.subscriptions%ROWTYPE;
  v_deadline timestamptz;
  v_gracia constant interval := interval '3 days';
BEGIN
  v_uid := COALESCE(auth.uid(), p_user_id);
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::timestamptz, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions s WHERE s.user_id = v_uid;

  -- Sin fila de suscripción = sin acceso de escritura (el backfill y
  -- handle_new_user garantizan que todo usuario real tenga una).
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::timestamptz, NULL::integer;
    RETURN;
  END IF;

  v_deadline := COALESCE(v_sub.current_period_end, v_sub.trial_ends_at);

  IF v_deadline IS NULL THEN
    -- Fila anómala sin fechas: tratar como vencida (conservador).
    RETURN QUERY SELECT 'expired'::text, v_sub.plan, NULL::timestamptz, NULL::integer;
    RETURN;
  END IF;

  IF now() <= v_deadline THEN
    -- Dentro del periodo. canceled conserva acceso hasta el vencimiento.
    RETURN QUERY SELECT
      CASE
        WHEN v_sub.status = 'canceled' THEN 'canceled'
        WHEN v_sub.status = 'trialing' THEN 'trialing'
        ELSE 'active'
      END,
      v_sub.plan, v_deadline,
      GREATEST(0, EXTRACT(day FROM (v_deadline - now()))::integer);
    RETURN;
  END IF;

  -- Vencida. canceled no recibe gracia (decidió no renovar).
  IF v_sub.status <> 'canceled' AND now() <= v_deadline + v_gracia THEN
    RETURN QUERY SELECT 'past_due'::text, v_sub.plan, v_deadline, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'expired'::text, v_sub.plan, v_deadline, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.suscripcion_efectiva(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suscripcion_efectiva(uuid) TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Guard de escritura por tenant (triggers)
-- ────────────────────────────────────────────────────────────────────────────
-- · Bloquea INSERT en clientas / consultas / citas con suscripción vencida
--   (bloqueo suave: leer/editar sigue permitido, crear no).
-- · Aplica el límite de 50 clientas del plan Básico A NIVEL DE DB.
--   Serializa con FOR UPDATE sobre la fila de subscriptions para que dos
--   inserts concurrentes no puedan superar el límite por carrera.
-- Los mensajes usan códigos estables que la UI mapea a texto amigable
-- (lib/errors.ts): SUSCRIPCION_VENCIDA, LIMITE_CLIENTAS_BASICO.

CREATE OR REPLACE FUNCTION public.verificar_escritura_tenant(
  p_user_id uuid,
  p_es_clienta_nueva boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_sub public.subscriptions%ROWTYPE;
  v_estado text;
  v_deadline timestamptz;
  v_count integer;
  v_limite constant integer := 50;
  v_gracia constant interval := interval '3 days';
BEGIN
  v_uid := COALESCE(auth.uid(), p_user_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'SUSCRIPCION_VENCIDA: no hay usuario para validar la suscripción';
  END IF;

  -- Lock por tenant: serializa inserts concurrentes del mismo usuario.
  SELECT * INTO v_sub FROM public.subscriptions s
   WHERE s.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUSCRIPCION_VENCIDA: el usuario no tiene suscripción activa';
  END IF;

  v_deadline := COALESCE(v_sub.current_period_end, v_sub.trial_ends_at);

  IF v_deadline IS NULL OR now() > v_deadline + (CASE WHEN v_sub.status = 'canceled' THEN interval '0' ELSE v_gracia END) THEN
    RAISE EXCEPTION 'SUSCRIPCION_VENCIDA: renueva tu plan para seguir creando registros';
  END IF;

  v_estado := CASE
    WHEN now() <= v_deadline AND v_sub.status = 'trialing' THEN 'trialing'
    WHEN now() <= v_deadline THEN 'active'
    ELSE 'past_due'
  END;

  -- Límite de clientas: solo plan Básico fuera de trial. Durante el trial la
  -- estilista prueba la experiencia completa (sin límite).
  IF p_es_clienta_nueva AND v_estado <> 'trialing' AND v_sub.plan = 'basico' THEN
    SELECT count(*) INTO v_count FROM public.clientas c WHERE c.user_id = v_uid;
    IF v_count >= v_limite THEN
      RAISE EXCEPTION 'LIMITE_CLIENTAS_BASICO: el plan Básico permite hasta % clientas', v_limite;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_escritura_tenant(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_escritura_tenant(uuid, boolean) TO service_role;

-- Trigger functions (SECURITY INVOKER; la validación pesada vive en la
-- función DEFINER de arriba, que postgres puede ejecutar como owner).
CREATE OR REPLACE FUNCTION public.trg_clientas_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Upserts (ON CONFLICT DO UPDATE) disparan BEFORE INSERT aunque terminen
  -- en update: si la fila ya existe NO es una clienta nueva → no cuenta
  -- para el límite (permite re-importar backups sin falsos rechazos).
  PERFORM public.verificar_escritura_tenant(
    NEW.user_id,
    NOT EXISTS (SELECT 1 FROM public.clientas c WHERE c.id = NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escritura_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.verificar_escritura_tenant(NEW.user_id, false);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_clientas_guard()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_escritura_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_suscripcion_clientas ON public.clientas;
CREATE TRIGGER guard_suscripcion_clientas
  BEFORE INSERT ON public.clientas
  FOR EACH ROW EXECUTE FUNCTION public.trg_clientas_guard();

DROP TRIGGER IF EXISTS guard_suscripcion_consultas ON public.consultas;
CREATE TRIGGER guard_suscripcion_consultas
  BEFORE INSERT ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();

DROP TRIGGER IF EXISTS guard_suscripcion_citas ON public.citas;
CREATE TRIGGER guard_suscripcion_citas
  BEFORE INSERT ON public.citas
  FOR EACH ROW EXECUTE FUNCTION public.trg_escritura_guard();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Procesamiento idempotente de eventos de pago (webhook / reconciliación)
-- ────────────────────────────────────────────────────────────────────────────
-- La llama el backend con service_role (RPC). Garantías:
--   · Un mismo evento (mismo reference ya approved) NUNCA extiende dos veces:
--     el UPDATE condicional + lock de fila serializa reintentos concurrentes.
--   · provider_payment_id UNIQUE evita aplicar el mismo pago Bold a dos
--     referencias distintas.
-- Devuelve: 'applied' | 'already_applied' | 'unknown_reference' | 'marked_<estado>'

CREATE OR REPLACE FUNCTION public.procesar_evento_pago(
  p_tipo text,                 -- 'approved' | 'rejected' | 'voided'
  p_reference text,
  p_provider_payment_id text,
  p_amount integer,
  p_metodo text,
  p_raw jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_pay public.payments%ROWTYPE;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_periodo constant interval := interval '30 days';
BEGIN
  SELECT * INTO v_pay FROM public.payments
   WHERE reference = p_reference
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'unknown_reference';
  END IF;

  IF p_tipo = 'approved' THEN
    IF v_pay.status = 'approved' THEN
      RETURN 'already_applied';  -- reintento de Bold o replay: no-op
    END IF;

    UPDATE public.payments SET
      status              = 'approved',
      provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
      metodo              = COALESCE(p_metodo, metodo),
      raw_webhook         = COALESCE(p_raw, raw_webhook),
      paid_at             = now()
    WHERE id = v_pay.id;

    -- Extender la suscripción: +30 días desde max(now, vencimiento actual).
    -- Pago durante el periodo = se acumula al final; pago tras vencer (o en
    -- trial) = el periodo arranca ahora. Sin prorrateo entre planes.
    SELECT GREATEST(COALESCE(s.current_period_end, now()), now())
      INTO v_inicio
      FROM public.subscriptions s WHERE s.user_id = v_pay.user_id
      FOR UPDATE;

    IF NOT FOUND THEN
      v_inicio := now();
      INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
      VALUES (v_pay.user_id, v_pay.plan, 'active', v_inicio + v_periodo)
      ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan, status = 'active',
        current_period_end = EXCLUDED.current_period_end, canceled_at = NULL;
    ELSE
      UPDATE public.subscriptions SET
        plan               = v_pay.plan,
        status             = 'active',
        current_period_end = v_inicio + v_periodo,
        canceled_at        = NULL
      WHERE user_id = v_pay.user_id;
    END IF;

    v_fin := v_inicio + v_periodo;
    UPDATE public.payments SET
      period_start = v_inicio,
      period_end   = v_fin,
      subscription_id = (SELECT id FROM public.subscriptions WHERE user_id = v_pay.user_id)
    WHERE id = v_pay.id;

    RETURN 'applied';
  END IF;

  -- rejected / voided: registrar sin tocar la suscripción. Un pago approved
  -- no se degrada a rejected por un evento tardío fuera de orden.
  IF p_tipo IN ('rejected', 'voided') THEN
    IF v_pay.status = 'approved' AND p_tipo = 'rejected' THEN
      RETURN 'already_applied';
    END IF;
    UPDATE public.payments SET
      status              = CASE WHEN p_tipo = 'voided' THEN 'voided' ELSE 'rejected' END,
      provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
      metodo              = COALESCE(p_metodo, metodo),
      raw_webhook         = COALESCE(p_raw, raw_webhook)
    WHERE id = v_pay.id;
    RETURN 'marked_' || p_tipo;
  END IF;

  RAISE EXCEPTION 'procesar_evento_pago: tipo desconocido %', p_tipo;
END;
$$;

-- Solo el backend (service_role) procesa eventos de pago.
REVOKE ALL ON FUNCTION public.procesar_evento_pago(text, text, text, integer, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.procesar_evento_pago(text, text, text, integer, text, jsonb)
  TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. handle_new_user: trial de 14 días + nombre_salon en signup
-- ────────────────────────────────────────────────────────────────────────────
-- Extiende la función existente: además del profile, crea la suscripción
-- trialing. De paso persiste nombre_salon desde el metadata del signup
-- (gap conocido: el registro ya lo enviaba pero no se guardaba).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, nombre_salon)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Estilista'),
    NULLIF(NEW.raw_user_meta_data->>'nombre_salon', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
  VALUES (NEW.id, 'trialing', now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Backfill: usuarios existentes reciben trial de 14 días desde hoy
-- ────────────────────────────────────────────────────────────────────────────
-- Evita dejar fuera (bloqueadas) a cuentas creadas antes de esta migración.

INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
SELECT u.id, 'trialing', now() + interval '14 days'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Refrescar el schema cache de PostgREST
-- ────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
