-- Métricas de la POC (correr en el SQL editor de Supabase). Fuente: tabla events.

-- Tasa de finalización: salas que llegaron a resultado / salas creadas
select
  count(distinct room_id) filter (where type = 'round_resolved')::numeric
    / nullif(count(distinct room_id) filter (where type = 'room_created'), 0) as completion_rate
from events;

-- Tiempo medio de decisión (segundos), desde inicio de ronda hasta resultado.
-- Nota: durationMs en rondas que pasan por la ruleta no incluye los ~6 s de la animación.
select avg((data->>'durationMs')::numeric) / 1000 as avg_decision_seconds
from events
where type = 'round_resolved';

-- Tasa de rebote del link: aperturas sin ingreso.
-- Nota: cuenta cada apertura, así que las aperturas repetidas (recargas, volver al link) inflan la tasa.
select
  1 - count(*) filter (where type = 'participant_joined')::numeric
      / nullif(count(*) filter (where type = 'link_opened'), 0) as bounce_rate
from events;

-- Tasa de desempate: rondas que fueron a ballotage o ruleta
select
  count(*) filter (where data->>'path' in ('runoff', 'roulette_after_skip', 'roulette_after_runoff'))::numeric
    / nullif(count(*), 0) as tiebreak_rate
from events
where type = 'round_resolved';

-- Repetición: salas que jugaron más de una ronda
select
  count(*) filter (where rounds > 1)::numeric / nullif(count(*), 0) as replay_rate
from (
  select room_id, count(*) as rounds from events where type = 'round_started' group by room_id
) per_room;
