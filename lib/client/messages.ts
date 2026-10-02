import type { ErrorCode } from '@/lib/shared/api-types';
import { ApiError } from './api';

export const ERROR_MESSAGES: Record<ErrorCode | 'NETWORK', string> = {
  ROOM_NOT_FOUND: 'Esta sala no existe.',
  ROOM_EXPIRED: 'Esta sala expiró.',
  ROOM_FULL: 'La sala está llena (15/15).',
  NICKNAME_TAKEN: 'Ese apodo ya lo está usando alguien en la sala. Probá con otro.',
  INVALID_NICKNAME: 'El apodo tiene que tener entre 1 y 20 caracteres.',
  INVALID_AVATAR: 'Ese avatar no está disponible. Recargá la página y elegí otro.',
  INVALID_TOKEN: 'No te reconocemos en esta sala. Volvé a entrar con tu apodo.',
  NOT_HOST: 'Solo quien arma la sala puede hacer eso.',
  WRONG_PHASE: 'Eso ya no se puede hacer en este momento.',
  HOST_STILL_ACTIVE: 'Ya volvió quien arma la sala o alguien más tomó el control.',
  NOT_ENOUGH_PLAYERS: 'Hacen falta al menos 2 personas para arrancar.',
  SUPER_ALREADY_USED: 'Ya usaste tu súper antojo.',
  ALREADY_VOTED: 'Ya votaste esa.',
  SPECTATOR: 'Esta ronda ya arrancó. Votás en la próxima.',
  INVALID_INPUT: 'Algo no salió bien. Probá de nuevo.',
  INTERNAL: 'Se nos quemó algo en la cocina. Probá de nuevo.',
  NETWORK: 'Sin conexión. Revisá tu internet.',
};

export function messageFor(error: unknown): string {
  return error instanceof ApiError ? ERROR_MESSAGES[error.code] : ERROR_MESSAGES.INTERNAL;
}
