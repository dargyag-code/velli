import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import { ContenidoConsentimientoQuimico } from '@/components/legal/ConsentimientoContenido';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';

export const metadata = {
  title: 'Consentimiento informado de servicios químicos — Velli Pro',
};

export default function ConsentimientoQuimicoPage() {
  return (
    <article className="bg-white rounded-3xl border border-[#EFE8E4] p-6 sm:p-8 shadow-velvet">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#3B0D1E] mb-1.5">
        Consentimiento informado · Servicios químicos
      </h1>
      <p className="text-xs text-[#6B535C] mb-6 leading-relaxed">
        Se firma por clienta en su ficha (nombre completo + aceptación). Sin
        esta firma vigente no se confirman servicios de decoloración.
      </p>

      <BannerPlaceholder version={CONSENTIMIENTO_VERSIONES.consentimiento_quimico} />

      <ContenidoConsentimientoQuimico />
    </article>
  );
}
