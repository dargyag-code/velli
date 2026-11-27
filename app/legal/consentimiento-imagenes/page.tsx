import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import { ContenidoConsentimientoImagenes } from '@/components/legal/ConsentimientoContenido';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';

export const metadata = {
  title: 'Consentimiento de imágenes y datos de salud — Veli',
};

export default function ConsentimientoImagenesPage() {
  return (
    <article className="bg-white rounded-xl border border-[#E4E4E7] p-6 sm:p-8">
      <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] mb-1.5">
        Consentimiento de imágenes · Datos de salud
      </h1>
      <p className="text-xs text-[#52525B] mb-6 leading-relaxed">
        Se firma en la ficha del cliente. Sin esta firma vigente, la cámara no se activa en los
        módulos clínicos protegidos.
      </p>

      <BannerPlaceholder version={CONSENTIMIENTO_VERSIONES.consentimiento_imagenes} />

      <ContenidoConsentimientoImagenes />
    </article>
  );
}
