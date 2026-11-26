import type { SupabaseClient } from '@supabase/supabase-js';
import { esOrgRole, type OrganizationMemberRecord } from './rbac';
import {
  resolverBrandSettings,
  type BrandSettingsResolved,
  type LegacySalonBrandFallback,
} from './brand';

export * from './rbac';
export * from './brand';

export async function obtenerMembresiaActiva(
  supabase: SupabaseClient,
  userId: string,
  organizationId?: string
): Promise<OrganizationMemberRecord | null> {
  let query = supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, active, created_at')
    .eq('user_id', userId)
    .eq('active', true);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.order('created_at', { ascending: true }).limit(1);
  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as Record<string, unknown>;
  if (!esOrgRole(row.role)) return null;

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    role: row.role,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

export async function obtenerBrandSettingsOrganizacion(
  supabase: SupabaseClient,
  organizationId: string,
  fallback?: LegacySalonBrandFallback | null
): Promise<BrandSettingsResolved> {
  const { data, error } = await supabase
    .from('brand_settings')
    .select(
      'organization_id, display_name, logo_url, primary_color, accent_color, custom_domain, public_tagline, legal_footer'
    )
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error || !data) {
    return resolverBrandSettings({ organizationId }, fallback);
  }

  const row = data as Record<string, unknown>;
  return resolverBrandSettings(
    {
      organizationId: String(row.organization_id ?? organizationId),
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      logoUrl: typeof row.logo_url === 'string' ? row.logo_url : null,
      primaryColor: typeof row.primary_color === 'string' ? row.primary_color : null,
      accentColor: typeof row.accent_color === 'string' ? row.accent_color : null,
      customDomain: typeof row.custom_domain === 'string' ? row.custom_domain : null,
      publicTagline: typeof row.public_tagline === 'string' ? row.public_tagline : null,
      legalFooter: typeof row.legal_footer === 'string' ? row.legal_footer : null,
    },
    fallback
  );
}

export async function actualizarLogoBrandSettings(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    displayName: string;
    logoUrl: string | null;
  }
): Promise<void> {
  const nombreLimpio = params.displayName.trim().slice(0, 120) || 'Mi Salón';
  const { error } = await supabase.from('brand_settings').upsert(
    {
      organization_id: params.organizationId,
      display_name: nombreLimpio,
      logo_url: params.logoUrl?.trim() || null,
    },
    { onConflict: 'organization_id' }
  );
  if (
    error &&
    error.code !== '42P01' &&
    error.code !== 'PGRST205' &&
    error.code !== 'PGRST202'
  ) {
    throw error;
  }
}
