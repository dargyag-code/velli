# Velli Business Intelligence · Fase 1 · Etapa 2 — Costo de la IA

- **Fecha:** 2026-10-19
- **Rama:** `velli-bi/fase-1`
- **Alcance:** medición y propuesta. No cambia código. En producción solo se leyeron datos: metadatos técnicos de las capturas y los prompts publicados.

## Resumen

| | Por diagnóstico | 50 al mes | 150 al mes | 300 al mes |
|---|---|---|---|---|
| **Típico** (como los diagnósticos reales: validación + análisis, 3 fotos) | US$0,028 · **COP 94** | COP 4.712 | COP 14.136 | COP 28.271 |
| Sin validación (calidad de captura ≥ 80) | US$0,015 · COP 50 | COP 2.505 | COP 7.514 | COP 15.028 |
| **Caso alto** (2 rondas con 5 fotos grandes de galería + 1 respaldo) | US$0,128 · **COP 434** | COP 21.693 | COP 65.079 | COP 130.159 |

Los pesos usan la tasa conservadora de 3.400 COP/US$ (ver §2). **Propuesta de tope para Pro+IA: 150 análisis con IA al mes.** En el caso típico eso cuesta unos COP 14.000, el 11,8 % del precio del plan (§6).

## 1. Modelo y proveedor

| Llamada | Archivo | Proveedor y modelo | Parámetros |
|---|---|---|---|
| Análisis del cabello | `app/api/analyze-hair/route.ts` | Anthropic, `claude-sonnet-4-6`, por `fetch` directo a la API | `max_tokens` 1500; sin razonamiento extendido; 1 a 5 fotos en base64 |
| Respaldo del análisis | igual | OpenAI, `gpt-4o`, con `detail` por defecto | Corre si Claude falla o si su respuesta no trae JSON |
| Validación de fotos («¿es cabello?») | `app/api/validate-hair-photo/route.ts` | La misma cadena: Claude Sonnet 4.6 y, si falla, GPT-4o con `detail: low` | `max_tokens` 400. Corre si la calidad de la captura es menor a 80 y siempre con fotos de galería |

- **Límite actual:** Upstash, 20 análisis y 60 validaciones por hora y por usuario. Las variables `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` existen en Vercel para Production y Preview; lo verifiqué por nombre con `vercel env ls`.
- **No hay control de plan ni tope mensual.** Cualquier plan, incluida la prueba gratis, usa la IA.
- **No se registra el consumo.** Las dos rutas descartan el campo `usage` de la respuesta, así que no hay tokens ni costos históricos.
- **El respaldo tiene fecha de apagado.** OpenAI anunció el 14 de octubre de 2026 que apaga `gpt-4o-2024-08-06` y `gpt-4o-2024-11-20` el **14 de enero de 2027** ([página de deprecaciones](https://developers.openai.com/api/docs/deprecations)). La página no menciona el alias `gpt-4o` por nombre. Ver la decisión D2.

## 2. Método

1. **Registros reales, solo lectura.** Hay 7 consultas con captura de cámara (mayo y junio de 2026). Solo traje las rutas técnicas de `capture_metadata`: fotos, resolución, formato, puntaje de calidad y validación. Nada de ubicación ni dispositivo. Resultado:
   - las 7 usaron **3 fotos webp de 720×1280 o 1280×720**;
   - todas puntuaron 62 o 75, por debajo de 80, así que **la validación corrió en las 7**;
   - en la práctica, cada diagnóstico con IA hizo **dos llamadas con 3 imágenes cada una**.
2. **Tokens, medidos y no estimados.** Usé el endpoint `count_tokens` de Anthropic, que es gratis y no genera respuestas, con:
   - los prompts **publicados en producción** (`analisis_foto.*`, sin extras);
   - imágenes **sintéticas** de las mismas dimensiones. Nunca se enviaron fotos de clientas: el costo de una imagen depende solo de su tamaño.

   Script y salida guardada: `calculos/contar_tokens.mjs` y `calculos/conteo_tokens.txt`.
3. **Tokens de salida.** No hay registros de las respuestas reales. Medí los tokens del JSON que pide cada prompt: unos 110 en el análisis y 81 en la validación de 3 fotos. Para el caso alto supuse 300.
4. **Precios.**
   - Claude Sonnet 4.6: US$3 por millón de tokens de entrada y US$15 por millón de salida. Fuente: [página oficial de precios de Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), consultada el 2026-10-19.
   - GPT-4o: US$2,50 y US$10, según agregadores de agosto de 2026 ([pricepertoken](https://pricepertoken.com/pricing-page/model/openai-gpt-4o), [anotherwrapper](https://anotherwrapper.com/tools/llm-pricing/gpt-4o-2024-05-13)). No lo confirmé en la página de OpenAI.
5. **Tasa de cambio.**
   - TRM observada: 3.170,46 COP/US$ (16-oct-2026, [Portafolio](https://www.portafolio.co/economia/finanzas/precio-del-dolar-hoy-en-colombia-asi-cotiza-la-divisa-este-16-de-octubre-tras-perder-casi-504569)).
   - Para presupuestar uso **3.400**, que cubre el margen cambiario de la tarjeta.
   - **Si la factura de Anthropic trae IVA (19 %), multiplica por 1,19.** No lo verifiqué.
6. Los cálculos están en `calculos/costo_ia.mjs`, con su salida en `calculos/costo_ia_salida.txt`. Para actualizar precios o la TRM, cámbialos y vuelve a correrlo.

## 3. Tokens medidos (Claude Sonnet 4.6)

| Petición | Tokens de entrada |
|---|---|
| 1 foto de 720×1280 (solo la imagen) | 1.211 |
| Foto grande de galería (1920×1080 o 3000×4000) | 1.575–1.579: la API la reduce a 1.568 px en el lado largo |
| Análisis con 1 / 3 / 5 fotos de 720×1280 | 1.939 / **4.361** / 6.784 |
| Validación con 1 / 3 / 5 fotos | 1.511 / **3.923** / 6.335 |
| Análisis con 5 fotos grandes de galería | 8.624 |
| Validación con 5 fotos grandes | 8.175 |

El estado del cabello (seco, húmedo, con producto, recién lavado) cambia el total en menos de 10 tokens. Los textos de los prompts suman unos 600 tokens. Más del 80 % del costo son las fotos.

## 4. Costo por diagnóstico

| Escenario | Qué incluye | US$ | COP (TRM 3.170) | COP (3.400) |
|---|---|---|---|---|
| **A · Típico observado** | Validación + análisis, 3 fotos de cámara | 0,0277 | 88 | **94** |
| B · Sin validación | Solo análisis, 3 fotos (calidad ≥ 80) | 0,0147 | 47 | 50 |
| **C · Alto realista** | 2 rondas (validación + análisis) con 5 fotos grandes, salidas largas, y 1 respaldo con GPT-4o | 0,1276 | 405 | **434** |
| D · Techo de una ronda | 5 fotos grandes, las dos llamadas agotan `max_tokens`, más respaldo | 0,0930 | 295 | 316 |

Por llamada: validación de 3 fotos US$0,0130; análisis de 3 fotos US$0,0147. El respaldo con GPT-4o, estimado con el método de cuadrículas de OpenAI y no medido, cuesta unos US$0,014.

## 5. Costo mensual de un salón

COP a 3.400 COP/US$:

| Diagnósticos al mes | A · típico | B · sin validación | C · alto realista |
|---|---|---|---|
| 50 | 4.712 | 2.505 | 21.693 |
| 150 | 14.136 | 7.514 | 65.079 |
| 300 | 28.271 | 15.028 | 130.159 |

**Cómo leerlo:**
- Con uso normal, la IA cuesta poco: 300 diagnósticos típicos son unos COP 28.000, el 24 % de los COP 120.000 del plan.
- El caso alto sostenido (fotos grandes, reintentos y respaldo en cada diagnóstico) a 300 al mes **supera el precio del plan**.
- Por eso el tope importa más por los extremos que por el promedio.

## 6. Propuesta de tope mensual para Pro+IA

**Tope: 150 análisis con IA por salón al mes.**
- **Unidad.** Cada vez que la estilista pulsa «Analizar», es decir, cada llamada a `/api/analyze-hair`, cuenta 1. La validación de fotos va dentro del mismo análisis, con un techo interno de 2 validaciones por análisis, para que nadie la use como vía aparte.
- **Aviso al 80 %** (120 análisis): «Te quedan 30 análisis con IA este mes».
- **Al llegar al tope**, la cámara con IA se pausa hasta el mes siguiente. El **diagnóstico manual sigue funcionando**: el tope nunca deja a una estilista sin poder trabajar, ni sin poder cotizar.
- **El mes** es el mes calendario en hora de Colombia, no el periodo de pago, para que sea fácil de explicar.
- **Prueba gratis: 20 análisis con IA en total.** Cuestan unos COP 1.900 en el caso típico y COP 6.300 en el techo. Así crear cuentas nuevas no es una fuente de IA gratis (decisión P3).

| Tope | Típico (A) | Ronda pesada | Techo (D) |
|---|---|---|---|
| 100/mes | COP 9.424 (7,9 % del plan) | 19.302 (16,1 %) | 31.606 (26,3 %) |
| **150/mes** | **COP 14.136 (11,8 % del plan; 23,6 % de los COP 60.000 que Pro+IA cuesta más que Pro)** | **28.954 (24,1 %)** | **47.409 (39,5 %)** |
| 200/mes | COP 18.848 (15,7 %) | 38.605 (32,2 %) | 63.212 (52,7 %) |

**Por qué 150:**
- Cubre un salón con mucho movimiento: unos 5 diagnósticos con IA por día hábil, durante 26 días, son 130 al mes.
- Mantiene el costo típico por debajo del 12 % del precio del plan.
- El techo teórico (cada análisis con 5 fotos grandes y el máximo de salida) queda por debajo del 40 %. Con 200, el techo pasa de la mitad del plan.

**Cómo se haría cumplir** (se diseña en la Etapa 3 y no se implementa todavía):
1. Control de plan y del tope **en el servidor**, en las dos rutas, nunca solo en la interfaz.
2. Una tabla de uso, `uso_ia`, que guarda cada llamada con proveedor, modelo, tokens de entrada y salida (del campo `usage`), costo estimado y resultado. Así se cuenta el tope y, sobre todo, se mide el costo real.
3. La guarda de suscripción que ya existe (`verificar_escritura_tenant`) sigue rigiendo para vencidas.

## 7. Palancas para bajar el costo (ninguna aplicada)

1. **La validación corre siempre y duplica las imágenes.** Pasó en 7 de 7 casos reales. Si se manda a baja resolución, o se fusiona con el análisis (que el JSON del análisis diga si cada foto muestra cabello), el típico baja de COP 94 a cerca de 50. Es un cambio técnico del prompt de validación, que no está en la base de conocimiento.
2. **Registrar `usage`** en cada llamada: sin eso, todo este documento es una estimación.
3. **Prompt caching: no aplica.** El texto ronda los 600 tokens y las fotos cambian en cada llamada.
4. **Cambiar de modelo.** Lo medí con `count_tokens` (`claude-sonnet-5-5`):
   - Sonnet 5.5 cuesta menos por token (US$2 / US$10).
   - Una foto de cámara cuesta casi igual: 1.215 tokens.
   - **Una foto grande de galería sube a 4.759 tokens, tres veces más**, porque ese modelo trabaja en alta resolución. Habría que reducir las fotos en el teléfono antes de enviarlas.
   - Además razona por defecto, lo que sube los tokens de salida.

   Cambiar de modelo exige probarlo con llamadas reales, que cuestan, y validar la calidad del diagnóstico con Keila. **Es tu decisión, no una recomendación.**
5. **Reducir las fotos de galería** a 1.568 px en el lado largo, en el teléfono, antes de enviarlas. Hoy no cambia el costo con Sonnet 4.6, porque la API ya las reduce. Sí baja el peso de la petición y protege el costo si algún día se cambia de modelo.

## 8. Decisiones que necesito

| # | Decisión | Mi recomendación |
|---|---|---|
| D1 | Tope de Pro+IA y de la prueba gratis | **150 análisis al mes** con aviso al 80 %, y **20** en la prueba gratis |
| D2 | El respaldo GPT-4o se apaga el 14-ene-2027 | Quitar el respaldo de OpenAI. Si Claude falla, la estilista sigue con el diagnóstico manual, que ya existe. Así queda un solo proveedor que declarar en la política de privacidad (R4). La alternativa sería migrar a `gpt-6-luna`: precio desconocido, y habría que probar la calidad y actualizar los textos legales. |
| D3 | Abaratar la validación (palanca 1) | Sí, después de que exista el registro de `usage` para medir el antes y el después |
| D4 | Cambiar de modelo | No por ahora. Primero registrar consumo real |
