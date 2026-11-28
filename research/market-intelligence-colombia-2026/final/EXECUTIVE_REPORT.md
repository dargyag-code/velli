# Informe Ejecutivo Consolidado · Inteligencia de Mercado Colombia 2026 para Veli

> **Coordinación:** `AGENTE 0` (Market Intelligence Lead & Research Coordinator)  
> **Base empírica:** **23 archivos CSV auditados (`2.302` registros normalizados, `0` errores de integridad)** construidos por 8 frentes especializados sobre **193 procedimientos canónicos**, **15 ciudades colombianas**, **81 establecimientos reales**, **94 insumos/productos profesionales**, **24 proveedores**, **21 competidores tecnológicos** y **22 normas sanitarias vigentes a 2026**.

---

## Respuestas Basadas en Evidencia a las 18 Preguntas Estratégicas

### 1. ¿Cuál es el tamaño y la estructura observable del mercado de servicios de belleza investigado en Colombia?
- **Escala macroeconómica verificada (ANDI / DANE / Inexmoda-Raddar):** La industria cosmética y de aseo en Colombia alcanzó **USD 6.861 millones** al cierre de 2025 (`1,61%` del PIB nacional), de los cuales **USD 3.565 millones (`+8,6%` anual)** corresponden a **Belleza y Cuidado Personal**, con un gasto per cápita de **$530.000 COP/año** y un segmento masculino en rápida expansión (**USD 393 millones**, `+11%–12%` anual).
- **Estructura empresarial hiper-atomizada (DANE EMICRON CIIU 9602):** Existen más de **261.000 unidades productivas** de peluquería y belleza en el país (moviendo solo en Bogotá `~$500.000 millones COP/año`). El **`~94%` son micronegocios**, más del `80%` son liderados por mujeres y operan con baja formalización financiera: cobran a ojo, pagan comisiones sobre el ingreso bruto y carecen de control de consumo por gramo o costo por minuto de silla.

### 2. ¿Cuáles son los servicios más frecuentes por vertical?
Según la densidad de oferta publicada y frecuencia en plataformas (`pricing/price_observations.csv` y `commercial/service_popularity.csv`):
- **`hair_studio`:** Cepillado/Blower (`hair-cepillado-blower`), Corte personalizado (`hair-corte-personalizado`), Retoque de raíz (`hair-retoque-raiz`), Tinte global (`hair-tinte-global`) y Balayage (`hair-balayage-completo`).
- **`barber_studio`:** Corte Fade/Degradado (`barber-corte-fade`), Combo Corte + Barba (`barber-combo-corte-barba`), Perfilado de barba (`barber-perfilado-barba`) y Perfilado de cejas (`barber-perfilado-cejas`).
- **`nail_bar`:** Manicura semipermanente (`nail-manicura-semipermanente`), Combo Manicura semi + Pedicura tradicional (`nail-combo-semi-manos-tradicional-pies`), Nivelación Base Rubber (`nail-nivelacion-rubber-base`), Uñas acrílicas/polygel y Diseño de cejas con hilo/cera.
- **`spa_estetica`:** Limpieza facial profunda (`spa-limpieza-facial-profunda`), Masaje relajante 60 min (`spa-masaje-relajante-60`), Depilación con cera (bikini/axilas/piernas) y Drenaje linfático / Maderoterapia.
- **`beauty_lounge`:** Maquillaje social (`lounge-maquillaje-social`), Paquete Maquillaje + Peinado/Ondas (`lounge-combo-maquillaje-peinado-social`) y Ondas glam/al agua (`lounge-ondas-glam-agua`).

### 3. ¿Cuáles tienen mayor recurrencia?
- **Alta frecuencia (cada `7–15 días`, `24–36 visitas/año`):** Masajes reductores/maderoterapia/drenaje en plan corporal (`7 días`), Manicura tradicional (`10–12 días`), Limpieza de contornos barbería (`10 días`), Cepillado/Blower (`14 días`), Corte Fade y Perfilado de barba (`14–15 días`).
- **Frecuencia media-alta (`18–25 días`, `15–20 visitas/año`):** Manicura semipermanente (`18 días`), Retoque de uñas acrílicas/polygel/rubber (`21 días`), Retoque de extensiones de pestañas (`21 días`), Diseño de cejas (`21 días`) y Depilación con cera (`21–25 días`).
- **Baja frecuencia / alto ticket (`90–150 días`, `2.5–4 visitas/año`):** Keratina/Aminoácidos (`90–105 días`), Balayage (`120 días`) y AirTouch (`150 días`) — exigen **servicios puente mensuales** (`hair-tonalizacion-post-decoloracion` e hidratación a los `30 días`) para no perder contacto con el cliente.

### 4. ¿Cuáles tienen los precios más altos?
En referencia estándar consolidada (`pricing/price_benchmarks.csv`):
1. `lounge-paquete-novia-completo` (**`$1.050.000 COP`** estándar · hasta `$1.600.000+` premium)
2. `spa-paquete-moldeo-10-sesiones` (**`$1.020.000 COP`** estándar · hasta `$1.550.000` premium)
3. `hair-airtouch` (**`$550.000 COP`** estándar · hasta `$880.000–$950.000` premium)
4. `lounge-acompanamiento-evento-touchup` (**`$550.000 COP`** estándar · hasta `$862.000+` premium)
5. `hair-correccion-color` (**`$520.000 COP`** estándar · hasta `$860.000–$1.100.000` premium)
6. `lounge-maquillaje-novia` (**`$460.000 COP`** estándar · hasta `$750.000` premium)
7. `hair-balayage-completo` (**`$420.000 COP`** estándar · hasta `$680.000–$940.000` premium)
8. `hair-decoloracion-global` (**`$410.000 COP`** estándar · hasta `$740.000` premium)

### 5. ¿Cuáles tienen mayor dispersión de precios?
Medidos por rango intercuartílico (`IQR = P75 - P25` en `price_benchmarks.csv`):
- **Paquetes multi-sesión y nupciales:** `spa-paquete-moldeo-10-sesiones` (`IQR $682.500`) y `lounge-paquete-novia-completo` (`IQR $610.000`).
- **Colorimetría correctiva y decoloración compleja:** `hair-correccion-color` (`IQR $395.000`, rango `$280k–$860k`), `hair-airtouch` (`IQR $344.000`), `hair-highlights-mechas-tradicionales` (`IQR $330.750`) y `hair-decoloracion-global` (`IQR $303.000`).
- **Aparatología facial cuando se mezclan tecnologías:** `spa-hidrafacial` mostraba dispersión extrema (`$180k–$520k`) precisamente porque el mercado mezcla *hidrodermoabrasión genérica* con *HydraFacial® original*.

### 6. ¿Qué diferencias existen entre ciudades?
Tomando **Bogotá D.C. = `1.00`** (`pricing/city_price_comparison.csv`):
- **Ciudades con prima turística o nupcial (> `1.00x`):** **Cartagena** supera a Bogotá en `beauty_lounge` (**`1.08x`**, epicentro del `40%–44%` de bodas destino del país y exigencia de maquillaje blindado por humedad) y en peluquería prime (`1.02x`). **Medellín** lidera ligeramente en `spa_estetica` (**`1.02x`**, hoteles boutique y wellness en El Poblado), aunque en `barber_studio` baja a **`0.84x`** por altísima competencia de oferta.
- **Grandes capitales competitivas (`0.82x – 0.94x`):** **Cali** (`0.85x–0.90x`, muy fuerte en rizos/afro y postoperatorio) y **Barranquilla** (`0.86x–0.94x`, fuerte gasto en blower/alisados y maquillaje social).
- **Intermedias dinámicas (`0.78x – 0.86x`):** **Pereira** y **Bucaramanga**.
- **Intermedias de menor tarifa en mano de obra (`0.62x – 0.72x`):** **Tunja** (`0.62x` en barbería), **Neiva** (`0.64x–0.68x`) y **Cúcuta** (`0.67x–0.69x`), donde el costo del insumo importado pesa proporcionalmente mucho más sobre el ticket final.

### 7. ¿Qué servicios están infravalorados o sobrevalorados frente a referencias comparables?
- **Infravalorados en el mercado (y/o en el catálogo v1):**
  - En el catálogo v1 estaban subestimados `spa-hidrafacial` (`+17,2%`), `spa-dermapen-microneedling` (`+16,7%`), `hair-correccion-color` (`+15,6%`), `lounge-maquillaje-piel-blindada` (`+13,5%`) y `hair-balayage-completo` (`+10,5%` frente al ticket real de melena media).
  - En el **mercado real colombiano** están crónicamente infravalorados frente a su costo de tiempo y materiales: **Trenzas Box Braids con kanekalon incluido** (`$210k` por `4 horas` → margen operativo **`-11,1%`**), **Manicura express / tradicional** (`$20k–$28k` ocupando `30–45 min` + autoclave + lima individual) y **Retiros aislados de semipermanente/acrílico** (`$18k–$30k`, margen negativo de `-1%` a `-2,5%`).
- **Sobrevalorados en el catálogo v1 frente a la mediana nacional real:** `barber-limpieza-facial-barberia` (`-22,7%`), `barber-facial-express-mascarilla` (`-22,2%`), `spa-cera-axilas` (`-21,4%`, comoditizado a `$20k–$22k`), `hair-corte-en-seco-rizos` (`-19,1%`, mediana real `$85k`) y `barber-corte-fade` (`-12,5%`, mediana nacional `$35k`).

### 8. ¿Qué procedimientos presentan mayor potencial de rentabilidad?
Evaluados por **Utilidad Operativa Real por Hora Activa del Especialista** (`financial/procedure_cost_models.csv`, descontando materiales, desechables, pasarela, comisión Y costo fijo por minuto de silla):
- **Con habilitación/aparatología especializada (`spa_estetica`):** `spa-hidrafacial` (`$165.328 COP/h`, `48,6%`), `spa-laser-zona-pequena` (`$163.328 COP/h`, requiere REPS) y `spa-masaje-parejas` (`$143.688 COP/h`).
- **Sin inversión médica pesada (accesibles a estudios independientes):**
  - `beauty_lounge`: **Maquillaje de novia** (`$140.885 COP/h`, `45,9%`) y **Paquete Social Maquillaje + Ondas** (`~$58k–$75k COP/h`).
  - `hair_studio`: **Ritual Head Spa Japonés** (`~$98k COP/h`), **Reparación molecular Plex/K18** (`~$82k COP/h` en `60 min`) y **Balayage bien cotizado por largo con solapamiento en pose** (`~$48k–$65k COP/h activa`).
  - `nail_bar`: **Laminado de cejas + tinte híbrido** (`~$62k COP/h`), **Lifting de pestañas** (`~$51k COP/h`) y **Pestañas Volumen Tecnológico (fibras Y/W)** (`~$39k COP/h`, superando al volumen ruso artesanal por tardar 30 min menos).
  - `barber_studio`: **Camuflaje de canas en cabello/barba** (`~$48k COP/h` en `30 min`) y **Experiencia Signature Corte + Ritual + Facial**.

### 9. ¿Qué productos representan los costos más importantes?
1. **Alisados orgánicos / aminoácidos (`$95` a `$390 COP/ml`):** `85–165 ml` representan `$24.000` a `$64.350 COP` en un solo servicio.
2. **Polvo decolorante + Matizante + Reparador Plex en rubios (`$260–$320/g` polvo + `$440–$640/g` matiz + `$720–$3.200/ml` Plex):** entre **`$48.000` y `$115.000 COP`** según longitud y densidad.
3. **Viales estériles/sueros de aparatología facial y kits monodosis de lifting/laminado (`$10.500` a `$60.000 COP/sesión`).**
4. **Desechables silenciosos en servicios de bajo ticket:** una lima/buffer individual (`$2.800`), guantes (`$440`) y bolsa de autoclave (`$500`) suman **`$3.740 COP`**, lo que absorbe el **`15%`** del ingreso bruto de una manicura de `$25.000 COP`.

### 10. ¿Qué servicios consumen más tiempo?
- **Ocupación total de silla/agenda:** Paquete Novia Completo en 2 citas (`330 min` reales), AirTouch (`300 min`), Corrección de color (`270–360 min`), Balayage / Decoloración global / Trenzas Box Braids (`240 min`), Babylights / Mechas tradicionales (`210 min`) y Keratina/Aminoácidos/Instalación de extensiones punto a punto (`180 min`).
- **Trampa de tiempo continuo (0 min solapables):** Trenzas Box Braids (`240 min`), Pestañas Mega Volumen (`165 min`) y Volumen Ruso (`150 min`) bloquean al 100% al especialista sin ventana de pose.

### 11. ¿Qué servicios permiten vender complementos (Upsell / Cross-Sell)?
- **En Silla Capilar:** *Retoque de raíz / Tinte* → `+ Reparación Plex` o `+ Repolarización` (`+30%` margen sin casi sumar tiempo de lavado); *Corte* → `+ Detox cuero cabelludo`.
- **En Barbería:** *Corte Fade* → `+ Perfilado de cejas` (`+15 min`, `+$15k`, margen altísimo) o `+ Camuflaje de canas` (`+30 min`).
- **En Nail Bar:** *Manicura semipermanente* → `+ Nivelación Rubber Base` (`+$20k` por `+15 min` y `$1.700` de producto) o `+ Diseño de cejas con hilo`.
- **En Spa/Estética:** *Limpieza facial profunda* → `+ Dermaplaning` o `+ Terapia LED`; *Masaje 60 min* → upgrade a `90 min` (`+$50k` con costo marginal de aceite `< $2.000 COP`).

### 12. ¿Qué oportunidades comerciales están desatendidas?
1. **Ocupación de días valle (`lunes a miércoles`, `30%–45%` vs `85%+` viernes-sábado):** membresías de corte/blower restringidas a `lun–jue` y paquetes corporales programados en mañanas valle.
2. **Rescate automatizado de inasistencias (`20%–40%` de *no-show*):** recordatorio interactivo por WhatsApp + anticipo local (`25%–30%` vía Nequi/PSE/Bold solo en citas `>=120 min`).
3. **Venta de mantenimiento en casa (Retail `<5%` en Colombia vs `15%–20%` potencial):** conectar automáticamente en `/s/[slug]` y post-servicio el shampoo sin sal post-keratina, el matizante post-balayage o el lash shampoo post-pestañas.
4. **Público masculino/unisex en `spa_estetica` y `nail_bar`:** masaje de descarga deportiva (auge de running/ciclismo en Bogotá/Medellín) y manicura/pedicura sin esmalte con copy neutro en género.

### 13. ¿Qué funcionalidades ofrecen los competidores?
Auditados **21 competidores** (`competition/competitor_features.csv` y `competitor_pricing.csv`):
- **Marketplaces (Fresha, Booksy):** reserva online fuerte, pero **Fresha eliminó su plan gratuito** (`$19.95 USD` o `$14.95 USD/prof` + **`20%`** por cliente nuevo) y **Booksy** cobra **`$29.99 + $20 USD/prof`** + **`30%`** en *Booksy Boost* (generando pérdida operativa real de `-$31.400 COP` en el primer Balayage).
- **SaaS LatAm (AgendaPro, Bewe, Kumbio):** agenda, POS y comisiones planas, pero **AgendaPro** cobra aparte bloques de WhatsApp (**`$200 COP/mensaje`**, `66x` el costo mayorista de Meta) y suma **`1%–2% + IVA` extra** sobre la pasarela de pagos.
- **Líderes globales (Mangomint `$120+$10/u USD`, Boulevard `$159–$410 USD`, GlossGenius `$24–$148 USD`, SQUIRE `$30–$250 USD`):** excelente UX de calendario y checkout, pero inaccesibles en precio USD, dependientes de SMS/Card-on-File de EE.UU. y sin pesaje nativo (dependen de básculas externas *Vish / SalonScale* de `$49–$199 USD/mes`).

### 14. ¿Dónde puede diferenciarse Veli?
En una **Brecha Mundial Triple (`0/21` competidores la tienen)**:
1. **Cotizador variable en silla + Dosificación física «Sin Báscula»** (`cazos 30g / tubos 60g / onzas 30ml`) + comprobante transparente `/c/[token]` sin comprar hardware Bluetooth.
2. **Motor de rentabilidad real y liquidación justa (`precio_menos_producto` + costo por minuto de silla)** que le ahorra a un salón estándar **`~$3,38 millones COP/mes` (`$40,5M/año`)** frente al esquema tradicional sobre bruto (`SCEN-02` vs `SCEN-03`).
3. **Vitrina propia anti-marketplace (`/s/[slug]`, `0%` comisión por cliente nuevo) + WhatsApp nativo + pagos locales colombianos + guardarraíles sanitarios locales (INVIMA/MinSalud).**

### 15. ¿Qué datos son suficientemente confiables para alimentar recomendaciones hoy?
- **Listos para producción (`confidence_level = high`, `81,4%` de los registros):** los 125+68 procedimientos en ciudades principales (`BOG`, `MED`, `CLO`, `BAQ`, `BGA`, `CTG`, `PEI`), los costos unitarios de distribuidores profesionales (`COP/g`, `COP/ml`, `COP/unidad`), los rendimientos técnicos de fabricantes (*Schwarzkopf, Wella, Organic Nails, Starpil*), el calendario estacional nacional y la matriz regulatoria de Colombia 2026.

### 16. ¿Qué datos necesitan más investigación?
- Tarifas desagregadas de `spa_estetica` y `beauty_lounge` en ciudades intermedias pequeñas (`Neiva, Tunja, Cúcuta, Ibagué, Villavicencio`), precios informales en efectivo de estratos 2–3 y descuentos privados por volumen negociados offline con visitadores médicos/cosméticos.

### 17. ¿Qué categorías o procedimientos deberían agregarse al catálogo?
Incorporar de forma priorizada los **68 procedimientos documentados en `catalog/missing_procedures.csv`**, encabezados por:
- **Categoría completa de Extensiones Capilares** (instalación tape-in, punto a punto queratina/microlink, cortina cosida, mantenimiento/subida y retiro).
- **Colorimetría y Bienestar Capilar:** `hair-airtouch`, `hair-highlights-mechas-tradicionales`, `hair-retoque-balayage-mantenimiento`, `hair-tonalizacion-post-decoloracion`, `hair-diagnostico-prueba-mechon`, `hair-head-spa-japones`, `hair-trenzas-africanas-box-braids` y `hair-corte-cabello-afro`.
- **Uñas y Mirada de alta rotación:** `nail-pestanas-volumen-tecnologico` (fibras Y/W), `nail-mantenimiento-soft-gel-rubber`, `nail-pedicura-rusa-combinada`, `nail-tinte-hibrido-cejas` y `nail-combo-semi-manos-tradicional-pies`.
- **Barbería, Estética y Eventos:** `barber-skin-fade-navaja`, `barber-combo-corte-facial`, `spa-hidrodermoabrasion-estetica` (separada de HydraFacial), `spa-masaje-deportivo-descarga`, `lounge-prueba-maquillaje-peinado-novia` y recargos explícitos de domicilio.

### 18. ¿Qué información debería convertirse en inteligencia automática dentro de Veli?
1. **Alerta preventiva de precio bajo equilibrio** cuando el salón configure una tarifa o descuento donde `operating_profit_cop <= 0` (ej. trenzas con insumo incluido o manicura express subvalorada).
2. **Calibración automática de recargos por largo/densidad/estructura** sugiriendo el precio mínimo de protección de margen en silla.
3. **Semáforo regulatorio en catálogo e inventario** (alerta REPS `Res. 3100/2019` en procedimientos invasivos/láser y bloqueo de insumos con formol o con fotoiniciadores **TPO/DMPT** prohibidos en 2026).
4. **Disparador inteligente de recompra por WhatsApp** basado en `return_frequency_days` + campañas previas a picos de `seasonality.csv`.

---

## Matriz Final de Priorización Ejecutiva (`P0` – `P3`)

| Nivel | Frente de Acción en Veli | Impacto Económico / Estratégico |
|---|---|---|
| **`P0`** | 1) Recalibrar `gramosBase` corto (`1.0x`) + separar matizante y pasar alisados a `ml`.<br>2) Pre-calibrar tarifas de onboarding según **Ciudad × Vertical × Segmento** (`price_benchmarks.csv`).<br>3) Activar guardarraíles regulatorios críticos (REPS en láser/dermapen/postop; bloqueo formol y TPO/DMPT). | Evita errores de sobrecosteo `2x–3x` en tallas XL, acelera activación en toda Colombia y blinda legalmente a los salones ante Secretarías de Salud. |
| **`P1`** | 1) Extender costeo variable (`estructural_ml_g` y `monodosis_kit`) a uñas, pestañas y cera.<br>2) Incorporar `cost_per_chair_min_cop` y métrica de **Utilidad Operativa por Hora Activa** en `/reportes`.<br>3) Comparador vivo **Comisión Bruta vs. Neto Químico** (`+$3.38M COP/mes` recuperables en salón de 4 sillas). | Convierte a Veli en el único CFO de bolsillo para negocios de belleza en Latinoamérica. |
| **`P2`** | 1) Expandir catálogo seleccionable con los **68 nuevos procedimientos y 29 variantes**.<br>2) Sugerencias automáticas de *Add-ons / Upsell* en `/s/[slug]` (`service_popularity.csv`).<br>3) Automatización de campañas WhatsApp por ciclo de retorno y calendario estacional colombiano. | Incrementa ticket promedio (`+15%–25%`) y ocupación de lunes a miércoles sin pagar peajes de marketplace (`20%–30%`). |
| **`P3`** | 1) Levantamiento de campo en segmento económico informal y ciudades intermedias con muestra baja.<br>2) Actualización trimestral automatizada de `market_*` e índices anonimizados opt-in. | Construye una ventaja de datos propietaria imposible de replicar en Colombia y escalable a México, Chile y Perú. |
