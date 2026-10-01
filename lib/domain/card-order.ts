import { CATEGORY_IDS } from './categories';
import { hashSeed, seededRng, shuffle } from './random';
import type { CategoryId } from './types';

/** Orden de tarjetas por participante y ronda. Determinístico: recargar la página da el mismo orden. */
export function cardOrder(participantId: string, roundNumber: number): CategoryId[] {
  return shuffle(CATEGORY_IDS, seededRng(hashSeed(`${participantId}:${roundNumber}`)));
}
