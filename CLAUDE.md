@AGENTS.md

## Dirección del producto: Velli Business Intelligence (desde octubre 2026)

Velli es un producto para el DUEÑO del salón: le dice cuánto cobrar y cuánto
gana en cada servicio. La puerta de entrada es el cotizador: el mismo servicio
cuesta lo mismo sin importar quién atienda.

Módulos, en este orden:
1. Cotizador y precios: precio = diagnóstico + plantilla de precios del salón;
   cotización por link de WhatsApp (wa.me, sin API) con la marca Velli; lo
   cobrado se confirma con un toque.
2. Rentabilidad para el dueño: diferencia de cada estilista frente a lo
   cotizado, margen por servicio (precio − producto − comisión), consumo de
   producto y aviso de compra, resumen semanal.
3. Recomendaciones y 4. Pronósticos (2027): no se construyen todavía, pero
   ningún cambio al modelo de datos debe cerrarles el paso (guardar historia,
   no sobrescribir precios ni costos pasados).

Planes (ya existen en Bold; NO cambiar precios, ids, días ni configuración de
Bold): Básico = módulo 1 · Pro = módulos 1 y 2 · Pro+IA = todo lo anterior,
más diagnóstico con IA con tope mensual y cotización sin la marca Velli.

Reglas para cualquier cambio:
- El diagnóstico (IA + base de conocimiento) y la colorimetría son el MOTOR,
  no el producto. El diagnóstico da las variables de precio (largo, densidad,
  estado, % de canas); la colorimetría da el costo (gramos de la fórmula
  final ÷ presentación × precio de compra). Sus reglas no se cambian para
  servir al cotizador: se adapta en la capa del cotizador.
- Congelado = flag apagado en `lib/flags/registro.ts` y oculto en la
  interfaz. NUNCA se borra código, datos, tablas, roles ni políticas RLS.
  Congelados: corte por forma de rostro (`lib/cortes/preagenda.ts` se
  reutilizará para avisos de retoque), app para clientas y marketplace,
  cuentas para cadenas. Fuera del producto: reseñas públicas.
- `rol corporativo` = equipo Velli que administra la librería. No es una
  cuenta para cadenas.
- Agenda: se mantiene para salones sin agenda y como fuente de datos; sin
  desarrollo nuevo.
- Se mantienen: multi-tenant con RLS, onboarding, Sentry, pagos Bold,
  consentimientos y reglas legales, suite de pruebas (todas en verde antes de
  cerrar cualquier tarea: `npm test`, `npm run typecheck`).
- El link público de cotización muestra SOLO servicio, precio y vigencia:
  nada del diagnóstico, ni fotos, ni datos de salud capilar.
- Producción: verificar solo leyendo. Las migraciones se dejan como borrador
  en `supabase/` y las aplica Vanessa a mano.
- Documentos de esta dirección: `docs/velli-bi/`.
