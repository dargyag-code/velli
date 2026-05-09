import { EstadoCabelloFoto, AnguloCaptura } from '@/lib/types';
import { PROMPT_ANALISIS, CONTEXTO_ESTADO, HairAnalysisResult } from '@/lib/hairAnalysis';
import { requireUser } from '@/lib/api/auth';
import { analyzeLimiter, checkRateLimit } from '@/lib/api/rateLimit';

// ── Límites de payload ────────────────────────────────────────────────────
// 1.6M chars en base64 ≈ 1.2MB de binario. 5 fotos máx por request.
const MAX_FOTOS = 5;
const MAX_FOTO_CHARS = 1_600_000;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT =
  'Eres un experto en análisis de texturas capilares. Responde SOLO con el objeto JSON solicitado. No uses backticks, no uses bloques de código markdown, no agregues texto antes ni después del JSON.';

interface AnalyzeContext {
  estadoCabello: EstadoCabelloFoto;
  angulos: AnguloCaptura[];
}

// ── Utilidades de parseo compartidas ──────────────────────────────────────

function extractJSON(rawText: string): unknown {
  const cleanText = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const match = cleanText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('La IA no devolvió un JSON válido');
  return JSON.parse(match[0]);
}

function buildUserPrompt(context: AnalyzeContext): string {
  const contexto = CONTEXTO_ESTADO[context.estadoCabello] ?? '';
  return `CONTEXTO DE CAPTURA:\n${contexto}\n\n${PROMPT_ANALISIS}`;
}

// dataURL "data:image/webp;base64,XXXX" → { mediaType, data }
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mediaType: m[1], data: m[2] };
  // Sin prefijo: asumimos webp (formato preferido del capturador)
  return { mediaType: 'image/webp', data: dataUrl };
}

// ── Anthropic Claude ──────────────────────────────────────────────────────

async function analyzeWithClaude(
  fotos: string[],
  context: AnalyzeContext
): Promise<HairAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

  const content: unknown[] = [];
  fotos.forEach((foto, index) => {
    const { mediaType, data } = parseDataUrl(foto);
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data },
    });
    content.push({
      type: 'text',
      text: `[Foto ${index + 1}: ángulo ${context.angulos[index] ?? 'desconocido'}]`,
    });
  });
  content.push({ type: 'text', text: buildUserPrompt(context) });

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic respondió ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const rawText: string = json?.content?.[0]?.text ?? '';
  return extractJSON(rawText) as HairAnalysisResult;
}

// ── OpenAI GPT-4o ─────────────────────────────────────────────────────────

async function analyzeWithOpenAI(
  fotos: string[],
  context: AnalyzeContext
): Promise<HairAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const content: unknown[] = [];
  fotos.forEach((foto, index) => {
    const dataUrl = foto.startsWith('data:') ? foto : `data:image/webp;base64,${foto}`;
    content.push({ type: 'image_url', image_url: { url: dataUrl } });
    content.push({
      type: 'text',
      text: `[Foto ${index + 1}: ángulo ${context.angulos[index] ?? 'desconocido'}]`,
    });
  });
  content.push({ type: 'text', text: buildUserPrompt(context) });

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI respondió ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const rawText: string = json?.choices?.[0]?.message?.content ?? '';
  return extractJSON(rawText) as HairAnalysisResult;
}

// ── Orquestador con fallback ──────────────────────────────────────────────

async function analyzeHair(
  fotos: string[],
  context: AnalyzeContext
): Promise<HairAnalysisResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[analyze-hair] Using Claude');
      return await analyzeWithClaude(fotos, context);
    } catch (error) {
      console.error('[analyze-hair] Claude failed, falling back to OpenAI:', error);
    }
  }
  console.log('[analyze-hair] Using OpenAI');
  return await analyzeWithOpenAI(fotos, context);
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth
  const auth = await requireUser();
  if (auth.response) return auth.response;

  // 2. Rate limit (20/h por user)
  const rl = await checkRateLimit(analyzeLimiter(), auth.user.id);
  if (!rl.ok) {
    const retryAfter = Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000));
    return Response.json(
      { error: 'rate_limited', reset: rl.reset },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Ningún proveedor de IA configurado en el servidor (ANTHROPIC_API_KEY o OPENAI_API_KEY)' },
      { status: 500 }
    );
  }

  // 3. Parseo y validación de payload
  let body: { fotos: string[]; estadoCabello: EstadoCabelloFoto; angulos: AnguloCaptura[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { fotos, estadoCabello, angulos } = body;
  if (!Array.isArray(fotos) || fotos.length < 1 || fotos.length > MAX_FOTOS) {
    return Response.json(
      { error: `fotos debe ser un array de 1 a ${MAX_FOTOS} elementos` },
      { status: 400 }
    );
  }
  if (!estadoCabello || !angulos?.length) {
    return Response.json(
      { error: 'Faltan campos requeridos: estadoCabello, angulos' },
      { status: 400 }
    );
  }

  // 4. Tamaño individual de cada foto
  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i];
    if (typeof foto !== 'string') {
      return Response.json(
        { error: `fotos[${i}] no es una cadena válida` },
        { status: 400 }
      );
    }
    if (foto.length > MAX_FOTO_CHARS) {
      return Response.json(
        { error: `fotos[${i}] excede el tamaño máximo permitido (≈1.2MB)` },
        { status: 413 }
      );
    }
  }

  try {
    const result = await analyzeHair(fotos, { estadoCabello, angulos });
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al analizar el cabello';
    return Response.json({ error: msg }, { status: 502 });
  }
}
