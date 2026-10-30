'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  MessageCircle,
  Trash2,
  Pencil,
  Check,
  X,
  Image as ImageIcon,
  ArrowLeft,
  MoreHorizontal,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Clock,
} from 'lucide-react';
import { BottomNavV2, Btn, Chip } from '@/components/v2';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import HistorialTimeline from '@/components/clienta/HistorialTimeline';
import SeguridadLegal from '@/components/clienta/SeguridadLegal';
import ListaPorCobrar from '@/components/cotizador/ListaPorCobrar';
import { getClientaById, getConsultasByClienta, deleteClienta, updateClienta } from '@/lib/db';
import {
  CATALOGO_VARIABLES,
  formatearPrecioCop,
  listarCotizacionesPorClienta,
  type Cotizacion,
  type VariablesCotizacion,
} from '@/lib/cotizador';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { resolveFotoUrl, resolveFotoUrls } from '@/lib/storage';
import { enlaceWhatsApp } from '@/lib/whatsapp';

type Tab = 'info' | 'historial' | 'galeria';

function etiquetaVariable<T extends string>(
  opciones: ReadonlyArray<{ valor: T; etiqueta: string }>,
  valor?: T
): string | null {
  if (!valor) return null;
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

function chipsVariablesCapilares(variables?: VariablesCotizacion): string[] {
  if (!variables) return [];
  const res: string[] = [];
  const largo = etiquetaVariable(CATALOGO_VARIABLES.largo, variables.largo?.valor);
  const densidad = etiquetaVariable(CATALOGO_VARIABLES.densidad, variables.densidad?.valor);
  const estado = etiquetaVariable(CATALOGO_VARIABLES.estado, variables.estado?.valor);
  const canas = etiquetaVariable(CATALOGO_VARIABLES.canas, variables.canas?.valor);

  if (largo) res.push(`Largo: ${largo}`);
  if (densidad) res.push(`Densidad: ${densidad}`);
  if (estado) res.push(`Fibra: ${estado}`);
  if (canas) res.push(`Canas: ${canas}`);
  return res;
}

// ── Sección de Cotizaciones y Cierres de la Clienta ───────────────────────
function SeccionCotizacionesClienta({
  cotizaciones,
  clientaId,
  limite,
  onVerTodas,
}: {
  cotizaciones: Cotizacion[];
  clientaId: string;
  limite?: number;
  onVerTodas?: () => void;
}) {
  const visibles = limite ? cotizaciones.slice(0, limite) : cotizaciones;

  if (cotizaciones.length === 0) {
    return (
      <article className="bg-white rounded-2xl border border-[#EFE8E4] p-6 text-center shadow-[0_8px_24px_-10px_rgba(59,13,30,0.06)]">
        <div className="w-11 h-11 rounded-2xl bg-[#F7ECEF] text-[#3B0D1E] mx-auto mb-3 flex items-center justify-center">
          <Sparkles size={19} />
        </div>
        <h3 className="text-base font-bold text-[#1C1518]">Sin cotizaciones ni cierres aún</h3>
        <p className="text-xs text-[#6E6266] mt-1 mb-4 max-w-xs mx-auto leading-relaxed">
          Cotiza en silla para registrar el diagnóstico capilar, consumo químico sin báscula y cierre financiero de esta clienta.
        </p>
        <Link
          href={`/?clientaId=${clientaId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#3B0D1E] hover:bg-[#6E1E3A] text-[#FAF7F5] text-xs font-bold no-underline transition-colors"
        >
          <Sparkles size={13} /> Cotizar en silla
        </Link>
      </article>
    );
  }

  return (
    <section className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-[0_12px_28px_-10px_rgba(59,13,30,0.06)] space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6E1E3A]">
            Trazabilidad Financiera & Capilar
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#1C1518] mt-0.5">
            Cotizaciones y Cierres ({cotizaciones.length})
          </h2>
        </div>
        {limite && cotizaciones.length > limite && onVerTodas && (
          <button
            type="button"
            onClick={onVerTodas}
            className="text-xs font-bold text-[#3B0D1E] hover:underline cursor-pointer"
          >
            Ver todas →
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visibles.map((cot) => {
          const fechaIso = (cot.cobradoAt || cot.createdAt || '').slice(0, 10);
          const fechaLegible = fechaIso ? formatDate(fechaIso) : 'Reciente';
          const montoMostrado =
            cot.estado === 'cobrada'
              ? (cot.precioCobrado ?? cot.precioCotizado)
              : cot.precioCotizado;
          const consentimientoDigital = cot.perfilExtendido?.['consentimientoAceptado'] === true;
          const etiquetasVars = chipsVariablesCapilares(cot.variables);
          const especialista = cot.estilistaNombre?.trim() || 'Especialista del salón';

          return (
            <div
              key={cot.id}
              className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] space-y-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[#1C1518]">{cot.servicioNombre}</h3>
                    {cot.estado === 'cobrada' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAF6F4] text-[#0D9488] text-[10px] font-bold">
                        <CheckCircle2 size={11} /> Cobrada
                      </span>
                    ) : cot.estado === 'enviada' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FDF2EC] text-[#D97757] text-[10px] font-bold">
                        <Clock size={11} /> Por cobrar
                      </span>
                    ) : cot.estado === 'anulada' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EFE8E4] text-[#6E6266] text-[10px] font-bold">
                        Anulada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F7ECEF] text-[#3B0D1E] text-[10px] font-bold">
                        Borrador
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6E6266] mt-1">
                    <span className="font-mono tabular-nums">{fechaLegible}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#1C1518]">
                      <UserCheck size={12} className="text-[#3B0D1E]" />
                      {especialista}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-[#3B0D1E] tabular-nums">
                    {formatearPrecioCop(montoMostrado)}
                  </div>
                  <div className="text-[10px] text-[#6E6266]">
                    {cot.estado === 'cobrada' ? 'Valor cobrado' : 'Valor cotizado'}
                  </div>
                </div>
              </div>

              {etiquetasVars.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {etiquetasVars.map((v) => (
                    <span
                      key={v}
                      className="px-2.5 py-0.5 rounded-full bg-white border border-[#EFE8E4] text-[11px] text-[#6E6266] font-medium"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}

              {consentimientoDigital && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF6F4] border border-[#0D9488]/25 text-[11px] font-semibold text-[#0D9488]">
                    <ShieldCheck size={12} /> Consentimiento digital aceptado
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Galería de fotos por visita ────────────────────────────────────────────
function GaleriaTab({ consultas }: { consultas: Consulta[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const visitasConFotos = [...consultas].reverse().filter(
    (c) => (c.fotoAnalisis && c.fotoAnalisis.length > 0) || c.fotoAntes || c.fotoDespues
  );

  const primera =
    visitasConFotos.length >= 2 ? visitasConFotos[visitasConFotos.length - 1] : null;
  const ultima = visitasConFotos.length >= 2 ? visitasConFotos[0] : null;
  const fotoP = primera?.fotoAntes || primera?.fotoDespues || primera?.fotoAnalisis?.[0];
  const fotoU = ultima?.fotoDespues || ultima?.fotoAntes || ultima?.fotoAnalisis?.[0];

  if (visitasConFotos.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-[#EFE8E4] text-center py-12 px-5">
        <div className="w-14 h-14 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] mx-auto mb-3.5 flex items-center justify-center">
          <ImageIcon size={24} className="text-[#96888C]" />
        </div>
        <p className="text-base font-bold text-[#1C1518] m-0">Aún no hay fotografías</p>
        <p className="text-xs text-[#6E6266] mt-1 mb-0">
          Las fotos del diagnóstico IA y registros antes/después aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {fotoP && fotoU && (
        <section
          className="v-grain"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 18,
            padding: 16,
            background: 'linear-gradient(135deg, #1F050F 0%, #3B0D1E 100%)',
            color: '#FAF7F5',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="v-caps" style={{ color: '#E8CFC8', marginBottom: 10 }}>
            Evolución · primera vs última visita
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { foto: fotoP, label: 'Primera', sub: formatDate(primera!.fecha) },
              { foto: fotoU, label: 'Última', sub: formatDate(ultima!.fecha) },
            ].map(({ foto, label, sub }) => (
              <button
                key={label}
                type="button"
                onClick={() => setLightbox(foto!)}
                className="active:scale-95 transition-transform"
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto}
                  alt={label}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid rgba(232, 207, 200, 0.35)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(31, 5, 15, 0.72)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '0 0 12px 12px',
                    padding: '6px 8px',
                    textAlign: 'left',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#FAF7F5' }}>
                    {label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: '#E8CFC8',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {visitasConFotos.map((c) => {
        const fotos: { url: string; label: string }[] = [];
        if (c.fotoAntes) fotos.push({ url: c.fotoAntes, label: 'Antes' });
        if (c.fotoDespues) fotos.push({ url: c.fotoDespues, label: 'Después' });
        (c.fotoAnalisis || []).forEach((url, i) =>
          fotos.push({ url, label: `Foto ${i + 1}` })
        );

        return (
          <article
            key={c.id}
            className="bg-white rounded-2xl border border-[#EFE8E4]"
            style={{ padding: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="v-num">VISITA · {c.numeroConsulta}</span>
              <span style={{ fontSize: 10, color: '#96888C' }}>· {formatDate(c.fecha)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {fotos.map(({ url, label }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(url)}
                  style={{
                    position: 'relative',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={label}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: '1px solid #EFE8E4',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(31, 5, 15, 0.65)',
                      borderRadius: '0 0 10px 10px',
                      padding: '2px 0',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 9, color: '#FAF7F5', fontWeight: 600 }}>
                      {label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </article>
        );
      })}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(31, 5, 15, 0.95)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(232, 207, 200, 0.3)',
              color: '#FAF7F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto completa"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 16,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════════
export default function ClientaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cotizacionesRefresh, setCotizacionesRefresh] = useState(0);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Clienta>>({});
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, cs, cots] = await Promise.all([
        getClientaById(id),
        getConsultasByClienta(id),
        listarCotizacionesPorClienta(id).catch(() => [] as Cotizacion[]),
      ]);
      const withSignedPhotos = await Promise.all(
        cs.map(async (consulta) => {
          const [fotoAntes, fotoDespues, fotoAnalisis] = await Promise.all([
            resolveFotoUrl(consulta.fotoAntes),
            resolveFotoUrl(consulta.fotoDespues),
            resolveFotoUrls(consulta.fotoAnalisis),
          ]);
          return {
            ...consulta,
            fotoAntes,
            fotoDespues,
            fotoAnalisis: fotoAnalisis.length ? fotoAnalisis : undefined,
          };
        })
      );
      setClienta(c || null);
      setConsultas(withSignedPhotos);
      setCotizaciones(cots);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Refrescar cotizaciones de la clienta cuando se cobre o anule desde ListaPorCobrar
  useEffect(() => {
    if (cotizacionesRefresh === 0) return;
    listarCotizacionesPorClienta(id)
      .then((cots) => setCotizaciones(cots))
      .catch(() => {});
  }, [cotizacionesRefresh, id]);

  const resumenFinanciero = useMemo(() => {
    const cobradas = cotizaciones.filter((c) => c.estado === 'cobrada');
    const totalInvertido = cobradas.reduce(
      (acc, c) => acc + (c.precioCobrado ?? c.precioCotizado),
      0
    );
    return {
      cantidadCierres: cobradas.length,
      totalInvertido,
    };
  }, [cotizaciones]);

  const startEditing = () => {
    if (!clienta) return;
    setEditData({
      nombre: clienta.nombre,
      edad: clienta.edad,
      telefono: clienta.telefono,
      email: clienta.email || '',
      alergias: clienta.alergias || '',
      condicionesMedicas: clienta.condicionesMedicas || '',
      medicamentos: clienta.medicamentos || '',
      embarazo: clienta.embarazo,
      nivelEstres: clienta.nivelEstres,
    });
    setEditing(true);
    setTab('info');
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditData({});
    setSaveOk(false);
  };

  const saveEditing = async () => {
    if (!clienta) return;
    setSaving(true);
    try {
      const updated: Clienta = {
        ...clienta,
        nombre: (editData.nombre ?? clienta.nombre).trim() || clienta.nombre,
        edad: Number(editData.edad) || clienta.edad,
        telefono: editData.telefono ?? clienta.telefono,
        email: editData.email || undefined,
        nivelEstres: (editData.nivelEstres as Clienta['nivelEstres']) ?? clienta.nivelEstres,
        embarazo: editData.embarazo ?? clienta.embarazo,
        alergias: editData.alergias || undefined,
        condicionesMedicas: editData.condicionesMedicas || undefined,
        medicamentos: editData.medicamentos || undefined,
      };
      await updateClienta(updated);
      setClienta(updated);
      setSaveOk(true);
      showToast('Clienta actualizada', 'success');
      setTimeout(() => {
        setEditing(false);
        setSaveOk(false);
      }, 1200);
    } catch (e) {
      console.error('[clientas.update]', e);
      showToast('No se pudieron guardar los cambios', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteClienta(id);
      showToast(`${clienta?.nombre || 'Clienta'} eliminada`, 'success');
      router.push('/clientas');
    } catch (e) {
      console.error('[clientas.delete]', e);
      showToast('No se pudo eliminar la clienta', 'error');
      setDeleting(false);
    }
  };

  const handleWhatsApp = () => {
    if (!clienta?.telefono) return;
    const url = enlaceWhatsApp(clienta.telefono);
    if (!url) {
      showToast('Ese teléfono no sirve para WhatsApp. Revisa que tenga 10 dígitos.', 'error');
      return;
    }
    window.open(url, '_blank');
  };

  // ═══ LOADING ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F5' }}>
        <div
          style={{ height: 240, background: '#3B0D1E', position: 'relative' }}
          className="loading-pulse"
        >
          <div
            style={{
              position: 'absolute',
              top: 50,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#FFFFFF',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={16} style={{ color: '#1C1518' }} />
          </div>
        </div>
        <main style={{ maxWidth: 768, margin: '0 auto', padding: '18px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 80 }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ═══ NOT FOUND ══════════════════════════════════════════════════════════
  if (!clienta) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F5' }}>
        <header
          style={{
            padding: '54px 16px 14px',
            background: '#FFFFFF',
            borderBottom: '1px solid #EFE8E4',
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#FAF7F5',
              border: '1px solid #EFE8E4',
              color: '#1C1518',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
          </button>
        </header>
        <main style={{ maxWidth: 768, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#1C1518' }}>
            Clienta no encontrada
          </p>
          <Link
            href="/clientas"
            style={{
              display: 'inline-block',
              marginTop: 14,
              color: '#3B0D1E',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'underline',
            }}
          >
            Volver a clientas
          </Link>
        </main>
        <BottomNavV2 />
      </div>
    );
  }

  // ═══ MAIN RENDER ════════════════════════════════════════════════════════
  const ultimaConsulta = consultas.at(-1);
  const totalEventosHistorial = cotizaciones.length + consultas.length;

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F5', position: 'relative' }}>
      {/* ── Hero Velvet Studio ───────────────────────────────────────────── */}
      <section className="v-gradient-hero v-grain relative pt-12 pb-6 px-4 sm:px-6 text-[#FAF7F5]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Volver"
              className="w-9 h-9 rounded-full bg-[#FAF7F5]/15 hover:bg-[#FAF7F5]/25 border border-[#E8CFC8]/25 text-[#FAF7F5] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="flex items-center gap-2">
              {editing ? (
                <button
                  type="button"
                  onClick={cancelEditing}
                  aria-label="Cancelar edición"
                  className="w-9 h-9 rounded-full bg-[#FAF7F5]/15 hover:bg-[#FAF7F5]/25 border border-[#E8CFC8]/25 text-[#FAF7F5] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    aria-label="Editar"
                    className="w-9 h-9 rounded-full bg-[#FAF7F5]/15 hover:bg-[#FAF7F5]/25 border border-[#E8CFC8]/25 text-[#FAF7F5] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    aria-label="Eliminar"
                    className="w-9 h-9 rounded-full bg-[#FAF7F5]/15 hover:bg-[#FAF7F5]/25 border border-[#E8CFC8]/25 text-[#FAF7F5] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#E8CFC8]">
            FOLIO · {clienta.id.slice(0, 8).toUpperCase()} · DESDE{' '}
            {new Date(clienta.fechaRegistro).getFullYear()}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#FAF7F5] tracking-tight mt-1 mb-3 truncate">
            {clienta.nombre}
          </h1>

          <div className="flex flex-wrap gap-2">
            {clienta.tipoRizoPrincipal && (
              <span className="px-3 py-1 rounded-full bg-[#E8CFC8] text-[#1F050F] text-xs font-bold">
                {getRizoLabel(clienta.tipoRizoPrincipal)}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-[#FAF7F5]/15 border border-[#E8CFC8]/25 text-[#FAF7F5] text-xs font-semibold">
              {resumenFinanciero.cantidadCierres > 0 || clienta.totalVisitas > 0
                ? 'Clienta activa'
                : 'Clienta nueva'}
            </span>
            {resumenFinanciero.cantidadCierres > 0 && (
              <span className="px-3 py-1 rounded-full bg-[#0D9488]/25 border border-[#0D9488]/40 text-[#FAF7F5] text-xs font-bold tabular-nums">
                {resumenFinanciero.cantidadCierres}{' '}
                {resumenFinanciero.cantidadCierres === 1 ? 'cierre' : 'cierres'}
              </span>
            )}
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '18px 16px 120px' }}>
        {/* ── KPIs de Retención y Ticket de la Clienta ─────────────────── */}
        <div className="grid grid-cols-3 bg-white rounded-2xl border border-[#EFE8E4] shadow-[0_8px_24px_-10px_rgba(59,13,30,0.06)] overflow-hidden mb-5">
          <div className="py-3.5 px-2.5 text-center border-r border-[#EFE8E4]">
            <div className="v-num" style={{ fontSize: 9 }}>
              CIERRES BI
            </div>
            <div className="text-base font-bold text-[#1C1518] tabular-nums mt-0.5">
              {resumenFinanciero.cantidadCierres}
            </div>
            <div className="text-[10px] text-[#6E6266]">
              {cotizaciones.length} cotiz.
            </div>
          </div>

          <div className="py-3.5 px-2.5 text-center border-r border-[#EFE8E4]">
            <div className="v-num" style={{ fontSize: 9 }}>
              INVERSIÓN TOTAL
            </div>
            <div className="text-sm sm:text-base font-bold text-[#3B0D1E] tabular-nums mt-0.5 truncate">
              {formatearPrecioCop(resumenFinanciero.totalInvertido)}
            </div>
            <div className="text-[10px] text-[#6E6266]">en salón</div>
          </div>

          <div className="py-3.5 px-2.5 text-center">
            <div className="v-num" style={{ fontSize: 9 }}>
              ÚLTIMA VISITA
            </div>
            <div className="text-sm sm:text-base font-bold text-[#1C1518] mt-0.5 truncate">
              {clienta.ultimaVisita
                ? formatDate(clienta.ultimaVisita).split(' ').slice(0, 2).join(' ')
                : '—'}
            </div>
            <div className="text-[10px] text-[#6E6266]">
              {consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'}
            </div>
          </div>
        </div>

        {/* ── Acciones principales (CTA maestro siempre a /?clientaId=...) ── */}
        {!editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <Link
              href={`/?clientaId=${clienta.id}`}
              style={{ flex: '1 1 100%', textDecoration: 'none' }}
            >
              <Btn variant="primary" size="lg" fullWidth icon={<Sparkles size={15} />}>
                Cotizar en Silla
              </Btn>
            </Link>
            {clienta.telefono && (
              <>
                <a
                  href={`tel:${clienta.telefono}`}
                  style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
                >
                  <Btn variant="outline" size="md" fullWidth icon={<Phone size={14} />}>
                    Llamar
                  </Btn>
                </a>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: 0 }}
                >
                  <Btn variant="soft" size="md" fullWidth icon={<MessageCircle size={14} />}>
                    WhatsApp
                  </Btn>
                </button>
              </>
            )}
          </div>
        )}

        {/* ── MODO EDITAR ───────────────────────────────────────────────── */}
        {editing ? (
          <div className="bg-white rounded-3xl border border-[#EFE8E4] p-5 space-y-4">
            <Input
              label="Nombre completo *"
              value={String(editData.nombre ?? '')}
              onChange={(e) => setEditData((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre de la clienta"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Edad"
                type="number"
                value={String(editData.edad ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, edad: Number(e.target.value) }))}
                placeholder="Años"
              />
              <Input
                label="WhatsApp / Teléfono"
                type="tel"
                value={String(editData.telefono ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="+57 300 123 4567"
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={String(editData.email ?? '')}
              onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
              placeholder="valentina@ejemplo.co"
            />

            <div>
              <p className="v-caps" style={{ marginBottom: 8 }}>
                Nivel de estrés
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['bajo', 'medio', 'alto'] as const).map((nivel) => {
                  const active = editData.nivelEstres === nivel;
                  return (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => setEditData((p) => ({ ...p, nivelEstres: nivel }))}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: 12,
                        textTransform: 'capitalize',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                        background: active ? '#F7ECEF' : '#FAF7F5',
                        color: active ? '#3B0D1E' : '#6E6266',
                        border: `1px solid ${active ? '#DFC5CE' : '#EFE8E4'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {nivel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid #EFE8E4',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <p className="v-caps">Datos de salud capilar</p>

              <div>
                <p className="v-caps" style={{ marginBottom: 8 }}>
                  ¿Embarazo o lactancia?
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { v: true, label: 'Sí' },
                    { v: false, label: 'No' },
                  ].map(({ v, label }) => {
                    const active = (editData.embarazo ?? false) === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setEditData((p) => ({ ...p, embarazo: v }))}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'var(--font-sans)',
                          background: active ? '#F7ECEF' : '#FAF7F5',
                          color: active ? '#3B0D1E' : '#6E6266',
                          border: `1px solid ${active ? '#DFC5CE' : '#EFE8E4'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Alergias a productos capilares"
                value={String(editData.alergias ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, alergias: e.target.value }))}
                placeholder="Opcional — ej. PPD, amoníaco…"
              />
              <Input
                label="Condiciones médicas relevantes"
                value={String(editData.condicionesMedicas ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, condicionesMedicas: e.target.value }))}
                placeholder="Tiroides, dermatitis, etc."
              />
              <Input
                label="Medicamentos que afectan el cabello"
                value={String(editData.medicamentos ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, medicamentos: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <Btn
              variant="primary"
              size="lg"
              fullWidth
              onClick={saveEditing}
              disabled={saving}
              icon={saveOk ? <Check size={16} /> : undefined}
            >
              {saveOk ? '¡Guardado!' : saving ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>
        ) : (
          <>
            {/* ── Cotizaciones pendientes de cerrar en 1 toque ─────────── */}
            <div className="mb-4">
              <ListaPorCobrar
                clientaId={clienta.id}
                clientaNombre={clienta.nombre}
                refreshKey={cotizacionesRefresh}
                onCambio={() => setCotizacionesRefresh((k) => k + 1)}
              />
            </div>

            {/* ── Pestañas de la Ficha ──────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid #EFE8E4',
                marginBottom: 16,
              }}
            >
              {[
                { key: 'info' as const, label: 'Resumen & Legal' },
                { key: 'historial' as const, label: `Historial · ${totalEventosHistorial}` },
                { key: 'galeria' as const, label: 'Galería' },
              ].map(({ key, label }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    style={{
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: active ? '#3B0D1E' : '#96888C',
                      borderBottom: active ? '2px solid #3B0D1E' : '2px solid transparent',
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab: Resumen & Legal ──────────────────────────────────── */}
            {tab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Destacado de Cotizaciones y Cierres directamente en la ficha */}
                <SeccionCotizacionesClienta
                  cotizaciones={cotizaciones}
                  clientaId={clienta.id}
                  limite={4}
                  onVerTodas={() => setTab('historial')}
                />

                {ultimaConsulta?.notasEstilista && (
                  <article
                    style={{
                      padding: '16px 18px',
                      borderLeft: '3px solid #6E1E3A',
                      background: '#FFFFFF',
                      borderRadius: '0 16px 16px 0',
                      borderTop: '1px solid #EFE8E4',
                      borderRight: '1px solid #EFE8E4',
                      borderBottom: '1px solid #EFE8E4',
                    }}
                  >
                    <div className="v-caps" style={{ color: '#6E1E3A' }}>
                      Notas de la última consulta
                    </div>
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontFamily: 'var(--font-serif)',
                        fontStyle: 'italic',
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: '#1C1518',
                      }}
                    >
                      «{ultimaConsulta.notasEstilista}»
                    </p>
                    <div
                      style={{
                        marginTop: 8,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        color: '#6E6266',
                        letterSpacing: '0.1em',
                      }}
                    >
                      — {formatDate(ultimaConsulta.fecha).toUpperCase()}
                    </div>
                  </article>
                )}

                {/* Datos personales */}
                <article className="bg-white rounded-3xl border border-[#EFE8E4] p-5">
                  <div className="v-caps" style={{ marginBottom: 10 }}>
                    Datos personales
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      {
                        label: 'WhatsApp / Teléfono',
                        value: clienta.telefono || '—',
                        mono: !!clienta.telefono,
                      },
                      { label: 'Email', value: clienta.email || '—' },
                      { label: 'Edad', value: clienta.edad ? `${clienta.edad} años` : '—' },
                      {
                        label: 'Nivel de estrés',
                        value: clienta.nivelEstres || '—',
                        cap: !!clienta.nivelEstres,
                      },
                      { label: 'Registro', value: formatDate(clienta.fechaRegistro), mono: true },
                    ].map(({ label, value, mono, cap }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 12,
                          paddingBottom: 6,
                          borderBottom: '1px solid #FAF7F5',
                        }}
                      >
                        <span style={{ fontSize: 11.5, color: '#6E6266' }}>{label}</span>
                        <span
                          style={{
                            fontSize: 13,
                            color: '#1C1518',
                            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
                            textTransform: cap ? 'capitalize' : 'none',
                            fontWeight: 500,
                            textAlign: 'right',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>

                {/* Salud capilar */}
                {(clienta.alergias ||
                  clienta.condicionesMedicas ||
                  clienta.medicamentos ||
                  clienta.embarazo) && (
                  <article
                    style={{
                      padding: 16,
                      borderRadius: 20,
                      background: '#FDF2EC',
                      border: '1px solid rgba(217, 119, 87, 0.28)',
                    }}
                  >
                    <div className="v-caps" style={{ color: '#B85D3B', marginBottom: 10 }}>
                      Salud capilar y antecedentes
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {clienta.alergias && (
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 10.5,
                              color: '#B85D3B',
                              fontWeight: 700,
                            }}
                          >
                            Alergias
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#1C1518' }}>
                            {clienta.alergias}
                          </p>
                        </div>
                      )}
                      {clienta.condicionesMedicas && (
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 10.5,
                              color: '#B85D3B',
                              fontWeight: 700,
                            }}
                          >
                            Condiciones médicas
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#1C1518' }}>
                            {clienta.condicionesMedicas}
                          </p>
                        </div>
                      )}
                      {clienta.medicamentos && (
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 10.5,
                              color: '#B85D3B',
                              fontWeight: 700,
                            }}
                          >
                            Medicamentos
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#1C1518' }}>
                            {clienta.medicamentos}
                          </p>
                        </div>
                      )}
                      {clienta.embarazo && (
                        <div
                          style={{
                            marginTop: 4,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(217, 119, 87, 0.25)',
                          }}
                        >
                          <Chip tone="amber" dot>
                            Embarazo o lactancia
                          </Chip>
                        </div>
                      )}
                    </div>
                  </article>
                )}

                {/* Consentimientos + seguridad química */}
                <SeguridadLegal clienta={clienta} onClientaChange={setClienta} />
              </div>
            )}

            {/* ── Tab: Historial completo (Cotizaciones + Diagnósticos) ── */}
            {tab === 'historial' && (
              <div className="space-y-6">
                <SeccionCotizacionesClienta cotizaciones={cotizaciones} clientaId={clienta.id} />

                <section className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-[0_12px_28px_-10px_rgba(59,13,30,0.06)]">
                  <div className="mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6E6266]">
                      Fichas Técnicas Previas
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C1518] mt-0.5">
                      Diagnósticos Capilares ({consultas.length})
                    </h2>
                  </div>
                  <HistorialTimeline
                    consultas={consultas}
                    clienta={clienta}
                    onCotizacionCreada={() => setCotizacionesRefresh((k) => k + 1)}
                  />
                </section>
              </div>
            )}

            {/* ── Tab: Galería ──────────────────────────────────────────── */}
            {tab === 'galeria' && <GaleriaTab consultas={consultas} />}
          </>
        )}
      </main>

      {/* Delete modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Eliminar clienta">
        <p style={{ margin: 0, fontSize: 14, color: '#1C1518', lineHeight: 1.5 }}>
          Esto borrará toda la información de <strong>{clienta.nombre}</strong> y su historial.
        </p>
        <p style={{ margin: '10px 0 18px', fontSize: 13, color: '#6E6266' }}>
          La acción no se puede deshacer. ¿Estás segura?
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="md" fullWidth onClick={() => setShowDelete(false)}>
            Cancelar
          </Btn>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="active:scale-95 transition-transform"
            style={{
              flex: 1,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              borderRadius: 999,
              background: '#C25949',
              color: '#FAF7F5',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1,
            }}
          >
            <Trash2 size={14} />
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      <BottomNavV2 />
    </div>
  );
}
