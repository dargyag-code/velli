# VELI · Benchmark Técnico y Visual UX/UI para Diseño en Figma

> **Alcance:** Investigación solo lectura (cero modificaciones a código de aplicación, CSS, migraciones ni tests).  
> **Propósito:** Documento de referencia directo para construir en Figma los **4 frames definitivos de Veli** (`Vitrina Pública /s/[slug]`, `Shell Escritorio + Inicio`, `Workspace Silla "Sin Báscula"` y `App Móvil Especialista 390px`).  
> **Contexto técnico base:** `AGENTS.md`, `app/globals.css`, `app/layout.tsx`, `app/s/[slug]/page.tsx`, `app/c/[token]/page.tsx`, `app/page.tsx`, `app/agenda/page.tsx`, `app/reportes/page.tsx`, `lib/cotizador/*`, `lib/costo.ts`, `lib/organizations/*`.

---

## 1. URLs realmente inspeccionadas

La recolección de benchmarks externos se ejecutó mediante búsqueda web estructurada (`search_web`) sobre páginas de producto, centros de ayuda oficiales, documentación de desarrolladores y subdominios activos, respetando la regla anti-bucle (máximo 1 intento ante bloqueo). Adicionalmente, se auditó el código local de Veli en solo lectura.

### 1.1 Analizadas con éxito (hechos verificables extraídos)

| Plataforma | URL inspeccionada | Tipo | Dato clave verificable extraído |
|---|---|---|---|
| **GlossGenius** | `https://glossgenius.com` | Home B2B | Posicionamiento anti-ERP (*"Get more clients booking and rebooking"*), prueba social (`100,000+` / `130,000+` negocios, ~4.8/5 en G2/Capterra), CTAs (`Start free trial`, `Book a demo`, `Log In`), trial 14 días sin tarjeta. |
| **GlossGenius** | `https://glossgenius.com/pricing` | Precios | Tiers vigentes: Standard (`$24` anual / `$28` mensual, solo 1 tema `Classic`), Gold (`$48`/`$56`, hasta 9 miembros, 6 temas), Platinum (`$148`/`$168`, ilimitado), Practice (Medspa/HIPAA). Procesamiento: `2.4% + $0.15` presencial, `3.4% + $0.15` online/card-on-file. |
| **GlossGenius** | `https://glossgenius.com/features/*` | Producto | Propuesta sin app ni login para clientas (*"no app download, account creation, or login required"*), 0% comisión de marketplace, enlace propio `*.glossgenius.com`. |
| **GlossGenius** | `https://glossgenius.elevio.help` | Help Center oficial | Flujo exacto de reserva online (6–8 pasos), *Card on File*, depósitos, multi-servicio/multi-profesional, SMS OTP (números EE.UU. `+1-833-609-9048`, `98368`), 7 temas y toggles `Starting Price (+)` / `Price Hidden ("Price Varies")`, restricción geográfica exclusiva EE.UU. |
| **GlossGenius (Sitio A)** | `https://greggala.glossgenius.com/` | Vitrina activa · Cabello/Color (Los Angeles, CA) | Categorías Haircuts/Color/Add-ons, precios con `+` y duración (`CUT New Client $140+ · 120 min`, `Current $120+ · 90 min`, `Maintenance $110+ · 75 min`, add-on `Diffusing +$30 · +30+ min`), advertencias técnicas largas en texto plano. |
| **GlossGenius (Respaldo A)** | `https://panistyle.glossgenius.com/` | Vitrina activa · Colorimetría (Katy, TX) | Confirma fricción química: `Balayage $275+`, `Full Highlights $250+`, nota manual aclarando 1 bowl incluido con B3 Bond Builder y **`$25` por cada bowl adicional**. |
| **GlossGenius (Sitio B)** | `https://sacredlashstudio.glossgenius.com/` | Vitrina activa · Pestañas (Charlotte, NC) | Secciones `About / Services / Portfolio / Reviews / Book`, servicios `Classic Full Sets`, `1-Week / 2-Week Classic Fills`, política explícita de 50% por cancelación <24h. |
| **GlossGenius (Sitio C)** | `https://missesthetics.glossgenius.com/` | Vitrina activa · Spa/Estética (McKinney, TX) | Precios fijos y variables (`SkinPen Microneedling $395+ · 75+ min`, `Top Shelf $275 · 90 min`, `Pumpkin Facial $99+ · 45+ min` con 3 niveles 45/60/75 min, `Virtual Consultation $50 · 30 min`). |
| **Mangomint** | `https://www.mangomint.com/features/salon-spa-calendar` | Producto · Agenda | Columnas multi-especialista + Resource Scheduling (salas/equipos), estados dinámicos, slide-over `Appointment Details`. |
| **Mangomint** | `https://www.mangomint.com/learn/calendar-colors-appointment-icons` y `/learn/calendar-basics` | Help Center oficial | Mapa exacto de colores de estado (Peach, Blue, Purple, Pink, Dark Gray, Faded/Crossed), sub-tiempos (`Outlined` buffer, `Semi-Transparent` processing, `Diagonal Stripes` block), 4 íconos discretos (Star, Note, Circle Arrows, Pen), modo High Contrast. |
| **Mangomint** | `https://www.mangomint.com/features/pos-payments`, `/learn/how-to-split-payments`, `/learn/how-to-split-services-into-separate-checkouts` | Producto + Help · POS | Slide-out Checkout lateral, cobro mixto servicio + retail (con escáner), split payment con recálculo automático de saldo, separación en tickets, propinas por especialista, `Front Desk Display` y `Client Self Checkout`. |
| **Mangomint** | `https://www.mangomint.com/features/client-management` y `/learn/client-details` | Producto + Help · CRM | Ficha `Client Details` en 6 pestañas limpias: `Timeline`, `Profile`, `Notes`, `Forms`, `Tags`, `Memberships`. |
| **Mangomint** | `https://www.mangomint.com/features/staff-management`, `/features/payroll-processing`, `/learn/payroll-report` | Producto + Help · Staff | Permisos granulares booleanos, comisiones escalonadas servicio/retail, Time Clock con PIN, `Payroll Report` interactivo y app móvil de staff. |
| **Mangomint** | `https://www.mangomint.com/features/flows`, `/learn/flows-basics`, `/learn/help-articles/automated-flows` | Producto + Help · Flows | Automatización visual en 4 bloques (`Trigger`, `Condition`, `Wait/Delay`, `Action`) + plantillas listas. |
| **Mangomint** | `https://www.mangomint.com/learn/help-articles/calendar/express-booking` y `/learn/help-articles/payments` | Help Center oficial | `Express Booking™` vía SMS temporal, `App Manager` modular y Command Bar `Cmd+K` con atajos por iniciales (`G C` → Gift Cards). |
| **Boulevard** | `https://www.joinblvd.com` | Producto completo | Self-Booking overlay, `Precision Scheduling™`, navegación Sidebar colapsable + Top Bar utilitaria, pestaña dedicada `Front Desk`, `Boulevard Duo™` POS y `Reports`. |
| **Boulevard** | `https://developers.joinblvd.com` | Docs técnicos | Webhooks exactos de estados (`CREATED`, `CONFIRMED`, `ARRIVED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `RESCHEDULED`) y `@boulevard/blvd-book-sdk` (overlay embebible). |
| **Squire** | `https://www.getsquire.com` (Home, Commander, POS, Payouts, Pricing, About) | Producto oficial | Copy editorial de oficio/autonomía (*"Built For The Modern Barbershop"*, *"The chair is just where it starts"*), arquitectura *SQUIRE Commander*, payouts/booth rent/comisiones, tiers `$30–$250/mo`. |
| **Squire (Design System)** | `https://rh.design` + App Store (`apple.com` · SQUIRE Commander) | Case study + App | Sistema de +600 componentes, ergonomía móvil/tablet en silla a 1–2 toques, tagline *"Hustle Smarter"*, paleta arquitectónica neutra de alto contraste. |
| **Contraste técnico** | `capterra.com`, `g2.com`, `thesalonbusiness.com`, `schedulingkit.com` | Reviews UX | Validación de fricciones reales (rigidez multi-sede en reportes de Boulevard; curva de uso en SQUIRE). |

### 1.2 Bloqueadas, acceso parcial o sin DOM directo

| URL / Recurso | Estado | Motivo y acción tomada |
|---|---|---|
| `https://glossgenius.com`, `https://glossgenius.com/pricing`, `https://greggala.glossgenius.com`, `https://panistyle.glossgenius.com`, `https://lemuriahair.glossgenius.com` | **Sin DOM directo vía HTTP local** | Entorno sandbox sin resolución DNS externa (`No se puede resolver el nombre remoto`). No se midió DOM en vivo; se sustituyó inmediatamente por documentación oficial y snippets verificados sin reintentos en bucle. |
| `https://sacredlashstudio.glossgenius.com/` y `https://lemuriahair.glossgenius.com/` | **Acceso parcial (JS)** | Se verificaron secciones, servicios y políticas, pero las tablas de precios en `$` y minutos se renderizan dinámicamente en cliente JS fuera del índice público. |
| `https://support.joinblvd.com` | **Restringido / parcial** | Artículos internos de interfaz autenticada no están indexados públicamente (requieren sesión). Complementado con `developers.joinblvd.com` y páginas de producto de `joinblvd.com`. |
| Artículos profundos de `mangomint.com/learn` (*Virtual Waiting Room* e íconos secundarios) | **Parcial** | Redirección sin desglose completo en snippet; solo se reportaron los estados e íconos explícitamente verificados. |

---

## 2. Anatomía comparada de Vitrinas Públicas

### 2.1 Tabla comparativa (GlossGenius vs. Boulevard vs. Squire vs. Veli actual)

| Dimensión | GlossGenius (`*.glossgenius.com`) | Boulevard (`@boulevard/blvd-book-sdk`) | Squire (Booking / Flex) | Veli actual (`/s/[slug]`) |
|---|---|---|---|---|
| **Contenedor y marca** | Mini-sitio independiente (`negocio.glossgenius.com`) con 7 temas (`Classic` gratis; 6 en Gold). Algunos temas fuerzan CTA negro. | **Overlay widget** embebido sobre el sitio propio del salón; conserva 100% el branding sin salir de la web. | Vitrina web propia + app *branded* (*Flex*) con fotografía documental oscura/neutra de oficio. | Ruta pública propia `/s/[slug]` (`force-dynamic`, `no-store`) con `brand_settings` (`displayName`, `logoUrl`, `primaryColor`, `publicTagline`). |
| **Estructura de vitrina** | Cover Hero + `Book Now` + nav `Home / Services / Portfolio / About / Reviews / Gift Cards`. En 6 temas inyecta 3–4 servicios con foto obligatorios. | Selector modal por pasos dentro del overlay: Sede → Categoría/Servicio → Add-ons → Especialista → Horarios optimizados. | Perfil compacto de barbería/barbero → lista limpia de servicios con precio y duración → flujo lineal a 1 mano. | Cabecera editorial con logo/color → Tabs **Servicios** y **Tienda** → buscador + filtros por categoría → tarjetas de servicio/producto + drawer de reserva y carrito retail. |
| **Pasos reales de reserva** | **6 pasos base (hasta 8 con condiciones):** Abrir link → `Book Now` → Elegir servicio(s) → Add-ons → Fecha/Hora → Datos (Nombre, Tel, Email, notas) → *(Card on File / Depósito / SMS OTP)* → Confirmación SMS+Email. | **6 pasos optimizados:** Abrir overlay → Sede → Servicio → Prompt de **Add-Ons compatibles** → Especialista → Horario agrupado (*Precision Scheduling*) → Tarjeta guardada + confirmación. | **4–5 pasos rápidos:** Servicio → Barbero/Especialista → Fecha/Hora → Datos + protección no-show → Confirmación + recibo/propina. | **4 pasos en `VitrinaPublicaClient.tsx`:** Elegir Servicio → Especialista (o cualquiera) → Fecha/Hora (`America/Bogota`) → Datos básicos → Persistencia en `POST /api/public/appointments` + apertura directa de **WhatsApp** (`wa.me`). |
| **Qué NO pide al cliente** | No exige descargar app ni crear cuenta/contraseña (*guest checkout*). | No saca al usuario a un marketplace; sin creación obligatoria de cuenta previa. | Flujo rápido en móvil sin fricción de registro largo. | Sin cuenta, sin contraseña, sin descarga de app, sin exigir tarjeta de crédito para apartar. |
| **Manejo de variantes y precios variables** | Solo 2 switches binarios: **`Starting Price` (`$275+`)** o **`Price Hidden` (`"Price Varies"`)**. Obliga a párrafos largos defensivos (`$25/bowl extra`). | Servicios multi-paso + **Add-Ons sugeridos contextualmente** antes de elegir horario (sube el ticket promedio). | Servicios claros por corte/barba/combo + add-ons discretos con duración exacta. | En servicios: precio base + duración (aún sin variantes/add-ons públicos ni badge "Desde"). En Tienda retail (`catalog_products`): variantes (`ml`, `talla`, `aroma`, `presentacion`) + carrito persistido en `public_orders`. |
| **Fricciones / errores a evitar** | 1) Solo EE.UU./USD. 2) Exige *Card on File* (`3.4%+$0.15`) que frena conversión en LATAM. 3) SMS en inglés (`+1-833`) en vez de WhatsApp. 4) Paywall de temas estéticos. 5) Cero ayuda para cotizar complejidad química. | 1) Depende de tener sitio web previo para embeber el overlay. 2) Requiere tarjeta guardada (fricción en Colombia). 3) Complejidad de configuración inicial alta para negocios pequeños. | 1) Enfoque 100% barbería; no contempla tiempos de pose ni consumo químico. 2) Fricción de tarjeta en archivo para mercados basados en transferencia/Nequi. | 1) Placeholder de búsqueda hardcodeado a cabello (*"Balayage, Hidratación"*) incluso en `barber_studio`/`nail_bar`. 2) Sin señal visual de "Precio desde" vs "Precio fijo" ni guía de add-ons. 3) `/c/[token]` aún no consume `brand_settings` (usa `#3B0D1E` fijo). |

### 2.2 Especificación lista para diseñar `/s/[slug]` en Figma

**Regla de privacidad innegociable (`AGENTS.md`):** `/s/[slug]` jamás expone costos internos, gramos/fórmulas químicas, márgenes ni comisiones. Solo proyecta catálogo público, disponibilidad horaria en `America/Bogota`, equipo visible, políticas y precios al cliente en COP sin decimales (`$120.000`).

- **Arquitectura de dos modos claros (`390px` y `1440px`):**
  1. **Cabecera de marca parametrizable (`brand_settings`):**
     - Fondo blanco limpio (`#FFFFFF`) sobre lienzo `#FAF7F5` (sin hero oscuro pesado por defecto).
     - Logo cuadrado/circular del negocio (`56×56px` en móvil, `72×72px` en escritorio), `display_name` en `Fraunces SemiBold`, `public_tagline` (máx. 1 línea en `Plus Jakarta Sans 14px` `#6B535C`), ubicación/ciudad + horario de hoy (`Abierto hoy · 09:00–19:00`) + botón secundario de WhatsApp directo y botón primario **`Reservar cita`** teñido con `brand_settings.primary_color` (fallback `#3B0D1E`).
  2. **Navegación local limpia (Segmented Tabs, máx. 3 pestañas):**
     - `Servicios` (activa por defecto) · `Tienda` (si hay `catalog_products` activos) · `Info y Políticas` (dirección, horarios, equipo y política de cancelación/anticipo local).
  3. **Catálogo de servicios con claridad de precio (superando a GlossGenius):**
     - Barra de búsqueda con placeholder **dinámico según `organizations.vertical`** (`"Buscar corte, barba..."` en `barber_studio`; `"Buscar balayage, hidratación..."` en `hair_studio`; `"Buscar semipermanente, lifting..."` en `nail_bar`).
     - Chips horizontales de categoría con scroll suave (`Todos`, `Color`, `Corte`, `Tratamientos`, etc.).
     - **Tarjeta de servicio estándar (limpia, 1 sola columna en `390px`, 2 columnas en `1440px`):**
       - Izquierda: Nombre del servicio (`16px Bold`), descripción máx. 2 líneas (`13px` `#6B535C`), metadato de duración (`90 min` con ícono reloj `14px`).
       - Derecha (alineada a la derecha, `tabular-nums`): Precio claro (`$120.000` si es fijo, o etiqueta discreta **`Desde $210.000`** si el servicio tiene variables de largo/densidad — jamás `"Price Varies"` sin referencia numérica) + botón compacto **`Elegir`** (`36px` alto).
  4. **Embudo de reserva en Drawer lateral (`1440px`, `440px` ancho) / Bottom Sheet completo (`390px`) en 4 pasos:**
     - **Paso 1 · Servicios y Add-ons:** Servicio seleccionado + sugerencia opcional de 1–2 add-ons compatibles (aprendizaje de Boulevard para subir ticket sin saturar) + barra resumen fija abajo con duración total y estimado COP.
     - **Paso 2 · Especialista:** Tarjeta `"Cualquier especialista disponible (más rápido)"` arriba + lista del equipo con foto/iniciales y especialidad.
     - **Paso 3 · Fecha y Hora (`America/Bogota`):** Tira horizontal de días (7 días visibles con swipe) + grilla de franjas horarias (`3 columnas` en `390px`, `4 columnas` en `1440px`) ocultando huecos imposibles y resaltando franjas óptimas.
     - **Paso 4 · Confirmación sin fricción Colombia:** Solo **Nombre**, **Celular WhatsApp (`+57`)** y **Nota opcional** (0 contraseñas, 0 tarjeta obligatoria). Si el negocio exige anticipo, muestra opción transparente de pago local (**Nequi / PSE / Bold**). Al confirmar: guarda cita en DB y presenta pantalla de éxito con código de reserva + botón verde/marca **`Confirmar por WhatsApp`** (mensaje prellenado) + `Agregar al calendario`.

---

## 3. Anatomía comparada del Panel SaaS Interno

### 3.1 Tabla comparativa (Mangomint vs. Boulevard vs. Squire Commander vs. Veli actual)

| Dimensión | Mangomint | Boulevard | Squire Commander | Veli actual (`c:\Users\vanes\velli-pro`) |
|---|---|---|---|---|
| **Navegación principal** | Topbar mínima (`Calendar`, `Clients`, `Sales`, `Messages`, `Reports`, `Settings`) + `App Manager` modular + **`Cmd+K`** con atajos por iniciales. | **Sidebar izquierdo colapsable** (`Front Desk`, `Calendar`, `Clients`, `Sales`, `Marketing`, `Inventory`, `Reports`, `Manage`) + **Top Bar utilitaria** (Search, `+`, alertas, sede). | Navegación compacta orientada a operación diaria en mostrador/silla: Agenda, Clientes, POS/Pagos, Equipo/Payouts. | `VelvetTopHeader` superior con 6 tabs para admin (`Workspace Silla`, `Agenda`, `Clientas CRM`, `Vitrina & Pedidos`, `BI & Nómina`, `Calibración $`) y 3 para `specialist` (`Silla`, `Agenda`, `Clientas`). Sin `Cmd+K` ni sidebar. |
| **Patrón de detalle y edición** | **Slide-over lateral derecho** para `Appointment Details`, `Checkout` y `Waitlist`. Nunca destruye el contexto del calendario. | **Flyout drawer derecho** en calendario + vista dedicada **`Front Desk`** para flujo en vivo de llegadas. | Paneles rápidos a 1–2 toques sin jerarquías profundas; optimizado para tablet/móvil en silla. | Páginas completas y modales centrados en `/agenda` y `/`; puente directo **"Abrir en silla"** desde `/agenda` hacia `/?clientaId=...`. |
| **Agenda multi-especialista** | Fondo blanco = turno activo; gris claro (o oscuro en High Contrast) = fuera de turno; línea roja hora actual. Sub-tiempos: `Outlined` (buffer), `Semi-Transparent` (pose), `Diagonal Stripes` (bloqueo). 4 micro-íconos sobre cita. | Grilla boutique limpia con codificación suave por estado (`CREATED`, `CONFIRMED`, `ARRIVED`, `ACTIVE`, `COMPLETED`, `CANCELLED`). | Bloques de alto contraste con hora, cliente y servicio legibles en <1 segundo entre turnos. | Vista Día/Semana en `America/Bogota`, filtro por especialista, estados `pending`, `confirmed`, `in_chair`, `completed`, `no_show`, `cancelled`. Sin diferenciación visual de pose vs buffer ni slide-over lateral. |
| **Cobro mixto (servicio + retail)** | Slide-over en 2 pasos: 1) Carrito (servicios + retail + código de barras + descuentos) → 2) Pagos (split payment con recálculo automático + propina por especialista). | Checkout guiado + `Boulevard Duo™` iPad de recepción, split payments, membresías y comisiones automáticas. | Tap-to-Pay rápido, propinas sugeridas, recibo SMS y atribución instantánea a comisión o renta de silla. | Cierre en 1 toque (`/?tab=cierre`, `ListaPorCobrar`) para cotizaciones de servicio. Pedidos retail (`public_orders`) viven separados en `/vitrina` sin cobro unificado en caja. |
| **KPIs y BI Financiero** | Reportes interactivos (`Payroll Report`, ventas, comisiones escalonadas) con estética sobria y filtros por periodo. | Reportes visuales limpios por rol/especialista/utilización (aunque usuarios reportan rigidez al cruzar multi-sede). | Resumen directo de ventas del día, propinas y *payouts* depositables (*Rapid Transfer*). | `/reportes` (solo admin): ingresos cobrados, inversión química, comisiones, utilidad neta, margen %, desvío gramos teóricos vs reales y liquidación por especialista con botón WhatsApp. |
| **App / Vista móvil Especialista (`390px`)** | App nativa iOS/Android con agenda personal, historial de clientes y checkout según permisos granulares. | Acceso de equipo filtrado por permisos y agenda individual. | **`SQUIRE Commander`** móvil: agenda del día + cobro rápido + **ganancias/payouts diarios visibles** en <2 toques. | `specialist` tiene aislamiento real por RLS (no ve costos ni márgenes), ve 3 tabs (`Silla`, `Agenda`, `Clientas`), **pero** `/agenda` abre en `'todas'` por defecto y **no tiene vista de "Mis Ganancias"** (comisiones propias). |

### 3.2 Qué tomar exactamente de Mangomint, Boulevard y Squire para el Shell de Veli

1. **De Boulevard → Shell de Escritorio `1440px` (Sidebar colapsable + Top Bar utilitaria):**
   - El header horizontal actual de Veli con 6+ pestañas + plan + configuración se satura al crecer (cuando se sumen Inventario, Caja o Automatizaciones).
   - Adoptar un **Sidebar izquierdo limpio (`240px` expandido / `72px` colapsado)** dividido en 3 grupos semánticos claros:
     - **Operación:** `Inicio` (vista estilo *Front Desk* de Boulevard), `Agenda`, `Workspace Silla`, `Clientes`.
     - **Crecimiento y Finanzas:** `Vitrina y Pedidos`, `BI y Nómina`.
     - **Estudio (colapsado al pie):** `Calibración $`, `Marca y Configuración`.
   - Mantener una **Top Bar utilitaria (`60px` alto)** que contenga exclusivamente: Buscador global `Cmd+K` (`Buscar cliente, cita o servicio...`), botón primario rápido `+ Nueva cita` / `+ Abrir silla` y perfil de usuario/sede.
2. **De Mangomint → Slide-overs laterales, códigos visuales de agenda y `Cmd+K`:**
   - **Cero modales pesados para ver/editar citas o cobrar:** todo detalle de cita (`Appointment Details`) y todo cierre de caja (servicio + retail + método de pago Colombia: Efectivo / Nequi / Daviplata / Tarjeta Bold / Mixto) se abre en un **slide-over derecho de `420px`–`460px`** sobre la vista activa.
   - **Tratamiento visual de la agenda:** fondo blanco para horas laborales (`specialist_schedules`), trama/gris cálido `#F5F0ED` para fuera de turno, indicador horizontal fino en `#D97757` para la hora actual, y tarjetas de cita con **borde lateral izquierdo semántico de `3px`** + fondo tintado ultra suave (al 6–8% de opacidad) en lugar de bloques sólidos chillones.
   - **Máximo 3 micro-íconos en tarjeta de cita** (ej.: nota clínica, recordatorio WhatsApp enviado, riesgo/guardarraíl químico) para lectura instantánea sin fatiga visual.
3. **De Squire Commander → Vista Móvil Especialista (`390px`) centrada en oficio y transparencia:**
   - Bottom navigation de **3 pilares puros** (`Mi Día`, `Mi Silla`, `Mis Ganancias`) sin exponer navegación administrativa.
   - En `Mi Día`, la agenda abre **pre-filtrada al especialista autenticado** con las próximas citas en orden cronológico y acción de 1 toque **`Abrir en silla`** (sin pasar por filtros).
   - En `Mis Ganancias`, mostrar exclusivamente sus **servicios completados y comisión acumulada del día/semana** (nunca costos químicos del salón ni utilidad neta del dueño, preservando intacta la barrera RLS actual).

---

## 4. Guía de proporciones y sistema visual para Figma

Basada en los tokens reales de `app/globals.css` y las restricciones estrictas de `AGENTS.md`, ajustada para lograr **100% neutralidad de género** y **0% estética de plantilla de IA**.

### 4.1 Escala tipográfica exacta (Figma Text Styles)

> **Regla global:** Activar `Tabular Figures` (`tnum`) en **todas** las cifras monetarias (`COP`), horas, duraciones, porcentajes, gramos y mililitros.

| Rol / Estilo Figma | Familia | Peso | Tamaño / Line-Height | Tracking | Uso estricto |
|---|---|---|---|---|---|
| `Display / Page H1` | **Fraunces** | SemiBold (600) | `28px / 34px` (`24px / 30px` móvil) | `-0.025em` | Título principal de pantalla (`Inicio`, `Workspace Silla`, `display_name` en `/s/[slug]`). Máx. 1 por vista. |
| `Display / KPI Hero` | **Fraunces** | SemiBold (600) | `32px / 36px` (`26px / 30px` móvil) | `-0.03em` | Cifra protagónica de BI o Ganancias del día (`$4.850.000`, `41.2%`). Siempre `tabular-nums`. |
| `Heading / Section H2` | **Plus Jakarta Sans** | Bold (700) | `18px / 24px` | `-0.02em` | Títulos de tarjeta, categorías de vitrina y encabezados de Drawer/Slide-over. |
| `Heading / Card H3` | **Plus Jakarta Sans** | SemiBold (600) | `15px / 20px` | `-0.01em` | Nombre de servicio, nombre de cliente en fila, título de bloque operativo. |
| `Body / Default` | **Plus Jakarta Sans** | Regular (400) / Medium (500) | `14px / 20px` | `0em` | Formularios, botones, descripciones de servicio, tablas operativas. |
| `Body / Small` | **Plus Jakarta Sans** | Medium (500) | `13px / 18px` | `0em` | Subtítulos, notas de cita, metadatos de horario y estado. |
| `Label / Overline` | **Plus Jakarta Sans** | Bold (700) | `11px / 14px` | `+0.08em` | Etiquetas de sección en mayúsculas (`.v-caps`). **Prohibido** usar `Fraunces Italic` (`.v-eyebrow`) en controles operativos o barberías. |
| `Mono / Formula & Tech` | **JetBrains Mono** | Medium (500) / SemiBold (600) | `13px / 18px` (badge: `12px`) | `0em` | Fórmulas químicas (`60g + 90ml`), equivalencias (`≈ 1 tubo 60g`), códigos `#TOKEN`, horas de grilla (`09:30`). Siempre `tabular-nums`. |

### 4.2 Radios, paddings, grillas y densidad de tablas

| Elemento | Medida exacta Figma | Nota operativa |
|---|---|---|
| **Artboards base** | Escritorio: **`1440 × 900px`** (scroll vertical libre) · Móvil: **`390 × 844px`** | Safe area inferior móvil: `34px` + Bottom Nav `64px`. |
| **Grilla Escritorio (`1440px`)** | Sidebar `240px` + Contenido fluido (`max-width: 1200px`, padding lateral `32px`, `12 cols`, gutter `20px`) | Evitar tarjetas estiradas a todo el ancho sin límite de lectura. |
| **Grilla Móvil (`390px`)** | `4 cols`, margen lateral **`16px`**, gutter **`12px`** | Todos los tap targets interactivos ≥ **`44×44px`** (stepper `-5g/+5g`: `44×44px`). |
| **Radios (`border-radius`)** | Tarjeta principal (`.v-card-hi`): **`24px`** (`rounded-3xl`) · Tarjeta interna / Drawer item: **`16px`** · Inputs / Botones / Selectores: **`12px`** · Chips / Tags estado: **`8px`** (o `999px` solo en filtros de categoría) | Usar **`8px` en badges de estado operativo** en vez de exceso de píldoras redondas reduce el aspecto de "plantilla IA". |
| **Paddings de tarjetas** | Tarjeta KPI / Resumen: **`20px`** (`16px` móvil) · Tarjeta Workspace / Formulario: **`24px`** (`16px` móvil) · Fila de servicio / cita: **`14px 16px`** | Separación vertical entre bloques hermanos: **`16px`–`20px`**; entre secciones macro: **`28px`–`32px`**. |
| **Densidad de tablas (BI, CRM, Pedidos)** | Header tabla: **`40px`** alto (`11px Bold Uppercase` `#6B535C`, fondo `#FAF7F5`) · Fila operativa: **`52px`–`56px`** alto · Separador: `1px solid #EFE8E4` | Máximo **5–6 columnas visibles** por tabla. Cifras alineadas a la **derecha** (`tabular-nums`), texto a la izquierda. Cero bordes verticales. |
| **Elevación / Sombras** | Superficies estándar: **borde `1px solid #EFE8E4` + sin sombra** o `--shadow-velvet` (`0 10px 30px -5px rgba(59,13,30,0.05)`). Slide-overs/popovers: `--shadow-md` (`rgba(59,13,30,0.07)`). | **Prohibido** usar `shadow-xl`/`shadow-2xl` negras sobre tarjetas planas. |

### 4.3 Regla exacta de dosificación del color (100% neutro en género y cero plantilla IA)

**Regla 85 / 10 / 4 / 1 (aplicable a toda pantalla del SaaS y a la Vitrina):**

1. **85% Superficies neutras cálidas y estructurales:**
   - Lienzo de fondo: `#FAF7F5` (`velvet-cream`).
   - Tarjetas, drawers y columnas activas de agenda: `#FFFFFF`.
   - Bordes y divisores: `#EFE8E4` (`1px`).
   - Fondo secundario neutro (hover suave, tiempo fuera de turno, inputs deshabilitados): `#F4EFEA` (preferir piedra cálida neutra en lugar de `#F5EBE8` rosado cuando se diseñen componentes transversales multi-vertical).
2. **10% Tinta tipográfica arquitectónica (cero negro puro `#000000`, cero gris azulado frío):**
   - Texto primario: `#3B0D1E` en panel interno de Veli *(y carbón cálido `#262120` opcional en vitrinas `/s/[slug]` cuando `brand_settings.primary_color` sea distinto al ciruela)*.
   - Texto secundario: `#6B535C` (etiquetas, subtítulos, descripciones).
   - Texto terciario / placeholders: `#947C85`.
3. **4% Semántica operativa y financiera (solo donde comunica dato real, nunca decoración):**
   - **Confirmado / Rentabilidad óptima / Margen sano (`>=30%`):** `#0D9488` sobre `#F0FDFA` (borde `#CCFBF1`).
   - **Alerta de margen (`<30%`), guardarraíl clínico, pendiente de cobro o calibración:** `#D97757` sobre `#FFF7F5` (borde `#FDE2D8`).
   - **En silla / Proceso activo:** Tinta de marca al 8% de opacidad con borde lateral `3px` en `#3B0D1E`.
   - **Auditoría crítica sobre `--bi-smart: #7C3AED` (violeta actual en `app/globals.css:41`):** **Reducir a <1% o reemplazar en Figma por tinta `#3B0D1E` + superficie `#F4EFEA` con tipografía `JetBrains Mono`**. El violeta/amatista `#7C3AED` aplicado a tarjetas o badges activa inmediatamente la percepción visual de "software genérico generado con IA" (y choca con barberías). El motor *"Sin Báscula"* debe lucir como un **instrumento de laboratorio/arquitectura** (monoespaciado, líneas finas, contraste limpio), no como un bloque morado "mágico".
4. **1% Acento de marca (`brand_settings.primary_color`, fallback `#3B0D1E`):**
   - Reservado **exclusivamente** para: 1 CTA primario por viewport (`Reservar cita`, `Guardar y enviar`, `Cobrar`), ítem activo del sidebar (barra lateral izquierda de `3px` + fondo `#F5EBE8` / `primary 8%`) y estado seleccionado de un control (`border: 1.5px solid primary`).

**Checklist de neutralidad de género obligatoria en Figma (aprendizaje Squire + auditoría local):**
- **Paletas preset en `brand_settings` para validar neutralidad al diseñar `/s/[slug]`:**
  - *Velvet Editorial (default):* `#3B0D1E` + piedra `#EAE4E0`.
  - *Barbería / Estudio Grafito:* `#1F2421` (bosque carbón) + piedra `#E6E4E0`.
  - *Estudio Terroso / Spa:* `#3F362E` (espresso) + arena `#EBE6DF`.
  - *Estudio Marino / Clínico:* `#1E2D3D` (azul tinta) + lino `#E6E9EC`.
- **Copy 100% neutro en toda la UI:** Usar **Cliente** (no *clienta*), **Especialista / Profesional** (no *estilista / asignada*), **Estudio** (o `display_name`), y reemplazar referencias corporales sesgadas detectadas en código (`"tira del brasier"` en `lib/cotizador/variables.ts:69` → **`"Media espalda"`**).
- **Cero ornamentos artificiales:** Cero gradientes morados/rosados, cero íconos de destellos/estrellitas "✨ IA", cero textos en cursiva romántica dentro de formularios o botones, y eliminar fugas técnicas como el badge `LIB/COSTO.TS` (`app/page.tsx:1975`).

---

## 5. Blueprint de los 4 frames prioritarios en Figma

### Frame 1 · Vitrina Pública `/s/[slug]` (`390px` + `1440px`)

**Objetivo de negocio:** Convertir tráfico de Instagram/WhatsApp en citas confirmadas y pedidos retail sin comisión de marketplace, sin crear cuenta y con identidad 100% del negocio.

| Bloque | Componentes exactos y contenido real | Estados a dibujar en Figma |
|---|---|---|
| **1. Cabecera de marca (`Brand Header`)** | Logo (`56px` móvil / `72px` desktop), `H1` nombre del estudio (ej. `Atelier Norte` en variante neutra/barbería o `Maison Lino` en colorimetría), `public_tagline` (1 línea), chip de estado (`Abierto hoy · 09:00–19:00`), ciudad (`Bogotá · Chapinero`), botón secundario `WhatsApp`, botón primario `Reservar cita` (`primary_color`). | **2 variantes de marca:** (a) default `#3B0D1E` estudio cabello; (b) preset barbería `#1F2421` para comprobar neutralidad de género. |
| **2. Barra de navegación y búsqueda** | Segmented Tabs (`Servicios` · `Tienda (6)` · `Info y Políticas`) + input buscador (`44px` alto, placeholder contextual a la vertical) + fila horizontal de chips de categoría (`Todos`, `Colorimetría`, `Corte`, `Tratamientos`). | Tab `Servicios` activa; chip seleccionado con borde `1.5px primary`. |
| **3. Catálogo de servicios** | Lista (`1 col` en `390px`) / Grilla (`2 cols` en `1440px`) de `ServiceCard` (`bg-white`, `rounded-2xl`, `border #EFE8E4`, padding `16px`): Nombre (`16px Bold`), descripción 2 líneas, duración (`120 min`), precio derecho en `tabular-nums` (`$120.000` o **`Desde $210.000`**) + CTA `Elegir`. | Tarjeta reposo, hover (`border #D8CFC9`), y seleccionada (`badge "1 elegido"` + barra inferior flotante fija `Continuar · 120 min · Desde $210.000`). |
| **4. Flujo de reserva (Drawer `440px` en `1440px` / Sheet en `390px`)** | Indicador lineal de 4 pasos (`1. Servicio` · `2. Especialista` · `3. Horario` · `4. Confirmar`). Mostrar abierto el **Paso 3 (Fecha/Hora)** con tira de 7 días + grilla de horas (`09:00`, `10:30`, `14:00` en `JetBrains Mono`) y un mini-frame anexo del **Paso 4 (Confirmación)** con inputs `Nombre`, `WhatsApp (+57)`, `Nota opcional`, aviso transparente de política/anticipo (Nequi/PSE/Bold si aplica) y CTA **`Confirmar y abrir WhatsApp`**. | Horario disponible, horario seleccionado (`primary`), sin cupo (deshabilitado). Estado final de confirmación con código `#RES-4821` y botón WhatsApp. |
| **5. Bloque Tienda / Carrito (mini-estado o sección inferior)** | `ProductCard` con foto 4:3, nombre, selector de variante (`250 ml`, `500 ml`), precio COP y `+ Agregar`. Botón flotante de carrito si hay ítems (`2 productos · $148.000`). | En stock vs agotado (`Agotado` discreto). |

---

### Frame 2 · Shell Escritorio + Inicio (`1440px`)

**Objetivo de negocio:** Dar al dueño/administrador control total de la operación del día (patrón *Front Desk* de Boulevard + claridad financiera de Veli) sin fatiga visual.

| Bloque | Componentes exactos y contenido real | Estados a dibujar en Figma |
|---|---|---|
| **1. Sidebar Izquierdo (`240px` fijo, colapsable a `72px`)** | Header con isotipo Veli + nombre del negocio + badge discreto del plan (`Pro`). **Grupo Operación:** `Inicio` (activo), `Agenda`, `Workspace Silla`, `Clientes`. **Grupo Negocio:** `Vitrina y Pedidos` (contador numérico simple si hay pedidos nuevos), `BI y Nómina`. **Grupo Estudio (al pie):** `Calibración $`, `Marca y Configuración`, botón colapsar sidebar. | Ítem activo con indicador izquierdo `3px` en `#3B0D1E`, fondo `#F4EFEA`, texto `#3B0D1E Bold`. Ítems inactivos `#6B535C`. |
| **2. Top Bar Utilitaria (`60px` alto, `bg-white/90`, `border-b #EFE8E4`)** | Izquierda: Fecha actual (`Jueves 26 Nov · Bogotá`) + filtro rápido de especialista/sede si aplica. Centro: Buscador global (`360px` ancho, `Buscar cliente, cita o servicio...` + keycap `⌘K` en `JetBrains Mono`). Derecha: Botón secundario `+ Nueva cita`, botón primario **`Abrir Silla`**, campana de notificaciones y avatar de usuario. | Buscador reposo + nota de interacción del Command Palette `⌘K` (Mangomint). |
| **3. Franja de KPIs del Día (4 tarjetas en grilla `4 cols`, gap `16px`)** | 1) **Cobrado hoy:** `$1.480.000` (`Fraunces 30px tabular-nums`, delta `+12% vs prom.` en `#0D9488`). 2) **Citas hoy:** `14` (`9 confirmadas · 3 en silla · 2 pendientes`). 3) **Margen neto estimado:** `43.8%` (`Meta ≥ 35%`, indicador `#0D9488`). 4) **Por cobrar en silla:** `3 tickets · $615.000` (enlace directo a cierre). | Tarjetas `bg-white rounded-3xl border #EFE8E4`, padding `20px`, cero sombras pesadas, cero gráficos de relleno decorativos. |
| **4. Cuerpo Principal Asimétrico (`8 cols` izquierda + `4 cols` derecha)** | **Izquierda · Recepción en Vivo (`Front Desk`):** Tabs rápidas (`En silla (3)`, `Próximas (6)`, `Por cobrar (3)`). Lista limpia de filas (`56px` alto) con: Hora (`JetBrains Mono`), Nombre cliente + badge cliente nuevo/recurrente, Servicio + Especialista, pill de estado (`8px` radio: `Confirmada`, `En silla`, `Pendiente`), y 2 acciones rápidas: ícono `WhatsApp` + botón **`Abrir en silla`** (o **`Cobrar`**). | Fila en estado `En silla` (borde izquierdo `3px #3B0D1E`), `Pendiente` (borde `#D97757`), `Confirmada` (`#0D9488`). |
| **5. Columna Derecha (`4 cols` · Acciones de Alto Valor)** | **Tarjeta A · Pedidos Vitrina `/s/[slug]`:** Últimos 2 pedidos retail (`status: sent_to_whatsapp`) con total COP y CTA `Gestionar` + botón `Copiar enlace vitrina`. **Tarjeta B · Alertas de Retención y Calibración:** 1) `8 clientes con +45 días sin visita` → `Reactivar por WhatsApp`. 2) `Desvío químico semanal: +14g/servicio` → `Ver en BI`. | Estado con datos + estado vacío limpio ("Todo al día en tu vitrina"). |

---

### Frame 3 · Workspace Silla "Sin Báscula" (`1440px`)

**Objetivo de negocio:** Permitir cotizar servicios complejos en <30 segundos frente al cliente, calcular consumo químico en unidades físicas sin báscula, proteger el margen real y enviar un comprobante transparente `/c/[token]` por WhatsApp.

| Bloque | Componentes exactos y contenido real | Estados a dibujar en Figma |
|---|---|---|
| **1. Cabecera de Sesión en Silla** | Breadcrumb `Workspace Silla`, tabs locales (`Cotizar en silla` · `Por cobrar (3)`), barra compacta de contexto: Selector de **Cliente** (`Camila Restrepo · Historial: 4 visitas`) + **Especialista** (`Mateo Rojas`) + **Servicio** (`Balayage Completo · Base $210.000`). | Cuando llega desde `/agenda` ("Abrir en silla"), muestra banner sutil `Cita 10:30 vinculada`. |
| **2. Layout Principal 2 Columnas (`7 cols` Configuración Técnica · `5 cols` Ticket Financiero Vivo Sticky)** | Separación visual clara: la izquierda es **táctil y de diagnóstico**; la derecha es el **tablero financiero y químico en tiempo real** que permanece visible al hacer scroll. | — |
| **3. Columna Izquierda · Diagnóstico en 4 Variables + Notas** | **4 grupos de selectores táctiles (tarjetas limpias `rounded-xl`, `48px+` alto, sin scroll):** 1) **Largo:** `Corto` · `Medio` · `Largo (media espalda)` · `Extra largo` (con impacto en COP discreto `+$45.000`). 2) **Densidad:** `Baja` · `Media` · `Alta (+$20.000)`. 3) **Estado de fibra:** `Sana` · `Procesada` · `Sensibilizada`. 4) **Canas / Cobertura:** `0–25%` · `25–50%` · `50–75%` · `75–100%`. **Bloque Guardarraíl Clínico (condicional):** alerta terracota `#FFF7F5` / borde `#D97757` solo si aplica regla (ej. *"Fibra sensibilizada: sugerir prueba de mechón + sellante antes de aclarar"*). | Selección activa con `border: 1.5px solid #3B0D1E` y fondo `#F4EFEA`. |
| **4. Columna Derecha · Módulo "Sin Báscula" (Instrumento de Precisión)** | **Tarjeta técnica (`bg-white rounded-3xl border #EFE8E4`, acento sobrio en `#3B0D1E`, CERO violeta IA, CERO badge `LIB/COSTO.TS`):** Header `Dosificación Sin Báscula` + selector de unidad física (`Cazo 30g` · `Tubo 60g` · `Onza 30ml`). Cifra principal en **`JetBrains Mono 24px`**: **`120 g`** + traducción física inmediata **`≈ 2 tubos (60g) · 4 cazos`** + peróxido calculado (`180 ml · 1:1.5`). Controles táctiles **`-5 g`** y **`+5 g`** (`44×44px`) con indicador de desvío sobre teórico (`+10g ajuste en vivo`). | Estado teórico base (`0g desvío`) y estado ajustado en vivo (`+10g` recalculando costo y margen al instante). |
| **5. Columna Derecha · Ticket Financiero Vivo & Protección de Margen (solo `owner`/`manager`)** | Desglose vertical alineado (`tabular-nums`): Precio calculado (`$275.000`), opción de ajuste manual con campo obligatorio `Motivo del ajuste` (regla DB `>=3 chars`), **Inversión química estimada** (`-$46.200`), **Comisión especialista (40%)** (`-$110.000`), línea divisoria `#EFE8E4`, **Utilidad neta del estudio** (`$118.800` · **`43.2%`** en `#0D9488`). **Estado de alerta (variante a dibujar):** si margen `<30%`, caja `#FFF7F5` con `Margen bajo (24.1%) · Precio sugerido para 35%: $315.000` + botón 1-clic `Aplicar sugerido`. **Footer de acciones:** Botón primario **`Guardar y enviar por WhatsApp`** (genera `/c/[token]` limpio sin costos) + botón secundario **`Cobrar ahora`** (abre slide-over de cobro). | Variante **Margen Sano (`43.2%`)** + variante **Alerta de Margen (`<30%`)** + nota de privacidad **Vista `specialist`** (oculta costos/comisión/utilidad y muestra solo Dosificación Sin Báscula + Total al cliente). |

---

### Frame 4 · App Móvil Especialista (`390px`: `Mi Día`, `Mi Silla`, `Mis Ganancias`)

**Objetivo de negocio:** Inspirada en *SQUIRE Commander* pero potenciada con *Sin Báscula* de Veli: operación a una sola mano en silla, cero exposición de costos/márgenes del negocio (respetando RLS) y visibilidad motivadora de ingresos propios.

*Diseñar como 3 artboards `390×844px` lado a lado en Figma compartiendo la misma **Bottom Navigation fija (`64px` + safe area)** con 3 ítems: `Mi Día` · `Mi Silla` · `Mis Ganancias`.*

| Sub-frame (`390×844px`) | Componentes exactos y contenido real | Estados y reglas clave |
|---|---|---|
| **4A · `Mi Día`** | **Top bar compacta (`56px`):** Saludo operativo (`Jueves 26 Nov`), nombre del especialista (`Mateo R.`), avatar/perfil. **Tira de resumen rápido (2 micro-cards horizontales):** `5 citas hoy` · `Próxima en 15 min`. **Tira de fechas semanal** (L–D, día activo en `#3B0D1E`). **Timeline vertical del día** (pre-filtrado al especialista, sin selector de "todas"): tarjetas de cita con hora en `JetBrains Mono` (`10:30 · 90 min`), nombre cliente, servicio, 1 micro-ícono si tiene nota previa, pill de estado (`Confirmada`, `En silla`, `Completada`), botón secundario `WhatsApp` y CTA de 1 toque **`Abrir en silla`** (`44px` alto). | Cita actual destacada con borde izquierdo `3px #3B0D1E`. Citas completadas con opacidad reducida (`65%`) para enfocar lo pendiente. |
| **4B · `Mi Silla` (Modo Silla Seguro RLS)** | **Header fijo compacto:** `Camila Restrepo` · `Balayage Completo` + botón `← Volver`. **Acordeón/Chips rápidos de las 4 variables** (`Largo: Largo`, `Densidad: Alta`, `Estado: Procesada`, `Canas: 0–25%`) editables a 1 toque. **Bloque Protagónico · Mezcla en Silla (Sin Báscula):** Cifra grande **`JetBrains Mono 28px`**: **`120 g`** + equivalencia física **`≈ 2 tubos (60g)`** + `Peróxido 180 ml (1:1.5)` + botones grandes **`-5 g`** / **`+5 g`** (`48×48px`) pensados para manos en operación. **Guardarraíl clínico (si aplica):** aviso breve no bloqueante. **Barra inferior fija:** Total al cliente **`$275.000`** + CTA **`Enviar comprobante WhatsApp`** (o `Finalizar servicio`). | **Estrictamente prohibido mostrar aquí:** costo químico en COP, precio por gramo, margen % del salón ni utilidad neta. |
| **4C · `Mis Ganancias`** | **Header:** `Mis Ganancias` + selector de periodo (`Hoy` · `Esta semana` · `Quincena`). **Tarjeta Hero limpia (`bg-white rounded-3xl border #EFE8E4`):** Etiqueta `COMISIÓN ESTIMADA` (`11px Bold`), cifra en **`Fraunces 32px tabular-nums`**: **`$342.000`**, subtítulo `7 servicios cobrados · 1 pendiente de cierre`. **Desglose transparente por servicio:** lista cronológica (`56px` fila) con fecha/hora, servicio + cliente (iniciales o nombre), regla aplicada (`40%`) y monto de su comisión en `tabular-nums` (`+$84.000` en `#0D9488`). **Pie informativo:** estado de liquidación (`Corte próximo: Lunes 30 Nov` · último pago recibido). | Solo expone ingresos del propio especialista (nunca totales del salón ni comisiones de compañeros). |

---

## 6. Oportunidades de diferenciación detectadas

Hallazgos concretos donde **ninguno de los 4 referentes globales** (GlossGenius, Mangomint, Boulevard, Squire) resuelve bien el problema, y donde Veli ya tiene ventaja construida en código o una oportunidad clara para destacar en Figma:

1. **Cotización guiada + Motor "Sin Báscula" integrado en el flujo de silla (brecha total en los 4 competidores):**
   - GlossGenius solo ofrece `$275+` o `"Price Varies"`, forzando a los salones (como `greggala` y `panistyle`) a escribir advertencias manuales y cobrar `$25 por bowl` a ojo. Mangomint, Boulevard y Squire no traducen el diagnóstico en gramos/tubos ni protegen el margen químico en vivo.
   - **Cómo destacarlo en Figma:** Convertir el módulo *"Sin Báscula"* del Frame 3 y Frame 4B en la pieza icónica de Veli: un instrumento sobrio en `JetBrains Mono` con equivalencias físicas (`cazos / tubos / oz`) y alerta preventiva de margen (`<30%`) que demuestra retorno económico inmediato al dueño.
2. **Arquitectura nativa de WhatsApp + Pagos locales de Colombia sin tarjeta obligatoria:**
   - GlossGenius, Mangomint, Boulevard y Squire dependen de SMS estadounidense (`+1-833` / shortcodes) y de **Card on File** con tarjeta de crédito (`3.4% + $0.15`), una barrera crítica de conversión en Colombia.
   - **Cómo destacarlo en Figma:** En `/s/[slug]` (Frame 1), la reserva culmina en 4 pasos sin registro y con **confirmación inmediata a WhatsApp** + soporte natural de **Nequi / PSE / Bold** para anticipos opcionales. En `/reportes` y `Inicio` (Frame 2), las acciones de reactivación (30/45/60+ días) y liquidación de nómina salen a 1 clic por WhatsApp.
3. **Comprobante de cotización transparente y auditable (`/c/[token]`) sin fuga de costos:**
   - Ninguno de los 4 ofrece un enlace de cotización técnica previa al servicio que blinde el precio frente al cliente (explicando variables de largo/densidad/estado y pasos incluidos) mientras mantiene bajo llave los costos químicos, márgenes y comisiones.
   - **Ajuste clave detectado en auditoría local:** Conectar `brand_settings` (`primary_color`, `logo_url`, `legal_footer`) en `app/c/[token]/page.tsx` para que herede la identidad de cada negocio igual que `/s/[slug]`.
4. **Anti-marketplace verdadero con Vitrina de Servicios + Tienda Retail en un solo enlace (`/s/[slug]`):**
   - GlossGenius exige pagar Gold (`$48–$56 USD/mes`) para desbloquear diseños modernos y bloquea países fuera de EE.UU.; Boulevard requiere un sitio web previo para embeber su overlay.
   - Veli ya ofrece en un solo enlace propio catálogo de servicios con reserva en hora Bogotá + tienda de productos con variantes (`ml`, `talla`, `aroma`) y pedidos persistidos en DB, sin competir al lado de otros salones y con 0% comisión de marketplace.
5. **Neutralidad de género real + multi-vertical en el mismo núcleo (superando el sesgo de GlossGenius y la rigidez de Squire):**
   - GlossGenius se percibe marcadamente femenino/boutique; Squire es exclusivo de barberías.
   - Veli ya cuenta con `organizations.vertical` (`hair_studio`, `nail_bar`, `barber_studio`, `spa_estetica`, `beauty_lounge`) y `brand_settings`. Al neutralizar el copy (*Cliente / Especialista / Estudio*), retirar el violeta `#7C3AED` de elementos "IA" y exponer selector de presets cromáticos en `EditorMarca`, Veli conquista barberías de autor, estudios de color, nail bars y spas bajo una misma arquitectura editorial sobria.
6. **Deudas concretas detectadas en la auditoría del repo que conviene resolver junto al nuevo diseño (para la futura fase de implementación):**
   - Exponer en `/configuracion` (`EditorMarca.tsx`) los controles de `primary_color`, `accent_color`, `public_tagline` y `vertical` que ya existen en DB (`brand_settings`).
   - Eliminar el badge técnico `LIB/COSTO.TS` visible en `app/page.tsx:1975`.
   - Pre-filtrar `/agenda` al especialista autenticado cuando el rol es `specialist` e incorporar la vista segura **`Mis Ganancias`** (Frame 4C) sin romper el aislamiento RLS de costos y márgenes.
   - Unificar el cobro de servicios (`ListaPorCobrar`) y pedidos retail (`public_orders`) bajo un mismo patrón de **slide-over de Checkout mixto** inspirado en Mangomint.
