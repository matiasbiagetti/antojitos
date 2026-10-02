-- Avatar emoji por participante. El default solo rellena a participantes de salas ya abiertas.
alter table participants add column avatar_id text not null default '1f600';
alter table participants alter column avatar_id drop default;
