import { describe, expect, it } from 'vitest';
import { classifySwipe, hintFor } from '@/lib/client/swipe';

const still = { x: 0, y: 0 };

describe('classifySwipe', () => {
  it.each([
    [{ x: 150, y: 10 }, still, 'yes'],
    [{ x: -150, y: 10 }, still, 'no'],
    [{ x: 20, y: -150 }, still, 'super'],
    [{ x: 30, y: 0 }, { x: 900, y: 0 }, 'yes'], // flick rápido
    [{ x: 0, y: -30 }, { x: 0, y: -900 }, 'super'],
    [{ x: 50, y: 40 }, still, null], // no alcanza
    [{ x: 0, y: 150 }, still, null], // hacia abajo no hace nada
  ] as const)('offset %j velocity %j -> %s', (offset, velocity, expected) => {
    expect(classifySwipe(offset, velocity)).toBe(expected);
  });
});

describe('hintFor', () => {
  it('shows a hint earlier than the commit threshold', () => {
    expect(hintFor({ x: 50, y: 0 })).toBe('yes');
    expect(hintFor({ x: -50, y: 0 })).toBe('no');
    expect(hintFor({ x: 0, y: -50 })).toBe('super');
    expect(hintFor({ x: 10, y: 10 })).toBeNull();
  });
});
