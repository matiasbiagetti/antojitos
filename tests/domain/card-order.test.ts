import { describe, expect, it } from 'vitest';
import { cardOrder } from '@/lib/domain/card-order';
import { CATEGORY_IDS } from '@/lib/domain/categories';

describe('cardOrder', () => {
  it('is a permutation of the 14 categories', () => {
    const order = cardOrder('participant-1', 1);
    expect(order).toHaveLength(14);
    expect([...order].sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it('is deterministic for the same participant and round (survives reloads)', () => {
    expect(cardOrder('participant-1', 1)).toEqual(cardOrder('participant-1', 1));
  });

  it('changes between participants and between rounds', () => {
    expect(cardOrder('participant-1', 1)).not.toEqual(cardOrder('participant-2', 1));
    expect(cardOrder('participant-1', 1)).not.toEqual(cardOrder('participant-1', 2));
  });
});
