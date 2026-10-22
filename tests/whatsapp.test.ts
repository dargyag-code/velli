// Links de WhatsApp con indicativo de Colombia (R7). Antes, "300 123 4567"
// daba wa.me/3001234567, que no abre ningún chat.
import { describe, expect, it } from 'vitest';
import { enlaceWhatsApp, numeroWhatsApp } from '@/lib/whatsapp';

describe('numeroWhatsApp', () => {
  it('antepone 57 a un celular colombiano de 10 dígitos, con o sin espacios', () => {
    expect(numeroWhatsApp('3001234567')).toBe('573001234567');
    expect(numeroWhatsApp('300 123 4567')).toBe('573001234567');
    expect(numeroWhatsApp('(300) 123-4567')).toBe('573001234567');
  });

  it('antepone 57 a un fijo colombiano de 10 dígitos (60x)', () => {
    expect(numeroWhatsApp('601 234 5678')).toBe('576012345678');
  });

  it('deja igual un número que ya trae el 57', () => {
    expect(numeroWhatsApp('+57 300 123 4567')).toBe('573001234567');
    expect(numeroWhatsApp('573001234567')).toBe('573001234567');
    expect(numeroWhatsApp('0057 300 123 4567')).toBe('573001234567');
    expect(numeroWhatsApp('(+57) 601 234 5678')).toBe('576012345678');
  });

  it('con el 57 delante exige que el resto sea un número colombiano', () => {
    expect(numeroWhatsApp('+57 234 5678')).toBeNull();
    expect(numeroWhatsApp('5730012345678')).toBeNull();
  });

  it('respeta los números de otros países', () => {
    expect(numeroWhatsApp('+1 (305) 555-1234')).toBe('13055551234');
    expect(numeroWhatsApp('+52 55 1234 5678')).toBe('525512345678');
    expect(numeroWhatsApp('13055551234')).toBe('13055551234');
  });

  it('rechaza lo que no se puede marcar', () => {
    expect(numeroWhatsApp('2345678')).toBeNull();
    expect(numeroWhatsApp('4155551234')).toBeNull();
    expect(numeroWhatsApp('abc')).toBeNull();
    expect(numeroWhatsApp('')).toBeNull();
    expect(numeroWhatsApp(null)).toBeNull();
    expect(numeroWhatsApp(undefined)).toBeNull();
  });
});

describe('enlaceWhatsApp', () => {
  it('arma wa.me con el número y el texto codificado', () => {
    expect(enlaceWhatsApp('300 123 4567', 'Hola María, ¿agendamos?')).toBe(
      'https://wa.me/573001234567?text=Hola%20Mar%C3%ADa%2C%20%C2%BFagendamos%3F'
    );
  });

  it('sin texto, solo el número', () => {
    expect(enlaceWhatsApp('3001234567')).toBe('https://wa.me/573001234567');
  });

  it('con un número inválido y texto, abre WhatsApp para elegir el contacto', () => {
    expect(enlaceWhatsApp('2345678', 'Hola')).toBe('https://wa.me/?text=Hola');
    expect(enlaceWhatsApp(undefined, 'Hola')).toBe('https://wa.me/?text=Hola');
  });

  it('con un número inválido y sin texto no hay link', () => {
    expect(enlaceWhatsApp('2345678')).toBeNull();
    expect(enlaceWhatsApp(null)).toBeNull();
  });
});
