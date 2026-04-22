import { createClient } from '@/lib/supabase/client';

const BUCKET = 'fotos';

function base64ToBlob(dataUrl: string): { blob: Blob; extension: string } {
  const match = dataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!match) throw new Error('Data URL inválida');
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const extension = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  return { blob: new Blob([bytes], { type: mime }), extension };
}

/**
 * Sube una foto en base64 al Storage del usuario autenticado.
 * Si ya es una URL pública (ej. migración o repetición), la devuelve sin tocarla.
 * Ruta: {user_id}/{path}
 */
export async function uploadFoto(dataUrlOrHttp: string, path: string): Promise<string> {
  if (!dataUrlOrHttp) return dataUrlOrHttp;
  if (dataUrlOrHttp.startsWith('http://') || dataUrlOrHttp.startsWith('https://')) {
    return dataUrlOrHttp;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { blob, extension } = base64ToBlob(dataUrlOrHttp);
  const cleanPath = path.replace(/^\/+/, '');
  const fullPath = `${user.id}/${cleanPath}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
  return data.publicUrl;
}

/**
 * Sube un array de fotos y devuelve sus URLs en el mismo orden.
 * Las fallidas se omiten (no rompen el flujo completo).
 */
export async function uploadFotos(dataUrls: string[], basePath: string): Promise<string[]> {
  const results = await Promise.all(
    dataUrls.map((url, i) =>
      uploadFoto(url, `${basePath}/${i}`).catch(() => null)
    )
  );
  return results.filter((u): u is string => !!u);
}
