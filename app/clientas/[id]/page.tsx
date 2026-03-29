'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, MessageCircle, Trash2, Plus, Calendar, Hash,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import HistorialTimeline from '@/components/clienta/HistorialTimeline';
import { getClientaById, getConsultasByClienta, deleteClienta } from '@/lib/db';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';

type Tab = 'info' | 'historial';

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
    ? ['2A', '2B', '2C'].includes(clienta.tipoRizoPrincipal)
      ? 'blue'
      : ['3A', '3B', '3C'].includes(clienta.tipoRizoPrincipal)
      ? 'purple'
      : 'gold'
    : 'gray';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
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
      <div className="min-h-screen bg-[#FAFAFA]">
        <Header showBack title="Clienta no encontrada" />
        <main className="max-w-2xl mx-auto px-4 py-5 text-center">
          <p className="text-[#666666]">Esta clienta no existe.</p>
          <Link href="/clientas" className="text-[#5B2D8E] text-sm font-semibold underline mt-2 block">
            Volver a clientas
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Header
        showBack
        title={clienta.nombre}
        rightAction={
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 rounded-xl hover:bg-red-50 transition-colors text-[#CCCCCC] hover:text-[#8E2D2D]"
          >
            <Trash2 size={18} />
          </button>
        }
      />

      <main className="max-w-2xl mx-auto pb-safe">
        {/* Profile header */}
        <div className="bg-gradient-to-br from-[#5B2D8E] to-[#7B4DB0] px-4 pt-5 pb-8">
          <div className="flex items-start gap-4">
            <Avatar nombre={clienta.nombre} tipoRizo={clienta.tipoRizoPrincipal} size="xl" />
            <div className="flex-1 min-w-0">
              <h1
                className="text-xl font-bold text-white mb-1 leading-tight"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {clienta.nombre}
              </h1>
              {clienta.tipoRizoPrincipal && (
                <Badge variant={rizoVariant as 'blue' | 'purple' | 'gold'} className="mb-2">
                  {getRizoLabel(clienta.tipoRizoPrincipal)}
                </Badge>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {clienta.edad > 0 && (
                  <span className="text-xs text-[#D0B8EE]">{clienta.edad} años</span>
                )}
                <span className="text-xs text-[#D0B8EE]">
                  {clienta.totalVisitas} {clienta.totalVisitas === 1 ? 'visita' : 'visitas'}
                </span>
                {clienta.ultimaVisita && (
                  <span className="text-xs text-[#D0B8EE]">
                    Última: {formatDate(clienta.ultimaVisita)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact buttons */}
          <div className="flex gap-2 mt-4">
            {clienta.telefono && (
              <>
                <a
                  href={`tel:${clienta.telefono}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/20 rounded-xl text-white text-xs font-semibold hover:bg-white/30 transition-colors"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <Phone size={14} />
                  Llamar
                </a>
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-500 rounded-xl text-white text-xs font-semibold hover:bg-green-600 transition-colors"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </button>
              </>
            )}
            <Link
              href={`/diagnostico?clientaId=${clienta.id}`}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-[#C9A84C] rounded-xl text-white text-xs font-semibold hover:bg-[#D4B56A] transition-colors"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Plus size={14} />
              Nueva consulta
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 bg-white border-b border-[#E5E5E5] -mt-4 mx-4 rounded-2xl shadow-md overflow-hidden">
          {[
            { icon: <Hash size={14} />, label: 'Consultas', value: clienta.totalVisitas },
            { icon: <Calendar size={14} />, label: 'Registro', value: formatDate(clienta.fechaRegistro) },
            { icon: <Calendar size={14} />, label: 'Última visita', value: clienta.ultimaVisita ? formatDate(clienta.ultimaVisita) : '—' },
          ].map(({ icon, label, value }, i) => (
            <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-[#E5E5E5]' : ''}`}>
              <div className="flex items-center justify-center text-[#C9A84C] mb-1">{icon}</div>
              <p className="text-xs font-bold text-[#2D2D2D]" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
              <p className="text-[10px] text-[#999999]">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 mt-4 mb-1">
          {[
            { key: 'info', label: 'Información' },
            { key: 'historial', label: `Historial (${consultas.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === key
                  ? 'bg-[#5B2D8E] text-white shadow-sm'
                  : 'bg-white text-[#666666] border border-[#E5E5E5] hover:bg-[#F3EDF9]'
              }`}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-6">
          {tab === 'info' && (
            <div className="flex flex-col gap-4">
              {/* Contact info */}
              <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
                <h3 className="text-xs font-bold text-[#999999] mb-3 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>
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
                      <span className="text-xs text-[#999999]" style={{ fontFamily: "'Montserrat', sans-serif" }}>{label}</span>
                      <span className="text-sm font-medium text-[#2D2D2D]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health */}
              {(clienta.alergias || clienta.condicionesMedicas || clienta.medicamentos) && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                  <h3 className="text-xs font-bold text-amber-700 mb-3 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    ⚠️ Salud capilar
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
                      <p className="text-xs font-bold text-amber-700">🤰 Embarazo o lactancia</p>
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
            <HistorialTimeline consultas={consultas} />
          )}
        </div>
      </main>

      <Footer />

      {/* Delete modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Eliminar clienta">
        <p className="text-sm text-[#666666] mb-4">
          ¿Estás segura de que quieres eliminar a <strong>{clienta.nombre}</strong>? Se eliminarán todas sus consultas. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => setShowDelete(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            fullWidth
            onClick={handleDelete}
            loading={deleting}
            icon={<Trash2 size={16} />}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
