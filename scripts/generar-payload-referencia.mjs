// ══════════════════════════════════════════════════════════════════════════
// Emite los payloads de los seeds de REFERENCIA para kb_reglas y
// kb_dimensiones (colorimetría Fase 3 + cortes Entrega 5).
//
//   node scripts/generar-payload-referencia.mjs <directorio-salida>
//
// Usa la API programática de Vite para cargar los .ts con resolución de
// alias, porque estos seeds importan VALORES (a diferencia de los seeds
// originales, que solo usan `import type` y por eso los carga Node directo).
//
// El script NO escribe en la base: solo emite JSON para inspeccionarlo. La
// carga es una operación aparte y explícita.
// ══════════════════════════════════════════════════════════════════════════

import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = process.argv[2];
if (!salida) {
  console.error('Uso: node scripts/generar-payload-referencia.mjs <directorio-salida>');
  process.exit(1);
}

const server = await createServer({
  root: raiz,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
  resolve: { alias: { '@': raiz } },
});

const { REGLAS_COLORIMETRIA } = await server.ssrLoadModule('/lib/kb/seed/colorimetria.ts');
const { REGLAS_CORTES, DIMENSIONES_CORTES } = await server.ssrLoadModule('/lib/kb/seed/cortes.ts');
await server.close();

// ── Mapeo a filas de la DB ──────────────────────────────────────────────

const reglaAFila = (r) => ({
  clave: r.clave,
  locale: r.locale ?? 'es',
  segmento: r.segmento,
  prioridad: r.prioridad,
  condiciones: r.condiciones ?? null,
  salida: r.salida,
  es_bandera_medica: r.esBanderaMedica ?? false,
  estado: r.estado ?? 'borrador',
  notas_internas: r.notasInternas ?? null,
});

const dimensionAFila = (d) => ({
  clave: d.clave,
  locale: d.locale ?? 'es',
  etiqueta: d.etiqueta,
  descripcion: d.descripcion ?? null,
  tipo: d.tipo,
  opciones: d.opciones ?? null,
  bandera_medica: d.banderaMedica ?? false,
  estado: d.estado ?? 'borrador',
});

const reglas = [...REGLAS_COLORIMETRIA, ...REGLAS_CORTES].map(reglaAFila);
const dimensiones = DIMENSIONES_CORTES.map(dimensionAFila);

// ── Verificaciones defensivas ───────────────────────────────────────────
// Nada sale de aquí publicado, ni con un segmento que el evaluador consuma.

const SEGMENTOS_REFERENCIA = ['referencia_color', 'referencia_corte'];

const noBorrador = [...reglas, ...dimensiones].filter((x) => x.estado !== 'borrador');
if (noBorrador.length) {
  console.error(`ABORTADO: ${noBorrador.length} fila(s) no están en borrador: ` +
    noBorrador.map((x) => x.clave).join(', '));
  process.exit(1);
}

const segmentoIndebido = reglas.filter((r) => !SEGMENTOS_REFERENCIA.includes(r.segmento));
if (segmentoIndebido.length) {
  console.error(
    `ABORTADO: ${segmentoIndebido.length} regla(s) con segmento que el evaluador SÍ consume ` +
    `(publicarlas contaminaría el diagnóstico): ` +
    segmentoIndebido.map((r) => `${r.clave}[${r.segmento}]`).join(', ')
  );
  process.exit(1);
}

const claves = reglas.map((r) => `${r.clave}|${r.locale}`);
const duplicadas = claves.filter((c, i) => claves.indexOf(c) !== i);
if (duplicadas.length) {
  console.error(`ABORTADO: claves duplicadas: ${[...new Set(duplicadas)].join(', ')}`);
  process.exit(1);
}

writeFileSync(path.join(salida, 'reglas-referencia.json'), JSON.stringify(reglas, null, 2), 'utf8');
writeFileSync(path.join(salida, 'dimensiones-cortes.json'), JSON.stringify(dimensiones, null, 2), 'utf8');

console.log(`reglas: ${reglas.length} (color: ${REGLAS_COLORIMETRIA.length}, corte: ${REGLAS_CORTES.length})`);
console.log(`dimensiones: ${dimensiones.length}`);
console.log(`segmentos: ${[...new Set(reglas.map((r) => r.segmento))].join(', ')}`);
console.log(`estados: ${[...new Set([...reglas, ...dimensiones].map((x) => x.estado))].join(', ')}`);
