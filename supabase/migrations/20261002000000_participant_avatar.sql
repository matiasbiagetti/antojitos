-- Avatar emoji por participante. El default se mantiene para que el código sin avatares (ventana de deploy / rollback) siga funcionando; el código nuevo siempre envía un avatar validado.
alter table participants add column avatar_id text not null default '1f600';
