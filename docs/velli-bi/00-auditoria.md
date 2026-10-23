# Velli Business Intelligence · Fase 1 · Etapa 0 — Auditoría

- **Fecha:** 2026-10-19
- **Rama:** `velli-bi/fase-1` (sale de `main` en `ba8fba3`, igual a `origin/main`)
- **Alcance:** solo lectura. No se editó código. En producción solo se hicieron `GET` a la Data API: conteos con `Prefer: count=exact` y `Range: 0-0`, que no traen filas, más el estado de publicación de contenido no personal de la base de conocimiento (flujos, marcas, reglas por segmento).

## 0. Fuentes y línea base

| Fuente | Qué es |
|---|---|
| `CLAUDE.md` | Solo importa `AGENTS.md`, que pide leer `node_modules/next/dist/docs/` antes de escribir código Next 16. No dice nada del producto. |
| Documento Maestro v1.1 (junio 2026) | `Downloads/Velli_Pro_Documento_Maestro (1).docx`. Describe el ecosistema de dos lados, el Pasaporte Capilar, las reseñas verificadas y los planes. |
| Informe de Estado de Construcción (agosto 2026) | `Downloads/Velli_Informe_Estado_Construccion.docx`. Es más reciente que el Maestro y lo usé para contrastar. |
| Documentación del repo | `README.md`, `PAGOS.md`, `GOBERNANZA.md`, `CONOCIMIENTO.md`, `COLORIMETRIA.md`, `CORTES.md`, `supabase/README.md` |
| Esquema | `supabase/schema.sql` (último dump: 2026-08), `supabase/migration-colorimetria.sql`, `supabase/migration-cortes.sql`, `supabase/_archive/*` |
| Código | `app/`, `components/`, `lib/`, `tests/`, `scripts/`, `proxy.ts`, `next.config.ts`, `public/sw.js`, `public/manifest.json` |

**Línea base antes de tocar nada:**

- `npx vitest run`: 248 de 248 pruebas en verde, en 8 archivos:
  - colorimetria: 54;
  - colorimetria.integracion: 20;
  - cortes: 42;
  - cortes.integracion: 32;
  - diagnostico.fase2: 37;
  - diagnostico.regresion: 18;
  - gobernanza.legal: 42;
  - prompts.sync: 3.
- `tsc --noEmit`: sin errores.

## 1. Lo que dicen el código y producción hoy

- **Tenencia.** Una cuenta es un usuario y es un salón. Todas las tablas de negocio filtran por `user_id = auth.uid()`. No existe la entidad «estilista» ni un «salón» separado del usuario.
- **Dinero.** No hay precios, cobros, costos ni comisiones en ninguna tabla. El único dinero del modelo son las suscripciones.
- **Producción (conteo del 2026-10-19):**
  - 6 perfiles, de los cuales 3 tienen rol corporativo;
  - 14 clientas;
  - 21 consultas: 15 cerradas (`es_borrador = false`) y 7 con `capture_metadata`, que solo se llena en el camino de cámara con IA;
  - 0 citas;
  - 6 suscripciones: 2 en prueba y 4 `active` en plan `pro`;
  - 2 pagos, ninguno aprobado. **Ningún salón está pagando.**
- **Migraciones aplicadas pero sin archivar:**
  - En producción existen `servicios_color` (0 filas), `kb_cortes` (16 fichas publicadas) y `cortes_ejecutados` (0 filas).
  - Aun así, `migration-colorimetria.sql` y `migration-cortes.sql` siguen fuera de `_archive/`.
  - `schema.sql` no incluye esas tablas.
  - `COLORIMETRIA.md` y `CORTES.md` todavía dicen «pendiente».
- **Base de conocimiento en producción:**
  - 320 reglas publicadas y 0 borradores. Incluyen 42 de `referencia_color` y 17 de `referencia_corte`.
  - 6 flujos publicados: `liso`, `ondulado`, `tipos34`, `canas`, `cabina` y `crecimiento`. El último pertenece a cortes.
  - 4 marcas publicadas (`Ponto`, `Etniker`, `Loreal`, `Igora Royal`). Las 4 tienen la carta técnica vacía: `{"series":[],"alturas":[]}`.

## 2. Tabla de módulos

**Decisiones:**

- **Se queda:** sigue igual; puede tener ajustes de texto.
- **Cambia de papel:** deja de ser producto y pasa a ser motor.
- **Se congela:** se apaga con un flag y se oculta, sin borrar nada.
- **Sale:** se retira del producto.

| # | Módulo o función | Archivos · rutas · tablas | Decisión | Qué cambia |
|---|---|---|---|---|
| 1 | Plataforma multi-tenant y autenticación | `proxy.ts`, `lib/supabase/{client,server,admin}.ts`, `lib/api/auth.ts`, `app/auth/*`. Tabla `profiles`; RLS por `auth.uid()`; trigger `on_auth_user_created` → `handle_new_user()` | Se queda | Nada en la Etapa 1. El link público de cotización necesita una ruta pública nueva en `proxy.ts:31`, porque hoy solo `/auth` y `/legal` son públicas. Cómo se modele la estilista depende de esta tenencia (P1). |
| 2 | Onboarding | `app/onboarding/page.tsx`, `components/dashboard/ChecklistInicio.tsx`, `components/marca/EditorMarca.tsx`, `lib/profile.ts`. Columnas `profiles.onboarding_completed`, `checklist_descartada`, `primer_pdf_descargado`, `servicios` (jsonb), `horario_atencion` (jsonb) | Se queda | Cambian los textos (§3). El paso 3 ya captura `servicios` con 8 sugeridos (`app/onboarding/page.tsx:19-28`): es la semilla natural del catálogo de servicios del salón. La checklist ganaría «Arma tu plantilla de precios» y «Envía tu primera cotización» cuando exista el cotizador. |
| 3 | Observabilidad (Sentry) | `instrumentation.ts`, `instrumentation-client.ts`, `sentry.*.config.ts`, `lib/sentry.ts`, `app/global-error.tsx`; CSP en `next.config.ts` | Se queda | Nada. |
| 4 | Pagos con Bold y suscripciones | `lib/payments/*`, `lib/subscription/{plans,estado}.ts`, `app/api/pagos/*`, `app/planes/*`, `components/subscription/SubscriptionBanner.tsx`. Tablas `subscriptions`, `payments`, `subscription_notifications`. RPC `suscripcion_efectiva`, `procesar_evento_pago`; triggers `trg_escritura_guard` y `trg_clientas_guard` | Se queda. No se tocan precios, ids de plan, días de prueba, periodo o gracia, ni Bold | El monto que va a Bold sale de `precioCop` en `plans.ts` y no se toca. Sí habría que cambiar `beneficios` (texto) y `features` (qué módulo abre cada plan); ver P2. Hoy `features` solo se usa en `/color` y `/cortes` (`app/color/page.tsx:84`, `app/cortes/page.tsx:103`). |
| 5 | Consentimientos y reglas legales | `lib/legal.ts`, `lib/consentimientos.ts`, `components/legal/*`, `components/wizard/ConsentimientoGate.tsx`, `components/clienta/SeguridadLegal.tsx`, `app/legal/*`. Tablas `consentimientos_clienta`, `legal_versiones`, `pruebas_sensibilidad`; trigger `citas_guard_legal` | Se queda | Nada en el código. Los textos de Términos y Privacidad están desactualizados y no cubren el cotizador (R4). |
| 6 | Suite de pruebas | `tests/*.test.ts` (8 archivos, 248 pruebas), `vitest.config.ts` | Se queda | La Etapa 1 agrega pruebas de flags. Las 74 pruebas de cortes siguen corriendo: importan `lib/cortes/*` directamente, y ocultar la interfaz no las toca. |
| 7 | Gobernanza de la base de conocimiento (rol corporativo) | `profiles.rol`, `es_cuenta_corporativa()`, `es_cuenta_fundadora()`, `app/conocimiento/page.tsx`, `lib/kb/admin.ts`, `lib/kb/marcas.ts` | Se queda | Nada. **`corporativo` es el equipo Velli que administra la librería.** No son «cuentas para cadenas» (P4). |
| 8 | Diagnóstico: asistente y motor de la base de conocimiento | `app/diagnostico/page.tsx`, `components/wizard/*`, `components/resultado/ResultadoDiagnostico.tsx`, `lib/kb/{evaluador,diagnostico,tipos}.ts`, `lib/diagnosticEngine.ts` (legacy y fallback), `lib/kb/seed/*`. Tablas `consultas` (+ `perfil_extendido` jsonb), `kb_reglas`, `kb_flujos`, `kb_dimensiones` | Cambia de papel: entrada del cotizador | El motor no cambia. El cotizador leerá de la consulta lo siguiente:<br>• densidad: `consultas.densidad`;<br>• estado: `nivel_dano`, `estado_puntas`, `elasticidad` y `porosidad`;<br>• % de canas: `perfil_extendido.estadoCanas`, por rangos (R5);<br>• largo: **no existe**, salvo `largoNaturalCm` y `largoEstiradoCm` en tipo 4. Habría que crear una dimensión nueva por datos, sin migración (P6).<br>El diagnóstico manual sigue siendo la entrada en Básico y Pro. |
| 9 | Diagnóstico con IA por foto | `app/api/analyze-hair/route.ts` (Claude `claude-sonnet-4-6`, `max_tokens` 1500, fallback `gpt-4o`), `app/api/validate-hair-photo/route.ts` (misma cadena, `max_tokens` 400; solo corre si la calidad es menor a 80 o si las fotos se suben de la galería), `lib/hairAnalysis.ts`, `components/wizard/{CameraCapture,PasoCabello}.tsx`, `lib/kb/promptsServidor.ts`, `lib/api/rateLimit.ts` (Upstash: 20/h y 60/h por usuario) | Cambia de papel: solo Pro+IA, con tope mensual | Hoy la usa cualquier plan, y también la prueba gratis, sin tope mensual. Ninguna de las dos rutas revisa el plan. No hay registro de uso ni de tokens (R2, R3). Cambios necesarios: control de plan en el servidor, contador mensual persistente y registro de `usage` por llamada. Se hace después de la Etapa 2, cuando haya tope definido. |
| 10 | Panel de conocimiento | `app/conocimiento/page.tsx` (7 pestañas para el rol corporativo, «Marcas de tu salón» para el rol salón) | Se queda como motor | Nada. Permite agregar la dimensión de largo y ajustar flujos sin redeploy. |
| 11 | Colorimetría | `app/color/page.tsx`, `lib/color/{tablas,reglas,calculadora,integracion,registro,tipos}.ts`, `lib/kb/seed/colorimetria.ts`. Tablas `servicios_color` (0 filas), `kb_marcas` (4, carta vacía), `salon_marcas_activas` (0 filas); 42 reglas `referencia_color` | Cambia de papel: además de la fórmula, da el costo | Las reglas CO-01 a CO-10 quedan intactas. El costo saldría de la fórmula final (`servicios_color.formula_final.componentes[].gramos`) dividida entre los gramos de la presentación y multiplicada por el precio de compra del salón, más el oxidante según la `proporcion`. Hoy faltan tres cosas:<br>• precios de compra: no existen;<br>• gramos por tubo: las cartas están vacías, así que se usan 60 g por defecto;<br>• el % de canas (R5).<br>Además, la fórmula sugerida siempre suma un tubo y no escala con el largo ni la densidad (R6). |
| 12 | Agenda | `app/agenda/page.tsx`, `components/agenda/CitasServicio.tsx`, `lib/agenda/{citas,reglas}.ts`, `lib/db.ts:571-628` (`getUpcomingCitas`, `getPastCitas` y `getNextCita` leen `consultas.proxima_cita`). Tabla `citas` (0 filas) y trigger `citas_guard_legal` | Se queda, sin desarrollo nuevo | Sigue visible para salones sin agenda y sirve como fuente de datos (`proxima_cita`, `citas`). Deja de venderse en los textos (§3). La barra inferior la muestra como pestaña principal (P12). |
| 13 | Reportes | `app/reportes/page.tsx`, `lib/db.ts` (`getConsultasByMonth`, `getRizoDistribution`, `getTratamientosDistribution`, `getSatisfaccionPromedio`), `lib/funnel.ts`, tabla `eventos_activacion` | No está en tu lista. Propuesta: se queda, y el módulo 2 se construye al lado | Hoy no muestra ingresos ni márgenes: el comentario en `app/reportes/page.tsx:128` dice que el ingreso del mes «no existe». Se vende como Pro, pero no está bloqueado por plan. El funnel necesitará eventos nuevos, como primera cotización o primer cobro confirmado. Eso exige ampliar el CHECK de `eventos_activacion`, que es una migración. |
| 14 | Fichero de clientas y PDF | `app/clientas/*`, `components/clienta/HistorialTimeline.tsx`, `lib/pdfGenerator.ts`, `lib/storage.ts`. Tablas `clientas` y `consultas`; bucket `fotos` | No está en tu lista. Propuesta: se queda | El PDF pone el logo y el nombre del salón, y siempre el dominio de la app al pie (`lib/pdfGenerator.ts`; desde el 2026-10-22 sale de `NEXT_PUBLIC_APP_URL`, §9). Es el patrón que sirve para «con / sin marca Velli». Los mensajes de WhatsApp del diagnóstico envían datos capilares; el de cotización **no** debe hacerlo. |
| 15 | Recordatorio por WhatsApp a clientas inactivas | `app/page.tsx:426-485` (wa.me con texto) | No está en tu lista. Se queda | El patrón wa.me se puede reutilizar para la cotización. Ojo: el teléfono no lleva prefijo de país (R7). |
| 16 | Marca del salón | `components/marca/EditorMarca.tsx`, `profiles.logo_url` y `color_primario` | No está en tu lista. Se queda | Se vende como Pro, pero no está bloqueada por plan. En el link: Básico y Pro llevan la marca Velli; Pro+IA va sin ella (P9). |
| 17 | **Corte por forma de rostro** | • Rutas: `app/cortes/page.tsx`; botón «Cortes» en `app/clientas/[id]/page.tsx:781-785`; pestaña «Cortes» en `app/conocimiento/page.tsx:309`.<br>• Código: `lib/cortes/{catalogo,fichas,integracion,lenguaje,matriz,serializacion,tipos,preagenda}.ts`, `components/cortes/Siluetas.tsx`, `lib/kb/seed/cortes.ts`, `scripts/generar-payload-{cortes,referencia}.mjs`.<br>• Tablas y datos: `kb_cortes` (16 publicadas), `cortes_ejecutados` (0 filas), 17 reglas `referencia_corte`, `flujo.crecimiento` en `kb_flujos` (**publicado**: hoy cada diagnóstico pregunta por remolinos) y las dimensiones `remolino*` y `direccionCrecimiento` en `kb_dimensiones` (borrador).<br>• Pruebas: `tests/cortes*.test.ts` (74). | Se congela | Con el flag `cortes` apagado:<br>• ocultar `/cortes`: redirige o muestra un aviso;<br>• ocultar el botón de la ficha;<br>• filtrar `flujo.crecimiento` en `cargarFlujosParaTipo()` (`lib/kb/diagnostico.ts:96`), sin despublicarlo en producción (R1).<br>Se conserva `lib/cortes/preagenda.ts` (`fechaSugeridaRetoque` y `proponerRetoque`, ciclo de retoque por ficha) para los futuros avisos de retoque. Datos, tablas y RLS quedan intactos. La IA facial ya está apagada (`NEXT_PUBLIC_FEATURE_IA_FACIAL`, `lib/subscription/plans.ts:112`). |
| 18 | **App para clientas y marketplace** | **No hay código.** Busqué «pasaporte», «passport», «marketplace» y «reseña». Solo hay textos que mencionan el «Pasaporte Capilar»:<br>• reglas publicadas `cronograma.f2.can2` y `intervalo.f2.can2` (`lib/kb/seed/reglasFase2.ts:652, 834`), `nota.f2.c05` (`:1349`) y `nota.f2.t401` (`:1557`);<br>• el consentimiento de imágenes (`components/legal/ConsentimientoContenido.tsx:87`);<br>• la calculadora de color (`hitosPasaporte`, `app/color/page.tsx:447`). | Se congela | No hay nada que apagar. Esos textos prometen a la clienta algo congelado (R14, P11). |
| 19 | **Cuentas corporativas para cadenas** | **No hay código** de cadenas, sedes, sucursales ni multi-salón | Se congela | No hay nada que apagar. No hay que confundirlo con el `rol corporativo` (fila 7, P4). Para no cerrarle el paso, el modelo del cotizador debería colgar de un `salon_id` aunque hoy sea igual al `user_id` del dueño. |
| 20 | **Reseñas públicas de «precio respetado»** | **No hay código.** Busqué «reseña» y «precio respetado». Solo aparecen como «Reseñas verificadas» en el Documento Maestro §5.2, para la app de clientas, que no se construyó | Sale del producto | No hay nada que retirar del código. Habría que quitarlo del Documento Maestro si se reescribe. |
| 21 | Cotizador, plantilla de precios, costo, comisiones y link público | No existen | Nuevo (diseño en la Etapa 3) | Ver R5–R9, R13 y P1, P6, P7, P9. |

## 3. Textos de venta que hoy venden la agenda o el diagnóstico

**No hay landing en este repo.** Sin sesión, `/` redirige a `/auth/login` (`proxy.ts:37-41`). Antes de pagar, una persona ve la metadata y la tarjeta para redes, el manifest, el login, el registro, el onboarding, la checklist y la página de planes. Si la landing existe fuera del repo, no la vi (P8).

| Dónde | Texto actual | Vende |
|---|---|---|
| `app/layout.tsx:33-35` (título y descripción) | «Velli Pro — Inteligencia capilar a tu alcance» / «Velli Pro es la herramienta profesional para estilistas: diagnóstico capilar con IA, planes de tratamiento personalizados e historial de clientas para todo tipo de cabello (1A–4C).» | Diagnóstico |
| `app/layout.tsx:53-55` (Open Graph) | «Diagnóstico capilar profesional con IA y planes de tratamiento personalizados para estilistas.» | Diagnóstico |
| `app/layout.tsx:68-69` (Twitter) | «Diagnóstico capilar profesional con IA para estilistas.» | Diagnóstico |
| `public/manifest.json` | Descripción «Inteligencia capilar a tu alcance»; atajo «Nueva consulta — Iniciar diagnóstico capilar» | Diagnóstico |
| `app/auth/login/page.tsx:129, 156, 168, 181, 192` | «INTELIGENCIA CAPILAR» · «EDICIÓN PROFESIONAL» · «El cabello, entendido.» · «Diagnóstico, plan y seguimiento — todo el oficio de tu salón en un solo lugar.» | Diagnóstico |
| `app/auth/registro/page.tsx:95-99, 172` | «Tu cuenta está lista. Configura tu salón en 3 pasos rápidos para que tus diagnósticos y PDF salgan con tu marca.» · «Inteligencia capilar a tu alcance» | Diagnóstico |
| `app/onboarding/page.tsx:191` (paso 1) | «Estos datos salen en tus PDF y en los recordatorios a tus clientas.» | Diagnóstico (PDF) |
| `app/onboarding/page.tsx:192` (paso 2) | «Tu logo y color visten los diagnósticos que entregas. Si lo prefieres, te prestamos la marca Velli.» | Diagnóstico |
| `app/onboarding/page.tsx:193` (paso 3) | «Tus servicios y horario alimentan la agenda y la disponibilidad.» | **Agenda** |
| `components/dashboard/ChecklistInicio.tsx:33, 40` | «Nombre, ciudad y WhatsApp para tus PDF» · «Su ficha guarda historia y salud capilar» | Diagnóstico |
| `components/dashboard/ChecklistInicio.tsx:46-47` | «Haz tu primer diagnóstico — Con IA o wizard manual, en minutos» | Diagnóstico e IA |
| `components/dashboard/ChecklistInicio.tsx:53-54` | «Descarga tu primer PDF — El informe que entregas a tu clienta» | Diagnóstico |
| `lib/subscription/plans.ts:44-49` (Básico) | «Para empezar con tus primeras clientas» · «Hasta 50 clientas» · **«Diagnósticos ilimitados con IA capilar»** · **«Agenda y historial por clienta»** · «PDF de resultados para tus clientas» | Diagnóstico, IA ilimitada y agenda. Choca con la oferta nueva, donde la IA pasa a Pro+IA con tope |
| `lib/subscription/plans.ts:64-73` (Pro) | «Para salones en crecimiento» · «Clientas ilimitadas» · «Todo lo del plan Básico» · «Calculadora de colorimetría» · «Reportes de tu negocio» · **«Exportación a Excel»** · «Personalización de marca» | Hereda lo del Básico. La «Exportación a Excel» no existe en el código (solo hay respaldo JSON); ver R12 |
| `lib/subscription/plans.ts:87-92` (Pro + IA) | «La experiencia Velli completa» · «Todo lo del plan Pro» · **«Funciones de IA facial (próximamente)»** · «Acceso anticipado a nuevas funciones de IA» | IA facial, que es parte del corte por rostro (congelado) |
| `app/color/page.tsx:182-183` (bloqueo por plan) | «La calculadora es del plan Pro» / «… El análisis de color por foto llegará con Pro + IA.» | Promete un análisis de color por foto que no está en la nueva oferta |
| `app/cortes/page.tsx:197-198` (bloqueo por plan) | «La matriz de cortes es del plan Pro» / «… La detección facial automática llegará con Pro + IA.» | Congelado |
| `app/page.tsx:124` (Inicio) | «Todo en orden. Comienza el día con tu próximo diagnóstico.» | Diagnóstico |
| `app/page.tsx:171-177` | «Tu día en una mirada» y botón «Agenda» | **Agenda** |
| `app/page.tsx:234, 310` | «Tu próxima clienta» y «Iniciar diagnóstico» | Agenda y diagnóstico |
| `app/page.tsx:324-325` (accesos rápidos) | «Nuevo diagnóstico · IA · 3 min» · «Cámara en vivo · Tipo de rizo» | Diagnóstico e IA |
| `app/page.tsx:429` (WhatsApp a inactivas) | «… desde tu última visita en Velli Pro. ¿Agendamos tu próxima consulta?» | Agenda |
| `app/page.tsx:642` (estado vacío) | «Aquí vivirá tu fichero: la historia y salud capilar de cada clienta. Crea la primera y haz su diagnóstico en minutos.» | Diagnóstico |
| `components/v2/BottomNavV2.tsx:7-11` | Inicio · Clientas · botón central «Nuevo diagnóstico» · **Agenda** · Métricas | Diagnóstico y agenda. El cotizador no tiene lugar en la navegación |
| `components/v2/Masthead.tsx:72`; `app/configuracion/page.tsx:274, 430` | «Velli — Inteligencia capilar» · «Velli — Inteligencia capilar a tu alcance» | Diagnóstico (tagline) |
| `app/configuracion/page.tsx:588-589` | «Horario y disponibilidad · Bloques de agenda» | Agenda |
| `components/resultado/ResultadoDiagnostico.tsx:83-89`; `components/clienta/HistorialTimeline.tsx:19-44` | Mensajes de WhatsApp a la clienta con tipo de cabello, porosidad, tratamiento y cronograma, firmados «Velli Pro, Inteligencia capilar a tu alcance» | Diagnóstico. Además envían datos capilares por WhatsApp |
| `app/legal/terminos/page.tsx:25-28` y §4; `app/legal/privacidad/page.tsx` §2-4 | «… realizar diagnósticos capilares con apoyo de inteligencia artificial, agendar citas y generar planes de tratamiento.» | Son textos legales, no de venta, pero describen el producto viejo (R4) |
| `README.md:3-5` | «diagnóstico capilar con IA, fichero de clientas (CRM), agenda, reportes y PDF» | Documentación |
| Documento Maestro: tagline, §5, §9.4 y §10 | Ecosistema de dos lados, Pasaporte Capilar, reseñas verificadas, planes con «análisis facial en tiempo real» | Documento externo |

## 4. Riesgos

| # | Riesgo | Por qué importa | Mitigación propuesta |
|---|---|---|---|
| R1 | **Cortes sigue vivo dentro del diagnóstico.** `flujo.crecimiento` está publicado en producción y es transversal, así que hoy cada diagnóstico pregunta por remolinos (`lib/kb/diagnostico.ts:112-116` devuelve todos los transversales publicados). | Ocultar `/cortes` no basta para congelar el módulo. | El flag filtra ese flujo en el código. No se despublica en producción: sería escribir en prod y dejaría rastro en `kb_auditoria`. |
| R2 | **La IA no tiene plan ni tope.** `/api/analyze-hair` y `/api/validate-hair-photo` solo exigen sesión. El único límite es Upstash (20/h y 60/h por usuario), y si faltan las variables de Upstash no hay límite (`lib/api/rateLimit.ts:87-95`). La prueba gratis abre Pro+IA durante 14 días (`lib/subscription/estado.ts:53-54`). | El tope de Pro+IA no se puede hacer cumplir solo desde la interfaz. Además, la validación de fotos también cuesta. | Control de plan y contador mensual en el servidor, dentro de las dos rutas, con una tabla de uso persistente. Se diseña tras la Etapa 2. |
| R3 | **No hay registro de consumo de IA.** Las rutas descartan `usage` (tokens) de la respuesta. En producción hay 7 consultas con captura de cámara y ningún token guardado. | La Etapa 2 no tendrá «registros reales» de tokens. | Estimación documentada: fotos por análisis, resolución de captura (1280×720 ideal, `CameraCapture.tsx:208`), tamaño de los prompts publicados y `max_tokens`. Si tienes acceso, usar el panel de uso de Anthropic (P10). Registrar `usage` desde ya en el diseño. |
| R4 | **Proveedor de IA mal declarado en los textos legales.** Términos §4 (`app/legal/terminos/page.tsx:58-63`) y Privacidad §4 (`app/legal/privacidad/page.tsx:67-72`) dicen OpenAI GPT-4o. El primario es Anthropic (Claude Sonnet 4.6); OpenAI es el respaldo. | Hay un encargado de tratamiento no declarado. El cotizador agrega datos nuevos (precios, cobros, estilistas, comisiones) y un link público. | Actualizar ambos textos antes de abrir el link público. **Corregido el 2026-10-22** (§9): solo Anthropic, y `LEGAL_VERSION` en `2026-10-22-placeholder`. Falta mencionar el link público cuando exista. |
| R5 | **El % de canas no llega a la colorimetría.** El asistente guarda `estadoCanas` por rangos (`sin_canas`, `menos_25`, `entre_25_50`, `mas_50`; `lib/kb/seed/contenido.ts:16-26`). La calculadora lee `perfil_extendido.porcentajeCanas` como número (`lib/color/integracion.ts:81, 92`), y nada lo escribe. | Con datos reales, hoy CO-05 (1/4, 1/2 o 3/4 de tubo) nunca se activa, y la vía «cobertura» tampoco aparece. Además, «más del 50 %» no distingue entre 50–75 % y más de 75 %, que cambian la fracción y el candado de 20 vol. Sin fracción no hay «fracción de tubo × precio». | **Corregido el 2026-10-22** (§9): cuatro tramos de canas. La calculadora traduce el tramo del asistente a porcentaje y, con «más del 50 %», pide un toque. La regla CO-05 no se toca: lo que cambia es el dato que le llega. |
| R6 | **Sin datos de producto para costear.** Las cartas de las 4 marcas están vacías (sin `gramosPorTubo`), ningún salón activó marcas (`salon_marcas_activas` = 0) y no existe precio de compra en ninguna tabla. La fórmula siempre suma un tubo (`GRAMOS_TUBO_DEFECTO = 60`, `lib/color/calculadora.ts:40`), sea cual sea el largo o la densidad. | Un costo calculado así subestima las cabezas largas o densas. | Llevar un catálogo de productos por salón (presentación y precio de compra) y un factor de consumo por largo y densidad en la plantilla del salón, sin tocar las reglas de color. Para costos reales, usar la fórmula **final** editada. |
| R7 | **Teléfonos sin prefijo de país.** Los links wa.me solo limpian dígitos (`app/page.tsx:427`, `ResultadoDiagnostico.tsx:92`, `HistorialTimeline.tsx:46`, `app/clientas/[id]/page.tsx:428`). | Un número guardado como «300 123 4567» genera `wa.me/3001234567`, que no es un número internacional válido. Pasa con los botones actuales y pasará con la cotización. | Normalizar a E.164, con +57 por defecto según la ciudad o el país del salón, en un helper único. **Corregido el 2026-10-22** en `lib/whatsapp.ts` (§9). |
| R8 | **La tenencia es de un solo usuario.** No existe la estilista. | «Diferencia de cada estilista» y «comisión» necesitan esa entidad. Si cada estilista necesita login propio, toda la RLS (hoy por `user_id`) tendría que pasar a `salon_id`, un cambio grande y riesgoso. | Recomendación P1: en la Fase 1, estilistas como registros dentro de la cuenta del dueño. |
| R9 | **Borrado en cascada de la historia financiera.** `consultas.clienta_id` es `ON DELETE CASCADE` (`schema.sql:1270`). «Borrar todos los datos» (`lib/db.ts:793`) y borrar una clienta (`lib/db.ts:365`) eliminan consultas. | Si las cotizaciones cuelgan de la consulta o la clienta en cascada, se pierde lo cobrado. Eso rompe los resúmenes y los futuros pronósticos. | Llaves foráneas con `ON DELETE SET NULL` y un resumen inmutable del servicio y el precio en la cotización. Hay que decidir la retención frente al derecho de supresión. |
| R10 | **Esquema y documentación desfasados** (§1). | Diseñar migraciones nuevas sobre un `schema.sql` que no refleja producción. | Antes de la Etapa 3: regenerar `schema.sql` (conservando el apéndice manual), archivar las dos migraciones aplicadas y corregir COLORIMETRIA.md y CORTES.md. |
| R11 | **Los flags actuales son de compilación.** `NEXT_PUBLIC_FEATURE_IA_FACIAL` queda fijado en el bundle al construir, así que cambiarlo exige redeploy. No hay flags por salón. | La Etapa 1 pide flags por entorno y por salón. | Registro único de flags en el servidor: entorno por defecto y excepción por salón (P14). |
| R12 | **Promesas de venta sin respaldo.** «Exportación a Excel» no existe. «Diagnósticos ilimitados con IA» aparece en Básico. «Reportes» y «Personalización de marca» se venden como Pro, pero no están bloqueados. | Desajuste entre lo que se cobra y lo que se entrega. | Reescribir `beneficios` cuando se apruebe P2. **Corregido en parte el 2026-10-22:** ya no aparecen «Diagnósticos ilimitados con IA capilar» (Básico) ni «Exportación a Excel» (Pro), y Básico ofrece «Diagnóstico capilar guiado». «Reportes» y «Personalización de marca» siguen sin bloqueo por plan. |
| R13 | **Consistencia del precio frente a entradas editables.** El precio depende de entradas que la estilista puede mover: el largo, o la densidad sugerida por la IA y luego editada. | Para auditar que «el mismo servicio cuesta lo mismo», hay que saber con qué variables se cotizó. | La cotización guarda la foto de las variables usadas, la plantilla vigente y quién cambió qué. |
| R14 | **Textos validados de la base de conocimiento prometen el Pasaporte Capilar a la clienta**, que está congelado: las reglas publicadas de CAN-2, C-05 y T4-01 y el consentimiento de imágenes. | Algunos son verbatim de la validación técnica. | Dejarlos por ahora (P11); cambiarlos es una decisión de producto. |
| R15 | **Poco impacto comercial hoy, pero no cero.** No hay pagos aprobados. Las 4 suscripciones `active` en `pro` no tienen pago asociado, así que serían cuentas del equipo o de prueba. | Si el plan Pro deja de incluir la IA, esas cuentas la pierden. | Pasarlas a `pro_ia` por SQL cuando toque, solo con tu autorización explícita para esa operación. |
| R16 | **Caché del service worker.** Las navegaciones se guardan en caché (`public/sw.js:72-78`). | Si la estilista abre en su propio teléfono un link público de cotización, la página queda en la caché de su PWA. | Excluir la ruta pública del caché del service worker al construirla. |
| R17 | **Una cuenta de salón puede hacerse corporativa.** Hallado en la Etapa 1, al diseñar los flags por salón. En `schema.sql`, el dump de producción de agosto: `authenticated` tiene `GRANT ALL` sobre `profiles` (`:1858`), la política «Users can update own profile» solo limita la fila y no las columnas (`:1419`), y el único trigger de `profiles` es `set_updated_at` (`:1231`). | Cualquier cuenta con sesión puede cambiar su propio `rol` a `corporativo` desde el cliente de Supabase. Con eso escribe en la librería global (`kb_reglas`, `kb_flujos`, `kb_prompts`, `kb_marcas`, `kb_cortes`), que alimenta el diagnóstico de todos los salones, incluidas las reglas de derivación médica. No lo probé escribiendo. | Trigger que rechaza cambios a `rol`, `es_fundadora` y `feature_flags` cuando vienen de una sesión de usuario. Se deja como borrador: `supabase/migration-proteger-perfil.sql`. **Hay que aplicarlo antes de abrir la beta a salones.** **Aplicada:** Vanessa confirmó el trigger en producción el 2026-10-22. |
| R18 | **Bold no está configurado en producción.** Hallado en la Etapa 2. `vercel env ls` lista las variables de Supabase, Sentry, Upstash, Anthropic y OpenAI, pero **ninguna de Bold** (`BOLD_API_KEY`, `BOLD_SECRET_KEY`, `BOLD_SANDBOX`, `PAYMENT_PROVIDER`). `lib/payments/bold.ts:46-53` lanza un error sin ellas. | En producción el checkout falla: hoy ningún salón puede pagar. Coincide con los 0 pagos aprobados. | Cargar las llaves de **producción** de Bold en Vercel y configurar el webhook, siguiendo `PAGOS.md`. Lo hace Vanessa. |
| R19 | **El respaldo de IA tiene fecha de apagado.** OpenAI apaga `gpt-4o-2024-08-06` y `gpt-4o-2024-11-20` el 14-ene-2027 (anunciado el 14-oct-2026). | Desde esa fecha, si Claude falla, el análisis falla. | Ver la decisión D2 en `01-costo-ia.md`. **Resuelto en el código el 2026-10-22:** ya no hay respaldo; si Claude falla, la estilista sigue en manual. |

## 5. Preguntas abiertas

| # | Pregunta | Mi recomendación |
|---|---|---|
| P1 | **Estilistas:** ¿cada estilista tiene login propio, o el dueño las registra dentro de su cuenta y se usa el teléfono o tablet del salón? | Registros sin login en la Fase 1, con `salon_id` igual al `user_id` del dueño. No obliga a reescribir la RLS y deja el login de estilistas para después. |
| P2 | **Planes:** ¿puedo cambiar `beneficios` (texto) y `features` (qué módulo abre cada plan) en `lib/subscription/plans.ts`, sin tocar precios, ids, días ni Bold? ¿Se mantiene el límite de 50 clientas del Básico, que hoy se aplica en la base de datos? | Sí a lo primero; mantener el límite mientras no lo decidas. |
| P3 | **Prueba gratis de 14 días:** ¿incluye IA? ¿Con qué tope? | Con IA, pero con un tope bajo (lo calculo en la Etapa 2), para que crear cuentas no sea una vía de IA gratis. |
| P4 | «Cuentas corporativas para cadenas» no existe en el código. ¿Confirmas que el `rol corporativo` (administra la librería) no se toca? | No tocarlo. |
| P5 | Al congelar Cortes, ¿oculto también la pestaña «Cortes» del panel de conocimiento? Solo la ve el equipo. | Dejarla visible para el rol corporativo y ocultar todo lo que ve un salón, incluido `flujo.crecimiento` en el asistente. |
| P6 | **Largo:** ¿qué tramos usará la plantilla: corto, medio, largo, extra largo, o centímetros? | Tramos con nombre y una referencia física. Entran como dimensión de la base de conocimiento, sin migración. **Decidido el 2026-10-22** (§9): mentón, hombros o clavícula, media espalda o tira del brasier, cintura o más. |
| P7 | **Canas:** ¿alineamos las opciones del asistente a los tramos de CO-05 (menos de 25, 25–50, 50–75, más de 75) o mapeamos los rangos actuales y aceptamos la ambigüedad de «más del 50 %»? | Alinear las opciones. Es un cambio de contenido; la regla CO-05 no se toca. **Decidido el 2026-10-22** (§9). |
| P8 | ¿Existe una landing fuera de este repo? | Si existe, pásame acceso para auditar sus textos. **Respondida el 2026-10-22:** Velli no tiene dominio propio (§9). |
| P9 | «Con la marca Velli» en el link: ¿el salón arriba y «Cotización hecha con Velli» al pie, con logo y enlace? ¿Y en Pro+IA «sin marca» significa solo el salón? | Sí, igual que el PDF actual (salón arriba, el dominio de la app al pie). |
| P10 | Para la Etapa 2, ¿tienes acceso al panel de uso de Anthropic (console.anthropic.com → Usage) para exportar el consumo real? | Si no, la estimación documentada basta para proponer el tope. |
| P11 | Los textos que mencionan el «Pasaporte Capilar» ante la clienta, ¿se dejan como están por ahora? | Sí. |
| P12 | **Agenda:** ¿se queda en la barra inferior como hoy? | Dejarla. Sin desarrollo nuevo, solo deja de aparecer en los textos de venta. Que el cotizador reemplace el botón central es una decisión de la Etapa 3. |
| P13 | Textos legales: ¿quién redacta la actualización (proveedor de IA, cotizaciones, link público)? ¿Bloqueamos la salida del link hasta tenerla? | Vanessa, desde el 2026-10-22. Sí a lo segundo. |
| P14 | **Flags por salón:** ¿aceptas una columna `profiles.feature_flags jsonb` (migración pequeña, que aplicarías tú) además de los flags de entorno que lee el servidor? | Sí. Mientras la columna no exista, el código cae a los valores del entorno, como ya hace hoy con `rol` (`lib/profile.ts:89`). |

## 6. Texto propuesto para CLAUDE.md

Debajo de la línea `@AGENTS.md`, que se conserva:

```markdown
## Dirección del producto: Velli Business Intelligence (desde octubre 2026)

Velli es un producto para el DUEÑO del salón: le dice cuánto cobrar y cuánto
gana en cada servicio. La puerta de entrada es el cotizador: el mismo servicio
cuesta lo mismo sin importar quién atienda.

Módulos, en este orden:
1. Cotizador y precios: precio = diagnóstico + plantilla de precios del salón;
   cotización por link de WhatsApp (wa.me, sin API) con la marca Velli; lo
   cobrado se confirma con un toque.
2. Rentabilidad para el dueño: diferencia de cada estilista frente a lo
   cotizado, margen por servicio (precio − producto − comisión), consumo de
   producto y aviso de compra, resumen semanal.
3. Recomendaciones y 4. Pronósticos (2027): no se construyen todavía, pero
   ningún cambio al modelo de datos debe cerrarles el paso (guardar historia,
   no sobrescribir precios ni costos pasados).

Planes (ya existen en Bold; NO cambiar precios, ids, días ni configuración de
Bold): Básico = módulo 1 · Pro = módulos 1 y 2 · Pro+IA = todo lo anterior,
más diagnóstico con IA con tope mensual y cotización sin la marca Velli.

Reglas para cualquier cambio:
- El diagnóstico (IA + base de conocimiento) y la colorimetría son el MOTOR,
  no el producto. El diagnóstico da las variables de precio (largo, densidad,
  estado, % de canas); la colorimetría da el costo (gramos de la fórmula
  final ÷ presentación × precio de compra). Sus reglas no se cambian para
  servir al cotizador: se adapta en la capa del cotizador.
- Congelado = feature flag apagado y oculto en la interfaz. NUNCA se borra
  código, datos, tablas, roles ni políticas RLS. Congelados: corte por forma
  de rostro (lib/cortes/preagenda.ts se reutilizará para avisos de retoque),
  app para clientas y marketplace, cuentas para cadenas. Fuera del producto:
  reseñas públicas.
- `rol corporativo` = equipo Velli que administra la librería. No es una
  cuenta para cadenas.
- Agenda: se mantiene para salones sin agenda y como fuente de datos; sin
  desarrollo nuevo.
- Se mantienen: multi-tenant con RLS, onboarding, Sentry, pagos Bold,
  consentimientos y reglas legales, suite de pruebas (todas en verde antes de
  cerrar cualquier tarea: `npm test`, `npm run typecheck`).
- El link público de cotización muestra SOLO servicio, precio y vigencia:
  nada del diagnóstico, ni fotos, ni datos de salud capilar.
- Producción: verificar solo leyendo. Las migraciones se dejan como borrador
  en `supabase/` y las aplica Vanessa a mano.
- Documentos de esta dirección: `docs/velli-bi/`.
```

## 7. Lo que no verifiqué

- Una landing fuera de este repo (P8).
- Las variables de entorno de Vercel en producción. En particular, si existen `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, y el valor de `NEXT_PUBLIC_FEATURE_IA_FACIAL`. En `.env.local` no está Upstash.
- El consumo real en los paneles de Anthropic y OpenAI.
- La interfaz en el navegador. Esta etapa no cambió nada visual; en la Etapa 1 mediré en el navegador que lo congelado quedó oculto.

## 8. Decisiones tomadas (2026-10-19)

Vanessa respondió «haz lo que parezca mejor para el plan». Se adoptan las recomendaciones de la sección 5, con estos detalles:

| # | Decisión |
|---|---|
| P1 | Las estilistas son registros dentro de la cuenta del dueño, sin login. El `user_id` del dueño es la clave del salón. Las tablas nuevas usan una función de RLS, para poder sumar miembros después sin reescribir políticas. |
| P2 | Sí se pueden cambiar `beneficios` y `features`, pero cada cambio llega cuando exista su módulo. En la Etapa 1 solo se quita la promesa de IA facial, que está congelada. Precios, ids, días y Bold quedan intactos. Se mantiene el límite de 50 clientas. |
| P3 | La prueba gratis incluye IA, con un tope bajo. La cifra está en `01-costo-ia.md`. |
| P4 | El `rol corporativo` no cambia de significado, pero se protege contra la autoasignación (R17). |
| P5 | La pestaña «Cortes» del panel sigue visible para el rol corporativo, con un aviso de módulo congelado. Se oculta todo lo que ve un salón, incluido `flujo.crecimiento` en el asistente. Nada se despublica en producción. |
| P6 | Los tramos de largo están en `02-diseno-cotizador.md` §1.1: estándar configurable de Velli desde el 2026-10-22 (§9). |
| P7 | Las canas se alinean con los tramos de CO-05 (`02-diseno-cotizador.md` §1.1), decidido el 2026-10-22. No se toca la base de producción ni la regla CO-05. |
| P8 | No hay acceso a una landing externa, así que queda fuera de la auditoría. Velli no tiene dominio propio (§9). |
| P9 | «Con marca Velli» significa un pie «Cotización hecha con Velli · {dominio de la app}». Pro+IA va sin ese pie. |
| P10 | La Etapa 2 usa una estimación documentada. Los tokens de imagen se cuentan con imágenes sintéticas del mismo tamaño, nunca con fotos de clientas. |
| P11 | Los textos de la base de conocimiento que mencionan el Pasaporte se dejan. En la interfaz de la estilista, la mención se oculta con el flag `app_clientas`. |
| P12 | La agenda se queda en la barra inferior. |
| P13 | Vanessa redacta los textos legales (desde el 2026-10-22). El link público no sale sin ellos. |
| P14 | Se agrega la columna `profiles.feature_flags` y un trigger que impide a las cuentas cambiarla. Si la columna no existe, el código usa los valores del entorno. |

## 9. Cambios de dirección (2026-10-22)

Vanessa construye Velli sola. Desde esta fecha:

**Sin validación externa.** Lo que esperaba una validación externa pasa a estándares de la industria en Colombia, configurables:

| Variable | Estándar |
|---|---|
| Largo | Corto (mentón) · Medio (hombros o clavícula) · Largo (media espalda o tira del brasier) · Extra largo (cintura o más) |
| Estado de la fibra | Sana / virgen (sin recargo) · Procesada / porosa (sugiere un tratamiento sellante) · Sensibilizada / muy dañada (alerta obligatoria de prueba de mechón y aditivo protector Plex) |
| Canas | 0–25 % · 25–50 % · 50–75 % (+15 % de gramos por saturación) · 75–100 % (+20 % de gramos y técnica de prepigmentación) |

- El detalle está en `02-diseno-cotizador.md` §1.1 y §3, y la plantilla de papel ya los usa.
- Los textos que vienen de la validación técnica de agosto (los verbatim de C-08, A-02, CO-05, CO-09 y otros) no cambian.

**Dominio.** Velli no tiene dominio propio.
- La URL base sale de `NEXT_PUBLIC_APP_URL`, por defecto `https://velli-three.vercel.app`.
- El correo de soporte sale de `NEXT_PUBLIC_SUPPORT_EMAIL`. Sin esa variable, Configuración oculta el contacto y los textos legales lo marcan como pendiente.
- Las dos viven en `lib/sitio.ts`. No queda ningún dominio fijo en el código, los PDF, los metadatos ni los textos legales, y `tests/sitio.test.ts` lo vigila.

**Corregido en el código** (rama `velli-bi/fase-1`):
- Dependencias: `npm audit fix`. Next.js pasa a 16.4.2 y quedan 0 vulnerabilidades.
- R4: Términos y Privacidad nombran solo a Anthropic. Los Términos dicen que Velli es una herramienta de estimación administrativa y financiera, y que el diagnóstico presencial, las pruebas de alergia y de mechón y la aplicación química son responsabilidad exclusiva del profesional del salón.
- R7: los links de WhatsApp llevan el indicativo 57 (`lib/whatsapp.ts`).
- R12: ya no aparecen «Diagnósticos ilimitados con IA capilar» en Básico ni «Exportación a Excel» en Pro. Básico ofrece ahora «Diagnóstico capilar guiado».
- La galería de la cámara muestra el motivo cuando la IA no encuentra cabello en las fotos.
- `supabase/borradores/velli-bi-uso-ia.sql` solo acepta `anthropic` como proveedor.
- R5: el % de canas del asistente llega a la calculadora de color (`porcentajeCanasDesdePerfil()` en `lib/color/integracion.ts`). Con «más del 50 %», la calculadora pide un toque, «Entre 50 y 75 %» o «Más del 75 %», y no muestra guía ni fórmula hasta tenerlo. La opción del asistente no se dividió: tres reglas del motor leen `mas_50` (`02-diseno-cotizador.md` §1.1).
- **Implementado el 2026-10-23 (Fase 1 completa en código, 340 pruebas en verde):**
  - Motor y capa de datos del cotizador en `lib/cotizador/` (`variables.ts`, `precio.ts`, `costo.ts`, `comision.ts`, `whatsapp.ts`, `db.ts`).
  - Enlace público `/c/[token]` (`app/c/[token]/page.tsx`), exclusión en `public/sw.js` (R16), cierre legal de P13/R4 en `app/legal/privacidad` y `app/legal/terminos`, y flag `cotizador` en `lib/flags/registro.ts`.
  - Interfaz del cotizador: `HojaCotizar.tsx`, `ListaPorCobrar.tsx`, `app/configuracion/precios/page.tsx`, menú central en `BottomNavV2.tsx`, `ChecklistInicio.tsx` (P2) y estructura de planes en `lib/subscription/plans.ts`.
  - Control de cupo y registro de consumo de IA en `lib/ia/uso.ts` (tope de 150 análisis/mes en Pro+IA, 20 en prueba gratis, aviso al 80 % y máximo 2 validaciones por análisis) integrado en `/api/analyze-hair`, `/api/validate-hair-photo` y `CameraCapture.tsx`.
  - **Migraciones aplicadas en producción el 2026-10-23:** `supabase/velli-bi-uso-ia.sql` y `supabase/velli-bi-cotizador.sql` (verificadas por lectura las 8 tablas `uso_ia`, `estilistas`, `servicios_salon`, `plantillas_precio`, `productos_salon`, `comisiones`, `cotizaciones` y `cotizacion_eventos`, y activado `feature_flags = '{"cotizador": true}'` en el perfil principal).

**Sigue pendiente:**
- Todo lo de producción: las llaves de Bold (R18), quitar el nombre de las 40 notas internas de la base de conocimiento y el despliegue de esta rama. Las dos migraciones de perfiles (R17 y feature flags) ya están aplicadas.
