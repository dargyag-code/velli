-- ══════════════════════════════════════════════════════════════════════════
-- VELLI PRO — ESQUEMA SUPABASE (Fase 2)
-- Adaptado al modelo de datos existente (lib/types.ts).
-- Las consultas mantienen sus objetos embebidos como JSONB para no romper
-- el wizard, el motor de diagnóstico ni el generador de PDF.
-- Ejecutar este archivo completo en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Perfiles de estilista (extiende auth.users) ──────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  nombre_negocio TEXT,
  telefono TEXT,
  ciudad TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clientas ─────────────────────────────────────────────────────────────
-- Columnas planas alineadas con el tipo `Clienta` en lib/types.ts.
CREATE TABLE public.clientas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  nombre TEXT NOT NULL,
  edad INTEGER DEFAULT 0,
  telefono TEXT,
  email TEXT,
  fecha_registro TEXT NOT NULL,            -- ISO yyyy-mm-dd (mantiene formato actual)

  -- Datos de salud del perfil
  nivel_estres TEXT CHECK (nivel_estres IN ('bajo', 'medio', 'alto')),
  embarazo BOOLEAN,
  alergias TEXT,
  condiciones_medicas TEXT,
  medicamentos TEXT,

  tipo_rizo_principal TEXT,
  ultima_visita TEXT,
  total_visitas INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Consultas (diagnósticos) ─────────────────────────────────────────────
-- Un registro por consulta. Los bloques "resultado", "productos actuales" y
-- la metadata de captura se guardan como JSONB para preservar el shape del
-- wizard y del motor de diagnóstico sin necesidad de normalizar.
CREATE TABLE public.consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clienta_id UUID NOT NULL REFERENCES public.clientas(id) ON DELETE CASCADE,

  fecha TEXT NOT NULL,                      -- ISO yyyy-mm-dd
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

  -- Los campos de salud (alergias, condiciones_medicas, medicamentos,
  -- embarazo_lactancia, nivel_estres) viven SOLO en clientas — no se duplican
  -- como snapshot aquí. Si el motor los necesita, los lee de clientas.

  -- Resultado generado por el motor (ResultadoConsulta)
  resultado JSONB NOT NULL,

  -- Post-consulta
  satisfaccion TEXT CHECK (satisfaccion IN ('muy_satisfecha', 'satisfecha', 'parcial', 'necesita_ajustes')),
  satisfaccion_estrellas INTEGER CHECK (satisfaccion_estrellas BETWEEN 1 AND 5),
  notas_estilista TEXT,
  proxima_cita TEXT,                        -- ISO yyyy-mm-dd

  -- Fotos (URLs en Supabase Storage) y metadata de captura
  foto_antes TEXT,
  foto_despues TEXT,
  foto_analisis TEXT[],
  capture_metadata JSONB,

  es_borrador BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_clientas_user ON public.clientas(user_id);
CREATE INDEX idx_clientas_nombre ON public.clientas(user_id, nombre);
CREATE INDEX idx_clientas_ultima_visita ON public.clientas(user_id, ultima_visita DESC);

CREATE INDEX idx_consultas_user ON public.consultas(user_id);
CREATE INDEX idx_consultas_clienta ON public.consultas(clienta_id);
CREATE INDEX idx_consultas_fecha ON public.consultas(user_id, fecha DESC);
CREATE INDEX idx_consultas_proxima_cita ON public.consultas(user_id, proxima_cita)
  WHERE proxima_cita IS NOT NULL;
CREATE INDEX idx_consultas_borrador ON public.consultas(user_id)
  WHERE es_borrador = TRUE;

-- ══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — cada estilista solo ve sus propios datos
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "clientas_select_own" ON public.clientas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clientas_insert_own" ON public.clientas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientas_update_own" ON public.clientas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "clientas_delete_own" ON public.clientas
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "consultas_select_own" ON public.consultas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "consultas_insert_own" ON public.consultas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "consultas_update_own" ON public.consultas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "consultas_delete_own" ON public.consultas
  FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════
-- STORAGE — fotos de clientas (bucket privado por usuario)
-- ══════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fotos_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "fotos_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "fotos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "fotos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCIÓN: crear perfil automáticamente al registrar usuario
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, nombre_negocio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Estilista'),
    NEW.raw_user_meta_data->>'nombre_negocio'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCIÓN: mantener updated_at sincronizado
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_clientas_updated_at
  BEFORE UPDATE ON public.clientas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
