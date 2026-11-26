import crypto from 'crypto';
import { requireOrgAccess } from '@/lib/api/auth';
import { checkRateLimit, validateLimiter } from '@/lib/api/rateLimit';
import { esUuidValido } from '@/lib/cotizador';
import {
  VITRINA_MEDIA_BUCKET,
  construirRutaVitrinaMedia,
  esVitrinaMediaFolder,
  extraerRutaVitrinaMediaDesdeUrl,
  validarArchivoImagenVitrina,
  validarRutaObjetoVitrinaMedia,
} from '@/lib/storage/vitrinaMedia';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

// ── POST /api/storage/vitrina ──────────────────────────────────────────────
// Sube una imagen validada (MIME + magic bytes + <= 3 MB) al bucket público
// `vitrina-media` bajo `{organization_id}/products/*` o `{organization_id}/brand/*`.
// Usa el cliente autenticado del usuario para que la RLS de `storage.objects`
// valide en base de datos la pertenencia `owner` / `manager`.
export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: 'Formulario multipart inválido' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const orgIdRaw = formData.get('organizationId');
  const folderRaw = formData.get('folder');
  const fileEntry = formData.get('file');
  const previousUrlRaw = formData.get('previousUrl');

  const organizationId = typeof orgIdRaw === 'string' ? orgIdRaw.trim() : '';
  const folder = typeof folderRaw === 'string' ? folderRaw.trim().toLowerCase() : '';

  if (!esUuidValido(organizationId)) {
    return Response.json(
      { error: 'organizationId inválido' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!esVitrinaMediaFolder(folder)) {
    return Response.json(
      { error: 'Carpeta inválida: usa products o brand' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!(fileEntry instanceof Blob)) {
    return Response.json(
      { error: 'Debes adjuntar un archivo de imagen' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const access = await requireOrgAccess({
    organizationId,
    allowedRoles: ['owner', 'manager'],
  });
  if (access.response) {
    return access.response;
  }

  const rl = await checkRateLimit(validateLimiter(), `vitrina_upload:${access.user.id}`);
  if (!rl.ok) {
    return Response.json(
      { error: 'Demasiadas subidas seguidas. Espera un momento.' },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const validacion = validarArchivoImagenVitrina({
    mimeType: fileEntry.type,
    sizeBytes: bytes.byteLength,
    headerBytes: bytes.subarray(0, 16),
  });

  if (!validacion.ok) {
    return Response.json(
      { error: validacion.error },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const fileId = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
  const objectPath = construirRutaVitrinaMedia({
    organizationId: access.membership.organizationId,
    folder,
    extension: validacion.extension,
    fileId,
  });

  const validacionRuta = validarRutaObjetoVitrinaMedia(
    objectPath,
    access.membership.organizationId
  );
  if (!validacionRuta.ok) {
    return Response.json(
      { error: validacionRuta.error },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const { error: uploadError } = await access.supabase.storage
    .from(VITRINA_MEDIA_BUCKET)
    .upload(validacionRuta.path, bytes, {
      contentType: validacion.mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('[api.storage.vitrina.upload]', uploadError);
    return Response.json(
      { error: 'No se pudo subir la imagen al almacenamiento de la vitrina' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  // Limpieza best-effort de imagen anterior si pertenecía a esta misma organización
  if (typeof previousUrlRaw === 'string' && previousUrlRaw.trim()) {
    const prevPath = extraerRutaVitrinaMediaDesdeUrl(previousUrlRaw);
    if (prevPath) {
      const checkPrev = validarRutaObjetoVitrinaMedia(
        prevPath,
        access.membership.organizationId
      );
      if (checkPrev.ok) {
        await access.supabase.storage
          .from(VITRINA_MEDIA_BUCKET)
          .remove([checkPrev.path])
          .catch(() => {});
      }
    }
  }

  const { data: pubData } = access.supabase.storage
    .from(VITRINA_MEDIA_BUCKET)
    .getPublicUrl(validacionRuta.path);

  return Response.json(
    {
      ok: true,
      url: pubData.publicUrl,
      path: validacionRuta.path,
      mimeType: validacion.mimeType,
      sizeBytes: bytes.byteLength,
    },
    { status: 201, headers: NO_STORE_HEADERS }
  );
}

// ── DELETE /api/storage/vitrina ────────────────────────────────────────────
// Elimina un archivo existente en `vitrina-media` verificando que pertenezca
// estrictamente al prefijo `{organization_id}/(products|brand)/*`.
export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'JSON inválido' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const raw = (body && typeof body === 'object' ? body : {}) as {
    organizationId?: unknown;
    path?: unknown;
    url?: unknown;
  };

  const organizationId =
    typeof raw.organizationId === 'string' ? raw.organizationId.trim() : '';
  if (!esUuidValido(organizationId)) {
    return Response.json(
      { error: 'organizationId inválido' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const access = await requireOrgAccess({
    organizationId,
    allowedRoles: ['owner', 'manager'],
  });
  if (access.response) {
    return access.response;
  }

  const candidatoRuta =
    typeof raw.path === 'string' && raw.path.trim()
      ? raw.path.trim()
      : typeof raw.url === 'string'
        ? extraerRutaVitrinaMediaDesdeUrl(raw.url)
        : null;

  const formatoRuta = validarRutaObjetoVitrinaMedia(candidatoRuta);
  if (!formatoRuta.ok) {
    return Response.json(
      { error: formatoRuta.error },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const validacionRuta = validarRutaObjetoVitrinaMedia(
    candidatoRuta,
    access.membership.organizationId
  );
  if (!validacionRuta.ok) {
    return Response.json(
      { error: validacionRuta.error },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { error: removeError } = await access.supabase.storage
    .from(VITRINA_MEDIA_BUCKET)
    .remove([validacionRuta.path]);

  if (removeError) {
    console.error('[api.storage.vitrina.delete]', removeError);
    return Response.json(
      { error: 'No se pudo eliminar la imagen' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return Response.json(
    { ok: true, removedPath: validacionRuta.path },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
