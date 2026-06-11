# PAGOS.md — Suscripciones y pagos en Velli Pro

Sistema de suscripciones **prepago** con [Bold](https://bold.co) (Colombia):
PSE, Nequi y tarjetas, vía checkout hospedado (nunca capturamos datos de pago).

## Modelo de negocio

- **Trial de 14 días sin tarjeta** al registrarse, con features de Pro+IA.
- **Prepago por periodo:** cada pago aprobado suma **30 días** desde
  `max(ahora, vencimiento actual)`. Sin cobro automático ni renovación
  recurrente — la estilista paga cuando quiere seguir.
- **Gracia de 3 días** tras vencer (`past_due`): todo sigue funcionando,
  con banner de aviso.
- **Vencida la gracia (`expired`): bloqueo suave.** Puede VER y editar sus
  datos, pero no CREAR clientas/consultas/citas. Enforced a nivel de DB
  (triggers), no solo de UI. Los datos nunca se borran.
- **Planes** (fuente de verdad: `lib/subscription/plans.ts`):

  | Plan   | Precio COP/30d | Límites |
  |--------|---------------|---------|
  | Básico | $25.000       | 50 clientas (enforced en DB) |
  | Pro    | $60.000       | Ilimitado + reportes + Excel + marca |
  | Pro+IA | $120.000      | Pro + IA facial (requiere además `NEXT_PUBLIC_FEATURE_IA_FACIAL=true`) |

  Las constantes 14/30/3 días se espejan en
  `supabase/migration-suscripciones.sql` — cambiar ambos lados a la vez.

## Arquitectura

```
lib/payments/types.ts       Interfaz PaymentProvider (agnóstica)
lib/payments/bold.ts        Implementación Bold (link de pagos + webhook HMAC)
lib/payments/index.ts       Registro de proveedores (env PAYMENT_PROVIDER)
lib/subscription/plans.ts   Planes, precios, feature flags
lib/subscription/estado.ts  RPC suscripcion_efectiva() desde el browser
lib/supabase/admin.ts       Cliente service_role (solo server)

app/api/pagos/checkout      POST: crea payment pending + link Bold → { url }
app/api/pagos/webhook       POST público: verifica firma → RPC procesar_evento_pago
app/api/pagos/estado        GET: estado del pago propio + reconciliación activa

app/planes                  Cards de planes + estado actual + botón pagar
app/planes/confirmacion     Retorno del checkout (polling + reconciliación)
components/subscription/SubscriptionBanner.tsx  Banner en Home

supabase/migration-suscripciones.sql  Tablas, RLS, triggers, RPCs, backfill
```

**Flujo de pago:**

1. La estilista toca "Elegir plan" → `POST /api/pagos/checkout` inserta el
   `payment` (pending, monto desde `plans.ts` — el cliente nunca manda monto)
   y crea el link de Bold → redirect al checkout hospedado.
2. Bold notifica al **webhook** (`SALE_APPROVED` / `SALE_REJECTED` /
   `VOID_APPROVED`) → se verifica la firma HMAC y se llama la RPC
   `procesar_evento_pago` (idempotente: reintentos = no-op).
3. Al volver, `/planes/confirmacion` hace polling de `/api/pagos/estado`,
   que **reconcilia directamente contra Bold** si el webhook aún no llegó
   (misma RPC idempotente: si ambos caminos corren, el segundo no hace nada).
4. Un pago aprobado pone `subscriptions.status = active` y extiende
   `current_period_end` +30 días.

**Seguridad:** tablas de pagos con RLS de solo lectura del propio tenant;
toda escritura pasa por `service_role` en el backend. El webhook valida HMAC
timing-safe antes de tocar la DB. Los triggers de la DB lanzan códigos
estables (`SUSCRIPCION_VENCIDA`, `LIMITE_CLIENTAS_BASICO`) que
`lib/errors.ts` traduce a mensajes amigables.

## Setup

1. **Aplicar la migración** `supabase/migration-suscripciones.sql` en el SQL
   Editor de Supabase (es idempotente). Después regenerar `schema.sql` según
   `supabase/README.md`.
2. **Llaves de Bold:** crear cuenta en [bold.co](https://bold.co) →
   Integraciones → API. Hay par de llaves de **prueba** y de **producción**
   (identidad + secreta). La misma URL base sirve para ambas: el ambiente lo
   determina la llave.
3. **`.env.local`** (y en Vercel para deploy):

   ```bash
   BOLD_API_KEY=...                 # llave de identidad
   BOLD_SECRET_KEY=...              # llave secreta (firma webhooks)
   BOLD_SANDBOX=true                # true con llaves de prueba
   PAYMENT_PROVIDER=bold            # opcional (default bold)
   SUPABASE_SERVICE_ROLE_KEY=...    # Project Settings → API → service_role
   ```

4. **Webhook en Bold:** en el panel de Bold configurar la URL
   `https://<dominio>/api/pagos/webhook`. Para probar en local usar un túnel
   (p. ej. `ngrok http 3000`). Sin webhook el sistema igual funciona vía la
   reconciliación de `/planes/confirmacion`, pero el webhook es el camino
   principal.

## Probar en sandbox

1. `BOLD_SANDBOX=true` con llaves de prueba.
2. Ir a `/planes`, elegir un plan → checkout de prueba de Bold
   (tarjetas de prueba en [developers.bold.co](https://developers.bold.co)).
3. Verificar: fila en `payments` pasa a `approved`, `subscriptions` queda
   `active` con `current_period_end` +30 días, y `/planes` muestra "Activa".
4. Simular vencimiento en SQL Editor:
   ```sql
   UPDATE subscriptions SET current_period_end = now() - interval '5 days'
   WHERE user_id = '<uid>';
   ```
   → crear una clienta debe fallar con `SUSCRIPCION_VENCIDA` y el banner
   debe decir "Tu plan venció".

## Pendiente (fases futuras)

- Notificaciones de renovación (`subscription_notifications`): la tabla y el
  dedupe ya existen; falta el cron que las genere y la campana que las lea.
- Email/WhatsApp de recordatorio (mismo esquema, otro `canal`).
- Facturación electrónica si se requiere (Bold emite comprobante de pago).
