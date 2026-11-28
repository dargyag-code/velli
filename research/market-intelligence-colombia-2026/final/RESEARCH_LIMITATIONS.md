# Limitaciones Metodológicas y Vacíos de Investigación Documentados (`RESEARCH_LIMITATIONS`)

> En cumplimiento de las reglas de integridad de Veli, este documento explicita qué partes del mercado colombiano presentan evidencia parcial y **cómo debe comportarse el producto ante esos vacíos** en lugar de inventar precisión.

---

## 1. Sesgo de Digitalización en el Segmento Económico / Barrio (`economico`)

- **Limitación real:** Las plataformas con precios públicos indexables (*Fresha, Booksy, WeiBook, AgendaPro* y sitios propios) sobrerrepresentan a los segmentos `estandar` (`57,6%` de la muestra) y `premium` (`30,8%`). Según DANE EMICRON (CIIU 9602), cerca del `94%` de las más de `261.000` unidades productivas en Colombia son micronegocios donde predomina el efectivo, el aviso físico en fachada y WhatsApp informal sin menú web publicado.
- **Mitigación aplicada:** Se contrastaron las tarifas digitales contra reportes locales de prensa regional (*Telemedellín*, directorios de barrio en Suba/Engativá/San Fernando y cadenas populares) y nunca se usó la mediana digital cruda como recomendación para el segmento `economico`.
- **Trabajo de campo futuro sugerido (P3):** Levantamiento presencial o por encuesta corta de onboarding en peluquerías y barberías de estratos 2 y 3 en Bogotá, Medellín, Cali, Barranquilla y ciudades intermedias.

---

## 2. Densidad Muestral Asimétrica en Ciudades Intermedias

- **Limitación real:** Mientras Bogotá (`88 obs.`), Medellín (`37`), Cali (`26`) y Barranquilla (`20`) cuentan con cobertura transversal en las 5 verticales, en ciudades intermedias como **Ibagué, Cúcuta, Neiva, Villavicencio y Manizales** la publicación abierta de precios es alta en `barber_studio` y `nail_bar`, pero escasa en `spa_estetica` y `beauty_lounge` (muchos spas y maquilladoras operan exclusivamente con botón *«Cotizar por WhatsApp»*).
- **Mitigación aplicada:** En `pricing/city_price_comparison.csv`, las **27 combinaciones ciudad×vertical** con `observed_sample_count = 0` se marcaron rigurosamente con `data_origin = estimated` y `confidence_level = low`.
- **Regla obligatoria para la UI de Veli:** Cuando un establecimiento en una ciudad con `confidence_level = low` consulte referencias locales, Veli debe mostrar el rango regional agregado con la etiqueta *«Referencia estimada para ciudades intermedias (muestra local en construcción)»*, nunca afirmando que es el promedio exacto de su ciudad.

---

## 3. Efecto Ancla en Servicios con Precio «Desde» (`starting_at`)

- **Limitación real:** El `25,4%` de las tarifas publicadas en Colombia (y más del `75%` en colorimetría compleja como *Balayage*, *Babylights*, *Corrección de color* y *Alisados*) se anuncian como precio **«Desde»** aplicable únicamente a cabello corto/escaso sin tratamientos correctivos adicionales. El ticket real cobrado en caja suele superar entre **`+18%` y `+45%`** ese valor publicado.
- **Mitigación aplicada:** En `catalog/procedure_variants.csv` y `technical/procedure_consumption.csv` se desacopló la tarifa base corto (`1.0x`) de los recargos reales por longitud y densidad (`medio`, `largo`, `extra_largo`).

---

## 4. Descuentos Comerciales Privados en Compra de Insumos (`products/`)

- **Limitación real:** Los precios verificados en `products/product_prices.csv` corresponden a listas públicas de distribuidores profesionales y mayoristas en Colombia. Sin embargo, salones con alto volumen mensual negocian con visitadores comerciales de *Henkel/Schwarzkopf, Wella, L'Oréal o Alfaparf* escalas de bonificación en especie (ej. *«compra 12 tubos y recibe 2 sin costo + oxidante»*, equivalente a un `12%–18%` de descuento efectivo) que no figuran en e-commerce.
- **Mitigación aplicada:** El modelo de costos en `financial/procedure_cost_models.csv` es **conservador** (usa precio distribuidor sin bonificaciones extraordinarias), y Veli permite que cada negocio sobrescriba en su propia tabla privada `productos_salon` su precio real de factura.

---

## 5. Costos Fijos de Arriendo por Micro-Zona Urbana

- **Limitación real:** Dentro de una misma ciudad, el arriendo por metro cuadrado varía hasta `3,5x` entre un local a pie de calle en Parque 93 / El Poblado frente a un segundo piso o estudio interior en Chapinero / Laureles / Envigado.
- **Mitigación aplicada:** El parámetro `cost_per_chair_min_cop` en `financial/` modela tres arquetipos claros (`economico`, `estandar`, `premium`), pero para recomendaciones automatizadas de punto de equilibrio individual en Veli (Fase P1) deberá alimentarse con **3 inputs simples del propio salón** (arriendo + servicios/fijos mensuales + número de sillas/horas operativas).
