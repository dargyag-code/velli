'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock4, ShieldCheck, XCircle } from 'lucide-react';
import { PLANES, esPlanId } from '@/lib/subscription/plans';
import { formatDate } from '@/lib/utils';

// ─── Confirmación de pago ──────────────────────────────────────────────────
// Página de retorno del checkout de Bold. Consulta /api/pagos/estado (que
// además reconcilia contra el proveedor si el webhook aún no llegó) con
// polling corto. Tres salidas: aprobado, rechazado/expirado, o "en proceso"
// (PSE puede tardar — se ofrece re-verificar manualmente).

const POLL_MS = 3_000;
const MAX_POLLS = 10; // ~30s de espera automática

interface EstadoRespuesta {
  pago: string;
  plan: string;
  suscripcion: { estado: string; plan: string | null; vence: string | null } | null;
}

function ConfirmacionInner() {
  const router = useRouter();
  const ref = useSearchParams().get('ref');

  const [resultado, setResultado] = useState<EstadoRespuesta | null>(null);
  const [agotado, setAgotado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const polls = useRef(0);

  const esFinal = (pago: string) =>
    pago === 'approved' ||
    pago === 'rejected' ||
    pago === 'voided' ||
    pago === 'expired' ||
    pago === 'error';

  const consultar = useCallback(async (): Promise<EstadoRespuesta | null> => {
    if (!ref) return null;
    try {
      const res = await fetch(`/api/pagos/estado?ref=${encodeURIComponent(ref)}`);
      if (!res.ok) return null;
      return (await res.json()) as EstadoRespuesta;
    } catch {
      return null;
    }
  }, [ref]);

  useEffect(() => {
    if (!ref) return;
    let activo = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const data = await consultar();
      if (!activo) return;
      if (data) setResultado(data);
      if (data && esFinal(data.pago)) return;
      polls.current += 1;
      if (polls.current >= MAX_POLLS) {
        setAgotado(true);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [ref, consultar]);

  const reverificar = async () => {
    setVerificando(true);
    const data = await consultar();
    if (data) setResultado(data);
    setVerificando(false);
  };

  const planNombre =
    resultado && esPlanId(resultado.plan) ? PLANES[resultado.plan].nombre : null;

  let cuerpo: React.ReactNode;

  if (!ref) {
    cuerpo = (
      <EstadoCard
        icono={
          <div className="w-14 h-14 rounded-2xl bg-[#FFF7F5] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center">
            <XCircle size={28} strokeWidth={1.8} />
          </div>
        }
        eyebrow="Referencia no encontrada"
        titulo="Enlace incompleto"
        detalle="No encontramos la referencia del pago. Si pagaste, tu plan se activará apenas confirmemos el pago."
        accion={
          <button
            type="button"
            onClick={() => router.push('/planes')}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans font-bold text-sm transition-colors cursor-pointer border-none"
          >
            Volver a planes
          </button>
        }
      />
    );
  } else if (resultado?.pago === 'approved') {
    cuerpo = (
      <EstadoCard
        icono={
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/25 text-[#0D9488] flex items-center justify-center">
            <CheckCircle2 size={28} strokeWidth={1.8} />
          </div>
        }
        eyebrow="Suscripción activa"
        titulo="¡Pago confirmado!"
        detalle={
          <>
            {planNombre ? `Tu plan ${planNombre} está activo` : 'Tu plan está activo'}
            {resultado.suscripcion?.vence ? (
              <>
                {' '}
                hasta el{' '}
                <span className="font-semibold text-[#3B0D1E] tabular-nums">
                  {formatDate(resultado.suscripcion.vence)}
                </span>
                .
              </>
            ) : (
              '.'
            )}{' '}
            Gracias por confiar en Velli.
          </>
        }
        accion={
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans font-bold text-sm transition-colors cursor-pointer border-none"
          >
            Ir al inicio
          </button>
        }
      />
    );
  } else if (resultado && esFinal(resultado.pago)) {
    cuerpo = (
      <EstadoCard
        icono={
          <div className="w-14 h-14 rounded-2xl bg-[#FFF7F5] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center">
            <XCircle size={28} strokeWidth={1.8} />
          </div>
        }
        eyebrow="Transacción no aprobada"
        titulo="El pago no se completó"
        detalle="Tu banco no aprobó la transacción o el pago fue cancelado. No se hizo ningún cobro; puedes intentar de nuevo."
        accion={
          <button
            type="button"
            onClick={() => router.push('/planes')}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans font-bold text-sm transition-colors cursor-pointer border-none"
          >
            Intentar de nuevo
          </button>
        }
      />
    );
  } else {
    cuerpo = (
      <EstadoCard
        icono={
          agotado ? (
            <div className="w-14 h-14 rounded-2xl bg-[#F5EBE8] border border-[#E8CFC8] text-[#52142B] flex items-center justify-center">
              <Clock4 size={28} strokeWidth={1.8} />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] flex items-center justify-center">
              <span className="w-7 h-7 rounded-full border-[3px] border-[#3B0D1E] border-t-transparent animate-spin inline-block" />
            </div>
          )
        }
        eyebrow={agotado ? 'Verificación bancaria' : 'Validando con pasarela'}
        titulo={agotado ? 'Tu pago sigue en proceso' : 'Confirmando tu pago…'}
        detalle={
          agotado
            ? 'Algunos medios (como PSE) tardan unos minutos. Tu plan se activará automáticamente apenas el banco confirme; también puedes verificar ahora.'
            : 'Estamos verificando con la pasarela de pago. Esto toma solo unos segundos.'
        }
        accion={
          agotado ? (
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={reverificar}
                disabled={verificando}
                className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans font-bold text-sm transition-colors cursor-pointer disabled:opacity-60 border-none"
              >
                {verificando ? 'Verificando…' : 'Verificar ahora'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-white hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#3B0D1E] font-sans font-bold text-sm transition-colors cursor-pointer"
              >
                Ir al inicio
              </button>
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans pb-24">
      <header className="sticky top-0 z-30 bg-[#FAF7F5]/95 backdrop-blur-md border-b border-[#EFE8E4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/planes"
            className="min-h-[44px] inline-flex items-center gap-2 text-xs font-bold text-[#6B535C] hover:text-[#3B0D1E] no-underline transition-colors"
          >
            <ArrowLeft size={16} />
            Volver a Planes
          </Link>
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
            Velli Business Intelligence
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 pt-10">
        {cuerpo}

        <div className="mt-6 flex items-start gap-2.5 text-xs text-[#6B535C] leading-relaxed px-1">
          <ShieldCheck size={16} className="text-[#3B0D1E] shrink-0 mt-0.5" />
          <p className="m-0">
            Transacción procesada de forma segura por Bold. Tu información operativa y las métricas de tu salón permanecen protegidas.
          </p>
        </div>
      </main>
    </div>
  );
}

function EstadoCard({
  icono,
  eyebrow,
  titulo,
  detalle,
  accion,
}: {
  icono: React.ReactNode;
  eyebrow: string;
  titulo: string;
  detalle: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl border border-[#EFE8E4] p-7 sm:p-8 shadow-velvet flex flex-col items-center text-center">
      {icono}
      <span className="mt-4 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
        {eyebrow}
      </span>
      <h1 className="m-0 mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#3B0D1E]">
        {titulo}
      </h1>
      <p className="m-0 mt-2.5 text-sm text-[#6B535C] font-sans leading-relaxed max-w-sm">
        {detalle}
      </p>
      {accion && <div className="mt-6 w-full">{accion}</div>}
    </section>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmacionInner />
    </Suspense>
  );
}
