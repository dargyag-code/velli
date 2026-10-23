// BUG-2: segunda capa de validación con Claude (visión).
// Verifica que las fotos REALMENTE muestran cabello humano (no rostro
// completo, no pared, no objetos). Se llama desde el cliente sólo cuando
// el score de calidad es < 80 o las fotos vienen de la galería, para no
// agregar coste innecesario.
// Sin respaldo de otro proveedor (decisión D2, docs/velli-bi/01-costo-ia.md):
// si Claude falla, el cliente sigue sin validación (lib/captureQuality.ts).

import * as Sentry from '@sentry/nextjs';
import { requireUser } from '@/lib/api/auth';
import { validateLimiter, checkRateLimit } from '@/lib/api/rateLimit';
import { MODELO_CLAUDE_IA, registrarUsoIA, verificarCupoIA } from '@/lib/ia/uso';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const VALIDACION_NO_DISPONIBLE = 'La validación con IA no está disponible en este momento.';

// ── Límites de payload ────────────────────────────────────────────────────
// 1M chars en base64 ≈ 750KB de binario. 5 fotos × 1M ≈ 5MB JSON, justo por
// debajo del proxyClientMaxBodySize (5mb) — así el rechazo es 413 limpio en
// vez de un truncamiento del proxy + 400 de JSON parse.
const MAX_FOTOS = 5;
const MAX_FOTO_CHARS = 1_000_000;

const SYSTEM_PROMPT =
  'Eres un validador estricto de fotos para diagnóstico capilar. Responde SOLO con un JSON válido sin texto adicional, sin markdown, sin backticks.';

const USER_PROMPT = `Te muestro {N} foto(s) numeradas. Para cada una, decide:
¿El cabello humano ocupa MÁS DEL 40% del frame y es visible con suficiente claridad como para analizar su tipo, porosidad y daño?

Responde ÚNICAMENTE con este JSON exacto:
{
  "perFoto": [
    { "index": 0, "isHair": true|false },
    { "index": 1, "isHair": true|false },
    ...
  ]
}

Reglas:
- "isHair": true sólo si el cabello es claramente el sujeto principal y ocupa >40% del área visible.
- "isHair": false si la foto es de un rostro de cerca sin mostrar cabello, una pared, ropa, otros objetos, o si el cabello es difícil de evaluar (muy lejos, muy borroso, oclusiones graves).
- Devuelve un objeto por cada foto en orden, mismo length que las fotos enviadas.`;

interface ValidationItem {
  index: number;
  isHair: boolean;
}

interface ClaudeValidationResponse {
  perFoto: ValidationItem[];
  tokensEntrada: number | null;
  tokensSalida: number | null;
}

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mediaType: m[1], data: m[2] };
  return { mediaType: 'image/webp', data: dataUrl };
}

function extractJSON(rawText: string): unknown {
  const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleanText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('La IA no devolvió un JSON válido');
  return JSON.parse(match[0]);
}

// ── Claude ─────────────────────────────────────────────────────────────
async function validarConClaude(
  fotos: string[],
  onUsage?: (tokensEntrada: number | null, tokensSalida: number | null) => void
): Promise<ClaudeValidationResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const content: unknown[] = [];
  fotos.forEach((foto, index) => {
    const { mediaType, data } = parseDataUrl(foto);
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
    content.push({ type: 'text', text: `[Foto ${index}]` });
  });
  content.push({ type: 'text', text: USER_PROMPT.replace('{N}', String(fotos.length)) });

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELO_CLAUDE_IA,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
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
  const parsed = extractJSON(rawText) as { perFoto: ValidationItem[] };
  return {
    perFoto: parsed.perFoto ?? [],
    tokensEntrada,
    tokensSalida,
  };
}

export async function POST(request: Request) {
  // 1. Auth
  const auth = await requireUser();
  if (auth.response) return auth.response;

  // 2. Rate limit (60/h por user)
  const rl = await checkRateLimit(validateLimiter(), auth.user.id);
  if (!rl.ok) {
    const retryAfter = Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000));
    return Response.json(
      { error: 'rate_limited', reset: rl.reset },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[validate-hair-photo] ANTHROPIC_API_KEY no configurada');
    return Response.json({ error: VALIDACION_NO_DISPONIBLE }, { status: 500 });
  }

  // 3. Parseo y validación de payload
  let body: { fotos: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { fotos } = body;
  if (!Array.isArray(fotos) || fotos.length < 1 || fotos.length > MAX_FOTOS) {
    return Response.json(
      { error: `fotos debe ser un array de 1 a ${MAX_FOTOS} elementos` },
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

  // 5. Verificar cupo de IA y máximo 2 validaciones por análisis (D1, §6)
  const cupo = await verificarCupoIA(auth.user.id, {
    supabase: auth.supabase,
    ruta: 'validar',
  });
  if (!cupo.permitido) {
    const status = cupo.codigo === 'PLAN_SIN_IA' ? 403 : 429;
    return Response.json(
      {
        error: cupo.mensaje ?? VALIDACION_NO_DISPONIBLE,
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
    const { perFoto, tokensEntrada, tokensSalida } = await validarConClaude(
      fotos,
      (tIn, tOut) => {
        ultimoTokensEntrada = tIn;
        ultimoTokensSalida = tOut;
      }
    );

    await registrarUsoIA({
      userId: auth.user.id,
      ruta: 'validar',
      modelo: MODELO_CLAUDE_IA,
      fotos: fotos.length,
      tokensEntrada,
      tokensSalida,
      ok: true,
    });

    // Sanitizar: si la IA omitió alguna foto, asumimos isHair=true para no bloquear injustamente
    const normalized: ValidationItem[] = fotos.map((_, i) => {
      const item = perFoto.find((p) => p.index === i);
      return { index: i, isHair: item?.isHair ?? true };
    });

    const validas = normalized.filter((p) => p.isHair).length;
    const total = normalized.length;
    const blocked = validas === 0;
    const warning = !blocked && validas < total;

    let message: string;
    if (blocked) {
      message = 'Las fotos no muestran cabello con suficiente claridad. Intenta de nuevo asegurándote de enfocar el cabello.';
    } else if (warning) {
      const fallidas = total - validas;
      message = `${fallidas} de ${total} ${fallidas === 1 ? 'foto no mostraba' : 'fotos no mostraban'} cabello con claridad — el análisis continuará pero podría ser menos preciso.`;
    } else {
      message = 'Las fotos muestran el cabello con claridad.';
    }

    return Response.json({
      perFoto: normalized,
      validas,
      total,
      blocked,
      warning,
      message,
    });
  } catch (e: unknown) {
    await registrarUsoIA({
      userId: auth.user.id,
      ruta: 'validar',
      modelo: MODELO_CLAUDE_IA,
      fotos: fotos.length,
      tokensEntrada: ultimoTokensEntrada,
      tokensSalida: ultimoTokensSalida,
      ok: false,
    });
    console.error('[validate-hair-photo] Claude falló:', e);
    Sentry.captureException(e, { tags: { area: 'ia', endpoint: 'validate-hair-photo' } });
    return Response.json({ error: VALIDACION_NO_DISPONIBLE }, { status: 502 });
  }
}
