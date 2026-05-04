-- ══════════════════════════════════════════════════════════════════════════
-- VELLI PRO — MIGRACIÓN: feedback de corrección manual sobre la IA
-- ══════════════════════════════════════════════════════════════════════════
-- Agrega dos columnas a public.consultas para capturar:
--   • ia_tipo_sugerido — tipo de cabello que la IA propuso (1A..4C)
--   • ia_correccion    — explicación opcional de la estilista de por qué
--                        la IA se equivocó. Insumo para reentrenar el modelo.
--
-- Idempotente: ejecutar en el SQL Editor de Supabase. Se puede correr
-- varias veces sin efecto adicional.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS ia_tipo_sugerido TEXT,
  ADD COLUMN IF NOT EXISTS ia_correccion TEXT;

-- Índice parcial: solo registros corregidos manualmente. Sirve para curar
-- ejemplos de entrenamiento sin escanear la tabla completa.
CREATE INDEX IF NOT EXISTS idx_consultas_ia_corregida
  ON public.consultas(user_id)
  WHERE ia_tipo_sugerido IS NOT NULL
    AND tipo_cabello IS NOT NULL
    AND ia_tipo_sugerido <> tipo_cabello;
