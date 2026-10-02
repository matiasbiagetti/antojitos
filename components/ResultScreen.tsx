'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { replay } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';
import { categoryName } from '@/lib/domain/categories';
import type { CategoryId, PublicResult, ResultPath } from '@/lib/domain/types';
import type { PhaseProps } from './RoomScreen';
import { Avatar } from './Avatar';
import { CategoryPhoto } from './CategoryPhoto';
import { TakeHostBanner } from './TakeHostBanner';

const PATH_TEXT: Record<ResultPath, string> = {
  no_cravings: 'Nadie sumó puntos.',
  direct: 'Ganó directo, sin discusión.',
  runoff: 'Se definió en el ballotage.',
  roulette_after_skip: 'Empate clavado: se fue directo a la ruleta.',
  roulette_after_runoff: 'El ballotage volvió a empatar: decidió la ruleta.',
};

const VOTE_ICON = { super: '⭐', yes: '✓', no: '✗' } as const;

function Breakdown({ result }: { result: PublicResult }) {
  const rows: CategoryId[] = result.ranking ?? result.scores?.map((s) => s.categoryId) ?? result.superCounts?.map((s) => s.categoryId) ?? [];
  if (rows.length === 0) return null;
  const firstRound =
    (result.tiebreak !== undefined && result.tiebreak.path !== 'direct') ||
    (result.winner !== null && result.ranking?.[0] !== result.winner);
  const title = result.ranking ? (firstRound ? 'Ranking de la primera vuelta' : 'Ranking') : 'Detalle';
  const score = (id: CategoryId) => result.scores?.find((s) => s.categoryId === id)?.score;
  const supers = (id: CategoryId) => result.superCounts?.find((s) => s.categoryId === id)?.superCount;
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-extrabold">{title}</h2>
      <ol className="space-y-1">
        {rows.map((id, i) => (
          <li key={id} className="flex items-center justify-between gap-2">
            <span>
              {result.ranking && <span className="mr-2 font-bold text-ink/50">{i + 1}.</span>}
              {categoryName(id)}
            </span>
            <span className="font-bold tabular-nums">
              {[score(id) !== undefined ? `${score(id)} pts` : null, supers(id) ? `${supers(id)} ⭐` : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ResultScreen({ roomId, session, snapshot, isHost, canTakeHost }: PhaseProps) {
  const result = snapshot.round?.result;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const host = snapshot.participants.find((p) => p.id === snapshot.hostParticipantId);
  if (!result) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      {result.winner ? (
        <motion.section
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="relative h-72 overflow-hidden rounded-3xl bg-ink/10 shadow-xl"
        >
          <CategoryPhoto categoryId={result.winner} sizes="448px" priority />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-20">
            <p className="text-sm font-bold uppercase tracking-wide text-secondary">🎉 ¡Match!</p>
            <h1 className="text-4xl font-black text-white">¡Se come {categoryName(result.winner)}!</h1>
          </div>
        </motion.section>
      ) : (
        <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-5xl">🤷</p>
          <h1 className="mt-2 text-3xl font-black">No hubo antojos</h1>
          <p className="mt-1 text-ink/70">Nadie sumó puntos. ¿Otra ronda?</p>
        </section>
      )}

      {result.tiebreak && result.winner && <p className="text-center font-bold text-ink/70">{PATH_TEXT[result.tiebreak.path]}</p>}

      {result.tiebreak?.runoffCounts && (
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-extrabold">Ballotage</h2>
          <ul className="space-y-1">
            {result.tiebreak.runoffCounts.map((c) => (
              <li key={c.categoryId} className="flex justify-between">
                <span>{categoryName(c.categoryId)}</span>
                <span className="font-bold">{c.votes} votos</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Breakdown result={result} />

      {result.individualVotes && (
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-extrabold">Quién votó qué</h2>
          <ul className="space-y-3">
            {result.individualVotes.map((person) => (
              <li key={person.nickname}>
                <p className="flex items-center gap-2 font-bold">
                  <Avatar id={person.avatarId} size={32} />
                  {person.nickname}
                </p>
                <p className="text-sm text-ink/80">
                  {person.votes.filter((v) => v.value !== 'no').map((v) => `${VOTE_ICON[v.value]} ${categoryName(v.categoryId)}`).join(' · ') ||
                    'No le fue nada'}
                </p>
                {person.runoffChoice && (
                  <p className="text-sm text-ink/60">Ballotage: {categoryName(person.runoffChoice)}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      {isHost ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            replay(roomId, session.token)
              .catch((err) => setError(messageFor(err)))
              .finally(() => setPending(false));
          }}
          className="rounded-2xl disabled:opacity-60 bg-primary px-4 py-4 text-xl font-extrabold text-white shadow-md"
        >
          Jugar otra ronda
        </button>
      ) : canTakeHost ? (
        <TakeHostBanner roomId={roomId} token={session.token} hostNickname={host?.nickname ?? 'El anfitrión'} />
      ) : (
        <p className="text-center text-ink/70">Si quieren otra, {host?.nickname ?? 'el anfitrión'} la arranca.</p>
      )}
    </main>
  );
}
