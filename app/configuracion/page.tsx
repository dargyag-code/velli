'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit3,
  Database,
  Download,
  Upload,
  Trash2,
  Heart,
  FileText,
  Shield,
  Phone,
  ChevronRight,
  Check,
  AlertCircle,
  LogOut,
  CreditCard,
  Palette,
  Calculator,
  ShoppingBag,
} from 'lucide-react';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
import VelvetImageUploader from '@/components/v2/VelvetImageUploader';
import {
  getAllClientas,
  getAllConsultas,
  bulkUpsertClientas,
  bulkUpsertConsultas,
  clearAllData,
} from '@/lib/db';
import { getProfile, updateProfile, signOut, COLOR_VELLI } from '@/lib/profile';
import type { Profile } from '@/lib/profile';
import { getSuscripcionEfectiva, type SuscripcionEfectiva } from '@/lib/subscription/estado';
import { PLANES } from '@/lib/subscription/plans';
import EditorMarca from '@/components/marca/EditorMarca';
import {
  actualizarLogoBrandSettings,
  obtenerBrandSettingsOrganizacion,
} from '@/lib/organizations';
import { createClient } from '@/lib/supabase/client';
import { obtenerOrganizacionActivaPanel, type OrganizacionPanelResumen } from '@/lib/vitrina';
import { uploadFoto } from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { getInitials } from '@/lib/utils';
import { enlaceSoporte } from '@/lib/sitio';
import { flagsActivos } from '@/lib/flags';

const MAILTO_SOPORTE = enlaceSoporte('Soporte Velli Pro');

export default function ConfiguracionPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nombre, setNombre] = useState('');
  const [nombreSalon, setNombreSalon] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const [permiteUbicacion, setPermiteUbicacion] = useState(false);
  const [savingGeo, setSavingGeo] = useState(false);

  const [editingMarca, setEditingMarca] = useState(false);
  const [marcaLogoPreview, setMarcaLogoPreview] = useState<string | null>(null);
  const [marcaLogoActual, setMarcaLogoActual] = useState<string | null>(null);
  const [savingMarca, setSavingMarca] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const [sub, setSub] = useState<SuscripcionEfectiva | null>(null);
  const [orgActiva, setOrgActiva] = useState<OrganizacionPanelResumen | null>(null);

  useEffect(() => {
    getSuscripcionEfectiva().then(setSub).catch(() => {});
    Promise.all([
      getProfile().catch(() => null),
      obtenerOrganizacionActivaPanel().catch(() => null),
    ])
      .then(async ([p, org]) => {
        setOrgActiva(org);
        let logoInicial = p?.logoUrl ?? null;

        if (org) {
          const brand = await obtenerBrandSettingsOrganizacion(createClient(), org.id, {
            organizationId: org.id,
            nombreSalon: p?.nombreSalon,
            logoUrl: p?.logoUrl,
            colorPrimario: p?.colorPrimario,
          }).catch(() => null);
          if (brand?.logoUrl) {
            logoInicial = brand.logoUrl;
          }
        }

        if (p) {
          setProfile({ ...p, logoUrl: logoInicial ?? p.logoUrl });
          setNombre(p.nombre);
          setNombreSalon(p.nombreSalon ?? '');
          setTelefono(p.telefono ?? '');
          setCiudad(p.ciudad ?? '');
          setPermiteUbicacion(!!p.permiteUbicacion);
          setMarcaLogoActual(logoInicial);
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  const toggleGeo = async () => {
    if (savingGeo) return;
    const next = !permiteUbicacion;
    setPermiteUbicacion(next);
    setSavingGeo(true);
    try {
      const updated = await updateProfile({ permiteUbicacion: next });
      setProfile(updated);
      showToast(next ? 'Ubicación activada' : 'Ubicación desactivada', 'success');
    } catch (e) {
      console.error('[profile.geo]', e);
      setPermiteUbicacion(!next);
      showToast('No se pudo guardar la preferencia', 'error');
    } finally {
      setSavingGeo(false);
    }
  };

  const guardarMarca = async () => {
    setSavingMarca(true);
    try {
      let logoUrl = marcaLogoActual ?? '';
      if (marcaLogoPreview) {
        logoUrl = await uploadFoto(marcaLogoPreview, 'branding/logo');
      }
      const updated = await updateProfile({ logoUrl, colorPrimario: COLOR_VELLI });
      if (orgActiva) {
        await actualizarLogoBrandSettings(createClient(), {
          organizationId: orgActiva.id,
          displayName: updated.nombreSalon || orgActiva.name || updated.nombre,
          logoUrl: logoUrl || null,
        });
      }
      setProfile({ ...updated, logoUrl: logoUrl || undefined });
      setMarcaLogoActual(logoUrl || null);
      setMarcaLogoPreview(null);
      setLogoError(false);
      setEditingMarca(false);
      showToast('Marca actualizada', 'success');
    } catch (e) {
      console.error('[marca.save]', e);
      showToast('No se pudo guardar tu marca', 'error');
    } finally {
      setSavingMarca(false);
    }
  };

  const cancelarMarca = () => {
    if (savingMarca) return;
    setMarcaLogoPreview(null);
    setMarcaLogoActual(profile?.logoUrl ?? null);
    setEditingMarca(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const p = await updateProfile({
        nombre: nombre.trim() || 'Estilista',
        nombreSalon: nombreSalon.trim(),
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
      a.download = `velli-respaldo-salon-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Respaldo de datos del salón descargado', 'success');
    } catch (e) {
      console.error('[backup.export]', e);
      showToast('No se pudo generar el respaldo de datos', 'error');
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
          setImportMsg({
            type: 'error',
            text: 'Archivo inválido: debe contener clientas y consultas.',
          });
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
        setImportMsg({
          type: 'error',
          text: 'Error al leer el archivo. Verifica que sea un respaldo válido del salón.',
        });
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
  const profileSub = profile?.nombreSalon || 'Velli Business Intelligence';
  const initials = profile?.nombre ? getInitials(profile.nombre) : '?';
  const headerSalon = profile?.nombreSalon?.trim() || profile?.nombre?.trim() || undefined;
  const headerCiudad = profile?.ciudad?.trim() || undefined;

  const esSpecialist = orgActiva?.role === 'specialist';

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans pb-16">
      <VelvetTopHeader
        nombreSalon={headerSalon}
        ciudadSalon={headerCiudad}
        rolOrganizacion={orgActiva?.role ?? null}
      />

      {/* Sub-header Velvet Studio */}
      <div className="border-b border-[#EFE8E4]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
          <div>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
              Ajustes · Administración del Salón
            </span>
            <h1 className="m-0 mt-0.5 font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#3B0D1E]">
              Tu cuenta
            </h1>
          </div>

          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-[#EFE8E4] hover:bg-[#F5EBE8] text-xs font-bold text-[#3B0D1E] no-underline transition-colors shrink-0 shadow-velvet"
          >
            <ArrowLeft size={14} />
            <span>Ir a Silla</span>
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-7">
        {/* Identity Card */}
        <section className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-velvet flex items-center gap-4">
          {profile?.logoUrl && !logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt="Logo del salón"
              onError={() => setLogoError(true)}
              className="w-12 h-12 rounded-2xl object-cover border border-[#EFE8E4] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-[#F5EBE8] border border-[#E8CFC8] text-[#3B0D1E] font-display text-xl font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="font-display text-lg font-semibold text-[#3B0D1E] leading-tight truncate">
              {profileName}
            </div>
            <div className="font-sans text-xs text-[#6B535C] mt-0.5 truncate">
              {profileSub}
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0FDFA] border border-[#0D9488]/25 text-[#0D9488] font-sans text-[11px] font-bold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
            Activa
          </span>
        </section>

        {/* 01 · Cuenta */}
        <SectionVelvet num="01" eyebrow="Cuenta">
          {profileLoading ? (
            <div className="p-4 flex items-center gap-3">
              <div className="skeleton-shimmer w-9 h-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3 w-2/5 rounded-md" />
                <div className="skeleton-shimmer h-2.5 w-3/5 rounded-md" />
              </div>
            </div>
          ) : editingProfile ? (
            <div className="p-5 space-y-3.5">
              <FieldVelvet
                label="Nombre"
                value={nombre}
                onChange={setNombre}
                placeholder="Tu nombre"
              />
              <FieldVelvet
                label="Nombre del salón"
                value={nombreSalon}
                onChange={setNombreSalon}
                placeholder="Ej. Atelier Camila Studio"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldVelvet
                  label="Teléfono"
                  value={telefono}
                  onChange={setTelefono}
                  placeholder="+57 ..."
                />
                <FieldVelvet
                  label="Ciudad"
                  value={ciudad}
                  onChange={setCiudad}
                  placeholder="Bogotá"
                />
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  disabled={saving}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FAF7F5] border border-[#E8CFC8] text-[#6B535C] hover:text-[#3B0D1E] font-sans text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 border-none"
                >
                  {saveOk ? (
                    <>
                      <Check size={14} /> Guardado
                    </>
                  ) : saving ? (
                    'Guardando…'
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <RowVelvet
              icon={<Edit3 size={16} />}
              title="Perfil profesional"
              sub="Salón, especialidades, contacto"
              onClick={() => setEditingProfile(true)}
            />
          )}

          {!esSpecialist &&
            (editingMarca ? (
              <div className="p-5">
                {orgActiva ? (
                  <VelvetImageUploader
                    organizationId={orgActiva.id}
                    folder="brand"
                    shape="square"
                    label="Logotipo oficial del salón"
                    helperText="JPG, PNG o WebP · máx. 3 MB · visible en tu vitrina pública"
                    value={marcaLogoActual}
                    onChange={(nextUrl) => {
                      setMarcaLogoPreview(null);
                      setMarcaLogoActual(nextUrl);
                      setLogoError(false);
                    }}
                    disabled={savingMarca}
                  />
                ) : (
                  <EditorMarca
                    logoSrc={marcaLogoPreview ?? marcaLogoActual}
                    onLogo={(dataUrl) => {
                      if (dataUrl) {
                        setMarcaLogoPreview(dataUrl);
                      } else {
                        setMarcaLogoPreview(null);
                        setMarcaLogoActual(null);
                      }
                    }}
                    nombreSalon={profile?.nombreSalon}
                  />
                )}
                <div className="flex items-center gap-2.5 mt-4">
                  <button
                    type="button"
                    onClick={cancelarMarca}
                    disabled={savingMarca}
                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FAF7F5] border border-[#E8CFC8] text-[#6B535C] hover:text-[#3B0D1E] font-sans text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardarMarca}
                    disabled={savingMarca}
                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 border-none"
                  >
                    {savingMarca ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <RowVelvet
                icon={<Palette size={16} />}
                title="Tu marca"
                sub="Logotipo oficial de tu salón"
                onClick={() => setEditingMarca(true)}
                rightEl={
                  <span className="inline-flex items-center gap-2 shrink-0">
                    {marcaLogoActual && !logoError && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={marcaLogoActual}
                        alt=""
                        aria-hidden
                        onError={() => setLogoError(true)}
                        className="w-7 h-7 rounded-lg object-cover border border-[#EFE8E4]"
                      />
                    )}
                    <ChevronRight size={15} className="text-[#947C85]" />
                  </span>
                }
              />
            ))}

          {!esSpecialist && (flagsActivos(profile?.featureFlags).cotizador || true) && (
            <RowVelvet
              icon={<Calculator size={16} />}
              title="Menú de servicios, química y comisiones"
              sub="Tarifas por servicio, costos de química ($/g y $/ml) y liquidación"
              onClick={() => router.push('/configuracion/precios')}
            />
          )}

          {!esSpecialist && (
            <RowVelvet
              icon={<ShoppingBag size={16} />}
              title="Vitrina pública y pedidos web"
              sub="Catálogo de tienda, enlace /s/slug y seguimiento de pedidos por WhatsApp"
              onClick={() => router.push('/vitrina')}
            />
          )}

          {!esSpecialist && (
            <RowVelvet
              icon={<CreditCard size={16} />}
              title="Tu plan"
              sub={descripcionSuscripcion(sub)}
              onClick={() => router.push('/planes')}
              rightEl={
                <span className="shrink-0 px-3 py-1.5 rounded-full bg-[#F5EBE8] border border-[#E8CFC8] text-[#3B0D1E] font-sans font-bold text-[11px] whitespace-nowrap">
                  Cambiar de plan
                </span>
              }
            />
          )}
        </SectionVelvet>

        {/* 02 · Respaldo y datos del salón (exclusivo owner / manager) */}
        {!esSpecialist && (
          <SectionVelvet num="02" eyebrow="Respaldo y datos del salón">
            <RowVelvet
              icon={<Download size={16} />}
              title="Descargar respaldo de datos del salón"
              sub="Guarda una copia segura de las clientas e historial de tu salón"
              onClick={handleExport}
              rightEl={
                exportLoading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-[#3B0D1E] border-t-transparent animate-spin inline-block shrink-0" />
                ) : undefined
              }
            />
            <RowVelvet
              icon={<Upload size={16} />}
              title="Restaurar respaldo de datos del salón"
              sub="Recupera una copia previa sin borrar los registros actuales"
              onClick={handleImport}
            />
            <RowVelvet
              icon={<Trash2 size={16} />}
              title="Borrar todos los datos"
              sub="Elimina tus clientas y consultas"
              onClick={() => setShowClearConfirm(true)}
              danger
            />
          </SectionVelvet>
        )}

        {importMsg && (
          <div
            className={`flex items-start gap-2.5 p-4 rounded-2xl border text-xs leading-relaxed ${
              importMsg.type === 'ok'
                ? 'bg-[#F0FDFA] border-[#0D9488]/30 text-[#0D9488]'
                : 'bg-[#FFF7F5] border-[#D97757]/35 text-[#D97757]'
            }`}
          >
            {importMsg.type === 'ok' ? (
              <Check size={15} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
            )}
            <p className="m-0 font-medium">{importMsg.text}</p>
          </div>
        )}

        {/* 03 · Privacidad */}
        <SectionVelvet num="03" eyebrow="Privacidad">
          <ToggleRowVelvet
            icon={<Shield size={16} />}
            title="Permitir capturar ubicación aproximada en fotos"
            sub="Si lo activas, registramos la ubicación aproximada al tomar fotos. No se comparte con terceros, solo queda en tu base de datos."
            value={permiteUbicacion}
            onChange={toggleGeo}
            saving={savingGeo}
          />
          <RowVelvet
            icon={<Heart size={16} />}
            title="Política de privacidad"
            sub="Cómo cuidamos los datos de tus clientas"
            onClick={() => router.push('/legal/privacidad')}
          />
          <RowVelvet
            icon={<Shield size={16} />}
            title="Tratamiento de datos"
            sub="Consentimientos, retención, derechos ARCO"
            onClick={() => router.push('/legal/privacidad')}
          />
          <RowVelvet
            icon={<FileText size={16} />}
            title="Términos y condiciones"
            sub="Uso de la plataforma Velli Business Intelligence"
            onClick={() => router.push('/legal/terminos')}
          />
          <RowVelvet
            icon={<FileText size={16} />}
            title="Consentimiento · servicios químicos"
            sub="Lo firma cada clienta en su ficha antes de decolorar"
            onClick={() => router.push('/legal/consentimiento-quimico')}
          />
          <RowVelvet
            icon={<FileText size={16} />}
            title="Consentimiento · imágenes"
            sub="Requisito para activar la cámara en alopecia y químicos"
            onClick={() => router.push('/legal/consentimiento-imagenes')}
          />
        </SectionVelvet>

        {/* 04 · Soporte */}
        <SectionVelvet num="04" eyebrow="Soporte">
          {MAILTO_SOPORTE && (
            <RowVelvet
              icon={<Phone size={16} />}
              title="Centro de ayuda"
              sub="Tutoriales y contacto"
              onClick={() => {
                window.location.href = MAILTO_SOPORTE;
              }}
            />
          )}
          <RowVelvet
            icon={<Database size={16} />}
            title="Versión de la app"
            sub="v1.0 · al día"
          />
        </SectionVelvet>

        {/* Acerca de Velli */}
        <section className="bg-white rounded-3xl border border-[#EFE8E4] p-6 text-center shadow-velvet">
          <div className="w-14 h-14 rounded-2xl bg-[#3B0D1E] mx-auto mb-3 flex items-center justify-center">
            <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M19.2 33.5C13.2 29.8 7.5 21.8 9.2 13.8C10.5 7.8 16.5 7.2 19.2 14.5C20.2 17.2 20.2 27.5 19.2 33.5Z"
                fill="#FAF7F5"
              />
              <path
                d="M20.8 33.5C26.8 29.8 32.5 21.8 30.8 13.8C29.5 7.8 23.5 7.2 20.8 14.5C19.8 17.2 19.8 27.5 20.8 33.5Z"
                fill="#E8CFC8"
                fillOpacity="0.88"
              />
              <circle cx="20" cy="6.5" r="2.5" fill="#D97757" />
            </svg>
          </div>
          <div className="text-lg font-bold text-[#3B0D1E] font-display tracking-tight">
            velli{' '}
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] ml-1">
              Business Intelligence
            </span>
          </div>
          <p className="text-xs text-[#6B535C] mt-2 max-w-xs mx-auto leading-relaxed">
            Cotización capilar sin báscula, cierre financiero en un toque y rentabilidad real por servicio.
          </p>
        </section>

        {/* Cerrar sesión */}
        <section className="pt-1 pb-4">
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-[#FFF7F5] hover:bg-[#F5EBE8] border border-[#D97757]/35 text-[#D97757] font-sans font-bold text-sm inline-flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer"
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
          <div className="font-mono text-center mt-2.5 text-[11px] text-[#947C85] tabular-nums">
            · {profile ? `sesión activa como ${profile.nombre}` : 'sesión activa'} ·
          </div>
        </section>
      </main>

      {showSignOutConfirm && (
        <ConfirmSheet
          icon={<LogOut size={22} />}
          eyebrow="Confirmación"
          title="¿Cerrar sesión?"
          description="Volverás a la pantalla de inicio de sesión. Los diagnósticos sin guardar se perderán."
          confirmLabel="Sí, cerrar sesión"
          loading={signingOut}
          onCancel={() => !signingOut && setShowSignOutConfirm(false)}
          onConfirm={handleSignOut}
        />
      )}

      {showClearConfirm && (
        <ConfirmSheet
          icon={<Trash2 size={22} />}
          eyebrow="Atención"
          title="¿Borrar todos los datos?"
          description="Se eliminarán todas tus clientas y consultas. No se puede deshacer. Descarga un respaldo de datos del salón antes si deseas conservarlas."
          confirmLabel="Sí, borrar todo"
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={handleClearAll}
        />
      )}
    </div>
  );
}

function descripcionSuscripcion(sub: SuscripcionEfectiva | null): string {
  if (!sub) return 'Suscripción, renovación y pagos';

  const nombre = sub.plan ? PLANES[sub.plan].nombre : null;
  const dias =
    sub.diasRestantes === null
      ? null
      : sub.diasRestantes === 0
        ? 'vence hoy'
        : sub.diasRestantes === 1
          ? '1 día restante'
          : `${sub.diasRestantes} días restantes`;

  switch (sub.estado) {
    case 'trialing':
      return `Prueba gratuita${dias ? ` · ${dias}` : ''}`;
    case 'active':
      return `Plan ${nombre ?? '—'}${dias ? ` · ${dias}` : ' · activo'}`;
    case 'past_due':
      return `Plan ${nombre ?? '—'} · en días de gracia${dias ? ` (${dias})` : ''}`;
    case 'canceled':
      return `Plan ${nombre ?? '—'} · no se renueva${dias ? ` · ${dias}` : ''}`;
    case 'expired':
      return 'Plan vencido · renueva para seguir creando registros';
  }
}

function SectionVelvet({
  num,
  eyebrow,
  children,
}: {
  num: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2 px-1">
        <span className="font-mono text-[11px] font-semibold text-[#947C85] tabular-nums">
          {num} ·
        </span>
        <h2 className="m-0 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
          {eyebrow}
        </h2>
      </div>
      <div className="bg-white rounded-3xl border border-[#EFE8E4] shadow-velvet overflow-hidden divide-y divide-[#EFE8E4]">
        {children}
      </div>
    </section>
  );
}

function RowVelvet({
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
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`w-full bg-transparent border-none flex items-center gap-3.5 min-h-[56px] px-5 py-3.5 text-left font-sans transition-colors ${
        interactive ? 'hover:bg-[#FAF7F5] cursor-pointer' : 'cursor-default'
      } ${danger ? 'text-[#D97757]' : 'text-[#3B0D1E]'}`}
    >
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
          danger
            ? 'bg-[#FFF7F5] border-[#D97757]/25 text-[#D97757]'
            : 'bg-[#FAF7F5] border-[#EFE8E4] text-[#3B0D1E]'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-snug">{title}</span>
        {sub && (
          <span className="block text-xs text-[#6B535C] mt-0.5 font-normal leading-relaxed">
            {sub}
          </span>
        )}
      </span>
      {rightEl ??
        (interactive ? <ChevronRight size={15} className="text-[#947C85] shrink-0" /> : null)}
    </button>
  );
}

function ToggleRowVelvet({
  icon,
  title,
  sub,
  value,
  onChange,
  saving = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  value: boolean;
  onChange: () => void;
  saving?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={saving}
      role="switch"
      aria-checked={value}
      className={`w-full bg-transparent border-none flex items-start gap-3.5 min-h-[56px] px-5 py-4 text-left text-[#3B0D1E] font-sans hover:bg-[#FAF7F5] transition-colors ${
        saving ? 'opacity-70 cursor-wait' : 'cursor-pointer'
      }`}
    >
      <span className="w-9 h-9 rounded-xl bg-[#FAF7F5] border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-snug">{title}</span>
        {sub && (
          <span className="block text-xs text-[#6B535C] mt-1 font-normal leading-relaxed">
            {sub}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`w-10 h-6 rounded-full relative shrink-0 mt-0.5 transition-colors ${
          value ? 'bg-[#3B0D1E]' : 'bg-[#E8CFC8]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

function FieldVelvet({
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
    <label className="block">
      <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1.5">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E] font-sans placeholder-[#947C85]"
      />
    </label>
  );
}

function ConfirmSheet({
  icon,
  eyebrow,
  title,
  description,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={() => !loading && onCancel()}
      className="fixed inset-0 z-50 bg-[#1F050F]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-[#EFE8E4] p-6 sm:p-7 shadow-velvet pb-safe"
      >
        <div className="w-10 h-1 rounded-full bg-[#E8CFC8] mx-auto mb-5 sm:hidden" />

        <div className="w-14 h-14 rounded-2xl bg-[#FFF7F5] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center mx-auto mb-3.5">
          {icon}
        </div>

        <span className="block text-center font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
          {eyebrow}
        </span>

        <h3 className="m-0 mt-1 mb-2 text-center font-display text-2xl font-semibold tracking-tight text-[#3B0D1E]">
          {title}
        </h3>

        <p className="m-0 mb-6 text-center text-xs sm:text-sm text-[#6B535C] leading-relaxed max-w-xs mx-auto">
          {description}
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-[46px] py-3 px-4 rounded-2xl bg-white hover:bg-[#FAF7F5] border border-[#EFE8E4] text-[#3B0D1E] font-sans font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 min-h-[46px] py-3 px-4 rounded-2xl bg-[#D97757] hover:opacity-95 text-white font-sans font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-opacity cursor-pointer disabled:opacity-60 border-none"
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-white animate-spin inline-block" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
