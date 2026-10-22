// ══════════════════════════════════════════════════════════════════════════
// Política lingüística del visagismo (validación técnica §5.1, PR-01).
//
// "Queda prohibido el uso de términos punitivos o de corrección. Las salidas
// de la app utilizarán exclusivamente los términos: Equilibrar, Destacar,
// Enmarcar, Celebrar."
//
// Nota: la Entrega 5 (PR-01) lista TRES verbos — equilibra, destaca,
// enmarca. La validación añade CELEBRAR ("mantener y potenciar los ángulos naturales
// si la clienta manifiesta que no desea suavizarlos"). Manda su versión.
//
// Ningún rostro tiene defectos: el visagismo es una caja de herramientas de
// proporción, no un tribunal. tests/cortes.test.ts verifica que ninguna
// salida de la matriz contenga un término vetado.
// ══════════════════════════════════════════════════════════════════════════

/** Los cuatro verbos permitidos para describir qué hace un corte. */
export const VERBOS_PERMITIDOS = ['equilibrar', 'destacar', 'enmarcar', 'celebrar'] as const;

export type VerboVisagismo = (typeof VERBOS_PERMITIDOS)[number];

export const GLOSARIO_VERBOS: Record<VerboVisagismo, string> = {
  equilibrar: 'Añadir masa o volumen visual donde la estructura del rostro lo requiere.',
  destacar: 'Exponer y dar protagonismo a facciones armónicas.',
  enmarcar: 'Delimitar los contornos del rostro con líneas suaves o flequillos.',
  celebrar: 'Mantener y potenciar los ángulos naturales del rostro.',
};

/**
 * Términos vetados en TODA salida visible: los punitivos, los que señalan
 * defectos y los que tratan una facción como algo a arreglar. La lista se
 * compara en minúsculas y sin acentos, por raíz de palabra.
 */
export const TERMINOS_VETADOS = [
  // Corrección explícita
  'corregir', 'corrige', 'correccion', 'corrector',
  'arreglar', 'arregla', 'compensar', 'compensa',
  // Defecto / juicio
  'defecto', 'imperfec', 'falla', 'problema',
  'feo', 'fea', 'afea', 'antiestetic',
  // Ocultar (trata la facción como algo a esconder)
  'disimul', 'ocultar', 'oculta', 'esconder', 'esconde', 'camufl',
  // Exceso / carencia como juicio
  'demasiado', 'demasiada', 'exagerad', 'desproporcion',
  // Reducción del rasgo
  'achicar', 'achica', 'adelgazar el rostro', 'reducir la frente',
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Devuelve los términos vetados encontrados en el texto (vacío = limpio). */
export function terminosVetadosEn(texto: string): string[] {
  const t = normalizar(texto);
  return TERMINOS_VETADOS.filter((v) => t.includes(normalizar(v)));
}

export function lenguajeEsValido(texto: string): boolean {
  return terminosVetadosEn(texto).length === 0;
}

/**
 * Verificación en profundidad de cualquier estructura de salida: recorre
 * todos los strings anidados. La usa el test sobre el resultado completo de
 * la matriz, no solo sobre los campos que recordemos revisar.
 */
export function auditarLenguaje(valor: unknown, ruta = '$'): { ruta: string; termino: string; texto: string }[] {
  const hallazgos: { ruta: string; termino: string; texto: string }[] = [];

  if (typeof valor === 'string') {
    for (const termino of terminosVetadosEn(valor)) {
      hallazgos.push({ ruta, termino, texto: valor });
    }
    return hallazgos;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => hallazgos.push(...auditarLenguaje(v, `${ruta}[${i}]`)));
    return hallazgos;
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      hallazgos.push(...auditarLenguaje(v, `${ruta}.${k}`));
    }
  }
  return hallazgos;
}
