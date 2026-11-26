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
import { CheckCircle2, Sparkles, Clock, UserCheck } from 'lucide-react';
import { checkRateLimit, cotizacionPublicaLimiter } from '@/lib/api/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';
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
}

function extraerPildorasDiagnosticoPublico(variables?: VariablesCotizacion | null): string[] {
  if (!variables || typeof variables !== 'object') {
    return ['Longitud: Evaluada en silla', 'Densidad: Calibrada', 'Fibra: Diagnóstico técnico'];
  }
  const vLargo =
    typeof variables.largo === 'object' ? variables.largo?.valor : (variables.largo as string | undefined);
  const vDensidad =
    typeof variables.densidad === 'object'
      ? variables.densidad?.valor
      : (variables.densidad as string | undefined);
  const vEstado =
    typeof variables.estado === 'object' ? variables.estado?.valor : (variables.estado as string | undefined);

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

    try {
      const admin = createAdminClient();
      const { data: cotRow } = await admin
        .from('cotizaciones')
        .select('user_id, estilista_nombre, variables, perfil_extendido, estado')
        .eq('token_publico', token.trim())
        .maybeSingle();

      const fila = cotRow as {
        user_id?: string;
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

        if (fila.user_id) {
          const [{ data: profRow }, { data: subRow }] = await Promise.all([
            admin
              .from('profiles')
              .select('telefono')
              .eq('id', fila.user_id)
              .maybeSingle(),
            admin
              .from('suscripciones')
              .select('plan, estado')
              .eq('user_id', fila.user_id)
              .maybeSingle(),
          ]);

          salonWhatsapp =
            ((profRow as { telefono?: string | null } | null)?.telefono ?? '').trim() || null;
          const sub = subRow as { plan?: string | null; estado?: string | null } | null;
          if (sub?.plan === 'pro_ia') {
            esPlanProIA = true;
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

// ── Isotipo Oficial La Gota Dual (Intacto) ────────────────────────────────
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
  const {
    estado,
    cotizacion,
    salonWhatsapp,
    estilistaNombre,
    pildorasDiagnostico,
    confirmado,
    esPlanProIA,
  } = await cargarEnPeticion(token);

  if (estado === 'rate_limited') {
    return (
      <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md mx-auto bg-white rounded-3xl border border-[#EFE8E4] p-7 text-center shadow-[0_10px_30px_-5px_rgba(59,13,30,0.06)]">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#3B0D1E] mb-2">
            Demasiadas consultas
          </h1>
          <p className="font-sans text-sm text-[#6B535C]">
            Por favor espera unos minutos antes de volver a abrir este comprobante.
          </p>
        </section>
      </main>
    );
  }

  if (!cotizacion) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md mx-auto bg-white rounded-3xl border border-[#EFE8E4] p-7 text-center shadow-[0_10px_30px_-5px_rgba(59,13,30,0.06)]">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#3B0D1E] mb-2">
            Cotización no disponible
          </h1>
          <p className="font-sans text-sm text-[#6B535C]">
            Este enlace no existe o la cotización fue anulada. Solicita una cotización actualizada en tu salón.
          </p>
        </section>
      </main>
    );
  }

  const precioFormateado = formatearPrecioCop(cotizacion.precio);
  const fechaFormateada = formatearFechaVigencia(cotizacion.vigenciaHasta);
  const pasosIncluidos = obtenerPasosIncluidos(cotizacion.servicio);
  const codigoReferencia = token.trim().slice(0, 8).toUpperCase();
  const mostrarMarcaVelli = cotizacion.conMarcaVelli && !esPlanProIA;

  return (
    <main className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] py-4">
      <article className="max-w-md mx-auto my-6 px-4">
        {/* Cabecera Ciruela */}
        <header className="bg-[#3B0D1E] !text-[#FAF7F5] p-6 rounded-t-3xl space-y-4 shadow-[0_10px_30px_-5px_rgba(59,13,30,0.18)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <IsotipoGotaDual />
              <div className="min-w-0">
                <p className="font-sans text-[11px] uppercase tracking-[0.08em] !text-[#E8CFC8] font-bold">
                  Comprobante de Cotización
                </p>
                <h1 className="font-display text-2xl font-semibold tracking-tight !text-[#FAF7F5] truncate mt-0.5 capitalize">
                  {cotizacion.salon}
                </h1>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-[#FAF7F5]/10 border border-[#E8CFC8]/25 !text-[#E8CFC8] font-mono text-xs font-semibold tabular-nums shrink-0">
              #{codigoReferencia}
            </span>
          </div>

          {/* Badge de estado (Vigencia activa · Hora Bogotá o Confirmada ✓) */}
          <div className="pt-3 border-t border-[#FAF7F5]/15 flex flex-wrap items-center justify-between gap-2">
            {confirmado ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D9488]/30 border border-[#99F6E4]/45 !text-[#FAF7F5] font-sans text-xs font-bold">
                <CheckCircle2 size={13} />
                Confirmada ✓
              </span>
            ) : cotizacion.vigente ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D9488]/25 border border-[#0D9488]/45 !text-[#F0FDFA] font-sans text-xs font-semibold">
                <Clock size={12} />
                Vigencia activa · Hora Bogotá ({fechaFormateada})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D97757]/25 border border-[#D97757]/45 !text-[#FFF7F5] font-sans text-xs font-semibold">
                Vencida el {fechaFormateada} · Hora Bogotá
              </span>
            )}
          </div>

          {/* Total Cotizado ($ COP) en la Cabecera Ciruela */}
          <div className="pt-3 border-t border-[#FAF7F5]/15 flex items-end justify-between gap-3">
            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] !text-[#E8CFC8] block">
                Total Cotizado ({cotizacion.moneda})
              </span>
              <div className="font-display text-3xl font-bold tabular-nums !text-[#FAF7F5] tracking-tight mt-0.5">
                {precioFormateado}{' '}
                <span className="font-sans text-xs font-bold !text-[#E8CFC8]">
                  {cotizacion.moneda}
                </span>
              </div>
            </div>
            <span className="font-mono text-[11px] !text-[#E8CFC8]/90 tabular-nums">
              Válida hasta {fechaFormateada}
            </span>
          </div>
        </header>

        {/* Cuerpo del Comprobante */}
        <div className="bg-white p-6 border-x border-b border-[#EFE8E4] rounded-b-3xl space-y-5 shadow-[0_10px_30px_-5px_rgba(59,13,30,0.06)]">
          {/* Servicio, Especialista Asignada y Píldoras de Diagnóstico Capilar */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5EBE8] text-[#3B0D1E] font-sans text-[11px] font-bold uppercase tracking-[0.08em]">
                <Sparkles size={12} />
                Servicio Personalizado
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#3B0D1E] font-sans text-xs font-semibold">
                <UserCheck size={13} className="text-[#3B0D1E]" />
                <span className="capitalize">
                  {estilistaNombre || 'Especialista asignada'}
                </span>
              </div>
            </div>

            <h2 className="font-sans text-lg md:text-xl font-bold tracking-tight text-[#3B0D1E] capitalize">
              {cotizacion.servicio}
            </h2>

            {/* Píldoras de diagnóstico capilar (sin exponer jamás costos ni comisiones) */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {pildorasDiagnostico.map((pildora) => (
                <span
                  key={pildora}
                  className="px-3 py-1 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] font-sans text-xs font-semibold text-[#3B0D1E]"
                >
                  {pildora}
                </span>
              ))}
            </div>

            <p className="font-sans text-xs sm:text-sm text-[#6B535C] leading-relaxed">
              Valor calculado de forma transparente según las características de longitud, densidad y estado de la fibra evaluadas en silla para tu cabello.
            </p>
          </div>

          {/* Desglose Transparente para la Clienta */}
          <div>
            <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] mb-3">
              Qué incluye tu procedimiento
            </h3>
            <ul className="space-y-2.5 pl-0 list-none">
              {pasosIncluidos.map((paso, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 font-sans text-xs sm:text-[13px] text-[#3B0D1E] leading-relaxed"
                >
                  <CheckCircle2 size={15} className="text-[#0D9488] shrink-0 mt-0.5" />
                  <span>{paso}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bloque Legal de Consentimiento Químico Informado + Confirmación */}
          <ConfirmacionPublicaCotizacion
            token={token}
            salon={cotizacion.salon}
            salonWhatsapp={salonWhatsapp}
            servicio={cotizacion.servicio}
            precioFormateado={precioFormateado}
            moneda={cotizacion.moneda}
            vigente={cotizacion.vigente}
            confirmadoInicial={confirmado}
          />

          {/* Aviso legal estándar (P13) */}
          <p className="font-sans text-[11px] text-[#6B535C] leading-relaxed border-t border-[#EFE8E4] pt-4">
            {TEXTO_LEGAL_COTIZACION_PUBLICA}
          </p>

          {/* Regla de Marca Blanca: oculto cuando es pro_ia */}
          {mostrarMarcaVelli && (
            <div className="pt-2 border-t border-[#EFE8E4] text-center">
              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-xs text-[#6B535C] hover:text-[#3B0D1E] transition-colors font-semibold no-underline"
              >
                Cotización hecha con Velli Business Intelligence · {APP_HOST}
              </a>
            </div>
          )}
        </div>
      </article>
    </main>
  );
}
