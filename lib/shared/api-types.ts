import type { CategoryId, PublicResult, RoomConfig, RoomPhase, VoteValue } from '@/lib/domain/types';

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_EXPIRED'
  | 'ROOM_FULL'
  | 'NICKNAME_TAKEN'
  | 'INVALID_NICKNAME'
  | 'INVALID_TOKEN'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'HOST_STILL_ACTIVE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'SUPER_ALREADY_USED'
  | 'ALREADY_VOTED'
  | 'SPECTATOR'
  | 'INVALID_INPUT'
  | 'INTERNAL';

export type ApiErrorBody = { error: { code: ErrorCode; message: string }; serverTime: number };

export type PublicRound = {
  number: number;
  deadline: string;
  finishedCount: number;
  voterCount: number;
  spectatorIds: string[];
  finalists?: CategoryId[];
  runoffDeadline?: string;
  runoffVotedCount?: number;
  roulette?: { segments: CategoryId[]; winner: CategoryId; endsAt: string };
  result?: PublicResult;
};

/** Lo único que los clientes leen de la base. Nunca contiene tokens ni votos individuales (salvo PublicResult.individualVotes). */
export type PublicSnapshot = {
  roomId: string;
  version: number;
  phase: RoomPhase;
  expiresAt: string;
  hostParticipantId: string | null;
  config: RoomConfig;
  participants: { id: string; nickname: string }[];
  round?: PublicRound;
};

export type SessionResponse = { roomId: string; participantId: string; token: string };

export type MeResponse = {
  participantId: string;
  nickname: string;
  isHost: boolean;
  roundNumber: number;
  isSpectator: boolean;
  cardOrder: CategoryId[];
  myVotes: { categoryId: CategoryId; value: VoteValue }[];
  myRunoffVote: CategoryId | null;
};
