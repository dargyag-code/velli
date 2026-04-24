import { createClient } from '@/lib/supabase/client';

const BUCKET = 'fotos';
const SIGN_EXPIRY_SECONDS = 60 * 60 * 24 * 365; // 1 año

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

async function signPath(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_EXPIRY_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

// Extrae el path dentro del bucket "fotos" de una URL pública o firmada de Supabase.
// Devuelve null si la URL no corresponde al bucket.
function extractSupabasePath(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/fotos\/([^?]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/**
 * Sube una foto en base64 al Storage del usuario autenticado.
 * Si ya es una URL http(s), la devuelve sin tocarla.
 * Devuelve una SIGNED URL (expira en 1 año).
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

  const signed = await signPath(fullPath);
  if (!signed) throw new Error('No se pudo firmar la URL de la foto');
  return signed;
}

/**
 * Sube un array de fotos y devuelve sus URLs firmadas en el mismo orden.
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

/**
 * Devuelve una URL utilizable para mostrar/descargar una foto:
 * - Si es una URL http(s) de Supabase (pública o firmada), extrae el path y re-firma.
 *   Así funcionan también las URLs públicas antiguas guardadas en BD.
 * - Si es una URL externa (no Supabase), se devuelve tal cual.
 * - Si es un data URL, se devuelve tal cual.
 * - Si es un path del bucket, se firma.
 */
export async function resolveFotoUrl(urlOrPath: string | undefined | null): Promise<string | undefined> {
  if (!urlOrPath) return undefined;
  if (urlOrPath.startsWith('data:')) return urlOrPath;

  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const path = extractSupabasePath(urlOrPath);
    if (!path) return urlOrPath; // URL externa
    const signed = await signPath(path);
    return signed ?? urlOrPath;
  }

  const signed = await signPath(urlOrPath);
  return signed ?? urlOrPath;
}

/** Resuelve un array de URLs; descarta las que fallen. */
export async function resolveFotoUrls(urls: (string | undefined | null)[] | undefined | null): Promise<string[]> {
  if (!urls || urls.length === 0) return [];
  const resolved = await Promise.all(urls.map((u) => resolveFotoUrl(u)));
  return resolved.filter((u): u is string => !!u);
}
