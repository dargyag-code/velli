import { EstadoCabelloFoto, AnguloCaptura } from '@/lib/types';
import { PROMPT_ANALISIS, CONTEXTO_ESTADO, HairAnalysisResult } from '@/lib/hairAnalysis';

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
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Ningún proveedor de IA configurado en el servidor (ANTHROPIC_API_KEY o OPENAI_API_KEY)' },
      { status: 500 }
    );
  }

  let body: { fotos: string[]; estadoCabello: EstadoCabelloFoto; angulos: AnguloCaptura[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { fotos, estadoCabello, angulos } = body;
  if (!fotos?.length || !estadoCabello || !angulos?.length) {
    return Response.json(
      { error: 'Faltan campos requeridos: fotos, estadoCabello, angulos' },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeHair(fotos, { estadoCabello, angulos });
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al analizar el cabello';
    return Response.json({ error: msg }, { status: 502 });
  }
}
