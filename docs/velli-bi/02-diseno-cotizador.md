# Velli Business Intelligence · Fase 1 · Etapa 3 — Diseño del cotizador

- **Fecha:** 2026-10-19
- **Rama:** `velli-bi/fase-1`
- **Alcance:** diseño. **No se aplicó nada.**
  - Borradores de migración: `supabase/borradores/velli-bi-cotizador.sql` y `velli-bi-uso-ia.sql`.
  - Se probaron en un Postgres en memoria (PGlite 0.5.10, PostgreSQL 18.6) junto con las dos migraciones de la Etapa 1: **51 de 51 pruebas en verde** (la 51, del 2026-10-22, comprueba que `uso_ia` solo acepta Anthropic) (`calculos/probar_borradores_salida.txt`).
  - Plantilla para probar en papel: `plantilla-precios.xlsx`.
- **Actualizado el 2026-10-22:** las variables usan estándares configurables de Velli, sin validación externa (§1.1), y el dominio sale de `NEXT_PUBLIC_APP_URL` (§4).
- **Actualizado el 2026-10-23:** todo el código de la Fase 1 (`lib/cotizador/`, `/c/[token]`, `HojaCotizar`, `ListaPorCobrar`, `/configuracion/precios`, `BottomNavV2`, `ChecklistInicio`, `plans.ts` y `lib/ia/uso.ts`) quedó implementado y verificado con **14 suites / 340 pruebas en verde**, y las migraciones `supabase/velli-bi-uso-ia.sql` y `supabase/velli-bi-cotizador.sql` ya fueron aplicadas en producción (verificadas las 8 tablas y `feature_flags = '{"cotizador": true}'` en el perfil principal).

## Resumen

- **Precio** = plantilla del servicio × variables del diagnóstico: largo, densidad, estado de la fibra y % de canas. La plantilla es versionada: cambiar un precio publica una versión nueva y nunca borra la anterior.
- **Cotizar en 3 toques** desde un diagnóstico existente: *Cotizar → servicio → Enviar por WhatsApp*.
- **Cobro en 1 toque:** «Cobrado» o, si cambió el valor, «Otro valor».
- **Mismo precio sin importar quién atienda.** Si el precio enviado difiere del de la plantilla, la base de datos exige un motivo. Lo enviado a la clienta no se puede editar: se anula y se cotiza de nuevo.
- **Costo** = gramos de la fórmula de colorimetría (sus reglas no cambian) × factor de consumo de la plantilla × precio por gramo del producto, más el oxidante y los insumos fijos.
- **Link público** `/c/<token>`: muestra solo servicio, precio, vigencia y el nombre del salón, con pie de Velli salvo en Pro+IA. Nada del diagnóstico, ni fotos, ni datos de salud capilar.

## 1. Modelo de datos

**Convenciones** (las de las migraciones existentes):
- `user_id` es el salón, es decir, la cuenta del dueño.
- Las estilistas son registros sin login (P1).
- RLS por salón en todas las tablas.
- Montos en COP enteros y fechas `timestamptz`.
- `perfil_extendido jsonb` en cada tabla para atributos nuevos sin migración.

| Tabla | Para qué | Columnas clave | Módulo |
|---|---|---|---|
| `estilistas` | Quién atiende | `nombre`, `activo` | 1 y 2 |
| `servicios_salon` | Catálogo de servicios del salón. Se siembra con los `profiles.servicios` del onboarding | `nombre`, `categoria`, `usa_formula_color`, `duracion_minutos` | 1 |
| `plantillas_precio` | Precio por servicio, **versionado** | `version`, `vigente_desde/hasta`, `precio_base`, `ajustes jsonb`, `consumo jsonb`, `redondeo`, `vigencia_dias` | 1 (precio), 2 (consumo) |
| `productos_salon` | Producto con su presentación y precio de compra | `marca_id` (librería) o `marca`, `tipo`, `presentacion_cantidad`, `unidad`, `precio_compra` | 2 |
| `comisiones` | Regla de comisión por alcance | `estilista_id` y `servicio_id` (null = todas/todos), `tipo` (porcentaje/fijo), `valor`, `base` | 2 |
| `cotizaciones` | Lo cotizado y lo cobrado | Detalle abajo | 1 y 2 |
| `cotizacion_eventos` | Bitácora de solo inserción: creada, enviada, cobrada, cobro corregido, anulada | `tipo`, `datos jsonb` | 2, 3 y 4 |
| `uso_ia` | Cada llamada a la IA con sus tokens. Sirve para el tope de Pro+IA | `ruta`, `proveedor`, `modelo`, `tokens_*`, `costo_usd`, `ok` | Pro+IA |

**Columnas de `cotizaciones`:**
- **Referencias:** `clienta_id`, `consulta_id`, `estilista_id`, `servicio_id`, `plantilla_id`, `servicio_color_id`. Todas pasan a `null` si se borra lo referido, porque la historia se conserva (R9).
- **Lo cotizado, que no cambia:** `servicio_nombre`, `estilista_nombre`, `plantilla_version`, `variables jsonb` (cada variable con su valor y origen: diagnóstico o manual), `precio_calculado`, `precio_cotizado`, `ajuste_manual_motivo`, `vigencia_hasta`.
- **Ciclo de vida:** `estado` (`borrador → enviada → cobrada`, o `anulada`), `enviada_at`, `precio_cobrado`, `cobrado_at`. Además, `diferencia_cobro` es una columna generada (cobrado − cotizado).
- **Costo, para el módulo 2:** `formula jsonb` (la fórmula usada), `costo_producto_estimado`, `costo_detalle jsonb` (cada producto con los gramos y el precio unitario de ese momento), `comision_estimada` y `comision_detalle`.
- **Link:** `token_publico` (uuid v4, 122 bits aleatorios) y `con_marca_velli` (copia del plan al cotizar).

**Funciones:**
- `salones_del_usuario()`: los salones a los que la sesión tiene acceso. Hoy devuelve la cuenta propia. Para sumar estilistas con login se cambia **solo esta función**, sin tocar políticas.
- `publicar_plantilla_precio(...)`: cierra la versión vigente y crea la siguiente en una transacción.
- `cotizacion_publica(token)`: la única puerta pública.
- `ia_analisis_del_mes()`: cuántos análisis con IA lleva el salón en el mes.

**Triggers:**
- guarda de suscripción (la existente: con el plan vencido se lee pero no se crea);
- `updated_at`;
- versiones de plantilla inmutables;
- `cotizaciones_mismo_salon`: ninguna referencia apunta a otro salón, y la consulta es de esa clienta;
- `cotizaciones_ciclo`: transiciones permitidas, lo enviado se congela y las fechas se llenan solas;
- `cotizaciones_registrar_evento`: escribe la bitácora.

### 1.1 Variables de precio

El catálogo vive **en código** (`lib/cotizador/variables.ts`, por construir), porque la lectura desde el diagnóstico también es código. Las plantillas guardan los ajustes por variable en `jsonb`: **una variable nueva no exige migración**. Si más adelante hace falta editar los tramos desde el panel, el catálogo pasa a una tabla `kb_*`, con la misma gobernanza de la base de conocimiento.

**Estándares de Velli (decididos el 2026-10-22).** Velli no depende de una validación externa: las tres variables de abajo usan estándares de la industria en Colombia, configurables. Los valores por defecto viven en el catálogo de código y cada salón decide cuánto cobra por cada uno en su plantilla.

| Variable | Valores | De dónde sale en el diagnóstico | Si falta |
|---|---|---|---|
| `largo` | `corto` (mentón) · `medio` (hombros o clavícula) · `largo` (media espalda o tira del brasier) · `extra_largo` (cintura o más) | **No existe hoy** (salvo tipo 4, en cm). Dimensión nueva `largoActual` en un flujo transversal `flujo.cotizacion`: es contenido de la base de conocimiento, sin migración (P6) | El cotizador la pregunta: 1 toque |
| `densidad` | `baja` · `media` · `alta` | `consultas.densidad`, del asistente o sugerida por la IA | 1 toque |
| `estado` | `sana` (sana o virgen) · `procesada` (procesada o porosa) · `sensibilizada` (sensibilizada o muy dañada) | Derivada (regla abajo) | 1 toque |
| `canas` | `0_25` · `25_50` · `50_75` · `75_100` | `perfil_extendido.estadoCanas` (tramos abajo) | 1 toque |

**Estado de la fibra.** Es una clasificación para el precio y para los avisos del cotizador, no una regla de diagnóstico. Gana el nivel más alto que se cumpla:

| Nivel | Cómo se lee del diagnóstico | Qué hace el cotizador |
|---|---|---|
| **Sana / virgen** | Sin química previa, elasticidad buena y puntas sanas | Sin recargo |
| **Procesada / porosa** | Química previa (tinte, decoloración o alisado), porosidad alta, elasticidad media, puntas «abiertas leves» o daño mecánico o térmico | Sugiere un tratamiento sellante, que la estilista puede sumar a la cotización |
| **Sensibilizada / muy dañada** | Elasticidad baja, puntas «abiertas severas» o daño químico | En servicios químicos, alerta obligatoria: prueba de mechón y aditivo protector Plex. El aditivo entra como insumo del costo |

- Si no existe ninguno de los datos, el estado queda «sin dato» y se pregunta.
- La alerta se suma a los guardarraíles que ya existen (A-06, y elasticidad baja ante una decoloración), que siguen bloqueando como hoy.
- Limitación: `consultas.nivel_dano` guarda solo el primer tipo de daño marcado.

**Canas.** Cuatro tramos, los mismos de CO-05: 0–25 %, 25–50 %, 50–75 % y 75–100 %. El asistente ofrece «Más del 50 %», que no distingue entre 50–75 % y 75–100 %. La división se hace con un toque donde se necesita: en la calculadora de color (hecho el 2026-10-22, R5) y, cuando exista, en el cotizador. No se divide la opción del asistente porque tres reglas del motor leen `mas_50` (`hecho.f2.tiene_canas`, `hecho.f2.canas_25_mas` y `nota.f2.c04`), y esas reglas no se cambian para servir al cotizador. Dividirla en el asistente exigiría cambiar esas tres condiciones o agregar preguntas condicionales al asistente; es una decisión aparte. La regla CO-05 no cambia.

| Tramo | En el costo | En la cotización |
|---|---|---|
| 0–25 % | Sin consumo extra | — |
| 25–50 % | Sin consumo extra | — |
| 50–75 % | +15 % de gramos de producto, por saturación | — |
| 75–100 % | +20 % de gramos de producto | Sugiere la técnica de prepigmentación |

Las consultas guardan `sin_canas` o `menos_25` (pasan a 0–25 %), `entre_25_50` (25–50 %) o `mas_50`; esta última pide un toque: «Entre 50 y 75 %» o «Más del 75 %».

### 1.2 Fórmula del precio

```
precio = redondeo( (precio_base + Σ suma) × (1 + Σ porcentaje / 100) )
```

Los ajustes `suma` y `porcentaje` van por cada valor de cada variable. Ejemplo:

| Concepto | Valor |
|---|---|
| Precio base de «Tinte completo» | 120.000 |
| Largo medio | +20 % |
| Densidad alta | +15 % |
| Canas 50–75 % | +15.000 |
| Cálculo | (120.000 + 15.000) × 1,35 = 182.250 |
| Redondeado a 1.000 | **182.000** |

Cada salón decide si sus ajustes son porcentajes, sumas o ambos. La hoja de papel permite las dos cosas, justamente para aprender qué usan (decisión E2).

### 1.3 Seguridad (RLS y reglas)

- Todas las políticas usan `user_id in (select public.salones_del_usuario())`. Postgres la evalúa una vez por consulta, no por fila.
- **`anon` no tiene acceso a ninguna tabla nueva.** Por defecto, cada tabla nueva de `public` le daría `GRANT ALL` (`schema.sql:1907-1910`); el borrador lo revoca. Lo público entra solo por `cotizacion_publica()`.
- Probado en PGlite:
  - otro salón no ve, no escribe a nombre ajeno ni referencia las clientas de otro;
  - lo enviado no se edita;
  - una cotización cobrada no vuelve atrás ni se borra; solo los borradores se borran;
  - borrar una clienta conserva lo cobrado.
- **Requisito previo, cumplido:** `migration-proteger-perfil.sql` (R17) está aplicada en producción (confirmado el 2026-10-22). Sin ella, una cuenta podía hacerse corporativa.

### 1.4 Lo que queda listo para los módulos 2, 3 y 4

- **Rentabilidad (2):**
  - la diferencia de cada estilista sale de `diferencia_cobro` por `estilista_id`;
  - el margen es precio − `costo_producto_estimado` − `comision_estimada`;
  - el consumo sale de `costo_detalle` (gramos por producto);
  - el resumen semanal sale de `cotizacion_eventos`.
  - **Falta** la existencia en inventario, para el aviso de compra: será una tabla de movimientos, con su propia migración.
- **Recomendaciones (3):** historia de precios (plantillas versionadas), variables guardadas en cada cotización y cobros reales.
- **Pronósticos (4):** las series de tiempo de eventos y cobros, y el precio de compra que se usó en cada cotización.

## 2. Flujo del estilista

### 2.1 Cotizar en 3 toques desde un diagnóstico existente

**Dónde aparece «Cotizar»:**
- al terminar un diagnóstico (`PasoPlan` y `ResultadoDiagnostico`);
- en la ficha de la clienta, junto a «Nueva consulta»;
- en cada consulta del historial.

| Toque | Qué hace | Qué ve la estilista |
|---|---|---|
| 1 · **Cotizar** | Abre una hoja inferior | Chips con las variables ya llenas desde el diagnóstico: largo, densidad, estado y canas. Debajo, los servicios del salón: primero los que sugiere el diagnóstico (el tratamiento principal se cruza con la categoría), luego los más usados |
| 2 · **Servicio** | Calcula el precio al instante, con la plantilla vigente y las variables | Precio grande y vigencia por defecto. La estilista viene preseleccionada (la última que usó ese teléfono) |
| 3 · **Enviar por WhatsApp** | Crea la cotización como `enviada` y abre wa.me con el mensaje | WhatsApp con el texto listo |

**Detalles del flujo:**
- **Opcionales, no suman toques si no se usan:** cambiar una variable (tocar su chip), cambiar de estilista, o ajustar el precio, que pide motivo.
- **Si falta un dato** (por ejemplo, un diagnóstico viejo sin largo), su chip aparece vacío y pide un toque. Nunca se inventa.
- **Lo legal se respeta:**
  - con bandera médica, o con un guardarraíl de color activo (elasticidad baja ante una decoloración, A-06), el servicio químico aparece bloqueado con su motivo. Se reutiliza `evaluarGuardarrailes()` sin cambiarlo;
  - el parche y el consentimiento se muestran como aviso. No impiden cotizar; sí impiden hacer el servicio, como hoy.

### 2.2 Confirmar lo cobrado

- Hay una lista **«Por cobrar»** en Inicio y en la ficha de la clienta.
- Cada cotización enviada muestra **[Cobrado $182.000 ✓]**: un toque y queda cobrada por lo cotizado.
- Al lado está **[Otro valor]**: un teclado numérico con un solo campo.
- Al cobrar se puede cambiar quién atendió. Por defecto es la estilista de la cotización.
- Lo cobrado se puede corregir después; la corrección queda en la bitácora.

### 2.3 Configuración

En **Configuración → Precios**:
- **Básico:** servicios, precio base, ajustes por variable, redondeo y vigencia. «Publicar» crea una versión nueva.
- **Pro, además:** productos con precio de compra, factores de consumo y comisiones.

### 2.4 Navegación (decisión E5)

Propuesta: que el botón central de la barra abra dos acciones, «Cotizar» y «Nuevo diagnóstico». La agenda se queda donde está (P12).

## 3. Costo de producto

La colorimetría **no cambia sus reglas** (CO-01 a CO-10). El cotizador lee su resultado y le pone precio.

1. **Fórmula.** Hay dos fuentes:
   - **Precisa:** el servicio de color registrado (`servicios_color.formula_final`), es decir, lo que la estilista dejó tras editar la fórmula.
   - **Estimada:** si se cotiza antes de usar la calculadora, `consumo.gramos_tinte_base` de la plantilla.
2. **Fracciones de tubo.** CO-05 ya las expresa en gramos dentro de la fórmula (1/4, 1/2 o 3/4 del tubo de la serie natural). El costo convierte gramos en pesos:
   ```
   precio por gramo = precio_compra / presentacion_cantidad
   costo del tinte  = Σ gramos de los componentes × factor de consumo × precio por gramo
   costo oxidante   = gramos de tinte × proporción × precio por ml
   costo total      = tinte + oxidante + consumo.insumos_fijos
   ```
   - La proporción sale de la carta de la marca (`proporcionEstandar`, por ejemplo «1:1,5»). Sin carta, se usa 1,5 marcado como orientativo.
3. **Factor de consumo.** La calculadora siempre devuelve un tubo, 60 g por defecto (R6). El factor por largo, densidad y canas vive en la plantilla del salón (`consumo.factor`), es decir, en la capa del cotizador y no en las reglas de color. Por defecto, canas 50–75 % multiplica por 1,15 y 75–100 % por 1,20 (§1.1). Ejemplo: medio 1,5 × alta 1,3 × canas 50–75 % 1,15 = 2,24 tubos.
4. **Canas: el adaptador (R5, hecho el 2026-10-22).** `diagnosticoDesdeConsulta()` leía `perfil_extendido.porcentajeCanas`, que nada escribe. Ahora `porcentajeCanasDesdePerfil()` traduce `estadoCanas` a un porcentaje representativo del tramo (`entre_25_50` → 37; tras el toque, 50–75 % → 62 y 75–100 % → 87). Esto no toca CO-05, pero hace que CO-05 se aplique por primera vez con diagnósticos reales: es un cambio de comportamiento de la calculadora, decidido el 2026-10-22 junto con los tramos. El cotizador reutiliza el mismo adaptador y el mismo toque.
5. **Copia del costo.** La cotización guarda cada producto con sus gramos y su precio unitario de ese momento (`costo_detalle`). Si el tinte sube, el margen histórico no cambia.
6. **Comisión.** Gana la regla más específica: estilista y servicio > estilista > servicio > salón. Se calcula sobre el precio o sobre precio − producto, según la regla, y también se copia.

**Ejemplo completo** (precios de compra ficticios, solo para ver la mecánica). «Tinte completo», con largo medio, densidad alta y canas de 50 a 75 %:

| Concepto | Cálculo | COP |
|---|---|---|
| Precio | (120.000 + 15.000) × 1,35, redondeado | 182.000 |
| Tinte | 60 g × 1,5 × 1,3 × 1,15 = 134,55 g × $500/g | −67.275 |
| Oxidante | 134,55 g × 1,5 = 201,8 ml × $30/ml | −6.055 |
| Insumos fijos | | −3.000 |
| Comisión | 40 % del precio | −72.800 |
| **Margen** | | **32.870 (18 %)** |

El «+15.000» del precio es un ajuste que decide el salón; el ×1,15 de los gramos es el consumo extra del estándar de canas. Son cosas distintas.

## 4. Link de WhatsApp y página pública

**Mensaje** (wa.me, sin API). Lleva solo lo que verá la página, sin datos del diagnóstico:

> Hola {nombre}, te comparto la cotización de *{servicio}* en {salón}: *{precio}*. Válida hasta el {fecha}. {link}

**Teléfono (R7).** Se normaliza con un solo helper:
- 10 dígitos que empiezan por 3 → se antepone 57;
- si ya trae 57 y tiene 12 dígitos → se deja;
- si no hay número válido → `https://wa.me/?text=…`, y WhatsApp deja elegir el contacto.

**Página `/c/<token>`:**
- **Muestra:** el nombre del salón (con su color), el servicio, el precio en COP y la vigencia («Válida hasta…» o «Vencida: pide una cotización nueva»).
- **Pie:** en Básico y Pro, «Cotización hecha con Velli · {dominio}», con el dominio de `NEXT_PUBLIC_APP_URL` (`lib/sitio.ts`; hoy `velli-three.vercel.app`, porque Velli no tiene dominio propio); en Pro+IA, sin pie.
- **No muestra:** el nombre de la clienta, nada del diagnóstico, fotos, datos de salud capilar ni el logo. El logo está en un bucket privado; firmarlo queda para una versión 2.
- **Técnica:**
  - componente de servidor dinámico que llama a `cotizacion_publica()` con la llave anónima;
  - agregar `/c` a las rutas públicas de `proxy.ts`;
  - excluir `/c/` del service worker (R16);
  - `robots: noindex` y `Cache-Control: no-store`;
  - límite por IP con Upstash, para que nadie la recorra a fuerza bruta;
  - Open Graph «Cotización · {salón}», que es lo que muestra la vista previa de WhatsApp. La marca Velli aparece ahí solo en Básico y Pro.
- **Legal (P13).** Texto provisional, lo redacta Vanessa: «Precio para el servicio descrito, válido hasta la fecha indicada. Puede cambiar si al momento del servicio el cabello requiere un trabajo distinto». El link no sale sin el texto final y sin una actualización de Privacidad que mencione los links públicos (R4). Desde el 2026-10-22 los Términos ya dicen que Velli estima y que el profesional del salón responde por el diagnóstico presencial, las pruebas y la aplicación química.

## 5. Plantilla para probar en papel (`plantilla-precios.xlsx`)

Es el mismo modelo de este documento, para usar en una visita con el dueño. Se hace una copia por salón.

**Hojas:**
- **Cómo usarla:** pasos, leyenda y qué queremos aprender.
- **Servicios:** viene con los 8 sugeridos del onboarding, más el precio base y qué variables afectan a cada servicio.
- **Ajustes:** suma o porcentaje por cada valor de cada variable.
- **Productos:** precio de compra; el costo por gramo se calcula solo.
- **Consumo:** factores por largo, densidad y canas, y proporción de oxidante.
- **Comisiones.**
- **Simulador:** precio, costo, comisión y margen de un caso, con los avisos del estándar (prueba de mechón y Plex, tratamiento sellante, prepigmentación).
- **Registro:** una semana de casos reales; compara el precio de la hoja con lo cobrado.
- **Resumen:** cuántos casos coinciden (±5 %) y la diferencia de cada estilista.

**Formato:**
- Las celdas a llenar van en amarillo con texto azul; las fórmulas, en negro; los datos traídos de otra hoja, en verde.
- Hay listas desplegables y está listo para imprimir en horizontal.
- Los valores de ejemplo reproducen el ejemplo de la sección 3: precio $182.000, margen $32.870.

**Cómo se verificó.** En este equipo no hay LibreOffice para recalcular, así que las fórmulas se evaluaron con `pycel` en tres escenarios:
- el archivo tal cual;
- una copia con un corte sin fórmula de color y otra estilista con comisión de color sobre precio menos producto;
- el ejemplo con fibra sensibilizada, para ver el aviso obligatorio.

Resultado (2026-10-22, con los estándares nuevos): 0 errores en las 227 fórmulas con datos y 67 de 67 valores esperados. Las 100 filas del Registro tienen la misma fórmula. Script y salida: `calculos/verificar_plantilla.py` y `calculos/verificar_plantilla_salida.txt`. El archivo pide recalcular al abrirse (`fullCalcOnLoad`), así que Excel y Google Sheets muestran los valores de inmediato.

## 6. Orden de implementación (cuando se apruebe)

1. Aplicar `migration-proteger-perfil.sql` y `migration-feature-flags.sql` (hecho; las dos confirmadas el 2026-10-22).
2. Regenerar `schema.sql` (con colorimetría y cortes) y archivar las migraciones aplicadas (R10).
3. **Probar en papel** con 3 salones usando `plantilla-precios.xlsx`. Antes de construir la interfaz, eso dice si las variables y la forma de los ajustes sirven.
4. Hecho el 2026-10-22: los tramos de largo, el estado de la fibra y la división de las canas quedan como estándares configurables de Velli (§1.1), sin validación externa. Los textos legales los redacta Vanessa.
5. Aplicar el borrador del cotizador, revisado con lo aprendido en papel. **Hoy no hay base de staging:** recomiendo crear un proyecto Supabase de pruebas para aplicarlo primero allí.
6. Construir:
   - `lib/cotizador` (variables, precio, costo y comisión como funciones puras, con pruebas);
   - la interfaz (hoja de cotizar, «Por cobrar», Configuración → Precios);
   - la página `/c/[token]`;
   - el normalizador de teléfono;
   - el flag `cotizador` (encendido en desarrollo y preview, apagado en producción hasta lanzar);
   - las funciones de cada plan.

## 7. Decisiones que necesito

| # | Decisión | Mi recomendación |
|---|---|---|
| E1 | Variables: tramos de largo, regla del estado de la fibra y canas divididas en dos | **Decidida el 2026-10-22:** estándares configurables (§1.1). La prueba en papel dice si los salones los usan así |
| E2 | Ajustes por porcentaje, por suma o ambos | Dejar ambos en la prueba y decidir según lo que usen los 3 salones |
| E3 | Texto del mensaje de WhatsApp y textos legales de la página | Vanessa |
| E4 | Base de staging antes de aplicar el borrador | Sí |
| E5 | Botón central: «Cotizar» y «Nuevo diagnóstico» | Sí, cuando exista el cotizador |
