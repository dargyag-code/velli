// Garantiza que las copias literales de los prompts en el seed de la KB
// (lib/kb/seed/contenido.ts) no driftean del código que hoy los usa como
// fallback (lib/hairAnalysis.ts). Si editas el prompt en un lado, este test
// te obliga a actualizar el otro — y a regenerar el SQL del seed.

import { describe, it, expect } from 'vitest';
import { PROMPT_ANALISIS, CONTEXTO_ESTADO } from '../lib/hairAnalysis';
import { SYSTEM_PROMPT_ANALISIS } from '../lib/kb/promptsServidor';
import { PROMPTS } from '../lib/kb/seed/contenido';

function contenido(clave: string): string | undefined {
  return PROMPTS.find((p) => p.clave === clave)?.contenido;
}

describe('seed de prompts sincronizado con el código fallback', () => {
  it('prompt principal de análisis', () => {
    expect(contenido('analisis_foto.principal')).toBe(PROMPT_ANALISIS);
  });

  it('system prompt de análisis', () => {
    expect(contenido('analisis_foto.sistema')).toBe(SYSTEM_PROMPT_ANALISIS);
  });

  it('contextos por estado del cabello', () => {
    expect(contenido('analisis_foto.contexto.seco_natural')).toBe(CONTEXTO_ESTADO.seco_natural);
    expect(contenido('analisis_foto.contexto.humedo')).toBe(CONTEXTO_ESTADO.humedo);
    expect(contenido('analisis_foto.contexto.con_producto')).toBe(CONTEXTO_ESTADO.con_producto);
    expect(contenido('analisis_foto.contexto.recien_lavado')).toBe(CONTEXTO_ESTADO.recien_lavado);
  });
});
