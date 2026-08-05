'use client';
// ══════════════════════════════════════════════════════════════════════════
// Matriz de recomendación de cortes (Entrega 5 §7). Plan Pro.
//
// Política lingüística de Keila (§5.1): toda salida usa exclusivamente
// equilibrar, destacar, enmarcar y celebrar. Ningún rostro tiene defectos.
//
// Imágenes: siluetas vectoriales propias (respuesta 4 de Keila). Las fotos
// reales se pueblan del antes/después del salón, y ese registro pasa por el
// gating de consentimiento de imágenes ya implementado.
// ══════════════════════════════════════════════════════════════════════════

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Scissors, Lock, Check, Camera, CalendarPlus, Info, Sparkles, Users,
} from 'lucide-react';
import { InnerHeader, Btn, Chip } from '@/components/v2';
import Input from '@/components/ui/Input';
import { showToast } from '@/lib/toast';
import { getClientaById } from '@/lib/db';
import { getProfile } from '@/lib/profile';
import { getSuscripcionEfectiva, featuresEfectivas } from '@/lib/subscription/estado';
import { uploadFoto } from '@/lib/storage';
import { evaluarCamara, listarConsentimientos, type ConsentimientoClienta } from '@/lib/consentimientos';
import ModalFirmaConsentimiento from '@/components/legal/ModalFirmaConsentimiento';
import { SiluetaRostro, EsquemaCorte } from '@/components/cortes/Siluetas';
import { GUIA_ROSTROS } from '@/lib/cortes/fichas';
import { recomendarCortes } from '@/lib/cortes/matriz';
import { cargarCatalogo, registrarCorteEjecutado } from '@/lib/cortes/catalogo';
import { cargarDiagnosticoVigente } from '@/lib/cortes/integracion';
import { horarioDisponible, preAgendarRetoque, proponerRetoque } from '@/lib/cortes/preagenda';
import { traducirErrorAgenda } from '@/lib/agenda/reglas';
import { FORMAS_ROSTRO } from '@/lib/cortes/tipos';
import type {
  EntradaDiagnosticoCorte, EtiquetaGenero, FichaCorte, FormaRostro,
  RecomendacionCorte, TolerarMantenimiento,
} from '@/lib/cortes/tipos';

const TOLERANCIAS: { v: TolerarMantenimiento; label: string; sub: string }[] = [
  { v: 'baja', label: 'Baja', sub: 'Cada 8 semanas o más' },
  { v: 'media', label: 'Media', sub: 'Cada 4 a 8 semanas' },
  { v: 'alta', label: 'Alta', sub: 'Cualquier frecuencia' },
];

const FILTROS_GENERO: { v: EtiquetaGenero | 'todo'; label: string }[] = [
  { v: 'todo', label: 'Todo el catálogo' },
  { v: 'sugerido_mujeres', label: 'Sugerido para mujeres' },
  { v: 'sugerido_hombres', label: 'Sugerido para hombres' },
  { v: 'unisex', label: 'Unisex' },
];

const DESEOS = [
  { v: 'pomulos', label: 'Pómulos' },
  { v: 'ojos', label: 'Ojos' },
  { v: 'mandibula', label: 'Mandíbula' },
  { v: 'cuello', label: 'Cuello' },
  { v: 'volumen', label: 'Volumen' },
  { v: 'rizos', label: 'Sus rizos' },
];

function MatrizContent() {
  const params = useSearchParams();
  const router = useRouter();
  const clientaId = params.get('clientaId');

  const [cargando, setCargando] = useState(true);
  const [habilitada, setHabilitada] = useState(false);
  const [clienta, setClienta] = useState<{ id: string; nombre: string } | null>(null);
  const [diagnostico, setDiagnostico] = useState<EntradaDiagnosticoCorte>({});
  const [catalogo, setCatalogo] = useState<FichaCorte[]>([]);
  const [origenCatalogo, setOrigenCatalogo] = useState<'kb' | 'seed'>('seed');
  const [consentimientos, setConsentimientos] = useState<ConsentimientoClienta[]>([]);
  const [bloqueoTipo4, setBloqueoTipo4] = useState(180);

  // Entradas de sesión
  const [formaRostro, setFormaRostro] = useState<FormaRostro>('ovalado');
  const [tolerancia, setTolerancia] = useState<TolerarMantenimiento>('media');
  const [filtroGenero, setFiltroGenero] = useState<EtiquetaGenero | 'todo'>('todo');
  const [quiereDestacar, setQuiereDestacar] = useState<string[]>([]);

  // Confirmación
  const [elegido, setElegido] = useState<RecomendacionCorte | null>(null);
  const [foto, setFoto] = useState<string | undefined>();
  const [notas, setNotas] = useState('');
  const [preAgendar, setPreAgendar] = useState(true);
  const [firmando, setFirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const recargarConsentimientos = useCallback(async () => {
    if (!clientaId) return;
    setConsentimientos(await listarConsentimientos(clientaId).catch(() => []));
  }, [clientaId]);

  useEffect(() => {
    (async () => {
      try {
        const [sub, cat, perfil] = await Promise.all([
          getSuscripcionEfectiva(),
          cargarCatalogo().catch(() => ({ fichas: [], origen: 'seed' as const })),
          getProfile().catch(() => null),
        ]);
        setHabilitada(featuresEfectivas(sub).calculadoraColor);
        setCatalogo(cat.fichas);
        setOrigenCatalogo(cat.origen);
        if (perfil?.bloqueoTipo4Minutos) setBloqueoTipo4(perfil.bloqueoTipo4Minutos);
        if (!clientaId) return;
        const [cl, dx, cs] = await Promise.all([
          getClientaById(clientaId),
          cargarDiagnosticoVigente(clientaId),
          listarConsentimientos(clientaId).catch(() => []),
        ]);
        setClienta(cl ? { id: cl.id, nombre: cl.nombre } : null);
        setDiagnostico(dx.diagnostico);
        setConsentimientos(cs);
      } finally {
        setCargando(false);
      }
    })();
  }, [clientaId]);

  const resultado = useMemo(
    () =>
      recomendarCortes({
        diagnostico,
        sesion: {
          formaRostro,
          toleranciaMantenimiento: tolerancia,
          filtroGenero,
          quiereDestacar: quiereDestacar.length ? quiereDestacar : undefined,
        },
        catalogo: catalogo.length ? catalogo : undefined,
      }),
    [diagnostico, formaRostro, tolerancia, filtroGenero, quiereDestacar, catalogo]
  );

  const gateFoto = evaluarCamara({
    contexto: 'registro_servicio_quimico',
    clientaRegistrada: !!clienta,
    firmas: consentimientos,
  });

  const confirmar = async () => {
    if (!clienta || !elegido) return;
    setGuardando(true);
    try {
      let fotoPath: string | undefined;
      if (foto && gateFoto.permitida) {
        fotoPath = await uploadFoto(foto, `cortes/${clienta.id}/${Date.now()}`);
      }

      await registrarCorteEjecutado({
        clientaId: clienta.id,
        corteClave: elegido.ficha.clave,
        variante: elegido.varianteRecomendada,
        formaRostro,
        razonamiento: { porque: elegido.porque, motivos: elegido.motivos },
        fotoDespues: fotoPath,
        notas: notas.trim() || undefined,
      });

      // PR-06 · ventana de pre-agendamiento del retoque.
      if (preAgendar) {
        const propuesta = proponerRetoque({
          ficha: elegido.ficha,
          bloqueoTipo4Minutos: bloqueoTipo4,
        });
        const libre = await horarioDisponible(propuesta).catch(() => true);
        if (libre) {
          try {
            await preAgendarRetoque({ clientaId: clienta.id, propuesta });
            showToast('Corte registrado y retoque pre-agendado', 'success');
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast(`Corte registrado. ${traducirErrorAgenda(msg)}`, 'info');
          }
        } else {
          showToast('Corte registrado. Ese horario de retoque estaba ocupado: agéndalo desde la agenda.', 'info');
        }
      } else {
        showToast('Corte registrado', 'success');
      }
      router.push(`/clientas/${clienta.id}`);
    } catch (e) {
      console.error('[cortes.registrar]', e);
      showToast('No se pudo registrar el corte. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Marco><p className="v-caps" style={{ textAlign: 'center', padding: 40 }}>Cargando…</p></Marco>;

  if (!habilitada) {
    return (
      <Marco>
        <Aviso icono={<Lock size={26} />} titulo="La matriz de cortes es del plan Pro"
          texto="La recomendación manual de corte está incluida en el plan Pro. La detección facial automática llegará con Pro + IA.">
          <Btn variant="primary" onClick={() => router.push('/planes')}>Ver planes</Btn>
        </Aviso>
      </Marco>
    );
  }

  if (!clienta) {
    return (
      <Marco>
        <Aviso icono={<Scissors size={26} />} titulo="Elige una clienta"
          texto="La matriz precarga el diagnóstico vigente para filtrar el catálogo por su patrón de cabello antes de puntuar por rostro.">
          <Btn variant="primary" onClick={() => router.push('/clientas')}>Ir a clientas</Btn>
        </Aviso>
      </Marco>
    );
  }

  return (
    <Marco subtitulo={clienta.nombre}>
      {/* ── Forma del rostro ────────────────────────────────────────────── */}
      <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="v-caps" style={{ marginBottom: 4 }}>Forma del rostro</div>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
          Con el cabello retirado del rostro, observa frente, pómulos, mandíbula y la
          proporción largo/ancho. Si es mezcla, registra la dominante.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {FORMAS_ROSTRO.map((f) => {
            const guia = GUIA_ROSTROS.find((g) => g.forma === f)!;
            const on = formaRostro === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormaRostro(f)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 12, cursor: 'pointer',
                  background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
                  border: `1px solid ${on ? 'rgba(45, 90, 39, 0.35)' : 'var(--border-soft)'}`,
                }}
              >
                <SiluetaRostro forma={f} size={40} activa={on} />
                <span style={{ fontSize: 10, fontWeight: 600, color: on ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  {guia.nombre}
                </span>
              </button>
            );
          })}
        </div>
        <p
          style={{
            margin: '10px 0 0', padding: '9px 11px', borderRadius: 10,
            background: 'var(--primary-pale)', fontSize: 11.5,
            color: 'var(--primary)', lineHeight: 1.5,
          }}
        >
          {GUIA_ROSTROS.find((g) => g.forma === formaRostro)!.vector}
        </p>
      </section>

      {/* ── Preferencias ────────────────────────────────────────────────── */}
      <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="v-caps" style={{ marginBottom: 8 }}>Tolerancia de mantenimiento</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {TOLERANCIAS.map(({ v, label, sub }) => {
            const on = tolerancia === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setTolerancia(v)}
                style={{
                  flex: 1, padding: '9px 6px', borderRadius: 12, cursor: 'pointer',
                  background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
                  border: `1px solid ${on ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--primary)' : 'var(--text-main)' }}>{label}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</div>
              </button>
            );
          })}
        </div>

        <div className="v-caps" style={{ marginBottom: 8 }}>¿Qué quiere destacar? (opcional)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {DESEOS.map(({ v, label }) => {
            const on = quiereDestacar.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => setQuiereDestacar((p) => on ? p.filter((x) => x !== v) : [...p, v])}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  background: on ? 'var(--secondary-pale)' : 'var(--bg-card)',
                  color: on ? 'var(--secondary-deep)' : 'var(--text-secondary)',
                  border: `1px solid ${on ? 'rgba(138, 90, 46, 0.3)' : 'var(--border-soft)'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {quiereDestacar.length > 0 && (
          <p style={{ margin: '0 0 12px', fontSize: 10.5, color: 'var(--secondary-deep)', lineHeight: 1.45 }}>
            Lo que la clienta pide pesa más que la heurística de proporción.
          </p>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-caps">
            <Users size={10} style={{ display: 'inline', verticalAlign: -1 }} /> Filtro de búsqueda
          </span>
          <select
            value={filtroGenero}
            onChange={(e) => setFiltroGenero(e.target.value as EtiquetaGenero | 'todo')}
            style={{
              padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
              fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-main)', width: '100%',
            }}
          >
            {FILTROS_GENERO.map((f) => (
              <option key={f.v} value={f.v}>{f.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Las etiquetas organizan la búsqueda, no levantan barreras: los unisex aparecen siempre.
          </span>
        </label>
      </section>

      {/* ── Top 3 ───────────────────────────────────────────────────────── */}
      <div className="v-caps" style={{ marginBottom: 10 }}>
        <Sparkles size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Recomendación
      </div>

      {resultado.recomendaciones.length === 0 ? (
        <div className="v-card" style={{ padding: 20, textAlign: 'center', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Con esos filtros el catálogo queda sin candidatos. Amplía la tolerancia de
            mantenimiento o el filtro de búsqueda.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {resultado.recomendaciones.map((rec, i) => {
            const on = elegido?.ficha.clave === rec.ficha.clave;
            return (
              <article
                key={rec.ficha.clave}
                className="v-card"
                style={{
                  padding: 14,
                  border: `1px solid ${on ? 'rgba(45, 90, 39, 0.4)' : 'var(--border-soft)'}`,
                  background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
                }}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flexShrink: 0 }}>
                    <EsquemaCorte largo={rec.ficha.largo} capas={rec.ficha.capas} size={56} destacado={on} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span className="v-num" style={{ fontSize: 9 }}>0{i + 1}</span>
                      <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text-main)' }}>
                        {rec.ficha.nombre}
                      </h3>
                      <Chip tone="ghost">{rec.ficha.clave}</Chip>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {rec.porque}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <Chip tone="green">{rec.frecuenciaRetoque}</Chip>
                      {rec.varianteRecomendada && <Chip tone="blue">Variante sugerida</Chip>}
                    </div>
                    {rec.varianteRecomendada && (
                      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--primary)' }}>
                        Variante: {rec.varianteRecomendada}
                      </p>
                    )}
                    {rec.notaHonesta && (
                      <p
                        style={{
                          margin: '8px 0 0', padding: '8px 10px', borderRadius: 10,
                          background: 'var(--treat-recon-bg)', fontSize: 11,
                          color: 'var(--treat-recon-color)', lineHeight: 1.5,
                        }}
                      >
                        <Info size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {rec.notaHonesta}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Btn
                    variant={on ? 'primary' : 'soft'}
                    size="sm"
                    fullWidth
                    icon={on ? <Check size={12} /> : undefined}
                    onClick={() => setElegido(on ? null : rec)}
                  >
                    {on ? 'Elegido para ejecutar' : 'Elegir este corte'}
                  </Btn>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Advertencias y descartes ────────────────────────────────────── */}
      {resultado.advertencias.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {resultado.advertencias.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px',
                borderRadius: 12, background: 'var(--treat-recon-bg)',
                border: '1px solid rgba(212, 130, 10, 0.25)',
              }}
            >
              <Info size={13} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--treat-recon-color)', lineHeight: 1.5 }}>{a}</p>
            </div>
          ))}
        </section>
      )}

      {resultado.descartados.length > 0 && (
        <details className="v-card" style={{ padding: 14, marginBottom: 14 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
            {resultado.descartados.length} corte(s) fuera de esta consulta y por qué
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {resultado.descartados.map((d) => (
              <div key={d.clave} style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{d.nombre}</strong> — {d.motivo}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Confirmación ────────────────────────────────────────────────── */}
      {elegido && (
        <section className="v-card" style={{ padding: 14, marginBottom: 24 }}>
          <div className="v-caps" style={{ marginBottom: 10 }}>Registrar la ejecución</div>

          {gateFoto.permitida ? (
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderRadius: 12, border: '1px dashed var(--border-strong)',
                cursor: 'pointer', background: 'var(--bg)', marginBottom: 10,
              }}
            >
              <Camera size={16} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {foto ? 'Foto del resultado cargada' : 'Agregar foto del resultado'}
              </span>
              <input
                type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setFoto(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          ) : (
            <div
              style={{
                padding: '12px 14px', borderRadius: 12, marginBottom: 10,
                background: 'var(--treat-recon-bg)', border: '1px solid rgba(212, 130, 10, 0.25)',
              }}
            >
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--treat-recon-color)', lineHeight: 1.5 }}>
                La foto del antes y después alimenta el catálogo visual del salón, y requiere
                el consentimiento de imágenes firmado y vigente de {clienta.nombre}.
              </p>
              <div style={{ marginTop: 10 }}>
                <Btn variant="soft" size="sm" onClick={() => setFirmando(true)}>
                  Firmar consentimiento de imágenes
                </Btn>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <Input
              label="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional — ajustes de la ejecución, preferencias de la clienta…"
            />
          </div>

          {/* PR-06 · ventana de pre-agendamiento */}
          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
              borderRadius: 12, cursor: 'pointer', marginBottom: 14,
              background: preAgendar ? 'var(--primary-pale)' : 'var(--bg)',
              border: `1px solid ${preAgendar ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
            }}
          >
            <input
              type="checkbox"
              checked={preAgendar}
              onChange={(e) => setPreAgendar(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-main)', lineHeight: 1.5 }}>
              <CalendarPlus size={12} style={{ display: 'inline', verticalAlign: -2 }} />{' '}
              {proponerRetoque({ ficha: elegido.ficha, bloqueoTipo4Minutos: bloqueoTipo4 }).mensaje}
            </span>
          </label>

          <Btn
            variant="primary" size="lg" fullWidth icon={<Check size={15} />}
            disabled={guardando} onClick={confirmar}
          >
            {guardando ? 'Registrando…' : 'Confirmar corte ejecutado'}
          </Btn>
        </section>
      )}

      {origenCatalogo === 'seed' && (
        <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
          Catálogo semilla incorporado. Cuando se publiquen las fichas desde el panel de
          conocimiento, la matriz usará esas.
        </p>
      )}

      {firmando && (
        <ModalFirmaConsentimiento
          tipo="consentimiento_imagenes"
          clientaId={clienta.id}
          clientaNombre={clienta.nombre}
          onClose={() => setFirmando(false)}
          onFirmado={recargarConsentimientos}
        />
      )}
    </Marco>
  );
}

// ── Átomos locales ─────────────────────────────────────────────────────────

function Marco({ children, subtitulo }: { children: React.ReactNode; subtitulo?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <InnerHeader title="Matriz de cortes" eyebrow={subtitulo ?? 'Visagismo'} backHref="/clientas" />
      <main style={{ maxWidth: 768, margin: '0 auto', padding: '14px 16px' }}>{children}</main>
    </div>
  );
}

function Aviso({
  icono, titulo, texto, children,
}: { icono: React.ReactNode; titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="v-card" style={{ padding: 24, textAlign: 'center', marginTop: 20 }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 10 }}>{icono}</div>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--text-main)' }}>{titulo}</h2>
      <p style={{ margin: '8px auto 16px', maxWidth: 380, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {texto}
      </p>
      {children}
    </div>
  );
}

export default function MatrizCortesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="v-caps">Cargando…</p>
        </div>
      }
    >
      <MatrizContent />
    </Suspense>
  );
}
