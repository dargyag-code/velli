# Fase 5 · Metodología Financiera, Costeo Unitario Real y Modelo de Rentabilidad Veli

> **Archivos generados en este módulo:**
> - [`commission_benchmarks.csv`](./commission_benchmarks.csv) — **14 esquemas reales de remuneración** en Colombia por vertical (`%` sobre neto químico, `%` sobre bruto, tarifa fija por sesión, alquiler de silla y contrato laboral CST con carga prestacional `~1.52x`).
> - [`procedure_cost_models.csv`](./procedure_cost_models.csv) — **Modelos económicos completos** para los **193 procedimientos canónicos** en escenario estándar más desgloses multi-segmento (`economico`, `estandar`, `premium`) en servicios ancla.
> - [`profitability_scenarios.csv`](./profitability_scenarios.csv) — **12 escenarios mensuales de establecimiento (4 sillas)** evaluando esquemas salariales y shocks de sensibilidad (inflación de insumos `+20%`, descuentos `-20%`, comisión de marketplace `25%`, caída de ocupación a `45%` y rescate de *no-shows*).

---

## 1. Separación Estricta de Niveles de Margen (Regla Anti-Ilusión Financiera)

En más del 80% de salones y barberías independientes en Colombia, los propietarios confunden el flujo de caja diario con utilidad, o calculan erróneamente `precio - costo_tubo`. El motor económico construido separa cuatro escalones contables rigurosos:

$$
\text{Margen Bruto} = P - (C_{\text{materiales}} + C_{\text{desechables}})
$$

$$
\text{Margen de Contribución del Estudio} = P - \underbrace{(C_{\text{materiales}} + C_{\text{desechables}} + C_{\text{pasarela}})}_{C_{\text{variable total}}} - C_{\text{comisión / MO directa}}
$$

$$
\text{Utilidad Operativa Real por Servicio} = \text{Margen de Contribución} - \left( t_{\text{silla}} \times C_{\text{indirecto/min}} \right)
$$

$$
\text{Rentabilidad por Hora Activa} = \frac{\text{Utilidad Operativa Real}}{t_{\text{activo especialista}}} \times 60
$$

Donde:
- $C_{\text{materiales}}$ cruza las cantidades físicas de `technical/procedure_consumption.csv` (incluyendo `5%` de merma en mezclas y ceras) contra los precios unitarios verificados de distribuidores colombianos en `products/product_substitutes.csv` (`COP/g`, `COP/ml`, `COP/unidad`).
- $C_{\text{desechables}}$ incorpora el costo obligatorio de bioseguridad (guantes de nitrilo `$440/par`, láminas de aluminio `$80/ud`, lima/buffer `$2.800/ud`, sabanilla TNT `$840/ud`, cuchilla `$320/ud`, bolsa de esterilización en autoclave `$500/ud`).
- $C_{\text{pasarela}}$ pondera el costo real transaccional en Colombia: `0.50%` en segmento `economico` (efectivo/Nequi P2P), `1.65%` en `estandar` (mix efectivo/transferencia + datáfono/link Bold `~2.99%`) y `2.35%` en `premium` (alta participación de tarjetas de crédito).
- $C_{\text{indirecto/min}}$ asigna los costos fijos mensuales del local (arriendo comercial, energía/acueducto/internet, recepción/aseo, contrato PGIRASA Res. 591/2024, depreciación de mobiliario/equipos y software) divididos entre los minutos productivos realmente ocupados:
  - `hair_studio`: `$175` (`econ`) · `$295` (`std`) · `$520 COP/min` (`prem`)
  - `barber_studio`: `$155` (`econ`) · `$260` (`std`) · `$460 COP/min` (`prem`)
  - `nail_bar`: `$145` (`econ`) · `$240` (`std`) · `$420 COP/min` (`prem`)
  - `spa_estetica`: `$210` (`econ`) · `$350` (`std`) · `$620 COP/min` (`prem`, cabina privada + amortización aparatología INVIMA)
  - `beauty_lounge`: `$170` (`econ`) · `$285` (`std`) · `$490 COP/min` (`prem`)

---

## 2. Precio de Equilibrio y Precio Objetivo Algebraico

Dado que tanto la comisión porcentual ($r_c$) como la comisión bancaria/pasarela ($r_p$) dependen del precio de venta $P$, el **Precio de Equilibrio Operativo** ($\text{Utilidad Operativa} = 0$) no puede hallarse sumando costos planos, sino despejando $P$:

- **Cuando la comisión se liquida sobre Neto Químico (`precio_menos_producto`, estándar Veli):**
  $$
  P_{\text{equilibrio}} = \frac{(C_{\text{mat}} + C_{\text{des}})(1 - r_c) + C_{\text{overhead}}}{1 - r_p - r_c}
  $$
- **Cuando la comisión se liquida sobre Precio Bruto:**
  $$
  P_{\text{equilibrio}} = \frac{C_{\text{mat}} + C_{\text{des}} + C_{\text{overhead}}}{1 - r_p - r_c}
  $$
- Para alcanzar un margen operativo neto objetivo $m^*$ (`22%` neto después de costos fijos, equivalente a `~35%–40%` de margen de contribución del estudio en `lib/cotizador/comision.ts`), el denominador pasa a $(1 - r_p - r_c - m^*)$, redondeado al múltiplo superior de `$1.000 COP`.

---

## 3. Hallazgos Económicos Clave de la Modelación

1. **La hemorragia silenciosa de la Comisión sobre Bruto (`SCEN-02` vs `SCEN-03`):**
   - Un salón estándar de 4 sillas que factura **`$38.000.000 COP/mes`** obtiene **`$8.921.000 COP/mes` (`23.5%`)** de utilidad operativa real liquidando `40%` sobre `precio_menos_producto` con control «Sin Báscula».
   - Ese mismo salón, con la misma facturación de `$38M`, si paga `40%` sobre el precio bruto y sufre `+3.5%` de merma química no controlada, cae a **`$5.543.000 COP/mes` (`14.6%`)**: **pierde `$3.378.000 COP` cada mes (`$40,5 millones COP/año`)**.
2. **Servicios destructores de margen a tarifas de mercado actuales:**
   - Los servicios largos de bajo ticket unitario —como **Manicura tradicional (`45 min`, `$26k–$28k`)**, **Pedicura tradicional (`45 min`, `$32k`)** o **Cepillado/Blower económico (`45 min`, `$26k–$35k`)**— quedan en pérdida operativa o margen `<5%` una vez se imputa el minuto de mesa/silla y la comisión del `45%`. Su rol es de **atracción/frecuencia**, y requieren empaquetarse con semipermanente, hidratación o diseño de cejas para rentabilizar la visita.
3. **Multiplicador de Utilidad al Reducir *No-Shows* (`SCEN-11`):**
   - Bajar la inasistencia del `24%` al `7%` mediante confirmación interactiva por WhatsApp y anticipos en citas largas (`>=120 min`) eleva la utilidad operativa mensual en **`+38,3%` (`+$3.42M COP/mes`)** porque los costos fijos de arriendo y servicios públicos ya están pagados.
