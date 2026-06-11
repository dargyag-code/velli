'use client';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock4, XCircle } from 'lucide-react';
import { InnerHeader, Btn } from '@/components/v2';
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
    pago === 'approved' || pago === 'rejected' || pago === 'voided' || pago === 'expired' || pago === 'error';

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

  // ── Render ────────────────────────────────────────────────────────────
  const planNombre =
    resultado && esPlanId(resultado.plan) ? PLANES[resultado.plan].nombre : null;

  let cuerpo: React.ReactNode;

  if (!ref) {
    cuerpo = (
      <EstadoCard
        icono={<XCircle size={40} strokeWidth={1.6} style={{ color: '#A63D26' }} />}
        titulo="Enlace incompleto"
        detalle="No encontramos la referencia del pago. Si pagaste, tu plan se activará apenas confirmemos el pago."
        accion={<Btn fullWidth onClick={() => router.push('/planes')}>Volver a planes</Btn>}
      />
    );
  } else if (resultado?.pago === 'approved') {
    cuerpo = (
      <EstadoCard
        icono={<CheckCircle2 size={40} strokeWidth={1.6} style={{ color: 'var(--primary)' }} />}
        titulo="¡Pago confirmado!"
        detalle={
          <>
            {planNombre ? `Tu plan ${planNombre} está activo` : 'Tu plan está activo'}
            {resultado.suscripcion?.vence
              ? ` hasta el ${formatDate(resultado.suscripcion.vence)}.`
              : '.'}{' '}
            Gracias por confiar en Velli.
          </>
        }
        accion={<Btn fullWidth onClick={() => router.push('/')}>Ir al inicio</Btn>}
      />
    );
  } else if (resultado && esFinal(resultado.pago)) {
    cuerpo = (
      <EstadoCard
        icono={<XCircle size={40} strokeWidth={1.6} style={{ color: '#A63D26' }} />}
        titulo="El pago no se completó"
        detalle="Tu banco no aprobó la transacción o el pago fue cancelado. No se hizo ningún cobro — puedes intentar de nuevo."
        accion={<Btn fullWidth onClick={() => router.push('/planes')}>Intentar de nuevo</Btn>}
      />
    );
  } else {
    cuerpo = (
      <EstadoCard
        icono={
          agotado ? (
            <Clock4 size={40} strokeWidth={1.6} style={{ color: 'var(--secondary-deep)' }} />
          ) : (
            <span
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--primary)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 800ms linear infinite',
                display: 'inline-block',
              }}
            />
          )
        }
        titulo={agotado ? 'Tu pago sigue en proceso' : 'Confirmando tu pago…'}
        detalle={
          agotado
            ? 'Algunos medios (como PSE) tardan unos minutos. Tu plan se activará automáticamente apenas el banco confirme — también puedes verificar ahora.'
            : 'Estamos verificando con la pasarela de pago. Esto toma solo unos segundos.'
        }
        accion={
          agotado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <Btn fullWidth onClick={reverificar} disabled={verificando}>
                {verificando ? 'Verificando…' : 'Verificar ahora'}
              </Btn>
              <Btn fullWidth variant="outline" onClick={() => router.push('/')}>
                Ir al inicio
              </Btn>
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="v-grain" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <InnerHeader eyebrow="Pago" title="Confirmación" backHref="/planes" />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px 120px' }}>{cuerpo}</main>
    </div>
  );
}

function EstadoCard({
  icono,
  titulo,
  detalle,
  accion,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div
      className="v-card-hi"
      style={{
        padding: '34px 24px 26px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
      }}
    >
      {icono}
      <h2
        style={{
          margin: '10px 0 0',
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          letterSpacing: '-0.01em',
          color: 'var(--text-main)',
        }}
      >
        {titulo}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.5,
        }}
      >
        {detalle}
      </p>
      {accion && <div style={{ marginTop: 16, width: '100%' }}>{accion}</div>}
    </div>
  );
}

export default function ConfirmacionPage() {
  // useSearchParams exige Suspense en el App Router.
  return (
    <Suspense fallback={null}>
      <ConfirmacionInner />
    </Suspense>
  );
}
