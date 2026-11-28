# Informe de Calidad, Normalización y Validación Cruzada de Datos (`DATA_QUALITY_REPORT`)

> **Auditor responsable:** `AGENTE 7` en coordinación con `AGENTE 0`  
> **Script verificador ejecutable:** [`../schema/validateMarketIntelligence.mjs`](../schema/validateMarketIntelligence.mjs)  
> **Resultado de ejecución:** **`PASSED_ZERO_ERRORS`** sobre **23 archivos CSV** y **2.302 registros estructurados**

---

## 1. Inventario Auditado y Conteo Exacto de Registros

| Módulo | Archivo CSV | Registros | Clave Primaria / Unicidad | Integridad FK y Reglas Validadas |
|---|---|---:|---|---|
| `/catalog` | `catalog_audit.csv` | 125 | `procedure_id` (100% únicos) | 1:1 exacto contra `CATALOGO_MAESTRO_COLOMBIA` |
| `/catalog` | `missing_procedures.csv` | 68 | `procedure_id` (100% únicos) | Amplía el universo canónico a **193 procedimientos** |
| `/catalog` | `procedure_variants.csv` | 29 | `variant_id` (100% únicos) | 100% FK válidos contra los 193 `procedure_id` |
| `/pricing` | `price_observations.csv` | 276 | `observation_id` (100% únicos) | 81 establecimientos reales en 15 ciudades; 18 columnas RFC-4180 |
| `/pricing` | `price_benchmarks.csv` | 193 | `benchmark_id` (100% únicos) | `min <= p25 <= median <= p75 <= max` y `econ < std < prem` en múltiplos de `1000 COP` |
| `/pricing` | `city_price_comparison.csv` | 75 | Compuesta (`city_code` + `vertical`) | 15 ciudades × 5 verticales; suma muestral = 276 |
| `/technical` | `procedure_technical_specs.csv` | 193 | `procedure_id` (100% únicos) | 193 fichas con complejidad, equipos, modo de costeo y contraindicaciones |
| `/technical` | `procedure_durations.csv` | 193 | `duration_id` (100% únicos) | `prep + exec_typical + pose + cleanup === total_chair_min` y `active <= total_chair` |
| `/technical` | `procedure_consumption.csv` | 264 | `consumption_id` (100% únicos) | Fórmulas, oxidantes, materiales estructurales y desechables por configuración |
| `/products` | `supplier_directory.csv` | 24 | `supplier_id` (100% únicos) | Fabricantes, importadores y distribuidores B2B/mayoristas en Colombia |
| `/products` | `product_catalog.csv` | 94 | `product_id` (100% únicos) | 25 categorías técnicas normalizadas |
| `/products` | `product_prices.csv` | 104 | `product_price_id` (100% únicos) | `unit_price_cop === observed_price_cop / content_amount`; canales separados |
| `/products` | `product_substitutes.csv` | 20 | `substitute_group_id` (100% únicos) | 100% FK contra `product_catalog.csv` y `econ < std < prem` |
| `/financial` | `commission_benchmarks.csv` | 14 | `commission_model_id` (100% únicos) | 5 esquemas salariales/comisionales reales en Colombia |
| `/financial` | `procedure_cost_models.csv` | 309 | `cost_model_id` (100% únicos) | `gross_margin >= contribution_margin >= operating_profit`; equilibrio exacto |
| `/financial` | `profitability_scenarios.csv` | 12 | `scenario_id` (100% únicos) | Línea base por segmento + sensibilidad a shocks |
| `/competition` | `competitor_matrix.csv` | 21 | `competitor_id` (100% únicos) | 8 directos CO/LatAm, 4 indirectos y 9 referentes globales |
| `/competition` | `competitor_features.csv` | 21 | `competitor_id` (100% únicos) | Enumeración estricta (`yes_native`, `partial_or_paid_addon`, `no`, `unverified`) |
| `/competition` | `competitor_pricing.csv` | 38 | `pricing_row_id` (100% únicos) | Tarifas verificadas USD/COP, peajes marketplace y WhatsApp |
| `/commercial` | `demand_observations.csv` | 44 | `demand_obs_id` (100% únicos) | Separación explícita estudio oficial vs patrón observado vs hipótesis |
| `/commercial` | `service_popularity.csv` | 75 | `procedure_id` (100% únicos) | Upsell y cross-sell validados contra los 193 IDs canónicos |
| `/commercial` | `seasonality.csv` | 60 | Compuesta (`month_num` + `vertical`) | Suma anual exacta = `12.00` por cada vertical (media = `1.00`) |
| `/regulatory` | `regulatory_matrix.csv` | 50 | `reg_req_id` (100% únicos) | Cobertura 100% de familias + reglas REPS/INVIMA/PGIRASA |
| **TOTAL** | **23 archivos CSV** | **2.302** | **0 duplicados** | **0 errores de validación** |

---

## 2. Matriz de Contradicciones e Inconsistencias Detectadas y Resueltas (`market_validation_issues`)

| ID Issue | Origen | Entidad / Procedimiento | Inconsistencia detectada | Resolución aplicada por `AGENTE 7` + `AGENTE 0` |
|---|---|---|---|---|
| `ISS-001` | Catálogo v1 vs `costo.ts` | `hair-balayage-completo`, `hair-babylights`, `hair-decoloracion-global`, `hair-correccion-color` | `gramos_base_sugeridos` en v1 (`100–140 g`) representaba melena media/larga, pero `FACTORES_CONSUMO_DEFECTO` multiplica `gramosBase` hasta por `3.0x` en XL (`360–420 g` irreales). | En `procedure_consumption.csv` se fijó explícitamente `corto = 60–80 g` y `medio_tipico = 90–110 g`, separando además el matizante (`40–60 g`) del polvo decolorante. |
| `ISS-002` | Catálogo v1 vs `semilla-financiera.ts` | `hair-keratina-alisado`, `hair-aminoacidos-capilares`, `hair-cirugia-capilar` | Declaraban unidad implícita en gramos (`80–90 g`) mientras los alisados líquidos en Colombia se compran por litro (`1.000 ml`) y se dosifican en onzas (`onza_30ml`). | Normalizado a `ml` (`60 ml` corto / `85 ml` medio típico) en `procedure_consumption.csv` y costeado contra `PROD-ALI-*` (`COP/ml`). |
| `ISS-003` | `AGENTE 3` vs `AGENTE 2` | `nail-polygel-set-nuevo` (`PROD-PLG-001`) | En la nota comercial de `product_prices.csv` se estimó inicialmente un gasto empírico alto (`~7.5 g/set`, 4 sets por tubo de `30 g`), mientras la ficha técnica *Organic Nails TechGel* demuestra `1.2–2.5 g/set` (13–24 sets por tubo). | `AGENTE 7` adoptó en `procedure_consumption.csv` y `procedure_cost_models.csv` el consumo técnico validado (`2.2 g` set nuevo / `1.5 g` retoque + `5%` merma), evitando inflar artificialmente el costo del servicio en `+$13.000 COP`. |
| `ISS-004` | Catálogo v1 vs Agenda real | `lounge-paquete-novia-completo` | Tenía `duracion_min = 180` pero el nombre incluye *«Prueba + Día del evento»*, subestimando 150 minutos de trabajo real y segunda ronda de insumos/desechables. | En `procedure_durations.csv` y `procedure_cost_models.csv` se modelaron los **`330 min` reales** (`150 min` prueba + `180 min` boda) y doble dotación cosmética, además de crear `lounge-prueba-maquillaje-peinado-novia` en `missing_procedures.csv`. |
| `ISS-005` | `AGENTE 1` vs Catálogo v1 | `spa-hidrafacial` | Mezclaba hidrodermoabrasión estética multimarca (`$120k–$250k`) con plataforma original *HydraFacial®* (`$340k–$550k`). | Desdoblado mediante `spa-hidrodermoabrasion-estetica` (`$185k` std) dejando `spa-hidrafacial` calibrado para tecnología premium (`$340k` std). |
| `ISS-006` | `AGENTE 6` vs `AGENTE 9` | Tendencias estéticas (`Dermapen`, `Exosomas/PDRN`, `Láser Diodo`, `Postoperatorio`) | Alta tracción comercial en redes y directorios, pero prohibición expresa para salones cosméticos no habilitados en salud (**Ley 711/2001** y **Res. 3100/2019**). | Prevaleció el criterio sanitario de `AGENTE 9`: exosomas/inyectables quedaron excluidos (`exclude_medical_or_fad`) y láser/dermapen/postoperatorio quedaron condicionados a bandera `restrict_require_reps_health_license`. |
| `ISS-007` | `AGENTE 3` vs `AGENTE 9` | Esmaltes semipermanentes, Rubber Base y Geles (`nail_bar`) | Cancelación regulatoria en Colombia (febrero 2026, **Res. INVIMA 2026007526 / Res. CAN 2548/2025**) de productos con fotoiniciadores **TPO** y **DMPT** sin periodo de agotamiento. | Documentado como alerta P0 de cumplimiento de inventario (`REG-CO-021` y `REG-CO-027`) para exigir `NSOC` reformulado HEMA-free/TPO-free. |

---

## 3. Distribución Auditada de Niveles de Confianza

Sobre los **1.190 registros primarios evaluables con `confidence_level`** (observaciones de precios, benchmarks, fichas técnicas, precios de insumos, modelos de costos, competencia, demanda y normativa):
- **`high`:** **969 registros (`81,4%`)** — Evidencia directa verificada en tarifarios públicos 2025–2026, listas de distribuidores colombianos, fichas técnicas de fabricantes o textos legales oficiales.
- **`medium`:** **211 registros (`17,7%`)** — Benchmarks híbridos (`1 <= n <= 4` observaciones directas complementadas con rangos sectoriales) o estimaciones paramétricas consistentes.
- **`low`:** **10 registros (`0,8%`)** (+ 27 celdas ciudad×vertical sin muestra individual directa en `city_price_comparison.csv`) — Servicios nicho cotizados por privado o cruces geográficos intermedios documentados explícitamente para no inducir falsa precisión.
- **`unverified`:** **0 registros aceptados como verdad de mercado** (usado únicamente en celdas puntuales de `competitor_features.csv` donde un competidor menor como *Tulook* no publica documentación verificable de ciertos submódulos).
