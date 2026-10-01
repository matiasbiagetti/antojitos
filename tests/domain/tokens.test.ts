import { describe, expect, it } from 'vitest';
import { generateRoomId, generateToken, hashToken } from '@/lib/server/tokens';

describe('tokens', () => {
  it('generates long random tokens', () => {
    const a = generateToken();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(generateToken());
  });

  it('hashes deterministically to hex sha256', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates 8-char room ids without ambiguous characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRoomId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    }
  });
});
