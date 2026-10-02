import { describe, expect, it } from 'vitest';
import { createLatestWinsSaver } from '@/lib/client/latest-wins-saver';

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createLatestWinsSaver', () => {
  it('sends a single save', async () => {
    const sent: number[] = [];
    const saver = createLatestWinsSaver<number>(async (v) => {
      sent.push(v);
    });
    expect(saver.pending()).toBe(false);
    const p = saver.save(1);
    expect(saver.pending()).toBe(true);
    await p;
    expect(sent).toEqual([1]);
    expect(saver.pending()).toBe(false);
  });

  it('coalesces rapid saves into first + last only', async () => {
    const sent: number[] = [];
    const gates: ReturnType<typeof deferred>[] = [];
    const saver = createLatestWinsSaver<number>((v) => {
      sent.push(v);
      const d = deferred();
      gates.push(d);
      return d.promise;
    });
    const p1 = saver.save(1);
    const p2 = saver.save(2);
    const p3 = saver.save(3);
    expect(sent).toEqual([1]);
    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(sent).toEqual([1, 3]);
    gates[1].resolve();
    await Promise.all([p1, p2, p3]);
    expect(sent).toEqual([1, 3]);
  });

  it('propagates errors and recovers for later saves', async () => {
    const sent: number[] = [];
    let fail = true;
    const saver = createLatestWinsSaver<number>(async (v) => {
      sent.push(v);
      if (fail) throw new Error('boom');
    });
    await expect(saver.save(1)).rejects.toThrow('boom');
    expect(saver.pending()).toBe(false);
    fail = false;
    await saver.save(2);
    expect(sent).toEqual([1, 2]);
  });

  it('idle() resolves only after the last save', async () => {
    const sent: number[] = [];
    const gates: ReturnType<typeof deferred>[] = [];
    const saver = createLatestWinsSaver<number>((v) => {
      sent.push(v);
      const d = deferred();
      gates.push(d);
      return d.promise;
    });
    await saver.idle(); // nothing pending: resolves right away
    void saver.save(1);
    void saver.save(2);
    let idle = false;
    const idleP = saver.idle().then(() => {
      idle = true;
    });
    gates[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(idle).toBe(false);
    gates[1].resolve();
    await idleP;
    expect(idle).toBe(true);
    expect(sent).toEqual([1, 2]);
  });
});
