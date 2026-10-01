-- Antojitos POC: esquema inicial

create table rooms (
  id text primary key,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  phase text not null check (phase in ('lobby', 'voting', 'runoff', 'roulette', 'result')),
  config jsonb not null,
  host_participant_id uuid,
  current_round int not null default 0
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms (id) on delete cascade,
  nickname text not null,
  nickname_key text not null,
  token_hash text not null unique,
  joined_at timestamptz not null,
  last_seen_at timestamptz not null,
  unique (room_id, nickname_key)
);

create index participants_room_idx on participants (room_id, joined_at);

alter table rooms
  add constraint rooms_host_fk foreign key (host_participant_id)
  references participants (id) on delete set null deferrable initially deferred;

create table rounds (
  room_id text not null references rooms (id) on delete cascade,
  number int not null,
  started_at timestamptz not null,
  deadline timestamptz not null,
  outcome jsonb,
  runoff_deadline timestamptz,
  roulette jsonb,
  roulette_ends_at timestamptz,
  full_result jsonb,
  primary key (room_id, number)
);

create table votes (
  room_id text not null,
  round_number int not null,
  participant_id uuid not null references participants (id) on delete cascade,
  category_id text not null,
  value text not null check (value in ('super', 'yes', 'no')),
  created_at timestamptz not null default now(),
  primary key (room_id, round_number, participant_id, category_id),
  foreign key (room_id, round_number) references rounds (room_id, number) on delete cascade
);

-- Un solo Súper antojo por participante y ronda.
create unique index votes_one_super_per_round
  on votes (room_id, round_number, participant_id)
  where value = 'super';

create table runoff_votes (
  room_id text not null,
  round_number int not null,
  participant_id uuid not null references participants (id) on delete cascade,
  category_id text not null,
  primary key (room_id, round_number, participant_id),
  foreign key (room_id, round_number) references rounds (room_id, number) on delete cascade
);

create table room_public (
  room_id text primary key references rooms (id) on delete cascade,
  snapshot jsonb not null,
  version int not null
);

-- Métricas: anónimas, sin FK, no se purgan.
create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  room_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS: sin políticas = sin acceso para anon/authenticated. Solo room_public es legible.
alter table rooms enable row level security;
alter table participants enable row level security;
alter table rounds enable row level security;
alter table votes enable row level security;
alter table runoff_votes enable row level security;
alter table events enable row level security;
alter table room_public enable row level security;

create policy "room snapshots are public" on room_public
  for select to anon, authenticated using (true);

alter publication supabase_realtime add table room_public;

-- Purga de salas vencidas cada 5 minutos.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-rooms',
  '*/5 * * * *',
  $$delete from public.rooms where expires_at < now()$$
);
