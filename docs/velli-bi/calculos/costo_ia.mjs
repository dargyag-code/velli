// ══════════════════════════════════════════════════════════════════════════
// Costo de la IA del diagnóstico (Velli BI · Etapa 2). Aritmética pura sobre
// los tokens medidos con count_tokens (conteo_tokens.txt) — sin red ni
// secretos. Cambia PRECIOS o TRM y vuelve a correr:
//   node docs/velli-bi/calculos/costo_ia.mjs
// ══════════════════════════════════════════════════════════════════════════

// USD por millón de tokens.
const PRECIOS = {
  // Anthropic, página oficial de precios (consultada 2026-10-19).
  sonnet46: { entrada: 3.0, salida: 15.0 },
  // OpenAI, agregadores (ago-2026); OpenAI no lo publica en deprecaciones.
  gpt4o: { entrada: 2.5, salida: 10.0 },
};

// COP por USD. TRM 16-oct-2026 (Portafolio) y un valor conservador que
// cubre el margen cambiario de la tarjeta y algo de devaluación.
const TRM = { observada: 3170.46, conservadora: 3400 };

// Tokens medidos con count_tokens en claude-sonnet-4-6 (ver conteo_tokens.txt).
const MEDIDO = {
  analisis3: 4361,          // 3 fotos 720x1280 + prompts publicados
  validacion3: 3923,        // 3 fotos 720x1280 + prompt de validación
  analisis5Grande: 8624,    // 5 fotos de galería 3000x4000 (tope de 1579 c/u)
  validacion5Grande: 8175,
  salidaAnalisis: 110,      // JSON típico del análisis
  salidaValidacion3: 81,
  salidaValidacion5: 125,
};

// GPT-4o (respaldo): estimación con el método de tiles de OpenAI, no medida.
// 3000x4000 → 1536x2048 → 768x1024 → 2x2 tiles → 4·170 + 85 = 765 por foto.
const GPT4O_ANALISIS_5_GRANDE = { entrada: 5 * 765 + 600, salida: 300 };

const usd = (p, entrada, salida) => (entrada * p.entrada + salida * p.salida) / 1e6;
const s = PRECIOS.sonnet46;

const llamadas = {
  validacion3: usd(s, MEDIDO.validacion3, MEDIDO.salidaValidacion3),
  analisis3: usd(s, MEDIDO.analisis3, MEDIDO.salidaAnalisis),
  // Ronda pesada: 5 fotos grandes y salidas largas (no el máximo teórico).
  validacion5Grande: usd(s, MEDIDO.validacion5Grande, MEDIDO.salidaValidacion5),
  analisis5GrandeLargo: usd(s, MEDIDO.analisis5Grande, 300),
  // Techo teórico de una ronda: max_tokens agotado en las dos llamadas.
  validacion5GrandeMax: usd(s, MEDIDO.validacion5Grande, 400),
  analisis5GrandeMax: usd(s, MEDIDO.analisis5Grande, 1500),
  respaldoGpt4o: usd(PRECIOS.gpt4o, GPT4O_ANALISIS_5_GRANDE.entrada, GPT4O_ANALISIS_5_GRANDE.salida),
};

const escenarios = {
  'A · típico observado (validación + análisis, 3 fotos)': llamadas.validacion3 + llamadas.analisis3,
  'B · sin validación (calidad ≥ 80, 3 fotos)': llamadas.analisis3,
  'C · alto realista (2 rondas de 5 fotos grandes + 1 respaldo GPT-4o)':
    2 * (llamadas.validacion5Grande + llamadas.analisis5GrandeLargo) + llamadas.respaldoGpt4o,
  'D · techo de UNA ronda (5 grandes, max_tokens agotado, + respaldo)':
    llamadas.validacion5GrandeMax + llamadas.analisis5GrandeMax + llamadas.respaldoGpt4o,
};

const cop = (v, trm) => Math.round(v * trm);
const fmt = (n) => n.toLocaleString('es-CO');

console.log('Costo por llamada (USD):');
for (const [k, v] of Object.entries(llamadas)) console.log(`  ${k}: ${v.toFixed(5)}`);

console.log('\nCosto por diagnóstico:');
for (const [k, v] of Object.entries(escenarios)) {
  console.log(`  ${k}: USD ${v.toFixed(4)} · COP ${fmt(cop(v, TRM.observada))} (TRM) · ${fmt(cop(v, TRM.conservadora))} (conservadora)`);
}

console.log('\nCosto mensual por salón (COP, TRM conservadora):');
for (const n of [50, 150, 300]) {
  const fila = Object.entries(escenarios)
    .filter(([k]) => !k.startsWith('D'))
    .map(([k, v]) => `${k.slice(0, 1)}=${fmt(cop(v * n, TRM.conservadora))}`)
    .join(' · ');
  console.log(`  ${n} diagnósticos: ${fila}`);
}

const PRECIO_PRO_IA = 120_000;
const DIFERENCIA_PRO = 60_000;
console.log('\nTope propuesto (Pro+IA, COP con TRM conservadora):');
for (const tope of [100, 150, 200]) {
  const tipico = cop(escenarios['A · típico observado (validación + análisis, 3 fotos)'] * tope, TRM.conservadora);
  const pesado = cop((llamadas.validacion5Grande + llamadas.analisis5GrandeLargo) * tope, TRM.conservadora);
  const techo = cop(escenarios['D · techo de UNA ronda (5 grandes, max_tokens agotado, + respaldo)'] * tope, TRM.conservadora);
  console.log(
    `  ${tope}/mes → típico ${fmt(tipico)} (${((tipico / PRECIO_PRO_IA) * 100).toFixed(1)} % del plan, ${((tipico / DIFERENCIA_PRO) * 100).toFixed(1)} % del extra sobre Pro)` +
    ` · ronda pesada ${fmt(pesado)} (${((pesado / PRECIO_PRO_IA) * 100).toFixed(1)} %)` +
    ` · techo ${fmt(techo)} (${((techo / PRECIO_PRO_IA) * 100).toFixed(1)} %)`
  );
}
const PRUEBA = 20;
console.log(`\nPrueba gratis con ${PRUEBA} análisis: típico COP ${fmt(cop(escenarios['A · típico observado (validación + análisis, 3 fotos)'] * PRUEBA, TRM.conservadora))} · techo COP ${fmt(cop(escenarios['D · techo de UNA ronda (5 grandes, max_tokens agotado, + respaldo)'] * PRUEBA, TRM.conservadora))}`);
