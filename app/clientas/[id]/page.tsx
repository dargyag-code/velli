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
import { Btn, Chip, VelvetTopHeader } from '@/components/v2';
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
      <article className="bg-white rounded-xl border border-[#E4E4E7] p-6 text-center ">
        <div className="w-12 h-12 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] mx-auto mb-3 flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <h3 className="m-0 font-sans text-base font-bold tracking-tight text-[#111111]">
          Sin cotizaciones ni cierres aún
        </h3>
        <p className="text-xs text-[#52525B] mt-1 mb-4 max-w-xs mx-auto leading-relaxed">
          Cotiza en silla para registrar el diagnóstico capilar, consumo químico sin báscula y cierre financiero de esta clienta.
        </p>
        <Link
          href={`/?clientaId=${clientaId}`}
          className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white text-xs font-bold no-underline transition-colors"
        >
          <Sparkles size={14} /> Cotizar en silla
        </Link>
      </article>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
            Trazabilidad Financiera & Capilar
          </span>
          <h2 className="m-0 mt-0.5 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111] tabular-nums">
            Cotizaciones y Cierres ({cotizaciones.length})
          </h2>
        </div>
        {limite && cotizaciones.length > limite && onVerTodas && (
          <button
            type="button"
            onClick={onVerTodas}
            className="min-h-[40px] px-3 rounded-xl bg-[#FAFAFA] hover:bg-[#F4F4F5] border border-[#E4E4E7] text-xs font-bold text-[#111111] cursor-pointer transition-colors"
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
              className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 font-sans text-sm font-bold text-[#111111] capitalize">
                      {cot.servicioNombre}
                    </h3>
                    {cot.estado === 'cobrada' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#15803D]/25 text-[#15803D] text-[10px] font-bold">
                        <CheckCircle2 size={11} /> Cobrada
                      </span>
                    ) : cot.estado === 'enviada' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFFBEB] border border-[#B45309]/30 text-[#B45309] text-[10px] font-bold">
                        <Clock size={11} /> Por cobrar
                      </span>
                    ) : cot.estado === 'anulada' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E4E4E7] text-[#52525B] text-[10px] font-bold">
                        Anulada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] text-[10px] font-bold">
                        Borrador
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#52525B] mt-1">
                    <span className="font-mono font-semibold tabular-nums text-[#71717A]">
                      {fechaLegible}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#111111] capitalize">
                      <UserCheck size={12} className="text-[#111111]" />
                      {especialista}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-display text-lg font-bold text-[#111111] tabular-nums tracking-tight">
                    {formatearPrecioCop(montoMostrado)}
                  </div>
                  <div className="text-[10px] text-[#71717A] font-semibold uppercase tracking-[0.06em]">
                    {cot.estado === 'cobrada' ? 'Valor cobrado' : 'Valor cotizado'}
                  </div>
                </div>
              </div>

              {etiquetasVars.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {etiquetasVars.map((v) => (
                    <span
                      key={v}
                      className="px-2.5 py-0.5 rounded-full bg-white border border-[#E4E4E7] text-[11px] text-[#52525B] font-semibold"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}

              {consentimientoDigital && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#15803D]/25 text-[11px] font-bold text-[#15803D]">
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

  const visitasConFotos = [...consultas]
    .reverse()
    .filter(
      (c) => (c.fotoAnalisis && c.fotoAnalisis.length > 0) || c.fotoAntes || c.fotoDespues
    );

  const primera =
    visitasConFotos.length >= 2 ? visitasConFotos[visitasConFotos.length - 1] : null;
  const ultima = visitasConFotos.length >= 2 ? visitasConFotos[0] : null;
  const fotoP = primera?.fotoAntes || primera?.fotoDespues || primera?.fotoAnalisis?.[0];
  const fotoU = ultima?.fotoDespues || ultima?.fotoAntes || ultima?.fotoAnalisis?.[0];

  if (visitasConFotos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E4E4E7] text-center py-12 px-5 ">
        <div className="w-14 h-14 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] mx-auto mb-3.5 flex items-center justify-center">
          <ImageIcon size={24} className="text-[#111111]" />
        </div>
        <h3 className="m-0 font-sans text-base font-bold text-[#111111]">
          Aún no hay fotografías
        </h3>
        <p className="text-xs text-[#52525B] mt-1 mb-0">
          Las fotos del diagnóstico IA y registros antes/después aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fotoP && fotoU && (
        <section className="bg-[#111111] border border-[#27272A] relative overflow-hidden rounded-xl p-5 text-white">
          <div className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#E4E4E7] mb-3">
            Evolución · primera vs última visita
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { foto: fotoP, label: 'Primera', sub: formatDate(primera!.fecha) },
              { foto: fotoU, label: 'Última', sub: formatDate(ultima!.fecha) },
            ].map(({ foto, label, sub }) => (
              <button
                key={label}
                type="button"
                onClick={() => setLightbox(foto!)}
                className="relative bg-transparent border-none p-0 cursor-pointer active:scale-[0.98] transition-transform"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto}
                  alt={label}
                  className="w-full aspect-square object-cover rounded-xl border border-[#E4E4E7]/35"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-[#111111]/75 backdrop-blur-sm rounded-b-2xl px-3 py-2 text-left">
                  <p className="m-0 text-xs font-bold text-white">{label}</p>
                  <p className="m-0 font-mono text-[10px] text-[#E4E4E7] tabular-nums">
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
            className="bg-white rounded-xl border border-[#E4E4E7] p-4 "
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-xs font-bold text-[#111111] tabular-nums">
                VISITA · {c.numeroConsulta}
              </span>
              <span className="text-xs text-[#71717A] tabular-nums">· {formatDate(c.fecha)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map(({ url, label }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="relative bg-transparent border-none p-0 cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={label}
                    className="w-full aspect-square object-cover rounded-xl border border-[#E4E4E7]"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-[#111111]/70 rounded-b-xl py-1 text-center">
                    <p className="m-0 text-[10px] text-white font-semibold">{label}</p>
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
          className="fixed inset-0 z-50 bg-[#111111]/95 backdrop-blur-md flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-white/15 border border-[#E4E4E7]/30 text-white flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto completa"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl"
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
      <div className="min-h-screen bg-[#FAFAFA] font-sans">
        <div className="h-56 bg-[#111111] relative loading-pulse">
          <div className="absolute top-12 left-4 min-w-[44px] min-h-[44px] rounded-full bg-white flex items-center justify-center">
            <ArrowLeft size={16} className="text-[#111111]" />
          </div>
        </div>
        <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer h-20 rounded-xl" />
          ))}
        </main>
      </div>
    );
  }

  // ═══ NOT FOUND ══════════════════════════════════════════════════════════
  if (!clienta) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] font-sans">
        <header className="pt-12 pb-3.5 px-4 bg-[#FAFAFA] border-b border-[#E4E4E7]">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="min-w-[44px] min-h-[44px] rounded-full bg-white border border-[#E4E4E7] text-[#111111] flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h1 className="m-0 font-display text-2xl font-semibold text-[#111111]">
            Clienta no encontrada
          </h1>
          <Link
            href="/clientas"
            className="inline-block mt-4 text-sm font-bold text-[#111111] underline"
          >
            Volver a clientas
          </Link>
        </main>
      </div>
    );
  }

  // ═══ MAIN RENDER ════════════════════════════════════════════════════════
  const ultimaConsulta = consultas.at(-1);
  const totalEventosHistorial = cotizaciones.length + consultas.length;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans relative pb-16">
      <VelvetTopHeader />
      {/* ── Cabecera Base Neutra Veli ────────────────────────────────────── */}
      <section className="bg-white border-b border-[#E4E4E7] relative pt-6 pb-6 px-4 sm:px-6 text-[#111111]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Volver"
              className="min-w-[40px] min-h-[40px] rounded-lg bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="flex items-center gap-2">
              {editing ? (
                <button
                  type="button"
                  onClick={cancelEditing}
                  aria-label="Cancelar edición"
                  className="min-w-[40px] min-h-[40px] rounded-lg bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={17} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    aria-label="Editar"
                    className="min-w-[40px] min-h-[40px] rounded-lg bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    aria-label="Eliminar"
                    className="min-w-[40px] min-h-[40px] rounded-lg bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A] tabular-nums">
            FOLIO · {clienta.id.slice(0, 8).toUpperCase()} · DESDE{' '}
            {new Date(clienta.fechaRegistro).getFullYear()}
          </div>
          <h1 className="m-0 font-display text-2xl md:text-3xl font-semibold text-[#111111] tracking-tight mt-1 mb-3 truncate capitalize">
            {clienta.nombre}
          </h1>

          <div className="flex flex-wrap gap-2">
            {clienta.tipoRizoPrincipal && (
              <span className="px-3 py-1 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] text-xs font-bold">
                {getRizoLabel(clienta.tipoRizoPrincipal)}
              </span>
            )}
            <span className="px-3 py-1 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-[#52525B] text-xs font-semibold">
              {resumenFinanciero.cantidadCierres > 0 || clienta.totalVisitas > 0
                ? 'Cliente activo'
                : 'Cliente nuevo'}
            </span>
            {resumenFinanciero.cantidadCierres > 0 && (
              <span className="px-3 py-1 rounded-lg bg-[#F0FDF4] border border-[#15803D]/30 text-[#15803D] text-xs font-bold tabular-nums">
                {resumenFinanciero.cantidadCierres}{' '}
                {resumenFinanciero.cantidadCierres === 1 ? 'cierre' : 'cierres'}
              </span>
            )}
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5">
        {/* ── KPIs de Retención y Ticket de la Clienta ─────────────────── */}
        <div className="grid grid-cols-3 bg-white rounded-xl border border-[#E4E4E7]  overflow-hidden mb-5">
          <div className="py-3.5 px-2.5 text-center border-r border-[#E4E4E7]">
            <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
              Cierres BI
            </div>
            <div className="font-display text-xl font-bold text-[#111111] tabular-nums mt-0.5">
              {resumenFinanciero.cantidadCierres}
            </div>
            <div className="text-[11px] text-[#71717A] tabular-nums">
              {cotizaciones.length} cotiz.
            </div>
          </div>

          <div className="py-3.5 px-2.5 text-center border-r border-[#E4E4E7]">
            <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
              Inversión total
            </div>
            <div className="font-display text-base sm:text-xl font-bold text-[#15803D] tabular-nums mt-0.5 truncate">
              {formatearPrecioCop(resumenFinanciero.totalInvertido)}
            </div>
            <div className="text-[11px] text-[#71717A]">en salón</div>
          </div>

          <div className="py-3.5 px-2.5 text-center">
            <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#52525B]">
              Última visita
            </div>
            <div className="font-display text-sm sm:text-base font-bold text-[#111111] tabular-nums mt-1 truncate">
              {clienta.ultimaVisita
                ? formatDate(clienta.ultimaVisita).split(' ').slice(0, 2).join(' ')
                : '—'}
            </div>
            <div className="text-[11px] text-[#71717A] tabular-nums">
              {consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'}
            </div>
          </div>
        </div>

        {/* ── Acciones principales (CTA maestro siempre a /?clientaId=...) ── */}
        {!editing && (
          <div className="flex gap-2.5 flex-wrap mb-5">
            <Link href={`/?clientaId=${clienta.id}`} className="basis-full no-underline">
              <Btn variant="primary" size="lg" fullWidth icon={<Sparkles size={15} />}>
                Cotizar en Silla
              </Btn>
            </Link>
            {clienta.telefono && (
              <>
                <a href={`tel:${clienta.telefono}`} className="flex-1 min-w-0 no-underline">
                  <Btn variant="outline" size="md" fullWidth icon={<Phone size={14} />}>
                    Llamar
                  </Btn>
                </a>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="flex-1 bg-transparent border-none p-0"
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
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6  space-y-4">
            <Input
              label="Nombre completo *"
              value={String(editData.nombre ?? '')}
              onChange={(e) => setEditData((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre de la clienta"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Edad"
                type="number"
                value={String(editData.edad ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, edad: Number(e.target.value) }))}
                placeholder="Años"
                className="tabular-nums"
              />
              <Input
                label="WhatsApp / Teléfono"
                type="tel"
                value={String(editData.telefono ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="+57 300 123 4567"
                className="tabular-nums"
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
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block mb-2">
                Nivel de estrés
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['bajo', 'medio', 'alto'] as const).map((nivel) => {
                  const active = editData.nivelEstres === nivel;
                  return (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => setEditData((p) => ({ ...p, nivelEstres: nivel }))}
                      className={`min-h-[46px] px-3 py-2 rounded-xl capitalize text-xs font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#F4F4F5] text-[#111111] border-[#E4E4E7]'
                          : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                      }`}
                    >
                      {nivel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#E4E4E7] pt-4 space-y-4">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#B45309] block">
                Datos de salud capilar
              </span>

              <div>
                <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block mb-2">
                  ¿Embarazo o lactancia?
                </span>
                <div className="grid grid-cols-2 gap-2">
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
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111]'
                        }`}
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

            {/* ── Segmented Control de la Ficha ────────────────────────── */}
            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-white border border-[#E4E4E7] mb-5">
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
                    className={`min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-bold tabular-nums transition-all cursor-pointer border-none ${
                      active
                        ? 'bg-[#111111] text-white'
                        : 'bg-transparent text-[#52525B] hover:bg-[#FAFAFA] hover:text-[#111111]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab: Resumen & Legal ──────────────────────────────────── */}
            {tab === 'info' && (
              <div className="space-y-4">
                <SeccionCotizacionesClienta
                  cotizaciones={cotizaciones}
                  clientaId={clienta.id}
                  limite={4}
                  onVerTodas={() => setTab('historial')}
                />

                {ultimaConsulta?.notasEstilista && (
                  <article className="p-5 bg-white rounded-xl border border-[#E4E4E7] border-l-4 border-l-[#111111] ">
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
                      Notas de la última consulta
                    </span>
                    <p className="m-0 mt-1.5 font-display italic text-sm leading-relaxed text-[#111111]">
                      «{ultimaConsulta.notasEstilista}»
                    </p>
                    <div className="mt-2 font-mono text-[10px] font-semibold text-[#71717A] tracking-[0.08em] tabular-nums">
                      — {formatDate(ultimaConsulta.fecha).toUpperCase()}
                    </div>
                  </article>
                )}

                {/* Datos personales */}
                <article className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6 ">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block mb-3">
                    Datos personales
                  </span>
                  <div className="space-y-2.5">
                    {[
                      {
                        label: 'WhatsApp / Teléfono',
                        value: clienta.telefono || '—',
                        mono: !!clienta.telefono,
                      },
                      { label: 'Email', value: clienta.email || '—' },
                      {
                        label: 'Edad',
                        value: clienta.edad ? `${clienta.edad} años` : '—',
                        tabular: true,
                      },
                      {
                        label: 'Nivel de estrés',
                        value: clienta.nivelEstres || '—',
                        cap: !!clienta.nivelEstres,
                      },
                      { label: 'Registro', value: formatDate(clienta.fechaRegistro), mono: true },
                    ].map(({ label, value, mono, cap, tabular }) => (
                      <div
                        key={label}
                        className="flex justify-between items-baseline gap-3 pb-2 border-b border-[#FAFAFA] last:border-none last:pb-0"
                      >
                        <span className="text-xs text-[#52525B]">{label}</span>
                        <span
                          className={`text-sm font-semibold text-[#111111] text-right truncate ${
                            mono ? 'font-mono text-xs tabular-nums' : ''
                          } ${tabular ? 'tabular-nums' : ''} ${cap ? 'capitalize' : ''}`}
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
                  <article className="p-5 rounded-xl bg-[#FFFBEB] border border-[#B45309]/30 space-y-2.5">
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#B45309] block">
                      Salud capilar y antecedentes
                    </span>
                    {clienta.alergias && (
                      <div>
                        <p className="m-0 text-[11px] font-bold text-[#B45309]">Alergias</p>
                        <p className="m-0 mt-0.5 text-sm text-[#111111]">{clienta.alergias}</p>
                      </div>
                    )}
                    {clienta.condicionesMedicas && (
                      <div>
                        <p className="m-0 text-[11px] font-bold text-[#B45309]">
                          Condiciones médicas
                        </p>
                        <p className="m-0 mt-0.5 text-sm text-[#111111]">
                          {clienta.condicionesMedicas}
                        </p>
                      </div>
                    )}
                    {clienta.medicamentos && (
                      <div>
                        <p className="m-0 text-[11px] font-bold text-[#B45309]">Medicamentos</p>
                        <p className="m-0 mt-0.5 text-sm text-[#111111]">{clienta.medicamentos}</p>
                      </div>
                    )}
                    {clienta.embarazo && (
                      <div className="pt-2 border-t border-[#B45309]/20">
                        <Chip tone="amber" dot>
                          Embarazo o lactancia
                        </Chip>
                      </div>
                    )}
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

                <section className="bg-white rounded-xl border border-[#E4E4E7] p-5 sm:p-6 ">
                  <div className="mb-4">
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525B] block">
                      Fichas Técnicas Previas
                    </span>
                    <h2 className="m-0 mt-0.5 font-sans text-base md:text-lg font-bold tracking-tight text-[#111111] tabular-nums">
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
        <p className="m-0 text-sm text-[#111111] leading-relaxed">
          Esto borrará toda la información de <strong>{clienta.nombre}</strong> y su historial.
        </p>
        <p className="mt-2.5 mb-5 text-xs text-[#52525B]">
          La acción no se puede deshacer. ¿Estás segura?
        </p>
        <div className="flex gap-2.5">
          <Btn variant="outline" size="md" fullWidth onClick={() => setShowDelete(false)}>
            Cancelar
          </Btn>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B45309] hover:opacity-95 text-white font-sans text-xs font-bold border-none inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            <Trash2 size={14} />
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
