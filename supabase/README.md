# Supabase schema y migraciones

## Source of truth: `schema.sql`

Este archivo refleja el estado real de la DB de producción al **2026-05-10**.
Se regeneró con:

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --file supabase/schema.sql
```

> **Nota sobre la CLI**: `supabase link` actualmente falla con error de permisos
> ("Your account does not have the necessary privileges to access this endpoint"),
> por eso usamos `--db-url` directamente. El connection string se saca de
> Supabase Dashboard → Project Settings → Database → Connection string (URI).
> Pendiente: resolver permisos de la cuenta para volver a `--linked`.

## Apéndice manual en `schema.sql`

Al final del archivo hay un bloque manualmente apendado bajo el header:

```
-- MANUALLY APPENDED — cross-schema items not captured by `dump --schema public`
```

Contiene objetos que viven fuera del schema `public` y son requeridos para que
la app funcione en una DB nueva:

- **Trigger `on_auth_user_created`** sobre `auth.users` — dispara
  `public.handle_new_user()` para crear el profile automáticamente en cada
  signup. Sin esto, los signups dejan al usuario sin profile.
- **Bucket privado `fotos`** en `storage.buckets` + sus 4 policies
  (`fotos_upload_own`, `fotos_select_own`, `fotos_update_own`,
  `fotos_delete_own`) sobre `storage.objects`. Los paths esperados son
  `{auth.uid}/...` (ver `lib/storage.ts`).

**Cuando se regenere `schema.sql` vía `db dump`, este bloque debe
conservarse o reconstruirse**, porque `--schema public` no lo captura.
Idealmente, cuando `supabase link` vuelva a funcionar, regenerar con
`--schema 'public,auth,storage'` y revisar si el apéndice manual sigue siendo
necesario.

## Setup de DB nueva (dev local o staging)

1. Crear proyecto Supabase nuevo.
2. SQL Editor → pegar el contenido completo de `schema.sql` (incluyendo el
   apéndice manual) → Run.
3. Verificar que `clientas`, `consultas`, `profiles`, `citas` existen con sus
   RLS policies habilitadas.
4. Verificar que `storage.buckets` tiene el bucket `fotos` y que
   `storage.objects` tiene las 4 policies `fotos_*`.
5. Probar un signup: confirmar que se crea automáticamente la fila en
   `profiles` (lo dispara el trigger `on_auth_user_created`).

**No ejecutes los archivos en `_archive/`** — sus efectos ya están en
`schema.sql` (incluido el apéndice manual).

## Knowledge base: migración APLICADA y archivada (2026-08-04)

`migration-knowledge-base.sql` (tablas `kb_*` + `consultas.perfil_extendido`
+ seed Sprint A/B) y `patch-flujo-liso.sql` (UPSERT del flujo de liso
completado) se aplicaron en prod, se verificó la exposición Data API y RLS,
y ambos se movieron a `_archive/`. Ver `CONOCIMIENTO.md` en la raíz.

- La migración se **GENERA** desde el seed canónico TS: `npm run kb:sql`
  tras cambiar `lib/kb/seed/*.ts` la recrea en `supabase/` (idempotente:
  `ON CONFLICT DO NOTHING` — no pisa ediciones del panel `/conocimiento`).
  Cambios sobre filas ya existentes en prod requieren patch aparte (ver
  `_archive/patch-flujo-liso.sql` como plantilla de UPSERT seguro).
- El contenido de Fase 2 (Sprint B) quedó cargado en estado **borrador**:
  se revisa y publica desde el panel `/conocimiento`.

## Velli BI: migraciones de octubre 2026 y desfases

Las dos están aplicadas en producción desde el 2026-10-22. Siguen en
`supabase/` porque `schema.sql` todavía no las refleja: primero se regenera y
después se archivan.

1. **`migration-proteger-perfil.sql`: APLICADA.** Vanessa lo confirmó el
   2026-10-22: `pg_trigger` muestra `profiles_guard_campos_protegidos`. Queda
   en `supabase/` hasta regenerar `schema.sql`, que todavía no trae el
   trigger; después se archiva. Antes de aplicarla, una cuenta con
   sesión podía cambiar su propio `profiles.rol` a `corporativo` y escribir
   en la librería global. El trigger cierra `rol`, `es_fundadora` y
   `feature_flags` a las sesiones de usuario. Ver R17 en
   `docs/velli-bi/00-auditoria.md`.
2. **`migration-feature-flags.sql`: APLICADA** el 2026-10-22 (verificado por
   lectura: los 6 perfiles tienen `{}`). Agrega `profiles.feature_flags`, los
   overrides de flags por salón de `lib/flags`. El código funciona sin ella:
   usa los valores del entorno. Trae la misma guardia que la anterior, así
   que el orden da igual.

**Migraciones de Etapa 2/3, APLICADAS el 2026-10-23 (en `supabase/` hasta regenerar `schema.sql`):**
3. **`velli-bi-cotizador.sql`: APLICADA** el 2026-10-23 (verificadas por lectura las 7 tablas: `estilistas`, `servicios_salon`, `plantillas_precio`, `productos_salon`, `comisiones`, `cotizaciones` y `cotizacion_eventos`, junto con el override `feature_flags = '{"cotizador": true}'` en el perfil principal).
4. **`velli-bi-uso-ia.sql`: APLICADA** el 2026-10-23 (verificada por lectura la tabla `uso_ia` y la función `ia_analisis_del_mes`).
- `velli-bi-cotizador.sql`: estilistas, servicios, plantillas de precio
  versionadas, productos, comisiones, cotizaciones, su bitácora y el link
  público.
- `velli-bi-uso-ia.sql`: el registro de uso de la IA, necesario para el tope
  de Pro+IA.

El diseño está en `docs/velli-bi/02-diseno-cotizador.md`. Se probaron con las
dos migraciones de arriba en un Postgres en memoria (PGlite), nunca contra
producción: 51 de 51 en verde
(`docs/velli-bi/calculos/probar_borradores.mjs`). Antes de aplicarlos hacen
falta la prueba en papel y, de preferencia, una base de staging. Las variables
del cotizador usan los estándares configurables del 2026-10-22, sin
validación externa.

Desfase conocido. `migration-colorimetria.sql` y `migration-cortes.sql` ya
están aplicadas en producción: el 2026-10-19 verifiqué por lectura que
existen `servicios_color`, `kb_cortes` y `cortes_ejecutados`. Pero
`schema.sql` todavía no las refleja. Hay que regenerarlo con `--db-url`
(conservando el apéndice manual) **antes** de archivarlas. Si se archivan
primero, una base nueva montada desde `schema.sql` quedaría sin esas tablas.

## Capa legal y de gobernanza: migración APLICADA y archivada

`migration-legal-gobernanza.sql` implementa la validación técnica firmada
(roles corporativo/salon, cartas de marca `kb_marcas` + `salon_marcas_activas`,
consentimientos versionados por clienta, pruebas de sensibilidad y el trigger
`citas_guard_legal` de la agenda). Ver `GOBERNANZA.md` en la raíz.

- Es **idempotente**: se puede re-ejecutar sin efectos dobles.
- Reescribe `es_cuenta_fundadora()` para delegar en `es_cuenta_corporativa()`
  — con eso todas las policies `kb_*` existentes pasan a exigir rol
  corporativo sin recrearlas.
- **Al aplicarla**, mover a `_archive/` y regenerar `schema.sql` (conservando
  el apéndice manual, como siempre).
- `public.legal_versiones` es el espejo en DB de `lib/legal.ts`: si subes una
  versión de consentimiento en el código, corre también el `UPDATE`
  correspondiente en esa tabla.

## Aplicar cambios futuros

1. Crear `migration-<nombre>.sql` en este directorio (idempotente con
   `IF NOT EXISTS` y `DROP ... IF EXISTS` donde aplique).
2. Aplicar manualmente en SQL Editor en cada entorno (dev, staging, prod).
3. Después del rollout, regenerar `schema.sql` con el comando `--db-url` de
   arriba.
4. **Restaurar el apéndice manual al final**, o ajustarlo si la migración
   también tocó objetos en `auth` / `storage`.
5. Mover el archivo de migración a `_archive/` con el comentario `ARCHIVED:`
   en la primera línea.

## Estado del archivo (última regeneración)

- Fecha: 2026-08-04
- Por: Vane + Claude Code (Sprint B, knowledge base Fase 2)
- Método: `supabase db dump --db-url ...` (`link` sigue no disponible por
  permisos) + apéndice manual restaurado al final.
- Incluye en `public` (vía dump): tablas `clientas`, `consultas` (con
  `perfil_extendido`), `profiles`, `citas`, `eventos_activacion`,
  `payments`, `subscriptions`, `subscription_notifications` y las 5 de la
  knowledge base (`kb_reglas`, `kb_flujos`, `kb_prompts`, `kb_dimensiones`,
  `kb_auditoria`) con sus RLS policies, `es_cuenta_fundadora()`,
  `kb_touch_version()` y `kb_auditar()`.
- Añadido manualmente (apéndice al final del archivo):
  - Trigger `on_auth_user_created` sobre `auth.users`
  - Bucket `fotos` y 4 policies de `storage.objects`
- **No incluido todavía**: event trigger que dispara `rls_auto_enable` (vive
  en schema `pg_catalog`/sistema). No bloquea hoy porque las tablas existentes
  ya tienen RLS; solo afectaría a tablas futuras creadas sin RLS explícito.
