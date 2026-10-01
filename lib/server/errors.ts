import type { ErrorCode } from '@/lib/shared/api-types';

const STATUS: Record<ErrorCode, number> = {
  ROOM_NOT_FOUND: 404,
  ROOM_EXPIRED: 410,
  ROOM_FULL: 409,
  NICKNAME_TAKEN: 409,
  INVALID_NICKNAME: 400,
  INVALID_TOKEN: 401,
  NOT_HOST: 403,
  WRONG_PHASE: 409,
  NOT_ENOUGH_PLAYERS: 409,
  SUPER_ALREADY_USED: 409,
  ALREADY_VOTED: 409,
  SPECTATOR: 403,
  INVALID_INPUT: 400,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }

  get status(): number {
    return STATUS[this.code];
  }
}
