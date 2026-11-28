# Fase 1 · Auditoría del Catálogo Maestro Actual (125 Procedimientos) y Mapa de Expansión

> **Archivos generados en este módulo:**
> - [`catalog_audit.csv`](./catalog_audit.csv) — Auditoría individual de los **125 procedimientos** de `lib/catalogos/catalogoMaestroColombia.ts` (sin modificar el archivo original).
> - [`missing_procedures.csv`](./missing_procedures.csv) — **68 procedimientos faltantes** con evidencia real en Colombia (llevando el universo de referencia de mercado a **193 procedimientos**).
> - [`procedure_variants.csv`](./procedure_variants.csv) — **29 variantes parametrizadas** por largo/densidad, estructura de uña, complejidad de diseño, sesiones en paquete y nivel de especialista.

---

## 1. Hallazgos Críticos de la Auditoría de los 125 Registros Actuales

### 1.1 Descalibración matemática entre `gramos_base_sugeridos` y el motor multiplicativo (`P0`)
Al cruzar `lib/catalogos/catalogoMaestroColombia.ts` con `lib/cotizador/costo.ts` y `lib/semilla-financiera.ts`, se detectó la contradicción técnica más importante del sistema actual:
- El motor `FACTORES_CONSUMO_DEFECTO` de Veli asume que `gramosTinteBase` representa **cabello corto (`1.0x`)** y lo multiplica por `1.5x` (medio), `2.0x` (largo) y `3.0x` (extra largo).
- Sin embargo, en el catálogo maestro v1 varios procedimientos de alta química registraron el consumo de una **melena media/larga** como si fuera la base:
  - `hair-balayage-completo`: tiene `120 g` (que multiplicado por `3.0x` en extra largo produciría **360 g de polvo + 540 ml de peróxido = 900 g de mezcla**, sobreestimando el costo químico en más del doble). **Corrección propuesta:** `gramos_base_corto = 60 g` de decolorante + fórmula secundaria separada de `40–60 g` de matizante.
  - `hair-babylights` (`100 g` → recalibrar a `60 g` corto), `hair-decoloracion-global` (`130 g` → `75 g` corto) y `hair-correccion-color` (`140 g` → `80 g` corto).
  - `hair-keratina-alisado` (`90 g`), `hair-aminoacidos-capilares` (`90 g`) y `hair-cirugia-capilar` (`80 g`): homologar a **`60 ml` (`onza_30ml`) en base corto** y corregir unidad de masa (`g`) a volumen (`ml`), tal como opera `ALI-ORG-1000` en `lib/semilla-financiera.ts`.

### 1.2 Insumos variables invisibles fuera de `hair_studio` (`P0` / `P1`)
Actualmente `usa_sin_bascula = true` solo está activo en 20 procedimientos capilares/barbería. Esto deja ciegos en costo variable a servicios con consumo significativo en otras verticales:
- **`nail_bar`:** `nail-acrilicas-set-nuevo` (`12–24 ml` monómero + `8–18 g` polímero según largo `#1` a `#5+`), `nail-polygel-set-nuevo` (`6–12 g` polygel), `nail-lifting-pestanas` y `nail-laminado-cejas` (sachets monodosis de pasos 1, 2 y 3).
- **`spa_estetica`:** `spa-cera-*` (`15–120 g` de cera elástica/miel por zona), `spa-dermapen-microneedling` (cartucho estéril de agujas obligatorio por sesión + vial activo).
- **Recomendación:** Incorporar en el modelo de datos el atributo `cost_tracking_mode`: `'sin_bascula_mezcla' | 'estructural_ml_g' | 'monodosis_kit' | 'consumibles_fijos'`.

### 1.3 Procedimientos híbridos que deben separarse (`P0` / `P1`)
1. **`hair-color-fantasia`:** mezcla cobrizos oxidativos (usan peróxido 20V–30V) con tonos fantasía semipermanentes directos (sin peróxido, sobre base decolorada).
2. **`spa-hidrafacial`:** mezcla *Hidrodermoabrasión estética multimarca* (`$120k–$250k`) con *HydraFacial® original* (`$350k–$600k`), distorsionando la dispersión del benchmark.
3. **`spa-drenaje-linfatico-manual`:** mezcla drenaje cosmético de bienestar con drenaje postoperatorio quirúrgico (distinto riesgo sanitario, frecuencia cada 48–72h y exigencia de personal habilitado).
4. **`lounge-paquete-novia-completo`:** declara `180 min` en una sola cita cuando en operación real consta de **dos reservas en fechas separadas** (Prueba `150 min` + Día de la boda `180 min`).

### 1.4 Alertas regulatorias detectadas sobre el catálogo actual (`P0`)
Cinco registros actuales de `spa_estetica` (`spa-dermapen-microneedling`, `spa-peeling-quimico-suave`, `spa-laser-zona-pequena`, `spa-laser-zona-mediana`, `spa-laser-zona-grande`) requieren **bandera normativa explícita** en Veli para distinguir alcance cosmético (Ley 711 de 2001 / Res. 2263 de 2004) frente a procedimientos invasivos o láser médico sujetos a habilitación REPS (Resolución 3100 de 2019).

---

## 2. Cobertura Expandida Propuesta (`125` actuales + `68` faltantes = `193` procedimientos)

| Vertical | Actuales (v1) | Faltantes detectados (`missing_procedures.csv`) | Total universo mercado | Huecos estratégicos cubiertos |
|---|---:|---:|---:|---|
| `hair_studio` | 32 | +18 | **50** | Extensiones (tape-in, queratina/microlink, cortina, subida, retiro), AirTouch, Highlights en aluminio, retoque balayage, trenzas/box braids, corte afro 4A–4C, prueba de mechón y Head Spa japonés. |
| `barber_studio` | 21 | +13 | **34** | Skin fade a shaver, Taper/Burst fade, Mullet/Crop, corte largo masculino, freestyle, combo corte+facial (sin barba), paquete novio, membresía mensual y domicilio VIP. |
| `nail_bar` | 30 | +14 | **44** | Volumen tecnológico (fibras Y/W, top ventas actual), Mega volumen, efecto Wispy, mantenimiento de Rubber/Kapping, Pedicura rusa en seco, Manicura japonesa, tinte híbrido de cejas y combos reales manos+pies. |
| `spa_estetica` | 24 | +13 | **37** | Hidrodermoabrasión separada de HydraFacial, masaje deportivo, masaje prenatal, cavitación, envolturas, drenaje postoperatorio separado, medias piernas/brazos/rostro en cera, hilo facial y paquete reductor x10. |
| `beauty_lounge` | 18 | +10 | **28** | Maquillaje glam noche, quinceañera, grado, prueba de novia separada, trenzas festival, paquete grupo invitadas, acompañamiento *second look* y recargos de domicilio urbano/fuera de ciudad. |
| **Total** | **125** | **+68** | **193** | Cobertura integral 360° del mercado colombiano 2026. |
