# Auditoría Forense Total · Plataforma Veli

> **Tipo:** solo lectura (cero cambios en código, tests o migraciones).
> **Rama auditada:** `main` @ `686a773` (incluye Fase P0).
> **Fecha:** 2026-11-28.
> **Método:** grafo estático de imports desde los 41 entrypoints de Next.js (`app/**/page|layout|route`, `proxy.ts`, `next.config.ts`) sobre 247 archivos, conteo de LOC, búsqueda de símbolos/clases CSS y lectura dirigida de código y SQL (`supabase/*.sql`).
> **Disparador:** una cuenta `nail_bar` sigue viendo el cotizador de colorimetría y el identificador de tipos de rizo.

---

## 1. Resumen ejecutivo y diagnóstico de salud

### 1.1 Diagnóstico en una frase

**Veli es hoy un software de peluquería de colorimetría con 4 verticales "pintadas" encima.** El sistema de verticales (`lib/flags/verticales.ts` → `hair_clinical_pack`) existe, está probado en tests, **pero tiene 0 consumidores en runtime**: ninguna pantalla, motor ni semilla consulta `organizations.vertical` para decidir qué mostrar o qué sembrar. Por eso el bug reportado no es un caso aislado sino el comportamiento por defecto de toda la app.

### 1.2 Conteo de hallazgos por severidad

| Severidad | Cantidad | Qué significa |
|---|---:|---|
| **Crítico** | **7** | Datos financieros falsos, violación de reglas innegociables (`AGENTS.md` §3) o fuga en rutas públicas. Bloquea vender a verticales no capilares. |
| **Alto** | **15** | Flujos rotos, brechas de RBAC/multi-tenant, promesas comerciales que no se cumplen. |
| **Medio** | **19** | Bugs acotados, fricción UX, deuda estructural. |
| **Bajo** | **10** | Restos de marca, código y dependencias sin uso, copy. |
| **Total** | **51** | |

### 1.3 Cifras de salud del código

| Métrica | Valor |
|---|---|
| Archivos de producción inalcanzables desde cualquier ruta | **47** |
| LOC eliminables sin tocar ningún test (Ola A segura) | **≈ 7.540** |
| LOC de motores capilares solo sostenidos por tests (`lib/cortes`, seeds de `lib/kb`) | **≈ 5.950** (sostienen **129 tests**) |
| Archivos > 1.000 líneas en `app/` + `components/` | 8 (`app/page.tsx` 2.212 · `components/wizard/CameraCapture.tsx` 2.108 · `app/configuracion/precios/page.tsx` 2.035 · `components/wizard/PasoCabello.tsx` 1.307 · `components/vitrina/VitrinaPublicaClient.tsx` 1.263 · `components/wizard/PasoPlan.tsx` 1.085 · `app/clientas/[id]/page.tsx` 1.032 · `app/reportes/page.tsx` 1.012) |
| `useState` en `app/page.tsx` | **37** |
| Clases CSS en `globals.css` sin uso | 16 |
| Clases CSS usadas pero inexistentes | `v-gradient-hero`, `v-grain` (rompen 3 pantallas) |
| Archivos con nombres/strings "Velli" o "Velvet" o color `#3B0D1E` | 57 |
| Dependencias npm sin ningún import | `dexie` |
| Lugares donde `organizations.vertical` sí se usa | 5 (selector de catálogo, guía de medición, tarjeta de madurez, placeholder del buscador público, índice de precios) |

### 1.4 Las 5 decisiones que más mueven la aguja

1. **Conectar `hair_clinical_pack` a la UI y a las semillas** (resuelve C1–C4 y la mayoría de fugas del §2).
2. **Dejar de sembrar químicos capilares** en cuentas que no son `hair_studio` y dejar de re-inyectarlos (C2).
3. **Congelar los campos financieros de `cotizaciones` cobradas** y mover correcciones a eventos compensatorios (C6).
4. **Decidir qué hacer con `lib/cortes` y los seeds de `lib/kb`**: borrarlos baja el conteo de tests de 408 a 279 (< piso de 390). Hay que reemplazar esa cobertura antes (§3.3).
5. **Unificar el modelo comercial** (`lib/subscription/plans.ts`, `/planes`, `PAGOS.md`) con el posicionamiento multi-vertical y precios objetivo.

---

## 2. Mapa de fugas por vertical

**Causa raíz común:** `hairClinicalPackActivo()` / `evaluarHairClinicalPack()` solo se llaman desde `tests/multitenant.rbac.test.ts`. Además, el helper que usan casi todas las pantallas, `obtenerOrganizacionActivaPanel` (`lib/vitrina/cliente.ts:111`), hace `.select('id, slug, name, city, whatsapp_phone')` y **ni siquiera lee `vertical`**.

Verticales afectadas: **N** = `nail_bar` · **B** = `barber_studio` · **S** = `spa_estetica` · **L** = `beauty_lounge`.

### 2.1 Cotizador químico, gramos y variables capilares

| Archivo / Ruta | Qué aparece mal | Verticales | Solución recomendada |
|---|---|---|---|
| `app/page.tsx:252-263, 500-517` | Fuerza `largo:'medio'`, `densidad:'media'`, `estado:'sana'`, `canas:'0_25'` en toda cotización | N B S L | Inicializar variables solo si `hairClinical.packActivo`; si no, `variables = null` |
| `app/page.tsx:641-667` + `lib/semilla-financiera.ts:279-316` | Recargo automático `+$20.000` por "cabello medio" al abrir Silla | N B S L | No aplicar `normalizarAjustesVelvetStudio` fuera de `hair_studio` |
| `app/page.tsx:702-705` | `usaCalculoGramos = true` para toda categoría ≠ `corte`/`peinado` → manicura con 90 g de tinte + peróxido | N S L (y rituales B) | Usar `perfil_extendido.costTrackingMode` y `usaFormulaColor` del servicio |
| `app/page.tsx:879` | `gramosBase \|\| semillaActual.gramosBase` → muestra "60 g" en un corte de barbería | B | Quitar fallback a semilla |
| `app/page.tsx:1384-1451` | Tarjeta de servicio con "60 g base · Químico / Decoloración" | N B S L | Badge según `costTrackingMode` |
| `app/page.tsx:1457-1695` | Tarjeta 2 "Diagnóstico Capilar Táctil + IA" (longitud, densidad, porosidad, canas, `SelectorTramoCanas`) | N B S L | Envolver en `hairClinical.diagnosticoCapilar` |
| `app/page.tsx:1698-1833` | "Guardarraíles Clínicos (lib/color/reglas.ts)": henna, tricoptilosis, prueba de mechón | N B S L | Envolver en `hairClinical.colorimetria`; quitar ruta de archivo del label |
| `app/page.tsx:1842-2127` | Ticket "MOTOR FINANCIERO SIN BÁSCULA", dosificación g/ml, `±5 g`, "Costo Químico Descontado" | N B S L | Ticket genérico "Insumos del servicio" para `consumibles_fijos`/`monodosis_kit` |
| `components/cotizador/ListaPorCobrar.tsx:205-266, 465-511` | Píldora `{g}g` y columna "Química" en cada pendiente | N B S L | Mismo criterio de `costTrackingMode` |
| `app/configuracion/precios/page.tsx:91-118, 809, 839` | Categorías y tipos de producto solo capilares; pestaña "Catálogo Químico (`$/g`, `$/ml`)" | N B S L | Catálogo de categorías por vertical (ya existe en `catalogoMaestroColombia.ts`) |
| `app/configuracion/precios/page.tsx:1083-1179, 1202-1478, 1840-2028` | Factores capilares, "Fórmula sin báscula", simulador con largo/densidad/canas | N B S L | Ocultar fuera de `hair_clinical_pack` |
| `app/reportes/page.tsx:555-606, 648-769, 798, 883` | KPI "Costo Químico", sección "Gramos teóricos vs reales", colilla "Química capilar empleada" | N B S L | Etiqueta "Insumos"; sección de gramos solo si hay servicios `sin_bascula_mezcla` |
| `app/onboarding/page.tsx:184-213` | Publica plantillas con `AJUSTES_VELVET_STUDIO_DEFECTO`, `FACTORES_CONSUMO_DEFECTO` y `gramosTinteBase: 60` para uñas/masajes | N B S L | Plantilla neutra (ajustes vacíos, 0 g) según `cost_tracking_mode` del ítem del catálogo |
| `app/onboarding/page.tsx:571-623` | Paso 3 habla de "cazos 30 g, tubos 60 g", "`$320/g` decolorante" | N B S L | Usar `GUIA_MEDICION_POR_VERTICAL` (ya existe) |
| `app/auth/login/page.tsx:46-48`, `app/auth/registro/page.tsx:134-136` | Badge "Sin Báscula", "protege tu margen químico" | Todas (pre-registro) | Copy transversal ("controla tu margen por servicio") |

### 2.2 Identificador de rizo, diagnóstico capilar e IA

| Archivo / Ruta | Qué aparece mal | Verticales | Solución recomendada |
|---|---|---|---|
| `app/page.tsx:1243-1268` | Badge de textura `'2B'` por defecto en cada cliente | N B S L | Mostrar solo si `packActivo` y hay dato real |
| `app/page.tsx:1474-1500, 2167-2194` | Botón "Analizar Foto con IA (Claude Vision)" → `CameraCapture` → `/api/validate-hair-photo` + `/api/analyze-hair` | N B S L | Gate doble: `hairClinical.packActivo && plan.diagnosticoIA` |
| `app/clientas/page.tsx:38, 156-170, 270-291, 504, 525-529` | Filtros Liso/Ondulado/Rizado/Coily (contadores siempre en 0), avatar por `toneFromTipoRizo` | N B S L | Filtros por vertical (ej. "Por reactivar", "Nuevos", "VIP") |
| `app/clientas/nueva/page.tsx:96, 180-295` | "Perfil & Salud Capilar", "PPD, amoníaco, decolorantes" | N B S L | Bloque "Sensibilidades y notas" genérico + bloque capilar condicional |
| `app/clientas/[id]/page.tsx:615-619, 764-815, 931-996` | Badge de rizo, "Alergias a productos capilares", "Diagnósticos Capilares" + `HistorialTimeline` | N B S L | Condicional al pack; historial unificado de citas + cobros |
| `components/clienta/SeguridadLegal.tsx:109-423` | "Nueva en color", "Cambio de marca química", "Parche en la nuca", bloqueo por alopecia | N B S L | Reglas de consentimiento por vertical (uñas: TPO/alergia acrílico; spa: contraindicaciones) |
| `components/clienta/HistorialTimeline.tsx` | Porosidad/densidad/grosor; mensaje WA "🌿 Velli — Diagnóstico Capilar" | N B S L | Condicional + renombrar marca |

### 2.3 Semillas financieras inyectadas sin mirar la vertical

| Archivo / Ruta | Qué ocurre | Verticales | Solución recomendada |
|---|---|---|---|
| `lib/cotizador/db.ts:790-815` (`sembrarBaseFinancieraSalon`) | Si `productos_salon` está vacío inserta 6 químicos capilares (decolorante, tinte, matizante, peróxido, alisado, máscara) | N B S L | Recibir `vertical` y sembrar desde un catálogo de insumos por vertical (o no sembrar) |
| `lib/cotizador/db.ts:866-905` | **Re-inyecta** los químicos si no encuentra el tinte de `$27.900` o la máscara, aunque el negocio los haya borrado | N B S L | Eliminar la lógica de "auto-reparación" de semillas |
| Disparadores: `app/onboarding/page.tsx:308, 335` · `app/page.tsx:352-399` · `app/configuracion/precios/page.tsx:230, 242` · `ListaPorCobrar.tsx:150-157` | Cada visita a esas pantallas puede volver a sembrar | N B S L | Sembrar una sola vez, en servidor, al terminar onboarding |
| `app/page.tsx:352-363` (`sembrarServiciosDesdeOnboarding`) | Siembra Balayage/Tinte/Alisado/Hidratación si no hay servicios | N B S L | Sembrar desde el Pack Popular de la vertical |
| `lib/semilla-financiera.ts:226-252` + copia en `app/page.tsx:123-151` | `obtenerSemillaServicio` cae por defecto en "Color Global" (`$120.000`, 60 g, `$465/g`, `requiereQuimico: true`) | N B S L | Fallback neutro sin química; borrar la copia duplicada |
| `lib/vitrina/servidor.ts:58-62, 145-152` | Servicio sin plantilla se publica en `/s/[slug]` a `$120.000` | N B S L | No publicar servicios sin precio, o mostrar "Consultar" |

### 2.4 Copy capilar o en femenino en pantallas transversales

| Archivo | Ejemplos | Solución |
|---|---|---|
| `lib/clientas/reactivacion.ts:125-127` | WhatsApp de reactivación: "consentir tu cabello", "mantenimiento capilar" (llega a clientes de barbería, uñas y spa) | Plantillas por vertical |
| `app/agenda/page.tsx:503` | Fallback "Servicio capilar" | "Servicio" |
| `app/vitrina/page.tsx:80, 157, 600, 631, 779` + `lib/vitrina/cliente.ts:175` | Categoría por defecto "Cuidado Capilar", "Shampoo Nutritivo" | Categoría por vertical |
| `components/vitrina/VitrinaPublicaClient.tsx:1045` | Placeholder de reserva "Tengo tinte previo o largo medio" | Placeholder por vertical |
| `components/vitrina/VitrinaPublicaClient.tsx:132-139` | Placeholder del buscador cubre 4 verticales; falta `beauty_lounge` | Agregar caso |
| `lib/cotizador/whatsapp.ts:16-17` → `app/c/[token]/page.tsx:447` | Pie legal público: "si al momento del servicio el cabello requiere…" | Texto neutro |
| `lib/cotizador/variables.ts:66-100` | "Hasta el mentón", "Se ve el cuero cabelludo" | Correcto solo dentro del pack capilar |
| `app/page.tsx:1219-1320`, `app/clientas/**`, `app/agenda/page.tsx:612, 640`, `ListaPorCobrar.tsx:281, 405, 544, 625`, `app/configuracion/precios/page.tsx:1506, 1571, 1722` | "Clienta", "Nueva Clienta", "Especialista asignada", "¿Estás segura?", "Todas las especialistas" | Copy neutro (`AGENTS.md` §2): Cliente, Especialista, Estudio |
| `supabase/migration-multitenant-rbac.sql:336` | `handle_new_user` pone `'Estilista'` como nombre por defecto | Valor neutro (migración aditiva) |
| `lib/organizations/navegacion.ts:30-31` + `VelvetTopHeader.tsx:72, 372` | Pestaña fija "Workspace (Silla)" con ícono tijera | Etiqueta por vertical (Silla / Mesa / Cabina / Estación) |

---

## 3. Tabla de decisión de módulos y código legado

### 3.1 Clasificación por módulo

| Módulo / carpeta | LOC aprox. | Acción | Motivo |
|---|---:|---|---|
| `proxy.ts`, `lib/supabase/*`, `lib/api/*`, `lib/organizations/*`, `lib/sitio.ts` | ≈ 1.050 | **CONSERVAR** | Núcleo de sesión, RBAC y multi-tenant |
| `lib/cotizador/precio.ts`, `comision.ts`, `whatsapp.ts`, `db.ts` | ≈ 2.400 | **REDISEÑAR_O_CORREGIR** | Núcleo correcto, pero con semillas capilares, `user_id` legado y fallbacks de 60 g |
| `lib/cotizador/costo.ts`, `variables.ts`, `lib/costo.ts` | ≈ 450 | **AISLAR_POR_VERTICAL** | Motor de gramos útil solo para `sin_bascula_mezcla` |
| `lib/semilla-financiera.ts` | 317 | **REDISEÑAR_O_CORREGIR** | Debe pasar a semillas por vertical; eliminar `normalizarAjustesVelvetStudio` |
| `lib/catalogos/*`, `lib/datos/*`, `components/catalogos/*`, `components/datos/*` | ≈ 5.100 | **CONSERVAR** | Fase P0, ya multi-vertical (ajustar `madurezDatos` §4.6) |
| `lib/agenda/disponibilidad.ts`, `lib/agenda/cliente.ts` | 521 | **CONSERVAR** | Agenda nueva (`appointments`), zona horaria correcta |
| `lib/agenda/citas.ts`, `lib/agenda/reglas.ts`, `components/agenda/CitasServicio.tsx`, `lib/cortes/preagenda.ts` | 978 | **ELIMINAR** (tras portar guardarraíles) | Agenda legada `public.citas`; las reglas de parche 48 h y bloqueo tipo 4 deben migrarse a `appointments` dentro del pack capilar |
| `lib/vitrina/*`, `components/vitrina/*`, `app/s/[slug]`, `app/api/public/*` | ≈ 2.700 | **REDISEÑAR_O_CORREGIR** | Arquitectura sana; corregir precio de respaldo, categorías y placeholders |
| `app/page.tsx` (Silla) | 2.212 | **REDISEÑAR_O_CORREGIR** | Monolito; separar en `SillaShell` + módulos por `costTrackingMode` |
| `components/cotizador/ListaPorCobrar.tsx` | 696 | **REDISEÑAR_O_CORREGIR** | Sobrescribe costos al cobrar; no cierra la cita |
| `lib/color/reglas.ts`, `calculadora.ts`, `integracion.ts`, `components/color/SelectorTramoCanas.tsx` | ≈ 890 | **AISLAR_POR_VERTICAL** | Colorimetría CO-01..CO-10; valiosa solo en `hair_studio` |
| `components/wizard/CameraCapture.tsx`, `lib/captureQuality.ts`, `lib/hairAnalysis.ts`, `lib/ia/uso.ts`, `app/api/analyze-hair`, `app/api/validate-hair-photo`, `lib/kb/promptsServidor.ts`, `lib/kb/tipos.ts`, `lib/kb/marcas.ts` | ≈ 4.130 | **AISLAR_POR_VERTICAL** | IA capilar (Anthropic); solo `hair_studio` + plan con IA |
| `components/clienta/HistorialTimeline.tsx`, `lib/pdfGenerator.ts`, `lib/diagnosticEngine.ts` | ≈ 1.890 | **AISLAR_POR_VERTICAL** | Historial y PDF de diagnóstico capilar |
| `components/clienta/SeguridadLegal.tsx`, `lib/consentimientos.ts`, `components/legal/*` | ≈ 870 | **REDISEÑAR_O_CORREGIR** | Consentimientos necesarios, pero hoy 100% químico-capilares |
| `lib/db.ts` (CRM) | 847 | **REDISEÑAR_O_CORREGIR** | `user_id` legado en upsert/borrado; no actualiza visitas |
| `app/configuracion/precios/page.tsx` | 2.035 | **REDISEÑAR_O_CORREGIR** | Falta CRUD; simulador ilegible; laboratorio capilar para todos |
| `app/reportes/page.tsx` | 1.012 | **REDISEÑAR_O_CORREGIR** | Sin ledger de nómina; etiquetas químicas fijas |
| `app/planes/page.tsx`, `lib/subscription/*` | ≈ 500 | **REDISEÑAR_O_CORREGIR** | Precios, copy y features desalineados |
| `components/subscription/SubscriptionBanner.tsx` | 141 | **REDISEÑAR_O_CORREGIR** | Huérfano: nadie avisa del fin del trial. Montarlo en el shell |
| `components/v2/VelvetTopHeader.tsx`, `VelvetImageUploader.tsx`, `Btn`, `Chip`, `AvatarV2`, `SettingsIconButton` | ≈ 890 | **CONSERVAR** (renombrar) | Sistema activo; nombres heredados "Velvet" |
| `components/marca/EditorMarca.tsx` | 126 | **ELIMINAR** (fusionar) | Duplica `VelvetImageUploader`; solo maneja logo y usa `var(--font-serif)` italic |
| `lib/payments/*` | 289 | **CONSERVAR** (congelado) | Correcto; nombres de env verificados (§4.8) |
| `lib/flags/registro.ts` | — | **CONSERVAR** (congelado) | No tocar (`AGENTS.md` §4) |
| `lib/flags/verticales.ts`, `lib/flags/index.ts` | ≈ 250 | **REDISEÑAR_O_CORREGIR** | Correctos pero sin consumidores: conectarlos |
| `supabase/_archive/*` | 2.238 | **CONSERVAR** | Historial de migraciones; no se ejecuta |

### 3.2 Candidatos a **ELIMINAR** sin impacto en tests (Ola A segura)

Todos tienen **0 importadores desde rutas activas y 0 tests**. Verificado con el grafo de imports.

| Archivo(s) | LOC | Rutas que lo usan | Tests ligados |
|---|---:|---|---:|
| `components/wizard/PasoCabello.tsx`, `PasoClienta.tsx`, `PasoPlan.tsx`, `PreguntasFlujo.tsx`, `RizoPatterns.tsx`, `StepClienta.tsx`, `StepCueroCabelludo.tsx`, `StepDiagnostico.tsx`, `StepHistorial.tsx`, `StepTipoRizo.tsx`, `ConsentimientoGate.tsx` | 4.429 | Ninguna (wizard de rizos retirado) | 0 |
| `components/resultado/ResultadoDiagnostico.tsx` | 452 | Ninguna | 0 |
| `components/dashboard/ChecklistInicio.tsx`, `ClientaCard.tsx`, `SearchBar.tsx`, `StatCard.tsx` | 519 | Ninguna | 0 |
| `components/layout/Header.tsx`, `Footer.tsx`, `ProgressBar.tsx` | 220 | Ninguna (`ProgressBar` solo lo usa `StepBarV2`, también huérfano) | 0 |
| `components/v2/InnerHeader.tsx`, `Masthead.tsx`, `SectionLabel.tsx`, `StatTile.tsx`, `StepBarV2.tsx` (+ sus exports en `components/v2/index.ts`) | 458 | Ninguna | 0 |
| `components/ui/Avatar.tsx`, `Badge.tsx`, `Button.tsx`, `Card.tsx`, `CheckboxGroup.tsx`, `Select.tsx`, `Toggle.tsx` | 369 | Solo componentes huérfanos | 0 |
| `components/agenda/CitasServicio.tsx` | 491 | Ninguna | 0 |
| `components/cortes/Siluetas.tsx` | 145 | Ninguna | 0 |
| `lib/kb/admin.ts`, `lib/kb/diagnostico.ts` | 344 | Solo `PreguntasFlujo` (huérfano) | 0 |
| `lib/color/registro.ts` | 90 | Ninguna | 0 |
| *(Nota: `lib/sentry.ts` sí se usa desde los entrypoints raíz `instrumentation-client.ts` y `sentry.*.config.ts`: **CONSERVAR**)* | — | Raíz Sentry | 0 |
| Dependencia `dexie` (`package.json:20`) | — | 0 imports | 0 |
| Clases CSS sin uso en `app/globals.css` (`font-brand`, `v-serif`, `v-display`, `v-sans`, `v-eyebrow`, `v-ticks`, `v-card-flat`, `v-safe-top`, `v-safe-bottom`, `v-photo`, `selection-card`, `v-fade`, `animate-fade-in-up`, `icon-pulse`, `animate-pulse-soft`, `pb-nav`) y alias `--font-serif`, `--font-dm-serif`, `--font-dm-sans` | ≈ 60 | — | 0 (cuidar `tests/veli.neutral-base.test.ts`, que solo exige los tokens) |
| **Total** | **≈ 7.600** | | **0** |

### 3.3 Candidatos a **ELIMINAR** que sí tienen tests (requieren decisión)

> [!WARNING]
> Eliminar estos módulos baja la suite de **408 a 279 tests**, por debajo del piso obligatorio de **390** (`AGENTS.md` §1). Antes hay que escribir al menos 111 tests nuevos (por ejemplo, del aislamiento por vertical de la Ola B) o conservarlos aislados.

| Módulo | LOC | Uso en producción | Tests ligados | Recomendación |
|---|---:|---|---:|---|
| `lib/cortes/*` (8 archivos) + `lib/kb/seed/cortes.ts` | 1.649 | Ninguno. `/cortes` redirige a `/` en `next.config.ts` | `tests/cortes.test.ts` (42) + `tests/cortes.integracion.test.ts` (32) = **74** | ELIMINAR en Ola A2, cuando la Ola B aporte ≥ 74 tests nuevos. Revisar referencias en `tests/flags.test.ts` |
| `lib/kb/evaluador.ts` + `lib/kb/seed/reglasFase2.ts` + `lib/kb/seed/reglasRizado.ts` | 4.112 | Ninguno (motor del wizard de rizos retirado) | `tests/diagnostico.fase2.test.ts` (37) + `tests/diagnostico.regresion.test.ts` (18) = **55** | Igual que arriba |
| `lib/kb/seed/contenido.ts` + `lib/kb/seed/colorimetria.ts` | 1.162 | Indirecto (fuente de los prompts de IA) | `tests/prompts.sync.test.ts` (3), parte de `tests/colorimetria.integracion.test.ts` | **AISLAR**, no eliminar, mientras exista la IA capilar |

### 3.4 Candidatos a **AISLAR_POR_VERTICAL** (útiles solo en `hair_studio`)

| Módulo | LOC | Dónde aparece hoy | Tests | Cómo aislar |
|---|---:|---|---:|---|
| Diagnóstico capilar táctil (Tarjeta 2 de Silla) | ≈ 240 en `app/page.tsx` | `/` | — | `hairClinical.diagnosticoCapilar` |
| Colorimetría CO-01..CO-10 (`lib/color/*`, `SelectorTramoCanas`) | ≈ 890 | `/` | `colorimetria.test.ts` (54) + `colorimetria.integracion.test.ts` (26) | `hairClinical.colorimetria` |
| Motor "Sin Báscula" (gramos, peróxido, `±5 g`) | ≈ 450 + UI | `/`, Por Cobrar, `/configuracion/precios`, `/reportes` | parte de `cotizador.test.ts` (25) | `costTrackingMode === 'sin_bascula_mezcla'` |
| IA de foto capilar (`CameraCapture`, `/api/analyze-hair`, `/api/validate-hair-photo`, `lib/ia/uso.ts`) | ≈ 4.130 | `/` | `ia.uso.test.ts` (12) + `ia.sin-respaldo.test.ts` (13) | `packActivo && plan.diagnosticoIA` (UI y endpoint) |
| Identificador de rizo (filtros, badges `getRizoLabel`, `toneFromTipoRizo`) | ≈ 120 | `/clientas`, `/clientas/[id]`, `/` | — | `packActivo` |
| Salud capilar y `SeguridadLegal` químico | ≈ 600 | `/clientas/nueva`, `/clientas/[id]` | — | Bloque genérico + capilar condicional |
| Historial de diagnósticos y PDF (`HistorialTimeline`, `pdfGenerator`, `diagnosticEngine`) | ≈ 1.890 | `/clientas/[id]` | — | Mostrar solo si hay consultas y `packActivo` |
| Semillas químicas (`CATALOGO_QUIMICO_SEMILLA`, `SERVICIOS_BASE_SEMILLA`) | ≈ 180 | Onboarding, Silla, Precios, Por Cobrar | `cotizador.test.ts` | Solo `hair_studio` |
| Consentimiento químico automático al aceptar `/c/[token]` | ≈ 50 | `app/api/cotizaciones/[token]/aceptar/route.ts:108-159` | — | Solo si el servicio requiere química |

---

## 4. Hallazgos detallados por área

Formato: **[ID · Severidad]** archivo:línea — hallazgo. *Causa raíz.*

### 4.1 Auth y Onboarding (`/auth/*`, `/onboarding`)

- **[C5 · Crítico]** `supabase/migration-multitenant-rbac.sql:359` + `lib/organizations/index.ts:153-166` + `app/onboarding/page.tsx:109, 263, 297, 320-344` — Toda cuenta nace como `hair_studio`, y cambiar la vertical en onboarding **puede fallar sin aviso** por 3 vías: (1) `actualizarContextoOrganizacionCliente` solo hace `console.warn` ante error y no verifica filas afectadas; (2) si la lectura inicial de la organización falla, `orgId` queda `null` y se omite el update; (3) "Saltar configuración" nunca guarda la vertical. Después del onboarding no hay ninguna pantalla para cambiarla. *Causa: el registro no pregunta la vertical y la persistencia no es transaccional ni verificada.*
- **[A8 · Alto]** `app/onboarding/page.tsx:218-249`, `app/configuracion/page.tsx:176-198` — El nombre del estudio, ciudad y WhatsApp se guardan en `profiles`, pero no en `organizations.name`, `organizations.whatsapp_phone` ni `brand_settings.display_name`. La vitrina pública queda con "Mi Salón" o con el nombre personal, y el `slug` queda como `mi-salon-xxxxxxxx` para siempre. *Causa: doble fuente de verdad `profiles` vs `organizations`.*
- **[A9 · Alto]** `app/page.tsx:321-324` — Es el único lugar que redirige a `/onboarding` si no está completo. `/agenda`, `/clientas`, `/vitrina`, `/reportes`, `/configuracion/*` y `/planes` se pueden abrir sin haber terminado el onboarding, y algunas siembran datos capilares. `lib/profile.ts:84` usa `?? true` (si el campo falta, da el onboarding por completado). *Causa: la guardia vive en una página cliente y no en `proxy.ts` ni en un layout de servidor.*
- **[M10 · Medio]** `app/onboarding/page.tsx:88, 131-133` — El paso actual vive en `useState`; recargar devuelve al Paso 1 y borra tarifas editadas, segmento y servicios personalizados.

### 4.2 Workspace Silla (`/`)

- **[C1 · Crítico]** `lib/flags/verticales.ts:146-173`, `lib/flags/index.ts:61-70` — `hair_clinical_pack` no tiene consumidores en runtime. *Raíz de todo el §2.*
- **[C3 · Crítico]** `app/page.tsx:702-705` — Costo químico calculado para servicios que no lo tienen. Ejemplo verificado: manicura de `$45.000` → cotizada en `$65.000` con `$48.230` de "costo químico", lo que destruye la comisión y el margen reportados.
- **[C4 · Crítico]** `app/page.tsx:258, 641-667` + `lib/semilla-financiera.ts:298-309` — Recargo automático de `+$20.000`, y **el dueño no puede dejar los recargos en `$0`**: si todos los recargos de largo son 0, la función asume que son "datos legados" y los reemplaza por los de Velvet Studio.
- **[A1 · Alto]** `app/page.tsx:204-209` + `components/cotizador/ListaPorCobrar.tsx:268-312` — Se descarta el `appointmentId` que manda la Agenda. La cita queda en `in_chair` para siempre; no se dispara el trigger que actualiza `clientas.ultima_visita`/`total_visitas`; **el motor de reactivación nunca ve a los clientes atendidos en Silla**, y "Madurez de datos" tampoco cuenta esas citas.
- **[A10 · Alto]** `components/cotizador/ListaPorCobrar.tsx:205-266, 288-297` — Al cobrar se recalculan costo y comisión con otra lógica (toma el primer producto en gramos, ignora recargos de insumos, no aplica el 40% por defecto) y **se sobrescriben** los valores guardados al cotizar.
- **[M1 · Medio]** `app/page.tsx:879` — Muestra "≈ 1 tubo (60 g)" y "Químico `$27.900`" bajo un corte con 0 g.
- **[M2 · Medio]** `app/page.tsx:1012-1029` — Calcula en pantalla con recargos fijos en COP, pero si no había plantilla publica una con `AJUSTES_EJEMPLO_PLANTILLA` (porcentuales). La siguiente cotización sale con otro precio.
- **[M3 · Medio]** `app/page.tsx:1072, 1090-1103` — `window.open` de WhatsApp después de varios `await`: Safari/iOS lo bloquea. Si falla `enviarCotizacion`, la cotización queda en `borrador` sin aparecer en Por Cobrar.
- **[M17 · Medio]** `app/page.tsx` — 2.212 líneas, 37 `useState`, 10 consultas en paralelo al montar, lógica de semillas dentro de la página. *Mantenimiento de alto riesgo.*
- **[B4 · Bajo]** `app/page.tsx:1701` — El label visible incluye la ruta "lib/color/reglas.ts". `L1742`: `bg-[#B45309]` donde debería ser `text-`. Colores heredados `#6E4F5D` en `L1155, 1169, 1180, 2014`.

**Comportamiento esperado de `/` para negocios sin mezcla química:** tarifa base limpia (recargo `$0`), sin Tarjeta 2, sin guardarraíles de colorimetría, sin cámara capilar; insumos fijos o kit por servicio según `costTrackingMode`; copy neutro; y el `appointmentId` conservado hasta el cobro para cerrar la cita.

### 4.3 Agenda (`/agenda`)

- **[A2 · Alto]** `app/agenda/page.tsx:115, 182-207, 674-684, 903-973` + `supabase/migration-agenda-puente.sql:319-334` — Un `specialist` ve el 100% de la agenda (nombres y WhatsApp de clientes de otros), puede crear citas a nombre de cualquiera y **cancelar citas ajenas**. No existe relación entre el usuario (`organization_members.user_id`) y su fila de `estilistas`, así que el sistema no sabe "quién es quién". *Causa: falta `estilistas.member_id`; RLS por organización, no por especialista.*
- **[A13 · Alto]** Dos agendas paralelas: `public.appointments` (activa, con exclusión de solapes y bitácora) y `public.citas` (legada, `lib/agenda/citas.ts`, `reglas.ts`, `CitasServicio.tsx`). Los guardarraíles legales (parche 48 h, consentimiento previo a decolorar, bloque extendido para cabello tipo 4) **solo existen en la legada, que ya no se usa**.
- **[M4 · Medio]** `app/agenda/page.tsx:133, 249, 723-748` — El `<select>` de hora muestra el primer horario libre pero el estado sigue en `'10:00'`: se agenda a la hora equivocada o choca con el trigger de horario.
- **[M5 · Medio]** `app/agenda/page.tsx:84-87, 919-974` + `lib/agenda/cliente.ts:43-126` — El estado `no_show` existe pero no hay botón para marcarlo; no hay reprogramación ni edición (solo cancelar y volver a crear).
- **[OK]** Zona horaria `America/Bogota` correcta en el motor nuevo (`lib/agenda/disponibilidad.ts:106-147`) y en SQL. La legada usa `toISOString().slice(0,10)` (salta de día después de las 19:00).

### 4.4 Clientes CRM (`/clientas`, `/clientas/nueva`, `/clientas/[id]`)

- **Por qué aparece el identificador de rizo:** el modelo `Clienta` (`lib/types.ts:16`, `tipo_cabello_principal`) nació para el wizard de rizos (hoy huérfano, §3.2). Sus artefactos visuales quedaron en el CRM sin ningún gate.
- **Persistencia:** 100% Supabase (`lib/db.ts`) + un espejo en `localStorage` (`velli_reactivacion_contactos_v1`). **Dexie no se usa.**
- **[A14 · Alto]** `lib/db.ts:387-394` — `updateClienta` hace `upsert` con `user_id` del usuario actual: si un `manager` o `specialist` edita un cliente, se queda con él. `lib/db.ts:840-846` — `clearAllData` borra por `user_id` y no por `organization_id`.
- **[M16 · Medio]** `app/clientas/page.tsx:80-82` — La búsqueda ignora el teléfono. `/clientas/[id]` no muestra las citas (`appointments`), solo cotizaciones y la tabla legada `consultas`.
- **[B8 · Bajo]** `lib/db.ts:241` — `numeroConsulta` siempre es 1.
- **Qué falta:** actualizar visitas al cobrar o completar cita (A1); notas y sensibilidades genéricas; historial unificado de citas y cobros; plantillas de reactivación por vertical.

### 4.5 Vitrina pública y pedidos (`/vitrina`, `/s/[slug]`, `/c/[token]`)

- **[C7 · Crítico]** `app/c/[token]/page.tsx:44-72, 118, 401-410` — La página pública lee `cotizaciones.variables` con `createAdminClient()` y muestra píldoras capilares: "Longitud: Medio, Densidad: Media, Fibra: Sana" en una manicura, y **"Fibra: Sensibilizada / muy dañada"** en servicios capilares. Contradice `lib/cotizador/whatsapp.ts:7` ("NUNCA incluyen datos clínicos ni del diagnóstico") y `AGENTS.md` §3 (privacidad en rutas públicas). Además, `app/api/cotizaciones/[token]/aceptar/route.ts:108-159` registra un `consentimiento_quimico` al aceptar **cualquier** cotización.
- **[A3 · Alto]** No existe `app/vitrina/layout.tsx` y `/vitrina` no está en `SPECIALIST_RESTRICTED_PREFIXES` (`lib/organizations/navegacion.ts:71-75`, contradice su propio comentario en `L11`). Un `specialist` que entre por URL ve todos los pedidos con nombres, teléfonos y montos.
- **[A5 · Alto]** `supabase/migration-multitenant-rbac.sql:156, 305, 369`, `migration-vitrina-editorial.sql:281` — `brand_settings.primary_color` tiene `DEFAULT '#3B0D1E'` y las RPC públicas hacen `coalesce(…, '#3B0D1E')`. `lib/organizations/brand.ts:20` no rechaza ese color. Resultado: el color prohibido sale en `/s/[slug]` y `/c/[token]`.
- **[A15 · Alto]** `lib/vitrina/servidor.ts:58-62` (precio de respaldo de `$120.000`), `VitrinaPublicaClient.tsx:628-634` ("Desde" forzado, ignora `esPrecioDesde`), `VitrinaPublicaClient.tsx:53-68` + `SelectorCatalogoColombia.tsx:46-64` (todo lo no capilar cae en la categoría `otro` → desaparecen los filtros; un platinado de barbería aparece como "Diseño de Rubios").
- **[M11 · Medio]** `app/api/public/appointments/route.ts:327-339` — Busca al cliente por teléfono entre solo 200 filas en memoria; a partir del cliente 201 deja de vincularlo.
- **[M6 parcial]** Los pedidos de `public_orders` completados no llegan a `/reportes`; las consultas de servicio desde la vitrina se guardan como pedidos y no como citas. `catalog_products` solo tiene `in_stock` (sin inventario por movimientos).
- **[OK]** `/s/[slug]` no expone costos, fórmulas ni comisiones; rate limit y `no-store` en `/api/public/*`.

### 4.6 BI, nómina y madurez de datos (`/reportes`)

- **[C6 · Crítico]** `supabase/velli-bi-cotizador.sql:406-449` — El trigger `cotizaciones_ciclo` congela precio cotizado y variables, pero **permite `UPDATE` directo** de `precio_cobrado`, `costo_producto_estimado`, `comision_estimada` y `estilista_id` en cotizaciones ya cobradas. `lib/cotizador/db.ts:1303-1319` (`corregirCobroCotizacion`) cambia `precio_cobrado` sin recalcular comisión. Viola `AGENTS.md` §3 (ledger append-only).
- **[A12 · Alto]** `app/reportes/page.tsx:292-334` — La liquidación de especialistas se calcula en el navegador cada vez. No hay cortes, estado "pagado" ni registro de pagos: un servicio aparece en "semana", "mes" y "30 días" sin saber si ya se pagó. El botón "Resumen WA" abre WhatsApp sin número (los especialistas no tienen teléfono guardado).
- **[M6 · Medio]** `app/reportes/page.tsx:279` — Sin ventas, pinta "0% margen" en verde. `L149-156`: el título usa el nombre del perfil del usuario (un `manager` ve su propio nombre).
- **[M7 · Medio]** `lib/datos/madurezDatos.ts:26, 129-152, 207, 238` — `usaQuimicaOSinBascula` está declarado pero no se usa; las dimensiones "costos" y "consumo" penalizan a negocios sin química y recomiendan "revisar decolorante, tinte, peróxido" y "ajusta `±5 g`". La dimensión de historial premia `tipo_cabello_principal` (`app/reportes/page.tsx:171-175`). Como no se pueden editar productos (A11), la dimensión de costos no se puede subir desde la interfaz.
- **[M8 · Medio]** `perfil_extendido.costTrackingMode` se guarda (`app/onboarding/page.tsx:176`, `app/configuracion/precios/page.tsx:441`) pero **ningún motor lo lee**.

### 4.7 Calibración de precios y configuración (`/configuracion`, `/configuracion/precios`)

- **[C2 · Crítico]** Ver §2.3: siembra y **re-siembra** de químicos capilares en cada carga de `/configuracion/precios`.
- **[A4 · Alto]** `app/configuracion/precios/page.tsx:1762`, `app/clientas/[id]/page.tsx:251, 561` — Usan `v-gradient-hero` y `v-grain`, que **no existen** en `globals.css`. Con `text-white` sobre fondo claro, el Simulador de Rentabilidad y el encabezado de la ficha de cliente quedan prácticamente ilegibles. Además llevan sombras `rgba(59,13,30,…)`.
- **[A11 · Alto]** `app/configuracion/precios/page.tsx:399-505, 1009-1197, 1443-1534` — No se pueden editar ni desactivar productos (`actualizarProductoSalon` existe en `lib/cotizador/db.ts:664` pero no se importa), ni renombrar servicios, cambiar su categoría o **su duración** (los creados a mano quedan sin duración), ni renombrar o desactivar "Especialista Principal". Overrides forzados en `L308-335, 701` impiden ciertos precios y gramos.
- **[M9 · Medio]** `components/marca/EditorMarca.tsx`, `app/configuracion/page.tsx:140-167, 439-466` — Solo se edita el logo. `primary_color`, `accent_color`, `public_tagline`, `legal_footer`, `custom_domain`, `slug` y `vertical` no tienen interfaz.
- **[M13 · Medio]** `lib/cotizador/db.ts:946-951` — Actualiza reglas de comisión en sitio en lugar de cerrar la vigente y crear una nueva.
- **[M14 · Medio]** `productos_salon.precio_compra` se cambia con `UPDATE` directo, sin historial de compras (inmutabilidad de inventario, `AGENTS.md` §3).
- **[OK]** `plantillas_precio` está bien blindada: trigger `PLANTILLA_INMUTABLE` + RPC `publicar_plantilla_precio`.

### 4.8 Planes y pagos (`/planes`, `lib/payments/bold.ts`)

- **[A6 · Alto]** `lib/subscription/plans.ts:51-136`, `app/planes/page.tsx:140-148` — UI con 2 planes: **Studio BI `$89.000`** y **Salón Pro + IA `$149.000`** (más `basico $25.000` oculto). El posicionamiento objetivo es `$99k / $179k / $299k`. Todo el copy es capilar ("un solo servicio de color…", "gramos de decolorante…", "Asistente visual IA de porosidad, densidad y canas"). Para uñas, barbería, spa o maquillaje el plan de `$149k` solo aporta quitar el sello Veli. No se mencionan Agenda ni Vitrina. `exportacionExcel: true` se promete pero no existe (solo hay exportación JSON). `PAGOS.md:19-24` documenta precios viejos (`$25k/$60k/$120k`). "Clientas ilimitadas" en femenino.
- **[A7 · Alto]** Suscripción no multi-tenant: `suscripcion_efectiva()` (`supabase/_archive/migration-suscripciones.sql:152-209`) busca por `auth.uid()`, así que un `manager` o `specialist` ve la cuenta como vencida aunque el `owner` pague. `app/planes/layout.tsx:9` deja entrar a `manager` y `/api/pagos/checkout` solo exige sesión: si un `manager` paga, se acredita en **su** suscripción personal, no en la del estudio (`rbac.ts:59` reserva la facturación al `owner`). `organizations.plan` no se degrada al vencer por fecha. Las tablas nuevas (`appointments`, `specialist_schedules`, `catalog_products`, `public_orders`) no tienen el trigger que bloquea escrituras con suscripción vencida.
- **[M15 · Medio]** `components/subscription/SubscriptionBanner.tsx` no está montado en ninguna página: nadie avisa que el trial termina.
- **Variables de entorno de Bold (verificado):** `BOLD_API_KEY`, `BOLD_SECRET_KEY`, `BOLD_SANDBOX`, `PAYMENT_PROVIDER` (`lib/payments/bold.ts:46-55`, `lib/payments/index.ts:23`, `.env.local.example:32-37`). **`BOLD_WEBHOOK_SECRET` no existe en el repositorio.** `env()` exige ambas llaves incluso para crear el link de pago: si en Vercel la secreta se configuró con otro nombre, también falla el checkout (HTTP 502). El webhook (`/api/pagos/webhook`) queda fuera del matcher de `proxy.ts` y valida HMAC con comparación de tiempo constante: correcto.

### 4.9 Seguridad, RBAC y riesgos técnicos (Eje 4)

| ID | Sev. | Hallazgo |
|---|---|---|
| A2 | Alto | `specialist` ve y cancela citas de otros (§4.3) |
| A3 | Alto | `/vitrina` sin guardia de servidor para `specialist` (§4.5) |
| A7 | Alto | Facturación y suscripción resueltas por `user_id`, no por organización (§4.8) |
| A14 | Alto | `lib/db.ts` reescribe `user_id` y borra por `user_id` (§4.4) |
| C7 | Crítico | `/c/[token]` muestra datos de diagnóstico capilar (§4.5) |
| — | OK | `/reportes`, `/configuracion/precios` y `/planes` con guardia de servidor (`protegerRutaSoloAdminEnServidor`) |
| — | OK | `/api/storage/vitrina` exige `owner`/`manager`, valida MIME y magic bytes, y restringe la ruta al prefijo de la organización |
| — | OK | `/api/analyze-hair` y `/api/validate-hair-photo`: sesión + rate limit + cupo por plan, solo Anthropic sin proveedor de respaldo (cumple política de IA) |
| — | OK | `projectQuoteForRole` (`lib/organizations/rbac.ts:145-167`) oculta costos y comisiones a `specialist` en Silla |
| M18 | Medio | `obtenerOrganizacionActivaPanel` (`lib/vitrina/cliente.ts:81-126`) duplica `obtenerContextoOrganizacionActivaCliente` y no lee `vertical` |
| M19 | Medio | Escrituras en `lib/cotizador/db.ts:339-1038` todavía usan `user_id: userId` como dueño; funciona mientras los triggers completen `organization_id`, pero mezcla dos modelos de tenencia |
| M12 | Medio | Copy en femenino y capilar en todas las rutas (§2.4) |
| B1 | Bajo | `dexie` instalado sin uso |
| B2 | Bajo | 16 clases CSS sin uso y alias de tipografías retiradas |
| B3 | Bajo | Nombres heredados: `VelvetTopHeader`, `VelvetImageUploader`, `normalizarHexVelvet`, `AJUSTES_VELVET_STUDIO_DEFECTO`; "Velli" en 57 archivos (incluido el mensaje WA "🌿 Velli — Diagnóstico Capilar") |
| B5 | Bajo | `lib/sentry.ts` huérfano |
| B6 | Bajo | Sombras `rgba(59,13,30,…)` y `#6E4F5D` en `app/planes`, `app/configuracion/precios`, `app/clientas/[id]`, `ListaPorCobrar`, `components/v2/Btn` |
| B7 | Bajo | Documentación raíz desactualizada: `PAGOS.md`, `COLORIMETRIA.md`, `CORTES.md`, `CONOCIMIENTO.md` describen módulos retirados o precios viejos |
| B9 | Bajo | Placeholder del buscador público sin caso `beauty_lounge`; placeholder de reserva capilar |
| B10 | Bajo | `EditorMarca` usa `var(--font-serif)` en itálica |

**Archivos monolíticos (> 500 líneas) con lógica mezclada:** `app/page.tsx` (2.212), `components/wizard/CameraCapture.tsx` (2.108), `app/configuracion/precios/page.tsx` (2.035), `lib/cotizador/db.ts` (1.373), `components/vitrina/VitrinaPublicaClient.tsx` (1.263), `app/clientas/[id]/page.tsx` (1.032), `app/reportes/page.tsx` (1.012), `app/agenda/page.tsx` (978), `app/configuracion/page.tsx` (962), `lib/pdfGenerator.ts` (953), `app/vitrina/page.tsx` (885), `lib/db.ts` (847), `components/cotizador/ListaPorCobrar.tsx` (696), `app/onboarding/page.tsx` (688).

---

## 5. Plan de limpieza y refactorización por olas

Ordenado por impacto y menor riesgo. Cada ola termina con `npm run typecheck` + `npm test` (≥ 390) + `npm run build`.

### Ola A · Podar código muerto y funciones innecesarias (riesgo bajo, 1–2 días)

| Paso | Qué | Impacto en tests |
|---|---|---|
| A.1 | Borrar los ≈ 7.600 LOC del §3.2 (wizard, resultado, dashboard, layout, v2 sin uso, ui huérfanos, `CitasServicio`, `Siluetas`, `kb/admin`, `kb/diagnostico`, `color/registro`, `sentry.ts`) y limpiar `components/v2/index.ts` | 0 |
| A.2 | Quitar `dexie` de `package.json` | 0 |
| A.3 | Quitar las 16 clases CSS sin uso y los alias `--font-serif`/`--font-dm-*`; agregar o reemplazar `v-gradient-hero`/`v-grain` por clases Base Neutra (arregla A4) | 0 |
| A.4 | Montar `SubscriptionBanner` en el shell (M15) y actualizar `PAGOS.md` | 0 |
| A.5 | **Condicionado:** borrar `lib/cortes/*` y los seeds de reglas de rizo (§3.3) **solo después** de que la Ola B sume ≥ 129 tests nuevos | −129 |

### Ola B · Aislamiento real por vertical (riesgo medio, 4–6 días; resuelve C1–C5, C7)

| Paso | Qué |
|---|---|
| B.1 | Un único helper de organización activa que incluya `vertical` y `feature_flags` (fusionar `obtenerOrganizacionActivaPanel` y `obtenerContextoOrganizacionActivaCliente`); exponer un hook `useVerticalPacks()` basado en `evaluarVerticalPacks` |
| B.2 | Silla: gatear Tarjeta 2, guardarraíles, cámara IA y badge de rizo; usar `costTrackingMode` en lugar de `categoria` para decidir el cálculo; arrancar con recargo `$0` fuera de `hair_studio`; quitar fallbacks de 60 g |
| B.3 | Semillas: `sembrarBaseFinancieraSalon(vertical)` que siembre una sola vez desde un catálogo de insumos por vertical y **sin re-inyección**; quitar `normalizarAjustesVelvetStudio` |
| B.4 | Registro y onboarding: preguntar la vertical, persistirla en servidor con verificación de filas, guardarla también al "Saltar"; selector de vertical en `/configuracion` (owner) |
| B.5 | CRM: gatear filtros de rizo, salud capilar, `SeguridadLegal` químico y `HistorialTimeline`; bloque genérico de sensibilidades |
| B.6 | `/configuracion/precios` y `/reportes`: categorías, etiquetas ("Insumos") y secciones de gramos según vertical; `madurezDatos` usando `usaQuimicaOSinBascula` |
| B.7 | `/c/[token]`: quitar las píldoras de diagnóstico (o mostrar solo un resumen no clínico definido por el servicio); consentimiento químico solo si el servicio lo requiere; pie legal neutro |
| B.8 | Copy neutro (Cliente, Especialista, Estudio) y plantillas de WhatsApp de reactivación por vertical; etiqueta de "Silla" por vertical |
| B.9 | **Tests nuevos** (meta ≥ 130): matriz 5 verticales × (Silla, semillas, CRM, precios, reportes, `/c/[token]`), garantizando que `nail_bar`/`barber_studio`/`spa_estetica`/`beauty_lounge` nunca rendericen módulos capilares ni siembren químicos |

### Ola C · Corrección de bugs y unificación de planes/UX (riesgo medio-alto, 5–8 días)

| Paso | Qué | Hallazgos |
|---|---|---|
| C.1 | Inmutabilidad financiera: congelar campos de cobro en el trigger de `cotizaciones`; correcciones como evento compensatorio; libro de liquidaciones de nómina; historial de compras de insumos; comisiones con versionado (requiere migración: **pedir confirmación**, `AGENTS.md` §4) | C6, A12, M13, M14 |
| C.2 | Puente Agenda → Silla → Cobro: conservar `appointmentId`, completar la cita al cobrar y actualizar visitas del cliente; no recalcular costos al cobrar | A1, A10 |
| C.3 | RBAC: vincular especialista con miembro (`estilistas.member_id`), RLS de agenda por especialista para `specialist`, `app/vitrina/layout.tsx` con guardia, facturación solo `owner` y suscripción resuelta por organización | A2, A3, A7 |
| C.4 | Marca: rechazar `#3B0D1E` en `brand.ts`, migración aditiva que cambie el `DEFAULT` y los `coalesce` a `#111111`; editor de marca completo (color, tagline, pie legal, slug) y sincronización `profiles` ↔ `organizations` ↔ `brand_settings` | A5, A8, M9 |
| C.5 | Planes: redefinir `plans.ts` y `/planes` con precios objetivo y beneficios multi-vertical (Agenda, Vitrina, BI); IA capilar como complemento de `hair_studio`; quitar promesas no implementadas (Excel) | A6 |
| C.6 | Vitrina: sin precio de respaldo, categorías por vertical, respetar "Desde"; vínculo de cliente por teléfono en SQL | A15, M11 |
| C.7 | CRUD en `/configuracion/precios` (editar/desactivar productos, servicios con duración, especialistas) | A11 |
| C.8 | Agenda: sincronizar hora del modal, botón "No asistió", reprogramar | M4, M5 |
| C.9 | Partir monolitos: `app/page.tsx` → módulos por modo de costo; `app/configuracion/precios/page.tsx` → 3 pestañas en archivos separados | M17 |
| C.10 | Retirar la agenda legada `public.citas` tras portar sus guardarraíles al pack capilar sobre `appointments` | A13 |

---

### Anexo · Evidencia de verificación

- Grafo de imports y conteos generados con scripts de solo lectura (fuera del repositorio).
- `hairClinicalPackActivo` / `evaluarHairClinicalPack`: únicas apariciones en `app/`, `components/` y `lib/` son sus propias definiciones (`lib/flags/index.ts:14, 61, 65`, `lib/flags/verticales.ts:146, 165`).
- `v-gradient-hero`: usada en `app/clientas/[id]/page.tsx:251, 561` y `app/configuracion/precios/page.tsx:1762`; ausente en `app/globals.css`.
- `app/vitrina/layout.tsx`: no existe.
- Suite actual: 22 archivos, 408 tests en verde (`main` @ `686a773`).
