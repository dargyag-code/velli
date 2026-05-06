'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Calendar, Check, Droplets, Leaf, Zap, Star,
  Clock, AlertCircle, FileText, Save, Camera, X as XIcon,
  Moon, Wind, ShoppingBag, Home as HomeIcon, ChevronRight,
} from 'lucide-react';
import { Consulta, Clienta, WizardData } from '@/lib/types';
import {
  getTratamientoBg, getTratamientoTextColor, getTratamientoBorderColor,
  formatDate, addWeeks, todayISO, getRizoLabel,
} from '@/lib/utils';
import { getTratamientoPrincipalExplicacion } from '@/lib/diagnosticEngine';
import { Btn, Chip, type ChipTone } from '@/components/v2';
import { vibracionConfirmacion, vibracionSutil } from '@/lib/haptics';

interface Props {
  consulta: Consulta;
  clienta: Clienta | null;
  wizardData: WizardData;
  onSave: (
    proximaCita: string,
    notas: string,
    esBorrador: boolean,
    fotoAntes?: string,
    fotoDespues?: string,
    estrellas?: number
  ) => Promise<string>;
  saving: boolean;
}

const TratamientoIcon = ({ t, size = 14 }: { t: string; size?: number }) => {
  const lower = t.toLowerCase();
  if (lower.includes('hidratac')) return <Droplets size={size} />;
  if (lower.includes('nutrici')) return <Leaf size={size} />;
  if (lower.includes('reconstru') || lower.includes('proteína') || lower.includes('proteina'))
    return <Zap size={size} />;
  return <Star size={size} />;
};

function tratamientoChipTone(t: string): ChipTone {
  const lower = t.toLowerCase();
  if (lower.includes('hidratac')) return 'blue';
  if (lower.includes('nutrici')) return 'green';
  if (lower.includes('reconstru') || lower.includes('proteína') || lower.includes('proteina'))
    return 'amber';
  if (lower.includes('repolariz')) return 'purple';
  return 'ghost';
}

// ── SectionCard editorial ──────────────────────────────────────────────────
function SectionCard({
  num,
  eyebrow,
  title,
  children,
  action,
}: {
  num?: string;
  eyebrow?: string;
  title: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          margin: '0 0 10px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {num && <span className="v-num" style={{ fontSize: 10 }}>· {num}</span>}
            {eyebrow && <span className="v-caps">{eyebrow}</span>}
          </div>
          <h2
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-serif)',
              fontSize: 18,
              lineHeight: 1.15,
              letterSpacing: '-0.015em',
              color: 'var(--text-main)',
            }}
          >
            {title}
          </h2>
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      <div className="v-card" style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

// Determina si hay suficientes detalles para diagnóstico "completo"
function hasDetallesCompletos(data: WizardData): boolean {
  return (
    data.estadoCueroCabelludo.length > 0 ||
    !!data.estadoPuntas ||
    data.quimicos.length > 0 ||
    !!data.frecuenciaLavado
  );
}

export default function PasoPlan({ consulta, clienta, wizardData, onSave, saving }: Props) {
  const router = useRouter();
  const { resultado } = consulta;
  const [proximaCita, setProximaCita] = useState(
    consulta.proximaCita || addWeeks(todayISO(), 4)
  );
  const [notas, setNotas] = useState(consulta.notasEstilista || '');
  const [fotoAntes, setFotoAntes] = useState<string | undefined>(consulta.fotoAntes);
  const [fotoDespues, setFotoDespues] = useState<string | undefined>(consulta.fotoDespues);
  const fotoAntesRef = useRef<HTMLInputElement>(null);
  const fotoDespuesRef = useRef<HTMLInputElement>(null);
  const [estrellas, setEstrellas] = useState<number>(0);
  const [savedOverlay, setSavedOverlay] = useState<{ tipo: 'express' | 'completo'; clientaId: string } | null>(null);

  const handleFotoAntes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoAntes(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFotoDespues = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoDespues(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const tieneDetalles = hasDetallesCompletos(wizardData);

  const handleGuardar = async (esBorrador: boolean) => {
    vibracionConfirmacion();
    const clientaId = await onSave(
      proximaCita,
      notas,
      esBorrador,
      fotoAntes,
      fotoDespues,
      estrellas > 0 ? (estrellas as 1 | 2 | 3 | 4 | 5) : undefined
    );
    setSavedOverlay({ tipo: esBorrador ? 'express' : 'completo', clientaId });
  };

  useEffect(() => {
    if (!savedOverlay) return;
    const t = setTimeout(() => {
      if (savedOverlay.clientaId) router.push(`/clientas/${savedOverlay.clientaId}`);
    }, 2000);
    return () => clearTimeout(t);
  }, [savedOverlay, router]);

  // Pillars sumario
  const pillars = [
    { ic: <Droplets size={16} />, l: 'Hidratación', show: consulta.balanceHP === 'hidratacion' || resultado.tratamientoPrincipal.toLowerCase().includes('hidrat') },
    { ic: <Leaf size={16} />, l: 'Nutrición', show: consulta.balanceHP === 'nutricion' || resultado.tratamientoPrincipal.toLowerCase().includes('nutri') },
    { ic: <Zap size={16} />, l: 'Reconst.', show: consulta.balanceHP === 'proteina' || resultado.tratamientoPrincipal.toLowerCase().includes('reconstr') || resultado.tratamientoPrincipal.toLowerCase().includes('proteína') || resultado.tratamientoPrincipal.toLowerCase().includes('proteina') },
  ];
  const activePillars = pillars.filter((p) => p.show);
  const showPillars = activePillars.length > 0 ? activePillars : pillars;

  return (
    <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 12, marginInline: -16 }}>
      {/* ═══ Editorial cover ═══════════════════════════════════════════════ */}
      <section
        className="v-grain"
        style={{
          position: 'relative',
          padding: '24px 18px 28px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #14241A 0%, #25401E 60%, #2D5A27 100%)',
          color: '#F5EDDC',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            className="v-num"
            style={{ color: 'rgba(232, 194, 144, 0.95)', fontSize: 9.5 }}
          >
            VELLI · DIAGNÓSTICO {formatDate(consulta.fecha).toUpperCase()}
          </div>
          {clienta && (
            <div
              className="v-num"
              style={{ color: 'rgba(232, 194, 144, 0.95)', fontSize: 9.5 }}
            >
              FOLIO · {consulta.id.slice(0, 8).toUpperCase()}
            </div>
          )}
        </div>

        <h1
          style={{
            margin: '14px 0 4px',
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            color: '#fff',
          }}
        >
          {clienta?.nombre ?? wizardData.nombre ?? 'Diagnóstico'}
        </h1>
        <h2
          style={{
            margin: '0 0 14px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 32,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            color: '#E8C290',
          }}
        >
          plan de cuidado
        </h2>
        <div className="v-rule" style={{ marginBottom: 12 }} />
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'rgba(245, 237, 220, 0.85)',
            maxWidth: 360,
          }}
        >
          {consulta.tipoRizoPrincipal && (
            <>
              Cabello{' '}
              <strong style={{ color: '#E8C290' }}>
                tipo {consulta.tipoRizoPrincipal} · {getRizoLabel(consulta.tipoRizoPrincipal)}
              </strong>
              .{' '}
            </>
          )}
          {[
            consulta.porosidad && `porosidad ${consulta.porosidad}`,
            consulta.densidad && `densidad ${consulta.densidad}`,
            consulta.elasticidad && `elasticidad ${consulta.elasticidad}`,
          ]
            .filter(Boolean)
            .join(', ')}
          {consulta.balanceHP && (
            <>
              {' '}— balance{' '}
              <strong style={{ color: '#E8C290' }}>{consulta.balanceHP}</strong>.
            </>
          )}
        </p>

        {/* Three pillars row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${showPillars.length}, 1fr)`,
            gap: 10,
            marginTop: 20,
          }}
        >
          {showPillars.map((p) => (
            <div
              key={p.l}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(232, 194, 144, 0.18)',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#E8C290', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                {p.ic}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  color: 'rgba(232, 194, 144, 0.85)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                }}
              >
                {p.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ padding: '22px 16px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* ═══ Tratamiento principal ════════════════════════════════════════ */}
        <section style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="v-num" style={{ fontSize: 10 }}>· 01</span>
                <span className="v-caps">Sesión inaugural</span>
              </div>
              <h2
                style={{
                  margin: '4px 0 0',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 22,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)',
                }}
              >
                {resultado.tratamientoPrincipal}
              </h2>
            </div>
            <Chip tone={tratamientoChipTone(resultado.tratamientoPrincipal)}>
              {resultado.intervaloSugerido?.split(' ')[0] ?? 'Plan'}
            </Chip>
          </div>
          <article
            className="v-card-hi"
            style={{ padding: 16, position: 'relative', overflow: 'hidden' }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 4,
                height: '100%',
                background: getTratamientoTextColor(resultado.tratamientoPrincipal),
              }}
            />
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--text-main)',
                lineHeight: 1.5,
              }}
            >
              {getTratamientoPrincipalExplicacion(resultado.tratamientoPrincipal, wizardData)}
            </p>

            {resultado.tratamientosAdicionales.length > 0 && (
              <>
                <div className="v-rule" style={{ margin: '14px 0 10px' }} />
                <div className="v-caps" style={{ marginBottom: 8 }}>
                  Adicionales · {resultado.tratamientosAdicionales.length}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {resultado.tratamientosAdicionales.map((t, i) => (
                    <li key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          minWidth: 22,
                          paddingTop: 2,
                        }}
                      >
                        0{i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)' }}>{t}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        </section>

        {/* ═══ Estado capilar (chips) ═══════════════════════════════════════ */}
        {(consulta.balanceHP || consulta.problemas.length > 0) && (
          <SectionCard num="02" eyebrow="Lectura" title="Estado capilar">
            {consulta.balanceHP && (
              <div style={{ marginBottom: consulta.problemas.length > 0 ? 10 : 0 }}>
                <Chip
                  tone={
                    consulta.balanceHP === 'hidratacion' ? 'blue'
                      : consulta.balanceHP === 'nutricion' ? 'green'
                        : consulta.balanceHP === 'proteina' ? 'amber'
                          : 'purple'
                  }
                  dot
                >
                  {consulta.balanceHP === 'hidratacion'
                    ? 'Necesita hidratación'
                    : consulta.balanceHP === 'nutricion'
                      ? 'Necesita nutrición'
                      : consulta.balanceHP === 'proteina'
                        ? 'Necesita proteína'
                        : 'En mantenimiento'}
                </Chip>
              </div>
            )}
            {consulta.problemas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {consulta.problemas.map((p) => (
                  <Chip key={p} tone="ghost">{p}</Chip>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ═══ Cronograma 4 semanas ═════════════════════════════════════════ */}
        <SectionCard num="03" eyebrow="4 semanas" title="Cronograma">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 4 }}>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 22,
                left: 22,
                right: 22,
                height: 1,
                background: 'var(--border)',
                zIndex: 0,
              }}
            />
            {[
              { sem: 'SEM 1', t: resultado.cronograma.semana1 },
              { sem: 'SEM 2', t: resultado.cronograma.semana2 },
              { sem: 'SEM 3', t: resultado.cronograma.semana3 },
              { sem: 'SEM 4', t: resultado.cronograma.semana4 },
            ].map(({ sem, t }) => {
              const bg = getTratamientoBg(t);
              const color = getTratamientoTextColor(t);
              return (
                <div key={sem} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: bg,
                      border: `1.5px solid ${color}`,
                      color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: 'var(--shadow-xs)',
                    }}
                  >
                    <TratamientoIcon t={t} size={16} />
                  </div>
                  <span
                    className="v-num"
                    style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                  >
                    {sem}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 11,
                      color,
                      textAlign: 'center',
                      lineHeight: 1.15,
                      letterSpacing: '-0.005em',
                      padding: '0 2px',
                    }}
                  >
                    {t.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ═══ Técnica de definición ════════════════════════════════════════ */}
        <SectionCard num="04" eyebrow="Técnica" title={resultado.tecnicaDefinicion}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {resultado.tecnicaDescripcion}
          </p>
        </SectionCard>

        {/* ═══ Productos ═══════════════════════════════════════════════════ */}
        {resultado.productosPonto.length > 0 && (
          <SectionCard num="05" eyebrow="Productos" title="Recomendados">
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resultado.productosPonto.map((producto, i) => {
                const borderColor = getTratamientoBorderColor(resultado.tratamientoPrincipal);
                return (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'var(--bg)',
                      borderLeft: `3px solid ${borderColor}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        minWidth: 22,
                        paddingTop: 2,
                      }}
                    >
                      0{i + 1}
                    </span>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-main)', lineHeight: 1.4, flex: 1 }}>
                      {producto}
                    </p>
                  </li>
                );
              })}
            </ol>
          </SectionCard>
        )}

        {/* ═══ Cuidado en casa ═════════════════════════════════════════════ */}
        {(resultado.cuidadoCasa.diaLavado.length > 0 ||
          resultado.cuidadoCasa.nocturno.length > 0 ||
          resultado.cuidadoCasa.refresh.length > 0 ||
          resultado.cuidadoCasa.evitar.length > 0) && (
          <SectionCard num="06" eyebrow="Casa" title="Cuidado entre visitas">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {resultado.cuidadoCasa.diaLavado.length > 0 && (
                <CasaBlock icon={<Droplets size={12} />} label="Día de lavado" color="var(--treat-hidrat-color)" tips={resultado.cuidadoCasa.diaLavado} />
              )}
              {resultado.cuidadoCasa.nocturno.length > 0 && (
                <CasaBlock icon={<Moon size={12} />} label="Rutina nocturna" color="var(--treat-repol-color)" tips={resultado.cuidadoCasa.nocturno} />
              )}
              {resultado.cuidadoCasa.refresh.length > 0 && (
                <CasaBlock icon={<Wind size={12} />} label="Días de refresh" color="var(--primary)" tips={resultado.cuidadoCasa.refresh} />
              )}
              {resultado.cuidadoCasa.evitar.length > 0 && (
                <CasaBlock icon={<AlertCircle size={12} />} label="Qué evitar" color="var(--danger)" tips={resultado.cuidadoCasa.evitar} />
              )}
            </div>
          </SectionCard>
        )}

        {/* ═══ Notas adicionales ═══════════════════════════════════════════ */}
        {resultado.notasAdicionales.length > 0 && (
          <section
            style={{
              margin: '0 0 18px',
              padding: '16px 18px',
              borderLeft: '3px solid var(--secondary)',
              background: 'var(--secondary-pale)',
            }}
          >
            <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>Nota clínica</div>
            <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {resultado.notasAdicionales.map((n, i) => (
                <li
                  key={i}
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 13.5,
                    lineHeight: 1.4,
                    color: 'var(--primary-deep)',
                  }}
                >
                  «{n}»
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ═══ Próxima cita ════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="v-caps">Próximo encuentro</div>
              <h2
                style={{
                  margin: '4px 0 0',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 18,
                  lineHeight: 1.1,
                  letterSpacing: '-0.015em',
                }}
              >
                Agendar próxima cita
              </h2>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--primary)',
                letterSpacing: '0.06em',
                fontWeight: 700,
              }}
            >
              {resultado.intervaloSugerido}
            </span>
          </div>
          <article
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'linear-gradient(135deg, var(--primary-deep), var(--primary))',
              color: '#F5EDDC',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Clock size={18} style={{ color: '#E8C290', flexShrink: 0 }} />
            <input
              type="date"
              value={proximaCita}
              onChange={(e) => setProximaCita(e.target.value)}
              min={todayISO()}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(232, 194, 144, 0.25)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#F5EDDC',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </article>
        </section>

        {/* ═══ Fotos antes/después ═════════════════════════════════════════ */}
        <SectionCard num="07" eyebrow="Documentación" title="Fotos del servicio">
          <div style={{ display: 'flex', gap: 12 }}>
            <FotoSlot
              label="ANTES"
              src={fotoAntes}
              onChange={handleFotoAntes}
              onClear={() => {
                setFotoAntes(undefined);
                if (fotoAntesRef.current) fotoAntesRef.current.value = '';
              }}
              inputRef={fotoAntesRef}
            />
            <FotoSlot
              label="DESPUÉS"
              src={fotoDespues}
              onChange={handleFotoDespues}
              onClear={() => {
                setFotoDespues(undefined);
                if (fotoDespuesRef.current) fotoDespuesRef.current.value = '';
              }}
              inputRef={fotoDespuesRef}
            />
          </div>
        </SectionCard>

        {/* ═══ Notas estilista ═════════════════════════════════════════════ */}
        <SectionCard num="08" eyebrow="Anotaciones" title="Para la próxima visita">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: le queda bien el fleco, no le gusta el gel, prefiere productos sin olor fuerte…"
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 12,
              border: '1px solid var(--border)',
              outline: 'none',
              fontSize: 13,
              background: 'var(--bg)',
              resize: 'none',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-main)',
              lineHeight: 1.4,
            }}
          />
        </SectionCard>

        {/* ═══ Satisfacción ════════════════════════════════════════════════ */}
        <SectionCard num="09" eyebrow="Cierre" title="¿Cómo quedó la clienta?">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: estrellas > 0 ? 6 : 0 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { vibracionSutil(); setEstrellas(n === estrellas ? 0 : n); }}
                className="active:scale-90 transition-transform"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <Star
                  size={32}
                  fill={n <= estrellas ? 'var(--secondary)' : 'none'}
                  stroke={n <= estrellas ? 'var(--secondary)' : 'var(--border-strong)'}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          {estrellas > 0 && (
            <p
              style={{
                margin: '4px 0 0',
                textAlign: 'center',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--secondary-deep)',
              }}
            >
              {estrellas === 5
                ? '¡Excelente!'
                : estrellas === 4
                  ? 'Muy bien'
                  : estrellas === 3
                    ? 'Bien'
                    : estrellas === 2
                      ? 'Regular'
                      : 'Necesita mejorar'}
            </p>
          )}
        </SectionCard>

        {/* ═══ Botones de guardar ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {tieneDetalles ? (
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handleGuardar(false)}
              disabled={saving}
              icon={
                saving ? (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'pulse-soft 1s linear infinite',
                    }}
                    className="loading-pulse"
                  />
                ) : (
                  <Save size={16} />
                )
              }
            >
              Guardar diagnóstico completo
            </Btn>
          ) : (
            <Btn variant="outline" size="lg" fullWidth disabled icon={<Save size={16} />}>
              Llena los detalles para guardar como completo
            </Btn>
          )}

          <Btn
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => handleGuardar(true)}
            disabled={saving}
            icon={<FileText size={14} />}
            iconRight={<Chip tone="amber" style={{ fontSize: 9.5, padding: '2px 7px' }}>Borrador</Chip>}
          >
            Guardar express
          </Btn>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--text-tertiary)',
          }}
        >
          VELLI · INTELIGENCIA CAPILAR · CONFIDENCIAL
        </div>
      </div>

      {/* ═══ Overlay de éxito ════════════════════════════════════════════════ */}
      {savedOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(20, 36, 26, 0.94)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle
              cx="40" cy="40" r="32"
              stroke="#E8C290" strokeWidth="3"
              strokeDasharray="210"
              strokeLinecap="round"
              className="animate-draw-circle"
            />
            <polyline
              points="24,40 34,52 56,28"
              stroke="#E8C290" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="60"
              className="animate-draw-check"
            />
          </svg>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              fontStyle: 'italic',
              color: '#fff',
              marginTop: 18,
              letterSpacing: '-0.01em',
            }}
          >
            {savedOverlay.tipo === 'express' ? 'Borrador guardado' : 'Diagnóstico guardado'}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'rgba(232, 194, 144, 0.85)',
              marginTop: 8,
            }}
          >
            REDIRIGIENDO AL PERFIL…
          </p>
        </div>
      )}
    </div>
  );
}

// ── CasaBlock ──────────────────────────────────────────────────────────────
function CasaBlock({
  icon,
  label,
  color,
  tips,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  tips: string[];
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span
          className="v-caps"
          style={{ color, letterSpacing: '0.14em' }}
        >
          {label}
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tips.map((tip, i) => (
          <li
            key={i}
            style={{
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              position: 'relative',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: -14,
                top: 8,
                width: 6,
                height: 1,
                background: 'var(--border-strong)',
              }}
            />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── FotoSlot ──────────────────────────────────────────────────────────────
function FotoSlot({
  label,
  src,
  onChange,
  onClear,
  inputRef,
}: {
  label: string;
  src?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="v-caps" style={{ marginBottom: 6 }}>{label}</div>
      {src ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 12 }}
          />
          <button
            type="button"
            onClick={onClear}
            aria-label="Quitar foto"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(20, 36, 26, 0.7)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <XIcon size={12} style={{ color: '#fff' }} />
          </button>
        </div>
      ) : (
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 110,
            borderRadius: 12,
            border: '1px dashed var(--border-strong)',
            cursor: 'pointer',
            background: 'var(--bg)',
            gap: 4,
          }}
        >
          <Camera size={20} style={{ color: 'var(--text-tertiary)' }} />
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.06em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            AGREGAR
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onChange}
          />
        </label>
      )}
    </div>
  );
}
