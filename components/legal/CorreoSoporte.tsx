import { SOPORTE_EMAIL } from '@/lib/sitio';

// Correo de soporte dentro de los textos legales. Sale de
// NEXT_PUBLIC_SUPPORT_EMAIL (lib/sitio.ts); si falta, se marca como pendiente
// en vez de inventar una dirección.
export default function CorreoSoporte() {
  if (!SOPORTE_EMAIL) {
    return <span className="font-semibold text-[#7A5200]">[correo de soporte pendiente]</span>;
  }
  return (
    <a href={`mailto:${SOPORTE_EMAIL}`} className="text-[#2D5A27] font-semibold hover:underline">
      {SOPORTE_EMAIL}
    </a>
  );
}
