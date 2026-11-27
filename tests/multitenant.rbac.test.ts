import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import {
  ORG_ROLES,
  VELVET_DEFAULT_ACCENT_COLOR,
  VELVET_DEFAULT_PRIMARY_COLOR,
  canAssignMemberRole,
  canCalibrateCosts,
  canPerformOrgAction,
  canViewNetProfitReports,
  esOrgRole,
  generarSlugOrganizacion,
  hasOrgRole,
  normalizarDominioPersonalizado,
  normalizarHexVelvet,
  obtenerBrandSettingsOrganizacion,
  projectQuoteForRole,
  proyectarBrandPublico,
  resolverBrandSettings,
  type MemberContext,
} from '@/lib/organizations';
import {
  REGLAS_COLORIMETRIA_CLINICAL,
  VERTICAL_POR_DEFECTO,
  evaluarHairClinicalPack,
  evaluarVerticalPacks,
  flagsActivos,
  hairClinicalPackActivo,
  normalizarVerticalSalon,
  parsearPacksEntorno,
} from '@/lib/flags';
import { requireOrgAccess } from '@/lib/api/auth';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('1. Multi-Tenant RBAC: permisos por rol (owner vs manager vs specialist)', () => {
  const owner: MemberContext = { organizationId: 'org-1', role: 'owner', active: true };
  const manager: MemberContext = { organizationId: 'org-1', role: 'manager', active: true };
  const specialist: MemberContext = { organizationId: 'org-1', role: 'specialist', active: true };
  const inactivo: MemberContext = { organizationId: 'org-1', role: 'owner', active: false };

  it('reconoce únicamente los 3 roles válidos del modelo RBAC', () => {
    expect(ORG_ROLES).toEqual(['owner', 'manager', 'specialist']);
    expect(esOrgRole('owner')).toBe(true);
    expect(esOrgRole('manager')).toBe(true);
    expect(esOrgRole('specialist')).toBe(true);
    expect(esOrgRole('admin')).toBe(false);
    expect(esOrgRole(null)).toBe(false);
  });

  it('owner posee control total administrativo, financiero y operativo en su organización', () => {
    expect(canPerformOrgAction(owner, 'org:manage_billing', 'org-1')).toBe(true);
    expect(canPerformOrgAction(owner, 'org:delete', 'org-1')).toBe(true);
    expect(canPerformOrgAction(owner, 'members:manage_managers', 'org-1')).toBe(true);
    expect(canPerformOrgAction(owner, 'members:manage_specialists', 'org-1')).toBe(true);
    expect(canPerformOrgAction(owner, 'brand:edit', 'org-1')).toBe(true);
    expect(canCalibrateCosts(owner, 'org-1')).toBe(true);
    expect(canViewNetProfitReports(owner, 'org-1')).toBe(true);
    expect(canPerformOrgAction(owner, 'workspace:quote_in_chair', 'org-1')).toBe(true);

    expect(canAssignMemberRole(owner, 'owner', 'org-1')).toBe(true);
    expect(canAssignMemberRole(owner, 'manager', 'org-1')).toBe(true);
    expect(canAssignMemberRole(owner, 'specialist', 'org-1')).toBe(true);
  });

  it('manager puede calibrar costos, ver utilidad neta y editar marca, pero no facturación ni escalar a owner/manager', () => {
    expect(canCalibrateCosts(manager, 'org-1')).toBe(true);
    expect(canViewNetProfitReports(manager, 'org-1')).toBe(true);
    expect(canPerformOrgAction(manager, 'commissions:manage', 'org-1')).toBe(true);
    expect(canPerformOrgAction(manager, 'brand:edit', 'org-1')).toBe(true);
    expect(canPerformOrgAction(manager, 'members:manage_specialists', 'org-1')).toBe(true);
    expect(canPerformOrgAction(manager, 'workspace:quote_in_chair', 'org-1')).toBe(true);

    expect(canPerformOrgAction(manager, 'org:manage_billing', 'org-1')).toBe(false);
    expect(canPerformOrgAction(manager, 'org:delete', 'org-1')).toBe(false);
    expect(canPerformOrgAction(manager, 'members:manage_managers', 'org-1')).toBe(false);

    expect(canAssignMemberRole(manager, 'specialist', 'org-1')).toBe(true);
    expect(canAssignMemberRole(manager, 'manager', 'org-1')).toBe(false);
    expect(canAssignMemberRole(manager, 'owner', 'org-1')).toBe(false);
  });

  it('specialist opera en silla pero tiene bloqueados utilidad neta, costos químicos, comisiones y marca', () => {
    expect(canPerformOrgAction(specialist, 'workspace:quote_in_chair', 'org-1')).toBe(true);
    expect(canPerformOrgAction(specialist, 'clients:read_write', 'org-1')).toBe(true);
    expect(canPerformOrgAction(specialist, 'clinical:diagnose', 'org-1')).toBe(true);

    expect(canViewNetProfitReports(specialist, 'org-1')).toBe(false);
    expect(canCalibrateCosts(specialist, 'org-1')).toBe(false);
    expect(canPerformOrgAction(specialist, 'commissions:manage', 'org-1')).toBe(false);
    expect(canPerformOrgAction(specialist, 'brand:edit', 'org-1')).toBe(false);
    expect(canPerformOrgAction(specialist, 'clients:delete', 'org-1')).toBe(false);
    expect(canPerformOrgAction(specialist, 'org:manage_billing', 'org-1')).toBe(false);
    expect(canAssignMemberRole(specialist, 'specialist', 'org-1')).toBe(false);
  });

  it('aisla estrictamente entre organizaciones y revoca todo permiso a miembros inactivos', () => {
    expect(hasOrgRole(owner, ['owner'], 'org-otra')).toBe(false);
    expect(canViewNetProfitReports(owner, 'org-otra')).toBe(false);
    expect(canCalibrateCosts(manager, 'org-otra')).toBe(false);

    expect(hasOrgRole(inactivo, ['owner'], 'org-1')).toBe(false);
    expect(canViewNetProfitReports(inactivo, 'org-1')).toBe(false);
    expect(canPerformOrgAction(inactivo, 'workspace:quote_in_chair', 'org-1')).toBe(false);
    expect(hasOrgRole(null, ['owner'])).toBe(false);
  });

  it('redacta costos internos, fórmulas y comisiones al proyectar cotizaciones para specialist', () => {
    const cotizacionCompleta = {
      id: 'cot-101',
      servicioNombre: 'Balayage / Diseño de Rubios',
      precioCotizado: 230000,
      costoProductoEstimado: 42620,
      costoDetalle: { gramosTinte: 90, mlOxidante: 135, insumosFijos: 9500 },
      comisionEstimada: 74952,
      comisionDetalle: { valor: 40, base: 'precio_menos_producto' },
      formula: { tono: '9.1', gramos: 90 },
    };

    const vistaSpecialist = projectQuoteForRole(cotizacionCompleta, specialist) as Record<
      string,
      unknown
    >;
    expect(vistaSpecialist.id).toBe('cot-101');
    expect(vistaSpecialist.precioCotizado).toBe(230000);
    expect(vistaSpecialist.costoProductoEstimado).toBeUndefined();
    expect(vistaSpecialist.costoDetalle).toBeUndefined();
    expect(vistaSpecialist.comisionEstimada).toBeUndefined();
    expect(vistaSpecialist.comisionDetalle).toBeUndefined();
    expect(vistaSpecialist.formula).toBeUndefined();

    const vistaOwner = projectQuoteForRole(cotizacionCompleta, owner);
    const vistaManager = projectQuoteForRole(cotizacionCompleta, manager);
    expect(vistaOwner).toEqual(cotizacionCompleta);
    expect(vistaManager).toEqual(cotizacionCompleta);
  });

  it('requireOrgAccess bloquea con 401 sin sesión y 403 cuando un specialist intenta entrar a ruta financiera', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const sinSesion = await requireOrgAccess({
      organizationId: 'org-1',
      allowedRoles: ['owner', 'manager'],
    });
    expect(sinSesion.response?.status).toBe(401);

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-spec-1' } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: 'mem-1',
                      organization_id: 'org-1',
                      user_id: 'user-spec-1',
                      role: 'specialist',
                      active: true,
                      created_at: '2026-11-25T00:00:00Z',
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

    const denegado = await requireOrgAccess({
      organizationId: 'org-1',
      allowedRoles: ['owner', 'manager'],
    });
    expect(denegado.response?.status).toBe(403);

    const permitidoEnSilla = await requireOrgAccess({
      organizationId: 'org-1',
      allowedRoles: ['owner', 'manager', 'specialist'],
    });
    expect(permitidoEnSilla.response).toBeUndefined();
    expect(permitidoEnSilla.membership?.role).toBe('specialist');
  });
});

describe('2. Brand Settings: resolución, sanitización Velvet Studio y proyección pública', () => {
  it('resuelve brand_settings completos con normalización de hex y dominio personalizado', () => {
    const resuelto = resolverBrandSettings({
      organizationId: 'org-atelier',
      displayName: '  Atelier Velvet Bogotá  ',
      logoUrl: 'https://cdn.ejemplo.co/logo.png',
      primaryColor: '#52142b',
      accentColor: '#e8cfc8',
      customDomain: 'https://Reservas.AtelierVelvet.co/agenda',
      publicTagline: 'Colorimetría de precisión sin sorpresas',
      legalFooter: 'Atelier Velvet SAS · NIT 901.000.000-1',
    });

    expect(resuelto).toEqual({
      organizationId: 'org-atelier',
      displayName: 'Atelier Velvet Bogotá',
      logoUrl: 'https://cdn.ejemplo.co/logo.png',
      primaryColor: '#52142B',
      accentColor: '#E8CFC8',
      customDomain: 'reservas.ateliervelvet.co',
      publicTagline: 'Colorimetría de precisión sin sorpresas',
      legalFooter: 'Atelier Velvet SAS · NIT 901.000.000-1',
    });

    const publico = proyectarBrandPublico(resuelto);
    expect(publico).not.toHaveProperty('customDomain');
    expect(publico.primaryColor).toBe('#52142B');
  });

  it('aplica fallback seguro Velvet Studio (#3B0D1E / #E8CFC8) ante negro puro, verde legado o inyección CSS', () => {
    expect(normalizarHexVelvet('#000000')).toBe(VELVET_DEFAULT_PRIMARY_COLOR);
    expect(normalizarHexVelvet('#2D5A27')).toBe(VELVET_DEFAULT_PRIMARY_COLOR);
    expect(normalizarHexVelvet('red; background:url(evil)')).toBe(VELVET_DEFAULT_PRIMARY_COLOR);
    expect(normalizarHexVelvet(undefined)).toBe(VELVET_DEFAULT_PRIMARY_COLOR);
    expect(normalizarHexVelvet(null, VELVET_DEFAULT_ACCENT_COLOR)).toBe(
      VELVET_DEFAULT_ACCENT_COLOR
    );
    expect(normalizarDominioPersonalizado('javascript:alert(1)')).toBeNull();

    const fallback = resolverBrandSettings(null, {
      organizationId: 'org-legacy',
      nombreSalon: 'Salón Clásico',
      colorPrimario: '#2D5A27',
    });
    expect(fallback.displayName).toBe('Salón Clásico');
    expect(fallback.primaryColor).toBe('#111111');
    expect(fallback.accentColor).toBe('#F4F4F5');
  });

  it('genera slugs deterministas sin tildes ni caracteres especiales y consulta brand_settings desde Supabase', async () => {
    expect(
      generarSlugOrganizacion('Salón María & Cía. · Medellín!', '550e8400-e29b-41d4-a716-446655440000')
    ).toBe('salon-maria-cia-medellin-550e8400');
    expect(generarSlugOrganizacion('   ', 'abcdef12-0000')).toBe('salon-abcdef12');

    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                organization_id: 'org-2',
                display_name: 'Casa Ciruela',
                logo_url: null,
                primary_color: '#3B0D1E',
                accent_color: '#E8CFC8',
                custom_domain: null,
                public_tagline: 'Alta peluquería',
                legal_footer: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const desdeDb = await obtenerBrandSettingsOrganizacion(mockClient, 'org-2');
    expect(desdeDb.displayName).toBe('Casa Ciruela');
    expect(desdeDb.primaryColor).toBe('#3B0D1E');
    expect(desdeDb.publicTagline).toBe('Alta peluquería');
  });
});

describe('3. Vertical Packs: activación y desactivación de hair_clinical_pack', () => {
  it('mantiene hair_studio por defecto en cuentas existentes activando diagnóstico, CO-01..CO-10 y visagismo', () => {
    expect(VERTICAL_POR_DEFECTO).toBe('hair_studio');
    expect(normalizarVerticalSalon(undefined)).toBe('hair_studio');
    expect(normalizarVerticalSalon(null)).toBe('hair_studio');

    const porDefecto = evaluarHairClinicalPack();
    expect(porDefecto.verticalEfectiva).toBe('hair_studio');
    expect(porDefecto.packActivo).toBe(true);
    expect(porDefecto.diagnosticoCapilar).toBe(true);
    expect(porDefecto.colorimetria).toBe(true);
    expect(porDefecto.reglasColorimetria).toEqual(REGLAS_COLORIMETRIA_CLINICAL);
    expect(porDefecto.reglasColorimetria).toHaveLength(10);
    expect(porDefecto.reglasColorimetria[0]).toBe('CO-01');
    expect(porDefecto.reglasColorimetria[9]).toBe('CO-10');
    expect(porDefecto.visagismo).toBe(true);

    // No altera el mapa existente de `flagsActivos()`
    vi.stubEnv('NEXT_PUBLIC_VELLI_FLAGS', '');
    expect(flagsActivos()).not.toHaveProperty('hair_clinical_pack');
  });

  it('desactiva hair_clinical_pack automáticamente en otras verticales cuando el flag no está habilitado', () => {
    for (const vertical of ['nail_bar', 'spa_estetica', 'barber_studio', 'beauty_lounge'] as const) {
      const evaluado = evaluarVerticalPacks({ vertical });
      expect(evaluado.verticalEfectiva).toBe(vertical);
      expect(evaluado.packs.hair_clinical_pack).toBe(false);
      expect(evaluado.hairClinical.diagnosticoCapilar).toBe(false);
      expect(evaluado.hairClinical.colorimetria).toBe(false);
      expect(evaluado.hairClinical.reglasColorimetria).toEqual([]);
      expect(evaluado.hairClinical.visagismo).toBe(false);
    }
  });

  it('permite encender hair_clinical_pack mediante flag de salón o entorno en otra vertical, y apagarlo por override', () => {
    const spaConPackSalon = evaluarHairClinicalPack({
      vertical: 'spa_estetica',
      salonPackOverrides: { hair_clinical_pack: true },
    });
    expect(spaConPackSalon.packActivo).toBe(true);
    expect(spaConPackSalon.diagnosticoCapilar).toBe(true);
    expect(spaConPackSalon.colorimetria).toBe(true);
    expect(spaConPackSalon.reglasColorimetria).toEqual(REGLAS_COLORIMETRIA_CLINICAL);
    expect(spaConPackSalon.visagismo).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_VELLI_FLAGS', 'hair_clinical_pack=on,cortes=off');
    expect(parsearPacksEntorno('hair_clinical_pack=on,cortes=off')).toEqual({
      hair_clinical_pack: true,
    });
    const nailConEnvFlag = hairClinicalPackActivo({ vertical: 'nail_bar' });
    expect(nailConEnvFlag.packActivo).toBe(true);

    // El override explícito de la organización/salón gana sobre el entorno y sobre hair_studio
    const apagadoExplicito = hairClinicalPackActivo({
      vertical: 'hair_studio',
      salonPackOverrides: { hair_clinical_pack: false },
    });
    expect(apagadoExplicito.packActivo).toBe(false);
    expect(apagadoExplicito.reglasColorimetria).toEqual([]);
  });
});

describe('4. Migración SQL Multi-Tenant y RLS (supabase/migration-multitenant-rbac.sql)', () => {
  const candidatos = [
    path.resolve(__dirname, '../supabase/migration-multitenant-rbac.sql'),
    path.resolve(__dirname, '../supabase/_archive/migration-multitenant-rbac.sql'),
  ];
  const ruta = candidatos.find((c) => existsSync(c));
  if (!ruta) {
    throw new Error('No se encontró migration-multitenant-rbac.sql en supabase/');
  }
  const sql = readFileSync(ruta, 'utf8');

  it('crea organizations, organization_members y brand_settings de forma idempotente y sin SQL destructivo', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.organizations\b/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.organization_members\b/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.brand_settings\b/);
    expect(sql).toMatch(/DEFAULT 'hair_studio'/);
    expect(sql).toMatch(/role IN \('owner', 'manager', 'specialist'\)/);

    // Ningún CREATE TABLE sin IF NOT EXISTS ni comandos destructivos en sentencias SQL
    const sqlSinComentarios = sql.replace(/--.*$/gm, '');
    expect(sqlSinComentarios.match(/^CREATE TABLE (?!IF NOT EXISTS)/gm)).toBeNull();
    expect(sqlSinComentarios).not.toMatch(/\bDROP TABLE\b/i);
    expect(sqlSinComentarios).not.toMatch(/\bTRUNCATE\b/i);

    // Cada CREATE POLICY estático tiene su DROP POLICY IF EXISTS previo
    const policies = [...sql.matchAll(/CREATE POLICY (\w+)/g)].map((m) => m[1]);
    expect(policies.length).toBeGreaterThanOrEqual(12);
    for (const p of policies) {
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS ${p}\\b`));
    }
  });

  it('habilita RLS, define current_user_org_ids() y has_org_role(), e incluye backfill a owner', () => {
    expect(sql).toMatch(/ALTER TABLE public\.organizations ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.organization_members ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.brand_settings ENABLE ROW LEVEL SECURITY/);

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.current_user_org_ids\(\)/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.has_org_role\(org_id uuid, roles text\[\]\)/
    );

    // Backfill idempotente hacia organizations, organization_members ('owner') y brand_settings
    expect(sql).toMatch(/INSERT INTO public\.organizations[\s\S]*?ON CONFLICT \(id\) DO NOTHING/);
    expect(sql).toMatch(
      /INSERT INTO public\.organization_members[\s\S]*?'owner'[\s\S]*?ON CONFLICT \(organization_id, user_id\) DO NOTHING/
    );
    expect(sql).toMatch(
      /INSERT INTO public\.brand_settings[\s\S]*?ON CONFLICT \(organization_id\) DO NOTHING/
    );
  });

  it('restringe costos químicos, comisiones y reportes de utilidad neta exclusivamente a owner y manager', () => {
    expect(sql).toMatch(
      /CREATE POLICY productos_salon_select_admin[\s\S]*?has_org_role\(COALESCE\(organization_id, user_id\), ARRAY\['owner', 'manager'\]\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY comisiones_select_admin[\s\S]*?has_org_role\(COALESCE\(organization_id, user_id\), ARRAY\['owner', 'manager'\]\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY cotizaciones_select_admin[\s\S]*?has_org_role\(COALESCE\(organization_id, user_id\), ARRAY\['owner', 'manager'\]\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY cotizacion_eventos_select_admin[\s\S]*?has_org_role\(COALESCE\(organization_id, user_id\), ARRAY\['owner', 'manager'\]\)/
    );
    expect(sql).toMatch(
      /FUNCTION public\.resumen_utilidad_neta_org[\s\S]*?IF NOT public\.has_org_role\(p_org_id, ARRAY\['owner', 'manager'\]\)/
    );
  });
});
