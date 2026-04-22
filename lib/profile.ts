import { createClient } from '@/lib/supabase/client';

export interface Profile {
  id: string;
  nombre: string;
  nombreNegocio?: string;
  telefono?: string;
  ciudad?: string;
}

type ProfileRow = {
  id: string;
  nombre: string;
  nombre_negocio: string | null;
  telefono: string | null;
  ciudad: string | null;
};

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    nombre: r.nombre,
    nombreNegocio: r.nombre_negocio ?? undefined,
    telefono: r.telefono ?? undefined,
    ciudad: r.ciudad ?? undefined,
  };
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

export async function updateProfile(updates: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const patch: Partial<ProfileRow> = {};
  if (updates.nombre !== undefined) patch.nombre = updates.nombre;
  if (updates.nombreNegocio !== undefined) patch.nombre_negocio = updates.nombreNegocio || null;
  if (updates.telefono !== undefined) patch.telefono = updates.telefono || null;
  if (updates.ciudad !== undefined) patch.ciudad = updates.ciudad || null;

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToProfile(data);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
