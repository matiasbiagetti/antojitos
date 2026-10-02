export interface LatestWinsSaver<T> {
  /** Queues `value`. Resolves when the drain that covers it finishes; rejects if a send failed. */
  save(value: T): Promise<void>;
  /** Never rejects. Resolves once nothing is in flight or queued: true if the drain it waited on succeeded (or there was none), false if it failed. */
  idle(): Promise<boolean>;
  pending(): boolean;
}

/**
 * Serializes saves: at most one `send` in flight. Saves made meanwhile are coalesced so
 * only the latest value is sent once the current request finishes. If a send fails, the
 * queued value is dropped on purpose: the UI reverts to the server state and shows the
 * error, so sending a newer value on top of a failed one would contradict what the user sees.
 * The saver is then ready for new saves.
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
      return drain
        ? drain.then(
            () => true,
            () => false,
          )
        : Promise.resolve(true);
    },
    pending: () => drain !== null,
  };
}
