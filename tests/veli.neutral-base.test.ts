import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CATALOGO_VARIABLES } from '@/lib/cotizador/variables';
import { NOMBRE_MARCA } from '@/lib/sitio';

const ROOT = path.resolve(__dirname, '..');

describe('Base Neutra Veli · Tokens semánticos, limpieza y marca Veli', () => {
  it('elimina por completo /design-lab y cualquier excepción en proxy.ts', () => {
    expect(existsSync(path.join(ROOT, 'app/design-lab'))).toBe(false);
    const proxy = readFileSync(path.join(ROOT, 'proxy.ts'), 'utf8');
    expect(proxy).not.toContain('design-lab');
  });

  it('define los tokens blancos/neutros en globals.css sin violeta IA ni tipografías retiradas', () => {
    const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    expect(css).toContain('--color-canvas: #FAFAFA');
    expect(css).toContain('--color-surface: #FFFFFF');
    expect(css).toContain('--color-surface-subtle: #F4F4F5');
    expect(css).toContain('--color-border: #E4E4E7');
    expect(css).toContain('--color-ink: #111111');
    expect(css).toContain('--color-ink-muted: #52525B');
    expect(css).toContain('--color-ink-subtle: #71717A');
    expect(css).toContain('--color-primary: #111111');
    expect(css).toContain('--color-ok: #15803D');
    expect(css).toContain('--color-alert: #B45309');
    expect(css).toContain('--color-error: #DC2626');

    expect(css).not.toContain('--bi-smart');
    expect(css).not.toMatch(/#7C3AED/i);
    expect(css).not.toMatch(/Fraunces|Comfortaa/i);
  });

  it('expone marca comercial Veli, retira LIB/COSTO.TS en Silla y neutraliza descripción de largo', () => {
    expect(NOMBRE_MARCA).toBe('Veli');

    const opcionLargo = CATALOGO_VARIABLES.largo.find((o) => o.valor === 'largo');
    expect(opcionLargo?.guia).toBe('Hasta la media espalda');
    expect(JSON.stringify(CATALOGO_VARIABLES)).not.toMatch(/brasier/i);

    const sillaPage = readFileSync(path.join(ROOT, 'app/page.tsx'), 'utf8');
    expect(sillaPage).not.toContain('LIB/COSTO.TS');
  });
});
