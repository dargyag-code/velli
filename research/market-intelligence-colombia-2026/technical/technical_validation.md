# Fase 3 · Validación Técnica de Procedimientos, Tiempos Reales y Consumos por Configuración

> **Archivos generados en este módulo:**
> - [`procedure_technical_specs.csv`](./procedure_technical_specs.csv) — **193 fichas técnicas estandarizadas** (125 actuales + 68 nuevos).
> - [`procedure_durations.csv`](./procedure_durations.csv) — **193 desgloses de tiempo** separando preparación, ejecución mínima/típica/compleja, tiempo de pose (`processing_pose_min`), limpieza/desinfección (Res. 2827/2006), **ocupación total de silla** y **tiempo activo real del especialista**.
> - [`procedure_consumption.csv`](./procedure_consumption.csv) — **Consumos técnicos multi-configuración** (químicos primarios, oxidantes, matizantes, geles/acrílicos estructurales, kits monodosis, ceras y desechables obligatorios de bioseguridad).

---

## 1. Principio Técnico Central: Ocupación de Silla vs. Tiempo Activo del Especialista

Uno de los errores más costosos en el software tradicional de agendas y nómina es asumir que `duración_cita == tiempo_productivo_exclusivo`. En la operación real auditada:
- En un **Balayage (`240 min` totales en silla)**: `10 min` preparación/diagnóstico + `95 min` montaje de folios + **`45 min` tiempo de pose** + `35 min` lavado/matiz/tratamiento + `45 min` blower/ondas + `10 min` limpieza. Durante los `45 min` de pose controlada (`can_overlap_client_in_pose = true`), un colorista experimentado puede ejecutar un corte (`45 min`) o aplicar un retoque de raíz, reduciendo el **tiempo activo exclusivo a `~195 min`** y elevando la rentabilidad por hora activa en **+23%**.
- En un **Retoque de raíz (`90 min` en silla)**: incluye **`35 min` de pose** (ficha técnica *Schwarzkopf Igora Royal* `30–45 min`), dejando **`55 min` activos** del profesional.
- Por el contrario, en **Extensiones de pestañas Volumen Ruso (`150 min`)**, **Uñas acrílicas (`120 min`)**, **Trenzas Box Braids (`240 min`)** o **Masaje relajante (`60 min`)**, el tiempo de pose aprovechable es **`0 min`** (`can_overlap_client_in_pose = false`): el 100% de la cita bloquea las manos del especialista y exige `10–15 min` adicionales de desinfección de camilla/instrumental entre clientes.

---

## 2. Diferenciación Técnica de Procedimientos Comercialmente Confundidos

| Par / Grupo confundido en el mercado | Diferencia real de protocolo e insumos | Impacto en costo y riesgo |
|---|---|---|
| **Keratina sin formol vs. Aminoácidos vs. Cirugía Capilar vs. Bótox Capilar** | **Keratina / Aminoácidos:** ácidos orgánicos (glioxílico/cisteína/taninos) activados por plancha a `200–230°C` en mechas finas (`180 min`, `60–120 ml`). **Cirugía capilar:** termoactivo suavizante de menor poder alisador (`150 min`). **Bótox capilar:** tratamiento ácido/lipídico rellenador de porosidad **sin modificación permanente de puentes** (`90 min`, calor moderado). | Costo químico de aminoácidos premium (`$17k–$35k`) duplica al bótox (`$8k–$15k`) y exige extracción/ventilación e INVIMA `NSOC` libre de formol. |
| **Balayage vs. Babylights vs. Highlights tradicionales vs. AirTouch** | **Highlights:** aluminio clásico desde raíz (`210 min`). **Babylights:** micro-tejidos ultrafinos con alto número de láminas (`50–80 folios`, `210–240 min`). **Balayage:** barrido/cardado degradado con falso crecimiento (`240 min`). **AirTouch:** separación neumática con secador mecha por mecha (`300+ min`, menor daño pero máxima mano de obra). | AirTouch consume similar químico que Balayage pero **+25% a +40% más horas de especialista**; cobrarlos igual destruye la utilidad por hora. |
| **Color Cobrizo Oxidativo vs. Color Fantasía Semipermanente** | **Cobrizo:** tinte oxidativo permanente + peróxido `20V/30V` (`1:1` o `1:1.5`). **Fantasía directo (azul/rosa/violeta):** pigmento directo ácido **sin peróxido (`1:0`)** que requiere base previamente decolorada a altura `9–10`. | Mezclarlos bajo un solo ítem distorsiona tanto el descuento de inventario de peróxido como la duración real si el cabello llega oscuro. |
| **Manicura Tradicional vs. Manicura Rusa Combinada** | **Tradicional:** ablandamiento húmedo + empujador/corta-cutícula (`45 min`). **Rusa combinada:** apertura y pulido de bolsillo en seco con **brocas de diamante calibradas** (`Staleks`) + tijera/alicate esterilizado en autoclave + esmaltado bajo cutícula (`75 min`). | La rusa exige esterilización estricta en autoclave (Res. 2827/2006), amortización de fresas de diamante y +30 min de especialista capacitada. |
| **Base Rubber vs. Kapping vs. Polygel vs. Acrílico Esculpido** | **Rubber Base (`0.3–0.5 ml`):** nivelación flexible sobre uña corta/media natural. **Kapping (`1.0–1.5 g`):** baño rígido/semirrígido sobre largo natural. **Polygel (`1.2–3.0 g`):** extensión híbrida curada en LED sin olor fuerte. **Acrílico (`4–6 ml` monómero EMA + `2.5–6.5 g` polímero):** estructura de alta resistencia mecánica. | *Nota de validación cruzada:* el rendimiento real técnico de un tubo de Polygel `30g` (*Organic Nails TechGel*) es de **`12 a 24 sets` (`1.2–2.5 g/set`)**, corrigiendo sobreestimaciones empíricas de `7.5 g/set`. |
| **Pestañas Pelo a Pelo Clásicas vs. Volumen Tecnológico vs. Volumen Ruso Artesanal** | **Clásicas (`120 min`):** fibra `0.15 mm` 1:1. **Volumen Tecnológico (`120 min`):** fibras preformadas termo-unidas en `Y` o `W` (rápida colocación y alta retención). **Volumen Ruso (`150–165 min`):** abanicos `3D–5D` armados artesanalmente en vivo con fibra `0.05–0.07 mm`. | El **Volumen Tecnológico** toma el mismo tiempo que Clásicas (`120 min`) pero se vende `+$15k–$30k` más caro, convirtiéndose en el servicio de **mayor margen por hora** en estudios de mirada. |
| **Hidrodermoabrasión Estética vs. HydraFacial® Original** | **Hidrodermoabrasión estética:** equipo multifuncional con registro INVIMA estético y lociones AHA/BHA de cabina (`$12k–$18k` costo insumos). **HydraFacial® MD:** plataforma patentada con puntas *HydroPeel* y viales originales de alto costo (`$95k–$145k` costo insumos). | Justifica plenamente su separación en dos IDs con rangos tarifarios distintos (`$180k` vs `$340k+`). |
| **Drenaje Linfático Cosmético vs. Drenaje Postoperatorio** | **Cosmético:** maniobras suaves tipo Vodder sobre piel íntegra para retención hídrica/piernas cansadas. **Postoperatorio:** atención posquirúrgica (liposucción/abdominoplastia) con riesgo de seroma, dehiscencia y fibrosis. | El postoperatorio exige profesional en salud habilitado (**REPS Res. 3100/2019**, fisioterapia) y bioseguridad reforzada con bolsa roja biosanitaria. |

---

## 3. Calibración de Gramajes y Rendimientos Verificados con Fichas Técnicas

1. **Coloración Permanente (*Schwarzkopf Igora Royal* / *Wella Koleston*):**
   - Proporción oficial `1:1` (`1:2` en superaclarantes).
   - **Retoque de raíz (`<= 3 cm`):** `40–45 g` tinte + `40–45 ml` oxidante.
   - **Color global:** Corto `45 g`, Medio `60 g` (1 tubo estándar), Largo `90 g` (1.5 tubos), Extra largo `120–150 g` (2–2.5 tubos).
2. **Decoloración (*Schwarzkopf BlondMe 9+* / *Wella Blondor*):**
   - Proporción oficial `1:1.5` en folios/balayage y `1:2` en global/crecimiento.
   - **Balayage / Babylights (polvo decolorante):** Corto `50–60 g`, Medio `80–90 g`, Largo `110–120 g`, Extra largo abundante `150–180 g` **+ matizante separado (`40–60 g` proporción `1:1.5`)**.
3. **Alisados / Aminoácidos / Keratinas sin formol:**
   - **Consumo real en mililitros (`ml`):** Corto `50–60 ml` (`~2 oz`), Medio `85–90 ml` (`~3 oz`), Largo `120 ml` (`~4 oz`), Extra largo abundante `150–180 ml` (`5–6 oz`).
4. **Cera Depilatoria (*Starpil* / cera elástica baja fusión):**
   - Cejas/bozo: `8–12 g` · Axilas: `18 g` · Bikini brasileño: `35 g` · Medias piernas: `50 g` · Espalda/pecho: `65 g` · Piernas completas: `100 g` (+ merma operativa `5%` y prohibición absoluta de reciclado de cera o doble inmersión de bajalenguas por Res. 2827/2006).
