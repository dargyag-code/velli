# AGENTS.md — Reglas Obligatorias de Ingeniería · Veli

Este documento define las reglas innegociables de arquitectura, calidad, diseño base, seguridad y flujo de trabajo para cualquier agente o desarrollador que intervenga en **Veli**. Ningún cambio puede contradecir estas directrices.

---

## Mapa rápido del repositorio actual

- **`proxy.ts`**: Punto de intercepción de sesión en **Next.js 16** (`@supabase/ssr`). Refresca cookies de sesión, protege rutas privadas redirigiendo a `/auth/login` y declara explícitamente las rutas públicas (`/auth/*`, `/legal/*`, `/icon*`, `/c`, `/c/*`, `/s` y `/s/*`), respetando `/auth/reset-password` en recuperación.
- **`app/layout.tsx` y `app/globals.css`**: Configuración global de la **Base Neutra Veli** en Tailwind CSS v4 (`@import "tailwindcss"` + `@theme`), carga de fuentes variables (`Plus_Jakarta_Sans`, `JetBrains_Mono`) sin arreglo `weight` para compatibilidad con Turbopack en Next.js 16, metadatos centralizados con `APP_URL` y lienzo limpio `#FAFAFA` / `#FFFFFF`.
- **`lib/`**:
  - `lib/supabase/` (`server.ts`, `client.ts`, `admin.ts`): Clientes Supabase SSR, navegador y `service_role` (exclusivo de servidor).
  - `lib/api/` (`auth.ts`, `rateLimit.ts`): Guardarraíles `requireUser()` / `requireOrgAccess()` y limitadores deslizantes con `@upstash/ratelimit` + `@upstash/redis`.
  - Motores de dominio puros y datos: `lib/cotizador/` (variables, precio, costo químico, comisión, WhatsApp, DB), `lib/color/`, `lib/cortes/`, `lib/kb/`, `lib/agenda/`, `lib/flags/`, `lib/ia/`, `lib/organizations/`, `lib/vitrina/`, `lib/storage/`, `lib/payments/` (Bold), `lib/subscription/` y `lib/sitio.ts` (fuente única de `APP_URL` y `SOPORTE_EMAIL`).
- **`supabase/`**: Esquema y migraciones SQL idempotentes con RLS, funciones RPC acotadas y tablas de eventos append-only.
- **`tests/`**: Suite automatizada en **Vitest** (`vitest.config.mts`, `tests/**/*.test.ts`, **>= 390 tests en verde**).

---

## 1. Stack y calidad obligatoria

- **Stack oficial**:
  - **Next.js 16** (App Router, `proxy.ts`, Turbopack) + **React 19** + **TypeScript 5** (`strict: true`, alias `@/*`).
  - **Tailwind CSS v4** (`@tailwindcss/postcss`, tokens semánticos en `@theme` dentro de `app/globals.css`).
  - **Supabase SSR / Postgres con RLS** (`@supabase/ssr`, `@supabase/supabase-js`).
  - **Upstash Ratelimit + Redis** (`@upstash/ratelimit`, `@upstash/redis` vía `lib/api/rateLimit.ts`).
- **Puerta de calidad (Definition of Done)**:
  - **Ninguna tarea se da por terminada** si `npx tsc --noEmit` (`npm run typecheck`) falla o si algún test existente se rompe al ejecutar `npm test` (`vitest run`).
  - **Base mínima obligatoria**: **390 tests pasando** (piso histórico >= 340). Toda nueva regla de negocio, cálculo financiero/inventario o validación de seguridad debe sumar pruebas automatizadas en `tests/`, nunca reducir la cobertura ni rebajar ese piso.
  - Prohibido introducir `any` injustificados, `@ts-ignore` o desactivar validaciones estrictas de TypeScript para forzar compilaciones.

---

## 2. Sistema de diseño · Base Neutra Veli (100% blanca y neutra)

La interfaz interna de **Veli** opera sobre una arquitectura **100% blanca, neutra y semántica**, lista para evolucionar desde Figma sin rehacer componentes ni arrastrar colores heredados:

- **Tokens semánticos obligatorios** (definidos en `app/globals.css` bajo `:root` y `@theme`):
  - `--color-canvas: #FAFAFA` (lienzo general)
  - `--color-surface: #FFFFFF` (paneles, tarjetas, sidebar, top bar y drawers)
  - `--color-surface-subtle: #F4F4F5` (fondos secundarios, estados hover e inactivos)
  - `--color-border: #E4E4E7` (bordes estructurales nítidos de `1px`)
  - `--color-ink: #111111` (texto primario y cifras)
  - `--color-ink-muted: #52525B` (texto secundario y etiquetas)
  - `--color-ink-subtle: #71717A` (metadatos y placeholders)
  - `--color-primary: #111111` (hover `#27272A`, texto `#FFFFFF`; en vistas públicas `/s/[slug]` y `/c/[token]` parametrizable vía `brand_settings.primary_color` con `#111111` como fallback seguro)
  - **Semánticos exclusivos para datos/estado real (jamás decoración)**:
    - Óptimo / Confirmado (`--color-ok`): `#15803D`
    - Alerta / Pendiente (`--color-alert`): `#B45309`
    - Error / Crítico (`--color-error`): `#DC2626`
- **Tipografías obligatorias** (`app/layout.tsx` y `app/globals.css`):
  - **`Plus Jakarta Sans`** (`--font-sans` / `font-sans`): UI operativa, navegación, títulos (`h1`–`h6`), formularios y cifras con **`tabular-nums`** (`font-variant-numeric: tabular-nums`).
  - **`JetBrains Mono`** (`--font-mono` / `font-mono` / `.v-mono`): **únicamente** para gramos (`g`), mililitros (`ml`), horarios y códigos técnicos (siempre con `tabular-nums`).
- **Geometría, radios y elevación**:
  - Radios consistentes: **`12px` (`rounded-xl`)** en paneles y tarjetas; **`8px` (`rounded-lg`)** en botones, inputs y badges.
  - Cero sombras pesadas (`shadow-xl` / `shadow-2xl`): jerarquía resuelta mediante bordes `1px solid #E4E4E7`.
- **Prohibiciones visuales y de copy**:
  - **PROHIBIDO** usar colores heredados de sistemas retirados (`#3B0D1E`, `#FAF7F5`, `Fraunces`, `Comfortaa`) o violetas/gradientes de estética IA (`#7C3AED`).
  - **Copy neutro en género** en la interfaz (*Cliente*, *Especialista*, *Estudio*).

---

## 3. Seguridad y arquitectura de datos

- **Multi-tenant con `organization_id` y RLS real**:
  - **Toda nueva tabla** debe incluir **`organization_id`** (`uuid NOT NULL` indexado) y **políticas reales de Row Level Security (`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`) en Supabase/Postgres** cubriendo lectura y escritura.
  - **Nunca confiar en filtros del frontend** como barrera de seguridad o aislamiento entre organizaciones/salones.
  - `createAdminClient()` (`service_role`, `lib/supabase/admin.ts`) jamás puede importarse en componentes cliente (`'use client'`) ni retornar registros completos sin seleccionar explícitamente las columnas permitidas.
  - Proteger Route Handlers autenticados con `requireUser()` / `requireOrgAccess()` (`lib/api/auth.ts`) y rutas expuestas o costosas con `checkRateLimit()` (`lib/api/rateLimit.ts`).
- **Política estricta de IA**:
  - Proveedor exclusivo **Anthropic** sin adaptadores de respaldo ni fallback a terceros.
- **Inmutabilidad financiera y de inventario (Ledger / Append-Only)**:
  - **Todo movimiento de dinero** (cobros, pagos, anticipos, cierres de caja, liquidaciones, ajustes) **y todo movimiento de inventario** (compras/entradas, consumos por servicio o fórmula, mermas, ajustes de stock) **debe ser inmutable**.
  - Se modela mediante registro de eventos/movimientos append-only con trazabilidad (fecha, autor, motivo, referencia); **NUNCA sobrescribir ni mutar saldos, costos históricos, versiones de precios ni cobros manualmente**. Cualquier corrección se registra como un nuevo evento compensatorio.
- **Privacidad estricta en rutas públicas**:
  - Las rutas, páginas, metadatos y endpoints/RPCs públicos (como `/c/[token]` y `/s/[slug]`) **JAMÁS deben exponer costos internos, precios de compra de insumos, fórmulas químicas privadas, márgenes de ganancia ni reglas o montos de comisiones**, ni fotografías o datos clínicos sensibles.
  - Proyectar exclusivamente los campos públicos indispensables en servidor o vía funciones RPC dedicadas, manteniendo cabeceras `Cache-Control: no-store` y `noindex, nofollow` en rutas por token (`/c/[token]`).

---

## 4. Modo de trabajo

- **Plan previo y control de migraciones**:
  - Antes de editar código en **tareas grandes**, presentar un **plan corto de archivos a crear/modificar** indicando el objetivo de cada cambio.
  - **Esperar confirmación explícita** antes de escribir o ejecutar migraciones SQL destructivas (`DROP`, `TRUNCATE`, eliminación/renombrado de columnas o cambios incompatibles con datos existentes). Toda migración en `supabase/` debe escribirse de forma idempotente.
- **Cambios acotados y atómicos**:
  - Mantener los cambios estrictamente **acotados y atómicos**: resolver una responsabilidad a la vez sin mezclar refactors no solicitados, sin alterar módulos congelados (`lib/flags/registro.ts`), configuración de pasarela (`lib/payments/bold.ts`) ni dominios fijos fuera de `lib/sitio.ts`.
  - Verificar siempre `npx tsc --noEmit` y `npm test` antes de dar cualquier tarea por completada.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
