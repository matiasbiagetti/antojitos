import type { CategoryId, RoomConfig, VoteValue } from '@/lib/domain/types';
import type { ErrorCode, MeResponse, SessionResponse } from '@/lib/shared/api-types';
import { updateServerTime } from './clock';

export class ApiError extends Error {
  constructor(public readonly code: ErrorCode | 'NETWORK') {
    super(code);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, opts: { token?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers['x-participant-token'] = opts.token;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const data = (await res.json().catch(() => ({}))) as { serverTime?: number; error?: { code?: ErrorCode } };
  if (typeof data.serverTime === 'number') updateServerTime(data.serverTime);
  if (!res.ok) throw new ApiError(data.error?.code ?? 'INTERNAL');
  return data as T;
}

const room = (roomId: string, action: string) => `/api/rooms/${encodeURIComponent(roomId)}/${action}`;

export const createRoom = (nickname: string) => call<SessionResponse>('POST', '/api/rooms', { body: { nickname } });

export const joinRoom = (roomId: string, nickname: string) =>
  call<SessionResponse>('POST', room(roomId, 'join'), { body: { nickname } });

export const getMe = (roomId: string, token: string) => call<MeResponse>('GET', room(roomId, 'me'), { token });

export const markOpened = (roomId: string) => call<{ ok: true }>('POST', room(roomId, 'opened'));

export const updateConfig = (roomId: string, token: string, config: RoomConfig) =>
  call<{ ok: true }>('POST', room(roomId, 'config'), { token, body: config });

export const startRound = (roomId: string, token: string) =>
  call<{ roundNumber: number }>('POST', room(roomId, 'start'), { token });

/** Reintenta hasta 3 veces ante fallas de red. Si el servidor ya lo tenía, es éxito. */
export async function sendVote(
  roomId: string,
  token: string,
  vote: { categoryId: CategoryId; value: VoteValue },
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await call('POST', room(roomId, 'vote'), { token, body: vote });
      return;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_VOTED') return;
      if (error instanceof ApiError && error.code === 'NETWORK' && attempt < 3) continue;
      throw error;
    }
  }
}

export const sendRunoffVote = (roomId: string, token: string, categoryId: CategoryId) =>
  call<{ ok: true }>('POST', room(roomId, 'runoff-vote'), { token, body: { categoryId } });

export const closeRoom = (roomId: string) => call<{ ok: true }>('POST', room(roomId, 'close'));

export const heartbeat = (roomId: string, token: string) =>
  call<{ hostParticipantId: string | null; canTakeHost: boolean }>('POST', room(roomId, 'heartbeat'), { token });

export const takeHost = (roomId: string, token: string) =>
  call<{ ok: true }>('POST', room(roomId, 'take-host'), { token });

export const replay = (roomId: string, token: string) => call<{ ok: true }>('POST', room(roomId, 'replay'), { token });
