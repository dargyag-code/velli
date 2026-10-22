// URL pública y correo de soporte (lib/sitio.ts). velli.app no es de Velli:
// ninguna parte de la app puede caer en ese dominio por defecto.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

async function cargar(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [clave, valor] of Object.entries(env)) vi.stubEnv(clave, valor ?? '');
  return import('@/lib/sitio');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('APP_URL', () => {
  it('sin variable usa el alias de Vercel', async () => {
    const sitio = await cargar({ NEXT_PUBLIC_APP_URL: undefined });
    expect(sitio.APP_URL).toBe('https://velli-three.vercel.app');
    expect(sitio.APP_HOST).toBe('velli-three.vercel.app');
  });

  it('toma la variable y le quita la barra final', async () => {
    const sitio = await cargar({ NEXT_PUBLIC_APP_URL: 'https://app.ejemplo.co/' });
    expect(sitio.APP_URL).toBe('https://app.ejemplo.co');
    expect(sitio.APP_HOST).toBe('app.ejemplo.co');
  });

  it('un valor mal escrito no rompe la app: vuelve al de por defecto', async () => {
    const sitio = await cargar({ NEXT_PUBLIC_APP_URL: 'app.ejemplo.co' });
    expect(sitio.APP_URL).toBe('https://velli-three.vercel.app');
  });
});

describe('SOPORTE_EMAIL', () => {
  it('sin variable no hay correo ni mailto', async () => {
    const sitio = await cargar({ NEXT_PUBLIC_SUPPORT_EMAIL: undefined });
    expect(sitio.SOPORTE_EMAIL).toBeNull();
    expect(sitio.enlaceSoporte('Soporte Velli Pro')).toBeNull();
  });

  it('con un correo válido arma el mailto con el asunto', async () => {
    const sitio = await cargar({ NEXT_PUBLIC_SUPPORT_EMAIL: ' ayuda@ejemplo.co ' });
    expect(sitio.SOPORTE_EMAIL).toBe('ayuda@ejemplo.co');
    expect(sitio.enlaceSoporte('Soporte Velli Pro')).toBe(
      'mailto:ayuda@ejemplo.co?subject=Soporte%20Velli%20Pro'
    );
  });

  it('descarta un valor que no es un correo', async () => {
    const sitio = await cargar({ NEXT_PUBLIC_SUPPORT_EMAIL: 'soporte' });
    expect(sitio.SOPORTE_EMAIL).toBeNull();
  });
});

describe('sin referencias fijas a velli.app', () => {
  const raiz = path.resolve(__dirname, '..');
  const carpetas = ['app', 'components', 'lib', 'public'];

  function archivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
      const ruta = path.join(dir, nombre);
      return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
    });
  }

  it('ningún archivo de la app nombra velli.app', () => {
    const conDominio = carpetas
      .flatMap((c) => archivos(path.join(raiz, c)))
      .filter((f) => /\.(tsx?|jsx?|json|html|css|webmanifest)$/.test(f))
      .filter((f) => /velli\.app/i.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(raiz, f));
    expect(conDominio).toEqual([]);
  });
});
