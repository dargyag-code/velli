import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const mockCheckRateLimit = vi.fn();
const mockCargarVitrina = vi.fn();
const mockInsertOrder = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? '181.50.10.20' : null),
  }),
}));

vi.mock('@/lib/api/rateLimit', () => ({
  publicOrderLimiter: () => null,
  vitrinaPublicaLimiter: () => null,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/vitrina/servidor', () => ({
  cargarVitrinaServidorPorSlug: (...args: unknown[]) => mockCargarVitrina(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'public_orders') {
        return {
          insert: (payload: unknown) => ({
            select: () => ({
              single: () => mockInsertOrder(payload),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { telefono: '3105556677' }, error: null }),
          }),
        }),
      };
    },
  }),
}));

import { POST } from '@/app/api/public/orders/route';
import {
  CAMPOS_PRIVADOS_PROHIBIDOS,
  armarMensajeWhatsAppPedido,
  generarCodigoPedido,
  puedeTransicionarEstadoPedido,
  resolverPrecioVariante,
  sanitizarPayloadVitrinaPublica,
  validarYCalcularPedidoPublico,
  type PublicCatalogProduct,
  type PublicServiceItem,
} from '@/lib/vitrina';

afterEach(() => {
  vi.clearAllMocks();
});

const CATALOGO_PRUEBA: {
  products: readonly PublicCatalogProduct[];
  services: readonly PublicServiceItem[];
} = {
  products: [
    {
      id: 'prod-shampoo',
      name: 'Shampoo Nutritivo Velvet',
      slug: 'shampoo-nutritivo-velvet',
      category: 'Cuidado Capilar',
      description: 'Libre de sulfatos',
      priceCop: 65000,
      variants: [
        { id: 'v-250', label: '250 ml', group: 'ml', priceOverrideCop: 65000, inStock: true },
        { id: 'v-500', label: '500 ml', group: 'ml', priceOverrideCop: 110000, inStock: true },
        { id: 'v-1000', label: '1000 ml', group: 'ml', priceOverrideCop: 185000, inStock: false },
      ],
      imageUrl: null,
      inStock: true,
      sortOrder: 0,
    },
    {
      id: 'prod-oleo',
      name: 'Óleo Reparador de Puntas',
      slug: 'oleo-reparador',
      category: 'Styling',
      description: null,
      priceCop: 48000,
      variants: [
        { id: 'v-aroma-rosa', label: 'Rosa Damascena', group: 'aroma', priceDeltaCop: 4000, inStock: true },
      ],
      imageUrl: null,
      inStock: true,
      sortOrder: 1,
    },
    {
      id: 'prod-agotado',
      name: 'Kit Agotado',
      slug: 'kit-agotado',
      category: 'Kits',
      description: null,
      priceCop: 120000,
      variants: [],
      imageUrl: null,
      inStock: false,
      sortOrder: 2,
    },
  ],
  services: [
    {
      id: 'srv-balayage',
      name: 'Balayage / Diseño de Rubios',
      category: 'decoloracion',
      durationMinutes: 240,
      priceCop: 210000,
      sortOrder: 0,
    },
    {
      id: 'srv-hidratacion',
      name: 'Hidratación Profunda / Nutrición',
      category: 'tratamiento',
      durationMinutes: 75,
      priceCop: 85000,
      sortOrder: 1,
    },
  ],
};

describe('1. Validación estricta del carrito y cálculo autoritativo de totales COP', () => {
  it('calcula totales COP exactos con variantes (override y delta) e ignora precios manipulados desde el cliente', () => {
    expect(resolverPrecioVariante(65000, { id: 'v-500', label: '500 ml', priceOverrideCop: 110000 })).toBe(
      110000
    );
    expect(resolverPrecioVariante(48000, { id: 'v-rosa', label: 'Rosa', priceDeltaCop: 4000 })).toBe(
      52000
    );

    const res = validarYCalcularPedidoPublico(
      {
        organizationSlug: 'atelier-velvet-a1b2c3d4',
        customerName: '  Camila Restrepo  ',
        customerPhone: '300 456 7890',
        orderType: 'product_cart',
        notes: 'Entregar en portería',
        items: [
          {
            kind: 'product',
            itemId: 'prod-shampoo',
            variantId: 'v-500',
            quantity: 2,
            // Intento de manipulación desde cliente: debe ignorarse
            unitPriceCop: 100,
          },
          {
            kind: 'product',
            itemId: 'prod-oleo',
            variantId: 'v-aroma-rosa',
            quantity: 1,
          },
        ],
      },
      CATALOGO_PRUEBA
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // 2 × $110.000 + 1 × ($48.000 + $4.000) = $220.000 + $52.000 = $272.000 COP
    expect(res.totalCop).toBe(272000);
    expect(res.customerName).toBe('Camila Restrepo');
    expect(res.normalizedCustomerWhatsapp).toBe('573004567890');
    expect(res.items[0].unitPriceCop).toBe(110000);
    expect(res.items[0].lineTotalCop).toBe(220000);
    expect(res.items[0].variantLabel).toBe('500 ml');
    expect(res.items[1].unitPriceCop).toBe(52000);
  });

  it('valida solicitudes de servicios (service_inquiry) contra tarifas activas de servicios', () => {
    const res = validarYCalcularPedidoPublico(
      {
        organizationSlug: 'atelier-velvet-a1b2c3d4',
        customerName: 'Laura Mejía',
        customerPhone: '+57 315 222 3344',
        orderType: 'service_inquiry',
        items: [
          { kind: 'service', itemId: 'srv-balayage', quantity: 1 },
          { kind: 'service', itemId: 'srv-hidratacion', quantity: 1 },
        ],
      },
      CATALOGO_PRUEBA
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.totalCop).toBe(295000);
  });

  it('rechaza carritos vacíos, teléfonos inválidos, cantidades no enteras y productos o variantes sin stock', () => {
    expect(
      validarYCalcularPedidoPublico(
        {
          organizationSlug: 'atelier-velvet',
          customerName: 'Ana',
          customerPhone: '3001234567',
          orderType: 'product_cart',
          items: [],
        },
        CATALOGO_PRUEBA
      ).ok
    ).toBe(false);

    expect(
      validarYCalcularPedidoPublico(
        {
          organizationSlug: 'atelier-velvet',
          customerName: 'Ana',
          customerPhone: '12345',
          orderType: 'product_cart',
          items: [{ kind: 'product', itemId: 'prod-shampoo', variantId: 'v-250', quantity: 1 }],
        },
        CATALOGO_PRUEBA
      ).ok
    ).toBe(false);

    expect(
      validarYCalcularPedidoPublico(
        {
          organizationSlug: 'atelier-velvet',
          customerName: 'Ana',
          customerPhone: '3001234567',
          orderType: 'product_cart',
          items: [{ kind: 'product', itemId: 'prod-agotado', quantity: 1 }],
        },
        CATALOGO_PRUEBA
      ).ok
    ).toBe(false);

    expect(
      validarYCalcularPedidoPublico(
        {
          organizationSlug: 'atelier-velvet',
          customerName: 'Ana',
          customerPhone: '3001234567',
          orderType: 'product_cart',
          items: [{ kind: 'product', itemId: 'prod-shampoo', variantId: 'v-1000', quantity: 1 }],
        },
        CATALOGO_PRUEBA
      ).ok
    ).toBe(false);

    expect(
      validarYCalcularPedidoPublico(
        {
          organizationSlug: 'atelier-velvet',
          customerName: 'Ana',
          customerPhone: '3001234567',
          orderType: 'product_cart',
          items: [{ kind: 'product', itemId: 'prod-shampoo', variantId: 'v-250', quantity: 1.5 }],
        },
        CATALOGO_PRUEBA
      ).ok
    ).toBe(false);
  });
});

describe('2. Generación del mensaje WhatsApp y persistencia transaccional previa (POST /api/public/orders)', () => {
  it('genera código trazable, mensaje legible y enlace wa.me con indicativo 57', () => {
    const codigo = generarCodigoPedido(new Date('2026-11-25T15:00:00Z'), '9K4M');
    expect(codigo).toBe('VP-261125-9K4M');

    const { mensaje, whatsappUrl } = armarMensajeWhatsAppPedido({
      orderCode: codigo,
      salonName: 'Atelier Velvet',
      salonWhatsapp: '312 888 9900',
      customerName: 'Valentina Gómez',
      customerPhone: '300 123 4567',
      orderType: 'product_cart',
      items: [
        {
          kind: 'product',
          itemId: 'prod-shampoo',
          name: 'Shampoo Nutritivo Velvet',
          variantId: 'v-500',
          variantLabel: '500 ml',
          quantity: 2,
          unitPriceCop: 110000,
          lineTotalCop: 220000,
        },
      ],
      totalCop: 220000,
      notes: 'Pago por transferencia',
    });

    expect(mensaje).toContain('*Código:* VP-261125-9K4M');
    expect(mensaje).toContain('2× Shampoo Nutritivo Velvet (500 ml) — $220.000');
    expect(mensaje).toContain('*Total pedido: $220.000 COP*');
    expect(mensaje).toContain('*Nota:* Pago por transferencia');
    expect(whatsappUrl).toMatch(/^https:\/\/wa\.me\/573128889900\?text=/);
  });

  it('persiste en public_orders ANTES de emitir wa.me y aborta con 500 si falla la inserción', async () => {
    const ordenEventos: string[] = [];

    mockCheckRateLimit.mockResolvedValue({ ok: true, remaining: 19, reset: Date.now() + 60_000 });
    mockCargarVitrina.mockResolvedValue({
      whatsappPhone: '311 444 5566',
      storefront: {
        organization: {
          id: 'org-1',
          slug: 'atelier-velvet',
          name: 'Atelier Velvet',
          city: 'Bogotá',
          vertical: 'hair_studio',
          conMarcaVelli: true,
        },
        brand: {
          organizationId: 'org-1',
          displayName: 'Atelier Velvet',
          logoUrl: null,
          primaryColor: '#3B0D1E',
          accentColor: '#E8CFC8',
          publicTagline: null,
          legalFooter: null,
        },
        services: CATALOGO_PRUEBA.services,
        products: CATALOGO_PRUEBA.products,
      },
    });

    mockInsertOrder.mockImplementationOnce(async (row: { order_code: string; total_cop: number }) => {
      ordenEventos.push(`db_insert:${row.total_cop}`);
      return {
        data: { id: 'order-uuid-1', order_code: row.order_code },
        error: null,
      };
    });

    const reqOk = new Request('http://localhost/api/public/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'atelier-velvet',
        customerName: 'Mariana Toro',
        customerPhone: '300 999 8877',
        orderType: 'product_cart',
        items: [{ kind: 'product', itemId: 'prod-shampoo', variantId: 'v-250', quantity: 2 }],
      }),
    });

    const resOk = await POST(reqOk);
    ordenEventos.push('response_returned');

    expect(resOk.status).toBe(201);
    const jsonOk = (await resOk.json()) as {
      ok: boolean;
      orderCode: string;
      totalCop: number;
      whatsappUrl: string;
    };
    expect(jsonOk.ok).toBe(true);
    expect(jsonOk.totalCop).toBe(130000);
    expect(jsonOk.whatsappUrl).toContain(encodeURIComponent(jsonOk.orderCode));
    expect(ordenEventos).toEqual(['db_insert:130000', 'response_returned']);

    // Si falla el INSERT en Supabase, jamás devuelve `whatsappUrl`
    mockInsertOrder.mockResolvedValueOnce({
      data: null,
      error: { code: '50000', message: 'DB failure' },
    });
    const reqFail = new Request('http://localhost/api/public/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'atelier-velvet',
        customerName: 'Mariana Toro',
        customerPhone: '300 999 8877',
        orderType: 'product_cart',
        items: [{ kind: 'product', itemId: 'prod-shampoo', variantId: 'v-250', quantity: 1 }],
      }),
    });
    const resFail = await POST(reqFail);
    expect(resFail.status).toBe(500);
    const jsonFail = (await resFail.json()) as Record<string, unknown>;
    expect(jsonFail.whatsappUrl).toBeUndefined();
  });

  it('aplica rate-limiting 429 por IP y valida máquina de estados de pedidos web', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, reset: Date.now() + 60_000 });
    const res429 = await POST(
      new Request('http://localhost/api/public/orders', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(res429.status).toBe(429);

    expect(puedeTransicionarEstadoPedido('sent_to_whatsapp', 'confirmed')).toBe(true);
    expect(puedeTransicionarEstadoPedido('confirmed', 'completed')).toBe(true);
    expect(puedeTransicionarEstadoPedido('completed', 'cancelled')).toBe(false);
    expect(puedeTransicionarEstadoPedido('cancelled', 'confirmed')).toBe(false);
  });
});

describe('3. Privacidad estricta: cero filtración de costos químicos, fórmulas ni comisiones', () => {
  it('elimina cualquier campo privado prohibido al sanitizar el payload público de la vitrina', () => {
    const contaminado = {
      organization: {
        id: 'org-priv',
        slug: 'salon-privado',
        name: 'Salón Privado',
        city: 'Cali',
        vertical: 'hair_studio',
        conMarcaVelli: true,
        comision_estimada: 74952,
      },
      brand: {
        displayName: 'Salón Privado',
        primaryColor: '#3B0D1E',
        customDomain: 'secreto.interno.local',
      },
      services: [
        {
          id: 'srv-1',
          name: 'Balayage',
          category: 'decoloracion',
          durationMinutes: 240,
          priceCop: 230000,
          sortOrder: 0,
          // Campos internos que JAMÁS pueden salir hacia afuera
          costo_producto_estimado: 42620,
          costoProductoEstimado: 42620,
          costo_detalle: { gramos: 90 },
          comision_estimada: 74952,
          comisionDetalle: { valor: 40 },
          formula: { tono: '8.1' },
          consumo: { gramosTinteBase: 60 },
        },
      ],
      products: [
        {
          id: 'prod-1',
          name: 'Máscara Nutritiva',
          slug: 'mascara-nutritiva',
          category: 'Tratamiento',
          priceCop: 95000,
          variants: [],
          inStock: true,
          sortOrder: 0,
          precio_compra: 42000,
          precioCompra: 42000,
          costoUnitarioCop: 180,
        },
      ],
    };

    const limpio = sanitizarPayloadVitrinaPublica(contaminado);
    expect(limpio).not.toBeNull();
    const serializado = JSON.stringify(limpio);

    for (const campoProhibido of CAMPOS_PRIVADOS_PROHIBIDOS) {
      expect(serializado).not.toContain(`"${campoProhibido}"`);
    }
  });

  it('verifica migración SQL de vitrina, RPC pública sin campos privados y ruta pública /s en proxy.ts', () => {
    const rutaSql = [
      path.resolve(__dirname, '../supabase/migration-vitrina-editorial.sql'),
      path.resolve(__dirname, '../supabase/_archive/migration-vitrina-editorial.sql'),
    ].find((p) => existsSync(p));
    expect(rutaSql).toBeDefined();

    const sql = readFileSync(rutaSql!, 'utf8');
    const sqlSinComentarios = sql.replace(/--.*$/gm, '');

    expect(sqlSinComentarios).toMatch(/CREATE TABLE IF NOT EXISTS public\.catalog_products\b/);
    expect(sqlSinComentarios).toMatch(/CREATE TABLE IF NOT EXISTS public\.public_orders\b/);
    expect(sqlSinComentarios).toMatch(/CREATE TABLE IF NOT EXISTS public\.public_order_events\b/);
    expect(sqlSinComentarios).toMatch(/ALTER TABLE public\.catalog_products ENABLE ROW LEVEL SECURITY/);
    expect(sqlSinComentarios).toMatch(/ALTER TABLE public\.public_orders ENABLE ROW LEVEL SECURITY/);
    expect(sqlSinComentarios).toMatch(/ALTER TABLE public\.public_order_events ENABLE ROW LEVEL SECURITY/);
    expect(sqlSinComentarios).not.toMatch(/\bDROP TABLE\b/i);
    expect(sqlSinComentarios).not.toMatch(/\bTRUNCATE\b/i);

    // La RPC pública jamás lee `productos_salon`, `comisiones`, `costo_producto_estimado` ni `comision_estimada`
    const cuerpoRpc = sqlSinComentarios.slice(
      sqlSinComentarios.indexOf('FUNCTION public.vitrina_publica_por_slug')
    );
    expect(cuerpoRpc).not.toMatch(/productos_salon/i);
    expect(cuerpoRpc).not.toMatch(/costo_producto_estimado/i);
    expect(cuerpoRpc).not.toMatch(/comision_estimada/i);
    expect(cuerpoRpc).not.toMatch(/precio_compra/i);

    const proxyTs = readFileSync(path.resolve(__dirname, '../proxy.ts'), 'utf8');
    expect(proxyTs).toContain("path.startsWith('/s/')");
  });
});
