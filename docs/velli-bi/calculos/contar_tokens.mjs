// Cuenta tokens de las peticiones REALES de Velli con count_tokens (gratis,
// no genera respuestas). Prompts: los publicados en producción (GET, solo
// lectura). Imágenes: sintéticas con las resoluciones reales. Nunca se
// envían fotos de clientas.
//
// Uso, fuera del repo (el SDK no es dependencia del proyecto):
//   1. copia este archivo y generar_imagenes.py a una carpeta temporal
//   2. mkdir img && python generar_imagenes.py "$(pwd)/img"
//   3. npm init -y && npm install @anthropic-ai/sdk
//   4. node contar_tokens.mjs <ruta del repo velli-pro>   (lee su .env.local)
// Salida guardada de la corrida del 2026-10-19: conteo_tokens.txt
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.argv[2];
const aqui = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#') && l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ── Prompts publicados en prod (lectura) ──────────────────────────────────
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/kb_prompts?select=clave,contenido,tipos_cabello&estado=eq.publicada&locale=eq.es`, { headers: H });
const filas = await r.json();
const porClave = new Map(filas.map((f) => [f.clave, f.contenido]));
const extras = filas.filter((f) => f.clave.startsWith('analisis_foto.extra'));
console.log('prompts publicados:', filas.map((f) => `${f.clave}(${f.contenido.length} car.)`).join(', '));
console.log('extras:', extras.length);

// Misma composición que lib/kb/promptsServidor.ts
function promptsAnalisis(estado) {
  const contexto = porClave.get(`analisis_foto.contexto.${estado}`);
  return {
    sistema: porClave.get('analisis_foto.sistema'),
    usuario: [`CONTEXTO DE CAPTURA:\n${contexto}`, porClave.get('analisis_foto.principal')].join('\n\n'),
  };
}

// Constantes de app/api/validate-hair-photo/route.ts, leídas del archivo.
const rutaVal = readFileSync(path.join(repo, 'app/api/validate-hair-photo/route.ts'), 'utf8');
const SYSTEM_VAL = rutaVal.match(/const SYSTEM_PROMPT =\s*\n?\s*'([^']+)';/)[1];
const USER_VAL = rutaVal.match(/const USER_PROMPT = `([\s\S]*?)`;/)[1];

const img = (nombre) => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/webp', data: readFileSync(path.join(aqui, 'img', nombre)).toString('base64') },
});

const ANGULOS = ['frontal', 'lateral', 'corona', 'frontal', 'lateral'];

function peticionAnalisis(n, archivo, estado = 'seco_natural') {
  const { sistema, usuario } = promptsAnalisis(estado);
  const content = [];
  for (let i = 0; i < n; i++) {
    content.push(img(archivo));
    content.push({ type: 'text', text: `[Foto ${i + 1}: ángulo ${ANGULOS[i]}]` });
  }
  content.push({ type: 'text', text: usuario });
  return { system: sistema, messages: [{ role: 'user', content }] };
}

function peticionValidacion(n, archivo) {
  const content = [];
  for (let i = 0; i < n; i++) {
    content.push(img(archivo));
    content.push({ type: 'text', text: `[Foto ${i}]` });
  }
  content.push({ type: 'text', text: USER_VAL.replace('{N}', String(n)) });
  return { system: SYSTEM_VAL, messages: [{ role: 'user', content }] };
}

// Salidas típicas (el JSON que pide cada prompt), para estimar tokens de salida.
const SALIDA_ANALISIS = JSON.stringify({
  tipoRizoPrincipal: '3B', tiposSecundarios: ['3A'],
  observaciones: 'Rizo espiral definido, porosidad alta, densidad media, puntas algo abiertas.',
  confianza: 'alta', porosidad: 'alta', densidad: 'media', danoVisible: 'leve',
}, null, 2);
const salidaValidacion = (n) => JSON.stringify({ perFoto: Array.from({ length: n }, (_, i) => ({ index: i, isHair: true })) }, null, 2);

async function contar(model, req) {
  const res = await client.messages.countTokens({ model, ...req });
  return res.input_tokens;
}

async function tokensTexto(model, texto) {
  // tokens del texto aislado: (mensaje con texto) − (mensaje mínimo)
  const con = await contar(model, { messages: [{ role: 'user', content: `x\n${texto}` }] });
  const sin = await contar(model, { messages: [{ role: 'user', content: 'x' }] });
  return con - sin;
}

for (const model of ['claude-sonnet-4-6', 'claude-sonnet-5-5']) {
  console.log(`\n=== ${model}`);
  const base1 = await contar(model, peticionAnalisis(1, 'sint_720x1280.webp'));
  const base2 = await contar(model, peticionAnalisis(2, 'sint_720x1280.webp'));
  console.log(`token por imagen 720x1280 (diferencia 2−1 fotos): ${base2 - base1}`);
  for (const archivo of ['sint_1280x720.webp', 'sint_1920x1080.webp', 'sint_3000x4000.webp']) {
    const a = await contar(model, peticionAnalisis(1, archivo));
    const b = await contar(model, peticionAnalisis(2, archivo));
    console.log(`token por imagen ${archivo}: ${b - a}`);
  }
  for (const n of [1, 3, 5]) {
    console.log(`análisis ${n} foto(s) 720x1280 · entrada: ${await contar(model, peticionAnalisis(n, 'sint_720x1280.webp'))}`);
  }
  for (const estado of ['humedo', 'con_producto', 'recien_lavado']) {
    console.log(`análisis 3 fotos estado=${estado} · entrada: ${await contar(model, peticionAnalisis(3, 'sint_720x1280.webp', estado))}`);
  }
  for (const n of [1, 3, 5]) {
    console.log(`validación ${n} foto(s) · entrada: ${await contar(model, peticionValidacion(n, 'sint_720x1280.webp'))}`);
  }
  console.log(`análisis 5 fotos 3000x4000 (caso galería grande) · entrada: ${await contar(model, peticionAnalisis(5, 'sint_3000x4000.webp'))}`);
  console.log(`validación 5 fotos 3000x4000 · entrada: ${await contar(model, peticionValidacion(5, 'sint_3000x4000.webp'))}`);
  console.log(`salida típica análisis (JSON): ~${await tokensTexto(model, SALIDA_ANALISIS)} tokens`);
  console.log(`salida típica validación 3 fotos: ~${await tokensTexto(model, salidaValidacion(3))} tokens`);
  console.log(`salida típica validación 5 fotos: ~${await tokensTexto(model, salidaValidacion(5))} tokens`);
}
