-- Lógica del bot del reto. Cada función devuelve un arreglo JSON de "acciones"
-- [{metodo, params}] que n8n ejecuta tal cual contra la API de Telegram.
\set ON_ERROR_STOP on
begin;

alter table evidencias add column if not exists aviso_borrador_en timestamptz;

-- ------------------------------------------------------------ utilidades

create or replace function fn_cfg_txt(k text) returns text
language sql stable as $$ select valor #>> '{}' from config where clave = k $$;

-- null entra, null sale: así los coalesce(' · ' || fn_html(x), '') funcionan
create or replace function fn_html(t text) returns text
language sql immutable as $$
  select replace(replace(replace(t, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

create or replace function fn_nombre(p participantes) returns text
language sql stable as $$ select coalesce(p.apodo, split_part(p.nombre, ' ', 1)) $$;

create or replace function fn_mencion(p participantes) returns text
language sql stable as $$
  select case when p.telegram_user_id is null then fn_html(fn_nombre(p))
              else '<a href="tg://user?id=' || p.telegram_user_id || '">' || fn_html(fn_nombre(p)) || '</a>' end
$$;

create or replace function fn_emoji(categoria text) returns text
language sql immutable as $$
  select case categoria
    when 'físico' then '💪' when 'económico' then '💰' when 'intelectual' then '📚'
    when 'idiomas' then '🗣' when 'profesional' then '🎓' when 'creativo' then '🎵'
    when 'mental' then '♟️' when 'social' then '🤝' when 'salud' then '🌿' else '🎯' end
$$;

-- 1500 → "1.500" · 18.5 → "18,5"
create or replace function fn_num(n numeric) returns text
language sql immutable as $$
  select translate(rtrim(to_char(n, 'FM999,999,999,990.99'), '.'), ',.', '.,')
$$;

-- Interpreta cifras escritas a mano: "1.500", "18,5", "15M", "200k", "+1"
create or replace function fn_parse_num(t text) returns numeric
language plpgsql immutable as $$
declare
  s text := lower(regexp_replace(coalesce(t, ''), '\s|\$|cop|%|kg|\+', '', 'g'));
  mult numeric := 1;
begin
  if s ~ 'm$' then mult := 1000000; s := left(s, -1);
  elsif s ~ 'k$' then mult := 1000; s := left(s, -1);
  end if;
  if s ~ '^\d{1,3}(\.\d{3})+(,\d+)?$' then s := replace(replace(s, '.', ''), ',', '.');
  elsif s ~ '^\d{1,3}(,\d{3})+(\.\d+)?$' then s := replace(s, ',', '');
  elsif s ~ '^\d+,\d+$' then s := replace(s, ',', '.');
  end if;
  if s !~ '^\d+(\.\d+)?$' then return null; end if;
  return s::numeric * mult;
end $$;

create or replace function fn_barra(pct numeric) returns text
language sql immutable as $$
  select repeat('▓', round(coalesce(pct, 0) / 10)::int) || repeat('░', 10 - round(coalesce(pct, 0) / 10)::int)
$$;

-- Fracción del reto transcurrida (0 antes de empezar, 100 al terminar)
create or replace function fn_ritmo_pct() returns numeric
language sql stable as $$
  select round(least(greatest(
    extract(epoch from now() - fn_cfg_txt('reto_inicio')::timestamptz)
    / extract(epoch from fn_cfg_txt('reto_fin')::timestamptz - fn_cfg_txt('reto_inicio')::timestamptz), 0), 1) * 100, 1)
$$;

-- Corre un aviso fuera del horario de silencio (hora Bogotá)
create or replace function fn_siguiente_aviso(ts timestamptz) returns timestamptz
language plpgsql stable as $$
declare
  loc timestamp := ts at time zone 'America/Bogota';
  desde int := (fn_cfg_txt('horario_silencio')::jsonb ->> 'desde')::int;
  hasta int := (fn_cfg_txt('horario_silencio')::jsonb ->> 'hasta')::int;
  h int := extract(hour from loc);
begin
  if h >= desde then return (loc::date + 1 + make_interval(hours => hasta)) at time zone 'America/Bogota'; end if;
  if h < hasta then return (loc::date + make_interval(hours => hasta)) at time zone 'America/Bogota'; end if;
  return ts;
end $$;

-- ------------------------------------------------------------ acciones de Telegram

create or replace function fn_accion(metodo text, params jsonb) returns jsonb
language sql immutable as $$ select jsonb_build_object('metodo', metodo, 'params', jsonb_strip_nulls(params)) $$;

create or replace function fn_send(chat bigint, texto text, markup jsonb default null, reply_to bigint default null)
returns jsonb language sql immutable as $$
  select fn_accion('sendMessage', jsonb_build_object(
    'chat_id', chat, 'text', texto, 'parse_mode', 'HTML', 'reply_markup', markup,
    'link_preview_options', jsonb_build_object('is_disabled', true),
    'reply_parameters', case when reply_to is not null
      then jsonb_build_object('message_id', reply_to, 'allow_sending_without_reply', true) end))
$$;

create or replace function fn_edit(chat bigint, msg bigint, texto text, markup jsonb default null)
returns jsonb language sql immutable as $$
  select fn_accion('editMessageText', jsonb_build_object(
    'chat_id', chat, 'message_id', msg, 'text', texto, 'parse_mode', 'HTML', 'reply_markup', markup,
    'link_preview_options', jsonb_build_object('is_disabled', true)))
$$;

create or replace function fn_answer(cq_id text, texto text, alerta boolean default false)
returns jsonb language sql immutable as $$
  select fn_accion('answerCallbackQuery', jsonb_build_object('callback_query_id', cq_id, 'text', texto, 'show_alert', alerta))
$$;

create or replace function fn_boton(texto text, data text) returns jsonb
language sql immutable as $$ select jsonb_build_object('text', texto, 'callback_data', data) $$;

-- ------------------------------------------------------------ textos

create or replace function fn_texto_ayuda() returns text
language sql immutable as $$
  select E'🤖 <b>Bot del reto Xenith</b>\n\n'
      || E'📸 Sube una foto o video al grupo y te pregunto a qué meta corresponde. '
      || E'Basta con que uno de los otros dos la apruebe (+5 pts). Si nadie vota en 48 h, se aprueba sola (+2 pts).\n\n'
      || E'/metas — tus metas y tu avance\n'
      || E'/avance — cómo va cada uno\n'
      || E'/puntos — tabla de puntos\n'
      || E'/soy — registrarte\n'
      || E'/activar — activar este grupo para el reto (una sola vez)\n\n'
      || E'💬 <b>Por privado</b> (abre el chat con el bot y dale Iniciar)\n'
      || E'Escríbeme normal: «recuérdame mañana a las 8 llamar al banco».\n'
      || E'/tareas — tus pendientes en Xenith\n'
      || E'/recordatorios — tus recordatorios\n'
      || E'/uso — cuánto se ha usado la IA'
$$;

create or replace function fn_texto_puntos() returns text
language sql stable as $$
  select E'🏆 <b>Tabla de puntos</b>\n\n' || coalesce(string_agg(
           case r.pos when 1 then '🥇' when 2 then '🥈' when 3 then '🥉' else r.pos || '.' end
           || ' ' || fn_html(coalesce(r.apodo, split_part(r.nombre, ' ', 1)))
           || ' — <b>' || fn_num(r.puntos) || '</b> pts'
           || ' <i>(' || r.evidencias_aprobadas || ' evidencias)</i>', E'\n' order by r.pos), 'Aún no hay puntos.')
    from (select v.*, rank() over (order by v.puntos desc) as pos from v_puntos v) r
$$;

create or replace function fn_detalle_avance(tipo meta_tipo, actual numeric, objetivo numeric, unidad text, pct numeric)
returns text language sql immutable as $$
  select case
    when tipo = 'HITO' then case when pct >= 100 then '✅ cumplida' else 'pendiente' end
    when tipo = 'NIVEL' and actual is null then 'sin registro aún'
    when tipo = 'NIVEL' then 'va en ' || fn_num(actual) || ' / ' || fn_num(objetivo) || coalesce(' ' || fn_html(unidad), '')
    else fn_num(coalesce(actual, 0)) || ' / ' || fn_num(objetivo) || coalesce(' ' || fn_html(unidad), '') end
$$;

-- Con participante: detalle de sus metas. Sin él: resumen de todos.
create or replace function fn_texto_avance(pid int) returns text
language plpgsql stable as $$
declare
  t text;
  ritmo numeric := fn_ritmo_pct();
begin
  if pid is not null then
    select E'🎯 <b>Metas de ' || fn_html(fn_nombre(p)) || E'</b>\n<i>Ritmo esperado: ' || fn_num(ritmo) || E' %</i>\n\n'
        || string_agg(fn_emoji(a.categoria) || ' ' || fn_html(a.titulo) || case when a.alcance <> 'PERSONAL' then ' 👥' else '' end
             || E'\n' || fn_barra(a.progreso_pct) || ' ' || fn_num(a.progreso_pct) || ' % · '
             || fn_detalle_avance(a.tipo, a.actual, a.objetivo, a.unidad, a.progreso_pct),
             E'\n\n' order by (a.alcance <> 'PERSONAL'), a.meta_id)
      into t
      from participantes p
      join v_avance a on a.participante_id = p.id or a.alcance = 'GRUPAL_COLECTIVA'
     where p.id = pid
     group by p.id;
    return t;
  end if;

  select E'📈 <b>Avance del reto</b>\n<i>Ritmo esperado: ' || fn_num(ritmo) || E' %</i>\n\n'
      || string_agg(
           case when x.prom >= ritmo then '🟢 ' else '🔴 ' end
           || '<b>' || fn_html(x.quien) || '</b> — ' || fn_num(x.prom) || ' % promedio · '
           || x.cumplidas || '/' || x.total || ' metas cumplidas', E'\n' order by x.prom desc)
    into t
    from (select coalesce(p.apodo, split_part(p.nombre, ' ', 1)) as quien,
                 round(avg(a.progreso_pct), 1) as prom,
                 count(*) filter (where a.progreso_pct >= 100) as cumplidas,
                 count(*) as total
            from participantes p
            join v_avance a on a.participante_id = p.id or a.alcance = 'GRUPAL_COLECTIVA'
           group by p.id) x;

  select t || E'\n\n👥 <b>Metas colectivas</b>\n' || string_agg(
           fn_emoji(a.categoria) || ' ' || fn_html(a.titulo) || E'\n' || fn_barra(a.progreso_pct) || ' ' || fn_num(a.progreso_pct) || ' % · '
           || fn_detalle_avance(a.tipo, a.actual, a.objetivo, a.unidad, a.progreso_pct),
           E'\n' order by a.meta_id)
    into t
    from v_avance a where a.alcance = 'GRUPAL_COLECTIVA';
  return t;
end $$;

-- ------------------------------------------------------------ evidencias

create or replace function fn_teclado_metas(eid int) returns jsonb
language sql stable as $$
  select jsonb_build_object('inline_keyboard',
    coalesce(jsonb_agg(jsonb_build_array(fn_boton(
        left(fn_emoji(m.categoria) || ' ' || case when m.alcance <> 'PERSONAL' then '👥 ' else '' end || m.titulo, 60),
        'em:' || eid || ':' || m.id))
      order by (m.alcance <> 'PERSONAL'), m.id), '[]'::jsonb)
    || jsonb_build_array(jsonb_build_array(fn_boton('🗑 Descartar', 'ex:' || eid))))
  from evidencias e
  join metas m on m.activa and (m.participante_id = e.participante_id or m.alcance <> 'PERSONAL')
  where e.id = eid
$$;

create or replace function fn_texto_pregunta_meta(eid int) returns text
language sql stable as $$
  select '📸 ' || fn_mencion(p) || E', ¿a qué meta corresponde esta evidencia?\n<i>#E' || e.id || '</i>'
    from evidencias e join participantes p on p.id = e.participante_id where e.id = eid
$$;

-- Segundo paso: cuánto aporta la evidencia, según el tipo de meta
create or replace function fn_paso_cantidad(eid int) returns jsonb
language plpgsql stable as $$
declare
  e evidencias;
  m metas;
  d meta_dimensiones;
  titulo text;
  filas jsonb;
  texto text;
  pie jsonb;
begin
  select * into e from evidencias where id = eid;
  select * into m from metas where id = e.meta_id;
  select * into d from meta_dimensiones where id = e.dimension_id;
  titulo := '<b>' || fn_html(m.titulo) || '</b>' || coalesce(' · ' || fn_html(d.nombre), '');
  pie := jsonb_build_array(fn_boton('↩️ Cambiar meta', 'eb:' || eid), fn_boton('🗑 Descartar', 'ex:' || eid));

  if m.tipo = 'ACUMULATIVA' then
    texto := '➕ ¿Cuánto suma a ' || titulo || '?';
    filas := jsonb_build_array(
      jsonb_build_array(fn_boton('+1', 'eq:' || eid || ':1'), fn_boton('+2', 'eq:' || eid || ':2'), fn_boton('+3', 'eq:' || eid || ':3')),
      jsonb_build_array(fn_boton('✏️ Otra cantidad', 'er:' || eid)),
      jsonb_build_array(fn_boton('💪 Solo constancia (no suma)', 'eq:' || eid || ':c')));
  elsif m.tipo = 'NIVEL' then
    texto := '📍 ¿En cuánto vas en ' || titulo || coalesce(' (' || fn_html(m.unidad) || ')', '')
          || E'?\n<b>Responde a este mensaje</b> con el número.';
    filas := jsonb_build_array(jsonb_build_array(fn_boton('💪 Solo constancia (sin valor nuevo)', 'eq:' || eid || ':c')));
  elsif m.tipo = 'HITO' then
    texto := '🏁 ¿Esta evidencia es la prueba final de ' || titulo || '?';
    filas := jsonb_build_array(
      jsonb_build_array(fn_boton('💪 Es un avance', 'eq:' || eid || ':c')),
      jsonb_build_array(fn_boton('🏁 Es la prueba final', 'eq:' || eid || ':1')));
  elsif m.tipo = 'HABITO' then
    texto := '🏋️ ¿Cuenta como día cumplido de ' || titulo || '?';
    filas := jsonb_build_array(
      jsonb_build_array(fn_boton('✅ Día cumplido', 'eq:' || eid || ':1')),
      jsonb_build_array(fn_boton('💪 Solo constancia', 'eq:' || eid || ':c')));
  else -- ABSTINENCIA
    texto := '🧪 ¿Es la prueba del mes de ' || titulo || '?';
    filas := jsonb_build_array(
      jsonb_build_array(fn_boton('🧪 Prueba negativa del mes', 'eq:' || eid || ':1')),
      jsonb_build_array(fn_boton('💪 Solo constancia', 'eq:' || eid || ':c')));
  end if;

  return jsonb_build_object(
    'texto', texto || E'\n<i>#E' || eid || '</i>',
    'teclado', jsonb_build_object('inline_keyboard', filas || jsonb_build_array(pie)));
end $$;

create or replace function fn_tarjeta(eid int) returns text
language sql stable as $$
  select '📸 <b>Evidencia #' || e.id || '</b> de ' || fn_mencion(p)
      || E'\n' || fn_emoji(m.categoria) || ' ' || fn_html(m.titulo) || coalesce(' · ' || fn_html(d.nombre), '')
      || E'\n' || case
           when e.cantidad is null then '💪 Constancia'
           when m.tipo = 'ACUMULATIVA' then '➕ Suma ' || fn_num(e.cantidad) || coalesce(' ' || fn_html(m.unidad), '')
           when m.tipo = 'NIVEL' then '📍 Nuevo valor: ' || fn_num(e.cantidad) || coalesce(' ' || fn_html(m.unidad), '')
           when m.tipo = 'HITO' then '🏁 Prueba final'
           when m.tipo = 'HABITO' then '✅ Día cumplido'
           else '🧪 Prueba del mes' end
      || coalesce(E'\n📝 ' || fn_html(e.nota), '')
    from evidencias e
    join participantes p on p.id = e.participante_id
    join metas m on m.id = e.meta_id
    left join meta_dimensiones d on d.id = e.dimension_id
   where e.id = eid
$$;

-- La evidencia queda lista: el mensaje del bot se convierte en la tarjeta de votación
create or replace function fn_a_votacion(eid int, chat bigint, msg bigint) returns jsonb
language plpgsql as $$
begin
  update evidencias set estado = 'PENDIENTE', enviada_en = now(), mensaje_voto_id = msg where id = eid;
  return jsonb_build_array(fn_edit(chat, msg,
    fn_tarjeta(eid) || E'\n\n🗳 ¿La aprueban? Basta un voto. Si nadie vota en '
      || fn_cfg_txt('horas_auto_aprobacion') || ' h se aprueba sola con ' || fn_cfg_txt('puntos_auto') || ' pts.',
    jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
      fn_boton('✅ Aprobar', 'va:' || eid), fn_boton('❌ Rechazar', 'vr:' || eid))))));
end $$;

-- Mensaje de celebración tras aprobar: puntos y avance de la meta
create or replace function fn_texto_celebracion(eid int) returns text
language sql stable as $$
  select '🔥 ' || fn_mencion(p) || ' suma <b>+' || fn_num(e.puntos) || '</b> pts (total: '
      || fn_num(vp.puntos) || ')'
      || coalesce(E'\n' || fn_emoji(m.categoria) || ' ' || fn_html(m.titulo) || ': '
           || fn_barra(a.progreso_pct) || ' ' || fn_num(a.progreso_pct) || ' %', '')
    from evidencias e
    join participantes p on p.id = e.participante_id
    join metas m on m.id = e.meta_id
    join v_puntos vp on vp.participante_id = p.id
    left join v_avance a on a.meta_id = m.id
         and (a.participante_id = p.id or (a.participante_id is null and m.alcance = 'GRUPAL_COLECTIVA'))
   where e.id = eid
$$;

-- ------------------------------------------------------------ recordatorios

-- Lo usa el agente de IA. `para` acepta slug, nombre, apodo o 'yo'.
create or replace function fn_crear_recordatorio(creador_tg bigint, para text, texto text, cuando timestamptz)
returns jsonb language plpgsql as $$
declare
  yo participantes;
  destino participantes;
  r recordatorios;
begin
  select * into yo from participantes where telegram_user_id = creador_tg;
  if yo.id is null then return jsonb_build_object('ok', false, 'error', 'Quien crea el recordatorio no está registrado'); end if;
  if lower(coalesce(para, 'yo')) in ('yo', 'me', 'mí', 'mi') then destino := yo;
  else
    select * into destino from participantes
     where lower(para) in (lower(slug), lower(nombre), lower(coalesce(apodo, '')), lower(split_part(nombre, ' ', 1)))
     limit 1;
  end if;
  if destino.id is null then return jsonb_build_object('ok', false, 'error', 'No encontré a ' || para); end if;
  insert into recordatorios (creado_por, para, texto, vence_en, intervalo_min, proximo_aviso)
  values (yo.id, destino.id, texto, cuando, fn_cfg_txt('recordatorio_intervalo_min')::int, cuando)
  returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id, 'para', fn_nombre(destino),
    'cuando', to_char(cuando at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'));
end $$;

-- ------------------------------------------------------------ callbacks (botones)

create or replace function fn_callback(cq jsonb, yo participantes) returns jsonb
language plpgsql as $$
declare
  partes text[] := string_to_array(cq ->> 'data', ':');
  accion text := partes[1];
  chat bigint := (cq -> 'message' -> 'chat' ->> 'id')::bigint;
  msg bigint := (cq -> 'message' ->> 'message_id')::bigint;
  cq_id text := cq ->> 'id';
  acts jsonb := '[]'::jsonb;
  toast text;
  e evidencias;
  otro participantes;
  r recordatorios;
  paso jsonb;
begin
  -- Registro: "soy fulano"
  if accion = 'id' then
    if yo.id is not null then
      return jsonb_build_array(fn_answer(cq_id, 'Ya estás registrado como ' || fn_nombre(yo)));
    end if;
    update participantes set telegram_user_id = (cq -> 'from' ->> 'id')::bigint,
           telegram_username = cq -> 'from' ->> 'username'
     where id = partes[2]::int and telegram_user_id is null
     returning * into otro;
    if otro.id is null then
      return jsonb_build_array(fn_answer(cq_id, 'Esa persona ya está registrada.', true));
    end if;
    return jsonb_build_array(
      fn_edit(chat, msg, '✅ ' || fn_mencion(otro) || E' quedó registrado.\n\n' || fn_texto_ayuda()),
      fn_answer(cq_id, 'Registrado'));
  end if;

  if yo.id is null then
    return jsonb_build_array(fn_answer(cq_id, 'Primero regístrate con /soy', true));
  end if;

  -- Recordatorio cumplido
  if accion = 'rh' then
    update recordatorios set estado = 'HECHO', hecho_en = now()
     where id = partes[2]::int and para = yo.id and estado = 'PENDIENTE'
     returning * into r;
    if r.id is null then return jsonb_build_array(fn_answer(cq_id, 'Ese recordatorio ya estaba cerrado.')); end if;
    acts := jsonb_build_array(fn_edit(chat, msg, E'✅ <s>' || fn_html(r.texto) || '</s>'), fn_answer(cq_id, '¡Hecho!'));
    if r.creado_por <> r.para then
      select * into otro from participantes where id = r.creado_por;
      if otro.telegram_user_id is not null then
        acts := acts || fn_send(otro.telegram_user_id, '✅ ' || fn_html(fn_nombre(yo)) || ' completó: ' || fn_html(r.texto));
      end if;
    end if;
    return acts;
  end if;

  select * into e from evidencias where id = partes[2]::int;
  if e.id is null then return jsonb_build_array(fn_answer(cq_id, 'Esa evidencia ya no existe.')); end if;
  select * into otro from participantes where id = e.participante_id;

  -- Votos
  if accion in ('va', 'vr') then
    if e.participante_id = yo.id then
      return jsonb_build_array(fn_answer(cq_id, 'No puedes votar tu propia evidencia 😏', true));
    end if;
    if e.estado <> 'PENDIENTE' then
      return jsonb_build_array(fn_answer(cq_id, 'Esta evidencia ya fue resuelta.'));
    end if;
    insert into votos_evidencia (evidencia_id, votante_id, aprueba) values (e.id, yo.id, accion = 'va')
    on conflict do nothing;
    update evidencias
       set estado = case when accion = 'va' then 'APROBADA' else 'RECHAZADA' end::evidencia_estado,
           puntos = case when accion = 'va' then fn_cfg_txt('puntos_aprobada')::numeric else 0 end,
           resuelta_en = now(), mensaje_voto_id = msg
     where id = e.id;
    acts := jsonb_build_array(fn_edit(chat, msg, fn_tarjeta(e.id) || E'\n\n'
      || case when accion = 'va'
           then '✅ Aprobada por ' || fn_html(fn_nombre(yo)) || ' · +' || fn_cfg_txt('puntos_aprobada') || ' pts'
           else '❌ Rechazada por ' || fn_html(fn_nombre(yo)) end));
    if accion = 'va' then
      acts := acts || fn_send(chat, fn_texto_celebracion(e.id), null, msg);
    end if;
    return acts || fn_answer(cq_id, 'Voto registrado');
  end if;

  -- Pasos del dueño de la evidencia
  if e.participante_id <> yo.id then
    return jsonb_build_array(fn_answer(cq_id, 'Esta evidencia es de ' || fn_nombre(otro) || '.'));
  end if;
  if e.estado <> 'BORRADOR' then
    return jsonb_build_array(fn_answer(cq_id, 'Esta evidencia ya está en votación.'));
  end if;

  if accion = 'em' then
    update evidencias set meta_id = partes[3]::int, dimension_id = null, cantidad = null where id = e.id;
    if exists (select 1 from meta_dimensiones where meta_id = partes[3]::int) then
      acts := jsonb_build_array(fn_edit(chat, msg,
        E'🗂 ¿De qué línea de negocio es?\n<i>#E' || e.id || '</i>',
        (select jsonb_build_object('inline_keyboard',
                  jsonb_agg(jsonb_build_array(fn_boton(d.nombre, 'ed:' || e.id || ':' || d.id)) order by d.id)
                  || jsonb_build_array(jsonb_build_array(fn_boton('↩️ Cambiar meta', 'eb:' || e.id))))
           from meta_dimensiones d where d.meta_id = partes[3]::int)));
    else
      paso := fn_paso_cantidad(e.id);
      acts := jsonb_build_array(fn_edit(chat, msg, paso ->> 'texto', paso -> 'teclado'));
    end if;
  elsif accion = 'ed' then
    update evidencias set dimension_id = partes[3]::int where id = e.id;
    paso := fn_paso_cantidad(e.id);
    acts := jsonb_build_array(fn_edit(chat, msg, paso ->> 'texto', paso -> 'teclado'));
  elsif accion = 'eq' then
    update evidencias set cantidad = case when partes[3] = 'c' then null else partes[3]::numeric end where id = e.id;
    acts := fn_a_votacion(e.id, chat, msg);
  elsif accion = 'er' then
    acts := jsonb_build_array(fn_edit(chat, msg,
      E'✏️ <b>Responde a este mensaje</b> con la cantidad.\n<i>#E' || e.id || '</i>',
      jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(fn_boton('↩️ Cambiar meta', 'eb:' || e.id))))));
  elsif accion = 'eb' then
    update evidencias set meta_id = null, dimension_id = null, cantidad = null where id = e.id;
    acts := jsonb_build_array(fn_edit(chat, msg, fn_texto_pregunta_meta(e.id), fn_teclado_metas(e.id)));
  elsif accion = 'ex' then
    delete from evidencias where id = e.id;
    acts := jsonb_build_array(fn_edit(chat, msg, '🗑 Evidencia descartada.'));
  end if;
  return acts || fn_answer(cq_id, null);
end $$;

-- ------------------------------------------------------------ mensajes

create or replace function fn_mensaje(msg jsonb, yo participantes) returns jsonb
language plpgsql as $$
declare
  chat bigint := (msg -> 'chat' ->> 'id')::bigint;
  es_grupo boolean := (msg -> 'chat' ->> 'type') in ('group', 'supergroup');
  msg_id bigint := (msg ->> 'message_id')::bigint;
  texto text := coalesce(msg ->> 'text', '');
  cmd text;
  grupo bigint := fn_cfg_txt('grupo_chat_id')::bigint;
  archivo text;
  eid int;
  e evidencias;
  n numeric;
  acts jsonb;
begin
  -- El grupo pasó a supergrupo: Telegram le cambia el id
  if msg ? 'migrate_to_chat_id' then
    update config set valor = to_jsonb((msg ->> 'migrate_to_chat_id')::bigint)
     where clave = 'grupo_chat_id' and valor #>> '{}' = chat::text;
    return '[]'::jsonb;
  end if;

  if texto like '/%' then
    cmd := lower(split_part(split_part(texto, ' ', 1), '@', 1));
  end if;

  archivo := coalesce(
    msg -> 'photo' -> -1 ->> 'file_id',
    msg -> 'video' ->> 'file_id',
    msg -> 'video_note' ->> 'file_id',
    case when msg -> 'document' ->> 'mime_type' ~ '^(image|video)/' then msg -> 'document' ->> 'file_id' end);

  -- Desconocido: que diga quién es
  if yo.id is null then
    if cmd in ('/start', '/soy') or not es_grupo or archivo is not null then
      if not exists (select 1 from participantes where telegram_user_id is null) then
        return jsonb_build_array(fn_send(chat, 'No te reconozco y ya están registrados todos los participantes del reto.', null, msg_id));
      end if;
      return jsonb_build_array(fn_send(chat, '👋 ¡Hola! Antes de empezar, ¿quién eres?',
        (select jsonb_build_object('inline_keyboard',
                  jsonb_agg(jsonb_build_array(fn_boton(fn_nombre(p), 'id:' || p.id)) order by p.id))
           from participantes p where p.telegram_user_id is null),
        msg_id));
    end if;
    return '[]'::jsonb;
  end if;

  if cmd = '/activar' then
    if not es_grupo then return jsonb_build_array(fn_send(chat, 'Usa /activar dentro del grupo del reto.')); end if;
    update config set valor = to_jsonb(chat) where clave = 'grupo_chat_id';
    return jsonb_build_array(fn_send(chat, E'✅ Grupo activado para el reto.\n\n' || fn_texto_ayuda()));
  end if;
  if cmd in ('/start', '/ayuda', '/help', '/soy') then return jsonb_build_array(fn_send(chat, fn_texto_ayuda())); end if;
  if cmd = '/puntos' then return jsonb_build_array(fn_send(chat, fn_texto_puntos())); end if;
  if cmd = '/metas' then return jsonb_build_array(fn_send(chat, fn_texto_avance(yo.id))); end if;
  if cmd = '/avance' then return jsonb_build_array(fn_send(chat, fn_texto_avance(null))); end if;

  -- Lo personal siempre sale por privado, aunque lo pidan en el grupo
  if cmd in ('/tareas', '/recordatorios', '/uso') then
    acts := case when es_grupo
      then jsonb_build_array(fn_send(chat, '📬 Te respondí por privado.', null, msg_id))
      else '[]'::jsonb end;
    if cmd = '/tareas' then
      if yo.xenith_email is null then
        return acts || fn_send(yo.telegram_user_id, 'Tu usuario del bot no está enlazado con Xenith todavía.');
      end if;
      return acts || fn_accion('__tareas', jsonb_build_object('chat_id', yo.telegram_user_id, 'email', yo.xenith_email));
    elsif cmd = '/recordatorios' then
      return acts || fn_send(yo.telegram_user_id, fn_texto_recordatorios(yo.id));
    else
      return acts || fn_send(yo.telegram_user_id, fn_texto_uso_ia(yo.id));
    end if;
  end if;

  -- Evidencia
  if archivo is not null then
    if not es_grupo then
      return jsonb_build_array(fn_send(chat, 'Envía tus evidencias en el grupo del reto para que los demás las voten 📸'));
    end if;
    if grupo is null or chat <> grupo then
      return jsonb_build_array(fn_send(chat, 'Este grupo no está activado para el reto. Usa /activar.'));
    end if;
    insert into evidencias (participante_id, telegram_file_id, telegram_chat_id, telegram_message_id, nota)
    values (yo.id, archivo, chat, msg_id, nullif(trim(msg ->> 'caption'), ''))
    returning id into eid;
    return jsonb_build_array(fn_send(chat, fn_texto_pregunta_meta(eid), fn_teclado_metas(eid), msg_id));
  end if;

  -- Respuesta con una cifra a una pregunta del bot (#E123)
  if (msg -> 'reply_to_message' -> 'from' ->> 'is_bot')::boolean then
    eid := substring(msg -> 'reply_to_message' ->> 'text' from '#E(\d+)')::int;
    if eid is not null then
      select * into e from evidencias where id = eid;
      if e.participante_id = yo.id and e.estado = 'BORRADOR' and e.meta_id is not null then
        n := fn_parse_num(texto);
        if n is null then
          return jsonb_build_array(fn_send(chat, 'No entendí la cifra. Escribe solo el número, por ejemplo 1500 o 18,5.', null, msg_id));
        end if;
        update evidencias set cantidad = n where id = eid;
        return fn_a_votacion(eid, chat, (msg -> 'reply_to_message' ->> 'message_id')::bigint);
      end if;
    end if;
  end if;

  -- Conversación libre en privado: la atiende el agente de IA
  if not es_grupo and cmd is null and texto <> '' then
    return jsonb_build_array(fn_accion('__agente', jsonb_build_object(
      'chat_id', chat, 'texto', texto, 'participante', fn_nombre(yo), 'participante_id', yo.id,
      'telegram_user_id', yo.telegram_user_id)));
  end if;
  return '[]'::jsonb;
end $$;

-- ------------------------------------------------------------ entrada principal

create or replace function fn_procesar_update(u jsonb) returns jsonb
language plpgsql as $$
declare
  yo participantes;
  frm jsonb := coalesce(u -> 'callback_query' -> 'from', u -> 'message' -> 'from');
begin
  if frm is null or (frm ->> 'is_bot')::boolean then return '[]'::jsonb; end if;
  select * into yo from participantes where telegram_user_id = (frm ->> 'id')::bigint;
  if u ? 'callback_query' then return fn_callback(u -> 'callback_query', yo); end if;
  if u ? 'message' then return fn_mensaje(u -> 'message', yo); end if;
  return '[]'::jsonb;
end $$;

-- ------------------------------------------------------------ tareas programadas

-- Cada 15 min: auto-aprobación, borradores olvidados y recordatorios
create or replace function fn_tick() returns jsonb
language plpgsql as $$
declare
  acts jsonb := '[]'::jsonb;
  grupo bigint := fn_cfg_txt('grupo_chat_id')::bigint;
  e record;
  r record;
begin
  for e in
    update evidencias
       set estado = 'AUTO_APROBADA', puntos = fn_cfg_txt('puntos_auto')::numeric, resuelta_en = now()
     where estado = 'PENDIENTE'
       and enviada_en <= now() - make_interval(hours => fn_cfg_txt('horas_auto_aprobacion')::int)
    returning id, telegram_chat_id, mensaje_voto_id
  loop
    acts := acts
      || fn_edit(e.telegram_chat_id, e.mensaje_voto_id, fn_tarjeta(e.id)
           || E'\n\n⌛ Aprobada automáticamente: nadie votó · +' || fn_cfg_txt('puntos_auto') || ' pts')
      || fn_send(e.telegram_chat_id, '⌛ La evidencia #' || e.id || ' se aprobó sola con '
           || fn_cfg_txt('puntos_auto') || ' pts. ¡Voten a tiempo! 👀', null, e.mensaje_voto_id);
  end loop;

  -- Borrador sin terminar: un aviso a las 2 h, se descarta a las 48 h
  for e in
    update evidencias set aviso_borrador_en = now()
     where estado = 'BORRADOR' and aviso_borrador_en is null and creada_en <= now() - interval '2 hours'
    returning id, participante_id, telegram_chat_id, telegram_message_id
  loop
    acts := acts || fn_send(e.telegram_chat_id,
      '⚠️ ' || (select fn_mencion(p) from participantes p where p.id = e.participante_id)
      || ', te falta decir a qué meta corresponde esta evidencia. Si no, se descarta en 2 días.',
      null, e.telegram_message_id);
  end loop;
  delete from evidencias where estado = 'BORRADOR' and creada_en <= now() - interval '48 hours';

  -- Recordatorios personales (por privado)
  for r in
    select rc.*, p.telegram_user_id, c.nombre as creador_nombre, c.apodo as creador_apodo
      from recordatorios rc
      join participantes p on p.id = rc.para
      left join participantes c on c.id = rc.creado_por
     where rc.estado = 'PENDIENTE' and rc.proximo_aviso <= now() and p.telegram_user_id is not null
     for update of rc
  loop
    acts := acts || fn_send(r.telegram_user_id,
      case when r.avisos_enviados = 0 then '⏰ <b>Recordatorio</b>' else '⏰ <b>Recordatorio</b> (sigue pendiente)' end
      || E'\n' || fn_html(r.texto)
      || case when r.creado_por is distinct from r.para
           then E'\n<i>De ' || fn_html(coalesce(r.creador_apodo, split_part(r.creador_nombre, ' ', 1))) || '</i>' else '' end,
      jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(fn_boton('✅ Hecho', 'rh:' || r.id)))));
    update recordatorios
       set avisos_enviados = avisos_enviados + 1,
           proximo_aviso = fn_siguiente_aviso(now() + make_interval(mins => intervalo_min))
     where id = r.id;
  end loop;

  return acts;
end $$;

-- 12, 15, 18 y 21 h: quién no ha subido evidencia hoy
create or replace function fn_recordar_evidencias(hora int) returns jsonb
language plpgsql as $$
declare
  grupo bigint := fn_cfg_txt('grupo_chat_id')::bigint;
  faltan text;
  listos text;
  texto text;
  acts jsonb := '[]'::jsonb;
  s record;
begin
  if grupo is null or now() < fn_cfg_txt('reto_inicio')::timestamptz or now() > fn_cfg_txt('reto_fin')::timestamptz then
    return acts;
  end if;

  select string_agg(fn_mencion(p), ', ' order by p.id) filter (where h.evidencias_hoy = 0),
         string_agg(fn_html(fn_nombre(p)) || ' (' || h.evidencias_hoy || ')', ', ' order by h.evidencias_hoy desc) filter (where h.evidencias_hoy > 0)
    into faltan, listos
    from v_evidencias_hoy h join participantes p on p.id = h.participante_id
   where p.telegram_user_id is not null;

  if faltan is null then
    if hora >= 21 then acts := acts || fn_send(grupo, '🏆 Hoy todos subieron evidencia. ¡Así se hace, equipo!'); end if;
  else
    texto := case
      when hora < 15 then '☀️ Mediodía y todavía no veo evidencia de hoy de ' || faltan || '. ¿Qué hicieron hoy por sus metas? 📸'
      when hora < 18 then '⏰ Ya son las 3. ' || faltan || ', una foto y listo.'
      when hora < 21 then '🌆 ' || faltan || '… el día se acaba y sin evidencia. Los demás ya van sumando puntos 👀'
      else '🌙 Última llamada, ' || faltan || '. Hoy todavía cuenta.' end
      || coalesce(E'\n🔥 Hoy ya subieron: ' || listos, '');
    acts := acts || fn_send(grupo, texto);
  end if;

  -- Los miércoles al mediodía: preguntar por la meta más abandonada de cada uno
  if hora = 12 and extract(isodow from now() at time zone 'America/Bogota') = 3 then
    for s in
      select distinct on (p.id) p.id, fn_mencion(p) as mencion, m.titulo,
             (select max(e.creada_en) from evidencias e
               where e.meta_id = m.id and e.participante_id = p.id and e.estado in ('APROBADA', 'AUTO_APROBADA')) as ultima
        from participantes p
        join metas m on m.activa and (m.participante_id = p.id or m.alcance = 'GRUPAL_INDIVIDUAL')
       where p.telegram_user_id is not null
       order by p.id, (select max(e.creada_en) from evidencias e
                        where e.meta_id = m.id and e.participante_id = p.id and e.estado in ('APROBADA', 'AUTO_APROBADA')) nulls first, random()
    loop
      acts := acts || fn_send(grupo, '🤔 ' || s.mencion || ', ¿cómo vas con <b>' || fn_html(s.titulo) || '</b>? '
        || case when s.ultima is null then 'Todavía no has subido nada de esa meta.'
                else 'Tu última evidencia fue hace ' || extract(day from now() - s.ultima)::int || ' días.' end);
    end loop;
  end if;
  return acts;
end $$;

-- Domingo en la noche
create or replace function fn_resumen_semanal() returns jsonb
language plpgsql as $$
declare
  grupo bigint := fn_cfg_txt('grupo_chat_id')::bigint;
  semana int := floor(extract(epoch from now() - fn_cfg_txt('reto_inicio')::timestamptz) / 604800)::int + 1;
  semanal text;
begin
  if grupo is null or now() < fn_cfg_txt('reto_inicio')::timestamptz then return '[]'::jsonb; end if;

  select string_agg(fn_html(fn_nombre(p)) || ': +' || fn_num(coalesce(x.pts, 0)) || ' pts (' || coalesce(x.n, 0) || ' evidencias)',
                    E'\n' order by coalesce(x.pts, 0) desc)
    into semanal
    from participantes p
    left join (select participante_id, sum(puntos) as pts, count(*) as n
                 from evidencias
                where estado in ('APROBADA', 'AUTO_APROBADA') and resuelta_en >= now() - interval '7 days'
                group by participante_id) x on x.participante_id = p.id;

  return jsonb_build_array(fn_send(grupo,
    E'📊 <b>Resumen semanal</b> — semana ' || least(semana, 52) || E' de 52\n\n'
    || E'<b>Esta semana</b>\n' || semanal || E'\n\n'
    || fn_texto_puntos() || E'\n\n'
    || fn_texto_avance(null)));
end $$;

grant execute on all functions in schema public to reto_app;
commit;
