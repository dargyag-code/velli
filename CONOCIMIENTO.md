# Knowledge Base del motor de diagnóstico

El motor de diagnóstico dejó de ser código con ~40 combinaciones hardcodeadas
y pasó a ser un **sistema basado en datos**: las reglas, tratamientos,
cronogramas, productos, flujos de wizard y prompts de IA viven en Supabase
como contenido versionado con estado borrador/publicada. Expandir a nuevos
tipos de cabello (Fase 2) o a colorimetría y cortes (Fase 3) es cargar
contenido, no reescribir código.

## Arquitectura

```
lib/diagnosticEngine.ts      Motor legacy (intacto) — fallback y referencia
lib/kb/tipos.ts              Tipos: Condicion (DSL jsonb), ReglaKB, FlujoKB…
lib/kb/evaluador.ts          Evaluador genérico + REGLA DE SEGURIDAD médica
lib/kb/seed/reglasRizado.ts  Seed canónico: 142 reglas (transcripción fiel)
lib/kb/seed/contenido.ts     Dimensiones, flujo liso (borrador), prompts IA
lib/kb/diagnostico.ts        Loader con caché (5 min) + fallback a legacy
lib/kb/promptsServidor.ts    Composición de prompts IA (caché 60 s, server)
lib/kb/admin.ts              CRUD del panel (RLS: solo fundadoras escriben)
app/conocimiento/page.tsx    Panel: CRUD + vista previa + publicar + auditoría
components/wizard/PreguntasFlujo.tsx  Preguntas dinámicas por tipo de cabello
scripts/generar-seed-kb-sql.mjs       Seed TS → migración SQL (npm run kb:sql)
supabase/migration-knowledge-base.sql Migración generada (DDL + RLS + seed)
tests/diagnostico.regresion.test.ts   Definición de terminado (ver abajo)
```

### Flujo en runtime

1. El wizard llama `generarDiagnostico()` (lib/kb/diagnostico.ts).
2. Si hay reglas **publicadas** en `kb_reglas` → las evalúa el evaluador
   genérico. Si la KB no está disponible (migración sin aplicar, sin red) →
   motor legacy. **Ambos caminos dan exactamente el mismo resultado** con el
   seed: lo garantiza la prueba de regresión.
3. Publicar una regla desde `/conocimiento` la activa para todos los salones
   en ≤5 minutos (TTL del caché), sin redeploy. Igual con los prompts de IA
   (≤60 s) y los flujos del wizard.

### Modelo de regla

Una regla = `condiciones` (árbol jsonb sobre el perfil capilar) + `salida`
(jsonb según el segmento) + `prioridad` + `estado`. Los segmentos espejan las
secciones del resultado: `tratamiento_principal` (gana la primera que
matchea), `nota`/`cuidado_casa`/`ingrediente_*` (se acumulan en orden),
`cronograma`/`tecnica`/`intervalo` (primera), `rutina` (primera por
paso+atributo), `hecho` (deriva hechos intermedios como `danoQuimico`) y
`derivacion_medica`. El campo `locale` ('es') deja la puerta abierta al
multiidioma.

### Regla de seguridad médica (no configurable por datos)

Si CUALQUIER regla con `es_bandera_medica` matchea (señales clínicas de
alopecia, dermatitis severa…), `evaluarDiagnostico` devuelve SIEMPRE una
**derivación a dermatólogo construida en código** — nunca un plan de
tratamiento, sin importar qué más diga la knowledge base. Las condiciones
médicas del seed solo miran dimensiones extendidas (`ext.*`) que el wizard de
rizos actual no llena → cero impacto en producción hoy.

### Perfil capilar extensible

`consultas.perfil_extendido` (jsonb) guarda las respuestas de dimensiones
nuevas (estado de canas, densidad por zonas, señales de alopecia, tipo de
cuero cabelludo, procesos químicos) — definidas como datos en
`kb_dimensiones`. Agregar una dimensión no requiere migración. El wizard
ramifica por tipo de cabello: un flujo **publicado** en `kb_flujos` agrega
sus preguntas cuando el tipo seleccionado matchea (el seed trae el flujo de
liso en **borrador** como plantilla de Fase 2; el flujo de rizado actual
sigue hardcodeado e idéntico).

## Seguridad (RLS)

- Lectura de contenido **publicado**: cualquier cuenta autenticada.
- Lectura de borradores + escritura: **solo** cuentas con
  `profiles.es_fundadora` (helper `public.es_cuenta_fundadora()`).
- `kb_auditoria`: registra quién cambió qué vía trigger `SECURITY DEFINER`
  (sin policy de INSERT — nadie puede escribirla a mano); solo fundadoras la
  leen. Cada UPDATE además incrementa `version` automáticamente.

## Pasos manuales para activar (una vez)

1. Supabase Dashboard → SQL Editor → pegar
   `supabase/migration-knowledge-base.sql` completa → Run. (Idempotente; el
   seed no pisa ediciones previas del panel.)
2. Verificar en Settings → Data API que las tablas `kb_*` quedan accesibles
   (cambio de Supabase de abr-2026: las tablas nuevas pueden no exponerse
   automáticamente).
3. Probar: `/conocimiento` con una cuenta fundadora debe listar 142 reglas;
   con una cuenta normal debe mostrar "Solo cuentas fundadoras".
4. Tras el rollout, regenerar `supabase/schema.sql` (ver supabase/README.md)
   y mover la migración a `_archive/`.

**Sin aplicar la migración nada cambia**: el wizard usa el motor incorporado.

## Cómo expandir (Fase 2 / Fase 3)

- **Nuevo tipo de cabello (p.ej. liso)**: completar/publicar el flujo
  `flujo.liso` desde el panel; crear reglas con condiciones sobre
  `tipoRizoPrincipal` en 1A–1C y/o `ext.*`; previsualizar con "incluir
  borradores"; publicar.
- **Colorimetría / cortes**: nuevas claves de dimensión (`ext.colorActual`,
  `ext.alturaTono`…) + reglas en los segmentos existentes — o segmentos
  nuevos si hace falta otra sección del resultado (agregar el segmento al
  CHECK de `kb_reglas` y al evaluador).
- **Conocimiento para la IA**: publicar prompts `analisis_foto.extra.*`
  (generales o con `tipos_cabello` específicos) — la ruta de análisis los
  incorpora sin redeploy.
- Si editas el **seed TS**, corre `npm run kb:sql` para regenerar la
  migración y `npm test` para validar.

## Definición de terminado / regresión

```
npm test        # 21 tests — regresión legacy vs KB + bandera médica + sync de prompts
npm run typecheck
npm run build
```

`tests/diagnostico.regresion.test.ts` compara `generateDiagnosis` (legacy)
contra el evaluador con el seed en miles de perfiles (barrido de tipos ×
porosidad × elasticidad × balance × daños × puntas × cuero × salud) con
igualdad profunda **exacta** — incluye la paridad de comportamientos raros
del legacy (p.ej. "Sin daño visible" cuenta como daño para ingredientes).
Si está en verde, los salones diagnostican idéntico a hoy.

Nota de alcance: `getTratamientoPrincipalExplicacion` (texto explicativo de
UI) y el rebuild de recomendaciones del PDF para consultas viejas siguen en
código — son presentación, no reglas de diagnóstico.
