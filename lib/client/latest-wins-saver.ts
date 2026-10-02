export interface LatestWinsSaver<T> {
  /** Queues `value`. Resolves when the drain that covers it finishes; rejects if a send failed. */
  save(value: T): Promise<void>;
  /** Resolves (never rejects) once nothing is in flight or queued. */
  idle(): Promise<void>;
  pending(): boolean;
}

/**
 * Serializes saves: at most one `send` in flight. Saves made meanwhile are coalesced so
 * only the latest value is sent once the current request finishes. If a send fails, the
 * queued value is dropped (the caller is expected to revert to server state) and the
 * saver is ready for new saves.
 */
export function createLatestWinsSaver<T>(send: (value: T) => Promise<void>): LatestWinsSaver<T> {
  let queued: { value: T } | null = null;
  let drain: Promise<void> | null = null;

  async function run() {
    try {
      while (queued) {
        const { value } = queued;
        queued = null;
        await send(value);
      }
    } finally {
      queued = null;
      drain = null;
    }
  }

  return {
    save(value) {
      queued = { value };
      drain ??= run();
      return drain;
    },
    idle() {
      return drain ? drain.then(
        () => undefined,
        () => undefined,
      ) : Promise.resolve();
    },
    pending: () => drain !== null,
  };
}
