import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import { ContenidoConsentimientoQuimico } from '@/components/legal/ConsentimientoContenido';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export const metadata = {
  title: 'Consentimiento informado de servicios químicos — Velli Pro',
};

export default function ConsentimientoQuimicoPage() {
  return (
    <article className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
      <h1 className="text-2xl text-[#2D5A27] mb-1" style={serif}>
        Consentimiento informado · Servicios químicos
      </h1>
      <p className="text-xs text-[#999999] mb-6">
        Se firma por clienta en su ficha (nombre completo + aceptación). Sin
        esta firma vigente no se confirman servicios de decoloración.
      </p>

      <BannerPlaceholder version={CONSENTIMIENTO_VERSIONES.consentimiento_quimico} />

      <ContenidoConsentimientoQuimico />
    </article>
  );
}
