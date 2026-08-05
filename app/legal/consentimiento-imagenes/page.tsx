import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import { ContenidoConsentimientoImagenes } from '@/components/legal/ConsentimientoContenido';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export const metadata = {
  title: 'Consentimiento de imágenes y datos de salud — Velli Pro',
};

export default function ConsentimientoImagenesPage() {
  return (
    <article className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
      <h1 className="text-2xl text-[#2D5A27] mb-1" style={serif}>
        Consentimiento de imágenes · Datos de salud
      </h1>
      <p className="text-xs text-[#999999] mb-6">
        Se firma por clienta en su ficha. Sin esta firma vigente, la cámara no
        se activa en el módulo de alopecia ni en el registro fotográfico de
        servicios químicos.
      </p>

      <BannerPlaceholder version={CONSENTIMIENTO_VERSIONES.consentimiento_imagenes} />

      <ContenidoConsentimientoImagenes />
    </article>
  );
}
