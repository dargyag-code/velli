'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit3, Calendar, Database, Download, Upload, Trash2,
  Heart, FileText, Shield, Phone, ChevronRight, Check,
  AlertCircle, LogOut,
} from 'lucide-react';
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
import { getInitials } from '@/lib/utils';

// ─── Página de Configuración (Ajustes / Tu cuenta) ────────────────────────
// Layout editorial alineado a Mejoras.html → SettingsScreen:
// top bar serif + identity card + secciones numeradas + filas editoriales.

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
      showToast('Datos eliminados', 'success');
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

  const profileName = profile?.nombre || 'Tu nombre';
  const profileSub = profile?.nombreNegocio || 'Velli — Inteligencia capilar a tu alcance';
  const initials = profile?.nombre ? getInitials(profile.nombre) : '?';

  return (
    <div
      className="v-grain"
      style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', paddingBottom: 140 }}
    >
      {/* ── Top bar editorial ─────────────────────────────────────────── */}
      <div style={{ padding: '54px 22px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          aria-label="Volver"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-main)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="v-caps">Ajustes</span>
          <h1
            style={{
              margin: '2px 0 0',
              fontFamily: 'var(--font-serif)',
              fontSize: 26,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
            }}
          >
            Tu{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--secondary-deep)' }}>cuenta</span>
          </h1>
        </div>
      </div>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Identity card ─────────────────────────────────────────── */}
        <div style={{ padding: '8px 6px 18px' }}>
          <div
            className="v-card"
            style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#FBF4EC',
                color: '#8A5A2E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-serif)',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 16,
                  lineHeight: 1.1,
                  color: 'var(--text-main)',
                }}
              >
                {profileName}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-tertiary)',
                  marginTop: 3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {profileSub}
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: '#EEF5ED',
                color: 'var(--primary)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: 10.5,
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }}
              />
              activa
            </span>
          </div>
        </div>

        {/* ── 01 Cuenta ─────────────────────────────────────────────── */}
        <SectionEditorial num="01" eyebrow="Cuenta">
          {profileLoading ? (
            <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="skeleton-shimmer" style={{ width: 34, height: 34, borderRadius: 10 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton-shimmer" style={{ height: 12, width: '40%' }} />
                <div className="skeleton-shimmer" style={{ height: 10, width: '70%' }} />
              </div>
            </div>
          ) : editingProfile ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FieldEditorial label="Nombre" value={nombre} onChange={setNombre} placeholder="Tu nombre" />
              <FieldEditorial label="Nombre del salón" value={nombreNegocio} onChange={setNombreNegocio} placeholder="Velli — Inteligencia capilar a tu alcance" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldEditorial label="Teléfono" value={telefono} onChange={setTelefono} placeholder="+57 ..." />
                <FieldEditorial label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Bogotá" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: 999,
                    background: 'transparent',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: 999,
                    background: 'var(--primary)',
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {saveOk ? <><Check size={14} /> Guardado</> : saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <RowEditorial
              icon={<Edit3 size={16} />}
              title="Perfil profesional"
              sub="Salón, especialidades, contacto"
              onClick={() => setEditingProfile(true)}
            />
          )}
          <RowEditorial
            icon={<Calendar size={16} />}
            title="Horario y disponibilidad"
            sub="Bloques de agenda"
            onClick={() => router.push('/agenda')}
          />
        </SectionEditorial>

        {/* ── 02 Backup y datos ─────────────────────────────────────── */}
        <SectionEditorial num="02" eyebrow="Backup y datos">
          <RowEditorial
            icon={<Download size={16} />}
            title="Exportar backup"
            sub="Descarga clientas y consultas como JSON"
            onClick={handleExport}
            rightEl={exportLoading ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid var(--primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 700ms linear infinite',
                }}
              />
            ) : undefined}
          />
          <RowEditorial
            icon={<Upload size={16} />}
            title="Importar backup"
            sub="Restaura un JSON anterior (no borra existentes)"
            onClick={handleImport}
          />
          <RowEditorial
            icon={<Trash2 size={16} />}
            title="Borrar todos los datos"
            sub="Elimina tus clientas y consultas"
            onClick={() => setShowClearConfirm(true)}
            danger
          />
        </SectionEditorial>

        {importMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 12,
              margin: '0 6px 14px',
              background: importMsg.type === 'ok' ? '#EEF7EE' : '#FCEEEE',
              border: `1px solid ${importMsg.type === 'ok' ? '#C8DDC4' : 'rgba(178,58,58,0.18)'}`,
              color: importMsg.type === 'ok' ? '#2F6B30' : '#7A1F1F',
            }}
          >
            {importMsg.type === 'ok'
              ? <Check size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            }
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>{importMsg.text}</p>
          </div>
        )}

        {/* ── 03 Privacidad ─────────────────────────────────────────── */}
        <SectionEditorial num="03" eyebrow="Privacidad">
          <RowEditorial
            icon={<Heart size={16} />}
            title="Política de privacidad"
            sub="Cómo cuidamos los datos de tus clientas"
            onClick={() => router.push('/legal/privacidad')}
          />
          <RowEditorial
            icon={<Shield size={16} />}
            title="Tratamiento de datos"
            sub="Consentimientos, retención, derechos ARCO"
            onClick={() => router.push('/legal/privacidad')}
          />
          <RowEditorial
            icon={<FileText size={16} />}
            title="Términos y condiciones"
            sub="Uso de la plataforma Velli Pro"
            onClick={() => router.push('/legal/terminos')}
          />
        </SectionEditorial>

        {/* ── 04 Soporte ────────────────────────────────────────────── */}
        <SectionEditorial num="04" eyebrow="Soporte">
          <RowEditorial
            icon={<Phone size={16} />}
            title="Centro de ayuda"
            sub="Tutoriales y contacto"
            onClick={() => { window.location.href = 'mailto:soporte@velli.app?subject=Soporte%20Velli%20Pro'; }}
          />
          <RowEditorial
            icon={<Database size={16} />}
            title="Versión de la app"
            sub="v1.0 · al día"
          />
        </SectionEditorial>

        {/* ── Acerca de Velli (hero editorial) ──────────────────────── */}
        <div style={{ padding: '14px 6px 4px' }}>
          <div className="v-card" style={{ padding: '22px 18px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 13,
                background: 'linear-gradient(160deg, #2D5A27 0%, #14241A 100%)',
                margin: '0 auto 12px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 22px rgba(20,36,26,0.18)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 38,
                  color: '#E8C290',
                  lineHeight: 1,
                }}
              >
                V
              </span>
              <span
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 14,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#E8C290',
                }}
              />
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text-main)' }}>
              Velli <span style={{ fontStyle: 'italic', color: 'var(--secondary-deep)' }}>Pro</span>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                v1.0
              </span>
            </div>
            <p
              style={{
                margin: '8px auto 0',
                maxWidth: 320,
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Diagnóstico capilar profesional con IA y planes de tratamiento personalizados para todo tipo de cabello.
            </p>
          </div>
        </div>

        {/* ── Cerrar sesión ── prominente al final ─────────────────── */}
        <div style={{ padding: '12px 6px 22px' }}>
          <div
            style={{
              height: 1,
              background: 'linear-gradient(to right, var(--border-strong), transparent)',
              marginBottom: 18,
            }}
          />
          <button
            type="button"
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
        <ConfirmSheet
          tone="red"
          icon={<LogOut size={22} />}
          eyebrow="Confirmación,"
          title={<>¿Cerrar <span style={{ fontStyle: 'italic', color: '#B23A3A' }}>sesión</span>?</>}
          description="Volverás a la pantalla de inicio de sesión. Los diagnósticos sin guardar se perderán."
          confirmLabel="Sí, cerrar sesión"
          loading={signingOut}
          onCancel={() => !signingOut && setShowSignOutConfirm(false)}
          onConfirm={handleSignOut}
        />
      )}

      {showClearConfirm && (
        <ConfirmSheet
          tone="red"
          icon={<Trash2 size={22} />}
          eyebrow="Atención,"
          title={<>¿Borrar <span style={{ fontStyle: 'italic', color: '#B23A3A' }}>todo</span>?</>}
          description="Se eliminarán todas tus clientas y consultas. No se puede deshacer. Exporta un backup antes si quieres conservarlas."
          confirmLabel="Sí, borrar todo"
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={handleClearAll}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes velliFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes velliSlideUp { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <BottomNav />
    </div>
  );
}

// ─── Subcomponentes editoriales ───────────────────────────────────────────

function SectionEditorial({
  num,
  eyebrow,
  children,
}: {
  num: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '14px 6px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span className="v-num">· {num}</span>
        <span className="v-caps">{eyebrow}</span>
      </div>
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function RowEditorial({
  icon,
  title,
  sub,
  rightEl,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  rightEl?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        cursor: interactive ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-soft)',
        textAlign: 'left',
        color: danger ? '#B23A3A' : 'var(--text-main)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: danger ? '#FCEEEE' : 'var(--primary-pale)',
          color: danger ? '#B23A3A' : 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.15 }}>{title}</span>
        {sub && (
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              color: 'var(--text-tertiary)',
              marginTop: 2,
              fontWeight: 400,
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {rightEl ?? (interactive ? <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : null)}
    </button>
  );
}

function FieldEditorial({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          marginBottom: 4,
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 13,
          color: 'var(--text-main)',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />
    </label>
  );
}

// ─── Bottom-sheet de confirmación reutilizable ────────────────────────────
function ConfirmSheet({
  tone = 'red',
  icon,
  eyebrow,
  title,
  description,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: {
  tone?: 'red' | 'amber';
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tones = {
    red: {
      fg: '#B23A3A',
      bg: '#FCEEEE',
      bd: 'rgba(178,58,58,0.18)',
      shadow: 'rgba(178,58,58,0.32)',
      gradient: 'linear-gradient(180deg, #B23A3A, #7A1F1F)',
    },
    amber: {
      fg: '#B47900',
      bg: '#FFF6E0',
      bd: 'rgba(180,121,0,0.20)',
      shadow: 'rgba(180,121,0,0.32)',
      gradient: 'linear-gradient(180deg, #B47900, #5C3A00)',
    },
  } as const;
  const t = tones[tone];

  return (
    <div
      onClick={() => !loading && onCancel()}
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
        animation: 'velliFadeIn 180ms ease',
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
          animation: 'velliSlideUp 220ms cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <div
          style={{
            width: 42,
            height: 4,
            background: 'var(--border-strong)',
            borderRadius: 4,
            margin: '0 auto 16px',
          }}
        />
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: t.bg,
            border: `1px solid ${t.bd}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: t.fg,
          }}
        >
          {icon}
        </div>
        <div className="v-eyebrow" style={{ textAlign: 'center', display: 'block' }}>
          {eyebrow}
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
          {title}
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
          {description}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
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
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 999,
              background: t.gradient,
              border: 'none',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 13.5,
              letterSpacing: '0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: `0 6px 18px ${t.shadow}`,
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
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 700ms linear infinite',
                }}
              />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
