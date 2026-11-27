'use client';

import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import {
  ALLOWED_VITRINA_MIMES,
  extraerRutaVitrinaMediaDesdeUrl,
  formatearTamanoImagenLegible,
  validarArchivoImagenVitrina,
  type VitrinaMediaFolder,
} from '@/lib/storage/vitrinaMedia';
import { showToast } from '@/lib/toast';

export interface VelvetImageUploaderProps {
  organizationId: string;
  folder: VitrinaMediaFolder;
  value: string | null;
  onChange: (nextUrl: string | null) => void;
  label?: string;
  helperText?: string;
  shape?: 'square' | 'landscape';
  disabled?: boolean;
}

export default function VelvetImageUploader({
  organizationId,
  folder,
  value,
  onChange,
  label = 'Imagen',
  helperText = 'JPG, PNG o WebP · máx. 3 MB',
  shape = 'landscape',
  disabled = false,
}: VelvetImageUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [previewTemporal, setPreviewTemporal] = useState<string | null>(null);

  const imagenVisible = previewTemporal ?? (value?.trim() ? value.trim() : null);
  const ocupado = subiendo || eliminando || disabled;

  const abrirSelector = () => {
    if (ocupado) return;
    fileInputRef.current?.click();
  };

  const manejarSeleccionArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || ocupado) return;

    setErrorLocal(null);

    const checkCliente = validarArchivoImagenVitrina({
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!checkCliente.ok) {
      setErrorLocal(checkCliente.error);
      showToast(checkCliente.error, 'error');
      return;
    }

    const blobPreviewUrl = URL.createObjectURL(file);
    setPreviewTemporal(blobPreviewUrl);
    setSubiendo(true);

    try {
      const formData = new FormData();
      formData.append('organizationId', organizationId);
      formData.append('folder', folder);
      formData.append('file', file);
      if (value?.trim()) {
        formData.append('previousUrl', value.trim());
      }

      const res = await fetch('/api/storage/vitrina', {
        method: 'POST',
        body: formData,
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok || !payload.url) {
        const msg = payload.error || 'No se pudo subir la imagen';
        setErrorLocal(msg);
        showToast(msg, 'error');
        return;
      }

      onChange(payload.url);
      showToast(
        `Imagen cargada (${formatearTamanoImagenLegible(file.size)})`,
        'success'
      );
    } catch (err) {
      console.error('[VelvetImageUploader.upload]', err);
      const msg = 'Error de conexión al subir la imagen';
      setErrorLocal(msg);
      showToast(msg, 'error');
    } finally {
      URL.revokeObjectURL(blobPreviewUrl);
      setPreviewTemporal(null);
      setSubiendo(false);
    }
  };

  const eliminarImagenActual = async () => {
    if (!value || ocupado) return;
    setErrorLocal(null);
    const rutaStorage = extraerRutaVitrinaMediaDesdeUrl(value);

    if (!rutaStorage) {
      onChange(null);
      return;
    }

    setEliminando(true);
    try {
      const res = await fetch('/api/storage/vitrina', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          path: rutaStorage,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(payload.error || 'No se pudo eliminar del almacenamiento', 'error');
        return;
      }

      onChange(null);
      showToast('Imagen eliminada', 'success');
    } catch (err) {
      console.error('[VelvetImageUploader.delete]', err);
      showToast('No se pudo eliminar la imagen', 'error');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#52525B]"
      >
        {label}
      </label>

      <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center gap-3.5">
        <button
          type="button"
          onClick={abrirSelector}
          disabled={ocupado}
          aria-label={imagenVisible ? 'Cambiar imagen' : 'Seleccionar imagen'}
          className={`relative overflow-hidden rounded-xl border border-dashed border-[#E4E4E7] bg-white hover:border-[#111111]/40 transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-60 ${
            shape === 'square' ? 'w-20 h-20' : 'w-full sm:w-28 h-24'
          }`}
        >
          {imagenVisible ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagenVisible}
              alt="Previsualización"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImagePlus size={22} className="text-[#71717A]" />
          )}

          {(subiendo || eliminando) && (
            <div className="absolute inset-0 bg-[#FAFAFA]/85 flex items-center justify-center">
              <Loader2 size={18} className="text-[#111111] animate-spin" />
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={abrirSelector}
              disabled={ocupado}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] font-sans text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Upload size={13} />
              <span>
                {subiendo
                  ? 'Subiendo…'
                  : imagenVisible
                    ? 'Cambiar imagen'
                    : 'Subir imagen'}
              </span>
            </button>

            {value && (
              <button
                type="button"
                onClick={eliminarImagenActual}
                disabled={ocupado}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FFFBEB] hover:bg-[#F4F4F5] border border-[#B45309]/30 font-sans text-xs font-bold text-[#B45309] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Trash2 size={13} />
                <span>{eliminando ? 'Quitando…' : 'Eliminar'}</span>
              </button>
            )}
          </div>

          <p className="m-0 font-mono text-[11px] text-[#52525B] tabular-nums">
            {helperText}
          </p>

          {errorLocal && (
            <p className="m-0 font-sans text-xs font-semibold text-[#B45309]">
              {errorLocal}
            </p>
          )}
        </div>

        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_VITRINA_MIMES.join(',')}
          onChange={manejarSeleccionArchivo}
          disabled={ocupado}
          className="hidden"
        />
      </div>
    </div>
  );
}
