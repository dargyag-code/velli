# Auditoría Técnica Real de Pre-Producción · Velli Pro

- **Fecha de auditoría**: 2026-11-26
- **Rama auditada**: `feat/preprod-audit-hardening` (base `060c019`, Next.js `16.4.6`)
- **Alcance**: Inspección directa de código fuente (`app/`, `components/`, `lib/`, `proxy.ts`, `next.config.ts`), esquema y migraciones SQL (`supabase/`), Route Handlers y suite automatizada (`tests/`).

## Escala de Clasificación

- **A**: Implementado y verificado automáticamente.
- **B**: Implementado parcialmente (con detalle exacto de brechas).
- **C**: Existe UI pero falta lógica/persistencia real (o viceversa).
- **D**: Presenta errores o riesgos de seguridad/aislamiento.
- **E**: Requiere verificación obligatoria en Supabase / entorno real de producción.

---

## 1. Resumen de Estado por Módulo (Hallazgos Reales y Cierre)

| # | Módulo | Estado Inicial | Estado Post-Cierre | Evidencia Principal |
|---|---|---|---|---|
| 1 | Workspace Silla (`/`) y Motor Financiero Sin Báscula | **D / B** | **A + E** | `app/page.tsx`, `components/cotizador/ListaPorCobrar.tsx`, `lib/cotizador/*`, `lib/costo.ts`, `lib/comision.ts` |
| 2 | CRM Clientas (`/clientas`, reactivación, consentimientos) | **D** | **A + E** | `app/clientas/*`, `lib/db.ts`, `lib/clientas/reactivacion.ts`, `lib/consentimientos.ts`, `supabase/schema.sql` |
| 3 | BI y Nómina (`/reportes`) y Calibración (`/configuracion/precios`) | **B / D** | **A + E** | `app/reportes/*`, `app/configuracion/precios/*`, `supabase/velli-bi-cotizador.sql` |
| 4 | Multi-Tenant, RBAC y Vertical Packs | **D / B** | **A + E** | `supabase/migration-multitenant-rbac.sql`, `lib/organizations/*`, `lib/flags/verticales.ts`, `lib/api/auth.ts` |
| 5 | Vitrina Pública (`/s/[slug]`), Catálogo (`/vitrina`) y Pedidos (`/api/public/orders`) | **C / B** | **A + E** | `app/s/[slug]/page.tsx`, `app/vitrina/page.tsx`, `app/api/public/orders/route.ts`, `supabase/migration-vitrina-editorial.sql` |
| 6 | Agenda (`/agenda`), Reservas (`/api/public/appointments`) y Puente a Silla | **A / B** | **A + E** | `app/agenda/page.tsx`, `app/api/public/appointments/route.ts`, `lib/agenda/*`, `supabase/migration-agenda-puente.sql` |
| 7 | Comprobante (`/c/[token]`), Pagos Bold y Cupo IA | **A / B** | **A + E** | `app/c/[token]/page.tsx`, `app/api/cotizaciones/[token]/aceptar/route.ts`, `lib/payments/bold.ts`, `lib/ia/uso.ts` |

---

## 2. Detalle Técnico por Módulo (Evidencia del Código Real)

### 2.1 Workspace Silla (`/`) y Motor Financiero Sin Báscula
- **Implementado y probado (A)**:
  - Motores puros de tarifa por variables (`lib/cotizador/precio.ts`), costo químico sin báscula en gramos/mililitros/equivalencias físicas (`lib/cotizador/costo.ts`, `lib/costo.ts`), comisión sobre neto libre de química (`lib/cotizador/comision.ts`, `lib/comision.ts`) y guardarraíles clínicos (`lib/color/reglas.ts`).
  - Pre-carga automática en Silla desde `/agenda` (`?clientaId`, `?specialistId`, `?serviceId`, `?customerName`, `?customerPhone`).
- **Brechas detectadas en auditoría inicial (D / B)**:
  1. **Exposición financiera al rol `specialist` en UI**: `app/page.tsx` y `components/cotizador/ListaPorCobrar.tsx` no consultaban el rol activo en `organization_members`, mostrando costo por gramo (`$/g`), descuento químico, comisión y **Utilidad Neta Real del Salón / Margen %** a cualquier miembro autenticado.
  2. **RPC `cotizaciones_operativas_silla` sin conectar (C)**: existía en `supabase/migration-multitenant-rbac.sql`, pero `lib/cotizador/db.ts` solo consultaba `SELECT * FROM cotizaciones` (bloqueado por RLS para `specialist`).
  3. **Bloqueo al crear cotizaciones como `specialist` / `manager` (D)**:
     - `crearCotizacion` ejecutaba `.insert(...).select('*').single()` y `enviarCotizacion` ejecutaba `.update({ estado: 'enviada' })` sobre `public.cotizaciones`, operaciones rechazadas por RLS para `specialist`.
     - El trigger `public.cotizaciones_mismo_salon()` validaba `c.user_id = NEW.user_id` en lugar de `COALESCE(organization_id, user_id)`, lanzando `REFERENCIA_OTRO_SALON` cuando una `specialist` o `manager` cotizaba para una clienta o servicio creado por la `owner`.
- **Cierre ejecutado**: conectadas las RPCs `cotizaciones_operativas_silla(p_org_id)` y `crear_cotizacion_operativa_silla(...)` con proyección `projectQuoteForRole`, desactivado el auto-sembrado para `specialist` y ocultados costos químicos, comisiones y utilidad neta en `/` y `ListaPorCobrar`.

---

### 2.2 CRM Clientas (`/clientas`, Reactivación y Consentimientos)
- **Implementado y probado (A)**:
  - Directorio CRM, ficha clínica (`/clientas/[id]`), alta (`/clientas/nueva`), motor de reactivación por WhatsApp a `30+`, `45+` y `60+` días con enfriamiento semanal (`last_reactivation_contact_at`) y consentimientos firmados (`consentimientos_clienta`, `pruebas_sensibilidad`).
- **Brechas detectadas en auditoría inicial (D)**:
  1. **Aislamiento RLS incompleto en tablas clínicas/CRM**: `supabase/migration-multitenant-rbac.sql` añadió `organization_id` a `clientas`, `consultas`, `citas`, `consentimientos_clienta`, `pruebas_sensibilidad` y `servicios_color` (omitiendo `cortes_ejecutados`), pero dejó activas únicamente las políticas antiguas `auth.uid() = user_id` de `schema.sql`. En Postgres real, `manager` y `specialist` veían **0 clientas** del salón y no podían registrar diagnósticos ni consentimientos.
- **Cierre ejecutado**: migradas de forma idempotente las políticas RLS de `clientas`, `consultas`, `citas`, `consentimientos_clienta`, `pruebas_sensibilidad`, `servicios_color`, `cortes_ejecutados` y `salon_marcas_activas` a pertenencia activa por `organization_id` (`current_user_org_ids()`), reservando el borrado de `clientas` a `owner | manager`.

---

### 2.3 BI y Nómina (`/reportes`) y Calibración (`/configuracion/precios`)
- **Implementado y probado (A)**:
  - Agregación real de ingresos cobrados, inversión química, desvío de gramos teóricos vs reales, liquidación por especialista con envío a WhatsApp y versionado inmutable de `plantillas_precio` mediante `publicar_plantilla_precio`.
- **Brechas detectadas en auditoría inicial (B / D)**:
  1. **Falta de protección en servidor y ocultamiento de navegación para `specialist`**: `VelvetTopHeader` mostraba los enlaces a `/reportes`, `/configuracion/precios`, `/vitrina` y `/planes` a todos los usuarios, y entrar por URL directa a `/reportes` o `/configuracion/precios` renderizaba la vista cliente sin redirección de servidor.
  2. **Propagación de `organization_id` en `publicar_plantilla_precio`**: la función insertaba `user_id` sin fijar explícitamente `organization_id` del servicio cuando la ejecutaba un `manager`.
- **Cierre ejecutado**: creados layouts de servidor en `app/reportes/layout.tsx`, `app/configuracion/precios/layout.tsx` y `app/planes/layout.tsx` que redirigen limpiamente a `/agenda` cuando el rol activo es `specialist`; filtrada la navegación en `VelvetTopHeader` y `/configuracion` (390px y escritorio); endurecida `publicar_plantilla_precio`.

---

### 2.4 Multi-Tenant, RBAC (`organizations`, `organization_members`, `brand_settings`) y Vertical Packs
- **Implementado y probado (A)**:
  - Esquema multi-tenant (`organizations`, `organization_members` acotado a `owner | manager | specialist`, `brand_settings`), funciones `current_user_org_ids()` y `has_org_role()`, `requireOrgAccess()` y `hair_clinical_pack` con `hair_studio` por defecto.
- **Brechas detectadas en auditoría inicial (D / B)**:
  1. **Orden alfabético de triggers `BEFORE INSERT` y suscripción por organización**: `set_default_org_*` se ejecutaba después de `cotizaciones_mismo_salon` y `guard_suscripcion_*` en Postgres; además, `verificar_escritura_tenant` consultaba `subscriptions` con `auth.uid()` del miembro invitado en lugar de la suscripción del titular de la organización, y `organizations.plan` no se sincronizaba al aprobarse pagos en `subscriptions`.
  2. **`update_updated_at()` sin `SET search_path = ''`**: heredado de `schema.sql`.
  3. **Desincronización de `logo_url` en `/configuracion`**: guardar el logo en `/configuracion` actualizaba `profiles.logo_url` en el bucket privado `fotos` (con URL firmada temporal), sin actualizar `public.brand_settings.logo_url`.
- **Cierre ejecutado**: triggers renombrados a `aa_set_default_org_*` (eliminando `set_default_org_*`), `update_updated_at()` endurecida con `SET search_path = ''`, `verificar_escritura_tenant` resuelta contra la suscripción del titular de la organización, trigger `sync_organization_plan_from_subscription` añadido, y `brand_settings.logo_url` sincronizado con subida real a `vitrina-media`.

---

### 2.5 Vitrina Pública (`/s/[slug]`), Catálogo (`/vitrina`) y Pedidos WhatsApp (`/api/public/orders`)
- **Implementado y probado (A)**:
  - Vitrina editorial SSR parametrizada por `brand_settings`, carrito retail + consulta de servicios, rate-limit con Upstash, recálculo autoritativo de montos COP en servidor y persistencia en `public_orders` + `public_order_events` antes de responder el enlace `wa.me`.
- **Brechas detectadas en auditoría inicial (C / B)**:
  1. **Sin subida real de imágenes (C)**: `/vitrina` solo ofrecía un `<input type="url">` manual para `image_url`; no existía el bucket público `vitrina-media` ni políticas RLS en `storage.objects`.
  2. **Bloqueo SEO e incompletitud de OpenGraph en `/s/[slug]` (B)**: `next.config.ts` inyectaba `X-Robots-Tag: noindex, nofollow` en `/s/:path*` y `app/s/[slug]/page.tsx` fijaba `robots: { index: false, follow: false }` sin metadatos `twitter` ni imagen de `logo_url`/`city`.
- **Cierre ejecutado**: creada `supabase/migration-storage-vitrina.sql` (`vitrina-media`, 3 MB, `jpeg/png/webp`, RLS por `{organization_id}/products/*` y `{organization_id}/brand/*`), endpoint validado `/api/storage/vitrina`, componente `VelvetImageUploader` integrado en `/vitrina` y `/configuracion`, y habilitado `index, follow` + `generateMetadata` completo (`openGraph` + `twitter`) en `/s/[slug]`.

---

### 2.6 Agenda (`/agenda`), Reservas Públicas (`/api/public/appointments`) y Puente "Abrir en Silla"
- **Implementado y probado (A)**:
  - Cálculo determinista de disponibilidad en `America/Bogota` (`UTC-5`), restricción física `EXCLUDE USING gist` (`appointments_no_specialist_overlap`) precedida por `CREATE EXTENSION IF NOT EXISTS btree_gist;`, trigger `appointments_guard_bogota()`, bitácora append-only `appointment_events`, vinculación automática de `clienta_id` por teléfono y botón **Abrir en Silla**.
- **Brecha menor endurecida (B)**:
  - En `appointments_guard_bogota()`, `a.id <> NEW.id` se reemplazó por `a.id IS DISTINCT FROM NEW.id` y se añadió índice compuesto por `organization_id` para reactivación en `public.clientas`.

---

### 2.7 Comprobante Público (`/c/[token]`), Pagos Bold y Cupo IA
- **Implementado y probado (A)**:
  - `/c/[token]` mantiene `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store, no-cache, must-revalidate`, validación UUID, rate-limit por IP y cero exposición de costos, fórmulas o comisiones.
  - Pagos Bold (`lib/payments/bold.ts`, `/api/pagos/*` — módulo congelado respetado intacto): verificación HMAC timing-safe e idempotencia transaccional en `procesar_evento_pago`.
  - Cupo IA (`lib/ia/uso.ts`, `/api/analyze-hair`, `/api/validate-hair-photo`): proveedor exclusivo Anthropic (`claude-sonnet-4-6`) sin respaldo de terceros, topes `20` (trial) / `150` (`pro_ia` mensual en `America/Bogota`) y máximo 2 validaciones por análisis.
- **Brechas detectadas en auditoría inicial (B)**:
  1. En `app/c/[token]/page.tsx`, la consulta de respaldo apuntaba a `.from('suscripciones')` (nombre inexistente; la tabla real es `public.subscriptions`) y no priorizaba `organizations.whatsapp_phone` ni `organizations.plan`.
  2. En `app/api/cotizaciones/[token]/aceptar/route.ts`, la sincronización hacia `consentimientos_clienta` filtraba `clientas` solo por `row.user_id`, omitiendo `organization_id` cuando la cotización había sido creada por una `specialist`.
- **Cierre ejecutado**: corregida la lectura hacia `organizations` + `subscriptions` en `/c/[token]` y sincronización multi-tenant en `/api/cotizaciones/[token]/aceptar`.

---

## 3. Verificación Obligatoria en Entorno Real (Clasificación E)

Los siguientes puntos dependen de servicios externos y deben validarse en el despliegue real antes de operar el primer salón piloto:

1. **Ejecución ordenada de migraciones SQL en Supabase SQL Editor**:
   1. `supabase/migration-multitenant-rbac.sql`
   2. `supabase/migration-vitrina-editorial.sql`
   3. `supabase/migration-agenda-puente.sql`
   4. `supabase/migration-storage-vitrina.sql`
2. **Variables de entorno en producción (Vercel)**:
   - `NEXT_PUBLIC_APP_URL` (dominio HTTPS real, sin barra final)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (indispensables para que el rate-limiting público esté activo y no en modo fallback)
   - `ANTHROPIC_API_KEY`
   - `BOLD_API_KEY`, `BOLD_WEBHOOK_SECRET`, `PAYMENT_PROVIDER=bold`
3. **Pruebas manuales de humo recomendadas en entorno real**:
   - Subir un logo en `/configuracion` y una foto de producto en `/vitrina` (< 3 MB, `.webp`/`.png`/`.jpg`) verificando renderizado público en `/s/[slug]` y previsualización OpenGraph al compartir en WhatsApp.
   - Iniciar sesión con una cuenta miembro de rol `specialist`: comprobar redirección automática de `/reportes` y `/configuracion/precios` hacia `/agenda`, ausencia de costos/utilidad neta en `/` y creación exitosa de cotización enviada a WhatsApp.
   - Agendar dos citas simultáneas para la misma especialista en `/s/[slug]` y confirmar respuesta `409` sin doble reserva.
