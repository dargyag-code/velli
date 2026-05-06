'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, MessageCircle, Trash2, Plus, Calendar, Hash,
  Pencil, Check, X, RotateCcw, Image as ImageIcon, ArrowLeft,
  MoreHorizontal, Heart, ChevronRight,
} from 'lucide-react';
import { Btn, Chip, type ChipTone } from '@/components/v2';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import HistorialTimeline from '@/components/clienta/HistorialTimeline';
import { getClientaById, getConsultasByClienta, deleteClienta, updateClienta } from '@/lib/db';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { resolveFotoUrl, resolveFotoUrls } from '@/lib/storage';

type Tab = 'info' | 'historial' | 'galeria';

// ── Galería de fotos por visita ────────────────────────────────────────────
function GaleriaTab({ consultas }: { consultas: Consulta[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const visitasConFotos = [...consultas].reverse().filter((c) =>
    (c.fotoAnalisis && c.fotoAnalisis.length > 0) || c.fotoAntes || c.fotoDespues
  );

  const primera = visitasConFotos.length >= 2 ? visitasConFotos[visitasConFotos.length - 1] : null;
  const ultima = visitasConFotos.length >= 2 ? visitasConFotos[0] : null;
  const fotoP = primera?.fotoAntes || primera?.fotoDespues || primera?.fotoAnalisis?.[0];
  const fotoU = ultima?.fotoDespues || ultima?.fotoAntes || ultima?.fotoAnalisis?.[0];

  if (visitasConFotos.length === 0) {
    return (
      <div
        className="v-card"
        style={{ textAlign: 'center', padding: '48px 20px' }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bg)',
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageIcon size={24} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 16,
            color: 'var(--text-main)',
          }}
        >
          Aún no hay fotos
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Las fotos del diagnóstico IA y antes/después aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Comparativa evolución */}
      {fotoP && fotoU && (
        <section
          className="v-grain"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 18,
            padding: 16,
            background: 'linear-gradient(135deg, var(--primary-deep) 0%, var(--primary) 100%)',
            color: '#F5EDDC',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="v-caps" style={{ color: 'rgba(232, 194, 144, 0.95)', marginBottom: 10 }}>
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
                    border: '1px solid rgba(232, 194, 144, 0.3)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(20, 36, 26, 0.7)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '0 0 12px 12px',
                    padding: '6px 8px',
                    textAlign: 'left',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-serif)',
                      fontSize: 12,
                      color: '#fff',
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'rgba(232, 194, 144, 0.85)',
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
          <article key={c.id} className="v-card" style={{ padding: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span className="v-num">VISITA · {c.numeroConsulta}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                · {formatDate(c.fecha)}
              </span>
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
                      border: '1px solid var(--border-soft)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(20, 36, 26, 0.6)',
                      borderRadius: '0 0 10px 10px',
                      padding: '2px 0',
                      textAlign: 'center',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 9,
                        color: '#fff',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </article>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(20, 36, 26, 0.95)',
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
              border: '1px solid rgba(232, 194, 144, 0.3)',
              color: '#fff',
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

// ── Helpers ────────────────────────────────────────────────────────────────
function rizoChipTone(tipo?: string): ChipTone {
  if (!tipo) return 'ghost';
  if (['1A', '1B', '1C'].includes(tipo)) return 'ghost';
  if (['2A', '2B', '2C'].includes(tipo)) return 'blue';
  if (['3A', '3B', '3C'].includes(tipo)) return 'green';
  if (['4A', '4B', '4C'].includes(tipo)) return 'gold';
  return 'ghost';
}

// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════════
export default function ClientaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Clienta>>({});
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, cs] = await Promise.all([
        getClientaById(id),
        getConsultasByClienta(id),
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
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
    const tel = clienta.telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  // ═══ LOADING ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ height: 280, background: 'var(--bg-deep)', position: 'relative' }} className="loading-pulse">
          <div
            style={{
              position: 'absolute',
              top: 50,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={16} style={{ color: 'var(--text-main)' }} />
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
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <header
          style={{
            padding: '54px 16px 14px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-soft)',
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
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
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
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text-main)' }}>
            Clienta no encontrada
          </p>
          <Link
            href="/clientas"
            style={{
              display: 'inline-block',
              marginTop: 14,
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'underline',
            }}
          >
            Volver a clientas
          </Link>
        </main>
      </div>
    );
  }

  // ═══ MAIN RENDER ════════════════════════════════════════════════════════
  const ultimaConsulta = consultas.at(-1);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* ── Hero portrait ────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', height: 280, overflow: 'hidden' }}>
        <div
          className="v-photo v-photo-curly v-grain"
          style={{ position: 'absolute', inset: 0, borderRadius: 0 }}
        />
        {/* Top action bar (back + actions) */}
        <div
          style={{
            position: 'absolute',
            top: 50,
            left: 16,
            right: 16,
            display: 'flex',
            justifyContent: 'space-between',
            zIndex: 5,
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
              background: 'rgba(255,255,255,0.95)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} style={{ color: 'var(--text-main)' }} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing ? (
              <button
                type="button"
                onClick={cancelEditing}
                aria-label="Cancelar edición"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} style={{ color: 'var(--text-main)' }} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startEditing}
                  aria-label="Editar"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <Pencil size={15} style={{ color: 'var(--primary)' }} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  aria-label="Eliminar"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <MoreHorizontal size={16} style={{ color: 'var(--text-main)' }} />
                </button>
              </>
            )}
          </div>
        </div>
        {/* Bottom gradient */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 40%, rgba(20, 36, 26, 0.85) 100%)',
          }}
        />
        {/* Title */}
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: 18,
            right: 18,
            color: '#F5EDDC',
            zIndex: 5,
          }}
        >
          <div
            className="v-num"
            style={{ color: 'rgba(232, 194, 144, 0.95)', fontSize: 9.5 }}
          >
            FOLIO · {clienta.id.slice(0, 8).toUpperCase()} · DESDE {new Date(clienta.fechaRegistro).getFullYear()}
          </div>
          <h1
            style={{
              margin: '4px 0 6px',
              fontFamily: 'var(--font-serif)',
              fontSize: 32,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {clienta.nombre}
          </h1>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {clienta.tipoRizoPrincipal && (
              <Chip
                tone="gold"
                style={{
                  background: 'rgba(232, 194, 144, 0.92)',
                  color: '#14241A',
                  borderColor: 'transparent',
                }}
              >
                {getRizoLabel(clienta.tipoRizoPrincipal)}
              </Chip>
            )}
            <Chip
              tone="green"
              dot
              style={{
                background: 'rgba(45, 90, 39, 0.85)',
                color: '#fff',
                borderColor: 'transparent',
              }}
            >
              {clienta.totalVisitas > 0 ? 'Activa' : 'Nueva'}
            </Chip>
            <Chip
              tone="ghost"
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                borderColor: 'transparent',
              }}
            >
              {clienta.totalVisitas} {clienta.totalVisitas === 1 ? 'visita' : 'visitas'}
            </Chip>
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '18px 16px 100px' }}>
        {/* Quick stats strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            background: 'var(--bg-card)',
            borderRadius: 16,
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-xs)',
            overflow: 'hidden',
            marginBottom: 18,
          }}
        >
          {[
            { l: 'CONSULTAS', v: clienta.totalVisitas, s: clienta.totalVisitas === 1 ? '· total' : '· totales' },
            { l: 'REGISTRO', v: formatDate(clienta.fechaRegistro).split(' ').slice(0, 2).join(' '), s: '· fecha' },
            {
              l: 'ÚLTIMA VISITA',
              v: clienta.ultimaVisita ? formatDate(clienta.ultimaVisita).split(' ').slice(0, 2).join(' ') : '—',
              s: clienta.ultimaVisita ? '· en el salón' : '· sin visitas',
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: '14px 10px',
                textAlign: 'center',
                borderRight: i < 2 ? '1px solid var(--border-soft)' : 'none',
              }}
            >
              <div className="v-num" style={{ fontSize: 9 }}>{s.l}</div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 16,
                  color: 'var(--text-main)',
                  marginTop: 2,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                }}
              >
                {s.v}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        {!editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {clienta.telefono && (
              <>
                <a href={`tel:${clienta.telefono}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                  <Btn variant="outline" size="md" fullWidth icon={<Phone size={14} />}>
                    Llamar
                  </Btn>
                </a>
                <button type="button" onClick={handleWhatsApp} style={{ flex: 1, background: 'transparent', border: 'none', padding: 0 }}>
                  <Btn variant="soft" size="md" fullWidth icon={<MessageCircle size={14} />}>
                    WhatsApp
                  </Btn>
                </button>
              </>
            )}
            <Link href={`/diagnostico?clientaId=${clienta.id}`} style={{ flex: clienta.telefono ? '1 1 100%' : 1, textDecoration: 'none' }}>
              <Btn variant="primary" size="md" fullWidth icon={<Plus size={14} />}>
                Nueva consulta
              </Btn>
            </Link>
            {consultas.length > 0 && (
              <Link
                href={`/diagnostico?clientaId=${clienta.id}&repeatFrom=${consultas.at(-1)?.id}`}
                style={{ textDecoration: 'none', flex: '1 1 100%' }}
              >
                <Btn variant="ghost" size="md" fullWidth icon={<RotateCcw size={13} />}>
                  Repetir último diagnóstico
                </Btn>
              </Link>
            )}
          </div>
        )}

        {/* ── MODO EDITAR ───────────────────────────────────────────────── */}
        {editing ? (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                label="Teléfono"
                type="tel"
                value={String(editData.telefono ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="+58 412…"
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={String(editData.email ?? '')}
              onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
              placeholder="correo@ejemplo.com"
            />

            <div>
              <p
                className="v-caps"
                style={{ marginBottom: 8 }}
              >
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
                        background: active ? 'var(--primary-pale)' : 'var(--bg-card)',
                        color: active ? 'var(--primary)' : 'var(--text-secondary)',
                        border: `1px solid ${active ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
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
                borderTop: '1px solid var(--border)',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <p className="v-caps">Datos de salud</p>

              <div>
                <p className="v-caps" style={{ marginBottom: 8 }}>¿Embarazo o lactancia?</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: true, label: 'Sí' }, { v: false, label: 'No' }].map(({ v, label }) => {
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
                          background: active ? 'var(--primary-pale)' : 'var(--bg-card)',
                          color: active ? 'var(--primary)' : 'var(--text-secondary)',
                          border: `1px solid ${active ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
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
                placeholder="Opcional — ej: sulfatos, siliconas…"
              />
              <Input
                label="Condiciones médicas relevantes"
                value={String(editData.condicionesMedicas ?? '')}
                onChange={(e) => setEditData((p) => ({ ...p, condicionesMedicas: e.target.value }))}
                placeholder="Tiroides, anemia, SOP, etc."
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
              icon={
                saveOk ? (
                  <Check size={16} />
                ) : saving ? (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'pulse-soft 1s linear infinite',
                    }}
                    className="loading-pulse"
                  />
                ) : undefined
              }
            >
              {saveOk ? '¡Guardado!' : 'Guardar cambios'}
            </Btn>
          </div>
        ) : (
          <>
            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid var(--border)',
                marginBottom: 14,
              }}
            >
              {[
                { key: 'info' as const, label: 'Información' },
                { key: 'historial' as const, label: `Historial · ${consultas.length}` },
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
                      color: active ? 'var(--primary)' : 'var(--text-tertiary)',
                      borderBottom: active
                        ? '2px solid var(--primary)'
                        : '2px solid transparent',
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab content ────────────────────────────────────────────── */}
            {tab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Notas última visita */}
                {ultimaConsulta?.notasEstilista && (
                  <article
                    style={{
                      padding: '16px 18px',
                      borderLeft: '3px solid var(--secondary)',
                      background: 'var(--secondary-pale)',
                      borderRadius: '0 14px 14px 0',
                    }}
                  >
                    <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
                      Notas de la última visita
                    </div>
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontFamily: 'var(--font-serif)',
                        fontStyle: 'italic',
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: 'var(--primary-deep)',
                      }}
                    >
                      «{ultimaConsulta.notasEstilista}»
                    </p>
                    <div
                      style={{
                        marginTop: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        color: 'var(--secondary-deep)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      — {formatDate(ultimaConsulta.fecha).toUpperCase()}
                    </div>
                  </article>
                )}

                {/* Datos personales */}
                <article className="v-card" style={{ padding: 14 }}>
                  <div className="v-caps" style={{ marginBottom: 10 }}>Datos personales</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Teléfono', value: clienta.telefono || '—', mono: !!clienta.telefono },
                      { label: 'Email', value: clienta.email || '—' },
                      { label: 'Edad', value: clienta.edad ? `${clienta.edad} años` : '—' },
                      { label: 'Nivel de estrés', value: clienta.nivelEstres || '—', cap: !!clienta.nivelEstres },
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
                          borderBottom: '1px solid var(--border-soft)',
                        }}
                      >
                        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{label}</span>
                        <span
                          style={{
                            fontSize: 13,
                            color: 'var(--text-main)',
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
                {(clienta.alergias || clienta.condicionesMedicas || clienta.medicamentos || clienta.embarazo) && (
                  <article
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: 'var(--treat-recon-bg)',
                      border: '1px solid rgba(212, 130, 10, 0.22)',
                    }}
                  >
                    <div className="v-caps" style={{ color: 'var(--treat-recon-color)', marginBottom: 10 }}>
                      Salud capilar
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {clienta.alergias && (
                        <div>
                          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--treat-recon-color)', letterSpacing: '0.04em', fontWeight: 600 }}>
                            Alergias
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-main)' }}>
                            {clienta.alergias}
                          </p>
                        </div>
                      )}
                      {clienta.condicionesMedicas && (
                        <div>
                          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--treat-recon-color)', letterSpacing: '0.04em', fontWeight: 600 }}>
                            Condiciones médicas
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-main)' }}>
                            {clienta.condicionesMedicas}
                          </p>
                        </div>
                      )}
                      {clienta.medicamentos && (
                        <div>
                          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--treat-recon-color)', letterSpacing: '0.04em', fontWeight: 600 }}>
                            Medicamentos
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-main)' }}>
                            {clienta.medicamentos}
                          </p>
                        </div>
                      )}
                      {clienta.embarazo && (
                        <div
                          style={{
                            marginTop: 4,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(212, 130, 10, 0.22)',
                          }}
                        >
                          <Chip tone="amber" dot>Embarazo o lactancia</Chip>
                        </div>
                      )}
                    </div>
                  </article>
                )}

                {/* Sin consultas */}
                {consultas.length === 0 && (
                  <article
                    style={{
                      textAlign: 'center',
                      padding: '32px 20px',
                      background: 'var(--bg-card)',
                      borderRadius: 16,
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text-main)' }}>
                      Sin consultas aún
                    </p>
                    <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Comienza la primera consulta para esta clienta
                    </p>
                    <Link href={`/diagnostico?clientaId=${clienta.id}`}>
                      <Btn variant="primary" size="md" icon={<Plus size={14} />}>
                        Primera consulta
                      </Btn>
                    </Link>
                  </article>
                )}
              </div>
            )}

            {tab === 'historial' && (
              <HistorialTimeline consultas={consultas} clienta={clienta} />
            )}

            {tab === 'galeria' && <GaleriaTab consultas={consultas} />}
          </>
        )}
      </main>

      {/* Delete modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Eliminar clienta">
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-main)', lineHeight: 1.5 }}>
          Esto borrará toda la información de <strong>{clienta.nombre}</strong> y su historial
          ({consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'}).
        </p>
        <p style={{ margin: '10px 0 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
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
              background: 'linear-gradient(180deg, #A03333, #8E2D2D)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(142, 45, 45, 0.32)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'pulse-soft 1s linear infinite',
                }}
                className="loading-pulse"
              />
            ) : (
              <Trash2 size={14} />
            )}
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
