-- ============================================================================
-- MIGRACIÓN: Knowledge Base del motor de diagnóstico
-- ============================================================================
-- GENERADO por scripts/generar-seed-kb-sql.mjs — NO editar a mano.
-- Para cambiar el seed: editar lib/kb/seed/*.ts y correr `npm run kb:sql`.
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

-- ============================================================================
-- SEED — 142 reglas de rizos, 5 dimensiones, 1 flujo(s), 6 prompts
-- ============================================================================

insert into public.kb_reglas
  (clave, locale, segmento, prioridad, condiciones, salida, es_bandera_medica, estado)
values
  ('hecho.balance_hp.proteina', 'es', 'hecho', 10, '{"hecho":"elasticidad","op":"eq","valor":"baja"}'::jsonb, '{"hecho":"balanceHP","valor":"proteina"}'::jsonb, false, 'publicada'),
  ('hecho.balance_hp.hidratacion_por_porosidad', 'es', 'hecho', 11, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"hecho":"balanceHP","valor":"hidratacion"}'::jsonb, false, 'publicada'),
  ('hecho.balance_hp.nutricion_por_porosidad', 'es', 'hecho', 12, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"hecho":"balanceHP","valor":"nutricion"}'::jsonb, false, 'publicada'),
  ('hecho.balance_hp.default', 'es', 'hecho', 13, NULL, '{"hecho":"balanceHP","valor":"hidratacion"}'::jsonb, false, 'publicada'),
  ('hecho.transicion', 'es', 'hecho', 20, '{"hecho":"tipoDano","op":"incluye","valor":"En transición capilar (dos texturas visibles)"}'::jsonb, '{"hecho":"transicion","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.dano_quimico', 'es', 'hecho', 21, '{"hecho":"tipoDano","op":"incluye","valor":"Daño químico (decoloración, alisado)"}'::jsonb, '{"hecho":"danoQuimico","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.dano_termico', 'es', 'hecho', 22, '{"hecho":"tipoDano","op":"incluye","valor":"Daño térmico (textura alterada por calor)"}'::jsonb, '{"hecho":"danoTermico","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.build_up', 'es', 'hecho', 23, '{"hecho":"estadoCueroCabelludo","op":"incluyeAlguno","valor":["Build-up (acumulación de producto)","Graso (exceso de sebo)"]}'::jsonb, '{"hecho":"buildUp","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.puntas_severas', 'es', 'hecho', 24, '{"hecho":"estadoPuntas","op":"eq","valor":"Puntas abiertas severas (necesita corte)"}'::jsonb, '{"hecho":"puntasSeveras","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.dano_severo', 'es', 'hecho', 25, '{"alguna":[{"hecho":"puntasSeveras","op":"verdadero"},{"todas":[{"hecho":"danoQuimico","op":"verdadero"},{"hecho":"elasticidad","op":"eq","valor":"baja"}]}]}'::jsonb, '{"hecho":"danoSevero","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.trat_reconstructor', 'es', 'hecho', 26, '{"alguna":[{"hecho":"balanceHP","op":"eq","valor":"proteina"},{"hecho":"elasticidad","op":"eq","valor":"baja"},{"hecho":"danoQuimico","op":"verdadero"},{"hecho":"danoTermico","op":"verdadero"}]}'::jsonb, '{"hecho":"tratReconstructor","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.tiene_caspa', 'es', 'hecho', 27, '{"hecho":"estadoCueroCabelludo","op":"incluyeAlguno","valor":["Caspa seca","Dermatitis seborreica"]}'::jsonb, '{"hecho":"tieneCaspa","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.tiene_caida', 'es', 'hecho', 28, '{"hecho":"problemas","op":"incluye","valor":"Caída excesiva"}'::jsonb, '{"hecho":"tieneCaida","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.tiene_frizz', 'es', 'hecho', 29, '{"hecho":"problemas","op":"regex","valor":"frizz"}'::jsonb, '{"hecho":"tieneFrizz","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.cuero_graso', 'es', 'hecho', 30, '{"hecho":"estadoCueroCabelludo","op":"incluyeAlguno","valor":["Graso (exceso de sebo)","Build-up (acumulación de producto)"]}'::jsonb, '{"hecho":"cueroGraso","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.cuero_seco', 'es', 'hecho', 31, '{"hecho":"estadoCueroCabelludo","op":"regex","valor":"seco|caspa"}'::jsonb, '{"hecho":"cueroSeco","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.es_liso', 'es', 'hecho', 32, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["1A","1B","1C"]}'::jsonb, '{"hecho":"esLiso","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.es_ondulado', 'es', 'hecho', 33, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["2A","2B","2C"]}'::jsonb, '{"hecho":"esOndulado","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.es_rizado', 'es', 'hecho', 34, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["3A","3B","3C"]}'::jsonb, '{"hecho":"esRizado","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.es_afro', 'es', 'hecho', 35, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["4A","4B","4C"]}'::jsonb, '{"hecho":"esAfro","valor":true}'::jsonb, false, 'publicada'),
  ('hecho.hay_dano', 'es', 'hecho', 36, '{"alguna":[{"hecho":"tipoDano","op":"noVacio"},{"hecho":"balanceHP","op":"eq","valor":"proteina"}]}'::jsonb, '{"hecho":"hayDano","valor":true}'::jsonb, false, 'publicada'),
  ('derivacion.alopecia', 'es', 'derivacion_medica', 10, '{"hecho":"ext.senalesAlopecia","op":"incluyeAlguno","valor":["placas_sin_cabello","perdida_difusa_severa","retroceso_linea_frontal"]}'::jsonb, '{"motivo":"Señales clínicas compatibles con alopecia.","recomendaciones":["Derivar a dermatología para diagnóstico (tricoscopia / exámenes).","No aplicar tratamientos químicos ni térmicos hasta tener valoración médica.","Documentar con fotos la zona afectada para el seguimiento."]}'::jsonb, true, 'publicada'),
  ('derivacion.dermatitis_severa', 'es', 'derivacion_medica', 11, '{"hecho":"ext.tipoCueroCabelludo","op":"en","valor":["dermatitis_severa","psoriasis_sospecha","lesiones_abiertas"]}'::jsonb, '{"motivo":"Cuero cabelludo con señales de dermatitis severa o lesiones.","recomendaciones":["Derivar a dermatología antes de cualquier servicio de salón.","Evitar productos con fragancia, alcohol o químicos agresivos en la zona."]}'::jsonb, true, 'publicada'),
  ('tratamiento.reconstruccion', 'es', 'tratamiento_principal', 10, '{"alguna":[{"hecho":"balanceHP","op":"eq","valor":"proteina"},{"hecho":"elasticidad","op":"eq","valor":"baja"}]}'::jsonb, '{"texto":"Reconstrucción"}'::jsonb, false, 'publicada'),
  ('tratamiento.hidratacion_profunda', 'es', 'tratamiento_principal', 20, '{"todas":[{"hecho":"balanceHP","op":"eq","valor":"hidratacion"},{"hecho":"porosidad","op":"neq","valor":"alta"}]}'::jsonb, '{"texto":"Hidratación profunda"}'::jsonb, false, 'publicada'),
  ('tratamiento.hidratacion_nutricion', 'es', 'tratamiento_principal', 30, '{"todas":[{"hecho":"balanceHP","op":"eq","valor":"hidratacion"},{"hecho":"porosidad","op":"eq","valor":"alta"}]}'::jsonb, '{"texto":"Hidratación + Nutrición (sellado)"}'::jsonb, false, 'publicada'),
  ('tratamiento.nutricion', 'es', 'tratamiento_principal', 40, '{"hecho":"balanceHP","op":"eq","valor":"nutricion"}'::jsonb, '{"texto":"Nutrición"}'::jsonb, false, 'publicada'),
  ('tratamiento.mantenimiento', 'es', 'tratamiento_principal', 50, '{"hecho":"balanceHP","op":"eq","valor":"equilibrado"}'::jsonb, '{"texto":"Mantenimiento"}'::jsonb, false, 'publicada'),
  ('tratamiento.default', 'es', 'tratamiento_principal', 60, NULL, '{"texto":"Hidratación + Mantenimiento"}'::jsonb, false, 'publicada'),
  ('adicional.repolarizacion', 'es', 'tratamiento_adicional', 10, '{"alguna":[{"hecho":"danoQuimico","op":"verdadero"},{"hecho":"danoTermico","op":"verdadero"}]}'::jsonb, '{"texto":"Repolarización capilar"}'::jsonb, false, 'publicada'),
  ('adicional.detox', 'es', 'tratamiento_adicional', 20, '{"hecho":"buildUp","op":"verdadero"}'::jsonb, '{"texto":"Detox / Clarificación (paso previo al tratamiento)"}'::jsonb, false, 'publicada'),
  ('adicional.transicion', 'es', 'tratamiento_adicional', 30, '{"hecho":"transicion","op":"verdadero"}'::jsonb, '{"texto":"Tratamiento diferenciado zona natural / zona procesada"}'::jsonb, false, 'publicada'),
  ('cronograma.reconstruccion_severa', 'es', 'cronograma', 10, '{"todas":[{"hecho":"tratamientoPrincipal","op":"eq","valor":"Reconstrucción"},{"hecho":"danoSevero","op":"verdadero"}]}'::jsonb, '{"semana1":"Reconstrucción","semana2":"Hidratación","semana3":"Nutrición","semana4":"Reconstrucción"}'::jsonb, false, 'publicada'),
  ('cronograma.reconstruccion', 'es', 'cronograma', 20, '{"hecho":"tratamientoPrincipal","op":"eq","valor":"Reconstrucción"}'::jsonb, '{"semana1":"Reconstrucción","semana2":"Hidratación","semana3":"Nutrición","semana4":"Hidratación"}'::jsonb, false, 'publicada'),
  ('cronograma.hidratacion_profunda', 'es', 'cronograma', 30, '{"hecho":"tratamientoPrincipal","op":"eq","valor":"Hidratación profunda"}'::jsonb, '{"semana1":"Hidratación","semana2":"Hidratación","semana3":"Nutrición","semana4":"Hidratación"}'::jsonb, false, 'publicada'),
  ('cronograma.hidratacion_nutricion', 'es', 'cronograma', 40, '{"hecho":"tratamientoPrincipal","op":"eq","valor":"Hidratación + Nutrición (sellado)"}'::jsonb, '{"semana1":"Hidratación","semana2":"Nutrición","semana3":"Hidratación","semana4":"Nutrición"}'::jsonb, false, 'publicada'),
  ('cronograma.nutricion', 'es', 'cronograma', 50, '{"hecho":"tratamientoPrincipal","op":"eq","valor":"Nutrición"}'::jsonb, '{"semana1":"Nutrición","semana2":"Hidratación","semana3":"Nutrición","semana4":"Hidratación"}'::jsonb, false, 'publicada'),
  ('cronograma.default', 'es', 'cronograma', 60, NULL, '{"semana1":"Hidratación","semana2":"Nutrición","semana3":"Hidratación","semana4":"Nutrición"}'::jsonb, false, 'publicada'),
  ('tecnica.liso_1c', 'es', 'tecnica', 10, '{"hecho":"tipoRizoPrincipal","op":"eq","valor":"1C"}'::jsonb, '{"tecnicaDefinicion":"Secado natural","tecnicaDescripcion":"Lava con shampoo suave y acondicionador. Aplica leave-in en cabello húmedo y peina de puntas a raíz con peine de dientes anchos. Haz scrunch suave en las puntas para potenciar la ondulación sutil. Deja secar sin tocar para evitar frizz. Si usas calor, aplica protector térmico antes.","metodoSecado":"Secado natural o difusor en frío","gelRecomendado":""}'::jsonb, false, 'publicada'),
  ('tecnica.liso_1a_1b', 'es', 'tecnica', 20, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["1A","1B"]}'::jsonb, '{"tecnicaDefinicion":"Secado natural","tecnicaDescripcion":"Lava con shampoo suave y acondicionador hidratante. Aplica leave-in en cabello húmedo y peina con peine de dientes anchos. Deja secar sin tocar para máximo brillo y sin frizz. Evita frotar con la toalla — usa microinfibra o camiseta de algodón.","metodoSecado":"Secado natural o difusor en frío","gelRecomendado":""}'::jsonb, false, 'publicada'),
  ('tecnica.ondulado_2a_2b', 'es', 'tecnica', 30, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["2A","2B"]}'::jsonb, '{"tecnicaDefinicion":"Scrunch","tecnicaDescripcion":"Aplica crema de peinar en el cabello húmedo. Distribuye con rake (peine de dientes anchos) de puntas a raíz. Luego haz scrunch (aprieta el cabello de abajo hacia arriba) para reforzar las ondas. Deja secar sin tocar.","metodoSecado":"Difusor en calor bajo o secado al aire libre","gelRecomendado":"Gel definidor liviano"}'::jsonb, false, 'publicada'),
  ('tecnica.ondulado_2c_3a', 'es', 'tecnica', 40, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["2C","3A"]}'::jsonb, '{"tecnicaDefinicion":"Rake & Shake + Scrunch","tecnicaDescripcion":"Aplica crema de peinar sección por sección. Pasa el peine de dientes anchos (rake) de medios a puntas para separar rizos. Agita las puntas suavemente (shake) para activar el patrón. Finaliza con scrunch para compactar el gel.","metodoSecado":"Difusor en calor medio","gelRecomendado":"Gel definidor o crema de peinar"}'::jsonb, false, 'publicada'),
  ('tecnica.rizado_3b_3c_fino', 'es', 'tecnica', 50, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"en","valor":["3B","3C"]},{"hecho":"grosor","op":"eq","valor":"fino"}]}'::jsonb, '{"tecnicaDefinicion":"Shingling suave","tecnicaDescripcion":"Divide el cabello en secciones pequeñas. Aplica crema de peinar rizo por rizo, deslizando los dedos desde la raíz hasta las puntas. Evita productos muy pesados que aplanen el volumen.","metodoSecado":"Difusor en calor bajo","gelRecomendado":"Crema de peinar + gel definidor"}'::jsonb, false, 'publicada'),
  ('tecnica.rizado_3b_3c', 'es', 'tecnica', 60, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["3B","3C"]}'::jsonb, '{"tecnicaDefinicion":"Praying Hands + Scrunch","tecnicaDescripcion":"Frota la crema de peinar entre las palmas y aplica deslizando ambas manos hacia abajo por cada sección (como si rezaras con el cabello dentro). Luego haz scrunch para compactar el rizo. Aplica gel encima con scrunch final.","metodoSecado":"Difusor en calor bajo-medio","gelRecomendado":"Crema de peinar + gel definidor"}'::jsonb, false, 'publicada'),
  ('tecnica.afro_4a', 'es', 'tecnica', 70, '{"hecho":"tipoRizoPrincipal","op":"eq","valor":"4A"}'::jsonb, '{"tecnicaDefinicion":"Shingling","tecnicaDescripcion":"Divide el cabello en secciones pequeñas. Aplica gel cremoso afro rizo por rizo, deslizando los dedos desde raíz hasta punta para definir cada espiral. Trabaja con el cabello muy húmedo para mejor agarre.","metodoSecado":"Difusor en calor bajo o secado al aire libre","gelRecomendado":"Gel cremoso afro + crema de peinar"}'::jsonb, false, 'publicada'),
  ('tecnica.afro_4b_densidad_alta', 'es', 'tecnica', 80, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"eq","valor":"4B"},{"hecho":"densidad","op":"eq","valor":"alta"}]}'::jsonb, '{"tecnicaDefinicion":"Twist Out","tecnicaDescripcion":"Divide en secciones. Aplica gel cremoso y forma twist (trenzas de 2 hilos) en cada sección. Deja secar completamente antes de soltar. Para día 2-3: twist-out para revivir la definición.","metodoSecado":"Secado al aire libre preferible (el calor puede dañar la estructura)","gelRecomendado":"Gel cremoso afro"}'::jsonb, false, 'publicada'),
  ('tecnica.afro_4b', 'es', 'tecnica', 81, '{"hecho":"tipoRizoPrincipal","op":"eq","valor":"4B"}'::jsonb, '{"tecnicaDefinicion":"Finger Coils o Shingling","tecnicaDescripcion":"Divide en secciones. Aplica gel cremoso y forma twist (trenzas de 2 hilos) en cada sección. Deja secar completamente antes de soltar. Para día 2-3: twist-out para revivir la definición.","metodoSecado":"Secado al aire libre preferible (el calor puede dañar la estructura)","gelRecomendado":"Gel cremoso afro"}'::jsonb, false, 'publicada'),
  ('tecnica.afro_4c_densidad_alta', 'es', 'tecnica', 82, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"eq","valor":"4C"},{"hecho":"densidad","op":"eq","valor":"alta"}]}'::jsonb, '{"tecnicaDefinicion":"Twist Out","tecnicaDescripcion":"Divide en secciones muy pequeñas. Envuelve cada sección alrededor de tu dedo con gel cremoso para crear una espiral. Deja secar sin tocar. Es laborioso pero da la máxima definición al tipo 4C.","metodoSecado":"Secado al aire libre preferible (el calor puede dañar la estructura)","gelRecomendado":"Gel cremoso afro"}'::jsonb, false, 'publicada'),
  ('tecnica.afro_4c', 'es', 'tecnica', 83, '{"hecho":"tipoRizoPrincipal","op":"eq","valor":"4C"}'::jsonb, '{"tecnicaDefinicion":"Finger Coils o Shingling","tecnicaDescripcion":"Divide en secciones muy pequeñas. Envuelve cada sección alrededor de tu dedo con gel cremoso para crear una espiral. Deja secar sin tocar. Es laborioso pero da la máxima definición al tipo 4C.","metodoSecado":"Secado al aire libre preferible (el calor puede dañar la estructura)","gelRecomendado":"Gel cremoso afro"}'::jsonb, false, 'publicada'),
  ('tecnica.default', 'es', 'tecnica', 90, NULL, '{"tecnicaDefinicion":"Rake & Shake + Scrunch","tecnicaDescripcion":"Aplica crema de peinar sección por sección con peine de dientes anchos. Agita puntas y compacta con scrunch.","metodoSecado":"Difusor en calor bajo o aire libre","gelRecomendado":"Gel definidor"}'::jsonb, false, 'publicada'),
  ('producto.mascarilla_reconstructora', 'es', 'producto_resumen', 10, '{"hecho":"tratReconstructor","op":"verdadero"}'::jsonb, '{"textos":["Mascarilla reconstructora con queratina hidrolizada (base del cronograma)"]}'::jsonb, false, 'publicada'),
  ('producto.mascarilla_alternada', 'es', 'producto_resumen', 11, '{"hecho":"tratReconstructor","op":"falso"}'::jsonb, '{"textos":["Mascarilla hidratante / nutritiva alternada según cronograma"]}'::jsonb, false, 'publicada'),
  ('producto.liso', 'es', 'producto_resumen', 20, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["1A","1B","1C"]}'::jsonb, '{"textos":["Leave-in ligero (aplicar de medios a puntas, evitar raíz)"]}'::jsonb, false, 'publicada'),
  ('producto.liso_porosidad_alta', 'es', 'producto_resumen', 21, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"en","valor":["1A","1B","1C"]},{"hecho":"porosidad","op":"eq","valor":"alta"}]}'::jsonb, '{"textos":["Aceite ligero (jojoba o almendras) en puntas para sellar"]}'::jsonb, false, 'publicada'),
  ('producto.ondulado_3a', 'es', 'producto_resumen', 30, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["2A","2B","2C","3A"]}'::jsonb, '{"textos":["Crema de peinar de textura media (sin sulfatos ni parabenos)","Gel definidor ligero con proteínas de trigo o seda (sin alcohol)"]}'::jsonb, false, 'publicada'),
  ('producto.ondulado_3a_porosidad_alta', 'es', 'producto_resumen', 31, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"en","valor":["2A","2B","2C","3A"]},{"hecho":"porosidad","op":"eq","valor":"alta"}]}'::jsonb, '{"textos":["Aceite medio (argán o jojoba) como sellador final"]}'::jsonb, false, 'publicada'),
  ('producto.rizado_3b_3c', 'es', 'producto_resumen', 40, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["3B","3C"]}'::jsonb, '{"textos":["Crema de peinar nutritiva e hidratante con humectantes (glicerina, aloe vera)","Gel definidor con proteínas vegetales, sin alcohol secante"]}'::jsonb, false, 'publicada'),
  ('producto.rizado_3b_3c_porosidad_alta', 'es', 'producto_resumen', 41, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"en","valor":["3B","3C"]},{"hecho":"porosidad","op":"eq","valor":"alta"}]}'::jsonb, '{"textos":["Aceite sellador (argán, jojoba o coco según porosidad)"]}'::jsonb, false, 'publicada'),
  ('producto.afro_default', 'es', 'producto_resumen', 50, '{"hecho":"tipoRizoPrincipal","op":"noEn","valor":["1A","1B","1C","2A","2B","2C","3A","3B","3C"]}'::jsonb, '{"textos":["Gel cremoso denso para máxima definición (con humectantes y proteínas vegetales)","Crema de peinar de alta densidad con mantecas (karité, cacao)","Aceite sellador pesado (ricino, coco u oliva) — método LOC/LCO obligatorio"]}'::jsonb, false, 'publicada'),
  ('evitar.base', 'es', 'ingrediente_evitar', 10, NULL, '{"textos":["Sulfatos agresivos (SLS, SLES)","Parabenos fuertes","Alcoholes secantes (alcohol denat., isopropílico)","Siliconas no solubles en agua"]}'::jsonb, false, 'publicada'),
  ('evitar.liso', 'es', 'ingrediente_evitar', 20, '{"hecho":"esLiso","op":"verdadero"}'::jsonb, '{"textos":["Mantecas densas en raíz (apelmazan el cabello liso)","Cremas de peinar muy pesadas"]}'::jsonb, false, 'publicada'),
  ('evitar.ondulado', 'es', 'ingrediente_evitar', 21, '{"hecho":"esOndulado","op":"verdadero"}'::jsonb, '{"textos":["Productos muy densos que aplasten la onda"]}'::jsonb, false, 'publicada'),
  ('evitar.porosidad_alta', 'es', 'ingrediente_evitar', 30, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"textos":["Humectantes puros en climas húmedos (provocan frizz)","Calor directo sin protector térmico"]}'::jsonb, false, 'publicada'),
  ('evitar.porosidad_baja', 'es', 'ingrediente_evitar', 31, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"textos":["Proteínas en exceso (rigidez y quiebre)","Aceites pesados (coco, ricino) — no penetran, se acumulan"]}'::jsonb, false, 'publicada'),
  ('evitar.embarazo', 'es', 'ingrediente_evitar', 40, '{"hecho":"embarazo","op":"verdadero"}'::jsonb, '{"textos":["Formol y derivados (alisados progresivos, keratina con formol)","Fragancias sintéticas intensas"]}'::jsonb, false, 'publicada'),
  ('buscar.liso', 'es', 'ingrediente_buscar', 10, '{"hecho":"esLiso","op":"verdadero"}'::jsonb, '{"textos":["Humectantes ligeros (glicerina, aloe vera, panthenol)","Aceites ligeros (jojoba, almendras) en poca cantidad, solo puntas","Mascarillas hidratantes ligeras"]}'::jsonb, false, 'publicada'),
  ('buscar.ondulado', 'es', 'ingrediente_buscar', 11, '{"hecho":"esOndulado","op":"verdadero"}'::jsonb, '{"textos":["Cremas de peinar de textura media","Humectantes (glicerina, aloe vera, miel)","Geles definidores ligeros (activan la onda sin cast pesado)"]}'::jsonb, false, 'publicada'),
  ('buscar.rizado', 'es', 'ingrediente_buscar', 12, '{"hecho":"esRizado","op":"verdadero"}'::jsonb, '{"textos":["Cremas de peinar nutritivas e hidratantes","Geles definidores con proteínas de trigo o seda","Aceites medios (argán, jojoba)","Mantecas medias (cacao, mango)"]}'::jsonb, false, 'publicada'),
  ('buscar.afro', 'es', 'ingrediente_buscar', 13, '{"hecho":"esAfro","op":"verdadero"}'::jsonb, '{"textos":["Cremas de peinar densas y nutritivas","Mantecas densas (karité, cacao, mango)","Aceites pesados (ricino, coco, oliva) para sellado","Geles cremosos para máxima definición","Mascarillas con proteínas vegetales (trigo, soja)","Método LOC o LCO (leave-in + aceite + crema)"]}'::jsonb, false, 'publicada'),
  ('buscar.porosidad_alta', 'es', 'ingrediente_buscar', 20, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"textos":["Ingredientes selladores (mantecas y aceites pesados)","Productos con pH ácido (ayudan a cerrar la cutícula)"]}'::jsonb, false, 'publicada'),
  ('buscar.porosidad_baja', 'es', 'ingrediente_buscar', 21, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"textos":["Productos ligeros a base de agua"]}'::jsonb, false, 'publicada'),
  ('buscar.dano', 'es', 'ingrediente_buscar', 30, '{"hecho":"hayDano","op":"verdadero"}'::jsonb, '{"textos":["Proteínas hidrolizadas (queratina, seda, trigo)","Tratamientos reconstructores con aminoácidos"]}'::jsonb, false, 'publicada'),
  ('buscar.frizz', 'es', 'ingrediente_buscar', 40, '{"hecho":"tieneFrizz","op":"verdadero"}'::jsonb, '{"textos":["Combinación de humectantes + selladores (método LOC/LCO)"]}'::jsonb, false, 'publicada'),
  ('buscar.cuero_graso', 'es', 'ingrediente_buscar', 50, '{"hecho":"cueroGraso","op":"verdadero"}'::jsonb, '{"textos":["Champús con árbol de té, menta o salvia (equilibran el sebo)"]}'::jsonb, false, 'publicada'),
  ('buscar.cuero_seco', 'es', 'ingrediente_buscar', 51, '{"hecho":"cueroSeco","op":"verdadero"}'::jsonb, '{"textos":["Champús suaves sin sulfatos y masajes con aceites ligeros"]}'::jsonb, false, 'publicada'),
  ('rutina.champu.producto', 'es', 'rutina', 10, NULL, '{"paso":"champu","atributo":"producto","valor":"Champú"}'::jsonb, false, 'publicada'),
  ('rutina.champu.caract.graso', 'es', 'rutina', 11, '{"hecho":"cueroGraso","op":"verdadero"}'::jsonb, '{"paso":"champu","atributo":"caracteristicas","valor":"sin sulfatos agresivos, con árbol de té o menta"}'::jsonb, false, 'publicada'),
  ('rutina.champu.caract.seco', 'es', 'rutina', 12, '{"hecho":"cueroSeco","op":"verdadero"}'::jsonb, '{"paso":"champu","atributo":"caracteristicas","valor":"suave sin sulfatos, hidratante"}'::jsonb, false, 'publicada'),
  ('rutina.champu.caract.default', 'es', 'rutina', 13, NULL, '{"paso":"champu","atributo":"caracteristicas","valor":"sin sulfatos agresivos, con tensoactivos suaves"}'::jsonb, false, 'publicada'),
  ('rutina.champu.frec.liso', 'es', 'rutina', 14, '{"hecho":"esLiso","op":"verdadero"}'::jsonb, '{"paso":"champu","atributo":"frecuencia","valor":"2-3 veces por semana"}'::jsonb, false, 'publicada'),
  ('rutina.champu.frec.ondulado', 'es', 'rutina', 15, '{"hecho":"esOndulado","op":"verdadero"}'::jsonb, '{"paso":"champu","atributo":"frecuencia","valor":"2 veces por semana"}'::jsonb, false, 'publicada'),
  ('rutina.champu.frec.rizado', 'es', 'rutina', 16, '{"hecho":"esRizado","op":"verdadero"}'::jsonb, '{"paso":"champu","atributo":"frecuencia","valor":"1-2 veces por semana"}'::jsonb, false, 'publicada'),
  ('rutina.champu.frec.default', 'es', 'rutina', 17, NULL, '{"paso":"champu","atributo":"frecuencia","valor":"1 vez por semana"}'::jsonb, false, 'publicada'),
  ('rutina.acond.producto', 'es', 'rutina', 20, NULL, '{"paso":"acondicionador","atributo":"producto","valor":"Acondicionador"}'::jsonb, false, 'publicada'),
  ('rutina.acond.caract.denso', 'es', 'rutina', 21, '{"alguna":[{"hecho":"esAfro","op":"verdadero"},{"hecho":"esRizado","op":"verdadero"}]}'::jsonb, '{"paso":"acondicionador","atributo":"caracteristicas","valor":"nutritivo e hidratante con humectantes y mantecas"}'::jsonb, false, 'publicada'),
  ('rutina.acond.caract.ondulado', 'es', 'rutina', 22, '{"hecho":"esOndulado","op":"verdadero"}'::jsonb, '{"paso":"acondicionador","atributo":"caracteristicas","valor":"ligero con humectantes (glicerina, aloe vera)"}'::jsonb, false, 'publicada'),
  ('rutina.acond.caract.default', 'es', 'rutina', 23, NULL, '{"paso":"acondicionador","atributo":"caracteristicas","valor":"muy ligero, sin siliconas pesadas"}'::jsonb, false, 'publicada'),
  ('rutina.acond.frec', 'es', 'rutina', 24, NULL, '{"paso":"acondicionador","atributo":"frecuencia","valor":"cada lavado"}'::jsonb, false, 'publicada'),
  ('rutina.mascarilla.producto', 'es', 'rutina', 30, NULL, '{"paso":"mascarilla","atributo":"producto","valor":"Mascarilla"}'::jsonb, false, 'publicada'),
  ('rutina.mascarilla.caract.dano', 'es', 'rutina', 31, '{"hecho":"hayDano","op":"verdadero"}'::jsonb, '{"paso":"mascarilla","atributo":"caracteristicas","valor":"reconstructora con queratina hidrolizada y aminoácidos"}'::jsonb, false, 'publicada'),
  ('rutina.mascarilla.caract.hidratacion', 'es', 'rutina', 32, '{"hecho":"balanceHP","op":"eq","valor":"hidratacion"}'::jsonb, '{"paso":"mascarilla","atributo":"caracteristicas","valor":"hidratante con humectantes (glicerina, aloe vera, miel)"}'::jsonb, false, 'publicada'),
  ('rutina.mascarilla.caract.nutricion', 'es', 'rutina', 33, '{"hecho":"balanceHP","op":"eq","valor":"nutricion"}'::jsonb, '{"paso":"mascarilla","atributo":"caracteristicas","valor":"nutritiva con mantecas y aceites vegetales"}'::jsonb, false, 'publicada'),
  ('rutina.mascarilla.caract.default', 'es', 'rutina', 34, NULL, '{"paso":"mascarilla","atributo":"caracteristicas","valor":"alternar hidratante y nutritiva según cronograma"}'::jsonb, false, 'publicada'),
  ('rutina.mascarilla.frec', 'es', 'rutina', 35, NULL, '{"paso":"mascarilla","atributo":"frecuencia","valor":"1 vez por semana"}'::jsonb, false, 'publicada'),
  ('rutina.leavein.producto', 'es', 'rutina', 40, NULL, '{"paso":"leavein","atributo":"producto","valor":"Leave-in"}'::jsonb, false, 'publicada'),
  ('rutina.leavein.caract.liso', 'es', 'rutina', 41, '{"hecho":"esLiso","op":"verdadero"}'::jsonb, '{"paso":"leavein","atributo":"caracteristicas","valor":"ligero en spray, aplicar solo en medios y puntas"}'::jsonb, false, 'publicada'),
  ('rutina.leavein.caract.afro', 'es', 'rutina', 42, '{"hecho":"esAfro","op":"verdadero"}'::jsonb, '{"paso":"leavein","atributo":"caracteristicas","valor":"cremoso denso, aplicar de raíz a puntas"}'::jsonb, false, 'publicada'),
  ('rutina.leavein.caract.rizado', 'es', 'rutina', 43, '{"hecho":"esRizado","op":"verdadero"}'::jsonb, '{"paso":"leavein","atributo":"caracteristicas","valor":"cremoso de textura media"}'::jsonb, false, 'publicada'),
  ('rutina.leavein.caract.default', 'es', 'rutina', 44, NULL, '{"paso":"leavein","atributo":"caracteristicas","valor":"cremoso ligero"}'::jsonb, false, 'publicada'),
  ('rutina.leavein.frec', 'es', 'rutina', 45, NULL, '{"paso":"leavein","atributo":"frecuencia","valor":"cada lavado"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.producto.afro', 'es', 'rutina', 50, '{"hecho":"esAfro","op":"verdadero"}'::jsonb, '{"paso":"definidor","atributo":"producto","valor":"Gel cremoso afro"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.producto.rizado', 'es', 'rutina', 51, '{"hecho":"esRizado","op":"verdadero"}'::jsonb, '{"paso":"definidor","atributo":"producto","valor":"Gel definidor"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.producto.ondulado', 'es', 'rutina', 52, '{"hecho":"esOndulado","op":"verdadero"}'::jsonb, '{"paso":"definidor","atributo":"producto","valor":"Gel definidor ligero"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.producto.default', 'es', 'rutina', 53, NULL, '{"paso":"definidor","atributo":"producto","valor":"Definidor (opcional)"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.caract.afro', 'es', 'rutina', 54, '{"hecho":"esAfro","op":"verdadero"}'::jsonb, '{"paso":"definidor","atributo":"caracteristicas","valor":"cremoso denso para máxima definición, con proteínas vegetales"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.caract.rizado', 'es', 'rutina', 55, '{"hecho":"esRizado","op":"verdadero"}'::jsonb, '{"paso":"definidor","atributo":"caracteristicas","valor":"con proteínas de trigo o seda, sin alcohol secante"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.caract.ondulado', 'es', 'rutina', 56, '{"hecho":"esOndulado","op":"verdadero"}'::jsonb, '{"paso":"definidor","atributo":"caracteristicas","valor":"ligero, activa la onda sin cast pesado"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.caract.default', 'es', 'rutina', 57, NULL, '{"paso":"definidor","atributo":"caracteristicas","valor":"muy ligero, solo si necesita control extra en puntas"}'::jsonb, false, 'publicada'),
  ('rutina.definidor.frec', 'es', 'rutina', 58, NULL, '{"paso":"definidor","atributo":"frecuencia","valor":"cada lavado"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.producto', 'es', 'rutina', 60, NULL, '{"paso":"aceite","atributo":"producto","valor":"Aceite sellador"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.caract.porosidad_alta', 'es', 'rutina', 61, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"paso":"aceite","atributo":"caracteristicas","valor":"pesado (ricino, coco u oliva)"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.caract.porosidad_baja', 'es', 'rutina', 62, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"paso":"aceite","atributo":"caracteristicas","valor":"ligero (jojoba o almendras)"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.caract.default', 'es', 'rutina', 63, NULL, '{"paso":"aceite","atributo":"caracteristicas","valor":"medio (argán o jojoba)"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.frec.obligatorio', 'es', 'rutina', 64, '{"alguna":[{"hecho":"esAfro","op":"verdadero"},{"hecho":"porosidad","op":"eq","valor":"alta"}]}'::jsonb, '{"paso":"aceite","atributo":"frecuencia","valor":"cada lavado (obligatorio para sellar)"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.frec.liso', 'es', 'rutina', 65, '{"hecho":"esLiso","op":"verdadero"}'::jsonb, '{"paso":"aceite","atributo":"frecuencia","valor":"1-2 veces por semana, solo en puntas"}'::jsonb, false, 'publicada'),
  ('rutina.aceite.frec.default', 'es', 'rutina', 66, NULL, '{"paso":"aceite","atributo":"frecuencia","valor":"2-3 veces por semana"}'::jsonb, false, 'publicada'),
  ('config.disclaimer_productos', 'es', 'config', 10, NULL, '{"campo":"disclaimerProductos","texto":"Estas recomendaciones son técnicas y aplican a productos de cualquier marca. Tu estilista puede sugerirte marcas específicas que cumplan con estas características según tu presupuesto y disponibilidad local."}'::jsonb, false, 'publicada'),
  ('nota.proteina', 'es', 'nota', 10, '{"hecho":"tratamientoPrincipal","op":"eq","valor":"Reconstrucción"}'::jsonb, '{"textos":["Prioridad alta en proteína — usa mascarilla reconstructora con queratina hidrolizada."]}'::jsonb, false, 'publicada'),
  ('nota.corte_puntas', 'es', 'nota', 20, '{"todas":[{"alguna":[{"hecho":"danoQuimico","op":"verdadero"},{"hecho":"danoTermico","op":"verdadero"}]},{"hecho":"puntasSeveras","op":"verdadero"}]}'::jsonb, '{"textos":["Se recomienda corte de puntas para eliminar el daño severo."]}'::jsonb, false, 'publicada'),
  ('nota.transicion', 'es', 'nota', 30, '{"hecho":"transicion","op":"verdadero"}'::jsonb, '{"textos":["Tratar zona natural y zona procesada por separado. Recomendar corte progresivo de la zona química."]}'::jsonb, false, 'publicada'),
  ('nota.linea_demarcacion', 'es', 'nota', 40, '{"todas":[{"hecho":"transicion","op":"verdadero"},{"hecho":"lineaDemarcacion","op":"noVacio"}]}'::jsonb, '{"textos":["Línea de demarcación: {{lineaDemarcacion}}"]}'::jsonb, false, 'publicada'),
  ('nota.twist_out', 'es', 'nota', 50, '{"todas":[{"hecho":"tipoRizoPrincipal","op":"en","valor":["4B","4C"]},{"hecho":"densidad","op":"eq","valor":"alta"}]}'::jsonb, '{"textos":["Para día 2-3: Twist Out para revivir la definición sin relavar."]}'::jsonb, false, 'publicada'),
  ('nota.sellado_afro', 'es', 'nota', 60, '{"hecho":"tipoRizoPrincipal","op":"en","valor":["4B","4C"]}'::jsonb, '{"textos":["Sella SIEMPRE con aceite después de aplicar el gel para retener humedad."]}'::jsonb, false, 'publicada'),
  ('nota.mascarilla_termica', 'es', 'nota', 70, '{"hecho":"tratReconstructor","op":"verdadero"}'::jsonb, '{"textos":["Mascarilla reconstructora: dejar actuar 20-30 min con calor (gorro térmico) para máxima reconstrucción."]}'::jsonb, false, 'publicada'),
  ('nota.porosidad_baja', 'es', 'nota', 80, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"textos":["Porosidad baja: clarifica 1 vez al mes para remover acumulación de producto."]}'::jsonb, false, 'publicada'),
  ('nota.porosidad_alta', 'es', 'nota', 90, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"textos":["Porosidad alta: sella SIEMPRE con aceite o manteca después de hidratar para retener la humedad.","Usa leave-in cremoso (no en spray) para mayor nutrición."]}'::jsonb, false, 'publicada'),
  ('nota.caspa', 'es', 'nota', 100, '{"hecho":"tieneCaspa","op":"verdadero"}'::jsonb, '{"textos":["Cuero cabelludo: considerar shampoo medicado 1x por semana.","Si la caspa persiste más de 4 semanas, consultar dermatólogo."]}'::jsonb, false, 'publicada'),
  ('nota.embarazo', 'es', 'nota', 110, '{"hecho":"embarazo","op":"verdadero"}'::jsonb, '{"textos":["Embarazo/lactancia: evitar keratina y productos con formol. Preferir ingredientes naturales."]}'::jsonb, false, 'publicada'),
  ('nota.caida', 'es', 'nota', 120, '{"hecho":"tieneCaida","op":"verdadero"}'::jsonb, '{"textos":["Caída excesiva: puede tener causa interna (estrés, anemia, tiroides, postparto). Recomendar consulta médica si persiste más de 3 meses."]}'::jsonb, false, 'publicada'),
  ('nota.estres', 'es', 'nota', 130, '{"hecho":"nivelEstres","op":"eq","valor":"alto"}'::jsonb, '{"textos":["Nivel de estrés alto: puede contribuir a la caída y fragilidad del cabello."]}'::jsonb, false, 'publicada'),
  ('casa.dia_lavado.base', 'es', 'cuidado_casa', 10, NULL, '{"campo":"diaLavado","textos":["Detangle en secciones con el acondicionador puesto (sin enjuagar)","Aplica mascarilla / tratamiento según cronograma","Enjuaga con agua fría para cerrar la cutícula","Aplica leave-in en cabello húmedo","Aplica crema de peinar + gel con la técnica indicada","Seca con toalla de microfibra o camiseta de algodón (sin frotar)","Usa difusor o deja secar al aire"]}'::jsonb, false, 'publicada'),
  ('casa.nocturno.base', 'es', 'cuidado_casa', 20, NULL, '{"campo":"nocturno","textos":["Usa bonnet de satín o funda de almohada de seda para dormir","Haz una piña suelta (ponytail en la coronilla sin apretar) para conservar los rizos","Si el cabello está muy seco, aplica 1-2 gotas de aceite en las puntas antes del bonnet"]}'::jsonb, false, 'publicada'),
  ('casa.refresh.base', 'es', 'cuidado_casa', 30, NULL, '{"campo":"refresh","textos":["Mezcla agua + leave-in en spray (proporción 50/50)","Aplica en secciones y scruncha suavemente","Si los rizos perdieron forma: aplica un poco de gel fresco y scruncha","Seca con difusor en frío o deja secar al aire"]}'::jsonb, false, 'publicada'),
  ('casa.evitar.base', 'es', 'cuidado_casa', 40, NULL, '{"campo":"evitar","textos":["Cepillar el cabello en seco (rompe los rizos y genera frizz)","Toalla de algodón (usa microfibra o camiseta)","Dormir sin protección (bonnet o funda de satín)","Calor directo sin protector térmico"]}'::jsonb, false, 'publicada'),
  ('casa.evitar.porosidad_baja', 'es', 'cuidado_casa', 50, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"campo":"evitar","textos":["Aceites pesados (coco, ricino) — se acumulan en cutícula cerrada"]}'::jsonb, false, 'publicada'),
  ('casa.dia_lavado.porosidad_baja', 'es', 'cuidado_casa', 51, '{"hecho":"porosidad","op":"eq","valor":"baja"}'::jsonb, '{"campo":"diaLavado","textos":["Aplica mascarilla con gorro térmico para abrir la cutícula y permitir absorción"]}'::jsonb, false, 'publicada'),
  ('casa.dia_lavado.porosidad_alta', 'es', 'cuidado_casa', 52, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"campo":"diaLavado","textos":["Aplica técnica LOC o LCO: Leave-in → Oil (aceite) → Cream (crema) para retener humedad"]}'::jsonb, false, 'publicada'),
  ('casa.evitar.porosidad_alta', 'es', 'cuidado_casa', 53, '{"hecho":"porosidad","op":"eq","valor":"alta"}'::jsonb, '{"campo":"evitar","textos":["Calor directo (agrava la apertura de cutícula)"]}'::jsonb, false, 'publicada'),
  ('casa.evitar.caida', 'es', 'cuidado_casa', 60, '{"hecho":"tieneCaida","op":"verdadero"}'::jsonb, '{"campo":"evitar","textos":["Peinados tensos (colas apretadas, trenzas pegadas al cuero cabelludo)"]}'::jsonb, false, 'publicada'),
  ('intervalo.urgente', 'es', 'intervalo', 10, '{"alguna":[{"hecho":"puntasSeveras","op":"verdadero"},{"hecho":"tratamientoPrincipal","op":"eq","valor":"Reconstrucción"},{"hecho":"danoQuimico","op":"verdadero"}]}'::jsonb, '{"texto":"Regresar en 2 semanas (seguimiento urgente)"}'::jsonb, false, 'publicada'),
  ('intervalo.tratamiento', 'es', 'intervalo', 20, '{"hecho":"tratamientoPrincipal","op":"neq","valor":"Mantenimiento"}'::jsonb, '{"texto":"Regresar en 3-4 semanas"}'::jsonb, false, 'publicada'),
  ('intervalo.mantenimiento', 'es', 'intervalo', 30, NULL, '{"texto":"Regresar en 6-8 semanas"}'::jsonb, false, 'publicada')
on conflict (clave, locale) do nothing;

insert into public.kb_dimensiones
  (clave, locale, etiqueta, descripcion, tipo, opciones, bandera_medica, estado)
values
  ('estadoCanas', 'es', 'Estado de canas', 'Proporción aproximada de canas visibles.', 'opcion', '[{"valor":"sin_canas","etiqueta":"Sin canas"},{"valor":"menos_25","etiqueta":"Menos del 25%"},{"valor":"entre_25_50","etiqueta":"Entre 25% y 50%"},{"valor":"mas_50","etiqueta":"Más del 50%"}]'::jsonb, false, 'publicada'),
  ('densidadPorZonas', 'es', 'Densidad por zonas', 'Zonas con densidad notablemente menor al resto.', 'multi', '[{"valor":"uniforme","etiqueta":"Uniforme (sin zonas ralas)"},{"valor":"entradas","etiqueta":"Entradas despobladas"},{"valor":"coronilla","etiqueta":"Coronilla rala"},{"valor":"laterales","etiqueta":"Laterales débiles"}]'::jsonb, false, 'publicada'),
  ('senalesAlopecia', 'es', 'Señales de alopecia', 'Señales clínicas observables. Las marcadas como médicas generan SIEMPRE derivación a dermatólogo.', 'multi', '[{"valor":"sin_senales","etiqueta":"Sin señales"},{"valor":"caida_estacional","etiqueta":"Caída estacional leve"},{"valor":"placas_sin_cabello","etiqueta":"Placas sin cabello (calvas localizadas)","banderaMedica":true},{"valor":"perdida_difusa_severa","etiqueta":"Pérdida difusa severa (cuero muy visible)","banderaMedica":true},{"valor":"retroceso_linea_frontal","etiqueta":"Retroceso de la línea frontal","banderaMedica":true}]'::jsonb, true, 'publicada'),
  ('tipoCueroCabelludo', 'es', 'Tipo de cuero cabelludo', 'Estado general del cuero cabelludo. Los estados marcados como médicos generan SIEMPRE derivación a dermatólogo.', 'opcion', '[{"valor":"normal","etiqueta":"Normal"},{"valor":"graso","etiqueta":"Graso"},{"valor":"seco","etiqueta":"Seco"},{"valor":"sensible","etiqueta":"Sensible"},{"valor":"dermatitis_leve","etiqueta":"Dermatitis leve / caspa"},{"valor":"dermatitis_severa","etiqueta":"Dermatitis severa (placas, inflamación)","banderaMedica":true},{"valor":"psoriasis_sospecha","etiqueta":"Sospecha de psoriasis","banderaMedica":true},{"valor":"lesiones_abiertas","etiqueta":"Lesiones abiertas o costras","banderaMedica":true}]'::jsonb, true, 'publicada'),
  ('procesosQuimicos', 'es', 'Procesos químicos previos', 'Procesos químicos aplicados en los últimos 12 meses.', 'multi', '[{"valor":"ninguno","etiqueta":"Ninguno"},{"valor":"tinte","etiqueta":"Tinte / coloración"},{"valor":"decoloracion","etiqueta":"Decoloración / mechas"},{"valor":"alisado","etiqueta":"Alisado permanente / keratina"},{"valor":"permanente","etiqueta":"Permanente (rizado químico)"},{"valor":"henna","etiqueta":"Henna / tintes vegetales"}]'::jsonb, false, 'publicada')
on conflict (clave, locale) do nothing;

insert into public.kb_flujos
  (clave, locale, tipos_cabello, definicion, estado)
values
  ('flujo.liso', 'es', ARRAY['1A', '1B', '1C']::text[], '{"titulo":"Preguntas para cabello liso","descripcion":"El cabello liso no se evalúa igual que el rizado: pesa más la grasa en raíz, el volumen y las zonas de densidad.","preguntas":[{"clave":"grasaRaiz","etiqueta":"¿Qué tan rápido se engrasa la raíz?","tipo":"opcion","opciones":[{"valor":"mismo_dia","etiqueta":"El mismo día del lavado"},{"valor":"1_2_dias","etiqueta":"A los 1-2 días"},{"valor":"3_mas_dias","etiqueta":"A los 3 días o más"}]},{"clave":"volumenRaiz","etiqueta":"¿Cómo es el volumen en la raíz?","tipo":"opcion","opciones":[{"valor":"plano","etiqueta":"Plano / pegado al cráneo"},{"valor":"medio","etiqueta":"Medio"},{"valor":"abundante","etiqueta":"Con cuerpo"}]},{"clave":"estadoCanas","etiqueta":"Estado de canas","tipo":"opcion","opciones":[{"valor":"sin_canas","etiqueta":"Sin canas"},{"valor":"menos_25","etiqueta":"Menos del 25%"},{"valor":"entre_25_50","etiqueta":"Entre 25% y 50%"},{"valor":"mas_50","etiqueta":"Más del 50%"}],"opcional":true},{"clave":"densidadPorZonas","etiqueta":"Densidad por zonas","tipo":"multi","opciones":[{"valor":"uniforme","etiqueta":"Uniforme"},{"valor":"entradas","etiqueta":"Entradas despobladas"},{"valor":"coronilla","etiqueta":"Coronilla rala"},{"valor":"laterales","etiqueta":"Laterales débiles"}],"opcional":true},{"clave":"senalesAlopecia","etiqueta":"Señales de alopecia","ayuda":"Si hay señales clínicas, el sistema deriva a dermatólogo.","tipo":"multi","opciones":[{"valor":"sin_senales","etiqueta":"Sin señales"},{"valor":"caida_estacional","etiqueta":"Caída estacional leve"},{"valor":"placas_sin_cabello","etiqueta":"Placas sin cabello","banderaMedica":true},{"valor":"perdida_difusa_severa","etiqueta":"Pérdida difusa severa","banderaMedica":true},{"valor":"retroceso_linea_frontal","etiqueta":"Retroceso de línea frontal","banderaMedica":true}],"opcional":true},{"clave":"tipoCueroCabelludo","etiqueta":"Tipo de cuero cabelludo","tipo":"opcion","opciones":[{"valor":"normal","etiqueta":"Normal"},{"valor":"graso","etiqueta":"Graso"},{"valor":"seco","etiqueta":"Seco"},{"valor":"sensible","etiqueta":"Sensible"},{"valor":"dermatitis_leve","etiqueta":"Dermatitis leve / caspa"},{"valor":"dermatitis_severa","etiqueta":"Dermatitis severa","banderaMedica":true},{"valor":"psoriasis_sospecha","etiqueta":"Sospecha de psoriasis","banderaMedica":true},{"valor":"lesiones_abiertas","etiqueta":"Lesiones abiertas","banderaMedica":true}],"opcional":true},{"clave":"procesosQuimicos","etiqueta":"Procesos químicos previos (últimos 12 meses)","tipo":"multi","opciones":[{"valor":"ninguno","etiqueta":"Ninguno"},{"valor":"tinte","etiqueta":"Tinte / coloración"},{"valor":"decoloracion","etiqueta":"Decoloración / mechas"},{"valor":"alisado","etiqueta":"Alisado permanente / keratina"},{"valor":"permanente","etiqueta":"Permanente (rizado químico)"},{"valor":"henna","etiqueta":"Henna / tintes vegetales"}],"opcional":true}]}'::jsonb, 'borrador')
on conflict (clave, locale) do nothing;

insert into public.kb_prompts
  (clave, locale, tipos_cabello, contenido, estado)
values
  ('analisis_foto.sistema', 'es', NULL, 'Eres un experto en análisis de texturas capilares. Responde SOLO con el objeto JSON solicitado. No uses backticks, no uses bloques de código markdown, no agregues texto antes ni después del JSON.', 'publicada'),
  ('analisis_foto.principal', 'es', NULL, 'Eres un experto en análisis de texturas capilares. Analiza las fotos de cabello y determina:

1. Tipo de cabello según el sistema Andre Walker (tipos: 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B, 3C, 4A, 4B, 4C). Tipos 1 son lisos (1A completamente liso, 1B liso con leve cuerpo, 1C liso con ondulación sutil en puntas).
2. Porosidad visible: "baja" (cabello brillante/resbaladizo/liso en cutícula), "media" (normal), "alta" (cabello opaco/esponjoso/mucho frizz/absorbe agua rápido).
3. Densidad del cabello: "baja" (cuero cabelludo muy visible a través del cabello), "media" (parcialmente visible), "alta" (cuero cabelludo no visible).
4. Daño visible: "ninguno", "leve" (algunas puntas abiertas), "moderado" (puntas muy abiertas, textura alterada), "severo" (quiebre, fragilidad extrema).

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin texto adicional, sin markdown):
{
  "tipoRizoPrincipal": "3B",
  "tiposSecundarios": ["3A"],
  "observaciones": "Rizo espiral definido, porosidad alta, densidad media.",
  "confianza": "alta",
  "porosidad": "alta",
  "densidad": "media",
  "danoVisible": "leve"
}

Reglas:
- tipoRizoPrincipal: obligatorio, uno de los 12 tipos válidos (1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B, 3C, 4A, 4B, 4C)
- tiposSecundarios: array vacío [] si no hay tipos secundarios claros
- observaciones: descripción breve del estado (máx 100 caracteres)
- confianza: "alta" si el patrón es claro y todos los campos son determinables con certeza, "media" si hay duda en algún campo, "baja" si las fotos no son suficientes
- porosidad, densidad, danoVisible: incluir siempre si las fotos tienen calidad suficiente', 'publicada'),
  ('analisis_foto.contexto.seco_natural', 'es', NULL, 'El cabello está SECO Y SIN PRODUCTO — estado ideal para diagnóstico. El patrón visible es el patrón real.', 'publicada'),
  ('analisis_foto.contexto.humedo', 'es', NULL, 'El cabello está HÚMEDO — el rizo se estira cuando está mojado. El tipo real probablemente sea más cerrado que lo visible.', 'publicada'),
  ('analisis_foto.contexto.con_producto', 'es', NULL, 'El cabello tiene PRODUCTO APLICADO — el brillo y la definición pueden estar alterados. Ajusta la evaluación de porosidad.', 'publicada'),
  ('analisis_foto.contexto.recien_lavado', 'es', NULL, 'El cabello está RECIÉN LAVADO SIN PRODUCTO — buen estado para evaluar porosidad.', 'publicada')
on conflict (clave, locale) do nothing;
