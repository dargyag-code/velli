# Velli Business Intelligence · Fase 1 · Etapa 2 — Costo de la IA

- **Fecha:** 2026-10-19
- **Actualizado:** 2026-10-22. D2 aplicada: el análisis ya no tiene respaldo GPT-4o, así que los casos altos se recalcularon sin él. Se agrega el caso E, el techo que permite la regla del tope (§6). D1 aprobada con la lectura típica (§8).
- **Rama:** `velli-bi/fase-1`
- **Alcance:** medición y propuesta. Este documento no cambia código; D2 se aplicó en las rutas el 2026-10-22. En producción solo se leyeron datos: metadatos técnicos de las capturas y los prompts publicados.

## Resumen

| | Por diagnóstico | 50 al mes | 150 al mes | 300 al mes |
|---|---|---|---|---|
| **Típico** (como los diagnósticos reales: validación + análisis, 3 fotos) | US$0,028 · **COP 94** | COP 4.712 | COP 14.136 | COP 28.271 |
| Sin validación (calidad de captura ≥ 80) | US$0,015 · COP 50 | COP 2.505 | COP 7.514 | COP 15.028 |
| **Caso alto** (2 rondas con 5 fotos grandes de galería) | US$0,114 · **COP 386** | COP 19.302 | COP 57.907 | COP 115.815 |

Los pesos usan la tasa conservadora de 3.400 COP/US$ (ver §2). **Tope para Pro+IA: 150 análisis con IA al mes** (D1, aprobada el 2026-10-22). En el caso típico eso cuesta unos COP 14.000, el 11,8 % del precio del plan (§6).

## 1. Modelo y proveedor

| Llamada | Archivo | Proveedor y modelo | Parámetros |
|---|---|---|---|
| Análisis del cabello | `app/api/analyze-hair/route.ts` | Anthropic, `claude-sonnet-4-6`, por `fetch` directo a la API | `max_tokens` 1500; sin razonamiento extendido; 1 a 5 fotos en base64 |
| Validación de fotos («¿es cabello?») | `app/api/validate-hair-photo/route.ts` | Anthropic, `claude-sonnet-4-6` | `max_tokens` 400. Corre si la calidad de la captura es menor a 80 y siempre con fotos de galería |

- **Sin respaldo desde el 2026-10-22 (D2).** Hasta entonces, las dos rutas caían a OpenAI `gpt-4o` si Claude fallaba o no devolvía JSON. OpenAI apaga `gpt-4o-2024-08-06` y `gpt-4o-2024-11-20` el 14 de enero de 2027 ([página de deprecaciones](https://developers.openai.com/api/docs/deprecations)). Ahora, si Claude falla, el análisis responde 502 y la cámara ofrece seguir con el diagnóstico manual. Si falla la validación, el análisis sigue sin ella. El detalle del error queda en el log y en Sentry (`area: ia`).
- **Límite actual:** Upstash, 20 análisis y 60 validaciones por hora y por usuario. Las variables `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` existen en Vercel para Production y Preview; lo verifiqué por nombre con `vercel env ls`.
- **No hay control de plan ni tope mensual.** Cualquier plan, incluida la prueba gratis, usa la IA.
- **No se registra el consumo.** Las dos rutas descartan el campo `usage` de la respuesta, así que no hay tokens ni costos históricos.
- **La app manda como máximo 3 fotos, pero las rutas aceptan 5.** La cámara toma 3 ángulos y la galería toma las 3 primeras fotos (`CameraCapture.tsx`). Las dos rutas aceptan hasta 5 (`MAX_FOTOS`). Los casos C, D y E (§4), con 5 fotos grandes, solo se alcanzan llamando la API directo con una sesión abierta.

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
   - GPT-4o ya no entra en ningún escenario (D2). La versión del 2026-10-19 lo sumaba en C y D con precios de agregadores; está en el historial de git.
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
| **C · Alto realista** | 2 rondas (validación + análisis) con 5 fotos grandes y salidas largas | 0,1135 | 360 | **386** |
| D · Techo de una ronda | 5 fotos grandes; las dos llamadas agotan `max_tokens` | 0,0789 | 250 | 268 |
| E · Techo con la regla del tope | Lo máximo que cabe en 1 análisis contado (§6): 2 validaciones y 1 análisis, con 5 fotos grandes y `max_tokens` agotado | 0,1094 | 347 | 372 |

Por llamada: validación de 3 fotos US$0,0130; análisis de 3 fotos US$0,0147. Antes de D2, C y D sumaban un respaldo con GPT-4o de unos US$0,014 (434 y 316 COP).

## 5. Costo mensual de un salón

COP a 3.400 COP/US$:

| Diagnósticos al mes | A · típico | B · sin validación | C · alto realista |
|---|---|---|---|
| 50 | 4.712 | 2.505 | 19.302 |
| 150 | 14.136 | 7.514 | 57.907 |
| 300 | 28.271 | 15.028 | 115.815 |

**Cómo leerlo:**
- Con uso normal, la IA cuesta poco: 300 diagnósticos típicos son unos COP 28.000, el 24 % de los COP 120.000 del plan.
- El caso alto sostenido (fotos grandes y reintentos en cada diagnóstico) a 300 al mes cuesta COP 115.815, **el 96,5 % del precio del plan**. Con el respaldo de GPT-4o lo superaba.
- Por eso el tope importa más por los extremos que por el promedio.

## 6. Propuesta de tope mensual para Pro+IA

**Tope: 150 análisis con IA por salón al mes.**
- **Unidad.** Cada vez que la estilista pulsa «Analizar», es decir, cada llamada a `/api/analyze-hair`, cuenta 1. La validación de fotos va dentro del mismo análisis, con un techo interno de 2 validaciones por análisis, para que nadie la use como vía aparte.
- **Aviso al 80 %** (120 análisis): «Te quedan 30 análisis con IA este mes».
- **Al llegar al tope**, la cámara con IA se pausa hasta el mes siguiente. El **diagnóstico manual sigue funcionando**: el tope nunca deja a una estilista sin poder trabajar, ni sin poder cotizar.
- **El mes** es el mes calendario en hora de Colombia, no el periodo de pago, para que sea fácil de explicar.
- **Prueba gratis: 20 análisis con IA en total.** Cuestan COP 1.885 en el caso típico, 5.365 en el techo de una ronda (D) y 7.441 en el techo con la regla del tope (E). Así crear cuentas nuevas no es una fuente de IA gratis (decisión P3).

| Tope | Típico (A) | Ronda pesada | Techo de una ronda (D) | Techo con la regla (E) |
|---|---|---|---|---|
| 100/mes | COP 9.424 (7,9 % del plan) | 19.302 (16,1 %) | 26.825 (22,4 %) | 37.203 (31,0 %) |
| **150/mes** | **COP 14.136 (11,8 % del plan; 23,6 % de los COP 60.000 que Pro+IA cuesta más que Pro)** | **28.954 (24,1 %)** | **40.237 (33,5 %)** | **55.805 (46,5 %)** |
| 200/mes | COP 18.848 (15,7 %) | 38.605 (32,2 %) | 53.650 (44,7 %) | 74.407 (62,0 %) |

La ronda pesada es 1 validación y 1 análisis con 5 fotos grandes y salidas largas; nunca incluyó el respaldo, así que no cambió con D2.

**Por qué 150:**
- Cubre un salón con mucho movimiento: unos 5 diagnósticos con IA por día hábil, durante 26 días, son 130 al mes.
- Mantiene el costo típico por debajo del 12 % del precio del plan.
- El techo teórico queda en el 33,5 % del plan con una validación por análisis (D) y en el 46,5 % con las dos que permite la regla (E). Con 200, E pasa del 60 %.

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

   Cambiar de modelo exige probarlo con llamadas reales, que cuestan, y validar la calidad del diagnóstico. **Es tu decisión, no una recomendación.**
5. **Reducir las fotos de galería** a 1.568 px en el lado largo, en el teléfono, antes de enviarlas. Hoy no cambia el costo con Sonnet 4.6, porque la API ya las reduce. Sí baja el peso de la petición y protege el costo si algún día se cambia de modelo.

## 8. Decisiones que necesito

| # | Decisión | Mi recomendación | Estado |
|---|---|---|---|
| D1 | Tope de Pro+IA y de la prueba gratis | **150 análisis al mes** con aviso al 80 %, y **20** en la prueba gratis | **Aprobada** el 2026-10-22. La condición del 2026-10-19 (que 150 análisis cuesten como máximo el 15 % del plan, COP 18.000) se mide con la lectura típica; ver abajo. No implementada: necesita `uso_ia` |
| D2 | El respaldo GPT-4o se apaga el 14-ene-2027 | Quitar el respaldo de OpenAI. Si Claude falla, la estilista sigue con el diagnóstico manual, que ya existe. Así queda un solo proveedor que declarar en la política de privacidad (R4). La alternativa sería migrar a `gpt-6-luna`: precio desconocido, y habría que probar la calidad y actualizar los textos legales. | **Aprobada** el 2026-10-19 y **aplicada** el 2026-10-22 (ver abajo) |
| D3 | Abaratar la validación (palanca 1) | Sí, después de que exista el registro de `usage` para medir el antes y el después | Sin decidir |
| D4 | Cambiar de modelo | No por ahora. Primero registrar consumo real | Sin decidir |

### D1 · Qué tope cumple el 15 %

**Decisión (2026-10-22): 150 al mes, con la lectura típica.** Los casos altos quedan acotados por el mismo tope.

El tope más alto cuyo costo no pasa de COP 18.000 al mes, según la lectura:

| Lectura | Costo por análisis | Tope máximo | ¿150 cumple? |
|---|---|---|---|
| Típica (A) | COP 94 | 191 | Sí: COP 14.136, el 11,8 % |
| Ronda pesada | COP 193 | 93 | No: 24,1 % |
| Techo de una ronda (D) | COP 268 | 67 | No: 33,5 % |
| Techo con la regla del tope (E) | COP 372 | **48** | No: 46,5 % |

- El 2026-10-19 di **56** como tope del peor caso. Ese número sumaba el respaldo GPT-4o, que ya no existe. Además contaba una sola validación por análisis, aunque la regla permite dos: eso fue un error mío. Sin GPT-4o y con las dos validaciones, el peor caso da **48**.
- Las tres lecturas altas usan 5 fotos grandes, y la app nunca manda más de 3 (§1). Solo se alcanzan llamando la API directo. Aun así, el tope las limita: con 150, ningún salón pasa de COP 55.805 al mes.

### D2 · Qué cambió (2026-10-22)

- `app/api/analyze-hair` y `app/api/validate-hair-photo` llaman solo a Claude. Si falla, el análisis responde 502 con un texto para la estilista, sin el error del proveedor. El detalle va al log y a Sentry.
- La cámara muestra «IA no disponible» con el motivo: sin conexión, la IA no respondió o el límite por hora. Ofrece «Seguir con selección manual», que abre el formulario manual del paso del cabello, e «Intentar de nuevo», salvo con el límite por hora. Las fotos de ese intento no se guardan, igual que con «Llenar manualmente sin cámara».
- El aviso de privacidad de la cámara nombra solo a Anthropic. La clave sube a `velli_ai_disclaimer_v2`, así que el aviso vuelve a salir una vez en cada dispositivo.
- OpenAI sale de la CSP y del `.env.local.example`. Pruebas: `tests/ia.sin-respaldo.test.ts`.
- Los textos legales (`app/legal/privacidad` y `app/legal/terminos`) nombran solo a Anthropic desde el 2026-10-22 (R4).
- **Pendiente, fuera del código:**
  - Tras desplegar, la variable `OPENAI_API_KEY` de Vercel queda sin uso. Se puede borrar allí y revocar la llave en OpenAI.
