// ── Versionado de documentos legales ────────────────────────────────────────
// La versión vigente de Términos y Privacidad. Se envía en el metadata del
// signup y handle_new_user la persiste en profiles.legal_aceptado_at /
// legal_version — así cada cuenta registra QUÉ versión aceptó y CUÁNDO.
//
// Al publicar el texto definitivo de la abogada: actualizar esta constante
// (p. ej. '2026-07-01') y el contenido de app/legal/*. Las cuentas con
// versión anterior podrán re-aceptar en una iteración futura si se requiere.

export const LEGAL_VERSION = '2026-06-11-placeholder';
