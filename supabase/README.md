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

## Migración pendiente de aplicar: `migration-knowledge-base.sql`

Knowledge base del motor de diagnóstico (tablas `kb_reglas`, `kb_flujos`,
`kb_prompts`, `kb_dimensiones`, `kb_auditoria` + columna
`consultas.perfil_extendido`). Ver `CONOCIMIENTO.md` en la raíz del repo.

- **GENERADA** desde el seed canónico TS: no editar a mano; correr
  `npm run kb:sql` tras cambiar `lib/kb/seed/*.ts`.
- Idempotente: el seed usa `ON CONFLICT DO NOTHING` — re-ejecutarla no pisa
  ediciones hechas por fundadoras desde el panel `/conocimiento`.
- **La app funciona sin aplicarla**: el wizard cae al motor incorporado con
  resultados idénticos (garantizado por `npm test`). Aplicar la migración
  activa el camino por datos.
- Tras aplicar, verificar en Dashboard → Settings → Data API que las tablas
  `kb_*` quedan accesibles (desde abr-2026 las tablas nuevas pueden no
  exponerse automáticamente al Data API).

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

- Fecha: 2026-05-10
- Por: Claude Code via Sprint 1.5
- Método: `supabase db dump --db-url ...` (`link` no disponible por permisos)
- Incluye en `public` (vía dump): tablas `clientas`, `consultas`, `profiles`,
  `citas`; RLS policies en las 4; función `handle_new_user`; función
  `update_updated_at` y triggers `set_updated_at_clientas` /
  `set_updated_at_profiles`; función event-trigger `rls_auto_enable`;
  columna `permite_ubicacion` en `profiles` (Sprint 1).
- Añadido manualmente (apéndice al final del archivo):
  - Trigger `on_auth_user_created` sobre `auth.users`
  - Bucket `fotos` y 4 policies de `storage.objects`
- **No incluido todavía**: event trigger que dispara `rls_auto_enable` (vive
  en schema `pg_catalog`/sistema). No bloquea hoy porque las tablas existentes
  ya tienen RLS; solo afectaría a tablas futuras creadas sin RLS explícito.
