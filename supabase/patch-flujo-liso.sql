-- ============================================================================
-- PATCH: flujo.liso — completa la plantilla del Sprint A con la Entrega 1
-- ============================================================================
-- GENERADO desde lib/kb/seed/contenido.ts (Sprint B) — NO editar a mano.
-- Contexto: la migración principal usa ON CONFLICT DO NOTHING, así que una
-- fila flujo.liso ya existente en prod (plantilla del Sprint A) no se
-- actualiza. Este patch la lleva al contenido completo del seed actual.
--
-- Alcance: SOLO la fila (clave='flujo.liso', locale='es'). Ninguna otra
-- fila de kb_flujos ni de otras tablas se toca.
--
-- Idempotente: el WHERE del DO UPDATE hace que una segunda ejecución sea
-- un no-op real (no incrementa version ni genera fila de auditoría).
--
-- Nota: fuerza estado='borrador' — el contenido nuevo debe revisarse en el
-- panel /conocimiento antes de publicarse. Si el flujo ya fue editado a
-- mano desde el panel y quieres conservar esa edición, NO ejecutes este
-- patch (revisa primero: select definicion from public.kb_flujos where
-- clave = 'flujo.liso').
-- ============================================================================

insert into public.kb_flujos (clave, locale, tipos_cabello, definicion, estado)
values
  ('flujo.liso', 'es', ARRAY['1A', '1B', '1C']::text[], '{"titulo":"Preguntas para cabello liso","descripcion":"En tipo 1 el cuero cabelludo es protagonista: el sebo viaja libre por la hebra recta. Desaparecen las preguntas de definición y entran oleosidad, volumen e historial.","preguntas":[{"clave":"grasaRaiz","etiqueta":"¿Qué tan rápido se engrasa la raíz?","tipo":"opcion","opciones":[{"valor":"mismo_dia","etiqueta":"El mismo día del lavado"},{"valor":"1_2_dias","etiqueta":"A los 1-2 días"},{"valor":"3_mas_dias","etiqueta":"A los 3 días o más"}]},{"clave":"volumenRaiz","etiqueta":"¿Cómo es el volumen en la raíz?","tipo":"opcion","opciones":[{"valor":"plano","etiqueta":"Plano / pegado al cráneo"},{"valor":"medio","etiqueta":"Medio"},{"valor":"abundante","etiqueta":"Con cuerpo"}]},{"clave":"tipoCueroCabelludo","etiqueta":"Tipo de cuero cabelludo","ayuda":"Picor, descamación y sensaciones. Si la descamación viene con placas, enrojecimiento o dolor, el asistente corta hacia bandera roja.","tipo":"opcion","opciones":[{"valor":"normal","etiqueta":"Normal"},{"valor":"graso","etiqueta":"Graso"},{"valor":"seco","etiqueta":"Seco"},{"valor":"sensible","etiqueta":"Sensible"},{"valor":"dermatitis_leve","etiqueta":"Dermatitis leve / caspa"},{"valor":"dermatitis_severa","etiqueta":"Dermatitis severa","banderaMedica":true},{"valor":"psoriasis_sospecha","etiqueta":"Sospecha de psoriasis","banderaMedica":true},{"valor":"lesiones_abiertas","etiqueta":"Lesiones abiertas","banderaMedica":true}],"opcional":true},{"clave":"nivelFrizz","etiqueta":"Nivel de frizz / estática","ayuda":"En 1C suele ser señal de cutícula abierta y estática.","tipo":"opcion","opciones":[{"valor":"bajo","etiqueta":"Bajo"},{"valor":"medio","etiqueta":"Medio"},{"valor":"alto","etiqueta":"Alto"}],"opcional":true},{"clave":"procesosQuimicos","etiqueta":"Procesos químicos previos (con fechas en observaciones)","tipo":"multi","opciones":[{"valor":"ninguno","etiqueta":"Ninguno"},{"valor":"tinte","etiqueta":"Tinte / coloración"},{"valor":"decoloracion","etiqueta":"Decoloración / mechas"},{"valor":"alisado","etiqueta":"Alisado permanente / keratina"},{"valor":"permanente","etiqueta":"Permanente (rizado químico)"},{"valor":"henna","etiqueta":"Henna / tintes vegetales"}],"opcional":true},{"clave":"frecuenciaTinte","etiqueta":"Frecuencia de coloración","tipo":"opcion","opciones":[{"valor":"sin_tinte","etiqueta":"No se tiñe"},{"valor":"cada_3_6_semanas","etiqueta":"Cada 3–6 semanas (cobertura)"},{"valor":"cada_8_semanas_o_menos","etiqueta":"Cada 8 semanas o menos"},{"valor":"esporadico","etiqueta":"Esporádico (más de 8 semanas)"}],"opcional":true},{"clave":"objetivoPrincipal","etiqueta":"Objetivo principal","ayuda":"Una sola opción dominante: ordena el plan cuando varias reglas aplican.","tipo":"opcion","opciones":[{"valor":"volumen","etiqueta":"Volumen"},{"valor":"control_frizz","etiqueta":"Control de frizz / estática"},{"valor":"brillo","etiqueta":"Brillo"},{"valor":"reparacion","etiqueta":"Reparación"},{"valor":"mantenimiento","etiqueta":"Mantenimiento"}]},{"clave":"densidadPorZonas","etiqueta":"Densidad por zonas","tipo":"multi","opciones":[{"valor":"uniforme","etiqueta":"Uniforme"},{"valor":"entradas","etiqueta":"Entradas despobladas"},{"valor":"coronilla","etiqueta":"Coronilla rala"},{"valor":"laterales","etiqueta":"Laterales débiles"}],"opcional":true}]}'::jsonb, 'borrador')
on conflict (clave, locale) do update
  set tipos_cabello = excluded.tipos_cabello,
      definicion    = excluded.definicion,
      estado        = excluded.estado
  where kb_flujos.definicion    is distinct from excluded.definicion
     or kb_flujos.tipos_cabello is distinct from excluded.tipos_cabello
     or kb_flujos.estado        is distinct from excluded.estado;
