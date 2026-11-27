// ══════════════════════════════════════════════════════════════════════════
// Reglas puras y utilidades de Supabase Storage (`vitrina-media`)
//
// Espeja las restricciones de `supabase/migration-storage-vitrina.sql`:
// - Bucket público: `vitrina-media`
// - Tamaño máximo: 3 MB (3.145.728 bytes)
// - MIME permitidos: `image/jpeg`, `image/png`, `image/webp`
// - Prefijos obligatorios por organización:
//   - `{organization_id}/products/<archivo>`
//   - `{organization_id}/brand/<archivo>`
// ══════════════════════════════════════════════════════════════════════════

export const VITRINA_MEDIA_BUCKET = 'vitrina-media' as const;

export const MAX_VITRINA_IMAGE_BYTES = 3 * 1024 * 1024; // 3.145.728 B (3 MB)

export const ALLOWED_VITRINA_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type VitrinaAllowedMime = (typeof ALLOWED_VITRINA_MIMES)[number];

export type VitrinaImageExtension = 'jpg' | 'png' | 'webp';

export type VitrinaMediaFolder = 'products' | 'brand';

export const VITRINA_MEDIA_FOLDERS: readonly VitrinaMediaFolder[] = [
  'products',
  'brand',
] as const;

const UUID_SEGMENT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OBJECT_PATH_REGEX =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(products|brand)\/([A-Za-z0-9._-]+)$/i;

const MIME_TO_EXTENSION: Record<VitrinaAllowedMime, VitrinaImageExtension> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function esVitrinaAllowedMime(valor: unknown): valor is VitrinaAllowedMime {
  return (
    typeof valor === 'string' &&
    (ALLOWED_VITRINA_MIMES as readonly string[]).includes(valor.trim().toLowerCase())
  );
}

export function esVitrinaMediaFolder(valor: unknown): valor is VitrinaMediaFolder {
  return (
    typeof valor === 'string' &&
    (VITRINA_MEDIA_FOLDERS as readonly string[]).includes(valor.trim().toLowerCase())
  );
}

/**
 * Inspecciona la cabecera binaria real (magic bytes) del archivo para evitar
 * archivos ejecutables, SVG o HTML renombrados como `.jpg`/`.png`/`.webp`.
 */
export function detectarMimePorMagicBytes(bytes: Uint8Array): VitrinaAllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  return null;
}

export type ResultadoValidacionImagenVitrina =
  | {
      ok: true;
      mimeType: VitrinaAllowedMime;
      extension: VitrinaImageExtension;
    }
  | {
      ok: false;
      error: string;
    };

export function validarArchivoImagenVitrina(params: {
  mimeType: string | null | undefined;
  sizeBytes: number;
  headerBytes?: Uint8Array;
}): ResultadoValidacionImagenVitrina {
  const mimeLimpio = (params.mimeType ?? '').trim().toLowerCase();

  if (!esVitrinaAllowedMime(mimeLimpio)) {
    return {
      ok: false,
      error: 'Formato no permitido. Usa únicamente imágenes JPG, PNG o WebP.',
    };
  }

  if (!Number.isFinite(params.sizeBytes) || params.sizeBytes <= 0) {
    return {
      ok: false,
      error: 'El archivo de imagen está vacío o es inválido.',
    };
  }

  if (params.sizeBytes > MAX_VITRINA_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'La imagen supera el límite máximo de 3 MB.',
    };
  }

  if (params.headerBytes) {
    const detectado = detectarMimePorMagicBytes(params.headerBytes);
    if (!detectado || detectado !== mimeLimpio) {
      return {
        ok: false,
        error: 'El contenido del archivo no coincide con una imagen JPG, PNG o WebP válida.',
      };
    }
  }

  return {
    ok: true,
    mimeType: mimeLimpio,
    extension: MIME_TO_EXTENSION[mimeLimpio],
  };
}

export function construirRutaVitrinaMedia(params: {
  organizationId: string;
  folder: VitrinaMediaFolder;
  extension: VitrinaImageExtension;
  fileId?: string;
}): string {
  const orgId = params.organizationId.trim().toLowerCase();
  if (!UUID_SEGMENT_REGEX.test(orgId)) {
    throw new Error('organizationId inválido para ruta de Storage');
  }
  if (!esVitrinaMediaFolder(params.folder)) {
    throw new Error('Carpeta de Storage inválida');
  }

  const rawId = (params.fileId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64);
  const safeId = rawId || 'asset';

  return `${orgId}/${params.folder}/${safeId}.${params.extension}`;
}

export type ResultadoValidacionRutaVitrina =
  | {
      ok: true;
      path: string;
      organizationId: string;
      folder: VitrinaMediaFolder;
      fileName: string;
    }
  | {
      ok: false;
      error: string;
    };

export function validarRutaObjetoVitrinaMedia(
  rawPath: string | null | undefined,
  expectedOrganizationId?: string
): ResultadoValidacionRutaVitrina {
  if (typeof rawPath !== 'string') {
    return { ok: false, error: 'Ruta de objeto inválida' };
  }

  const limpio = rawPath.trim();
  if (!limpio || limpio.includes('..') || limpio.includes('//') || limpio.startsWith('/')) {
    return { ok: false, error: 'Ruta de objeto no permitida' };
  }

  const match = limpio.match(OBJECT_PATH_REGEX);
  if (!match) {
    return {
      ok: false,
      error: 'La ruta debe seguir el patrón {organization_id}/products/* o {organization_id}/brand/*',
    };
  }

  const orgId = match[1].toLowerCase();
  const folder = match[2].toLowerCase() as VitrinaMediaFolder;
  const fileName = match[3];

  if (expectedOrganizationId && orgId !== expectedOrganizationId.trim().toLowerCase()) {
    return {
      ok: false,
      error: 'El archivo no pertenece a la organización activa',
    };
  }

  return {
    ok: true,
    path: `${orgId}/${folder}/${fileName}`,
    organizationId: orgId,
    folder,
    fileName,
  };
}

export function extraerRutaVitrinaMediaDesdeUrl(
  urlOrPath: string | null | undefined
): string | null {
  if (typeof urlOrPath !== 'string' || !urlOrPath.trim()) return null;
  const valor = urlOrPath.trim();

  const matchUrl = valor.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/vitrina-media\/([^?#]+)/i
  );
  if (matchUrl?.[1]) {
    try {
      return decodeURIComponent(matchUrl[1]);
    } catch {
      return matchUrl[1];
    }
  }

  const validado = validarRutaObjetoVitrinaMedia(valor);
  return validado.ok ? validado.path : null;
}

export function formatearTamanoImagenLegible(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
