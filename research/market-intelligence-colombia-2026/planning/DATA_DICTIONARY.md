# Diccionario de Datos y Estándares de Normalización · Inteligencia de Mercado Veli

> **Uso obligatorio por todos los agentes (`AGENTE 0` .. `AGENTE 9`).**  
> Todos los archivos CSV deben codificarse en **UTF-8**, separados por coma (`,`), encerrando entre comillas dobles (`"..."`) cualquier campo de texto que contenga comas, punto y coma o saltos. Valores nulos se representan con cadena vacía `""`. Montos monetarios siempre en enteros **COP** sin separadores de miles ni símbolo `$` (ej. `380000`), salvo para precios internacionales de software en `competitor_pricing.csv` donde se explicita `currency` (`USD` | `COP`).

---

## 1. Enumeraciones Globales Normalizadas

### 1.1 Verticales (`vertical`)
Alineadas 1:1 con `organizations.vertical` (`lib/flags/verticales.ts`):
- `hair_studio` — Peluquería, colorimetría, alisados, tratamientos y rizos/texturas
- `barber_studio` — Barbería clásica, urbana y de autor
- `nail_bar` — Uñas, manicura/pedicura, cejas y pestañas
- `spa_estetica` — Limpieza facial, masajes, moldeo corporal y depilación
- `beauty_lounge` — Maquillaje social/novias, peinados de evento y paquetes integrales

### 1.2 Ciudades y Departamentos Normalizados (`city` / `department`)
| `city_code` | `city` | `department` | `city_tier` |
|---|---|---|---|
| `BOG` | `Bogotá D.C.` | `Bogotá D.C.` | `principal` |
| `MED` | `Medellín` | `Antioquia` | `principal` |
| `CLO` | `Cali` | `Valle del Cauca` | `principal` |
| `BAQ` | `Barranquilla` | `Atlántico` | `principal` |
| `BGA` | `Bucaramanga` | `Santander` | `intermedia_alta` |
| `CTG` | `Cartagena` | `Bolívar` | `intermedia_alta` |
| `PEI` | `Pereira` | `Risaralda` | `intermedia` |
| `MZL` | `Manizales` | `Caldas` | `intermedia` |
| `AXM` | `Armenia` | `Quindío` | `intermedia` |
| `IBE` | `Ibagué` | `Tolima` | `intermedia` |
| `VVC` | `Villavicencio` | `Meta` | `intermedia` |
| `CUC` | `Cúcuta` | `Norte de Santander` | `intermedia` |
| `SMR` | `Santa Marta` | `Magdalena` | `intermedia` |
| `NVA` | `Neiva` | `Huila` | `intermedia` |
| `TUN` | `Tunja` | `Boyacá` | `intermedia` |

### 1.3 Segmento de Establecimiento (`establishment_segment`)
Clasificación por señales verificables (ubicación/estrato comercial, infraestructura de cabina, marcas de backbar declaradas, presencia digital y política de reserva), **nunca solo por el precio**:
- `economico` — Salón/barbería de barrio tradicional o centro comercial popular, atención por orden de llegada o WhatsApp básico, marcas nacionales económicas.
- `estandar` — Estudio consolidado en zona comercial/residencial media-alta, agenda digital activa (Fresha/Booksy/AgendaPro/propia), marcas profesionales estándar.
- `premium` — Estudio de autor, boutique o clínica estética en corredor prime (Chicó/Usaquén/Chapinero Alto, El Poblado/Laureles, Granada/Pance, Alto Prado, Bocagrande), diagnóstico previo y backbar de gama alta.

### 1.4 Origen del Dato (`data_origin`) y Nivel de Confianza (`confidence_level`)
- **`data_origin`:**
  - `observed` — Dato extraído directamente de fuente pública verificable.
  - `calculated` — Derivado matemáticamente (ej. mediana, $/g, margen de contribución) sobre insumos trazables.
  - `estimated` — Estimación técnica o paramétrica explícita cuando el mercado no publica el desglose exacto.
  - `proposed` — Recomendación curada para Veli (ej. nuevo `procedure_id` o regla de negocio).
  - `pending` — Vacío documentado que requiere trabajo de campo adicional.
- **`confidence_level`:**
  - `high` — Evidencia directa vigente (2025–2026), consistente en múltiples fuentes y asociada inequívocamente al procedimiento/producto.
  - `medium` — Evidencia válida con alguna limitación (muestra pequeña 2–4 obs., rango agregado de directorio o condición parcial).
  - `low` — Evidencia parcial, indirecta o extrapolada entre ciudades comparables.
  - `unverified` — Sin evidencia pública directa suficiente; no apto para automatización sin validación humana.

### 1.5 Unidades de Medida Normalizadas (`unit`)
- Masa: `g` (gramos), `kg` (kilogramos → convertir siempre a `g` en costos unitarios)
- Volumen: `ml` (mililitros), `l` (litros → convertir siempre a `ml` en costos unitarios)
- Conteo / Servicio: `unidad` (pieza individual: lima, par de guantes, cuchilla, lámina, cápsula), `par`, `kit`, `sesion`, `min` (minutos), `dias`
- Moneda: `COP` (enteros), `USD` (solo benchmarking internacional SaaS)

### 1.6 Convención de Identificadores Canónicos
- Procedimientos existentes (125): conservan exactamente su `id` de `lib/catalogos/catalogoMaestroColombia.ts` (`hair-*`, `barber-*`, `nail-*`, `spa-*`, `lounge-*`).
- Procedimientos nuevos propuestos: mismo prefijo por vertical (`hair-*`, `barber-*`, `nail-*`, `spa-*`, `lounge-*`) registrado en `missing_procedures.csv`.
- Variantes: `VAR-{procedure_id}-{variant_code}` (ej. `VAR-hair-balayage-completo-largo-alta`).
- Observaciones de precio: `OBS-CO-{0001..9999}`.
- Productos: `PROD-{CAT}-{001..999}` (ej. `PROD-DEC-001`, `PROD-TIN-001`, `PROD-NAIL-001`).
- Proveedores: `SUP-CO-{001..999}`.
- Fuentes: `SRC-{001..999}`.
- Competidores: `COMP-{slug}` (ej. `COMP-agendapro`, `COMP-mangomint`).

---

## 2. Especificación Lógica de las 21 Tablas (`market_*`)

| # | Tabla lógica | Clave primaria | Relaciones principales (FK) | Propósito en Veli | Archivo(s) físico(s) en esta entrega |
|---:|---|---|---|---|---|
| 1 | `market_categories` | `category_id` | `vertical` | Árbol normalizado de categoría y subcategoría por vertical | `schema/marketIntelligenceSchema.ts` + derivado de `catalog/*` |
| 2 | `market_procedures` | `procedure_id` | `category_id` | Catálogo canónico de mercado (125 auditados + nuevos validados) sin mezclar con `servicios_salon` privados | `catalog/catalog_audit.csv`, `catalog/missing_procedures.csv` |
| 3 | `market_procedure_variants` | `variant_id` | `procedure_id` | Variantes por largo, densidad, diseño, largo de uña o zona corporal | `catalog/procedure_variants.csv` |
| 4 | `market_sources` | `source_id` | — | Registro auditable de URLs, tipo de fuente, cobertura y fecha de consulta | `planning/SOURCE_REGISTRY.md` |
| 5 | `market_establishments` | `establishment_id` | `source_id` | Establecimientos observados con ciudad, departamento y segmento verificable | Integrado en `pricing/price_observations.csv` + `schema` |
| 6 | `market_price_observations` | `observation_id` | `procedure_id`, `source_id` | Tarifas observadas en Colombia con los 18 atributos obligatorios | `pricing/price_observations.csv` |
| 7 | `market_price_benchmarks` | `benchmark_id` | `procedure_id` | P25, mediana, P75, dispersión y rangos sugeridos por segmento | `pricing/price_benchmarks.csv`, `pricing/city_price_comparison.csv` |
| 8 | `market_suppliers` | `supplier_id` | `source_id` | Fabricantes, importadores y distribuidores de belleza en Colombia | `products/supplier_directory.csv` |
| 9 | `market_products` | `product_id` | `supplier_id` | Insumos químicos, cosméticos, esmaltes/geles, ceras y aparatología | `products/product_catalog.csv`, `products/product_substitutes.csv` |
| 10 | `market_product_prices` | `product_price_id` | `product_id`, `supplier_id`, `source_id` | Precios por presentación y costo unitario (`COP/g`, `COP/ml`, `COP/unidad`) | `products/product_prices.csv` |
| 11 | `market_procedure_formulas` | `formula_id` | `procedure_id`, `product_id` | Dosificaciones químicas base y proporciones de mezcla (ej. 1:1, 1:1.5, 1:2) | `technical/procedure_consumption.csv` |
| 12 | `market_procedure_consumables` | `consumable_map_id` | `procedure_id`, `product_id` | Desechables y consumibles por sesión (guantes, aluminio, limas, bajalenguas, sabanilla) | `technical/procedure_consumption.csv` |
| 13 | `market_procedure_durations` | `duration_id` | `procedure_id` | Preparación, ejecución por variante, tiempo de pose y limpieza; silla vs activo | `technical/procedure_durations.csv` |
| 14 | `market_commission_models` | `commission_model_id` | `vertical` | Modelos de pago al especialista (% bruto, % neto químico, fijo, silla, mixto CST) | `financial/commission_benchmarks.csv` |
| 15 | `market_cost_models` | `cost_model_id` | `procedure_id`, `commission_model_id` | Estructura completa de costos variables, indirectos, equilibrio y utilidad/hora | `financial/procedure_cost_models.csv`, `financial/profitability_scenarios.csv` |
| 16 | `market_competitors` | `competitor_id` | `source_id` | Competidores directos, indirectos y referentes globales | `competition/competitor_matrix.csv`, `competition/competitor_pricing.csv` |
| 17 | `market_competitor_features` | `comp_feature_id` | `competitor_id` | Capacidades verificadas módulo por módulo y comisiones ocultas | `competition/competitor_features.csv` |
| 18 | `market_demand_observations` | `demand_obs_id` | `procedure_id`, `source_id` | Frecuencia, recurrencia, estacionalidad y elasticidad al precio | `commercial/demand_observations.csv`, `commercial/service_popularity.csv`, `commercial/seasonality.csv` |
| 19 | `market_trends` | `trend_id` | `vertical`, `source_id` | Procedimientos y modelos emergentes calificados en 10 dimensiones | `commercial/commercial_opportunities.md` |
| 20 | `market_regulatory_requirements` | `reg_req_id` | `procedure_id` | Alcance legal (cosmético, estético, médico), normas MinSalud/INVIMA y riesgos | `regulatory/regulatory_matrix.csv` |
| 21 | `market_validation_issues` | `issue_id` | `target_entity`, `target_id` | Contradicciones detectadas, correcciones de auditoría y vacíos documentados | `final/DATA_QUALITY_REPORT.md` + `catalog/catalog_audit.csv` |
