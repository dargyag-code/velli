// ── Links de WhatsApp (wa.me, sin API) ──────────────────────────────────────
// wa.me exige el número internacional, solo dígitos. Antes cada pantalla
// limpiaba los dígitos y nada más, así que un celular guardado como
// "300 123 4567" daba wa.me/3001234567, que no abre ningún chat (R7).
//
// Reglas, pensadas para salones en Colombia:
//   · 10 dígitos que empiezan por 3 (celular) o por 60 (fijo) → se antepone 57.
//   · Con indicativo 57 → el resto tiene que ser uno de esos números.
//   · Con + o 00 delante, o con 11 a 15 dígitos → número de otro país: se deja.
//   · Lo demás (p. ej. un fijo viejo de 7 dígitos) no es válido.

const INDICATIVO_COLOMBIA = '57';

function esNacionalColombia(digitos: string): boolean {
  return /^(3\d{9}|60\d{8})$/.test(digitos);
}

/** Número para wa.me (solo dígitos, con indicativo) o null si no es válido. */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const crudo = telefono.trim();
  let digitos = crudo.replace(/\D/g, '');
  const internacional = crudo.startsWith('+') || digitos.startsWith('00');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);

  if (esNacionalColombia(digitos)) return INDICATIVO_COLOMBIA + digitos;
  // Desde aquí solo sirve un número que ya trae su indicativo.
  if (!internacional && digitos.length < 11) return null;
  if (digitos.startsWith(INDICATIVO_COLOMBIA)) {
    return esNacionalColombia(digitos.slice(INDICATIVO_COLOMBIA.length)) ? digitos : null;
  }
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

/**
 * Link de WhatsApp al número dado, con el texto si lo hay. Si el número no es
 * válido pero hay texto, abre WhatsApp para elegir el contacto
 * (`wa.me/?text=…`); sin texto, devuelve null.
 */
export function enlaceWhatsApp(telefono: string | null | undefined, texto: string): string;
export function enlaceWhatsApp(telefono: string | null | undefined, texto?: string): string | null;
export function enlaceWhatsApp(telefono: string | null | undefined, texto?: string): string | null {
  const numero = numeroWhatsApp(telefono);
  const consulta = texto ? `?text=${encodeURIComponent(texto)}` : '';
  if (numero) return `https://wa.me/${numero}${consulta}`;
  return texto ? `https://wa.me/${consulta}` : null;
}
