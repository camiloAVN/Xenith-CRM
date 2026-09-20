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
  ('recordatorio_anticipo_min', '15', 'Minutos de anticipación del primer aviso de un recordatorio'),
  ('ia_grupo_probabilidad', '0.18', 'Probabilidad de que el bot se meta en una conversación del grupo'),
  ('ia_grupo_cooldown_min', '40', 'Minutos mínimos entre dos intervenciones del bot en el grupo'),
  ('ia_grupo_dia', '8', 'Máximo de intervenciones del bot en el grupo por día'),
  ('ia_grupo_ultimo', 'null', 'Última vez que el bot opinó en el grupo (la maneja fn_grupo_puede_opinar)'),
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

-- Sprints corriendo: la caja de tiempo y cuánto comprometió la persona
create or replace function fn_xenith_sprints(items jsonb) returns text
language sql stable as $$
  select case when coalesce(jsonb_array_length(items), 0) = 0 then '' else
    E'\n\n🏃 <b>Sprint</b>\n' || string_agg(
      '• ' || fn_html(x ->> 'name') || ' · ' || fn_html(x ->> 'project')
        || ' · ' || case
             when (x ->> 'daysLeft')::int > 1 then 'quedan ' || (x ->> 'daysLeft') || ' días'
             when (x ->> 'daysLeft')::int = 1 then 'queda 1 día'
             when (x ->> 'daysLeft')::int = 0 then 'termina hoy'
             else 'venció hace ' || abs((x ->> 'daysLeft')::int) || ' días' end
        || ' · ' || fn_num((x ->> 'accepted')::numeric) || ' de '
        || fn_num((x ->> 'committed')::numeric) || ' pts aceptados',
      E'\n' order by n)
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
  from (select fn_xenith_sprints(u -> 'sprints')
            || fn_xenith_seccion('🛠 <b>Por hacer</b>', u -> 'asignadas', 'asignada')
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

-- Cómo va el equipo: una línea por persona con lo que tiene encima.
-- El detalle de cada quien se pide aparte; esto es el vistazo rápido.
create or replace function fn_texto_equipo(payload jsonb) returns text
language sql stable as $$
  select '👥 <b>Cómo va el equipo en Xenith</b>' || coalesce(E'\n' || string_agg(
      '• <b>' || fn_html(coalesce(fn_nombre(p), split_part(x ->> 'email', '@', 1))) || '</b> — '
      || jsonb_array_length(x -> 'asignadas') || ' por hacer · '
      || jsonb_array_length(x -> 'enRevision') || ' en revisión · '
      || jsonb_array_length(x -> 'porAprobar') || ' por aprobar'
      || case when jsonb_array_length(x -> 'asignadas') + jsonb_array_length(x -> 'enRevision') = 0
              then ' 😴' else '' end,
      E'\n' order by p.id nulls last), E'\nNadie tiene nada. Sospechoso.')
    from jsonb_array_elements(coalesce(payload -> 'users', '[]')) x
    -- JOIN, no LEFT JOIN: en Xenith puede haber más usuarios (equipo ampliado)
    -- que sí reciben correos pero NO están en el bot. Aquí solo salen los tres
    -- del reto; los demás no aparecen ni en /equipo ni en ningún aviso.
    join participantes p on lower(p.xenith_email) = lower(x ->> 'email')
$$;

-- Firma vieja (payload, chat bigint) reemplazada por (payload, params jsonb).
drop function if exists fn_xenith_tareas_de(jsonb, bigint);

-- /tareas, /equipo o el agente. `params` trae chat_id y, según el caso,
-- `email` + `de` (pendientes de otra persona) o `modo = equipo`.
create or replace function fn_xenith_tareas_de(payload jsonb, params jsonb) returns jsonb
language plpgsql stable as $$
declare
  chat bigint := (params ->> 'chat_id')::bigint;
  p participantes;
  u jsonb;
begin
  if payload -> 'users' is null then
    return jsonb_build_array(fn_send(chat, '⚠️ No pude conectar con Xenith. Intenta en un rato.'));
  end if;

  if params ->> 'modo' = 'equipo' then
    return jsonb_build_array(fn_send(chat, fn_texto_equipo(payload)));
  end if;

  -- Preguntar por otro: el endpoint ya vino filtrado por SU correo, así que
  -- users[0] es esa persona. Se puede consultar a cualquiera del equipo; lo
  -- que nunca se mezcla es lo que el bot MANDA solo (avisos y resumen diario).
  if params ->> 'de' is not null then
    u := payload -> 'users' -> 0;
    if u is null then
      return jsonb_build_array(fn_send(chat, 'No encontré a esa persona en Xenith.'));
    end if;
    return jsonb_build_array(fn_send(chat,
      replace(fn_texto_tareas_xenith(u), 'Tus pendientes en Xenith',
              'Pendientes de ' || fn_html(params ->> 'de'))));
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
    acts := acts || fn_send(p.telegram_user_id,
      '☀️ Despierte, ' || fn_html(fn_nombre(p)) || E'. Esto es lo que tiene encima:\n' || fn_texto_tareas_xenith(u));
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
           '#' || r.id || ' · ' || fn_fecha_corta(r.vence_en)
           || case when r.anticipo_min > 0 then ' <i>(aviso ' || r.anticipo_min || ' min antes)</i>' else '' end
           || ' — ' || fn_html(r.texto)
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

-- ------------------------------------------------------------ vida en el grupo

/**
 * ¿El bot se mete en esta conversación?
 *
 * Tres frenos, en este orden: que no hable encima de sí mismo (cooldown), que
 * no se vuelva plaga (tope diario) y que no conteste todo (probabilidad). Un
 * bot que responde cada mensaje deja de ser gracioso en dos días; uno que cae
 * de vez en cuando se siente parte del parche.
 *
 * Consume la decisión: si dice que sí, deja marcado el momento, así que dos
 * mensajes seguidos no pueden colarse los dos.
 */
create or replace function fn_grupo_puede_opinar() returns boolean
language plpgsql as $$
declare
  ultimo timestamptz := nullif(fn_cfg_txt('ia_grupo_ultimo'), '')::timestamptz;
  hoy int;
begin
  if ultimo is not null
     and ultimo > now() - make_interval(mins => fn_cfg_txt('ia_grupo_cooldown_min')::int) then
    return false;
  end if;

  select count(*) into hoy from uso_ia
   where herramienta = '__grupo'
     and (creado_en at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date;
  if hoy >= fn_cfg_txt('ia_grupo_dia')::int then return false; end if;

  if random() >= fn_cfg_txt('ia_grupo_probabilidad')::numeric then return false; end if;

  update config set valor = to_jsonb(now()) where clave = 'ia_grupo_ultimo';
  return true;
end $$;

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
  -- 'privado' (por defecto), 'grupo' (se metió en la conversación) o
  -- 'arenga' (el reloj le pidió que joda a los que no han hecho nada).
  modo text := coalesce(p ->> 'modo', 'privado');
  hoy_n int;
  mes_usd numeric;
  historial jsonb;
  ahora timestamp := now() at time zone 'America/Bogota';
  sistema text;
  destinos jsonb;
  herramientas jsonb;
begin
  select * into yo from participantes where id = (p ->> 'participante_id')::int;
  if chat is null then return jsonb_build_object('ok', false, 'acts', '[]'::jsonb); end if;
  -- La arenga la dispara el reloj, no una persona: no hay `yo`.
  if yo.id is null and modo <> 'arenga' then
    return jsonb_build_object('ok', false, 'acts', '[]'::jsonb);
  end if;

  if length(texto) > fn_cfg_txt('ia_max_caracteres')::int then
    return jsonb_build_object('ok', false, 'acts', jsonb_build_array(fn_send(chat,
      '✂️ Ese mensaje es muy largo para mí (máximo ' || fn_cfg_txt('ia_max_caracteres') || ' caracteres). ¿Me lo resumes?')));
  end if;

  select count(*) into hoy_n from uso_ia
   where participante_id = yo.id
     and herramienta is distinct from '__grupo'
     and (creado_en at time zone 'America/Bogota')::date = ahora::date;
  if modo = 'privado' and hoy_n >= fn_cfg_txt('ia_mensajes_dia')::int then
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

  sistema := 'Eres el bot del parche de Xenith y hablas por privado con ' || fn_nombre(yo)
    || '. El combo son Camilo, Nicolás y David (alias Potro): tres socios que se joden entre ellos todo el día.' || E'\n'
    || 'Ayudas con tres cosas y nada más: recordatorios personales (crear, ver, cambiar, cancelar), '
    || 'las tareas del CRM de Xenith (las suyas o las de otro, si pregunta) y el avance del reto anual.' || E'\n'
    || 'TU TONO (esto es lo que te hace tú):' || E'\n'
    || '- Colombiano, callejero y mamagallista. Parcero, marica, güevón, no joda, hágale pues, qué pereza, '
    || 'deje de gaminear, póngase las pilas, ni por el putas, ah mijo. Tutea o vosea, nunca usted formal.' || E'\n'
    || '- Grosero y burlón con ellos, pero nunca cruel: se burla de la pereza y del incumplimiento, no de la persona. '
    || 'Nada de racismo, sexismo ni insultos a la familia.' || E'\n'
    || '- CORTO. Una o dos frases, máximo. Si te extiendes, perdiste la gracia.' || E'\n'
    || '- Si alguien va atrasado o lleva días sin entregar, se lo echas en cara. Si cumplió, lo reconoces con una '
    || 'palmada seca ("bien ahí") y sigues.' || E'\n'
    || 'Reglas duras:' || E'\n'
    || '- Usa las herramientas para actuar o consultar; nunca inventes tareas, metas ni recordatorios.' || E'\n'
    || '- Para crear un recordatorio necesitas qué y cuándo. Si falta la hora, pregunta en UNA frase.' || E'\n'
    || '- En fecha_hora va LA HORA DEL EVENTO, no la del aviso: el bot avisa 15 min antes por defecto. '
    || 'Si piden otra anticipación ("avísame una hora antes"), usa avisar_antes_min.' || E'\n'
    || '- Las fechas relativas (mañana, el viernes, en 2 horas) se calculan desde la fecha actual que llega en cada mensaje, hora de Bogotá.' || E'\n'
    || '- Si preguntan por otra persona del equipo, usa ver_tareas_xenith con esa persona.' || E'\n'
    || '- Texto plano, sin markdown, sin emojis de más (uno basta).' || E'\n'
    || '- Si piden algo fuera de esto, los mandas a volar en una frase y mencionas /tareas, /equipo, /recordatorios o /metas.' || E'\n'
    || '- Una de las metas del reto se llama "Maria"; nunca escribas otro nombre para ella.';

  herramientas := jsonb_build_array(
    jsonb_build_object('name', 'crear_recordatorio',
      'description', 'Programa un recordatorio que el bot enviará por privado a la hora indicada y repetirá cada 3 horas hasta que lo marquen como hecho.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false,
        'required', jsonb_build_array('texto', 'fecha_hora', 'para'),
        'properties', jsonb_build_object(
          'texto', jsonb_build_object('type', 'string', 'description', 'Qué hay que recordar, corto y claro.'),
          'fecha_hora', jsonb_build_object('type', 'string', 'description', 'LA HORA DEL EVENTO en Bogotá, formato YYYY-MM-DD HH:MM (24 h). El aviso sale antes, no a esta hora.'),
          'avisar_antes_min', jsonb_build_object('type', 'integer', 'description', 'Minutos de anticipación del aviso. Por defecto 15; súbelo si piden "avísame media hora antes".'),
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
      'description', 'Muestra las tareas pendientes en el CRM de Xenith: por hacer, por valorar y por aprobar. '
        || 'Sin "persona" muestra las de quien escribe; con el nombre de un compañero, las de esa persona; '
        || 'con "todos", un resumen de cómo va el equipo. Úsala también para saber si alguien ya terminó su trabajo.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false,
        'properties', jsonb_build_object(
          'persona', jsonb_build_object('type', 'string', 'enum', destinos || '["todos"]'::jsonb,
            'description', '"yo" o se omite para las propias.')))),
    jsonb_build_object('name', 'ver_metas_reto',
      'description', 'Muestra el avance de quien escribe en sus metas del reto anual.',
      'input_schema', jsonb_build_object('type', 'object', 'additionalProperties', false, 'properties', '{}'::jsonb)));

  -- En el grupo el bot es un contertulio, no un asistente: ni herramientas ni
  -- memoria, una sola línea y permiso explícito para quedarse callado.
  if modo = 'grupo' then
    sistema := 'Estás en el grupo de WhatsApp... perdón, de Telegram, del parche de Xenith: Camilo, Nicolás y David (Potro), '
      || 'tres socios que se joden entre ellos todo el día y tienen un reto de un año con plata de por medio.' || E'\n'
      || 'Acabas de leer un mensaje del grupo. Suelta UNA sola línea, corta, colombiana y mamagallista, como un cuarto '
      || 'integrante que se mete a joder. Parcero, marica, güevón, no joda, hágale pues, deje de gaminear.' || E'\n'
      || 'Reglas: máximo 15 palabras. Nada de saludar, explicar, ofrecer ayuda ni hacer preguntas de asistente. '
      || 'No repitas lo que dijeron. Si no se te ocurre nada bueno, responde exactamente: NADA' || E'\n'
      || 'Una de las metas del reto se llama "Maria"; nunca escribas otro nombre para ella.';
    return jsonb_build_object('ok', true,
      'ctx', jsonb_build_object('participante_id', yo.id, 'chat_id', chat, 'texto', texto,
                                'modo', 'grupo', 'reply_to', p ->> 'reply_to'),
      'body', jsonb_build_object(
        'model', fn_cfg_txt('ia_modelo'),
        'max_tokens', 100,
        'system', sistema,
        'messages', jsonb_build_array(jsonb_build_object('role', 'user', 'content',
          fn_nombre(yo) || ' escribió en el grupo: ' || texto))));
  end if;

  if modo = 'arenga' then
    sistema := 'Eres el bot del reto anual del parche de Xenith: Camilo, Nicolás y David (Potro). '
      || 'Tu trabajo ahora es joderlos para que no abandonen el reto.' || E'\n'
      || 'Con los datos que te paso, escribe UNA arenga de máximo 25 palabras: colombiana, grosera, mamagallista y '
      || 'con nombre propio. Si alguien lleva días sin subir nada, se lo echas en cara. Si todos cumplieron, los felicitas seco.' || E'\n'
      || 'Nada de listas, nada de emojis de más (uno basta), nada de explicar el reto: ellos ya saben qué es. '
      || 'No inventes datos: usa solo los que te doy.' || E'\n'
      || 'Una de las metas del reto se llama "Maria"; nunca escribas otro nombre para ella.';
    return jsonb_build_object('ok', true,
      'ctx', jsonb_build_object('chat_id', chat, 'modo', 'arenga',
                                'menciones', p ->> 'menciones', 'fallback', p ->> 'fallback'),
      'body', jsonb_build_object(
        'model', fn_cfg_txt('ia_modelo'),
        'max_tokens', 120,
        'system', sistema,
        'messages', jsonb_build_array(jsonb_build_object('role', 'user', 'content', texto))));
  end if;

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

  -- Grupo y arenga: una sola línea, sin herramientas y sin memoria.
  if (ctx ->> 'modo') in ('grupo', 'arenga') then
    select string_agg(b ->> 'text', E'\n') into texto_modelo
      from jsonb_array_elements(coalesce(resp -> 'content', '[]'::jsonb)) b
     where b ->> 'type' = 'text';
    texto_modelo := trim(coalesce(texto_modelo, ''));

    insert into uso_ia (participante_id, tokens_entrada, tokens_salida, costo_usd, herramienta, error)
    values (coalesce(yo.id, 1), tin, tout,
            (tin * fn_cfg_txt('ia_precio_entrada')::numeric + tout * fn_cfg_txt('ia_precio_salida')::numeric) / 1000000,
            '__' || (ctx ->> 'modo'),
            case when resp -> 'content' is null then left(resp::text, 300) end);

    if ctx ->> 'modo' = 'arenga' then
      -- Si el modelo falla, igual sale el reclamo: el texto de respaldo lo
      -- armó SQL antes de llamarlo.
      if texto_modelo = '' or resp -> 'content' is null then
        texto_modelo := coalesce(ctx ->> 'fallback', '');
        if texto_modelo = '' then return acts; end if;
        return jsonb_build_array(fn_send(chat, texto_modelo));
      end if;
      -- Las menciones las pone SQL: así el tag de Telegram siempre funciona,
      -- diga lo que diga el modelo.
      return jsonb_build_array(fn_send(chat,
        fn_html(texto_modelo) || coalesce(E'\n' || (ctx ->> 'menciones'), '')));
    end if;

    -- En el grupo, quedarse callado es una respuesta válida.
    if texto_modelo = '' or upper(texto_modelo) = 'NADA' or resp -> 'content' is null then
      return acts;
    end if;
    return jsonb_build_array(fn_send(chat, fn_html(texto_modelo), null,
      nullif(ctx ->> 'reply_to', '')::bigint));
  end if;

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
      res := fn_crear_recordatorio(yo.telegram_user_id, coalesce(inp ->> 'para', 'yo'),
        left(trim(inp ->> 'texto'), 300), cuando, (inp ->> 'avisar_antes_min')::int);
      if (res ->> 'ok')::boolean then
        select * into otro from participantes p where p.id = (select para from recordatorios where id = (res ->> 'id')::int);
        respuesta := '⏰ Listo (#' || (res ->> 'id') || '): '
          || case when otro.id = yo.id then 'te aviso' else 'le aviso a ' || fn_html(fn_nombre(otro)) end
          || ' ' || (res ->> 'anticipo_min') || ' min antes de «'
          || fn_html(left(trim(inp ->> 'texto'), 300)) || '» (' || fn_fecha_corta(cuando) || ').'
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
             anticipo_min = coalesce((inp ->> 'avisar_antes_min')::int, anticipo_min),
             -- El aviso vuelve a calcularse con la anticipación, no con la hora.
             proximo_aviso = greatest(
               coalesce(cuando, vence_en)
                 - make_interval(mins => coalesce((inp ->> 'avisar_antes_min')::int, anticipo_min)),
               now()),
             avisos_enviados = case when cuando is not null then 0 else avisos_enviados end
       where id = (inp ->> 'id')::int and estado = 'PENDIENTE' and yo.id in (para, creado_por)
      returning * into r;
      respuesta := case when r.id is null then 'No encontré ese recordatorio entre tus pendientes.'
                        else '✏️ Cambiado (#' || r.id || '): «' || fn_html(r.texto) || '», aviso '
                             || r.anticipo_min || ' min antes de ' || fn_fecha_corta(r.vence_en) || '.' end;
    end if;

  elsif herr = 'cancelar_recordatorio' then
    update recordatorios set estado = 'CANCELADO'
     where id = (inp ->> 'id')::int and estado = 'PENDIENTE' and yo.id in (para, creado_por)
    returning * into r;
    respuesta := case when r.id is null then 'No encontré ese recordatorio entre tus pendientes.'
                      else '🗑 Cancelado: «' || fn_html(r.texto) || '».' end;

  elsif herr = 'ver_tareas_xenith' then
    -- A quién le pregunta. El correo SIEMPRE sale de la tabla, nunca del
    -- modelo: lo más que puede hacer es nombrar a alguien del equipo.
    if coalesce(inp ->> 'persona', 'yo') = 'todos' then
      acts := jsonb_build_array(fn_accion('__tareas', jsonb_build_object('chat_id', chat, 'modo', 'equipo')));
      memoria := '(le mostré cómo va todo el equipo)';
    else
      if coalesce(inp ->> 'persona', 'yo') in ('yo', 'me') then
        otro := yo;
      else
        select * into otro from participantes
         where lower(inp ->> 'persona') in (lower(slug), lower(nombre), lower(coalesce(apodo, '')), lower(split_part(nombre, ' ', 1)))
         limit 1;
      end if;
      if otro.id is null then
        respuesta := 'No sé quién es ese. Aquí solo estamos Camilo, Nicolás y el Potro.';
      elsif otro.xenith_email is null then
        respuesta := fn_html(fn_nombre(otro)) || ' no está enlazado con Xenith todavía.';
      else
        acts := jsonb_build_array(fn_accion('__tareas', jsonb_build_object(
          'chat_id', chat, 'email', otro.xenith_email,
          'de', case when otro.id = yo.id then null else fn_nombre(otro) end)));
        memoria := '(le mostré las tareas de ' || fn_nombre(otro) || ')';
      end if;
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
