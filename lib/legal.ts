// ── Versionado de documentos legales ────────────────────────────────────────
// La versión vigente de Términos y Privacidad. Se envía en el metadata del
// signup y handle_new_user la persiste en profiles.legal_aceptado_at /
// legal_version — así cada cuenta registra QUÉ versión aceptó y CUÁNDO.
//
// Cada cambio de contenido en app/legal/* sube esta constante (p. ej.
// '2026-07-01'); al publicar la versión definitiva se quita "-placeholder".
// Las cuentas con versión anterior podrán re-aceptar en una iteración futura
// si se requiere.
//
// 2026-10-22: la IA pasa a ser solo Anthropic (sin OpenAI) y los Términos
// dicen que Velli estima y que el profesional del salón responde por el
// diagnóstico presencial, las pruebas y la aplicación química.

export const LEGAL_VERSION = '2026-10-22-placeholder';

// ── Consentimientos digitales por clienta (validación técnica, sección 6.P3) ──
// Mismo patrón de versionado que LEGAL_VERSION, pero la firma es POR CLIENTA
// (no por cuenta): nombre completo tecleado + checkbox + timestamp + versión,
// guardados en public.consentimientos_clienta.
//
// IMPORTANTE: estas constantes tienen un espejo en la DB
// (public.legal_versiones, seed en supabase/migration-legal-gobernanza.sql).
// El trigger citas_guard_legal valida "vigente" contra esa tabla. Al publicar
// los textos definitivos: subir la versión aquí, actualizar el contenido en
// app/legal/* y correr:
// UPDATE public.legal_versiones SET version = '<nueva>' WHERE tipo = '<tipo>';
// tests/gobernanza.legal.test.ts vigila que ambos lados no se desincronicen.

export type TipoConsentimiento = 'consentimiento_quimico' | 'consentimiento_imagenes';

export const CONSENTIMIENTO_VERSIONES: Record<TipoConsentimiento, string> = {
  consentimiento_quimico: '2026-08-05-placeholder',
  consentimiento_imagenes: '2026-08-05-placeholder',
};
