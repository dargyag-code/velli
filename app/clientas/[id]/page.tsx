'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, MessageCircle, Trash2, Plus, Calendar, Hash,
  Pencil, Check, X, RotateCcw, Image as ImageIcon,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import HistorialTimeline from '@/components/clienta/HistorialTimeline';
import { getClientaById, getConsultasByClienta, deleteClienta, updateClienta } from '@/lib/db';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';

type Tab = 'info' | 'historial' | 'galeria';

// ── Galería de fotos por visita ────────────────────────────────────────────

function GaleriaTab({ consultas }: { consultas: Consulta[] }) {
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };
  const [lightbox, setLightbox] = useState<string | null>(null);

  const visitasConFotos = [...consultas].reverse().filter((c) =>
    (c.fotoAnalisis && c.fotoAnalisis.length > 0) || c.fotoAntes || c.fotoDespues
  );

  // Comparativa primera vs última visita
  const primera = visitasConFotos.length >= 2 ? visitasConFotos[visitasConFotos.length - 1] : null;
  const ultima  = visitasConFotos.length >= 2 ? visitasConFotos[0] : null;
  const fotoP = primera?.fotoAntes || primera?.fotoDespues || primera?.fotoAnalisis?.[0];
  const fotoU = ultima?.fotoDespues || ultima?.fotoAntes || ultima?.fotoAnalisis?.[0];

  if (visitasConFotos.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-[#E5E5E5]">
        <ImageIcon size={32} className="text-[#CCCCCC] mx-auto mb-3" />
        <p className="text-sm text-[#999999]">Aún no hay fotos</p>
        <p className="text-xs text-[#AAAAAA] mt-1">Las fotos del diagnóstico IA y antes/después aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Comparativa evolución ── */}
      {fotoP && fotoU && (
        <div
          className="rounded-2xl p-4 border border-[#E5E5E5] overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)' }}
        >
          <p className="text-xs font-bold text-[#A8D0A3] uppercase tracking-wide mb-3" style={serif}>
            ✨ Evolución — Primera vs Última visita
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { foto: fotoP, label: 'Primera visita', sub: formatDate(primera!.fecha) },
              { foto: fotoU, label: 'Última visita',  sub: formatDate(ultima!.fecha)  },
            ].map(({ foto, label, sub }) => (
              <button key={label} type="button" onClick={() => setLightbox(foto)} className="relative active:scale-95 transition-transform">
                <img
                  src={foto}
                  alt={label}
                  className="w-full aspect-square object-cover rounded-xl border-2 border-white/20"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-xl py-1.5 px-2">
                  <p className="text-[10px] text-white font-bold">{label}</p>
                  <p className="text-[9px] text-white/70">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {visitasConFotos.map((c) => {
        const fotos: { url: string; label: string }[] = [];
        if (c.fotoAntes) fotos.push({ url: c.fotoAntes, label: 'Antes' });
        if (c.fotoDespues) fotos.push({ url: c.fotoDespues, label: 'Después' });
        (c.fotoAnalisis || []).forEach((url, i) =>
          fotos.push({ url, label: `Foto ${i + 1}` })
        );

        return (
          <div key={c.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-bold text-[#2D2D2D]" style={serif}>
                Visita #{c.numeroConsulta}
              </p>
              <span className="text-[10px] text-[#999999]">{formatDate(c.fecha)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map(({ url, label }, i) => (
                <button key={i} type="button" onClick={() => setLightbox(url)} className="relative group">
                  <img
                    src={url}
                    alt={label}
                    className="w-full aspect-square object-cover rounded-xl border border-[#E5E5E5]"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-xl py-0.5">
                    <p className="text-[9px] text-white text-center font-semibold">{label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt="Foto completa"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

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
      setClienta(c || null);
      setConsultas(cs);
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
      setTimeout(() => {
        setEditing(false);
        setSaveOk(false);
      }, 1200);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteClienta(id);
    router.push('/clientas');
  };

  const handleWhatsApp = () => {
    if (!clienta?.telefono) return;
    const tel = clienta.telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  const rizoVariant = clienta?.tipoRizoPrincipal
    ? ['2A', '2B', '2C'].includes(clienta.tipoRizoPrincipal) ? 'blue'
    : ['3A', '3B', '3C'].includes(clienta.tipoRizoPrincipal) ? 'purple'
    : 'gold'
    : 'gray';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0E8]">
        <Header showBack title="Cargando..." />
        <main className="max-w-2xl mx-auto px-4 py-5">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-20 loading-pulse border border-[#E5E5E5]" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!clienta) {
    return (
      <div className="min-h-screen bg-[#F5F0E8]">
        <Header showBack title="Clienta no encontrada" />
        <main className="max-w-2xl mx-auto px-4 py-5 text-center">
          <p className="text-[#666666]">Esta clienta no existe.</p>
          <Link href="/clientas" className="text-[#2D5A27] text-sm font-semibold underline mt-2 block">
            Volver a clientas
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header
        showBack
        title={editing ? 'Editar clienta' : clienta.nombre}
        rightAction={
          editing ? (
            <button
              onClick={cancelEditing}
              className="p-2 rounded-xl hover:bg-[#EEF5ED] text-[#666666]"
            >
              <X size={18} />
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={startEditing}
                className="p-2 rounded-xl hover:bg-[#EEF5ED] text-[#2D5A27]"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="p-2 rounded-xl hover:bg-red-50 text-[#CCCCCC] hover:text-[#8E2D2D]"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )
        }
      />

      <main className="max-w-2xl mx-auto pb-safe">
        {/* Profile header */}
        <div className="bg-gradient-to-br from-[#2D5A27] to-[#3D7A35] px-4 pt-5 pb-8">
          <div className="flex items-start gap-4">
            <Avatar nombre={clienta.nombre} tipoRizo={clienta.tipoRizoPrincipal} size="xl" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white mb-1 leading-tight" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                {clienta.nombre}
              </h1>
              {clienta.tipoRizoPrincipal && (
                <Badge variant={rizoVariant as 'blue' | 'purple' | 'gold'} className="mb-2">
                  {getRizoLabel(clienta.tipoRizoPrincipal)}
                </Badge>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {clienta.edad > 0 && (
                  <span className="text-xs text-[#A8C8A3]">{clienta.edad} años</span>
                )}
                <span className="text-xs text-[#A8C8A3]">
                  {clienta.totalVisitas} {clienta.totalVisitas === 1 ? 'visita' : 'visitas'}
                </span>
                {clienta.ultimaVisita && (
                  <span className="text-xs text-[#A8C8A3]">
                    Última: {formatDate(clienta.ultimaVisita)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact buttons */}
          {!editing && (
            <div className="flex gap-2 mt-4">
              {clienta.telefono && (
                <>
                  <a
                    href={`tel:${clienta.telefono}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/20 rounded-xl text-white text-xs font-semibold hover:bg-white/30"
                    style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    <Phone size={14} />
                    Llamar
                  </a>
                  <button
                    onClick={handleWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500 rounded-xl text-white text-xs font-semibold hover:bg-green-600"
                    style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                </>
              )}
              <div className="ml-auto flex gap-2">
                {consultas.length > 0 && (
                  <Link
                    href={`/diagnostico?clientaId=${clienta.id}&repeatFrom=${consultas.at(-1)?.id}`}
                    className="flex items-center gap-1 px-2.5 py-2 bg-white/20 rounded-xl text-white text-xs font-semibold hover:bg-white/30"
                    style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                  >
                    <RotateCcw size={13} />
                    Repetir
                  </Link>
                )}
                <Link
                  href={`/diagnostico?clientaId=${clienta.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#C9956B] rounded-xl text-white text-xs font-semibold hover:bg-[#D4A882]"
                  style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                >
                  <Plus size={14} />
                  Nueva consulta
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 bg-white border-b border-[#E5E5E5] -mt-4 mx-4 rounded-2xl shadow-md overflow-hidden">
          {[
            { icon: <Hash size={14} />, label: 'Consultas', value: clienta.totalVisitas },
            { icon: <Calendar size={14} />, label: 'Registro', value: formatDate(clienta.fechaRegistro) },
            { icon: <Calendar size={14} />, label: 'Última visita', value: clienta.ultimaVisita ? formatDate(clienta.ultimaVisita) : '—' },
          ].map(({ icon, label, value }, i) => (
            <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-[#E5E5E5]' : ''}`}>
              <div className="flex items-center justify-center text-[#C9956B] mb-1">{icon}</div>
              <p className="text-xs font-bold text-[#2D2D2D]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>{value}</p>
              <p className="text-[10px] text-[#999999]">{label}</p>
            </div>
          ))}
        </div>

        {/* ── MODO EDITAR ── */}
        {editing ? (
          <div className="px-4 pt-5 pb-8 flex flex-col gap-4 fade-in">
            <Input
              label="Nombre completo *"
              value={String(editData.nombre ?? '')}
              onChange={(e) => setEditData((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre de la clienta"
            />
            <div className="grid grid-cols-2 gap-3">
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
                placeholder="+58 412..."
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
              <p className="text-xs font-bold text-[#666666] mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                Nivel de estrés
              </p>
              <div className="flex gap-2">
                {(['bajo', 'medio', 'alto'] as const).map((nivel) => (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => setEditData((p) => ({ ...p, nivelEstres: nivel }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border-2 transition-all ${
                      editData.nivelEstres === nivel
                        ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                        : 'border-[#E5E5E5] text-[#666666]'
                    }`}
                  >
                    {nivel}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E5E5E5] pt-4 flex flex-col gap-4">
              <p className="text-xs font-bold text-[#999999] uppercase tracking-wide" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                Datos de salud
              </p>

              {/* Embarazo / Lactancia — Sí/No */}
              <div>
                <p className="text-xs font-semibold text-[#444] mb-2" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  ¿Embarazo o lactancia?
                </p>
                <div className="flex gap-2">
                  {([{ v: true, label: 'Sí' }, { v: false, label: 'No' }]).map(({ v, label }) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setEditData((p) => ({ ...p, embarazo: v }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                        (editData.embarazo ?? false) === v
                          ? 'border-[#2D5A27] bg-[#EEF5ED] text-[#2D5A27]'
                          : 'border-[#E5E5E5] text-[#666666]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Input
                  label="Alergias a productos capilares"
                  value={String(editData.alergias ?? '')}
                  onChange={(e) => setEditData((p) => ({ ...p, alergias: e.target.value }))}
                  placeholder="Opcional — ej: sulfatos, siliconas..."
                />
                <Input
                  label="Condiciones médicas relevantes"
                  value={String(editData.condicionesMedicas ?? '')}
                  onChange={(e) => setEditData((p) => ({ ...p, condicionesMedicas: e.target.value }))}
                  placeholder="tiroides, anemia, SOP, etc."
                />
                <Input
                  label="Medicamentos que afectan el cabello"
                  value={String(editData.medicamentos ?? '')}
                  onChange={(e) => setEditData((p) => ({ ...p, medicamentos: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={saveEditing}
              loading={saving}
              icon={saveOk ? <Check size={18} /> : undefined}
            >
              {saveOk ? '¡Guardado!' : 'Guardar cambios'}
            </Button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 px-4 mt-4 mb-1">
              {[
                { key: 'info', label: 'Información' },
                { key: 'historial', label: `Historial (${consultas.length})` },
                { key: 'galeria', label: 'Galería' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key as Tab)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    tab === key
                      ? 'bg-[#2D5A27] text-white shadow-sm'
                      : 'bg-white text-[#666666] border border-[#E5E5E5] hover:bg-[#EEF5ED]'
                  }`}
                  style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-4 pt-3 pb-6">
              {tab === 'info' && (
                <div className="flex flex-col gap-4">
                  {/* Notas de la última visita — destacado */}
                  {consultas.at(-1)?.notasEstilista && (
                    <div className="bg-[#EEF5ED] rounded-2xl border border-[#90B98A] p-4">
                      <h3 className="text-xs font-bold text-[#2D5A27] mb-2 uppercase tracking-wide" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                        Notas de la última visita
                      </h3>
                      <p className="text-sm text-[#2D2D2D] leading-relaxed">{consultas.at(-1)!.notasEstilista}</p>
                      <p className="text-[10px] text-[#7A9B76] mt-2">{formatDate(consultas.at(-1)!.fecha)}</p>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
                    <h3 className="text-xs font-bold text-[#999999] mb-3 uppercase tracking-wide" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                      Datos personales
                    </h3>
                    <div className="flex flex-col gap-2.5">
                      {[
                        { label: 'Teléfono', value: clienta.telefono || '—' },
                        { label: 'Email', value: clienta.email || '—' },
                        { label: 'Edad', value: clienta.edad ? `${clienta.edad} años` : '—' },
                        { label: 'Nivel de estrés', value: clienta.nivelEstres || '—' },
                        { label: 'Registro', value: formatDate(clienta.fechaRegistro) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center">
                          <span className="text-xs text-[#999999]" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>{label}</span>
                          <span className="text-sm font-medium text-[#2D2D2D]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(clienta.alergias || clienta.condicionesMedicas || clienta.medicamentos || clienta.embarazo) && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                      <h3 className="text-xs font-bold text-amber-700 mb-3 uppercase tracking-wide" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                        Salud capilar
                      </h3>
                      {clienta.alergias && (
                        <div className="mb-2">
                          <p className="text-xs text-[#999999] mb-0.5">Alergias:</p>
                          <p className="text-sm text-[#2D2D2D]">{clienta.alergias}</p>
                        </div>
                      )}
                      {clienta.condicionesMedicas && (
                        <div className="mb-2">
                          <p className="text-xs text-[#999999] mb-0.5">Condiciones médicas:</p>
                          <p className="text-sm text-[#2D2D2D]">{clienta.condicionesMedicas}</p>
                        </div>
                      )}
                      {clienta.medicamentos && (
                        <div>
                          <p className="text-xs text-[#999999] mb-0.5">Medicamentos:</p>
                          <p className="text-sm text-[#2D2D2D]">{clienta.medicamentos}</p>
                        </div>
                      )}
                      {clienta.embarazo && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          <p className="text-xs font-bold text-amber-700">Embarazo o lactancia</p>
                        </div>
                      )}
                    </div>
                  )}

                  {consultas.length === 0 && (
                    <div className="text-center py-6 bg-white rounded-2xl border border-[#E5E5E5]">
                      <p className="text-sm text-[#999999] mb-3">Sin consultas aún</p>
                      <Link href={`/diagnostico?clientaId=${clienta.id}`}>
                        <Button variant="primary" size="sm" icon={<Plus size={14} />}>
                          Primera consulta
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {tab === 'historial' && (
                <HistorialTimeline consultas={consultas} clienta={clienta} />
              )}

              {tab === 'galeria' && (
                <GaleriaTab consultas={consultas} />
              )}
            </div>
          </>
        )}
      </main>

      {/* Delete modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Eliminar clienta">
        <p className="text-sm text-[#666666] mb-4">
          ¿Estás segura de que quieres eliminar a <strong>{clienta.nombre}</strong>? Se eliminarán todas sus consultas. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" size="md" fullWidth onClick={() => setShowDelete(false)}>
            Cancelar
          </Button>
          <Button variant="danger" size="md" fullWidth onClick={handleDelete} loading={deleting} icon={<Trash2 size={16} />}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
