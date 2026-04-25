import { EstadoCabelloFoto, AnguloCaptura } from '@/lib/types';
import { PROMPT_ANALISIS, CONTEXTO_ESTADO } from '@/lib/hairAnalysis';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY no configurada en el servidor' }, { status: 500 });
  }

  let body: { fotos: string[]; estadoCabello: EstadoCabelloFoto; angulos: AnguloCaptura[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { fotos, estadoCabello, angulos } = body;

  if (!fotos?.length || !estadoCabello || !angulos?.length) {
    return Response.json({ error: 'Faltan campos requeridos: fotos, estadoCabello, angulos' }, { status: 400 });
  }

  // Build multimodal content for OpenAI
  const content: unknown[] = [];

  fotos.forEach((foto: string, index: number) => {
    const dataUrl = foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;
    content.push({
      type: 'image_url',
      image_url: { url: dataUrl },
    });
    content.push({
      type: 'text',
      text: `[Foto ${index + 1}: ángulo ${angulos[index] ?? 'desconocido'}]`,
    });
  });

  const contexto = CONTEXTO_ESTADO[estadoCabello] ?? '';
  content.push({
    type: 'text',
    text: `CONTEXTO DE CAPTURA:\n${contexto}\n\n${PROMPT_ANALISIS}`,
  });

  let openaiRes: Response;
  try {
    openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 512,
        messages: [
          {
            // System message explícito: responder SOLO con JSON puro, sin markdown
            role: 'system',
            content:
              'Eres un experto en análisis de texturas capilares. Responde SOLO con el objeto JSON solicitado. No uses backticks, no uses bloques de código markdown, no agregues texto antes ni después del JSON.',
          },
          { role: 'user', content },
        ],
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error de red al contactar la API de OpenAI';
    return Response.json({ error: msg }, { status: 502 });
  }

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => '');
    return Response.json({ error: `OpenAI API respondió con ${openaiRes.status}: ${errText}` }, { status: 502 });
  }

  const openaiData = await openaiRes.json();
  const rawText: string = openaiData?.choices?.[0]?.message?.content ?? '';

  const cleanText = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const match = cleanText.match(/\{[\s\S]*\}/);
  if (!match) {
    return Response.json({ error: 'La IA no devolvió un JSON válido' }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(match[0]);
    return Response.json(parsed);
  } catch {
    return Response.json({ error: 'No se pudo parsear la respuesta de la IA' }, { status: 502 });
  }
}
