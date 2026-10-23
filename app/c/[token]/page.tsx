// ══════════════════════════════════════════════════════════════════════════
// Página pública de cotización `/c/[token]`
// (docs/velli-bi/02-diseno-cotizador.md §4).
//
// Reglas de privacidad y seguridad:
// - Muestra ÚNICAMENTE nombre del salón, servicio, precio en COP y vigencia.
// - Nada del diagnóstico, ni nombre de la clienta, ni fotos, ni salud capilar.
// - No indexable (robots: noindex, nofollow) y sin caché (no-store).
// - Protegida por rate-limit por IP (Upstash) y validación previa de UUID.
// - Pie «Cotización hecha con Velli · {dominio}» solo cuando `con_marca_velli`
//   es `true` (planes Básico y Pro); oculto en Pro+IA.
// ══════════════════════════════════════════════════════════════════════════

import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { checkRateLimit, cotizacionPublicaLimiter } from '@/lib/api/rateLimit';
import { APP_HOST, APP_URL } from '@/lib/sitio';
import {
  TEXTO_LEGAL_COTIZACION_PUBLICA,
  construirMetadataCotizacion,
  esUuidValido,
  extraerIpDesdeHeaders,
  formatearFechaVigencia,
  formatearPrecioCop,
  normalizarColorSalon,
  obtenerCotizacionPublica,
  type CotizacionPublica,
} from '@/lib/cotizador';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResultadoCargaCotizacionPublica {
  estado: 'ok' | 'no_encontrada' | 'rate_limited';
  cotizacion: CotizacionPublica | null;
}

const cargarEnPeticion = cache(async (token: string): Promise<ResultadoCargaCotizacionPublica> => {
  noStore();

  // Validación rápida de UUID antes de consumir rate limit o consultar Supabase
  if (!esUuidValido(token)) {
    return { estado: 'no_encontrada', cotizacion: null };
  }

  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(cotizacionPublicaLimiter(), `ip:${ip}`);
  if (!rl.ok) {
    return { estado: 'rate_limited', cotizacion: null };
  }

  try {
    const cotizacion = await obtenerCotizacionPublica(token);
    if (!cotizacion) {
      return { estado: 'no_encontrada', cotizacion: null };
    }
    return { estado: 'ok', cotizacion };
  } catch (err) {
    console.error('[cotizacion-publica]', err);
    return { estado: 'no_encontrada', cotizacion: null };
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

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export default async function CotizacionPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { estado, cotizacion } = await cargarEnPeticion(token);

  if (estado === 'rate_limited') {
    return (
      <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-white rounded-3xl border border-[#E5E0D8] p-6 text-center shadow-sm">
          <h1 className="text-xl text-[#2D2D2D] mb-2" style={serif}>
            Demasiadas consultas
          </h1>
          <p className="text-sm text-[#6B6560]">
            Por favor espera unos minutos antes de volver a abrir este enlace.
          </p>
        </section>
      </main>
    );
  }

  if (!cotizacion) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-white rounded-3xl border border-[#E5E0D8] p-6 text-center shadow-sm">
          <h1 className="text-xl text-[#2D2D2D] mb-2" style={serif}>
            Cotización no disponible
          </h1>
          <p className="text-sm text-[#6B6560]">
            Este enlace no existe o la cotización fue anulada. Pide una cotización nueva en tu
            salón.
          </p>
        </section>
      </main>
    );
  }

  const colorSalon = normalizarColorSalon(cotizacion.colorSalon);
  const precioFormateado = formatearPrecioCop(cotizacion.precio);
  const fechaFormateada = formatearFechaVigencia(cotizacion.vigenciaHasta);

  return (
    <main className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-4">
      <article className="w-full max-w-md bg-white rounded-3xl border border-[#E5E0D8] overflow-hidden shadow-sm">
        {/* Encabezado con la identidad y color del salón */}
        <header
          className="px-6 py-6 text-white"
          style={{ backgroundColor: colorSalon }}
        >
          <p className="text-xs uppercase tracking-widest opacity-85 font-semibold mb-1">
            Cotización de servicio
          </p>
          <h1 className="text-2xl font-normal leading-tight" style={serif}>
            {cotizacion.salon}
          </h1>
        </header>

        {/* Cuerpo: servicio, valor en COP y vigencia */}
        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#6B6560] font-semibold mb-1">
              Servicio
            </p>
            <p className="text-lg font-semibold text-[#1E1E1E]">
              {cotizacion.servicio}
            </p>
          </div>

          <div className="rounded-2xl bg-[#FAF8F5] border border-[#EDE8DF] p-5 text-center">
            <p className="text-xs uppercase tracking-wider text-[#6B6560] font-semibold mb-1">
              Valor estimado
            </p>
            <p
              className="text-4xl font-bold tracking-tight text-[#1E1E1E]"
              style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {precioFormateado}{' '}
              <span className="text-base font-normal text-[#6B6560]">{cotizacion.moneda}</span>
            </p>
          </div>

          {/* Estado de vigencia */}
          {cotizacion.vigente ? (
            <div className="rounded-xl bg-[#EEF5ED] border border-[#C6DEC3] px-4 py-3 text-center">
              <p className="text-sm font-medium text-[#2D5A27]">
                Válida hasta el {fechaFormateada}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-[#FFF4E5] border border-[#F5D099] px-4 py-3 text-center">
              <p className="text-sm font-semibold text-[#9A5B00]">
                Vencida: pide una cotización nueva
              </p>
              <p className="text-xs text-[#9A5B00] mt-0.5">
                Estuvo vigente hasta el {fechaFormateada}
              </p>
            </div>
          )}

          {/* Aviso legal (P13) */}
          <p className="text-xs text-[#6B6560] leading-relaxed border-t border-[#F0ECE3] pt-4">
            {TEXTO_LEGAL_COTIZACION_PUBLICA}
          </p>
        </div>

        {/* Pie con marca Velli en Básico y Pro; oculto en Pro+IA */}
        {cotizacion.conMarcaVelli && (
          <footer className="bg-[#FAF8F5] border-t border-[#EDE8DF] px-6 py-3 text-center">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6B6560] hover:text-[#2D5A27] transition-colors font-medium"
            >
              Cotización hecha con Velli · {APP_HOST}
            </a>
          </footer>
        )}
      </article>
    </main>
  );
}
