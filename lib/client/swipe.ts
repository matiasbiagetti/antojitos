import type { VoteValue } from '@/lib/domain/types';

export const SWIPE_DISTANCE = 110;
export const SWIPE_VELOCITY = 600;
export const HINT_DISTANCE = 40;

type Vec = { x: number; y: number };

function direction(offset: Vec, velocity: Vec, distance: number, speed: number): VoteValue | null {
  // Upward only if the signal crosses its threshold AND dominates its horizontal component
  const upwardViaOffset = -offset.y > distance && -offset.y > Math.abs(offset.x);
  const upwardViaVelocity = -velocity.y > speed && -velocity.y > Math.abs(velocity.x);

  if (upwardViaOffset || upwardViaVelocity) return 'super';

  // Otherwise check horizontal
  if (Math.abs(offset.x) > distance || Math.abs(velocity.x) > speed) {
    const sign = offset.x !== 0 ? offset.x : velocity.x;
    return sign > 0 ? 'yes' : 'no';
  }
  return null;
}

/** Arriba = súper antojo, derecha = me va, izquierda = paso. Hacia abajo no hace nada. */
export function classifySwipe(offset: Vec, velocity: Vec): VoteValue | null {
  return direction(offset, velocity, SWIPE_DISTANCE, SWIPE_VELOCITY);
}

export function hintFor(offset: Vec): VoteValue | null {
  return direction(offset, { x: 0, y: 0 }, HINT_DISTANCE, Infinity);
}
