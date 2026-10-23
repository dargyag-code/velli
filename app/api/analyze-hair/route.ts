import * as Sentry from '@sentry/nextjs';
import { EstadoCabelloFoto, AnguloCaptura } from '@/lib/types';
import { HairAnalysisResult } from '@/lib/hairAnalysis';
import { componerPromptsAnalisis, PromptsAnalisis } from '@/lib/kb/promptsServidor';
import { requireUser } from '@/lib/api/auth';
import { analyzeLimiter, checkRateLimit } from '@/lib/api/rateLimit';
import { MODELO_CLAUDE_IA, registrarUsoIA, verificarCupoIA } from '@/lib/ia/uso';

// ── Límites de payload ────────────────────────────────────────────────────
// 1M chars en base64 ≈ 750KB de binario. 5 fotos × 1M ≈ 5MB JSON, justo por
// debajo del proxyClientMaxBodySize (5mb) — así el rechazo es 413 limpio en
// vez de un truncamiento del proxy + 400 de JSON parse.
const MAX_FOTOS = 5;
const MAX_FOTO_CHARS = 1_000_000;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Sin respaldo de otro proveedor (decisión D2, docs/velli-bi/01-costo-ia.md):
// si Claude falla, la estilista sigue con el diagnóstico manual. La cámara
// arma su propio aviso según el status (lib/hairAnalysis.ts); este texto
// cubre a las versiones de la app que muestran `error` tal cual.
const IA_NO_DISPONIBLE = 'La IA no está disponible en este momento. Sigue con el diagnóstico manual.';

interface AnalyzeContext {
  estadoCabello: EstadoCabelloFoto;
  angulos: AnguloCaptura[];
  // Prompts compuestos desde la knowledge base (kb_prompts publicados) con
  // fallback al contenido hardcodeado — ver lib/kb/promptsServidor.ts.
  prompts: PromptsAnalisis;
}

interface ClaudeAnalyzeResponse {
  result: HairAnalysisResult;
  tokensEntrada: number | null;
  tokensSalida: number | null;
}

// ── Utilidades de parseo ──────────────────────────────────────────────────

function extractJSON(rawText: string): unknown {
  const cleanText = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const match = cleanText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('La IA no devolvió un JSON válido');
  return JSON.parse(match[0]);
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
  context: AnalyzeContext,
  onUsage?: (tokensEntrada: number | null, tokensSalida: number | null) => void
): Promise<ClaudeAnalyzeResponse> {
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
  content.push({ type: 'text', text: context.prompts.usuario });

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELO_CLAUDE_IA,
      max_tokens: 1500,
      system: context.prompts.sistema,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic respondió ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const tokensEntrada =
    typeof json?.usage?.input_tokens === 'number' ? json.usage.input_tokens : null;
  const tokensSalida =
    typeof json?.usage?.output_tokens === 'number' ? json.usage.output_tokens : null;
  onUsage?.(tokensEntrada, tokensSalida);

  const rawText: string = json?.content?.[0]?.text ?? '';
  const result = extractJSON(rawText) as HairAnalysisResult;
  return { result, tokensEntrada, tokensSalida };
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

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[analyze-hair] ANTHROPIC_API_KEY no configurada');
    return Response.json({ error: IA_NO_DISPONIBLE }, { status: 500 });
  }

  // 3. Parseo y validación de payload
  let body: {
    fotos: string[];
    estadoCabello: EstadoCabelloFoto;
    angulos: AnguloCaptura[];
    // Opcional: tipo previamente estimado — habilita segmentos de prompt
    // específicos por tipo de cabello publicados en la knowledge base.
    tipoEstimado?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { fotos, estadoCabello, angulos, tipoEstimado } = body;
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

  // 5. Verificar cupo de IA por plan y tope mensual / prueba gratis (D1, P3)
  const cupo = await verificarCupoIA(auth.user.id, {
    supabase: auth.supabase,
    ruta: 'analizar',
  });
  if (!cupo.permitido) {
    const status = cupo.codigo === 'PLAN_SIN_IA' ? 403 : 429;
    return Response.json(
      {
        error: cupo.mensaje ?? IA_NO_DISPONIBLE,
        codigo: cupo.codigo ?? 'TOPE_IA_ALCANZADO',
        motivo: cupo.motivo,
        usados: cupo.usados,
        tope: cupo.tope,
        restantes: cupo.restantes,
      },
      { status }
    );
  }

  let ultimoTokensEntrada: number | null = null;
  let ultimoTokensSalida: number | null = null;

  try {
    // Prompt compuesto desde la knowledge base (sin redeploy al publicar);
    // fallback automático al contenido hardcodeado si la KB no responde.
    const prompts = await componerPromptsAnalisis(
      auth.supabase,
      estadoCabello,
      typeof tipoEstimado === 'string' ? tipoEstimado : undefined
    );
    const { result, tokensEntrada, tokensSalida } = await analyzeWithClaude(
      fotos,
      { estadoCabello, angulos, prompts },
      (tIn, tOut) => {
        ultimoTokensEntrada = tIn;
        ultimoTokensSalida = tOut;
      }
    );

    await registrarUsoIA({
      userId: auth.user.id,
      ruta: 'analizar',
      modelo: MODELO_CLAUDE_IA,
      fotos: fotos.length,
      tokensEntrada,
      tokensSalida,
      ok: true,
    });

    if (cupo.medido) {
      return Response.json({
        ...result,
        restantes: cupo.restantes,
        avisoOchentaPorCiento: cupo.avisoOchentaPorCiento,
      });
    }

    return Response.json(result);
  } catch (e: unknown) {
    await registrarUsoIA({
      userId: auth.user.id,
      ruta: 'analizar',
      modelo: MODELO_CLAUDE_IA,
      fotos: fotos.length,
      tokensEntrada: ultimoTokensEntrada,
      tokensSalida: ultimoTokensSalida,
      ok: false,
    });
    // El detalle del proveedor queda en el log y en Sentry, no en la pantalla.
    console.error('[analyze-hair] Claude falló:', e);
    Sentry.captureException(e, { tags: { area: 'ia', endpoint: 'analyze-hair' } });
    return Response.json({ error: IA_NO_DISPONIBLE }, { status: 502 });
  }
}
