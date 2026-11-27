// ══════════════════════════════════════════════════════════════════════════
// Página pública de cotización `/c/[token]` · Base Blanca Neutra Veli
// Conectada dinámicamente a `brand_settings.primary_color` con fallback #111111.
// ══════════════════════════════════════════════════════════════════════════

import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { checkRateLimit, cotizacionPublicaLimiter } from '@/lib/api/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizarHexVelvet } from '@/lib/organizations/brand';
import { APP_HOST, APP_URL } from '@/lib/sitio';
import ConfirmacionPublicaCotizacion from '@/components/cotizador/ConfirmacionPublicaCotizacion';
import {
  CATALOGO_VARIABLES,
  TEXTO_LEGAL_COTIZACION_PUBLICA,
  construirMetadataCotizacion,
  esUuidValido,
  extraerIpDesdeHeaders,
  formatearFechaVigencia,
  formatearPrecioCop,
  obtenerCotizacionPublica,
  type CotizacionPublica,
  type VariablesCotizacion,
} from '@/lib/cotizador';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResultadoCargaCotizacionPublica {
  estado: 'ok' | 'no_encontrada' | 'rate_limited';
  cotizacion: CotizacionPublica | null;
  salonWhatsapp: string | null;
  estilistaNombre: string | null;
  pildorasDiagnostico: string[];
  confirmado: boolean;
  esPlanProIA: boolean;
  brandPrimaryColor: string;
  brandLegalFooter: string | null;
}

function extraerPildorasDiagnosticoPublico(variables?: VariablesCotizacion | null): string[] {
  if (!variables || typeof variables !== 'object') {
    return ['Longitud: Evaluada en silla', 'Densidad: Calibrada', 'Fibra: Diagnóstico técnico'];
  }
  const vLargo =
    typeof variables.largo === 'object'
      ? variables.largo?.valor
      : (variables.largo as string | undefined);
  const vDensidad =
    typeof variables.densidad === 'object'
      ? variables.densidad?.valor
      : (variables.densidad as string | undefined);
  const vEstado =
    typeof variables.estado === 'object'
      ? variables.estado?.valor
      : (variables.estado as string | undefined);

  const etqLargo = CATALOGO_VARIABLES.largo.find((o) => o.valor === vLargo)?.etiqueta;
  const etqDensidad = CATALOGO_VARIABLES.densidad.find((o) => o.valor === vDensidad)?.etiqueta;
  const etqEstado = CATALOGO_VARIABLES.estado.find((o) => o.valor === vEstado)?.etiqueta;

  const pildoras: string[] = [];
  if (etqLargo) pildoras.push(`Longitud: ${etqLargo}`);
  if (etqDensidad) pildoras.push(`Densidad: ${etqDensidad}`);
  if (etqEstado) pildoras.push(`Fibra: ${etqEstado}`);
  return pildoras.length > 0
    ? pildoras
    : ['Longitud: Evaluada en silla', 'Densidad: Calibrada', 'Fibra: Diagnóstico técnico'];
}

const cargarEnPeticion = cache(async (token: string): Promise<ResultadoCargaCotizacionPublica> => {
  noStore();

  const vacio: ResultadoCargaCotizacionPublica = {
    estado: 'no_encontrada',
    cotizacion: null,
    salonWhatsapp: null,
    estilistaNombre: null,
    pildorasDiagnostico: [],
    confirmado: false,
    esPlanProIA: false,
    brandPrimaryColor: '#111111',
    brandLegalFooter: null,
  };

  if (!esUuidValido(token)) {
    return vacio;
  }

  const hdrs = await headers();
  const ip = extraerIpDesdeHeaders(hdrs);
  const rl = await checkRateLimit(cotizacionPublicaLimiter(), `ip:${ip}`);
  if (!rl.ok) {
    return { ...vacio, estado: 'rate_limited' };
  }

  try {
    const cotizacion = await obtenerCotizacionPublica(token);
    if (!cotizacion) {
      return vacio;
    }

    let salonWhatsapp: string | null = null;
    let estilistaNombre: string | null = null;
    let pildorasDiagnostico = extraerPildorasDiagnosticoPublico(null);
    let confirmado = false;
    let esPlanProIA = !cotizacion.conMarcaVelli;
    let brandPrimaryColor = normalizarHexVelvet(cotizacion.colorSalon, '#111111');
    let brandLegalFooter: string | null = null;

    try {
      const admin = createAdminClient();
      const { data: cotRow } = await admin
        .from('cotizaciones')
        .select('user_id, organization_id, estilista_nombre, variables, perfil_extendido, estado')
        .eq('token_publico', token.trim())
        .maybeSingle();

      const fila = cotRow as {
        user_id?: string;
        organization_id?: string | null;
        estilista_nombre?: string | null;
        variables?: VariablesCotizacion | null;
        perfil_extendido?: Record<string, unknown> | null;
        estado?: string | null;
      } | null;

      if (fila) {
        estilistaNombre = (fila.estilista_nombre ?? '').trim() || null;
        pildorasDiagnostico = extraerPildorasDiagnosticoPublico(fila.variables);
        confirmado =
          fila.perfil_extendido?.['consentimientoAceptado'] === true ||
          fila.estado === 'cobrada';

        const orgIdEfectivo = fila.organization_id || fila.user_id || null;
        if (orgIdEfectivo) {
          const [{ data: orgRow }, { data: profRow }, { data: subRow }, { data: brandRow }] =
            await Promise.all([
              admin
                .from('organizations')
                .select('whatsapp_phone, plan')
                .eq('id', orgIdEfectivo)
                .maybeSingle(),
              admin
                .from('profiles')
                .select('telefono')
                .eq('id', fila.user_id ?? orgIdEfectivo)
                .maybeSingle(),
              admin
                .from('subscriptions')
                .select('plan, status')
                .eq('user_id', orgIdEfectivo)
                .maybeSingle(),
              admin
                .from('brand_settings')
                .select('primary_color, legal_footer')
                .eq('organization_id', orgIdEfectivo)
                .maybeSingle(),
            ]);

          const org = orgRow as { whatsapp_phone?: string | null; plan?: string | null } | null;
          salonWhatsapp =
            (org?.whatsapp_phone ?? '').trim() ||
            ((profRow as { telefono?: string | null } | null)?.telefono ?? '').trim() ||
            null;
          const sub = subRow as { plan?: string | null; status?: string | null } | null;
          if (org?.plan === 'pro_ia' || sub?.plan === 'pro_ia') {
            esPlanProIA = true;
          }
          const bs = brandRow as {
            primary_color?: string | null;
            legal_footer?: string | null;
          } | null;
          if (bs?.primary_color) {
            brandPrimaryColor = normalizarHexVelvet(bs.primary_color, '#111111');
          }
          if (bs?.legal_footer?.trim()) {
            brandLegalFooter = bs.legal_footer.trim();
          }
        }
      }
    } catch {
      salonWhatsapp = null;
    }

    return {
      estado: 'ok',
      cotizacion,
      salonWhatsapp,
      estilistaNombre,
      pildorasDiagnostico,
      confirmado,
      esPlanProIA,
      brandPrimaryColor,
      brandLegalFooter,
    };
  } catch (err) {
    console.error('[cotizacion-publica]', err);
    return vacio;
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
      'Fórmula de aclaración y matiz calibrada a medida',
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
      'Diagnóstico previo de elasticidad e historial de la fibra',
      'Preparación profunda y aplicación uniforme por secciones',
      'Sellado térmico controlado según grosor de la hebra',
      'Protocolo de cierre y recomendaciones de cuidado',
    ];
  }
  return [
    'Valoración personalizada en silla antes de iniciar',
    'Insumos profesionales dosificados según diagnóstico',
    'Ejecución técnica por tu especialista del estudio',
    'Acabado profesional y recomendaciones de mantenimiento',
  ];
}

export default async function CotizacionPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const {
    estado,
    cotizacion,
    salonWhatsapp,
    estilistaNombre,
    pildorasDiagnostico,
    confirmado,
    esPlanProIA,
    brandPrimaryColor,
    brandLegalFooter,
  } = await cargarEnPeticion(token);

  if (estado === 'rate_limited') {
    return (
      <main className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <section className="w-full max-w-md mx-auto bg-white rounded-xl border border-[#E4E4E7] p-7 text-center">
          <h1 className="font-sans text-xl font-bold tracking-tight text-[#111111] mb-2">
            Demasiadas consultas
          </h1>
          <p className="font-sans text-sm text-[#52525B]">
            Por favor espera unos minutos antes de volver a abrir este comprobante.
          </p>
        </section>
      </main>
    );
  }

  if (!cotizacion) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <section className="w-full max-w-md mx-auto bg-white rounded-xl border border-[#E4E4E7] p-7 text-center">
          <h1 className="font-sans text-xl font-bold tracking-tight text-[#111111] mb-2">
            Cotización no disponible
          </h1>
          <p className="font-sans text-sm text-[#52525B]">
            Este enlace no existe o la cotización fue anulada. Solicita una cotización actualizada en el estudio.
          </p>
        </section>
      </main>
    );
  }

  const precioFormateado = formatearPrecioCop(cotizacion.precio);
  const fechaFormateada = formatearFechaVigencia(cotizacion.vigenciaHasta);
  const pasosIncluidos = obtenerPasosIncluidos(cotizacion.servicio);
  const codigoReferencia = token.trim().slice(0, 8).toUpperCase();
  const mostrarMarcaVeli = cotizacion.conMarcaVelli && !esPlanProIA;
  const inicialesEstudio = cotizacion.salon
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'ST';

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111111] py-6">
      <article className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
          <div className="h-1.5 w-full" style={{ backgroundColor: brandPrimaryColor }} />

          <header className="p-6 border-b border-[#E4E4E7] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-lg text-white font-bold text-sm flex items-center justify-center shrink-0"
                  style={{ backgroundColor: brandPrimaryColor }}
                >
                  {inicialesEstudio}
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[11px] uppercase tracking-[0.06em] text-[#71717A] font-semibold">
                    Comprobante de Cotización
                  </p>
                  <h1 className="font-sans text-xl font-bold tracking-tight text-[#111111] truncate mt-0.5 capitalize">
                    {cotizacion.salon}
                  </h1>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] text-[#52525B] font-mono text-xs font-medium tabular-nums shrink-0">
                #{codigoReferencia}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {confirmado ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#15803D]/25 text-[#15803D] font-sans text-xs font-semibold">
                  <CheckCircle2 size={13} />
                  Confirmada
                </span>
              ) : cotizacion.vigente ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#15803D]/25 text-[#15803D] font-sans text-xs font-medium">
                  <Clock size={12} />
                  Vigencia activa · Hora Bogotá ({fechaFormateada})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFFBEB] border border-[#B45309]/25 text-[#B45309] font-sans text-xs font-medium">
                  Vencida el {fechaFormateada}
                </span>
              )}
            </div>

            <div className="pt-3 border-t border-[#E4E4E7] flex items-end justify-between gap-3">
              <div>
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71717A] block">
                  Total cotizado ({cotizacion.moneda})
                </span>
                <div className="font-sans text-3xl font-bold tabular-nums text-[#111111] tracking-tight mt-0.5">
                  {precioFormateado}{' '}
                  <span className="font-sans text-xs font-semibold text-[#71717A]">
                    {cotizacion.moneda}
                  </span>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
                Hasta {fechaFormateada}
              </span>
            </div>
          </header>

          <div className="p-6 space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#F4F4F5] text-[#111111] font-sans text-[11px] font-semibold">
                  Servicio personalizado
                </span>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-[#111111] font-sans text-xs font-medium">
                  <UserCheck size={13} className="text-[#52525B]" />
                  <span className="capitalize">
                    {estilistaNombre || 'Especialista del estudio'}
                  </span>
                </div>
              </div>

              <h2 className="font-sans text-lg font-bold tracking-tight text-[#111111] capitalize">
                {cotizacion.servicio}
              </h2>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {pildorasDiagnostico.map((pildora) => (
                  <span
                    key={pildora}
                    className="px-2.5 py-1 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] font-sans text-xs font-medium text-[#52525B]"
                  >
                    {pildora}
                  </span>
                ))}
              </div>

              <p className="font-sans text-xs sm:text-sm text-[#52525B] leading-relaxed">
                Valor calculado de forma transparente según el diagnóstico presencial evaluado en silla.
              </p>
            </div>

            <div>
              <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71717A] mb-3">
                Qué incluye el procedimiento
              </h3>
              <ul className="space-y-2.5 pl-0 list-none">
                {pasosIncluidos.map((paso, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 font-sans text-xs sm:text-[13px] text-[#111111] leading-relaxed"
                  >
                    <CheckCircle2 size={15} className="text-[#15803D] shrink-0 mt-0.5" />
                    <span>{paso}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ConfirmacionPublicaCotizacion
              token={token}
              salon={cotizacion.salon}
              salonWhatsapp={salonWhatsapp}
              servicio={cotizacion.servicio}
              precioFormateado={precioFormateado}
              moneda={cotizacion.moneda}
              vigente={cotizacion.vigente}
              confirmadoInicial={confirmado}
              primaryColor={brandPrimaryColor}
            />

            <p className="font-sans text-[11px] text-[#71717A] leading-relaxed border-t border-[#E4E4E7] pt-4">
              {brandLegalFooter || TEXTO_LEGAL_COTIZACION_PUBLICA}
            </p>

            {mostrarMarcaVeli && (
              <div className="pt-2 border-t border-[#E4E4E7] text-center">
                <a
                  href={APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-xs text-[#71717A] hover:text-[#111111] transition-colors font-medium no-underline"
                >
                  Cotización hecha con Veli · {APP_HOST}
                </a>
              </div>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
