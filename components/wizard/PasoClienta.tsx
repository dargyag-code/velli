'use client';
import React, { useState, useEffect } from 'react';
import { Search, Check, X } from 'lucide-react';
import { WizardData, Clienta } from '@/lib/types';
import { getAllClientas } from '@/lib/db';
import { AvatarV2, toneFromTipoRizo, Chip } from '@/components/v2';
import { vibracionSutil } from '@/lib/haptics';

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export default function PasoClienta({ data, onChange, errors }: Props) {
  const [clientas, setClientas] = useState<Clienta[]>([]);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    getAllClientas().then(setClientas);
  }, []);

  const filtered = clientas.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const selectClienta = (c: Clienta) => {
    vibracionSutil();
    onChange({
      clientaId: c.id,
      nombre: c.nombre,
      telefono: c.telefono || '',
      edad: String(c.edad || ''),
      email: c.email || '',
    });
    setShowList(false);
    setSearch('');
  };

  const clearClienta = () => {
    vibracionSutil();
    onChange({ clientaId: undefined, nombre: '', telefono: '', edad: '', email: '' });
  };

  return (
    <div className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Eyebrow + título editorial */}
      <div>
        <div className="v-caps">Capítulo 01 · Quién está frente a ti</div>
        <h1
          style={{
            margin: '4px 0 6px',
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: 'var(--text-main)',
          }}
        >
          Empezamos por <em style={{ color: 'var(--secondary-deep)' }}>conocerla</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          La historia siempre empieza con un nombre. Asocia esta consulta a una clienta del fichero
          o crea una nueva.
        </p>
      </div>

      {/* Clienta ya seleccionada */}
      {data.clientaId && (
        <section
          className="v-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            background: 'var(--primary-pale)',
            border: '1px solid rgba(45, 90, 39, 0.18)',
          }}
        >
          <AvatarV2 nombre={data.nombre} tone={toneFromTipoRizo()} size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v-caps" style={{ color: 'var(--primary)' }}>Clienta seleccionada</div>
            <p
              style={{
                margin: '2px 0 0',
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                color: 'var(--primary-deep)',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {data.nombre}
            </p>
            {data.telefono && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 11,
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                }}
              >
                {data.telefono}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clearClienta}
            aria-label="Quitar selección"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </section>
      )}

      {/* Buscar existente */}
      {!data.clientaId && clientas.length > 0 && (
        <section className="v-card" style={{ padding: 14 }}>
          <div className="v-caps" style={{ marginBottom: 10 }}>Buscar en mi fichero</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--bg)',
              borderRadius: 999,
            }}
          >
            <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowList(true); }}
              onFocus={() => setShowList(true)}
              placeholder="Mariana, Catalina, Sofía…"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-main)',
              }}
            />
          </div>

          {showList && (search || filtered.length > 0) && (
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {filtered.length === 0 ? (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                    padding: '12px 0',
                    margin: 0,
                  }}
                >
                  No se encontraron clientas
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectClienta(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      background: 'transparent',
                      border: '1px solid var(--border-soft)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AvatarV2 nombre={c.nombre} tone={toneFromTipoRizo(c.tipoRizoPrincipal)} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 14,
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.nombre}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {c.tipoRizoPrincipal ? `Rizo ${c.tipoRizoPrincipal} · ` : ''}
                        {c.totalVisitas} {c.totalVisitas === 1 ? 'visita' : 'visitas'}
                      </div>
                    </div>
                    <Check size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {/* Separador */}
      {!data.clientaId && clientas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="v-caps">o crea una nueva ficha</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
      )}

      {/* Formulario nueva clienta */}
      {!data.clientaId && (
        <section className="v-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-caps" style={{ color: 'var(--text-secondary)' }}>
                Nombre completo <Chip tone="amber" style={{ padding: '0 6px', fontSize: 8.5, marginLeft: 4 }}>requerido</Chip>
              </span>
              <input
                type="text"
                value={data.nombre}
                onChange={(e) => onChange({ nombre: e.target.value })}
                placeholder="María Fernanda Restrepo"
                style={{
                  border: 'none',
                  borderBottom: errors.nombre
                    ? '1px solid var(--danger)'
                    : '1px solid var(--border-strong)',
                  background: 'transparent',
                  padding: '6px 0',
                  fontSize: 14,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-serif)',
                  outline: 'none',
                }}
              />
              {errors.nombre && (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 11,
                    color: 'var(--danger)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {errors.nombre}
                </p>
              )}
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-caps" style={{ color: 'var(--text-secondary)' }}>
                Teléfono / WhatsApp
              </span>
              <input
                type="tel"
                value={data.telefono}
                onChange={(e) => onChange({ telefono: e.target.value })}
                placeholder="+57 300 …"
                style={{
                  border: 'none',
                  borderBottom: '1px solid var(--border-strong)',
                  background: 'transparent',
                  padding: '6px 0',
                  fontSize: 14,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.02em',
                  outline: 'none',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '40%' }}>
              <span className="v-caps" style={{ color: 'var(--text-secondary)' }}>Edad</span>
              <input
                type="number"
                value={data.edad}
                onChange={(e) => onChange({ edad: e.target.value })}
                placeholder="32"
                inputMode="numeric"
                style={{
                  border: 'none',
                  borderBottom: '1px solid var(--border-strong)',
                  background: 'transparent',
                  padding: '6px 0',
                  fontSize: 14,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-caps" style={{ color: 'var(--text-secondary)' }}>
                Email <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· opcional</span>
              </span>
              <input
                type="email"
                value={data.email}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="maria@correo.com"
                style={{
                  border: 'none',
                  borderBottom: '1px solid var(--border-strong)',
                  background: 'transparent',
                  padding: '6px 0',
                  fontSize: 14,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-serif)',
                  outline: 'none',
                }}
              />
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
