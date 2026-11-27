import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { obtenerMembresiaActiva, type OrganizationMemberRecord } from './index';
import { SPECIALIST_FALLBACK_ROUTE } from './navegacion';

/**
 * Obtiene la membresía activa del usuario autenticado en el servidor.
 * Si la tabla `organization_members` aún no existe en el entorno, retorna `null`
 * sin interrumpir la carga.
 */
export async function obtenerMembresiaActivaServidor(): Promise<OrganizationMemberRecord | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await obtenerMembresiaActiva(supabase, user.id);
  } catch {
    return null;
  }
}

/**
 * Guardia de servidor para rutas financieras y de calibración (`/reportes`,
 * `/configuracion/precios`, `/planes`). Redirige limpiamente a `/agenda` cuando
 * el usuario autenticado tiene rol `specialist`, evitando pantallas rotas o
 * errores 403 en consola.
 */
export async function protegerRutaSoloAdminEnServidor(
  destinoFallback: string = SPECIALIST_FALLBACK_ROUTE
): Promise<void> {
  const membership = await obtenerMembresiaActivaServidor();
  if (membership?.role === 'specialist') {
    redirect(destinoFallback);
  }
}
