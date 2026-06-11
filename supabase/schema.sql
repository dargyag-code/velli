


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."funnel_activacion"() RETURNS TABLE("evento" "text", "cuentas" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."funnel_activacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."procesar_evento_pago"("p_tipo" "text", "p_reference" "text", "p_provider_payment_id" "text", "p_amount" integer, "p_metodo" "text", "p_raw" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."procesar_evento_pago"("p_tipo" "text", "p_reference" "text", "p_provider_payment_id" "text", "p_amount" integer, "p_metodo" "text", "p_raw" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suscripcion_efectiva"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("estado" "text", "plan" "text", "vence" timestamp with time zone, "dias_restantes" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."suscripcion_efectiva"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_clientas_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."trg_clientas_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_escritura_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.verificar_escritura_tenant(NEW.user_id, false);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_escritura_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_escritura_tenant"("p_user_id" "uuid", "p_es_clienta_nueva" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."verificar_escritura_tenant"("p_user_id" "uuid", "p_es_clienta_nueva" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."citas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clienta_id" "uuid" NOT NULL,
    "fecha" timestamp with time zone NOT NULL,
    "hora" "text",
    "duracion_minutos" integer DEFAULT 60,
    "servicio" "text",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "notas" "text",
    "diagnostico_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "citas_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'confirmada'::"text", 'completada'::"text", 'cancelada'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."citas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "apellido" "text",
    "telefono" "text",
    "email" "text",
    "edad" integer,
    "ciudad" "text",
    "tipo_cabello_principal" "text",
    "notas" "text",
    "nivel_estres" "text",
    "embarazo_lactancia" boolean DEFAULT false,
    "alergias" "text",
    "condiciones_medicas" "text",
    "medicamentos" "text",
    "total_visitas" integer DEFAULT 0,
    "ultima_visita" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clientas_nivel_estres_check" CHECK (("nivel_estres" = ANY (ARRAY['bajo'::"text", 'medio'::"text", 'alto'::"text"])))
);


ALTER TABLE "public"."clientas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clienta_id" "uuid" NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"(),
    "es_borrador" boolean DEFAULT false,
    "tipo_cabello" "text",
    "porosidad" "text",
    "densidad" "text",
    "grosor_hebra" "text",
    "elasticidad" "text",
    "problemas" "text"[],
    "historial_quimicos" "text"[],
    "frecuencia_calor" "text",
    "frecuencia_lavado" "text",
    "estado_cuero_cabelludo" "text"[],
    "estado_puntas" "text",
    "nivel_dano" "text",
    "estado_transicion" "text",
    "balance_hp" "text",
    "necesidad_principal" "text",
    "tratamientos" "text"[],
    "cronograma" "jsonb",
    "tecnica_definicion" "text",
    "productos_recomendados" "jsonb",
    "recomendaciones_casa" "text"[],
    "resultado_esperado" "text"[],
    "foto_antes" "text",
    "foto_despues" "text",
    "foto_analisis" "text"[],
    "resultado_ia" "jsonb",
    "ia_confirmada" boolean,
    "capture_metadata" "jsonb",
    "observaciones_estilista" "text",
    "satisfaccion_clienta" integer,
    "proxima_cita" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ia_tipo_sugerido" "text",
    "ia_correccion" "text",
    CONSTRAINT "diagnosticos_densidad_check" CHECK (("densidad" = ANY (ARRAY['baja'::"text", 'media'::"text", 'alta'::"text"]))),
    CONSTRAINT "diagnosticos_elasticidad_check" CHECK (("elasticidad" = ANY (ARRAY['baja'::"text", 'media'::"text", 'alta'::"text"]))),
    CONSTRAINT "diagnosticos_grosor_hebra_check" CHECK (("grosor_hebra" = ANY (ARRAY['fino'::"text", 'medio'::"text", 'grueso'::"text"]))),
    CONSTRAINT "diagnosticos_porosidad_check" CHECK (("porosidad" = ANY (ARRAY['baja'::"text", 'media'::"text", 'alta'::"text"]))),
    CONSTRAINT "diagnosticos_satisfaccion_clienta_check" CHECK ((("satisfaccion_clienta" >= 1) AND ("satisfaccion_clienta" <= 5)))
);


ALTER TABLE "public"."consultas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos_activacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "evento" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eventos_activacion_evento_check" CHECK (("evento" = ANY (ARRAY['registro'::"text", 'onboarding_completado'::"text", 'primera_clienta'::"text", 'primer_diagnostico'::"text", 'pago'::"text"])))
);


ALTER TABLE "public"."eventos_activacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "provider" "text" DEFAULT 'bold'::"text" NOT NULL,
    "reference" "text" NOT NULL,
    "provider_payment_id" "text",
    "provider_link_id" "text",
    "checkout_url" "text",
    "plan" "text" NOT NULL,
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'COP'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metodo" "text",
    "raw_webhook" "jsonb",
    "paid_at" timestamp with time zone,
    "period_start" timestamp with time zone,
    "period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "payments_plan_check" CHECK (("plan" = ANY (ARRAY['basico'::"text", 'pro'::"text", 'pro_ia'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'voided'::"text", 'expired'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "apellido" "text",
    "nombre_salon" "text",
    "telefono" "text",
    "ciudad" "text",
    "color_primario" "text" DEFAULT '#2D5A27'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "permite_ubicacion" boolean DEFAULT false NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "checklist_descartada" boolean DEFAULT false NOT NULL,
    "primer_pdf_descargado" boolean DEFAULT false NOT NULL,
    "logo_url" "text",
    "servicios" "jsonb",
    "horario_atencion" "jsonb",
    "es_fundadora" boolean DEFAULT false NOT NULL,
    "legal_aceptado_at" timestamp with time zone,
    "legal_version" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "canal" "text" DEFAULT 'in_app'::"text" NOT NULL,
    "vence_ref" timestamp with time zone NOT NULL,
    "mensaje" "text" NOT NULL,
    "leida_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscription_notifications_canal_check" CHECK (("canal" = ANY (ARRAY['in_app'::"text", 'email'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "subscription_notifications_tipo_check" CHECK (("tipo" = ANY (ARRAY['vence_5d'::"text", 'vence_1d'::"text", 'gracia'::"text", 'vencida'::"text"])))
);


ALTER TABLE "public"."subscription_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan" "text",
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['basico'::"text", 'pro'::"text", 'pro_ia'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'past_due'::"text", 'expired'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientas"
    ADD CONSTRAINT "clientas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "diagnosticos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_activacion"
    ADD CONSTRAINT "eventos_activacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_activacion"
    ADD CONSTRAINT "eventos_activacion_user_evento_unique" UNIQUE ("user_id", "evento");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_provider_payment_id_key" UNIQUE ("provider_payment_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_notifications"
    ADD CONSTRAINT "subscription_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_notifications"
    ADD CONSTRAINT "subscription_notifications_user_id_tipo_canal_vence_ref_key" UNIQUE ("user_id", "tipo", "canal", "vence_ref");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_citas_fecha" ON "public"."citas" USING "btree" ("fecha");



CREATE INDEX "idx_citas_user" ON "public"."citas" USING "btree" ("user_id");



CREATE INDEX "idx_clientas_updated" ON "public"."clientas" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_clientas_user" ON "public"."clientas" USING "btree" ("user_id");



CREATE INDEX "idx_consultas_borrador" ON "public"."consultas" USING "btree" ("user_id") WHERE ("es_borrador" = true);



CREATE INDEX "idx_consultas_clienta" ON "public"."consultas" USING "btree" ("clienta_id");



CREATE INDEX "idx_consultas_fecha" ON "public"."consultas" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_consultas_ia_corregida" ON "public"."consultas" USING "btree" ("user_id") WHERE (("ia_tipo_sugerido" IS NOT NULL) AND ("tipo_cabello" IS NOT NULL) AND ("ia_tipo_sugerido" <> "tipo_cabello"));



CREATE INDEX "idx_consultas_proxima_cita" ON "public"."consultas" USING "btree" ("user_id", "proxima_cita") WHERE ("proxima_cita" IS NOT NULL);



CREATE INDEX "idx_consultas_user" ON "public"."consultas" USING "btree" ("user_id");



CREATE INDEX "idx_eventos_activacion_evento" ON "public"."eventos_activacion" USING "btree" ("evento");



CREATE INDEX "idx_payments_user_created" ON "public"."payments" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_subnotif_user" ON "public"."subscription_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "guard_suscripcion_citas" BEFORE INSERT ON "public"."citas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_escritura_guard"();



CREATE OR REPLACE TRIGGER "guard_suscripcion_clientas" BEFORE INSERT ON "public"."clientas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_clientas_guard"();



CREATE OR REPLACE TRIGGER "guard_suscripcion_consultas" BEFORE INSERT ON "public"."consultas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_escritura_guard"();



CREATE OR REPLACE TRIGGER "set_updated_at_clientas" BEFORE UPDATE ON "public"."clientas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_payments" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_subscriptions" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_clienta_id_fkey" FOREIGN KEY ("clienta_id") REFERENCES "public"."clientas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_diagnostico_id_fkey" FOREIGN KEY ("diagnostico_id") REFERENCES "public"."consultas"("id");



ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientas"
    ADD CONSTRAINT "clientas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "diagnosticos_clienta_id_fkey" FOREIGN KEY ("clienta_id") REFERENCES "public"."clientas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "diagnosticos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eventos_activacion"
    ADD CONSTRAINT "eventos_activacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_notifications"
    ADD CONSTRAINT "subscription_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own citas" ON "public"."citas" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own clientas" ON "public"."clientas" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own diagnosticos" ON "public"."consultas" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own citas" ON "public"."citas" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own clientas" ON "public"."clientas" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own diagnosticos" ON "public"."consultas" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own citas" ON "public"."citas" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own clientas" ON "public"."clientas" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own diagnosticos" ON "public"."consultas" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own citas" ON "public"."citas" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own clientas" ON "public"."clientas" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own diagnosticos" ON "public"."consultas" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."citas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consultas_delete_own" ON "public"."consultas" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "consultas_insert_own" ON "public"."consultas" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "consultas_select_own" ON "public"."consultas" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "consultas_update_own" ON "public"."consultas" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."eventos_activacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eventos_activacion_insert_own" ON "public"."eventos_activacion" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "eventos_activacion_select_own" ON "public"."eventos_activacion" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select_own" ON "public"."payments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subnotif_select_own" ON "public"."subscription_notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "subnotif_update_own" ON "public"."subscription_notifications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."subscription_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_select_own" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."funnel_activacion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."funnel_activacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."funnel_activacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."funnel_activacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."procesar_evento_pago"("p_tipo" "text", "p_reference" "text", "p_provider_payment_id" "text", "p_amount" integer, "p_metodo" "text", "p_raw" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."procesar_evento_pago"("p_tipo" "text", "p_reference" "text", "p_provider_payment_id" "text", "p_amount" integer, "p_metodo" "text", "p_raw" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."suscripcion_efectiva"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."suscripcion_efectiva"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suscripcion_efectiva"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_clientas_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_clientas_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_escritura_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_escritura_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verificar_escritura_tenant"("p_user_id" "uuid", "p_es_clienta_nueva" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verificar_escritura_tenant"("p_user_id" "uuid", "p_es_clienta_nueva" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."citas" TO "anon";
GRANT ALL ON TABLE "public"."citas" TO "authenticated";
GRANT ALL ON TABLE "public"."citas" TO "service_role";



GRANT ALL ON TABLE "public"."clientas" TO "anon";
GRANT ALL ON TABLE "public"."clientas" TO "authenticated";
GRANT ALL ON TABLE "public"."clientas" TO "service_role";



GRANT ALL ON TABLE "public"."consultas" TO "anon";
GRANT ALL ON TABLE "public"."consultas" TO "authenticated";
GRANT ALL ON TABLE "public"."consultas" TO "service_role";



GRANT ALL ON TABLE "public"."eventos_activacion" TO "anon";
GRANT ALL ON TABLE "public"."eventos_activacion" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos_activacion" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_notifications" TO "anon";
GRANT ALL ON TABLE "public"."subscription_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- =============================================================================
-- MANUALLY APPENDED — cross-schema items not captured by `dump --schema public`
-- =============================================================================
-- Estos objetos viven en otros schemas (auth, storage) pero son requeridos
-- para que la app funcione en una DB nueva. Cuando link de la CLI esté
-- disponible, considerar regenerar con --schema 'public,auth,storage' o
-- mantener este bloque como apéndice manual.

-- Trigger que dispara handle_new_user() al crear usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage: bucket privado "fotos" + policies (paths shape: {auth.uid}/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fotos_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "fotos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "fotos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "fotos_delete_own" ON storage.objects;

CREATE POLICY "fotos_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fotos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fotos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fotos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );






