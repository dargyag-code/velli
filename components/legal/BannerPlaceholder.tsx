import { LEGAL_VERSION } from '@/lib/legal';

// Aviso visible mientras el texto legal no sea definitivo. Quitar este banner
// (y subir la versión correspondiente) al publicar la versión final.
// `version` permite reutilizarlo en los consentimientos versionados por
// clienta (default: LEGAL_VERSION de Términos/Privacidad).
export default function BannerPlaceholder({ version }: { version?: string }) {
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
        definitivo; puede cambiar antes de publicarse esa versión. Versión:{' '}
        <code className="font-mono">{version ?? LEGAL_VERSION}</code>
      </p>
    </div>
  );
}
