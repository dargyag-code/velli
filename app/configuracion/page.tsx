'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Download, Upload, Trash2,
  ChevronRight, Check, AlertCircle, LogOut,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import {
  getAllClientas,
  getAllConsultas,
  bulkUpsertClientas,
  bulkUpsertConsultas,
  clearAllData,
} from '@/lib/db';
import { getProfile, updateProfile, signOut } from '@/lib/profile';
import type { Profile } from '@/lib/profile';
import { showToast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[10px] font-bold text-[#999999] uppercase tracking-widest px-1 mb-2" style={serif}>
        {title}
      </h2>
      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ActionRow({
  icon, label, sublabel, onClick, danger = false, rightEl,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  danger?: boolean;
  rightEl?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#F5F5F5] last:border-b-0 hover:bg-[#F5F0E8] active:bg-[#F5F5F5] transition-colors text-left"
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-100' : 'bg-[#EEF5ED]'}`}>
        <span className={danger ? 'text-red-500' : 'text-[#2D5A27]'}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${danger ? 'text-red-600' : 'text-[#2D2D2D]'}`}>
          {label}
        </p>
        {sublabel && <p className="text-xs text-[#999999] truncate">{sublabel}</p>}
      </div>
      {rightEl ?? <ChevronRight size={14} className="text-[#CCCCCC] shrink-0" />}
    </button>
  );
}

export default function ConfiguracionPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nombre, setNombre] = useState('');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setProfile(p);
          setNombre(p.nombre);
          setNombreNegocio(p.nombreNegocio ?? '');
          setTelefono(p.telefono ?? '');
          setCiudad(p.ciudad ?? '');
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const p = await updateProfile({
        nombre: nombre.trim() || 'Estilista',
        nombreNegocio: nombreNegocio.trim(),
        telefono: telefono.trim(),
        ciudad: ciudad.trim(),
      });
      setProfile(p);
      setSaveOk(true);
      showToast('Perfil actualizado', 'success');
      setTimeout(() => {
        setSaveOk(false);
        setEditingProfile(false);
      }, 1200);
    } catch (e) {
      console.error('[profile.save]', e);
      showToast('No se pudo guardar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const [clientas, consultas] = await Promise.all([
        getAllClientas(),
        getAllConsultas(),
      ]);
      const data = {
        version: 2,
        exportadoEn: new Date().toISOString(),
        clientas,
        consultas,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `velli-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup descargado', 'success');
    } catch (e) {
      console.error('[backup.export]', e);
      showToast('No se pudo crear el backup', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.clientas || !data.consultas) {
          setImportMsg({ type: 'error', text: 'Archivo inválido: debe contener clientas y consultas.' });
          return;
        }

        await bulkUpsertClientas(data.clientas);
        await bulkUpsertConsultas(data.consultas);

        setImportMsg({
          type: 'ok',
          text: `Importadas ${data.clientas.length} clientas y ${data.consultas.length} consultas.`,
        });
        setTimeout(() => setImportMsg(null), 4000);
      } catch {
        setImportMsg({ type: 'error', text: 'Error al leer el archivo. Verifica que sea un backup válido.' });
        setTimeout(() => setImportMsg(null), 4000);
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    try {
      await clearAllData();
      setShowClearConfirm(false);
      setClearDone(true);
      showToast('Datos eliminados', 'success');
      setTimeout(() => setClearDone(false), 3000);
    } catch (e) {
      console.error('[data.clear]', e);
      setShowClearConfirm(false);
      showToast('No se pudieron eliminar los datos', 'error');
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/auth/login');
      router.refresh();
    } catch (e) {
      console.error('[auth.signOut]', e);
      setSigningOut(false);
      showToast(friendlyError(e), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header title="Configuración" />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-nav">

        {/* ── Perfil ── */}
        <Section title="Perfil">
          {profileLoading ? (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 rounded-xl skeleton-shimmer shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-32 skeleton-shimmer" />
                <div className="h-2.5 w-48 skeleton-shimmer" />
              </div>
            </div>
          ) : editingProfile ? (
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs text-[#666666] block mb-1" style={serif}>Nombre</label>
                <input
                  className="w-full border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="text-xs text-[#666666] block mb-1" style={serif}>Nombre del salón</label>
                <input
                  className="w-full border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
                  value={nombreNegocio}
                  onChange={(e) => setNombreNegocio(e.target.value)}
                  placeholder="Velli — Inteligencia capilar a tu alcance"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[#666666] block mb-1" style={serif}>Teléfono</label>
                  <input
                    className="w-full border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+57 ..."
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666666] block mb-1" style={serif}>Ciudad</label>
                  <input
                    className="w-full border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    placeholder="Bogotá"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingProfile(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#666666] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#2D5A27] text-sm text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={serif}
                >
                  {saveOk ? <><Check size={16} /> Guardado</> : saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <ActionRow
              icon={<User size={16} />}
              label={profile?.nombre || 'Tu nombre'}
              sublabel={profile?.nombreNegocio || 'Velli — Inteligencia capilar a tu alcance'}
              onClick={() => setEditingProfile(true)}
            />
          )}
        </Section>

        {/* ── Datos ── */}
        <Section title="Datos">
          <ActionRow
            icon={<Download size={16} />}
            label="Exportar backup"
            sublabel="Descarga todas las clientas y consultas como JSON"
            onClick={handleExport}
            rightEl={exportLoading ? (
              <div className="w-4 h-4 border-2 border-[#2D5A27] border-t-transparent rounded-full animate-spin" />
            ) : undefined}
          />
          <ActionRow
            icon={<Upload size={16} />}
            label="Importar backup"
            sublabel="Restaura un backup JSON anterior (no borra datos existentes)"
            onClick={handleImport}
          />
        </Section>

        {importMsg && (
          <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 border ${
            importMsg.type === 'ok'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {importMsg.type === 'ok'
              ? <Check size={14} className="mt-0.5 shrink-0" />
              : <AlertCircle size={14} className="mt-0.5 shrink-0" />
            }
            <p className="text-xs">{importMsg.text}</p>
          </div>
        )}

        {clearDone && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-green-50 border border-green-200">
            <Check size={14} className="text-green-700 shrink-0" />
            <p className="text-xs text-green-800">Todos los datos fueron eliminados.</p>
          </div>
        )}

        {/* ── Zona de peligro ── */}
        <Section title="Zona de peligro">
          {showClearConfirm ? (
            <div className="p-4">
              <p className="text-sm text-red-700 mb-3 font-semibold text-center">
                ¿Eliminar TODOS tus datos permanentemente?
              </p>
              <p className="text-xs text-[#666666] text-center mb-4">
                Se borrarán todas tus clientas y consultas. No se puede deshacer. Exporta un backup primero.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#666666] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm text-white font-bold"
                  style={serif}
                >
                  Sí, borrar todo
                </button>
              </div>
            </div>
          ) : (
            <ActionRow
              icon={<Trash2 size={16} />}
              label="Borrar todos los datos"
              sublabel="Elimina tus clientas y consultas de la nube"
              onClick={() => setShowClearConfirm(true)}
              danger
            />
          )}
        </Section>

        {/* ── Sesión ── */}
        <Section title="Sesión">
          {showSignOutConfirm ? (
            <div className="p-4">
              <p className="text-sm text-[#2D2D2D] mb-1 font-semibold text-center" style={serif}>
                ¿Cerrar sesión?
              </p>
              <p className="text-xs text-[#666666] text-center mb-4">
                Tendrás que iniciar sesión de nuevo para acceder a tus clientas.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  disabled={signingOut}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#666666] font-semibold disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={serif}
                >
                  {signingOut ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Sí, cerrar sesión'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <ActionRow
              icon={<LogOut size={16} />}
              label="Cerrar sesión"
              sublabel={profile ? `Sesión activa como ${profile.nombre}` : undefined}
              onClick={() => setShowSignOutConfirm(true)}
              danger
            />
          )}
        </Section>

        {/* ── Acerca de ── */}
        <Section title="Acerca de">
          <div className="px-4 py-6 flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: 'linear-gradient(135deg, #1A2E1A 0%, #2D5A27 100%)',
                boxShadow: '0 4px 16px rgba(45,90,39,0.28)',
              }}
            >
              <span className="text-white text-3xl leading-none" style={serif}>V</span>
            </div>
            <p className="text-base font-bold text-[#2D5A27]" style={serif}>
              Velli Pro <span className="text-[#999999] font-normal text-sm">v1.0</span>
            </p>
            <p className="text-xs text-[#C9956B] mt-0.5 mb-3" style={serif}>
              Inteligencia capilar a tu alcance
            </p>
            <p className="text-xs text-[#666666] leading-relaxed max-w-xs">
              Velli Pro es una herramienta profesional para estilistas que combina inteligencia
              artificial con conocimiento tricológico para ofrecer diagnósticos precisos y planes
              de tratamiento personalizados.
            </p>
            <div className="flex gap-4 mt-5 text-[11px] text-[#999999]">
              <Link href="/legal/terminos" className="hover:text-[#2D5A27] hover:underline">
                Términos de uso
              </Link>
              <span className="text-[#E5E5E5]">·</span>
              <Link href="/legal/privacidad" className="hover:text-[#2D5A27] hover:underline">
                Privacidad
              </Link>
              <span className="text-[#E5E5E5]">·</span>
              <a
                href="mailto:soporte@velli.app?subject=Soporte%20Velli%20Pro"
                className="hover:text-[#2D5A27] hover:underline"
              >
                Soporte
              </a>
            </div>
          </div>
        </Section>

      </main>

      <BottomNav />
    </div>
  );
}
