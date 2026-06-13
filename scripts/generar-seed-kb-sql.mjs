// ══════════════════════════════════════════════════════════════════════════
// Genera supabase/migration-knowledge-base.sql desde el seed canónico TS.
//
//   npm run kb:sql
//
// Requiere Node >= 23 (type stripping nativo para importar los .ts del
// seed — por eso esos archivos solo usan `import type`). La migración
// resultante es idempotente: DDL con IF NOT EXISTS / DROP IF EXISTS y
// seed con ON CONFLICT DO NOTHING (re-ejecutarla no pisa ediciones hechas
// por fundadoras desde el panel de conocimiento).
// ══════════════════════════════════════════════════════════════════════════

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { REGLAS_RIZADO } = await import(
  new URL('../lib/kb/seed/reglasRizado.ts', import.meta.url)
);
const { DIMENSIONES, FLUJOS, PROMPTS } = await import(
  new URL('../lib/kb/seed/contenido.ts', import.meta.url)
);

// ── Helpers de SQL ──────────────────────────────────────────────────────────

const str = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => (v == null ? 'NULL' : `${str(JSON.stringify(v))}::jsonb`);
const arr = (a) =>
  a == null ? 'NULL' : `ARRAY[${a.map(str).join(', ')}]::text[]`;
const bool = (b) => (b ? 'true' : 'false');

// ── DDL ─────────────────────────────────────────────────────────────────────

const DDL = `-- ============================================================================
-- MIGRACIÓN: Knowledge Base del motor de diagnóstico
-- ============================================================================
-- GENERADO por scripts/generar-seed-kb-sql.mjs — NO editar a mano.
-- Para cambiar el seed: editar lib/kb/seed/*.ts y correr \`npm run kb:sql\`.
--
-- Idempotente: puede ejecutarse varias veces. El seed usa ON CONFLICT DO
-- NOTHING — re-ejecutar NO pisa ediciones hechas desde el panel.
--
-- RLS: lectura de contenido publicado para cualquier cuenta autenticada;
-- lectura completa + escritura SOLO para cuentas con profiles.es_fundadora.
--
-- NOTA (cambio Supabase abr-2026): las tablas nuevas en public pueden no
-- exponerse automáticamente al Data API. Tras aplicar, verificar en
-- Dashboard → Settings → Data API que kb_* quedan accesibles.
-- ============================================================================

-- ── Helper: ¿la cuenta actual es fundadora? ─────────────────────────────────
-- SECURITY INVOKER: dentro de una policy se evalúa con los permisos del
-- usuario; profiles permite SELECT de la fila propia, que es lo único que
-- se necesita.
create or replace function public.es_cuenta_fundadora()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select p.es_fundadora from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.es_cuenta_fundadora() from public;
grant execute on function public.es_cuenta_fundadora() to authenticated;
grant execute on function public.es_cuenta_fundadora() to service_role;

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.kb_reglas (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  locale text not null default 'es',
  segmento text not null check (segmento in (
    'hecho', 'derivacion_medica', 'tratamiento_principal',
    'tratamiento_adicional', 'cronograma', 'tecnica', 'producto_resumen',
    'ingrediente_buscar', 'ingrediente_evitar', 'rutina', 'nota',
    'cuidado_casa', 'intervalo', 'config'
  )),
  prioridad integer not null default 100,
  condiciones jsonb,
  salida jsonb not null,
  es_bandera_medica boolean not null default false,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicada', 'archivada')),
  version integer not null default 1,
  notas_internas text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clave, locale)
);

create table if not exists public.kb_flujos (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  locale text not null default 'es',
  tipos_cabello text[],
  definicion jsonb not null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicada', 'archivada')),
  version integer not null default 1,
  notas_internas text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clave, locale)
);

create table if not exists public.kb_prompts (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  locale text not null default 'es',
  tipos_cabello text[],
  contenido text not null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicada', 'archivada')),
  version integer not null default 1,
  notas_internas text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clave, locale)
);

create table if not exists public.kb_dimensiones (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  locale text not null default 'es',
  etiqueta text not null,
  descripcion text,
  tipo text not null check (tipo in ('opcion', 'multi', 'texto', 'booleano')),
  opciones jsonb,
  bandera_medica boolean not null default false,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicada', 'archivada')),
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clave, locale)
);

create table if not exists public.kb_auditoria (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid not null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  usuario uuid,
  datos_antes jsonb,
  datos_despues jsonb,
  created_at timestamptz not null default now()
);

-- Perfil capilar extensible: dimensiones nuevas (canas, alopecia, zonas…)
-- viven aquí como jsonb — agregar una dimensión NO requiere migración.
alter table public.consultas add column if not exists perfil_extendido jsonb;

-- ── Índices ─────────────────────────────────────────────────────────────────

create index if not exists idx_kb_reglas_lookup
  on public.kb_reglas (locale, estado, segmento, prioridad);
create index if not exists idx_kb_flujos_lookup
  on public.kb_flujos (locale, estado);
create index if not exists idx_kb_prompts_lookup
  on public.kb_prompts (locale, estado);
create index if not exists idx_kb_auditoria_registro
  on public.kb_auditoria (tabla, registro_id, created_at desc);
create index if not exists idx_kb_auditoria_fecha
  on public.kb_auditoria (created_at desc);

-- ── Trigger: versión + updated_at/updated_by en cada UPDATE ────────────────

create or replace function public.kb_touch_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ── Trigger: auditoría (quién cambió qué) ───────────────────────────────────
-- SECURITY DEFINER: kb_auditoria no tiene policy de INSERT — solo este
-- trigger escribe. Las funciones de trigger no son invocables directamente,
-- así que no queda expuesta como endpoint.
create or replace function public.kb_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.kb_auditoria (tabla, registro_id, accion, usuario, datos_antes, datos_despues)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.kb_auditar() from public;
revoke all on function public.kb_touch_version() from public;

drop trigger if exists kb_touch_reglas on public.kb_reglas;
create trigger kb_touch_reglas before update on public.kb_reglas
  for each row execute function public.kb_touch_version();
drop trigger if exists kb_touch_flujos on public.kb_flujos;
create trigger kb_touch_flujos before update on public.kb_flujos
  for each row execute function public.kb_touch_version();
drop trigger if exists kb_touch_prompts on public.kb_prompts;
create trigger kb_touch_prompts before update on public.kb_prompts
  for each row execute function public.kb_touch_version();
drop trigger if exists kb_touch_dimensiones on public.kb_dimensiones;
create trigger kb_touch_dimensiones before update on public.kb_dimensiones
  for each row execute function public.kb_touch_version();

drop trigger if exists kb_audit_reglas on public.kb_reglas;
create trigger kb_audit_reglas after insert or update or delete on public.kb_reglas
  for each row execute function public.kb_auditar();
drop trigger if exists kb_audit_flujos on public.kb_flujos;
create trigger kb_audit_flujos after insert or update or delete on public.kb_flujos
  for each row execute function public.kb_auditar();
drop trigger if exists kb_audit_prompts on public.kb_prompts;
create trigger kb_audit_prompts after insert or update or delete on public.kb_prompts
  for each row execute function public.kb_auditar();
drop trigger if exists kb_audit_dimensiones on public.kb_dimensiones;
create trigger kb_audit_dimensiones after insert or update or delete on public.kb_dimensiones
  for each row execute function public.kb_auditar();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.kb_reglas enable row level security;
alter table public.kb_flujos enable row level security;
alter table public.kb_prompts enable row level security;
alter table public.kb_dimensiones enable row level security;
alter table public.kb_auditoria enable row level security;

-- kb_reglas
drop policy if exists kb_reglas_select_publicadas on public.kb_reglas;
create policy kb_reglas_select_publicadas on public.kb_reglas
  for select to authenticated using (estado = 'publicada');
drop policy if exists kb_reglas_select_fundadora on public.kb_reglas;
create policy kb_reglas_select_fundadora on public.kb_reglas
  for select to authenticated using ((select public.es_cuenta_fundadora()));
drop policy if exists kb_reglas_insert_fundadora on public.kb_reglas;
create policy kb_reglas_insert_fundadora on public.kb_reglas
  for insert to authenticated with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_reglas_update_fundadora on public.kb_reglas;
create policy kb_reglas_update_fundadora on public.kb_reglas
  for update to authenticated
  using ((select public.es_cuenta_fundadora()))
  with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_reglas_delete_fundadora on public.kb_reglas;
create policy kb_reglas_delete_fundadora on public.kb_reglas
  for delete to authenticated using ((select public.es_cuenta_fundadora()));

-- kb_flujos
drop policy if exists kb_flujos_select_publicadas on public.kb_flujos;
create policy kb_flujos_select_publicadas on public.kb_flujos
  for select to authenticated using (estado = 'publicada');
drop policy if exists kb_flujos_select_fundadora on public.kb_flujos;
create policy kb_flujos_select_fundadora on public.kb_flujos
  for select to authenticated using ((select public.es_cuenta_fundadora()));
drop policy if exists kb_flujos_insert_fundadora on public.kb_flujos;
create policy kb_flujos_insert_fundadora on public.kb_flujos
  for insert to authenticated with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_flujos_update_fundadora on public.kb_flujos;
create policy kb_flujos_update_fundadora on public.kb_flujos
  for update to authenticated
  using ((select public.es_cuenta_fundadora()))
  with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_flujos_delete_fundadora on public.kb_flujos;
create policy kb_flujos_delete_fundadora on public.kb_flujos
  for delete to authenticated using ((select public.es_cuenta_fundadora()));

-- kb_prompts
drop policy if exists kb_prompts_select_publicadas on public.kb_prompts;
create policy kb_prompts_select_publicadas on public.kb_prompts
  for select to authenticated using (estado = 'publicada');
drop policy if exists kb_prompts_select_fundadora on public.kb_prompts;
create policy kb_prompts_select_fundadora on public.kb_prompts
  for select to authenticated using ((select public.es_cuenta_fundadora()));
drop policy if exists kb_prompts_insert_fundadora on public.kb_prompts;
create policy kb_prompts_insert_fundadora on public.kb_prompts
  for insert to authenticated with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_prompts_update_fundadora on public.kb_prompts;
create policy kb_prompts_update_fundadora on public.kb_prompts
  for update to authenticated
  using ((select public.es_cuenta_fundadora()))
  with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_prompts_delete_fundadora on public.kb_prompts;
create policy kb_prompts_delete_fundadora on public.kb_prompts
  for delete to authenticated using ((select public.es_cuenta_fundadora()));

-- kb_dimensiones
drop policy if exists kb_dimensiones_select_publicadas on public.kb_dimensiones;
create policy kb_dimensiones_select_publicadas on public.kb_dimensiones
  for select to authenticated using (estado = 'publicada');
drop policy if exists kb_dimensiones_select_fundadora on public.kb_dimensiones;
create policy kb_dimensiones_select_fundadora on public.kb_dimensiones
  for select to authenticated using ((select public.es_cuenta_fundadora()));
drop policy if exists kb_dimensiones_insert_fundadora on public.kb_dimensiones;
create policy kb_dimensiones_insert_fundadora on public.kb_dimensiones
  for insert to authenticated with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_dimensiones_update_fundadora on public.kb_dimensiones;
create policy kb_dimensiones_update_fundadora on public.kb_dimensiones
  for update to authenticated
  using ((select public.es_cuenta_fundadora()))
  with check ((select public.es_cuenta_fundadora()));
drop policy if exists kb_dimensiones_delete_fundadora on public.kb_dimensiones;
create policy kb_dimensiones_delete_fundadora on public.kb_dimensiones
  for delete to authenticated using ((select public.es_cuenta_fundadora()));

-- kb_auditoria: solo lectura para fundadoras; escribe únicamente el trigger
-- (SECURITY DEFINER). Sin policies de INSERT/UPDATE/DELETE.
drop policy if exists kb_auditoria_select_fundadora on public.kb_auditoria;
create policy kb_auditoria_select_fundadora on public.kb_auditoria
  for select to authenticated using ((select public.es_cuenta_fundadora()));

-- ── Grants (RLS limita filas; sin grant no hay acceso vía Data API) ────────

grant select, insert, update, delete on public.kb_reglas to authenticated;
grant select, insert, update, delete on public.kb_flujos to authenticated;
grant select, insert, update, delete on public.kb_prompts to authenticated;
grant select, insert, update, delete on public.kb_dimensiones to authenticated;
grant select on public.kb_auditoria to authenticated;
grant all on public.kb_reglas to service_role;
grant all on public.kb_flujos to service_role;
grant all on public.kb_prompts to service_role;
grant all on public.kb_dimensiones to service_role;
grant all on public.kb_auditoria to service_role;
`;

// ── Seed ────────────────────────────────────────────────────────────────────

function seedReglas() {
  const filas = REGLAS_RIZADO.map((r) => {
    const cols = [
      str(r.clave),
      str(r.locale ?? 'es'),
      str(r.segmento),
      String(r.prioridad),
      jsonb(r.condiciones),
      jsonb(r.salida),
      bool(r.esBanderaMedica ?? false),
      str(r.estado ?? 'publicada'),
    ];
    return `  (${cols.join(', ')})`;
  });
  return `insert into public.kb_reglas
  (clave, locale, segmento, prioridad, condiciones, salida, es_bandera_medica, estado)
values
${filas.join(',\n')}
on conflict (clave, locale) do nothing;`;
}

function seedDimensiones() {
  const filas = DIMENSIONES.map((d) => {
    const cols = [
      str(d.clave),
      str(d.locale ?? 'es'),
      str(d.etiqueta),
      d.descripcion ? str(d.descripcion) : 'NULL',
      str(d.tipo),
      jsonb(d.opciones ?? null),
      bool(d.banderaMedica ?? false),
      str(d.estado ?? 'publicada'),
    ];
    return `  (${cols.join(', ')})`;
  });
  return `insert into public.kb_dimensiones
  (clave, locale, etiqueta, descripcion, tipo, opciones, bandera_medica, estado)
values
${filas.join(',\n')}
on conflict (clave, locale) do nothing;`;
}

function seedFlujos() {
  const filas = FLUJOS.map((f) => {
    const cols = [
      str(f.clave),
      str(f.locale ?? 'es'),
      arr(f.tiposCabello),
      jsonb(f.definicion),
      str(f.estado ?? 'borrador'),
    ];
    return `  (${cols.join(', ')})`;
  });
  return `insert into public.kb_flujos
  (clave, locale, tipos_cabello, definicion, estado)
values
${filas.join(',\n')}
on conflict (clave, locale) do nothing;`;
}

function seedPrompts() {
  const filas = PROMPTS.map((p) => {
    const cols = [
      str(p.clave),
      str(p.locale ?? 'es'),
      arr(p.tiposCabello ?? null),
      str(p.contenido),
      str(p.estado ?? 'publicada'),
    ];
    return `  (${cols.join(', ')})`;
  });
  return `insert into public.kb_prompts
  (clave, locale, tipos_cabello, contenido, estado)
values
${filas.join(',\n')}
on conflict (clave, locale) do nothing;`;
}

const sql = [
  DDL,
  '-- ============================================================================',
  `-- SEED — ${REGLAS_RIZADO.length} reglas de rizos, ${DIMENSIONES.length} dimensiones, ${FLUJOS.length} flujo(s), ${PROMPTS.length} prompts`,
  '-- ============================================================================',
  '',
  seedReglas(),
  '',
  seedDimensiones(),
  '',
  seedFlujos(),
  '',
  seedPrompts(),
  '',
].join('\n');

const destino = path.join(raiz, 'supabase', 'migration-knowledge-base.sql');
writeFileSync(destino, sql, 'utf8');
console.log(
  `OK → ${destino}\n  reglas: ${REGLAS_RIZADO.length} · dimensiones: ${DIMENSIONES.length} · flujos: ${FLUJOS.length} · prompts: ${PROMPTS.length}`
);
