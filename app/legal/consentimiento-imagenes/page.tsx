import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import { ContenidoConsentimientoImagenes } from '@/components/legal/ConsentimientoContenido';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';

export const metadata = {
  title: 'Consentimiento de imágenes y datos de salud — Velli Pro',
};

export default function ConsentimientoImagenesPage() {
  return (
    <article className="bg-white rounded-3xl border border-[#EFE8E4] p-6 sm:p-8 shadow-velvet">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#3B0D1E] mb-1.5">
        Consentimiento de imágenes · Datos de salud
      </h1>
      <p className="text-xs text-[#6B535C] mb-6 leading-relaxed">
        Se firma por clienta en su ficha. Sin esta firma vigente, la cámara no
        se activa en el módulo de alopecia ni en el registro fotográfico de
        servicios químicos.
      </p>

      <BannerPlaceholder version={CONSENTIMIENTO_VERSIONES.consentimiento_imagenes} />

      <ContenidoConsentimientoImagenes />
    </article>
  );
}
