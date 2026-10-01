'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ApiError, sendRunoffVote } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';
import { categoryImage, categoryName } from '@/lib/domain/categories';
import type { CategoryId } from '@/lib/domain/types';
import { Countdown } from './Countdown';
import type { PhaseProps } from './RoomScreen';

export function RunoffScreen({ roomId, session, snapshot, me }: PhaseProps) {
  const round = snapshot.round!;
  const finalists = round.finalists ?? [];
  const [choice, setChoice] = useState<CategoryId | null>(me.myRunoffVote);
  const [error, setError] = useState<string | null>(null);

  async function choose(categoryId: CategoryId) {
    if (choice) return;
    setChoice(categoryId);
    try {
      await sendRunoffVote(roomId, session.token, categoryId);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'ALREADY_VOTED' || err.code === 'WRONG_PHASE')) return;
      setChoice(null);
      setError(messageFor(err));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-primary">¡Hay empate!</h1>
        {round.runoffDeadline && <Countdown until={round.runoffDeadline} />}
      </header>
      <p className="text-lg">{choice ? 'Listo, ya votaste.' : 'Elegí una sola. La más votada gana.'}</p>
      <div className="grid gap-3">
        {finalists.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => void choose(id)}
            disabled={choice !== null}
            aria-pressed={choice === id}
            className={`relative h-32 overflow-hidden rounded-3xl bg-secondary text-left shadow-md transition ${
              choice === id ? 'ring-4 ring-primary' : choice ? 'opacity-50' : 'active:scale-[0.98]'
            }`}
          >
            <Image src={categoryImage(id)} alt="" fill sizes="448px" className="object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-4 text-2xl font-black text-white">
              {categoryName(id)}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <p className="text-center text-sm font-bold text-ink/70">
        {round.runoffVotedCount ?? 0} de {snapshot.participants.length} votaron
      </p>
    </main>
  );
}
