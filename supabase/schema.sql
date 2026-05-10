


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



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', 'Estilista'));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

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
    "permite_ubicacion" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientas"
    ADD CONSTRAINT "clientas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "diagnosticos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



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



CREATE OR REPLACE TRIGGER "set_updated_at_clientas" BEFORE UPDATE ON "public"."clientas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



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



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."citas" TO "anon";
GRANT ALL ON TABLE "public"."citas" TO "authenticated";
GRANT ALL ON TABLE "public"."citas" TO "service_role";



GRANT ALL ON TABLE "public"."clientas" TO "anon";
GRANT ALL ON TABLE "public"."clientas" TO "authenticated";
GRANT ALL ON TABLE "public"."clientas" TO "service_role";



GRANT ALL ON TABLE "public"."consultas" TO "anon";
GRANT ALL ON TABLE "public"."consultas" TO "authenticated";
GRANT ALL ON TABLE "public"."consultas" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



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







