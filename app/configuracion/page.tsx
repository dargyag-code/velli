'use client';
import React, { useState, useEffect } from 'react';
import {
  Settings, User, Download, Upload, Trash2,
  ChevronRight, Check, AlertCircle, Info,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import { db } from '@/lib/db';

const STYLIST_KEY = 'velli_stylist_name';
const BUSINESS_KEY = 'velli_business_name';

// ── Sección genérica ───────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2
        className="text-[10px] font-bold text-[#999999] uppercase tracking-widest px-1 mb-2"
        style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
      >
        {title}
      </h2>
      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── Fila de acción ─────────────────────────────────────────────────────────
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
  const [stylistName, setStylistName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  useEffect(() => {
    setStylistName(localStorage.getItem(STYLIST_KEY) ?? '');
    setBusinessName(localStorage.getItem(BUSINESS_KEY) ?? '');
  }, []);

  const saveProfile = () => {
    localStorage.setItem(STYLIST_KEY, stylistName.trim());
    localStorage.setItem(BUSINESS_KEY, businessName.trim());
    setSaveOk(true);
    setTimeout(() => { setSaveOk(false); setEditingProfile(false); }, 1200);
  };

  // ── Exportar datos ──────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const [clientas, consultas] = await Promise.all([
        db.clientas.toArray(),
        db.consultas.toArray(),
      ]);
      const data = {
        version: 1,
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
    } catch {
      // silently fail
    } finally {
      setExportLoading(false);
    }
  };

  // ── Importar datos ──────────────────────────────────────────────────────
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

        // Upsert para no duplicar
        await db.transaction('rw', db.clientas, db.consultas, async () => {
          for (const c of data.clientas) await db.clientas.put(c);
          for (const c of data.consultas) await db.consultas.put(c);
        });

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

  // ── Borrar todos los datos ──────────────────────────────────────────────
  const handleClearAll = async () => {
    await db.transaction('rw', db.clientas, db.consultas, async () => {
      await db.clientas.clear();
      await db.consultas.clear();
    });
    setShowClearConfirm(false);
    setClearDone(true);
    setTimeout(() => setClearDone(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <Header title="Configuración" />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-nav">

        {/* ── Perfil de la estilista ── */}
        <Section title="Perfil">
          {editingProfile ? (
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs text-[#666666] block mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  Nombre de la estilista
                </label>
                <input
                  className="w-full border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
                  value={stylistName}
                  onChange={(e) => setStylistName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="text-xs text-[#666666] block mb-1" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
                  Nombre del negocio
                </label>
                <input
                  className="w-full border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#2D5A27] outline-none"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Velli — Inteligencia capilar a tu alcance"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingProfile(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#E5E5E5] text-sm text-[#666666] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProfile}
                  className="flex-1 py-2.5 rounded-xl bg-[#2D5A27] text-sm text-white font-bold flex items-center justify-center gap-2"
                  style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                >
                  {saveOk ? <><Check size={16} /> Guardado</> : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <ActionRow
              icon={<User size={16} />}
              label={stylistName || 'Tu nombre'}
              sublabel={businessName || 'Velli — Inteligencia capilar a tu alcance'}
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

        {/* Mensaje de importación */}
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

        {/* ── IA ── */}
        <Section title="Inteligencia Artificial">
          <div className="px-4 py-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#EEF5ED] flex items-center justify-center shrink-0">
              <Info size={16} className="text-[#2D5A27]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2D2D2D] mb-0.5">API de OpenAI (GPT-4o)</p>
              <p className="text-xs text-[#666666] leading-relaxed">
                El análisis de cámara IA usa GPT-4o. Para activarlo, agrega tu clave en el archivo{' '}
                <code className="bg-[#EEF5ED] text-[#2D5A27] px-1 py-0.5 rounded text-[10px]">.env.local</code>{' '}
                con el valor{' '}
                <code className="bg-[#EEF5ED] text-[#2D5A27] px-1 py-0.5 rounded text-[10px]">OPENAI_API_KEY=sk-...</code>{' '}
                — Consíguelo en{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] underline">platform.openai.com/api-keys</a>
              </p>
            </div>
          </div>
        </Section>

        {/* ── Zona de peligro ── */}
        <Section title="Zona de peligro">
          {showClearConfirm ? (
            <div className="p-4">
              <p className="text-sm text-red-700 mb-3 font-semibold text-center">
                ¿Eliminar TODOS los datos permanentemente?
              </p>
              <p className="text-xs text-[#666666] text-center mb-4">
                Se borrarán todas las clientas y consultas. No se puede deshacer. Exporta un backup primero.
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
                  style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
                >
                  Sí, borrar todo
                </button>
              </div>
            </div>
          ) : (
            <ActionRow
              icon={<Trash2 size={16} />}
              label="Borrar todos los datos"
              sublabel="Elimina clientas y consultas de este dispositivo"
              onClick={() => setShowClearConfirm(true)}
              danger
            />
          )}
        </Section>

        {/* ── Acerca de ── */}
        <Section title="Acerca de">
          <div className="px-4 py-4 text-center">
            <p className="text-sm font-bold text-[#2D5A27] mb-0.5" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
              Velli — Inteligencia capilar a tu alcance
            </p>
            <p className="text-xs text-[#999999]">Velli Pro · Versión 1.0</p>
            <p className="text-xs text-[#CCCCCC] mt-2">
              Diagnóstico capilar profesional para todo tipo de cabello
            </p>
          </div>
        </Section>

      </main>

      <BottomNav />
    </div>
  );
}
