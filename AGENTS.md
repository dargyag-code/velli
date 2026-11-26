# AGENTS.md — Reglas Obligatorias de Ingeniería · Velli Pro

Este documento define las reglas innegociables de arquitectura, calidad, diseño, seguridad y flujo de trabajo para cualquier agente o desarrollador que intervenga en **Velli Pro**. Ningún cambio puede contradecir estas directrices.

---

## Mapa rápido del repositorio actual

- **`proxy.ts`**: Punto de intercepción de sesión en **Next.js 16** (`@supabase/ssr`). Refresca cookies de sesión, protege rutas privadas redirigiendo a `/auth/login` y declara explícitamente las rutas públicas (`/auth/*`, `/legal/*`, `/icon*`, `/c` y `/c/*`), respetando `/auth/reset-password` en recuperación.
- **`app/layout.tsx` y `app/globals.css`**: Configuración global del sistema **Velvet Studio** en Tailwind CSS v4 (`@import "tailwindcss"` + `@theme`), carga de fuentes variables (`Plus_Jakarta_Sans`, `Fraunces`, `JetBrains_Mono`) sin arreglo `weight` para compatibilidad con Turbopack en Next.js 16, metadatos centralizados con `APP_URL` y lienzo cálido `#FAF7F5`.
- **`lib/`**:
  - `lib/supabase/` (`server.ts`, `client.ts`, `admin.ts`): Clientes Supabase SSR, navegador y `service_role` (exclusivo de servidor).
  - `lib/api/` (`auth.ts`, `rateLimit.ts`): Guardarraíl `requireUser()` y limitadores deslizantes con `@upstash/ratelimit` + `@upstash/redis`.
  - Motores de dominio puros y datos: `lib/cotizador/` (variables, precio, costo químico, comisión, WhatsApp, DB), `lib/color/`, `lib/cortes/`, `lib/kb/`, `lib/agenda/`, `lib/flags/`, `lib/ia/`, `lib/payments/` (Bold), `lib/subscription/` y `lib/sitio.ts` (fuente única de `APP_URL` y `SOPORTE_EMAIL`).
- **`supabase/`**: Esquema y migraciones SQL idempotentes con RLS, funciones RPC acotadas y tablas de eventos append-only.
- **`tests/`**: Suite automatizada en **Vitest** (`vitest.config.mts`, 14 archivos en `tests/**/*.test.ts`, **340 tests en verde**).

---

## 1. Stack y calidad obligatoria

- **Stack oficial**:
  - **Next.js 16** (App Router, `proxy.ts`, Turbopack) + **React 19** + **TypeScript 5** (`strict: true`, alias `@/*`).
  - **Tailwind CSS v4** (`@tailwindcss/postcss`, tokens en `@theme` dentro de `app/globals.css`).
  - **Supabase SSR / Postgres con RLS** (`@supabase/ssr`, `@supabase/supabase-js`).
  - **Upstash Ratelimit + Redis** (`@upstash/ratelimit`, `@upstash/redis` vía `lib/api/rateLimit.ts`).
- **Puerta de calidad (Definition of Done)**:
  - **Ninguna tarea se da por terminada** si `npx tsc --noEmit` (`npm run typecheck`) falla o si algún test existente se rompe al ejecutar `npm test` (`vitest run`).
  - **Base mínima obligatoria**: **340 tests pasando**. Toda nueva regla de negocio, cálculo financiero/inventario o validación de seguridad debe sumar pruebas automatizadas en `tests/`, nunca reducir la cobertura ni rebajar ese piso.
  - Prohibido introducir `any` injustificados, `@ts-ignore` o desactivar validaciones estrictas de TypeScript para forzar compilaciones.

---

## 2. Sistema de diseño Velvet Studio (estricto)

- **Tipografías obligatorias** (configuradas en `app/layout.tsx` y `app/globals.css`):
  - **`Fraunces`** (`--font-display` / `font-display` / `.v-display`): Títulos editoriales (`h1`) y cifras protagónicas de Business Intelligence siempre acompañadas de **`tabular-nums`** (`font-variant-numeric: tabular-nums`).
  - **`Plus Jakarta Sans`** (`--font-sans` / `font-sans`): Interfaz operativa, navegación, formularios, subtítulos (`h2`–`h6`), botones y textos de lectura.
  - **`JetBrains Mono`** (`--font-mono` / `font-mono` / `.v-mono`): Fórmulas químicas, gramos (`g`), mililitros (`ml`), proporciones, códigos técnicos y tokens (siempre con `tabular-nums`).
- **Superficies, bordes y paleta cromática**:
  - Lienzo base cálido: `bg-[#FAF7F5]` (`--bg`), texto primario `#3B0D1E`, secundarios `#6B535C` y `#947C85` (cero negro puro `#000000` y cero grises fríos genéricos).
  - **Superficies limpias estándar**: `bg-white rounded-3xl border border-[#EFE8E4]` (con sombras cálidas muy sutiles tintadas en ciruela cuando corresponda, ej. `shadow-velvet`).
  - **Acento base**: `#3B0D1E` (hover `#52142B`), **parametrizable en vistas públicas vía `brand_settings`** de la organización/salón (usando `#3B0D1E` como fallback seguro y validado).
- **Prohibiciones visuales absolutas**:
  - **PROHIBIDO** usar gradientes morados/rosados/azules genéricos de estética IA.
  - **PROHIBIDO** usar sombras pesadas, oscuras o repetitivas (`shadow-xl` / `shadow-2xl` estándar sobre tarjetas operativas).
  - **PROHIBIDO** usar layouts genéricos de plantilla IA (rejillas decorativas sin jerarquía de negocio, exceso de píldoras/badges ornamentales o textos artificiales).

---

## 3. Seguridad y arquitectura de datos

- **Multi-tenant con `organization_id` y RLS real**:
  - **Toda nueva tabla** debe incluir **`organization_id`** (`uuid NOT NULL` indexado) y **políticas reales de Row Level Security (`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`) en Supabase/Postgres** cubriendo lectura y escritura.
  - **Nunca confiar en filtros del frontend** como barrera de seguridad o aislamiento entre organizaciones/salones.
  - `createAdminClient()` (`service_role`, `lib/supabase/admin.ts`) jamás puede importarse en componentes cliente (`'use client'`) ni retornar registros completos sin seleccionar explícitamente las columnas permitidas.
  - Proteger Route Handlers autenticados con `requireUser()` (`lib/api/auth.ts`) y rutas expuestas o costosas con `checkRateLimit()` (`lib/api/rateLimit.ts`).
- **Inmutabilidad financiera y de inventario (Ledger / Append-Only)**:
  - **Todo movimiento de dinero** (cobros, pagos, anticipos, cierres de caja, liquidaciones, ajustes) **y todo movimiento de inventario** (compras/entradas, consumos por servicio o fórmula, mermas, ajustes de stock) **debe ser inmutable**.
  - Se modela mediante registro de eventos/movimientos append-only con trazabilidad (fecha, autor, motivo, referencia); **NUNCA sobrescribir ni mutar saldos, costos históricos, versiones de precios ni cobros manualmente**. Cualquier corrección se registra como un nuevo evento compensatorio.
- **Privacidad estricta en rutas públicas**:
  - Las rutas, páginas, metadatos y endpoints/RPCs públicos (como `/c/[token]` o futuras vistas públicas para clientas) **JAMÁS deben exponer costos internos, precios de compra de insumos, fórmulas químicas privadas, márgenes de ganancia ni reglas o montos de comisiones**, ni fotografías o datos clínicos sensibles.
  - Proyectar exclusivamente los campos públicos indispensables en servidor o vía funciones RPC dedicadas, manteniendo cabeceras `Cache-Control: no-store` y `noindex, nofollow` en rutas por token.

---

## 4. Modo de trabajo

- **Plan previo y control de migraciones**:
  - Antes de editar código en **tareas grandes**, presentar un **plan corto de archivos a crear/modificar** indicando el objetivo de cada cambio.
  - **Esperar confirmación explícita** antes de escribir o ejecutar migraciones SQL destructivas (`DROP`, `TRUNCATE`, eliminación/renombrado de columnas o cambios incompatibles con datos existentes). Toda migración en `supabase/` debe escribirse de forma idempotente.
- **Cambios acotados y atómicos**:
  - Mantener los cambios estrictamente **acotados y atómicos**: resolver una responsabilidad a la vez sin mezclar refactors no solicitados, sin alterar módulos congelados (`lib/flags/registro.ts`), configuración de pasarela (`lib/payments/bold.ts`) ni dominios centralizados (`lib/sitio.ts`, nunca usar dominios fijos).
  - Verificar siempre `npx tsc --noEmit` y `npm test` (>= 340 tests pasando) antes de dar cualquier tarea por completada.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
