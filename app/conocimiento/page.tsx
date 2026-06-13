'use client';
// ══════════════════════════════════════════════════════════════════════════
// Panel de conocimiento — SOLO cuentas fundadoras.
//
// CRUD de reglas de diagnóstico, flujos de wizard y prompts de IA, con
// vista previa ("si el perfil es X, la recomendación sería Y"), publicación
// controlada (borrador → publicada) y auditoría de quién cambió qué.
// La RLS de kb_* es la barrera real (escritura solo fundadoras); esta UI
// además se oculta para cuentas normales.
// ══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Plus, AlertTriangle, Eye, History, Sparkles, GitBranch,
  MessageSquareText, ShieldCheck,
} from 'lucide-react';
import { InnerHeader, Btn } from '@/components/v2';
import Modal from '@/components/ui/Modal';
import { getProfile } from '@/lib/profile';
import { showToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { WizardData, WIZARD_INITIAL_DATA, ResultadoConsulta } from '@/lib/types';
import { evaluarDiagnostico } from '@/lib/kb/evaluador';
import { rowToRegla } from '@/lib/kb/diagnostico';
import {
  ReglaKBRow, FlujoKBRow, PromptKBRow, EstadoKB, SegmentoRegla,
  Condicion, SalidaRegla, DefinicionFlujo,
} from '@/lib/kb/tipos';
import {
  listarReglas, guardarRegla, eliminarRegla,
  listarFlujos, guardarFlujo, eliminarFlujo,
  listarPrompts, guardarPrompt, eliminarPrompt,
  listarAuditoria, AuditoriaRow, ReglaEditable, FlujoEditable, PromptEditable,
} from '@/lib/kb/admin';

type Tab = 'reglas' | 'flujos' | 'prompts' | 'preview' | 'auditoria';

const SEGMENTOS: SegmentoRegla[] = [
  'hecho', 'derivacion_medica', 'tratamiento_principal', 'tratamiento_adicional',
  'cronograma', 'tecnica', 'producto_resumen', 'ingrediente_buscar',
  'ingrediente_evitar', 'rutina', 'nota', 'cuidado_casa', 'intervalo', 'config',
];

const ESTADOS: EstadoKB[] = ['borrador', 'publicada', 'archivada'];

// ── Átomos locales ──────────────────────────────────────────────────────────

function ChipEstado({ estado }: { estado: EstadoKB }) {
  const colores: Record<EstadoKB, { bg: string; fg: string }> = {
    publicada: { bg: 'var(--primary-pale)', fg: 'var(--primary)' },
    borrador: { bg: 'var(--treat-recon-bg)', fg: 'var(--treat-recon-color)' },
    archivada: { bg: '#EFEDE8', fg: 'var(--text-tertiary)' },
  };
  const c = colores[estado];
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        background: c.bg,
        color: c.fg,
        flexShrink: 0,
      }}
    >
      {estado}
    </span>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="v-caps">{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  outline: 'none',
  fontSize: 13,
  background: 'var(--bg-card)',
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-main)',
  width: '100%',
};

const monoArea: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  lineHeight: 1.5,
  resize: 'vertical',
};

function SelectSimple({
  value, options, onChange,
}: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((o) => (
        <option key={o} value={o}>{o || '—'}</option>
      ))}
    </select>
  );
}

function ChipsMulti({
  options, selected, onChange,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])
            }
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
              color: on ? 'var(--primary)' : 'var(--text-secondary)',
              border: `1px solid ${on ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
              cursor: 'pointer',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// JSON editable con validación inline.
function JsonArea({
  value, onChange, rows = 6, permitirNull,
}: {
  value: string;
  onChange: (texto: string, valido: boolean) => void;
  rows?: number;
  permitirNull?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <textarea
        value={value}
        rows={rows}
        spellCheck={false}
        onChange={(e) => {
          const t = e.target.value;
          let ok = false;
          try {
            if (permitirNull && t.trim() === '') {
              ok = true;
            } else {
              JSON.parse(t);
              ok = true;
            }
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'JSON inválido');
          }
          onChange(t, ok);
        }}
        style={monoArea}
      />
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function ConocimientoPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [esFundadora, setEsFundadora] = useState(false);
  const [tab, setTab] = useState<Tab>('reglas');

  const [reglas, setReglas] = useState<ReglaKBRow[]>([]);
  const [flujos, setFlujos] = useState<FlujoKBRow[]>([]);
  const [prompts, setPrompts] = useState<PromptKBRow[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([]);
  const [kbDisponible, setKbDisponible] = useState(true);

  const recargar = useCallback(async () => {
    try {
      const [r, f, p] = await Promise.all([listarReglas(), listarFlujos(), listarPrompts()]);
      setReglas(r);
      setFlujos(f);
      setPrompts(p);
      setKbDisponible(true);
    } catch (e) {
      // Tablas inexistentes → la migración knowledge-base no corrió aún.
      console.error('[conocimiento] carga falló', e);
      setKbDisponible(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const perfil = await getProfile();
        const ok = !!perfil?.esFundadora;
        setEsFundadora(ok);
        if (ok) await recargar();
      } finally {
        setCargando(false);
      }
    })();
  }, [recargar]);

  useEffect(() => {
    if (tab === 'auditoria' && esFundadora) {
      listarAuditoria().then(setAuditoria).catch(() => {});
    }
  }, [tab, esFundadora]);

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <InnerHeader title="Panel de conocimiento" eyebrow="Knowledge base" backHref="/configuracion" />
        <p style={{ textAlign: 'center', padding: 40 }} className="v-caps">Cargando…</p>
      </div>
    );
  }

  if (!esFundadora) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <InnerHeader title="Panel de conocimiento" eyebrow="Knowledge base" backHref="/configuracion" />
        <div style={{ maxWidth: 480, margin: '40px auto', padding: 16, textAlign: 'center' }}>
          <ShieldCheck size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: '0 0 6px' }}>
            Solo cuentas fundadoras
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
            Esta sección administra las reglas de diagnóstico de Velli y está
            restringida a cuentas fundadoras.
          </p>
          <Btn variant="soft" onClick={() => router.push('/')}>Volver al inicio</Btn>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'reglas', label: 'Reglas', icon: <BookOpen size={13} /> },
    { id: 'flujos', label: 'Flujos', icon: <GitBranch size={13} /> },
    { id: 'prompts', label: 'Prompts IA', icon: <MessageSquareText size={13} /> },
    { id: 'preview', label: 'Vista previa', icon: <Eye size={13} /> },
    { id: 'auditoria', label: 'Auditoría', icon: <History size={13} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      <InnerHeader title="Panel de conocimiento" eyebrow="Knowledge base" backHref="/configuracion" />

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '14px 16px' }}>
        {!kbDisponible && (
          <div
            style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 14px',
              borderRadius: 12, marginBottom: 14,
              background: 'var(--treat-recon-bg)', border: '1px solid rgba(212, 130, 10, 0.25)',
            }}
          >
            <AlertTriangle size={16} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--treat-recon-color)', lineHeight: 1.45 }}>
              <strong>La knowledge base no está disponible.</strong> Aplica la migración{' '}
              <code>supabase/migration-knowledge-base.sql</code> en el SQL Editor de
              Supabase. Mientras tanto el diagnóstico usa el motor incorporado
              (resultados idénticos).
            </p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                background: tab === t.id ? 'var(--primary)' : 'var(--bg-card)',
                color: tab === t.id ? '#fff' : 'var(--text-secondary)',
                border: tab === t.id ? 'none' : '1px solid var(--border-soft)',
                cursor: 'pointer',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'reglas' && <TabReglas reglas={reglas} onCambio={recargar} />}
        {tab === 'flujos' && <TabFlujos flujos={flujos} onCambio={recargar} />}
        {tab === 'prompts' && <TabPrompts prompts={prompts} onCambio={recargar} />}
        {tab === 'preview' && <TabPreview reglas={reglas} />}
        {tab === 'auditoria' && <TabAuditoria eventos={auditoria} />}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tab: Reglas
// ════════════════════════════════════════════════════════════════════════════

function TabReglas({ reglas, onCambio }: { reglas: ReglaKBRow[]; onCambio: () => Promise<void> }) {
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todas');
  const [editando, setEditando] = useState<ReglaKBRow | 'nueva' | null>(null);

  const visibles = useMemo(
    () =>
      filtroSegmento === 'todas'
        ? reglas
        : reglas.filter((r) => r.segmento === filtroSegmento),
    [reglas, filtroSegmento]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SelectSimple
            value={filtroSegmento}
            options={['todas', ...SEGMENTOS]}
            onChange={setFiltroSegmento}
          />
        </div>
        <Btn size="sm" icon={<Plus size={13} />} onClick={() => setEditando('nueva')}>
          Nueva regla
        </Btn>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
        {visibles.length} regla(s) · solo las <strong>publicadas</strong> afectan el
        diagnóstico de los salones.
      </p>

      {visibles.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => setEditando(r)}
          className="v-card active:scale-[0.99] transition-transform"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-soft)',
            background: 'var(--bg-card)', width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.es_bandera_medica && (
                <AlertTriangle size={12} style={{ color: 'var(--treat-recon-color)', flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                  color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.clave}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {r.segmento} · prioridad {r.prioridad} · v{r.version}
            </div>
          </div>
          <ChipEstado estado={r.estado} />
        </button>
      ))}

      {editando && (
        <EditorRegla
          regla={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onCambio={onCambio}
        />
      )}
    </div>
  );
}

function EditorRegla({
  regla, onCerrar, onCambio,
}: {
  regla: ReglaKBRow | null;
  onCerrar: () => void;
  onCambio: () => Promise<void>;
}) {
  const [clave, setClave] = useState(regla?.clave ?? '');
  const [segmento, setSegmento] = useState<SegmentoRegla>(regla?.segmento ?? 'nota');
  const [prioridad, setPrioridad] = useState(String(regla?.prioridad ?? 100));
  const [estado, setEstado] = useState<EstadoKB>(regla?.estado ?? 'borrador');
  const [medica, setMedica] = useState(regla?.es_bandera_medica ?? false);
  const [condiciones, setCondiciones] = useState(
    regla?.condiciones ? JSON.stringify(regla.condiciones, null, 2) : ''
  );
  const [condValidas, setCondValidas] = useState(true);
  const [salida, setSalida] = useState(
    regla ? JSON.stringify(regla.salida, null, 2) : '{\n  "textos": [""]\n}'
  );
  const [salidaValida, setSalidaValida] = useState(true);
  const [notas, setNotas] = useState(regla?.notas_internas ?? '');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const guardar = async () => {
    if (!clave.trim() || !condValidas || !salidaValida) {
      showToast('Revisa la clave y los JSON antes de guardar', 'error');
      return;
    }
    setGuardando(true);
    try {
      const payload: ReglaEditable = {
        id: regla?.id,
        clave: clave.trim(),
        segmento,
        prioridad: parseInt(prioridad, 10) || 100,
        condiciones: condiciones.trim() ? (JSON.parse(condiciones) as Condicion) : null,
        salida: JSON.parse(salida) as SalidaRegla,
        es_bandera_medica: medica,
        estado,
        notas_internas: notas.trim() || null,
      };
      await guardarRegla(payload);
      await onCambio();
      showToast(regla ? 'Regla actualizada' : 'Regla creada', 'success');
      onCerrar();
    } catch (e) {
      console.error('[kb.guardarRegla]', e);
      showToast('No se pudo guardar la regla', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!regla) return;
    setGuardando(true);
    try {
      await eliminarRegla(regla.id);
      await onCambio();
      showToast('Regla eliminada', 'success');
      onCerrar();
    } catch (e) {
      console.error('[kb.eliminarRegla]', e);
      showToast('No se pudo eliminar la regla', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} title={regla ? `Editar · ${regla.clave}` : 'Nueva regla'} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="Clave (única)">
          <input value={clave} onChange={(e) => setClave(e.target.value)} style={inputStyle} />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Campo label="Segmento">
            <SelectSimple value={segmento} options={SEGMENTOS} onChange={(v) => setSegmento(v as SegmentoRegla)} />
          </Campo>
          <Campo label="Prioridad">
            <input
              type="number"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              style={inputStyle}
            />
          </Campo>
          <Campo label="Estado">
            <SelectSimple value={estado} options={ESTADOS} onChange={(v) => setEstado(v as EstadoKB)} />
          </Campo>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={medica} onChange={(e) => setMedica(e.target.checked)} />
          <span style={{ fontSize: 12.5, color: 'var(--text-main)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--treat-recon-color)', verticalAlign: -1 }} />{' '}
            Bandera médica — si matchea, SIEMPRE deriva a dermatólogo (segmento
            derivacion_medica)
          </span>
        </label>
        <Campo label="Condiciones (JSON · vacío = siempre aplica)">
          <JsonArea value={condiciones} onChange={(t, ok) => { setCondiciones(t); setCondValidas(ok); }} permitirNull />
        </Campo>
        <Campo label="Salida (JSON · forma según segmento)">
          <JsonArea value={salida} onChange={(t, ok) => { setSalida(t); setSalidaValida(ok); }} rows={8} />
        </Campo>
        <Campo label="Notas internas (opcional)">
          <input value={notas} onChange={(e) => setNotas(e.target.value)} style={inputStyle} />
        </Campo>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
          {regla ? (
            confirmandoBorrado ? (
              <Btn variant="outline" size="sm" disabled={guardando} onClick={borrar} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Confirmar eliminación
              </Btn>
            ) : (
              <Btn variant="ghost" size="sm" onClick={() => setConfirmandoBorrado(true)} style={{ color: 'var(--danger)' }}>
                Eliminar
              </Btn>
            )
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Btn>
            <Btn size="sm" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tab: Flujos
// ════════════════════════════════════════════════════════════════════════════

function TabFlujos({ flujos, onCambio }: { flujos: FlujoKBRow[]; onCambio: () => Promise<void> }) {
  const [editando, setEditando] = useState<FlujoKBRow | 'nuevo' | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', flex: 1 }}>
          Un flujo <strong>publicado</strong> agrega sus preguntas al wizard para los
          tipos de cabello que cubre — sin redeploy.
        </p>
        <Btn size="sm" icon={<Plus size={13} />} onClick={() => setEditando('nuevo')}>
          Nuevo flujo
        </Btn>
      </div>

      {flujos.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setEditando(f)}
          className="v-card active:scale-[0.99] transition-transform"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-soft)',
            background: 'var(--bg-card)', width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
              {f.clave}
            </span>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {f.definicion?.titulo} · tipos: {f.tipos_cabello?.join(', ') ?? 'todos'} ·{' '}
              {f.definicion?.preguntas?.length ?? 0} pregunta(s) · v{f.version}
            </div>
          </div>
          <ChipEstado estado={f.estado} />
        </button>
      ))}

      {editando && (
        <EditorFlujo
          flujo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onCambio={onCambio}
        />
      )}
    </div>
  );
}

function EditorFlujo({
  flujo, onCerrar, onCambio,
}: {
  flujo: FlujoKBRow | null;
  onCerrar: () => void;
  onCambio: () => Promise<void>;
}) {
  const [clave, setClave] = useState(flujo?.clave ?? '');
  const [tipos, setTipos] = useState(flujo?.tipos_cabello?.join(', ') ?? '');
  const [estado, setEstado] = useState<EstadoKB>(flujo?.estado ?? 'borrador');
  const [definicion, setDefinicion] = useState(
    flujo
      ? JSON.stringify(flujo.definicion, null, 2)
      : JSON.stringify(
          { titulo: '', descripcion: '', preguntas: [{ clave: '', etiqueta: '', tipo: 'opcion', opciones: [{ valor: '', etiqueta: '' }] }] },
          null,
          2
        )
  );
  const [defValida, setDefValida] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!clave.trim() || !defValida) {
      showToast('Revisa la clave y el JSON de la definición', 'error');
      return;
    }
    setGuardando(true);
    try {
      const payload: FlujoEditable = {
        id: flujo?.id,
        clave: clave.trim(),
        tipos_cabello: tipos.trim()
          ? tipos.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)
          : null,
        definicion: JSON.parse(definicion) as DefinicionFlujo,
        estado,
      };
      await guardarFlujo(payload);
      await onCambio();
      showToast(flujo ? 'Flujo actualizado' : 'Flujo creado', 'success');
      onCerrar();
    } catch (e) {
      console.error('[kb.guardarFlujo]', e);
      showToast('No se pudo guardar el flujo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!flujo) return;
    setGuardando(true);
    try {
      await eliminarFlujo(flujo.id);
      await onCambio();
      showToast('Flujo eliminado', 'success');
      onCerrar();
    } catch (e) {
      console.error('[kb.eliminarFlujo]', e);
      showToast('No se pudo eliminar el flujo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} title={flujo ? `Editar · ${flujo.clave}` : 'Nuevo flujo'} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Campo label="Clave">
            <input value={clave} onChange={(e) => setClave(e.target.value)} style={inputStyle} />
          </Campo>
          <Campo label="Estado">
            <SelectSimple value={estado} options={ESTADOS} onChange={(v) => setEstado(v as EstadoKB)} />
          </Campo>
        </div>
        <Campo label="Tipos de cabello (separados por coma · vacío = todos)">
          <input value={tipos} onChange={(e) => setTipos(e.target.value)} placeholder="1A, 1B, 1C" style={inputStyle} />
        </Campo>
        <Campo label="Definición (JSON: titulo, descripcion, preguntas[])">
          <JsonArea value={definicion} onChange={(t, ok) => { setDefinicion(t); setDefValida(ok); }} rows={14} />
        </Campo>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {flujo ? (
            <Btn variant="ghost" size="sm" disabled={guardando} onClick={borrar} style={{ color: 'var(--danger)' }}>
              Eliminar
            </Btn>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Btn>
            <Btn size="sm" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tab: Prompts IA
// ════════════════════════════════════════════════════════════════════════════

function TabPrompts({ prompts, onCambio }: { prompts: PromptKBRow[]; onCambio: () => Promise<void> }) {
  const [editando, setEditando] = useState<PromptKBRow | 'nuevo' | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', flex: 1 }}>
          La IA compone su prompt con los segmentos <strong>publicados</strong> (con
          caché de ~1 min en el servidor) — publicar aquí no requiere redeploy.
        </p>
        <Btn size="sm" icon={<Plus size={13} />} onClick={() => setEditando('nuevo')}>
          Nuevo prompt
        </Btn>
      </div>

      {prompts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setEditando(p)}
          className="v-card active:scale-[0.99] transition-transform"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-soft)',
            background: 'var(--bg-card)', width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
              {p.clave}
            </span>
            <div
              style={{
                fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {p.tipos_cabello ? `tipos: ${p.tipos_cabello.join(', ')} · ` : ''}
              {p.contenido.slice(0, 80)}…
            </div>
          </div>
          <ChipEstado estado={p.estado} />
        </button>
      ))}

      {editando && (
        <EditorPrompt
          prompt={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onCambio={onCambio}
        />
      )}
    </div>
  );
}

function EditorPrompt({
  prompt, onCerrar, onCambio,
}: {
  prompt: PromptKBRow | null;
  onCerrar: () => void;
  onCambio: () => Promise<void>;
}) {
  const [clave, setClave] = useState(prompt?.clave ?? '');
  const [tipos, setTipos] = useState(prompt?.tipos_cabello?.join(', ') ?? '');
  const [estado, setEstado] = useState<EstadoKB>(prompt?.estado ?? 'borrador');
  const [contenido, setContenido] = useState(prompt?.contenido ?? '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!clave.trim() || !contenido.trim()) {
      showToast('La clave y el contenido son requeridos', 'error');
      return;
    }
    setGuardando(true);
    try {
      const payload: PromptEditable = {
        id: prompt?.id,
        clave: clave.trim(),
        tipos_cabello: tipos.trim()
          ? tipos.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)
          : null,
        contenido,
        estado,
      };
      await guardarPrompt(payload);
      await onCambio();
      showToast(prompt ? 'Prompt actualizado' : 'Prompt creado', 'success');
      onCerrar();
    } catch (e) {
      console.error('[kb.guardarPrompt]', e);
      showToast('No se pudo guardar el prompt', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!prompt) return;
    setGuardando(true);
    try {
      await eliminarPrompt(prompt.id);
      await onCambio();
      showToast('Prompt eliminado', 'success');
      onCerrar();
    } catch (e) {
      console.error('[kb.eliminarPrompt]', e);
      showToast('No se pudo eliminar el prompt', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} title={prompt ? `Editar · ${prompt.clave}` : 'Nuevo prompt'} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Campo label="Clave">
            <input value={clave} onChange={(e) => setClave(e.target.value)} style={inputStyle} />
          </Campo>
          <Campo label="Estado">
            <SelectSimple value={estado} options={ESTADOS} onChange={(v) => setEstado(v as EstadoKB)} />
          </Campo>
        </div>
        <Campo label="Tipos de cabello (separados por coma · vacío = todos)">
          <input value={tipos} onChange={(e) => setTipos(e.target.value)} placeholder="3A, 3B" style={inputStyle} />
        </Campo>
        <Campo label="Contenido">
          <textarea
            value={contenido}
            rows={12}
            onChange={(e) => setContenido(e.target.value)}
            style={monoArea}
            spellCheck={false}
          />
        </Campo>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {prompt ? (
            <Btn variant="ghost" size="sm" disabled={guardando} onClick={borrar} style={{ color: 'var(--danger)' }}>
              Eliminar
            </Btn>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Btn>
            <Btn size="sm" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tab: Vista previa — "si el perfil es X, la recomendación sería Y"
// ════════════════════════════════════════════════════════════════════════════

const TIPOS_CABELLO = ['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C', '4A', '4B', '4C'];
const DANOS_PREVIEW = [
  'Sin daño visible',
  'Daño mecánico (peinado brusco, ligas, etc.)',
  'Daño térmico (textura alterada por calor)',
  'Daño químico (decoloración, alisado)',
  'En transición capilar (dos texturas visibles)',
];
const CUERO_PREVIEW = [
  'Saludable (limpio, sin irritación)',
  'Graso (exceso de sebo)',
  'Seco / descamación',
  'Caspa seca',
  'Dermatitis seborreica',
  'Build-up (acumulación de producto)',
];
const PROBLEMAS_PREVIEW = ['Frizz excesivo', 'Resequedad', 'Caída excesiva', 'Rizos poco definidos'];

function TabPreview({ reglas }: { reglas: ReglaKBRow[] }) {
  const [tipo, setTipo] = useState('3B');
  const [porosidad, setPorosidad] = useState('media');
  const [densidad, setDensidad] = useState('media');
  const [grosor, setGrosor] = useState('medio');
  const [elasticidad, setElasticidad] = useState('media');
  const [balanceHP, setBalanceHP] = useState('');
  const [tipoDano, setTipoDano] = useState<string[]>([]);
  const [cuero, setCuero] = useState<string[]>([]);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [estadoPuntas, setEstadoPuntas] = useState('');
  const [embarazo, setEmbarazo] = useState(false);
  const [nivelEstres, setNivelEstres] = useState('');
  const [extJson, setExtJson] = useState('');
  const [extValido, setExtValido] = useState(true);
  const [incluirBorradores, setIncluirBorradores] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generar = () => {
    setError(null);
    try {
      const data: WizardData = {
        ...WIZARD_INITIAL_DATA,
        nombre: 'Vista previa',
        tipoRizoPrincipal: tipo,
        porosidad,
        densidad,
        grosor,
        elasticidad,
        balanceHP,
        tipoDano,
        estadoCueroCabelludo: cuero,
        problemas,
        estadoPuntas,
        perfilExtendido: extJson.trim() ? JSON.parse(extJson) : undefined,
      };
      const activas = reglas
        .filter((r) =>
          incluirBorradores ? r.estado !== 'archivada' : r.estado === 'publicada'
        )
        .map(rowToRegla);
      if (activas.length === 0) {
        setError('No hay reglas activas para evaluar (¿migración aplicada?).');
        setResultado(null);
        return;
      }
      setResultado(evaluarDiagnostico(activas, data, { embarazo, nivelEstres }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al evaluar');
      setResultado(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="v-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="v-caps" style={{ color: 'var(--primary)' }}>Perfil de prueba</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Campo label="Tipo"><SelectSimple value={tipo} options={['', ...TIPOS_CABELLO]} onChange={setTipo} /></Campo>
          <Campo label="Porosidad"><SelectSimple value={porosidad} options={['', 'baja', 'media', 'alta']} onChange={setPorosidad} /></Campo>
          <Campo label="Densidad"><SelectSimple value={densidad} options={['', 'baja', 'media', 'alta']} onChange={setDensidad} /></Campo>
          <Campo label="Grosor"><SelectSimple value={grosor} options={['', 'fino', 'medio', 'grueso']} onChange={setGrosor} /></Campo>
          <Campo label="Elasticidad"><SelectSimple value={elasticidad} options={['', 'baja', 'media', 'alta']} onChange={setElasticidad} /></Campo>
          <Campo label="Balance H/P"><SelectSimple value={balanceHP} options={['', 'hidratacion', 'nutricion', 'proteina', 'equilibrado']} onChange={setBalanceHP} /></Campo>
        </div>
        <Campo label="Tipo de daño">
          <ChipsMulti options={DANOS_PREVIEW} selected={tipoDano} onChange={setTipoDano} />
        </Campo>
        <Campo label="Cuero cabelludo">
          <ChipsMulti options={CUERO_PREVIEW} selected={cuero} onChange={setCuero} />
        </Campo>
        <Campo label="Problemas">
          <ChipsMulti options={PROBLEMAS_PREVIEW} selected={problemas} onChange={setProblemas} />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Campo label="Puntas">
            <SelectSimple
              value={estadoPuntas}
              options={['', 'Puntas sanas (selladas)', 'Puntas abiertas leves', 'Puntas abiertas severas (necesita corte)']}
              onChange={setEstadoPuntas}
            />
          </Campo>
          <Campo label="Nivel de estrés">
            <SelectSimple value={nivelEstres} options={['', 'bajo', 'medio', 'alto']} onChange={setNivelEstres} />
          </Campo>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={embarazo} onChange={(e) => setEmbarazo(e.target.checked)} />
          <span style={{ fontSize: 12.5 }}>Embarazo / lactancia</span>
        </label>
        <Campo label="Perfil extendido (JSON · ej. señales de alopecia)">
          <JsonArea
            value={extJson}
            onChange={(t, ok) => { setExtJson(t); setExtValido(ok); }}
            rows={3}
            permitirNull
          />
        </Campo>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={incluirBorradores}
            onChange={(e) => setIncluirBorradores(e.target.checked)}
          />
          <span style={{ fontSize: 12.5 }}>
            Incluir reglas en <strong>borrador</strong> (simula qué pasaría al publicarlas)
          </span>
        </label>
        <Btn fullWidth icon={<Sparkles size={14} />} disabled={!extValido} onClick={generar}>
          Generar vista previa
        </Btn>
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{error}</p>
      )}

      {resultado && <ResultadoPreview resultado={resultado} />}
    </div>
  );
}

function ResultadoPreview({ resultado }: { resultado: ResultadoConsulta }) {
  const esDerivacion = resultado.tratamientoPrincipal === 'Derivación a dermatólogo';
  return (
    <div
      className="v-card"
      style={{
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        border: esDerivacion ? '1px solid rgba(212, 130, 10, 0.4)' : '1px solid var(--border-soft)',
      }}
    >
      <div className="v-caps" style={{ color: 'var(--primary)' }}>La recomendación sería</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {esDerivacion && <AlertTriangle size={18} style={{ color: 'var(--treat-recon-color)' }} />}
        <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 22 }}>
          {resultado.tratamientoPrincipal || '—'}
        </h3>
      </div>
      {resultado.tratamientosAdicionales.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {resultado.tratamientosAdicionales.map((t) => (
            <span
              key={t}
              style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: 'var(--primary-pale)', color: 'var(--primary)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div>
        <div className="v-caps" style={{ marginBottom: 4 }}>Cronograma</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
          <span>S1 · {resultado.cronograma.semana1 || '—'}</span>
          <span>S2 · {resultado.cronograma.semana2 || '—'}</span>
          <span>S3 · {resultado.cronograma.semana3 || '—'}</span>
          <span>S4 · {resultado.cronograma.semana4 || '—'}</span>
        </div>
      </div>
      {resultado.tecnicaDefinicion && (
        <div style={{ fontSize: 12 }}>
          <div className="v-caps" style={{ marginBottom: 4 }}>Técnica</div>
          <strong>{resultado.tecnicaDefinicion}</strong> · {resultado.metodoSecado}
        </div>
      )}
      <div style={{ fontSize: 12 }}>
        <div className="v-caps" style={{ marginBottom: 4 }}>Intervalo</div>
        {resultado.intervaloSugerido || '—'}
      </div>
      {resultado.notasAdicionales.length > 0 && (
        <div>
          <div className="v-caps" style={{ marginBottom: 4 }}>Notas</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
            {resultado.notasAdicionales.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          Ver resultado completo (JSON)
        </summary>
        <pre
          style={{
            margin: '8px 0 0', padding: 10, borderRadius: 10, background: 'var(--bg)',
            fontSize: 10, lineHeight: 1.45, overflow: 'auto', maxHeight: 320,
          }}
        >
          {JSON.stringify(resultado, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tab: Auditoría
// ════════════════════════════════════════════════════════════════════════════

function TabAuditoria({ eventos }: { eventos: AuditoriaRow[] }) {
  if (eventos.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>
        Sin eventos de auditoría todavía.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {eventos.map((e) => {
        const clave =
          (e.datos_despues?.clave as string | undefined) ??
          (e.datos_antes?.clave as string | undefined) ??
          e.registro_id.slice(0, 8);
        const color =
          e.accion === 'DELETE' ? 'var(--danger)'
          : e.accion === 'INSERT' ? 'var(--primary)'
          : 'var(--secondary-deep)';
        return (
          <div
            key={e.id}
            className="v-card"
            style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.06em', color, flexShrink: 0, width: 52,
              }}
            >
              {e.accion}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {e.tabla.replace('kb_', '')} · {clave}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {formatDate(e.created_at)} · {e.usuario ? `usuario ${e.usuario.slice(0, 8)}…` : 'sistema'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
