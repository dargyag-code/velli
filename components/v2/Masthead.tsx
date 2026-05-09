'use client';
import React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

interface MastheadProps {
  name?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Mostrar marca "EST · 2026" en la esquina superior derecha */
  showEst?: boolean;
}

export default function Masthead({ name = '', subtitle, action, showEst = true }: MastheadProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? 'V';
  return (
    <header
      className="v-grain"
      style={{
        position: 'relative',
        padding: '54px 18px 22px',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #14241A 0%, #1F3D24 100%)',
        color: '#F5EDDC',
      }}
    >
      {showEst && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'rgba(201, 149, 107, 0.85)',
            letterSpacing: '0.2em',
          }}
        >
          <span>EST · 2026</span>
          <div style={{ width: 24, height: 1, background: 'rgba(201, 149, 107, 0.5)' }} />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 16,
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'rgba(201, 149, 107, 0.95)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Velli — Inteligencia capilar
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 30,
                lineHeight: 1,
                color: '#fff',
                letterSpacing: '-0.02em',
              }}
            >
              Hola,
            </span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 30,
                lineHeight: 1,
                color: '#E8C290',
                letterSpacing: '-0.02em',
              }}
            >
              {name || 'Estilista'}.
            </span>
          </div>
          {subtitle && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: 'rgba(245,237,220,0.65)',
                maxWidth: 280,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action !== undefined ? (
          action
        ) : (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link
              href="/reportes"
              aria-label="Notificaciones y reportes"
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#F5EDDC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'transform 120ms ease',
                outline: 'none',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Bell size={16} strokeWidth={1.7} />
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#E8C290',
                }}
              />
            </Link>
            <Link
              href="/configuracion"
              aria-label="Cuenta y configuración"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(232, 194, 144, 0.95)',
                color: '#14241A',
                fontFamily: 'var(--font-serif)',
                fontSize: 16,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
                outline: 'none',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {initial}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
