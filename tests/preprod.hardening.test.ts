import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockRequireOrgAccess = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockRedirect = vi.fn((destino: string): never => {
  throw new Error(`NEXT_REDIRECT:${destino}`);
});
const mockCreateServerClient = vi.fn();

vi.mock('@/lib/api/auth', () => ({
  requireOrgAccess: (...args: unknown[]) => mockRequireOrgAccess(...args),
}));

vi.mock('@/lib/api/rateLimit', () => ({
  validateLimiter: () => null,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: (destino: string) => mockRedirect(destino),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateServerClient(),
}));

import nextConfig from '@/next.config';
import { POST as uploadVitrinaMedia, DELETE as deleteVitrinaMedia } from '@/app/api/storage/vitrina/route';
import {
  MAX_VITRINA_IMAGE_BYTES,
  VITRINA_MEDIA_BUCKET,
  construirRutaVitrinaMedia,
  detectarMimePorMagicBytes,
  extraerRutaVitrinaMediaDesdeUrl,
  validarArchivoImagenVitrina,
  validarRutaObjetoVitrinaMedia,
} from '@/lib/storage/vitrinaMedia';
import {
  SPECIALIST_FALLBACK_ROUTE,
  esRutaRestringidaParaSpecialist,
  mostrarAccesoPlanesPorRol,
  mostrarAdministracionVitrinaPorRol,
  obtenerTabsNavegacionPorRol,
  resolverRedireccionPorRol,
} from '@/lib/organizations/navegacion';
import { protegerRutaSoloAdminEnServidor } from '@/lib/organizations/servidor';
import VitrinaProtectedLayout from '@/app/vitrina/layout';
import {
  crearCotizacionOperativaSilla,
  listarCotizacionesOperativasSilla,
} from '@/lib/cotizador/db';
import {
  CAMPOS_PRIVADOS_PROHIBIDOS,
  construirMetadataVitrinaPublica,
  type PublicStorefrontData,
} from '@/lib/vitrina';
import { APP_URL } from '@/lib/sitio';

afterEach(() => {
  vi.clearAllMocks();
});

const ORG_ID_A = '11111111-1111-4111-8111-111111111111';
const ORG_ID_B = '22222222-2222-4222-8222-222222222222';

const PNG_MINIMO = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

const JPEG_MINIMO = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const WEBP_MINIMO = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function leerSqlSinComentarios(nombreArchivo: string): string {
  const ruta = path.resolve(__dirname, '..', 'supabase', nombreArchivo);
  return readFileSync(ruta, 'utf8').replace(/--.*$/gm, '');
}

function extraerBloquesFuncionSql(sql: string): Array<{ nombre: string; bloque: string }> {
  const regex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_.]+)\s*\([\s\S]*?\$\$\s*[\s\S]*?\$\$\s*;/gi;
  const bloques: Array<{ nombre: string; bloque: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    bloques.push({ nombre: match[1], bloque: match[0] });
  }
  return bloques;
}

describe('1. Endurecimiento de migraciones SQL para Postgres real', () => {
  it('declara CREATE EXTENSION IF NOT EXISTS btree_gist antes de EXCLUDE USING gist en agenda', () => {
    const sqlAgenda = leerSqlSinComentarios('migration-agenda-puente.sql');
    const idxExtension = sqlAgenda.search(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+btree_gist\s*;/i);
    const idxExclude = sqlAgenda.search(/EXCLUDE\s+USING\s+gist/i);

    expect(idxExtension).toBeGreaterThanOrEqual(0);
    expect(idxExclude).toBeGreaterThan(idxExtension);
  });

  it('todas las funciones SECURITY DEFINER, handle_new_user() y assign_default_organization_id() fijan search_path vacío y califican public.*', () => {
    const archivos = [
      'migration-multitenant-rbac.sql',
      'migration-vitrina-editorial.sql',
      'migration-agenda-puente.sql',
      'migration-storage-vitrina.sql',
    ];

    let vioHandleNewUser = false;
    let vioAssignDefaultOrg = false;
    let totalSecurityDefiner = 0;

    for (const archivo of archivos) {
      const sql = leerSqlSinComentarios(archivo);

      // Idempotencia no destructiva obligatoria
      expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);

      const funciones = extraerBloquesFuncionSql(sql);
      expect(funciones.length).toBeGreaterThan(0);

      for (const fn of funciones) {
        if (fn.nombre.toLowerCase().endsWith('handle_new_user')) {
          vioHandleNewUser = true;
          expect(fn.bloque).toMatch(/SET\s+search_path\s*=\s*''/i);
          expect(fn.bloque).toMatch(/public\.(profiles|organizations|organization_members|brand_settings)/i);
        }

        if (fn.nombre.toLowerCase().endsWith('assign_default_organization_id')) {
          vioAssignDefaultOrg = true;
          expect(fn.bloque).toMatch(/SET\s+search_path\s*=\s*''/i);
          expect(fn.bloque).toMatch(/public\.organization_members/i);
        }

        if (/SECURITY\s+DEFINER/i.test(fn.bloque)) {
          totalSecurityDefiner += 1;
          expect(fn.bloque, `${archivo} -> ${fn.nombre}`).toMatch(/SET\s+search_path\s*=\s*''/i);
          expect(fn.bloque, `${archivo} -> ${fn.nombre}`).toMatch(/\bpublic\./i);
        }
      }
    }

    expect(vioHandleNewUser).toBe(true);
    expect(vioAssignDefaultOrg).toBe(true);
    expect(totalSecurityDefiner).toBeGreaterThanOrEqual(10);
  });

  it('ordena triggers aa_set_default_org_* antes de triggers de guardia y define crear_cotizacion_operativa_silla', () => {
    const sqlRbac = leerSqlSinComentarios('migration-multitenant-rbac.sql');

    expect(sqlRbac).toMatch(/'aa_set_default_org_'\s*\|\|\s*t/);
    expect(sqlRbac).toMatch(
      /ALTER TABLE public\.%I DISABLE TRIGGER USER[\s\S]*?UPDATE public\.%I SET organization_id = user_id[\s\S]*?ALTER TABLE public\.%I ENABLE TRIGGER USER/
    );
    expect(sqlRbac).not.toMatch(/DISABLE TRIGGER ALL/i);
    expect('aa_set_default_org_appointments' < 'appointments_guard_bogota_trg').toBe(true);
    expect('aa_set_default_org_cotizaciones' < 'cotizaciones_eventos_trg').toBe(true);
    expect('aa_set_default_org_clientas' < 'guard_write_clientas').toBe(true);

    expect(sqlRbac).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.crear_cotizacion_operativa_silla\b/i
    );
    expect(sqlRbac).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.crear_cotizacion_operativa_silla\b[\s\S]*?TO\s+authenticated/i
    );
  });
});

describe('2. Supabase Storage real (vitrina-media) y API /api/storage/vitrina', () => {
  it('acepta imágenes reales JPG, PNG y WebP <= 3 MB y rechaza tamaños excesivos, SVG o cabeceras falsificadas', () => {
    expect(detectarMimePorMagicBytes(JPEG_MINIMO)).toBe('image/jpeg');
    expect(detectarMimePorMagicBytes(PNG_MINIMO)).toBe('image/png');
    expect(detectarMimePorMagicBytes(WEBP_MINIMO)).toBe('image/webp');

    const okPng = validarArchivoImagenVitrina({
      mimeType: 'image/png',
      sizeBytes: PNG_MINIMO.byteLength,
      headerBytes: PNG_MINIMO,
    });
    expect(okPng).toEqual({ ok: true, mimeType: 'image/png', extension: 'png' });

    const demasiadoGrande = validarArchivoImagenVitrina({
      mimeType: 'image/webp',
      sizeBytes: MAX_VITRINA_IMAGE_BYTES + 1,
      headerBytes: WEBP_MINIMO,
    });
    expect(demasiadoGrande.ok).toBe(false);

    const svgRechazado = validarArchivoImagenVitrina({
      mimeType: 'image/svg+xml',
      sizeBytes: 512,
    });
    expect(svgRechazado.ok).toBe(false);

    const htmlDisfrazadoDePng = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>');
    const spoofRechazado = validarArchivoImagenVitrina({
      mimeType: 'image/png',
      sizeBytes: htmlDisfrazadoDePng.byteLength,
      headerBytes: htmlDisfrazadoDePng,
    });
    expect(spoofRechazado.ok).toBe(false);
  });

  it('restringe rutas estrictamente a {organization_id}/products/* y {organization_id}/brand/* sin traversal ni cruce de organización', () => {
    const rutaProducto = construirRutaVitrinaMedia({
      organizationId: ORG_ID_A,
      folder: 'products',
      extension: 'webp',
      fileId: 'shampoo-velvet-01',
    });
    expect(rutaProducto).toBe(`${ORG_ID_A}/products/shampoo-velvet-01.webp`);

    const validaPropia = validarRutaObjetoVitrinaMedia(rutaProducto, ORG_ID_A);
    expect(validaPropia).toEqual({
      ok: true,
      organizationId: ORG_ID_A,
      folder: 'products',
      fileName: 'shampoo-velvet-01.webp',
      path: rutaProducto,
    });

    // Intento de operar sobre el prefijo de otra organización
    const cruceOrg = validarRutaObjetoVitrinaMedia(rutaProducto, ORG_ID_B);
    expect(cruceOrg.ok).toBe(false);

    // Intento de traversal o subcarpeta no autorizada
    expect(validarRutaObjetoVitrinaMedia(`${ORG_ID_A}/products/../secret.png`, ORG_ID_A).ok).toBe(
      false
    );
    expect(validarRutaObjetoVitrinaMedia(`${ORG_ID_A}/avatars/foto.png`, ORG_ID_A).ok).toBe(false);

    const urlPublica = `https://xyzcompany.supabase.co/storage/v1/object/public/${VITRINA_MEDIA_BUCKET}/${ORG_ID_A}/brand/logo-velvet.png`;
    expect(extraerRutaVitrinaMediaDesdeUrl(urlPublica)).toBe(
      `${ORG_ID_A}/brand/logo-velvet.png`
    );
  });

  it('protege POST y DELETE /api/storage/vitrina por rol owner|manager, cabeceras binarias y aislamiento de organización', async () => {
    // 1. Specialist bloqueado con 403
    mockRequireOrgAccess.mockResolvedValueOnce({
      response: Response.json({ error: 'Permisos insuficientes' }, { status: 403 }),
    });

    const fdSpecialist = new FormData();
    fdSpecialist.set('organizationId', ORG_ID_A);
    fdSpecialist.set('folder', 'products');
    fdSpecialist.set('file', new Blob([PNG_MINIMO], { type: 'image/png' }), 'prod.png');

    const res403 = await uploadVitrinaMedia(
      new Request('http://localhost/api/storage/vitrina', {
        method: 'POST',
        body: fdSpecialist,
      })
    );
    expect(res403.status).toBe(403);
    expect(mockRequireOrgAccess).toHaveBeenCalledWith({
      organizationId: ORG_ID_A,
      allowedRoles: ['owner', 'manager'],
    });

    // 2. Owner con archivo falsificado (SVG con MIME image/png) -> 400 sin tocar Storage
    const mockUpload = vi.fn();
    mockRequireOrgAccess.mockResolvedValueOnce({
      user: { id: 'user-owner' },
      membership: { organizationId: ORG_ID_A, role: 'owner' },
      supabase: {
        storage: {
          from: () => ({ upload: mockUpload }),
        },
      },
      response: null,
    });
    mockCheckRateLimit.mockResolvedValueOnce({ ok: true });

    const fdSpoof = new FormData();
    fdSpoof.set('organizationId', ORG_ID_A);
    fdSpoof.set('folder', 'brand');
    fdSpoof.set(
      'file',
      new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/png' }),
      'falso.png'
    );

    const res400 = await uploadVitrinaMedia(
      new Request('http://localhost/api/storage/vitrina', {
        method: 'POST',
        body: fdSpoof,
      })
    );
    expect(res400.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();

    // 3. Subida válida de owner -> 201 bajo {organization_id}/products/*.png
    mockUpload.mockResolvedValueOnce({ error: null });
    mockRequireOrgAccess.mockResolvedValueOnce({
      user: { id: 'user-owner' },
      membership: { organizationId: ORG_ID_A, role: 'owner' },
      supabase: {
        storage: {
          from: (bucket: string) => ({
            upload: mockUpload,
            getPublicUrl: (objectPath: string) => ({
              data: {
                publicUrl: `https://xyzcompany.supabase.co/storage/v1/object/public/${bucket}/${objectPath}`,
              },
            }),
          }),
        },
      },
      response: null,
    });
    mockCheckRateLimit.mockResolvedValueOnce({ ok: true });

    const fdValido = new FormData();
    fdValido.set('organizationId', ORG_ID_A);
    fdValido.set('folder', 'products');
    fdValido.set('file', new Blob([PNG_MINIMO], { type: 'image/png' }), 'shampoo.png');

    const res201 = await uploadVitrinaMedia(
      new Request('http://localhost/api/storage/vitrina', {
        method: 'POST',
        body: fdValido,
      })
    );
    expect(res201.status).toBe(201);
    const json201 = (await res201.json()) as { ok: boolean; path: string; url: string };
    expect(json201.ok).toBe(true);
    expect(json201.path.startsWith(`${ORG_ID_A}/products/`)).toBe(true);
    expect(json201.path.endsWith('.png')).toBe(true);

    // 4. DELETE bloquea intento de borrar archivo de otra organización (403)
    const mockRemove = vi.fn();
    mockRequireOrgAccess.mockResolvedValueOnce({
      user: { id: 'user-owner' },
      membership: { organizationId: ORG_ID_A, role: 'owner' },
      supabase: {
        storage: {
          from: () => ({ remove: mockRemove }),
        },
      },
      response: null,
    });

    const resDelAjeno = await deleteVitrinaMedia(
      new Request('http://localhost/api/storage/vitrina', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: ORG_ID_A,
          path: `${ORG_ID_B}/brand/logo-ajeno.png`,
        }),
      })
    );
    expect(resDelAjeno.status).toBe(403);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe('3. Guardias reales de rol specialist y proyección operativa en Silla (/)', () => {
  it('oculta /reportes, /configuracion/precios, /planes y administración de /vitrina para specialist', () => {
    const tabsSpecialist = obtenerTabsNavegacionPorRol('specialist').map((t) => t.href);
    expect(tabsSpecialist).toEqual(['/', '/agenda', '/clientas']);
    expect(tabsSpecialist).not.toContain('/reportes');
    expect(tabsSpecialist).not.toContain('/configuracion/precios');
    expect(tabsSpecialist).not.toContain('/vitrina');

    expect(mostrarAccesoPlanesPorRol('specialist')).toBe(false);
    expect(mostrarAccesoPlanesPorRol('manager')).toBe(true);
    expect(mostrarAccesoPlanesPorRol('owner')).toBe(true);

    expect(mostrarAdministracionVitrinaPorRol('specialist')).toBe(false);
    expect(mostrarAdministracionVitrinaPorRol('manager')).toBe(true);
    expect(mostrarAdministracionVitrinaPorRol('owner')).toBe(true);

    expect(esRutaRestringidaParaSpecialist('/reportes')).toBe(true);
    expect(esRutaRestringidaParaSpecialist('/configuracion/precios')).toBe(true);
    expect(esRutaRestringidaParaSpecialist('/planes/confirmacion')).toBe(true);
    expect(esRutaRestringidaParaSpecialist('/vitrina')).toBe(true);
    expect(esRutaRestringidaParaSpecialist('/vitrina/pedidos')).toBe(true);
    expect(esRutaRestringidaParaSpecialist('/agenda')).toBe(false);

    expect(resolverRedireccionPorRol('/reportes', 'specialist')).toBe(SPECIALIST_FALLBACK_ROUTE);
    expect(resolverRedireccionPorRol('/configuracion/precios', 'specialist')).toBe('/agenda');
    expect(resolverRedireccionPorRol('/vitrina', 'specialist')).toBe('/agenda');
    expect(resolverRedireccionPorRol('/vitrina', 'manager')).toBeNull();
    expect(resolverRedireccionPorRol('/reportes', 'owner')).toBeNull();
  });

  it('bloquea en servidor el acceso directo de specialist a /vitrina mediante VitrinaProtectedLayout', async () => {
    const construirSupabaseMembresia = (role: 'owner' | 'manager' | 'specialist') => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'usr-vitrina-1' } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: 'mem-vit-1',
                      organization_id: ORG_ID_A,
                      user_id: 'usr-vitrina-1',
                      role,
                      active: true,
                      created_at: '2026-11-28T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockCreateServerClient.mockResolvedValueOnce(construirSupabaseMembresia('specialist'));
    await expect(VitrinaProtectedLayout({ children: 'panel-vitrina' })).rejects.toThrow(
      'NEXT_REDIRECT:/agenda'
    );
    expect(mockRedirect).toHaveBeenCalledWith('/agenda');

    mockRedirect.mockClear();
    mockCreateServerClient.mockResolvedValueOnce(construirSupabaseMembresia('manager'));
    await expect(VitrinaProtectedLayout({ children: 'panel-vitrina' })).resolves.toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirige en servidor a /agenda cuando un specialist entra directo a rutas financieras', async () => {
    const construirSupabaseMembresia = (role: 'owner' | 'manager' | 'specialist') => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'usr-1' } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: 'mem-1',
                      organization_id: ORG_ID_A,
                      user_id: 'usr-1',
                      role,
                      active: true,
                      created_at: '2026-11-26T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockCreateServerClient.mockResolvedValueOnce(construirSupabaseMembresia('specialist'));
    await expect(protegerRutaSoloAdminEnServidor()).rejects.toThrow('NEXT_REDIRECT:/agenda');
    expect(mockRedirect).toHaveBeenCalledWith('/agenda');

    mockRedirect.mockClear();
    mockCreateServerClient.mockResolvedValueOnce(construirSupabaseMembresia('owner'));
    await expect(protegerRutaSoloAdminEnServidor()).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('consume cotizaciones_operativas_silla y crear_cotizacion_operativa_silla sin exponer costos químicos, márgenes ni fórmulas', async () => {
    const filaConCamposSensiblesSimulados = {
      id: '33333333-3333-4333-8333-333333333333',
      organization_id: ORG_ID_A,
      clienta_id: '44444444-4444-4444-8444-444444444444',
      estilista_id: '55555555-5555-4555-8555-555555555555',
      estilista_nombre: 'Camila',
      servicio_id: '66666666-6666-4666-8666-666666666666',
      servicio_nombre: 'Balayage Velvet',
      variables: { largo: 'largo' },
      precio_calculado: 240000,
      precio_cotizado: 240000,
      moneda: 'COP',
      vigencia_hasta: '2026-12-05',
      estado: 'enviada',
      enviada_at: '2026-11-26T15:00:00Z',
      con_marca_velli: true,
      token_publico: '77777777-7777-4777-8777-777777777777',
      created_at: '2026-11-26T15:00:00Z',
      updated_at: '2026-11-26T15:00:00Z',
      // Aunque un mock malicioso incluyera campos financieros internos, el mapeador operativo los descarta
      costo_producto_estimado: 48500,
      costo_detalle: { gramos: 90 },
      comision_estimada: 76600,
      comision_detalle: { valor: 40 },
      formula: { tono: '9.1' },
    };

    const mockRpc = vi.fn(async (fnName: string) => {
      if (fnName === 'cotizaciones_operativas_silla') {
        return { data: [filaConCamposSensiblesSimulados], error: null };
      }
      if (fnName === 'crear_cotizacion_operativa_silla') {
        return { data: [filaConCamposSensiblesSimulados], error: null };
      }
      return { data: null, error: { message: `RPC inesperada ${fnName}` } };
    });

    const fakeClient = { rpc: mockRpc } as unknown as SupabaseClient;

    const lista = await listarCotizacionesOperativasSilla(ORG_ID_A, {
      soloPorCobrar: true,
      client: fakeClient,
    });
    expect(mockRpc).toHaveBeenCalledWith('cotizaciones_operativas_silla', {
      p_org_id: ORG_ID_A,
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].precioCotizado).toBe(240000);
    expect(lista[0].costoProductoEstimado).toBeUndefined();
    expect(lista[0].costoDetalle).toBeUndefined();
    expect(lista[0].comisionEstimada).toBeUndefined();
    expect(lista[0].comisionDetalle).toBeUndefined();
    expect(lista[0].formula).toBeUndefined();

    const creada = await crearCotizacionOperativaSilla(
      ORG_ID_A,
      {
        servicioNombre: 'Balayage Velvet',
        variables: { largo: { valor: 'largo', origen: 'manual' } },
        precioCalculado: 240000,
        precioCotizado: 240000,
        vigenciaHasta: '2026-12-05',
      },
      fakeClient
    );
    expect(mockRpc).toHaveBeenCalledWith(
      'crear_cotizacion_operativa_silla',
      expect.objectContaining({
        p_org_id: ORG_ID_A,
        p_servicio_nombre: 'Balayage Velvet',
        p_precio_cotizado: 240000,
      })
    );
    expect(creada.costoProductoEstimado).toBeUndefined();
    expect(creada.comisionEstimada).toBeUndefined();
    expect(creada.formula).toBeUndefined();
  });
});

describe('4. OpenGraph dinámico, SEO e invariantes de privacidad en /s/[slug] vs /c/[token]', () => {
  it('genera metadatos index, follow con OpenGraph y Twitter proyectando solo campos públicos y filtrando campos privados', () => {
    const noEncontrada = construirMetadataVitrinaPublica(null);
    expect(noEncontrada.robots).toEqual({ index: false, follow: false });

    const logoSeguro = `https://xyzcompany.supabase.co/storage/v1/object/public/${VITRINA_MEDIA_BUCKET}/${ORG_ID_A}/brand/logo.webp`;
    const contaminado = {
      organization: {
        id: ORG_ID_A,
        slug: 'atelier-velvet-medellin',
        name: 'Atelier Velvet',
        city: 'Medellín',
        vertical: 'hair_studio',
        conMarcaVelli: true,
        whatsappPhone: '3009998877',
        comision_estimada: 89000,
      },
      brand: {
        organizationId: ORG_ID_A,
        displayName: 'Atelier Velvet Studio',
        logoUrl: logoSeguro,
        primaryColor: '#3B0D1E',
        accentColor: '#E8CFC8',
        publicTagline: 'Colorimetría de autor y cuidado capilar en El Poblado.',
        legalFooter: 'Precios en COP.',
        customDomain: 'interno.privado.local',
      },
      services: [
        {
          id: 'srv-1',
          name: 'Diseño de Rubios',
          category: 'decoloracion',
          durationMinutes: 210,
          priceCop: 280000,
          sortOrder: 0,
          costo_producto_estimado: 51200,
          formula: { tono: '10.21' },
        },
      ],
      products: [],
    } as unknown as PublicStorefrontData;

    const metadata = construirMetadataVitrinaPublica(contaminado);

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe('Atelier Velvet Studio · Medellín | Servicios y Tienda');
    expect(metadata.description).toBe(
      'Colorimetría de autor y cuidado capilar en El Poblado.'
    );
    expect(metadata.alternates?.canonical).toBe(`${APP_URL}/s/atelier-velvet-medellin`);
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      url: `${APP_URL}/s/atelier-velvet-medellin`,
      title: 'Atelier Velvet Studio · Medellín | Servicios y Tienda',
      siteName: 'Atelier Velvet Studio',
      locale: 'es_CO',
      images: [{ url: logoSeguro, alt: 'Identidad visual de Atelier Velvet Studio' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [logoSeguro],
    });

    const serializado = JSON.stringify(metadata);
    for (const campoProhibido of CAMPOS_PRIVADOS_PROHIBIDOS) {
      expect(serializado).not.toContain(campoProhibido);
    }
    expect(serializado).not.toContain('interno.privado.local');
    expect(serializado).not.toContain('3009998877');
    expect(serializado).not.toContain('51200');
    expect(serializado).not.toContain('10.21');

    // Rechaza esquemas peligrosos en logo_url (ej. javascript:)
    const conLogoPeligroso: PublicStorefrontData = {
      organization: {
        id: ORG_ID_A,
        slug: 'atelier-velvet',
        name: 'Atelier Velvet',
        city: 'Bogotá',
        vertical: 'hair_studio',
        conMarcaVelli: true,
      },
      brand: {
        organizationId: ORG_ID_A,
        displayName: 'Atelier Velvet',
        logoUrl: 'javascript:alert(1)',
        primaryColor: '#3B0D1E',
        accentColor: '#E8CFC8',
        publicTagline: null,
        legalFooter: null,
      },
      services: [],
      products: [],
    };
    const metaSinImagenInsegura = construirMetadataVitrinaPublica(conLogoPeligroso);
    expect(JSON.stringify(metaSinImagenInsegura)).not.toContain('javascript:');
  });

  it('mantiene noindex, nofollow + no-store estrictamente en /c/:path* y permite indexación en /s/:path*', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const reglas = await nextConfig.headers!();

    const reglaCotizacionToken = reglas.find((r) => r.source === '/c/:path*');
    expect(reglaCotizacionToken).toBeDefined();
    expect(reglaCotizacionToken!.headers).toEqual(
      expect.arrayContaining([
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ])
    );

    const reglaVitrina = reglas.find((r) => r.source === '/s/:path*');
    if (reglaVitrina) {
      const robotsHeader = reglaVitrina.headers.find(
        (h) => h.key.toLowerCase() === 'x-robots-tag'
      );
      expect(robotsHeader?.value ?? '').not.toContain('noindex');
    }
  });
});
