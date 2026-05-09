'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Download, Upload, Trash2,
  ChevronRight, Check, AlertCircle, LogOut, FileText, Shield,
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
    // Estructura inline replicando app/page.tsx (Home) — evita riesgo de
    // que Tailwind v4 no aplique clases custom como pb-nav o min-h-screen
    // y deje el contenido inferior tapado por la BottomNav fixed.
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <Header title="Configuración" />

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px 140px' }}>

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

        {/* ── Backup y datos ── */}
        <Section title="Backup y datos">
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
            <>
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
              <ActionRow
                icon={<Trash2 size={16} />}
                label="Borrar todos los datos"
                sublabel="Elimina tus clientas y consultas de la nube"
                onClick={() => setShowClearConfirm(true)}
                danger
              />
            </>
          )}
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

        {/* ── Acerca de Velli ── */}
        <Section title="Acerca de Velli">
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
            <a
              href="mailto:soporte@velli.app?subject=Soporte%20Velli%20Pro"
              className="text-[11px] text-[#999999] mt-5 hover:text-[#2D5A27] hover:underline"
            >
              soporte@velli.app
            </a>
          </div>
        </Section>

        {/* ── Legal ── */}
        <Section title="Legal">
          <ActionRow
            icon={<FileText size={16} />}
            label="Términos de uso"
            sublabel="Condiciones del servicio"
            onClick={() => router.push('/legal/terminos')}
          />
          <ActionRow
            icon={<Shield size={16} />}
            label="Política de privacidad"
            sublabel="Cómo tratamos tus datos y los de tus clientas"
            onClick={() => router.push('/legal/privacidad')}
          />
        </Section>

        {/* ── Cerrar sesión ── prominente, al final ── */}
        <div className="mt-2 mb-2">
          <div
            style={{
              height: 1,
              background: 'linear-gradient(to right, var(--border-strong), transparent)',
              marginBottom: 18,
            }}
          />
          <button
            onClick={() => setShowSignOutConfirm(true)}
            style={{
              width: '100%',
              background: '#FCEEEE',
              border: '1px solid rgba(178,58,58,0.18)',
              borderRadius: 16,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: '#B23A3A',
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              transition: 'transform 120ms ease',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#B23A3A',
                boxShadow: '0 0 0 4px rgba(178,58,58,0.32)',
              }}
            />
            Cerrar sesión
          </button>
          <div
            className="v-mono"
            style={{
              textAlign: 'center',
              marginTop: 10,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            · {profile ? `sesión activa como ${profile.nombre}` : 'sesión activa'} ·
          </div>
        </div>

      </main>

      {showSignOutConfirm && (
        <LogoutConfirmSheet
          loading={signingOut}
          onCancel={() => !signingOut && setShowSignOutConfirm(false)}
          onConfirm={handleSignOut}
        />
      )}

      <BottomNav />
    </div>
  );
}

// ─── Bottom-sheet "¿Cerrar sesión?" modal ─────────────────────────────────
function LogoutConfirmSheet({
  loading,
  onCancel,
  onConfirm,
}: {
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(20,15,10,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 180ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="v-grain"
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--bg-card)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: '22px 22px calc(28px + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 30px rgba(20,15,10,0.18)',
          animation: 'slideUp 220ms cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 42,
            height: 4,
            background: 'var(--border-strong)',
            borderRadius: 4,
            margin: '0 auto 16px',
          }}
        />
        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#FCEEEE',
            border: '1px solid rgba(178,58,58,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: '#B23A3A',
          }}
        >
          <LogOut size={22} />
        </div>
        <div className="v-eyebrow" style={{ textAlign: 'center', display: 'block' }}>
          Confirmación,
        </div>
        <h3
          style={{
            margin: '4px 0 6px',
            textAlign: 'center',
            fontFamily: 'var(--font-serif)',
            fontSize: 26,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--text-main)',
          }}
        >
          ¿Cerrar <span style={{ fontStyle: 'italic', color: '#B23A3A' }}>sesión</span>?
        </h3>
        <p
          style={{
            textAlign: 'center',
            margin: '0 auto 18px',
            maxWidth: 320,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          Volverás a la pantalla de inicio de sesión. Los diagnósticos sin
          guardar se perderán.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 999,
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 999,
              background: 'linear-gradient(180deg, #B23A3A, #7A1F1F)',
              border: 'none',
              color: '#FFFFFF',
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 13.5,
              letterSpacing: '0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 18px rgba(178,58,58,0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(255,255,255,0.6)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 700ms linear infinite',
                }}
              />
            ) : (
              'Sí, cerrar sesión'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
