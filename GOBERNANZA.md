# Capa legal y de gobernanza

Implementa las tres correcciones de la **validación firmada de Keila Moreno**
(`docs/conocimiento/VALIDACIÓN KEILA MORENO.docx`, sección 6): gobernanza de
la librería global (P.2), consentimientos digitales de datos sensibles (P.3)
y bloqueos preventivos de agenda (P.7).

Migración: `supabase/migration-legal-gobernanza.sql` (idempotente).
Tests: `tests/gobernanza.legal.test.ts`.

> El motor de diagnóstico no se tocó: `tests/diagnostico.regresion.test.ts` y
> `tests/diagnostico.fase2.test.ts` siguen en verde sin cambios.

---

## 1. Modelo de roles

`profiles.rol` — `'corporativo' | 'salon'`, **default `'salon'`** (todo tenant
nuevo nace como salón).

| Rol | Puede |
|---|---|
| `corporativo` | Administra la librería global: reglas base (`kb_reglas`), flujos, prompts, dimensiones y cartas técnicas de marca (`kb_marcas`). Ve el funnel agregado y la auditoría. |
| `salon` | **No** edita reglas base ni cartas. Solo selecciona qué marcas publicadas están activas en su inventario (`salon_marcas_activas`). |

**Mapeo de `es_fundadora`:** la migración hace
`UPDATE profiles SET rol='corporativo' WHERE es_fundadora`. La columna
`es_fundadora` se conserva como flag histórico; el gating efectivo es `rol`.

**Cómo se cerró la RLS sin reescribir cada policy:** todas las policies
`kb_*_{insert,update,delete}_fundadora` ya llamaban a
`public.es_cuenta_fundadora()`. La migración reescribe esa función para que
delegue en la nueva `public.es_cuenta_corporativa()` (que exige
`rol = 'corporativo'`). Un solo cambio cierra la escritura de toda la
librería al rol salon.

`kb_marcas` es la tabla nueva de cartas técnicas: la escribe solo el rol
corporativo, y el resto de cuentas solo lee las `publicada`.
`salon_marcas_activas` es la **única** escritura de marcas del rol salon, y
su policy exige que la marca esté publicada.

**Panel `/conocimiento`:** el rol corporativo ve las 6 pestañas (Reglas,
Flujos, Prompts IA, Marcas, Vista previa, Auditoría). El rol salon ve una
pantalla distinta — "Marcas de tu salón" — para activar/desactivar marcas de
la librería. `/configuracion` enruta a la vista que corresponda al rol.

---

## 2. Consentimientos digitales versionados

Reutiliza el patrón de `LEGAL_VERSION`, pero la firma es **por clienta**, no
por cuenta.

| Documento | Constante | Página |
|---|---|---|
| `consentimiento_quimico` | `CONSENTIMIENTO_VERSIONES.consentimiento_quimico` | `/legal/consentimiento-quimico` |
| `consentimiento_imagenes` | `CONSENTIMIENTO_VERSIONES.consentimiento_imagenes` | `/legal/consentimiento-imagenes` |

**Los dos textos son PLACEHOLDER** (borradores del Paquete Legal) y llevan el
banner de documento provisional, tanto en la página como en el modal de firma.
Los definitivos los entrega Keila.

**Firma digital** = nombre completo tecleado (≥ 5 caracteres, CHECK en DB) +
checkbox de aceptación (`CHECK (aceptado)`) + timestamp + versión aceptada.
Se guarda en `consentimientos_clienta`, que es **inmutable**: no hay policies
de UPDATE ni DELETE, así que re-firmar una versión nueva agrega una fila sin
pisar la anterior. "Vigente" = la versión firmada coincide con la actual.

`public.legal_versiones` es el espejo en DB de `lib/legal.ts` — el trigger de
agenda valida la vigencia contra esa tabla. **Los dos lados deben moverse
juntos** (el test `el seed de legal_versiones coincide con lib/legal.ts` lo
vigila).

### Gating duro de cámara

`evaluarCamara()` (`lib/consentimientos.ts`) es **fail-closed**: sin gate
explícito o sin clienta registrada devuelve bloqueado.

- **Módulo de alopecia** — la cámara del wizard (`PasoCabello`) captura cuero
  cabelludo y alimenta el flujo transversal de cabina. Sin
  `consentimiento_imagenes` vigente se renderiza `ConsentimientoGate` **en
  lugar de** `CameraCapture`; desde ahí se puede firmar y la cámara se libera.
  La selección manual (sin fotos) queda siempre disponible.
- **Registro fotográfico de servicios químicos** — en `PasoPlan`, si la
  consulta declara químicos, los slots de foto antes/después se sustituyen por
  el aviso de consentimiento requerido.
- **Clienta no registrada** → bloqueado (`motivo: 'sin_clienta'`): no hay a
  quién atribuir la firma. Hay que crear la clienta y firmar desde su ficha.

---

## 3. Bloqueos de agenda

La tabla `citas` (que existía sin uso) pasa a ser la agenda de servicios de
cabina. El trigger `citas_guard_legal` (BEFORE INSERT OR UPDATE) es la
barrera real; `lib/agenda/reglas.ts` la espeja en el cliente para bloquear la
UI antes y explicar el motivo.

### a) Prueba de sensibilidad (48 h)

Clienta con `nueva_en_color` o `cambio_marca_quimica` → **confirmar** un
servicio de color exige un parche `negativo` aplicado **≥ 48 h antes** de la
cita y **≤ 14 días** (validez por aplicación, no de por vida). Un parche
positivo nunca habilita.

La decoloración exige además `consentimiento_quimico` vigente.

Flujo de registro: ficha de la clienta → "Seguridad química" → *Registrar
parche* (fecha, hora, resultado, notas). Ahí mismo se activan las dos
banderas.

### b) Bloque de 2–4 h para servicios tipo 4

`profiles.bloqueo_tipo4_minutos` (default 180, `CHECK BETWEEN 120 AND 240`),
configurable en `/configuracion` → *Bloque para servicios tipo 4* (2/3/4 h).

"Día de lavado tipo 4" e "instalación de peinado protector" **fuerzan** esa
duración al guardar (el trigger sobrescribe `duracion_minutos`) y nadie puede
sobreprogramar encima: el trigger rechaza cualquier cita que solape con un
bloque extendido, y también un bloque que caiga sobre citas existentes. Las
canceladas y no-show liberan el horario.

`clasificar_servicio()` existe en SQL y en TS (`clasificarServicio`) — el
test de paridad verifica que ambos cubran los mismos patrones. **Si cambias
los patrones, cámbialos en los dos sitios.**

Errores del trigger (`PARCHE_SENSIBILIDAD_REQUERIDO`,
`CONSENTIMIENTO_QUIMICO_REQUERIDO`, `AGENDA_BLOQUEADA`) se traducen a
mensajes accionables con `traducirErrorAgenda()`.

---

## Archivos

| Área | Archivos |
|---|---|
| Migración | `supabase/migration-legal-gobernanza.sql` |
| Roles | `lib/profile.ts`, `lib/kb/marcas.ts`, `app/conocimiento/page.tsx`, `app/configuracion/page.tsx` |
| Consentimientos | `lib/legal.ts`, `lib/consentimientos.ts`, `components/legal/*`, `app/legal/consentimiento-*` |
| Gating de cámara | `components/wizard/ConsentimientoGate.tsx`, `components/wizard/PasoCabello.tsx`, `components/wizard/PasoPlan.tsx`, `app/diagnostico/page.tsx` |
| Agenda | `lib/agenda/reglas.ts`, `lib/agenda/citas.ts`, `components/agenda/CitasServicio.tsx`, `app/agenda/page.tsx` |
| Ficha de clienta | `components/clienta/SeguridadLegal.tsx`, `app/clientas/[id]/page.tsx` |
| Tests | `tests/gobernanza.legal.test.ts` |
