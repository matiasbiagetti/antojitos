import type {
  CategoryId,
  FullResult,
  RoomConfig,
  RoomPhase,
  RoundOutcome,
  RunoffVote,
  Vote,
  VoteValue,
} from '@/lib/domain/types';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { asJson, type Db } from './db';

export type Room = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  phase: RoomPhase;
  config: RoomConfig;
  hostParticipantId: string | null;
  currentRound: number;
};

export type Participant = { id: string; roomId: string; nickname: string; joinedAt: Date; lastSeenAt: Date };

export type RouletteInfo = { segments: CategoryId[]; winner: CategoryId };

export type Round = {
  roomId: string;
  number: number;
  startedAt: Date;
  deadline: Date;
  outcome: RoundOutcome | null;
  runoffDeadline: Date | null;
  roulette: RouletteInfo | null;
  rouletteEndsAt: Date | null;
  fullResult: FullResult | null;
};

export type RoundUpdate = Partial<
  Pick<Round, 'outcome' | 'runoffDeadline' | 'roulette' | 'rouletteEndsAt' | 'fullResult'>
>;

export type EventType =
  | 'room_created'
  | 'link_opened'
  | 'participant_joined'
  | 'round_started'
  | 'round_resolved'
  | 'replay';

type RoomRow = {
  id: string;
  created_at: Date;
  expires_at: Date;
  phase: RoomPhase;
  config: RoomConfig;
  host_participant_id: string | null;
  current_round: number;
};

type ParticipantRow = { id: string; room_id: string; nickname: string; joined_at: Date; last_seen_at: Date };

type RoundRow = {
  room_id: string;
  number: number;
  started_at: Date;
  deadline: Date;
  outcome: RoundOutcome | null;
  runoff_deadline: Date | null;
  roulette: RouletteInfo | null;
  roulette_ends_at: Date | null;
  full_result: FullResult | null;
};

const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  phase: r.phase,
  config: r.config,
  hostParticipantId: r.host_participant_id,
  currentRound: r.current_round,
});

const toParticipant = (r: ParticipantRow): Participant => ({
  id: r.id,
  roomId: r.room_id,
  nickname: r.nickname,
  joinedAt: r.joined_at,
  lastSeenAt: r.last_seen_at,
});

const toRound = (r: RoundRow): Round => ({
  roomId: r.room_id,
  number: r.number,
  startedAt: r.started_at,
  deadline: r.deadline,
  outcome: r.outcome,
  runoffDeadline: r.runoff_deadline,
  roulette: r.roulette,
  rouletteEndsAt: r.roulette_ends_at,
  fullResult: r.full_result,
});

// --- rooms ---

export async function insertRoom(db: Db, room: Room): Promise<void> {
  await db`
    insert into rooms (id, created_at, expires_at, phase, config, host_participant_id, current_round)
    values (${room.id}, ${room.createdAt}, ${room.expiresAt}, ${room.phase}, ${db.json(asJson(room.config))},
            ${room.hostParticipantId}, ${room.currentRound})`;
}

export async function getRoom(db: Db, id: string, opts: { forUpdate?: boolean } = {}): Promise<Room | null> {
  const rows = opts.forUpdate
    ? await db<RoomRow[]>`select * from rooms where id = ${id} for update`
    : await db<RoomRow[]>`select * from rooms where id = ${id}`;
  return rows[0] ? toRoom(rows[0]) : null;
}

export async function setRoomPhase(db: Db, id: string, phase: RoomPhase): Promise<void> {
  await db`update rooms set phase = ${phase} where id = ${id}`;
}

export async function setRoomConfig(db: Db, id: string, config: RoomConfig): Promise<void> {
  await db`update rooms set config = ${db.json(asJson(config))} where id = ${id}`;
}

export async function setRoomHost(db: Db, id: string, participantId: string): Promise<void> {
  await db`update rooms set host_participant_id = ${participantId} where id = ${id}`;
}

export async function startRoomRound(db: Db, id: string, roundNumber: number): Promise<void> {
  await db`update rooms set phase = 'voting', current_round = ${roundNumber} where id = ${id}`;
}

// --- participants ---

export async function insertParticipant(
  db: Db,
  p: { roomId: string; nickname: string; nicknameKey: string; tokenHash: string; now: Date },
): Promise<Participant> {
  const [row] = await db<ParticipantRow[]>`
    insert into participants (room_id, nickname, nickname_key, token_hash, joined_at, last_seen_at)
    values (${p.roomId}, ${p.nickname}, ${p.nicknameKey}, ${p.tokenHash}, ${p.now}, ${p.now})
    returning id, room_id, nickname, joined_at, last_seen_at`;
  return toParticipant(row);
}

export async function listParticipants(db: Db, roomId: string): Promise<Participant[]> {
  const rows = await db<ParticipantRow[]>`
    select id, room_id, nickname, joined_at, last_seen_at from participants
    where room_id = ${roomId} order by joined_at, id`;
  return rows.map(toParticipant);
}

export async function nicknameTaken(db: Db, roomId: string, nicknameKey: string): Promise<boolean> {
  const rows = await db`select 1 from participants where room_id = ${roomId} and nickname_key = ${nicknameKey}`;
  return rows.length > 0;
}

export async function findParticipantByTokenHash(
  db: Db,
  roomId: string,
  tokenHash: string,
): Promise<Participant | null> {
  const rows = await db<ParticipantRow[]>`
    select id, room_id, nickname, joined_at, last_seen_at from participants
    where room_id = ${roomId} and token_hash = ${tokenHash}`;
  return rows[0] ? toParticipant(rows[0]) : null;
}

export async function touchParticipant(db: Db, participantId: string, now: Date): Promise<void> {
  await db`update participants set last_seen_at = ${now} where id = ${participantId}`;
}

// --- rounds ---

export async function insertRound(
  db: Db,
  r: { roomId: string; number: number; startedAt: Date; deadline: Date },
): Promise<void> {
  await db`
    insert into rounds (room_id, number, started_at, deadline)
    values (${r.roomId}, ${r.number}, ${r.startedAt}, ${r.deadline})`;
}

export async function getRound(db: Db, roomId: string, number: number): Promise<Round | null> {
  const rows = await db<RoundRow[]>`select * from rounds where room_id = ${roomId} and number = ${number}`;
  return rows[0] ? toRound(rows[0]) : null;
}

const jsonOrNull = (db: Db, value: unknown) => (value === undefined ? null : db.json(asJson(value)));

/** Pisa solo los campos presentes en `fields`. */
export async function updateRound(db: Db, roomId: string, number: number, fields: RoundUpdate): Promise<void> {
  await db`
    update rounds set
      outcome = coalesce(${jsonOrNull(db, fields.outcome)}::jsonb, outcome),
      runoff_deadline = coalesce(${fields.runoffDeadline ?? null}::timestamptz, runoff_deadline),
      roulette = coalesce(${jsonOrNull(db, fields.roulette)}::jsonb, roulette),
      roulette_ends_at = coalesce(${fields.rouletteEndsAt ?? null}::timestamptz, roulette_ends_at),
      full_result = coalesce(${jsonOrNull(db, fields.fullResult)}::jsonb, full_result)
    where room_id = ${roomId} and number = ${number}`;
}

// --- votes ---

export async function listVotes(db: Db, roomId: string, roundNumber: number): Promise<Vote[]> {
  const rows = await db<{ participant_id: string; category_id: CategoryId; value: VoteValue }[]>`
    select participant_id, category_id, value from votes
    where room_id = ${roomId} and round_number = ${roundNumber} order by created_at`;
  return rows.map((r) => ({ participantId: r.participant_id, categoryId: r.category_id, value: r.value }));
}

export async function insertVote(db: Db, roomId: string, roundNumber: number, vote: Vote): Promise<void> {
  await db`
    insert into votes (room_id, round_number, participant_id, category_id, value)
    values (${roomId}, ${roundNumber}, ${vote.participantId}, ${vote.categoryId}, ${vote.value})`;
}

export async function listRunoffVotes(db: Db, roomId: string, roundNumber: number): Promise<RunoffVote[]> {
  const rows = await db<{ participant_id: string; category_id: CategoryId }[]>`
    select participant_id, category_id from runoff_votes
    where room_id = ${roomId} and round_number = ${roundNumber}`;
  return rows.map((r) => ({ participantId: r.participant_id, categoryId: r.category_id }));
}

export async function insertRunoffVote(db: Db, roomId: string, roundNumber: number, vote: RunoffVote): Promise<void> {
  await db`
    insert into runoff_votes (room_id, round_number, participant_id, category_id)
    values (${roomId}, ${roundNumber}, ${vote.participantId}, ${vote.categoryId})`;
}

// --- public snapshot ---

export async function nextPublicVersion(db: Db, roomId: string): Promise<number> {
  const [row] = await db<{ v: number }[]>`
    select coalesce(max(version), 0) + 1 as v from room_public where room_id = ${roomId}`;
  return row.v;
}

export async function upsertPublicSnapshot(
  db: Db,
  roomId: string,
  version: number,
  snapshot: PublicSnapshot,
): Promise<void> {
  await db`
    insert into room_public (room_id, snapshot, version)
    values (${roomId}, ${db.json(asJson(snapshot))}, ${version})
    on conflict (room_id) do update set snapshot = excluded.snapshot, version = excluded.version`;
}

// --- events ---

export async function insertEvent(
  db: Db,
  type: EventType,
  roomId: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await db`insert into events (type, room_id, data) values (${type}, ${roomId}, ${db.json(asJson(data))})`;
}
