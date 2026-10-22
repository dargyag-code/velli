// Decisión D2 (docs/velli-bi/01-costo-ia.md): la IA del diagnóstico usa solo
// Claude, sin respaldo de GPT-4o. Si Claude falla, la ruta responde un texto
// claro (sin el error del proveedor) y la cámara ofrece seguir con el
// diagnóstico manual. Estas pruebas corren las rutas con la red simulada:
// ninguna llamada sale del proceso.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/lib/api/auth', () => ({
  requireUser: async () => ({ user: { id: 'estilista-1' }, supabase: {} }),
}));
vi.mock('@/lib/api/rateLimit', () => ({
  analyzeLimiter: () => null,
  validateLimiter: () => null,
  checkRateLimit: async () => ({ ok: true, remaining: 1, reset: Date.now() }),
}));
vi.mock('@/lib/kb/promptsServidor', () => ({
  componerPromptsAnalisis: async () => ({ sistema: 'sistema', usuario: 'usuario' }),
}));

import { POST as analizarRuta } from '../app/api/analyze-hair/route';
import { POST as validarRuta } from '../app/api/validate-hair-photo/route';
import { IANoDisponibleError, analizarCabello } from '../lib/hairAnalysis';

const RESULTADO = {
  tipoRizoPrincipal: '3B',
  tiposSecundarios: ['3A'],
  observaciones: 'Rizo espiral definido.',
  confianza: 'alta',
};

const FOTO = 'data:image/webp;base64,AAAA';

function peticion(ruta: string, cuerpo: unknown): Request {
  return new Request(`http://localhost${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

const analisis = () =>
  peticion('/api/analyze-hair', { fotos: [FOTO], estadoCabello: 'seco_natural', angulos: ['frontal'] });
const validacion = () => peticion('/api/validate-hair-photo', { fotos: [FOTO] });

const claudeResponde = (texto: string) =>
  Response.json({ content: [{ type: 'text', text: texto }] });
const claudeSobrecargado = () =>
  new Response('{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', { status: 529 });

// Red simulada: registra cada URL que la ruta intenta llamar.
function redSimulada(responder: () => Response) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
    urls.push(String(url));
    return responder();
  }));
  return urls;
}

async function errorDe(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (e) {
    return e;
  }
  throw new Error('se esperaba un error');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-prueba');
  // Aunque la llave de OpenAI siga cargada en el entorno, ya no se usa.
  vi.stubEnv('OPENAI_API_KEY', 'sk-prueba');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sentry.captureException.mockClear();
});

describe('/api/analyze-hair sin respaldo', () => {
  it('si Claude falla responde 502 con un texto claro y no llama a OpenAI', async () => {
    const urls = redSimulada(claudeSobrecargado);
    const res = await analizarRuta(analisis());

    expect(res.status).toBe(502);
    const cuerpo = await res.json();
    expect(cuerpo.error).toMatch(/diagnóstico manual/);
    expect(JSON.stringify(cuerpo)).not.toMatch(/529|Overloaded|Anthropic/i);
    expect(urls).toEqual(['https://api.anthropic.com/v1/messages']);
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });

  it('si Claude no devuelve JSON también cae en el diagnóstico manual', async () => {
    const urls = redSimulada(() => claudeResponde('No puedo analizar estas fotos.'));
    const res = await analizarRuta(analisis());

    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/diagnóstico manual/);
    expect(urls).toHaveLength(1);
  });

  it('sin la llave de Anthropic no llama a ningún proveedor', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const urls = redSimulada(() => claudeResponde(JSON.stringify(RESULTADO)));
    const res = await analizarRuta(analisis());

    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/diagnóstico manual/);
    expect(urls).toEqual([]);
  });

  it('con Claude disponible devuelve el análisis', async () => {
    const urls = redSimulada(() => claudeResponde(JSON.stringify(RESULTADO)));
    const res = await analizarRuta(analisis());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULTADO);
    expect(urls).toEqual(['https://api.anthropic.com/v1/messages']);
  });
});

describe('/api/validate-hair-photo sin respaldo', () => {
  it('si Claude falla responde 502 sin el error del proveedor y no llama a OpenAI', async () => {
    const urls = redSimulada(claudeSobrecargado);
    const res = await validarRuta(validacion());

    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/529|Overloaded|Anthropic/i);
    expect(urls).toEqual(['https://api.anthropic.com/v1/messages']);
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });

  it('sin la llave de Anthropic no llama a ningún proveedor', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const urls = redSimulada(() => claudeResponde('{"perFoto":[{"index":0,"isHair":true}]}'));
    const res = await validarRuta(validacion());

    expect(res.status).toBe(500);
    expect(urls).toEqual([]);
  });
});

describe('analizarCabello: aviso para la estilista', () => {
  const llamar = () => analizarCabello([FOTO], 'seco_natural', ['frontal']);

  it('sin conexión → seguir en manual', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const e = await errorDe(llamar());

    expect(e).toBeInstanceOf(IANoDisponibleError);
    expect((e as IANoDisponibleError).motivo).toBe('sin_conexion');
    expect((e as IANoDisponibleError).message).toBe('No hay conexión a internet para usar la IA.');
  });

  it('502 de la ruta → la IA no respondió', async () => {
    redSimulada(() => Response.json({ error: 'x' }, { status: 502 }));
    const e = await errorDe(llamar());

    expect((e as IANoDisponibleError).motivo).toBe('sin_respuesta');
    expect((e as IANoDisponibleError).message).toBe('La IA no respondió esta vez.');
  });

  it('504 sin JSON (función agotada) → la IA no respondió', async () => {
    redSimulada(() => new Response('<html>Gateway Timeout</html>', { status: 504 }));
    const e = await errorDe(llamar());

    expect((e as IANoDisponibleError).motivo).toBe('sin_respuesta');
  });

  it('429 → límite por hora con los minutos que faltan', async () => {
    redSimulada(() => Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '600' } }));
    const e = await errorDe(llamar());

    expect((e as IANoDisponibleError).motivo).toBe('limite_hora');
    expect((e as IANoDisponibleError).message).toBe(
      'Llegaste al límite de análisis con IA por hora. Vuelve a estar disponible en 10 minutos.'
    );
  });

  it('429 con menos de un minuto usa el singular, y sin Retry-After omite el tiempo', async () => {
    redSimulada(() => new Response(null, { status: 429, headers: { 'Retry-After': '30' } }));
    expect(((await errorDe(llamar())) as Error).message).toMatch(/en 1 minuto\.$/);

    redSimulada(() => new Response(null, { status: 429 }));
    expect(((await errorDe(llamar())) as Error).message).toBe('Llegaste al límite de análisis con IA por hora.');
  });

  it('un error de la petición (4xx) no ofrece el manual: muestra el texto del servidor', async () => {
    redSimulada(() =>
      Response.json({ error: 'fotos[0] excede el tamaño máximo permitido (≈1.2MB)' }, { status: 413 })
    );
    const e = await errorDe(llamar());

    expect(e).not.toBeInstanceOf(IANoDisponibleError);
    expect((e as Error).message).toBe('fotos[0] excede el tamaño máximo permitido (≈1.2MB)');
  });

  it('con respuesta correcta devuelve el análisis', async () => {
    redSimulada(() => Response.json(RESULTADO));
    expect(await llamar()).toEqual(RESULTADO);
  });
});
