import { describe, expect, it } from 'vitest';
import { cryptoRng, hashSeed, pickOne, seededRng, shuffle } from '@/lib/domain/random';

describe('seededRng', () => {
  it('is deterministic for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('returns numbers in [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('is stable and differs for different inputs', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });
});

describe('shuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRng(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('pickOne', () => {
  it('picks by rng position', () => {
    expect(pickOne(['a', 'b', 'c'], { next: () => 0 })).toBe('a');
    expect(pickOne(['a', 'b', 'c'], { next: () => 0.999 })).toBe('c');
  });

  it('throws on empty input', () => {
    expect(() => pickOne([], { next: () => 0 })).toThrow();
  });
});

describe('cryptoRng', () => {
  it('returns numbers in [0, 1)', () => {
    const n = cryptoRng.next();
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(1);
  });
});
