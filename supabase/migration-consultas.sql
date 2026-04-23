-- ══════════════════════════════════════════════════════════════════════════
-- VELLI PRO — MIGRACIÓN IDEMPOTENTE: asegurar que existe public.consultas
-- ══════════════════════════════════════════════════════════════════════════
-- Este script es SEGURO de ejecutar múltiples veces. Maneja tres casos:
--   A) Ya existe public.consultas  → no hace nada destructivo (solo agrega
--      índices/policies faltantes con IF NOT EXISTS / DO blocks).
--   B) Existe public.diagnosticos  → la renombra a public.consultas,
--      renombra índices, constraints y policies para que queden consistentes.
--   C) No existe ninguna           → crea public.consultas desde cero.
--
-- Ejecutar en el SQL Editor de Supabase una sola vez después de pegar.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── PASO 0: Asegurar dependencia public.clientas ─────────────────────────
-- La tabla consultas tiene un FK a clientas. Si clientas no existe,
-- abortamos con un error claro para que el usuario corra schema.sql primero.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clientas'
  ) THEN
    RAISE EXCEPTION
      'La tabla public.clientas no existe. Ejecuta supabase/schema.sql primero.';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- CASO B: renombrar diagnosticos → consultas (si aplica)
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  has_old  BOOLEAN;
  has_new  BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'diagnosticos'
  ) INTO has_old;

  SELECT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'consultas'
  ) INTO has_new;

  IF has_old AND NOT has_new THEN
    RAISE NOTICE 'Renombrando public.diagnosticos → public.consultas';
    ALTER TABLE public.diagnosticos RENAME TO consultas;

    -- Renombrar índices que puedan existir con el prefijo viejo.
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_diagnosticos_user') THEN
      ALTER INDEX public.idx_diagnosticos_user RENAME TO idx_consultas_user;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_diagnosticos_clienta') THEN
      ALTER INDEX public.idx_diagnosticos_clienta RENAME TO idx_consultas_clienta;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_diagnosticos_fecha') THEN
      ALTER INDEX public.idx_diagnosticos_fecha RENAME TO idx_consultas_fecha;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_diagnosticos_proxima_cita') THEN
      ALTER INDEX public.idx_diagnosticos_proxima_cita RENAME TO idx_consultas_proxima_cita;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_diagnosticos_borrador') THEN
      ALTER INDEX public.idx_diagnosticos_borrador RENAME TO idx_consultas_borrador;
    END IF;

    -- Eliminar policies con el nombre viejo (se recrean más abajo).
    DROP POLICY IF EXISTS "diagnosticos_select_own" ON public.consultas;
    DROP POLICY IF EXISTS "diagnosticos_insert_own" ON public.consultas;
    DROP POLICY IF EXISTS "diagnosticos_update_own" ON public.consultas;
    DROP POLICY IF EXISTS "diagnosticos_delete_own" ON public.consultas;

    -- Si la FK se llamaba con prefijo viejo, renombrar columna "diagnostico_id"
    -- a "clienta_id" no aplica — la FK en esa tabla apunta a clientas y ya se
    -- llama clienta_id en el schema actual. Si tu versión antigua usaba otro
    -- nombre de columna, corrígelo manualmente.
  ELSIF has_old AND has_new THEN
    RAISE NOTICE
      'Existen AMBAS tablas (diagnosticos y consultas). Revísalo manualmente para evitar pérdida de datos.';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- CASO C: crear public.consultas si no existe
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id UUID NOT NULL REFERENCES public.clientas(id) ON DELETE CASCADE,

  fecha TEXT NOT NULL,
  numero_consulta INTEGER NOT NULL DEFAULT 1,

  -- Paso 1: historial
  quimicos TEXT[] NOT NULL DEFAULT '{}',
  ultimo_quimico TEXT,
  uso_calor TEXT[] NOT NULL DEFAULT '{}',
  frecuencia_calor TEXT,
  usa_protector_termico BOOLEAN NOT NULL DEFAULT FALSE,
  frecuencia_lavado TEXT,
  metodo_lavado TEXT,
  productos_actuales JSONB NOT NULL DEFAULT '{}'::jsonb,
  problemas TEXT[] NOT NULL DEFAULT '{}',
  otro_problema TEXT,

  -- Paso 2: tipo de rizo
  tipo_rizo_principal TEXT,
  tipos_secundarios TEXT[],
  zonas_cambio TEXT,

  -- Paso 3: diagnóstico técnico
  porosidad TEXT CHECK (porosidad IN ('baja', 'media', 'alta')),
  porosidad_obs TEXT,
  densidad TEXT CHECK (densidad IN ('baja', 'media', 'alta')),
  grosor TEXT CHECK (grosor IN ('fino', 'medio', 'grueso')),
  elasticidad TEXT CHECK (elasticidad IN ('baja', 'media', 'alta')),
  balance_hp TEXT CHECK (balance_hp IN ('hidratacion', 'nutricion', 'proteina', 'equilibrado')),

  -- Paso 4: cuero cabelludo y daño
  estado_cuero_cabelludo TEXT[] NOT NULL DEFAULT '{}',
  obs_cuero_cabelludo TEXT,
  estado_puntas TEXT,
  tipo_dano TEXT[] NOT NULL DEFAULT '{}',
  linea_demarcacion TEXT,

  -- Paso 5: snapshot de salud
  alergias TEXT,
  condiciones_medicas TEXT,
  medicamentos TEXT,
  embarazo BOOLEAN NOT NULL DEFAULT FALSE,
  nivel_estres TEXT NOT NULL DEFAULT '',

  -- Resultado generado por el motor
  resultado JSONB NOT NULL,

  -- Post-consulta
  satisfaccion TEXT CHECK (satisfaccion IN ('muy_satisfecha', 'satisfecha', 'parcial', 'necesita_ajustes')),
  satisfaccion_estrellas INTEGER CHECK (satisfaccion_estrellas BETWEEN 1 AND 5),
  notas_estilista TEXT,
  proxima_cita TEXT,

  -- Fotos (Supabase Storage) y metadata
  foto_antes TEXT,
  foto_despues TEXT,
  foto_analisis TEXT[],
  capture_metadata JSONB,

  es_borrador BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- ÍNDICES (idempotentes)
-- ══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_consultas_user    ON public.consultas(user_id);
CREATE INDEX IF NOT EXISTS idx_consultas_clienta ON public.consultas(clienta_id);
CREATE INDEX IF NOT EXISTS idx_consultas_fecha   ON public.consultas(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_proxima_cita
  ON public.consultas(user_id, proxima_cita) WHERE proxima_cita IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultas_borrador
  ON public.consultas(user_id) WHERE es_borrador = TRUE;

-- ══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultas_select_own" ON public.consultas;
DROP POLICY IF EXISTS "consultas_insert_own" ON public.consultas;
DROP POLICY IF EXISTS "consultas_update_own" ON public.consultas;
DROP POLICY IF EXISTS "consultas_delete_own" ON public.consultas;

CREATE POLICY "consultas_select_own" ON public.consultas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "consultas_insert_own" ON public.consultas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "consultas_update_own" ON public.consultas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "consultas_delete_own" ON public.consultas
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;

-- ── Verificación: lista las columnas finales de public.consultas ─────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'consultas'
ORDER BY ordinal_position;
