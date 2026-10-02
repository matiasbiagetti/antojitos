import { cardOrder } from '@/lib/domain/card-order';
import { canTransition } from '@/lib/domain/room-machine';
import { DEFAULT_CONFIG, ROUND_SECONDS_OPTIONS, type RoomConfig, type VisibilityConfig } from '@/lib/domain/types';
import type { MeResponse, SessionResponse } from '@/lib/shared/api-types';
import { sql, transaction } from '../db';
import { AppError } from '../errors';
import { isSpectator, writePublicSnapshot } from '../public-snapshot';
import { requireHost, requireParticipant, withRoomTx } from '../room-context';
import {
  getRound,
  insertEvent,
  insertParticipant,
  insertRoom,
  listParticipants,
  listRunoffVotes,
  listVotes,
  nicknameTaken,
  setRoomConfig,
  setRoomHost,
  setRoomPhase,
  touchParticipant,
} from '../room-repository';
import { generateRoomId, generateToken, hashToken } from '../tokens';

export const ROOM_TTL_MS = 60 * 60 * 1000;
export const MAX_PARTICIPANTS = 15;
export const MIN_PARTICIPANTS = 2;
const MAX_NICKNAME_LENGTH = 20;

const VISIBILITY_KEYS: (keyof VisibilityConfig)[] = [
  'showRanking',
  'showScores',
  'showSuperCounts',
  'showTiebreakPath',
  'showWhoVotedWhat',
];

export function normalizeNickname(raw: unknown): { nickname: string; key: string } {
  if (typeof raw !== 'string') throw new AppError('INVALID_NICKNAME');
  const nickname = raw.trim().replace(/\s+/g, ' ');
  const length = [...nickname].length;
  if (length < 1 || length > MAX_NICKNAME_LENGTH) throw new AppError('INVALID_NICKNAME');
  return { nickname, key: nickname.toLocaleLowerCase('es') };
}

export function parseConfig(raw: unknown): RoomConfig {
  const value = raw as { visibility?: Record<string, unknown>; roundSeconds?: unknown } | null;
  const visibility = value?.visibility;
  if (!visibility || VISIBILITY_KEYS.some((k) => typeof visibility[k] !== 'boolean')) {
    throw new AppError('INVALID_INPUT');
  }
  const roundSeconds = value?.roundSeconds as RoomConfig['roundSeconds'];
  if (!ROUND_SECONDS_OPTIONS.includes(roundSeconds)) throw new AppError('INVALID_INPUT');
  return {
    visibility: Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, visibility[k]])) as VisibilityConfig,
    roundSeconds,
  };
}

const nicknameFrom = (body: unknown) => normalizeNickname((body as { nickname?: unknown } | null)?.nickname);

export async function createRoom(body: unknown, now: Date): Promise<SessionResponse> {
  const { nickname, key } = nicknameFrom(body);
  const roomId = generateRoomId();
  const token = generateToken();
  const participantId = await transaction(async (tx) => {
    await insertRoom(tx, {
      id: roomId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ROOM_TTL_MS),
      phase: 'lobby',
      config: DEFAULT_CONFIG,
      hostParticipantId: null,
      currentRound: 0,
    });
    const host = await insertParticipant(tx, { roomId, nickname, nicknameKey: key, tokenHash: hashToken(token), now });
    await setRoomHost(tx, roomId, host.id);
    await insertEvent(tx, 'room_created', roomId);
    await writePublicSnapshot(tx, roomId);
    return host.id;
  });
  return { roomId, participantId, token };
}

export async function joinRoom(roomId: string, body: unknown, now: Date): Promise<SessionResponse> {
  const { nickname, key } = nicknameFrom(body);
  const token = generateToken();
  const participantId = await withRoomTx(roomId, now, async (tx) => {
    const participants = await listParticipants(tx, roomId);
    if (participants.length >= MAX_PARTICIPANTS) throw new AppError('ROOM_FULL');
    if (await nicknameTaken(tx, roomId, key)) throw new AppError('NICKNAME_TAKEN');
    const p = await insertParticipant(tx, { roomId, nickname, nicknameKey: key, tokenHash: hashToken(token), now });
    await insertEvent(tx, 'participant_joined', roomId);
    return p.id;
  });
  return { roomId, participantId, token };
}

export async function getMe(roomId: string, token: string | null, now: Date): Promise<MeResponse> {
  return withRoomTx(
    roomId,
    now,
    async (tx, room) => {
      const me = await requireParticipant(tx, room, token);
      const round = room.currentRound > 0 ? await getRound(tx, roomId, room.currentRound) : null;
      const votes = round ? await listVotes(tx, roomId, round.number) : [];
      const runoffVotes = round ? await listRunoffVotes(tx, roomId, round.number) : [];
      return {
        participantId: me.id,
        nickname: me.nickname,
        isHost: room.hostParticipantId === me.id,
        roundNumber: room.currentRound,
        isSpectator: round ? isSpectator(me, round) : false,
        cardOrder: round ? cardOrder(me.id, round.number) : [],
        myVotes: votes.filter((v) => v.participantId === me.id).map(({ categoryId, value }) => ({ categoryId, value })),
        myRunoffVote: runoffVotes.find((v) => v.participantId === me.id)?.categoryId ?? null,
      };
    },
    { snapshot: false, lock: false },
  );
}

export async function recordOpened(roomId: string): Promise<{ ok: true }> {
  await insertEvent(sql, 'link_opened', roomId);
  return { ok: true };
}

export async function updateConfig(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }> {
  const config = parseConfig(body);
  await withRoomTx(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    requireHost(room, me);
    if (!canTransition(room.phase, 'config')) throw new AppError('WRONG_PHASE');
    await setRoomConfig(tx, roomId, config);
  });
  return { ok: true };
}

export const HOST_TIMEOUT_MS = 30_000;

/**
 * Marca al participante como conectado. En `lobby`/`result`, si el anfitrión lleva más de 30 s sin
 * señal, pasa el rol al participante activo que entró primero. Solo reescribe la foto si cambió el rol.
 */
export async function heartbeat(
  roomId: string,
  token: string | null,
  now: Date,
): Promise<{ hostParticipantId: string | null }> {
  const hostParticipantId = await withRoomTx(
    roomId,
    now,
    async (tx, room) => {
      const me = await requireParticipant(tx, room, token);
      await touchParticipant(tx, me.id, now);
      if (room.phase !== 'lobby' && room.phase !== 'result') return room.hostParticipantId;

      const participants = (await listParticipants(tx, roomId)).map((p) => (p.id === me.id ? { ...p, lastSeenAt: now } : p));
      const isActive = (lastSeenAt: Date) => now.getTime() - lastSeenAt.getTime() <= HOST_TIMEOUT_MS;
      const host = participants.find((p) => p.id === room.hostParticipantId);
      if (host && isActive(host.lastSeenAt)) return room.hostParticipantId;

      const candidate = participants.find((p) => isActive(p.lastSeenAt)); // ya vienen ordenados por joined_at
      if (!candidate || candidate.id === room.hostParticipantId) return room.hostParticipantId;
      await setRoomHost(tx, roomId, candidate.id);
      await writePublicSnapshot(tx, roomId);
      return candidate.id;
    },
    { snapshot: false },
  );
  return { hostParticipantId };
}

export async function replay(roomId: string, token: string | null, now: Date): Promise<{ ok: true }> {
  await withRoomTx(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    requireHost(room, me);
    if (!canTransition(room.phase, 'replay')) throw new AppError('WRONG_PHASE');
    await setRoomPhase(tx, roomId, 'lobby');
    await insertEvent(tx, 'replay', roomId);
  });
  return { ok: true };
}
