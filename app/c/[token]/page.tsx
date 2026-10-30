// ══════════════════════════════════════════════════════════════════════════
// Página pública de cotización `/c/[token]`
// (docs/velli-bi/02-diseno-cotizador.md §4 · Estética Velvet Studio BI).
//
// Reglas de privacidad y seguridad:
// - Muestra ÚNICAMENTE nombre del salón, servicio, pasos generales incluidos,
//   precio en COP, vigencia y casilla de aceptación de condiciones.
// - No expone datos sensibles de salud capilar ni fotos de la clienta.
// - No indexable (robots: noindex, nofollow) y sin caché (no-store).
// - Protegida por rate-limit por IP (Upstash) y validación previa de UUID.
// - Pie «Cotización hecha con Velli · {dominio}» solo cuando `con_marca_velli`
//   es `true`; oculto en Salón Pro + IA.
// ══════════════════════════════════════════════════════════════════════════

import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { checkRateLimit, cotizacionPublicaLimiter } from '@/lib/api/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';
import { APP_HOST, APP_URL } from '@/lib/sitio';
import ConfirmacionPublicaCotizacion from '@/components/cotizador/ConfirmacionPublicaCotizacion';
import {
  TEXTO_LEGAL_COTIZACION_PUBLICA,
  construirMetadataCotizacion,
  esUuidValido,
  extraerIpDesdeHeaders,
  formatearFechaVigencia,
  formatearPrecioCop,
  obtenerCotizacionPublica,
  type CotizacionPublica,
} from '@/lib/cotizador';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResultadoCargaCotizacionPublica {
  estado: 'ok' | 'no_encontrada' | 'rate_limited';
  cotizacion: CotizacionPublica | null;
  salonWhatsapp: string | null;
}

const cargarEnPeticion = cache(async (token: string): Promise<ResultadoCargaCotizacionPublica> => {
  noStore();

  if (!esUuidValido(token)) {
    return { estado: 'no_encontrada', cotizacion: null, salonWhatsapp: null };
  }

  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(cotizacionPublicaLimiter(), `ip:${ip}`);
  if (!rl.ok) {
    return { estado: 'rate_limited', cotizacion: null, salonWhatsapp: null };
  }

  try {
    const cotizacion = await obtenerCotizacionPublica(token);
    if (!cotizacion) {
      return { estado: 'no_encontrada', cotizacion: null, salonWhatsapp: null };
    }

    let salonWhatsapp: string | null = null;
    try {
      const admin = createAdminClient();
      const { data: cotRow } = await admin
        .from('cotizaciones')
        .select('user_id')
        .eq('token_publico', token.trim())
        .maybeSingle();
      const userId = (cotRow as { user_id?: string } | null)?.user_id;
      if (userId) {
        const { data: profRow } = await admin
          .from('profiles')
          .select('telefono')
          .eq('id', userId)
          .maybeSingle();
        salonWhatsapp =
          ((profRow as { telefono?: string | null } | null)?.telefono ?? '').trim() || null;
      }
    } catch {
      salonWhatsapp = null;
    }

    return { estado: 'ok', cotizacion, salonWhatsapp };
  } catch (err) {
    console.error('[cotizacion-publica]', err);
    return { estado: 'no_encontrada', cotizacion: null, salonWhatsapp: null };
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const { cotizacion } = await cargarEnPeticion(token);
  return construirMetadataCotizacion(cotizacion);
}

function obtenerPasosIncluidos(servicioNombre: string): string[] {
  const s = servicioNombre.toLowerCase();
  if (
    s.includes('balayage') ||
    s.includes('babylight') ||
    s.includes('decolor') ||
    s.includes('mecha') ||
    s.includes('correcci')
  ) {
    return [
      'Evaluación presencial de longitud, densidad y resistencia de la fibra',
      'Fórmula de aclaración y matiz calibrada a medida para tu cabello',
      'Protección y sellado técnico post-coloración en lavacabezas',
      'Finalización profesional y guía de mantenimiento en casa',
    ];
  }
  if (s.includes('color') || s.includes('tinte') || s.includes('cubrimiento') || s.includes('retoque')) {
    return [
      'Diagnóstico de tono base, porosidad y porcentaje de saturación',
      'Aplicación de fórmula de color calibrada según masa capilar',
      'Lavado técnico con sellante de cutícula y balance de pH',
      'Secado y verificación final de reflejo en luz natural',
    ];
  }
  if (s.includes('alisado') || s.includes('keratina') || s.includes('amino')) {
    return [
      'Diagnóstico previo de elasticidad e historial del cabello',
      'Preparación profunda y aplicación uniforme por secciones',
      'Sellado térmico controlado según grosor de la hebra',
      'Lavado final o protocolo de cierre y recomendaciones de cuidado',
    ];
  }
  return [
    'Valoración capilar personalizada en silla antes de iniciar',
    'Insumos profesionales dosificados según largo y densidad',
    'Ejecución técnica especializada por tu profesional asignada',
    'Acabado de salón y recomendaciones de cuidado posterior',
  ];
}

function IsotipoGotaDual() {
  return (
    <div className="w-11 h-11 rounded-2xl bg-[#FAF7F5]/12 border border-[#E8CFC8]/25 flex items-center justify-center shrink-0">
      <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M19.2 33.5C13.2 29.8 7.5 21.8 9.2 13.8C10.5 7.8 16.5 7.2 19.2 14.5C20.2 17.2 20.2 27.5 19.2 33.5Z"
          fill="#FAF7F5"
        />
        <path
          d="M20.8 33.5C26.8 29.8 32.5 21.8 30.8 13.8C29.5 7.8 23.5 7.2 20.8 14.5C19.8 17.2 19.8 27.5 20.8 33.5Z"
          fill="#E8CFC8"
          fillOpacity="0.85"
        />
        <circle cx="20" cy="6.5" r="2.5" fill="#D97757" />
      </svg>
    </div>
  );
}

export default async function CotizacionPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { estado, cotizacion, salonWhatsapp } = await cargarEnPeticion(token);

  if (estado === 'rate_limited') {
    return (
      <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-white rounded-3xl border border-[#EFE8E4] p-7 text-center shadow-[0_20px_50px_-12px_rgba(59,13,30,0.10)]">
          <h1 className="text-xl font-bold text-[#1C1518] mb-2">
            Demasiadas consultas
          </h1>
          <p className="text-sm text-[#6E6266]">
            Por favor espera unos minutos antes de volver a abrir este comprobante.
          </p>
        </section>
      </main>
    );
  }

  if (!cotizacion) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-white rounded-3xl border border-[#EFE8E4] p-7 text-center shadow-[0_20px_50px_-12px_rgba(59,13,30,0.10)]">
          <h1 className="text-xl font-bold text-[#1C1518] mb-2">
            Cotización no disponible
          </h1>
          <p className="text-sm text-[#6E6266]">
            Este enlace no existe o la cotización fue anulada. Solicita una cotización actualizada en tu salón.
          </p>
        </section>
      </main>
    );
  }

  const precioFormateado = formatearPrecioCop(cotizacion.precio);
  const fechaFormateada = formatearFechaVigencia(cotizacion.vigenciaHasta);
  const pasosIncluidos = obtenerPasosIncluidos(cotizacion.servicio);

  return (
    <main className="min-h-screen bg-[#FAF7F5] text-[#1C1518] flex flex-col items-center justify-center py-8 px-4">
      <article className="w-full max-w-lg bg-white rounded-3xl border border-[#EFE8E4] overflow-hidden shadow-[0_24px_60px_-15px_rgba(59,13,30,0.15)]">
        {/* Cabecera Oficial Velvet Plum #3B0D1E */}
        <header className="bg-[#3B0D1E] px-6 py-6 text-[#FAF7F5]">
          <div className="flex items-center gap-3.5">
            <IsotipoGotaDual />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#E8CFC8] font-bold">
                Propuesta Capilar Personalizada
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[#FAF7F5] truncate mt-0.5">
                {cotizacion.salon}
              </h1>
            </div>
          </div>
        </header>

        {/* Cuerpo Editorial */}
        <div className="p-6 sm:p-7 space-y-6">
          {/* Servicio y Resumen de Diagnóstico */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7ECEF] text-[#6E1E3A] text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={12} />
              Diagnóstico & Servicio
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1C1518] tracking-tight">
              {cotizacion.servicio}
            </h2>
            <p className="text-xs sm:text-sm text-[#6E6266] leading-relaxed">
              Valor calculado de forma transparente según las características de longitud, masa capilar, porosidad y requerimientos técnicos evaluados para tu cabello.
            </p>
          </div>

          {/* Tarjeta de Precio en $ COP */}
          <div className="rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] p-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6266] font-bold mb-1.5">
              Inversión Cotizada
            </p>
            <p className="text-4xl font-bold tracking-tight text-[#3B0D1E]">
              {precioFormateado}{' '}
              <span className="text-sm font-semibold text-[#6E6266]">{cotizacion.moneda}</span>
            </p>

            <div className="mt-3 flex items-center justify-center">
              {cotizacion.vigente ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF6F4] text-[#0D7A70] text-xs font-semibold">
                  <Clock size={12} />
                  Válida hasta el {fechaFormateada}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF2EC] text-[#B85D3B] text-xs font-semibold">
                  Cotización vencida el {fechaFormateada} · Solicita actualizarla
                </span>
              )}
            </div>
          </div>

          {/* Pasos Incluidos en el Procedimiento */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#6E6266] mb-3">
              Qué incluye tu procedimiento
            </h3>
            <ul className="space-y-2.5">
              {pasosIncluidos.map((paso, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-[#1C1518] leading-relaxed">
                  <CheckCircle2 size={15} className="text-[#0D9488] shrink-0 mt-0.5" />
                  <span>{paso}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Casilla de Consentimiento y Confirmación por WhatsApp */}
          <ConfirmacionPublicaCotizacion
            token={token}
            salon={cotizacion.salon}
            salonWhatsapp={salonWhatsapp}
            servicio={cotizacion.servicio}
            precioFormateado={precioFormateado}
            moneda={cotizacion.moneda}
            vigente={cotizacion.vigente}
          />

          {/* Aviso legal estándar (P13) */}
          <p className="text-[11px] text-[#6E6266] leading-relaxed border-t border-[#EFE8E4] pt-4">
            {TEXTO_LEGAL_COTIZACION_PUBLICA}
          </p>
        </div>

        {/* Pie con marca Velli salvo en Salón Pro + IA */}
        {cotizacion.conMarcaVelli && (
          <footer className="bg-[#FAF7F5] border-t border-[#EFE8E4] px-6 py-3.5 text-center">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6E6266] hover:text-[#3B0D1E] transition-colors font-semibold no-underline"
            >
              Cotización hecha con Velli Business Intelligence · {APP_HOST}
            </a>
          </footer>
        )}
      </article>
    </main>
  );
}
