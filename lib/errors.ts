const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos',
  'Email not confirmed': 'Aún no has confirmado tu email. Revisa tu bandeja.',
  'User already registered': 'Ya existe una cuenta con este email',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Unable to validate email address: invalid format': 'El email no tiene un formato válido',
  'New password should be different from the old password': 'La nueva contraseña debe ser distinta',
  'Email rate limit exceeded': 'Demasiados intentos. Espera unos minutos antes de volver a intentar.',
};

// Códigos estables que lanzan los triggers de suscripción en la DB
// (supabase/migration-suscripciones.sql). El RAISE EXCEPTION llega como
// "CODIGO: detalle" dentro del message del error de supabase-js.
const SUBSCRIPTION_ERROR_MAP: Record<string, string> = {
  SUSCRIPCION_VENCIDA:
    'Tu plan venció. Renueva en Planes para seguir creando registros — tus datos siguen intactos.',
  LIMITE_CLIENTAS_BASICO:
    'Llegaste al límite de 50 clientas del plan Básico. Pasa a Pro para clientas ilimitadas.',
};

export function friendlyAuthError(rawMessage: string | undefined | null): string {
  if (!rawMessage) return 'Algo no salió bien, intenta de nuevo.';
  if (AUTH_ERROR_MAP[rawMessage]) return AUTH_ERROR_MAP[rawMessage];
  for (const [codigo, mensaje] of Object.entries(SUBSCRIPTION_ERROR_MAP)) {
    if (rawMessage.includes(codigo)) return mensaje;
  }
  const lower = rawMessage.toLowerCase();
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  }
  if (lower.includes('rate limit')) {
    return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  }
  return 'Algo no salió bien, intenta de nuevo.';
}

export function friendlyError(e: unknown): string {
  if (typeof e === 'string') return friendlyAuthError(e);
  if (e && typeof e === 'object' && 'message' in e) {
    return friendlyAuthError(String((e as { message: unknown }).message));
  }
  return 'Algo no salió bien, intenta de nuevo.';
}
