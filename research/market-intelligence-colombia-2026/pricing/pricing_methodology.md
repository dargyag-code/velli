# Metodología de Inteligencia de Precios y Hallazgos de Mercado · Colombia (2025–2026)

> **Entregable oficial — Fase 2 (`AGENTE 1 · Inteligencia de Precios y Mercado`)**  
> Cobertura: **276 observaciones reales verificadas** (`price_observations.csv`), **193 procedimientos canónicos** (`price_benchmarks.csv`) y **75 cruces geográficos** en **15 ciudades × 5 verticales** (`city_price_comparison.csv`).

---

## 1. Diseño Muestral, Cobertura y Trazabilidad de Fuentes

La recolección se ejecutó exclusivamente sobre fuentes públicas auditables publicadas en Colombia (vigencia 2025–2026), sin extrapolaciones ficticias ni invención de establecimientos:

1. **Marketplaces de agendamiento con tarifario público verificable (`booking_platform`, 159 obs. / 57,6%)**:
   - **Fresha Colombia** (`fresha.com/es/a/`): perfiles activos con precios visibles, duración declarada y ubicación exacta en Bogotá D.C., Medellín, Cali, Barranquilla, Bucaramanga, Cartagena, Pereira, Manizales, Ibagué, Cúcuta y Neiva.
   - **AgendaPro Colombia** (`agendapro.com/co/`): vitrinas de reserva directa de estudios capilares, spas, barberías y salones de uñas en Bogotá, Medellín, Cali, Pereira, Manizales, Armenia, Santa Marta y Tunja.
   - **Booksy Colombia** (`co.booksy.com/`) y **WeiBook Colombia** (`weibook.co`): estudios de barbería, uñas y belleza integral con alta penetración en ciudades intermedias (Armenia, Santa Marta, Tunja).
2. **Portales oficiales de cadenas, clínicas y estudios de autor (`official_website`, 117 obs. / 42,4%)**:
   - Tarifarios directos publicados por marcas referentes como *Super Wow*, *Inlash*, *Barbería Lords*, *El Mago del Color*, *Picasso Peluquería*, *VIP Studio Peluquería*, *Japanese Head Spa Bogotá*, *Glam Spa Bogotá*, *Depilarte*, *BodyBrite*, *Yo Soy Soler*, *Etérea Beauty*, *Secret Glow Makeup*, *Michelle Makeup*, *Foriu*, *Rodina Styleroom*, *Los Rizos de Fernanda*, *Ava Lyen*, *Verónica Santillana*, *Viva Spa*, *Landmark Spa*, *Elcielo Spa*, *Sahara Spa*, *Laskin*, *The Salon SPA*, *Mostacho Barbería* y *Cordero Barbería*.

### Resumen cuantitativo del corpus recolectado

| Métrica de cobertura | Valor exacto | Detalle operativo |
|---|---:|---|
| Observaciones verificadas (`price_observations.csv`) | **276** | `OBS-CO-0001` a `OBS-CO-0276` |
| Establecimientos reales únicos | **81** | Distribuidos en las 15 ciudades objetivo |
| Procedimientos canónicos con muestra directa (`n >= 1`) | **97** | 50,3% del catálogo ampliado de 193 procedimientos |
| Procedimientos canónicos benchmarkeados (`price_benchmarks.csv`) | **193** | 125 de `catalog_audit.csv` + 68 de `missing_procedures.csv` |
| Matriz geográfica (`city_price_comparison.csv`) | **75** | 15 ciudades colombianas × 5 verticales de Veli |

**Distribución por vertical (`price_observations.csv`):**
- `nail_bar`: **93** observaciones (33,7%)
- `barber_studio`: **71** observaciones (25,7%)
- `hair_studio`: **54** observaciones (19,6%)
- `spa_estetica`: **36** observaciones (13,0%)
- `beauty_lounge`: **22** observaciones (8,0%)

**Distribución por ciudad (`price_observations.csv`):**
Bogotá D.C. (**88**), Medellín (**37**), Cali (**26**), Barranquilla (**20**), Bucaramanga (**14**), Armenia (**14**), Tunja (**14**), Pereira (**13**), Cartagena (**12**), Santa Marta (**9**), Manizales (**7**), Villavicencio (**7**), Ibagué (**5**), Cúcuta (**5**) y Neiva (**5**).

---

## 2. Metodología Estadística y Reglas de Estimación (`price_benchmarks.csv`)

Cada uno de los **193 procedimientos canónicos** cuenta con indicadores de tendencia central, posición, dispersión y precios sugeridos por segmento:

1. **Cálculo de cuantiles empíricos (`P25`, `Mediana`, `P75`, `IQR`)**:
   - Se emplea interpolación lineal continua tipo `R-7` (estándar `PERCENTILE.INC` / NumPy): para un arreglo ordenado $x_{(1)} \le \dots \le x_{(n)}$ y probabilidad $q \in \{0.25, 0.50, 0.75\}$, se define $p = (n - 1)q$, $k = \lfloor p \rfloor$ y $f = p - k$, obteniendo $Q(q) = \text{round}(x_{(k+1)} + f \cdot (x_{(k+2)} - x_{(k+1)}))$.
   - La dispersión intercuartílica se reporta exactamente como $\text{IQR} = P_{75} - P_{25}$.
2. **Umbral estricto de origen del dato (`data_origin`) y confianza (`confidence_level`)**:
   - **`calculated` + `high` (13 procedimientos con `n >= 5`)**: procedimientos ancla con alta densidad muestral directa multi-ciudad (ej. `barber-corte-fade` `n=15`, `barber-combo-corte-barba` `n=15`, `nail-manicura-semipermanente` `n=14`, `hair-balayage-completo` `n=13`, `nail-manicura-tradicional` `n=10`, `barber-perfilado-barba` `n=10`, `barber-combo-ritual-premium` `n=8`, `nail-pedicura-semipermanente` `n=6`, `hair-corte-personalizado` `n=5`, `hair-cepillado-blower` `n=5`, `barber-ritual-toalla-caliente` `n=5`, `nail-cejas-hilo-visagismo` `n=5`, `lounge-maquillaje-social` `n=5`). Todos sus estadísticos descriptivos se calculan directamente sobre las filas observadas.
   - **`estimated` + `medium` (171 procedimientos)**:
     - *Síntesis híbrida (`1 <= n <= 4`, 84 procedimientos)*: integra las observaciones directas verificadas con los pisos, medianas y techos sectoriales documentados en directorios nacionales 2025–2026, evitando distorsiones por muestras pequeñas de una sola ciudad.
     - *Estimación paramétrica sectorial (`n = 0`, 87 procedimientos)*: calibrada a partir de rangos agregados publicados en plataformas colombianas y relaciones técnicas de tiempo de silla y consumo de insumos frente a procedimientos ancla de la misma familia.
   - **`estimated` + `low` (9 procedimientos)**: asignado honestamente a servicios emergentes, logísticos o de cotización cerrada por WhatsApp donde casi ningún estudio publica tarifa fija abierta (`hair-permanente-ondulacion`, `barber-coloracion-fantasia-diseno`, `barber-hidratacion-capilar-silla`, `barber-membresia-mensual-corte`, `barber-servicio-domicilio-vip`, `nail-taller-automanicura-cuidado`, `lounge-acompanamiento-evento-touchup`, `lounge-recargo-domicilio-fuera-ciudad` y `lounge-asesoria-imagen-colorimetria`).
3. **Redondeo comercial y monotonicidad por segmento**:
   - Los tres precios recomendados (`recommended_econ_cop`, `recommended_std_cop`, `recommended_prem_cop`) están expresados en **múltiplos exactos de `1.000 COP`** y cumplen invariablemente `recommended_econ_cop < recommended_std_cop < recommended_prem_cop`.
   - Para evitar sobreponderar un mismo establecimiento que publica 4 tarifas por longitud capilar, se registró 1 observación base/media representativa por procedimiento-establecimiento, salvo cuando el negocio diferencia escalafones reales de especialista (ej. *Barbería Lords*: *Superior* vs *V.I.P.* vs *Signature Master*) o separa tarifa regular vs promocional.

---

## 3. Señales Verificables de Segmentación (`establishment_segment`)

Conforme al `DATA_DICTIONARY.md`, ningún establecimiento fue clasificado únicamente por el valor monetario cobrado. Se aplicó una matriz de 4 señales observables documentadas en `evidence_notes`:

| Segmento | Participación muestra | Señales verificables exigidas | Ejemplos reales en muestra |
|---|---:|---|---|
| `economico` | **32 obs.** (11,6%) | Barrios populares o periféricos, locales básicos sin recepción separada, atención híbrida orden de llegada / agenda básica, insumos nacionales de volumen. | *Magic Extensions* (Medellín), *Tendencia Beauty Studio* (Bucaramanga), *MF Barber Studio* (Neiva), *Royal Club* (Tunja), *Nany Eye Lashes* (Cúcuta). |
| `estandar` | **159 obs.** (57,6%) | Corredores comerciales consolidados o centros comerciales regionales, agenda digital estructurada (Fresha/Booksy/AgendaPro/app propia), kits desechables y marcas profesionales estándar. | *Super Wow*, *Picasso Peluquería*, *Glam Spa*, *Depilarte*, *Los Rizos de Fernanda*, *La Crespería*, *Tribu Barber*, *Check Point*, *Mostacho Barbería*. |
| `premium` | **85 obs.** (30,8%) | Corredores inmobiliarios prime (Chicó, Rosales, El Nogal, Country, El Poblado, Bocagrande, Pinares/Circunvalar, Mall Plaza Buenavista), diagnóstico previo o microcámara, amenidades/zonas húmedas y backbar de lujo (Olaplex/K18, Wella/Sebastian, HydraFacial®). | *El Mago del Color*, *Barbería Lords*, *Inlash*, *Secret Glow Makeup*, *Etérea Beauty*, *Ava Lyen*, *Landmark Spa*, *Elcielo Spa*, *Laskin*, *The Salon SPA*. |

> **Prueba de independencia precio-segmento:** En *Super Wow* (`estandar` en centros comerciales), un set de uñas acrílicas cuesta `179.900 COP` por costos locativos y kit bioseguro estandarizado, superando a estudios independientes `estandar`, mientras que en *Barbería Lords* (`premium`), un rapado a 1 grado inicia en `19.800 COP` pese a operar en el Parque de la 93.

---

## 4. Tratamiento de Precios `"Desde"` (`starting_at`) y Tarifas Promocionales

### 4.1 Sesgo de anclaje en tarifas `"Desde"` (`starting_at`: 70 obs. / 25,4% vs `fixed`: 206 obs. / 74,6%)
En Colombia, el **85%+ de los servicios de decoloración, alisados y estructuras largas de uñas** se publican en Fresha, AgendaPro e Instagram bajo la etiqueta `"Desde"` (`starting_at`):
- **Colorimetría compleja (`hair-balayage-completo`, `hair-babylights`, `hair-correccion-color`)**: el valor publicado (`$290.000–$460.000 COP`) aplica estrictamente a cabello corto o hasta los hombros, densidad media y sin extracción de tintes oscuros. Cuando un estudio explicita su matriz cerrada por longitud (ej. *Jhonatan Ortiz Lourido* en Cali: corto `480.000`, medio `600.000`, largo `750.000 COP`; *The Salon SPA* en Cartagena: medio `450.000`, largo `600.000`, XL `750.000 COP`; *Adoratta* en Cali: largo abundante `650.000 COP`), se comprueba un **multiplicador real de `1.35x` (medio-largo) a `1.75x` (extra largo)** sobre el precio `"Desde"`.
- **Ajuste metodológico en `price_benchmarks.csv`**: para evitar que el anclaje `"Desde"` subestime el ingreso esperado de un salón en Veli, `recommended_std_cop` en procedimientos químicos largos se calibró sobre la **melena media real** (`$420.000 COP` en balayage, `$520.000 COP` en corrección de color y `$260.000 COP` en keratina orgánica), dejando la base corta y extra-larga para la tabla de variantes (`market_procedure_variants`).

### 4.2 Separación de precios regulares (`272 obs.`) vs promocionales (`4 obs.`)
Se identificaron tres mecánicas promocionales recurrentes en el mercado colombiano que **no deben confundirse con el precio de lista sostenible**:
1. **Ganchos de primera visita en marketplaces**: ej. *Combo Corte Lords 1ra Vez* en `49.000 COP` (incluyendo asesoría y mascarilla facial) frente a `55.000–70.000 COP` en tarifa regular recurrente.
2. **Descuentos por compra anticipada e-commerce o bonos multisesión**: ej. *Yo Soy Soler* ofrece *Hydrafacial* en `330.000 COP` (`-25%` web) frente a `440.000 COP` precio lista, y `275.000 COP/sesión` al comprar paquete de 3; *BodyBrite* reduce sesiones láser de `180.000 COP` lista a `65.000–75.000 COP` en paquetes promocionales de 6 a 12 sesiones.
3. **Tarifas de días valle (martes a jueves)**: ej. *Sahara Spa* (Cali) reduce el ritual en pareja a `180.000 COP` miércoles y jueves; *Picasso Peluquería* activa paquetes de balayage en `230.000 COP` en días valle frente a `420.000 COP` regular.

---

## 5. Dispersión Geográfica Multi-Ciudad (`city_price_comparison.csv`)

Tomando a **Bogotá D.C. como base `1.00`** en cada vertical, el análisis de las **15 ciudades** revela una estructura de **cuatro escalones tarifarios** con marcadas asimetrías sectoriales:

| Escalón geográfico | Ciudades incluidas | Rango de índice vs Bogotá | Dinámica competitiva observada |
|---|---|---|---|
| **1. Polos con prima turística / lujo focalizado** | Cartagena (`CTG`), Medellín (`MED`) en Spa/Capilar | `0.98x – 1.08x` | **Cartagena** supera a Bogotá en `beauty_lounge` (`1.08x`) y `hair_studio` prime (`1.02x`) por bodas destino y exigencia climática de fijación/antifrizz. **Medellín (El Poblado)** alcanza `1.02x` en `spa_estetica` por turismo wellness internacional (*Elcielo*, *Landmark*, *Ava Lyen*), pero es mucho más económica en barbería (`0.84x`). |
| **2. Capitales principales competitivas** | Cali (`CLO`), Barranquilla (`BAQ`) | `0.76x – 0.91x` | Alta especialización técnica con costos inmobiliarios menores que Bogotá. **Cali** lidera en texturas afro/rizos y estética postoperatoria/clínica (`0.90x–0.91x`). **Barranquilla** muestra fuerte polarización entre el norte comercial (`Mall Plaza` / `Alto Prado`) y barberías urbanas (`0.76x`). |
| **3. Intermedias dinámicas y turísticas** | Bucaramanga (`BGA`), Pereira (`PEI`), Santa Marta (`SMR`), Manizales (`MZL`), Armenia (`AXM`) | `0.71x – 0.89x` | **Pereira** lidera el Eje Cafetero (`0.82x–0.86x`) con estudios consolidados en Pinares/Circunvalar. **Santa Marta** evidencia una brecha interna del **+40%** en la misma marca (*Francisco Dávila*: `35.000 COP` en El Rodadero vs `25.000 COP` en barrio residencial). **Bucaramanga** y **Armenia** destacan por alta adopción de Fresha/AgendaPro en uñas y barbería. |
| **4. Intermedias de costo contenido / frontera** | Ibagué (`IBE`), Villavicencio (`VVC`), Tunja (`TUN`), Cúcuta (`CUC`), Neiva (`NVA`) | `0.62x – 0.76x` | Fuerte compresión tarifaria en servicios intensivos en mano de obra: barbería en Tunja y Neiva opera entre `20.000` y `28.000 COP` (`0.62x–0.64x`), y extensiones de pestañas o pedicura en **Cúcuta** bajan hasta `60.000` y `20.000 COP` (`0.67x`). |

### Limitaciones explícitas de muestra en ciudades intermedias
En cumplimiento de los estándares de transparencia de datos, **27 de las 75 celdas ciudad × vertical** registran `observed_sample_count = 0` y se marcan explícitamente con `data_origin = estimated` y `confidence_level = low` en `city_price_comparison.csv`. Esto ocurre principalmente en **`beauty_lounge` y `spa_estetica` dentro de ciudades intermedias** (Bucaramanga, Manizales, Armenia, Ibagué, Villavicencio, Cúcuta, Santa Marta, Neiva y Tunja), donde los estudios de maquillaje nupcial y cabinas de estética corporal cotizan casi exclusivamente por WhatsApp cerrado y aún tienen baja publicación de menús abiertos en marketplaces.

---

## 6. Auditoría frente al Catálogo Maestro v1 (`delta_vs_v1_pct`) y Outliers

Al contrastar los `125` procedimientos originales del Catálogo Maestro v1 (`catalogoMaestroColombia.ts`) contra las tarifas reales 2025–2026:

### 6.1 Principales procedimientos infravalorados en el Catálogo v1 (`delta_vs_v1_pct > +8%`)

| `procedure_id` | Sugerido v1 (COP) | Estándar 2026 (COP) | Delta vs v1 | Causa técnica y comercial verificada |
|---|---:|---:|---:|---|
| `spa-hidrafacial` | `290000` | `340000` | **+17,24%** | El protocolo HydraFacial® original en clínicas (*Laskin* `291.750`, *Yo Soy Soler* `440.000` lista) cuesta mucho más que la hidrodermoabrasión genérica (`133.000–185.000`), confirmando la urgencia de separarlos. |
| `spa-dermapen-microneedling` | `240000` | `280000` | **+16,67%** | Exigencia de habilitación médica/estética, cartucho estéril descartable y viales de ácido hialurónico/exosomas (`250.000–450.000+ COP`). |
| `hair-correccion-color` | `450000` | `520000` | **+15,56%** | Altísimo riesgo técnico y 5–7 horas de silla (*El Mago del Color* inicia en `590.000`; extracción de negro en *Zibá Pereira* `800.000 COP`). El techo v1 (`850k`) también queda corto frente a melenas XL (`1.100k+`). |
| `lounge-maquillaje-piel-blindada` | `185000` | `210000` | **+13,51%** | Uso de fijadores impermeables e insumos *high-end* (en estudios prime de Bogotá alcanza `280.000 COP`). |
| `spa-masaje-relajante-60` | `130000` | `145000` | **+11,54%** | Alza de costos operativos de cabina y lencería en Bogotá y Medellín (`125.000` en spas estándar; `194.000–210.000` en boutique). |
| `hair-balayage-completo` | `380000` | `420000` | **+10,53%** | `$380k` corresponde a tarifa `"Desde"` en cabello corto; el ticket estándar real en melena media con matiz y plex cierra en `420.000 COP`. |
| `lounge-maquillaje-social` | `150000` | `165000` | **+10,00%** | Estudios consolidados de Bogotá, Pereira y Cartagena operan entre `160.000` y `260.000 COP` incluyendo pestañas y preparación de piel. |
| `nail-lifting-pestanas` | `105000` | `115000` | **+9,52%** | Cadenas especializadas (*Glam Spa* `110k`, *Le Visage* `146k`, *Inlash* `165k`) elevaron el estándar con laminación/keratina incluida. |
| `hair-keratina-alisado` | `240000` | `260000` | **+8,33%** | Sustitución de alisados informales con formol por líneas orgánicas/aminoácidos con notificación INVIMA de mayor costo por ml. |

### 6.2 Principales procedimientos sobrevalorados en el Catálogo v1 (`delta_vs_v1_pct < -11%`)

| `procedure_id` | Sugerido v1 (COP) | Estándar 2026 (COP) | Delta vs v1 | Causa técnica y comercial verificada |
|---|---:|---:|---:|---|
| `barber-limpieza-facial-barberia` | `75000` | `58000` | **-22,67%** | En silla de barbería compite como complemento ágil; cobrar `$75k` lo acerca al precio de cabina estética dedicada y frena su conversión. |
| `barber-facial-express-mascarilla` | `45000` | `35000` | **-22,22%** | Observado en `34.900 COP` individual o empaquetado por `+$10k–$15k` dentro de combos VIP en todo el país. |
| `spa-cera-axilas` | `28000` | `22000` | **-21,43%** | Servicio comoditizado de 15 min anclado en `20.000 COP` incluso en estudios reconocidos de Bogotá y Medellín (*Glam Spa*, *Verónica Santillana*). |
| `hair-corte-en-seco-rizos` | `105000` | `85000` | **-19,05%** | Estudios referentes reales cobran `68.000 COP` en Cali (*La Crespería*) y `75.000 COP` en Medellín (*Los Rizos de Fernanda*) por solo corte. |
| `hair-definicion-rizos` | `90000` | `75000` | **-16,67%** | Definiciones individuales oscilan entre `44.000` (express) y `77.000–80.000 COP` (rizo a rizo), reservando tickets de `$140k+` para el combo con corte. |
| `nail-pedicura-semipermanente` | `62000` | `52000` | **-16,13%** | Mediana nacional altamente consistente entre `45.000` y `55.000 COP` en Medellín, Cali, Armenia y Bucaramanga. |
| `nail-pedicura-tradicional` | `38000` | `32000` | **-15,79%** | Fuera de spas de lujo, el mercado nacional opera entre `20.000` y `35.000 COP`. |
| `barber-perfilado-barba` | `28000` | `24000` | **-14,29%** | Ponderación nacional: en 11 de las 15 ciudades el perfilado sin vapor cuesta entre `15.000` y `25.000 COP`. |
| `barber-combo-corte-barba` | `60000` | `52000` | **-13,33%** | Sesgo bogotano en v1: mientras cadenas prime de Bogotá cobran `$75k–$105k`, el estándar nacional multi-ciudad se sitúa en `$40k–$55k`. |
| `barber-corte-fade` | `40000` | `35000` | **-12,50%** | Mediana nacional de 15 observaciones en `30.000–35.000 COP`; `$40k+` corresponde a corredores prime de Bogotá o barberías de autor. |

### 6.3 Outliers verificados en la distribución colombiana
- **Outliers superiores de ultra-lujo hotelero/clínico**: *Elcielo Spa* en Medellín (`400.000 COP` masaje 60 min y `300.000 COP` express 30 min), *Ava Lyen* (`360.000–399.000 COP` ritual Head Spa 120 min), *Secret Glow Makeup* (`1.350.000 COP` paquete Novia Diamond) e *Inlash* (`315.000 COP` pack laminado + lifting). Son precios reales verificados, pero representan el percentil `P95–P99` de experiencia sensorial/marca y no deben distorsionar `recommended_std_cop`.
- **Outliers inferiores de frontera y ganchos promocionales**: pestañas pelo a pelo en Cúcuta (`60.000 COP` en *Nany Eye Lashes*) y repolarización desde `30.000 COP` en Neiva (*Luz de Jade*), explicados por menores costos fijos locales e intensidad informal de precios.

---

## 7. Recomendaciones Directas para la Parametrización de Veli

1. **Onboarding inteligente por ciudad (`city_code`) y segmento (`establishment_segment`)**: al crear una organización en Veli, multiplicar la semilla base o preseleccionar `recommended_econ_cop` / `recommended_std_cop` / `recommended_prem_cop` ajustado por `price_index_vs_bogota` de `city_price_comparison.csv`. Así, una barbería estándar en Tunja o Manizales verá sugerido un corte fade en `28.000–32.000 COP` en lugar de `45.000 COP` de Bogotá.
2. **Eliminación de ambigüedad `"Desde"` en el Cotizador y Vitrina Pública (`/s/[slug]`)**: parametrizar obligatoriamente variantes explícitas de largo/densidad en decoloraciones, alisados y uñas esculpidas para proteger el margen químico del estudio y evitar fricciones en caja.
3. **Separación de paquetes multi-sesión vs sesiones unitarias**: modelar `spa-paquete-moldeo-10-sesiones` y `lounge-paquete-novia-completo` como planes de múltiples citas vinculadas con ingreso diferido/trazable en ledger inmutable, nunca como una sola cita continua en agenda.
