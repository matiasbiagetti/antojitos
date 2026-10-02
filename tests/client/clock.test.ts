import { afterEach, describe, expect, it, vi } from 'vitest';
import { msUntil, onClockChange, resetClock, serverNow, updateServerTime } from '@/lib/client/clock';

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

  it('notifies listeners on large offset changes (>500ms) but not small ones', () => {
    const baseTime = 1000000;
    // Initialize offset to baseTime
    updateServerTime(baseTime, baseTime);

    const listener = vi.fn();
    const unsubscribe = onClockChange(listener);

    // Small change (< 500ms) - no notification
    updateServerTime(baseTime + 100, baseTime);
    expect(listener).not.toHaveBeenCalled();

    // Large change (> 500ms) - notification fires
    updateServerTime(baseTime + 700, baseTime);
    expect(listener).toHaveBeenCalledTimes(1);

    // Another large change (from 700 to 100, delta = 600 > 500)
    updateServerTime(baseTime + 100, baseTime);
    expect(listener).toHaveBeenCalledTimes(2);

    // Unsubscribe and verify no more notifications
    unsubscribe();
    updateServerTime(baseTime + 750, baseTime);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
