import { afterEach, describe, expect, it, vi } from 'vitest';
import { msUntil, resetClock, serverNow, updateServerTime } from '@/lib/client/clock';

describe('server clock (Review Focus 4)', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetClock();
  });

  it('corrects a device clock that is 5 minutes ahead', () => {
    const server = Date.parse('2026-10-01T20:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(server + 5 * 60_000);
    updateServerTime(server);
    expect(serverNow()).toBe(server);
    expect(msUntil(new Date(server + 60_000).toISOString())).toBe(60_000);
  });

  it('without server time it falls back to the device clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    expect(serverNow()).toBe(1_000);
  });
});
