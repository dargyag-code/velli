import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import { ContenidoConsentimientoQuimico } from '@/components/legal/ConsentimientoContenido';
import { CONSENTIMIENTO_VERSIONES } from '@/lib/legal';

export const metadata = {
  title: 'Consentimiento informado de servicios químicos — Veli',
};

export default function ConsentimientoQuimicoPage() {
  return (
    <article className="bg-white rounded-xl border border-[#E4E4E7] p-6 sm:p-8">
      <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] mb-1.5">
        Consentimiento informado · Servicios químicos
      </h1>
      <p className="text-xs text-[#52525B] mb-6 leading-relaxed">
        Se firma en la ficha del cliente (nombre completo + aceptación). Sin esta firma vigente no
        se confirman procedimientos de decoloración.
      </p>

      <BannerPlaceholder version={CONSENTIMIENTO_VERSIONES.consentimiento_quimico} />

      <ContenidoConsentimientoQuimico />
    </article>
  );
}
