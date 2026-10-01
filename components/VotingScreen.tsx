'use client';

import { useState } from 'react';
import { ApiError, sendVote } from '@/lib/client/api';
import type { CategoryId, VoteValue } from '@/lib/domain/types';
import { Countdown } from './Countdown';
import type { PhaseProps } from './RoomScreen';
import { SwipeDeck } from './SwipeDeck';

export function VotingScreen({ roomId, session, snapshot, me }: PhaseProps) {
  const round = snapshot.round!;
  const [voted, setVoted] = useState(() => new Set<CategoryId>(me.myVotes.map((v) => v.categoryId)));
  const [superUsed, setSuperUsed] = useState(() => me.myVotes.some((v) => v.value === 'super'));
  const [notice, setNotice] = useState<string | null>(null);

  const isSpectator = me.isSpectator || round.spectatorIds.includes(session.participantId);
  const remaining = me.cardOrder.filter((id) => !voted.has(id));
  const current = remaining[0];

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(null), 1800);
  }

  async function vote(categoryId: CategoryId, value: VoteValue) {
    setVoted((prev) => new Set(prev).add(categoryId));
    if (value === 'super') setSuperUsed(true);
    try {
      await sendVote(roomId, session.token, { categoryId, value });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SUPER_ALREADY_USED') flash('Ya usaste tu súper antojo');
      // WRONG_PHASE: la ronda ya cerró; la foto pública nos lleva a la pantalla siguiente.
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <Countdown until={round.deadline} />
        <p className="text-sm font-bold text-ink/70">
          {round.finishedCount} de {round.voterCount} terminaron
        </p>
      </header>

      {isSpectator ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-5xl">👀</p>
          <h1 className="text-2xl font-extrabold">La ronda ya arrancó</h1>
          <p className="text-ink/70">Vas a ver el resultado y podés jugar la próxima. Si hay ballotage, votás.</p>
        </section>
      ) : current ? (
        <>
          <p className="text-center text-sm font-bold text-ink/60">
            {me.cardOrder.length - remaining.length + 1} de {me.cardOrder.length}
          </p>
          <SwipeDeck
            key={current}
            categoryId={current}
            superAvailable={!superUsed}
            onVote={(value) => void vote(current, value)}
            onSuperBlocked={() => flash('Ya usaste tu súper antojo')}
          />
        </>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-5xl">🙌</p>
          <h1 className="text-2xl font-extrabold">¡Listo! Esperando al resto…</h1>
        </section>
      )}

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-28 z-40 rounded-2xl bg-ink px-4 py-3 text-center font-bold text-white">
          {notice}
        </p>
      )}
    </main>
  );
}
