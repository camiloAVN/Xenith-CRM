-- Agente de IA por privado + tareas de Xenith. Idempotente: editar y reaplicar.
--   ssh railway-postgres 'psql -U postgres -d reto -q' < agente/sql/04-agente.sql
-- Depende de 03-logic.sql (fn_send, fn_html, fn_crear_recordatorio...).
\set ON_ERROR_STOP on
begin;

-- ------------------------------------------------------------ tablas

-- Una fila por llamada al modelo: sirve para el tope diario, el tope mensual y /uso
create table if not exists uso_ia (
  id serial primary key,
  participante_id int not null references participantes (id),
  creado_en timestamptz not null default now(),
  tokens_entrada int not null default 0,
  tokens_salida int not null default 0,
  costo_usd numeric(10, 6) not null default 0,
  herramienta text,
  error text
);
create index if not exists uso_ia_idx on uso_ia (participante_id, creado_en);

-- Memoria corta de la conversación (últimos turnos recientes, se purga sola)
create table if not exists chat_ia (
  id serial primary key,
  participante_id int not null references participantes (id),
  rol text not null check (rol in ('user', 'assistant')),
  texto text not null,
  creado_en timestamptz not null default now()
);
create index if not exists chat_ia_idx on chat_ia (participante_id, creado_en);

insert into config (clave, valor, descripcion) values
  ('ia_modelo', '"claude-haiku-4-5"', 'Modelo de Anthropic del agente (el más barato)'),
  ('ia_max_tokens', '350', 'Tope de tokens de salida por respuesta'),
  ('ia_mensajes_dia', '25', 'Mensajes a la IA por persona y día (hora Bogotá)'),
  ('ia_tope_mes_usd', '3', 'Gasto máximo del mes en USD, sumando a todos; al llegar se apaga la IA'),
  ('ia_precio_entrada', '1', 'USD por millón de tokens de entrada (Haiku 4.5)'),
  ('ia_precio_salida', '5', 'USD por millón de tokens de salida (Haiku 4.5)'),
  ('ia_max_caracteres', '600', 'Largo máximo de un mensaje para la IA'),
  ('ia_memoria_min', '30', 'Minutos que el agente recuerda la conversación'),
  ('ia_memoria_turnos', '4', 'Mensajes previos que se le mandan al modelo'),
  ('xenith_url', '"https://xenith.com.co"', 'URL del CRM para los enlaces'),
  ('xenith_sondeo_desde', 'null', 'Última consulta de novedades de Xenith (la maneja fn_xenith_novedades)')
on conflict (clave) do nothing;

-- ------------------------------------------------------------ fechas en español

-- 'jue 17 sep'
create or replace function fn_dia_corto(d date) returns text
language sql immutable as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from d)::int + 1]
      || ' ' || extract(day from d)::int || ' '
      || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from d)::int]
$$;

-- 'jue 17 sep, 3:05 pm' (hora Bogotá)
create or replace function fn_fecha_corta(ts timestamptz) returns text
language sql stable as $$
  select fn_dia_corto(l::date) || ', ' || to_char(l, 'FMHH12:MI')
      || case when extract(hour from l) < 12 then ' am' else ' pm' end
    from (select ts at time zone 'America/Bogota' as l) x
$$;

-- 'YYYY-MM-DD HH:MM' en hora Bogotá -> timestamptz (null si no se entiende)
create or replace function fn_parse_fecha_local(t text) returns timestamptz
language plpgsql stable as $$
begin
  return (t::timestamp) at time zone 'America/Bogota';
exception when others then
  return null;
end $$;

-- ------------------------------------------------------------ tareas de Xenith

-- En Xenith la fecha límite se guarda como medianoche UTC del día elegido:
-- el día que ve la gente es la parte de fecha en UTC, no en Bogotá.
create or replace function fn_xenith_vence(due text) returns text
language sql stable as $$
  select case
    when due is null then null
    when d = hoy then 'vence hoy'
    when d = hoy + 1 then 'vence mañana'
    when d < hoy then 'venció el ' || fn_dia_corto(d)
    else 'vence el ' || fn_dia_corto(d) end
  from (select (due::timestamptz at time zone 'UTC')::date as d,
               (now() at time zone 'America/Bogota')::date as hoy) x
$$;

create or replace function fn_xenith_linea(x jsonb, extra text default null) returns text
language sql stable as $$
  select '<a href="' || fn_cfg_txt('xenith_url') || '/dashboard/proyectos/' || (x ->> 'projectId') || '">'
      || fn_html(x ->> 'title') || '</a> · ' || fn_html(x ->> 'project')
      || coalesce(' · ' || extra, '')
$$;

-- Una sección de la lista, con tope de 8 renglones
create or replace function fn_xenith_seccion(titulo text, items jsonb, tipo text) returns text
language sql stable as $$
  select case when coalesce(jsonb_array_length(items), 0) = 0 then '' else
    E'\n\n' || titulo || E'\n' || string_agg('• ' ||
      fn_xenith_linea(x, case tipo
        when 'asignada' then
          case when (x ->> 'dueDate') is not null
                and (x ->> 'dueDate')::timestamptz at time zone 'UTC' < (now() at time zone 'America/Bogota')::date
               then '🔴 ' else '' end || fn_xenith_vence(x ->> 'dueDate')
        when 'votar' then 'cierra ' || fn_fecha_corta((x ->> 'votingClosesAt')::timestamptz)
        when 'aprobar' then 'de ' || fn_html(coalesce(x ->> 'assignee', '?'))
        else null end),
      E'\n' order by n) filter (where n <= 8)
    || case when jsonb_array_length(items) > 8 then E'\n<i>…y ' || (jsonb_array_length(items) - 8) || ' más</i>' else '' end
  end
  from jsonb_array_elements(items) with ordinality a(x, n)
$$;

-- Todos los pendientes de UNA persona (un elemento de `users` del endpoint)
create or replace function fn_texto_tareas_xenith(u jsonb) returns text
language sql stable as $$
  select case
    when u is null then '🤷 No encontré tu usuario en Xenith.'
    when t = '' then '🎉 No tienes pendientes en Xenith.'
    else '📋 <b>Tus pendientes en Xenith</b>' || t end
  from (select fn_xenith_seccion('🛠 <b>Por hacer</b>', u -> 'asignadas', 'asignada')
            || fn_xenith_seccion('🗳 <b>Por valorar</b>', u -> 'porVotar', 'votar')
            || fn_xenith_seccion('✅ <b>Por aprobar</b>', u -> 'porAprobar', 'aprobar')
            || fn_xenith_seccion('⏳ <b>Esperando revisión</b>', u -> 'enRevision', null) as t) x
$$;

-- Lo que ve cada quien. El cruce por correo es el que garantiza que nadie
-- reciba las tareas de otro: solo sale lo del usuario cuyo email coincide.
create or replace function fn_xenith_usuario(payload jsonb, p participantes) returns jsonb
language sql stable as $$
  select x from jsonb_array_elements(coalesce(payload -> 'users', '[]')) x
   where p.xenith_email is not null and lower(x ->> 'email') = lower(p.xenith_email)
   limit 1
$$;

-- /tareas o el agente: la respuesta del endpoint filtrado por el correo de quien pregunta
create or replace function fn_xenith_tareas_de(payload jsonb, chat bigint) returns jsonb
language plpgsql stable as $$
declare
  p participantes;
begin
  if payload -> 'users' is null then
    return jsonb_build_array(fn_send(chat, '⚠️ No pude conectar con Xenith. Intenta en un rato.'));
  end if;
  select * into p from participantes where telegram_user_id = chat;
  if p.id is null then return '[]'::jsonb; end if;
  return jsonb_build_array(fn_send(chat, fn_texto_tareas_xenith(fn_xenith_usuario(payload, p))));
end $$;

-- 7 am: resumen por privado a quien tenga algo pendiente
create or replace function fn_xenith_resumen(payload jsonb) returns jsonb
language plpgsql stable as $$
declare
  acts jsonb := '[]'::jsonb;
  p participantes;
  u jsonb;
begin
  if payload -> 'users' is null then return acts; end if;
  for p in select * from participantes where telegram_user_id is not null and xenith_email is not null order by id loop
    u := fn_xenith_usuario(payload, p);
    if u is null then continue; end if;
    if jsonb_array_length(u -> 'asignadas') + jsonb_array_length(u -> 'porVotar') + jsonb_array_length(u -> 'porAprobar') = 0 then
      continue;
    end if;
    acts := acts || fn_send(p.telegram_user_id, '☀️ Buenos días, ' || fn_html(fn_nombre(p)) || E'.\n\n' || fn_texto_tareas_xenith(u));
  end loop;
  return acts;
end $$;

-- Desde cuándo pedir novedades (ISO en UTC con Z: un '+' se rompe en la URL)
create or replace function fn_xenith_sondeo_desde() returns text
language sql stable as $$
  select to_char(coalesce(nullif(fn_cfg_txt('xenith_sondeo_desde'), '')::timestamptz, now() - interval '15 minutes')
                 at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;

-- Cada 15 min (7–21 h): avisos de lo que pasó desde el último sondeo
create or replace function fn_xenith_novedades(payload jsonb) returns jsonb
language plpgsql as $$
declare
  acts jsonb := '[]'::jsonb;
  p participantes;
  u jsonb;
  lineas text;
begin
  -- Si el endpoint falló no se avanza la marca: el próximo sondeo lo recupera
  if payload -> 'users' is null or payload ->> 'now' is null then return acts; end if;
  update config set valor = to_jsonb(payload ->> 'now') where clave = 'xenith_sondeo_desde';

  for p in select * from participantes where telegram_user_id is not null and xenith_email is not null order by id loop
    u := fn_xenith_usuario(payload, p);
    if u is null or coalesce(jsonb_array_length(u -> 'novedades'), 0) = 0 then continue; end if;
    select string_agg(case n ->> 'tipo'
             when 'asignada' then '🆕 Te asignaron ' || fn_xenith_linea(n -> 'task', fn_xenith_vence(n -> 'task' ->> 'dueDate'))
             when 'votar' then '🗳 Valora ' || fn_xenith_linea(n -> 'task')
             when 'aprobar' then '✅ Espera tu aprobación ' || fn_xenith_linea(n -> 'task')
             when 'rechazada' then '↩️ Rechazaron tu entrega ' || fn_xenith_linea(n -> 'task')
             when 'aceptada' then '🎉 Aceptaron ' || fn_xenith_linea(n -> 'task',
                                    case when n ->> 'points' is not null then '+' || fn_num((n ->> 'points')::numeric) || ' pts' end)
           end, E'\n' order by ord)
      into lineas
      from jsonb_array_elements(u -> 'novedades') with ordinality a(n, ord);
    acts := acts || fn_send(p.telegram_user_id, '🔔 <b>Xenith</b>' || E'\n' || lineas);
  end loop;
  return acts;
end $$;

-- ------------------------------------------------------------ recordatorios

create or replace function fn_texto_recordatorios(pid int) returns text
language sql stable as $$
  select coalesce(E'⏰ <b>Recordatorios pendientes</b>\n' || string_agg(
           '#' || r.id || ' · ' || fn_fecha_corta(r.vence_en) || ' — ' || fn_html(r.texto)
           || case when r.para <> pid then ' <i>(para ' || fn_html(fn_nombre(d)) || ')</i>'
                   when r.creado_por is distinct from pid then ' <i>(de ' || fn_html(fn_nombre(c)) || ')</i>'
                   else '' end,
           E'\n' order by r.vence_en),
         'No tienes recordatorios pendientes. Escríbeme algo como «recuérdame mañana a las 8 llamar al banco».')
    from recordatorios r
    join participantes d on d.id = r.para
    left join participantes c on c.id = r.creado_por
   where r.estado = 'PENDIENTE' and pid in (r.para, r.creado_por)
$$;

-- ------------------------------------------------------------ agente de IA

create or replace function fn_texto_uso_ia(pid int) returns text
language sql stable as $$
  select '🤖 <b>Uso de la IA</b>'
      || E'\nHoy: ' || (select count(*) from uso_ia u where u.participante_id = pid
                         and (u.creado_en at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date)
      || ' de ' || fn_cfg_txt('ia_mensajes_dia') || ' mensajes'
      || E'\nEste mes (los tres): US$ ' || to_char(coalesce(sum(u.costo_usd), 0), 'FM990.000')
      || ' de ' || fn_cfg_txt('ia_tope_mes_usd')
    from uso_ia u
   where date_trunc('month', u.creado_en at time zone 'America/Bogota') = date_trunc('month', now() at time zone 'America/Bogota')
$$;

-- Arma la petición a Anthropic, o corta antes si se pasó algún límite.
-- Devuelve {ok:false, acts} o {ok:true, body, ctx}.
create or replace function fn_agente_preparar(p jsonb) returns jsonb
language plpgsql stable as $$
declare
  yo participantes;
  chat bigint := (p ->> 'chat_id')::bigint;
  texto text := trim(coalesce(p ->> 'texto', ''));
  hoy_n int;
  mes_usd numeric;
  historial jsonb;
  ahora timestamp := now() at time zone 'America/Bogota';
  sistema text;
  destinos jsonb;
  herramientas jsonb;
begin
  select * into yo from participantes where id = (p ->> 'participante_id')::int;
  if yo.id is null or chat is null then return jsonb_build_object('ok', false, 'acts', '[]'::jsonb); end if;

  if length(texto) > fn_cfg_txt('ia_max_caracteres')::int then
    return jsonb_build_object('ok', false, 'acts', jsonb_build_array(fn_send(chat,
      '✂️ Ese mensaje es muy largo para mí (máximo ' || fn_cfg_txt('ia_max_caracteres') || ' caracteres). ¿Me lo resumes?')));
  end if;

  select count(*) into hoy_n from uso_ia
   where participante_id = yo.id
     and (creado_en at time zone 'America/Bogota')::date = ahora::date;
  if hoy_n >= fn_cfg_txt('ia_mensajes_dia')::int then
    return jsonb_build_object('ok', false, 'acts', jsonb_build_array(fn_send(chat,
      '🔋 Llegaste al límite de ' || fn_cfg_txt('ia_mensajes_dia') || ' mensajes con la IA por hoy. '
      || 'Mañana sigo. Mientras tanto funcionan /tareas, /recordatorios y /metas.')));
  end if;

  select coalesce(sum(costo_usd), 0) into mes_usd from uso_ia
   where date_trunc('month', creado_en at time zone 'America/Bogota') = date_trunc('month', ahora);
  if mes_usd >= fn_cfg_txt('ia_tope_mes_usd')::numeric then
    return jsonb_build_object('ok', false, 'acts', jsonb_build_array(fn_send(chat,
      '🔋 La IA llegó al tope de gasto de este mes. Vuelve el 1.º. Mientras tanto funcionan /tareas, /recordatorios y /metas.')));
  end if;

  -- Memoria corta: últimos turnos recientes, empezando siempre por un mensaje del usuario
  select coalesce(jsonb_agg(jsonb_build_object('role', h.rol, 'content', h.texto) order by h.id), '[]'::jsonb)
    into historial
    from (select * from chat_ia
           where participante_id = yo.id
             and creado_en > now() - make_interval(mins => fn_cfg_txt('ia_memoria_min')::int)
           order by id desc limit fn_cfg_txt('ia_memoria_turnos')::int) h;
  while jsonb_array_length(historial) > 0 and historial -> 0 ->> 'role' = 'assistant' loop
    historial := historial - 0;
  end loop;

  select jsonb_agg(slug order by id) || '["yo"]'::jsonb into destinos from participantes;

  sistema := 'Eres el asistente del bot de Telegram del equipo Xenith y hablas por chat privado con '
    || fn_nombre(yo) || '. El equipo son Camilo, Nicolás y David (le dicen Potro).' || E'\n'
    || 'Ayudas con tres cosas y nada más: recordatorios personales (crear, ver, cambiar, cancelar), '
    || 'las tareas que tiene asignadas en el CRM de Xenith, y su avance en el reto anual del equipo.' || E'\n'
    || 'Reglas:' || E'\n'
    || '- Usa las herramientas para actuar o consultar; nunca inventes tareas, metas ni recordatorios.' || E'\n'
    || '- Para crear un recordatorio necesitas qué y cuándo. Si falta la hora exacta, pregunta en una frase.' || E'\n'
    || '- Las fechas relativas (mañana, el viernes, en 2 horas) se calculan desde la fecha actual que llega en cada mensaje, hora de Bogotá.' || E'\n'
    || '- Responde en español, en máximo 3 frases, texto plano sin markdown.' || E'\n'
    || '- Si piden algo fuera de esto, dilo amablemente en una frase y menciona /tareas, /recordatorios o /metas.' || E'\n'
    || '- Una de las metas del reto se llama "Maria"; nunca escribas otro nombre para ella.';

  herramientas := jsonb_build_array(
    jsonb_build_object('name', 'crear_recordatorio',
      'description', 'Programa un recordatorio que el bot enviará por privado a la hora indicada y repetirá cada 3 horas hasta que lo marquen como hecho.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false,
        'required', jsonb_build_array('texto', 'fecha_hora', 'para'),
        'properties', jsonb_build_object(
          'texto', jsonb_build_object('type', 'string', 'description', 'Qué hay que recordar, corto y claro.'),
          'fecha_hora', jsonb_build_object('type', 'string', 'description', 'Fecha y hora en Bogotá, formato YYYY-MM-DD HH:MM (24 h).'),
          'para', jsonb_build_object('type', 'string', 'enum', destinos, 'description', '"yo" si es para quien escribe.')))),
    jsonb_build_object('name', 'ver_recordatorios',
      'description', 'Lista los recordatorios pendientes de quien escribe (con su número #id).',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false, 'properties', '{}'::jsonb)),
    jsonb_build_object('name', 'cambiar_recordatorio',
      'description', 'Cambia la hora y/o el texto de un recordatorio pendiente por su #id.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false,
        'required', jsonb_build_array('id'),
        'properties', jsonb_build_object(
          'id', jsonb_build_object('type', 'integer'),
          'fecha_hora', jsonb_build_object('type', 'string', 'description', 'Nueva fecha y hora, YYYY-MM-DD HH:MM.'),
          'texto', jsonb_build_object('type', 'string')))),
    jsonb_build_object('name', 'cancelar_recordatorio',
      'description', 'Cancela un recordatorio pendiente por su #id.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false,
        'required', jsonb_build_array('id'),
        'properties', jsonb_build_object('id', jsonb_build_object('type', 'integer')))),
    jsonb_build_object('name', 'ver_tareas_xenith',
      'description', 'Muestra las tareas pendientes de quien escribe en el CRM de Xenith: por hacer, por valorar y por aprobar.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false, 'properties', '{}'::jsonb)),
    jsonb_build_object('name', 'ver_metas_reto',
      'description', 'Muestra el avance de quien escribe en sus metas del reto anual.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false, 'properties', '{}'::jsonb)));

  return jsonb_build_object('ok', true,
    'ctx', jsonb_build_object('participante_id', yo.id, 'chat_id', chat, 'texto', texto),
    'body', jsonb_build_object(
      'model', fn_cfg_txt('ia_modelo'),
      'max_tokens', fn_cfg_txt('ia_max_tokens')::int,
      'system', sistema,
      'tools', herramientas,
      'tool_choice', jsonb_build_object('type', 'auto', 'disable_parallel_tool_use', true),
      'messages', historial || jsonb_build_array(jsonb_build_object('role', 'user', 'content',
        '[Ahora: ' || (array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[extract(dow from ahora)::int + 1]
        || ' ' || to_char(ahora, 'YYYY-MM-DD HH24:MI') || ']' || E'\n' || texto))));
end $$;

-- Interpreta la respuesta del modelo: ejecuta la herramienta elegida (una sola,
-- sin segunda llamada) y arma el mensaje con plantillas. Registra el consumo.
create or replace function fn_agente_responder(ctx jsonb, resp jsonb) returns jsonb
language plpgsql as $$
declare
  yo participantes;
  otro participantes;
  chat bigint := (ctx ->> 'chat_id')::bigint;
  tin int := coalesce((resp -> 'usage' ->> 'input_tokens')::int, 0);
  tout int := coalesce((resp -> 'usage' ->> 'output_tokens')::int, 0);
  bloque jsonb;
  herr text;
  inp jsonb;
  texto_modelo text;
  respuesta text;
  memoria text;
  acts jsonb := '[]'::jsonb;
  res jsonb;
  cuando timestamptz;
  r recordatorios;
begin
  select * into yo from participantes where id = (ctx ->> 'participante_id')::int;
  if yo.id is null then return acts; end if;

  if resp -> 'content' is null then
    insert into uso_ia (participante_id, error)
    values (yo.id, left(coalesce(resp -> 'error' ->> 'message', resp::text), 500));
    return jsonb_build_array(fn_send(chat, '⚠️ No pude pensar ahora mismo. Intenta en un rato, o usa /tareas, /recordatorios o /metas.'));
  end if;

  select b into bloque from jsonb_array_elements(resp -> 'content') b where b ->> 'type' = 'tool_use' limit 1;
  select string_agg(b ->> 'text', E'\n') into texto_modelo
    from jsonb_array_elements(resp -> 'content') b where b ->> 'type' = 'text';
  herr := bloque ->> 'name';
  inp := coalesce(bloque -> 'input', '{}'::jsonb);

  if herr = 'crear_recordatorio' then
    cuando := fn_parse_fecha_local(inp ->> 'fecha_hora');
    if cuando is null then
      respuesta := 'No entendí la fecha. ¿Me la repites? (por ejemplo: mañana a las 8 am)';
    elsif cuando < now() - interval '2 minutes' then
      respuesta := 'Esa hora ya pasó 🙃 ¿Para cuándo lo programo?';
    elsif cuando > now() + interval '400 days' then
      respuesta := 'Solo programo recordatorios para el próximo año como mucho.';
    else
      res := fn_crear_recordatorio(yo.telegram_user_id, coalesce(inp ->> 'para', 'yo'), left(trim(inp ->> 'texto'), 300), cuando);
      if (res ->> 'ok')::boolean then
        select * into otro from participantes p where p.id = (select para from recordatorios where id = (res ->> 'id')::int);
        respuesta := '⏰ Listo (#' || (res ->> 'id') || '): '
          || case when otro.id = yo.id then 'te recuerdo' else 'le recuerdo a ' || fn_html(fn_nombre(otro)) end
          || ' «' || fn_html(left(trim(inp ->> 'texto'), 300)) || '» el ' || fn_fecha_corta(cuando) || '.'
          || case when otro.id <> yo.id and otro.telegram_user_id is null
                  then E'\n⚠️ ' || fn_html(fn_nombre(otro)) || ' aún no se ha registrado en el bot, así que no le llegará.' else '' end;
      else
        respuesta := '⚠️ ' || fn_html(res ->> 'error');
      end if;
    end if;

  elsif herr = 'ver_recordatorios' then
    respuesta := fn_texto_recordatorios(yo.id);

  elsif herr = 'cambiar_recordatorio' then
    cuando := fn_parse_fecha_local(inp ->> 'fecha_hora');
    if inp ? 'fecha_hora' and (cuando is null or cuando < now() - interval '2 minutes') then
      respuesta := 'Esa fecha no me sirve (no la entendí o ya pasó). ¿Cuál sería?';
    else
      update recordatorios
         set texto = coalesce(left(nullif(trim(inp ->> 'texto'), ''), 300), texto),
             vence_en = coalesce(cuando, vence_en),
             proximo_aviso = coalesce(cuando, proximo_aviso),
             avisos_enviados = case when cuando is not null then 0 else avisos_enviados end
       where id = (inp ->> 'id')::int and estado = 'PENDIENTE' and yo.id in (para, creado_por)
      returning * into r;
      respuesta := case when r.id is null then 'No encontré ese recordatorio entre tus pendientes.'
                        else '✏️ Cambiado (#' || r.id || '): «' || fn_html(r.texto) || '» el ' || fn_fecha_corta(r.vence_en) || '.' end;
    end if;

  elsif herr = 'cancelar_recordatorio' then
    update recordatorios set estado = 'CANCELADO'
     where id = (inp ->> 'id')::int and estado = 'PENDIENTE' and yo.id in (para, creado_por)
    returning * into r;
    respuesta := case when r.id is null then 'No encontré ese recordatorio entre tus pendientes.'
                      else '🗑 Cancelado: «' || fn_html(r.texto) || '».' end;

  elsif herr = 'ver_tareas_xenith' then
    if yo.xenith_email is null then
      respuesta := 'Tu usuario del bot no está enlazado con Xenith todavía.';
    else
      acts := jsonb_build_array(fn_accion('__tareas', jsonb_build_object('chat_id', chat, 'email', yo.xenith_email)));
      memoria := '(le mostré sus tareas pendientes de Xenith)';
    end if;

  elsif herr = 'ver_metas_reto' then
    respuesta := fn_texto_avance(yo.id);
    memoria := '(le mostré el avance de sus metas del reto)';

  else
    respuesta := fn_html(coalesce(nullif(trim(texto_modelo), ''), '🤔 No te entendí. ¿Me lo dices de otra forma?'));
  end if;

  if respuesta is not null then acts := acts || fn_send(chat, respuesta); end if;

  insert into uso_ia (participante_id, tokens_entrada, tokens_salida, costo_usd, herramienta)
  values (yo.id, tin, tout,
          (tin * fn_cfg_txt('ia_precio_entrada')::numeric + tout * fn_cfg_txt('ia_precio_salida')::numeric) / 1000000,
          herr);

  insert into chat_ia (participante_id, rol, texto) values
    (yo.id, 'user', ctx ->> 'texto'),
    (yo.id, 'assistant', left(coalesce(memoria,
      replace(replace(replace(regexp_replace(respuesta, '<[^>]+>', '', 'g'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')), 600));
  delete from chat_ia where creado_en < now() - interval '2 days';

  return acts;
end $$;

grant execute on all functions in schema public to reto_app;
commit;
