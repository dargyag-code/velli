// ══════════════════════════════════════════════════════════════════════════
// Costo de la IA del diagnóstico (Velli BI · Etapa 2). Aritmética pura sobre
// los tokens medidos con count_tokens (conteo_tokens.txt) — sin red ni
// secretos. Cambia PRECIOS o TRM y vuelve a correr:
//   node docs/velli-bi/calculos/costo_ia.mjs
//
// 2026-10-22: sin respaldo GPT-4o (decisión D2), así que los casos altos ya
// no suman su costo. Se agrega E, el techo con la regla del tope (hasta 2
// validaciones por análisis). La versión anterior está en el historial de git.
// ══════════════════════════════════════════════════════════════════════════

// USD por millón de tokens.
const PRECIOS = {
  // Anthropic, página oficial de precios (consultada 2026-10-19).
  sonnet46: { entrada: 3.0, salida: 15.0 },
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
};

const A = 'A · típico observado (validación + análisis, 3 fotos)';
const D = 'D · techo de UNA ronda (5 grandes, max_tokens agotado)';
const E = 'E · techo con la regla del tope (2 validaciones + 1 análisis, al máximo)';
const escenarios = {
  [A]: llamadas.validacion3 + llamadas.analisis3,
  'B · sin validación (calidad ≥ 80, 3 fotos)': llamadas.analisis3,
  'C · alto realista (2 rondas de 5 fotos grandes)':
    2 * (llamadas.validacion5Grande + llamadas.analisis5GrandeLargo),
  [D]: llamadas.validacion5GrandeMax + llamadas.analisis5GrandeMax,
  [E]: 2 * llamadas.validacion5GrandeMax + llamadas.analisis5GrandeMax,
};
const rondaPesada = llamadas.validacion5Grande + llamadas.analisis5GrandeLargo;

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
    .filter(([k]) => 'ABC'.includes(k[0]))
    .map(([k, v]) => `${k.slice(0, 1)}=${fmt(cop(v * n, TRM.conservadora))}`)
    .join(' · ');
  console.log(`  ${n} diagnósticos: ${fila}`);
}

const PRECIO_PRO_IA = 120_000;
const DIFERENCIA_PRO = 60_000;
const pct = (v) => `${((v / PRECIO_PRO_IA) * 100).toFixed(1)} %`;
console.log('\nTope propuesto (Pro+IA, COP con TRM conservadora):');
for (const tope of [100, 150, 200]) {
  const tipico = cop(escenarios[A] * tope, TRM.conservadora);
  const pesado = cop(rondaPesada * tope, TRM.conservadora);
  const techo = cop(escenarios[D] * tope, TRM.conservadora);
  const techoRegla = cop(escenarios[E] * tope, TRM.conservadora);
  console.log(
    `  ${tope}/mes → típico ${fmt(tipico)} (${pct(tipico)} del plan, ${((tipico / DIFERENCIA_PRO) * 100).toFixed(1)} % del extra sobre Pro)` +
    ` · ronda pesada ${fmt(pesado)} (${pct(pesado)})` +
    ` · techo D ${fmt(techo)} (${pct(techo)})` +
    ` · techo E ${fmt(techoRegla)} (${pct(techoRegla)})`
  );
}

// D1: el tope más alto cuyo costo no pasa del 15 % del plan, según la lectura.
const LIMITE_D1 = 0.15 * PRECIO_PRO_IA;
console.log(`\nTope máximo con costo ≤ 15 % del plan (COP ${fmt(LIMITE_D1)}):`);
const lecturas = {
  'típico (A)': escenarios[A],
  'ronda pesada': rondaPesada,
  'techo de una ronda (D)': escenarios[D],
  'techo con la regla del tope (E)': escenarios[E],
};
for (const [k, v] of Object.entries(lecturas)) {
  const unidad = v * TRM.conservadora;
  const maximo = Math.floor(LIMITE_D1 / unidad);
  console.log(`  ${k}: ${maximo} análisis/mes (COP ${fmt(Math.round(unidad))} c/u → ${fmt(cop(v * maximo, TRM.conservadora))} al mes)`);
}

const PRUEBA = 20;
console.log(
  `\nPrueba gratis con ${PRUEBA} análisis: típico COP ${fmt(cop(escenarios[A] * PRUEBA, TRM.conservadora))}` +
  ` · techo D COP ${fmt(cop(escenarios[D] * PRUEBA, TRM.conservadora))}` +
  ` · techo E COP ${fmt(cop(escenarios[E] * PRUEBA, TRM.conservadora))}`
);
