-- Reinicio del bot antes de arrancar el reto (17-sep-2026).
--
--   ssh railway-postgres 'psql -U postgres -d reto -q' < agente/sql/reset-pruebas.sql
--
-- Borra SOLO lo que se generó probando: evidencias, votos, recordatorios,
-- consumo y memoria de la IA. NO toca participantes, metas, config ni
-- `grupo_chat_id`, así que el bot sigue registrado y el grupo activado.
\set ON_ERROR_STOP on
begin;

-- Evidencias de prueba y sus votos (los votos caen por cascada, pero se
-- borran primero para que quede explícito qué se está eliminando).
delete from votos_evidencia;
delete from evidencias;

-- Recordatorios de prueba. Si tienes alguno real pendiente que quieras
-- conservar, comenta esta línea.
delete from recordatorios;

-- Consumo y memoria del agente: el contador del mes arranca en cero.
delete from chat_ia;
delete from uso_ia;

-- La marca del sondeo de Xenith vuelve a cero: el próximo barrido mira solo
-- los últimos 15 minutos y no revive avisos viejos.
update config set valor = 'null'::jsonb where clave = 'xenith_sondeo_desde';

commit;

-- ------------------------------------------------------------ verificación
\echo
\echo == Debe quedar todo en cero:
select (select count(*) from evidencias) as evidencias,
       (select count(*) from votos_evidencia) as votos,
       (select count(*) from recordatorios) as recordatorios,
       (select count(*) from uso_ia) as llamadas_ia;

\echo
\echo == Participantes (los tres deben estar registrados):
select slug, nombre, apodo,
       telegram_user_id is not null as registrado,
       xenith_email
  from participantes order by id;

\echo
\echo == Fechas y grupo:
select clave, valor from config
 where clave in ('reto_inicio', 'reto_fin', 'grupo_chat_id', 'ia_tope_mes_usd')
 order by clave;

\echo
\echo == Metas activas por persona:
select coalesce(p.slug, 'GRUPAL') as de, count(*) as metas
  from metas m left join participantes p on p.id = m.participante_id
 where m.activa group by 1 order by 1;
