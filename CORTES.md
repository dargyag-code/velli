# Módulo de cortes — matriz de recomendación

Fuentes: `docs/conocimiento/Velli_Base_Conocimiento_Entrega5_Cortes_BORRADOR_v0.1.docx`
(fichas y la lógica de su §7) y la `VALIDACIÓN KEILA MORENO.docx`. **Las
respuestas 4 y 5 de Keila mandan sobre la entrega** donde difieran.

Migración: `supabase/migration-cortes.sql` (idempotente). **Ya está en
producción**: lo verifiqué por lectura el 2026-10-19 (`kb_cortes` con 16
fichas publicadas y `cortes_ejecutados` creada). Falta archivarla y regenerar
`schema.sql`.
Tests: `tests/cortes.test.ts` y `tests/cortes.integracion.test.ts`.

> **Congelado desde octubre de 2026** (Velli BI). El flag `cortes` está
> apagado en `lib/flags/registro.ts`. Con el flag apagado, los salones no ven
> `/cortes`, el botón de la ficha ni las preguntas de `flujo.crecimiento` en
> el asistente. Código, catálogo, tablas y RLS quedan intactos, y las pruebas
> siguen corriendo. `lib/cortes/preagenda.ts` se reutilizará para los avisos
> de retoque. Las decisiones están en `docs/velli-bi/00-auditoria.md`.

---

## Divergencias resueltas a favor de Keila

| Tema | Entrega 5 | Keila (manda) |
|---|---|---|
| Estructura del catálogo | §5 y §6 lo parten en "sección mujeres" y "sección hombres" | **Catálogo único** indexado por atributos arquitectónicos (largo, capas, densidad, textura); el género es **filtro de búsqueda opcional** (respuesta 5) |
| Vocabulario | PR-01 lista **tres** verbos: equilibra, destaca, enmarca | **Cuatro**: añade **celebrar** (§5.1) |
| Nombre de W-07 | Pregunta abierta: "¿Corte Velli por rizo?" | **"Corte Arquitectónico Velli en Seco"** (§5.2) |
| Imágenes | Pregunta abierta n.º 4 (fotos propias o ilustraciones) | **Banco de ilustraciones vectoriales propias**; nada de buscadores (respuesta 4) |

El filtro de género **nunca excluye los unisex**: la etiqueta organiza la
búsqueda, no levanta barreras.

---

## Arquitectura

| Capa | Archivo | Qué hace |
|---|---|---|
| Tipos | `lib/cortes/tipos.ts` | Formas de rostro, índice arquitectónico, compatibilidad |
| Catálogo semilla | `lib/cortes/fichas.ts` | 16 fichas + guía de las 7 formas de rostro |
| Lenguaje | `lib/cortes/lenguaje.ts` | Vocabulario permitido y auditoría de términos vetados |
| Matriz | `lib/cortes/matriz.ts` | Lógica de §7.2 en orden |
| PR-06 | `lib/cortes/preagenda.ts` | Pre-agendamiento del retoque vía `lib/agenda/` |
| Datos | `lib/cortes/catalogo.ts` | `kb_cortes` + historial, con fallback al seed |
| Integración | `lib/cortes/integracion.ts` | Precarga del diagnóstico + remolinos |
| Siluetas | `components/cortes/Siluetas.tsx` | SVG propios: 7 rostros + esquema por corte |
| KB | `lib/kb/seed/cortes.ts` | Seed en **borrador** |
| UI | `app/cortes/page.tsx` | Plan Pro |

### Orden de la matriz (§7.2, no reordenar)

1. **Filtro duro por tipo** (PR-03) — lo incompatible **ni aparece**; lo
   condicionado aparece con su nota (ej. W-06 en patrón 3: *"recto solo se
   verá recto alisado"*).
2. **Filtro de mantenimiento** (PR-06) — umbrales: tolerancia baja ≥ 8
   semanas, media ≥ 4, alta sin límite.
3. **Veto de remolinos** (PR-05) — un remolino frontal **excluye** los cortes
   que dependen de flequillo; un remolino de coronilla **advierte** sobre la
   raya sin excluir, porque la raya se reubica.
4. **Puntuación por rostro** — favorece +2, neutro +1, precaución 0. Lo que
   la clienta declara suma **+3**, por encima de cualquier heurística (PR-01).
5. **Salida** — top 3 con el porqué visible, variante, frecuencia y nota honesta.

Los descartes se muestran **con su motivo**: nada se oculta.

---

## Política lingüística (§5.1)

Vocabulario permitido, y solo ese: **equilibrar, destacar, enmarcar,
celebrar**. Vetados: `corregir`, `arreglar`, `compensar`, `defecto`,
`disimular`, `ocultar`, `esconder`, `camuflar`, `demasiado`,
`desproporcionado`, `achicar`, y los juicios estéticos.

`auditarLenguaje()` recorre **cualquier** estructura de salida buscando
strings anidados. El test la corre sobre el resultado completo de la matriz
en **105 combinaciones** (7 rostros × 3 tolerancias × 5 patrones), no solo
sobre los campos que uno recuerde revisar.

---

## Integración: consume, no duplica

- **Diagnóstico**: `cargarDiagnosticoVigente()` precarga tipo, subtipo,
  densidad, grosor y encogimiento desde la última consulta.
- **Remolinos**: viven en `consultas.perfil_extendido` con la dimensión nueva
  en `kb_dimensiones`, igual que el Sprint B. Sin columna nueva.
- **Pre-agendamiento**: `preAgendarRetoque()` llama a `crearCitaServicio()`,
  así que pasa por el trigger `citas_guard_legal` y hereda el bloque
  extendido de tipo 4 y el rechazo de solapes. `horarioDisponible()` avisa
  del conflicto **antes** de intentar crear la cita.
- **Fotos**: pasan por `evaluarCamara()` con el consentimiento de imágenes.

---

## Corrección incluida: el seed de colorimetría

El seed de colorimetría del Sprint C usaba `segmento: 'config'` con
`campo: 'disclaimerProductos'`. El evaluador toma **la primera** regla
`config` con ese campo por prioridad ascendente, y las reglas de colorimetría
no tenían condiciones y arrancaban en prioridad 101 — publicarlas habría
reemplazado el disclaimer de productos de **todos** los diagnósticos.

Nunca llegó a producción porque el seed era solo TypeScript, sin SQL generado.
La corrección: dos segmentos nuevos, `referencia_color` y `referencia_corte`,
que el evaluador ignora por completo. La migración extiende el CHECK de
`kb_reglas.segmento`, y hay un test de regresión que falla si alguna regla de
colorimetría vuelve a `config`.

---

## Pendientes

Estado de los pendientes, verificado en producción por lectura el 2026-10-19:

1. Hecho: la migración está aplicada (segmentos, `kb_cortes` y
   `cortes_ejecutados`). Falta moverla a `_archive/`.
2. Hecho: las 16 fichas están cargadas y publicadas.
3. Hecho a medias: el seed de referencia está publicado (17 reglas
   `referencia_corte`), pero las tres dimensiones de remolinos siguen en
   borrador.
4. Hecho (commit `ba8fba3`): `flujo.crecimiento` está publicado. Con el
   módulo congelado, el asistente lo oculta.
5. Preguntas abiertas de la Entrega 5 §8 sin decidir: si se abren las
   barberías como segmento comercial, validación del mapeo rostro × corte
   contra la escuela de Keila, y la ruta de fotos del catálogo.
