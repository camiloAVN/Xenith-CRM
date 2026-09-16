-- Esquema del reto anual. Se ejecuta conectado a la base `reto`.
\set ON_ERROR_STOP on
begin;

create type meta_tipo as enum ('ACUMULATIVA', 'NIVEL', 'HITO', 'HABITO', 'ABSTINENCIA');
create type meta_alcance as enum ('PERSONAL', 'GRUPAL_INDIVIDUAL', 'GRUPAL_COLECTIVA');
create type evidencia_estado as enum ('BORRADOR', 'PENDIENTE', 'APROBADA', 'AUTO_APROBADA', 'RECHAZADA');
create type recordatorio_estado as enum ('PENDIENTE', 'HECHO', 'CANCELADO');

-- Parámetros del reto (fechas, puntos, chat del grupo...)
create table config (
  clave text primary key,
  valor jsonb not null,
  descripcion text
);

create table participantes (
  id serial primary key,
  slug text unique not null,
  nombre text not null,
  apodo text,
  telegram_user_id bigint unique,
  telegram_username text,
  xenith_email text,
  creado_en timestamptz not null default now()
);

create table metas (
  id serial primary key,
  codigo text unique not null,
  participante_id int references participantes (id),       -- null = grupal
  alcance meta_alcance not null,
  categoria text not null,
  titulo text not null,
  tipo meta_tipo not null,
  objetivo numeric not null,          -- HABITO: semanas requeridas · HITO: 1
  unidad text,
  frecuencia numeric,                 -- HABITO: días por semana
  valor_inicial numeric,              -- NIVEL: línea base (null = primera evidencia)
  direccion text not null default 'SUBE' check (direccion in ('SUBE', 'BAJA')),
  cuenta_desde timestamptz,           -- ABSTINENCIA: solo cuentan pruebas desde aquí
  criterio text,                      -- cómo se verifica al final del reto
  activa boolean not null default true,
  check ((alcance = 'PERSONAL') = (participante_id is not null))
);

-- Submetas con objetivo propio (ventas por línea de negocio)
create table meta_dimensiones (
  id serial primary key,
  meta_id int not null references metas (id) on delete cascade,
  nombre text not null,
  objetivo numeric not null,
  unique (meta_id, nombre)
);

-- cantidad null = solo constancia (da puntos, no avanza la meta)
create table evidencias (
  id serial primary key,
  participante_id int not null references participantes (id),
  meta_id int references metas (id),
  dimension_id int references meta_dimensiones (id),
  cantidad numeric,
  nota text,
  telegram_file_id text not null,
  telegram_chat_id bigint not null,
  telegram_message_id bigint,
  mensaje_pregunta_id bigint,         -- mensaje del bot que pide meta/cantidad
  mensaje_voto_id bigint,             -- mensaje del bot con los botones de voto
  estado evidencia_estado not null default 'BORRADOR',
  puntos numeric not null default 0,
  creada_en timestamptz not null default now(),
  enviada_en timestamptz,             -- pasa a PENDIENTE: arranca el plazo de 48 h
  resuelta_en timestamptz
);
create index evidencias_estado_idx on evidencias (estado, enviada_en);
create index evidencias_meta_idx on evidencias (meta_id, participante_id);

create table votos_evidencia (
  evidencia_id int not null references evidencias (id) on delete cascade,
  votante_id int not null references participantes (id),
  aprueba boolean not null,
  votado_en timestamptz not null default now(),
  primary key (evidencia_id, votante_id)
);

create table recordatorios (
  id serial primary key,
  creado_por int references participantes (id),
  para int not null references participantes (id),
  texto text not null,
  vence_en timestamptz not null,
  intervalo_min int not null default 180,
  proximo_aviso timestamptz not null,
  avisos_enviados int not null default 0,
  estado recordatorio_estado not null default 'PENDIENTE',
  hecho_en timestamptz,
  creado_en timestamptz not null default now()
);
create index recordatorios_pendientes_idx on recordatorios (estado, proximo_aviso);

create table veredictos_finales (
  meta_id int not null references metas (id),
  participante_id int not null references participantes (id),
  cumplida boolean not null,
  nota text,
  decidido_en timestamptz not null default now(),
  primary key (meta_id, participante_id)
);

-- ---------------------------------------------------------------- vistas

-- Qué meta mide a quién. Las colectivas tienen participante null.
create view v_pares as
  select m.id as meta_id, m.participante_id from metas m
   where m.alcance = 'PERSONAL' and m.activa
  union all
  select m.id, p.id from metas m cross join participantes p
   where m.alcance = 'GRUPAL_INDIVIDUAL' and m.activa
  union all
  select m.id, null from metas m
   where m.alcance = 'GRUPAL_COLECTIVA' and m.activa;

create view v_evidencias_aprobadas as
  select e.*, (e.creada_en at time zone 'America/Bogota') as creada_local
    from evidencias e
   where e.estado in ('APROBADA', 'AUTO_APROBADA');

create view v_avance as
with ap as (select * from v_evidencias_aprobadas),
calc as (
  -- ACUMULATIVA sin submetas
  select p.meta_id, p.participante_id,
         coalesce(sum(a.cantidad), 0) as actual,
         coalesce(sum(a.cantidad), 0) / m.objetivo as progreso
    from v_pares p join metas m on m.id = p.meta_id
    left join ap a on a.meta_id = p.meta_id and a.cantidad is not null
                  and (p.participante_id is null or a.participante_id = p.participante_id)
   where m.tipo = 'ACUMULATIVA'
     and not exists (select 1 from meta_dimensiones d where d.meta_id = m.id)
   group by p.meta_id, p.participante_id, m.objetivo

  union all
  -- ACUMULATIVA con submetas: promedio de cada submeta, cada una topada al 100 %
  select p.meta_id, p.participante_id,
         sum(ds.actual) as actual,
         avg(least(ds.actual / ds.objetivo, 1)) as progreso
    from v_pares p
    join (select d.meta_id, d.objetivo, coalesce(sum(a.cantidad), 0) as actual
            from meta_dimensiones d
            left join ap a on a.dimension_id = d.id and a.cantidad is not null
           group by d.id, d.meta_id, d.objetivo) ds on ds.meta_id = p.meta_id
   group by p.meta_id, p.participante_id

  union all
  -- NIVEL: último valor contra la línea base
  select p.meta_id, p.participante_id, ult.cantidad as actual,
         case
           when ult.cantidad is null then 0
           when m.direccion = 'SUBE' and ult.cantidad >= m.objetivo then 1
           when m.direccion = 'BAJA' and ult.cantidad <= m.objetivo then 1
           else (ult.cantidad - base.v) / nullif(m.objetivo - base.v, 0)
         end as progreso
    from v_pares p join metas m on m.id = p.meta_id
    left join lateral (
      select a.cantidad from ap a
       where a.meta_id = p.meta_id and a.cantidad is not null
         and (p.participante_id is null or a.participante_id = p.participante_id)
       order by a.creada_en desc limit 1) ult on true
    left join lateral (
      select coalesce(m.valor_inicial, (
        select a.cantidad from ap a
         where a.meta_id = p.meta_id and a.cantidad is not null
           and (p.participante_id is null or a.participante_id = p.participante_id)
         order by a.creada_en asc limit 1)) as v) base on true
   where m.tipo = 'NIVEL'

  union all
  -- HITO: cumplido con una prueba final aprobada (cantidad >= 1)
  select p.meta_id, p.participante_id, count(a.id) as actual,
         case when count(a.id) > 0 then 1 else 0 end as progreso
    from v_pares p join metas m on m.id = p.meta_id
    left join ap a on a.meta_id = p.meta_id and a.cantidad >= 1
                  and (p.participante_id is null or a.participante_id = p.participante_id)
   where m.tipo = 'HITO'
   group by p.meta_id, p.participante_id

  union all
  -- HABITO: semanas (hora Bogotá) con al menos `frecuencia` días entrenados
  select p.meta_id, p.participante_id,
         count(s.semana) filter (where s.dias >= m.frecuencia) as actual,
         count(s.semana) filter (where s.dias >= m.frecuencia) / m.objetivo as progreso
    from v_pares p join metas m on m.id = p.meta_id
    left join (select a.meta_id, a.participante_id,
                      date_trunc('week', a.creada_local) as semana,
                      count(distinct a.creada_local::date) as dias
                 from ap a where a.cantidad >= 1
                group by 1, 2, 3) s
           on s.meta_id = p.meta_id and s.participante_id = p.participante_id
   where m.tipo = 'HABITO'
   group by p.meta_id, p.participante_id, m.objetivo

  union all
  -- ABSTINENCIA: pruebas aprobadas dentro de la ventana
  select p.meta_id, p.participante_id, count(a.id) as actual,
         count(a.id) / m.objetivo as progreso
    from v_pares p join metas m on m.id = p.meta_id
    left join ap a on a.meta_id = p.meta_id and a.cantidad >= 1
                  and a.participante_id = p.participante_id
                  and (m.cuenta_desde is null or a.creada_en >= m.cuenta_desde)
   where m.tipo = 'ABSTINENCIA'
   group by p.meta_id, p.participante_id, m.objetivo
)
select c.meta_id, c.participante_id, pa.nombre as participante,
       m.codigo, m.titulo, m.categoria, m.tipo, m.alcance, m.unidad,
       m.objetivo, c.actual,
       round(least(greatest(coalesce(c.progreso, 0), 0), 1) * 100, 1) as progreso_pct
  from calc c
  join metas m on m.id = c.meta_id
  left join participantes pa on pa.id = c.participante_id;

create view v_puntos as
select p.id as participante_id, p.nombre, p.apodo,
       coalesce(sum(e.puntos), 0) as puntos,
       count(e.id) as evidencias_aprobadas
  from participantes p
  left join v_evidencias_aprobadas e on e.participante_id = p.id
 group by p.id, p.nombre, p.apodo;

-- Valor de cada meta incumplida: penitencia total ÷ (personales + grupales)
create view v_penitencia as
select p.id as participante_id, p.nombre,
       n.metas_totales,
       round((select (valor #>> '{}')::numeric from config where clave = 'penitencia_total') / n.metas_totales, 0) as valor_por_meta
  from participantes p
  cross join lateral (
    select (select count(*) from metas m where m.activa and m.participante_id = p.id)
         + (select count(*) from metas m where m.activa and m.alcance <> 'PERSONAL') as metas_totales) n;

-- Evidencias subidas hoy (hora Bogotá) por persona, sin contar rechazadas
create view v_evidencias_hoy as
select p.id as participante_id, p.nombre, p.telegram_user_id,
       count(e.id) as evidencias_hoy
  from participantes p
  left join evidencias e on e.participante_id = p.id
        and e.estado <> 'RECHAZADA'
        and (e.creada_en at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date
 group by p.id, p.nombre, p.telegram_user_id;

commit;
