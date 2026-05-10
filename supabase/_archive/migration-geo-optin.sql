-- ARCHIVED: los efectos de esta migración ya están en supabase/schema.sql.
-- No ejecutar en una DB nueva. Conservado solo como registro histórico.

-- ══════════════════════════════════════════════════════════════════════════
-- VELLI PRO — MIGRACIÓN: opt-in para captura de ubicación aproximada
-- ══════════════════════════════════════════════════════════════════════════
-- Agrega `permite_ubicacion` a profiles. Default `false` — la geolocalización
-- queda OFF para todas las estilistas hasta que la activen explícitamente
-- desde /configuracion. Antes de esta migración, la app capturaba lat/lon
-- automáticamente al sacar fotos del wizard, sin aviso.
--
-- Idempotente: ejecutar en el SQL Editor de Supabase. Se puede correr varias
-- veces sin efecto adicional.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permite_ubicacion BOOLEAN NOT NULL DEFAULT false;
