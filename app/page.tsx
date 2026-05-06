'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, CalendarDays, TrendingUp, BarChart2, Search,
  ChevronRight, Camera, Sparkles, AlertCircle, FileText,
} from 'lucide-react';
import {
  Masthead, StatTile, SectionLabel, BottomNavV2,
  Btn, Chip, AvatarV2, toneFromTipoRizo,
} from '@/components/v2';
import Onboarding from '@/components/dashboard/Onboarding';
import {
  getAllClientas, getRecentClientas, getStatsThisMonth,
  getMostFrequentTratamiento, getNextCita,
  getClientasInactivas, getConsultasBorrador, getLastTratamientosMap,
} from '@/lib/db';
import { getProfile, type Profile } from '@/lib/profile';
import { Clienta, Consulta } from '@/lib/types';
import { formatDate, getRizoLabel } from '@/lib/utils';

const SPARK_LINES = {
  green: '0,15 14,11 28,13 42,7 56,9 70,5 85,8 100,2',
  gold: '0,12 14,14 28,9 42,11 56,7 70,8 85,6 100,4',
  blue: '0,16 14,15 28,12 42,14 56,10 70,12 85,7 100,5',
  goldDown: '0,8 14,10 28,9 42,12 56,11 70,14 85,12 100,15',
} as const;

function todayLabel(): { caps: string; serif: string; full: string } {
  const d = new Date();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dia = days[d.getDay()];
  const num = String(d.getDate()).padStart(2, '0');
  const mes = months[d.getMonth()];
  return {
    caps: `${dia} · ${num} ${mes}`,
    serif: 'Tu día',
    full: `${dia} ${num} ${mes}`,
  };
}

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [recentClientas, setRecentClientas] = useState<Clienta[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    nextCita: null as { nombre: string; fecha: string } | null,
    frecuente: '',
  });
  const [loading, setLoading] = useState(true);
  const [inactivas, setInactivas] = useState<Array<Clienta & { diasInactiva: number }>>([]);
  const [borradores, setBorradores] = useState<Array<{ consulta: Consulta; clienta: Clienta }>>([]);
  const [tratamientosMap, setTratamientosMap] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [all, recent, month, frecuente, next, inact, borr, prof] = await Promise.all([
        getAllClientas(),
        getRecentClientas(8),
        getStatsThisMonth(),
        getMostFrequentTratamiento(),
        getNextCita(),
        getClientasInactivas(45),
        getConsultasBorrador(),
        getProfile().catch(() => null),
      ]);
      setClientas(all);
      setRecentClientas(recent);
      setStats({ total: all.length, thisMonth: month, nextCita: next, frecuente });
      setInactivas(inact.slice(0, 3));
      setBorradores(borr.slice(0, 3));
      setProfile(prof);
      const tMap = await getLastTratamientosMap(recent.map((c) => c.id));
      setTratamientosMap(tMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const searchResults = search
    ? clientas.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()))
    : [];

  const displayClientas = search ? searchResults : recentClientas;
  const isFirstTime = !loading && clientas.length === 0;
  const profileCompleto = !!(profile?.nombre && profile?.nombreNegocio);
  const stylistName = profile?.nombre || '';

  const today = todayLabel();
  const alertCount = inactivas.length + borradores.length;
  const subtitle = stats.nextCita
    ? `Próxima cita: ${stats.nextCita.nombre} · ${formatDate(stats.nextCita.fecha)}.`
    : alertCount > 0
      ? `Tienes ${alertCount} ${alertCount === 1 ? 'pendiente' : 'pendientes'} por atender.`
      : 'Todo en orden. Comienza el día con tu próximo diagnóstico.';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <Masthead name={stylistName || 'Estilista'} subtitle={subtitle} />

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px 120px' }}>

        {isFirstTime ? (
          <Onboarding nombre={profile?.nombre} profileCompleto={profileCompleto} />
        ) : (
          <>
            {/* ── Today summary card · editorial hero ───────────────────── */}
            <section
              className="v-card-hi v-grain"
              style={{ overflow: 'hidden', marginBottom: 22 }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #FBF4EC 0%, #F5EDDC 100%)',
                  padding: '18px 18px 16px',
                  borderBottom: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="v-caps" style={{ color: 'var(--secondary-deep)' }}>
                      {today.caps}
                    </div>
                    <h2
                      style={{
                        margin: '4px 0 0',
                        fontFamily: 'var(--font-serif)',
                        fontSize: 26,
                        letterSpacing: '-0.02em',
                        color: 'var(--primary-deep)',
                        lineHeight: 1.05,
                      }}
                    >
                      {today.serif} <em style={{ color: 'var(--secondary-deep)' }}>en una mirada</em>
                    </h2>
                  </div>
                  <Link href="/agenda" style={{ flexShrink: 0 }}>
                    <Btn size="sm" variant="dark" iconRight={<ChevronRight size={12} />}>
                      Agenda
                    </Btn>
                  </Link>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                {[
                  {
                    label: 'CLIENTAS',
                    value: loading ? '—' : String(stats.total),
                    sub: stats.total === 1 ? '· en tu fichero' : '· en tu fichero',
                  },
                  {
                    label: 'CONSULTAS',
                    value: loading ? '—' : String(stats.thisMonth),
                    sub: '· este mes',
                  },
                  {
                    label: 'PENDIENTES',
                    value: loading ? '—' : String(alertCount),
                    sub: alertCount === 0 ? '· todo al día' : '· por atender',
                  },
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px 14px',
                      borderRight: i < 2 ? '1px solid var(--border-soft)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span className="v-num" style={{ fontSize: 9 }}>{c.label}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 26,
                        lineHeight: 1,
                        color: 'var(--text-main)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {c.value}
                    </span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{c.sub}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Próxima cita · featured (si hay) ─────────────────────── */}
            {stats.nextCita && (
              <>
                <SectionLabel
                  num="01"
                  eyebrow="A continuación"
                  title="Tu próxima clienta"
                  action={
                    <Link href="/agenda">
                      <Btn size="sm" variant="ghost" iconRight={<ChevronRight size={12} />}>
                        Ver agenda
                      </Btn>
                    </Link>
                  }
                />
                <article
                  style={{
                    marginBottom: 24,
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div style={{ display: 'flex' }}>
                    <div
                      className="v-photo v-photo-curly"
                      style={{ width: 110, height: 130, borderRadius: 0, position: 'relative', flexShrink: 0 }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          left: 8,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.85)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {formatDate(stats.nextCita.fecha)}
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minWidth: 0,
                      }}
                    >
                      <div>
                        <div className="v-num" style={{ fontSize: 9.5 }}>
                          {formatDate(stats.nextCita.fecha)}
                        </div>
                        <h3
                          style={{
                            margin: '3px 0 0',
                            fontFamily: 'var(--font-serif)',
                            fontSize: 20,
                            lineHeight: 1.1,
                            letterSpacing: '-0.01em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {stats.nextCita.nombre}
                        </h3>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                          {stats.frecuente && stats.frecuente !== 'Sin datos' && (
                            <Chip tone="blue">{stats.frecuente.split(' ')[0]}</Chip>
                          )}
                          <Chip tone="gold">Próxima</Chip>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <Link href="/diagnostico">
                          <Btn size="sm" variant="primary" icon={<Sparkles size={12} />}>
                            Iniciar diagnóstico
                          </Btn>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              </>
            )}

            {/* ── Quick actions · 2x2 editorial ─────────────────────────── */}
            <SectionLabel num={stats.nextCita ? '02' : '01'} eyebrow="Acciones" title="¿Qué quieres hacer?" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { Icon: Sparkles, label: 'Nuevo diagnóstico', tag: 'IA · 3 min', tone: 'primary', href: '/diagnostico' },
                { Icon: Camera, label: 'Cámara en vivo', tag: 'Tipo de rizo', tone: 'gold', href: '/diagnostico?mode=camera' },
                { Icon: Users, label: 'Mis clientas', tag: `${stats.total} ${stats.total === 1 ? 'activa' : 'activas'}`, tone: 'soft', href: '/clientas' },
                { Icon: BarChart2, label: 'Reportes', tag: 'Mes corriente', tone: 'soft', href: '/reportes' },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="active:scale-[0.98] transition-transform"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                    padding: '14px 14px 12px',
                    textAlign: 'left',
                    background:
                      a.tone === 'primary'
                        ? 'linear-gradient(180deg, #25401E, #14241A)'
                        : a.tone === 'gold'
                          ? 'linear-gradient(180deg, #D8A878, #B47E4D)'
                          : 'var(--bg-card)',
                    color:
                      a.tone === 'primary'
                        ? '#F5EDDC'
                        : a.tone === 'gold'
                          ? '#fff'
                          : 'var(--text-main)',
                    border: a.tone === 'soft' ? '1px solid var(--border-soft)' : 'none',
                    borderRadius: 16,
                    boxShadow: a.tone === 'soft' ? 'var(--shadow-xs)' : 'var(--shadow-sm)',
                    textDecoration: 'none',
                  }}
                >
                  <a.Icon size={18} strokeWidth={1.7} />
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.1 }}>{a.label}</div>
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.65,
                        marginTop: 4,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {a.tag}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* ── Métricas en cifras (sparklines) ───────────────────────── */}
            <SectionLabel num={stats.nextCita ? '03' : '02'} eyebrow="Esta semana" title="Tu salón en números" />
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 100, borderRadius: 18 }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                <StatTile
                  label="CLIENTAS"
                  value={stats.total}
                  suffix="total"
                  accent="green"
                  spark={SPARK_LINES.green}
                />
                <StatTile
                  label="CONSULTAS"
                  value={stats.thisMonth}
                  suffix="/mes"
                  accent="gold"
                  spark={SPARK_LINES.gold}
                />
                <StatTile
                  label="PRÓXIMA"
                  value={stats.nextCita ? formatDate(stats.nextCita.fecha).split(' ').slice(0, 2).join(' ') : '—'}
                  accent="blue"
                  spark={SPARK_LINES.blue}
                />
                <StatTile
                  label="TRATAMIENTO"
                  value={stats.frecuente === 'Sin datos' || !stats.frecuente ? '—' : stats.frecuente.split(' ')[0]}
                  accent="gold"
                  spark={SPARK_LINES.goldDown}
                />
              </div>
            )}

            {/* ── Alertas inteligentes ─────────────────────────────────── */}
            {!loading && (inactivas.length > 0 || borradores.length > 0) && (
              <>
                <SectionLabel
                  num="·"
                  eyebrow="Atención"
                  title="Pendientes por atender"
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {inactivas.map((c) => {
                    const tel = c.telefono?.replace(/\D/g, '');
                    const msg = encodeURIComponent(
                      `Hola ${c.nombre}! 🌿 Han pasado ${c.diasInactiva} días desde tu última visita en Velli Pro. ¿Agendamos tu próxima consulta?`
                    );
                    return (
                      <article
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'var(--secondary-pale)',
                          border: '1px solid rgba(138, 90, 46, 0.18)',
                          borderRadius: 14,
                          padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'rgba(138, 90, 46, 0.12)',
                            color: 'var(--secondary-deep)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AlertCircle size={16} strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-serif)',
                              fontSize: 14,
                              color: 'var(--text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.nombre}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--secondary-deep)' }}>
                            Sin visitas hace {c.diasInactiva} días
                          </p>
                        </div>
                        {tel && (
                          <a
                            href={`https://wa.me/${tel}?text=${msg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ flexShrink: 0, textDecoration: 'none' }}
                          >
                            <Btn size="sm" variant="gold">WhatsApp</Btn>
                          </a>
                        )}
                      </article>
                    );
                  })}
                  {borradores.map(({ consulta, clienta: c }) => (
                    <article
                      key={consulta.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'var(--treat-hidrat-bg)',
                        border: '1px solid rgba(26, 82, 118, 0.15)',
                        borderRadius: 14,
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'rgba(26, 82, 118, 0.10)',
                          color: 'var(--treat-hidrat-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={16} strokeWidth={1.8} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-serif)',
                            fontSize: 14,
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.nombre}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--treat-hidrat-color)' }}>
                          Diagnóstico borrador pendiente
                        </p>
                      </div>
                      <Link href={`/clientas/${c.id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                        <Btn size="sm" variant="primary">Completar</Btn>
                      </Link>
                    </article>
                  ))}
                </div>
              </>
            )}

            {/* ── Búsqueda + clientas recientes ─────────────────────────── */}
            <SectionLabel
              num="·"
              eyebrow="Personas a tu cuidado"
              title={search ? `Resultados · ${searchResults.length}` : 'Clientas recientes'}
              action={
                !search ? (
                  <Link href="/clientas">
                    <Btn size="sm" variant="ghost" iconRight={<ChevronRight size={12} />}>
                      Ver todas
                    </Btn>
                  </Link>
                ) : undefined
              }
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                boxShadow: 'var(--shadow-xs)',
                marginBottom: 14,
              }}
            >
              <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar clienta…"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 13,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 72 }} />
                ))}
              </div>
            ) : displayClientas.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'var(--bg-card)',
                  borderRadius: 16,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'var(--primary-pale)',
                    margin: '0 auto 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={24} style={{ color: 'var(--primary)' }} />
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontSize: 17,
                    color: 'var(--text-main)',
                  }}
                >
                  {search ? 'Sin resultados' : 'Aún no tienes clientas'}
                </p>
                <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {search ? `No se encontró "${search}"` : '¡Comienza tu primera consulta!'}
                </p>
                {!search && (
                  <Link href="/diagnostico">
                    <Btn variant="primary" size="md" icon={<Sparkles size={14} />}>
                      Primera consulta
                    </Btn>
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {displayClientas.map((c) => {
                  const tone = toneFromTipoRizo(c.tipoRizoPrincipal);
                  const trat = tratamientosMap[c.id];
                  return (
                    <Link
                      key={c.id}
                      href={`/clientas/${c.id}`}
                      className="stagger-item"
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      <article
                        style={{
                          background: 'var(--bg-card)',
                          borderRadius: 16,
                          padding: 14,
                          boxShadow: 'var(--shadow-xs)',
                          border: '1px solid var(--border-soft)',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <AvatarV2 nombre={c.nombre} tone={tone} size="md" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                            <h3
                              style={{
                                margin: 0,
                                fontFamily: 'var(--font-serif)',
                                fontSize: 16,
                                color: 'var(--text-main)',
                                letterSpacing: '-0.005em',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {c.nombre}
                            </h3>
                            {c.ultimaVisita && (
                              <span className="v-num" style={{ fontSize: 9.5, flexShrink: 0 }}>
                                {formatDate(c.ultimaVisita)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            {c.tipoRizoPrincipal && (
                              <Chip tone="ghost" style={{ padding: '2px 7px', fontSize: 9.5 }}>
                                {getRizoLabel(c.tipoRizoPrincipal)}
                              </Chip>
                            )}
                            {c.totalVisitas > 0 && (
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                · {c.totalVisitas} {c.totalVisitas === 1 ? 'visita' : 'visitas'}
                              </span>
                            )}
                            {trat && (
                              <Chip
                                tone={
                                  trat.toLowerCase().includes('hidrat') ? 'blue'
                                  : trat.toLowerCase().includes('reconstr') ? 'amber'
                                  : trat.toLowerCase().includes('repolariz') ? 'purple'
                                  : 'green'
                                }
                                style={{ marginLeft: 'auto', fontSize: 9.5 }}
                              >
                                {trat.split(' ')[0]}
                              </Chip>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      </article>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ── Pull-quote editorial ──────────────────────────────────── */}
            {!loading && !search && (
              <section
                style={{
                  marginTop: 24,
                  padding: '20px 18px',
                  borderRadius: 20,
                  background: 'var(--secondary-pale)',
                  border: '1px solid rgba(138, 90, 46, 0.18)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: 12,
                    fontFamily: 'var(--font-serif)',
                    fontSize: 80,
                    color: 'rgba(138, 90, 46, 0.18)',
                    lineHeight: 1,
                  }}
                >
                  “
                </div>
                <div className="v-caps" style={{ color: 'var(--secondary-deep)', marginBottom: 8 }}>
                  Sabiduría del oficio
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 17,
                    lineHeight: 1.35,
                    color: 'var(--primary-deep)',
                  }}
                >
                  «El cabello es el mapa de un cuero cabelludo bien cuidado. Lee primero, corta después.»
                </p>
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    color: 'var(--secondary-deep)',
                    letterSpacing: '0.1em',
                  }}
                >
                  <span>— MAESTRA TRICÓLOGA</span>
                  <span>VELLI · WEEKLY</span>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNavV2 />
    </div>
  );
}
