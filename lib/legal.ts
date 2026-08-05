// ── Versionado de documentos legales ────────────────────────────────────────
// La versión vigente de Términos y Privacidad. Se envía en el metadata del
// signup y handle_new_user la persiste en profiles.legal_aceptado_at /
// legal_version — así cada cuenta registra QUÉ versión aceptó y CUÁNDO.
//
// Al publicar el texto definitivo de la abogada: actualizar esta constante
// (p. ej. '2026-07-01') y el contenido de app/legal/*. Las cuentas con
// versión anterior podrán re-aceptar en una iteración futura si se requiere.

export const LEGAL_VERSION = '2026-06-11-placeholder';

// ── Consentimientos digitales por clienta (validación Keila, sección 6.P3) ──
// Mismo patrón de versionado que LEGAL_VERSION, pero la firma es POR CLIENTA
// (no por cuenta): nombre completo tecleado + checkbox + timestamp + versión,
// guardados en public.consentimientos_clienta.
//
// IMPORTANTE: estas constantes tienen un espejo en la DB
// (public.legal_versiones, seed en supabase/migration-legal-gobernanza.sql).
// El trigger citas_guard_legal valida "vigente" contra esa tabla. Al publicar
// los textos definitivos de Keila: subir la versión aquí, actualizar el
// contenido en app/legal/* y correr:
// UPDATE public.legal_versiones SET version = '<nueva>' WHERE tipo = '<tipo>';
// tests/gobernanza.legal.test.ts vigila que ambos lados no se desincronicen.

export type TipoConsentimiento = 'consentimiento_quimico' | 'consentimiento_imagenes';

export const CONSENTIMIENTO_VERSIONES: Record<TipoConsentimiento, string> = {
  consentimiento_quimico: '2026-08-05-placeholder',
  consentimiento_imagenes: '2026-08-05-placeholder',
};
