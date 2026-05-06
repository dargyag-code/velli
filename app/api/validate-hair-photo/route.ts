// BUG-2: segunda capa de validación con GPT-4o vision.
// Verifica que las fotos REALMENTE muestran cabello humano (no rostro
// completo, no pared, no objetos). Se llama desde el cliente sólo cuando
// el score de calidad es < 80, para no agregar coste innecesario.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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
async function validarConClaude(fotos: string[]): Promise<ValidationItem[]> {
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
      model: 'claude-sonnet-4-6',
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
  const rawText: string = json?.content?.[0]?.text ?? '';
  const parsed = extractJSON(rawText) as { perFoto: ValidationItem[] };
  return parsed.perFoto ?? [];
}

// ── OpenAI GPT-4o ──────────────────────────────────────────────────────
async function validarConOpenAI(fotos: string[]): Promise<ValidationItem[]> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const content: unknown[] = [];
  fotos.forEach((foto, index) => {
    const dataUrl = foto.startsWith('data:') ? foto : `data:image/webp;base64,${foto}`;
    content.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } });
    content.push({ type: 'text', text: `[Foto ${index}]` });
  });
  content.push({ type: 'text', text: USER_PROMPT.replace('{N}', String(fotos.length)) });

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 400,
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
  const parsed = extractJSON(rawText) as { perFoto: ValidationItem[] };
  return parsed.perFoto ?? [];
}

async function validar(fotos: string[]): Promise<ValidationItem[]> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[validate-hair-photo] usando Claude');
      return await validarConClaude(fotos);
    } catch (error) {
      console.error('[validate-hair-photo] Claude falló, fallback a OpenAI:', error);
    }
  }
  console.log('[validate-hair-photo] usando OpenAI');
  return await validarConOpenAI(fotos);
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Ningún proveedor de IA configurado (ANTHROPIC_API_KEY o OPENAI_API_KEY)' },
      { status: 500 }
    );
  }

  let body: { fotos: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { fotos } = body;
  if (!fotos?.length) {
    return Response.json({ error: 'Falta el campo `fotos` (array de data URLs)' }, { status: 400 });
  }
  if (fotos.length > 5) {
    return Response.json({ error: 'Máximo 5 fotos por validación' }, { status: 400 });
  }

  try {
    const perFoto = await validar(fotos);

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
    const msg = e instanceof Error ? e.message : 'Error al validar las fotos';
    return Response.json({ error: msg }, { status: 502 });
  }
}
