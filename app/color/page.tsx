'use client';
// ══════════════════════════════════════════════════════════════════════════
// Calculadora de colorimetría (Sprint C · Entrega 3 §7). Plan Pro.
//
// Principio rector con peso jurídico (validación técnica, respuesta 6):
//   "Velli orienta la formulación y el diseño; el estilista decide y ejecuta"
// Por eso la pantalla muestra SIEMPRE la Guía de Razonamiento Técnico (el
// porqué) junto a una Fórmula Sugerida 100 % editable en gramos y volúmenes
// antes de confirmar. Al confirmar se registra la fórmula FINAL, el proceso
// y la foto del resultado.
// ══════════════════════════════════════════════════════════════════════════

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Palette, ShieldAlert, Lock, Check, Camera, ChevronRight, Sparkles,
  ListChecks, Layers, Info,
} from 'lucide-react';
import { InnerHeader, Btn, Chip } from '@/components/v2';
import Input from '@/components/ui/Input';
import { showToast } from '@/lib/toast';
import { getClientaById } from '@/lib/db';
import { getSuscripcionEfectiva, featuresEfectivas } from '@/lib/subscription/estado';
import { uploadFoto } from '@/lib/storage';
import { evaluarCamara, listarConsentimientos, type ConsentimientoClienta } from '@/lib/consentimientos';
import ModalFirmaConsentimiento from '@/components/legal/ModalFirmaConsentimiento';
import { calcularColor, type CartaMarca } from '@/lib/color/calculadora';
import {
  cargarDiagnosticoVigente, cartaDesdeMarca, marcasDelSalon,
  prerrequisitosDecoloracion,
} from '@/lib/color/integracion';
import SelectorTramoCanas from '@/components/color/SelectorTramoCanas';
import { registrarServicioColor } from '@/lib/color/registro';
import { useFlags } from '@/lib/flags/useFlags';
import { NIVELES, filaAltura, type NivelTono, type Temperatura, type Volumen } from '@/lib/color/tablas';
import type { Clienta } from '@/lib/types';
import type {
  Bloqueo, DiagnosticoColor, FormulaSugerida, ResultadoCalculadora,
} from '@/lib/color/tipos';
import type { MarcaKBRow } from '@/lib/kb/marcas';

const TEMPERATURAS: { v: Temperatura; label: string }[] = [
  { v: 'frio', label: 'Frío' },
  { v: 'neutro', label: 'Neutro' },
  { v: 'calido', label: 'Cálido' },
];

function CalculadoraContent() {
  const params = useSearchParams();
  const router = useRouter();
  const flags = useFlags();
  const clientaId = params.get('clientaId');

  const [cargando, setCargando] = useState(true);
  const [habilitada, setHabilitada] = useState(false);
  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoColor>({});
  const [marcas, setMarcas] = useState<MarcaKBRow[]>([]);
  const [consentimientos, setConsentimientos] = useState<ConsentimientoClienta[]>([]);
  const [bloqueosLegales, setBloqueosLegales] = useState<Bloqueo[]>([]);

  // Entradas de sesión
  const [nivelNatural, setNivelNatural] = useState<NivelTono>(6);
  const [pigmentoArtificial, setPigmentoArtificial] = useState(false);
  const [nivelLargos, setNivelLargos] = useState<NivelTono>(6);
  const [nivelObjetivo, setNivelObjetivo] = useState<NivelTono>(8);
  const [temperatura, setTemperatura] = useState<Temperatura>('frio');
  const [marcaId, setMarcaId] = useState('');
  const [canasAltas, setCanasAltas] = useState<number | null>(null);

  // Fórmula editable + confirmación
  const [formulaEditada, setFormulaEditada] = useState<FormulaSugerida | null>(null);
  const [proceso, setProceso] = useState('');
  const [foto, setFoto] = useState<string | undefined>();
  const [firmando, setFirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const recargarConsentimientos = useCallback(async () => {
    if (!clientaId) return;
    setConsentimientos(await listarConsentimientos(clientaId).catch(() => []));
  }, [clientaId]);

  useEffect(() => {
    (async () => {
      try {
        const sub = await getSuscripcionEfectiva();
        setHabilitada(featuresEfectivas(sub).calculadoraColor);
        if (!clientaId) return;
        const [cl, dx, ms, cs] = await Promise.all([
          getClientaById(clientaId),
          cargarDiagnosticoVigente(clientaId),
          marcasDelSalon().catch(() => []),
          listarConsentimientos(clientaId).catch(() => []),
        ]);
        setClienta(cl ?? null);
        setDiagnostico(dx.diagnostico);
        setCanasAltas(null);
        setMarcas(ms);
        setConsentimientos(cs);
        if (cl) setBloqueosLegales(await prerrequisitosDecoloracion(cl).catch(() => []));
      } finally {
        setCargando(false);
      }
    })();
  }, [clientaId]);

  const carta: CartaMarca | undefined = useMemo(
    () => cartaDesdeMarca(marcas.find((m) => m.id === marcaId)),
    [marcas, marcaId]
  );

  // Sin el tramo elegido no se calcula la cobertura: la guía y la fórmula
  // esperan, para no mostrar una fórmula sin CO-05 a una cabeza con canas.
  const faltaPrecisarCanas = !!diagnostico.canasPorPrecisar && canasAltas === null;
  const diagnosticoEfectivo: DiagnosticoColor = useMemo(
    () =>
      diagnostico.canasPorPrecisar && canasAltas !== null
        ? { ...diagnostico, porcentajeCanas: canasAltas }
        : diagnostico,
    [diagnostico, canasAltas]
  );

  const resultado: ResultadoCalculadora = useMemo(
    () =>
      calcularColor({
        diagnostico: diagnosticoEfectivo,
        sesion: {
          nivelNatural,
          nivelActualLargos: pigmentoArtificial ? nivelLargos : undefined,
          pigmentoArtificial,
          nivelObjetivo,
          temperatura,
          marcaId: marcaId || undefined,
        },
        carta,
        // Los prerrequisitos legales solo aplican cuando la ruta es
        // decoloración; el motor los filtra junto al resto de guardarraíles.
        bloqueosLegales: pigmentoArtificial && nivelObjetivo > nivelLargos
          ? bloqueosLegales
          : [],
      }),
    [diagnosticoEfectivo, nivelNatural, nivelLargos, pigmentoArtificial, nivelObjetivo,
     temperatura, marcaId, carta, bloqueosLegales]
  );

  // La fórmula editable se re-siembra cada vez que cambia la sugerida.
  useEffect(() => {
    setFormulaEditada(resultado.formula ? { ...resultado.formula } : null);
  }, [resultado.formula]);

  const gateFoto = evaluarCamara({
    contexto: 'registro_servicio_quimico',
    clientaRegistrada: !!clienta,
    firmas: consentimientos,
  });

  const confirmar = async () => {
    if (!clienta || !formulaEditada || !proceso.trim()) return;
    setGuardando(true);
    try {
      let fotoPath: string | undefined;
      if (foto && gateFoto.permitida) {
        fotoPath = await uploadFoto(foto, `color/${clienta.id}/${Date.now()}`);
      }
      await registrarServicioColor({
        clientaId: clienta.id,
        marcaId: marcaId || undefined,
        formulaFinal: formulaEditada,
        guiaRazonamiento: resultado.guia,
        proceso: proceso.trim(),
        fotoResultado: fotoPath,
      });
      showToast('Servicio de color registrado', 'success');
      router.push(`/clientas/${clienta.id}`);
    } catch (e) {
      console.error('[color.registrar]', e);
      showToast('No se pudo registrar el servicio. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── Estados de pantalla ────────────────────────────────────────────────
  if (cargando) {
    return (
      <Marco>
        <p className="v-caps" style={{ textAlign: 'center', padding: 40 }}>Cargando…</p>
      </Marco>
    );
  }

  if (!habilitada) {
    return (
      <Marco>
        <Aviso
          icono={<Lock size={26} />}
          titulo="La calculadora es del plan Pro"
          texto="La colorimetría manual está incluida en el plan Pro. El análisis de color por foto llegará con Pro + IA."
        >
          <Btn variant="primary" onClick={() => router.push('/planes')}>Ver planes</Btn>
        </Aviso>
      </Marco>
    );
  }

  if (!clienta) {
    return (
      <Marco>
        <Aviso
          icono={<Palette size={26} />}
          titulo="Elige una clienta"
          texto="La calculadora no se abre en blanco (CO-02): precarga el diagnóstico vigente de la clienta para calcular sobre SU cabello."
        >
          <Btn variant="primary" onClick={() => router.push('/clientas')}>Ir a clientas</Btn>
        </Aviso>
      </Marco>
    );
  }

  const hayBloqueos = resultado.bloqueos.length > 0;

  return (
    <Marco subtitulo={clienta.nombre}>
      {/* ── Entradas de sesión ──────────────────────────────────────────── */}
      <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="v-caps" style={{ marginBottom: 10 }}>Lectura de la base</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <SelectorNivel label="Nivel natural (raíz)" valor={nivelNatural} onChange={setNivelNatural} />
          <SelectorNivel label="Nivel objetivo" valor={nivelObjetivo} onChange={setNivelObjetivo} />
        </div>

        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 12, marginBottom: 12, cursor: 'pointer',
            background: pigmentoArtificial ? 'var(--secondary-pale)' : 'var(--bg)',
            border: `1px solid ${pigmentoArtificial ? 'rgba(138, 90, 46, 0.3)' : 'var(--border-soft)'}`,
          }}
        >
          <input
            type="checkbox"
            checked={pigmentoArtificial}
            onChange={(e) => setPigmentoArtificial(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--text-main)' }}>
            Hay pigmento artificial en medios y puntas
          </span>
        </label>

        {pigmentoArtificial && (
          <div style={{ marginBottom: 12 }}>
            <SelectorNivel label="Nivel actual de los largos" valor={nivelLargos} onChange={setNivelLargos} />
          </div>
        )}

        {diagnostico.canasPorPrecisar && (
          <SelectorTramoCanas valor={canasAltas} onChange={setCanasAltas} />
        )}

        <div style={{ marginBottom: 12 }}>
          <span className="v-caps">Temperatura del objetivo</span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {TEMPERATURAS.map(({ v, label }) => {
              const on = temperatura === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTemperatura(v)}
                  style={{
                    flex: 1, padding: '9px 8px', borderRadius: 12, fontSize: 12,
                    fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    background: on ? 'var(--primary-pale)' : 'var(--bg-card)',
                    color: on ? 'var(--primary)' : 'var(--text-secondary)',
                    border: `1px solid ${on ? 'rgba(45, 90, 39, 0.3)' : 'var(--border-soft)'}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-caps">Marca del inventario</span>
          <select
            value={marcaId}
            onChange={(e) => setMarcaId(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
              outline: 'none', fontSize: 13, background: 'var(--bg-card)',
              fontFamily: 'var(--font-sans)', color: 'var(--text-main)', width: '100%',
            }}
          >
            <option value="">Sin marca — cálculo orientativo</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          {marcas.length === 0 && (
            <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Activa las marcas de tu inventario en Configuración → Marcas de tu salón.
            </span>
          )}
        </label>
      </section>

      {/* ── Bloqueos: la calculadora NO muestra fórmula ─────────────────── */}
      {hayBloqueos && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {resultado.bloqueos.map((b) => (
            <article
              key={b.codigo}
              style={{
                padding: 14, borderRadius: 14,
                background: '#FCEEEE', border: '1px solid rgba(178,58,58,0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ShieldAlert size={16} style={{ color: '#7A1F1F' }} />
                <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15, color: '#7A1F1F' }}>
                  {b.titulo}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#7A1F1F', lineHeight: 1.5 }}>{b.mensaje}</p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-main)', lineHeight: 1.5 }}>
                <strong>Camino previo:</strong> {b.caminoPrevio}
                {b.reevaluarEnSemanas && ` Reevaluación bloqueada por ${b.reevaluarEnSemanas} semanas.`}
              </p>
              {/* Protocolo CO-09: se muestra VERBATIM, sin reescribir. */}
              {b.textoVerbatim && (
                <blockquote
                  style={{
                    margin: '10px 0 0', padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.6)', borderLeft: '3px solid #7A1F1F',
                    fontSize: 12, lineHeight: 1.55, color: 'var(--text-main)', fontStyle: 'italic',
                  }}
                >
                  {b.textoVerbatim}
                </blockquote>
              )}
              {(b.codigo === 'parche_sensibilidad' || b.codigo === 'consentimiento_quimico') && (
                <Link
                  href={`/clientas/${clienta.id}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10,
                    fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none',
                  }}
                >
                  Resolver en la ficha de {clienta.nombre} <ChevronRight size={12} />
                </Link>
              )}
            </article>
          ))}
        </section>
      )}

      {/* ── Guía de razonamiento técnico ────────────────────────────────── */}
      {!faltaPrecisarCanas && resultado.guia && (
        <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={14} style={{ color: 'var(--primary)' }} />
            <div className="v-caps">Guía de razonamiento técnico</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Dato etiqueta="Niveles a mover" valor={String(resultado.guia.nivelesAMover)} />
            <Dato etiqueta="Fondo esperado" valor={resultado.guia.fondoEsperado} />
            <Dato etiqueta="Acción" valor={resultado.guia.accionSobreFondo} />
            <Dato etiqueta="Reflejo LatAm" valor={resultado.guia.denominacionLatam} mono />
          </div>

          <p
            style={{
              margin: '0 0 10px', padding: '9px 11px', borderRadius: 10,
              background: 'var(--primary-pale)', fontSize: 12, lineHeight: 1.5,
              color: 'var(--primary)',
            }}
          >
            {resultado.guia.neutralizacion}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resultado.guia.pasos.map((p) => (
              <div key={p.regla} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span
                  style={{
                    flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 9.5,
                    fontWeight: 700, color: 'var(--secondary-deep)',
                    background: 'var(--secondary-pale)', borderRadius: 999, padding: '2px 7px',
                  }}
                >
                  {p.regla}
                </span>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Advertencias ────────────────────────────────────────────────── */}
      {resultado.advertencias.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {resultado.advertencias.map((a) => (
            <div
              key={a.codigo}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px',
                borderRadius: 12, background: 'var(--treat-recon-bg)',
                border: '1px solid rgba(212, 130, 10, 0.25)',
              }}
            >
              <Info size={14} style={{ color: 'var(--treat-recon-color)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--treat-recon-color)', lineHeight: 1.5 }}>
                {a.mensaje}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* ── Plan multi-sesión (CO-10) ───────────────────────────────────── */}
      {!faltaPrecisarCanas && resultado.planMultiSesion && (
        <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Layers size={14} style={{ color: 'var(--secondary-deep)' }} />
            <div className="v-caps">Plan multi-sesión por etapas</div>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {resultado.planMultiSesion.motivo}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resultado.planMultiSesion.etapas.map((e) => (
              <article
                key={e.numero}
                style={{
                  padding: 12, borderRadius: 12, background: 'var(--bg)',
                  borderLeft: '3px solid var(--secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{e.titulo}</strong>
                  {e.fondoIntermedio && <Chip tone="gold">Fondo: {e.fondoIntermedio}</Chip>}
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                  {e.acciones.map((a, i) => (
                    <li key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a}</li>
                  ))}
                </ul>
                {e.tratamientoIntermedio && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--primary)' }}>
                    Entre sesiones: {e.tratamientoIntermedio}
                    {e.esperaSemanas && ` · esperar ${e.esperaSemanas} semanas`}
                  </p>
                )}
              </article>
            ))}
          </div>
          {flags.app_clientas && (
            <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Hitos para el Pasaporte Capilar: {resultado.planMultiSesion.hitosPasaporte.length} fotos de cierre.
            </p>
          )}
        </section>
      )}

      {/* ── Fórmula sugerida, 100 % editable ────────────────────────────── */}
      {!faltaPrecisarCanas && formulaEditada && (
        <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="v-caps">Fórmula sugerida</div>
            <Chip tone={formulaEditada.origen === 'carta_marca' ? 'green' : 'ghost'}>
              {formulaEditada.origen === 'carta_marca' ? 'Carta de marca' : 'Orientativo'}
            </Chip>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
            Editable en gramos y volúmenes: Velli orienta, tú decides y ejecutas.
          </p>

          {formulaEditada.componentes.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-main)' }}>{c.descripcion}</div>
                {c.notaRegla && (
                  <div style={{ fontSize: 10, color: 'var(--secondary-deep)', marginTop: 1 }}>{c.notaRegla}</div>
                )}
              </div>
              <div style={{ width: 96, flexShrink: 0 }}>
                <Input
                  label="gramos"
                  type="number"
                  value={String(c.gramos)}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    setFormulaEditada((f) => f && {
                      ...f,
                      componentes: f.componentes.map((x, j) => (j === i ? { ...x, gramos: g } : x)),
                    });
                  }}
                />
              </div>
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-caps">Volumen</span>
              <select
                value={formulaEditada.volumen}
                disabled={formulaEditada.volumenBloqueado}
                onChange={(e) =>
                  setFormulaEditada((f) => f && { ...f, volumen: Number(e.target.value) as Volumen })
                }
                style={{
                  padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                  fontSize: 13, background: formulaEditada.volumenBloqueado ? 'var(--bg)' : 'var(--bg-card)',
                  color: 'var(--text-main)', width: '100%',
                  cursor: formulaEditada.volumenBloqueado ? 'not-allowed' : 'pointer',
                }}
              >
                {[10, 20, 30, 40].map((v) => (
                  <option key={v} value={v}>{v} vol</option>
                ))}
              </select>
            </label>
            <Input
              label="Proporción"
              value={formulaEditada.proporcion}
              onChange={(e) => setFormulaEditada((f) => f && { ...f, proporcion: e.target.value })}
            />
          </div>

          {/* CO-05: el candado de 20 vol no se puede levantar desde la UI. */}
          {formulaEditada.volumenBloqueado && (
            <p
              style={{
                margin: '8px 0 0', padding: '9px 11px', borderRadius: 10,
                background: 'var(--treat-recon-bg)', fontSize: 11,
                color: 'var(--treat-recon-color)', lineHeight: 1.5,
              }}
            >
              <Lock size={11} style={{ display: 'inline', verticalAlign: -1 }} />{' '}
              {formulaEditada.volumenMotivo}
            </p>
          )}

          <div style={{ marginTop: 10 }}>
            <Input
              label="Tiempo de pausa"
              value={formulaEditada.tiempoPausa}
              onChange={(e) => setFormulaEditada((f) => f && { ...f, tiempoPausa: e.target.value })}
            />
          </div>
        </section>
      )}

      {/* ── Checklist de seguridad ──────────────────────────────────────── */}
      <section className="v-card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <ListChecks size={14} style={{ color: 'var(--primary)' }} />
          <div className="v-caps">Checklist de seguridad</div>
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {resultado.checklistSeguridad.map((c, i) => (
            <li key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c}</li>
          ))}
        </ul>
      </section>

      {/* ── Confirmación y registro ─────────────────────────────────────── */}
      {!hayBloqueos && !faltaPrecisarCanas && formulaEditada && (
        <section className="v-card" style={{ padding: 14, marginBottom: 24 }}>
          <div className="v-caps" style={{ marginBottom: 10 }}>Registrar el servicio</div>
          <div style={{ marginBottom: 10 }}>
            <Input
              label="Proceso aplicado *"
              value={proceso}
              onChange={(e) => setProceso(e.target.value)}
              placeholder="Ej: retoque de raíz + matización de medios y puntas"
            />
          </div>

          {/* Foto del resultado: pasa por el gating de consentimiento. */}
          {gateFoto.permitida ? (
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderRadius: 12, border: '1px dashed var(--border-strong)',
                cursor: 'pointer', background: 'var(--bg)',
              }}
            >
              <Camera size={16} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {foto ? 'Foto del resultado cargada' : 'Agregar foto del resultado'}
              </span>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
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
                padding: '12px 14px', borderRadius: 12,
                background: 'var(--treat-recon-bg)', border: '1px solid rgba(212, 130, 10, 0.25)',
              }}
            >
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--treat-recon-color)', lineHeight: 1.5 }}>
                La foto del resultado es registro fotográfico de un servicio químico: requiere el
                consentimiento de imágenes firmado y vigente de {clienta.nombre}.
              </p>
              <div style={{ marginTop: 10 }}>
                <Btn variant="soft" size="sm" onClick={() => setFirmando(true)}>
                  Firmar consentimiento de imágenes
                </Btn>
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              icon={<Check size={15} />}
              disabled={!proceso.trim() || guardando}
              onClick={confirmar}
            >
              {guardando ? 'Registrando…' : 'Confirmar y registrar en el historial'}
            </Btn>
          </div>
        </section>
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
      <InnerHeader
        title="Calculadora de color"
        eyebrow={subtitulo ?? 'Colorimetría'}
        backHref="/clientas"
      />
      <main style={{ maxWidth: 768, margin: '0 auto', padding: '14px 16px' }}>{children}</main>
    </div>
  );
}

function Aviso({
  icono, titulo, texto, children,
}: {
  icono: React.ReactNode; titulo: string; texto: string; children?: React.ReactNode;
}) {
  return (
    <div className="v-card" style={{ padding: 24, textAlign: 'center', marginTop: 20 }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 10 }}>{icono}</div>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--text-main)' }}>
        {titulo}
      </h2>
      <p style={{ margin: '8px auto 16px', maxWidth: 380, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {texto}
      </p>
      {children}
    </div>
  );
}

function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {etiqueta}
      </div>
      <div
        style={{
          fontSize: 13, color: 'var(--text-main)', marginTop: 2,
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          textTransform: mono ? 'none' : 'capitalize',
        }}
      >
        {valor}
      </div>
    </div>
  );
}

function SelectorNivel({
  label, valor, onChange,
}: {
  label: string; valor: NivelTono; onChange: (v: NivelTono) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="v-caps">{label}</span>
      <select
        value={valor}
        onChange={(e) => onChange(Number(e.target.value) as NivelTono)}
        style={{
          padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
          outline: 'none', fontSize: 13, background: 'var(--bg-card)',
          fontFamily: 'var(--font-sans)', color: 'var(--text-main)', width: '100%',
        }}
      >
        {NIVELES.map((n) => (
          <option key={n} value={n}>{n} · {filaAltura(n).nombre}</option>
        ))}
      </select>
    </label>
  );
}

export default function CalculadoraColorPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="v-caps">Cargando…</p>
        </div>
      }
    >
      <CalculadoraContent />
    </Suspense>
  );
}
