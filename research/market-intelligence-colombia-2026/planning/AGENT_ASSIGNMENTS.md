# Matriz de Asignación de Agentes y Fronteras de Alcance

> **Principio rector:** Ningún agente duplica las búsquedas ni sobrescribe los archivos de otro frente. Todos consumen los identificadores canónicos definidos en [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md), [`../catalog/catalog_audit.csv`](../catalog/catalog_audit.csv) y [`../catalog/missing_procedures.csv`](../catalog/missing_procedures.csv).

---

## 1. Roster de Agentes y Responsabilidades

| Código | Rol Especializado | Fases | Directorio exclusivo de salida | Dependencias de entrada |
|---|---|---|---|---|
| **AGENTE 0** | Coordinador y Arquitecto de Investigación | Fases 1 y 10 | `/planning/`, `/catalog/`, `/final/` | `AGENTS.md`, `lib/catalogos/catalogoMaestroColombia.ts`, `lib/cotizador/*`, `lib/semilla-financiera.ts` |
| **AGENTE 1** | Inteligencia de Precios y Mercado | Fase 2 | `/pricing/` | `catalog_audit.csv`, `missing_procedures.csv`, `DATA_DICTIONARY.md` |
| **AGENTE 2** | Inteligencia Técnica de Procedimientos | Fase 3 | `/technical/` | `catalog_audit.csv`, `missing_procedures.csv`, `procedure_variants.csv` |
| **AGENTE 3** | Productos, Marcas, Proveedores e Insumos | Fase 4 | `/products/` | `catalog_audit.csv`, `missing_procedures.csv`, `DATA_DICTIONARY.md` |
| **AGENTE 4** | Finanzas, Costos y Rentabilidad | Fase 5 | `/financial/` | **Ola 2:** requiere salidas de `AGENTE 1` (`/pricing`), `AGENTE 2` (`/technical`) y `AGENTE 3` (`/products`) |
| **AGENTE 5** | Inteligencia Competitiva y Benchmarking | Fase 6 | `/competition/` | `DATA_DICTIONARY.md` + benchmarks previos en `docs/` |
| **AGENTE 6** | Inteligencia Comercial, Demanda y Tendencias | Fases 7 y 8 | `/commercial/` | `catalog_audit.csv`, `missing_procedures.csv`, `DATA_DICTIONARY.md` |
| **AGENTE 9** | Validación Normativa Colombiana y Riesgos | Fase 9 | `/regulatory/` | `catalog_audit.csv`, `missing_procedures.csv`, `DATA_DICTIONARY.md` |
| **AGENTE 7** | Auditoría de Calidad, Normalización y Esquema | Transversal | `/schema/` + `/final/DATA_QUALITY_REPORT.md` | **Ola 3:** audita la totalidad de CSVs y documentos de los agentes 1, 2, 3, 4, 5, 6 y 9 |

---

## 2. Reglas Anti-Solapamiento entre Frentes

1. **Precios al público vs. Precios de insumos:**
   - `AGENTE 1` investiga exclusivamente **tarifas al cliente final** en salones, barberías, nail bars, spas y estudios de maquillaje en ciudades de Colombia.
   - `AGENTE 3` investiga exclusivamente **precios de compra profesional / mayorista / comercial de insumos, químicos, desechables y equipos** en distribuidores colombianos.
2. **Protocolo técnico vs. Costeo financiero:**
   - `AGENTE 2` determina **tiempos reales (preparación, ejecución, pose, limpieza)** y **cantidades físicas de consumo (`g`, `ml`, `unidades`) por configuración**.
   - `AGENTE 4` **prohíbe inventar gramajes o minutos**: cruza matemáticamente las cantidades de `AGENTE 2` con los costos unitarios de `AGENTE 3` y los precios de mercado de `AGENTE 1`.
3. **Tendencias comerciales vs. Habilitación legal:**
   - `AGENTE 6` evalúa tracción comercial, recurrencia, estacionalidad y potencial de ticket de servicios emergentes.
   - `AGENTE 9` dictamina si ese servicio es **cosmético (habilitable en salón/barbería/spa)**, **estético no invasivo (requiere cosmetólogo certificado y aparatología INVIMA)** o **competencia exclusiva médica (habilitación REPS Res. 3100/2019)**, pudiendo vetar su recomendación para salones estándar.
4. **Autoridad de Rechazo (`AGENTE 7`):**
   - `AGENTE 7` ejecuta validación programática de integridad referencial, unidades, múltiplos COP, rangos lógicos y correspondencia de fuentes, documentando cualquier ajuste o rechazo en `DATA_QUALITY_REPORT.md`.
