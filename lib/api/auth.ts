import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  ORG_ROLES,
  hasOrgRole,
  obtenerMembresiaActiva,
  type OrgRole,
  type OrganizationMemberRecord,
} from '@/lib/organizations';

export type RequireUserResult =
  | { user: User; supabase: SupabaseClient; response?: never }
  | { response: Response; user?: never; supabase?: never };

export type RequireOrgAccessResult =
  | {
      user: User;
      supabase: SupabaseClient;
      membership: OrganizationMemberRecord;
      response?: never;
    }
  | {
      response: Response;
      user?: never;
      supabase?: never;
      membership?: never;
    };

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: Response.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }
  return { user, supabase };
}

/**
 * Valida sesión autenticada + pertenencia activa a una organización + rol RBAC.
 * Si no se pasa `organizationId`, resuelve la organización activa principal del usuario.
 */
export async function requireOrgAccess(options?: {
  organizationId?: string;
  allowedRoles?: readonly OrgRole[];
}): Promise<RequireOrgAccessResult> {
  const auth = await requireUser();
  if (auth.response) {
    return { response: auth.response };
  }

  const membership = await obtenerMembresiaActiva(
    auth.supabase,
    auth.user.id,
    options?.organizationId
  );

  const rolesPermitidos = options?.allowedRoles ?? ORG_ROLES;
  if (!hasOrgRole(membership, rolesPermitidos, options?.organizationId) || !membership) {
    return {
      response: Response.json(
        { error: 'Sin permisos suficientes en esta organización' },
        { status: 403 }
      ),
    };
  }

  return {
    user: auth.user,
    supabase: auth.supabase,
    membership,
  };
}
