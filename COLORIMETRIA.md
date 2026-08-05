# Calculadora de colorimetría (Sprint C)

Fuentes: `docs/conocimiento/Velli_Fase3_Colorimetria_BORRADOR_v0.1.docx` (la
Entrega 3 — §7 es la especificación funcional, §2–§6 el contenido) y la
`VALIDACIÓN KEILA MORENO.docx`. **Las reglas de Keila mandan sobre la
Entrega 3** donde difieran.

Migración: `supabase/migration-colorimetria.sql` (idempotente, **pendiente**).
Tests: `tests/colorimetria.test.ts` y `tests/colorimetria.integracion.test.ts`.

> El motor de diagnóstico no se tocó: `diagnostico.regresion` y
> `diagnostico.fase2` siguen en verde sin cambios.

---

## Divergencias resueltas a favor de Keila

| Tema | Entrega 3 | Keila (manda) |
|---|---|---|
| Tabla de fondos | §3.2 agrupa niveles 1–3 como "Rojo" | §4.1 desglosa: nivel 1 es **"Rojo profundo"**, 2 y 3 "Rojo" |
| Denominaciones | No las incluye | Añade la **columna latinoamericana** (`.7`, `.13`, `.1`, `.2`…) |
| CO-05 canas | "valida la regla general y deja el detalle a las cartas" | **Cierra los tramos**: 25–50 % → 1/4 tubo; 50–75 % → 1/2; >75 % → 3/4 o completo **y candado de 20 vol** |
| CO-09 | "validar el protocolo exacto" | **Texto verbatim** obligatorio en pantalla |

Los textos verbatim viven en `lib/color/reglas.ts` (`CO09_PROTOCOLO_VERBATIM`)
y `tramoCanas()`. **No se reescriben sin validación de Keila** — hay tests que
los comparan carácter a carácter.

---

## Arquitectura

| Capa | Archivo | Qué hace |
|---|---|---|
| Tablas universales | `lib/color/tablas.ts` | Escala 1–10 de Keila, fondos, neutralizantes, denominación LatAm, rueda, reflejos, oxidantes |
| Reglas de oro | `lib/color/reglas.ts` | CO-01…CO-10 como funciones puras + guardarraíles |
| Motor | `lib/color/calculadora.ts` | Orquesta en el orden exacto de §7.2 |
| Integración | `lib/color/integracion.ts` | Marcas del salón, precarga del diagnóstico, prerrequisitos legales |
| Registro | `lib/color/registro.ts` | Persiste el servicio confirmado |
| KB | `lib/kb/seed/colorimetria.ts` | Seed en **borrador**, derivado del motor (no puede driftear) |
| UI | `app/color/page.tsx` | Plan Pro; razonamiento + fórmula editable |

### Orden del cálculo (§7.2, no reordenar)

1. **Guardarraíles** — si algo bloquea, no se muestra fórmula, se muestra el camino previo.
2. **Vía del proceso** — CO-01 decide tinte vs. decapado/decoloración.
3. **Distancia → volumen** — CO-03, el mínimo que cubre.
4. **Fondo → neutralización** — CO-04 sobre la tabla de Keila.
5. **Ajustes del diagnóstico** — CO-05 canas, CO-07 porosidad, CO-06 pre-pigmentación.
6. **Viabilidad** — CO-10, plan por etapas si no cabe en una sesión.

### Guardarraíles duros

- **Elasticidad baja** → bloquea decoloración y aclaración, desvía a REP-1/REP-2 con reevaluación a 4 semanas. No bloquea un depósito ni una cobertura en el mismo nivel (no castigan la fibra).
- **Bandera médica activa o cuero cabelludo lesionado** → bloqueo total (A-06).
- **Henna o sales metálicas** (registradas **o dudosas**) → bloqueo de peróxidos hasta prueba de mechón registrada, con el texto CO-09 verbatim en pantalla.

### Nivel de autoridad (Keila, respuesta 6)

> «Velli orienta la formulación y el diseño; el estilista decide y ejecuta.»

La pantalla muestra la **Guía de Razonamiento Técnico** (niveles a mover,
fondo esperado, neutralización, con la regla CO que originó cada paso) junto a
una **Fórmula Sugerida 100 % editable** en gramos y volúmenes. La única
excepción a la edición es el candado de 20 vol de CO-05 (>75 % canas), que la
UI deja deshabilitado con su motivo a la vista.

Al confirmar se registra en `servicios_color` la fórmula **final** (la
editada, no la sugerida), el razonamiento congelado, el proceso y la foto.

---

## Integración: consume, no duplica

- **Marcas**: `marcasDelSalon()` cruza `salon_marcas_activas` con las cartas
  **publicadas** de `kb_marcas`. Sin marca seleccionada, la fórmula se declara
  `orientativo` en la propia salida.
- **Foto del resultado**: pasa por `evaluarCamara()` — es registro fotográfico
  de servicio químico, así que exige `consentimiento_imagenes` vigente. Se
  puede firmar desde la misma pantalla.
- **Prerrequisitos de decoloración**: `prerrequisitosDecoloracion()` reutiliza
  `evaluarConfirmacionCita()` de `lib/agenda/reglas.ts` — los **mismos**
  requisitos que exige el trigger `citas_guard_legal` (parche negativo en
  ventana 48 h–14 días + consentimiento químico vigente), con el motivo
  accionable de `traducirErrorAgenda()`. Así la estilista lo resuelve antes,
  en vez de chocarse con el bloqueo al confirmar la cita.

---

## Los tres casos pedagógicos (§8)

La verificación de que "la calculadora está viva". Cubiertos en
`tests/colorimetria.test.ts`:

1. **Base 6 → rubio 8 frío**: vía tinte, 2 niveles, 20 vol, fondo amarillo
   neutralizado con violeta, denominación `.2` → fórmula tipo 8.2. Una sesión.
2. **70 % de canas en su nivel**: vía cobertura, 0 niveles, **20 vol**, 1/2
   tubo de serie natural obligatorio (CO-05).
3. **Teñida de 4 que quiere un 7**: CO-01 manda decapado/decoloración; con
   porosidad alta y elasticidad media el límite cae a 2 niveles → **plan
   multi-sesión**, jamás fórmula directa.

> **Matiz del caso 2**: los 20 vol salen del estándar de cobertura de cana
> (10 vol solo deposita), **no** del candado de CO-05, que Keila fijó por
> encima del 75 %. Por eso `volumenBloqueado` es `false` a 70 % y `true` a
> 80 %. Si Keila quiere que el candado empiece antes, es un cambio de un
> número en `tramoCanas()`.

---

## Pendientes

1. Aplicar `supabase/migration-colorimetria.sql` (tabla `servicios_color`).
2. Publicar el seed de colorimetría desde `/conocimiento` (está en borrador).
3. Cargar las primeras cartas técnicas de marca (Keila sugiere 1–2 bien
   cargadas antes que 5 a medias) usando `ESQUEMA_CARTA_MARCA` como guía.
4. Preguntas abiertas de la Entrega 3 §9 que siguen sin decidir: qué marcas
   soportar primero, y si la Entrega 4 (catálogo de cortes) arranca ya.
