'use client';

import { useState } from 'react';
import { takeHost } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';

export function TakeHostBanner({ roomId, token, hostNickname }: { roomId: string; token: string; hostNickname: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 text-center shadow-sm">
      <p className="text-ink/70">{hostNickname} no responde hace un rato.</p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          takeHost(roomId, token)
            .catch((err) => setError(messageFor(err)))
            .finally(() => setPending(false));
        }}
        className="rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-white shadow-md disabled:opacity-60"
      >
        Tomar el control
      </button>
    </section>
  );
}
