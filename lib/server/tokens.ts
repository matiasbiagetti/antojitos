import { createHash, randomBytes } from 'node:crypto';

const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRoomId(): string {
  return [...randomBytes(8)].map((b) => ROOM_ID_ALPHABET[b % ROOM_ID_ALPHABET.length]).join('');
}
