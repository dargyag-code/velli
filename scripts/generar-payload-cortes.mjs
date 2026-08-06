// ══════════════════════════════════════════════════════════════════════════
// Emite el payload JSON de las 16 fichas para cargarlas en kb_cortes.
//
//   node scripts/generar-payload-cortes.mjs > /ruta/payload.json
//
// Requiere Node >= 23 (type stripping nativo). Por eso lib/kb/seed/*.ts y
// lib/cortes/*.ts usan rutas relativas y `import type` donde corresponde.
//
// El script NO escribe en la base: solo emite el payload para inspeccionarlo
// antes de cargarlo. La carga es una operación aparte y explícita.
// ══════════════════════════════════════════════════════════════════════════

// Se importan los módulos HOJA (solo importan tipos, así que el type
// stripping de Node los resuelve). lib/kb/seed/cortes.ts no sirve aquí
// porque importa valores, que Node sí intentaría resolver.
const { FICHAS_CORTE } = await import(
  new URL('../lib/cortes/fichas.ts', import.meta.url)
);
const { fichaAFila } = await import(
  new URL('../lib/cortes/serializacion.ts', import.meta.url)
);

const FILAS_CORTES = FICHAS_CORTE.map(fichaAFila);

// Verificación defensiva: nada sale de aquí en un estado que no sea borrador.
const noBorrador = FILAS_CORTES.filter((f) => f.estado !== 'borrador');
if (noBorrador.length > 0) {
  console.error(
    `ABORTADO: ${noBorrador.length} ficha(s) no están en borrador: ` +
      noBorrador.map((f) => f.clave).join(', ')
  );
  process.exit(1);
}

if (FILAS_CORTES.length !== 16) {
  console.error(`ABORTADO: se esperaban 16 fichas y hay ${FILAS_CORTES.length}.`);
  process.exit(1);
}

process.stdout.write(JSON.stringify(FILAS_CORTES, null, 2));
