import { LEGAL_VERSION } from '@/lib/legal';

// Aviso visible mientras el texto legal definitivo lo redacta la abogada.
// Quitar este banner (y subir LEGAL_VERSION) al publicar la versión final.
export default function BannerPlaceholder() {
  return (
    <div
      role="note"
      className="mb-6 rounded-xl border-2 border-dashed border-[#B47900] bg-[#FFF6E0] p-4"
    >
      <p className="text-sm font-bold text-[#7A5200] mb-1">
        ⚠️ DOCUMENTO PROVISIONAL (PLACEHOLDER)
      </p>
      <p className="text-xs text-[#7A5200] leading-relaxed">
        Este texto es un borrador de trabajo y no constituye el documento legal
        definitivo, que está en redacción por nuestra asesora legal. Versión:{' '}
        <code className="font-mono">{LEGAL_VERSION}</code>
      </p>
    </div>
  );
}
