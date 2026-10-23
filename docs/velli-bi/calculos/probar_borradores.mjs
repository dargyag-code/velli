// ══════════════════════════════════════════════════════════════════════════
// Prueba los borradores SQL de Velli BI en un Postgres EN MEMORIA (PGlite):
// nunca toca producción. Carga schema.sql (hasta el apéndice manual), la
// migración de colorimetría y luego, dos veces cada una para probar que son
// idempotentes:
//   supabase/migration-proteger-perfil.sql
//   supabase/migration-feature-flags.sql
//   supabase/borradores/velli-bi-cotizador.sql
//   supabase/borradores/velli-bi-uso-ia.sql
// Y verifica RLS entre dos salones, triggers y el link público.
//
// Uso, fuera del repo (PGlite no es dependencia del proyecto):
//   npm init -y && npm install @electric-sql/pglite
//   node probar_borradores.mjs <ruta del repo velli-pro>
// Salida guardada de la corrida del 2026-10-22: probar_borradores_salida.txt
// ══════════════════════════════════════════════════════════════════════════

import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
const leer = (rel) => {
  const rutaDirecta = path.join(repo, rel);
  if (existsSync(rutaDirecta)) return readFileSync(rutaDirecta, 'utf8');
  const base = path.basename(rel);
  for (const dir of ['supabase', 'supabase/borradores', 'supabase/_archive']) {
    const candidata = path.join(repo, dir, base);
    if (existsSync(candidata)) return readFileSync(candidata, 'utf8');
  }
  return readFileSync(rutaDirecta, 'utf8');
};
const db = new PGlite();

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

const resultados = [];
const ok = (nombre) => resultados.push(['OK   ', nombre]);
const falla = (nombre, detalle) => resultados.push(['FALLA', nombre, detalle]);

async function prueba(nombre, fn) {
  try {
    const r = await fn();
    if (r === false) falla(nombre, 'la verificación devolvió false');
    else ok(nombre);
  } catch (e) {
    falla(nombre, e.message);
  }
}

async function esperaError(nombre, patron, fn) {
  try {
    await fn();
    falla(nombre, 'no lanzó error');
  } catch (e) {
    if (patron.test(e.message)) ok(nombre);
    else falla(nombre, e.message);
  }
}

// Ejecuta fn con el rol y el usuario (claim sub) indicados, como PostgREST.
async function como(rol, uid, fn) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec(`set role ${rol}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const q = async (sql, params = []) => (await db.query(sql, params)).rows;

// ── 1. Entorno tipo Supabase ──────────────────────────────────────────────
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);

const schema = leer('supabase/schema.sql');
await db.exec(schema.slice(0, schema.indexOf('-- MANUALLY APPENDED')));
// El dump deja la sesión con search_path vacío y row_security = off (así lo
// genera pg_dump). Se restauran para que la RLS se evalúe como en Supabase.
await db.exec(`set search_path to public; set row_security = on;`);
await db.exec(leer('supabase/migration-colorimetria.sql'));

// ── 2. Migraciones (dos veces: idempotentes) ──────────────────────────────
for (const archivo of [
  'supabase/migration-proteger-perfil.sql',
  'supabase/migration-feature-flags.sql',
  'supabase/borradores/velli-bi-cotizador.sql',
  'supabase/borradores/velli-bi-uso-ia.sql',
]) {
  await prueba(`aplica ${archivo} (1.ª vez)`, () => db.exec(leer(archivo)));
  await prueba(`aplica ${archivo} (2.ª vez, idempotente)`, () => db.exec(leer(archivo)));
}

// ── 3. Datos de dos salones ───────────────────────────────────────────────
await db.exec(`
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');
  insert into public.profiles (id, nombre, nombre_salon, color_primario)
    values ('${A}', 'Ana', 'Salón A', '#2D5A27'), ('${B}', 'Bea', 'Salón B', null);
  insert into public.subscriptions (user_id, status, trial_ends_at)
    values ('${A}', 'trialing', now() + interval '14 days'),
           ('${B}', 'trialing', now() + interval '14 days'),
           ('${C}', 'trialing', now() + interval '14 days');
`);

// ── 4. Guardia de profiles (Etapa 1, R17) ─────────────────────────────────
await prueba('perfil: la cuenta edita su nombre', () =>
  como('authenticated', A, () => db.query(`update public.profiles set nombre = 'Ana M.' where id = $1`, [A])));
await esperaError('perfil: la cuenta NO se asigna rol corporativo', /CAMPO_PROTEGIDO/, () =>
  como('authenticated', A, () => db.query(`update public.profiles set rol = 'corporativo' where id = $1`, [A])));
await esperaError('perfil: la cuenta NO se marca fundadora', /CAMPO_PROTEGIDO/, () =>
  como('authenticated', A, () => db.query(`update public.profiles set es_fundadora = true where id = $1`, [A])));
await esperaError('perfil: la cuenta NO toca sus feature_flags', /CAMPO_PROTEGIDO/, () =>
  como('authenticated', A, () => db.query(`update public.profiles set feature_flags = '{"cortes": true}' where id = $1`, [A])));
await esperaError('perfil: una cuenta nueva NO nace corporativa', /CAMPO_PROTEGIDO/, () =>
  como('authenticated', C, () => db.query(`insert into public.profiles (id, nombre, rol) values ($1, 'Cata', 'corporativo')`, [C])));
await prueba('perfil: una cuenta nueva nace salón', () =>
  como('authenticated', C, () => db.query(`insert into public.profiles (id, nombre) values ($1, 'Cata')`, [C])));
await prueba('perfil: el SQL Editor sí asigna flags y rol', async () => {
  await db.query(`update public.profiles set feature_flags = feature_flags || '{"cortes": true}', rol = 'corporativo' where id = $1`, [B]);
  const [r] = await q(`select feature_flags, rol from public.profiles where id = $1`, [B]);
  await db.query(`update public.profiles set rol = 'salon' where id = $1`, [B]);
  return r.feature_flags.cortes === true && r.rol === 'corporativo';
});
await esperaError('perfil: feature_flags debe ser un objeto', /profiles_feature_flags_objeto/, () =>
  db.query(`update public.profiles set feature_flags = '[]' where id = $1`, [B]));

// ── 5. Cotizador ──────────────────────────────────────────────────────────
const ids = {};
await prueba('A crea servicio, estilista, clienta y consulta', async () => {
  await como('authenticated', A, async () => {
    ids.servicio = (await q(`insert into public.servicios_salon (user_id, nombre, categoria, usa_formula_color)
      values ($1, 'Tinte raíz', 'color', true) returning id`, [A]))[0].id;
    ids.estilista = (await q(`insert into public.estilistas (user_id, nombre) values ($1, 'Caro') returning id`, [A]))[0].id;
    ids.clienta = (await q(`insert into public.clientas (user_id, nombre) values ($1, 'Lucía') returning id`, [A]))[0].id;
    ids.consulta = (await q(`insert into public.consultas (user_id, clienta_id, densidad) values ($1, $2, 'alta') returning id`, [A, ids.clienta]))[0].id;
  });
});
await esperaError('nombre de servicio duplicado (sin importar mayúsculas)', /uq_servicios_salon_nombre/, () =>
  como('authenticated', A, () => db.query(`insert into public.servicios_salon (user_id, nombre) values ($1, ' tinte RAÍZ ')`, [A])));

await prueba('publicar plantilla v1 y v2: queda una sola vigente', async () => {
  await como('authenticated', A, async () => {
    ids.v1 = (await q(`select public.publicar_plantilla_precio($1, 120000, '{"largo": {"largo": {"porcentaje": 40}}}'::jsonb) as id`, [ids.servicio]))[0].id;
    ids.v2 = (await q(`select public.publicar_plantilla_precio($1, 130000) as id`, [ids.servicio]))[0].id;
  });
  const filas = await q(`select version, vigente_hasta is null as vigente from public.plantillas_precio where servicio_id = $1 order by version`, [ids.servicio]);
  return filas.length === 2 && !filas[0].vigente && filas[1].vigente && filas[1].version === 2;
});
await esperaError('una versión de plantilla no se edita', /PLANTILLA_INMUTABLE/, () =>
  como('authenticated', A, () => db.query(`update public.plantillas_precio set precio_base = 1 where id = $1`, [ids.v2])));
await esperaError('una plantilla no se borra desde el cliente', /permission denied/, () =>
  como('authenticated', A, () => db.query(`delete from public.plantillas_precio where id = $1`, [ids.v1])));
await esperaError('B no publica plantillas en el servicio de A', /SERVICIO_NO_ENCONTRADO/, () =>
  como('authenticated', B, () => db.query(`select public.publicar_plantilla_precio($1, 1)`, [ids.servicio])));

const insertarCotizacion = (extra = {}) => {
  const c = {
    user_id: A, clienta_id: ids.clienta, consulta_id: ids.consulta, estilista_id: ids.estilista,
    servicio_id: ids.servicio, plantilla_id: ids.v2, servicio_nombre: 'Tinte raíz',
    plantilla_version: 2, variables: { largo: { valor: 'medio', origen: 'diagnostico' } },
    precio_calculado: 130000, precio_cotizado: 130000, estado: 'enviada', ...extra,
  };
  const cols = Object.keys(c);
  return q(
    `insert into public.cotizaciones (${cols.join(', ')}, vigencia_hasta)
     values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, current_date + 15)
     returning id, token_publico, enviada_at`,
    cols.map((k) => (typeof c[k] === 'object' && c[k] !== null ? JSON.stringify(c[k]) : c[k]))
  );
};

await prueba('A envía una cotización (enviada_at automático, evento creada)', async () => {
  const [r] = await como('authenticated', A, () => insertarCotizacion());
  ids.cot = r.id;
  ids.token = r.token_publico;
  const ev = await q(`select tipo from public.cotizacion_eventos where cotizacion_id = $1`, [ids.cot]);
  return r.enviada_at !== null && ev.length === 1 && ev[0].tipo === 'creada';
});
await esperaError('precio distinto al de la plantilla exige motivo', /cotizaciones_ajuste_con_motivo/, () =>
  como('authenticated', A, () => insertarCotizacion({ precio_cotizado: 120000 })));
await prueba('precio distinto con motivo sí entra', () =>
  como('authenticated', A, () => insertarCotizacion({ precio_cotizado: 120000, ajuste_manual_motivo: 'Clienta frecuente' })));

await prueba('B no ve cotizaciones ni eventos de A', async () => {
  const [c] = await como('authenticated', B, () => q(`select count(*)::int n from public.cotizaciones`));
  const [e] = await como('authenticated', B, () => q(`select count(*)::int n from public.cotizacion_eventos`));
  return c.n === 0 && e.n === 0;
});
await esperaError('B no cuelga su cotización de la clienta de A', /REFERENCIA_OTRO_SALON/, () =>
  como('authenticated', B, () => db.query(
    `insert into public.cotizaciones (user_id, clienta_id, servicio_nombre, precio_calculado, precio_cotizado, vigencia_hasta)
     values ($1, $2, 'X', 1, 1, current_date)`, [B, ids.clienta])));
await esperaError('B no escribe cotizaciones a nombre de A', /row-level security/, () =>
  como('authenticated', B, () => db.query(
    `insert into public.cotizaciones (user_id, servicio_nombre, precio_calculado, precio_cotizado, vigencia_hasta)
     values ($1, 'X', 1, 1, current_date)`, [A])));

await esperaError('lo enviado no se modifica', /COTIZACION_INMUTABLE/, () =>
  como('authenticated', A, () => db.query(`update public.cotizaciones set precio_cotizado = 1 where id = $1`, [ids.cot])));
await prueba('cobro en un toque con otro valor: diferencia y evento', async () => {
  await como('authenticated', A, () => db.query(
    `update public.cotizaciones set estado = 'cobrada', precio_cobrado = 140000 where id = $1`, [ids.cot]));
  const [r] = await q(`select diferencia_cobro, cobrado_at from public.cotizaciones where id = $1`, [ids.cot]);
  const ev = await q(`select tipo from public.cotizacion_eventos where cotizacion_id = $1 order by id`, [ids.cot]);
  return r.diferencia_cobro === 10000 && r.cobrado_at !== null && ev.map((e) => e.tipo).join() === 'creada,cobrada';
});
await prueba('corregir lo cobrado deja huella', async () => {
  await como('authenticated', A, () => db.query(`update public.cotizaciones set precio_cobrado = 135000 where id = $1`, [ids.cot]));
  const ev = await q(`select tipo, datos from public.cotizacion_eventos where cotizacion_id = $1 order by id`, [ids.cot]);
  const ultimo = ev.at(-1);
  return ultimo.tipo === 'cobro_corregido' && ultimo.datos.antes === 140000 && ultimo.datos.despues === 135000;
});
await esperaError('una cobrada no vuelve a enviada', /COTIZACION_TRANSICION/, () =>
  como('authenticated', A, () => db.query(`update public.cotizaciones set estado = 'enviada' where id = $1`, [ids.cot])));
await prueba('una cobrada no se borra (0 filas)', async () => {
  const r = await como('authenticated', A, () => db.query(`delete from public.cotizaciones where id = $1`, [ids.cot]));
  return r.affectedRows === 0;
});
await prueba('un borrador sí se borra', async () => {
  const [b] = await como('authenticated', A, () => insertarCotizacion({ estado: 'borrador' }));
  ids.borrador = b.token_publico;
  const [b2] = await como('authenticated', A, () => insertarCotizacion({ estado: 'borrador' }));
  const r = await como('authenticated', A, () => db.query(`delete from public.cotizaciones where id = $1`, [b2.id]));
  return r.affectedRows === 1;
});

// ── 6. Link público ───────────────────────────────────────────────────────
await prueba('anon ve servicio, precio y vigencia por token — y nada más', async () => {
  const filas = await como('anon', null, () => q(`select * from public.cotizacion_publica($1)`, [ids.token]));
  const cols = Object.keys(filas[0] ?? {}).sort().join();
  const esperado = ['color_salon', 'con_marca_velli', 'moneda', 'precio', 'salon', 'servicio', 'vigencia_hasta', 'vigente'].sort().join();
  return filas.length === 1 && cols === esperado && filas[0].salon === 'Salón A' &&
    filas[0].precio === 130000 && filas[0].vigente === true && filas[0].con_marca_velli === true;
});
await prueba('un borrador no existe hacia afuera', async () =>
  (await como('anon', null, () => q(`select * from public.cotizacion_publica($1)`, [ids.borrador]))).length === 0);
await prueba('un token inventado no devuelve nada', async () =>
  (await como('anon', null, () => q(`select * from public.cotizacion_publica(gen_random_uuid())`))).length === 0);
await esperaError('anon no lee la tabla de cotizaciones', /permission denied/, () =>
  como('anon', null, () => db.query(`select * from public.cotizaciones`)));

// ── 7. Historia que sobrevive al borrado (R9) ─────────────────────────────
await esperaError('A no reasigna su cotización a una consulta de otra clienta', /REFERENCIA_OTRO_SALON/, async () => {
  const otra = await como('authenticated', A, async () => {
    const cl = (await q(`insert into public.clientas (user_id, nombre) values ($1, 'Marta') returning id`, [A]))[0].id;
    return (await q(`insert into public.consultas (user_id, clienta_id) values ($1, $2) returning id`, [A, cl]))[0].id;
  });
  await como('authenticated', A, () => db.query(`update public.cotizaciones set consulta_id = $1 where id = $2`, [otra, ids.cot]));
});
await prueba('borrar la clienta conserva lo cobrado', async () => {
  await db.query(`delete from public.clientas where id = $1`, [ids.clienta]);
  const [r] = await q(`select clienta_id, consulta_id, precio_cobrado, servicio_nombre from public.cotizaciones where id = $1`, [ids.cot]);
  return r.clienta_id === null && r.consulta_id === null && r.precio_cobrado === 135000 && r.servicio_nombre === 'Tinte raíz';
});

// ── 8. Comisiones ─────────────────────────────────────────────────────────
await prueba('una regla de comisión del salón', () =>
  como('authenticated', A, () => db.query(`insert into public.comisiones (user_id, tipo, valor) values ($1, 'porcentaje', 40)`, [A])));
await esperaError('no hay dos reglas vigentes con el mismo alcance', /uq_comisiones_vigente/, () =>
  como('authenticated', A, () => db.query(`insert into public.comisiones (user_id, tipo, valor) values ($1, 'porcentaje', 35)`, [A])));
await prueba('regla específica de una estilista convive con la del salón', () =>
  como('authenticated', A, () => db.query(`insert into public.comisiones (user_id, estilista_id, tipo, valor) values ($1, $2, 'porcentaje', 45)`, [A, ids.estilista])));
await esperaError('un porcentaje no pasa de 100', /comisiones_porcentaje_max/, () =>
  como('authenticated', A, () => db.query(`insert into public.comisiones (user_id, servicio_id, tipo, valor) values ($1, $2, 'porcentaje', 120)`, [A, ids.servicio])));

// ── 9. Uso de IA y tope ───────────────────────────────────────────────────
await esperaError('una cuenta no escribe su propio uso de IA', /permission denied/, () =>
  como('authenticated', A, () => db.query(`insert into public.uso_ia (user_id, ruta, proveedor, modelo, fotos, ok) values ($1, 'analizar', 'anthropic', 'claude-sonnet-4-6', 3, true)`, [A])));
await prueba('el servidor (service_role) registra el uso', () =>
  como('service_role', null, () => db.query(
    `insert into public.uso_ia (user_id, ruta, proveedor, modelo, fotos, tokens_entrada, tokens_salida, costo_usd, ok)
     values ($1, 'analizar', 'anthropic', 'claude-sonnet-4-6', 3, 4361, 110, 0.0147, true),
            ($1, 'validar', 'anthropic', 'claude-sonnet-4-6', 3, 3923, 81, 0.0130, true)`, [A])));
await prueba('cupo del mes: A lleva 1 análisis; B no ve el de A', async () => {
  const [a] = await como('authenticated', A, () => q(`select public.ia_analisis_del_mes() n`));
  const [b] = await como('authenticated', B, () => q(`select public.ia_analisis_del_mes($1) n`, [A]));
  const [s] = await como('service_role', null, () => q(`select public.ia_analisis_del_mes($1) n`, [A]));
  return a.n === 1 && b.n === 0 && s.n === 1;
});
await esperaError('solo se acepta Anthropic como proveedor (sin respaldo de OpenAI)', /uso_ia_proveedor_check/, () =>
  como('service_role', null, () => db.query(
    `insert into public.uso_ia (user_id, ruta, proveedor, modelo, fotos, ok) values ($1, 'analizar', 'openai', 'gpt-4o', 3, true)`, [A])));
await esperaError('una cuenta no borra su uso para recuperar cupo', /permission denied/, () =>
  como('authenticated', A, () => db.query(`delete from public.uso_ia where user_id = $1`, [A])));

// ── 10. Suscripción vencida: bloqueo suave ────────────────────────────────
await esperaError('con el plan vencido no se crea configuración nueva', /SUSCRIPCION_VENCIDA/, async () => {
  await db.query(`update public.subscriptions set trial_ends_at = now() - interval '10 days' where user_id = $1`, [B]);
  await como('authenticated', B, () => db.query(`insert into public.estilistas (user_id, nombre) values ($1, 'Dani')`, [B]));
});
await prueba('con el plan vencido se sigue leyendo', async () => {
  await como('authenticated', B, () => q(`select * from public.servicios_salon`));
});

// ── Resumen ───────────────────────────────────────────────────────────────
const fallas = resultados.filter((r) => r[0] === 'FALLA');
for (const r of resultados) console.log(r.join(' · '));
console.log(`\n${resultados.length - fallas.length}/${resultados.length} OK`);
process.exit(fallas.length ? 1 : 0);
