# Velli Pro

SaaS multi-tenant para estilistas capilares: diagnóstico capilar con IA,
fichero de clientas (CRM), agenda, reportes y PDF de resultados con la marca
del salón. PWA mobile-first.

**Stack:** Next.js 16 (Turbopack) · React 19 · TypeScript · Tailwind 4 ·
Supabase (Auth, Postgres con RLS, Storage) · Bold (suscripciones prepago) ·
Claude Sonnet con fallback GPT-4o (análisis capilar).

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Variables de entorno en
`.env.local` (Supabase URL/keys, Bold, claves de IA — ver route handlers en
`app/api/`).

## Documentación interna

- `AGENTS.md` / `CLAUDE.md` — convenciones para agentes de código.
- `supabase/README.md` — schema, migraciones y cómo regenerar `schema.sql`.
- `PAGOS.md` — modelo de suscripciones prepago con Bold.

## Deploy

Push a `main` despliega a producción vía Vercel (proyecto `velli`). Las
migraciones SQL (`supabase/migration-*.sql`) se aplican a mano en el SQL
Editor de Supabase **antes** del deploy correspondiente.
